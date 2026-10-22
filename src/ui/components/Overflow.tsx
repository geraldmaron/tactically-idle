import type { ReactNode } from 'react';
import { Icon } from '../icons';

/** A quiet "more" control holding the actions that are not the screen's move: rarely used or
 * destructive ones (Dismiss, Delete). Choosing an item closes the menu. `up` opens it above the
 * control, for a footer. */
export function Overflow({ label, children, up, text }: { label: string; children: ReactNode; up?: boolean; text?: string }) {
  return <details className={`overflow${up ? ' overflow-up' : ''}`}>
    <summary className="btn btn-quiet btn-md overflow-btn" aria-label={label}>{text ?? <Icon name="more" size={20} />}</summary>
    <div className="overflow-menu" onClick={(event) => {
      if ((event.target as HTMLElement).closest('button')) (event.currentTarget.parentElement as HTMLDetailsElement).open = false;
    }}>{children}</div>
  </details>;
}
