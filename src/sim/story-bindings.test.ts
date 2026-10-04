import { describe, expect, it } from 'vitest';
import { VALID_TINY } from '../content/locations/test-fixtures';
import { TWO_FLOOR_FIXTURE } from '../content/locations/two-floor-fixture';
import { BUILDING_FAMILIES } from '../gen/building';
import { generateIncident, INCIDENT_TYPES_V5 } from '../gen/incident';
import { buildLocation, deriveLocation, pointInPolygon } from './location';
import { validateScenario } from './operation';
import { builtFor } from './resolution';
import type { ActionDefinition, IncidentSpec, ScenarioDefinition, StoryAnchor } from './scenario-types';
import type { BuiltLocation, LocationDefinition, Opening } from './types';
import { currentStoryRoute, findStoryObject, findStoryRoute, queryStoryRooms, selectStoryExterior, selectStoryRoom, storyPoint, validateStoryBindings } from './story-bindings';

function build(location: LocationDefinition = VALID_TINY): BuiltLocation {
  const copy = structuredClone(location);
  return { location: copy, derived: deriveLocation(copy), issues: [] };
}
function fixture(built = build()): ScenarioDefinition {
  const initial = { spaceId: 'b', at: storyPoint(built, 'b', 1)! };
  return {
    id: 'story_fixture', version: 5, code: 'TEST', title: 'Binding test', setting: 'residential',
    locationFamilyId: built.location.familyId, locationSeed: 0, summary: 'Test', variantLabel: 'Test', pressureLabel: 'Test',
    squadRange: { min: 1, max: 1 }, briefing: { known: [], unknown: [] }, objectives: [],
    pressure: { start: 0, perMinute: 0, threshold: 100, civilianPerMinute: 0 }, rewards: { funding: 0, devPoints: 0, trust: 0, xp: 0 }, endings: {},
    stages: {
      assess: { id: 'assess', label: 'Assess', prompt: 'Test', actions: [] },
      adapt: { id: 'adapt', label: 'Adapt', prompt: 'Test', actions: [] },
      resolve: { id: 'resolve', label: 'Resolve', prompt: 'Test', actions: [] },
    },
    facts: [{ id: 'loc:resident', label: 'Resident location', spaceId: 'b', truth: true, initial: 'reported', showWhenUnknown: false,
      markers: {}, claim: 'The resident is in B', source: null, note: null, uncertainty: 'Location unconfirmed', person: { label: 'Resident', at: initial.at } }],
    story: {
      archetypeId: 'resident_help', version: 1, episodeId: 'fixture', seed: 1,
      bindings: {
        rooms: { home: { spaceId: 'b' } }, exterior: { meeting: { spaceId: 'yard' } },
        routes: { leave: { fromSpaceId: 'b', toSpaceId: 'yard', profile: 'walking', openingIds: findStoryRoute(built, 'b', 'yard', 'walking')! } },
        people: { resident: { id: 'resident', label: 'Resident', locationFactId: 'loc:resident', initial, transitions: [] } },
        props: { phone: { id: 'phone', label: 'Resident’s phone', kind: 'carried', holderPersonId: 'resident' }, bed: { id: 'bed', label: 'Bed', kind: 'mapped', objectId: 'o_bed' } },
      },
    },
  };
}
function additionalDoor(id: string, a: string, b: string): Opening {
  return { id, a, b, type: 'door', state: 'closed', from: { x: 14, y: b === 'yard' ? 10 : 5 }, to: { x: 17, y: b === 'yard' ? 10 : 5 }, material: 'hollow_core' };
}
function propAction(scenario: ScenarioDefinition): ActionDefinition {
  const action: ActionDefinition = {
    id: 'use_phone', stage: 'assess', title: 'Use phone', icon: 'radio', summary: 'Use the bound phone', targetId: 'b', task: 'Phone',
    requires: { storyProps: [{ propId: 'phone', holderPersonId: 'resident', reason: 'The resident needs their phone' }] },
    check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 1 }], difficulty: 1 },
    workload: { base: 1, perSqFt: 0 }, approach: 'none', stressBase: 0,
    outcomes: { favorable: [], mixed: [], adverse: [] },
  };
  scenario.stages.assess.actions.push(action);
  return action;
}

