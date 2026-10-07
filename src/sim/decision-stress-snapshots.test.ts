import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import { HOUR_MS, settle } from './economy';
import { decisionViews, lastDecisionView } from './operation-selectors';
import { initializePersonnel } from './personnel';
import { next } from './rng';
import { CURRENT_SAVE_VERSION, deserialize, serialize } from './save';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import { apply, makeState, NOW, startRun } from './test-fixtures';
import type { GameState, OutcomeBand, StageId } from './types';

const ID = 'decision_stress_fixture';
const round = (n: number) => Math.round(n * 10) / 10;

function action(stage: StageId, effect: OutcomeEffect): ActionDefinition {
  return {
    id: stage, stage, title: stage, icon: 'radio', summary: 'Check the report',
    targetId: 'front_yard', task: 'Checking', requires: {}, approach: 'none',
    workload: { base: 1, perSqFt: 0 }, stressBase: 12,
    check: { kind: 'coordination', difficulty: 35, ratings: [{ key: 'coordination', weight: 1 }] },
    outcomes: Object.fromEntries((['favorable', 'mixed', 'adverse'] as OutcomeBand[]).map((band) => [band, [effect]])) as ActionDefinition['outcomes'],
  };
}

function fixture(): ScenarioDefinition {
  const scenario = structuredClone(SCENARIOS.ms_occupancy);
  scenario.id = ID;
  scenario.version = 3;
  scenario.pressure = { start: 0, perMinute: 0, threshold: 90, civilianPerMinute: 0 };
  scenario.stages = {
    assess: { id: 'assess', label: 'Assess', prompt: 'Assess', actions: [action('assess', { stage: 'adapt' })] },
    adapt: { id: 'adapt', label: 'Adapt', prompt: 'Adapt', actions: [action('adapt', { stage: 'resolve' })] },
    resolve: { id: 'resolve', label: 'Resolve', prompt: 'Resolve', actions: [action('resolve', { ending: 'handed_over' })] },
  };
  scenario.endings.handed_over.strain = 5;
  return scenario;
}

function started(): GameState {
  const state = makeState();
  state.saveVersion = CURRENT_SAVE_VERSION;
  state.contentVersion = 3;
  initializePersonnel(state);
  return startRun(state, ID, ['A']);
}

