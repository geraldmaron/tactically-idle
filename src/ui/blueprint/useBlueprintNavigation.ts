import { useEffect, useRef, type RefObject } from 'react';
import { MapGestures } from './gestures';
import { panByPixels, wheelZoomFactor, zoomAt } from './camera';
import type { useViewport } from './useViewport';

type Camera = ReturnType<typeof useViewport>;

export function useBlueprintNavigation(svgRef: RefObject<SVGSVGElement | null>, camera: Camera, sceneKey: string, onNavigate: () => void) {
  const latest = useRef({ camera, onNavigate });
  latest.current = { camera, onNavigate };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    latest.current.onNavigate();
    const captures = new Map<number, Element>();
    const gestures = new MapGestures({
      getView: () => latest.current.camera.getView(),
      getBase: () => latest.current.camera.getBase(),
      getBounds: () => svg.getBoundingClientRect(),
      moveTo: (view) => latest.current.camera.moveTo(view),
      onNavigate: () => latest.current.onNavigate(),
      onActiveChange: (active) => { svg.dataset.navigating = String(active); },
    });

    const release = (pointerId: number) => {
      const target = captures.get(pointerId);
      captures.delete(pointerId);
      if (target?.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    };
    const cancel = () => {
      gestures.cancel();
      for (const pointerId of captures.keys()) release(pointerId);
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      latest.current.camera.stop();
      gestures.down(event.pointerId, { x: event.clientX, y: event.clientY });
      // Capture the original room target, so an ordinary tap still clicks that room.
      const target = event.target instanceof Element ? event.target : svg;
      try {
        target.setPointerCapture(event.pointerId);
        captures.set(event.pointerId, target);
      } catch {
        // A removed target can lose capture between event dispatch and this handler.
        gestures.up(event.pointerId, true);
      }
    };
    const move = (event: PointerEvent) => {
      gestures.move(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const up = (event: PointerEvent) => {
      gestures.up(event.pointerId, event.type !== 'pointerup');
      release(event.pointerId);
    };
    const click = (event: MouseEvent) => {
      if (!gestures.blocksClick(event.detail)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const wheel = (event: WheelEvent) => {
      if (gestures.pointerCount || event.metaKey || event.altKey) return;
      const bounds = svg.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const current = latest.current.camera;
      const before = current.getView();
      const after = zoomAt(before, current.getBase(), wheelZoomFactor(event.deltaY, event.deltaMode, bounds.height, event.ctrlKey), { x: event.clientX, y: event.clientY }, bounds);
      const changed = before.x !== after.x || before.y !== after.y || before.w !== after.w;
      // At the zoom limit ordinary wheel scrolling can continue to the surrounding page.
      if (!changed && !event.ctrlKey) return;
      event.preventDefault();
      latest.current.onNavigate();
      current.moveTo(after);
    };
    const key = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const current = latest.current.camera;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] };
      if (!arrows[event.key] && !['+', '=', '-', '_', 'Home', '0'].includes(event.key)) return;
      event.preventDefault();
      cancel();
      latest.current.onNavigate();
      if (event.key === 'Home' || event.key === '0') current.reset();
      else if (event.key === '+' || event.key === '=') current.zoomBy(1.3);
      else if (event.key === '-' || event.key === '_') current.zoomBy(1 / 1.3);
      else {
        const [dx, dy] = arrows[event.key];
        const step = event.shiftKey ? 3 : 1;
        current.moveTo(panByPixels(current.getView(), current.getBase(), dx * step, dy * step, svg.getBoundingClientRect()));
      }
    };
    const visibility = () => { if (document.hidden) cancel(); };
    // Native non-passive wheel listener is scoped to the drawing, never the page.
    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('lostpointercapture', up);
    svg.addEventListener('click', click, true);
    svg.addEventListener('wheel', wheel, { passive: false });
    svg.addEventListener('keydown', key);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    // Keep center/zoom on orientation changes; end a gesture whose screen scale just changed.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(cancel);
    observer?.observe(svg);
    return () => {
      cancel();
      observer?.disconnect();
      svg.removeEventListener('pointerdown', down);
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up);
      svg.removeEventListener('pointercancel', up);
      svg.removeEventListener('lostpointercapture', up);
      svg.removeEventListener('click', click, true);
      svg.removeEventListener('wheel', wheel);
      svg.removeEventListener('keydown', key);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [svgRef, sceneKey]);
}
