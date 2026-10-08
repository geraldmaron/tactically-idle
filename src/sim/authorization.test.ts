import { describe, expect, it } from 'vitest';
import { COMMAND_LINES } from '../content/incidents/lines';
import { drawIncidentSpec, generateIncident } from '../gen/incident';
import { NOW, startGateRun } from '../gen/incident/gates/engine-driver';
import { AUTHORIZATION_V1, authorize, readForceThreat } from './authorization';
import { buildLocation } from './location';
import { actionViews } from './operation-selectors';
import { evaluateAction } from './resolution';
import { getScenario } from './scenario-registry';
import { CONCESSIONS_ALLOWED } from './scenario-types';
import type { ClockDef, ConcessionKind, IncidentPersonDef, IncidentType, ScenarioDefinition } from './scenario-types';
import type { KnowledgeStatus, OperationRun, StageId } from './types';

// M2 slice 4 (docs/incident-domain-model.md §7): one rule table for entry, concessions and deadly
// force, read from what the team believes, with the line command says.

type Run = Pick<OperationRun, 'knowledge' | 'flags' | 'clocks'>;
const run = (knowledge: Record<string, KnowledgeStatus> = {}, flags: string[] = [], clocks: Run['clocks'] = undefined): Run => ({ knowledge, flags, clocks });
const tank: ClockDef = { id: 'tank', label: 'The tank', kind: 'supply', owner: 'resident', start: 40, ratePerMin: 1, rateKnown: true,
  cues: [{ at: 30, text: 'The gauge is in the red.' }], urgent: 'Ana’s spare tank is in the red' };
const scenario = (patch: Partial<ScenarioDefinition> = {}) => ({ version: 13, facts: [], threats: [
  { factId: 'f_shots', because: 'Ash fired at the lock on Eli’s door' },
  { flag: 'mark:rifle_at_door', because: 'Ash took the rifle to the door Sam is hiding behind' },
], clocks: [tank], ...patch } as unknown as ScenarioDefinition);
const ENTRY = { kind: 'entry' } as const;

describe('authorization: entry', () => {
  it('stays locked while nobody has seen a threat to life and no clock is running out', () => {
    expect(authorize(scenario(), run(), ENTRY)).toEqual({ allowed: false, rule: 'entry:none', reason: COMMAND_LINES.entry.refused });
    expect(authorize(scenario({ threats: undefined, clocks: undefined }), run(), ENTRY).allowed).toBe(false);
  });

  it('opens on a threat fact the team believes, and never on one it doesn’t', () => {
    for (const status of ['reported', 'confirmed'] as const) {
      expect(authorize(scenario(), run({ f_shots: status }), ENTRY)).toEqual({ allowed: true, rule: 'entry:threat', reason: 'Command approves it because Ash fired at the lock on Eli’s door.' });
    }
    for (const status of ['unknown', 'disproved'] as const) expect(authorize(scenario(), run({ f_shots: status }), ENTRY).allowed).toBe(false);
  });

  it('opens on a threat mark, and a mark speaks before a claim the team was only told', () => {
    expect(authorize(scenario(), run({}, ['mark:rifle_at_door']), ENTRY).reason).toBe('Command approves it because Ash took the rifle to the door Sam is hiding behind.');
    expect(authorize(scenario(), run({ f_shots: 'reported' }, ['mark:rifle_at_door']), ENTRY).reason).toContain('took the rifle');
    // Confirmed beats reported between facts.
    const two = scenario({ threats: [{ factId: 'f_a', because: 'a' }, { factId: 'f_b', because: 'b' }] });
    expect(authorize(two, run({ f_a: 'reported', f_b: 'confirmed' }), ENTRY).reason).toBe('Command approves it because b.');
    expect(authorize(two, run({ f_a: 'reported', f_b: 'reported' }), ENTRY).reason).toBe('Command approves it because a.');
  });

  it('opens when an urgent clock has given its first cue and its owner is still inside', () => {
    expect(authorize(scenario(), run({}, [], { tank: { value: 35, cued: 0 } }), ENTRY).allowed).toBe(false);
    expect(authorize(scenario(), run({}, [], { tank: { value: 25, cued: 1 } }), ENTRY)).toEqual({ allowed: true, rule: 'entry:clock', reason: 'Command approves it because Ana’s spare tank is in the red.' });
    expect(authorize(scenario(), run({}, [], { tank: { value: 0, cued: 1 } }), ENTRY).rule).toBe('entry:clock');
    for (const flag of ['safe:resident', 'out:resident']) expect(authorize(scenario(), run({}, [flag], { tank: { value: 25, cued: 1 } }), ENTRY).allowed).toBe(false);
    // A clock with no urgent phrase never opens the door, however low.
    expect(authorize(scenario({ clocks: [{ ...tank, urgent: undefined }] }), run({}, [], { tank: { value: 5, cued: 1 } }), ENTRY).allowed).toBe(false);
    // A seen threat speaks before the clock.
    expect(authorize(scenario(), run({ f_shots: 'confirmed' }, [], { tank: { value: 25, cued: 1 } }), ENTRY).rule).toBe('entry:threat');
  });

  it('writes one sentence from the bound phrase, whatever punctuation the phrase ends with', () => {
    const s = scenario({ threats: [{ factId: 'f_a', because: 'Ana can’t wait any longer. ' }] });
    expect(authorize(s, run({ f_a: 'confirmed' }), ENTRY).reason).toBe('Command approves it because Ana can’t wait any longer.');
  });
});

