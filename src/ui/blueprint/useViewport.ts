// A single SVG viewBox keeps every object, label, annotation and hit target together.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Rect } from './geometry';
import { clampView } from './camera';
export { MAX_ZOOM, clampView, unitsPerPixel } from './camera';

const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useViewport(base: Rect, sceneKey = '') {
  const [view, setView] = useState<Rect>(base);
  const viewRef = useRef(view);
  const baseRef = useRef(base);
  baseRef.current = base;
  const previousScene = useRef({ base, sceneKey });
  const raf = useRef(0);
  const baseKey = `${base.x},${base.y},${base.w},${base.h}`;

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);

  // Update the ref immediately: several touch/wheel events can precede React's next render.
  const publish = useCallback((next: Rect) => {
    viewRef.current = next;
    setView(next);
  }, []);
  const getView = useCallback(() => viewRef.current, []);
  const getBase = useCallback(() => baseRef.current, []);

  const moveTo = useCallback((next: Rect) => {
    stop();
    publish(clampView(next, baseRef.current));
  }, [stop, publish]);

  const animateTo = useCallback((target: Rect) => {
    const goal = clampView(target, baseRef.current);
    stop();
    if (prefersReducedMotion()) {
      publish(goal);
      return;
    }
    const from = viewRef.current;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 240);
      const ease = 1 - Math.pow(1 - t, 3);
      publish({ x: from.x + (goal.x - from.x) * ease, y: from.y + (goal.y - from.y) * ease, w: from.w + (goal.w - from.w) * ease, h: from.h + (goal.h - from.h) * ease });
      raf.current = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  }, [publish, stop]);

  useEffect(() => {
    const previous = previousScene.current;
    const currentBase = baseRef.current;
    const current = viewRef.current;
    const priorZoom = previous.base.w / current.w;
    if (previous.sceneKey !== sceneKey || priorZoom <= 1.01) moveTo(currentBase);
    else {
      // Knowledge can expand the sheet. Keep the player's world center and relative zoom.
      const w = currentBase.w / priorZoom;
      const h = currentBase.h / priorZoom;
      moveTo({ x: current.x + (current.w - w) / 2, y: current.y + (current.h - h) / 2, w, h });
    }
    previousScene.current = { base: currentBase, sceneKey };
    return stop;
  }, [baseKey, sceneKey, moveTo, stop]);

  const zoomBy = useCallback((factor: number) => {
    const current = viewRef.current;
    const shape = clampView({ ...current, w: current.w / factor }, baseRef.current);
    animateTo({ ...shape, x: current.x + (current.w - shape.w) / 2, y: current.y + (current.h - shape.h) / 2 });
  }, [animateTo]);

  const reset = useCallback(() => animateTo(baseRef.current), [animateTo]);

  const zoomToRect = useCallback((rect: Rect, pad = 2.5) => {
    const aspect = baseRef.current.w / baseRef.current.h;
    let w = rect.w + pad * 2;
    let h = rect.h + pad * 2;
    if (w / h < aspect) w = h * aspect;
    else h = w / aspect;
    // Clamp size before centering, so tiny rooms don't move toward a sheet edge at max zoom.
    const shape = clampView({ x: rect.x, y: rect.y, w, h }, baseRef.current);
    animateTo({ ...shape, x: rect.x + (rect.w - shape.w) / 2, y: rect.y + (rect.h - shape.h) / 2 });
  }, [animateTo]);

  return { view, zoom: base.w / view.w, getView, getBase, moveTo, stop, zoomBy, reset, zoomToRect };
}
