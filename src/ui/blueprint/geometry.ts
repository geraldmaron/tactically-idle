// Small geometry + seeded-randomness helpers for the blueprint renderer. Feet, y down.
import type { Polygon, Vec } from '../../sim/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const unit = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;

export const r2 = (n: number): number => Math.round(n * 100) / 100;
export const pt = (p: Vec): string => `${r2(p.x)} ${r2(p.y)}`;

export function pointInPolygon(p: Vec, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-9) return len(sub(p, a));
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return len(sub(p, add(a, scale(ab, t))));
}

export function distToPolygonEdges(p: Vec, poly: Polygon): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return best;
}

export function bboxOf(poly: Polygon): Rect {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function rectsOverlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export const inflate = (r: Rect, m: number): Rect => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });

/** Axis-aligned bounds of a point set. */
export function pointsRect(pts: Vec[]): Rect {
  return bboxOf(pts);
}

export function polyPath(poly: Polygon): string {
  return poly.map((p, i) => `${i ? 'L' : 'M'}${r2(p.x)} ${r2(p.y)}`).join(' ') + ' Z';
}

// ------------------------------------------------------------------ seeded randomness

export function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // final avalanche
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seeded = (key: string): (() => number) => mulberry32(hash32(key));

/** Smooth closed/open curve through points (Catmull-Rom to cubic Bezier). */
export function smoothPath(pts: Vec[], closed = false): string {
  const n = pts.length;
  if (n < 2) return '';
  const P = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${r2(c1.x)} ${r2(c1.y)} ${r2(c2.x)} ${r2(c2.y)} ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return d + (closed ? ' Z' : '');
}

// ------------------------------------------------------------------ feet-inches

/** 38 -> 38'-0"; 12.5 -> 12'-6". */
export function feetInches(ft: number): string {
  let totalIn = Math.round(ft * 12);
  const sign = totalIn < 0 ? '-' : '';
  totalIn = Math.abs(totalIn);
  const f = Math.floor(totalIn / 12);
  const i = totalIn % 12;
  return `${sign}${f}'-${i}"`;
}

// ------------------------------------------------------------------ clipping + rect helpers

/** Sutherland-Hodgman clip of a polygon to an axis-aligned rectangle. */
export function clipPolyToRect(poly: Polygon, r: Rect): Polygon {
  type Edge = { inside: (p: Vec) => boolean; cut: (a: Vec, b: Vec) => Vec };
  const x0 = r.x;
  const x1 = r.x + r.w;
  const y0 = r.y;
  const y1 = r.y + r.h;
  const atX = (x: number) => (a: Vec, b: Vec): Vec => ({ x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) });
  const atY = (y: number) => (a: Vec, b: Vec): Vec => ({ y, x: a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y) });
  const edges: Edge[] = [
    { inside: (p) => p.x >= x0, cut: atX(x0) },
    { inside: (p) => p.x <= x1, cut: atX(x1) },
    { inside: (p) => p.y >= y0, cut: atY(y0) },
    { inside: (p) => p.y <= y1, cut: atY(y1) },
  ];
  let out = poly;
  for (const e of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (e.inside(cur)) {
        if (!e.inside(prev)) out.push(e.cut(prev, cur));
        out.push(cur);
      } else if (e.inside(prev)) out.push(e.cut(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}

export const rectContains = (outer: Rect, inner: Rect, tol = 0): boolean =>
  inner.x >= outer.x - tol && inner.y >= outer.y - tol && inner.x + inner.w <= outer.x + outer.w + tol && inner.y + inner.h <= outer.y + outer.h + tol;

/** Area of `r` lying outside `frame`. */
export function areaOutside(r: Rect, frame: Rect): number {
  const w = Math.max(0, Math.min(r.x + r.w, frame.x + frame.w) - Math.max(r.x, frame.x));
  const h = Math.max(0, Math.min(r.y + r.h, frame.y + frame.h) - Math.max(r.y, frame.y));
  return r.w * r.h - w * h;
}

/** Intersection of segment a->b with segment c->d: parameter t along a->b, or null. */
export function segIntersectT(a: Vec, b: Vec, c: Vec, d: Vec): number | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-9) return null;
  const qp = sub(c, a);
  const t = cross(qp, s) / den;
  const u = cross(qp, r) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

// ------------------------------------------------------------------ polygon helpers (L/T/U footprints, chamfers)

/** Signed area (shoelace). Positive = clockwise in a y-down frame, which is how rooms are authored. */
export function signedArea(poly: Polygon): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export const polygonAreaAbs = (poly: Polygon): number => Math.abs(signedArea(poly));

/** True when the polygon is its own bounding box (no notches, no chamfer). */
export function isRectilinearBox(poly: Polygon): boolean {
  const bb = bboxOf(poly);
  return Math.abs(polygonAreaAbs(poly) - bb.w * bb.h) < 0.05;
}

/** Signed distance from `p` to the polygon outline: positive inside, negative outside. */
function signedDistToPolygon(p: Vec, poly: Polygon): number {
  const d = distToPolygonEdges(p, poly);
  return pointInPolygon(p, poly) ? d : -d;
}

/**
 * Pole of inaccessibility: the interior point farthest from every edge (polylabel). Gives a label
 * anchor that stays inside L, T and U shaped rooms where the centroid can fall outside. `distance`
 * is the clearance at that point.
 */
export function poleOfInaccessibility(poly: Polygon, precision = 0.15): { x: number; y: number; distance: number } {
  const bb = bboxOf(poly);
  const cell0 = Math.min(bb.w, bb.h) / 2 || 1;
  type Cell = { x: number; y: number; h: number; d: number; max: number };
  const mk = (x: number, y: number, h: number): Cell => {
    const d = signedDistToPolygon({ x, y }, poly);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };
  const queue: Cell[] = [];
  for (let x = bb.x; x < bb.x + bb.w; x += cell0 * 2) for (let y = bb.y; y < bb.y + bb.h; y += cell0 * 2) queue.push(mk(x + cell0, y + cell0, cell0));
  let best = mk(bb.x + bb.w / 2, bb.y + bb.h / 2, 0);
  for (const c of queue) if (c.d > best.d) best = c;
  let guard = 0;
  while (queue.length && guard++ < 4000) {
    queue.sort((a, b) => b.max - a.max);
    const c = queue.shift()!;
    if (c.d > best.d) best = c;
    if (c.max - best.d <= precision) continue;
    const h = c.h / 2;
    queue.push(mk(c.x - h, c.y - h, h), mk(c.x + h, c.y - h, h), mk(c.x - h, c.y + h, h), mk(c.x + h, c.y + h, h));
  }
  return { x: best.x, y: best.y, distance: best.d };
}

/** Outward unit normal of edge i (assumes a simple polygon). */
export function edgeOutwardNormal(poly: Polygon, i: number): Vec {
  const a = poly[i];
  const b = poly[(i + 1) % poly.length];
  const d = unit(sub(b, a));
  const n = perp(d); // (-dy, dx)
  // In a y-down frame, positive shoelace area = clockwise, whose outward normal is (dy, -dx) = -perp.
  return signedArea(poly) > 0 ? scale(n, -1) : n;
}

/** Polygon centroid by area weighting; falls back to the vertex mean for degenerate shapes. */
export function polyCentroid(poly: Polygon): Vec {
  const A = signedArea(poly);
  if (Math.abs(A) < 1e-9) return { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length };
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}
