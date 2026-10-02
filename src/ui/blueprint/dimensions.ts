// Dimension lines computed from footprint and room geometry (never hardcoded).
import type { LocationDefinition } from '../../sim/types';
import type { Polygon, Vec } from '../../sim/types';
import { bboxOf, dot, edgeOutwardNormal, feetInches, r2, type Rect } from './geometry';
import { computeFront } from './layout';

export interface DimLine {
  id: string;
  orient: 'h' | 'v';
  /** Measured span along the line's axis (x for h, y for v). */
  a: number;
  b: number;
  /** Fixed coordinate of the dimension line itself (y for h, x for v). */
  line: number;
  /** Extension lines run from `from` to `line` (same fixed axis). */
  from: number;
  /** Extension line at the `b` end when the outline steps there (notched or chamfered footprints); defaults to `from`. */
  from2?: number;
  label: string;
  /** Which edge of the sheet the line sits on (decides where its text goes). */
  side: 'top' | 'bottom' | 'left' | 'right';
}

/** Distance from the drawn frame to each dimension line, and the paper margin that holds the dimension rows. */
export const DIM_OFFSET = 1.5;
export const SHEET_MARGIN = 3.5;

type Side = 'N' | 'E' | 'S' | 'W';
const SIDE_VEC: Record<Side, Vec> = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };
const horizontal = (s: Side) => s === 'N' || s === 'S';
const FACING = 0.35;

interface Edge {
  a: Vec;
  b: Vec;
}

/** Footprint edges whose outward normal points toward `side` (a chamfer faces two sides). */
function facingEdges(fp: Polygon, side: Side): Edge[] {
  const out: Edge[] = [];
  for (let i = 0; i < fp.length; i++) if (dot(edgeOutwardNormal(fp, i), SIDE_VEC[side]) > FACING) out.push({ a: fp[i], b: fp[(i + 1) % fp.length] });
  return out;
}

/** Position (across the side's axis) of the outermost facing edge over coordinate `along`; null when none covers it. */
function outerAt(edges: Edge[], side: Side, along: number): number | null {
  const h = horizontal(side);
  let best: number | null = null;
  for (const e of edges) {
    const a0 = h ? e.a.x : e.a.y;
    const a1 = h ? e.b.x : e.b.y;
    if (Math.abs(a1 - a0) < 0.01) continue;
    if (along < Math.min(a0, a1) - 0.01 || along > Math.max(a0, a1) + 0.01) continue;
    const t = (along - a0) / (a1 - a0);
    const across = h ? e.a.y + (e.b.y - e.a.y) * t : e.a.x + (e.b.x - e.a.x) * t;
    const outward = side === 'S' || side === 'E' ? best === null || across > best : best === null || across < best;
    if (outward) best = across;
  }
  return best;
}

function distToEdge(p: Vec, e: Edge): number {
  const dx = e.b.x - e.a.x;
  const dy = e.b.y - e.a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - e.a.x) * dx + (p.y - e.a.y) * dy) / l2));
  return Math.hypot(p.x - (e.a.x + dx * t), p.y - (e.a.y + dy * t));
}

/** The side of the footprint that faces the street: the street zone's side, else the front door's, else south. */
export function streetSide(loc: LocationDefinition): Side {
  const fp = bboxOf(loc.footprint);
  const c = { x: fp.x + fp.w / 2, y: fp.y + fp.h / 2 };
  const toSide = (v: Vec): Side => (Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'E' : 'W') : v.y > 0 ? 'S' : 'N');
  const streets = loc.zones.filter((z) => z.kind === 'street' || z.tags.includes('street'));
  let best: { side: Side; d: number } | null = null;
  for (const z of streets) {
    const zb = bboxOf(z.polygon);
    const dx = Math.max(zb.x - (fp.x + fp.w), fp.x - (zb.x + zb.w), 0);
    const dy = Math.max(zb.y - (fp.y + fp.h), fp.y - (zb.y + zb.h), 0);
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { side: toSide({ x: zb.x + zb.w / 2 - c.x, y: zb.y + zb.h / 2 - c.y }), d };
  }
  if (best) return best.side;
  const front = computeFront(loc);
  return front ? toSide(front.out) : 'S';
}

function uniqueSorted(values: number[], lo: number, hi: number): number[] {
  const out = [lo, hi];
  for (const v of values) if (v > lo + 0.45 && v < hi - 0.45) out.push(r2(v));
  out.sort((p, q) => p - q);
  return out.filter((v, i) => i === 0 || Math.abs(v - out[i - 1]) > 0.05);
}

