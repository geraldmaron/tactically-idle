import { describe, expect, it } from 'vitest';
import { generateIncident, INCIDENT_TYPES_V5 } from '../gen/incident';
import { isGenericResponseExit, responseFailurePlan } from './response-failure';
import { apply, NOW, startRun } from './test-fixtures';
import { createInitialState } from './department';
import type { ScenarioDefinition } from './scenario-types';
import { actionViews } from './operation-selectors';
import { builtFor } from './resolution';
import { computeDebrief, validateScenario } from './operation';
import { deserialize, serialize } from './save';
import type { GameState } from './types';

function running(s: ScenarioDefinition): GameState {
  const state = createInitialState(NOW, 719);
  state.incidents = [{ id: s.id, type: s.incident!.type, familyId: s.incident!.familyId, tier: s.incident!.tier, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  return startRun(state, s.id, ['A'], { positions: { A: builtFor(s.locationFamilyId, s.locationSeed, []).location.entries[0] }, loadouts: { A: {} } });
}
function armed(seed = 1, version = 8): GameState {
  const s = generateIncident({ type: 'active_armed_incident', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: version });
  return running(s);
}

describe('guarded failed responses', () => {
  it('keeps current viable calls playable without a generic exit or an early failure reward', () => {
    for (const type of INCIDENT_TYPES_V5) {
      const s = generateIncident({ type: type.type, familyId: type.families[0], buildingSeed: 7, seed: 1, tier: 2, contentVersion: 8 });
      const built = builtFor(s.locationFamilyId, s.locationSeed, []);
      expect(validateScenario(s, built), s.id).toEqual([]);
      expect(Object.values(s.stages).flatMap(stage => stage.actions).some(action => isGenericResponseExit(s, action))).toBe(false);
      const state = running(s);
      expect(responseFailurePlan(state), s.id).toBeNull();
      const before = structuredClone(state);
      expect(apply(state, { type: 'endFailedResponse', runId: state.activeRun!.id, revision: 0 }).result.ok).toBe(false);
      expect(state).toEqual(before);
    }
  });

  it('requires a real dead end, gives no progress or reward, and survives reload and settlement once', () => {
    let state = armed();
    const first = apply(state, { type: 'decide', actionId: 'v5_noise_check_patrol', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(first.result).toEqual({ ok: true }); state = first.state;
    const plan = responseFailurePlan(state)!;
    expect(plan).not.toBeNull();
    expect(plan.reasonKind).toBe('no_viable_approach');
    const before = structuredClone(state.activeRun!);
    const ended = apply(state, { type: 'endFailedResponse', runId: plan.runId, revision: plan.revision });
    expect(ended.result).toEqual({ ok: true });
    expect(ended.state.activeRun).toMatchObject({ status: 'debrief', objective: before.objective, clock: before.clock, rngState: before.rngState, history: before.history });
    const restored = deserialize(serialize(ended.state, NOW));
    expect(restored?.activeRun).toEqual(ended.state.activeRun);
    const report = computeDebrief(ended.state, ended.state.activeRun!)!;
    expect(report).toMatchObject({ completionAchieved: false, disposition: 'unresolved', fundingReward: 0, devPointReward: 0, trustDelta: -2 });
    expect(report.officerCondition.every(officer => officer.xpGained === 0)).toBe(true);
    expect(apply(ended.state, { type: 'endFailedResponse', runId: plan.runId, revision: plan.revision }).result.ok).toBe(false);
    const closed = apply(ended.state, { type: 'closeDebrief' });
    expect(closed.result).toEqual({ ok: true });
    expect(closed.state.department.funding).toBe(ended.state.department.funding);
    expect(closed.state.department.trust).toBe(ended.state.department.trust - 2);
    expect(deserialize(serialize(closed.state, NOW))?.debriefs[0]).toEqual(closed.state.debriefs[0]);
  });

  it('does not rewrite old records while retiring their generic current cards', () => {
    const state = armed(1, 7);
    expect(actionViews(state, NOW, 'A').some(action => /withdraw|partial/.test(action.id))).toBe(false);
    const legacy = apply(state, { type: 'decide', actionId: 'v5_noise_assess_withdraw', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(legacy.result).toEqual({ ok: true });
    const restored = deserialize(serialize(legacy.state, NOW));
    expect(restored?.activeRun?.history).toEqual(legacy.state.activeRun?.history);
    expect(restored?.activeRun?.responseFailure).toBeUndefined();
  });

  it('rejects stale, forged and premature failed-response records', () => {
    const state = armed();
    expect(apply(state, { type: 'endFailedResponse', runId: 'another-run', revision: 0 }).result.ok).toBe(false);
    const forged = structuredClone(state);
    forged.activeRun!.responseFailure = { version: 1, revision: 0, atClock: 0, reasonKind: 'no_viable_approach', title: 'Failure', reason: 'No', remainingTasks: ['Still open'] };
    expect(deserialize(serialize(forged, NOW))).toBeNull();
  });
});
