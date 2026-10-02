// Spatial signal model: how sound, heat, radio and sight travel through a built
// location. Game abstractions, not physics.
//
// Attenuation: a straight segment from -> to is cut at every room/zone polygon
// edge (wall centerlines) it crosses. Crossings that coincide (two polygons
// sharing one wall, or a vertex hit) merge into one, and the spaces on either side
// are found by sampling the middle of each sub-interval, so a physical wall is
// counted once and a graze that stays in one space counts nothing. Each wall is
// either an opening (when the crossing lies on one that joins the two spaces) or
// plain wall material. Layers multiply. Objects tagged blocks_sight/concealment
// multiply visual and thermal by OBJECT_BLOCK when the segment crosses their
// footprint. Finally open air applies a LINEAR falloff max(0, 1 - k*d), k from
// AIR_FALLOFF_PER_FT. Linear (not exp) gives each channel a hard range, which the
// UI can state; the lot is under 100 ft so the clamp rarely matters.
//
// Floors. Each floor has its own geometry: floor 0 is the ground rooms plus the exterior
// zones, floor 1 is the upper rooms (outside the upper outline is open air, so a floor-1
// wall with nothing behind it counts as an exterior wall or window). Same-floor signals
// use only that floor's geometry. Signals between floors take the best of: through the
// floor/ceiling slab (walls on each floor, slab crossed once, at the source, the target or
// the midpoint in plan), straight through the outside wall when one end is outdoors, and
// down or up each stair (walk to the stair end, open air along the stair, walk on).
//
// Geometry is cached per BuiltLocation (WeakMap). Opening state, material and
// covering are read live on every call, so mutating those is safe; mutating
// polygons or objects of a built location in place is not (build a new one).
import type { BuiltLocation, Glazing, Id, Opening, OpeningType, PlacedObject, Polygon, StagingPoint, Vec, WallMaterial } from './types';
import { COVERINGS, DOORS, FLOORS, GLAZING, OPEN_AIR, AIR_FALLOFF_PER_FT, WALLS } from '../content/materials';
import { floorMap, pointInPolygon, polygonOverlapArea, stairEnds } from './location';

export type Channel = 'sound' | 'thermal' | 'radio' | 'visual';

export interface Blocker {
  kind: 'wall' | 'opening' | 'object' | 'floor';
  /** Opening/object id, or null for a plain wall. */
  id: Id | null;
  /** Player-language label, e.g. 'Brick wall', 'Hollow-core door (closed)', 'Wardrobe'. */
  label: string;
  /** 0..1 multiplier this layer applied. */
  transmission: number;
}

export interface SignalResult {
  /** Product of all layers and air falloff, 0..1. */
  transmission: number;
  /** Straight-line distance in feet. */
  distance: number;
  blockers: Blocker[];
  /** True when nothing reduced the signal below 0.9. */
  clear: boolean;
}

/** Multiplier a sight-blocking object applies to visual and thermal. */
export const OBJECT_BLOCK = 0.1;
/** Tags that make an object block sight and heat. */
export const SIGHT_BLOCK_TAGS = ['blocks_sight', 'concealment'];

/** Abstract height of one storey, feet; adds to the path length between floors. */
export const STOREY_HEIGHT_FT = 9;

const EPS_END = 1e-4;
const EPS_MERGE = 1e-3;
const OPENING_TOL = 0.1;
const CLEAR_AT = 0.9;

// ---------------------------------------------------------------- prepared geometry

