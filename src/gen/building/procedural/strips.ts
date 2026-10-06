import { GRID, R, type Rect, bboxOfRects, decomposeRects, rcx, rcy, rh, rw } from './geom';

/** A rectangle of floor that will hold one row of rooms. */
export interface Piece {
  rect: Rect;
  /** Side: runs along the strip. Cap: sits beyond the strip's end. Iso: touches nothing useful. */
  kind: 'side' | 'cap' | 'iso';
  /** Axis rooms are laid out along. */
  rowAxis: 'x' | 'y';
  /** Edge of the piece nearest the strip, null when it does not touch. */
  stripEdge: 'n' | 's' | 'e' | 'w' | null;
  /** Length of shared wall with the strip. */
  contact: number;
  /** 0 (north) to 1 (south) across the whole footprint. */
  frontness: number;
  /** True when rooms in this piece can reach an outside wall (the side away from the strip is exterior). */
  windowable: boolean;
}

export interface StripSpec {
  axis: 'v' | 'h';
  /** Cross range: x for a vertical strip, y for a horizontal one. */
  cross: [number, number];
  /** Along range: y for a vertical strip, x for a horizontal one. */
  along: [number, number];
}

export interface StripPlan {
  strip: Rect;
  pieces: Piece[];
}

export function stripRect(s: StripSpec): Rect {
  return s.axis === 'v' ? R(s.cross[0], s.along[0], s.cross[1], s.along[1]) : R(s.along[0], s.cross[0], s.along[1], s.cross[1]);
}

/**
 * Carve a hall strip out of a footprint and cut what remains into rectangular pieces. The
 * strip must lie wholly inside the footprint. Pieces are maximal in the strip's cross
 * direction so each side of the strip is one tall piece wherever the outline allows.
 */
/** Footprint cell grids by rectangle list, so repeated strip plans over one footprint share the raster. */
const baseGrids = new WeakMap<Rect[], { grid: Uint8Array; bb: Rect; i0: number; j0: number; nI: number; nJ: number }>();

function baseGrid(rects: Rect[]) {
  let g = baseGrids.get(rects);
  if (!g) {
    const bb = bboxOfRects(rects);
    const i0 = Math.round(bb.x0 / GRID);
    const j0 = Math.round(bb.y0 / GRID);
    const nI = Math.round(bb.x1 / GRID) - i0;
    const nJ = Math.round(bb.y1 / GRID) - j0;
    const grid = new Uint8Array(nI * nJ);
    for (const r of rects)
      for (let j = Math.round(r.y0 / GRID); j < Math.round(r.y1 / GRID); j++)
        for (let i = Math.round(r.x0 / GRID); i < Math.round(r.x1 / GRID); i++) grid[(j - j0) * nI + (i - i0)] = 1;
    g = { grid, bb, i0, j0, nI, nJ };
    baseGrids.set(rects, g);
  }
  return g;
}

