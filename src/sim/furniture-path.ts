// Room-local navigation for furnished generation. No random draws or location
// mutation: the furnishing validator and route overlay use the same geometry.
import type { PlacedObject, Room, Vec } from './types';

export interface FootprintRect { x: number; y: number; w: number; h: number }

const EPS = 1e-7;
const MAX_VERTICES = 256;
const length = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });

/** The same centre rotation used by the blueprint's objectRect. */
export function footprintRect(object: PlacedObject): FootprintRect {
  if (object.rotation === 90 || object.rotation === 270) {
    const cx = object.x + object.w / 2, cy = object.y + object.h / 2;
    return { x: cx - object.h / 2, y: cy - object.w / 2, w: object.h, h: object.w };
  }
  return { x: object.x, y: object.y, w: object.w, h: object.h };
}

function pointEdgeDistance(p: Vec, a: Vec, b: Vec): number {
  const d = sub(b, a);
  const denominator = d.x * d.x + d.y * d.y;
  const t = denominator ? Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / denominator)) : 0;
  return length(p, { x: a.x + d.x * t, y: a.y + d.y * t });
}

function inside(p: Vec, polygon: readonly Vec[]): boolean {
  let result = false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (pointEdgeDistance(p, a, b) <= EPS) return true;
    if (a.y > p.y !== b.y > p.y && p.x < a.x + (b.x - a.x) * (p.y - a.y) / (b.y - a.y)) result = !result;
  }
  return result;
}

function intersectionTime(a: Vec, b: Vec, c: Vec, d: Vec): number | null {
  const ab = sub(b, a), cd = sub(d, c), ca = sub(c, a);
  const denominator = cross(ab, cd);
  if (Math.abs(denominator) <= EPS) return null;
  const t = cross(ca, cd) / denominator, u = cross(ca, ab) / denominator;
  return t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS ? Math.max(0, Math.min(1, t)) : null;
}

function edgeDistance(a: Vec, b: Vec, c: Vec, d: Vec): number {
  if (intersectionTime(a, b, c, d) !== null) return 0;
  return Math.min(pointEdgeDistance(a, c, d), pointEdgeDistance(b, c, d), pointEdgeDistance(c, a, b), pointEdgeDistance(d, a, b));
}

function interiorHit(a: Vec, b: Vec, rect: FootprintRect): boolean {
  let low = 0, high = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, rect.x + EPS, rect.x + rect.w - EPS],
    [a.y, b.y - a.y, rect.y + EPS, rect.y + rect.h - EPS],
  ]) {
    if (Math.abs(delta) < EPS) {
      if (start < min || start > max) return false;
    } else {
      const t1 = (min - start) / delta, t2 = (max - start) / delta;
      low = Math.max(low, Math.min(t1, t2));
      high = Math.min(high, Math.max(t1, t2));
      if (low > high) return false;
    }
  }
  return low <= high;
}

function obstacles(room: Room, objects: readonly PlacedObject[], clearance: number): FootprintRect[] {
  return objects.filter(object => object.in === room.id && object.type !== 'rug' && object.type !== 'steps').map(object => {
    const r = footprintRect(object);
    return { x: r.x - clearance, y: r.y - clearance, w: r.w + clearance * 2, h: r.h + clearance * 2 };
  });
}

function clearPoint(room: Room, rects: readonly FootprintRect[], point: Vec, wallClearance: number): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !inside(point, room.polygon)) return false;
  if (rects.some(rect => interiorHit(point, point, rect))) return false;
  return room.polygon.every((a, i) => pointEdgeDistance(point, a, room.polygon[(i + 1) % room.polygon.length]) + EPS >= wallClearance);
}

/** A circular agent fits inside the room and outside every solid footprint. */
export function roomPointClear(room: Room, objects: readonly PlacedObject[], point: Vec, clearance = 1): boolean {
  return clearPoint(room, obstacles(room, objects, Math.max(0, clearance)), point, Math.max(0, clearance));
}

