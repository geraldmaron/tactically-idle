import { describe, expect, it } from 'vitest';
import { generateIncident } from '../gen/incident';
import { specForSituation } from '../gen/incident/gates/catalog';
import { applyNaturalMove, firstMove, startGateRun, withDraftScenario } from '../gen/incident/gates/engine-driver';
import { choiceActionId } from '../gen/incident/trees-v13/compile';
import { SCENARIO_TYPES_V11 } from '../content/scenario-types-v11';
import { buildLocation } from './location';
import { applyMoves, meterConditionsHold, meterContributors, METERS_V1, stanceOf } from './meters';
import { matchedEffects, traceRun } from './operation';
import { evaluateAction } from './resolution';
import { deserialize, serialize } from './save';
import { NOW } from './test-fixtures';
import type { ActionDefinition, IncidentPersonDef, MeterEvent, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { GameState, OperationRun } from './types';

// M2 slice 3 (docs/incident-domain-model.md §2): a subject's agitation and rapport move with what
// the team does, as far as their volatility says, and every later conversation with them shows it.

const subject = (volatility: IncidentPersonDef['volatility']): IncidentPersonDef => ({
  id: 'taker', kind: 'subject', label: 'Ash', minor: false, spaceId: 'r1', at: { x: 0, y: 0 }, meters: { agitation: 60, rapport: 10 }, volatility,
});
const after = (volatility: IncidentPersonDef['volatility'], ...events: MeterEvent[]) => {
  const scenario = { incidentPeople: [subject(volatility)] } as ScenarioDefinition;
  const run: Pick<OperationRun, 'meters'> = { meters: { taker: { agitation: 60, rapport: 10, moved: {} } } };
  applyMoves(run, scenario, events.map(event => ({ moves: [{ personId: 'taker', event }] })));
  return run.meters!.taker;
};

describe('meters: the model', () => {
  it('move by the standard event, scaled by volatility', () => {
    const steady = after('steady', 'provoked'), shifting = after('shifting', 'provoked'), volatile = after('volatile', 'provoked');
    expect(shifting.agitation - 60).toBe(METERS_V1.events.provoked.agitation);
    expect(steady.agitation - 60).toBeLessThan(shifting.agitation - 60);
    expect(volatile.agitation - 60).toBeGreaterThan(shifting.agitation - 60);
    expect(volatile.rapport).toBeLessThan(steady.rapport);
  });

  it('stay inside 0 to 100, and record only what actually moved', () => {
    const pushed = after('volatile', 'provoked', 'provoked', 'shots', 'shots');
    expect(pushed.agitation).toBe(100);
    expect(pushed.rapport).toBe(0);
    expect((pushed.moved.provoked!.rapport ?? 0) + (pushed.moved.shots!.rapport ?? 0)).toBe(-10);
  });

  it('show on a conversation as what changed since the call began, and nothing at the start', () => {
    const person = subject('shifting');
    expect(meterContributors(person, { agitation: 60, rapport: 10, moved: {} })).toEqual([]);
    const heard = meterContributors(person, after('shifting', 'heard'));
    expect(heard.every(c => c.value > 0)).toBe(true);
    expect(heard.map(c => c.label)).toEqual(['Ash is talking to you more', 'Ash is steadier now']);
    const stung = meterContributors(person, after('shifting', 'provoked'));
    expect(stung.every(c => c.value < 0)).toBe(true);
    const volatile = meterContributors(subject('volatile'), after('volatile', 'provoked'));
    expect(volatile.reduce((sum, c) => sum + c.value, 0)).toBeLessThan(stung.reduce((sum, c) => sum + c.value, 0));
  });

  it('read as a stance only once the team has heard from the subject', () => {
    expect(stanceOf({ agitation: 90, rapport: 0, moved: {} })).toBe('unheard');
    expect(stanceOf(after('volatile', 'provoked', 'provoked'))).toBe('breaking');
    expect(stanceOf(after('shifting', 'heard', 'heard', 'heard', 'heard', 'contact'))).toBe('yielding');
  });
});

describe('meters: in the calls', () => {
  const s = generateIncident(specForSituation('hostage_crisis', 'market_row', 0));
  const built = buildLocation(s.locationFamilyId, s.locationSeed);
  const odds = (actionSuffix: string, meters: NonNullable<OperationRun['meters']>[string] | null, patch: (scenario: ScenarioDefinition) => void = () => {}) => {
    const state = startGateRun(s.id, 719);
    const run = structuredClone(state.activeRun!);
    if (meters) run.meters = { taker: meters };
    const scenario = structuredClone(s);
    patch(scenario);
    const action = Object.values(scenario.stages).flatMap(stage => stage.actions).find(entry => entry.id.endsWith(actionSuffix))!;
    const ev = evaluateAction({ state, run, scenario, action, built, acting: ['A'], support: [] });
    return { p: ev.pFavorable, labels: ev.contributors.map(c => c.label) };
  };
  const volatility = s.incidentPeople!.find(person => person.id === 'taker')!.volatility!;

  it('make talking to the subject easier after the team heard them out, and harder after it provoked them', () => {
    const start = odds('_offer_ask_both', null);
    const heard = odds('_offer_ask_both', after(volatility, 'heard'));
    const provoked = odds('_offer_ask_both', after(volatility, 'provoked'));
    expect(heard.p).toBeGreaterThan(start.p);
    expect(provoked.p).toBeLessThan(start.p);
    expect(heard.labels.some(label => label.endsWith('is talking to you more'))).toBe(true);
  });

  it('leave a conversation with someone else, and work that is not a conversation, alone', () => {
    const moved = after(volatility, 'provoked');
    const elsewhere = odds('_offer_ask_both', moved, scenario => {
      for (const action of Object.values(scenario.stages).flatMap(stage => stage.actions)) if (action.id.endsWith('_offer_ask_both')) action.talksTo = 'courier';
    });
    expect(elsewhere.p).toBe(odds('_offer_ask_both', null, scenario => {
      for (const action of Object.values(scenario.stages).flatMap(stage => stage.actions)) if (action.id.endsWith('_offer_ask_both')) action.talksTo = 'courier';
    }).p);
    expect(odds('_offer_take_courier', moved).p).toBe(odds('_offer_take_courier', null).p);
  });
});

// M2 slice 5 (docs/incident-domain-model.md §8): escalation from meters. An outcome can branch on a
// subject's stance or agitation as it stands when the decision starts, like a hidden truth.

describe('meters: escalation branches, the model', () => {
  const runAt = (agitation: number, rapport: number, heard = true): Pick<OperationRun, 'meters'> =>
    ({ meters: { taker: { agitation, rapport, moved: heard ? { provoked: { agitation: 10, rapport: -8 } } : {} } } });

  it('read the stance and the agitation as they stand, both when given, and negate with is: false', () => {
    expect(meterConditionsHold([{ personId: 'taker', stance: ['breaking'], is: true }], runAt(85, 10))).toBe(true);
    expect(meterConditionsHold([{ personId: 'taker', stance: ['breaking'], is: true }], runAt(70, 10))).toBe(false);
    expect(meterConditionsHold([{ personId: 'taker', stance: ['volatile', 'breaking'], is: true }], runAt(70, 10))).toBe(true);
    expect(meterConditionsHold([{ personId: 'taker', agitationAtLeast: 70, is: true }], runAt(70, 10))).toBe(true);
    expect(meterConditionsHold([{ personId: 'taker', stance: ['volatile'], agitationAtLeast: 75, is: true }], runAt(70, 10))).toBe(false);
    expect(meterConditionsHold([{ personId: 'taker', stance: ['breaking'], is: false }], runAt(70, 10))).toBe(true);
    // Before the team caused any event the subject is unheard, whatever the numbers say.
    expect(meterConditionsHold([{ personId: 'taker', stance: ['unheard'], is: true }], runAt(85, 10, false))).toBe(true);
  });

  it('never match someone with no meters, so the negated branch holds for them', () => {
    expect(meterConditionsHold([{ personId: 'nobody', agitationAtLeast: 0, is: true }], runAt(85, 10))).toBe(false);
    expect(meterConditionsHold([{ personId: 'nobody', agitationAtLeast: 0, is: false }], runAt(85, 10))).toBe(true);
    expect(meterConditionsHold([{ personId: 'taker', agitationAtLeast: 0, is: true }], {})).toBe(false);
  });

  it('let a tree write "the hidden truth decides, or a subject past breaking point does it anyway"', () => {
    // Two routed escalations (the truth, or the meter) and the calm outcome that needs both false.
    const raised = (truth: boolean) => ({ version: 13, facts: [{ id: 'f_raised', truth }], clocks: [] }) as unknown as ScenarioDefinition;
    const breaking = [{ personId: 'taker', stance: ['breaking' as const], is: true }];
    const action = { workload: { base: 5, perSqFt: 0 }, outcomes: { mixed: [], adverse: [], favorable: [
      { truth: [{ factId: 'f_raised', is: true }], text: 'escalates: truth', ending: 'threat' },
      { truth: [{ factId: 'f_raised', is: false }], meters: breaking, text: 'escalates: breaking', ending: 'threat' },
      { truth: [{ factId: 'f_raised', is: false }], meters: [{ ...breaking[0], is: false }], text: 'calm', ending: 'calm' },
    ] } } as unknown as ActionDefinition;
    const texts = (truth: boolean, agitation: number) => matchedEffects(action, 'favorable', { knowledge: {}, flags: [], pressure: 0, ...runAt(agitation, 10) }, raised(truth)).map(effect => effect.text);
    expect(texts(true, 40)).toEqual(['escalates: truth']);
    expect(texts(true, 90)).toEqual(['escalates: truth']);
    expect(texts(false, 90)).toEqual(['escalates: breaking']);
    expect(texts(false, 40)).toEqual(['calm']);
  });
});

describe('meters: escalation branches, in play', () => {
  // A barricade call where every outcome is split on the subject's agitation: the calm side provokes
  // the subject past the line, the other side says ESCALATED. The first decision must take the calm
  // side (the line is read before its own events), the second the escalated one.
  const family = SCENARIO_TYPES_V11.find(info => info.type === 'barricaded')!.families[0];
  const base = generateIncident(specForSituation('barricaded', family, 0));
  const subject = base.incidentPeople!.find(person => person.meters)!;
  const line = subject.meters!.agitation + 3;
  const split = (effect: OutcomeEffect): OutcomeEffect[] => [
    { ...effect, meters: [{ personId: subject.id, agitationAtLeast: line, is: false }],
      moves: [...effect.moves ?? [], { personId: subject.id, event: 'provoked' }, { personId: subject.id, event: 'provoked' }] },
    { ...effect, meters: [{ personId: subject.id, agitationAtLeast: line, is: true }], ...(effect.text ? { text: `ESCALATED ${effect.text}` } : {}) },
  ];
  const draft: ScenarioDefinition = structuredClone(base);
  for (const action of Object.values(draft.stages).flatMap(stage => stage.actions))
    for (const band of ['favorable', 'mixed', 'adverse'] as const) action.outcomes[band] = action.outcomes[band].flatMap(split);
  const loads = (state: GameState) => {
    const copy = structuredClone(state);
    copy.incidents = [];
    delete copy.activeRun!.sourceIncident;
    return deserialize(serialize(copy, NOW)) !== null;
  };

  it('read the meters as they stood when the decision started, replay in traceRun, and save', () => {
    withDraftScenario(draft, id => {
      let played = 0;
      for (let seed = 1; seed <= 20 && played < 3; seed++) {
        let state: GameState | null = applyNaturalMove(startGateRun(id, seed), { kind: 'decide', actionId: choiceActionId('barricaded', 'window', 'call_him') });
        if (!state || state.activeRun!.status !== 'active') continue;
        const move = firstMove(state);
        state = move && applyNaturalMove(state, move);
        if (!state) continue;
        played++;
        const run = state.activeRun!;
        const [first, second] = run.history.map(decision => decision.committed!.consequences.join(' '));
        expect(first).not.toContain('ESCALATED');
        expect(second).toContain('ESCALATED');
        const steps = traceRun(getDraft(id), run).steps;
        expect(steps[0].effects.some(effect => effect.text?.startsWith('ESCALATED'))).toBe(false);
        expect(steps[1].effects.some(effect => effect.text?.startsWith('ESCALATED'))).toBe(true);
        expect(loads(state), `save after seed ${seed}`).toBe(true);
      }
      expect(played).toBeGreaterThan(0);
    });
  });
  const getDraft = (id: string) => ({ ...draft, id });
});
