import type { Condition, ScenarioDefinition, StoryAnchor, StoryInstance } from './scenario-types';
import type { BuiltLocation, ExteriorZone, Id, LocationDefinition, ObjectType, Opening, PlacedObject, Polygon, Room, RoomType, Vec, ZoneKind } from './types';
import { floorMap, openingFloor, pointInPolygon, polygonBBox, polygonCentroid } from './location';

export type StoryRouteProfile = StoryInstance['bindings']['routes'][string]['profile'];
export interface StoryObjectSelector { spaceId?: Id; type?: ObjectType; tags?: readonly string[] }
export interface StoryRoomSelector {
  setting?: LocationDefinition['setting'];
  types?: readonly RoomType[];
  floor?: number;
  tags?: readonly string[];
  /** Every requirement must match a real object in the selected room. */
  requiredObjects?: readonly Omit<StoryObjectSelector, 'spaceId'>[];
  excludeSpaceIds?: readonly Id[];
  adjacentToExterior?: boolean;
  reachableFromSpaceId?: Id;
  profile?: StoryRouteProfile;
}
export interface StoryExteriorSelector {
  kinds?: readonly ZoneKind[];
  tags?: readonly string[];
  entriesOnly?: boolean;
  reachableFromSpaceId?: Id;
  profile?: StoryRouteProfile;
}

const byId = (a: { id: Id }, b: { id: Id }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const allTags = (tags: readonly string[], required: readonly string[] = []) => required.every(tag => tags.includes(tag));
function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}
function choose<T>(items: readonly T[], seed: number, role: string): T | null {
  return items.length ? items[hash(`${seed}:${role}`) % items.length] : null;
}
function matchesObject(object: PlacedObject, selector: StoryObjectSelector): boolean {
  return (selector.spaceId === undefined || object.in === selector.spaceId)
    && (selector.type === undefined || object.type === selector.type) && allTags(object.tags, selector.tags);
}

/** Optional lookup returns null when a required prop has no actual mapped counterpart. */
export function findStoryObject(built: BuiltLocation, selector: StoryObjectSelector, seed = 0): PlacedObject | null {
  return choose(built.location.objects.filter(object => matchesObject(object, selector)).sort(byId), seed, 'object');
}

/** Sorted candidate lists are independent of authored array order. No room or furniture is invented. */
export function queryStoryRooms(built: BuiltLocation, selector: StoryRoomSelector = {}): Room[] {
  if (selector.setting !== undefined && built.location.setting !== selector.setting) return [];
  const exteriorIds = new Set(built.location.zones.map(zone => zone.id));
  return built.location.rooms.filter(room => (selector.types === undefined || selector.types.includes(room.type))
    && (selector.floor === undefined || room.floor === selector.floor)
    && allTags(room.tags, selector.tags)
    && !selector.excludeSpaceIds?.includes(room.id)
    && (selector.requiredObjects ?? []).every(requirement => built.location.objects.some(object => matchesObject(object, { ...requirement, spaceId: room.id })))
    && (!selector.adjacentToExterior || built.location.openings.some(opening => opening.type !== 'stair'
      && usableOpening(built, opening, selector.profile ?? 'walking')
      && ((opening.a === room.id && exteriorIds.has(opening.b)) || (opening.b === room.id && exteriorIds.has(opening.a)))))
    && (selector.reachableFromSpaceId === undefined || findStoryRoute(built, selector.reachableFromSpaceId, room.id, selector.profile ?? 'walking') !== null))
    .sort(byId);
}

export function selectStoryRoom(built: BuiltLocation, selector: StoryRoomSelector, seed: number): Room | null {
  return choose(queryStoryRooms(built, selector), seed, 'room');
}

export function selectStoryExterior(built: BuiltLocation, selector: StoryExteriorSelector, seed: number): ExteriorZone | null {
  const zones = built.location.zones.filter(zone => (selector.kinds === undefined || selector.kinds.includes(zone.kind))
    && allTags(zone.tags, selector.tags)
    && (!selector.entriesOnly || built.location.entries.includes(zone.id))
    && (selector.reachableFromSpaceId === undefined || findStoryRoute(built, selector.reachableFromSpaceId, zone.id, selector.profile ?? 'walking') !== null))
    .sort(byId);
  return choose(zones, seed, 'exterior');
}

