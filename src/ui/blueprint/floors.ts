// Floor handling for the blueprint: which floor a space, opening, object or person belongs to, the
// per-floor view of a LocationDefinition (so walls, dimensions and furniture are computed unchanged),
// stair geometry, and the marker/person counts shown on the floor tabs. Pure; no React.
import type { BuiltLocation, MapOverlay, SquadTask, LocationDefinition, Opening, PlacedObject, Polygon, SpaceView, Vec } from '../../sim/types';
import { add, bboxOf, len, mid, perp, pointInPolygon, scale, sub, unit } from './geometry';

/** 1 or 2 (the contract caps a structure at 2 floors). A plan that only lists floor-1 rooms still counts as 2. */
export function floorCount(loc: LocationDefinition): 1 | 2 {
  const declared = loc.floors ?? 1;
  const listed = loc.rooms.some((r) => (r.floor ?? 0) >= 1) ? 2 : 1;
  return Math.max(declared, listed) >= 2 ? 2 : 1;
}

export const FLOOR_NAMES = ['GROUND', 'UPPER'] as const;
export const floorWord = (f: number): string => (f === 0 ? 'Ground floor' : 'Upper floor');

/** Floor of a room or zone id (zones and unknown ids are ground). */
export function spaceFloor(loc: LocationDefinition, id: string): number {
  const r = loc.rooms.find((x) => x.id === id);
  return r ? (r.floor ?? 0) : 0;
}

/** Floor an opening is drawn on. Stairs: the lower floor. */
export function openingFloor(loc: LocationDefinition, o: Opening): number {
  if (o.floor !== undefined) return o.floor;
  const fa = loc.rooms.find((r) => r.id === o.a);
  const fb = loc.rooms.find((r) => r.id === o.b);
  if (fa && fb) return Math.min(fa.floor ?? 0, fb.floor ?? 0);
  if (fa) return fa.floor ?? 0;
  if (fb) return fb.floor ?? 0;
  return 0;
}

/** Floor of a placed object: the floor of its room, or ground for exterior objects. */
export function objectFloor(loc: LocationDefinition, o: PlacedObject): number {
  return spaceFloor(loc, o.in);
}

export interface StairModel {
  id: string;
  /** The lower floor (the upper is lower + 1). */
  lower: number;
  /** Plan rectangle of the flight, corner order foot-left, foot-right, head-right, head-left. */
  poly: Polygon;
  /** Unit vector along the run, foot -> head. */
  axis: Vec;
  foot: Vec;
  head: Vec;
  width: number;
  length: number;
}

const STAIR_W = 3.2;
const STAIR_L = 9;

function rectAlong(center: Vec, axis: Vec, length: number, width: number): { poly: Polygon; foot: Vec; head: Vec } {
  const n = perp(axis);
  const foot = add(center, scale(axis, -length / 2));
  const head = add(center, scale(axis, length / 2));
  const hw = width / 2;
  return { poly: [add(foot, scale(n, hw)), add(foot, scale(n, -hw)), add(head, scale(n, -hw)), add(head, scale(n, hw))], foot, head };
}

/**
 * One model per `stair` opening. The flight rectangle is the stair room's plan (type 'stair') when a or b
 * names one; otherwise a 3.2 x 9 ft run centred on the opening and pointing into the room on side `a`.
 * `from` is the foot and `to` the head when they are a real run (over 3 ft apart); a short segment (a
 * doorway-like entry on the stair room's wall) only says which end of the room is the foot.
 */
