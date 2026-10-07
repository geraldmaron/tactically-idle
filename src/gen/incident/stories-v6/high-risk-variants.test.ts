import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLocation } from '../../../sim/location';
import { actionViews, previewAction } from '../../../sim/operation-selectors';
import { computeDebrief, validateScenario } from '../../../sim/operation';
import { planActionResupply } from '../../../sim/equipment-resupply';
import { responseFailurePlan } from '../../../sim/response-failure';
import { initializePersonnel } from '../../../sim/personnel';
import { bandFor, builtFor, evaluateAction, openingFlag } from '../../../sim/resolution';
import { next } from '../../../sim/rng';
import { deserialize, serialize } from '../../../sim/save';
import { scenarioActions, type IncidentType, type ScenarioDefinition } from '../../../sim/scenario-types';
import { currentStoryRoute } from '../../../sim/story-bindings';
import { storyPeoplePublic, storyPropsPublic } from '../../../sim/story-people';
import { apply, makeState, NOW, startCmd, unitId } from '../../../sim/test-fixtures';
import type { GameState, OutcomeBand } from '../../../sim/types';
import { generateIncident } from '../index';
import { applyHighRiskVariation } from './high-risk-variants';

// Exercise the module directly while the v6 registry/cast layer remains independently owned.
const scenarios = vi.hoisted(() => new Map<string, ScenarioDefinition>());
vi.mock('../../../sim/scenario-registry', async importOriginal => {
  const original = await importOriginal<typeof import('../../../sim/scenario-registry')>();
  return { ...original, getScenario: (id: string) => scenarios.get(id) ?? original.getScenario(id) };
});
afterEach(() => scenarios.clear());
const families: [IncidentType, string][] = [['hostage_crisis', 'market_row'], ['active_armed_incident', 'market_row'], ['protected_rescue', 'juniper_court_v1']];
function fixture(type: IncidentType, variant: number, seed = 1, familyId = type === 'protected_rescue' ? 'juniper_court_v1' : 'market_row') {
  const s = generateIncident({ type, familyId, buildingSeed: 7, seed, tier: 2, contentVersion: 5 });
  const before = structuredClone(s);
  s.version = 6;
  const built = buildLocation(familyId, 7);
  const metadata = applyHighRiskVariation(s, built, variant);
  scenarios.set(s.id, s);
  return { s, built, before, metadata };
}
function find(type: IncidentType, variant: number, truths: Record<string, boolean> = {}) {
  for (let seed = 0; seed < 150; seed++) {
    const f = fixture(type, variant, seed);
    if (Object.entries(truths).every(([name, value]) => f.s.facts.some(fact => fact.id.endsWith(name) && fact.truth === value)) && f.s.externalServices!.every(service => service.available)) return f;
  }
  throw new Error('No matching authored episode');
}
function running(s: ScenarioDefinition, vehicle = false): GameState {
  const state = makeState({ inventory: vehicle ? { armored_rescue_vehicle: 1 } : {} });
  state.saveVersion = 5; state.contentVersion = 5; initializePersonnel(state);
  if (vehicle) state.officers.off_brooks.certs.push('vehicle_operations');
  state.incidents = [{ id: s.id, type: s.incident!.type, familyId: s.incident!.familyId, tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const started = apply(state, { ...startCmd(s.id, ['A'], { positions: { A: buildLocation(s.incident!.familyId, 7).location.entries[0] }, loadouts: { A: {} } }), ...(vehicle ? { supportUnitIds: [unitId('armored_rescue_vehicle')] } : {}) });
  expect(started.result).toEqual({ ok: true });
  return started.state;
}
function evaluate(state: GameState, id: string) {
  const run = state.activeRun!, s = scenarios.get(run.scenarioId)!;
  const a = scenarioActions(s).find(candidate => candidate.id === id)!;
  expect(a, id).toBeDefined();
  return evaluateAction({ state, run, scenario: s, action: a, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function decide(state: GameState, id: string, band: OutcomeBand | null = 'favorable') {
  const ev = evaluate(state, id);
  expect(ev.eligible, `${id}: ${ev.reason}`).toBe(true);
  const input = structuredClone(state);
  if (band) {
    let selected = false;
    for (let seed = 1; seed < 100_000; seed++) if (bandFor(ev.margin, next(seed).value) === band) { input.activeRun!.rngState = seed; selected = true; break; }
    expect(selected, `${id} can sample ${band}`).toBe(true);
  }
  const committed = apply(input, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(committed.result).toEqual({ ok: true });
  if (band) { expect(committed.state.activeRun!.history.at(-1)!.band).toBe(band); return committed.state; }
  const loaded = deserialize(serialize(committed.state, NOW));
  expect(loaded).not.toBeNull(); expect(loaded!.activeRun).toEqual(committed.state.activeRun);
  return loaded!;
}
function play(state: GameState, ids: string[]) { for (const id of ids) state = decide(state, id); return state; }
function notes(state: GameState) { return state.activeRun!.history.flatMap(step => step.committed?.consequences ?? []).join(' '); }

describe('v6 high-risk episodes change actual decisions', () => {
  it.each(families)('%s has three deterministic, distinct graphs with valid bindings', (type, familyId) => {
    const graphs = new Set<string>();
    for (const variant of [0, 1, 2]) {
      const { s, built, metadata, before } = fixture(type, variant, 1, familyId);
      expect(validateScenario(s, built)).toEqual([]);
      expect(metadata.modules.length).toBeGreaterThan(0); expect(metadata.modules.length).toBeLessThanOrEqual(2);
      expect(metadata.publicContext.every(text => text.endsWith('.'))).toBe(true);
      graphs.add(JSON.stringify(scenarioActions(s).map(a => [a.id, a.requires, a.storyRoute, a.workload, a.outcomes])));
      const regenerated = generateIncident(before.incident!);
      expect(regenerated).toEqual(before);
      const second = structuredClone(before); second.version = 6; applyHighRiskVariation(second, built, variant);
      expect(second).toEqual(s);
    }
    expect(graphs.size).toBe(3);
  });

  it.each([0, 1, 2])('hostage contact variant %i can finish with ordinary radio gear', variant => {
    const { s } = find('hostage_crisis', variant, { care_needed: false });
    let state = decide(running(s), 'v5_sig_hear_ben');
    if (variant === 2) state = decide(state, 'v5_sig_relay_contact');
    state = decide(state, 'v5_sig_release_ben');
    if (variant === 0) state = decide(state, 'v5_sig_relay_contact');
    expect(state.activeRun!.flags).toContain('sig_contact');
    expect(state.activeRun!.flags).not.toContain('sig_contact_lost');
    state = play(state, ['v5_sig_hear_mara', 'v5_sig_record_account', 'v5_sig_bring_mara_out', 'v5_sig_civilian_next_step']);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    if (variant === 1) expect(storyPropsPublic(s, buildLocation('market_row', 7), state.activeRun!).find(prop => prop.id === 'maras_phone')?.holderPersonId).toBe('mara');
    if (variant === 2) expect(notes(state)).toContain('four extra minutes between replies');
  });

  it('omits unreachable lost-contact actions from the independent-phone episode while retaining threat recovery', () => {
    const { s, built } = fixture('hostage_crisis', 1);
    const ids = scenarioActions(s).map(a => a.id);
    const dormant = ['lost_line_update', 'relay_contact', 'relay_contact_later', 'hear_mara_later'].map(name => `v5_sig_${name}`);
    expect(ids.filter(id => dormant.includes(id))).toEqual([]);
    expect(ids).toEqual(expect.arrayContaining(['v5_sig_record_account', 'v5_sig_clarify_recording', 'v5_sig_urgent_protection']));
    expect(validateScenario(s, built)).toEqual([]);
  });

  it.each([false, true])('armed arrival moves Eli to the chosen actual zone (quiet %s)', quiet => {
    const { s, built } = find('active_armed_incident', 0, { f_pause: true, f_stand_down: true, f_care_needed: false });
    let state = play(running(s), ['v5_noise_hear_eli', 'v5_noise_agreed_pause', 'v5_noise_check_stand_down', 'v5_noise_reach_eli']);
    const id = `v5_noise_bring_eli_${quiet ? 'quiet' : 'public'}`;
    const target = scenarioActions(s).find(a => a.id === id)!.targetId;
    state = decide(state, id);
    const eli = storyPeoplePublic(s, built, state.activeRun!).find(person => person.id === 'eli')!;
    expect(eli.position && !('kind' in eli.position) && eli.position.spaceId).toBe(target);
    expect(evaluate(state, `v5_noise_bring_eli_${quiet ? 'public' : 'quiet'}`).eligible).toBe(false);
    state = decide(state, 'v5_noise_civilian_next_step');
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    if (!quiet) expect(notes(state)).toContain('four minutes to give Eli space');
  });

  it.each(['juniper_court_v1', 'willow_terrace_v1', 'harbour_court'])('rescue destination is a real chair route at %s and keeps Jun’s chair', familyId => {
    for (const quiet of [false, true]) {
      const { s, built } = fixture('protected_rescue', 0, 2, familyId);
      expect(validateScenario(s, built)).toEqual([]);
      let state = play(running(s), ['v5_chair_reach_and_hear', `v5_chair_check_${quiet ? 'quiet' : 'public'}_chair_route`, 'v5_chair_prepare_assistance']);
      const id = `v5_chair_reach_${quiet ? 'quiet' : 'public'}_assistance`;
      const target = scenarioActions(s).find(a => a.id === id)!.targetId;
      if (quiet) expect(evaluate(state, 'v5_chair_check_reserved_vehicle').eligible).toBe(false);
      state = play(state, [id, 'v5_chair_assisted_move']);
      const jun = storyPeoplePublic(s, built, state.activeRun!).find(person => person.id === 'jun')!;
      const chair = storyPropsPublic(s, built, state.activeRun!).find(prop => prop.id === 'wheelchair')!;
      expect(jun.position && !('kind' in jun.position) && jun.position.spaceId).toBe(target);
      expect(chair.position).toEqual(jun.position);
      expect(state.activeRun!.flags).toContain('v5_chair_jun_safe');
      expect(actionViews(state, NOW, 'A').some(action => action.id === 'v5_chair_civilian_partial')).toBe(false);
      expect(previewAction(state, NOW, 'v5_chair_civilian_partial', ['A'], [])?.eligible).toBe(true);
      state = decide(state, 'v5_chair_civilian_partial');
      expect(state.activeRun!.status).toBe('debrief');
    }
  });

  it.each([false, true])('quotes the real rescue privacy cost for the selected destination (quiet=%s)', quiet => {
    const { s } = find('protected_rescue', 0, { f_care_needed: false });
    let state = play(running(s), [
      'v5_chair_reach_and_hear', `v5_chair_check_${quiet ? 'quiet' : 'public'}_chair_route`,
      'v5_chair_prepare_assistance', `v5_chair_reach_${quiet ? 'quiet' : 'public'}_assistance`, 'v5_chair_assisted_move',
    ]);
    const preview = previewAction(state, NOW, 'v5_chair_civilian_next_step', ['A'], [])!;
    expect(preview.eligible, preview.reason ?? '').toBe(true);
    expect(preview.timeRange).toEqual(quiet ? { min: 2, max: 3 } : { min: 10, max: 11 });
    expect(preview.timeCost).toBeGreaterThanOrEqual(preview.timeRange.min);
    expect(preview.timeCost).toBeLessThanOrEqual(preview.timeRange.max);
    state = decide(state, 'v5_chair_civilian_next_step');
    expect(state.activeRun!.history.at(-1)!.timeCost).toBe(quiet ? 2 : 10);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('checks every selected route edge again and cannot commit a blocked destination', () => {
    for (const type of ['active_armed_incident', 'protected_rescue'] as const) {
      const f = type === 'active_armed_incident' ? find(type, 0, { f_pause: true, f_stand_down: true }) : fixture(type, 0);
      const { s, built } = f;
      const base = type === 'active_armed_incident'
        ? play(running(s), ['v5_noise_hear_eli', 'v5_noise_agreed_pause', 'v5_noise_check_stand_down', 'v5_noise_reach_eli'])
        : play(running(s), ['v5_chair_reach_and_hear', 'v5_chair_check_quiet_chair_route', 'v5_chair_prepare_assistance']);
      const id = type === 'active_armed_incident' ? 'v5_noise_bring_eli_quiet' : 'v5_chair_reach_quiet_assistance';
      const a = scenarioActions(s).find(candidate => candidate.id === id)!;
      const route = s.story!.bindings.routes[a.storyRoute!];
      for (const edge of route.openingIds) {
        const blocked = structuredClone(base); blocked.activeRun!.flags.push(openingFlag(edge, 'blocked'));
        const current = builtFor(base.activeRun!.locationFamilyId, base.activeRun!.locationSeed, blocked.activeRun!.flags);
        const alternate = currentStoryRoute(s, current, a.storyRoute!);
        const ev = evaluate(blocked, id);
        expect(ev.eligible).toBe(alternate !== null);
        if (alternate) expect(alternate).not.toContain(edge);
      }
      const blocked = structuredClone(base);
      blocked.activeRun!.flags.push(...built.location.openings.filter(edge => edge.a === route.toSpaceId || edge.b === route.toSpaceId).map(edge => openingFlag(edge.id, 'blocked')));
      expect(evaluate(blocked, id).eligible).toBe(false);
      const before = storyPeoplePublic(s, built, blocked.activeRun!);
      const refused = apply(blocked, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
      expect(refused.result.ok).toBe(false); expect(refused.state).toBe(blocked);
      expect(storyPeoplePublic(s, built, refused.state.activeRun!)).toEqual(before);
    }
  });

  it('early dispatch spends time now, starts the real clock and preserves later care gates', () => {
    const { s } = find('active_armed_incident', 1, { f_pause: true, f_stand_down: false, f_care_needed: true });
    const before = decide(running(s), 'v5_noise_hear_eli');
    const early = decide(before, 'v5_noise_request_receiver_early');
    expect(early.activeRun!.clock).toBeGreaterThan(before.activeRun!.clock);
    expect(early.activeRun!.externalSupport?.v5_noise_civilian_ambulance).toBeDefined();
    expect(evaluate(early, 'v5_noise_civilian_transfer').eligible).toBe(false);
    const steps = ['v5_noise_agreed_pause', 'v5_noise_check_stand_down', 'v5_noise_clarify_stand_down', 'v5_noise_reach_eli', 'v5_noise_bring_eli_out'];
    const first = play(early, steps);
    const later = decide(play(before, steps), 'v5_noise_civilian_request');
    expect(first.activeRun!.externalSupport!.v5_noise_civilian_ambulance.requestedAt).toBeLessThan(later.activeRun!.externalSupport!.v5_noise_civilian_ambulance.requestedAt);
    let state = decide(first, 'v5_noise_civilian_agreement');
    if (!evaluate(state, 'v5_noise_civilian_transfer').eligible) state = decide(state, 'v5_noise_civilian_wait');
    state = decide(state, 'v5_noise_civilian_transfer');
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('does not add a redundant early-request choice when dispatch already reports no crew', () => {
    for (const type of ['hostage_crisis', 'active_armed_incident', 'protected_rescue'] as const) {
      let found = false;
      for (let seed = 0; seed < 100; seed++) {
        const { s, metadata } = fixture(type, type === 'hostage_crisis' ? 0 : 1, seed);
        const request = scenarioActions(s).find(a => a.id.endsWith('civilian_request'))!;
        const serviceId = request.outcomes.favorable.flatMap(effect => effect.requestSupport ?? [])[0];
        if (s.externalServices!.find(service => service.id === serviceId)!.available) continue;
        expect(scenarioActions(s).some(a => a.id.endsWith('request_receiver_early'))).toBe(false);
        expect(metadata.modules).not.toContain('request_receiver_early');
        expect(metadata.modules.length).toBeGreaterThan(0);
        found = true; break;
      }
      expect(found).toBe(true);
    }
  });

  it('Jun’s original pickup reaches safety sooner while the prepared private destination finishes sooner', () => {
    const { s } = find('protected_rescue', 0, { f_care_needed: false });
    const outcomes = [false, true].map(quiet => {
      let state = play(running(s), ['v5_chair_reach_and_hear', `v5_chair_check_${quiet ? 'quiet' : 'public'}_chair_route`, 'v5_chair_prepare_assistance', `v5_chair_reach_${quiet ? 'quiet' : 'public'}_assistance`, 'v5_chair_assisted_move']);
      const safeAt = state.activeRun!.clock;
      state = decide(state, 'v5_chair_civilian_next_step');
      expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
      return { safeAt, completeAt: state.activeRun!.clock, notes: notes(state) };
    });
    expect(outcomes[0].safeAt).toBeLessThan(outcomes[1].safeAt);
    expect(outcomes[1].completeAt).toBeLessThan(outcomes[0].completeAt);
    expect(outcomes[0].notes).toContain('eight minutes to arrange Jun’s requested conversation');
    expect(outcomes[1].notes).not.toContain('eight minutes to arrange Jun’s requested conversation');
  });

  it('only the original pickup retains the genuinely reserved and qualified vehicle option', () => {
    const { s } = find('protected_rescue', 0, { f_vehicle_fit: true, f_care_needed: false });
    const noVehicle = play(running(s), ['v5_chair_reach_and_hear', 'v5_chair_check_public_chair_route']);
    expect(evaluate(noVehicle, 'v5_chair_check_reserved_vehicle').eligible).toBe(false);
    const quiet = play(running(s, true), ['v5_chair_reach_and_hear', 'v5_chair_check_quiet_chair_route']);
    expect(evaluate(quiet, 'v5_chair_check_reserved_vehicle').eligible).toBe(false);
    let state = play(running(s, true), ['v5_chair_reach_and_hear', 'v5_chair_check_public_chair_route', 'v5_chair_check_reserved_vehicle', 'v5_chair_reach_public_vehicle']);
    const unqualified = structuredClone(state); unqualified.officers.off_brooks.certs = unqualified.officers.off_brooks.certs.filter(cert => cert !== 'vehicle_operations');
    expect(evaluate(unqualified, 'v5_chair_vehicle_move').eligible).toBe(false);
    const unreserved = structuredClone(state); unreserved.activeRun!.supportUnitIds = [];
    expect(evaluate(unreserved, 'v5_chair_vehicle_move').eligible).toBe(false);
    state = play(state, ['v5_chair_vehicle_move', 'v5_chair_civilian_next_step']);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    expect(state.activeRun!.history.find(step => step.actionId === 'v5_chair_vehicle_move')!.unitsUsed).toContain(unitId('armored_rescue_vehicle'));
    expect(notes(state)).toContain('eight minutes to arrange Jun’s requested conversation');
  });

  it.each(families)('%s preserves issued low-resource withdrawal results while hiding the current exit card', (type, familyId) => {
    for (const variant of [0, 1, 2]) {
      const { s } = fixture(type, variant, 1, familyId);
      let state = running(s);
      const first = actionViews(state, NOW, 'A').find(view => view.eligible && !view.id.includes('withdraw'))!;
      state = decide(state, first.id, null);
      expect(actionViews(state, NOW, 'A').some(view => view.id.includes('withdraw'))).toBe(false);
      const leave = scenarioActions(s).find(action => action.stage === state.activeRun!.stage && action.id.includes('withdraw'))!;
      expect(previewAction(state, NOW, leave.id, ['A'], [])?.eligible).toBe(true);
      state = decide(state, leave.id, null);
      expect(state.activeRun!.responseFailure).toBeUndefined();
      const report = computeDebrief(state, state.activeRun!)!;
      expect(report.completionAchieved).toBe(false);
      expect(report.disposition).toBe('relief_partial');
    }
  });

  it.each(families)('%s natural sparse-equipment journeys preserve every save and finish honestly', (type, familyId) => {
    for (const variant of [0, 1, 2]) for (const seed of [1, 2, 3]) {
      const { s } = fixture(type, variant, seed, familyId);
      let state = running(s);
      for (let step = 0; state.activeRun!.status === 'active' && step < 40; step++) {
        const visible = actionViews(state, NOW, 'A');
        const options = visible.filter(view => view.eligible);
        if (!options.length) {
          const delivery = visible.find(view => planActionResupply(state, NOW, view.id, view.actingSquadIds, view.supportSquadIds).ok);
          if (delivery) {
            expect(responseFailurePlan(state)).toBeNull();
            const supplied = apply(state, { type: 'resupplyAction', actionId: delivery.id, actingSquadIds: delivery.actingSquadIds, supportSquadIds: delivery.supportSquadIds });
            expect(supplied.result).toEqual({ ok: true });
            const restored = deserialize(serialize(supplied.state, NOW));
            expect(restored?.activeRun).toEqual(supplied.state.activeRun);
            expect(restored!.activeRun!.history).toEqual(state.activeRun!.history);
            state = restored!;
            continue;
          }
          const plan = responseFailurePlan(state);
          expect(plan, `${type}:${variant}:${seed}: exhausted response requires an honest failure`).not.toBeNull();
          const before = structuredClone(state);
          const failed = apply(state, { type: 'endFailedResponse', runId: plan!.runId, revision: plan!.revision });
          expect(failed.result).toEqual({ ok: true });
          const { runId: _runId, consequence: _consequence, ...record } = plan!;
          Object.assign(before.activeRun!, { stage: 'debrief', status: 'debrief', endingId: 'handed_over', responseFailure: record });
          expect(failed.state).toEqual(before);
          const restored = deserialize(serialize(failed.state, NOW));
          expect(restored?.activeRun).toEqual(failed.state.activeRun);
          state = restored!;
          break;
        }
        const onward = options.filter(view => !/withdraw|partial|record.*pending|record.*unfinished/i.test(view.id + ' ' + view.title));
        const choices = onward.length ? onward : options;
        const chosen = choices[(seed + step) % choices.length];
        state = decide(state, chosen.id, null);
      }
      expect(state.activeRun!.status).toBe('debrief');
      const report = computeDebrief(state, state.activeRun!);
      expect(report).not.toBeNull();
      if (state.activeRun!.responseFailure) {
        expect(report).toMatchObject({ completionAchieved: false, disposition: 'unresolved', fundingReward: 0, devPointReward: 0, trustDelta: -2 });
        expect(report!.officerCondition.every(officer => officer.xpGained === 0)).toBe(true);
      }
      const closed = apply(state, { type: 'closeDebrief' });
      expect(closed.result).toEqual({ ok: true });
      if (state.activeRun!.responseFailure) {
        expect(closed.state.department.funding).toBe(state.department.funding);
        expect(closed.state.department.devPoints).toBe(state.department.devPoints);
      }
      expect(deserialize(serialize(closed.state, NOW))?.debriefs).toEqual(closed.state.debriefs);
    }
  });
});
