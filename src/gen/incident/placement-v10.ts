import type { EnvironmentDefinition, IncidentType } from '../../sim/scenario-types';
import type { BuiltLocation, Id, LocationDefinition, Room, Vec } from '../../sim/types';
import { findStoryRoute, storyPoint } from '../../sim/story-bindings';
import { hashSeed } from '../../sim/rng';

/** What a room is used for, read from its real type and tags (generated buildings carry
 * a rich tag vocabulary; authored ones mostly only a type, which the fallbacks cover).
 * Stairs are never a placement: nobody waits for the team on a flight of stairs. */
export type PlacementKind =
  | 'bedroom' | 'bath' | 'wc' | 'living' | 'dining' | 'kitchen' | 'study' | 'utility' | 'storage' | 'hall' | 'landing'
  | 'shop' | 'bar' | 'reception' | 'office' | 'meeting' | 'open_office' | 'staff' | 'stock' | 'cold' | 'server' | 'warehouse'
  | 'guest_room' | 'flat';

export interface PlacementAffinity {
  /** Relative weight per room use. Absent or 0 means never placed there. */
  kinds: Partial<Record<PlacementKind, number>>;
  /** Multiplier for rooms above the ground floor (stairs are walkable, so they count). */
  upstairs?: number;
  /** Extra multipliers by use when the call happens at night. */
  night?: Partial<Record<PlacementKind, number>>;
  /** Extra multipliers by room tag, e.g. a keyholder checking where the valuables are. */
  tags?: Readonly<Record<string, number>>;
  /** Percent of calls whose first report names a plausible but wrong room. Only for
   * callers who were not on scene; patrol-present calls report what patrol sees. */
  misreport?: number | ((variant: number) => number);
}

/** Proposed game tuning (docs/phase3-generation.md, "People and placement"): weights are
 * reviewed plausibility, not sourced statistics. Homes keep people in rooms they would be
 * in for that story; businesses keep them in staff, office, stock or trading areas, never a
 * guest's room or the private flat above the shop. */
export const PLACEMENT_AFFINITIES_V10: Partial<Record<IncidentType, PlacementAffinity>> = {
  // Found at home after a missed check-in: anywhere lived in, often their own room.
  missing_vulnerable: { kinds: { bedroom: 4, living: 4, kitchen: 3, dining: 2, study: 2, bath: 1 }, night: { bedroom: 2 },
    // The "old sighting" situation is a wrong-room report by construction.
    misreport: variant => variant === 1 ? 100 : 20 },
  // Someone who finds being alone hard tonight: a bedroom or a lockable private room.
  person_in_crisis: { kinds: { bedroom: 5, living: 4, kitchen: 2, bath: 2, study: 1, dining: 1 }, night: { bedroom: 1.5 }, tags: { lockable: 1.25 }, misreport: 25 },
  // Patrol has separated the adults and reports what it sees, so the room is right.
  domestic: { kinds: { living: 4, kitchen: 4, bedroom: 3, dining: 2, study: 2 } },
  // A gathering happens in the shared rooms; the neighbour only hears it through a wall.
  disturbance: { kinds: { living: 6, dining: 4, kitchen: 3, study: 1, bedroom: 1 }, misreport: 35 },
  // A visitor who let themselves in stays in the shared rooms, rarely upstairs.
  false_intruder: { kinds: { living: 4, kitchen: 4, dining: 3, hall: 2, study: 1 }, upstairs: .25, misreport: 35 },
  // Someone living there: any lived-in room, or by the damaged entrance.
  vacant_occupancy: { kinds: { living: 4, kitchen: 3, bedroom: 3, dining: 2, study: 2, hall: 1 }, misreport: 20 },
  // The keyholder met patrol and is checking the premises, drawn to the till or safe.
  burglary: { kinds: { shop: 4, office: 4, reception: 3, stock: 3, bar: 3, warehouse: 3, open_office: 2, meeting: 1, staff: 1, storage: 1, server: 1, cold: 1, dining: 1 },
    upstairs: .5, tags: { valuables: 1.5 } },
  // A shop witness: on the trading floor, or waiting in a staff or office area.
  business_robbery: { kinds: { shop: 5, bar: 5, reception: 4, office: 3, staff: 3, dining: 2, stock: 2, open_office: 2, meeting: 2, warehouse: 2 }, tags: { valuables: 1.25 } },
};

const WORK_TAGS = ['staff', 'office', 'work', 'meeting', 'server'];
/** Floors of a business that hold a private flat (a bedroom or a residential living room). */
function flatFloors(location: LocationDefinition): Set<number> {
  return new Set(location.setting !== 'business' ? [] : location.rooms
    .filter(room => room.floor > 0 && (room.type === 'bedroom' && !room.tags.includes('guest') || room.tags.includes('residential'))).map(room => room.floor));
}

export function placementKind(room: Room, location: LocationDefinition, flats = flatFloors(location)): PlacementKind | null {
  const has = (tag: string) => room.tags.includes(tag), business = location.setting === 'business';
  if (room.type === 'stair' || has('stairs')) return null;
  if (business && flats.has(room.floor) && !WORK_TAGS.some(has)) return 'flat';
  switch (room.type) {
    case 'hall': return room.floor > 0 ? 'landing' : 'hall';
    case 'bedroom': return business && has('guest') ? 'guest_room' : 'bedroom';
    case 'bathroom': return has('wc') ? 'wc' : 'bath';
    case 'living': return has('dining') ? 'dining' : 'living';
    case 'kitchen': return business ? 'staff' : 'kitchen';
    case 'utility': return business && has('staff') ? 'staff' : 'utility';
    case 'office': return !business ? 'study' : has('reception') ? 'reception' : has('meeting') ? 'meeting'
      : has('work') && !has('private') ? 'open_office' : 'office';
    case 'retail': return has('bar') ? 'bar' : 'shop';
    case 'storage': return has('warehouse') ? 'warehouse' : has('cold') ? 'cold' : has('server') ? 'server'
      // Authored stockrooms carry no service tag; generated ones say 'stock'.
      : business && (has('stock') || !has('service')) ? 'stock' : 'storage';
    default: return null;
  }
}

