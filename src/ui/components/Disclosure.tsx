import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import './disclosure.css';

// The one way the game hides detail inline (disclosure-taxonomy): evidence, logs and secondary
// facts the player may want, behind one summary row that looks and behaves the same everywhere.
// Reference guides open in a Sheet, filters are chip rails, and harm is never put behind one.
export function Disclosure({ summary, count, hint, icon, open, name, className, row, children }: {
  /** What is inside, as a plain noun phrase. */
  summary: ReactNode;
  /** How many items are inside, when that helps decide whether to open it. */
  count?: number;
  /** One short line under the summary. */
  hint?: ReactNode;
  icon?: IconName;
  /** Initial state; the player's toggle wins after that. */
  open?: boolean;
  /** Stable id for tests and analytics: `data-disclosure`. */
  name: string;
  className?: string;
  /** The summary is a ready-made row (a list item's own columns); only the chevron is added. */
  row?: string;
  children: ReactNode;
}) {
  if (row) return (
    <details className={`disclosure disclosure-rowed${className ? ` ${className}` : ''}`} data-disclosure={name} open={open || undefined}>
      <summary className={`disclosure-summary ${row}`}>{summary}<span className="disclosure-chevron" aria-hidden="true" /></summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
  return (
    <details className={`disclosure${className ? ` ${className}` : ''}`} data-disclosure={name} open={open || undefined}>
      <summary className="disclosure-summary">
        {icon && <Icon name={icon} size={15} />}
        <span className="disclosure-label">
          <span className="disclosure-title">{summary}{count !== undefined && <span className="disclosure-count">{count}</span>}</span>
          {hint && <span className="disclosure-hint">{hint}</span>}
        </span>
        <span className="disclosure-chevron" aria-hidden="true" />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
