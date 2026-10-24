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
  /** A row that must read at a glance: the state said in a pill under the price, a lock beside the blocker. */
  pill?: boolean;
}

/** One price column for a row's trail: glyph and price, with one quiet caption under it. */
/** `part` splits it for a row whose trail has no room for the caption: the price in the trail, the
 * blocker or free route under the row's detail. */
export function CostTag({ quote, part = 'all' }: { quote: CostQuote; part?: 'all' | 'value' | 'note' }) {
  const { state, price, blocker, free, done, pill } = quote;
  const pillText = pill ? (state === 'locked' ? 'Locked' : state === 'short' ? 'Needs funding' : null) : null;
  const live = state !== 'owned';
  const freeNote = live && free ? `Free at ${free.label}${free.met ? '' : ` · ${free.have}/${free.need}`}` : null;
  return <span className={`cost-quote${part === 'note' ? ' cost-quote-inline' : ''}`} data-state={state}>
    {part !== 'note' && (state === 'owned'
      ? <span className="cost-quote-value"><Icon name="check" size={16} />{done ?? 'Owned'}</span>
      : <span className="cost-quote-value"><Icon name={state === 'locked' ? 'lock' : 'funds'} size={16} />{price != null ? money(price) : ''}</span>)}
    {part !== 'note' && pillText && <span className="cost-quote-pill">{pillText}</span>}
    {part !== 'value' && live && blocker && <span className="cost-quote-note" data-kind="blocker">{pill && state === 'locked' && <Icon name="lock" size={16} />}{blocker}</span>}
    {part !== 'value' && freeNote && <span className="cost-quote-note">{freeNote}</span>}
    {part !== 'value' && live && free && <span className="cost-quote-bar" data-met={free.met ? 'yes' : undefined}><i style={{ width: `${Math.round(Math.min(1, free.have / Math.max(1, free.need)) * 100)}%` }} /></span>}
  </span>;
}

/** Owned out of total as separate segments, so a track reads as steps; the count stays beside it. */
export function Segments({ done, total, label }: { done: number; total: number; label?: string }) {
  return <span className="segments" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {Array.from({ length: total }, (_, index) => <i key={index} data-on={index < done ? 'yes' : undefined} />)}
  </span>;
}