interface PreparedSpace {
  id: Id;
  polygon: Polygon;
  isRoom: boolean;
  label: string;
}
interface PreparedObject {
  object: PlacedObject;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface FloorGeom {
  spaces: PreparedSpace[];
  edges: [Vec, Vec][];
  blockers: PreparedObject[];
}
interface Prepared {
  rooms: unknown;
  zones: unknown;
  objects: unknown;
  spaces: PreparedSpace[];
  byId: Map<Id, PreparedSpace>;
  /** Floor of every room and zone (zones 0). */
  floorOf: Map<Id, number>;
  floors: Map<number, FloorGeom>;
}

const cache = new WeakMap<BuiltLocation, Prepared>();
const EMPTY_FLOOR: FloorGeom = { spaces: [], edges: [], blockers: [] };

function prepare(built: BuiltLocation): Prepared {
  const loc = built.location;
  const hit = cache.get(built);
  if (hit && hit.rooms === loc.rooms && hit.zones === loc.zones && hit.objects === loc.objects) return hit;
  const floorOf = floorMap(loc);
  const spaces: PreparedSpace[] = [
    ...loc.rooms.map((r) => ({ id: r.id, polygon: r.polygon, isRoom: true, label: r.label })),
    ...loc.zones.map((z) => ({ id: z.id, polygon: z.polygon, isRoom: false, label: z.label })),
  ];
  const floors = new Map<number, FloorGeom>();
  for (const f of new Set([0, ...floorOf.values()])) {
    const here = spaces.filter((s) => (floorOf.get(s.id) ?? 0) === f);
    const edges: [Vec, Vec][] = [];
    for (const s of here) for (let i = 0; i < s.polygon.length; i++) edges.push([s.polygon[i], s.polygon[(i + 1) % s.polygon.length]]);
    const blockers: PreparedObject[] = loc.objects
      .filter((o) => (floorOf.get(o.in) ?? 0) === f && o.tags.some((t) => SIGHT_BLOCK_TAGS.includes(t)))
      .map((o) => {
        const swap = o.rotation === 90 || o.rotation === 270;
        const w = swap ? o.h : o.w;
        const h = swap ? o.w : o.h;
        const cx = o.x + o.w / 2;
        const cy = o.y + o.h / 2;
        return { object: o, x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
      });
    floors.set(f, { spaces: here, edges, blockers });
  }
  const prepared: Prepared = {
    rooms: loc.rooms,
    zones: loc.zones,
    objects: loc.objects,
    spaces,
    byId: new Map(spaces.map((s) => [s.id, s])),
    floorOf,
    floors,
  };
  cache.set(built, prepared);
  return prepared;
}

const floorGeom = (prep: Prepared, floor: number): FloorGeom => prep.floors.get(floor) ?? EMPTY_FLOOR;

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Parameter t along p0->p1 where it crosses q0->q1, or null (parallel or no crossing). */
function crossT(p0: Vec, p1: Vec, q0: Vec, q1: Vec): number | null {
  const rx = p1.x - p0.x;
  const ry = p1.y - p0.y;
  const sx = q1.x - q0.x;
  const sy = q1.y - q0.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const qx = q0.x - p0.x;
  const qy = q0.y - p0.y;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * ry - qy * rx) / denom;
  const e = 1e-9;
  return t >= -e && t <= 1 + e && u >= -e && u <= 1 + e ? t : null;
}

/** Length fraction range [tIn, tOut] of the segment inside a rectangle, or null (slab method). */
function clipRect(a: Vec, b: Vec, r: PreparedObject): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  for (const [p, d, lo, hi] of [
    [a.x, b.x - a.x, r.x0, r.x1],
    [a.y, b.y - a.y, r.y0, r.y1],
  ] as const) {
    if (Math.abs(d) < 1e-12) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

const titleCase = (s: string) => {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const glazingAdj: Record<Glazing, string> = { single: 'single-glazed', double: 'double-glazed', security: 'security-glazed' };

// ---------------------------------------------------------------- spaces

/**
 * Space (room or zone) containing a point on a floor (default 0), or null. Floor 0 holds the
 * ground rooms and the exterior zones; floor 1 holds only the upper rooms.
 */
export function spaceAt(built: BuiltLocation, p: Vec, floor = 0): Id | null {
  for (const s of floorGeom(prepare(built), floor).spaces) if (pointInPolygon(p, s.polygon)) return s.id;
  return null;
}

/** Floor a room or zone is on (zones and unknown ids are 0). */
export function spaceFloor(built: BuiltLocation, spaceId: Id): number {
  return prepare(built).floorOf.get(spaceId) ?? 0;
}

/** Material of the wall shared by two spaces (overrides, then interior/exterior default). */
export function wallMaterialBetween(built: BuiltLocation, a: Id, b: Id): WallMaterial {
  const m = built.location.materials;
  const o = m.overrides.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (o) return o.material;
  const roomIds = new Set(built.location.rooms.map((r) => r.id));
  return roomIds.has(a) && roomIds.has(b) ? m.interior : m.exterior;
}

// ---------------------------------------------------------------- layers

interface Layer {
  t: number;
  label: string;
}

/** Transmission of an opening for one channel, or null when it acts as plain wall (blocked). */
function openingLayer(o: Opening, channel: Channel): Layer | null {
  if (o.state === 'blocked') return null;
  if (o.type === 'doorway' || o.state === 'open') return { t: OPEN_AIR[channel], label: '' };
  const cover = o.covering ?? 'none';
  const coverLabel = cover === 'blinds' ? ', blinds drawn' : cover === 'curtains' ? ', curtains drawn' : '';
  const state = o.state === 'locked' ? 'locked' : 'closed';
  if (o.type === 'window' || (o.type === 'sliding' && o.glazing)) {
    const g = o.glazing ?? 'double';
    const t = GLAZING[g][channel] * (channel === 'visual' ? COVERINGS[cover].visual : 1);
    const noun = o.type === 'window' ? 'window' : 'sliding door';
    return { t, label: `${titleCase(glazingAdj[g])} ${noun}${coverLabel}` };
  }
  const door = DOORS[o.material ?? 'hollow_core'];
  return { t: door[channel], label: `${door.label} (${state})` };
}

interface Trace {
  /** Product of wall/opening/object layers (no air falloff). */
  layers: number;
  blockers: Blocker[];
  distance: number;
}

function trace(built: BuiltLocation, from: Vec, to: Vec, channel: Channel): Trace {
  const prep = prepare(built);
  const len = dist(from, to);
  const blockers: { at: number; b: Blocker }[] = [];
  let layers = 1;
  if (len < 1e-9) return { layers, blockers: [], distance: 0 };

  // Distinct wall crossings along the segment.
  const raw: number[] = [];
  for (const [q0, q1] of prep.edges) {
    const t = crossT(from, to, q0, q1);
    if (t === null || t * len < EPS_END || (1 - t) * len < EPS_END) continue;
    raw.push(t);
  }
  raw.sort((a, b) => a - b);
  const ts: number[] = [];
  for (const t of raw) if (ts.length === 0 || (t - ts[ts.length - 1]) * len > EPS_MERGE) ts.push(t);

  if (ts.length > 0) {
    const bounds = [0, ...ts, 1];
    const spaceIds = bounds.slice(0, -1).map((t0, i) => spaceAt(built, lerp(from, to, (t0 + bounds[i + 1]) / 2)));
    for (let j = 0; j < ts.length; j++) {
      const sa = spaceIds[j];
      const sb = spaceIds[j + 1];
      if (!sa || !sb || sa === sb) continue;
      if (!prep.byId.get(sa)?.isRoom && !prep.byId.get(sb)?.isRoom) continue; // zone to zone: open ground
      const p = lerp(from, to, ts[j]);
      const opening = built.location.openings.find(
        (o) => ((o.a === sa && o.b === sb) || (o.a === sb && o.b === sa)) && distToSegment(p, o.from, o.to) <= OPENING_TOL,
      );
      const layer = opening ? openingLayer(opening, channel) : null;
      if (opening && layer) {
        layers *= layer.t;
        if (layer.t < 0.999) blockers.push({ at: ts[j], b: { kind: 'opening', id: opening.id, label: layer.label, transmission: layer.t } });
      } else {
        const m = wallMaterialBetween(built, sa, sb);
        const t = WALLS[m][channel];
        layers *= t;
        blockers.push({ at: ts[j], b: { kind: 'wall', id: null, label: `${WALLS[m].label} wall`, transmission: t } });
      }
    }
  }

  if (channel === 'visual' || channel === 'thermal') {
    for (const o of prep.blockers) {
      const hit = clipRect(from, to, o);
      if (!hit || (hit[1] - hit[0]) * len < EPS_MERGE) continue;
      layers *= OBJECT_BLOCK;
      blockers.push({ at: hit[0], b: { kind: 'object', id: o.object.id, label: titleCase(o.object.type), transmission: OBJECT_BLOCK } });
    }
  }

  blockers.sort((a, b) => a.at - b.at);
  return { layers, blockers: blockers.map((x) => x.b), distance: len };
}

const falloff = (channel: Channel, d: number) => Math.max(0, 1 - AIR_FALLOFF_PER_FT[channel] * d);

function result(transmission: number, distance: number, blockers: Blocker[]): SignalResult {
  return { transmission, distance, blockers, clear: transmission >= CLEAR_AT };
}

/** Signal along the straight segment from → to, crossing walls, openings (by state/material) and blocking objects. */
export function signalBetween(built: BuiltLocation, from: Vec, to: Vec, channel: Channel): SignalResult {
  const t = trace(built, from, to, channel);
  return result(t.layers * falloff(channel, t.distance), t.distance, t.blockers);
}

/**
 * Best of the straight line and, for sound and visual, two-leg routes through each
 * opening of the target's space (from → opening midpoint → to). `distance` stays
 * the straight-line distance; `via` names the opening when a route beats it.
 */
export function bestSignal(built: BuiltLocation, from: Vec, to: Vec, channel: Channel): SignalResult & { via: Id | null } {
  const straight = signalBetween(built, from, to, channel);
  if (channel !== 'sound' && channel !== 'visual') return { ...straight, via: null };
  const target = spaceAt(built, to);
  if (!target || spaceAt(built, from) === target) return { ...straight, via: null };

  let best: (SignalResult & { via: Id | null }) | null = null;
  let bestT = straight.transmission;
  for (const o of built.location.openings) {
    if (o.a !== target && o.b !== target) continue;
    const layer = openingLayer(o, channel);
    if (!layer) continue;
    const m = midpoint(o.from, o.to);
    const l1 = trace(built, from, m, channel);
    const l2 = trace(built, m, to, channel);
    const total = l1.layers * layer.t * l2.layers * falloff(channel, l1.distance + l2.distance);
    if (total > bestT + 1e-12) {
      bestT = total;
      const own: Blocker[] = layer.t < 0.999 ? [{ kind: 'opening', id: o.id, label: layer.label, transmission: layer.t }] : [];
      best = { ...result(total, straight.distance, [...l1.blockers, ...own, ...l2.blockers]), via: o.id };
    }
  }
  return best ?? { ...straight, via: null };
}

/** Nearest opening of a space to a point (optionally filtered by type), with distance in feet to its midpoint. */
export function nearestOpening(
  built: BuiltLocation,
  spaceId: Id,
  p: Vec,
  types?: OpeningType[],
): { opening: Opening; distance: number } | null {
  let best: { opening: Opening; distance: number } | null = null;
  for (const o of built.location.openings) {
    if (o.a !== spaceId && o.b !== spaceId) continue;
    if (types && !types.includes(o.type)) continue;
    const d = dist(p, midpoint(o.from, o.to));
    if (!best || d < best.distance) best = { opening: o, distance: d };
  }
  return best;
}

export function stagingPointById(built: BuiltLocation, id: Id): StagingPoint | undefined {
  return built.derived.stagingPoints.find((s) => s.id === id);
}

/** Staging points in a given space (e.g. all window/door points available from 'side_yard_e'). */
export function stagingPointsIn(built: BuiltLocation, spaceId: Id): StagingPoint[] {
  return built.derived.stagingPoints.filter((s) => s.spaceId === spaceId);
}

// ---------------------------------------------------------------- description

/** Spaces sharing a wall with `spaceId`, in the order first met walking its outline. */
function neighbours(built: BuiltLocation, spaceId: Id): Id[] {
  const s = prepare(built).byId.get(spaceId);
  if (!s) return [];
  const found: Id[] = [];
  for (let i = 0; i < s.polygon.length; i++) {
    const a = s.polygon[i];
    const b = s.polygon[(i + 1) % s.polygon.length];
    const len = dist(a, b);
    if (len < 1e-9) continue;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const n = Math.max(1, Math.ceil(len / 0.5));
    for (let k = 0; k < n; k++) {
      const c = lerp(a, b, (k + 0.5) / n);
      for (const sign of [1, -1]) {
        const q = { x: c.x + nx * sign * 0.2, y: c.y + ny * sign * 0.2 };
        const id = spaceAt(built, q);
        if (id && id !== spaceId && !found.includes(id)) found.push(id);
      }
    }
  }
  return found;
}

/** Player-language description of a space's construction: walls, doors, windows and coverings. */
export function describeConstruction(built: BuiltLocation, spaceId: Id): string[] {
  const prep = prepare(built);
  const space = prep.byId.get(spaceId);
  if (!space) return [];
  const lines: string[] = [];
  const m = built.location.materials;
  const other = (o: Opening) => prep.byId.get(o.a === spaceId ? o.b : o.a);
  const lower = (s: string) => s.toLowerCase();

  if (space.isRoom) {
    const ns = neighbours(built, spaceId).map((id) => prep.byId.get(id)).filter((x): x is PreparedSpace => Boolean(x));
    if (ns.some((n) => !n.isRoom)) lines.push(`${WALLS[m.exterior].label} exterior walls`);
    const rooms = ns.filter((n) => n.isRoom);
    const special = rooms.filter((n) => wallMaterialBetween(built, spaceId, n.id) !== m.interior);
    if (rooms.length > special.length) lines.push(`${WALLS[m.interior].label} interior walls`);
    for (const n of special) lines.push(`${WALLS[wallMaterialBetween(built, spaceId, n.id)].label} wall to the ${lower(n.label)}`);
  }

  const mine = built.location.openings.filter((o) => o.a === spaceId || o.b === spaceId);
  for (const o of mine) {
    const to = other(o);
    if (!to) continue;
    if (o.type === 'doorway') {
      if (space.isRoom || to.isRoom) lines.push(`${o.state === 'blocked' ? 'Blocked' : 'Open'} doorway to the ${lower(to.label)}`);
    } else if (o.type === 'door') {
      const state = o.state === 'closed' ? '' : ` (${o.state})`;
      lines.push(`${DOORS[o.material ?? 'hollow_core'].label} to the ${lower(to.label)}${state}`);
    } else if (o.type === 'sliding') {
      lines.push(`${titleCase(glazingAdj[o.glazing ?? 'double'])} sliding door to the ${lower(to.label)}`);
    }
  }

  const windows = mine.filter((o) => o.type === 'window');
  for (const g of ['single', 'double', 'security'] as Glazing[]) {
    const ws = windows.filter((w) => (w.glazing ?? 'double') === g);
    if (ws.length === 0) continue;
    const blinds = ws.filter((w) => w.covering === 'blinds').length;
    const curtains = ws.filter((w) => w.covering === 'curtains').length;
    const parts = [blinds ? `${blinds} with blinds` : '', curtains ? `${curtains} curtained` : ''].filter(Boolean);
    lines.push(`${ws.length} ${glazingAdj[g]} window${ws.length === 1 ? '' : 's'}${parts.length ? ` (${parts.join(', ')})` : ''}`);
  }
  return lines;
}
