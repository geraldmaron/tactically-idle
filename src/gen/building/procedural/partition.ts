import { assignRooms, sliceRow } from './fill';
import { type Rect, rarea, rh, rw } from './geom';
import type { Rand } from './rand';
import { type Piece, type StripPlan, planStrip } from './strips';
import type { PRoom, RoomSeed } from './types';

/** Hands out temporary room ids that finalizeRooms replaces. */
export class RoomMaker {
  private n = 0;
  make(seed: RoomSeed, rect: Rect, floor: number, extraTags: string[] = []): PRoom {
    this.n++;
    return { id: `t${this.n}`, seed, floor, rect, poly: [], tags: [...seed.tags, ...extraTags], label: seed.label };
  }
}

export interface StripOpts {
  hw: [number, number];
  /** Smallest thickness of a side piece / cap piece. */
  minSide: number;
  minCap: number;
  maxPieces: number;
  /** Probability of the strip running along the building's longer axis. */
  longAxis: number;
  /** Relative odds of the strip spanning fully, or anchored to its low or high end. */
  full: number;
  anchored: number;
  /** Strip axis: 'v', 'h', or any (a long-axis bias applies). */
  axis?: 'v' | 'h';
  /** Put the strip at a footprint edge only (narrow plans, apartments). */
  edge?: boolean;
  /** Sides of the footprint with no windows (party walls, corridors). */
  noWindow?: ('n' | 's' | 'e' | 'w')[];
  /** Strip along range must reach the footprint's low end (apartments: corridor side). */
  lowEdge?: boolean;
  /** Which end a short strip anchors to (default either). */
  anchor?: 'lo' | 'hi';
  /** Thickness range of the cap beyond an anchored strip (default: random). */
  capDepth?: [number, number];
  /** Fewest pieces a plan may have (default 2; a hall along one wall leaves just one). */
  minPieces?: number;
}

export function insideAt(rects: Rect[], axis: 'v' | 'h', c0: number, c1: number, a: number): boolean {
  return rects.some((r) => (axis === 'v' ? c0 >= r.x0 - 1e-9 && c1 <= r.x1 + 1e-9 && a > r.y0 && a < r.y1 : c0 >= r.y0 - 1e-9 && c1 <= r.y1 + 1e-9 && a > r.x0 && a < r.x1));
}

/** Longest stretch along `axis` where the strip's cross range [c0, c1] stays inside the footprint. */
export function extentAlong(rects: Rect[], axis: 'v' | 'h', c0: number, c1: number): [number, number] | null {
  const lo = Math.min(...rects.map((r) => (axis === 'v' ? r.y0 : r.x0)));
  const hi = Math.max(...rects.map((r) => (axis === 'v' ? r.y1 : r.x1)));
  let best: [number, number] | null = null;
  let start: number | null = null;
  for (let a = lo; a < hi + 0.01; a += 0.5) {
    const on = a < hi && insideAt(rects, axis, c0, c1, a + 0.25);
    if (on && start === null) start = a;
    if (!on && start !== null) {
      if (!best || a - start > best[1] - best[0]) best = [start, a];
      start = null;
    }
  }
  return best;
}

/** Cross position of a strip: centred between two side pieces, or hugging one wall. */
export function pickCross(rng: Rand, q0: number, q1: number, hw: number, minSide: number): number | null {
  const both = q1 - q0 >= hw + 2 * minSide;
  const mode = rng.weighted([['both', both ? 8 : 0], ['lo', q1 - q0 >= hw + minSide ? 1 : 0], ['hi', q1 - q0 >= hw + minSide ? 1 : 0]] as const);
  if (!both && q1 - q0 < hw + minSide) return null;
  if (mode === 'lo') return q0;
  if (mode === 'hi') return q1 - hw;
  return rng.snapped(q0 + minSide, q1 - hw - minSide);
}

/** Along-axis coordinates where the footprint outline steps (rectangle edges), inside the open interval (lo, hi). */
export function stepEdges(rects: Rect[], axis: 'v' | 'h', lo: number, hi: number): number[] {
  const out = new Set<number>();
  for (const r of rects)
    for (const v of axis === 'v' ? [r.y0, r.y1] : [r.x0, r.x1]) if (v > lo + 1e-9 && v < hi - 1e-9) out.add(v);
  return [...out].sort((a, b) => a - b);
}

