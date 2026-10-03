import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons';
import { useEscape } from './hooks';
import { observeSheetViewport, type SheetViewportInsets } from './sheet-viewport';
import './sheet-viewport.css';

/** Element inside the phone frame that sheets render into, so they stay clipped to it. */
export const OverlayRootContext = createContext<HTMLElement | null>(null);

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Pinned below the scrolling body (confirm buttons). */
  footer?: ReactNode;
  /** Non-modal sheets leave the content above interactive (the live map). */
  modal?: boolean;
  /** Cap on height as a fraction of the phone frame. */
  maxHeight?: 'short' | 'tall';
  className?: string;
}

export function Sheet({ open, onClose, title, subtitle, children, footer, modal = true, maxHeight = 'tall', className }: SheetProps) {
  const root = useContext(OverlayRootContext);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [viewport, setViewport] = useState<SheetViewportInsets | null>(null);
  useEscape(open, onClose);
  useLayoutEffect(() => {
    if (!open || !root) return;
    return observeSheetViewport(root, (next) => setViewport((previous) =>
      previous && Object.keys(next).every((key) => next[key as keyof SheetViewportInsets] === previous[key as keyof SheetViewportInsets]) ? previous : next));
  }, [open, root]);
  useEffect(() => {
    if (open && modal) closeRef.current?.focus();
  }, [open, modal]);
  if (!open || !root) return null;
  return createPortal(
    <>
      {modal && <div className="sheet-backdrop" onClick={onClose} />}
      <section
        className={`sheet sheet-${maxHeight}${modal ? '' : ' sheet-nonmodal'}${className ? ` ${className}` : ''}`}
        data-viewport-constrained={viewport && (viewport.top > 0 || viewport.bottom > 0) ? true : undefined}
        style={viewport ? {
          '--sheet-visible-top': `${viewport.top}px`, '--sheet-visible-right': `${viewport.right}px`,
          '--sheet-visible-bottom': `${viewport.bottom}px`, '--sheet-visible-left': `${viewport.left}px`,
        } as CSSProperties : undefined}
        role={modal ? 'dialog' : 'region'}
        aria-modal={modal ? true : undefined}
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <div className="sheet-titles">
            <h2 className="sheet-title">{title}</h2>
            {subtitle && <div className="sheet-sub">{subtitle}</div>}
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </section>
    </>,
    root,
  );
}
