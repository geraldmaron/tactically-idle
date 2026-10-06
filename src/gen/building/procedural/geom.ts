import type { Vec } from '../../../sim/types';

// Plain 2D helpers for the building generator. Feet, y grows downward (south), everything
// the generator emits sits on a 0.5 ft grid so polygon edges shared by two spaces are
// bit-for-bit identical.

export type { Vec };
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Seg {
  a: Vec;
  b: Vec;
}

export const GRID = 0.5;
export const EPS = 1e-6;

export const R = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 });
export const rw = (r: Rect) => r.x1 - r.x0;
export const rh = (r: Rect) => r.y1 - r.y0;
export const rarea = (r: Rect) => rw(r) * rh(r);
export const snap = (v: number, step = GRID) => Math.round(v / step) * step;
export const rcx = (r: Rect) => (r.x0 + r.x1) / 2;
export const rcy = (r: Rect) => (r.y0 + r.y1) / 2;
export const vec = (x: number, y: number): Vec => ({ x, y });
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
/**
 * Euclidean length. Saves rebuild a building from (familyId, seed) on whatever engine the player
 * runs, so the generator uses only arithmetic that ECMAScript fixes bit for bit. Math.hypot, exp,
 * log, pow, `**` and the trig functions are implementation-approximated (ECMA-262 §21.3.2);
 * Math.sqrt is not: §21.3.2.33 returns 𝔽(√n), the correctly rounded root. procedural-math.test.ts
 * holds the generator to this.
 */
export const norm = (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy);
export const dist = (a: Vec, b: Vec) => norm(a.x - b.x, a.y - b.y);
export const segLen = (s: Seg) => dist(s.a, s.b);

export function inflate(r: Rect, d: number): Rect {
  return { x0: r.x0 - d, y0: r.y0 - d, x1: r.x1 + d, y1: r.y1 + d };
}

/** Area of the intersection (0 when the rectangles only touch). */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > EPS && h > EPS ? w * h : 0;
}

export const rectsOverlap = (a: Rect, b: Rect) => overlapArea(a, b) > EPS;

export function rectContains(outer: Rect, inner: Rect): boolean {
  return inner.x0 >= outer.x0 - EPS && inner.x1 <= outer.x1 + EPS && inner.y0 >= outer.y0 - EPS && inner.y1 <= outer.y1 + EPS;
}

export function rectPoly(r: Rect): Vec[] {
  return [vec(r.x0, r.y0), vec(r.x1, r.y0), vec(r.x1, r.y1), vec(r.x0, r.y1)];
}

export function bboxOfRects(rs: Rect[]): Rect {
  return {
    x0: Math.min(...rs.map((r) => r.x0)),
    y0: Math.min(...rs.map((r) => r.y0)),
    x1: Math.max(...rs.map((r) => r.x1)),
    y1: Math.max(...rs.map((r) => r.y1)),
  };
}

// ------------------------------------------------------------------ polygons

