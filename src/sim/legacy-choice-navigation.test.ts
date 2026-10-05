import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { getScenario } from './scenario-registry';
import { actionViews, previewAction, stageContinuations } from './operation-selectors';
import { traceRun } from './operation';
import { getBuilt, bandFor, evaluateAction } from './resolution';
import { next } from './rng';
import { deserialize, serialize } from './save';
import { apply, NOW, startRun } from './test-fixtures';
import type { GameState, OperationRun } from './types';
import { legacyStageNavigation } from './compatibility/legacy-choices';
import frozen from './fixtures/legacy-navigation-runs.json';

function running(version: number, type = 'welfare_check'): GameState {
  const scenarioId = `gen:${type}:cedar_close:7:7:2:${version}`;
  const scenario = getScenario(scenarioId)!;
  const initial = createInitialState(NOW, 41);
  initial.incidents = [{ id: scenarioId, type: scenario.incident!.type, familyId: 'cedar_close', tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: true }];
  return startRun(initial, scenarioId, ['A'], { positions: { A: getBuilt('cedar_close', 7).location.entries[0] }, loadouts: { A: {} } });
}

function decide(state: GameState, actionId: string): GameState {
  const result = apply(state, { type: 'decide', actionId, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  return result.state;
}

describe('free navigation for issued calls', () => {
  it.each([
    [3, 'welfare_check', 'v3_welfare_contact', 'v3_welfare_proceed'],
    [3, 'barricaded', 'v3_protect_contact', 'v3_protect_proceed'],
    [4, 'welfare_check', 'v4_source', 'v4_proceed'],
    [4, 'medical_complication', 'v4_source', 'v4_proceed'],
  ] as const)('continues v%i %s without any simulated cost or reward', (version, type, first, navigation) => {
    const before = decide(running(version, type), first);
    const run = before.activeRun!;
    const scenario = getScenario(run.scenarioId)!;
    const revision = run.revision;
    expect(stageContinuations(before)).toEqual([{ actionId: navigation, fromStage: 'adapt', toStage: 'resolve', revision, label: 'Continue to response choices', description: 'Leaves the remaining preparation options behind. No operation time passes.' }]);
    expect(actionViews(before, NOW, 'A').some(action => action.id === navigation)).toBe(false);
    expect(previewAction(before, NOW, navigation, ['A'], [])).toBeNull();
    const result = apply(before, { type: 'continueStage', actionId: navigation, revision });
    expect(result.result).toEqual({ ok: true });
    const after = result.state;
    const expected = structuredClone(before);
    expected.activeRun!.stage = 'resolve';
    expected.activeRun!.stageContinuations = [{ version: 1, actionId: navigation, revision, fromStage: 'adapt', toStage: 'resolve' }];
    expect(after).toEqual(expected);
    expect(traceRun(scenario, after.activeRun!)).toEqual(traceRun(scenario, run));
    expect(stageContinuations(after)).toEqual([]);
    expect(deserialize(serialize(after, NOW))).toEqual(after);
    const repeated = apply(after, { type: 'continueStage', actionId: navigation, revision });
    expect(repeated.result.ok).toBe(false);
    expect(repeated.state).toBe(after);
    expect(decide(before, navigation)).toEqual(after);

    const choice = actionViews(after, NOW, 'A').find(action => action.eligible)!;
    const resumed = deserialize(serialize(after, NOW))!;
    const nextState = decide(after, choice.id);
    expect(decide(resumed, choice.id)).toEqual(nextState);
    expect(nextState.activeRun!.history.at(-1)!.sample).toBe(next(run.rngState).value);
    expect(nextState.activeRun!.history.at(-1)!.timeCost).toBeGreaterThan(0);
    expect(deserialize(serialize(nextState, NOW))).not.toBeNull();
  });

  it('does not advance requested care, alter squads or require fit officers', () => {
    let before = decide(running(4), 'v4_source');
    before = decide(before, 'v4_request_care');
    for (const officer of Object.values(before.officers)) officer.stress = 100;
    const result = apply(before, { type: 'continueStage', actionId: 'v4_proceed', revision: before.activeRun!.revision });
    expect(result.result.ok).toBe(true);
    expect(result.state.activeRun!.externalSupport).toEqual(before.activeRun!.externalSupport);
    expect(result.state.activeRun!.clock).toBe(before.activeRun!.clock);
    expect(result.state.activeRun!.squadTasks).toEqual(before.activeRun!.squadTasks);
    expect(result.state.officers).toEqual(before.officers);
  });

  it('refuses stale revisions and real work presented as a continuation', () => {
    const state = decide(running(3), 'v3_welfare_contact');
    for (const [actionId, revision] of [['v3_welfare_proceed', 0], ['v3_welfare_agreement', 1], ['v3_welfare_visit', 1], ['unrecognized', 1]] as const) {
      const result = apply(state, { type: 'continueStage', actionId, revision });
      expect(result.result.ok).toBe(false);
      expect(result.state).toBe(state);
    }
    const before = running(3);
    expect(apply(before, { type: 'continueStage', actionId: 'v3_welfare_proceed', revision: 0 }).result.ok).toBe(false);
  });

  it('recognizes only reviewed IDs with the exact navigation contract', () => {
    const scenario = getScenario(running(3).activeRun!.scenarioId)!;
    const original = scenario.stages.adapt.actions.find(action => action.id === 'v3_welfare_proceed')!;
    expect(legacyStageNavigation(scenario, original)).toBe(true);
    const variants = [
      { ...original, id: 'some_new_proceed' },
      { ...original, consumes: [{ tag: 'medkit', qty: 1 }] },
      { ...original, requires: { ...original.requires, flags: [{ flag: 'care_ready', reason: 'Care must be ready' }] } },
      { ...original, outcomes: { ...original.outcomes, adverse: [...original.outcomes.adverse, { pressure: 1 }] } },
      { ...original, outcomes: { ...original.outcomes, favorable: [{ when: { flags: ['care_ready'] }, stage: 'resolve' as const }] } },
    ];
    for (const action of variants) expect(legacyStageNavigation(scenario, action)).toBe(false);
    expect(legacyStageNavigation({ ...scenario, version: 5 }, original)).toBe(false);
  });

  it('keeps the assistance briefing as consequential work and gives it an honest label', () => {
    const state = decide(running(3, 'medical_complication'), 'assist_contact');
    const view = actionViews(state, NOW, 'A').find(action => action.id === 'assist_commit_plan')!;
    expect(view.title).toBe('Brief the team on access and care arrangements');
    expect(view.summary).toContain('add pressure');
    expect(stageContinuations(state)).toEqual([]);
    expect(apply(state, { type: 'continueStage', actionId: view.id, revision: state.activeRun!.revision }).result.ok).toBe(false);
    const run = state.activeRun!;
    const scenario = getScenario(run.scenarioId)!;
    const action = scenario.stages.adapt.actions.find(action => action.id === view.id)!;
    const ev = evaluateAction({ state, run, scenario, action, built: getBuilt(run.locationFamilyId, run.locationSeed), acting: ['A'], support: [] });
    for (let seed = 1; seed < 100_000; seed++) if (bandFor(ev.margin, next(seed).value) === 'adverse') { run.rngState = seed; break; }
    const after = decide(state, action.id);
    expect(after.activeRun!.history.at(-1)!.band).toBe('adverse');
    expect(after.activeRun!.clock).toBeGreaterThan(run.clock);
    expect(after.activeRun!.flags).toContain('assist_needs_followthrough');
    expect(after.activeRun!.pressure).toBeGreaterThan(run.pressure);
  });

  it('rejects malformed, duplicated and wrong-version navigation markers on load', () => {
    const state = decide(running(4), 'v4_source');
    const valid = apply(state, { type: 'continueStage', actionId: 'v4_proceed', revision: 1 }).state;
    expect(deserialize(serialize(valid, NOW))).not.toBeNull();
    const mutations: ((run: OperationRun) => void)[] = [
      run => { run.stageContinuations![0].version = 2 as 1; },
      run => { run.stageContinuations![0].actionId = 'v4_verify'; },
      run => { run.stageContinuations![0].revision = 0; },
      run => { run.stageContinuations![0].revision = 2; },
      run => { run.stageContinuations!.push({ ...run.stageContinuations![0] }); },
      run => { run.scenarioVersion = 3; },
      run => { run.stage = 'adapt'; },
      run => { run.flags.push('used:v4_proceed'); },
      run => { Object.assign(run.stageContinuations![0], { reward: 100 }); },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(valid);
      mutate(changed.activeRun!);
      expect(deserialize(serialize(changed, NOW))).toBeNull();
    }
  });
});

describe('already committed navigation remains historical', () => {
  it.each(frozen)('preserves the old sampled outcome for $run.scenarioId', snapshot => {
    const state = running(snapshot.run.scenarioVersion);
    state.activeRun = structuredClone(snapshot.run) as unknown as OperationRun;
    for (const [id, stress] of Object.entries(snapshot.stress)) state.officers[id].stress = stress;
    const scenario = getScenario(state.activeRun.scenarioId)!;
    const before = structuredClone(state.activeRun);
    expect(before.history.at(-1)!.timeCost).toBeGreaterThan(0);
    const loaded = deserialize(serialize(state, NOW))!;
    expect(loaded).not.toBeNull();
    expect(loaded.activeRun).toEqual(before);
    expect(traceRun(scenario, loaded.activeRun!).end).toEqual(snapshot.trace);
    expect(stageContinuations(loaded)).toEqual([]);
    const nextChoice = actionViews(loaded, NOW, 'A').find(action => action.eligible)!;
    const resumed = decide(loaded, nextChoice.id);
    expect(resumed.activeRun!.history.slice(0, before.history.length)).toEqual(before.history);
  });
});