function space(built: BuiltLocation, spaceId: Id): Room | ExteriorZone | undefined {
  return built.location.rooms.find(room => room.id === spaceId) ?? built.location.zones.find(zone => zone.id === spaceId);
}
function segmentDistance(point: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}
function boundaryClearance(point: Vec, polygon: Polygon): number {
  return Math.min(...polygon.map((a, i) => segmentDistance(point, a, polygon[(i + 1) % polygon.length])));
}
function hitsObject(point: Vec, object: PlacedObject, margin = 0): boolean {
  const swap = object.rotation === 90 || object.rotation === 270;
  const halfWidth = (swap ? object.h : object.w) / 2 + margin;
  const halfHeight = (swap ? object.w : object.h) / 2 + margin;
  return Math.abs(point.x - object.x - object.w / 2) <= halfWidth
    && Math.abs(point.y - object.y - object.h / 2) <= halfHeight;
}
function pointFree(built: BuiltLocation, spaceId: Id, at: Vec, margin = 0): boolean {
  const location = space(built, spaceId);
  return !!location && Number.isFinite(at.x) && Number.isFinite(at.y)
    && pointInPolygon(at, location.polygon) && boundaryClearance(at, location.polygon) > margin
    && !built.location.objects.some(object => object.in === spaceId && object.tags.includes('blocks_space') && hitsObject(at, object, margin));
}

/** Deterministic occupied-space placement; null is an explicit unsupported binding, never a fake point. */
export function storyPoint(built: BuiltLocation, spaceId: Id, seed: number, occupied: readonly StoryAnchor[] = []): Vec | null {
  const location = space(built, spaceId);
  if (!location) return null;
  const bounds = polygonBBox(location.polygon);
  const candidates = [polygonCentroid(location.polygon)];
  // Half-foot cells cover the game's rooms, while a cap keeps malformed huge geometry bounded.
  const step = Math.max(0.5, Math.sqrt(bounds.w * bounds.h / 20000));
  for (let y = bounds.y + step / 2; y < bounds.y + bounds.h; y += step)
    for (let x = bounds.x + step / 2; x < bounds.x + bounds.w; x += step) candidates.push({ x, y });
  const start = hash(`${seed}:${spaceId}`) % candidates.length;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[(start + i) % candidates.length];
    if (pointFree(built, spaceId, candidate, 0.2)
      && !occupied.some(anchor => anchor.spaceId === spaceId && Math.hypot(candidate.x - anchor.at.x, candidate.y - anchor.at.y) < 1.5)) return { ...candidate };
  }
  return null;
}

function usableOpening(built: BuiltLocation, opening: Opening, profile: StoryRouteProfile): boolean {
  if (opening.state === 'blocked' || opening.type === 'window' || !space(built, opening.a) || !space(built, opening.b)) return false;
  const floors = floorMap(built.location);
  const a = floors.get(opening.a)!, b = floors.get(opening.b)!;
  if (opening.type === 'stair') return profile === 'walking' && a !== b
    && built.location.rooms.some(room => room.id === opening.a) && built.location.rooms.some(room => room.id === opening.b);
  const floor = openingFloor(opening, floors, new Set(built.location.rooms.map(room => room.id)));
  if (a !== b || floor !== a) return false;
  return profile === 'walking' || (profile === 'chair' && a === 0 && Math.hypot(opening.to.x - opening.from.x, opening.to.y - opening.from.y) >= 3);
}

/** Complete shortest edge-count path, with stable ID tie-breaking. Locked doors remain engine work. */
export function findStoryRoute(built: BuiltLocation, fromSpaceId: Id, toSpaceId: Id, profile: StoryRouteProfile): Id[] | null {
  if (!space(built, fromSpaceId) || !space(built, toSpaceId) || !['walking', 'chair'].includes(profile)) return null;
  if (profile === 'chair' && [fromSpaceId, toSpaceId].some(id => (floorMap(built.location).get(id) ?? 0) !== 0)) return null;
  const openings = built.location.openings.filter(opening => usableOpening(built, opening, profile)).sort(byId);
  const queue: { id: Id; route: Id[] }[] = [{ id: fromSpaceId, route: [] }];
  const seen = new Set([fromSpaceId]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current.id === toSpaceId) return current.route;
    for (const opening of openings) {
      const next = opening.a === current.id ? opening.b : opening.b === current.id ? opening.a : undefined;
      if (next === undefined || seen.has(next)) continue;
      seen.add(next);
      queue.push({ id: next, route: [...current.route, opening.id] });
    }
  }
  return null;
}

/** Recompute from the current builtFor result, so later opening flags cannot leave a stale route. */
export function currentStoryRoute(scenario: ScenarioDefinition, built: BuiltLocation, routeRole: string): Id[] | null {
  const route = scenario.version >= 5 ? scenario.story?.bindings.routes[routeRole] : undefined;
  return route ? findStoryRoute(built, route.fromSpaceId, route.toSpaceId, route.profile) : null;
}