describe('deterministic roles bind actual generated geometry and contents', () => {
  it('places separate people within rooms and exterior zones across every current family and twelve seeds', () => {
    for (const family of BUILDING_FAMILIES) for (let seed = 0; seed < 12; seed++) {
      const built = buildLocation(family.id, seed);
      const before = structuredClone(built);
      for (const space of [...built.location.rooms, ...built.location.zones]) {
        const first = storyPoint(built, space.id, seed);
        expect(first, `${family.id}/${seed}/${space.id}`).not.toBeNull();
        expect(storyPoint(built, space.id, seed)).toEqual(first);
        expect(pointInPolygon(first!, space.polygon)).toBe(true);
        for (const object of built.location.objects.filter(entry => entry.in === space.id && entry.tags.includes('blocks_space'))) {
          const rotated = object.rotation === 90 || object.rotation === 270;
          const inX = Math.abs(first!.x - object.x - object.w / 2) <= (rotated ? object.h : object.w) / 2;
          const inY = Math.abs(first!.y - object.y - object.h / 2) <= (rotated ? object.w : object.h) / 2;
          expect(inX && inY, object.id).toBe(false);
        }
        const second = storyPoint(built, space.id, seed, [{ spaceId: space.id, at: first! }]);
        expect(second).not.toBeNull();
        expect(Math.hypot(first!.x - second!.x, first!.y - second!.y)).toBeGreaterThanOrEqual(1.5);
      }
      expect(built).toEqual(before);
    }
  });

  it('filters setting, floor, type, tags and actual required objects without fabricated fallbacks', () => {
    const built = build();
    built.location.rooms[0].tags = ['private', 'quiet'];
    built.location.objects[0].tags.push('rest');
    const selector = { setting: 'residential' as const, types: ['living' as const], floor: 0, tags: ['private'], requiredObjects: [{ type: 'bed' as const, tags: ['rest'] }] };
    expect(queryStoryRooms(built, selector).map(room => room.id)).toEqual(['a']);
    expect(selectStoryRoom(built, selector, 27)?.id).toBe('a');
    expect(queryStoryRooms(built, { ...selector, setting: 'business' })).toEqual([]);
    expect(queryStoryRooms(built, { ...selector, floor: 1 })).toEqual([]);
    expect(queryStoryRooms(built, { requiredObjects: [{ type: 'chair' }] })).toEqual([]);
    expect(findStoryObject(built, { type: 'chair' })).toBeNull();
    expect(findStoryObject(built, { type: 'bed', spaceId: 'a', tags: ['rest'] })?.id).toBe('o_bed');
    expect(findStoryObject(built, { type: 'bed', spaceId: 'b' })).toBeNull();
    expect(queryStoryRooms(built, { adjacentToExterior: true }).map(room => room.id)).toEqual(['a']);
    expect(queryStoryRooms(built, { adjacentToExterior: true, profile: 'chair' })).toEqual([]);
    expect(selectStoryExterior(built, { entriesOnly: true, kinds: ['yard'], reachableFromSpaceId: 'b' }, 8)?.id).toBe('yard');
    expect(selectStoryExterior(built, { kinds: ['parking'] }, 8)).toBeNull();
    expect(queryStoryRooms(built, { reachableFromSpaceId: 'ghost' })).toEqual([]);
  });

  it('keeps query selection stable when source arrays are reordered and excludes used roles', () => {
    const built = build();
    const room = selectStoryRoom(built, {}, 37);
    const point = storyPoint(built, 'a', 37);
    built.location.rooms.reverse(); built.location.openings.reverse(); built.location.objects.reverse();
    expect(selectStoryRoom(built, {}, 37)).toEqual(room);
    expect(storyPoint(built, 'a', 37)).toEqual(point);
    expect(queryStoryRooms(built, { excludeSpaceIds: ['a', 'b'] }).map(entry => entry.id)).toEqual(['c']);
  });

  it('avoids rotated blocking footprints, handles concave rooms, and explicitly rejects no-free-space', () => {
    const built = build();
    Object.assign(built.location.objects[0], { x: 1, y: 1, w: 4, h: 2, rotation: 90 });
    for (let seed = 0; seed < 80; seed++) {
      const point = storyPoint(built, 'a', seed)!;
      expect(point.x >= 2 && point.x <= 4 && point.y >= 0 && point.y <= 4).toBe(false);
    }
    built.location.rooms[0].polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 10 }, { x: 0, y: 10 }];
    built.location.objects = [];
    expect(pointInPolygon(storyPoint(built, 'a', 5)!, built.location.rooms[0].polygon)).toBe(true);
    built.location.objects = [{ ...VALID_TINY.objects[0], x: 0, y: 0, w: 10, h: 10 }];
    expect(storyPoint(built, 'a', 5)).toBeNull();
    expect(storyPoint(built, 'ghost', 5)).toBeNull();
  });
});

