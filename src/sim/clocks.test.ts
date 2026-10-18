import { describe, expect, it } from 'vitest';
import { generateIncident } from '../gen/incident';
import { specForSituation } from '../gen/incident/gates/catalog';
import { applyMove, applyNaturalMove, startGateRun, withDraftScenario } from '../gen/incident/gates/engine-driver';
import { choiceActionId } from '../gen/incident/trees-v13/compile';
import { actionViews } from './operation-selectors';
import { computeDebrief, traceRun } from './operation';
import { endStates } from './outcome-score';
import { NOW } from './test-fixtures';
import { CLOCK_RULES_V1, clockConditionsHold, clockOutEffects, cueEffects, advanceClocks, stepClock } from './clocks';
import { deserialize, serialize } from './save';
import type { ClockDef, IncidentType, ScenarioDefinition } from './scenario-types';
import type { GameState, StageId } from './types';

// M2 slice 3 (docs/incident-domain-model.md §3): what runs down on the operation's minutes.

const door: ClockDef = { id: 'door', label: 'The door', kind: 'structural', start: 50, ratePerMin: 2.5, rateKnown: false, factId: 'f_door',
  cues: [{ at: 35, text: 'The frame is splitting.', mark: 'door_weak', reveal: true }] };
const tank: ClockDef = { id: 'tank', label: 'The tank', kind: 'supply', owner: 'resident', start: 40, ratePerMin: 1, rateKnown: true,
  cues: [{ at: 30, text: 'The gauge is in the red.', mark: 'low' }, { at: 0, text: 'The tank is empty.' }] };
const scenarioWith = (clocks: ClockDef[]) => ({ version: 13, clocks, facts: [{ id: 'f_door', truth: false }] } as unknown as ScenarioDefinition);

describe('clocks: the model', () => {
  it('run down by rate times minutes and fire each cue once as they pass it', () => {
    expect(stepClock(door, { value: 50, cued: 0 }, 4, [])).toEqual({ value: 40, cued: 0 });
    expect(stepClock(door, { value: 50, cued: 0 }, 8, [])).toEqual({ value: 30, cued: 1 });
    expect(stepClock(tank, { value: 20, cued: 1 }, 30, [])).toEqual({ value: 0, cued: 2 });
  });

  it('never run out before the team has heard a cue in an earlier decision', () => {
    // One long wait from a silent start stops just short, and the cue fires.
    expect(stepClock(door, { value: 50, cued: 0 }, 40, [])).toEqual({ value: CLOCK_RULES_V1.floor, cued: 1 });
    // Once a cue was heard, the next decision can run it out.
    expect(stepClock(door, { value: 30, cued: 1 }, 20, [])).toEqual({ value: 0, cued: 1 });
  });

  it('stop once the person they belong to is out of the building', () => {
    expect(stepClock(tank, { value: 20, cued: 1 }, 15, ['safe:resident'])).toEqual({ value: 20, cued: 1 });
    expect(stepClock(tank, { value: 20, cued: 1 }, 15, ['out:resident'])).toEqual({ value: 20, cued: 1 });
  });

  it('answer forks at the end of the choice: low after the first cue, out at zero; a missing clock is neither', () => {
    const s = scenarioWith([door]);
    const run = { clocks: { door: { value: 30, cued: 1 } }, flags: [] };
    expect(clockConditionsHold([{ clockId: 'door', state: 'out', is: true }], s, run, 12)).toBe(true);
    expect(clockConditionsHold([{ clockId: 'door', state: 'out', is: false }], s, run, 6)).toBe(true);
    expect(clockConditionsHold([{ clockId: 'door', state: 'low', is: true }], s, run, 0)).toBe(true);
    expect(clockConditionsHold([{ clockId: 'gone', state: 'out', is: false }, { clockId: 'gone', state: 'low', is: false }], s, run, 99)).toBe(true);
  });

  it('turn cues into effects: a mark, the fact settled, and silence when the team already has it', () => {
    const s = scenarioWith([door]);
    const run = { clocks: { door: { value: 40, cued: 0 } }, flags: [] as string[], knowledge: {} as Record<string, 'unknown' | 'reported' | 'confirmed' | 'disproved'> };
    const fired = advanceClocks(run, s, 4);
    expect(run.clocks.door).toEqual({ value: 30, cued: 1 });
    expect(cueEffects(fired, s, run)).toEqual([{ text: 'The frame is splitting.', setFlags: ['mark:door_weak'], knowledge: [{ factId: 'f_door', status: 'disproved' }] }]);
    expect(cueEffects(fired, s, { ...run, knowledge: { f_door: 'disproved' } })[0].text).toBeUndefined();
    expect(cueEffects(fired, s, { ...run, flags: ['mark:door_weak'] })[0].text).toBeUndefined();
  });
});

// ---------------------------------------------------------------- in play

