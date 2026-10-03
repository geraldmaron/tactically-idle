export interface ViewportRect { left: number; top: number; width: number; height: number }
export interface SheetViewportInsets { top: number; right: number; bottom: number; left: number }

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/** Both rectangles use layout-viewport CSS pixels; the result is overlay-relative. */
export function sheetViewportInsets(root: ViewportRect, visible: ViewportRect): SheetViewportInsets {
  if (![root.left, root.top, root.width, root.height, visible.left, visible.top, visible.width, visible.height].every(Number.isFinite)
    || root.width <= 0 || root.height <= 0 || visible.width <= 0 || visible.height <= 0) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const left = clamp(visible.left - root.left, root.width);
  const top = clamp(visible.top - root.top, root.height);
  return {
    left, top,
    right: clamp(root.left + root.width - visible.left - visible.width, root.width - left),
    bottom: clamp(root.top + root.height - visible.top - visible.height, root.height - top),
  };
}

/** Observe only while a sheet is open. Keyboard, browser chrome, zoom and rotation
 * can change the visual viewport without changing the app's layout viewport. */
export function observeSheetViewport(root: HTMLElement, update: (insets: SheetViewportInsets) => void): () => void {
  const view = root.ownerDocument.defaultView;
  if (!view) return () => {};
  const viewport = view.visualViewport;
  let frame: number | null = null;
  let disposed = false;
  const read = () => {
    frame = null;
    if (disposed) return;
    const usable = viewport && viewport.width > 0 && viewport.height > 0;
    update(sheetViewportInsets(root.getBoundingClientRect(), usable
      ? { left: viewport.offsetLeft, top: viewport.offsetTop, width: viewport.width, height: viewport.height }
      : { left: 0, top: 0, width: view.innerWidth, height: view.innerHeight }));
  };
  const schedule = () => {
    if (!disposed && frame === null) frame = view.requestAnimationFrame(read);
  };
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  view.addEventListener('resize', schedule);
  view.addEventListener('orientationchange', schedule);
  view.addEventListener('scroll', schedule, { passive: true });
  // Resolve the observer from the root's realm, including the isolated QA iframe.
  const ResizeObserverClass = (view as Window & typeof globalThis).ResizeObserver;
  const observer = ResizeObserverClass ? new ResizeObserverClass(schedule) : null;
  observer?.observe(root);
  read();
  return () => {
    disposed = true;
    if (frame !== null) view.cancelAnimationFrame(frame);
    observer?.disconnect();
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    view.removeEventListener('resize', schedule);
    view.removeEventListener('orientationchange', schedule);
    view.removeEventListener('scroll', schedule);
  };
}
