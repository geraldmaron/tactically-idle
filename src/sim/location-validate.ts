import type {
  BuiltLocation,
  DerivedLocation,
  Id,
  LocationDefinition,
  Opening,
  PlacedObject,
  Polygon,
  ValidationIssue,
  Vec,
} from './types';
import { floorMap, polygonArea, polygonBBox, polygonOverlapArea } from './location';

// Structural checks that make a layout playable. Geometry here is sampled on a
// 0.25 ft grid rather than clipped exactly, so it stays correct for any polygon
// shape, not only the rectilinear rooms the first families use.

const STEP = 0.25;
/** Distance within which a point counts as lying on a wall or edge. */
const TOL = 0.05;
const MIN_DOOR_WIDTH = 2;
/** Least plan overlap (sq ft) between the two rooms of a stair for the stairwell to count as aligned. */
const MIN_STAIR_OVERLAP = 4;
const MAX_FLOORS = 2;

type Pt = Vec;

// ---------------------------------------------------------------- geometry

function pointInPolygon(p: Pt, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToBoundary(p: Pt, poly: Polygon): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return best;
}

const insideOrOn = (p: Pt, poly: Polygon) => pointInPolygon(p, poly) || distToBoundary(p, poly) <= TOL;

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Pt, b: Pt, p: Pt): boolean {
  return Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);
}

function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  return (
    (o1 === 0 && onSegment(a, b, c)) ||
    (o2 === 0 && onSegment(a, b, d)) ||
    (o3 === 0 && onSegment(c, d, a)) ||
    (o4 === 0 && onSegment(c, d, b))
  );
}

/** Any two non-adjacent edges touching or crossing. */
function selfIntersects(poly: Polygon): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
    }
  return false;
}

/** Cell centres of a rectangle, for area-style sampling. */
function* cellCentres(x0: number, y0: number, x1: number, y1: number): Generator<Pt> {
  for (let x = x0 + STEP / 2; x < x1; x += STEP) for (let y = y0 + STEP / 2; y < y1; y += STEP) yield { x, y };
}

/** Points covering a rectangle including its edges and corners. */
function* rectPoints(x0: number, y0: number, x1: number, y1: number): Generator<Pt> {
  const xs = steps(x0, x1);
  const ys = steps(y0, y1);
  for (const x of xs) for (const y of ys) yield { x, y };
}

function steps(a: number, b: number): number[] {
  const out: number[] = [];
  for (let v = a; v < b; v += STEP) out.push(v);
  out.push(b);
  return out;
}

/** Axis-aligned bounds of an object's footprint after rotation about its centre. */
function objectRect(o: PlacedObject): { x0: number; y0: number; x1: number; y1: number } {
  const swap = o.rotation === 90 || o.rotation === 270;
  const w = swap ? o.h : o.w;
  const h = swap ? o.w : o.h;
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

const segLength = (o: Opening) => Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);

function pointsAlong(a: Pt, b: Pt): Pt[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / STEP));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
}

/** Two outlines share a wall when at least one foot of A's boundary lies on B's boundary. */
function sharesWall(a: Polygon, b: Polygon): boolean {
  let n = 0;
  for (let i = 0; i < a.length; i++)
    for (const p of pointsAlong(a[i], a[(i + 1) % a.length])) if (distToBoundary(p, b) <= TOL) n++;
  return n * STEP >= 1;
}

// ---------------------------------------------------------------- validation

