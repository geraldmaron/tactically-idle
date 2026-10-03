import { describe, expect, it, vi } from 'vitest';
import { anchoredView, clampView, MAX_ZOOM, panByPixels, screenToWorld, wheelZoomFactor, zoomAt, type ScreenBounds } from './camera';
import { MapGestures } from './gestures';
import type { Rect } from './geometry';

const base: Rect = { x: -10, y: -20, w: 100, h: 80 };
const centered: Rect = { x: 15, y: 0, w: 50, h: 40 };
const bounds: ScreenBounds = { left: 30, top: 50, width: 500, height: 400 };

function setup(initial = centered, screen = bounds) {
  let view = { ...initial };
  const onNavigate = vi.fn();
  const onActiveChange = vi.fn();
  const gestures = new MapGestures({
    getView: () => view,
    getBase: () => base,
    getBounds: () => screen,
    moveTo: (next) => { view = next; },
    onNavigate,
    onActiveChange,
  });
  return { gestures, getView: () => view, onNavigate, onActiveChange };
}

function expectPoint(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
}

describe('blueprint camera coordinates', () => {
  it.each([
    { left: 30, top: 50, width: 800, height: 400 },
    { left: 30, top: 50, width: 500, height: 800 },
    bounds,
  ])('zooms at the actual cursor with letterboxing in $width × $height', (screen) => {
    const point = { x: screen.left + screen.width * 0.54, y: screen.top + screen.height * 0.56 };
    const anchor = screenToWorld(centered, point, screen);
    const result = zoomAt(centered, base, 1.25, point, screen);
    expectPoint(screenToWorld(result, point, screen), anchor);
    expect(result.w).toBeCloseTo(40);
  });

  it('follows the moving pinch centroid while preserving the world anchor', () => {
    const before = { x: 280, y: 250 };
    const after = { x: 320, y: 220 };
    const anchor = screenToWorld(centered, before, bounds);
    const result = anchoredView(centered, base, 1.5, anchor, after, bounds);
    expectPoint(screenToWorld(result, after, bounds), anchor);
    expect(result.w).toBeCloseTo(centered.w / 1.5);
  });

  it('clamps zoom and pan at every sheet edge without changing the aspect ratio', () => {
    for (const w of [-1, 0, 0.001, 25, 200, Infinity, NaN]) {
      for (const [x, y] of [[-1e6, -1e6], [1e6, 1e6], [NaN, Infinity]]) {
        const result = clampView({ x, y, w, h: 123 }, base);
        expect(result.w).toBeGreaterThanOrEqual(base.w / MAX_ZOOM);
        expect(result.w).toBeLessThanOrEqual(base.w);
        expect(result.w / result.h).toBeCloseTo(base.w / base.h);
        expect(result.x).toBeGreaterThanOrEqual(base.x);
        expect(result.y).toBeGreaterThanOrEqual(base.y);
        expect(result.x + result.w).toBeLessThanOrEqual(base.x + base.w);
        expect(result.y + result.h).toBeLessThanOrEqual(base.y + base.h);
      }
    }
  });

  it('uses rendered SVG units for drag at both portrait and landscape sizes', () => {
    const wide = panByPixels(centered, base, 20, -10, { ...bounds, width: 900 });
    expectPoint(wide, { x: 13, y: 1 });
    const tall = panByPixels(centered, base, 20, -10, { ...bounds, height: 900 });
    expectPoint(tall, { x: 13, y: 1 });
  });

  it('normalizes wheel units and keeps trackpad pinch increments bounded', () => {
    expect(wheelZoomFactor(1, 1, 400, false)).toBe(wheelZoomFactor(16, 0, 400, false));
    expect(wheelZoomFactor(1, 2, 400, false)).toBe(wheelZoomFactor(400, 0, 400, false));
    expect(wheelZoomFactor(-2, 0, 400, true)).toBeGreaterThan(1);
    expect(wheelZoomFactor(2, 0, 400, true)).toBeLessThan(1);
    expect(wheelZoomFactor(-10000, 0, 400, true)).toBeCloseTo(Math.E);
  });
});

