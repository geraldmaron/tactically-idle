import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import type { ActionDefinition, Condition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { GameState, OutcomeBand } from './types';
import { createInitialState } from './department';
import { apply, NOW, startRun } from './test-fixtures';
import { actionViews } from './operation-selectors';
import { computeDebrief, outcomeFactor, validateScenario } from './operation';
import { externalSupportActionIssue, externalSupportViews, validExternalSupportState } from './external-support';
import { deserialize, serialize } from './save';
import { getBuilt } from './resolution';

const ID = 'test_external_support_v4';
const CONDITIONAL_ID = 'test_external_support_v5';
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
function conditionalDefinition(): ScenarioDefinition {
  const scenario = definition();
  scenario.id = CONDITIONAL_ID;
  scenario.version = 5;
  for (const effect of Object.values(scenario.stages.assess.actions[0].outcomes).flat()) effect.setFlags = ['crew_requested'];
  for (const id of ['conditional_offer', 'conditional_escort']) {
    const option = action(id, { stage: 'assess' });
    for (const band of Object.keys(option.outcomes) as OutcomeBand[]) option.outcomes[band].push({
      when: { notFlags: ['crew_requested'] }, requestSupport: ['medical'], setFlags: ['crew_requested'],
    });
    scenario.stages.assess.actions.push(option);
  }
  return scenario;
}
function started(scenarioId = ID): GameState { return startRun(createInitialState(NOW), scenarioId, ['A']); }
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
beforeAll(() => { SCENARIOS[ID] = definition(); SCENARIOS[CONDITIONAL_ID] = conditionalDefinition(); });
afterAll(() => { delete SCENARIOS[ID]; delete SCENARIOS[CONDITIONAL_ID]; });

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

  it.each([0.3, 3.7])('preserves an exact fractional receiver wait of %s minutes in every preview', (remaining) => {
    const state = decide(started(), 'request_medical');
    const run = state.activeRun!;
    run.clock = Math.round((run.externalSupport!.medical.availableAt! - remaining) * 10) / 10;
    const before = structuredClone(state);
    const view = actionViews(state, NOW, 'A').find(a => a.id === 'wait_medical')!;
    expect(view).toMatchObject({ timeCost: remaining, timeRange: { min: remaining, max: remaining } });
    expect(state).toEqual(before);
    expect(decide(state, 'wait_medical').activeRun!.history.at(-1)!.timeCost).toBe(remaining);
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

describe('v5 public conditions on support effects', () => {
  const run = () => ({
    clock: 10, knowledge: { observed: 'confirmed' as const }, flags: ['care_ready', 'crew_requested'], pressure: 20,
    externalSupport: { medical: { requestedAt: 0, availableAt: 10, acceptedAt: null } },
  });
  const conditions: [string, Condition, Condition][] = [
    ['known fact', { facts: [{ factId: 'observed', in: ['confirmed'] }] }, { facts: [{ factId: 'observed', in: ['reported'] }] }],
    ['unknown fact', { facts: [{ factId: 'unseen', in: ['unknown'] }] }, { facts: [{ factId: 'unseen', in: ['confirmed'] }] }],
    ['required flag', { flags: ['care_ready'] }, { flags: ['not_ready'] }],
    ['excluded flag', { notFlags: ['not_ready'] }, { notFlags: ['crew_requested'] }],
    ['minimum pressure', { pressureAtLeast: 20 }, { pressureAtLeast: 21 }],
    ['maximum pressure', { pressureBelow: 21 }, { pressureBelow: 20 }],
  ];

  it.each(conditions)('checks requests only when the public %s condition matches', (_label, matches, misses) => {
    const scenario = SCENARIOS[CONDITIONAL_ID];
    expect(externalSupportActionIssue(run(), scenario, action('request', { when: misses, requestSupport: ['medical'] }))).toBeNull();
    expect(externalSupportActionIssue(run(), scenario, action('request', { when: matches, requestSupport: ['medical'] }))).toContain('already been requested');
  });

  it.each([1, 2, 3, 4])('preserves the issued v%s scan even when its public condition does not match', version => {
    const scenario = { ...SCENARIOS[CONDITIONAL_ID], version };
    expect(externalSupportActionIssue(run(), scenario, action('request', { when: { notFlags: ['crew_requested'] }, requestSupport: ['medical'] }))).toContain('already been requested');
    expect(externalSupportActionIssue(run(), scenario, action('accept', { when: { flags: ['not_ready'] }, acceptSupport: ['medical'] }))).toContain('identify the available receiving service');
  });

  it.each(['favorable', 'mixed', 'adverse'] as const)('still validates a matching request or acceptance found only in the %s band', band => {
    const scenario = SCENARIOS[CONDITIONAL_ID];
    for (const effect of [{ requestSupport: ['medical'] }, { acceptSupport: ['medical'] }]) {
      const option = action('conditional', { when: { flags: ['not_ready'] }, ...effect });
      option.outcomes[band] = [{ when: { flags: ['care_ready'] }, ...effect }];
      expect(externalSupportActionIssue(run(), scenario, option)).toContain('requestSupport' in effect ? 'already been requested' : 'identify the available receiving service');
    }
  });

  it('keeps explicit support requirements even when no conditional acceptance will commit', () => {
    const option = action('accept', { when: { flags: ['not_ready'] }, acceptSupport: ['medical'] }, {
      requires: { externalSupport: [{ serviceId: 'medical', status: 'available', reason: 'The crew must arrive.' }] },
    });
    expect(externalSupportActionIssue({ ...run(), clock: 9 }, SCENARIOS[CONDITIONAL_ID], option)).toBe('The crew must arrive.');
    expect(externalSupportActionIssue(run(), SCENARIOS[CONDITIONAL_ID], option)).toBeNull();
  });

  it('skips inactive acceptance effects but preserves all receiving-service gates for possible effects', () => {
    const scenario = SCENARIOS[CONDITIONAL_ID];
    const option = action('accept', { when: { flags: ['transfer_needed'] }, acceptSupport: ['medical'] });
    const state = run();
    expect(externalSupportActionIssue(state, scenario, option)).toBeNull();
    state.flags.push('transfer_needed');
    expect(externalSupportActionIssue({ ...state, clock: 9 }, scenario, option)).toContain('must be available');
    expect(externalSupportActionIssue({ ...state, flags: ['transfer_needed'] }, scenario, option)).toContain('care and safety preparations');
    expect(externalSupportActionIssue(state, scenario, option)).toContain('identify the available receiving service');
    option.requires.externalSupport = [{ serviceId: 'medical', status: 'available', reason: 'The crew must arrive.' }];
    expect(externalSupportActionIssue(state, scenario, option)).toBeNull();
    expect(externalSupportActionIssue({ ...state, externalSupport: { medical: { ...state.externalSupport.medical, acceptedAt: 10 } } }, scenario, option)).toBe('The crew must arrive.');
  });

  it('never uses hidden truth to dismiss a publicly possible support effect', () => {
    const scenario = structuredClone(SCENARIOS[CONDITIONAL_ID]);
    const option = action('request', { when: { flags: ['care_ready'] }, truth: [{ factId: scenario.facts[0].id, is: true }], requestSupport: ['medical'] });
    for (const truth of [false, true]) {
      scenario.facts[0].truth = truth;
      expect(externalSupportActionIssue(run(), scenario, option)).toContain('already been requested');
    }
  });

  it.each([true, false])('commits one request across later conditional steps and resumes it exactly (early request: %s)', early => {
    let state = started(CONDITIONAL_ID);
    if (early) state = decide(state, 'request_medical');
    state = decide(state, 'conditional_offer');
    const requested = structuredClone(state.activeRun!.externalSupport);
    state = decide(state, 'conditional_escort');
    refused(state, 'conditional_offer');
    refused(state, 'conditional_escort');
    refused(state, 'request_alias');
    expect(state.activeRun!.externalSupport).toEqual(requested);
    expect(state.activeRun!.history.flatMap(record => record.committed!.externalSupport!)).toHaveLength(1);
    expect(state.activeRun!.externalSupport!.medical.acceptedAt).toBeNull();
    expect(state.activeRun!.objective).toBe(0);
    expect(validExternalSupportState(state.activeRun!, SCENARIOS[CONDITIONAL_ID])).toBe(true);
    expect(deserialize(serialize(state, NOW))!.activeRun).toEqual(state.activeRun);
  });
});
