import type { Rand } from './rand';
import { R, type Rect, rarea } from './geom';

export type Shape = 'rect' | 'L' | 'T' | 'U' | 'notch' | 'ext';

export interface Footprint {
  shape: Shape;
  /** Tiling of the footprint, house-local feet (origin at the north-west corner of its bounding box). */
  rects: Rect[];
  W: number;
  D: number;
  area: number;
  /** Corner of the bounding box that is cut, for L and notch shapes. */
  cut?: 'nw' | 'ne' | 'sw' | 'se';
}

export interface FootprintLimits {
  /** Smallest thickness of any wing, feet. */
  minWing: number;
}

/**
 * Footprint shapes are unions of one to three axis-aligned rectangles. The street is on the
 * south (high y). Every wing thickness stays at or above `minWing`, so any wing can hold a
 * row of rooms.
 */
export function makeFootprint(shape: Shape, W: number, D: number, rng: Rand, lim: FootprintLimits & { extAlign?: 'w' | 'e'; cuts?: ('nw' | 'ne' | 'sw' | 'se')[] }): Footprint | null {
  const m = lim.minWing;
  const done = (rects: Rect[], extra: Partial<Footprint> = {}): Footprint => ({ shape, rects, W, D, area: rects.reduce((a, r) => a + rarea(r), 0), ...extra });
  switch (shape) {
    case 'rect':
      return done([R(0, 0, W, D)]);
    case 'L':
    case 'notch': {
      const small = shape === 'notch';
      const vwLo = Math.max(small ? 7 : m, small ? 0 : 0.3 * W);
      const vwHi = small ? Math.min(0.26 * W, W - m) : Math.min(0.5 * W, W - m);
      const vdLo = Math.max(small ? 7 : m, small ? 0 : 0.3 * D);
      const vdHi = small ? Math.min(0.26 * D, D - m) : Math.min(0.5 * D, D - m);
      if (vwHi < vwLo || vdHi < vdLo) return null;
      const vw = rng.snapped(vwLo, vwHi);
      const vd = rng.snapped(vdLo, vdHi);
      const cut = rng.pick(lim.cuts ?? (['nw', 'ne', 'sw', 'se'] as const));
      const x0 = cut === 'nw' || cut === 'sw' ? vw : 0;
      const x1 = cut === 'nw' || cut === 'sw' ? W : W - vw;
      const north = cut === 'nw' || cut === 'ne';
      const band = north ? R(0, vd, W, D) : R(0, 0, W, D - vd);
      const arm = north ? R(x0, 0, x1, vd) : R(x0, D - vd, x1, D);
      return done([band, arm], { cut });
    }
    case 'T': {
      const bt = rng.snapped(Math.max(m, 0.3 * D), Math.min(0.5 * D, D - m));
      const sw = rng.snapped(Math.max(2 * m, 0.4 * W), Math.min(0.65 * W, W - 2 * m + 2));
      if (bt > D - m || sw >= W - 2 * m + 1) return null;
      const sx0 = rng.snapped(Math.max(m, (W - sw) / 2 - 3), Math.min(W - m - sw, (W - sw) / 2 + 3));
      const barNorth = rng.chance(0.5);
      return done(barNorth ? [R(0, 0, W, bt), R(sx0, bt, sx0 + sw, D)] : [R(0, D - bt, W, D), R(sx0, 0, sx0 + sw, D - bt)]);
    }
    case 'U': {
      const bt = rng.snapped(Math.max(m, 0.38 * D), Math.min(0.55 * D, D - m - 2));
      const l1 = rng.snapped(Math.max(m, 0.24 * W), Math.min(0.36 * W, W - 2 * m - 2));
      const l2 = rng.snapped(Math.max(m, 0.24 * W), Math.min(0.36 * W, W - 2 * m - 2));
      if (W - l1 - l2 < 8 || D - bt < 8) return null;
      const baseNorth = rng.chance(0.5);
      return baseNorth
        ? done([R(0, 0, W, bt), R(0, bt, l1, D), R(W - l2, bt, W, D)])
        : done([R(0, D - bt, W, D), R(0, 0, l1, D - bt), R(W - l2, 0, W, D - bt)]);
    }
    case 'ext': {
      const ed = rng.snapped(Math.max(9, m), Math.min(14, D - 16));
      const ew = rng.snapped(Math.max(2 * m, 0.4 * W), Math.min(0.72 * W, W - 4));
      if (D - ed < 14 || ew > W) return null;
      const align = lim.extAlign ?? rng.pick(['w', 'c', 'e'] as const);
      const ex0 = align === 'w' ? 0 : align === 'e' ? W - ew : Math.floor((W - ew) / 2 / 0.5) * 0.5;
      return done([R(0, ed, W, D), R(ex0, 0, ex0 + ew, ed)]);
    }
  }
}
