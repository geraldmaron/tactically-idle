import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import { createInitialState } from './department';
import { apply, NOW, startRun } from './test-fixtures';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { GameState } from './types';
import { casualtyFlags, civilianOutcomeViews, incidentOfficerUnavailable, INJURY_RECOVERY_HOURS } from './incident-consequences';
import { actionViews } from './operation-selectors';
import { computeDebrief, validateScenario } from './operation';
import { evaluateAction, getBuilt, strainFor } from './resolution';
import { deserialize, serialize } from './save';
import { deployability } from './officer';
import { qualifiedOfficers } from './equipment-requirements';

const ID = 'test_incident_casualty_v4';
function action(id: string, effect: OutcomeEffect, extra: Partial<ActionDefinition> = {}): ActionDefinition {
  return { id, stage: 'assess', title: id, icon: 'radio', summary: id, targetId: 'front_yard', task: id,
    requires: {}, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 1 }], difficulty: 20 },
    approach: 'none', workload: { base: 1, perSqFt: 0 }, stressBase: 1,
    outcomes: { favorable: [effect], mixed: [effect], adverse: [effect] }, ...extra };
}
function definition(): ScenarioDefinition {
  const base = structuredClone(SCENARIOS.ms_occupancy);
  return { ...base, id: ID, version: 4, pressure: { start: 0, perMinute: 0, threshold: 100, civilianPerMinute: 0 },
    civilianOutcomes: [{ id: 'resident', label: 'Resident', factId: 'f_occ_e', safeFlag: 'resident_safe', injuredFlag: 'resident_injured', careFlag: 'resident_care' }],
    externalServices: [{ id: 'ambulance', label: 'Ambulance crew', kind: 'medical', description: 'Accept injured officers for care', arrivalMinutes: 6, available: true }],
    stages: {
      assess: { id: 'assess', label: 'Incident', prompt: 'An injured officer changes the next decision.', actions: [
        action('incident', { officerHarm: { severity: 'serious', label: 'Gunshot injury' }, setFlags: ['resident_injured'], stage: 'assess' }, { check: { kind: 'execution', ratings: [{ key: 'shooting', weight: 1 }], difficulty: 20 }, requires: { certs: ['entry_team'] } }),
        action('continue', { stage: 'assess' }, { requires: { certs: ['entry_team'] }, check: { kind: 'execution', ratings: [{ key: 'shooting', weight: 1 }], difficulty: 20 } }),
        action('request', { requestSupport: ['ambulance'], stage: 'assess' }, { commandOnly: true }),
        action('stabilize', { officerCare: 'stabilize', stage: 'assess' }, { requires: { certs: ['advanced_first_aid'], allTags: ['medkit'] }, consumes: [{ tag: 'medkit', qty: 1 }], check: { kind: 'medical', ratings: [{ key: 'medical', weight: 1 }], difficulty: 20 } }),
        action('stabilize_again', { officerCare: 'stabilize', stage: 'assess' }, { requires: { certs: ['advanced_first_aid'], allTags: ['medkit'] }, consumes: [{ tag: 'medkit', qty: 1 }], check: { kind: 'medical', ratings: [{ key: 'medical', weight: 1 }], difficulty: 20 } }),
        action('wait', { stage: 'assess' }, { commandOnly: true, awaitSupport: 'ambulance' }),
        action('evacuate', { acceptSupport: ['ambulance'], officerCare: 'evacuate', stage: 'assess' }, { commandOnly: true, requires: { externalSupport: [{ serviceId: 'ambulance', status: 'available', reason: 'Wait for the ambulance crew' }] } }),
        action('end', { ending: 'handed_over' }, { commandOnly: true }),
      ] },
      adapt: { id: 'adapt', label: 'Adapt', prompt: 'Adapt', actions: [action('adapt_end', { ending: 'handed_over' }, { stage: 'adapt', commandOnly: true })] },
      resolve: { id: 'resolve', label: 'Resolve', prompt: 'Resolve', actions: [action('resolve_end', { ending: 'handed_over' }, { stage: 'resolve', commandOnly: true })] },
    },
    endings: { handed_over: { id: 'handed_over', title: 'Unresolved duties', summary: 'Remaining duties were recorded.', trustAdjust: 0, strain: 0, disposition: 'unresolved', remainingTasks: ['Complete the protective responsibility'] } },
  };
}
function started(solo = false): GameState {
  const state = createInitialState(NOW, 99);
  if (solo) {
    const squad = state.squads.find(entry => entry.id === 'A')!;
    for (const id of squad.officerIds) if (id !== 'off_brooks') state.officers[id].squadId = null;
    squad.officerIds = ['off_brooks']; squad.leaderId = 'off_brooks';
  }
  return startRun(state, ID, ['A'], { loadouts: { A: { trauma_kit: 2 } } });
}
function choose(state: GameState, actionId: string): GameState {
  const result = apply(state, { type: 'decide', actionId, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  return result.state;
}
function injured(state = started()): GameState { return choose(state, 'incident'); }
beforeAll(() => { SCENARIOS[ID] = definition(); });
afterAll(() => { delete SCENARIOS[ID]; });

describe('injury changes the team, care choices and saved aftermath', () => {
  it('records a named injured participant, excludes their skill and leaves other officers available', () => {
    const state = injured(); const run = state.activeRun!;
    const casualty = Object.values(run.officerCasualties!)[0];
    expect(casualty.officerId).toBe('off_brooks');
    expect(casualty).toMatchObject({ severity: 'serious', care: 'needed', label: 'Gunshot injury', recoveryUntil: NOW + INJURY_RECOVERY_HOURS.serious * 3_600_000 });
    expect(incidentOfficerUnavailable(state, run, casualty.officerId)).toBe(true);
    expect(incidentOfficerUnavailable(state, run, 'off_ortiz')).toBe(false);
    expect(actionViews(state, NOW, 'A').find(view => view.id === 'continue')).toMatchObject({ eligible: false });
    expect(qualifiedOfficers(state, ['A'], SCENARIOS[ID].stages.assess.actions[1]).map(officer => officer.id)).not.toContain('off_brooks');
    expect(deserialize(serialize(state, NOW))?.activeRun).toEqual(run);
  });
  it('spends one real kit, shortens recovery once and still requires evacuation', () => {
    const before = injured(); const state = choose(before, 'stabilize');
    const record = state.activeRun!.officerCasualties!.off_brooks;
    expect(record.care).toBe('stabilized');
    expect(record.recoveryUntil).toBe(NOW + INJURY_RECOVERY_HOURS.serious * 3_600_000 * .8);
    expect(state.activeRun!.history.at(-1)!.itemsConsumed).toEqual([{ itemId: 'trauma_kit', qty: 1 }]);
    expect(state.activeRun!.flags).toContain('casualty:awaiting_transport');
    expect(state.activeRun!.flags).not.toContain('casualty:untreated');
    expect(incidentOfficerUnavailable(state, state.activeRun!, 'off_brooks')).toBe(true);
    expect(apply(state, { type: 'decide', actionId: 'stabilize_again', actingSquadIds: ['A'], supportSquadIds: [] }).result.ok).toBe(false);
    expect(deserialize(serialize(state, NOW))?.activeRun).toEqual(state.activeRun);
  });
  it('keeps command care possible after a lone officer is injured, without a first-aid kit or medic', () => {
    let state = injured(started(true));
    expect(actionViews(state, NOW, 'A').find(view => view.id === 'stabilize')?.eligible).toBe(false);
    state = choose(state, 'request'); state = choose(state, 'wait'); state = choose(state, 'evacuate');
    expect(state.activeRun!.officerCasualties!.off_brooks.care).toBe('evacuated');
    expect(state.activeRun!.flags).toContain('casualty:evacuated');
    expect(state.activeRun!.flags).not.toContain('casualty:awaiting_transport');
    expect(deserialize(serialize(state, NOW))?.activeRun).toEqual(state.activeRun);
    const ended = choose(state, 'end');
    const report = computeDebrief(ended, ended.activeRun!)!;
    expect(report.officerCasualties).toEqual([state.activeRun!.officerCasualties!.off_brooks]);
    const closed = apply(ended, { type: 'closeDebrief' });
    expect(closed.result.ok).toBe(true);
    expect(deployability(closed.state.officers.off_brooks, NOW).ok).toBe(false);
    expect(closed.state.debriefs[0].officerCasualties).toEqual(report.officerCasualties);
  });
  it('rejects corrupt injury records, erased injuries, altered care and false casualty flags', () => {
    const state = injured();
    for (const change of [
      (copy: GameState) => { copy.activeRun!.officerCasualties!.off_brooks.recoveryUntil = Number.NaN; },
      (copy: GameState) => { copy.activeRun!.officerCasualties = {}; },
      (copy: GameState) => { copy.activeRun!.history[0].committed!.officerCasualties = []; copy.activeRun!.officerCasualties = {}; },
      (copy: GameState) => { copy.activeRun!.officerCasualties!.off_brooks.care = 'evacuated'; },
      (copy: GameState) => { copy.activeRun!.flags = []; },
      (copy: GameState) => { copy.officers.off_brooks.injury = null; },
    ]) {
      const copy = structuredClone(state); change(copy);
      expect(deserialize(serialize(copy, NOW))).toBeNull();
    }
  });
  it('accepts a long paused operation after the department recovery timer has elapsed', () => {
    const state = injured(); const until = state.officers.off_brooks.injury!.until;
    state.department.clockHighWater = until + 1; state.department.lastSettledAt = until + 1; state.officers.off_brooks.injury = null;
    expect(deserialize(serialize(state, until + 1))).not.toBeNull();
    expect(incidentOfficerUnavailable(state, state.activeRun!, 'off_brooks')).toBe(true);
    const cared = choose(state, 'stabilize');
    expect(cared.activeRun!.officerCasualties!.off_brooks.recoveryUntil).toBe(until);
    expect(deserialize(serialize(cared, until + 1))).not.toBeNull();
  });
  it('rejects an entirely injured supporting squad before it can satisfy headcount or equipment support', () => {
    const state = started(); const run = state.activeRun!;
    run.squadIds.push('B');
    run.squadTasks.push({ squadId: 'B', positionId: 'front_yard', stagingId: null, at: null, task: 'Support' });
    run.officerCasualties = {};
    for (const id of state.squads.find(squad => squad.id === 'B')!.officerIds) run.officerCasualties[id] = { officerId: id, severity: 'wounded', label: 'Injury', at: 0, care: 'needed', recoveryUntil: NOW + 1000 };
    const option = action('two_squads', { stage: 'assess' }, { requires: { minSquads: { count: 2, reason: 'Two teams needed' } }, support: { max: 5, maxSquads: 1, coverSpaceId: 'front_yard', reachMinutes: 10, label: 'support', task: 'Support' } });
    const result = evaluateAction({ state, run, scenario: SCENARIOS[ID], action: option, built: getBuilt(run.locationFamilyId, run.locationSeed), acting: ['A'], support: ['B'] });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('no uninjured officer');
    expect(result.uses).toEqual([]);
    expect(result.arrivals).toEqual([]);
  });
  it('keeps civilian accounting separate from score and never reads hidden truth', () => {
    const state = started(); const run = state.activeRun!; const scenario = SCENARIOS[ID];
    expect(civilianOutcomeViews(scenario, run)[0].status).toBe('unaccounted');
    run.knowledge.f_occ_e = 'confirmed';
    expect(civilianOutcomeViews(scenario, run)[0].status).toBe('needs_help');
    run.flags.push('resident_injured');
    expect(civilianOutcomeViews(scenario, run)[0].status).toBe('injured_needs_care');
    run.flags.push('resident_safe');
    expect(civilianOutcomeViews(scenario, run)[0].status).toBe('injured_needs_care');
    run.flags.push('resident_care');
    expect(civilianOutcomeViews(scenario, run)[0].status).toBe('care_accepted');
    expect(casualtyFlags({})).toEqual([]);
  });
  it('does not let an out-of-action mentor improve later officer contributions or stress', () => {
    const state = started(); const run = state.activeRun!;
    state.officers.off_brooks.traits = ['mentor'];
    state.officers.off_vale.traits = ['rookie'];
    state.officers.off_vale.serviceStartDay = 999_999;
    run.officerCasualties = { off_brooks: { officerId: 'off_brooks', severity: 'serious', label: 'Injury', at: 0, care: 'evacuated', recoveryUntil: NOW + 1000 } };
    const option = action('observe_after_injury', { stage: 'assess' });
    const input = { state, run, scenario: SCENARIOS[ID], action: option, built: getBuilt(run.locationFamilyId, run.locationSeed), acting: ['A' as const], support: [] };
    const withAbsentMentor = evaluateAction(input);
    expect(withAbsentMentor.contributors.some(contributor => contributor.label.includes('steadied by a mentor') || contributor.label.includes('Brooks: mentoring'))).toBe(false);
    const strain = strainFor(input, withAbsentMentor, 'mixed');
    state.officers.off_brooks.traits = [];
    const noMentor = evaluateAction(input);
    expect(withAbsentMentor.score).toBe(noMentor.score);
    expect(strain).toEqual(strainFor(input, noMentor, 'mixed'));
  });
  it('refuses content that labels field harm as a command-only decision', () => {
    const scenario = definition(); scenario.stages.assess.actions[0].commandOnly = true;
    expect(validateScenario(scenario, getBuilt(scenario.locationFamilyId, scenario.locationSeed)).join(' ')).toContain('command decisions');
  });
});