describe('authorization: concessions', () => {
  const kinds: ConcessionKind[] = ['food', 'water', 'phone', 'statement', 'message', 'third_party', 'surrender_terms', 'weapon', 'transport', 'officer_swap', 'family'];
  it('allows food, water, a phone, a statement, a message, a third party and surrender terms, and never the rest', () => {
    for (const item of kinds) {
      const result = authorize(scenario(), run(), { kind: 'concession', item });
      const allowed = CONCESSIONS_ALLOWED.includes(item);
      expect(result, item).toEqual({ allowed, rule: allowed ? 'concession:allowed' : 'concession:never', reason: COMMAND_LINES.concession[item] });
    }
    expect(['weapon', 'transport', 'officer_swap', 'family'].every(item => !AUTHORIZATION_V1.concessions.allowed.includes(item as ConcessionKind))).toBe(true);
  });

  it('never depends on what the team believes', () => {
    expect(authorize(scenario(), run({ f_shots: 'confirmed' }, ['mark:rifle_at_door']), { kind: 'concession', item: 'family' }).allowed).toBe(false);
  });
});

describe('command lines (content/incidents/lines.ts)', () => {
  it('are plain sentences, and a refusal fits the locked summary', () => {
    const lines = [COMMAND_LINES.entry.approved, COMMAND_LINES.entry.refused, ...Object.values(COMMAND_LINES.concession)];
    for (const line of lines) {
      expect(line, 'colon or dash').not.toMatch(/[:–—]| - /);
      expect(line).toMatch(/^Command .+\.$/);
    }
    const refusals = [COMMAND_LINES.entry.refused, ...Object.entries(COMMAND_LINES.concession).filter(([kind]) => !CONCESSIONS_ALLOWED.includes(kind as ConcessionKind)).map(([, line]) => line)];
    for (const line of refusals) expect(line.length, line).toBeLessThanOrEqual(80);
  });
});

describe('authorization: deadly force reads beliefs', () => {
  const person = (patch: Partial<IncidentPersonDef> = {}): IncidentPersonDef => ({ id: 'p', kind: 'subject', label: 'Ash', minor: false, spaceId: 'r1', at: { x: 0, y: 0 },
    threat: { armament: 'handgun', readiness: 'brandished', disposition: 'agitated', intent: 'harm_others', awareness: 'aware' }, armamentFactId: 'f_arm', doorFt: 30, ...patch });
  const s = (people: IncidentPersonDef[]) => ({ incidentPeople: people } as ScenarioDefinition);
  it('needs the weapon believed and in hand, and a blade or bat within reach', () => {
    expect(readForceThreat(s([person()]), run({ f_arm: 'reported' }), person()).rule).toBe('force:gun');
    expect(readForceThreat(s([person()]), run({ f_arm: 'unknown' }), person()).rule).toBe('force:unseen');
    expect(readForceThreat(s([person()]), run({ f_arm: 'confirmed' }), person({ threat: { ...person().threat!, readiness: 'concealed' } })).rule).toBe('force:empty');
    const blade = person({ threat: { ...person().threat!, armament: 'edged' } });
    expect(readForceThreat(s([blade]), run({ f_arm: 'confirmed' }), blade).rule).toBe('force:out_of_reach');
    expect(readForceThreat(s([blade]), run({ f_arm: 'confirmed' }), { ...blade, doorFt: AUTHORIZATION_V1.deadlyForce.reachFt })).toMatchObject({ deadly: true, rule: 'force:reach', near: null });
    const unknown = person({ threat: { ...person().threat!, armament: 'unknown' } });
    expect(readForceThreat(s([unknown]), run({ f_arm: 'reported' }), unknown).rule).toBe('force:unclear');
  });
});

// ---------------------------------------------------------------- in the calls

function calls(type: IncidentType, n: number, seed = 1312): ScenarioDefinition[] {
  const out: ScenarioDefinition[] = [];
  let state = seed;
  for (let i = 0; i < n; i++) {
    const drawn = drawIncidentSpec(state, { level: 10, trust: 90, contentVersion: 13, unlockedTypes: [type] });
    state = drawn.state;
    out.push(generateIncident(drawn.spec));
  }
  return out;
}