export function stairModels(loc: LocationDefinition): StairModel[] {
  const out: StairModel[] = [];
  for (const o of loc.openings) {
    if (o.type !== 'stair') continue;
    const lower = openingFloor(loc, o);
    const span = len(sub(o.to, o.from));
    const rooms = [o.a, o.b].map((id) => loc.rooms.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
    const stairRoom = rooms.find((r) => r.type === 'stair' && (r.floor ?? 0) === lower) ?? rooms.find((r) => r.type === 'stair');
    let poly: Polygon;
    let foot: Vec;
    let head: Vec;
    let axis: Vec;
    let width: number;
    let length: number;
    if (stairRoom) {
      const bb = bboxOf(stairRoom.polygon);
      const alongX = bb.w > bb.h;
      length = alongX ? bb.w : bb.h;
      width = alongX ? bb.h : bb.w;
      const c = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
      let ax: Vec = alongX ? { x: 1, y: 0 } : { x: 0, y: 1 };
      const want = span > 3 ? sub(o.to, o.from) : sub(c, mid(o.from, o.to));
      if (ax.x * want.x + ax.y * want.y < 0) ax = scale(ax, -1);
      axis = ax;
      ({ poly, foot, head } = rectAlong(c, axis, length, width));
    } else if (span > 3) {
      axis = unit(sub(o.to, o.from));
      width = STAIR_W;
      length = span;
      ({ poly, foot, head } = rectAlong(mid(o.from, o.to), axis, length, width));
    } else {
      const m = mid(o.from, o.to);
      const wall = span > 0.1 ? unit(sub(o.to, o.from)) : { x: 1, y: 0 };
      let n = perp(wall);
      const into = rooms.find((r) => r.id === o.a)?.polygon;
      if (into && !pointInPolygon(add(m, scale(n, 1.2)), into)) n = scale(n, -1);
      axis = n;
      width = Math.max(STAIR_W, span);
      length = STAIR_L;
      ({ poly, foot, head } = rectAlong(add(m, scale(axis, length / 2 - 0.3)), axis, length, width));
    }
    out.push({ id: o.id, lower, poly, axis, foot, head, width, length });
  }
  return out;
}

export interface FloorView {
  floor: number;
  /** The location as this floor shows it: footprint, rooms, openings and objects of the floor only. */
  loc: LocationDefinition;
  /** Flights that serve this floor (as the lower or the upper end). */
  stairs: (StairModel & { dir: 'up' | 'down' })[];
  /** Other floor's stairwell outlines, drawn ghosted. */
  ghostStairs: Polygon[];
  /** Other floor's outline when it differs from this one (a smaller upper floor, or the ground floor seen from above). */
  ghostOutline: Polygon | null;
}

const sameOutline = (a: Polygon, b: Polygon): boolean => a.length === b.length && a.every((p, i) => Math.abs(p.x - b[i].x) < 0.05 && Math.abs(p.y - b[i].y) < 0.05);

/** Per-floor view. Floor 0 of a single-storey plan returns the location unchanged (same arrays). */
export function floorView(loc: LocationDefinition, floor: number): FloorView {
  if (floorCount(loc) === 1) return { floor: 0, loc, stairs: [], ghostStairs: [], ghostOutline: null };
  const footprint = floor === 0 ? loc.footprint : (loc.upperFootprint ?? loc.footprint);
  const otherFootprint = floor === 0 ? (loc.upperFootprint ?? loc.footprint) : loc.footprint;
  const rooms = loc.rooms.filter((r) => (r.floor ?? 0) === floor);
  const openings = loc.openings.filter((o) => o.type !== 'stair' && openingFloor(loc, o) === floor);
  const objects = loc.objects.filter((o) => objectFloor(loc, o) === floor);
  const view: LocationDefinition = { ...loc, footprint, rooms, openings, objects, notes: floor === 0 ? loc.notes : [] };
  const models = stairModels(loc);
  const stairs = models.filter((m) => m.lower === floor || m.lower + 1 === floor).map((m) => ({ ...m, dir: (m.lower === floor ? 'up' : 'down') as 'up' | 'down' }));
  const otherFloor = floor === 0 ? 1 : 0;
  const ghostStairs: Polygon[] = [];
  for (const m of models) {
    const other = loc.rooms.find((r) => r.type === 'stair' && (r.floor ?? 0) === otherFloor && pointInPolygon(mid(m.foot, m.head), r.polygon));
    ghostStairs.push(other ? other.polygon : m.poly);
  }
  const ghostOutline = sameOutline(footprint, otherFootprint) ? null : otherFootprint;
  return { floor, loc: view, stairs, ghostStairs, ghostOutline };
}

export interface FloorBadge {
  /** Unresolved markers on the floor. */
  markers: number;
  /** People the player knows about (reported or confirmed) on the floor. */
  people: number;
  count: number;
}

/**
 * What each floor holds that the player should not miss: spaces still carrying an amber/unknown/reported
 * marker, plus people reported or confirmed there. Resolved (mint) markers and checked-clear people do not count.
 */
export function floorBadges(loc: LocationDefinition, spaces: SpaceView[]): FloorBadge[] {
  const n = floorCount(loc);
  const out: FloorBadge[] = Array.from({ length: n }, () => ({ markers: 0, people: 0, count: 0 }));
  for (const s of spaces) {
    const f = Math.min(n - 1, spaceFloor(loc, s.id));
    if (s.marker && (s.marker.tone === 'amber' || s.status === 'unknown' || s.status === 'reported')) out[f].markers += 1;
    for (const p of s.people ?? []) {
      if (p.status !== 'reported' && p.status !== 'confirmed') continue;
      out[Math.min(n - 1, p.floor ?? f)].people += 1;
    }
  }
  for (const b of out) b.count = b.markers + b.people;
  return out;
}

/** Stable geometry for one floor. Keep this separate from frequently changing player knowledge. */
export function floorGeometry(built: BuiltLocation, floor: number) {
  const plan = floorView(built.location, floor);
  const active = plan.floor;
  const location = active === 0 ? plan.loc : { ...plan.loc, zones: [], entries: [] };
  return {
    plan,
    built: { ...built, location, derived: { ...built.derived, stagingPoints: built.derived.stagingPoints.filter((p) => (p.floor ?? spaceFloor(built.location, p.spaceId)) === active) } },
  };
}

/** Everything drawn or targetable belongs to the active floor, including knowledge and action overlays. */
export function floorKnowledge(loc: LocationDefinition, spaces: SpaceView[], squadTasks: SquadTask[], overlays: MapOverlay[], floor: number) {
  const onFloor = (id: string) => spaceFloor(loc, id) === floor;
  return {
    spaces: spaces.filter((s) => onFloor(s.id)).map((s) => ({ ...s, people: s.people.filter((p) => (p.floor ?? spaceFloor(loc, s.id)) === floor) })),
    squadTasks: squadTasks.filter((t) => onFloor(t.positionId)),
    overlays: overlays.filter((o) => (o.floor ?? 0) === floor),
  };
}

export function floorScene(built: BuiltLocation, spaces: SpaceView[], squadTasks: SquadTask[], overlays: MapOverlay[], floor: number) {
  const geometry = floorGeometry(built, floor);
  return { ...geometry, ...floorKnowledge(built.location, spaces, squadTasks, overlays, geometry.plan.floor) };
}
