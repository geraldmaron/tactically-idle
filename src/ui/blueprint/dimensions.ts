// Dimension lines computed from footprint and room geometry (never hardcoded).
import type { LocationDefinition } from '../../sim/types';
import { bboxOf, feetInches, r2, type Rect } from './geometry';

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
  label: string;
  /** Which edge of the sheet the line sits on (decides where its text goes). */
  side: 'top' | 'bottom' | 'left' | 'right';
}

/** Distance from the drawn frame to each dimension line, and the paper margin that holds the dimension rows. */
export const DIM_OFFSET = 1.5;
export const SHEET_MARGIN = 3.5;

function uniqueSorted(values: number[], lo: number, hi: number): number[] {
  const out = [lo, hi];
  for (const v of values) if (v > lo + 0.45 && v < hi - 0.45) out.push(r2(v));
  out.sort((p, q) => p - q);
  return out.filter((v, i) => i === 0 || Math.abs(v - out[i - 1]) > 0.05);
}

/** `frame` is the drawn area (feet); dimension rows sit just outside it. Defaults to the whole lot. */
export function computeDimensions(loc: LocationDefinition, frame?: Rect): DimLine[] {
  const fr = frame ?? { x: 0, y: 0, w: loc.bounds.w, h: loc.bounds.h };
  const fp = bboxOf(loc.footprint);
  const x1 = fp.x + fp.w;
  const y1 = fp.y + fp.h;
  const dims: DimLine[] = [];

  // Overall width on top.
  dims.push({ id: 'top', orient: 'h', a: fp.x, b: x1, line: fr.y - DIM_OFFSET, from: fp.y - 0.7, label: feetInches(fp.w), side: 'top' });
  // Overall depth on the left.
  dims.push({ id: 'left', orient: 'v', a: fp.y, b: y1, line: fr.x - DIM_OFFSET, from: fp.x - 0.7, label: feetInches(fp.h), side: 'left' });

  // Bottom: split by porch edges if a porch meets the front facade, else by room boundaries.
  const southXs: number[] = [];
  for (const z of loc.zones) {
    if (z.kind !== 'porch') continue;
    for (const p of z.polygon) if (Math.abs(p.y - y1) < 0.06) southXs.push(p.x);
  }
  if (southXs.length === 0) {
    for (const r of loc.rooms) for (const p of r.polygon) if (Math.abs(p.y - y1) < 0.06) southXs.push(p.x);
  }
  const bottom = uniqueSorted(southXs, fp.x, x1);
  if (bottom.length > 2) {
    for (let i = 0; i < bottom.length - 1; i++) {
      dims.push({ id: `bottom-${i}`, orient: 'h', a: bottom[i], b: bottom[i + 1], line: fr.y + fr.h + DIM_OFFSET, from: y1 + 0.7, label: feetInches(bottom[i + 1] - bottom[i]), side: 'bottom' });
    }
  } else {
    dims.push({ id: 'bottom', orient: 'h', a: fp.x, b: x1, line: fr.y + fr.h + DIM_OFFSET, from: y1 + 0.7, label: feetInches(fp.w), side: 'bottom' });
  }

  // Right: split by room boundaries on the east wall.
  const eastYs: number[] = [];
  for (const r of loc.rooms) for (const p of r.polygon) if (Math.abs(p.x - x1) < 0.06) eastYs.push(p.y);
  const right = uniqueSorted(eastYs, fp.y, y1);
  for (let i = 0; i < right.length - 1; i++) {
    dims.push({ id: `right-${i}`, orient: 'v', a: right[i], b: right[i + 1], line: fr.x + fr.w + DIM_OFFSET, from: x1 + 0.7, label: feetInches(right[i + 1] - right[i]), side: 'right' });
  }
  return dims;
}

/** Sheet viewBox: the drawn frame (default: the whole lot) plus margins that hold the dimension rows and the north arrow. */
export function sheetViewBox(loc: LocationDefinition, frame?: Rect): Rect {
  const fr = frame ?? { x: 0, y: 0, w: loc.bounds.w, h: loc.bounds.h };
  return { x: fr.x - SHEET_MARGIN, y: fr.y - SHEET_MARGIN, w: fr.w + 2 * SHEET_MARGIN, h: fr.h + 2 * SHEET_MARGIN };
}
