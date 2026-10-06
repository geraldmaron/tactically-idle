import type { IncidentType, ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation, Room } from '../../../sim/types';
import { hashSeed } from '../../../sim/rng';
import { findStoryRoute, queryStoryRooms, selectStoryRoom, type StoryRoomSelector } from '../../../sim/story-bindings';
import { bindScenarioText } from './episode-plan';

/** Content v10 hosts the six authored stories (v5 premises, v6 episodes, v7 scenes,
 * v8 decisions) on any building whose actual rooms, objects, floors and routes meet
 * the story's needs, instead of on the named authored buildings. Every helper here is
 * read only for incidents at contentVersion >= 10; v1-v9 keep their frozen paths. */
export const LOCATION_HOSTED_V10 = 10;
export const hostsByLocation = (s: ScenarioDefinition) => (s.incident?.contentVersion ?? 0) >= LOCATION_HOSTED_V10;

// Zones that sit inside a block (a balcony, a shared corridor or stairwell) are real
// entries, but nobody can be walked "outside" to wait there, and their level and lift
// access are not modelled, so a step-free pickup cannot be assumed at them.
const INDOOR_EXTERIOR_TAGS = ['balcony', 'corridor', 'stairwell'];

/** Ordered places a story's "outside" can be. The v5 authors read the arrival as the
 * first entry; generated buildings order entries by construction, and the first can be a
 * balcony or a fenced yard too cramped to hold the people a story moves outside. The
 * episode is tried at each candidate in turn, so the original first entry still wins
 * whenever it can host the story. */
export function storyArrivalsV10(built: BuiltLocation, type: IncidentType): string[] {
  const zones = new Map(built.location.zones.map(zone => [zone.id, zone]));
  return built.location.entries.filter(id => {
    const tags = zones.get(id)?.tags ?? [];
    if (tags.includes('balcony')) return false;
    // Jun leaves with the wheelchair to a vehicle pickup: only a ground-level exterior qualifies,
    // except that a building recording step-free access (`_g2` apartments: a ground-floor unit
    // or an elevator) makes its shared corridor the step-free way to the street door.
    if (type === 'protected_rescue' && built.location.access?.stepFree && tags.includes('corridor')) return true;
    return type !== 'protected_rescue' || !tags.some(tag => INDOOR_EXTERIOR_TAGS.includes(tag));
  });
}

/** The same building with `arrival` listed first. IDs, geometry and routes are unchanged;
 * only the story authors' notion of "outside" moves to a zone that can hold it. */
export function withStoryArrival(built: BuiltLocation, arrival: string): BuiltLocation {
  if (built.location.entries[0] === arrival) return built;
  return { ...built, location: { ...built.location, entries: [arrival, ...built.location.entries.filter(id => id !== arrival)] } };
}

/** Location requirements replacing authored building identity. Each one is something the
 * story actually depends on, expressed against the built location. */