export function polyArea(p: Vec[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function polyBBox(p: Vec[]): Rect {
  return {
    x0: Math.min(...p.map((q) => q.x)),
    y0: Math.min(...p.map((q) => q.y)),
    x1: Math.max(...p.map((q) => q.x)),
    y1: Math.max(...p.map((q) => q.y)),
  };
}

export function pointInPoly(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return norm(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToPoly(p: Vec, poly: Vec[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return best;
}

export const insideOrOn = (p: Vec, poly: Vec[], tol = 0.05) => pointInPoly(p, poly) || distToPoly(p, poly) <= tol;

export function polyEdges(poly: Vec[]): Seg[] {
  return poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length] }));
}

/**
 * Parts of A's boundary that lie on B's boundary (collinear, overlapping by at least
 * `minLen`), each oriented along A's edge.
 */
export function sharedSegments(A: Vec[], B: Vec[], minLen = 0.5): Seg[] {
  const out: Seg[] = [];
  const eb = polyEdges(B);
  for (const ea of polyEdges(A)) {
    const len = segLen(ea);
    if (len < EPS) continue;
    const ux = (ea.b.x - ea.a.x) / len;
    const uy = (ea.b.y - ea.a.y) / len;
    for (const f of eb) {
      const flen = segLen(f);
      if (flen < EPS) continue;
      const vx = (f.b.x - f.a.x) / flen;
      const vy = (f.b.y - f.a.y) / flen;
      if (Math.abs(ux * vy - uy * vx) > 1e-6) continue;
      const off = (f.a.x - ea.a.x) * -uy + (f.a.y - ea.a.y) * ux;
      if (Math.abs(off) > 1e-6) continue;
      const t1 = (f.a.x - ea.a.x) * ux + (f.a.y - ea.a.y) * uy;
      const t2 = (f.b.x - ea.a.x) * ux + (f.b.y - ea.a.y) * uy;
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(len, Math.max(t1, t2));
      if (hi - lo >= minLen - EPS) out.push({ a: vec(ea.a.x + ux * lo, ea.a.y + uy * lo), b: vec(ea.a.x + ux * hi, ea.a.y + uy * hi) });
    }
  }
  return out;
}

/** Unit normal of a segment pointing out of `poly` (probe-based, works for diagonals). */
export function outwardNormal(s: Seg, poly: Vec[]): Vec {
  const len = segLen(s) || 1;
  const nx = -(s.b.y - s.a.y) / len;
  const ny = (s.b.x - s.a.x) / len;
  const m = lerp(s.a, s.b, 0.5);
  return pointInPoly(vec(m.x + nx * 0.25, m.y + ny * 0.25), poly) ? vec(-nx, -ny) : vec(nx, ny);
}

/** Does the axis-aligned rectangle lie wholly inside the polygon (edges included)? */
export function rectInsidePoly(r: Rect, poly: Vec[]): boolean {
  if (poly.length === 4 && poly[0].y === poly[1].y && poly[1].x === poly[2].x && poly[2].y === poly[3].y && poly[3].x === poly[0].x) {
    // Axis-aligned rectangle: containment is a bounds test.
    return r.x0 >= poly[0].x - 0.05 && r.x1 <= poly[1].x + 0.05 && r.y0 >= poly[0].y - 0.05 && r.y1 <= poly[2].y + 0.05;
  }
  const xs = steps(r.x0, r.x1);
  const ys = steps(r.y0, r.y1);
  for (const x of xs) for (const y of [r.y0, r.y1]) if (!insideOrOn(vec(x, y), poly)) return false;
  for (const y of ys) for (const x of [r.x0, r.x1]) if (!insideOrOn(vec(x, y), poly)) return false;
  for (const q of poly) if (q.x > r.x0 + EPS && q.x < r.x1 - EPS && q.y > r.y0 + EPS && q.y < r.y1 - EPS) return false;
  return true;
}

function steps(a: number, b: number, step = 0.5): number[] {
  const out: number[] = [];
  for (let v = a; v < b - EPS; v += step) out.push(v);
  out.push(b);
  return out;
}

// ------------------------------------------------------------------ grid tracing

/**
 * Outline of a set of grid cells (cell size 0.5 ft) as a clockwise polygon with collinear
 * vertices removed. Returns null for a region with a hole, several parts, or two cells
 * touching only at a corner (a pinch), since none of those is a valid room or zone outline.
 */
export function traceCells(has: (i: number, j: number) => boolean, i0: number, j0: number, i1: number, j1: number): Vec[] | null {
  const w = i1 - i0 + 1;
  const h = j1 - j0 + 1;
  // Each grid vertex has at most one outgoing boundary edge; a second one means a pinch.
  const next = new Int32Array(w * h).fill(-1);
  const vid = (x: number, y: number) => (y - j0) * w + (x - i0);
  let edges = 0;
  const add = (x0: number, y0: number, x1: number, y1: number): boolean => {
    const a = vid(x0, y0);
    if (next[a] !== -1) return false;
    next[a] = vid(x1, y1);
    edges++;
    return true;
  };
  for (let j = j0; j < j1; j++)
    for (let i = i0; i < i1; i++) {
      if (!has(i, j)) continue;
      if (!has(i, j - 1) && !add(i, j, i + 1, j)) return null;
      if (!has(i + 1, j) && !add(i + 1, j, i + 1, j + 1)) return null;
      if (!has(i, j + 1) && !add(i + 1, j + 1, i, j + 1)) return null;
      if (!has(i - 1, j) && !add(i, j + 1, i, j)) return null;
    }
  if (edges === 0) return null;
  let start = 0;
  while (next[start] === -1) start++;
  const loop: number[] = [];
  let k = start;
  do {
    loop.push(k);
    k = next[k];
    if (k === -1 || loop.length > edges) return null;
  } while (k !== start);
  if (loop.length !== edges) return null;
  const xy = (v: number): [number, number] => [(v % w) + i0, Math.floor(v / w) + j0];
  const pts: Vec[] = [];
  for (let n = 0; n < loop.length; n++) {
    const a = xy(loop[(n + loop.length - 1) % loop.length]);
    const b = xy(loop[n]);
    const c = xy(loop[(n + 1) % loop.length]);
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) pts.push(vec(b[0] * GRID, b[1] * GRID));
  }
  return pts;
}