function clearSegment(room: Room, rects: readonly FootprintRect[], a: Vec, b: Vec, wallClearance: number): boolean {
  if (!clearPoint(room, rects, a, wallClearance) || !clearPoint(room, rects, b, wallClearance)) return false;
  if (rects.some(rect => interiorHit(a, b, rect))) return false;
  const cuts = [0, 1];
  for (let i = 0; i < room.polygon.length; i++) {
    const c = room.polygon[i], d = room.polygon[(i + 1) % room.polygon.length];
    if (edgeDistance(a, b, c, d) + EPS < wallClearance) return false;
    const t = intersectionTime(a, b, c, d);
    if (t !== null) cuts.push(t);
  }
  // Endpoint inclusion alone is insufficient for concave rooms. Test each
  // interval cut by a wall, including the zero-clearance door approach.
  cuts.sort((x, y) => x - y);
  return cuts.slice(1).every((end, i) => {
    const t = (cuts[i] + end) / 2;
    return inside({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, room.polygon);
  });
}

/** Wall clearance may be zero only for the short normal approach to an opening. */
export function roomSegmentClear(room: Room, objects: readonly PlacedObject[], from: Vec, to: Vec, clearance = 1, wallClearance = clearance): boolean {
  return clearSegment(room, obstacles(room, objects, Math.max(0, clearance)), from, to, Math.max(0, wallClearance));
}

/**
 * A bounded visibility graph around expanded furniture and inset room corners.
 * Solid footprints get conservative square clearance; walls get radial clearance.
 * Returns null for invalid endpoints, a sealed passage, or excessive geometry.
 */
export function findRoomPath(room: Room, objects: readonly PlacedObject[], from: Vec, to: Vec, clearance = 1): Vec[] | null {
  const margin = Math.max(0, clearance);
  const rects = obstacles(room, objects, margin);
  if (!clearPoint(room, rects, from, margin) || !clearPoint(room, rects, to, margin)) return null;
  if (clearSegment(room, rects, from, to, margin)) return [from, to];
  const vertices: Vec[] = [from, to];
  const add = (point: Vec) => {
    if (clearPoint(room, rects, point, margin) && !vertices.some(p => length(p, point) < EPS)) vertices.push(point);
  };
  for (const rect of rects) {
    for (const x of [rect.x, rect.x + rect.w]) for (const y of [rect.y, rect.y + rect.h]) add({ x, y });
  }
  // Orthogonal corners are exact. Miter intersections also support sloping walls.
  let area = 0;
  for (let i = 0; i < room.polygon.length; i++) area += cross(room.polygon[i], room.polygon[(i + 1) % room.polygon.length]);
  const sign = area >= 0 ? 1 : -1;
  for (let i = 0; i < room.polygon.length; i++) {
    const p = room.polygon[i], previous = room.polygon[(i + room.polygon.length - 1) % room.polygon.length], next = room.polygon[(i + 1) % room.polygon.length];
    const a = sub(p, previous), b = sub(next, p), al = Math.hypot(a.x, a.y), bl = Math.hypot(b.x, b.y);
    if (!al || !bl) continue;
    const u = { x: a.x / al, y: a.y / al }, v = { x: b.x / bl, y: b.y / bl };
    const offsetA = { x: p.x - u.y * margin * sign, y: p.y + u.x * margin * sign };
    const offsetB = { x: p.x - v.y * margin * sign, y: p.y + v.x * margin * sign };
    const denominator = cross(u, v);
    if (Math.abs(denominator) > EPS) {
      const t = cross(sub(offsetB, offsetA), v) / denominator;
      add({ x: offsetA.x + u.x * t, y: offsetA.y + u.y * t });
    }
  }
  if (vertices.length > MAX_VERTICES) return null;
  const costs = vertices.map(() => Infinity), previous = vertices.map(() => -1), done = new Set<number>();
  costs[0] = 0;
  while (done.size < vertices.length) {
    let current = -1;
    for (let i = 0; i < vertices.length; i++) if (!done.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
    if (current < 0 || !Number.isFinite(costs[current])) return null;
    if (current === 1) {
      const path: Vec[] = [];
      for (let i = 1; i >= 0; i = previous[i]) path.unshift(vertices[i]);
      return path;
    }
    done.add(current);
    for (let i = 0; i < vertices.length; i++) {
      if (done.has(i)) continue;
      const cost = costs[current] + length(vertices[current], vertices[i]);
      if (cost + EPS < costs[i] && clearSegment(room, rects, vertices[current], vertices[i], margin)) {
        costs[i] = cost;
        previous[i] = current;
      }
    }
  }
  return null;
}
