import type { Vec } from '../../sim/types';
import type { Rect } from './geometry';

export const MAX_ZOOM = 4;
export interface ScreenBounds { left: number; top: number; width: number; height: number }

/** SVG's xMidYMid meet scale, including either horizontal or vertical letterboxing. */
export function unitsPerPixel(view: Rect, width: number, height: number): number {
  return Math.max(view.w / Math.max(width, 1), view.h / Math.max(height, 1));
}

export function clampView(view: Rect, base: Rect): Rect {
  const w = Math.max(base.w / MAX_ZOOM, Math.min(base.w, Number.isFinite(view.w) ? view.w : base.w));
  const h = w * base.h / base.w;
  const x = Math.max(base.x, Math.min(base.x + base.w - w, Number.isFinite(view.x) ? view.x : base.x));
  const y = Math.max(base.y, Math.min(base.y + base.h - h, Number.isFinite(view.y) ? view.y : base.y));
  return { x, y, w, h };
}

function screenOffset(view: Rect, point: Vec, bounds: ScreenBounds): Vec {
  const scale = unitsPerPixel(view, bounds.width, bounds.height);
  return {
    x: (point.x - bounds.left - bounds.width / 2) * scale + view.w / 2,
    y: (point.y - bounds.top - bounds.height / 2) * scale + view.h / 2,
  };
}

export function screenToWorld(view: Rect, point: Vec, bounds: ScreenBounds): Vec {
  const offset = screenOffset(view, point, bounds);
  return { x: view.x + offset.x, y: view.y + offset.y };
}

/** Keep a world point under the current finger/cursor, subject only to sheet bounds. */
export function anchoredView(view: Rect, base: Rect, factor: number, anchor: Vec, point: Vec, bounds: ScreenBounds): Rect {
  const scaled = clampView({ ...view, w: view.w / (Number.isFinite(factor) && factor > 0 ? factor : 1) }, base);
  const offset = screenOffset(scaled, point, bounds);
  return clampView({ ...scaled, x: anchor.x - offset.x, y: anchor.y - offset.y }, base);
}

export function zoomAt(view: Rect, base: Rect, factor: number, point: Vec, bounds: ScreenBounds): Rect {
  return anchoredView(view, base, factor, screenToWorld(view, point, bounds), point, bounds);
}

export function panByPixels(view: Rect, base: Rect, dx: number, dy: number, bounds: ScreenBounds): Rect {
  const scale = unitsPerPixel(view, bounds.width, bounds.height);
  return clampView({ ...view, x: view.x - dx * scale, y: view.y - dy * scale }, base);
}

export function wheelZoomFactor(deltaY: number, deltaMode: number, height: number, ctrlKey: boolean): number {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(height, 1) : 1);
  return Math.exp(-Math.max(-1, Math.min(1, pixels * (ctrlKey ? 0.01 : 0.002))));
}
