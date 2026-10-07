import { expect, it } from 'vitest';
import { makeState, startRun, apply, NOW } from './test-fixtures';
import { actionViews } from './operation-selectors';
import { getScenario } from './scenario-registry';
import { getBuilt } from './resolution';
import { hashSeed } from './rng';

/** The captured records carried a `practice: false` flag, removed with practice on 2026-10-06.
 * Putting it back where it stood shows every other byte of the run and settlement unchanged. */
function withRetiredFlag<T extends object>(record: T, beforeKey: string): T {
  return Object.fromEntries(Object.entries(record).flatMap(([key, value]) => key === beforeKey ? [['practice', false], [key, value]] : [[key, value]])) as T;
}

function completedRun(scenarioId: string, seed: number) {
  const scenario = getScenario(scenarioId)!;
  const initial = makeState({ rngState: seed });
  if (scenario.incident) initial.incidents = [{
    id: scenario.id, type: scenario.incident.type, familyId: scenario.locationFamilyId,
    tier: scenario.incident.tier, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: true,
  }];
  const entry = getBuilt(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
  let state = startRun(initial, scenarioId, ['A'], { positions: { A: entry } });
  for (let step = 0; state.activeRun?.status === 'active' && step < 30; step++) {
    const available = actionViews(state, NOW, 'A').filter((view) => view.eligible);
    const pick = available[step % 2] ?? available[0];
    if (!pick) throw new Error(`No action for ${scenarioId}`);
    const result = apply(state, { type: 'decide', actionId: pick.id, actingSquadIds: pick.actingSquadIds, supportSquadIds: pick.supportSquadIds });
    expect(result.result).toEqual({ ok: true });
    state = result.state;
  }
  const run = state.activeRun ? withRetiredFlag({
    ...state.activeRun,
    history: state.activeRun.history.map(({ stressLevels: _stressLevels, ...decision }) => decision),
  }, 'squadIds') : null;
  const closed = apply(state, { type: 'closeDebrief' });
  expect(closed.result).toEqual({ ok: true });
  const result = closed.state;
  const { decisions: _decisions, ...debrief } = result.debriefs[0];
  return { run, officers: result.officers, units: result.units, reservations: result.reservations, department: result.department, rngState: result.rngState, debrief: withRetiredFlag(debrief, 'objective') };
}

// Captured from unchanged management baseline 5325b00, then compared field-for-field.
// New display snapshots are additive; historical runs and settlements remain identical.
const LEGACY_OUTPUTS: Record<string, number> = {
  "ms_occupancy/17": 1154534141,
  "ms_occupancy/93": 3750771589,
  "ms_occupancy/641": 2117135951,
  "ms_urgent/17": 3653381957,
  "ms_urgent/93": 3519166904,
  "ms_urgent/641": 9654557,
  "gen:welfare_check:cedar_close:0:1:1:1/17": 3890085847,
  "gen:welfare_check:cedar_close:0:1:1:1/93": 3954215929,
  "gen:welfare_check:cedar_close:0:1:1:1/641": 3870714103,
  "gen:welfare_check:cedar_close:0:1:1:2/17": 2372814688,
  "gen:welfare_check:cedar_close:0:1:1:2/93": 1078128852,
  "gen:welfare_check:cedar_close:0:1:1:2/641": 1961257944,
  "gen:medical_complication:cedar_close:0:1:1:1/17": 1903181990,
  "gen:medical_complication:cedar_close:0:1:1:1/93": 2049849814,
  "gen:medical_complication:cedar_close:0:1:1:1/641": 733048746,
  "gen:medical_complication:cedar_close:0:1:1:2/17": 753491776,
  "gen:medical_complication:cedar_close:0:1:1:2/93": 3464173504,
  "gen:medical_complication:cedar_close:0:1:1:2/641": 3404708713,
  "gen:disturbance:cedar_close:0:1:1:1/17": 787448658,
  "gen:disturbance:cedar_close:0:1:1:1/93": 551207479,
  "gen:disturbance:cedar_close:0:1:1:1/641": 346818511,
  "gen:disturbance:cedar_close:0:1:1:2/17": 1939150658,
  "gen:disturbance:cedar_close:0:1:1:2/93": 3104234682,
  "gen:disturbance:cedar_close:0:1:1:2/641": 1296186020
};

it.each(Object.entries(LEGACY_OUTPUTS))('preserves the complete legacy run, RNG and settlement: %s', (key, fingerprint) => {
  const [scenarioId, seed] = key.split('/');
  expect(hashSeed(JSON.stringify(completedRun(scenarioId, Number(seed))))).toBe(fingerprint);
});
