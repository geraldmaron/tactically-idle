import { describe, expect, it } from 'vitest';
import { pairedDelta, shareOf, wilson } from './stats';

describe('wilson', () => {
  // Published Wilson 95% intervals (z = 1.96), e.g. Newcombe 1998 table I and standard calculators.
  const known: [k: number, n: number, lo: number, hi: number][] = [
    [0, 10, 0, 0.2775],
    [1, 10, 0.0179, 0.4042],
    [5, 10, 0.2366, 0.7634],
    [9, 10, 0.5958, 0.9821],
    [10, 10, 0.7225, 1],
    [81, 263, 0.2553, 0.3662],
    [15, 148, 0.0624, 0.1605],
    [0, 20, 0, 0.1611],
  ];
  for (const [k, n, lo, hi] of known) {
    it(`${k} of ${n}`, () => {
      const [a, b] = wilson(k, n);
      expect(a).toBeCloseTo(lo, 4);
      expect(b).toBeCloseTo(hi, 4);
    });
  }

  it('is symmetric: k of n mirrors n - k of n', () => {
    const [lo, hi] = wilson(37, 120);
    const [lo2, hi2] = wilson(83, 120);
    expect(lo).toBeCloseTo(1 - hi2, 12);
    expect(hi).toBeCloseTo(1 - lo2, 12);
  });

  it('narrows with more runs and stays inside 0..1', () => {
    const small = wilson(41, 100), large = wilson(164, 400);
    expect(large[1] - large[0]).toBeLessThan(small[1] - small[0]);
    for (const [k, n] of [[0, 1], [1, 1], [3, 7], [400, 400]]) {
      const [lo, hi] = wilson(k, n);
      expect(lo).toBeGreaterThanOrEqual(0);
      expect(hi).toBeLessThanOrEqual(1);
      expect(lo).toBeLessThanOrEqual(k / n);
      expect(hi).toBeGreaterThanOrEqual(k / n);
    }
  });

  it('says nothing about a share with no runs', () => {
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
});

describe('pairedDelta', () => {
  it('is the mean per-run difference with mean ± 1.96·sd/√n', () => {
    const before = [1, 0, 1, 1, 0, 0, 1, 0];
    const after = [1, 1, 1, 0, 1, 0, 1, 1];
    const d = pairedDelta(before, after);
    // Differences: 0, 1, 0, -1, 1, 0, 0, 1 → mean 0.25, sample sd 0.7071.
    expect(d.n).toBe(8);
    expect(d.mean).toBeCloseTo(0.25, 12);
    const half = 1.959963984540054 * 0.7071067811865476 / Math.sqrt(8);
    expect(d.lo).toBeCloseTo(0.25 - half, 10);
    expect(d.hi).toBeCloseTo(0.25 + half, 10);
    expect(d.withinNoise).toBe(true);
  });

  it('pairing removes the noise two independent shares would carry', () => {
    // The same 200 runs, and the patch flips 10 of them from bad to clean: a sure +5 points.
    const before = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 1 : 0));
    const after = before.map((value, i) => (value === 0 && i < 20 ? 1 : value));
    const d = pairedDelta(before, after);
    expect(d.mean).toBeCloseTo(0.05, 12);
    expect(d.lo).toBeGreaterThan(0);
    expect(d.withinNoise).toBe(false);
  });

  it('a negative delta whose interval stays below zero is not noise', () => {
    const before = Array.from({ length: 100 }, () => 30);
    const after = before.map((value, i) => value - 2 - (i % 3));
    const d = pairedDelta(before, after);
    expect(d.mean).toBeCloseTo(-3, 1);
    expect(d.hi).toBeLessThan(0);
    expect(d.withinNoise).toBe(false);
  });

  it('identical runs give a zero delta inside the noise', () => {
    expect(pairedDelta([1, 0, 1], [1, 0, 1])).toEqual({ mean: 0, lo: 0, hi: 0, n: 3, withinNoise: true });
  });

  it('cannot estimate a spread from fewer than two pairs', () => {
    expect(pairedDelta([], [])).toMatchObject({ n: 0, withinNoise: true, lo: -Infinity, hi: Infinity });
    expect(pairedDelta([0], [1])).toMatchObject({ mean: 1, n: 1, withinNoise: true });
  });

  it('refuses runs that are not paired one to one', () => {
    expect(() => pairedDelta([1, 0], [1])).toThrow(/paired one to one/);
  });
});

describe('shareOf (few-runs rule)', () => {
  it('shows a count below 30 runs', () => {
    expect(shareOf(3, 20)).toMatchObject({ p: 0.15, showCount: true });
    expect(shareOf(9, 29).showCount).toBe(true);
    expect(shareOf(9, 30).showCount).toBe(false);
  });

  it('mutes an interval wider than 20 points', () => {
    const small = shareOf(15, 40);
    expect(small.hi - small.lo).toBeGreaterThan(0.2);
    expect(small.few).toBe(true);
    const large = shareOf(164, 400);
    expect(large.hi - large.lo).toBeLessThan(0.2);
    expect(large.few).toBe(false);
  });

  it('carries the Wilson interval', () => {
    const share = shareOf(81, 263);
    expect(share.lo).toBeCloseTo(0.2553, 4);
    expect(share.hi).toBeCloseTo(0.3662, 4);
  });

  it('handles no runs', () => {
    expect(shareOf(0, 0)).toEqual({ p: 0, lo: 0, hi: 1, few: true, showCount: true });
  });
});
