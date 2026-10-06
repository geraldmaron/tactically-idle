import { describe, expect, it } from 'vitest';
import { R, chamferPolygon, norm, decomposeRects, polyArea, sharedSegments, traceCells, unionPolygon } from './geom';
import { Rand } from './rand';
import { distribute } from './slice';
import { planStrip } from './strips';

describe('geometry', () => {
  it('traces the union of rectangles as a clockwise outline with collinear points removed', () => {
    const l = unionPolygon([R(0, 0, 10, 4), R(0, 4, 4, 10)]);
    expect(l).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }]);
    expect(polyArea(l as { x: number; y: number }[])).toBe(10 * 4 + 4 * 6);
  });

  it('rejects regions with a hole or a pinch', () => {
    const ring = (i: number, j: number) => i >= 0 && i < 6 && j >= 0 && j < 6 && !(i >= 2 && i < 4 && j >= 2 && j < 4);
    expect(traceCells(ring, 0, 0, 6, 6)).toBeNull();
    const diagonal = (i: number, j: number) => (i === 0 && j === 0) || (i === 1 && j === 1);
    expect(traceCells(diagonal, 0, 0, 2, 2)).toBeNull();
  });

  it('finds the wall two outlines share, whichever way each runs', () => {
    const a = unionPolygon([R(0, 0, 10, 8)]) as { x: number; y: number }[];
    const b = unionPolygon([R(10, 2, 18, 12)]) as { x: number; y: number }[];
    const segs = sharedSegments(a, b, 1);
    expect(segs).toHaveLength(1);
    expect(norm(segs[0].b.x - segs[0].a.x, segs[0].b.y - segs[0].a.y)).toBe(6);
  });

  it('cuts a corner with a 45 degree edge', () => {
    const cut = chamferPolygon(unionPolygon([R(0, 0, 20, 14)]) as { x: number; y: number }[], { x: 20, y: 14 }, 5) as { x: number; y: number }[];
    expect(cut).toHaveLength(5);
    expect(polyArea(cut)).toBe(20 * 14 - 12.5);
    expect(decomposeRects((i, j) => i >= 0 && i < 4 && j >= 0 && j < 2, 0, 0, 4, 2)).toEqual([R(0, 0, 2, 1)]);
  });
});

describe('slicing and strips', () => {
  it('splits a length on the half-foot grid, honouring minimums and the total', () => {
    const sizes = distribute(30, [{ weight: 3, min: 6 }, { weight: 1, min: 8 }, { weight: 1, min: 6 }]) as number[];
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(30);
    expect(sizes.every((s) => s * 2 === Math.round(s * 2))).toBe(true);
    expect(sizes[1]).toBeGreaterThanOrEqual(8);
    expect(distribute(10, [{ weight: 1, min: 6 }, { weight: 1, min: 6 }])).toBeNull();
    expect(distribute(20, [{ weight: 1, min: 4, fixed: 5 }, { weight: 1, min: 4 }])).toEqual([5, 15]);
  });

  it('cuts a hall strip and a reserved block out of a footprint into rectangular pieces', () => {
    const plan = planStrip([R(0, 0, 28, 30)], { axis: 'v', cross: [10, 14], along: [0, 30] }, 6, { reserved: [R(14, 10, 22, 20)] });
    expect(plan).not.toBeNull();
    const total = (plan?.pieces ?? []).reduce((a, p) => a + (p.rect.x1 - p.rect.x0) * (p.rect.y1 - p.rect.y0), 0);
    expect(total).toBe(28 * 30 - 4 * 30 - 8 * 10);
    expect(planStrip([R(0, 0, 28, 30)], { axis: 'v', cross: [26, 30], along: [0, 30] })).toBeNull();
  });
});

describe('random stream', () => {
  it('is reproducible and covers its ranges', () => {
    const a = new Rand('x:1');
    const b = new Rand('x:1');
    for (let i = 0; i < 20; i++) expect(a.float()).toBe(b.float());
    const r = new Rand('x:2');
    for (let i = 0; i < 200; i++) {
      const v = r.snapped(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      expect(v * 2).toBe(Math.round(v * 2));
    }
    expect(new Rand('x:3').shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