function at(type: IncidentType, family: string, variant: 0 | 1 | 2, node: string, stage: StageId, clocks: Record<string, { value: number; cued: number }>, clock = 10): { state: GameState; s: ScenarioDefinition } {
  const s = generateIncident(specForSituation(type, family, variant));
  const state = startGateRun(s.id, 719);
  const run = state.activeRun!;
  run.flags = ['tree:started', `at:${node}`];
  run.stage = stage;
  run.clock = clock;
  run.clocks = { ...run.clocks, ...clocks };
  return { state, s };
}
const decide = (state: GameState, type: string, node: string, choice: string) => {
  const after = applyMove(state, { kind: 'decide', actionId: choiceActionId(type, node, choice), band: 'favorable' });
  expect(after, `${node}.${choice} could not be decided`).not.toBeNull();
  return after!.activeRun!;
};

describe('clocks: in the calls', () => {
  it('a splitting door gives during a long wait once the worker has said so, and holds before that', () => {
    const warned = at('active_armed_incident', 'market_row', 2, 'dug_in', 'adapt', { door: { value: 20, cued: 1 } });
    expect(decide(warned.state, 'active_armed_incident', 'dug_in', 'dug_wait').flags).toContain('at:through_door');
    // The same wait from a silent door: it stops short, and the worker's line comes with it.
    const silent = at('active_armed_incident', 'market_row', 2, 'dug_in', 'adapt', { door: { value: 50, cued: 0 } });
    const run = decide(silent.state, 'active_armed_incident', 'dug_in', 'dug_wait');
    expect(run.flags).toContain('at:standoff');
    expect(run.flags).toContain('mark:door_weak');
    expect(run.knowledge.f_door_holds).toBe('disproved');
    expect(run.history.at(-1)!.committed!.consequences.join(' ')).toContain(silent.s.clocks!.find(c => c.id === 'door')!.cues[0].text);
    // A door that holds never gives, however long the wait.
    const holding = at('active_armed_incident', 'market_row', 0, 'dug_in', 'adapt', {});
    expect(decide(holding.state, 'active_armed_incident', 'dug_in', 'dug_wait').flags).toContain('at:standoff');
  });

  it('a short oxygen tank reads red during a long wait, said once, and a full one never does', () => {
    const short = at('protected_rescue', 'cedar_close', 2, 'their_terms', 'adapt', {});
    const run = decide(short.state, 'protected_rescue', 'their_terms', 'stay_in');
    expect(run.flags).toContain('mark:running_low');
    const lines = run.history.at(-1)!.committed!.consequences.join(' ');
    expect(lines.match(/in the red/g)?.length, 'the outcome and the cue say it once between them').toBe(1);
    const full = at('protected_rescue', 'cedar_close', 0, 'their_terms', 'adapt', {});
    expect(decide(full.state, 'protected_rescue', 'their_terms', 'stay_in').flags).not.toContain('mark:running_low');
  });

  it('an unwell owner collapses in a night-long hold after the first sign, and not before it', () => {
    // The collapse is the owner badly hurt and `owner_down` set, wherever the call goes next.
    const collapsed = (run: NonNullable<GameState['activeRun']>) => run.personCasualties?.owner?.severity === 'serious' && run.flags.includes('mark:owner_down');
    const seen = at('hostage_crisis', 'market_row', 1, 'standoff', 'resolve', { owner_condition: { value: 30, cued: 1 } });
    expect(collapsed(decide(seen.state, 'hostage_crisis', 'standoff', 'into_night'))).toBe(true);
    const unseen = at('hostage_crisis', 'market_row', 1, 'standoff', 'resolve', { owner_condition: { value: 60, cued: 0 } });
    const run = decide(unseen.state, 'hostage_crisis', 'standoff', 'into_night');
    expect(collapsed(run)).toBe(false);
    expect(run.flags).toContain('mark:owner_unwell');
    // A well owner has no clock, and never collapses.
    const well = at('hostage_crisis', 'market_row', 0, 'standoff', 'resolve', {});
    expect(well.s.clocks ?? []).toEqual([]);
    expect(collapsed(decide(well.state, 'hostage_crisis', 'standoff', 'into_night'))).toBe(false);
  });

  it('keep a save valid with clocks and meters mid-call', () => {
    const s = generateIncident(specForSituation('hostage_crisis', 'market_row', 1));
    const after = applyMove(startGateRun(s.id, 719), { kind: 'decide', actionId: choiceActionId('hostage_crisis', 'offer', 'hear_him'), band: 'favorable' })!;
    expect(after.activeRun!.meters?.taker?.moved.heard).toBeDefined();
    expect(after.activeRun!.clocks?.owner_condition?.value).toBeLessThan(60);
    const loaded = deserialize(serialize(after, 1));
    expect(loaded?.activeRun?.clocks).toEqual(after.activeRun!.clocks);
    expect(loaded?.activeRun?.meters).toEqual(after.activeRun!.meters);
  });
});

