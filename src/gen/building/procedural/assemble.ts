import { chamferPolygon, outwardNormal, polyArea, rarea, rectPoly, sharedSegments, type Seg, type Vec } from './geom';
import type { PRoom, Plan } from './types';

/** Keys that are numbered even when a building has only one of them. */
const ALWAYS_NUMBERED = new Set(['bedroom', 'bath', 'wc', 'storage', 'office', 'meeting', 'unit', 'ensuite']);

export type Side = 'n' | 's' | 'e' | 'w' | 'd';

/** A stretch of a room's wall that lies on the building outline. */
export interface Run {
  room: string;
  floor: number;
  seg: Seg;
  /** Unit normal pointing out of the building. */
  normal: Vec;
  side: Side;
  len: number;
}

/** Two rooms on one floor and the stretches of wall they share. */
export interface Pair {
  a: string;
  b: string;
  segs: Seg[];
  len: number;
}

export function sideOf(n: Vec): Side {
  if (Math.abs(n.x) > 0.9) return n.x > 0 ? 'e' : 'w';
  if (Math.abs(n.y) > 0.9) return n.y > 0 ? 's' : 'n';
  return 'd';
}

/**
 * Give every room its id, label and outline. Ids are the seed key, numbered when several
 * rooms share a key (largest first), and stairs are stair_<floor>. Applies the chamfer.
 * Returns false when a chamfer does not fit.
 */
export function finalizeRooms(plan: Plan): boolean {
  const renamed = new Map<string, string>();
  const byKey = new Map<string, PRoom[]>();
  for (const r of plan.rooms) (byKey.get(r.seed.key) ?? byKey.set(r.seed.key, []).get(r.seed.key)!).push(r);
  for (const [key, group] of byKey) {
    group.sort((p, q) => p.floor - q.floor || rarea(q.rect) - rarea(p.rect) || p.rect.y0 - q.rect.y0 || p.rect.x0 - q.rect.x0);
    group.forEach((r, i) => {
      const n = i + 1;
      const numbered = group.length > 1 || ALWAYS_NUMBERED.has(key);
      const old = r.id;
      r.id = key === 'stair' ? `stair_${r.floor}` : numbered ? `${key}_${n}` : key;
      renamed.set(old, r.id);
      r.label = key === 'stair' ? 'Stairs' : numbered && group.length > 1 ? `${r.seed.label} ${n}` : r.seed.label;
      r.poly = rectPoly(r.rect);
    });
  }
  for (const r of plan.rooms) if (r.ensuiteOf !== undefined) r.ensuiteOf = renamed.get(r.ensuiteOf) ?? r.ensuiteOf;
  plan.footprintSq = plan.footprint;
  if (plan.chamfer) {
    const { corner, leg } = plan.chamfer;
    const fp = chamferPolygon(plan.footprint, corner, leg);
    if (!fp) return false;
    const owner = plan.rooms.find((r) => r.floor === 0 && r.poly.some((p) => p.x === corner.x && p.y === corner.y));
    if (!owner) return false;
    const clip = (r: PRoom): boolean => {
      const w = r.rect.x1 - r.rect.x0;
      const h = r.rect.y1 - r.rect.y0;
      if (w < leg + 5 || h < leg + 5) return false;
      const poly = chamferPolygon(r.poly, corner, leg);
      if (!poly) return false;
      r.poly = poly;
      r.tags = [...r.tags, 'chamfer'];
      return true;
    };
    if (!clip(owner)) return false;
    plan.footprint = fp;
    // The upper floor keeps the cut when it reaches that corner.
    const up = plan.rooms.find((r) => r.floor === 1 && r.poly.some((p) => p.x === corner.x && p.y === corner.y));
    if (plan.upperFootprint && up) {
      const ufp = chamferPolygon(plan.upperFootprint, corner, leg);
      if (!ufp || !clip(up)) return false;
      plan.upperFootprint = ufp;
    }
  }
  return true;
}

export const roomArea = (r: PRoom) => polyArea(r.poly);

/** Wall stretches that face the outdoors, per room. */
export function exteriorRuns(plan: Plan): Run[] {
  const runs: Run[] = [];
  for (const r of plan.rooms) {
    const outline = r.floor === 0 ? plan.footprint : plan.upperFootprint;
    if (!outline) continue;
    for (const seg of sharedSegments(r.poly, outline, 0.5)) {
      const normal = outwardNormal(seg, r.poly);
      runs.push({ room: r.id, floor: r.floor, seg, normal, side: sideOf(normal), len: Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) });
    }
  }
  return runs;
}

/** Every pair of rooms on one floor that share a wall of at least one foot. */
export function roomPairs(plan: Plan): Pair[] {
  const out: Pair[] = [];
  const rooms = plan.rooms;
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      if (a.floor !== b.floor) continue;
      const segs = sharedSegments(a.poly, b.poly, 1);
      if (segs.length === 0) continue;
      out.push({ a: a.id, b: b.id, segs, len: segs.reduce((s, g) => s + Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y), 0) });
    }
  return out;
}
