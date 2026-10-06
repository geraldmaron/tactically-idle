import { hashSeed, next } from '../../../sim/rng';

/**
 * Stateful wrapper over the shared mulberry32 generator in src/sim/rng.ts. It is the only
 * source of randomness in the building generator; there is no Math.random and no clock.
 */
export class Rand {
  private state: number;

  constructor(seedText: string) {
    this.state = hashSeed(seedText);
  }

  /** Uniform in [0, 1). */
  float(): number {
    const r = next(this.state);
    this.state = r.state;
    return r.value;
  }

  /** Uniform in [a, b). */
  range(a: number, b: number): number {
    return a + this.float() * (b - a);
  }

  /** Uniform value in [a, b] snapped to `step` (default half a foot). */
  snapped(a: number, b: number, step = 0.5): number {
    const lo = Math.ceil(a / step - 1e-9);
    const hi = Math.floor(b / step + 1e-9);
    if (hi <= lo) return lo * step;
    return (lo + Math.floor(this.float() * (hi - lo + 1))) * step;
  }

  /** Integer in [a, b] inclusive. */
  int(a: number, b: number): number {
    return a + Math.floor(this.float() * (b - a + 1));
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.float() * items.length)];
  }

  /** Pick by weight; items with weight <= 0 are never chosen. */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of items) total += Math.max(0, w);
    let t = this.float() * total;
    for (const [item, w] of items) {
      if (w <= 0) continue;
      t -= w;
      if (t < 0) return item;
    }
    return items[items.length - 1][0];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