export function planStrip(rects: Rect[], s: StripSpec, minPiece = 6, opt: { exposure?: Rect[]; noWindow?: ('n' | 's' | 'e' | 'w')[]; reserved?: Rect[] } = {}): StripPlan | null {
  const base = baseGrid(rects);
  const { bb, i0, j0, nI, nJ } = base;
  const i1 = i0 + nI;
  const j1 = j0 + nJ;
  // 0 outside the footprint, 1 floor, 2 taken by the strip or a reserved block.
  const grid = base.grid.slice();
  const fill = (r: Rect, v: number, only?: number) => {
    for (let j = Math.max(j0, Math.round(r.y0 / GRID)); j < Math.min(j1, Math.round(r.y1 / GRID)); j++)
      for (let i = Math.max(i0, Math.round(r.x0 / GRID)); i < Math.min(i1, Math.round(r.x1 / GRID)); i++) {
        const k = (j - j0) * nI + (i - i0);
        if (only === undefined || grid[k] === only) grid[k] = v;
      }
  };
  const strip = stripRect(s);
  // The strip must be wholly inside the footprint.
  for (let j = Math.round(strip.y0 / GRID); j < Math.round(strip.y1 / GRID); j++)
    for (let i = Math.round(strip.x0 / GRID); i < Math.round(strip.x1 / GRID); i++)
      if (i < i0 || i >= i1 || j < j0 || j >= j1 || grid[(j - j0) * nI + (i - i0)] !== 1) return null;
  fill(strip, 2, 1);
  for (const q of opt.reserved ?? []) fill(q, 2, 1);
  const rest = (i: number, j: number) => i >= i0 && i < i1 && j >= j0 && j < j1 && grid[(j - j0) * nI + (i - i0)] === 1;
  const raw =
    s.axis === 'v'
      ? decomposeRects(rest, i0, j0, i1, j1)
      : decomposeRects((j, i) => rest(i, j), j0, i0, j1, i1).map((r) => R(r.y0, r.x0, r.y1, r.x1));
  const exp = opt.exposure ?? rects;
  const outside = (x: number, y: number) => !exp.some((q) => x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1);
  const blocked = (side: 'n' | 's' | 'e' | 'w') => (opt.noWindow ?? []).includes(side);
  const pieces: Piece[] = [];
  for (const r of raw) {
    if (Math.min(rw(r), rh(r)) < minPiece) return null;
    const cT = contact(r, strip);
    const exposed = {
      n: outside(rcx(r), r.y0 - 0.25) && !(blocked('n') && r.y0 <= bb.y0 + 1e-9),
      s: outside(rcx(r), r.y1 + 0.25) && !(blocked('s') && r.y1 >= bb.y1 - 1e-9),
      w: outside(r.x0 - 0.25, rcy(r)) && !(blocked('w') && r.x0 <= bb.x0 + 1e-9),
      e: outside(r.x1 + 0.25, rcy(r)) && !(blocked('e') && r.x1 >= bb.x1 - 1e-9),
    };
    const stripEdge: Piece['stripEdge'] = cT.len >= 3.5 ? cT.edge : null;
    const far = stripEdge === 'n' ? 's' : stripEdge === 's' ? 'n' : stripEdge === 'e' ? 'w' : stripEdge === 'w' ? 'e' : null;
    pieces.push({
      rect: r,
      kind: cT.len < 3.5 ? 'iso' : cT.along ? 'side' : 'cap',
      rowAxis: cT.len >= 3.5 && cT.along ? (s.axis === 'v' ? 'y' : 'x') : rw(r) >= rh(r) ? 'x' : 'y',
      stripEdge,
      contact: cT.len,
      windowable: far ? exposed[far] : exposed.n || exposed.s || exposed.e || exposed.w,
      frontness: (rcy(r) - bb.y0) / Math.max(1, bb.y1 - bb.y0),
    });
  }
  return { strip, pieces };
}

/** Shared wall between a piece and the strip, and whether it runs along the strip's long axis. */
function contact(r: Rect, strip: Rect): { len: number; edge: 'n' | 's' | 'e' | 'w'; along: boolean } {
  const overlapX = Math.min(r.x1, strip.x1) - Math.max(r.x0, strip.x0);
  const overlapY = Math.min(r.y1, strip.y1) - Math.max(r.y0, strip.y0);
  const eps = 1e-9;
  const vertical = rh(strip) >= rw(strip);
  let best: { len: number; edge: 'n' | 's' | 'e' | 'w'; along: boolean } = { len: 0, edge: 'n', along: false };
  const consider = (len: number, edge: 'n' | 's' | 'e' | 'w', alongStrip: boolean) => {
    if (len > best.len) best = { len, edge, along: alongStrip };
  };
  if (Math.abs(r.x1 - strip.x0) < eps && overlapY > eps) consider(overlapY, 'e', vertical);
  if (Math.abs(r.x0 - strip.x1) < eps && overlapY > eps) consider(overlapY, 'w', vertical);
  if (Math.abs(r.y1 - strip.y0) < eps && overlapX > eps) consider(overlapX, 's', !vertical);
  if (Math.abs(r.y0 - strip.y1) < eps && overlapX > eps) consider(overlapX, 'n', !vertical);
  return best;
}