describe('routes use complete current opening chains', () => {
  it('follows both edges from a room through a corridor to the exterior, including locked doors', () => {
    const built = build();
    built.location.rooms[0].type = 'hall';
    built.location.openings[0].state = 'locked';
    expect(findStoryRoute(built, 'b', 'yard', 'walking')).toEqual(['d_ab', 'd_front']);
    expect(findStoryRoute(built, 'yard', 'b', 'walking')).toEqual(['d_front', 'd_ab']);
    expect(findStoryRoute(built, 'b', 'b', 'walking')).toEqual([]);
    expect(findStoryRoute(built, 'ghost', 'ghost', 'walking')).toBeNull();
    for (const edge of ['d_ab', 'd_front']) {
      const blocked = structuredClone(built);
      blocked.location.openings.find(opening => opening.id === edge)!.state = 'blocked';
      expect(findStoryRoute(blocked, 'b', 'yard', 'walking')).toBeNull();
    }
  });

  it('uses a stable alternative when one exit blocks and rejects all exits blocked without stale derived adjacency', () => {
    const built = build();
    built.location.openings.push(additionalDoor('d_bc', 'b', 'c'), additionalDoor('d_cyard', 'c', 'yard'));
    const scenario = fixture(built);
    expect(currentStoryRoute(scenario, built, 'leave')).toEqual(['d_ab', 'd_front']);
    built.location.openings.reverse();
    expect(currentStoryRoute(scenario, built, 'leave')).toEqual(['d_ab', 'd_front']);
    built.location.openings.find(opening => opening.id === 'd_front')!.state = 'blocked';
    expect(currentStoryRoute(scenario, built, 'leave')).toEqual(['d_bc', 'd_cyard']);
    built.location.openings.find(opening => opening.id === 'd_cyard')!.state = 'blocked';
    expect(currentStoryRoute(scenario, built, 'leave')).toBeNull();
    expect(currentStoryRoute(scenario, built, 'missing')).toBeNull();
  });

  it('honors actual builtFor run flags on generated maps', () => {
    for (const family of BUILDING_FAMILIES) for (let seed = 0; seed < 5; seed++) {
      const built = buildLocation(family.id, seed);
      const from = built.location.rooms[0].id, to = built.location.entries[0];
      const route = findStoryRoute(built, from, to, 'walking');
      expect(route).not.toBeNull();
      const scenario = fixture();
      scenario.story!.bindings.routes.leave = { fromSpaceId: from, toSpaceId: to, openingIds: route!, profile: 'walking' };
      for (const edge of route!) {
        const changed = builtFor(family.id, seed, [`opening:${edge}=blocked`]);
        const alternative = currentStoryRoute(scenario, changed, 'leave');
        expect(alternative ?? []).not.toContain(edge);
      }
      const blocked = builtFor(family.id, seed, built.location.openings.filter(opening => opening.a === to || opening.b === to).map(opening => `opening:${opening.id}=blocked`));
      expect(currentStoryRoute(scenario, blocked, 'leave')).toBeNull();
    }
  });

  it('keeps chair routes on ground-level openings at least three feet wide, while walking allows stairs', () => {
    const built = build();
    expect(findStoryRoute(built, 'b', 'yard', 'chair')).toBeNull();
    for (const opening of built.location.openings.filter(entry => entry.id === 'd_ab' || entry.id === 'd_front')) {
      if (opening.from.x === opening.to.x) opening.to.y = opening.from.y + 3;
      else opening.to.x = opening.from.x + 3;
    }
    expect(findStoryRoute(built, 'b', 'yard', 'chair')).toEqual(['d_ab', 'd_front']);
    built.location.openings.find(opening => opening.id === 'd_front')!.type = 'window';
    expect(findStoryRoute(built, 'b', 'yard', 'chair')).toBeNull();
    const twoFloors = build(TWO_FLOOR_FIXTURE);
    expect(findStoryRoute(twoFloors, 'landing', 'hall', 'walking')).toEqual(['st_hall_landing']);
    expect(findStoryRoute(twoFloors, 'landing', 'hall', 'chair')).toBeNull();
    expect(findStoryRoute(twoFloors, 'landing', 'landing', 'chair')).toBeNull();
    const stair = twoFloors.location.openings.find(opening => opening.id === 'st_hall_landing')!;
    stair.type = 'door';
    expect(findStoryRoute(twoFloors, 'landing', 'hall', 'walking')).toBeNull();
  });
});

