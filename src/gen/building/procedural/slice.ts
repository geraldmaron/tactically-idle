import { GRID } from './geom';

export interface Slot {
  /** Share of the free space, relative to other slots. */
  weight: number;
  min: number;
  max?: number;
  /** Exact size; the slot takes no share of the free space. */
  fixed?: number;
}

const up = (v: number) => Math.ceil(v / GRID - 1e-9) * GRID;

/**
 * Split `total` feet into slot sizes on the half-foot grid. Weights share the free space;
 * minimums are honoured first, then soft maximums. Returns null when the minimums do not fit.
 */
export function distribute(total: number, slots: Slot[]): number[] | null {
  const n = slots.length;
  const size = new Array<number>(n).fill(0);
  const locked = new Array<boolean>(n).fill(false);
  let remaining = total;
  slots.forEach((s, i) => {
    if (s.fixed !== undefined) {
      size[i] = s.fixed;
      locked[i] = true;
      remaining -= s.fixed;
    }
  });
  for (let pass = 0; pass < 2 * n + 2; pass++) {
    const free = slots.map((_, i) => i).filter((i) => !locked[i]);
    if (free.length === 0) break;
    const wsum = free.reduce((a, i) => a + Math.max(slots[i].weight, 1e-6), 0);
    let changed = false;
    for (const i of free) {
      const share = (remaining * Math.max(slots[i].weight, 1e-6)) / wsum;
      if (share < slots[i].min - 1e-9) {
        size[i] = up(slots[i].min);
        locked[i] = true;
        remaining -= size[i];
        changed = true;
        break;
      }
    }
    if (changed) continue;
    for (const i of free) {
      const share = (remaining * Math.max(slots[i].weight, 1e-6)) / wsum;
      const max = slots[i].max;
      if (max !== undefined && share > max + 1e-9 && free.length > 1) {
        size[i] = Math.floor(max / GRID) * GRID;
        locked[i] = true;
        remaining -= size[i];
        changed = true;
        break;
      }
    }
    if (!changed) {
      for (const i of free) size[i] = (remaining * Math.max(slots[i].weight, 1e-6)) / wsum;
      break;
    }
  }
  if (remaining < -1e-6 && slots.every((_, i) => locked[i])) return null;
  const snapped = size.map((v, i) => (slots[i].fixed !== undefined ? v : Math.round(v / GRID) * GRID));
  const diff = total - snapped.reduce((a, b) => a + b, 0);
  if (Math.abs(diff) > 1e-9) {
    let best = -1;
    snapped.forEach((v, i) => {
      if (slots[i].fixed === undefined && (best < 0 || v > snapped[best])) best = i;
    });
    if (best < 0) return null;
    snapped[best] += diff;
  }
  return snapped.every((v, i) => v >= slots[i].min - 1e-9 && v > 0) ? snapped : null;
}
