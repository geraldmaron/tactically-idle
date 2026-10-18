// Layers above a surface: popovers, drawers and confirm sheets. Every open layer joins one stack, so
// Esc always closes the topmost layer first (spec 3.0, keyboard), and focus moves into a layer when
// it opens and back to its opener when Esc closes it. A modal layer (aria-modal) also keeps Tab
// inside it, so a key never reaches the controls hidden behind its scrim.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { Glyph } from './glyphs';
import { cx } from './marks';

interface Layer { close: () => void; modal: boolean }
const layers: Layer[] = [];
let listening = false;

function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !layers.length) return;
  event.preventDefault();
  event.stopPropagation();
  layers[layers.length - 1].close();
}

/** Joins the Esc stack while `open`. A modal layer also holds the global keys off (spec 3.0). */
export function useLayer(open: boolean, onClose: () => void, modal = false) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    if (!listening) { window.addEventListener('keydown', onEscape, true); listening = true; }
    const layer: Layer = { close: () => close.current(), modal };
    layers.push(layer);
    return () => { const at = layers.indexOf(layer); if (at >= 0) layers.splice(at, 1); };
  }, [open]);
}

/** True while a modal layer is open; global surface keys stand down then. */
export const modalOpen = () => layers.some(layer => layer.modal);

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Where Tab goes inside a modal: `items` are its controls in order, `active` the focused one,
 * `inside` whether focus is in the modal at all. From outside (or the panel itself) to the first
 * control (the last with Shift); from the last to the first and back; else null, the browser's own
 * step. */
export function trapTarget<T>(items: readonly T[], active: T | null, inside: boolean, back: boolean): T | null {
  if (!items.length) return null;
  const first = items[0], last = items[items.length - 1];
  if (!inside || active === null || !items.includes(active)) return back ? last : first;
  if (!back && active === last) return first;
  if (back && active === first) return last;
  return null;
}

/** Open modal panels, the topmost last: only it keeps Tab. */
const traps: RefObject<HTMLElement | null>[] = [];

function useTrapTab(open: boolean, panel: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    traps.push(panel);
    const onKey = (event: KeyboardEvent) => {
      const root = panel.current;
      if (event.key !== 'Tab' || event.defaultPrevented || !root || traps[traps.length - 1] !== panel) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const inside = !!active && root.contains(active) && active !== root;
      const target = items.length ? trapTarget(items, active, inside, event.shiftKey) : root;
      if (!target) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const at = traps.indexOf(panel);
      if (at >= 0) traps.splice(at, 1);
    };
  }, [open]);
}

function useFocusInto(open: boolean, panel: RefObject<HTMLElement | null>, returnTo?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const before = (returnTo?.current ?? document.activeElement) as HTMLElement | null;
    const target = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panel.current;
    target?.focus({ preventScroll: true });
    return () => { if (before && document.contains(before) && panel.current?.contains(document.activeElement)) before.focus({ preventScroll: true }); };
  }, [open]);
}

/** A small panel under its anchor. Closes on Esc, on a press outside it, and when its anchor scrolls away. */
export function Popover({ open, onClose, anchor, label, children, align = 'start', width }: {
  open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null>; label: string; children: ReactNode; align?: 'start' | 'end'; width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  useLayer(open, onClose);
  useFocusInto(open, panel, anchor);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const w = Math.min(width ?? panel.current?.offsetWidth ?? 280, window.innerWidth - 16);
      const left = align === 'end' ? a.right - w : a.left;
      setStyle({ top: a.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - w - 8)), width, maxHeight: window.innerHeight - a.bottom - 20 });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, align, width]);
  useEffect(() => {
    if (!open) return;
    const press = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) onClose();
    };
    document.addEventListener('pointerdown', press, true);
    return () => document.removeEventListener('pointerdown', press, true);
  }, [open, onClose]);
  if (!open) return null;
  return <div ref={panel} className="lab-popover" role="dialog" aria-label={label} style={style} tabIndex={-1}>{children}</div>;
}

/** A panel over the surface from the right (or the bottom at narrow widths). Not modal: the surface
 * behind stays usable. */
export function Drawer({ open, onClose, title, children, width = 400, actions }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number; actions?: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  useLayer(open, onClose);
  useFocusInto(open, panel);
  if (!open) return null;
  return (
    <aside ref={panel} className="lab-drawer" style={{ '--lab-drawer-w': `${width}px` } as CSSProperties} aria-label={typeof title === 'string' ? title : 'Drawer'} tabIndex={-1}>
      <header className="lab-drawer-head">
        <h2 className="lab-drawer-title">{title}</h2>
        {actions}
        <button type="button" className="lab-icon-button" onClick={onClose} aria-label="Close"><Glyph name="close" /></button>
      </header>
      <div className="lab-drawer-body">{children}</div>
    </aside>
  );
}

/** A modal question with one confirming action. */
export function ConfirmSheet({ open, title, children, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, tone = 'default', busy = false }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void; tone?: 'default' | 'danger'; busy?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useLayer(open, onCancel, true);
  useFocusInto(open, panel);
  useTrapTab(open, panel);
  if (!open) return null;
  return (
    <div className="lab-scrim" onPointerDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
      <div ref={panel} className="lab-sheet" role="alertdialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <h2 className="lab-sheet-title">{title}</h2>
        <div className="lab-sheet-body">{children}</div>
        <div className="lab-sheet-actions">
          <button type="button" className="lab-button" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={cx('lab-button', 'lab-button-primary', tone === 'danger' && 'lab-button-danger')} onClick={onConfirm} disabled={busy} data-autofocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A modal panel for longer content (the command palette, the shortcut sheet). */
export function Modal({ open, onClose, label, children, className }: { open: boolean; onClose: () => void; label: string; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useLayer(open, onClose, true);
  useFocusInto(open, panel);
  useTrapTab(open, panel);
  if (!open) return null;
  return (
    <div className="lab-scrim lab-scrim-top" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panel} className={cx('lab-modal', className)} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</div>
    </div>
  );
}
