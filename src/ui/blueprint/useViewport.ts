// Pan/zoom state for the blueprint, expressed as a viewBox in feet. Keeps the aspect of the base sheet.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Rect } from './geometry';

export const MAX_ZOOM = 4;

const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function clampView(v: Rect, base: Rect): Rect {
  const w = Math.max(base.w / MAX_ZOOM, Math.min(base.w, v.w));
  const h = (w * base.h) / base.w;
  const x = Math.max(base.x, Math.min(base.x + base.w - w, v.x));
  const y = Math.max(base.y, Math.min(base.y + base.h - h, v.y));
  return { x, y, w, h };
}

export function useViewport(base: Rect) {
  const [view, setView] = useState<Rect>(base);
  const viewRef = useRef(view);
  viewRef.current = view;
  const raf = useRef(0);
  const baseKey = `${base.x},${base.y},${base.w},${base.h}`;

  const cancel = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  };

  const animateTo = useCallback(
    (target: Rect) => {
      const goal = clampView(target, base);
      cancel();
      if (prefersReducedMotion()) {
        setView(goal);
        return;
      }
      const from = viewRef.current;
      const t0 = performance.now();
      const dur = 240;
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        setView({ x: from.x + (goal.x - from.x) * e, y: from.y + (goal.y - from.y) * e, w: from.w + (goal.w - from.w) * e, h: from.h + (goal.h - from.h) * e });
        raf.current = t < 1 ? requestAnimationFrame(tick) : 0;
      };
      raf.current = requestAnimationFrame(tick);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey],
  );

  useEffect(() => {
    cancel();
    setView(base);
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  const zoomBy = useCallback(
    (factor: number) => {
      const v = viewRef.current;
      const w = v.w / factor;
      const h = (w * base.h) / base.w;
      animateTo({ x: v.x + v.w / 2 - w / 2, y: v.y + v.h / 2 - h / 2, w, h });
    },
    [animateTo, base],
  );

  const reset = useCallback(() => animateTo(base), [animateTo, base]);

  const zoomToRect = useCallback(
    (r: Rect, pad = 2.5) => {
      const aspect = base.w / base.h;
      let w = r.w + pad * 2;
      let h = r.h + pad * 2;
      if (w / h < aspect) w = h * aspect;
      else h = w / aspect;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      animateTo({ x: cx - w / 2, y: cy - h / 2, w, h });
    },
    [animateTo, base],
  );

  /** Immediate pan (no animation), used while dragging. */
  const panTo = useCallback(
    (x: number, y: number) => {
      cancel();
      const v = viewRef.current;
      setView(clampView({ ...v, x, y }, base));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey],
  );

  const zoom = base.w / view.w;
  return { view, zoom, zoomBy, reset, zoomToRect, panTo };
}