export interface WeightedRoom { room: Room; kind: PlacementKind; weight: number }
/** Every room the role could plausibly be in, with its weight; deterministic and sorted. */
export function placementCandidates(built: BuiltLocation, type: IncidentType, timeOfDay: EnvironmentDefinition['timeOfDay'], arrivalId: Id): WeightedRoom[] {
  const affinity = PLACEMENT_AFFINITIES_V10[type];
  if (!affinity) return [];
  const flats = flatFloors(built.location);
  return built.location.rooms.flatMap(room => {
    const kind = placementKind(room, built.location, flats);
    let weight = kind ? affinity.kinds[kind] ?? 0 : 0;
    if (room.floor > 0) weight *= affinity.upstairs ?? 1;
    if (timeOfDay === 'night' && kind) weight *= affinity.night?.[kind] ?? 1;
    for (const [tag, factor] of Object.entries(affinity.tags ?? {})) if (room.tags.includes(tag)) weight *= factor;
    // Integer weights keep the hash pick exact across platforms.
    weight = Math.round(weight * 100);
    // An exit route to the arrival point is required: the story walks people out along it.
    return kind && weight > 0 && findStoryRoute(built, room.id, arrivalId, 'walking') ? [{ room, kind, weight }] : [];
  }).sort((a, b) => a.room.id < b.room.id ? -1 : a.room.id > b.room.id ? 1 : 0);
}

function weightedPick<T extends { weight: number }>(items: readonly T[], seed: number): T | null {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;
  let roll = seed % total;
  for (const item of items) { if (roll < item.weight) return item; roll -= item.weight; }
  return null;
}

/** A natural room name in prose, floor-aware: "the upstairs bedroom", "bedroom 2 upstairs",
 * "the back office". Single-floor buildings never say "upstairs". */
export function roomPhrase(built: BuiltLocation, room: Room): string {
  const label = room.label.toLowerCase(), name = ({ living: 'living room', dining: 'dining room', bath: 'bathroom', 'bar and dining': 'bar' } as Record<string, string>)[label] ?? label;
  const upstairs = room.floor > 0 && built.location.rooms.some(other => other.floor !== room.floor);
  return /\d$/.test(name) ? `${name}${upstairs ? ' upstairs' : ''}` : `the ${upstairs ? 'upstairs ' : ''}${name}`;
}

export interface PersonPlacement {
  room: Room;
  kind: PlacementKind;
  /** Exact standing point, clear of furniture and reachable from the room's doorway. */
  at: Vec;
  /** Walking route from the room to the arrival point; stairs count as walkable. */
  route: Id[];
  /** What dispatch reports. Differs from `room` only when the first account is wrong. */
  reported: { room: Room; at: Vec };
  misreported: boolean;
}

/** Role-to-room placement for the v10 framework person. Same inputs, same placement; a new
 * call (seed) or building (buildingSeed) moves the person. Null when the building has no
 * plausible reachable room with free floor space, so the caller can try another building. */
export function placeFrameworkPerson(built: BuiltLocation, input: {
  type: IncidentType; variant: number; seed: number; buildingSeed: number;
  timeOfDay: EnvironmentDefinition['timeOfDay']; arrivalId: Id;
}): PersonPlacement | null {
  const key = `${input.type}:${input.seed}:${input.buildingSeed}:place-v10`;
  const affinity = PLACEMENT_AFFINITIES_V10[input.type];
  let pool = placementCandidates(built, input.type, input.timeOfDay, input.arrivalId);
  for (let attempt = 0; pool.length; attempt++) {
    const picked = weightedPick(pool, hashSeed(`${key}:room:${attempt}`))!;
    const at = storyPoint(built, picked.room.id, hashSeed(`${key}:at`));
    const route = at && findStoryRoute(built, picked.room.id, input.arrivalId, 'walking');
    if (!at || !route) { pool = pool.filter(entry => entry !== picked); continue; }
    const actual = { spaceId: picked.room.id, at };
    const misreport = typeof affinity?.misreport === 'function' ? affinity.misreport(input.variant) : affinity?.misreport ?? 0;
    let reported: PersonPlacement['reported'] | null = null;
    if (hashSeed(`${key}:misreport`) % 100 < misreport) {
      // A wrong first account still names a room the person could plausibly be in.
      let others = pool.filter(entry => entry !== picked);
      for (let tries = 0; !reported && others.length; tries++) {
        const wrong = weightedPick(others, hashSeed(`${key}:reported:${tries}`))!;
        const point = storyPoint(built, wrong.room.id, hashSeed(`${key}:reported-at`));
        if (point) reported = { room: wrong.room, at: point };
        else others = others.filter(entry => entry !== wrong);
      }
    }
    // A room-level report never carries the hidden exact point: a separate free spot.
    if (!reported) {
      const point = storyPoint(built, picked.room.id, hashSeed(`${key}:reported-at`), [actual]);
      if (!point) { pool = pool.filter(entry => entry !== picked); continue; }
      reported = { room: picked.room, at: point };
    }
    return { room: picked.room, kind: picked.kind, at, route, reported, misreported: reported.room.id !== picked.room.id };
  }
  return null;
}
