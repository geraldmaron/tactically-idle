import { describe, expect, it, vi } from 'vitest';
import { observeSheetViewport, sheetViewportInsets, type ViewportRect } from './sheet-viewport';

const phone = { left: 0, top: 0, width: 390, height: 844 };

describe('sheet visible viewport intersection', () => {
  it.each([320, 375, 390, 430])('preserves an unobscured %ipx phone frame', (width) => {
    expect(sheetViewportInsets({ ...phone, width }, { ...phone, width })).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
  it('keeps the whole sheet above the keyboard even when Safari pans down', () => {
    const insets = sheetViewportInsets(phone, { left: 0, top: 70, width: 390, height: 345 });
    expect(insets).toEqual({ top: 70, right: 0, bottom: 429, left: 0 });
    expect(phone.height - insets.top - insets.bottom).toBe(345);
  });
  it('measures from a centered desktop overlay, not the document origin', () => {
    expect(sheetViewportInsets({ left: 425, top: 16, width: 430, height: 768 }, { left: 0, top: 0, width: 1280, height: 800 }))
      .toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
  it('accounts for page scrolling and horizontal visual-viewport offsets without rescaling content', () => {
    expect(sheetViewportInsets({ ...phone, top: -40 }, { left: 80, top: 100, width: 230, height: 320 }))
      .toEqual({ top: 140, right: 80, bottom: 384, left: 80 });
  });
  it('bounds fully disjoint rectangles instead of producing negative dimensions', () => {
    expect(sheetViewportInsets(phone, { left: 500, top: 1000, width: 200, height: 300 }))
      .toEqual({ top: 844, right: 0, bottom: 0, left: 390 });
  });
  it('falls back safely for transient empty or invalid measurements', () => {
    for (const visible of [{ ...phone, height: 0 }, { ...phone, top: NaN }, { ...phone, width: Infinity }]) {
      expect(sheetViewportInsets(phone, visible)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    }
  });
});

function fixture(withViewport = true) {
  let rect: ViewportRect = { ...phone };
  const viewport = Object.assign(new EventTarget(), { offsetLeft: 0, offsetTop: 0, width: 390, height: 844, scale: 1 });
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  let rootResize: (() => void) | undefined;
  const disconnect = vi.fn();
  const observe = vi.fn();
  const view = Object.assign(new EventTarget(), {
    visualViewport: withViewport ? viewport : null,
    innerWidth: 390, innerHeight: 844,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; }),
    cancelAnimationFrame: vi.fn((id: number) => { frames.delete(id); }),
    ResizeObserver: class {
      constructor(callback: () => void) { rootResize = callback; }
      observe = observe;
      disconnect = disconnect;
    },
  });
  const root = { ownerDocument: { defaultView: view }, getBoundingClientRect: () => rect } as unknown as HTMLElement;
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(0)); };
  return { view, viewport, root, frames, flush, disconnect, observe, resizeRoot: () => rootResize?.(), setRect: (next: ViewportRect) => { rect = next; } };
}

describe('sheet viewport observation lifecycle', () => {
  it('reads on open, coalesces keyboard animation events, and restores after dismissal', () => {
    const state = fixture();
    const update = vi.fn();
    const stop = observeSheetViewport(state.root, update);
    expect(update).toHaveBeenLastCalledWith({ top: 0, right: 0, bottom: 0, left: 0 });
    Object.assign(state.viewport, { height: 345, offsetTop: 70 });
    state.viewport.dispatchEvent(new Event('resize'));
    state.viewport.dispatchEvent(new Event('scroll'));
    state.view.dispatchEvent(new Event('resize'));
    expect(state.frames.size).toBe(1);
    state.flush();
    expect(update).toHaveBeenLastCalledWith({ top: 70, right: 0, bottom: 429, left: 0 });
    Object.assign(state.viewport, { height: 844, offsetTop: 0 });
    state.viewport.dispatchEvent(new Event('resize'));
    state.flush();
    expect(update).toHaveBeenLastCalledWith({ top: 0, right: 0, bottom: 0, left: 0 });
    stop();
  });
  it('updates for orientation, root resize and document scroll, without changing deliberate zoom', () => {
    const state = fixture();
    const update = vi.fn();
    const stop = observeSheetViewport(state.root, update);
    Object.assign(state.viewport, { width: 195, height: 422, offsetLeft: 60, scale: 2 });
    state.view.dispatchEvent(new Event('orientationchange'));
    state.resizeRoot();
    state.setRect({ ...phone, top: -10 });
    state.view.dispatchEvent(new Event('scroll'));
    state.flush();
    expect(update).toHaveBeenLastCalledWith({ top: 10, right: 135, bottom: 412, left: 60 });
    expect(state.viewport.scale).toBe(2);
    stop();
  });
  it('uses inner dimensions without VisualViewport and remeasures a resized layout', () => {
    const state = fixture(false);
    const update = vi.fn();
    const stop = observeSheetViewport(state.root, update);
    state.view.innerHeight = 360;
    state.view.dispatchEvent(new Event('resize'));
    state.flush();
    expect(update).toHaveBeenLastCalledWith({ top: 0, right: 0, bottom: 484, left: 0 });
    stop();
  });
  it('removes every listener, disconnects observation and cancels queued work on close', () => {
    const state = fixture();
    const update = vi.fn();
    const stop = observeSheetViewport(state.root, update);
    state.viewport.dispatchEvent(new Event('resize'));
    stop();
    expect(state.disconnect).toHaveBeenCalledOnce();
    expect(state.view.cancelAnimationFrame).toHaveBeenCalledOnce();
    for (const target of [state.view, state.viewport]) {
      for (const type of ['resize', 'scroll', 'orientationchange']) target.dispatchEvent(new Event(type));
    }
    state.resizeRoot();
    state.flush();
    expect(state.frames.size).toBe(0);
    expect(update).toHaveBeenCalledOnce();
    const reopened = vi.fn();
    const stopAgain = observeSheetViewport(state.root, reopened);
    state.viewport.height = 300;
    state.viewport.dispatchEvent(new Event('resize'));
    state.flush();
    expect(reopened).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledOnce();
    stopAgain();
  });
});