/** Sample hall strips until one yields sensible pieces; null when none does. */
export function sampleStrip(rng: Rand, rects: Rect[], o: StripOpts, avoid?: (p: StripPlan) => boolean): StripPlan | null {
  const bx0 = Math.min(...rects.map((r) => r.x0));
  const bx1 = Math.max(...rects.map((r) => r.x1));
  const by0 = Math.min(...rects.map((r) => r.y0));
  const by1 = Math.max(...rects.map((r) => r.y1));
  const long = bx1 - bx0 >= by1 - by0 ? 'h' : 'v';
  for (let tries = 0; tries < 60; tries++) {
    const axis = o.axis ?? (rng.chance(o.longAxis) ? long : long === 'h' ? 'v' : 'h');
    const hw = rng.snapped(o.hw[0], o.hw[1]);
    let q0 = axis === 'v' ? bx0 : by0;
    let q1 = axis === 'v' ? bx1 : by1;
    // Often run the strip through every wing: confine it to the cross range they share.
    const shared0 = Math.max(...rects.map((r) => (axis === 'v' ? r.x0 : r.y0)));
    const shared1 = Math.min(...rects.map((r) => (axis === 'v' ? r.x1 : r.y1)));
    if (shared1 - shared0 >= hw + o.minSide - 0.01 && (shared0 > q0 || shared1 < q1) && rng.chance(0.65)) {
      q0 = shared0;
      q1 = shared1;
    }
    let c0: number | null = null;
    // Often hug a step in the outline so every wing's rooms touch the strip (a U's legs, a T's stem).
    const crossEdges = [...new Set(rects.flatMap((r) => (axis === 'v' ? [r.x0, r.x1] : [r.y0, r.y1])))].filter((v) => v > q0 + 1e-9 && v < q1 - 1e-9);
    if (!o.edge && crossEdges.length && rng.chance(0.45)) {
      const e = rng.pick(crossEdges);
      const c = rng.chance(0.5) ? e : e - hw;
      const reach = c >= q0 - 1e-9 && c + hw <= q1 + 1e-9 ? extentAlong(rects, axis, c, c + hw) : null;
      if (reach && reach[1] - reach[0] >= 12) c0 = c;
    }
    if (c0 === null) {
      if (o.edge) {
        if (q1 - q0 < hw + o.minSide - 0.01) continue;
        c0 = o.lowEdge || rng.chance(0.5) ? q0 : q1 - hw;
      } else {
        c0 = pickCross(rng, q0, q1, hw, o.minSide);
        if (c0 === null) continue;
      }
    }
    const c1 = c0 + hw;
    const ext = extentAlong(rects, axis, c0, c1);
    if (!ext || ext[1] - ext[0] < 12) continue;
    const steps = stepEdges(rects, axis, ext[0], ext[1]);
    const total = ext[1] - ext[0];
    // A hall running the whole length of a long house is rare: favour a hall that stops at a cap room.
    const fullWeight = (steps.length ? o.full * 0.4 : o.full) * (total > 26 && !o.edge ? 0.3 : 1);
    const mode = rng.weighted([['full', fullWeight], ['lo', o.anchor === 'hi' ? 0 : o.anchored], ['hi', o.anchor === 'lo' ? 0 : o.anchored]] as const);
    let along: [number, number] = ext;
    if (mode !== 'full') {
      // A cap often coincides with a step in the outline (a wing's end wall).
      const cap = steps.filter((v) => (mode === 'lo' ? ext[1] - v >= o.minCap && v - ext[0] >= 10 : v - ext[0] >= o.minCap && ext[1] - v >= 10));
      if (cap.length && !o.capDepth && rng.chance(0.75)) {
        const v = rng.pick(cap);
        along = mode === 'lo' ? [ext[0], v] : [v, ext[1]];
      } else {
        const len = o.capDepth ? total - rng.snapped(o.capDepth[0], o.capDepth[1]) : rng.snapped(Math.max(10, total * 0.45), Math.min(total - o.minCap, total * 0.8));
        if (len < 10 || total - len < o.minCap) continue;
        along = mode === 'lo' ? [ext[0], ext[0] + len] : [ext[1] - len, ext[1]];
      }
    }
    const plan = planStrip(rects, { axis, cross: [c0, c1], along }, Math.min(o.minSide, o.minCap) - 0.01, { noWindow: o.noWindow });
    if (!plan) continue;
    if (plan.pieces.length > o.maxPieces || plan.pieces.length < (o.minPieces ?? 2)) continue;
    if (plan.pieces.some((p) => (p.kind === 'cap' ? Math.min(rw(p.rect), rh(p.rect)) < o.minCap : Math.min(rw(p.rect), rh(p.rect)) < o.minSide))) continue;
    if (avoid && avoid(plan)) continue;
    return plan;
  }
  return null;
}

/** Assign seeds to pieces and slice them into rooms; the strip itself becomes `hallSeed`. */
export function layoutPieces(rng: Rand, maker: RoomMaker, plan: StripPlan, seeds: RoomSeed[], floor: number, extraTags: string[] = [], filler?: RoomSeed): PRoom[] | null {
  const asg = assignRooms(plan.pieces, seeds, rng, filler);
  if (!asg) return null;
  const rooms: PRoom[] = [];
  for (const a of asg) {
    const placed = sliceRow(a, rng);
    if (!placed) return null;
    for (const p of placed) {
      const r = maker.make(p.seed, p.rect, floor, extraTags);
      rooms.push(r);
      if (p.ensuite) {
        const e = maker.make(p.ensuite.seed, p.ensuite.rect, floor, extraTags);
        e.ensuiteOf = r.id;
        rooms.push(e);
      }
    }
  }
  return rooms;
}

export const pieceArea = (p: Piece) => rarea(p.rect);
