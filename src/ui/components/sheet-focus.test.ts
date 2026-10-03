import { describe, expect, it, vi } from 'vitest';
import { containSheetFocus } from './sheet-focus';

// The app's suite runs in Node. This small DOM fixture exercises the production
// lifecycle/listeners, including browser-like failed focus on disabled/inert
// controls, without adding a DOM dependency or pretending to test layout.
class TestElement {
  children: TestElement[] = [];
  parentElement: TestElement | null = null;
  attributes = new Map<string, string>();
  disabled = false;
  visible = true;
  visibility = 'visible';
  focusCalls = vi.fn();
  constructor(readonly ownerDocument: TestDocument, readonly tag = 'div') {}
  get isConnected(): boolean { return this === this.ownerDocument.documentElement || !!this.parentElement?.isConnected; }
  get tabIndex() { return this.hasAttribute('tabindex') ? Number(this.getAttribute('tabindex')) : this.tag === 'button' ? 0 : -1; }
  set tabIndex(value: number) { this.setAttribute('tabindex', String(value)); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  hasAttribute(name: string) { return this.attributes.has(name); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  append(child: TestElement) { child.remove(); child.parentElement = this; this.children.push(child); return child; }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
    if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body;
  }
  contains(other: TestElement | null): boolean { return this === other || this.children.some((child) => child.contains(other)); }
  matches(selector: string) { return selector === ':disabled' && this.disabled; }
  closest() : TestElement | null {
    return this.hasAttribute('inert') || this.hasAttribute('hidden') || this.getAttribute('aria-hidden') === 'true'
      ? this : this.parentElement?.closest() ?? null;
  }
  getClientRects(): object[] { return this.visible && (!this.parentElement || this.parentElement.getClientRects().length) ? [{}] : []; }
  querySelectorAll(): TestElement[] {
    return this.children.flatMap((child) => [
      ...(child.tag === 'button' || child.hasAttribute('tabindex') ? [child] : []), ...child.querySelectorAll(),
    ]);
  }
  focus(options: FocusOptions) {
    this.focusCalls(options);
    if (!this.isConnected || this.disabled || this.closest() || !this.getClientRects().length || this.visibility !== 'visible') return;
    if (this.ownerDocument.activeElement === this) return;
    this.ownerDocument.activeElement = this;
    this.ownerDocument.dispatchEvent(new Event('focusin'));
  }
  get node() { return this as unknown as HTMLElement; }
}

class TestDocument extends EventTarget {
  documentElement = new TestElement(this, 'html');
  body = this.documentElement.append(new TestElement(this, 'body'));
  activeElement = this.body;
  observers: { callback: () => void; active: boolean; options?: MutationObserverInit }[] = [];
  defaultView = {
    HTMLElement: TestElement,
    getComputedStyle: (target: TestElement) => ({ visibility: target.visibility }),
    MutationObserver: class {
      state = { callback: () => {}, active: false, options: undefined as MutationObserverInit | undefined };
      constructor(callback: () => void) { this.state.callback = callback; }
      observe = (target: TestElement, options: MutationObserverInit) => {
        this.state.active = true;
        this.state.options = options;
        target.ownerDocument.observers.push(this.state);
      };
      disconnect = () => { this.state.active = false; };
    },
  };
  mutate() { this.observers.filter((observer) => observer.active).forEach((observer) => observer.callback()); }
  key(key: string, shiftKey = false) {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key, shiftKey });
    this.dispatchEvent(event);
    return event;
  }
}

function fixture() {
  const doc = new TestDocument();
  const outside = doc.body.append(new TestElement(doc, 'button'));
  const app = doc.body.append(new TestElement(doc));
  const bar = app.append(new TestElement(doc));
  const opener = bar.append(new TestElement(doc, 'button'));
  const alreadyInert = app.append(new TestElement(doc));
  alreadyInert.setAttribute('inert', 'existing');
  const root = app.append(new TestElement(doc));
  const live = root.append(new TestElement(doc));
  const liveButton = live.append(new TestElement(doc, 'button'));
  const modal = () => {
    const backdrop = root.append(new TestElement(doc));
    const sheet = root.append(new TestElement(doc));
    sheet.tabIndex = -1;
    const close = sheet.append(new TestElement(doc, 'button'));
    const enrol = sheet.append(new TestElement(doc, 'button'));
    const done = sheet.append(new TestElement(doc, 'button'));
    const onClose = vi.fn();
    const stop = containSheetFocus(root.node, sheet.node, backdrop.node, onClose);
    return { sheet, backdrop, close, enrol, done, onClose, stop };
  };
  opener.focus({});
  return { doc, app, bar, opener, alreadyInert, root, live, liveButton, outside, modal };
}

