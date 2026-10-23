import { Icon } from '../icons';
import { money } from '../format';

export type CostState = 'owned' | 'ready' | 'short' | 'locked';

/** What a price tag says, from a quote: the cash price, why it can't be paid yet, and a free route
 * when a milestone grants it. Built from the sim's quote and catalog fields, never from cash alone. */
export interface CostQuote {
  state: CostState;
  /** Funding price; absent once owned. */
  price?: number | null;
  /** A short blocker caption: a missing prerequisite or "Needs funding". */
  blocker?: string;
  /** The milestone that grants it free, with progress. */
  free?: { label: string; met: boolean; have: number; need: number };
  /** Said in place of a price once owned. */
  done?: string;
}

/** One price column for a row's trail: glyph and price, with one quiet caption under it. */
/** `part` splits it for a row whose trail has no room for the caption: the price in the trail, the
 * blocker or free route under the row's detail. */
export function CostTag({ quote, part = 'all' }: { quote: CostQuote; part?: 'all' | 'value' | 'note' }) {
  const { state, price, blocker, free, done } = quote;
  const caption = state === 'owned' ? null : blocker ?? (free ? `Free at ${free.label}` : null);
  return <span className={`cost-tag${part === 'note' ? ' cost-tag-inline' : ''}`} data-state={state}>
    {part !== 'note' && (state === 'owned'
      ? <span className="cost-tag-value"><Icon name="check" size={14} strokeWidth={3} />{done ?? 'Owned'}</span>
      : <span className="cost-tag-value"><Icon name={state === 'locked' ? 'lock' : 'cash'} size={14} />{price != null ? money(price) : ''}</span>)}
    {part !== 'value' && caption && <span className="cost-tag-note">{caption}{!blocker && free && !free.met ? ` · ${free.have}/${free.need}` : ''}</span>}
    {part !== 'value' && !blocker && free && state !== 'owned' && <span className="cost-tag-bar" data-met={free.met ? 'yes' : undefined}><i style={{ width: `${Math.round(Math.min(1, free.have / Math.max(1, free.need)) * 100)}%` }} /></span>}
  </span>;
}

/** Owned out of total as separate segments, so a track reads as steps; the count stays beside it. */
export function Segments({ done, total, label }: { done: number; total: number; label?: string }) {
  return <span className="segments" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {Array.from({ length: total }, (_, index) => <i key={index} data-on={index < done ? 'yes' : undefined} />)}
  </span>;
}