export function validateLocation(loc: LocationDefinition, derived: DerivedLocation): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string, ref?: Id) => issues.push({ severity: 'error', code, message, ref });
  const warn = (code: string, message: string, ref?: Id) => issues.push({ severity: 'warning', code, message, ref });

  const polys = new Map<Id, Polygon>();
  for (const r of loc.rooms) polys.set(r.id, r.polygon);
  for (const z of loc.zones) polys.set(z.id, z.polygon);
  const roomIds = new Set(loc.rooms.map((r) => r.id));
  const zoneIds = new Set(loc.zones.map((z) => z.id));

  // Duplicate ids share one namespace so any reference is unambiguous.
  const seen = new Set<Id>();
  for (const id of [
    ...loc.rooms.map((r) => r.id),
    ...loc.zones.map((z) => z.id),
    ...loc.openings.map((o) => o.id),
    ...loc.objects.map((o) => o.id),
  ]) {
    if (seen.has(id)) err('duplicate_id', `Id "${id}" is used more than once`, id);
    seen.add(id);
  }

  // Polygons. Spaces that fail here are skipped by the sampled checks below.
  const badPolys = new Set<Id>();
  const checkPoly = (id: Id, poly: Polygon) => {
    if (poly.length < 3) {
      err('polygon_too_few_vertices', `${id} has fewer than 3 vertices`, id);
      badPolys.add(id);
    } else if (polygonArea(poly) < 1e-6) {
      err('polygon_zero_area', `${id} has zero area`, id);
      badPolys.add(id);
    } else if (selfIntersects(poly)) {
      err('polygon_self_intersect', `${id} outline crosses itself`, id);
      badPolys.add(id);
    }
  };
  checkPoly('footprint', loc.footprint);
  if (loc.upperFootprint) checkPoly('upperFootprint', loc.upperFootprint);
  for (const [id, poly] of polys) checkPoly(id, poly);

  // Floors: at most two, consistent with the rooms and with upperFootprint.
  const floorOf = floorMap(loc);
  const roomById = new Map(loc.rooms.map((r) => [r.id, r]));
  const declared = loc.floors ?? 1;
  const floorsOk = Number.isInteger(declared) && declared >= 1 && declared <= MAX_FLOORS;
  if (declared > MAX_FLOORS) err('too_many_floors', `Location declares ${declared} floors (at most ${MAX_FLOORS})`);
  else if (!floorsOk) err('floors_mismatch', `Location declares ${declared} floors (must be 1 or 2)`);
  const roomFloorOk = new Set<Id>();
  for (const r of loc.rooms) {
    const f = r.floor ?? 0;
    if (!Number.isInteger(f) || f < 0) err('room_floor_invalid', `${r.id} is on invalid floor ${f}`, r.id);
    else if (f >= MAX_FLOORS) err('too_many_floors', `${r.id} is on floor ${f} (at most ${MAX_FLOORS} floors, numbered 0 and 1)`, r.id);
    else roomFloorOk.add(r.id);
  }
  if (floorsOk)
    for (let f = 0; f < declared; f++)
      if (loc.rooms.length > 0 && !loc.rooms.some((r) => (r.floor ?? 0) === f)) err('floors_mismatch', `Location declares ${declared} floors but floor ${f} has no rooms`);
  for (const r of loc.rooms)
    if (floorsOk && roomFloorOk.has(r.id) && (r.floor ?? 0) >= declared)
      err('floors_mismatch', `${r.id} is on floor ${r.floor} but the location declares ${declared} floor${declared === 1 ? '' : 's'}`, r.id);
  if (floorsOk && declared === 2 && !loc.upperFootprint) err('missing_upper_footprint', 'Two-floor location has no upperFootprint');
  if (floorsOk && declared === 1 && loc.upperFootprint) warn('upper_footprint_unused', 'upperFootprint is set but the location has one floor');
  if (loc.upperFootprint && !badPolys.has('upperFootprint') && !badPolys.has('footprint')) {
    const ub = polygonBBox(loc.upperFootprint);
    let over = 0;
    for (const p of cellCentres(ub.x, ub.y, ub.x + ub.w, ub.y + ub.h)) if (pointInPolygon(p, loc.upperFootprint) && !pointInPolygon(p, loc.footprint)) over++;
    if (over > 0) warn('upper_footprint_overhang', `upperFootprint overhangs the ground floor by about ${(over * STEP * STEP).toFixed(2)} sq ft`);
  }

  // Rooms must not overlap and must sit inside the footprint.
  for (let i = 0; i < loc.rooms.length; i++) {
    const a = loc.rooms[i];
    if (badPolys.has(a.id)) continue;
    const ba = polygonBBox(a.polygon);
    for (let j = i + 1; j < loc.rooms.length; j++) {
      const b = loc.rooms[j];
      if (badPolys.has(b.id) || a.floor !== b.floor) continue;
      const bb = polygonBBox(b.polygon);
      const x0 = Math.max(ba.x, bb.x);
      const y0 = Math.max(ba.y, bb.y);
      const x1 = Math.min(ba.x + ba.w, bb.x + bb.w);
      const y1 = Math.min(ba.y + ba.h, bb.y + bb.h);
      if (x1 <= x0 || y1 <= y0) continue;
      let cells = 0;
      for (const p of cellCentres(x0, y0, x1, y1)) if (pointInPolygon(p, a.polygon) && pointInPolygon(p, b.polygon)) cells++;
      if (cells > 0)
        err('room_overlap', `${a.id} and ${b.id} overlap by about ${(cells * STEP * STEP).toFixed(2)} sq ft`, a.id);
    }
    // Floor 0 rooms sit inside the footprint, floor 1 rooms inside the upper footprint.
    const upper = (a.floor ?? 0) === 1;
    const outline = upper ? loc.upperFootprint : (a.floor ?? 0) === 0 ? loc.footprint : undefined;
    const outlineId = upper ? 'upperFootprint' : 'footprint';
    if (outline && roomFloorOk.has(a.id) && !badPolys.has(outlineId)) {
      let outside = 0;
      for (const p of cellCentres(ba.x, ba.y, ba.x + ba.w, ba.y + ba.h))
        if (pointInPolygon(p, a.polygon) && !pointInPolygon(p, outline)) outside++;
      if (outside > 0)
        err(upper ? 'room_outside_upper_footprint' : 'room_outside_footprint', `${a.id} extends outside the ${upper ? 'upper-floor ' : ''}footprint`, a.id);
    }
  }

  // Openings.
  for (const o of loc.openings) {
    const A = polys.get(o.a);
    const B = polys.get(o.b);
    if (!A || !B) {
      err('opening_missing_space', `${o.id} joins missing space ${!A ? o.a : o.b}`, o.id);
      continue;
    }
    const aRoom = roomIds.has(o.a);
    const bRoom = roomIds.has(o.b);

    if (o.type === 'stair') {
      // A stair joins a floor-0 room to a floor-1 room whose outlines overlap in plan;
      // `from` lies in room a (the foot when a is the ground room), `to` in room b.
      const ra = roomById.get(o.a);
      const rb = roomById.get(o.b);
      const fa = ra?.floor ?? -1;
      const fb = rb?.floor ?? -1;
      if (!ra || !rb) err('stair_floors_invalid', `${o.id} must join two rooms, not an exterior zone`, o.id);
      else if (!((fa === 0 && fb === 1) || (fa === 1 && fb === 0)))
        err('stair_floors_invalid', `${o.id} joins floors ${fa} and ${fb}; a stair must join floor 0 and floor 1`, o.id);
      else if (o.floor !== undefined && o.floor !== 0) err('stair_floors_invalid', `${o.id} is on floor ${o.floor}; a stair's floor is its lower floor (0)`, o.id);
      else if (!badPolys.has(o.a) && !badPolys.has(o.b)) {
        const overlap = polygonOverlapArea(ra.polygon, rb.polygon);
        if (overlap < MIN_STAIR_OVERLAP)
          err('stair_misaligned', `${o.id}: ${o.a} and ${o.b} overlap by ${overlap.toFixed(2)} sq ft in plan (need ${MIN_STAIR_OVERLAP}); the stairwell is not aligned`, o.id);
        else if (!insideOrOn(o.from, ra.polygon) || !insideOrOn(o.to, rb.polygon))
          err('stair_misaligned', `${o.id}: foot or head is not inside its stair room (from must lie in ${o.a}, to in ${o.b})`, o.id);
      }
      continue;
    }

    // Everything else stays on one floor. Exterior zones are floor 0, so only a window
    // may join a floor-1 room to a zone.
    const fa = floorOf.get(o.a) ?? 0;
    const fb = floorOf.get(o.b) ?? 0;
    let expected = 0;
    let sameFloor = true;
    if (aRoom && bRoom) {
      sameFloor = fa === fb;
      expected = fa;
    } else if (aRoom || bRoom) {
      expected = aRoom ? fa : fb;
      if (expected !== 0 && o.type !== 'window') sameFloor = false;
    }
    if (o.floor !== undefined && o.floor !== expected) sameFloor = false;
    if (!sameFloor) {
      err('opening_cross_floor', `${o.id} (${o.type}) joins ${o.a} (floor ${fa}) and ${o.b} (floor ${fb}) but openings other than stairs must stay on one floor`, o.id);
      continue;
    }

    if (!badPolys.has(o.a) && !badPolys.has(o.b)) {
      // A floor-1 window faces the outdoors from the upper outline, which may sit inside
      // the ground footprint, so only its room's wall is checked, not the zone's edge.
      const upperWindow = o.type === 'window' && expected >= 1 && (aRoom !== bRoom);
      const off = pointsAlong(o.from, o.to).some((p) =>
        upperWindow ? distToBoundary(p, aRoom ? A : B) > TOL : distToBoundary(p, A) > TOL || distToBoundary(p, B) > TOL,
      );
      if (off) err('opening_not_on_wall', `${o.id} does not lie on a wall shared by ${o.a} and ${o.b}`, o.id);
    }
    if ((o.type === 'door' || o.type === 'doorway') && segLength(o) < MIN_DOOR_WIDTH)
      err('opening_too_narrow', `${o.id} is ${segLength(o).toFixed(2)} ft wide (minimum ${MIN_DOOR_WIDTH})`, o.id);
    if (o.swing && o.swing.into !== o.a && o.swing.into !== o.b)
      err('swing_invalid', `${o.id} swings into ${o.swing.into}, which it does not join`, o.id);
    if (o.type === 'door' && !o.material) err('door_missing_material', `${o.id} is a door with no leaf material`, o.id);
    if (o.type === 'window' && !o.glazing) err('window_missing_glazing', `${o.id} is a window with no glazing`, o.id);
    if (o.type === 'sliding' && !o.glazing && !o.material) err('sliding_missing_material', `${o.id} is a sliding door with no glazing or leaf material`, o.id);
    if (o.type === 'window') {
      const outline = expected === 0 ? loc.footprint : expected === 1 ? loc.upperFootprint : undefined;
      const outlineId = expected === 0 ? 'footprint' : 'upperFootprint';
      const m = { x: (o.from.x + o.to.x) / 2, y: (o.from.y + o.to.y) / 2 };
      if (outline && !badPolys.has(outlineId) && distToBoundary(m, outline) > TOL)
        warn('window_not_on_footprint', `${o.id} is not on the ${expected === 0 ? '' : 'upper-floor '}exterior wall`, o.id);
    }
  }

  // Wall material overrides must name two real, neighbouring spaces.
  for (const ov of loc.materials.overrides) {
    const ref = `${ov.a}|${ov.b}`;
    const A = polys.get(ov.a);
    const B = polys.get(ov.b);
    if (!A || !B) {
      err('override_unknown_space', `Material override names unknown space ${!A ? ov.a : ov.b}`, ref);
      continue;
    }
    if (badPolys.has(ov.a) || badPolys.has(ov.b)) continue;
    if (!sharesWall(A, B)) err('override_not_adjacent', `Material override names ${ov.a} and ${ov.b}, which share no wall`, ref);
  }

  // Staging points are derived; one that cannot sit inside its space is a warning.
  for (const sp of derived.stagingPoints ?? []) {
    const poly = polys.get(sp.spaceId);
    // The ground-side point under a floor-1 window need not sit in a zone (the upper outline can be recessed).
    const underUpperWindow = sp.kind === 'window' && !roomIds.has(sp.spaceId) && (loc.openings.find((o) => o.id === sp.openingId)?.floor ?? 0) >= 1;
    if (poly && !badPolys.has(sp.spaceId) && !underUpperWindow && !pointInPolygon(sp.at, poly))
      warn('staging_point_outside_space', `Staging point ${sp.id} falls outside ${sp.spaceId}`, sp.id);
  }

  // Objects.
  for (const o of loc.objects) {
    if (o.mechanical && o.tags.length === 0)
      err('mechanical_missing_tags', `${o.id} is mechanical but names no rule tags`, o.id);
    const space = polys.get(o.in);
    if (!space) {
      err('object_missing_space', `${o.id} is placed in missing space ${o.in}`, o.id);
      continue;
    }
    if (badPolys.has(o.in)) continue;
    const r = objectRect(o);
    for (const p of rectPoints(r.x0, r.y0, r.x1, r.y1))
      if (!insideOrOn(p, space)) {
        err('object_outside_space', `${o.id} extends outside ${o.in}`, o.id);
        break;
      }
  }

  // Door swings that sweep through blocking furniture are playable but suspicious.
  for (const o of loc.openings) {
    if (o.type !== 'door' || !o.swing) continue;
    const into = polys.get(o.swing.into);
    if (!into || (o.swing.into !== o.a && o.swing.into !== o.b)) continue;
    const hinge = o.swing.hinge === 'from' ? o.from : o.to;
    const free = o.swing.hinge === 'from' ? o.to : o.from;
    const r = segLength(o);
    if (r === 0) continue;
    const u = { x: (free.x - hinge.x) / r, y: (free.y - hinge.y) / r };
    const mid = { x: (o.from.x + o.to.x) / 2, y: (o.from.y + o.to.y) / 2 };
    let n = { x: -u.y, y: u.x };
    if (!pointInPolygon({ x: mid.x + n.x * 0.3, y: mid.y + n.y * 0.3 }, into)) n = { x: -n.x, y: -n.y };
    for (const obj of loc.objects) {
      if (obj.in !== o.swing.into || !obj.mechanical || !obj.tags.includes('blocks_space')) continue;
      const rect = objectRect(obj);
      const hit = [...rectPoints(rect.x0, rect.y0, rect.x1, rect.y1)].some((p) => {
        const dx = p.x - hinge.x;
        const dy = p.y - hinge.y;
        return Math.hypot(dx, dy) <= r && dx * u.x + dy * u.y > TOL && dx * n.x + dy * n.y > TOL;
      });
      if (hit) warn('swing_blocked', `${o.id} swing arc overlaps ${obj.id}`, o.id);
    }
  }

  // Entries and reachability.
  if (loc.entries.length === 0) err('no_entry', 'Location has no entry zones');
  for (const e of loc.entries) if (!zoneIds.has(e)) err('entry_not_zone', `Entry ${e} is not an exterior zone`, e);
  const reached = new Set<Id>(loc.entries.filter((e) => zoneIds.has(e)));
  const queue = [...reached];
  while (queue.length) {
    const id = queue.pop() as Id;
    for (const edge of derived.adjacency[id] ?? [])
      if (!reached.has(edge.to)) {
        reached.add(edge.to);
        queue.push(edge.to);
      }
  }
  for (const id of roomIds) if (!reached.has(id)) err('unreachable_room', `${id} cannot be reached from any entry`, id);

  return issues;
}

/** Throws with every error message when the built location is not playable. */
export function assertPlayable(built: BuiltLocation): void {
  const errors = built.issues.filter((i) => i.severity === 'error');
  if (errors.length === 0) return;
  throw new Error(`Location ${built.location.id} (seed ${built.location.seed}) is not playable:\n${errors.map((i) => `[${i.code}] ${i.message}`).join('\n')}`);
}
