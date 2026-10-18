// Interval maths for simulated numbers (spec section 5, rules 5 and 6). Shares carry a Wilson 95%
// interval; before/after comparisons are paired run by run (common random numbers), so the delta
// interval comes from the per-run differences, not from two independent shares.

/** 95% two-sided normal quantile. */
export const Z95 = 1.959963984540054;
/** Below this many runs a share is shown as a count ("3 of 20 runs"), not a percentage. */
export const COUNT_BELOW = 30;
/** An interval wider than this renders muted with "few runs". */
export const WIDE_INTERVAL = 0.2;

/** Wilson score interval for k successes in n trials. With no trials the share could be anything. */
export function wilson(k: number, n: number, z = Z95): [lo: number, hi: number] {
  if (n <= 0) return [0, 1];
  const p = Math.min(1, Math.max(0, k / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom;
  // At the edges the bounds are exactly 0 and 1; floating point would leave them a hair inside.
  return [k <= 0 ? 0 : Math.max(0, center - half), k >= n ? 1 : Math.min(1, center + half)];
}

export interface PairedDelta { mean: number; lo: number; hi: number; n: number; withinNoise: boolean }

/** Mean of after − before over runs paired one to one, with mean ± 1.96·sd/√n. Fewer than two
 * pairs can't estimate the spread, so the interval is unbounded and the delta is within noise. */
export function pairedDelta(before: readonly number[], after: readonly number[]): PairedDelta {
  if (before.length !== after.length) throw new Error(`pairedDelta needs runs paired one to one (${before.length} before, ${after.length} after)`);
  const n = before.length;
  if (n === 0) return { mean: 0, lo: -Infinity, hi: Infinity, n, withinNoise: true };
  const diffs = before.map((value, i) => after[i] - value);
  const mean = diffs.reduce((sum, d) => sum + d, 0) / n;
  if (n < 2) return { mean, lo: -Infinity, hi: Infinity, n, withinNoise: true };
  const variance = diffs.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (n - 1);
  const half = Z95 * Math.sqrt(variance / n);
  const lo = mean - half, hi = mean + half;
  return { mean, lo, hi, n, withinNoise: lo <= 0 && hi >= 0 };
}

/** A simulated share with its interval and the display rules: a count below COUNT_BELOW runs, muted
 * ("few runs") when the interval is wider than WIDE_INTERVAL. */
export function shareOf(k: number, n: number): { p: number; lo: number; hi: number; few: boolean; showCount: boolean } {
  const [lo, hi] = wilson(k, n);
  return { p: n > 0 ? k / n : 0, lo, hi, few: hi - lo > WIDE_INTERVAL, showCount: n < COUNT_BELOW };
}
