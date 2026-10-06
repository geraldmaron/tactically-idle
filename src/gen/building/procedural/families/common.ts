import { type Footprint, type Shape, makeFootprint } from '../footprint';
import type { Rand } from '../rand';
import type { WindowStyle } from '../types';

/** Window glazing and covering odds shared by the dwelling families. */
export const HOME_WINDOWS: Record<string, WindowStyle> & { default: WindowStyle } = {
  default: { glazing: [['double', 7], ['single', 3]], covering: [['none', 4], ['blinds', 3], ['curtains', 3]] },
  bedroom: { glazing: [['double', 7], ['single', 3]], covering: [['curtains', 6], ['blinds', 3], ['none', 1]] },
  bath: { glazing: [['single', 6], ['double', 4]], covering: [['blinds', 7], ['curtains', 2], ['none', 1]] },
  wc: { glazing: [['single', 6], ['double', 4]], covering: [['blinds', 7], ['curtains', 2], ['none', 1]] },
  living: { glazing: [['double', 7], ['single', 3]], covering: [['curtains', 5], ['blinds', 2], ['none', 3]] },
  kitchen: { glazing: [['double', 7], ['single', 3]], covering: [['none', 6], ['blinds', 3], ['curtains', 1]] },
  hall: { glazing: [['double', 7], ['single', 3]], covering: [['none', 6], ['blinds', 2], ['curtains', 2]] },
  landing: { glazing: [['double', 7], ['single', 3]], covering: [['none', 6], ['blinds', 2], ['curtains', 2]] },
};

export const STREET_NAMES = ['Maple Street', 'Alder Court', 'Birch Lane', 'Cedar Avenue', 'Dunmore Road', 'Elm Terrace', 'Fairview Drive', 'Garnet Street', 'Harlow Circle', 'Ivy Way', 'Juniper Road', 'Kestrel Lane', 'Linden Avenue', 'Mercer Street', 'Norwood Drive', 'Orchard Row', 'Pennant Street', 'Quarry Road', 'Rowan Court', 'Sycamore Avenue', 'Thistle Lane', 'Upland Road', 'Vesper Street', 'Willow Circle'];

/** Record why a draw was abandoned (for acceptance diagnostics) and return null. */
export function no(why: ((reason: string) => void) | undefined, reason: string): null {
  why?.(reason);
  return null;
}

/** Prefix diagnostics with the footprint shape so acceptance can be read per shape. */
export function tagWhy(why: ((reason: string) => void) | undefined, shape: string): ((reason: string) => void) | undefined {
  return why ? (r) => why(`${r}:${shape}`) : undefined;
}

/**
 * Draw a footprint of `shape` whose area lies in `area`, resampling the dimensions a few
 * times; bigger shapes (T, U, extensions) need bigger envelopes to reach the same floor area.
 */
export function drawFootprint(
  rng: Rand,
  shape: Shape,
  wr: [number, number],
  dr: [number, number],
  area: [number, number],
  lim: { minWing: number; extAlign?: 'w' | 'e'; cuts?: ('nw' | 'ne' | 'sw' | 'se')[] },
): Footprint | null {
  const grow: Record<Shape, number> = { rect: 1, L: 1.12, notch: 1.04, T: 1.28, U: 1.35, ext: 1.12 };
  const g = grow[shape];
  for (let k = 0; k < 10; k++) {
    const W = rng.snapped(wr[0], Math.min(wr[1] * g, wr[1] + 12));
    const Dp = rng.snapped(dr[0], Math.min(dr[1] * g, dr[1] + 8));
    const fp = makeFootprint(shape, W, Dp, rng, lim);
    if (fp && fp.area >= area[0] && fp.area <= area[1]) return fp;
  }
  return null;
}

/** Expected floor area of a pool (required rooms in full, optional ones by probability), sq ft. */
export function poolArea(seeds: { area: number; required: boolean; prob: number; ensuite?: { area: number } }[]): number {
  return seeds.reduce((a, s) => a + (s.area + (s.ensuite?.area ?? 0)) * (s.required ? 1 : s.prob), 0);
}