describe('story authoring validation', () => {
  it.each(INCIDENT_TYPES_V5.flatMap(type => type.families.map(family => [type.type, family] as const)))('deterministically validates the actual %s recipe on %s across map and story seeds', (type, familyId) => {
    for (const buildingSeed of [0, 7, 42]) for (const seed of [0, 13, 91]) {
      const spec: IncidentSpec = { type, familyId, buildingSeed, seed, tier: seed % 5 + 1, contentVersion: 5 };
      const before = structuredClone(spec);
      const first = generateIncident(spec), second = generateIncident(spec);
      expect(first.story, `${type}/${familyId}/${buildingSeed}/${seed}`).toBeDefined();
      expect(first).toEqual(second);
      expect(spec).toEqual(before);
      const built = buildLocation(familyId, buildingSeed);
      expect(validateScenario(first, built), first.id).toEqual([]);
      expect(Object.keys(first.story!.bindings.people).length).toBeGreaterThan(0);
      for (const [role, route] of Object.entries(first.story!.bindings.routes)) {
        expect(currentStoryRoute(first, built, role)).toEqual(route.openingIds);
        expect(route.openingIds.length).toBeGreaterThan(0);
      }
    }
  });

  it('accepts actual bindings, carried and mapped props, and explicitly labeled offscene transitions', () => {
    const built = build(), scenario = fixture(built);
    scenario.story!.bindings.people.resident.transitions.push({ when: { facts: [{ factId: 'loc:resident', in: ['confirmed'] }] }, to: { kind: 'offscene', label: 'Left with family' }, observed: true, label: 'With family' });
    scenario.story!.bindings.props.phone.transitions = [{ when: { facts: [{ factId: 'loc:resident', in: ['confirmed'] }] }, holderPersonId: 'resident' }];
    expect(validateStoryBindings(scenario, built)).toEqual([]);
    const before = structuredClone(scenario);
    expect(validateStoryBindings(scenario, built)).toEqual([]);
    expect(scenario).toEqual(before);
  });

  it('accepts flags declared by outcomes and checks every public condition and action binding', () => {
    const built = build(), scenario = fixture(built);
    const action: ActionDefinition = {
      id: 'leave', stage: 'assess', title: 'Leave', icon: 'door', summary: 'Leave together', targetId: 'b', task: 'Leaving',
      requires: {}, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 1 }], difficulty: 1 },
      workload: { base: 1, perSqFt: 0 }, approach: 'none', stressBase: 0,
      storyTargetPersonId: 'resident', storyRoute: 'leave',
      outcomes: { favorable: [{ setFlags: ['left'] }], mixed: [{ setFlags: ['left'] }], adverse: [] },
    };
    scenario.stages.assess.actions = [action];
    scenario.story!.bindings.people.resident.transitions = [{ when: { flags: ['left'], notFlags: ['casualty:untreated'] }, to: { kind: 'offscene', label: 'Left safely' }, observed: true }];
    expect(validateStoryBindings(scenario, built)).toEqual([]);
    action.visibleWhen = { facts: [{ factId: 'bad_visible', in: ['confirmed'] }] };
    action.requires.facts = [{ factId: 'bad_required', in: ['confirmed'], reason: 'Test' }];
    action.modifiers = [{ label: 'Modifier', when: { facts: [{ factId: 'bad_modifier', in: ['confirmed'] }] }, source: 'preparation', value: 1 }];
    action.outcomes.favorable[0].when = { facts: [{ factId: 'bad_outcome', in: ['confirmed'] }] };
    action.storyTargetPersonId = 'bad_person'; action.storyRoute = 'bad_route';
    scenario.endings.test = { id: 'test', title: 'Test', summary: 'Test', trustAdjust: 0, strain: 0, completion: { facts: [{ factId: 'bad_ending', in: ['confirmed'] }] } };
    scenario.externalServices = [{ id: 'test', label: 'Test', kind: 'test', description: 'Test', arrivalMinutes: 1, available: true, acceptWhen: { facts: [{ factId: 'bad_service', in: ['confirmed'] }] } }];
    const errors = validateStoryBindings(scenario, built).join('\n');
    for (const reference of ['bad_visible', 'bad_required', 'bad_modifier', 'bad_outcome', 'bad_person', 'bad_route', 'bad_ending', 'bad_service']) expect(errors).toContain(reference);
  });

  it('validates required prop IDs and holders, including a holder reached through an authored transfer', () => {
    const built = build(), scenario = fixture(built);
    const action = propAction(scenario);
    expect(validateStoryBindings(scenario, built)).toEqual([]);
    const otherAt = storyPoint(built, 'b', 2, [scenario.story!.bindings.people.resident.initial])!;
    scenario.story!.bindings.people.friend = { id: 'friend', label: 'Friend', locationFactId: 'loc:friend', initial: { spaceId: 'b', at: otherAt }, transitions: [] };
    scenario.facts.push({ ...scenario.facts[0], id: 'loc:friend', person: { label: 'Friend', at: otherAt } });
    action.requires.storyProps![0].holderPersonId = 'friend';
    expect(validateStoryBindings(scenario, built).join('\n')).toContain('can never be held by friend');
    scenario.story!.bindings.props.phone.transitions = [{ when: { facts: [{ factId: 'loc:friend', in: ['confirmed'] }] }, holderPersonId: 'friend' }];
    expect(validateStoryBindings(scenario, built)).toEqual([]);
    action.requires.storyProps = [{ propId: 'bed', reason: 'Use the mapped bed' }];
    expect(validateStoryBindings(scenario, built)).toEqual([]);
    action.requires.storyProps[0].holderPersonId = 'resident';
    expect(validateStoryBindings(scenario, built).join('\n')).toContain('mapped prop bed cannot require a carried holder');
  });

  it('rejects unknown prop/holder requirements and missing bindings through the main scenario validator', () => {
    const built = build(), scenario = fixture(built);
    const action = propAction(scenario);
    action.requires.storyProps = [{ propId: 'ghost_prop', holderPersonId: 'ghost_person', reason: '' }];
    const errors = validateScenario(scenario, built).join('\n');
    expect(errors).toContain('unknown required prop ghost_prop');
    expect(errors).toContain('unknown holder ghost_person');
    expect(errors).toContain('needs a reason');
    delete scenario.story;
    expect(validateStoryBindings(scenario, built).join('\n')).toContain('requires missing story bindings');
    scenario.version = 4;
    expect(validateStoryBindings(scenario, built)).toEqual([]);
    expect(validateScenario(scenario, built).join('\n')).not.toContain(': story ');
  });

  it.each([
    ['wrong room kind', (s: ScenarioDefinition) => { s.story!.bindings.rooms.home.spaceId = 'yard'; }, 'actual room'],
    ['wrong exterior kind', (s: ScenarioDefinition) => { s.story!.bindings.exterior.meeting.spaceId = 'b'; }, 'actual exterior'],
    ['fake mapped chair', (s: ScenarioDefinition) => { s.story!.bindings.props.bed.objectId = 'invented-chair'; }, 'unknown mapped object'],
    ['missing holder', (s: ScenarioDefinition) => { s.story!.bindings.props.phone.holderPersonId = 'ghost'; }, 'unknown holder'],
    ['missing next holder', (s: ScenarioDefinition) => { s.story!.bindings.props.phone.transitions = [{ when: {}, holderPersonId: 'ghost' }]; }, 'unknown holder'],
    ['missing fact', (s: ScenarioDefinition) => { s.story!.bindings.people.resident.locationFactId = 'ghost'; }, 'unknown fact'],
    ['bad public transition', (s: ScenarioDefinition) => { s.story!.bindings.people.resident.transitions = [{ when: { facts: [{ factId: 'ghost', in: ['confirmed'] }] }, to: { kind: 'offscene', label: 'Gone' }, observed: true }]; }, 'unknown fact'],
    ['fake offscene zone', (s: ScenarioDefinition) => { s.story!.bindings.people.resident.transitions = [{ when: {}, to: { spaceId: 'offscene', at: { x: 0, y: 0 } }, observed: true }]; }, 'unknown space'],
    ['empty offscene label', (s: ScenarioDefinition) => { s.story!.bindings.people.resident.transitions = [{ when: {}, to: { kind: 'offscene', label: '' }, observed: true }]; }, 'labeled offscene'],
    ['undeclared flag', (s: ScenarioDefinition) => { s.story!.bindings.people.resident.transitions = [{ when: { flags: ['misspelled'] }, to: { kind: 'offscene', label: 'Gone' }, observed: true }]; }, 'undeclared flag'],
    ['outside point', (s: ScenarioDefinition) => { s.story!.bindings.people.resident.initial.at = { x: 500, y: 500 }; }, 'point is outside'],
    ['furniture collision', (s: ScenarioDefinition) => { s.story!.bindings.people.resident.initial = { spaceId: 'a', at: { x: 2, y: 2 } }; }, 'blocked by an object'],
    ['disconnected route', (s: ScenarioDefinition) => { s.story!.bindings.routes.leave.openingIds = ['d_front', 'd_ab']; }, 'not contiguous'],
    ['incomplete route', (s: ScenarioDefinition) => { s.story!.bindings.routes.leave.openingIds = ['d_ab']; }, 'does not reach'],
    ['chair on narrow route', (s: ScenarioDefinition) => { s.story!.bindings.routes.leave.profile = 'chair'; }, 'incompatible with chair'],
    ['unknown public prompt fact', (s: ScenarioDefinition) => { s.stages.assess.contextPrompts = [{ when: { facts: [{ factId: 'ghost', in: ['confirmed'] }] }, prompt: 'Ghost' }]; }, 'unknown fact'],
    ['unknown civilian fact', (s: ScenarioDefinition) => { s.civilianOutcomes = [{ id: 'civilian', label: 'Civilian', factId: 'ghost', safeFlag: 'safe', injuredFlag: 'hurt', careFlag: 'care' }]; }, 'unknown fact'],
  ])('rejects %s', (_, change, message) => {
    const built = build(), scenario = fixture(built);
    change(scenario);
    expect(validateStoryBindings(scenario, built).join('\n')).toContain(message);
  });

  it('rejects duplicate actors, location links, labels and overlapping initial points', () => {
    const built = build(), scenario = fixture(built);
    scenario.story!.bindings.people.other = structuredClone(scenario.story!.bindings.people.resident);
    const errors = validateStoryBindings(scenario, built).join('\n');
    expect(errors).toContain('duplicate person id');
    expect(errors).toContain('duplicate person label');
    expect(errors).toContain('duplicate person location fact');
    expect(errors).toContain('overlap');
    scenario.story!.bindings.props.other = structuredClone(scenario.story!.bindings.props.phone);
    expect(validateStoryBindings(scenario, built).join('\n')).toContain('duplicate prop id');
  });

  it('validates named floors instead of mistaking an upstairs anchor for overlapping downstairs geometry', () => {
    const built = build(TWO_FLOOR_FIXTURE), scenario = fixture();
    const at: StoryAnchor = { spaceId: 'landing', at: storyPoint(built, 'landing', 12)! };
    const outside = built.location.entries[0];
    scenario.story!.bindings.people.resident.initial = at;
    scenario.story!.bindings.rooms.home.spaceId = 'landing';
    scenario.story!.bindings.exterior.meeting.spaceId = outside;
    scenario.story!.bindings.routes.leave = { fromSpaceId: 'landing', toSpaceId: outside, profile: 'walking', openingIds: findStoryRoute(built, 'landing', outside, 'walking')! };
    scenario.story!.bindings.props = {};
    scenario.facts[0].spaceId = 'landing'; scenario.facts[0].person!.at = at.at;
    expect(validateStoryBindings(scenario, built)).toEqual([]);
    expect(validateScenario(scenario, built).join('\n')).not.toContain('position is not inside landing');
    scenario.facts[0].person!.reportedAt = at.at;
    expect(validateScenario(scenario, built).join('\n')).not.toContain('position is not inside landing');
    scenario.version = 4;
    expect(validateScenario(scenario, built).join('\n')).toContain('position is not inside landing');
  });

  it('rejects unreachable required anchors and leaves versions one through four untouched', () => {
    const built = build(), scenario = fixture(built);
    built.location.openings.find(opening => opening.id === 'd_ab')!.state = 'blocked';
    expect(validateStoryBindings(scenario, built).join('\n')).toContain('unreachable');
    for (const version of [1, 2, 3, 4]) {
      scenario.version = version;
      expect(validateStoryBindings(scenario, built)).toEqual([]);
      expect(currentStoryRoute(scenario, built, 'leave')).toBeNull();
    }
  });
});