/** Authoring validation only. Legacy scenarios keep their original validator and behavior. */
export function validateStoryBindings(scenario: ScenarioDefinition, built: BuiltLocation): string[] {
  if (scenario.version < 5) return [];
  if (!scenario.story) return Object.values(scenario.stages).flatMap(stage => stage.actions)
    .filter(action => action.storyRoute || action.storyTargetPersonId || action.requires.storyProps?.length)
    .map(action => `${scenario.id}: story action ${action.id} requires missing story bindings`);
  const errors: string[] = [];
  const error = (message: string) => errors.push(`${scenario.id}: story ${message}`);
  const { story } = scenario;
  const { bindings } = story;
  const facts = new Map(scenario.facts.map(fact => [fact.id, fact]));
  const people = Object.values(bindings.people);
  const personIds = new Set(people.map(person => person.id));
  const actions = Object.values(scenario.stages).flatMap(stage => stage.actions);
  const effects = actions.flatMap(action => Object.values(action.outcomes).flat());
  const flags = new Set(['casualty:officers', 'casualty:untreated', 'casualty:awaiting_transport', 'casualty:evacuated',
    ...effects.flatMap(effect => [...effect.setFlags ?? [], ...effect.clearFlags ?? []]),
    ...built.location.openings.flatMap(opening => ['open', 'closed', 'locked', 'blocked'].map(state => `opening:${opening.id}=${state}`))]);
  const requiredFact = (id: Id, context: string) => { if (!facts.has(id)) error(`${context} references unknown fact ${id}`); };
  const condition = (when: Condition | undefined, context: string) => {
    for (const entry of when?.facts ?? []) requiredFact(entry.factId, context);
    for (const flag of [...when?.flags ?? [], ...when?.notFlags ?? []]) if (!flags.has(flag)) error(`${context} references undeclared flag ${flag}`);
  };
  const unique = (values: readonly string[], context: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (!value.trim()) error(`${context} is empty`);
      if (seen.has(value)) error(`duplicate ${context} ${value}`);
      seen.add(value);
    }
  };
  const reachable = (id: Id) => built.location.entries.some(entry => findStoryRoute(built, entry, id, 'walking') !== null);
  const anchor = (value: StoryAnchor, context: string) => {
    if (!space(built, value.spaceId)) error(`${context} references unknown space ${value.spaceId}`);
    else {
      if (!pointFree(built, value.spaceId, value.at)) error(`${context} point is outside its space or blocked by an object`);
      if (!reachable(value.spaceId)) error(`${context} space ${value.spaceId} is unreachable from an entry`);
    }
  };
  if (!story.archetypeId.trim() || !story.episodeId.trim() || !Number.isSafeInteger(story.version) || story.version < 1 || !Number.isSafeInteger(story.seed) || story.seed < 0) error('has invalid archetype identity, version or seed');
  unique(scenario.facts.map(fact => fact.id), 'fact id');
  for (const [role, binding] of Object.entries(bindings.rooms)) {
    if (!role.trim() || !built.location.rooms.some(room => room.id === binding.spaceId)) error(`room ${role} does not reference an actual room ${binding.spaceId}`);
    else if (!reachable(binding.spaceId)) error(`room ${role} is unreachable from an entry`);
  }
  for (const [role, binding] of Object.entries(bindings.exterior)) {
    if (!role.trim() || !built.location.zones.some(zone => zone.id === binding.spaceId)) error(`exterior ${role} does not reference an actual exterior zone ${binding.spaceId}`);
    else if (!reachable(binding.spaceId)) error(`exterior ${role} is unreachable from an entry`);
  }
  unique(people.map(person => person.id), 'person id');
  unique(people.map(person => person.label), 'person label');
  unique(people.map(person => person.locationFactId), 'person location fact');
  for (const [role, person] of Object.entries(bindings.people)) {
    if (!role.trim()) error('person role is empty');
    requiredFact(person.locationFactId, `person ${person.id}`);
    anchor(person.initial, `person ${person.id} initial`);
    if (person.reported) anchor(person.reported, `person ${person.id} reported`);
    const fact = facts.get(person.locationFactId);
    if (fact?.person && fact.person.label !== person.label) error(`person ${person.id} label disagrees with its location fact`);
    for (const [index, transition] of person.transitions.entries()) {
      const context = `person ${person.id} transition ${index}`;
      condition(transition.when, context);
      if ('kind' in transition.to) {
        if (transition.to.kind !== 'offscene' || !transition.to.label.trim()) error(`${context} needs a labeled offscene destination`);
      } else anchor(transition.to, context);
      if (transition.label !== undefined && !transition.label.trim()) error(`${context} has an empty label`);
    }
  }
  for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
    const a = people[i].initial, b = people[j].initial;
    if (a.spaceId === b.spaceId && Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y) < 1.5) error(`people ${people[i].id} and ${people[j].id} overlap`);
  }
  for (const civilian of scenario.civilianOutcomes ?? []) requiredFact(civilian.factId, `civilian ${civilian.id}`);
  unique(Object.values(bindings.props).map(prop => prop.id), 'prop id');
  unique(Object.values(bindings.props).map(prop => prop.label), 'prop label');
  for (const [role, prop] of Object.entries(bindings.props)) {
    if (!role.trim()) error('prop role is empty');
    if (prop.kind === 'mapped') {
      const object = built.location.objects.find(entry => entry.id === prop.objectId);
      if (!object || !space(built, object.in)) error(`prop ${prop.id} references an unknown mapped object ${prop.objectId}`);
      else if (!reachable(object.in)) error(`prop ${prop.id} mapped object is unreachable from an entry`);
      if (prop.holderPersonId || prop.transitions?.length) error(`mapped prop ${prop.id} cannot declare carried holders`);
    } else if (prop.kind === 'carried') {
      if (!prop.holderPersonId || !personIds.has(prop.holderPersonId)) error(`prop ${prop.id} references an unknown holder ${prop.holderPersonId}`);
      if (prop.objectId) error(`carried prop ${prop.id} cannot declare a mapped object`);
    } else error(`prop ${prop.id} has an invalid kind`);
    for (const transition of prop.transitions ?? []) {
      condition(transition.when, `prop ${prop.id} transition`);
      if (!personIds.has(transition.holderPersonId)) error(`prop ${prop.id} transition references an unknown holder ${transition.holderPersonId}`);
    }
  }
  for (const [role, route] of Object.entries(bindings.routes)) {
    let at = route.fromSpaceId;
    if (!role.trim() || !space(built, at) || !space(built, route.toSpaceId)) error(`route ${role} has an unknown endpoint`);
    if (!['walking', 'chair'].includes(route.profile)) error(`route ${role} has an invalid profile`);
    const seen = new Set<Id>();
    for (const openingId of route.openingIds) {
      const opening = built.location.openings.find(entry => entry.id === openingId);
      if (seen.has(openingId)) error(`route ${role} repeats opening ${openingId}`);
      seen.add(openingId);
      if (!opening) { error(`route ${role} references unknown opening ${openingId}`); continue; }
      if (!usableOpening(built, opening, route.profile)) error(`route ${role} opening ${openingId} is blocked or incompatible with ${route.profile}`);
      if (opening.a === at) at = opening.b;
      else if (opening.b === at) at = opening.a;
      else error(`route ${role} opening ${openingId} is not contiguous from ${at}`);
    }
    if (at !== route.toSpaceId) error(`route ${role} does not reach ${route.toSpaceId}`);
    if (findStoryRoute(built, route.fromSpaceId, route.toSpaceId, route.profile) === null) error(`route ${role} is unreachable`);
  }
  for (const stage of Object.values(scenario.stages)) {
    for (const prompt of stage.contextPrompts ?? []) condition(prompt.when, `stage ${stage.id} prompt`);
    for (const action of stage.actions) {
      condition(action.visibleWhen, `action ${action.id} visibility`);
      condition({ facts: action.requires.facts, flags: action.requires.flags?.map(entry => entry.flag), notFlags: action.requires.notFlags?.map(entry => entry.flag) }, `action ${action.id} requirements`);
      for (const modifier of action.modifiers ?? []) condition(modifier.when, `action ${action.id} modifier`);
      if (action.storyTargetPersonId && !personIds.has(action.storyTargetPersonId)) error(`action ${action.id} references unknown target person ${action.storyTargetPersonId}`);
      if (action.storyRoute && !bindings.routes[action.storyRoute]) error(`action ${action.id} references unknown route ${action.storyRoute}`);
      for (const requirement of action.requires.storyProps ?? []) {
        const prop = Object.values(bindings.props).find(binding => binding.id === requirement.propId);
        if (!prop) error(`action ${action.id} references unknown required prop ${requirement.propId}`);
        if (!requirement.reason.trim()) error(`action ${action.id} required prop ${requirement.propId} needs a reason`);
        if (requirement.holderPersonId !== undefined) {
          if (!personIds.has(requirement.holderPersonId)) error(`action ${action.id} required prop ${requirement.propId} references unknown holder ${requirement.holderPersonId}`);
          else if (prop?.kind === 'mapped') error(`action ${action.id} mapped prop ${prop.id} cannot require a carried holder`);
          else if (prop && prop.holderPersonId !== requirement.holderPersonId && !prop.transitions?.some(transition => transition.holderPersonId === requirement.holderPersonId))
            error(`action ${action.id} required prop ${prop.id} can never be held by ${requirement.holderPersonId}`);
        }
      }
      for (const effect of Object.values(action.outcomes).flat()) condition(effect.when, `action ${action.id} outcome`);
    }
  }
  for (const ending of Object.values(scenario.endings)) condition(ending.completion, `ending ${ending.id}`);
  for (const service of scenario.externalServices ?? []) condition(service.acceptWhen, `service ${service.id}`);
  return errors;
}
