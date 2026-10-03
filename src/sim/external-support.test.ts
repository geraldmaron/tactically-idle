import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { GameState } from './types';
import { createInitialState } from './department';
import { apply, NOW, startRun } from './test-fixtures';
import { actionViews } from './operation-selectors';
import { computeDebrief, outcomeFactor, validateScenario } from './operation';
import { externalSupportViews, validExternalSupportState } from './external-support';
import { deserialize, serialize } from './save';
import { getBuilt } from './resolution';

const ID = 'test_external_support_v4';
const effects = (effect: OutcomeEffect) => ({ favorable: [effect], mixed: [effect], adverse: [effect] });
function action(id: string, effect: OutcomeEffect, extra: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    id, stage: 'assess', title: id, icon: 'radio', summary: id, targetId: 'front_yard', task: id,
    requires: {}, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 1 }], difficulty: 25 },
    approach: 'none', workload: { base: 0.5, perSqFt: 0 }, stressBase: 0, outcomes: effects(effect), ...extra,
  };
}
function definition(): ScenarioDefinition {
  const base = structuredClone(SCENARIOS.ms_occupancy);
  const requests = ['medical', 'community', 'unavailable'].map((serviceId) => action(`request_${serviceId}`, { requestSupport: [serviceId], stage: 'assess' }));
  return {
    ...base, id: ID, version: 4, pressure: { start: 0, perMinute: 0, threshold: 100, civilianPerMinute: 0 },
    rewards: { funding: 200, devPoints: 6, trust: 5, xp: 20 },
    externalServices: [
      { id: 'medical', label: 'North medical team', kind: 'medical', description: 'A clinical receiving team', arrivalMinutes: 10, available: true, acceptWhen: { flags: ['care_ready'] } },
      { id: 'community', label: 'Community response team', kind: 'community', description: 'A named follow-up service', arrivalMinutes: 7, available: true, acceptWhen: { flags: ['care_ready'] } },
      { id: 'unavailable', label: 'Relief team', kind: 'relief', description: 'No team is available for this incident', arrivalMinutes: 8, available: false },
    ],
    stages: {
      assess: { id: 'assess', label: 'Assess', prompt: 'Keep responsibility until completion.', actions: [
        ...requests,
        action('request_alias', { requestSupport: ['medical'], stage: 'assess' }),
        action('prepare', { setFlags: ['care_ready'], objective: 30, stage: 'assess' }, { workload: { base: 2, perSqFt: 0 } }),
        action('wait_medical', { stage: 'assess' }, { awaitSupport: 'medical' }),
        action('wait_community', { stage: 'assess' }, { awaitSupport: 'community' }),
        action('wait_unavailable', { stage: 'assess' }, { awaitSupport: 'unavailable' }),
        action('accept_medical', { acceptSupport: ['medical'], objective: 70, ending: 'care' }, { requires: { externalSupport: [{ serviceId: 'medical', status: 'available', reason: 'The medical team must arrive.' }] } }),
        action('accept_wrong', { acceptSupport: ['community'], stage: 'assess' }, { requires: { externalSupport: [{ serviceId: 'community', status: 'available', reason: 'The community team must arrive.' }] } }),
        action('leave', { ending: 'handed_over' }),
        action('resolve', { setFlags: ['resolved'], objective: 100, ending: 'resolved' }),
        action('fake_care', { objective: 100, ending: 'care' }),
      ] },
      adapt: { id: 'adapt', label: 'Adapt', prompt: 'Adapt', actions: [action('adapt_end', { ending: 'handed_over' }, { stage: 'adapt' })] },
      resolve: { id: 'resolve', label: 'Resolve', prompt: 'Resolve', actions: [action('resolve_end', { ending: 'handed_over' }, { stage: 'resolve' })] },
    },
    endings: {
      handed_over: { id: 'handed_over', title: 'Responsibilities unfinished', summary: 'No receiver accepted responsibility.', trustAdjust: 0, strain: 0, disposition: 'unresolved', remainingTasks: ['Complete care or a safe disposition.'] },
      care: { id: 'care', title: 'Care accepted', summary: 'The named medical team accepted care.', trustAdjust: 0, strain: 0, disposition: 'care_accepted', completion: { acceptedServiceId: 'medical', flags: ['care_ready'] } },
      resolved: { id: 'resolved', title: 'Resolved', summary: 'The responsibility is complete.', trustAdjust: 0, strain: 0, disposition: 'resolved', completion: { flags: ['resolved'] } },
    },
  };
}
function started(): GameState { return startRun(createInitialState(NOW), ID, ['A']); }
function decide(state: GameState, actionId: string): GameState {
  const result = apply(state, { type: 'decide', actionId, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  return result.state;
}
function refused(state: GameState, actionId: string) {
  const result = apply(state, { type: 'decide', actionId, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result.ok).toBe(false);
  expect(result.state).toEqual(state);
}
beforeAll(() => { SCENARIOS[ID] = definition(); });
afterAll(() => { delete SCENARIOS[ID]; });

describe('external support responsibility lifecycle', () => {
  it('keeps requests nonterminal, unrewarded, named and one-shot', () => {
    const initial = started();
    const state = decide(initial, 'request_medical');
    const run = state.activeRun!;
    expect(run.status).toBe('active');
    expect(run.objective).toBe(0);
    expect(state.department.funding).toBe(initial.department.funding);
    expect(state.department.devPoints).toBe(initial.department.devPoints);
    expect(run.externalSupport?.medical).toEqual({ requestedAt: run.clock, availableAt: run.clock + 10, acceptedAt: null });
    expect(externalSupportViews(SCENARIOS[ID], run)[0]).toMatchObject({ status: 'requested', minutesRemaining: 10 });
    refused(state, 'request_medical');
    refused(state, 'request_alias');
    refused(state, 'accept_medical');
    expect(Object.keys(state.officers)).toEqual(Object.keys(initial.officers));
    expect(state.units).toEqual(initial.units);
  });

  it('advances arrivals during other decisions then waits exactly the remainder', () => {
    let state = decide(started(), 'request_medical');
    const availableAt = state.activeRun!.externalSupport!.medical.availableAt!;
    state = decide(state, 'prepare');
    const remaining = Math.round((availableAt - state.activeRun!.clock) * 10) / 10;
    const view = actionViews(state, NOW, 'A').find((entry) => entry.id === 'wait_medical')!;
    expect(view.timeCost).toBe(remaining);
    expect(view.timeRange).toEqual({ min: remaining, max: remaining });
    state = decide(state, 'wait_medical');
    expect(state.activeRun!.clock).toBe(availableAt);
    expect(state.activeRun!.history.at(-1)!.timeCost).toBe(remaining);
    expect(externalSupportViews(SCENARIOS[ID], state.activeRun!)[0].status).toBe('available');
    refused(state, 'wait_medical');
    const accepted = decide(state, 'accept_medical');
    expect(accepted.activeRun!.externalSupport!.medical.acceptedAt).toBe(accepted.activeRun!.clock);
    expect(computeDebrief(accepted, accepted.activeRun!)!).toMatchObject({ disposition: 'care_accepted', completionAchieved: true, receivingService: { id: 'medical' }, remainingTasks: [] });
    refused(accepted, 'accept_medical');
  });

  it('requires the correct ready service and prior care conditions', () => {
    let state = decide(started(), 'request_medical');
    state = decide(state, 'wait_medical');
    refused(state, 'accept_medical');
    state = decide(state, 'prepare');
    refused(state, 'accept_wrong');
    expect(actionViews(state, NOW, 'A').find((entry) => entry.id === 'accept_medical')!.eligible).toBe(true);
  });

  it('keeps unavailable support honest and cannot wait for or accept it', () => {
    let state = decide(started(), 'request_unavailable');
    expect(state.activeRun!.externalSupport!.unavailable).toMatchObject({ availableAt: null, acceptedAt: null });
    expect(externalSupportViews(SCENARIOS[ID], state.activeRun!)[2]).toMatchObject({ status: 'unavailable', minutesRemaining: null });
    refused(state, 'wait_unavailable');
    state = decide(state, 'leave');
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ disposition: 'unresolved', completionAchieved: false });
    expect(computeDebrief(state, state.activeRun!)!.receivingService).toBeUndefined();
  });

  it('resumes exact timers, histories and RNG, including a pending accepted debrief', () => {
    let state = decide(started(), 'request_medical');
    state = decide(state, 'prepare');
    const restored = deserialize(serialize(state, NOW))!;
    expect(restored).not.toBeNull();
    expect(restored.activeRun).toEqual(state.activeRun);
    const uninterrupted = decide(state, 'wait_medical');
    const resumed = decide(restored, 'wait_medical');
    expect(resumed).toEqual(uninterrupted);
    const ended = decide(resumed, 'accept_medical');
    expect(deserialize(serialize(ended, NOW))!.activeRun).toEqual(ended.activeRun);
    const closed = apply(ended, { type: 'closeDebrief' }).state;
    expect(deserialize(serialize(closed, NOW))!.debriefs[0]).toEqual(closed.debriefs[0]);
    const repeated = apply(closed, { type: 'closeDebrief' });
    expect(repeated.result.ok).toBe(false);
    expect(repeated.state).toEqual(closed);
  });

  it('rejects corrupt, forged, missing and out-of-order support timers', () => {
    const state = decide(decide(started(), 'request_medical'), 'prepare');
    const corruptions: ((state: GameState) => void)[] = [
      (s) => { s.activeRun!.externalSupport!.medical.availableAt! += 1; },
      (s) => { s.activeRun!.externalSupport!.medical.requestedAt = -1; },
      (s) => { s.activeRun!.externalSupport!.medical.acceptedAt = 0; },
      (s) => { s.activeRun!.externalSupport!.other = { requestedAt: 0, availableAt: 0, acceptedAt: 0 }; },
      (s) => { delete s.activeRun!.externalSupport; },
      (s) => { s.activeRun!.history[0].committed!.externalSupport = []; },
      (s) => { s.activeRun!.history[0].committed!.externalSupport![0].at += 1; },
      (s) => { s.activeRun!.history[0].committed!.externalSupport![0].kind = 'accepted'; },
      (s) => { s.activeRun!.clock += 1; },
      (s) => { s.activeRun!.rngState += 1; },
      (s) => { s.activeRun!.history[0].sample = 0.5; },
    ];
    for (const corrupt of corruptions) {
      const bad = structuredClone(state);
      corrupt(bad);
      expect(deserialize(serialize(bad, NOW))).toBeNull();
    }
    expect(validExternalSupportState(state.activeRun!, SCENARIOS[ID])).toBe(true);
  });

  it('gates full DP and favorable careers on completion while keeping service credit', () => {
    const partial = decide(decide(started(), 'prepare'), 'leave');
    expect(outcomeFactor(partial.activeRun!)).toBeCloseTo(0.615);
    const result = computeDebrief(partial, partial.activeRun!)!;
    expect(result.objective).toEqual({ score: 30, label: 'Unresolved' });
    expect(result.devPointReward).toBe(3);
    expect(result.fundingReward).toBeGreaterThan(0);
    const beforeCareer = partial.officers.off_chen.career.favorable;
    const closed = apply(partial, { type: 'closeDebrief' }).state;
    expect(closed.officers.off_chen.career.favorable).toBe(beforeCareer);
    const falselyScored = decide(started(), 'fake_care');
    expect(falselyScored.activeRun!.endingId).toBe('handed_over');
    expect(computeDebrief(falselyScored, falselyScored.activeRun!)!).toMatchObject({ completionAchieved: false, disposition: 'unresolved', objective: { score: 100, label: 'Unresolved' }, devPointReward: 3 });
    const full = decide(started(), 'resolve');
    const incompleteReward = computeDebrief(falselyScored, falselyScored.activeRun!)!;
    const fullReward = computeDebrief(full, full.activeRun!)!;
    expect(incompleteReward.fundingReward).toBeLessThan(fullReward.fundingReward);
    expect(incompleteReward.officerCondition[0].xpGained).toBeLessThan(fullReward.officerCondition[0].xpGained);
    expect(incompleteReward.trustDelta).toBeLessThan(fullReward.trustDelta);
  });

  it('gives accepted meaningful care equal completion credit', () => {
    let care = decide(started(), 'request_medical');
    care = decide(care, 'prepare');
    care = decide(care, 'wait_medical');
    care = decide(care, 'accept_medical');
    const resolved = decide(started(), 'resolve');
    expect(computeDebrief(care, care.activeRun!)!.devPointReward).toBe(computeDebrief(resolved, resolved.activeRun!)!.devPointReward);
    expect(computeDebrief(care, care.activeRun!)!.devPointReward).toBe(6);
    expect(apply(care, { type: 'closeDebrief' }).state.officers.off_chen.career.favorable).toBe(care.officers.off_chen.career.favorable + 1);
  });

  it('rejects invalid authored services and unguarded handovers', () => {
    const built = getBuilt(SCENARIOS[ID].locationFamilyId, SCENARIOS[ID].locationSeed);
    expect(validateScenario(SCENARIOS[ID], built)).toEqual([]);
    const invalid = structuredClone(SCENARIOS[ID]);
    invalid.externalServices![0].arrivalMinutes = 100;
    invalid.stages.assess.actions.find((entry) => entry.id === 'accept_medical')!.requires = {};
    invalid.stages.assess.actions.find((entry) => entry.id === 'request_medical')!.outcomes.favorable[0].ending = 'care';
    expect(validateScenario(invalid, built)).toEqual(expect.arrayContaining([
      expect.stringMatching(/response time/), expect.stringMatching(/acceptance requires/), expect.stringMatching(/requesting support cannot/),
    ]));
  });
});
