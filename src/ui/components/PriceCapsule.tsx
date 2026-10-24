// A price on a row, the way a store shows its Get button (canvas Kit, "Buttons", 2026-10-24): a capsule
// at the row's trail holding the funding glyph and the amount. Amber only when buying it helps a call on
// the board; quiet otherwise; dashed with a lock behind a gate; warning text when funding is short.
// Funding only: real-money prices never use this (they come from the store's own sheet).
import type { JSX } from 'react';
import { Funds } from './Funds';
import { Icon } from '../icons';

export type PriceTone = 'plain' | 'hot' | 'locked' | 'short' | 'owned';

export function PriceCapsule({ value, tone = 'plain', label }: { value: number;
  /** hot: helps a call on the board. locked: behind a gate. short: not enough funding now. owned: nothing left to buy. */
  tone?: PriceTone;
  /** Text in place of the amount, for owned ("All built"). */
  label?: string }): JSX.Element {
  return <span className="price-capsule" data-tone={tone}>
    {tone === 'locked' && <Icon name="lock" size={16} />}
    {tone === 'owned' && <Icon name="check" size={16} />}
    {label ?? <Funds value={value} />}
  </span>;
}