// M2 slice 5: a clock that runs out where no fork reads it hurts its owner still inside and sets a
// mark the tree's prompts read, so the record and the text agree.
describe('clocks: running out where no fork reads it', () => {
  const owned: ClockDef = { ...tank, onOut: { harm: 'serious', mark: 'tank_empty' } };
  const s = scenarioWith([owned]);
  const before = { tank: { value: 5, cued: 1 } }, after = { tank: { value: 0, cued: 2 } };

  it('hurt the owner still inside and set the mark, once, when the clock crosses zero', () => {
    expect(clockOutEffects(s, before, after, { flags: [] }, [])).toEqual([{ personHarm: [{ personId: 'resident', severity: 'serious' }], setFlags: ['mark:tank_empty'] }]);
    // Already out before this decision: it did not run out here.
    expect(clockOutEffects(s, after, after, { flags: [] }, [])).toEqual([]);
    expect(clockOutEffects(s, before, { tank: { value: 2, cued: 1 } }, { flags: [] }, [])).toEqual([]);
    // A clock with no onOut changes nothing on the record.
    expect(clockOutEffects(scenarioWith([tank]), before, after, { flags: [] }, [])).toEqual([]);
  });

  it('leave the owner unhurt when this decision got them out, and leave the harm to an outcome that narrates it', () => {
    expect(clockOutEffects(s, before, after, { flags: ['safe:resident', 'out:resident'] }, [])).toEqual([{ setFlags: ['mark:tank_empty'] }]);
    expect(clockOutEffects(s, before, after, { flags: [] }, [{ personHarm: [{ personId: 'resident', severity: 'fatal' }] }])).toEqual([{ setFlags: ['mark:tank_empty'] }]);
  });

  it('a short tank that runs out in a long wait hurts the resident inside; the score, the debrief and the save agree', () => {
    // The rescue's short tank, already in the red at the start, so the first long wait runs it out.
    const base = generateIncident(specForSituation('protected_rescue', 'cedar_close', 2));
    const draft: ScenarioDefinition = structuredClone(base);
    draft.clocks = draft.clocks!.map(clock => clock.id === 'oxygen' ? { ...clock, start: 25 } : clock);
    expect(draft.clocks.find(clock => clock.id === 'oxygen')!.onOut).toEqual({ harm: 'serious', mark: 'tank_empty' });
    const loads = (state: GameState) => {
      const copy = structuredClone(state);
      copy.incidents = [];
      delete copy.activeRun!.sourceIncident;
      return deserialize(serialize(copy, NOW)) !== null;
    };
    withDraftScenario(draft, id => {
      const scenario = { ...draft, id };
      const pick = (state: GameState, ids: [node: string, choice: string][]) => {
        const eligible = actionViews(state, NOW, 'A').filter(view => view.eligible).map(view => view.id);
        return ids.map(([node, choice]) => choiceActionId('protected_rescue', node, choice)).find(action => eligible.includes(action));
      };
      let state: GameState | null = startGateRun(id, 3);
      for (let i = 0; i < 3 && state && !state.activeRun!.flags.includes('person_harm:resident:serious'); i++) {
        const actionId = pick(state, [['wont_leave', 'ask_them'], ['at_the_door', 'ask_now'], ['their_terms', 'stay_in']]);
        state = actionId ? applyNaturalMove(state, { kind: 'decide', actionId }) : null;
      }
      expect(state, 'the long wait was reached').not.toBeNull();
      const run = state!.activeRun!;
      const wait = run.history.at(-1)!;
      expect(wait.actionId).toBe(choiceActionId('protected_rescue', 'their_terms', 'stay_in'));
      // Recorded on the decision whose minutes ran it out, and the tree's prompts can read it.
      expect(run.personCasualties?.resident).toMatchObject({ severity: 'serious', care: 'needed', causeRevision: wait.revision });
      expect(wait.committed!.personCasualties).toEqual([run.personCasualties!.resident]);
      expect(run.flags).toEqual(expect.arrayContaining(['mark:tank_empty', 'at:inside_room']));
      expect(wait.committed!.consequences.join(' ')).toContain('spare tank stops');
      expect(traceRun(scenario, run).end.flags).toContain('mark:tank_empty');
      expect(loads(state!)).toBe(true);
      // The call goes on: the team can still carry the resident out, and the end reads them hurt.
      const end = applyNaturalMove(state!, { kind: 'decide', actionId: choiceActionId('protected_rescue', 'inside_room', 'go_for_breath') });
      expect(end, 'walking a hurt resident out is still allowed').not.toBeNull();
      const finished = end!.activeRun!;
      expect(['resident_hurt', 'resident_killed']).toContain(finished.endingId);
      const resident = endStates(scenario, finished, { steps: traceRun(scenario, finished).steps }).find(person => person.id === 'resident')!;
      expect(resident.state === 'killed' || (resident.state === 'hurt' && resident.severity === 'serious')).toBe(true);
      expect(computeDebrief(end!, finished)!.personCasualties!.some(person => person.personId === 'resident')).toBe(true);
      expect(loads(end!)).toBe(true);
    });
  });
});
