import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guardSheetPointerTransitions } from './sheet-pointer-transition';

// Real EventTarget propagation/cancellation and fake time exercise the guard
// independently of React and layout. Hosted QA checks the actual hit targets.
function fixture() {
  const view = new EventTarget();
  const doc = Object.assign(new EventTarget(), { defaultView: view });
  const inside = {};
  const backdropTarget = {};
  const background = {};
  const sheet = { ownerDocument: doc, contains: (node: object) => node === inside } as unknown as HTMLElement;
  const backdrop = { contains: (node: object) => node === backdropTarget } as unknown as HTMLElement;
  const add = vi.spyOn(doc, 'addEventListener');
  const remove = vi.spyOn(doc, 'removeEventListener');
  const guard = guardSheetPointerTransitions(sheet, backdrop);
  const event = (type = 'click', target = inside, x = 100, y = 400, detail = 1) => {
    const input = Object.assign(new Event(type, { cancelable: true }), { clientX: x, clientY: y, detail, button: 0 });
    Object.defineProperty(input, 'target', { value: target });
    doc.dispatchEvent(input);
    return input;
  };
  return { guard, event, inside, backdropTarget, background, doc, view, add, remove };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000); });
afterEach(() => { vi.useRealTimers(); });

describe('save sheet pointer transitions', () => {
  it('blocks the next touch at the old Cancel position after the library replaces the form', () => {
    const f = fixture();
    expect(f.event().defaultPrevented).toBe(false);
    f.guard.transition();
    vi.advanceTimersByTime(80);
    // Touch clicks may still have detail 1 and may move a few pixels.
    expect(f.event('pointerdown', f.background, 110, 406).defaultPrevented).toBe(true);
    expect(f.event('mousedown', f.background, 110, 406).defaultPrevented).toBe(true);
    expect(f.event('pointerup', f.background, 110, 406).defaultPrevented).toBe(true);
    expect(f.event('click', f.background, 110, 406).defaultPrevented).toBe(true);
    f.guard.release();
    vi.runAllTimers();
  });

  it('blocks desktop double-click activation even if its target was replaced', () => {
    const f = fixture();
    f.event();
    f.guard.transition();
    expect(f.event('click', f.background, 100, 400, 2).defaultPrevented).toBe(true);
    expect(f.event('dblclick', f.background, 100, 400, 2).defaultPrevented).toBe(true);
    f.guard.release();
    vi.runAllTimers();
  });

  it('stops the newly exposed control handler before it can navigate or write a save', () => {
    const f = fixture();
    const activate = vi.fn();
    f.event();
    f.guard.transition();
    f.doc.addEventListener('click', activate);
    f.event('click', f.background);
    expect(activate).not.toHaveBeenCalled();
    f.event('click', f.background, 200, 200);
    expect(activate).toHaveBeenCalledOnce();
    f.guard.release();
    vi.runAllTimers();
  });

  it.each(['close', 'start new campaign', 'load campaign'])('survives %s and replacement of the old app root, then removes every listener', () => {
    const f = fixture();
    f.event();
    f.guard.release();
    expect(f.event('click', f.background).defaultPrevented).toBe(true);
    vi.advanceTimersByTime(501);
    expect(f.event('click', f.background).defaultPrevented).toBe(false);
    expect(f.remove.mock.calls).toHaveLength(f.add.mock.calls.length);
  });

  it('allows an immediate intentional tap elsewhere and guards its next transition', () => {
    const f = fixture();
    f.event();
    f.guard.transition();
    expect(f.event('pointerdown', f.inside, 200, 200).defaultPrevented).toBe(false);
    expect(f.event('click', f.inside, 200, 200).defaultPrevented).toBe(false);
    f.guard.transition();
    expect(f.event('click', f.background, 200, 200).defaultPrevented).toBe(true);
    f.guard.release();
    vi.runAllTimers();
  });

  it('preserves keyboard and assistive activation without a delay', () => {
    const f = fixture();
    f.event();
    f.guard.transition();
    expect(f.event('click', f.inside, 100, 400, 0).defaultPrevented).toBe(false);
    expect(f.event().defaultPrevented).toBe(false);
    f.guard.transition();
    f.doc.dispatchEvent(new Event('keydown'));
    expect(f.event().defaultPrevented).toBe(false);
    f.guard.release();
    vi.runAllTimers();
  });

  it.each(['popstate', 'blur', 'pagehide'])('clears a dismissed guard on %s without interfering with history or focus', (type) => {
    const f = fixture();
    f.event();
    f.guard.release();
    f.view.dispatchEvent(new Event(type));
    expect(f.event('click', f.background).defaultPrevented).toBe(false);
    expect(f.remove.mock.calls).toHaveLength(f.add.mock.calls.length);
  });

  it('keeps a blocked press safe if it is held beyond the repeat interval', () => {
    const f = fixture();
    f.event();
    f.guard.release();
    vi.advanceTimersByTime(450);
    expect(f.event('pointerdown', f.background).defaultPrevented).toBe(true);
    vi.advanceTimersByTime(800);
    expect(f.event('pointerup', f.background).defaultPrevented).toBe(true);
    expect(f.event('click', f.background).defaultPrevented).toBe(true);
    expect(f.remove.mock.calls).toHaveLength(f.add.mock.calls.length);
    expect(f.event('click', f.background).defaultPrevented).toBe(false);
  });

  it('does not block unchanged controls or unrelated app pointers', () => {
    const f = fixture();
    expect(f.event().defaultPrevented).toBe(false);
    expect(f.event('click', f.inside, 100, 400, 2).defaultPrevented).toBe(false);
    f.doc.dispatchEvent(new Event('keydown'));
    f.event('click', f.background);
    f.guard.transition();
    expect(f.event('click', f.background).defaultPrevented).toBe(false);
    f.guard.release();
    expect(f.remove.mock.calls).toHaveLength(f.add.mock.calls.length);
  });

  it('does not extend an old pointer gesture when an async save takes longer', () => {
    const f = fixture();
    f.event();
    vi.advanceTimersByTime(700);
    f.guard.transition();
    expect(f.event('click', f.background).defaultPrevented).toBe(false);
    f.guard.release();
    expect(f.remove.mock.calls).toHaveLength(f.add.mock.calls.length);
  });

  it('protects backdrop dismissal and cleans up a cancelled follow-up pointer', () => {
    const f = fixture();
    f.event('click', f.backdropTarget);
    f.guard.release();
    expect(f.event('pointerdown', f.background).defaultPrevented).toBe(true);
    vi.advanceTimersByTime(700);
    f.event('pointercancel', f.background);
    expect(f.event('click', f.background).defaultPrevented).toBe(false);
    expect(f.remove.mock.calls).toHaveLength(f.add.mock.calls.length);
  });
});
