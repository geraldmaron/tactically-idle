import type {
  BuiltLocation,
  DerivedLocation,
  DerivedRoom,
  GraphEdge,
  Id,
  LocationDefinition,
  LocationFamily,
  Opening,
  Polygon,
  StagingPoint,
  Vec,
} from './types';
import { MAPLE_STREET } from '../content/locations/maple-street';
import { STAIR_MINUTES } from '../content/materials';
import { applyVariations } from './location-variation';
import { validateLocation } from './location-validate';
import { generateBuilding, isGeneratedFamily } from '../gen/building';

/** Abstract location tuning. Game abstractions, not real-world movement rates. */
export const LOCATION_TUNING = {
  /** Feet of cautious movement per operation minute. */
  feetPerMinute: 20,
  /** Fixed minutes to pass any opening. */
  openingMinutes: 0.5,
  /** Extra minutes to pass a locked opening. */
  lockedMinutes: 3,
  /** Usable square feet per useful participant. */
  sqftPerParticipant: 40,
  maxRoomCapacity: 6,
  maxZoneCapacity: 12,
};

export const LOCATION_FAMILIES: Record<Id, LocationFamily> = {
  [MAPLE_STREET.id]: MAPLE_STREET,
};

export function polygonArea(p: Polygon): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function polygonCentroid(p: Polygon): Vec {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < p.length; i++) {
    const p0 = p[i];
    const p1 = p[(i + 1) % p.length];
    const f = p0.x * p1.y - p1.x * p0.y;
    a += f;
    cx += (p0.x + p1.x) * f;
    cy += (p0.y + p1.y) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = p.length || 1;
    return { x: p.reduce((s, q) => s + q.x, 0) / n, y: p.reduce((s, q) => s + q.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function polygonBBox(p: Polygon) {
  const xs = p.map((q) => q.x);
  const ys = p.map((q) => q.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Ray-casting point-in-polygon. Points exactly on an edge may fall either way. */
export function pointInPolygon(p: Vec, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Overlap area of two polygons in plan, sampled on a grid of cell centres (exact for
 * grid-aligned shapes, close for others). Used for stair alignment and floor/ceiling checks.
 */
export function polygonOverlapArea(a: Polygon, b: Polygon, step = 0.25): number {
  const ba = polygonBBox(a);
  const bb = polygonBBox(b);
  const x0 = Math.max(ba.x, bb.x);
  const y0 = Math.max(ba.y, bb.y);
  const x1 = Math.min(ba.x + ba.w, bb.x + bb.w);
  const y1 = Math.min(ba.y + ba.h, bb.y + bb.h);
  if (x1 <= x0 || y1 <= y0) return 0;
  let cells = 0;
  for (let x = x0 + step / 2; x < x1; x += step)
    for (let y = y0 + step / 2; y < y1; y += step) {
      const p = { x, y };
      if (pointInPolygon(p, a) && pointInPolygon(p, b)) cells++;
    }
  return cells * step * step;
}

/** Number of floors: `floors` when set, else the highest room floor + 1 (at least 1). */
export function floorCount(loc: LocationDefinition): number {
  if (loc.floors !== undefined) return loc.floors;
  return loc.rooms.reduce((m, r) => Math.max(m, (r.floor ?? 0) + 1), 1);
}

/** Exterior outline of a floor (0 = footprint, 1 = upperFootprint), if it has one. */
export function footprintOf(loc: LocationDefinition, floor: number): Polygon | undefined {
  return floor === 0 ? loc.footprint : floor === 1 ? loc.upperFootprint : undefined;
}

/** Floor of every room and zone by id (zones are always floor 0). */
export function floorMap(loc: LocationDefinition): Map<Id, number> {
  const m = new Map<Id, number>();
  for (const z of loc.zones) m.set(z.id, 0);
  for (const r of loc.rooms) m.set(r.id, r.floor ?? 0);
  return m;
}

/**
 * Floor an opening sits on: `o.floor` when given, else the floor of its room (space `a`
 * when that is a room, otherwise `b`; zone-to-zone paths are floor 0). A stair's floor is
 * its lower floor.
 */
export function openingFloor(o: Opening, floors: Map<Id, number>, roomIds: Set<Id>): number {
  if (o.floor !== undefined) return o.floor;
  if (roomIds.has(o.a)) return floors.get(o.a) ?? 0;
  if (roomIds.has(o.b)) return floors.get(o.b) ?? 0;
  return 0;
}

export interface StairEnds {
  /** Room on the lower floor, and the point where the stair starts (the foot). */
  low: { room: Id; floor: number; at: Vec };
  /** Room on the upper floor, and the point where the stair ends (the head). */
  high: { room: Id; floor: number; at: Vec };
}

/**
 * Stair convention: `from` is a point inside room `a`, `to` a point inside room `b`
 * (canonically a = ground stair room, from = foot; b = upper stair room, to = head).
 * Either order of a/b is understood; the lower floor's end is the foot. Returns null
 * when the opening does not join rooms on two different floors.
 */
export function stairEnds(o: Opening, floors: Map<Id, number>): StairEnds | null {
  const fa = floors.get(o.a);
  const fb = floors.get(o.b);
  if (o.type !== 'stair' || fa === undefined || fb === undefined || fa === fb) return null;
  const A = { room: o.a, floor: fa, at: o.from };
  const B = { room: o.b, floor: fb, at: o.to };
  return fa < fb ? { low: A, high: B } : { low: B, high: A };
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Distance a staging point sits from its opening, along the wall normal. */
export const STAGING_OFFSET_FT = 1.5;
/** Fallback offsets tried (largest first) when a space is too narrow for the full offset. */
const STAGING_FALLBACKS = [STAGING_OFFSET_FT, 1, 0.75, 0.5];

function placeInside(m: Vec, n: Vec, poly: Polygon): Vec {
  for (const d of STAGING_FALLBACKS)
    for (const sign of [1, -1]) {
      const p = { x: m.x + n.x * sign * d, y: m.y + n.y * sign * d };
      if (pointInPolygon(p, poly)) return p;
    }
  // No inside point found; aim for the space's centroid side so the validator can warn.
  const c = polygonCentroid(poly);
  const sign = (c.x - m.x) * n.x + (c.y - m.y) * n.y >= 0 ? 1 : -1;
  return { x: m.x + n.x * sign * STAGING_OFFSET_FT, y: m.y + n.y * sign * STAGING_OFFSET_FT };
}

const stagingKind = (o: Opening): StagingPoint['kind'] =>
  o.type === 'window' ? 'window' : o.type === 'doorway' ? 'doorway' : o.type === 'stair' ? 'stair' : 'door';

/**
 * One staging point on each side of every door, doorway (room-to-room or
 * room-to-zone) and window, ~1.5 ft out from the opening midpoint along the wall
 * normal. Zone-to-zone paths get none. A stair gets one point at its foot (in the lower
 * room) and one at its head (in the upper room), exactly at the opening's `from` / `to`.
 * Every point carries the floor of the space it stands in (exterior zones are floor 0).
 */
export function deriveStagingPoints(loc: LocationDefinition): StagingPoint[] {
  const polys = new Map<Id, Polygon>();
  for (const r of loc.rooms) polys.set(r.id, r.polygon);
  const zoneIds = new Set(loc.zones.map((z) => z.id));
  for (const z of loc.zones) polys.set(z.id, z.polygon);
  const floors = floorMap(loc);
  const out: StagingPoint[] = [];
  for (const o of loc.openings) {
    if (o.type === 'stair') {
      if (!polys.has(o.a) || !polys.has(o.b)) continue;
      out.push(
        { id: `sp_${o.id}_${o.a}`, spaceId: o.a, facesId: o.b, openingId: o.id, kind: 'stair', at: { ...o.from }, floor: floors.get(o.a) ?? 0 },
        { id: `sp_${o.id}_${o.b}`, spaceId: o.b, facesId: o.a, openingId: o.id, kind: 'stair', at: { ...o.to }, floor: floors.get(o.b) ?? 0 },
      );
      continue;
    }
    if (o.type === 'doorway' && zoneIds.has(o.a) && zoneIds.has(o.b)) continue;
    const A = polys.get(o.a);
    const B = polys.get(o.b);
    if (!A || !B) continue;
    const len = dist(o.from, o.to);
    if (len < 1e-9) continue;
    const m = mid(o.from, o.to);
    const n = { x: -(o.to.y - o.from.y) / len, y: (o.to.x - o.from.x) / len };
    for (const [spaceId, facesId, poly] of [
      [o.a, o.b, A],
      [o.b, o.a, B],
    ] as const)
      out.push({ id: `sp_${o.id}_${spaceId}`, spaceId, facesId, openingId: o.id, kind: stagingKind(o), at: placeInside(m, n, poly), floor: floors.get(spaceId) ?? 0 });
  }
  return out;
}

/**
 * Compute areas, capacities and the traversal graph from the location record. Rooms carry
 * their floor (zones are 0). A stair joins its two stair rooms with cost STAIR_MINUTES plus
 * the walk from the lower room's centre to the foot and from the head to the upper room's
 * centre, so distances between floors include the climb.
 */
export function deriveLocation(loc: LocationDefinition): DerivedLocation {
  const T = LOCATION_TUNING;
  const spaces: Record<Id, DerivedRoom> = {};
  const all = [
    ...loc.rooms.map((r) => ({ id: r.id, polygon: r.polygon, zone: false, floor: r.floor ?? 0 })),
    ...loc.zones.map((z) => ({ id: z.id, polygon: z.polygon, zone: true, floor: 0 })),
  ];
  for (const s of all) {
    const area = polygonArea(s.polygon);
    const blocked = loc.objects
      .filter((o) => o.in === s.id && o.mechanical && o.tags.includes('blocks_space'))
      .reduce((sum, o) => sum + o.w * o.h, 0);
    const usableArea = Math.max(0, area - blocked);
    const cap = Math.floor(usableArea / T.sqftPerParticipant);
    spaces[s.id] = {
      id: s.id,
      area,
      usableArea,
      capacity: Math.max(1, Math.min(s.zone ? T.maxZoneCapacity : T.maxRoomCapacity, cap)),
      centroid: polygonCentroid(s.polygon),
      bbox: polygonBBox(s.polygon),
      floor: s.floor,
    };
  }

  const floors = floorMap(loc);
  const adjacency: Record<Id, GraphEdge[]> = {};
  for (const id of Object.keys(spaces)) adjacency[id] = [];
  for (const o of loc.openings) {
    if (o.type === 'window' || o.state === 'blocked') continue;
    const A = spaces[o.a];
    const B = spaces[o.b];
    if (!A || !B) continue;
    let cost: number;
    if (o.type === 'stair') {
      // Walk to the foot, climb, walk from the head to the other room's centre.
      const ends = stairEnds(o, floors);
      if (!ends) continue;
      cost = STAIR_MINUTES + (dist(spaces[ends.low.room].centroid, ends.low.at) + dist(ends.high.at, spaces[ends.high.room].centroid)) / T.feetPerMinute;
    } else {
      const m = mid(o.from, o.to);
      cost = T.openingMinutes + (dist(A.centroid, m) + dist(m, B.centroid)) / T.feetPerMinute;
    }
    if (o.state === 'locked') cost += T.lockedMinutes;
    cost = Math.round(cost * 100) / 100;
    adjacency[o.a].push({ to: o.b, openingId: o.id, cost });
    adjacency[o.b].push({ to: o.a, openingId: o.id, cost });
  }

  const ids = Object.keys(spaces);
  const distance: Record<Id, Record<Id, number>> = {};
  for (const i of ids) {
    distance[i] = {};
    for (const j of ids) distance[i][j] = i === j ? 0 : Infinity;
    for (const e of adjacency[i]) distance[i][e.to] = Math.min(distance[i][e.to], e.cost);
  }
  for (const k of ids)
    for (const i of ids)
      for (const j of ids) {
        const via = distance[i][k] + distance[k][j];
        if (via < distance[i][j]) distance[i][j] = via;
      }
  for (const i of ids) for (const j of ids) if (Number.isFinite(distance[i][j])) distance[i][j] = Math.round(distance[i][j] * 100) / 100;

  return { locationId: loc.id, stagingPoints: deriveStagingPoints(loc), spaces, adjacency, distance };
}

/**
 * Build a playable location: apply seeded variations to the family's base layout,
 * derive metrics, and validate. Identical (family, seed, version) always yields an
 * identical result. Callers must refuse to start a run when issues contain errors.
 */
export function buildLocation(familyId: Id, seed: number): BuiltLocation {
  if (!LOCATION_FAMILIES[familyId] && isGeneratedFamily(familyId)) {
    const location = generateBuilding(familyId, seed);
    const derived = deriveLocation(location);
    return { location, derived, issues: validateLocation(location, derived) };
  }
  const family = LOCATION_FAMILIES[familyId];
  if (!family) throw new Error(`Unknown location family ${familyId}`);
  const location = applyVariations(family, seed);
  const derived = deriveLocation(location);
  const issues = validateLocation(location, derived);
  return { location, derived, issues };
}
