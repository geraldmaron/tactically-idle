import { describe, it, expect } from 'vitest';
import { GENERATED_FAMILIES_V10 } from '../../content/scenario-types-v10';
import { SCENARIO_RECIPES_V9, scenarioRecipe, specForRecipe } from '../../content/scenario-recipes';
import { ADDITIONAL_FRAMEWORK_BY_TYPE } from '../../content/incident-frameworks-v9';
import { furnishedFamilyIdV7 } from '../building';
import { buildLocation } from '../../sim/location';
import { findStoryRoute, validateStoryBindings } from '../../sim/story-bindings';
import { storyPeoplePublic } from '../../sim/story-people';
import { validateScenario } from '../../sim/operation';
import { createInitialState } from '../../sim/department';
import { actionViews, pendingDebrief, stageContinuations } from '../../sim/operation-selectors';
import { responseFailurePlan } from '../../sim/response-failure';
import { apply, NOW, startCmd, stockKit } from '../../sim/test-fixtures';
import { hashSeed } from '../../sim/rng';
import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, Room } from '../../sim/types';
import { generateIncident } from './index';
import { PLACEMENT_AFFINITIES_V10, placeFrameworkPerson, placementKind, roomPhrase } from './placement-v10';

// Role-to-room placement covers the eight compiled frameworks; the six authored stories keep their own scene rules.
const TYPES = (Object.keys(GENERATED_FAMILIES_V10) as IncidentType[]).filter(type => ADDITIONAL_FRAMEWORK_BY_TYPE[type]);
const spec = (type: IncidentType, familyId: string, i: number): IncidentSpec =>
  ({ type, familyId, buildingSeed: hashSeed(`${familyId}:${i}:placement-test`), seed: hashSeed(`${type}:${i}:placement-call`), tier: 2, contentVersion: 10 });
const person = (s: ScenarioDefinition) => Object.values(s.story!.bindings.people)[0];
const hosted = (s: ScenarioDefinition): BuiltLocation => buildLocation(s.locationFamilyId, s.locationSeed);
const roomOf = (built: BuiltLocation, id: string): Room => built.location.rooms.find(room => room.id === id)!;
// Plausibility the weights must never break, independent of their tuning.
const BUSINESS_NEVER = ['flat', 'guest_room', 'bedroom', 'bath', 'wc', 'landing', 'utility', null];
const HOME_NEVER = ['wc', 'utility', 'storage', 'landing', 'stair', 'shop', 'office', null];

