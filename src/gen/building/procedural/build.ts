import type { ExteriorZone, LocationDefinition, MapNote, Opening, PlacedObject, Room } from '../../../sim/types';
import { exteriorRuns, finalizeRooms, roomPairs, type Run } from './assemble';
import { distToPoly, lerp, sharedSegments, vec, type Rect } from './geom';
import { type InteriorResult, chooseExterior, connectRooms, makeInteriorOpenings } from './openings';
import type { Rand } from './rand';
import { GEN_VERSION, type FamilySpec, type PRoom } from './types';
import { placeWindows } from './windows';
import { buildZones } from './zones';
import { exteriorObjects } from './exterior';

/**
 * One generation attempt, unfurnished: rooms hold no objects (the game's furnishing solver,
 * furnishLocationV7, places them; generate.ts accepts a draw only once that solve is clean).
 * Returns null as soon as any stage cannot complete; the caller retries with the next draw
 * from the same stream. `familyId` is the public building type id the location carries.
 */
export function buildAttempt(spec: FamilySpec, familyId: string, seed: number, rng: Rand, why?: (reason: string) => void): LocationDefinition | null {
  const no = (reason: string): null => {
    why?.(reason);
    return null;
  };
  const drawn = spec.plan(rng, why);
  if (!drawn) return null;
  const { plan, lot, ext } = drawn;
  if (!finalizeRooms(plan)) return no('finalize');
  const rooms = plan.rooms;
  const policy = spec.policy;
  const pairs = roomPairs(plan);
  const runs: Run[] = exteriorRuns(plan);

  // Exterior doors first so interior doors keep clear of their swings.
  const interior: InteriorResult = { openings: [], swings: new Map(), overrides: [] };
  const frontSides: Run['side'][] = spec.frontSides ?? (plan.chamfer && rng.chance(0.5) ? ['d'] : ['s']);
  const usable = runs.filter((r) => !plan.partyWalls.includes(r.side as 'e' | 'w'));
  const extDoors = chooseExterior(rooms, usable, policy, rng, interior.swings, frontSides, spec.backSides);
  if (!extDoors) return no('exterior_door');

  for (const f of [0, 1]) {
    const onFloor = rooms.filter((r) => r.floor === f);
    if (onFloor.length === 0) continue;
    const fp = pairs.filter((p) => onFloor.some((r) => r.id === p.a));
    const roots = f === 0 ? extDoors.map((d) => d.room) : onFloor.filter((r) => r.seed.key === 'stair').map((r) => r.id);
    const edges = connectRooms(onFloor, fp, roots, policy, rng, why);
    if (!edges) return no('connect');
    if (!makeInteriorOpenings(edges, policy, rng, f, interior, why)) return no('interior_door');
  }

  const zoneSet = buildZones(plan, lot, ext, extDoors, rng);
  if (!zoneSet) return no('zones');

  const openings: Opening[] = [...interior.openings];
  for (const d of extDoors) {
    const mid = lerp(d.from, d.to, 0.5);
    const zone = zoneSet.zones.find((z) => z.id === zoneSet.at(vec(mid.x + d.normal.x * 0.5, mid.y + d.normal.y * 0.5)));
    if (!zone) return no('door_zone');
    if ([d.from, d.to, mid].some((p) => distToPoly(p, zone.polygon) > 0.05)) return no('door_zone_edge');
    openings.push({
      id: d.id,
      type: d.type,
      a: d.room,
      b: zone.id,
      from: d.from,
      to: d.to,
      ...(d.type === 'door' ? { swing: { hinge: d.hinge, into: d.room } } : {}),
      state: d.state,
      material: d.material,
    });
  }
  if (plan.stair) {
    const lo = rooms.find((r) => r.id === plan.stair?.lower) as PRoom;
    const hi = rooms.find((r) => r.id === plan.stair?.upper) as PRoom;
    // The run follows the longer side; the foot is at the south or east end, the head at the other.
    const tall = lo.rect.y1 - lo.rect.y0 >= lo.rect.x1 - lo.rect.x0 - 0.01;
    const cx = (lo.rect.x0 + lo.rect.x1) / 2;
    const cy = (lo.rect.y0 + lo.rect.y1) / 2;
    const foot = tall ? vec(cx, lo.rect.y1 - 1) : vec(lo.rect.x1 - 1, cy);
    const head = tall ? vec(cx, lo.rect.y0 + 1) : vec(lo.rect.x0 + 1, cy);
    openings.push({ id: `st_${lo.id}_${hi.id}`, type: 'stair', a: lo.id, b: hi.id, from: foot, to: head, state: 'open', floor: 0 });
  }
  openings.push(...zoneSet.paths);
  const windows = placeWindows(rooms, runs, zoneSet, openings, policy, rng);
  openings.push(...windows);

  const objects: PlacedObject[] = [];
  const notes: MapNote[] = [];
  const entries = exteriorObjects(plan, lot, ext, zoneSet, openings, extDoors, objects, notes, rng);
  if (!entries) return no('entries');

  const overrides = [...interior.overrides];
  for (const side of plan.partyWalls) {
    const zone = zoneSet.zones.find((z) => zoneSet.classOf.get(z.id) === (side === 'w' ? 'neighbor_w' : 'neighbor_e'));
    if (!zone) continue;
    const mat = rng.weighted([['brick', 6], ['concrete', 4]] as const);
    for (const r of rooms) if (sharedSegments(r.poly, zone.polygon, 1).length > 0) overrides.push({ a: r.id, b: zone.id, material: mat });
  }

  tagRooms(rooms, openings, runs);
  const outRooms: Room[] = rooms.map((r) => ({ id: r.id, label: r.label, type: r.seed.type, floor: r.floor, polygon: r.poly, tags: r.tags }));
  const zones: ExteriorZone[] = zoneSet.zones;
  const loc: LocationDefinition = {
    id: familyId,
    familyId,
    version: GEN_VERSION,
    seed,
    name: spec.name(rng),
    setting: spec.setting,
    units: 'ft',
    bounds: { w: lot.w, h: lot.h },
    footprint: plan.footprint,
    floors: plan.floors,
    ...(plan.upperFootprint ? { upperFootprint: plan.upperFootprint } : {}),
    wallThickness: { exterior: 0.6, interior: 0.35 },
    materials: {
      exterior: rng.weighted(policy.extWall),
      interior: rng.weighted(policy.intWall),
      overrides,
      ...(plan.floors === 2 && policy.floorCeiling ? { floorCeiling: policy.floorCeiling } : {}),
    },
    rooms: outRooms,
    zones,
    openings,
    objects,
    notes,
    entries,
  };
  return tidy(loc);
}