/**
 * `frame` is the drawn area (feet); dimension rows sit just outside it. Defaults to the whole lot.
 * Overall width and depth are always given (top and left). The side facing the street carries the segment
 * chain: breakpoints at every step and chamfer vertex of that side plus porch edges (or, failing a porch,
 * room walls meeting the outline). The east side is chained by room walls too. Stepped outlines get
 * extension lines that reach the actual wall at each end.
 */
export function computeDimensions(loc: LocationDefinition, frame?: Rect): DimLine[] {
  const fr = frame ?? { x: 0, y: 0, w: loc.bounds.w, h: loc.bounds.h };
  const fpPoly = loc.footprint;
  const fp = bboxOf(fpPoly);
  const primary = streetSide(loc);
  const chainH: Side = primary === 'N' ? 'N' : 'S';
  const chainV: Side = primary === 'W' ? 'W' : 'E';
  const dims: DimLine[] = [];

  const lineAt = (side: Side) => (side === 'N' ? fr.y - DIM_OFFSET : side === 'S' ? fr.y + fr.h + DIM_OFFSET : side === 'W' ? fr.x - DIM_OFFSET : fr.x + fr.w + DIM_OFFSET);
  const bboxEdge = (side: Side) => (side === 'N' ? fp.y : side === 'S' ? fp.y + fp.h : side === 'W' ? fp.x : fp.x + fp.w);
  const away = (side: Side, v: number) => (side === 'S' || side === 'E' ? v + 0.7 : v - 0.7);
  const orient = (side: Side): 'h' | 'v' => (horizontal(side) ? 'h' : 'v');

  const overall = (side: Side, id: string) => {
    const edges = facingEdges(fpPoly, side);
    const h = horizontal(side);
    const a = h ? fp.x : fp.y;
    const b = h ? fp.x + fp.w : fp.y + fp.h;
    const fa = outerAt(edges, side, a + 0.02) ?? bboxEdge(side);
    const fb = outerAt(edges, side, b - 0.02) ?? bboxEdge(side);
    dims.push({ id, orient: orient(side), a, b, line: lineAt(side), from: away(side, fa), from2: away(side, fb), label: feetInches(b - a), side: side === 'N' ? 'top' : side === 'S' ? 'bottom' : side === 'W' ? 'left' : 'right' });
  };

  const chain = (side: Side, preferPorch: boolean) => {
    const edges = facingEdges(fpPoly, side);
    const h = horizontal(side);
    const lo = h ? fp.x : fp.y;
    const hi = h ? fp.x + fp.w : fp.y + fp.h;
    const alongOf = (p: Vec) => (h ? p.x : p.y);
    const onOutline = (p: Vec) => edges.some((e) => distToEdge(p, e) < 0.06);
    const bps: number[] = [];
    for (const e of edges) bps.push(alongOf(e.a), alongOf(e.b));
    let extras: number[] = [];
    if (preferPorch) for (const z of loc.zones) if (z.kind === 'porch') for (const p of z.polygon) if (onOutline(p)) extras.push(alongOf(p));
    if (extras.length === 0) for (const r of loc.rooms) for (const p of r.polygon) if (onOutline(p)) extras.push(alongOf(p));
    const pts = uniqueSorted([...bps, ...extras], lo, hi);
    const sideName = side === 'N' ? 'top' : side === 'S' ? 'bottom' : side === 'W' ? 'left' : 'right';
    if (pts.length <= 2) {
      overall(side, sideName);
      return;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const fa = outerAt(edges, side, a + (b - a) * 0.5) ?? bboxEdge(side);
      dims.push({ id: `${sideName}-${i}`, orient: orient(side), a, b, line: lineAt(side), from: away(side, fa), label: feetInches(b - a), side: sideName });
    }
  };

  // horizontal pair
  if (chainH === 'S') {
    overall('N', 'top');
    chain('S', primary === 'S');
  } else {
    overall('S', 'bottom');
    chain('N', true);
  }
  // vertical pair
  if (chainV === 'E') {
    overall('W', 'left');
    chain('E', primary === 'E');
  } else {
    overall('E', 'right');
    chain('W', true);
  }
  return dims;
}

/** Sheet viewBox: the drawn frame (default: the whole lot) plus margins that hold the dimension rows and the north arrow. */
export function sheetViewBox(loc: LocationDefinition, frame?: Rect, extraTop = 0): Rect {
  const fr = frame ?? { x: 0, y: 0, w: loc.bounds.w, h: loc.bounds.h };
  return { x: fr.x - SHEET_MARGIN, y: fr.y - SHEET_MARGIN - extraTop, w: fr.w + 2 * SHEET_MARGIN, h: fr.h + 2 * SHEET_MARGIN + extraTop };
}
