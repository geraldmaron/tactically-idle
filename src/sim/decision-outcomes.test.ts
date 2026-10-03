import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { GameState, KnowledgeStatus, OutcomeBand, StageId } from './types';
import { advanceTime, matchedEffects, traceRun, validateScenario } from './operation';
import { actionViews, decisionViews, lastDecisionView, pendingDebrief, previewAction, spaceViews, stageProgress } from './operation-selectors';
import { builtFor, evaluateAction } from './resolution';
import { next } from './rng';
import { initializePersonnel } from './personnel';
import { CURRENT_SAVE_VERSION, deserialize, serialize } from './save';
import { apply, makeState, NOW, startRun } from './test-fixtures';

const ID = 'decision_outcomes_fixture';
const FACT = 'f_occ_e';
const bands: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const round = (n: number) => Math.round(n * 10) / 10;
const table = (effects: OutcomeEffect[]) => Object.fromEntries(bands.map((band) => [band, structuredClone(effects)])) as ActionDefinition['outcomes'];
function action(id: string, stage: StageId, effects: OutcomeEffect[], over: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    id, stage, title: id, icon: 'radio', summary: 'Check the public report', targetId: 'front_yard', task: 'Checking',
    requires: {}, approach: 'none', workload: { base: 1, perSqFt: 0 }, stressBase: 0,
    check: { kind: 'coordination', difficulty: 35, ratings: [{ key: 'coordination', weight: 1 }] },
    outcomePreview: { favorable: 'A check may settle the report.', mixed: 'The check may need more time.', adverse: 'The report may remain unresolved.' },
    consequenceLevel: 'low', outcomes: table(effects), ...over,
  };
}
function fixture(): ScenarioDefinition {
  const scenario = structuredClone(SCENARIOS.ms_occupancy);
  scenario.id = ID;
  scenario.version = 3;
  scenario.pressure = { start: 0, perMinute: 2, threshold: 90, civilianPerMinute: 20 };
  scenario.stages = {
    assess: { id: 'assess', label: 'Assess', prompt: 'Check the claim before acting.', actions: [action('prime', 'assess', [{ stage: 'resolve', objective: 97, civilian: -96, pressure: 99 }])] },
    adapt: { id: 'adapt', label: 'Adapt', prompt: 'Prepare an informed next step.', actions: [action('adapt', 'adapt', [{ stage: 'resolve' }])] },
    resolve: { id: 'resolve', label: 'Resolve', prompt: 'A safe follow-through remains available.', actions: [
      action('recover', 'resolve', [{ stage: 'resolve', objective: 20, civilian: -100, pressure: -200, extraMinutes: 30, reveal: [FACT], setFlags: ['recovered'], text: 'The attempted step used supplies; follow-through is still required.' }], { consumes: [{ tag: 'medkit', qty: 1 }], stressBase: 50, consequenceLevel: 'high' }),
      action('finish', 'resolve', [{ ending: 'handed_over', text: 'Responsibility and checked facts were passed on.' }]),
    ] },
  };
  return scenario;
}
function started(): GameState {
  const state = makeState();
  state.saveVersion = CURRENT_SAVE_VERSION;
  state.contentVersion = 3;
  initializePersonnel(state);
  return startRun(state, ID, ['A']);
}
function decide(state: GameState, actionId: string): GameState {
  const result = apply(state, { type: 'decide', actionId, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  return result.state;
}

beforeEach(() => { SCENARIOS[ID] = fixture(); });
afterEach(() => { delete SCENARIOS[ID]; });

describe('committed v3 decisions', () => {
  it('records actual clamped scores, elapsed time, strain, supplies, knowledge and ending', () => {
    let state = decide(started(), 'prime');
    for (const officer of Object.values(state.officers)) officer.stress = 99.5;
    const before = structuredClone(state);
    state = decide(state, 'recover');
    const run = state.activeRun!;
    const record = run.history.at(-1)!;
    expect(record.committed).toMatchObject({ objectiveDelta: 3, civilianSafetyDelta: -4, pressureDelta: -100, endingTitle: null });
    expect(record.timeCost).toBe(round(run.clock - before.activeRun!.clock));
    expect(record.timeCost).toBeGreaterThanOrEqual(31);
    for (const [id, delta] of Object.entries(record.stressDeltas)) {
      expect(delta).toBe(0.5);
      expect(delta).toBe(round(state.officers[id].stress - before.officers[id].stress));
    }
    expect(record.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
    expect(record.knowledgeChanges).toEqual([{ factId: FACT, status: 'confirmed' }]);
    expect(record.explanation).toContain('Time pressure is past 90: civilian safety fell 4.');
    expect(record.committed!.consequences).toContain('Next: A safe follow-through remains available.');
    expect(lastDecisionView(state)).toMatchObject({ objectiveDelta: 3, civilianSafetyDelta: -4, pressureDelta: -100, actualStressDeltas: true, supplies: [{ itemId: 'trauma_kit', label: 'Trauma kit', qty: 1 }] });
    expect(traceRun(SCENARIOS[ID], run).end).toEqual(Object.fromEntries(['knowledge', 'flags', 'pressure', 'objective', 'civilianSafety', 'clock'].map((key) => [key, run[key as keyof typeof run]])));
    state = decide(state, 'finish');
    expect(lastDecisionView(state)?.endingTitle).toBe(SCENARIOS[ID].endings.handed_over.title);
    expect(pendingDebrief(state)?.endingSummary).toBe(SCENARIOS[ID].endings.handed_over.summary);
    expect(stageProgress(state).prompt).toBe(SCENARIOS[ID].endings.handed_over.summary);
  });

  it('persists the log and continues with identical samples and results after reload', () => {
    const state = decide(started(), 'prime');
    const loaded = deserialize(serialize(state, NOW))!;
    expect(loaded).not.toBeNull();
    expect(loaded.activeRun).toEqual(state.activeRun);
    expect(decisionViews(loaded)).toEqual(decisionViews(state));
    const continued = decide(state, 'recover');
    const resumed = decide(loaded, 'recover');
    expect(resumed.activeRun).toEqual(continued.activeRun);
    expect(resumed.officers).toEqual(continued.officers);
    expect(decisionViews(resumed)).toEqual(decisionViews(continued));
    expect(deserialize(serialize(resumed, NOW))!.activeRun).toEqual(resumed.activeRun);
    expect(resumed.activeRun!.rngState).toBe(next(state.activeRun!.rngState).state);
  });

  it('bounds resolve recovery to one committed attempt and settles rewards once', () => {
    const state = decide(decide(started(), 'prime'), 'recover');
    expect(state.activeRun).toMatchObject({ status: 'active', stage: 'resolve', revision: 2 });
    const repeated = apply(state, { type: 'decide', actionId: 'recover', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(repeated.result).toEqual({ ok: false, reason: 'Already tried this stage' });
    expect(repeated.state).toBe(state);
    expect(repeated.state.department.funding).toBe(state.department.funding);
    const finished = decide(state, 'finish');
    expect(finished.department.funding).toBe(state.department.funding);
    const closed = apply(finished, { type: 'closeDebrief' });
    expect(closed.result).toEqual({ ok: true });
    expect(closed.state.department.funding).toBe(state.department.funding + closed.state.debriefs[0].fundingReward);
    expect(closed.state.debriefs[0].decisions).toEqual(decisionViews(finished));
    expect(deserialize(serialize(closed.state, NOW))!.debriefs[0].decisions).toEqual(decisionViews(finished));
    expect(apply(closed.state, { type: 'closeDebrief' })).toEqual({ state: closed.state, result: { ok: false, reason: 'No debrief to close' } });
  });

  it('finishes safely when every one-shot nonterminal resolve option has been used', () => {
    SCENARIOS[ID].stages.resolve.actions = [action('only_recovery', 'resolve', [{ stage: 'resolve', text: 'The recovery attempt was inconclusive.' }])];
    expect(validateScenario(SCENARIOS[ID], builtFor('maple_street', 0, []))).toEqual([]);
    const state = decide(decide(started(), 'prime'), 'only_recovery');
    expect(state.activeRun).toMatchObject({ status: 'debrief', endingId: 'handed_over', revision: 2 });
    expect(lastDecisionView(state)?.endingTitle).toBe(SCENARIOS[ID].endings.handed_over.title);
  });

  it('does not let time-saving effects reverse operation time', () => {
    SCENARIOS[ID].stages.assess.actions = [action('too_fast', 'assess', [{ stage: 'resolve', extraMinutes: -100 }])];
    const state = decide(started(), 'too_fast');
    expect(state.activeRun!.clock).toBe(0.5);
    expect(lastDecisionView(state)!.timeCost).toBe(0.5);
  });

  it.each([{ trust: 99, adjust: 40, delta: 1 }, { trust: 1, adjust: -40, delta: -1 }, { trust: 100, adjust: 40, delta: 0 }, { trust: 0, adjust: -40, delta: 0 }])('reports actual boundary-limited trust when closing (%j)', ({ trust, adjust, delta }) => {
    SCENARIOS[ID].endings.handed_over.trustAdjust = adjust;
    const state = decide(decide(started(), 'prime'), 'finish');
    state.department.trust = trust;
    const debrief = pendingDebrief(state)!;
    expect(debrief.trustDelta).toBe(delta);
    const closed = apply(state, { type: 'closeDebrief' });
    expect(closed.result).toEqual({ ok: true });
    expect(closed.state.department.trust - state.department.trust).toBe(debrief.trustDelta);
    expect(closed.state.debriefs[0].trustDelta).toBe(debrief.trustDelta);
    const repeated = apply(closed.state, { type: 'closeDebrief' });
    expect(repeated.result.ok).toBe(false);
    expect(repeated.state).toBe(closed.state);
  });

  it('distinguishes actual ending strain at close from decision-time strain', () => {
    SCENARIOS[ID].endings.handed_over.strain = 5;
    const state = decide(decide(started(), 'prime'), 'finish');
    state.officers.off_chen.stress = 99;
    const history = structuredClone(state.activeRun!.history);
    const debrief = pendingDebrief(state)!;
    expect(debrief.causes[0]).toContain('Ending adjustment at close: Chen +1 strain');
    const closed = apply(state, { type: 'closeDebrief' });
    expect(closed.state.officers.off_chen.stress).toBe(100);
    expect(state.activeRun!.history).toEqual(history);
    expect(closed.state.debriefs[0].decisions).toEqual(decisionViews(state));
  });
});

describe('public previews and committed truth', () => {
  function installProbe(status: KnowledgeStatus, truth: boolean) {
    const scenario = SCENARIOS[ID];
    scenario.facts[0].initial = status;
    scenario.facts[0].truth = truth;
    if (!truth) delete scenario.facts[0].person!.at;
    const probe = action('probe', 'assess', [
      { stage: 'adapt', reveal: [FACT] },
      { truth: [{ factId: FACT, is: true }], extraMinutes: 4, text: 'CONFIRMED PRIVATE BRANCH' },
      { truth: [{ factId: FACT, is: false }], extraMinutes: 2, text: 'DISPROVED PRIVATE BRANCH' },
    ], { targetId: 'bedroom_e', approach: 'window', spatial: { channel: 'visual', subjectFactId: FACT, weight: 4, noun: 'Known sightline' }, consequenceLevel: 'severe' });
    scenario.stages.assess.actions = [probe, action('hidden', 'assess', [{ stage: 'adapt', reveal: [FACT] }], { visibleWhen: { facts: [{ factId: FACT, in: ['confirmed'] }] } })];
    return probe;
  }

  it.each(['unknown', 'reported'] as KnowledgeStatus[])('keeps every public projection identical when only hidden truth changes (%s)', (status) => {
    installProbe(status, true);
    const trueState = started();
    const snapshots = (state: GameState) => ({ actions: actionViews(state, NOW, 'A'), explicit: previewAction(state, NOW, 'probe', ['A'], []), hidden: previewAction(state, NOW, 'hidden', ['A'], []), spaces: spaceViews(state), stage: stageProgress(state) });
    const before = snapshots(trueState);
    const unchanged = structuredClone(trueState);
    SCENARIOS[ID].facts[0].truth = false;
    delete SCENARIOS[ID].facts[0].person!.at;
    expect(snapshots(trueState)).toEqual(before);
    expect(trueState).toEqual(unchanged);
    expect(before.hidden).toBeNull();
    expect(JSON.stringify(before)).not.toMatch(/PRIVATE BRANCH/);
    expect(before.actions[0].consequenceLevel).toBe('severe');
    expect(before.actions[0].likelihood.favorable + before.actions[0].likelihood.mixed + before.actions[0].likelihood.adverse).toBeCloseTo(1);
    const fact = before.spaces.flatMap((space) => space.facts).find((fact) => fact.id === FACT)!;
    expect(fact.verifyActions).toContainEqual({ actionId: 'probe', title: 'probe', stage: 'assess', availableNow: true });
    expect(fact.verifyActions.some((action) => action.actionId === 'hidden')).toBe(false);
  });

  it.each([true, false])('settles reveal and truth branches only on commit, then replays them without RNG (%s)', (truth) => {
    installProbe('reported', truth);
    const initial = started();
    const preview = previewAction(initial, NOW, 'probe', ['A'], [])!;
    const state = decide(initial, 'probe');
    const record = state.activeRun!.history[0];
    expect(record.knowledgeChanges).toContainEqual({ factId: FACT, status: truth ? 'confirmed' : 'disproved' });
    expect(record.committed?.consequences.join(' ')).toContain(truth ? 'CONFIRMED PRIVATE BRANCH' : 'DISPROVED PRIVATE BRANCH');
    expect(record.committed?.consequences.join(' ')).not.toContain(truth ? 'DISPROVED PRIVATE BRANCH' : 'CONFIRMED PRIVATE BRANCH');
    expect(record.timeCost).toBeGreaterThanOrEqual(preview.timeRange.min);
    expect(record.timeCost).toBeLessThanOrEqual(preview.timeRange.max);
    const copy = structuredClone(state);
    expect(traceRun(SCENARIOS[ID], state.activeRun!).end.knowledge[FACT]).toBe(truth ? 'confirmed' : 'disproved');
    decisionViews(state);
    expect(state).toEqual(copy);
  });

  it('matches public conditions against the pre-decision state, not a preceding effect', () => {
    const scenario = SCENARIOS[ID];
    const probe = action('probe', 'assess', [{ reveal: [FACT] }, { when: { facts: [{ factId: FACT, in: ['confirmed'] }] }, objective: 99 }]);
    const state = started();
    expect(matchedEffects(probe, 'favorable', state.activeRun!, scenario)).toHaveLength(1);
  });

  it('returns detached public metadata, so rendering cannot mutate the durable log or authored previews', () => {
    const state = decide(started(), 'prime');
    const record = state.activeRun!.history[0];
    const original = structuredClone(record);
    decisionViews(state)[0].consequences.push('UI-only note');
    const view = previewAction(state, NOW, 'recover', ['A'], [])!;
    view.outcomePreview.favorable = 'UI-only wording';
    expect(record).toEqual(original);
    expect(SCENARIOS[ID].stages.resolve.actions[0].outcomePreview!.favorable).not.toBe('UI-only wording');
  });

  it('lists actual declared supplies and never restores retired batteries when eligibility is blocked', () => {
    const scenario = SCENARIOS[ID];
    scenario.stages.assess.actions = [action('powered', 'assess', [{ stage: 'resolve' }], { consumes: [{ tag: 'battery', qty: 2 }, { tag: 'medkit', qty: 1 }] }), action('wait', 'assess', [{ stage: 'resolve' }])];
    const state = started();
    const stocked = previewAction(state, NOW, 'powered', ['A'], [])!;
    expect(stocked.suppliesRequired).toEqual([{ label: 'Trauma kit', qty: 1 }]);
    state.reservations = state.reservations.filter((reservation) => reservation.itemId !== 'trauma_kit');
    const missing = previewAction(state, NOW, 'powered', ['A'], [])!;
    expect(missing.eligible).toBe(false);
    expect(missing.suppliesRequired).toEqual([{ label: 'Trauma kit', qty: 1 }]);
    expect(JSON.stringify(missing.suppliesRequired)).not.toMatch(/battery/i);
  });

  it('rejects unknown fact IDs in public visibility and commit-only reveal/truth declarations', () => {
    const scenario = SCENARIOS[ID];
    scenario.stages.assess.actions[0].visibleWhen = { facts: [{ factId: 'bad_visibility', in: ['confirmed'] }] };
    scenario.stages.assess.actions[0].outcomes.favorable.push({ reveal: ['bad_reveal'], truth: [{ factId: 'bad_truth', is: true }] });
    const errors = validateScenario(scenario, builtFor('maple_street', 0, []));
    for (const id of ['bad_visibility', 'bad_reveal', 'bad_truth']) expect(errors.join(' ')).toContain(id);
  });

  it('shows mandatory device supplies when the device is unavailable, without legacy power rows', () => {
    SCENARIOS[ID].stages.assess.actions.push(action('device', 'assess', [{ stage: 'resolve' }], { requires: { allTags: ['energy_device'] }, capabilities: { rules: ['less_lethal_device'], required: ['less_lethal_device'] } }));
    const view = previewAction(started(), NOW, 'device', ['A'], [])!;
    expect(view.eligible).toBe(false);
    expect(view.suppliesRequired).toEqual([{ label: 'Device cartridge', qty: 1 }]);
  });
});

describe('legacy compatibility boundaries', () => {
  it('preserves historically recorded battery consumption in old decision logs', () => {
    SCENARIOS[ID].version = 1;
    SCENARIOS[ID].stages.resolve.actions = [action('finish', 'resolve', [{ ending: 'handed_over' }])];
    const state = decide(started(), 'prime');
    state.activeRun!.history[0].itemsConsumed.push({ itemId: 'battery_pack', qty: 1 });
    expect(lastDecisionView(state)?.supplies).toContainEqual({ itemId: 'battery_pack', label: 'Battery pack', qty: 1 });
    expect(lastDecisionView(state)?.actualStressDeltas).toBe(false);
  });
  it.each([1, 2])('keeps legacy decision payloads free of new committed fields (version %s)', (version) => {
    const scenario = SCENARIOS[ID];
    scenario.version = version;
    scenario.stages.resolve.actions = [action('finish', 'resolve', [{ ending: 'handed_over' }])];
    const state = decide(started(), 'prime');
    expect(state.activeRun!.history[0]).not.toHaveProperty('committed');
    expect(lastDecisionView(state)?.actualStressDeltas).toBe(false);
    expect(pendingDebrief(decide(state, 'finish'))).not.toHaveProperty('endingSummary');
  });

  it('preserves versioned replay and resupply pressure before decisions', () => {
    const initial = started();
    initial.activeRun!.resupplies = [{ minutes: 50, allocations: [] }];
    advanceTime(initial.activeRun!, SCENARIOS[ID], 50);
    const state = decide(initial, 'prime');
    const run = state.activeRun!;
    const traced = traceRun(SCENARIOS[ID], run);
    expect(traced.end.clock).toBe(run.clock);
    expect(traced.end.civilianSafety).toBe(run.civilianSafety);
    expect(traced.end.pressure).toBe(run.pressure);
    expect(traced.steps[0].pressureDelta).toBe(run.history[0].committed!.pressureDelta);
    const ev = evaluateAction({ state, run, scenario: SCENARIOS[ID], action: SCENARIOS[ID].stages.resolve.actions[1], built: builtFor('maple_street', 0, []), acting: ['A'], support: [] });
    expect(ev.eligible).toBe(true);
  });
});
