import { describe, expect, it } from 'vitest';
import { COURSES } from '../../../content/courses';
import { createInitialState } from '../../../sim/department';
import { buildLocation } from '../../../sim/location';
import { computeDebrief, validateScenario } from '../../../sim/operation';
import { actionViews } from '../../../sim/operation-selectors';
import { bandFor, builtFor, evaluateAction, openingFlag } from '../../../sim/resolution';
import { next } from '../../../sim/rng';
import { deserialize, serialize } from '../../../sim/save';
import { scenarioActions, type IncidentType, type ScenarioDefinition } from '../../../sim/scenario-types';
import { currentStoryRoute } from '../../../sim/story-bindings';
import { storyPeoplePublic, storyPropsPublic } from '../../../sim/story-people';
import { apply, makeUnit, NOW, startCmd } from '../../../sim/test-fixtures';
import type { GameState, OutcomeBand, SquadId } from '../../../sim/types';
import { generateIncident, INCIDENT_TYPES_V5 } from '../index';
import { legacyCommitmentPresentation } from './commitments';

const generate = (type: IncidentType, seed = 0, contentVersion = 8) => generateIncident({ type, familyId: type === 'protected_rescue' ? 'juniper_court_v1' : ['welfare_check', 'barricaded'].includes(type) ? 'cedar_close' : 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion });
function pick(type: IncidentType, predicate: (s: ScenarioDefinition) => boolean): ScenarioDefinition {
  for (let seed = 0; seed < 100; seed++) { const s = generate(type, seed); if (predicate(s)) return s; }
  throw new Error(`No bounded fixture for ${type}`);
}
const has = (s: ScenarioDefinition, id: string) => scenarioActions(s).some(a => a.id === id);
const fact = (s: ScenarioDefinition, id: string) => s.facts.find(f => f.id === id)!;
function start(s: ScenarioDefinition, two = false, rngState = 719): GameState {
  const state = createInitialState(NOW, 719);
  for (let n = 100; n < 108; n++) { const unit = makeUnit('radio_kit', n); state.units[unit.id] = unit; }
  state.rngState = rngState;
  for (const officer of Object.values(state.officers)) officer.certs = [...new Set(Object.values(COURSES).flatMap(c => c.grants.cert ? [c.grants.cert] : []))];
  state.incidents = [{ id: s.id, type: s.incident!.type, familyId: s.incident!.familyId, tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
  const result = apply(state, startCmd(s.id, two ? ['A', 'B'] : ['A'], { positions: { A: entry, B: entry }, loadouts: { A: { radio_kit: 4, trauma_kit: 1 }, ...(two ? { B: { radio_kit: 4 } } : {}) } }));
  expect(result.result).toEqual({ ok: true });
  return result.state;
}
function ev(state: GameState, s: ScenarioDefinition, id: string, acting: SquadId[] = ['A'], support: SquadId[] = []) {
  const run = state.activeRun!, action = scenarioActions(s).find(a => a.id === id)!;
  expect(action, id).toBeDefined();
  return evaluateAction({ state, run, scenario: s, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting, support });
}
function choose(state: GameState, s: ScenarioDefinition, id: string, band: OutcomeBand = 'favorable', acting: SquadId[] = ['A'], support: SquadId[] = []) {
  const evaluation = ev(state, s, id, acting, support);
  expect(evaluation.eligible, `${id}: ${evaluation.reason}`).toBe(true);
  const input = structuredClone(state);
  let found = false;
  for (let seed = 1; seed < 100_000; seed++) if (bandFor(evaluation.margin, next(seed).value) === band) { input.activeRun!.rngState = seed; found = true; break; }
  expect(found).toBe(true);
  const result = apply(input, { type: 'decide', actionId: id, actingSquadIds: acting, supportSquadIds: support });
  expect(result.result, id).toEqual({ ok: true });
  expect(result.state.activeRun!.history.at(-1)!.band).toBe(band);
  return result.state;
}
function play(state: GameState, s: ScenarioDefinition, ids: string[]) { for (const id of ids) state = choose(state, s, id); return state; }
function natural(state: GameState, s: ScenarioDefinition, id: string, acting: SquadId[] = ['A']) {
  expect(ev(state, s, id, acting).eligible, id).toBe(true);
  const result = apply(state, { type: 'decide', actionId: id, actingSquadIds: acting, supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  return result.state;
}
const notes = (state: GameState) => state.activeRun!.history.flatMap(h => h.committed?.consequences ?? []).join(' ');
const people = (state: GameState, s: ScenarioDefinition) => storyPeoplePublic(s, builtFor(s.locationFamilyId, s.locationSeed, state.activeRun!.flags), state.activeRun!);
function declinedExit(s: ScenarioDefinition) {
  let state = choose(start(s), s, 'v5_protective_ask_mina_directly', 'adverse');
  return choose(state, s, 'v5_protective_clarify_no_shared_account', 'adverse');
}

describe('V8 concrete commitments', () => {
  it('validates bound v8 output for all six families without changing issued v7 definitions', () => {
    for (const info of INCIDENT_TYPES_V5) for (const seed of [0, 3, 8]) {
      const previous = generate(info.type, seed, 7), snapshot = JSON.stringify(previous);
      const s = generate(info.type, seed);
      expect(s.version).toBe(8); expect(s.incident!.contentVersion).toBe(8);
      expect(validateScenario(s, buildLocation(s.locationFamilyId, s.locationSeed)), s.id).toEqual([]);
      expect(JSON.stringify(generate(info.type, seed, 7))).toBe(snapshot);
    }
  });

  it.each(['favorable', 'mixed', 'adverse'] as const)('Jun’s %s openings really leave the squad in different places', band => {
    const s = generate('protected_rescue');
    const state = start(s), room = s.story!.bindings.rooms.scene.spaceId;
    const call = choose(state, s, 'v5_chair_hear_jun', band);
    const direct = choose(state, s, 'v5_chair_reach_and_hear', band);
    expect(call.activeRun!.squadTasks[0].positionId).toBe(state.activeRun!.squadTasks[0].positionId);
    expect(call.activeRun!.flags).not.toContain('v5_chair_jun_reached');
    expect(direct.activeRun!.squadTasks[0].positionId).toBe(room);
    expect(direct.activeRun!.flags).toContain('v5_chair_jun_reached');
    expect(actionViews(direct, NOW, 'A').map(a => a.id)).not.toContain('v5_chair_reach_jun');
    expect(direct.activeRun!.clock).toBeGreaterThan(call.activeRun!.clock);
    expect(people(direct, s).find(p => p.id === 'jun')!.position).toMatchObject({ spaceId: room });
  });

  it('quiet chair-route commitment includes assistance; two acting squads travel, contribute and retain real aftermath', () => {
    const s = pick('protected_rescue', s => has(s, 'v5_chair_check_quiet_chair_route'));
    let state: GameState | undefined;
    // Reload validates the uninterrupted saved RNG sequence. Screen only the
    // initial campaign sample; never rewrite a committed decision's RNG.
    for (let seed = 1; seed < 500; seed++) {
      let candidate = start(s, true, seed);
      for (const id of ['v5_chair_reach_and_hear', 'v5_chair_check_quiet_chair_route', 'v5_chair_reach_quiet_assistance']) candidate = natural(candidate, s, id);
      if (bandFor(ev(candidate, s, 'v5_chair_assisted_move', ['A', 'B']).margin, next(candidate.activeRun!.rngState).value) === 'mixed') { state = candidate; break; }
    }
    expect(state).toBeDefined();
    state = state!;
    expect(state.activeRun!.flags).toContain('v5_chair_assistance_ready');
    expect(actionViews(state, NOW, 'A').map(a => a.id)).not.toContain('v5_chair_prepare_assistance');
    const both = ev(state, s, 'v5_chair_assisted_move', ['A', 'B']);
    const solo = ev(state, s, 'v5_chair_assisted_move');
    expect(both.eligible).toBe(true); expect(solo.eligible).toBe(true);
    expect(both.participantIds.some(id => state.squads[1].officerIds.includes(id))).toBe(true);
    expect(both.participantIds.length).toBeLessThanOrEqual(buildLocation(s.locationFamilyId, s.locationSeed).derived.spaces[both.action.targetId].capacity);
    expect(both.arrivals.map(a => a.squadId).sort()).toEqual(['A', 'B']);
    expect(deserialize(serialize(state, NOW)), 'pre-injury save').not.toBeNull();
    const finished = natural(state, s, 'v5_chair_assisted_move', ['A', 'B']);
    expect(finished.activeRun!.history.at(-1)!.band).toBe('mixed');
    expect(finished.activeRun!.flags).toContain('v5_chair_jun_safe');
    expect(finished.activeRun!.flags).toContain('casualty:awaiting_transport');
    expect(finished.activeRun!.history.at(-1)!.actingSquadIds).toEqual(['A', 'B']);
    expect(storyPropsPublic(s, builtFor(s.locationFamilyId, s.locationSeed, finished.activeRun!.flags), finished.activeRun!).find(p => p.id === 'wheelchair')!.holderPersonId).toBe('jun');
    const restored = deserialize(serialize(finished, NOW));
    expect(restored, 'post-injury save').not.toBeNull();
    expect(restored?.activeRun).toEqual(finished.activeRun);
  });

  it('Jun can replace an obstructed selected pickup with the actual alternate chair route and finish there', () => {
    const s = pick('protected_rescue', s => has(s, 'v8_chair_change_to_quiet_route') && !fact(s, 'v5_chair_f_care_needed').truth);
    const routes = s.story!.bindings.routes;
    const originalRoute = routes.v6_public_exit, alternateRoute = routes.v6_quiet_exit;
    const built = buildLocation(s.locationFamilyId, s.locationSeed);
    const blockedIds = built.location.openings.filter(o => o.a === originalRoute.toSpaceId || o.b === originalRoute.toSpaceId).map(o => o.id);
    expect(blockedIds.length).toBeGreaterThan(0);
    let before: GameState | undefined, inspected: GameState | undefined, atAlternate: GameState | undefined;
    for (let seed = 1; seed < 100; seed++) {
      let candidate = start(s, false, seed);
      for (const id of ['v5_chair_reach_and_hear', 'v5_chair_check_public_chair_route', 'v5_chair_prepare_assistance']) candidate = natural(candidate, s, id);
      expect(ev(candidate, s, 'v5_chair_reach_public_assistance').eligible).toBe(true);
      // A current physical obstruction is an explicit regression fixture, not
      // a sampled story truth or an invented alternate destination.
      candidate.activeRun!.flags.push(...blockedIds.map(id => openingFlag(id, 'blocked')));
      const changed = natural(candidate, s, 'v8_chair_change_to_quiet_route');
      const moved = natural(changed, s, 'v5_chair_reach_quiet_assistance');
      if (bandFor(ev(moved, s, 'v5_chair_assisted_move').margin, next(moved.activeRun!.rngState).value) === 'favorable') {
        before = candidate; inspected = changed; atAlternate = moved; break;
      }
    }
    expect(before).toBeDefined(); expect(inspected).toBeDefined(); expect(atAlternate).toBeDefined();
    before = before!; inspected = inspected!; atAlternate = atAlternate!;
    const current = builtFor(s.locationFamilyId, s.locationSeed, before.activeRun!.flags);
    expect(currentStoryRoute(s, current, 'v6_public_exit')).toBeNull();
    expect(currentStoryRoute(s, current, 'v6_quiet_exit')).not.toBeNull();
    expect(ev(before, s, 'v5_chair_reach_public_assistance').eligible).toBe(false);
    const refused = apply(before, { type: 'decide', actionId: 'v5_chair_reach_public_assistance', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(refused.result.ok).toBe(false); expect(refused.state).toBe(before);
    expect(people(inspected, s).find(p => p.id === 'jun')!.position).toEqual(people(before, s).find(p => p.id === 'jun')!.position);
    expect(inspected.activeRun!.squadTasks[0].positionId).toBe(before.activeRun!.squadTasks[0].positionId);
    expect(inspected.activeRun!.flags).toContain('v5_chair_quiet_destination');
    expect(inspected.activeRun!.flags).toContain('v5_chair_assistance_ready');
    expect(inspected.activeRun!.flags).not.toContain('v5_chair_public_destination');
    expect(inspected.activeRun!.flags).not.toContain('v5_chair_vehicle_ready');
    expect(inspected.activeRun!.flags).not.toContain('v5_chair_at_pickup');
    expect(inspected.activeRun!.clock - before.activeRun!.clock).toBeCloseTo(inspected.activeRun!.history.at(-1)!.timeCost);
    expect(inspected.activeRun!.history.at(-1)!.timeCost).toBeGreaterThanOrEqual(10);
    expect(people(atAlternate, s).find(p => p.id === 'jun')!.position).toMatchObject({ spaceId: alternateRoute.toSpaceId });
    expect(atAlternate.activeRun!.squadTasks[0].positionId).toBe(alternateRoute.toSpaceId);
    expect(atAlternate.activeRun!.flags).not.toContain('v5_chair_jun_safe');
    const movement = ev(inspected, s, 'v5_chair_reach_quiet_assistance');
    expect(movement.storyMovementMinutes).toBeGreaterThan(0);
    const sealed = structuredClone(before);
    sealed.activeRun!.flags.push(...built.location.openings.filter(o => o.a === alternateRoute.toSpaceId || o.b === alternateRoute.toSpaceId).map(o => openingFlag(o.id, 'blocked')));
    expect(ev(sealed, s, 'v8_chair_change_to_quiet_route').eligible).toBe(false);
    const noWayOut = apply(sealed, { type: 'decide', actionId: 'v8_chair_change_to_quiet_route', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(noWayOut.result.ok).toBe(false); expect(noWayOut.state).toBe(sealed);
    let done = natural(atAlternate, s, 'v5_chair_assisted_move');
    done = natural(done, s, 'v5_chair_civilian_next_step');
    expect(computeDebrief(done, done.activeRun!)!.completionAchieved).toBe(true);
    expect(people(done, s).find(p => p.id === 'jun')!.position).toMatchObject({ spaceId: alternateRoute.toSpaceId });
    for (const snapshot of [before, inspected, atAlternate, done]) {
      const restored = deserialize(serialize(snapshot, NOW));
      expect(restored, `reload after ${snapshot.activeRun!.history.at(-1)!.actionId}`).not.toBeNull();
      expect(restored!.activeRun).toEqual(snapshot.activeRun);
      expect(restored!.activeRun!.flags).toEqual(expect.arrayContaining(blockedIds.map(id => openingFlag(id, 'blocked'))));
    }
  });

  it.each(['favorable', 'mixed', 'adverse'] as const)('Ada’s %s current check includes acknowledgement only when the old question was repeated', band => {
    const s = pick('welfare_check', s => s.story!.episode!.variantId === 'duplicated_alert' && !fact(s, 'v5_welfare_care_needed').truth);
    const currentCheck = 'v5_welfare_check_ada_now';
    const prepare = (direct: boolean): GameState => {
      for (let seed = 1; seed < 500; seed++) {
        let candidate = start(s, false, seed);
        const steps = direct ? ['v5_welfare_ask_about_return', 'v5_welfare_trace_sources_adapt'] : ['v5_welfare_trace_sources_assess'];
        for (const id of steps) candidate = natural(candidate, s, id);
        const evaluation = ev(candidate, s, currentCheck);
        if (evaluation.eligible && bandFor(evaluation.margin, next(candidate.activeRun!.rngState).value) === band) return candidate;
      }
      throw new Error(`No natural ${band} ${direct ? 'direct' : 'source'}-first fixture`);
    };
    const sourceFirst = prepare(false), repeated = prepare(true);
    expect(repeated.activeRun!.flags).not.toContain('v5_welfare_contact_ready');
    expect(repeated.activeRun!.flags).not.toContain('v5_welfare_repair_made');
    expect(actionViews(repeated, NOW, 'A').find(a => a.id === currentCheck)?.eligible).toBe(true);
    expect(has(s, 'v5_welfare_acknowledge_repeat')).toBe(false);
    const directDone = natural(repeated, s, currentCheck), sourceDone = natural(sourceFirst, s, currentCheck);
    expect(directDone.activeRun!.history.at(-1)!.band).toBe(band);
    expect(sourceDone.activeRun!.history.at(-1)!.band).toBe(band);
    expect(directDone.activeRun!.history.at(-1)!.timeCost - sourceDone.activeRun!.history.at(-1)!.timeCost).toBeCloseTo(2);
    expect(directDone.activeRun!.flags).toContain('v5_welfare_repair_made');
    expect(sourceDone.activeRun!.flags).not.toContain('v5_welfare_repair_made');
    expect(notes(directDone)).toContain('acknowledges the repeated question');
    expect(notes(directDone)).toContain('limited to');
    for (const [beforeCheck, afterCheck] of [[repeated, directDone], [sourceFirst, sourceDone]]) {
      expect(afterCheck.activeRun!.squadTasks[0].positionId).toBe(beforeCheck.activeRun!.squadTasks[0].positionId);
      expect(people(afterCheck, s).find(p => p.id === 'ada')!.position).toMatchObject({ spaceId: s.story!.bindings.rooms.scene.spaceId });
      expect(afterCheck.activeRun!.flags.includes('v5_welfare_current_checked')).toBe(band !== 'adverse');
      expect(afterCheck.activeRun!.status).toBe(band === 'adverse' ? 'active' : 'debrief');
      expect(afterCheck.activeRun!.externalSupport).toEqual({});
      if (band !== 'adverse') expect(computeDebrief(afterCheck, afterCheck.activeRun!)!.completionAchieved).toBe(true);
      else expect(afterCheck.activeRun!.flags).toContain('v5_welfare_ada_declined');
      for (const snapshot of [beforeCheck, afterCheck]) {
        const restored = deserialize(serialize(snapshot, NOW));
        expect(restored).not.toBeNull();
        expect(restored!.activeRun).toEqual(snapshot.activeRun);
      }
    }
  });

  it('dispatch’s prepared introduction has a later two-minute benefit, while patrol-first stays quicker for the initial check', () => {
    const s = pick('active_armed_incident', s => fact(s, 'v5_noise_f_pause').truth && fact(s, 'v5_noise_f_stand_down').truth);
    const initial = start(s, true);
    expect(ev(initial, s, 'v5_noise_hear_eli').workloadMinutes).toBe(ev(initial, s, 'v5_noise_check_patrol').workloadMinutes + 1);
    const suffix = ['v5_noise_agreed_pause', 'v5_noise_check_stand_down'];
    const linked = play(initial, s, ['v5_noise_hear_eli', ...suffix]);
    const patrol = play(initial, s, ['v5_noise_check_patrol', ...suffix]);
    expect(ev(linked, s, 'v8_noise_reach_on_kept_call').workloadMinutes).toBe(ev(patrol, s, 'v5_noise_reach_eli').workloadMinutes - 2);
    expect(ev(patrol, s, 'v8_noise_reach_on_kept_call').eligible).toBe(false);
    const reached = choose(linked, s, 'v8_noise_reach_on_kept_call', 'favorable', ['B']);
    expect(reached.activeRun!.flags).toContain('v5_noise_eli_reached');
    expect(reached.activeRun!.flags).toContain('v5_noise_voice_promised');
    expect(reached.activeRun!.flags).not.toContain('v5_noise_eli_safe');
    expect(notes(reached)).toContain('Dispatch introduces the arriving squad');
  });

  it('Rosa can change an accepted inside plan, with fresh consent, real movement and the correct receiver clock', () => {
    const s = generate('medical_complication');
    let state = play(start(s), s, ['v5_assistance_hear_rosa_assess', 'v5_assistance_offer_here']);
    const inside = state.activeRun!.externalSupport!['v5_assistance_rosa_crew'].requestedAt;
    expect(ev(state, s, 'v8_assistance_change_to_outside').eligible).toBe(true);
    state = choose(state, s, 'v8_assistance_change_to_outside');
    expect(state.activeRun!.flags).not.toContain('v5_assistance_onsite');
    expect(state.activeRun!.flags).toContain('v5_assistance_outside');
    expect(state.activeRun!.externalSupport!['v5_assistance_rosa_crew'].requestedAt).toBe(inside);
    expect(state.activeRun!.externalSupport!['v5_assistance_outside_crew'].requestedAt).toBeGreaterThan(inside!);
    expect(ev(state, s, 'v5_assistance_receive_here').eligible).toBe(false);
    state = play(state, s, ['v5_assistance_wait_outside_crew', 'v5_assistance_receive_outside']);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    expect(state.activeRun!.externalSupport!['v5_assistance_outside_crew'].acceptedAt).not.toBeNull();
    expect(state.activeRun!.externalSupport!['v5_assistance_rosa_crew'].acceptedAt).toBeNull();
    expect(storyPropsPublic(s, builtFor(s.locationFamilyId, s.locationSeed, state.activeRun!.flags), state.activeRun!).find(p => p.id === 'shop_keys')!.holderPersonId).toBe('rosa');
  });

  it('a declined Rosa switch keeps the accepted inside plan and does not request its alternative crew', () => {
    const s = generate('medical_complication');
    const state = choose(play(start(s), s, ['v5_assistance_hear_rosa_assess', 'v5_assistance_offer_here']), s, 'v8_assistance_change_to_outside', 'adverse');
    expect(state.activeRun!.flags).toContain('v5_assistance_onsite');
    expect(state.activeRun!.flags).not.toContain('v5_assistance_outside');
    expect(state.activeRun!.externalSupport!['v5_assistance_outside_crew']).toBeUndefined();
  });

  it('changing Rosa’s assessment place cannot bypass a physically blocked exit', () => {
    const s = generate('medical_complication');
    const state = play(start(s), s, ['v5_assistance_hear_rosa_assess', 'v5_assistance_offer_here']);
    const scene = s.story!.bindings.rooms.scene.spaceId;
    state.activeRun!.flags.push(...buildLocation(s.locationFamilyId, s.locationSeed).location.openings.filter(o => o.a === scene || o.b === scene).map(o => openingFlag(o.id, 'blocked')));
    expect(ev(state, s, 'v8_assistance_change_to_outside').eligible).toBe(false);
    expect(ev(state, s, 'v5_assistance_receive_here').eligible).toBe(false);
    expect(state.activeRun!.flags).not.toContain('v5_assistance_outside');
  });

  it('Mina can decline exit, accept a private conversation at home, and complete her actual nonmedical choice', () => {
    const s = pick('barricaded', s => s.story!.episode!.variantId === 'privacy-and-exit-ready' && !fact(s, 'v5_protective_care_needed').truth);
    const state = choose(declinedExit(s), s, 'v8_protective_offer_private_at_home');
    expect(state.activeRun!.status).toBe('debrief');
    expect(state.activeRun!.endingId).toBe('v8_protective_private_at_home');
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    expect(state.activeRun!.flags).not.toContain('v5_protective_mina_outside');
    expect(people(state, s).find(p => p.id === 'mina')!.position).toMatchObject({ spaceId: s.story!.bindings.rooms.scene.spaceId });
    expect(notes(state)).not.toContain('promises to share');
  });

  it('Mina’s in-place conversation can reveal care needs without pretending she accepted the medical move', () => {
    const s = pick('barricaded', s => s.story!.episode!.variantId === 'privacy-and-exit-ready' && fact(s, 'v5_protective_care_needed').truth);
    let state = choose(declinedExit(s), s, 'v8_protective_offer_private_at_home');
    expect(state.activeRun!.status).toBe('active');
    expect(state.activeRun!.flags).toContain('v5_protective_private_conversation');
    expect(state.activeRun!.flags).not.toContain('v5_protective_assessment_agreed');
    expect(state.activeRun!.externalSupport!['v5_protective_mina_crew']).toBeUndefined();
    state = choose(state, s, 'v8_protective_choose_assessment_outside');
    expect(state.activeRun!.flags).not.toContain('v5_protective_mina_outside');
    state = play(state, s, ['v5_protective_meet_mina_outside', 'v5_protective_wait_with_mina', 'v5_protective_receive_mina']);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    expect(state.activeRun!.externalSupport!['v5_protective_mina_crew'].acceptedAt).not.toBeNull();
  });

  it('Mina can decline the in-place offer too; the chosen privacy promise survives all bands', () => {
    const s = pick('barricaded', s => s.story!.episode!.variantId === 'privacy-and-exit-ready');
    const state = choose(declinedExit(s), s, 'v8_protective_offer_private_at_home', 'adverse');
    expect(state.activeRun!.flags).not.toContain('v8_protective_private_at_home');
    expect(state.activeRun!.flags).not.toContain('v8_protective_mina_safe');
    expect(state.activeRun!.flags).not.toContain('v5_protective_private_conversation');
    expect(notes(state)).toContain('respects that answer');
  });

  it('Mina’s two-squad option reserves real separate receiving duty, radios and time while solo remains viable', () => {
    const s = pick('barricaded', s => s.story!.episode!.variantId === 'privacy-and-exit-ready');
    const state = choose(start(s, true), s, 'v5_protective_ask_mina_directly');
    const solo = ev(state, s, 'v5_protective_meet_mina_outside');
    const pair = ev(state, s, 'v8_protective_move_with_receiving_squad', ['A'], ['B']);
    expect(solo.eligible).toBe(true); expect(pair.eligible).toBe(true);
    expect(ev(state, s, 'v8_protective_move_with_receiving_squad').eligible).toBe(false);
    expect(pair.workloadMinutes).toBe(solo.workloadMinutes + 2);
    expect(pair.arrivals.find(a => a.squadId === 'B')).toMatchObject({ role: 'support', spaceId: s.story!.bindings.exterior.arrival.spaceId });
    expect(pair.contributors.some(c => c.source === 'support' && c.value > 0)).toBe(true);
    const finished = choose(state, s, 'v8_protective_move_with_receiving_squad', 'favorable', ['A'], ['B']);
    expect(finished.activeRun!.history.at(-1)!.supportSquadIds).toEqual(['B']);
    expect(finished.activeRun!.history.at(-1)!.unitsUsed.filter(id => id.includes('radio_kit')).length).toBeGreaterThanOrEqual(2);
    expect(finished.activeRun!.squadTasks.find(t => t.squadId === 'B')!.task).toContain('private');
    expect(ev(finished, s, 'v5_protective_meet_mina_outside').eligible).toBe(false);
  });

  it('collapses only redundant preparations and keeps variant-specific release facts', () => {
    for (let seed = 0; seed < 9; seed++) {
      const s = generate('hostage_crisis', seed), old = generate('hostage_crisis', seed, 7);
      expect(has(s, 'v5_sig_check_patrol')).toBe(false);
      expect(scenarioActions(s).find(a => a.id === 'v5_sig_hear_ben')!.outcomes).toEqual(scenarioActions(old).find(a => a.id === 'v5_sig_hear_ben')!.outcomes);
      expect(scenarioActions(s).find(a => a.id === 'v5_sig_release_ben')!.outcomes).toEqual(scenarioActions(old).find(a => a.id === 'v5_sig_release_ben')!.outcomes);
    }
  });

  it('legacy presentation exposes existing Jun benefit without mutating history, outcomes or promising v8 mechanics', () => {
    const s = generate('protected_rescue', 4, 7), before = JSON.stringify(s);
    const a = scenarioActions(s).find(a => a.id === 'v5_chair_reach_and_hear')!;
    const view = legacyCommitmentPresentation(s, a, buildLocation(s.locationFamilyId, s.locationSeed));
    expect(view!.outcomePreview!.favorable).toContain('Skip the later reach');
    expect(JSON.stringify(s)).toBe(before);
    const armed = generate('active_armed_incident', 4, 7);
    expect(legacyCommitmentPresentation(armed, scenarioActions(armed).find(a => a.id === 'v5_noise_hear_eli')!, buildLocation(armed.locationFamilyId, armed.locationSeed))).toBeNull();
  });
});