export function storyRoomV10(built: BuiltLocation, type: IncidentType, base: StoryRoomSelector, seed: number): Room | null {
  const arrival = built.location.entries[0];
  if (type === 'protected_rescue') {
    // Jun waits in a ground-floor living space and leaves with the wheelchair: the room
    // must have a chair-compatible route to the pickup. Which home it is does not matter,
    // but the bound route (the same shortest chair route attachStoryBindings uses) must
    // not pass through a block's shared corridor or stairwell, whose level is unmodelled.
    const selector: StoryRoomSelector = { floor: 0, types: ['living'], reachableFromSpaceId: arrival, profile: 'chair' };
    const zones = new Map(built.location.zones.map(zone => [zone.id, zone]));
    const openings = new Map(built.location.openings.map(opening => [opening.id, opening]));
    // A generated building that records step-free access (`_g2` apartments: ground-floor
    // unit or an elevator) makes its shared corridor and stairwell part of a usable route.
    const commonAccess = built.location.access?.stepFree === true;
    const stepFree = (room: Room) => commonAccess || !(findStoryRoute(built, room.id, arrival, 'chair') ?? []).some(id => {
      const opening = openings.get(id)!;
      return [opening.a, opening.b].some(space => zones.get(space)?.tags.some(tag => INDOOR_EXTERIOR_TAGS.includes(tag)));
    });
    const chosen = selectStoryRoom(built, selector, seed);
    if (!chosen || stepFree(chosen)) return chosen;
    const allowed = queryStoryRooms(built, selector).filter(stepFree);
    return allowed.length ? allowed[hashSeed(`${seed}:step-free-v10`) % allowed.length] : null;
  }
  if (type === 'welfare_check' || type === 'barricaded') {
    // Ada and Mina are just inside their own front door. A room with its own exterior
    // door is preferred (the v9 rule); in a flat whose front door opens onto a hall, a
    // room one inside door from that hall is still just inside her doorway.
    const selector: StoryRoomSelector = { ...base, types: ['living', 'bedroom'], reachableFromSpaceId: arrival };
    const adjacent = selectStoryRoom(built, selector, seed);
    if (adjacent) return adjacent;
    const near = queryStoryRooms(built, { ...selector, adjacentToExterior: false }).filter(room => (findStoryRoute(built, arrival, room.id, 'walking')?.length ?? Infinity) <= 2);
    return near.length ? near[hashSeed(`${seed}:near-door-v10`) % near.length] : null;
  }
  // The business stories already select by setting, room type and required objects
  // (a register for Eli's tills). Only the reachable arrival changes.
  return selectStoryRoom(built, { ...base, reachableFromSpaceId: arrival }, seed);
}

/** A spoken room name from the real label. Generated living spaces carry one-word labels
 * ("Living", "Dining") that read as adjectives in a sentence; authored labels
 * ("Front room", "Living / dining") are already phrases and stay as they are. */
export function roomPhraseV10(room: Room): string {
  const label = room.label.toLowerCase();
  return room.type === 'living' && (label === 'living' || label === 'dining') ? `${label} room` : label;
}

/** Authored premises named the building they were written for ("Market Row", "the print
 * shop", "the living room"). On v10 those display phrases come from the actual location:
 * its name and the real room's label. Only display text is rebound; IDs, flags and
 * conditions are untouched. Runs after v8, before the v9 cast binder (no generated
 * location name contains an authored cast name, so the cast binder cannot rewrite it). */
export function withLocationTextV10(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  if (!hostsByLocation(input)) return input;
  const type = input.incident!.type;
  const name = built.location.name;
  const scene = built.location.rooms.find(room => room.id === input.story?.bindings.rooms.scene.spaceId);
  const replacements: Record<string, string> = {};
  for (const room of built.location.rooms) {
    const label = room.label.toLowerCase(), phrase = roomPhraseV10(room);
    if (phrase === label) continue;
    // Identity entries keep the longer, already-correct phrase from matching the short one.
    for (const lead of ['the', 'ground-floor']) Object.assign(replacements, { [`${lead} ${label}`]: `${lead} ${phrase}`, [`${lead} ${phrase}`]: `${lead} ${phrase}` });
  }
  if (type === 'protected_rescue' && scene) replacements['the living room'] = `the ${roomPhraseV10(scene)}`;
  if (type === 'active_armed_incident') Object.assign(replacements, {
    'Market Row response': `response at ${name}`, 'Market Row': name, 'Shop worker': 'Staff member', 'shop worker': 'staff member',
    'the shop manager': 'the manager', 'A quiet shop': 'Silence inside', 'Shop register': 'Register', 'the shop': name,
  });
  if (type === 'hostage_crisis') Object.assign(replacements, {
    'the print shop': name, 'print-shop owner': 'owner', 'shop owner': 'owner', 'in her shop': `at ${name}`,
    'missing shop money': 'missing money', 'the shop money': 'the money', 'the shop’s only working phone': 'the only working phone inside',
    'the only working phone in the shop': 'the only working phone inside', 'mapped shop fixture': 'mapped fixture',
    'The shop is not finished': 'The call is not finished', 'the shop': name,
  });
  if (type === 'medical_complication') Object.assign(replacements, {
    'the shop keys': `the keys to ${name}`, 'shop keys': 'work keys', 'shop duties': 'work duties', 'shop responsibility': 'work responsibility', 'the shop': name,
  });
  if (!Object.keys(replacements).length) return input;
  return bindScenarioText(input, replacements);
}