/** Outline of a union of rectangles (see traceCells for the null cases). */
export function unionPolygon(rects: Rect[]): Vec[] | null {
  if (rects.length === 1) return rectPoly(rects[0]);
  const bb = bboxOfRects(rects);
  const i0 = Math.round(bb.x0 / GRID);
  const j0 = Math.round(bb.y0 / GRID);
  const i1 = Math.round(bb.x1 / GRID);
  const j1 = Math.round(bb.y1 / GRID);
  const w = i1 - i0;
  const cells = new Uint8Array(w * (j1 - j0));
  for (const r of rects)
    for (let j = Math.round(r.y0 / GRID); j < Math.round(r.y1 / GRID); j++)
      for (let i = Math.round(r.x0 / GRID); i < Math.round(r.x1 / GRID); i++) cells[(j - j0) * w + (i - i0)] = 1;
  return traceCells((i, j) => i >= i0 && i < i1 && j >= j0 && j < j1 && cells[(j - j0) * w + (i - i0)] === 1, i0, j0, i1, j1);
}

/**
 * Split a region (given as a membership test over half-foot cells) into maximal
 * rectangles by merging equal row-runs downward. Deterministic scan order.
 */
export function decomposeRects(has: (i: number, j: number) => boolean, i0: number, j0: number, i1: number, j1: number): Rect[] {
  type Run = { a: number; b: number; top: number };
  const out: Rect[] = [];
  let open: Run[] = [];
  for (let j = j0; j <= j1; j++) {
    const runs: [number, number][] = [];
    if (j < j1) {
      let start = -1;
      for (let i = i0; i <= i1; i++) {
        const on = i < i1 && has(i, j);
        if (on && start < 0) start = i;
        if (!on && start >= 0) {
          runs.push([start, i]);
          start = -1;
        }
      }
    }
    const next: Run[] = [];
    for (const r of open) {
      const hit = runs.findIndex(([a, b]) => a === r.a && b === r.b);
      if (hit >= 0) {
        next.push(r);
        runs.splice(hit, 1);
      } else out.push(R(r.a * GRID, r.top * GRID, r.b * GRID, j * GRID));
    }
    for (const [a, b] of runs) next.push({ a, b, top: j });
    open = next;
  }
  return out;
}

/** Cut the corner at `corner` of a convex-cornered polygon with a 45 degree chamfer of leg `leg`. */
export function chamferPolygon(poly: Vec[], corner: Vec, leg: number): Vec[] | null {
  const n = poly.length;
  const idx = poly.findIndex((p) => Math.abs(p.x - corner.x) < EPS && Math.abs(p.y - corner.y) < EPS);
  if (idx < 0) return null;
  const prev = poly[(idx + n - 1) % n];
  const nextV = poly[(idx + 1) % n];
  const toward = (from: Vec, to: Vec): Vec => {
    const d = dist(from, to);
    return d < leg + EPS ? vec(NaN, NaN) : vec(from.x + ((to.x - from.x) / d) * leg, from.y + ((to.y - from.y) / d) * leg);
  };
  const p1 = toward(corner, prev);
  const p2 = toward(corner, nextV);
  if (Number.isNaN(p1.x) || Number.isNaN(p2.x)) return null;
  return [...poly.slice(0, idx), p1, p2, ...poly.slice(idx + 1)];
}

export const fmt = (n: number) => String(Math.round(n * 100) / 100);