/** Round coordinates to a millionth of a foot and fold -0 into 0, so equal buildings serialise equally. */
function tidy<T>(value: T): T {
  if (typeof value === 'number') return (Math.round(value * 1e6) / 1e6 + 0) as T;
  if (Array.isArray(value)) return value.map(tidy) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tidy(v)])) as T;
  return value;
}

/** Derived room tags: floor, orientation, circulation role, windowless, doors to the outside. Furniture tags come later (generate.ts). */
function tagRooms(rooms: PRoom[], openings: Opening[], runs: Run[]): void {
  const two = rooms.some((r) => r.floor === 1);
  for (const r of rooms) {
    const tags = new Set(r.tags);
    if (r.floor === 1) tags.add('upstairs');
    else if (two) tags.add('ground');
    const mine = runs.filter((q) => q.room === r.id);
    if (mine.length === 0) tags.add('interior');
    if (mine.some((q) => q.side === 's' || q.side === 'd')) tags.add('street_facing');
    if (mine.some((q) => q.side === 'n')) tags.add('rear_facing');
    const ops = openings.filter((o) => (o.a === r.id || o.b === r.id) && o.type !== 'window');
    const doors = ops.filter((o) => o.type !== 'stair');
    if (r.seed.cls === 'circ' && doors.length >= 3) tags.add('junction');
    if (!openings.some((o) => o.type === 'window' && o.a === r.id)) tags.add('windowless');
    if (ops.some((o) => o.type === 'doorway' && (rooms.some((q) => q.id === o.a) && rooms.some((q) => q.id === o.b)) && r.seed.cls !== 'circ')) tags.add('open');
    const w = Math.min(r.rect.x1 - r.rect.x0, r.rect.y1 - r.rect.y0);
    if (w <= 7 || r.seed.cls === 'circ') tags.add('narrow');
    if (openings.some((o) => o.a === r.id && o.id.startsWith('d_') && !rooms.some((q) => q.id === o.b) && o.type !== 'window')) tags.add('exterior_door');
    r.tags = [...tags];
  }
}

export type { Rect };
