interface Modal {
  sheet: HTMLElement;
  backdrop: HTMLElement | null;
  opener: HTMLElement | null;
  lastFocus: HTMLElement | null;
  onClose: () => void;
}

const focusableSelector = 'button, input, select, textarea, a[href], area[href], summary, iframe, object, embed, audio[controls], video[controls], [tabindex], [contenteditable]:not([contenteditable="false"])';
const controllers = new WeakMap<HTMLElement, ReturnType<typeof createController>>();

/** A modal belongs to its app frame, not to unrelated controls elsewhere in the
 * document. One controller owns inert state and focus for overlapping sheets. */
export function containSheetFocus(root: HTMLElement, sheet: HTMLElement, backdrop: HTMLElement | null, onClose: () => void): () => void {
  let controller = controllers.get(root);
  if (!controller) {
    controller = createController(root);
    controllers.set(root, controller);
  }
  return controller.add(sheet, backdrop, onClose);
}

function createController(root: HTMLElement) {
  const app = root.parentElement ?? root;
  const doc = root.ownerDocument;
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  const modals: Modal[] = [];
  // Keep the original attribute as well as its boolean state, including elements
  // that were already inert before any of our sheets opened.
  const inert = new Map<HTMLElement, string | null>();
  const element = (value: Element | null) => view && value instanceof view.HTMLElement ? value : null;
  const available = (target: HTMLElement | null): target is HTMLElement => !!target?.isConnected
    && !target.matches(':disabled') && !target.closest('[inert], [hidden], [aria-hidden="true"]')
    && target.getClientRects().length > 0 && !['hidden', 'collapse'].includes(view?.getComputedStyle(target).visibility ?? '');
  const tabStops = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(focusableSelector)]
    .filter((target) => target.tabIndex >= 0 && available(target))
    .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
  const top = () => modals.at(-1);
  const focus = (target: HTMLElement) => target.focus({ preventScroll: true });
  const ownsFocus = () => !doc.activeElement || doc.activeElement === doc.body
    || doc.activeElement === doc.documentElement || app.contains(doc.activeElement);
  const restoreInert = (target: HTMLElement, previous: string | null) => {
    if (previous === null) target.removeAttribute('inert');
    else target.setAttribute('inert', previous);
  };
  const syncInert = () => {
    const modal = top();
    const blocked = new Set<HTMLElement>();
    if (modal) {
      for (const sibling of app.children) {
        const target = element(sibling);
        if (target && target !== root) blocked.add(target);
      }
      for (const sibling of root.children) {
        const target = element(sibling);
        if (target && target !== modal.sheet && target !== modal.backdrop) blocked.add(target);
      }
    }
    for (const [target, previous] of inert) {
      if (!blocked.has(target)) {
        restoreInert(target, previous);
        inert.delete(target);
      }
    }
    for (const target of blocked) {
      if (!inert.has(target)) inert.set(target, target.getAttribute('inert'));
      if (!target.hasAttribute('inert')) target.setAttribute('inert', '');
    }
  };
  const containFocus = () => {
    const modal = top();
    if (!modal || !ownsFocus()) return;
    const active = element(doc.activeElement);
    if (available(active) && modal.sheet.contains(active)) {
      modal.lastFocus = active;
      return;
    }
    const previous = modal.lastFocus;
    focus(available(previous) && modal.sheet.contains(previous) ? previous : tabStops(modal.sheet)[0] ?? modal.sheet);
  };
  const keydown = (event: KeyboardEvent) => {
    const modal = top();
    if (!modal || !ownsFocus()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      // Capture before the non-modal live-map Escape handler can also close.
      event.stopPropagation();
      modal.onClose();
    } else if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const stops = tabStops(modal.sheet);
      const active = element(doc.activeElement);
      const index = active ? stops.indexOf(active) : -1;
      // Review/receipt headings can hold programmatic focus without being tab
      // stops. Preserve native adjacent navigation from that position, wrapping
      // only when there is no usable control in the requested direction.
      if (index === -1 && available(active) && modal.sheet.contains(active)
        && stops.some((stop) => active.compareDocumentPosition(stop)
          & (event.shiftKey ? active.DOCUMENT_POSITION_PRECEDING : active.DOCUMENT_POSITION_FOLLOWING))) return;
      if (index === -1 || (event.shiftKey ? index === 0 : index === stops.length - 1)) {
        event.preventDefault();
        focus((event.shiftKey ? stops.at(-1) : stops[0]) ?? modal.sheet);
      }
    }
  };
  const observer = view?.MutationObserver ? new view.MutationObserver(() => {
    syncInert();
    containFocus();
  }) : null;

  return {
    add(sheet: HTMLElement, backdrop: HTMLElement | null, onClose: () => void) {
      const modal: Modal = { sheet, backdrop, onClose, opener: element(doc.activeElement), lastFocus: null };
      modals.push(modal);
      if (modals.length === 1) {
        doc.addEventListener('keydown', keydown, true);
        doc.addEventListener('focusin', containFocus, true);
        observer?.observe(app, { childList: true, subtree: true, attributes: true,
          attributeFilter: ['disabled', 'hidden', 'inert', 'tabindex', 'class', 'style', 'aria-hidden'] });
      }
      syncInert();
      focus(tabStops(sheet)[0] ?? sheet);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const wasTop = top() === modal;
        const shouldRestore = ownsFocus();
        // If an underlying sheet disappears first, keep the surviving sheet's
        // return route pointed at the original app control, not a removed node.
        for (const remaining of modals) {
          if (remaining !== modal && remaining.opener && sheet.contains(remaining.opener)) remaining.opener = modal.opener;
        }
        modals.splice(modals.indexOf(modal), 1);
        syncInert();
        if (!modals.length) {
          observer?.disconnect();
          doc.removeEventListener('keydown', keydown, true);
          doc.removeEventListener('focusin', containFocus, true);
          controllers.delete(root);
        }
        if (!wasTop || !shouldRestore) return;
        const next = top();
        if (available(modal.opener) && (!next || next.sheet.contains(modal.opener))) focus(modal.opener);
        else if (next) containFocus();
        else {
          // Cleanup can precede DOM removal, so exclude the closing sheet.
          const fallback = tabStops(app).find((target) => !sheet.contains(target));
          if (fallback) focus(fallback);
        }
      };
    },
  };
}