describe('blueprint pointer gesture lifecycle', () => {
  it('preserves ordinary taps and small finger jitter', () => {
    const { gestures, getView, onNavigate } = setup();
    gestures.down(1, { x: 100, y: 100 });
    gestures.move(1, { x: 103, y: 102 });
    gestures.up(1);
    expect(getView()).toEqual(centered);
    expect(gestures.blocksClick(1)).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('pans with one pointer, suppresses its click, and immediately allows the next tap', () => {
    const { gestures, getView, onNavigate, onActiveChange } = setup();
    gestures.down(1, { x: 100, y: 100 });
    gestures.move(1, { x: 130, y: 120 });
    expectPoint(getView(), { x: 12, y: -2 });
    gestures.up(1);
    expect(gestures.blocksClick(1)).toBe(true);
    expect(gestures.blocksClick(0)).toBe(false);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
    gestures.down(2, { x: 100, y: 100 });
    gestures.up(2);
    expect(gestures.blocksClick(1)).toBe(false);
  });

  it('does not accidentally select a room when dragging a fully fitted map', () => {
    const { gestures, getView } = setup(base);
    gestures.down(1, { x: 100, y: 100 });
    gestures.move(1, { x: 160, y: 180 });
    gestures.up(1);
    expect(getView()).toEqual(base);
    expect(gestures.blocksClick(1)).toBe(true);
  });

  it('pinches from fit, anchored at the original centroid', () => {
    const { gestures, getView } = setup(base);
    gestures.down(1, { x: 230, y: 250 });
    gestures.down(2, { x: 330, y: 250 });
    gestures.move(1, { x: 180, y: 250 });
    gestures.move(2, { x: 380, y: 250 });
    expect(getView().w).toBeCloseTo(50);
    expectPoint(screenToWorld(getView(), { x: 280, y: 250 }, bounds), { x: 40, y: 20 });
    gestures.up(1);
    gestures.up(2);
    expect(gestures.blocksClick(1)).toBe(true);
  });

  it('translates a pinch centroid without drifting from its original world anchor', () => {
    const { gestures, getView } = setup();
    const originalCentroid = { x: 280, y: 250 };
    const anchor = screenToWorld(centered, originalCentroid, bounds);
    gestures.down(1, { x: 230, y: 250 });
    gestures.down(2, { x: 330, y: 250 });
    gestures.move(1, { x: 225, y: 270 });
    gestures.move(2, { x: 375, y: 270 });
    expect(getView().w).toBeCloseTo(50 / 1.5);
    expectPoint(screenToWorld(getView(), { x: 300, y: 270 }, bounds), anchor);
  });

  it('continues dragging with the remaining finger after a pinch without jumping', () => {
    const { gestures, getView } = setup();
    gestures.down(1, { x: 230, y: 250 });
    gestures.down(2, { x: 330, y: 250 });
    gestures.move(2, { x: 380, y: 250 });
    const beforeLift = { ...getView() };
    gestures.up(1);
    expect(getView()).toEqual(beforeLift);
    gestures.move(2, { x: 410, y: 260 });
    expectPoint(getView(), panByPixels(beforeLift, base, 30, 10, bounds));
  });

  it('ignores a third finger until it replaces a lifted primary pointer', () => {
    const { gestures, getView } = setup();
    gestures.down(1, { x: 230, y: 250 });
    gestures.down(2, { x: 330, y: 250 });
    gestures.down(3, { x: 400, y: 280 });
    gestures.move(3, { x: 500, y: 400 });
    expect(getView()).toEqual(centered);
    gestures.up(1);
    expect(getView()).toEqual(centered);
    gestures.move(3, { x: 510, y: 400 });
    expect(getView().w).toBeLessThan(centered.w);
    expect(gestures.pointerCount).toBe(2);
  });

  it('recovers from pointercancel, lost capture, unknown and repeated end events', () => {
    const { gestures, getView } = setup();
    gestures.down(1, { x: 230, y: 250 });
    gestures.down(2, { x: 330, y: 250 });
    gestures.up(1, true);
    gestures.up(1, true);
    gestures.move(99, { x: -999, y: 999 });
    gestures.move(2, { x: 350, y: 250 });
    expectPoint(getView(), { x: 13, y: 0 });
    gestures.cancel();
    expect(gestures.pointerCount).toBe(0);
    expect(gestures.blocksClick(1)).toBe(true);
    gestures.down(5, { x: 200, y: 200 });
    gestures.up(5);
    expect(gestures.blocksClick(1)).toBe(false);
  });

  it('keeps coincident contacts finite and can pinch once they separate', () => {
    const { gestures, getView } = setup();
    gestures.down(1, { x: 280, y: 250 });
    gestures.down(2, { x: 280, y: 250 });
    gestures.move(2, { x: 290, y: 250 });
    expect(getView()).toEqual(centered);
    gestures.move(2, { x: 300, y: 250 });
    expect(Object.values(getView()).every(Number.isFinite)).toBe(true);
    expect(getView().w).toBeCloseTo(base.w / MAX_ZOOM);
  });

  it('reverses immediately after reaching a pan bound', () => {
    const { gestures, getView } = setup();
    gestures.down(1, { x: 280, y: 250 });
    gestures.move(1, { x: 2000, y: 250 });
    expect(getView().x).toBe(base.x);
    gestures.move(1, { x: 1990, y: 250 });
    expect(getView().x).toBeCloseTo(base.x + 1);
  });

  it('supports repeated pinch cycles without scale or centroid drift', () => {
    const { gestures, getView } = setup();
    for (let i = 0; i < 100; i++) {
      gestures.down(1, { x: 230, y: 250 });
      gestures.down(2, { x: 330, y: 250 });
      gestures.move(1, { x: 220, y: 250 });
      gestures.move(2, { x: 340, y: 250 });
      gestures.move(1, { x: 230, y: 250 });
      gestures.move(2, { x: 330, y: 250 });
      gestures.up(2);
      gestures.up(1);
    }
    expectPoint(getView(), centered);
    expect(getView().w).toBeCloseTo(centered.w, 9);
    expect(getView().h).toBeCloseTo(centered.h, 9);
    expect(gestures.pointerCount).toBe(0);
  });
});