describe('v10 framework placement', () => {
  it.each(TYPES)('%s places people plausibly, reachably and validly on every generated building type', type => {
    for (const familyId of GENERATED_FAMILIES_V10[type]!) for (let i = 0; i < 6; i++) {
      const s = generateIncident(spec(type, familyId, i)), built = hosted(s), p = person(s);
      const label = `${type} ${s.locationFamilyId}:${s.locationSeed}`;
      expect(validateStoryBindings(s, built), label).toEqual([]);
      expect(validateScenario(s, built), label).toEqual([]);
      const actual = roomOf(built, p.initial.spaceId), reported = roomOf(built, p.reported!.spaceId);
      for (const room of [actual, reported]) {
        const kind = placementKind(room, built.location);
        expect(PLACEMENT_AFFINITIES_V10[type]!.kinds[kind!] ?? 0, `${label} ${room.id}`).toBeGreaterThan(0);
        expect((built.location.setting === 'business' ? BUSINESS_NEVER : HOME_NEVER).includes(kind), `${label} ${room.id} ${kind}`).toBe(false);
      }
      if (type === 'false_intruder') expect(['bedroom', 'bath'].includes(placementKind(actual, built.location)!), label).toBe(false);
      // The exit route walks from the actual room to the arrival point, stairs included.
      const exit = s.story!.bindings.routes.exit;
      expect(exit.fromSpaceId).toBe(actual.id);
      expect(exit.openingIds).toEqual(findStoryRoute(built, actual.id, s.story!.bindings.exterior.arrival.spaceId, 'walking'));
      // Patrol is present on these calls, so the first report names the right room.
      if (['domestic', 'burglary', 'business_robbery'].includes(type)) expect(reported.id, label).toBe(actual.id);
      const known = s.briefing.known.find(line => line.startsWith('Dispatch places'))!;
      expect(known, label).toContain(roomPhrase(built, reported));
      if (reported.floor > 0) expect(known, label).toContain('upstairs');
    }
  }, 120000);

  it('is deterministic for the same call and building, and moves people between calls', () => {
    const built = buildLocation(furnishedFamilyIdV7('two_storey_house_g1'), 41);
    const input = { type: 'person_in_crisis' as const, variant: 0, seed: 7, buildingSeed: 41, timeOfDay: 'night' as const, arrivalId: built.location.entries[0] };
    expect(placeFrameworkPerson(built, input)).toEqual(placeFrameworkPerson(built, input));
    const rooms = new Set<string>(), points = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const placed = placeFrameworkPerson(built, { ...input, seed })!;
      rooms.add(placed.room.id); points.add(`${placed.at.x},${placed.at.y}`);
    }
    expect(rooms.size).toBeGreaterThanOrEqual(4);
    expect(points.size).toBeGreaterThan(rooms.size);
    const s = spec('domestic', 'semi_detached_g1', 3);
    expect(generateIncident(s)).toEqual(generateIncident(s));
  });

  it('places people upstairs where the building has an upper floor, with floor-aware wording', () => {
    for (const type of ['missing_vulnerable', 'person_in_crisis', 'domestic', 'vacant_occupancy'] as const) {
      let upstairs = 0;
      for (let i = 0; i < 20; i++) {
        const s = generateIncident(spec(type, 'two_storey_house_g1', i)), built = hosted(s);
        if (roomOf(built, person(s).initial.spaceId).floor > 0) upstairs++;
      }
      expect(upstairs, type).toBeGreaterThan(2);
    }
    const built = buildLocation(furnishedFamilyIdV7('two_storey_house_g1'), 3);
    const room = (id: string) => roomOf(built, id);
    expect(roomPhrase(built, room('bath_1'))).toBe('the upstairs bathroom');
    expect(roomPhrase(built, room('bedroom_2'))).toBe('bedroom 2 upstairs');
    expect(roomPhrase(built, room('living'))).toBe('the living room');
    const bungalow = buildLocation(furnishedFamilyIdV7('bungalow_g1'), 3);
    expect(roomPhrase(bungalow, roomOf(bungalow, 'bedroom_1'))).toBe('bedroom 1');
  });

  it('keeps businesses to staff, office, stock and trading areas and the keyholder near valuables', () => {
    let valuables = 0, total = 0;
    for (const familyId of GENERATED_FAMILIES_V10.burglary!) for (let i = 0; i < 12; i++) {
      const s = generateIncident(spec('burglary', familyId, i)), built = hosted(s), room = roomOf(built, person(s).initial.spaceId);
      expect(['flat', 'guest_room', 'bedroom'].includes(placementKind(room, built.location)!), `${familyId} ${room.id}`).toBe(false);
      total++; if (room.tags.includes('valuables')) valuables++;
    }
    expect(valuables / total).toBeGreaterThan(.4);
  }, 60000);

  it('v10 calls on authored buildings use the same affinities', () => {
    for (const type of TYPES) for (const familyId of ['cedar_close', 'market_row']) {
      const s0 = { type, familyId, buildingSeed: 5, seed: 11, tier: 2, contentVersion: 10 };
      let s: ScenarioDefinition;
      try { s = generateIncident(s0); } catch { continue; }
      if (s.locationFamilyId !== furnishedFamilyIdV7(familyId)) continue;
      const built = hosted(s), kind = placementKind(roomOf(built, person(s).initial.spaceId), built.location);
      expect(PLACEMENT_AFFINITIES_V10[type]!.kinds[kind!] ?? 0, `${type} ${familyId} ${kind}`).toBeGreaterThan(0);
      expect(validateStoryBindings(s, built)).toEqual([]);
    }
  });

  it('leaves v9 framework placement on the ground floor of the authored buildings', () => {
    for (const recipe of SCENARIO_RECIPES_V9.filter(r => ADDITIONAL_FRAMEWORK_BY_TYPE[r.type])) {
      const s = generateIncident(specForRecipe(recipe, 7)), p = person(s);
      expect(s.incident!.contentVersion).toBe(9);
      expect(p.reported!.spaceId).toBe(p.initial.spaceId);
      expect(s.briefing.known.some(line => /^Dispatch places \S+ in the /.test(line))).toBe(true);
    }
  });
});