function decide(state: GameState): GameState {
  const actionId = state.activeRun!.stage;
  const result = apply(state, { type: 'decide', actionId, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  return result.state;
}

beforeEach(() => { SCENARIOS[ID] = fixture(); });
afterEach(() => { delete SCENARIOS[ID]; });

describe('decision-time stress snapshots', () => {
  it.each([
    { before: 0, stressBase: 0, after: 0 },
    { before: 0.5, stressBase: -12, after: 0 },
    { before: 99.5, stressBase: 12, after: 100 },
    { before: 100, stressBase: 12, after: 100 },
  ])('records actual levels and deltas at clamped boundaries (%j)', ({ before, stressBase, after }) => {
    SCENARIOS[ID].stages.assess.actions[0].stressBase = stressBase;
    const state = started();
    for (const id of state.squads[0].officerIds) state.officers[id].stress = before;
    const resolved = decide(state);
    const record = resolved.activeRun!.history[0];
    expect(Object.keys(record.stressLevels!)).toEqual(Object.keys(record.stressDeltas));
    expect(lastDecisionView(resolved)!.actualStressDeltas).toBe(true);
    for (const row of lastDecisionView(resolved)!.stressDeltas) {
      expect(record.stressLevels![row.officerId]).toEqual({ stressBefore: before, stressAfter: after });
      expect(row).toMatchObject({ stressBefore: before, stressAfter: after, delta: round(after - before) });
      expect(resolved.officers[row.officerId].stress).toBe(after);
    }
    expect(resolved.activeRun!.rngState).toBe(next(state.activeRun!.rngState).state);
  });

  it('retains detached snapshots through later decisions, debrief settlement, rest and reload', () => {
    let state = decide(started());
    const firstRecord = structuredClone(state.activeRun!.history[0]);
    const firstView = structuredClone(decisionViews(state)[0]);
    const detached = decisionViews(state)[0];
    detached.stressDeltas[0].stressAfter = 99;
    detached.stressDeltas[0].stressBefore = 98;
    expect(state.activeRun!.history[0]).toEqual(firstRecord);
    state = decide(state);
    expect(state.officers.off_chen.stress).toBeGreaterThan(firstRecord.stressLevels!.off_chen.stressAfter);
    expect(decisionViews(state)[0]).toEqual(firstView);
    state = decide(state);
    const views = structuredClone(decisionViews(state));
    const stressBeforeClose = state.officers.off_chen.stress;
    const closed = apply(state, { type: 'closeDebrief' });
    expect(closed.result).toEqual({ ok: true });
    expect(closed.state.officers.off_chen.stress).toBe(stressBeforeClose + 5);
    expect(closed.state.debriefs[0].decisions).toEqual(views);
    expect(state.activeRun!.history[0]).toEqual(firstRecord);
    closed.state.squads[0].duty = 'rest';
    settle(closed.state, NOW + HOUR_MS);
    expect(closed.state.officers.off_chen.stress).toBeLessThan(stressBeforeClose + 5);
    expect(closed.state.debriefs[0].decisions).toEqual(views);
    expect(deserialize(serialize(closed.state, NOW + HOUR_MS))!.debriefs[0].decisions).toEqual(views);
  });

  it.each([1, 2])('captures new legacy scenario decisions without changing stored requested strain (v%s)', (version) => {
    SCENARIOS[ID].version = version;
    const initial = started();
    for (const id of initial.squads[0].officerIds) initial.officers[id].stress = 99.5;
    const state = decide(initial);
    const record = state.activeRun!.history[0];
    expect(record).not.toHaveProperty('committed');
    expect(record.stressDeltas.off_chen).toBeGreaterThan(0.5);
    expect(lastDecisionView(state)).toMatchObject({ actualStressDeltas: true });
    expect(lastDecisionView(state)!.stressDeltas[0]).toMatchObject({ delta: 0.5, stressBefore: 99.5, stressAfter: 100 });
    expect(deserialize(serialize(state, NOW))!.activeRun).toEqual(state.activeRun);
  });

  it.each([1, 3])('loads existing active and archived decisions without inventing missing levels (v%s)', (version) => {
    SCENARIOS[ID].version = version;
    let state = decide(started());
    delete state.activeRun!.history[0].stressLevels;
    const savedDelta = state.activeRun!.history[0].stressDeltas.off_chen;
    state.officers.off_chen.stress = 100;
    state = deserialize(serialize(state, NOW))!;
    const first = lastDecisionView(state)!;
    expect(first.actualStressDeltas).toBe(version === 3);
    expect(first.stressDeltas[0].delta).toBe(savedDelta);
    expect(first.stressDeltas.every((row) => !('stressBefore' in row) && !('stressAfter' in row))).toBe(true);
    state = decide(decide(state));
    state = apply(state, { type: 'closeDebrief' }).state;
    const archived = structuredClone(state.debriefs[0].decisions![0]);
    state.officers.off_chen.stress = 0;
    const loaded = deserialize(serialize(state, NOW))!;
    expect(loaded.debriefs[0].decisions![0]).toEqual(archived);
    expect(loaded.debriefs[0].decisions![0].stressDeltas[0]).not.toHaveProperty('stressBefore');
    expect(loaded.department).toEqual(state.department);
  });
});

describe('saved stress snapshot validation', () => {
  const invalidPairs: [string, unknown][] = [
    ['missing before', { stressAfter: 50 }], ['missing after', { stressBefore: 50 }],
    ['missing both', {}], ['null', null], ['array', [20, 30]],
    ['below zero', { stressBefore: -1, stressAfter: 50 }], ['above 100', { stressBefore: 50, stressAfter: 101 }],
    ['nonfinite before', { stressBefore: Infinity, stressAfter: 50 }], ['nonfinite after', { stressBefore: 50, stressAfter: NaN }],
    ['numeric string', { stressBefore: '40', stressAfter: 50 }],
  ];

  it.each(invalidPairs)('rejects invalid active-run snapshot: %s', (_label, pair) => {
    const state = decide(started());
    (state.activeRun!.history[0].stressLevels as Record<string, unknown>).off_chen = pair;
    expect(deserialize(serialize(state, NOW))).toBeNull();
  });

  it.each(invalidPairs.filter(([label]) => !['missing both', 'null', 'array'].includes(label)))('rejects incomplete or invalid archived stress row: %s', (_label, pair) => {
    const state = apply(decide(decide(decide(started()))), { type: 'closeDebrief' }).state;
    const row = state.debriefs[0].decisions![0].stressDeltas[0];
    delete row.stressBefore;
    delete row.stressAfter;
    Object.assign(row, pair);
    expect(deserialize(serialize(state, NOW))).toBeNull();
  });

  it('rejects orphan or missing officer snapshots when the optional map is present', () => {
    const state = decide(started());
    const missing = structuredClone(state);
    delete missing.activeRun!.history[0].stressLevels!.off_chen;
    expect(deserialize(serialize(missing, NOW))).toBeNull();
    const orphan = structuredClone(state);
    orphan.activeRun!.history[0].stressLevels!.off_ghost = { stressBefore: 0, stressAfter: 2 };
    expect(deserialize(serialize(orphan, NOW))).toBeNull();
  });
});