describe('authorization in evaluation', () => {
  const types: IncidentType[] = ['active_armed_incident', 'barricaded', 'hostage_crisis', 'protected_rescue'];
  const all = types.flatMap(type => calls(type, 3));

  /** Evaluate a choice at the point of the call where it is offered: its visibility made true. */
  function evaluate(s: ScenarioDefinition, actionId: string, change: (scenario: ScenarioDefinition, r: OperationRun) => void = () => {}) {
    const state = startGateRun(s.id, 719);
    const r = structuredClone(state.activeRun!);
    const scenarioCopy = structuredClone(s);
    const action = Object.values(scenarioCopy.stages).flatMap(stage => stage.actions).find(entry => entry.id === actionId)!;
    const visible = action.visibleWhen;
    r.flags = [...new Set([...r.flags, ...visible?.flags ?? []])].filter(flag => !(visible?.notFlags ?? []).includes(flag));
    for (const fact of visible?.facts ?? []) if (!fact.in.includes(r.knowledge[fact.factId] ?? 'unknown')) r.knowledge[fact.factId] = fact.in[0];
    change(scenarioCopy, r);
    return evaluateAction({ state, run: r, scenario: scenarioCopy, action, built: buildLocation(s.locationFamilyId, s.locationSeed), acting: ['A'], support: [] });
  }

  it('locks an entry with command’s line until a threat is seen, and carries the approval once it is', () => {
    let checked = 0;
    for (const s of all) {
      const entries = Object.values(s.stages).flatMap(stage => stage.actions).filter(action => action.authority?.kind === 'entry');
      for (const action of entries) {
        // A choice offered only once a threat is seen can't be asked about before it.
        const threatFlags = new Set((s.threats ?? []).flatMap(threat => threat.flag ?? []));
        const threatFacts = new Set((s.threats ?? []).flatMap(threat => threat.factId ?? []));
        if (action.visibleWhen?.flags?.some(flag => threatFlags.has(flag)) || action.visibleWhen?.facts?.some(fact => threatFacts.has(fact.factId))) continue;
        const quiet = (scenario: ScenarioDefinition, r: OperationRun) => {
          for (const threat of scenario.threats ?? []) { if (threat.factId) r.knowledge[threat.factId] = 'unknown'; }
          r.flags = r.flags.filter(flag => !threatFlags.has(flag));
          r.clocks = undefined;
        };
        const locked = evaluate(s, action.id, quiet);
        expect(locked.authority, action.id).toEqual({ allowed: false, rule: 'entry:none', reason: COMMAND_LINES.entry.refused });
        expect(locked.eligible).toBe(false);
        expect(locked.reason).toBe(COMMAND_LINES.entry.refused);
        const seen = evaluate(s, action.id, (scenario, r) => {
          quiet(scenario, r);
          scenario.threats = [{ factId: scenario.facts[0].id, because: 'Ash fired at the lock' }];
          r.knowledge[scenario.facts[0].id] = 'confirmed';
        });
        expect(seen.authority).toEqual({ allowed: true, rule: 'entry:threat', reason: 'Command approves it because Ash fired at the lock.' });
        expect(seen.reason).not.toBe(COMMAND_LINES.entry.refused);
        checked++;
      }
    }
    expect(checked, 'tagged entry choices across the four calls').toBeGreaterThan(0);
  }, 120000);

  it('reads the call’s own threats and clocks, bound, into a plain command line', () => {
    let lines = 0;
    for (const s of all) {
      for (const threat of s.threats ?? []) {
        const line = authorize(s, run(threat.factId ? { [threat.factId]: 'confirmed' } : {}, threat.flag ? [threat.flag] : []), ENTRY).reason;
        expect(line, s.id).not.toMatch(/[{}:–—]| - /);
        lines++;
      }
      for (const clock of (s.clocks ?? []).filter(def => def.urgent)) {
        const result = authorize({ ...s, threats: [] }, run({}, [], { [clock.id]: { value: 1, cued: 1 } }), ENTRY);
        expect(result.rule, `${s.id} ${clock.id}`).toBe('entry:clock');
        expect(result.reason).not.toMatch(/[{}:–—]| - /);
        lines++;
      }
    }
    expect(lines, 'bound threat and clock phrases').toBeGreaterThan(0);
  }, 120000);

  it('puts command’s answer on the player’s choice, and leaves earlier versions alone', () => {
    let seen = 0;
    for (const s of all) {
      const state = startGateRun(s.id, 719);
      const scenarioNow = getScenario(state.activeRun!.scenarioId)!;
      const stageActions = scenarioNow.stages[state.activeRun!.stage as StageId].actions;
      for (const view of actionViews(state, NOW, 'A')) {
        const action = stageActions.find(entry => entry.id === view.id);
        if (!action?.authority) { expect(view.authority).toBeUndefined(); continue; }
        expect(view.authority, view.id).toBeDefined();
        if (!view.authority!.allowed) {
          expect(view.eligible).toBe(false);
          expect(view.reason).toBe(view.authority!.reason);
          expect(view.summary).toBe(view.authority!.reason);
        }
        seen++;
      }
    }
    expect(seen, 'choices asking command for something at the start of a call').toBeGreaterThan(0);
    // Version 12 and earlier never read `authority`.
    const s = all.find(entry => Object.values(entry.stages).some(stage => stage.actions.some(action => action.authority)))!;
    const action = Object.values(s.stages).flatMap(stage => stage.actions).find(entry => entry.authority)!;
    expect(evaluate(s, action.id, scenario => { scenario.version = 12; }).authority).toBeUndefined();
  }, 120000);
});