describe('v10 wrong-room reports', () => {
  /** missing_vulnerable situation 1 is an old sighting: its first report is always wrong. */
  const misreported = (() => {
    for (let i = 0; i < 200; i++) {
      const s = spec('missing_vulnerable', 'two_storey_house_g1', i);
      if (scenarioRecipe(s).variant !== 1) continue;
      const scenario = generateIncident(s);
      if (scenario.locationSeed === s.buildingSeed) return scenario;
    }
    throw new Error('No hosted old-sighting call');
  })();

  it('reports a plausible other room, hides the exact point and reveals the actual room only when checked', () => {
    const s = misreported, built = hosted(s), p = person(s), fact = s.facts.find(f => f.id === p.locationFactId)!;
    expect(p.reported!.spaceId).not.toBe(p.initial.spaceId);
    expect(fact.spaceId).toBe(p.reported!.spaceId);
    expect(fact.person!.at).toBeUndefined();
    expect(JSON.stringify([s.briefing, fact.claim])).not.toContain(roomPhrase(built, roomOf(built, p.initial.spaceId)));
    const before = storyPeoplePublic(s, built, { knowledge: {}, flags: [], pressure: 0 })[0];
    expect(before.position).toEqual(p.reported);
    const after = storyPeoplePublic(s, built, { knowledge: { [fact.id]: 'confirmed' }, flags: [], pressure: 0 })[0];
    expect(after.position).toEqual(p.initial);
    const verify = s.stages.adapt.actions.find(a => a.id.endsWith('_verify'))!;
    expect(verify.targetId).toBe(p.reported!.spaceId);
    expect(verify.outcomes.favorable[0].text).toContain(roomPhrase(built, roomOf(built, p.initial.spaceId)));
  });

  it('plays through real dispatch and save boundaries to a debrief', () => {
    const s = misreported, built = hosted(s), p = person(s), inc = s.incident!;
    const state0 = createInitialState(NOW, 719);
    state0.incidents = [{ id: s.id, type: inc.type, familyId: inc.familyId, tier: inc.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
    const kit = stockKit(state0, ['A']);
    const start = apply(kit.state, startCmd(s.id, ['A'], { positions: { A: built.location.entries[0] }, loadouts: kit.loadouts, units: kit.units }));
    expect(start.result).toEqual({ ok: true });
    let state = start.state, sawReported = false, sawActual = false;
    for (let step = 0; step < 60 && state.activeRun!.status === 'active'; step++) {
      const at = storyPeoplePublic(s, built, state.activeRun!)[0].position;
      if (at && !('kind' in at) && at.spaceId === p.reported!.spaceId) sawReported = true;
      if (at && !('kind' in at) && at.spaceId === p.initial.spaceId) sawActual = true;
      const choices = actionViews(state, NOW, 'A').filter(a => a.eligible), continuation = stageContinuations(state)[0];
      const result = choices.length ? apply(state, { type: 'decide', actionId: choices[0].id, actingSquadIds: choices[0].actingSquadIds, supportSquadIds: choices[0].supportSquadIds })
        : continuation ? apply(state, { type: 'continueStage', actionId: continuation.actionId, revision: continuation.revision })
        : apply(state, { type: 'endFailedResponse', runId: responseFailurePlan(state)!.runId, revision: responseFailurePlan(state)!.revision });
      expect(result.result).toEqual({ ok: true });
      state = result.state;
    }
    expect(state.activeRun!.status).toBe('debrief');
    expect(pendingDebrief(state)).not.toBeNull();
    expect(sawReported).toBe(true);
    // This journey checks the person, so the public map must have moved off the wrong room.
    expect(state.activeRun!.knowledge[p.locationFactId]).toBe('confirmed');
    expect(sawActual || state.activeRun!.flags.includes(`v9_${inc.type}_completed`)).toBe(true);
    const final = storyPeoplePublic(s, built, state.activeRun!)[0].position!;
    expect('kind' in final ? null : final.spaceId).not.toBe(p.reported!.spaceId);
  }, 30000);
});
