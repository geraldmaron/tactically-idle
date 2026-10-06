import { describe, expect, it } from 'vitest';
import { COURSES } from '../content/courses';
import { DEV_NODES } from '../content/dev-tree';
import { generateIncident } from '../gen/incident';
import { initializePersonnel } from './personnel';
import { computeDebrief } from './operation';
import { actionViews } from './operation-selectors';
import { bandFor, builtFor, evaluateAction } from './resolution';
import { forceSeverity } from './force-risk';
import { hashSeed, next } from './rng';
import { deserialize, serialize } from './save';
import { scenarioActions, type ScenarioDefinition } from './scenario-types';
import { apply, makeState, NOW, startRun } from './test-fixtures';
import type { GameState } from './types';

function scene(): ScenarioDefinition {
  for (let seed = 0; seed < 30; seed++) {
    const scenario = generateIncident({ type: 'active_armed_incident', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 8 });
    if (!scenario.facts.find(fact => fact.id === 'v5_noise_f_care_needed')!.truth
      && scenario.externalServices!.find(service => service.id === 'v7_medical_grant')!.available) return scenario;
  }
  throw Error('No bounded scene with an available receiver and no additional civilian symptom');
}
function start(scenario: ScenarioDefinition, seed: number): GameState {
  const state = makeState({ rngState: seed, inventory: { service_sidearm: 1 } });
  state.saveVersion = 5; state.contentVersion = 8; initializePersonnel(state);
  state.department.unlockedNodes = Object.keys(DEV_NODES);
  state.department.developmentTiers = Object.fromEntries(Object.keys(DEV_NODES).map(id => [id, 1]));
  const certs = Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : []);
  for (const officer of Object.values(state.officers)) officer.certs = [...certs];
  state.incidents = [{ id: scenario.id, type: 'active_armed_incident', familyId: 'market_row', tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const built = builtFor(scenario.locationFamilyId, scenario.locationSeed, []);
  return startRun(state, scenario.id, ['A'], { positions: { A: built.location.entries[0] }, loadouts: { A: { service_sidearm: 1, trauma_kit: 2 } } });
}
function evaluation(state: GameState, scenario: ScenarioDefinition, id: string) {
  const run = state.activeRun!, action = scenarioActions(scenario).find(action => action.id === id)!;
  expect(action, id).toBeDefined();
  return evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function choose(state: GameState, scenario: ScenarioDefinition, id: string): GameState {
  const ev = evaluation(state, scenario, id); expect(ev.eligible, `${id}: ${ev.reason}`).toBe(true);
  const result = apply(state, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result, id).toEqual({ ok: true });
  const restored = deserialize(serialize(result.state, NOW));
  expect(restored?.activeRun, `reload after ${id}`).toEqual(result.state.activeRun);
  return restored!;
}

/** Screen only the campaign seed. Every selected action uses its uninterrupted
 * natural sample stream, and every committed decision is reloaded. */
function injuredSubject(scenario: ScenarioDefinition, band: 'favorable' | 'mixed' = 'favorable'): GameState {
  const reference = choose(start(scenario, 1), scenario, 'v5_noise_hear_eli');
  const margin = evaluation(reference, scenario, 'v5_noise_urgent_response').margin;
  for (let seed = 0; seed < 100_000; seed++) {
    const campaign = next(seed);
    const initial = (hashSeed(`${scenario.id}:${scenario.locationSeed}`) ^ Math.floor(campaign.value * 4294967296)) >>> 0;
    const first = next(initial), effort = next(first.state), harm = next(effort.state);
    if (bandFor(margin, effort.value) !== band || forceSeverity('firearm', harm.value) !== 'serious') continue;
    let state = choose(start(scenario, seed), scenario, 'v5_noise_hear_eli');
    if (bandFor(evaluation(state, scenario, 'v5_noise_urgent_response').margin, effort.value) !== band) continue;
    state = choose(state, scenario, 'v5_noise_urgent_response');
    expect(state.activeRun!.history.at(-1)!.band).toBe(band);
    expect(state.activeRun!.personCasualties!.grant).toMatchObject({ severity: 'serious', care: 'needed' });
    return state;
  }
  throw Error('No bounded natural injury stream');
}

describe('V8 completion waits for remaining actual care', () => {
  it('keeps Eli’s chosen next step pending while Grant needs care, then settles that outcome once', () => {
    const scenario = scene();
    let state = injuredSubject(scenario);
    const injury = structuredClone(state.activeRun!.personCasualties!.grant);
    for (const id of ['v7_check_grant', 'v5_noise_reach_eli']) state = choose(state, scenario, id);
    const move = ['v5_noise_bring_eli_out', 'v5_noise_bring_eli_public', 'v5_noise_bring_eli_quiet'].find(id =>
      scenarioActions(scenario).some(action => action.id === id) && evaluation(state, scenario, id).eligible)!;
    expect(move).toBeDefined(); state = choose(state, scenario, move);
    const endingAction = scenarioActions(scenario).find(action => action.id === 'v5_noise_civilian_next_step')!;
    const chosenEnding = Object.values(endingAction.outcomes).flat().find(effect => effect.ending)!.ending!;
    state = choose(state, scenario, endingAction.id);
    expect(state.activeRun).toMatchObject({ status: 'active', stage: 'resolve', endingId: null });
    expect(state.activeRun!.responseFailure).toBeUndefined();
    expect(state.activeRun!.personCasualties!.grant).toEqual(injury);
    expect(state.activeRun!.history.filter(decision => decision.actionId === endingAction.id)).toHaveLength(1);
    expect(actionViews(state, NOW, 'A').some(action => action.id === 'v7_request_grant' && action.eligible)).toBe(true);
    expect(apply(state, { type: 'closeDebrief' }).result.ok).toBe(false);
    for (const id of ['v7_request_grant', 'v7_wait_grant', 'v7_receive_grant']) state = choose(state, scenario, id);
    expect(state.activeRun).toMatchObject({ status: 'debrief', stage: 'debrief', endingId: chosenEnding });
    expect(state.activeRun!.responseFailure).toBeUndefined();
    expect(state.activeRun!.personCasualties!.grant).toEqual({ ...injury, care: 'accepted' });
    expect(state.activeRun!.history.filter(decision => decision.actionId === endingAction.id)).toHaveLength(1);
    const report = computeDebrief(state, state.activeRun!)!;
    expect(report).toMatchObject({ completionAchieved: true, disposition: 'followup_agreed' });
    expect(report.personCasualties).toContainEqual(expect.objectContaining({ personId: 'grant', severity: 'serious', care: 'accepted' }));
    const beforeSettlement = structuredClone(state.department);
    const closed = apply(state, { type: 'closeDebrief' }); expect(closed.result).toEqual({ ok: true });
    expect(closed.state.department.funding - beforeSettlement.funding).toBe(report.fundingReward);
    expect(closed.state.department.devPoints - beforeSettlement.devPoints).toBe(report.devPointReward);
    expect(closed.state.department.trust - beforeSettlement.trust).toBe(report.trustDelta);
    const restored = deserialize(serialize(closed.state, NOW))!;
    expect(restored.activeRun).toBeNull(); expect(restored.debriefs).toEqual(closed.state.debriefs);
    expect(restored.debriefs.filter(debrief => debrief.runId === report.runId)).toHaveLength(1);
    const duplicate = apply(restored, { type: 'closeDebrief' });
    expect(duplicate.result.ok).toBe(false); expect(duplicate.state).toEqual(restored);
  });

  it('retains the earlier civilian-ending gate when an injured officer still needs transport', () => {
    const scenario = scene();
    let state = injuredSubject(scenario, 'mixed');
    expect(Object.values(state.activeRun!.officerCasualties ?? {})).toHaveLength(1);
    for (const id of ['v5_noise_resolve_officer_continue', 'v7_check_grant', 'v5_noise_reach_eli']) state = choose(state, scenario, id);
    const move = ['v5_noise_bring_eli_out', 'v5_noise_bring_eli_public', 'v5_noise_bring_eli_quiet'].find(id =>
      scenarioActions(scenario).some(action => action.id === id) && evaluation(state, scenario, id).eligible)!;
    expect(move).toBeDefined(); state = choose(state, scenario, move);
    expect(state.activeRun!.flags).toContain('casualty:awaiting_transport');
    expect(evaluation(state, scenario, 'v5_noise_civilian_next_step').eligible).toBe(false);
    const refused = apply(state, { type: 'decide', actionId: 'v5_noise_civilian_next_step', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(refused.result.ok).toBe(false); expect(refused.state).toEqual(state);
    expect(state.activeRun).toMatchObject({ status: 'active', stage: 'resolve', endingId: null });
    expect(evaluation(state, scenario, 'v5_noise_resolve_officer_request').eligible).toBe(true);
  });
});
