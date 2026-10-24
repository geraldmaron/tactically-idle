// An amount of funding as the player sees it: the funding glyph and the bare number, with "funding"
// for screen readers. Funding never wears a currency symbol; "$" is kept for real-money prices, which
// come from the store (canvas pass, 2026-10-24). The glyph takes the colour of the text around it.
import type { JSX } from 'react';
import { Icon } from '../icons';
import { liveMoney, money, moneyFull, perHour, rate, signedMoney } from '../format';

const FORMATS = { money, full: moneyFull, signed: signedMoney, rate, perHour, live: liveMoney } as const;
export type FundsFormat = keyof typeof FORMATS;

export function Funds({ value, format = 'money', className }: { value: number;
  /** money 2,480 or 12.4K; full 12,400; signed +620; rate +620/h; perHour 380/h; live the balance. */
  format?: FundsFormat;
  className?: string }): JSX.Element {
  return <span className={className ? `funds ${className}` : 'funds'}>
    <Icon name="funds" size={16} className="funds-glyph" />{FORMATS[format](value)}<span className="sr-only"> funding</span>
  </span>;
}