describe('modal sheet focus containment', () => {
  it('focuses Close, blocks only the app background, and restores its exact prior inert state and opener', () => {
    const state = fixture();
    const modal = state.modal();
    expect(state.doc.activeElement).toBe(modal.close);
    expect(modal.close.focusCalls).toHaveBeenCalledWith({ preventScroll: true });
    expect(state.bar.hasAttribute('inert')).toBe(true);
    expect(state.live.hasAttribute('inert')).toBe(true);
    expect(state.alreadyInert.getAttribute('inert')).toBe('existing');
    expect(modal.sheet.hasAttribute('inert')).toBe(false);
    expect(modal.backdrop.hasAttribute('inert')).toBe(false);
    expect(state.root.hasAttribute('inert')).toBe(false);
    expect(state.outside.hasAttribute('inert')).toBe(false);
    modal.stop();
    expect(state.doc.activeElement).toBe(state.opener);
    expect(state.bar.hasAttribute('inert')).toBe(false);
    expect(state.live.hasAttribute('inert')).toBe(false);
    expect(state.alreadyInert.getAttribute('inert')).toBe('existing');
    expect(state.doc.observers.every((observer) => !observer.active)).toBe(true);
  });

  it('recovers Tab and Shift+Tab when repeat-clicking a disabled Enrolled button leaves focus on body', () => {
    const state = fixture();
    const modal = state.modal();
    modal.enrol.disabled = true;
    state.doc.activeElement = state.doc.body;
    expect(state.doc.key('Tab').defaultPrevented).toBe(true);
    expect(state.doc.activeElement).toBe(modal.close);
    state.doc.activeElement = state.doc.body;
    expect(state.doc.key('Tab', true).defaultPrevented).toBe(true);
    expect(state.doc.activeElement).toBe(modal.done);
    expect(state.doc.key('Tab').defaultPrevented).toBe(true);
    expect(state.doc.activeElement).toBe(modal.close);
    expect(state.doc.key('Tab', true).defaultPrevented).toBe(true);
    expect(state.doc.activeElement).toBe(modal.done);
    modal.stop();
  });

  it('preserves valid internal focus, and repairs disabled, removed and hidden focused controls without a timer', () => {
    const state = fixture();
    const modal = state.modal();
    modal.enrol.focus({});
    state.doc.mutate();
    expect(state.doc.activeElement).toBe(modal.enrol);
    expect(state.doc.key('Tab').defaultPrevented).toBe(false);
    modal.enrol.disabled = true;
    state.doc.mutate();
    expect(state.doc.activeElement).toBe(modal.close);
    modal.done.focus({});
    modal.done.remove();
    state.doc.mutate();
    expect(state.doc.activeElement).toBe(modal.close);
    const heading = modal.sheet.append(new TestElement(state.doc));
    heading.tabIndex = -1;
    heading.focus({});
    state.doc.mutate();
    expect(state.doc.activeElement).toBe(heading);
    heading.setAttribute('hidden', '');
    state.doc.mutate();
    expect(state.doc.activeElement).toBe(modal.close);
    modal.stop();
  });

  it('blocks new toasts and new overlays, and restores detached background nodes on close', () => {
    const state = fixture();
    const modal = state.modal();
    const toast = state.app.append(new TestElement(state.doc));
    const action = toast.append(new TestElement(state.doc, 'button'));
    const overlay = state.root.append(new TestElement(state.doc));
    state.doc.mutate();
    expect(toast.hasAttribute('inert')).toBe(true);
    expect(overlay.hasAttribute('inert')).toBe(true);
    action.focus({});
    expect(state.doc.activeElement).toBe(modal.close);
    toast.remove();
    state.doc.mutate();
    expect(toast.hasAttribute('inert')).toBe(false);
    modal.stop();
    expect(overlay.hasAttribute('inert')).toBe(false);
  });

  it('contains programmatic focus escape within the app while leaving outer test-frame controls alone', () => {
    const state = fixture();
    const modal = state.modal();
    // Simulate an unexpected browser focus move, even though normal focus() on
    // the inert opener is already blocked by the browser.
    state.doc.activeElement = state.opener;
    state.doc.dispatchEvent(new Event('focusin'));
    expect(state.doc.activeElement).toBe(modal.close);
    state.outside.focus({});
    state.doc.mutate();
    expect(state.doc.activeElement).toBe(state.outside);
    expect(state.doc.key('Tab').defaultPrevented).toBe(false);
    expect(state.doc.key('Escape').defaultPrevented).toBe(false);
    expect(modal.onClose).not.toHaveBeenCalled();
    modal.stop();
    expect(state.doc.activeElement).toBe(state.outside);
  });

  it('only dismisses the top modal on Escape and keeps background blocked until the last modal closes', () => {
    const state = fixture();
    const first = state.modal();
    first.enrol.focus({});
    const second = state.modal();
    expect(first.sheet.hasAttribute('inert')).toBe(true);
    expect(first.backdrop.hasAttribute('inert')).toBe(true);
    const escape = state.doc.key('Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(second.onClose).toHaveBeenCalledOnce();
    expect(first.onClose).not.toHaveBeenCalled();
    second.stop();
    second.sheet.remove();
    second.backdrop.remove();
    expect(state.bar.hasAttribute('inert')).toBe(true);
    expect(first.sheet.hasAttribute('inert')).toBe(false);
    expect(state.doc.activeElement).toBe(first.enrol);
    state.doc.key('Escape');
    expect(first.onClose).toHaveBeenCalledOnce();
    first.stop();
    expect(state.bar.hasAttribute('inert')).toBe(false);
    expect(state.doc.activeElement).toBe(state.opener);
  });

  it('retains the original opener when an underlying modal is removed before the top modal', () => {
    const state = fixture();
    const first = state.modal();
    const second = state.modal();
    first.stop();
    first.sheet.remove();
    first.backdrop.remove();
    expect(state.doc.activeElement).toBe(second.close);
    expect(state.bar.hasAttribute('inert')).toBe(true);
    second.stop();
    expect(state.doc.activeElement).toBe(state.opener);
    expect(state.bar.hasAttribute('inert')).toBe(false);
  });

  it.each(['disabled', 'removed'] as const)('restores a usable app control if its opener becomes %s', (change) => {
    const state = fixture();
    const fallback = state.bar.append(new TestElement(state.doc, 'button'));
    const modal = state.modal();
    if (change === 'disabled') state.opener.disabled = true;
    else state.opener.remove();
    modal.stop();
    expect(state.doc.activeElement).toBe(fallback);
  });

  it('falls back to the dialog when every control is unavailable', () => {
    const state = fixture();
    const modal = state.modal();
    for (const control of [modal.close, modal.enrol, modal.done]) control.disabled = true;
    state.doc.mutate();
    expect(state.doc.activeElement).toBe(modal.sheet);
    expect(state.doc.key('Tab').defaultPrevented).toBe(true);
    expect(state.doc.activeElement).toBe(modal.sheet);
    expect(state.doc.key('Tab', true).defaultPrevented).toBe(true);
    expect(state.doc.activeElement).toBe(modal.sheet);
    modal.stop();
  });

  it('cleans up idempotently, leaves the live map interactive, and starts fresh on reopening', () => {
    const state = fixture();
    const first = state.modal();
    first.stop();
    first.stop();
    first.sheet.remove();
    first.backdrop.remove();
    state.liveButton.focus({});
    expect(state.doc.activeElement).toBe(state.liveButton);
    expect(state.doc.key('Tab').defaultPrevented).toBe(false);
    state.doc.key('Escape');
    expect(first.onClose).not.toHaveBeenCalled();
    const second = state.modal();
    expect(state.doc.activeElement).toBe(second.close);
    state.doc.key('Escape');
    expect(second.onClose).toHaveBeenCalledOnce();
    expect(first.onClose).not.toHaveBeenCalled();
    second.stop();
    expect(state.doc.activeElement).toBe(state.liveButton);
  });
});
