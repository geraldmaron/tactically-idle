// Display formatting helpers. Pure functions; no game state.

/** $620, $2,480, $12.4K. Under 10,000 keeps full precision so costs stay exact. */
export function money(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 10000) {
    const k = Math.round(a / 100) / 10;
    return `${sign}$${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${sign}$${a.toLocaleString('en-US')}`;
}

/** Always-exact dollars: $12,400. */
export function moneyFull(n: number): string {
  const v = Math.round(n);
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US')}`;
}

/** +$620 / -$40 / $0 */
export function signedMoney(n: number): string {
  const v = Math.round(n);
  if (v === 0) return '$0';
  return `${v > 0 ? '+' : '-'}${money(Math.abs(v))}`;
}

/** +$620/h */
export function rate(n: number): string {
  return `${signedMoney(n)}/h`;
}

/** Plain per-hour amount: $380/h */
export function perHour(n: number): string {
  return `${money(n)}/h`;
}

export function signed(n: number, digits = 0): string {
  const v = digits ? Number(n.toFixed(digits)) : Math.round(n);
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v)}`;
}

/** Milliseconds as "3h 20m", "45m", "2d 4h", "<1m". */
export function duration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 1) return ms > 0 ? '<1m' : '0m';
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** "in 3h 20m" / "3h 20m ago" / "now". */
export function relativeTime(at: number, now: number): string {
  const diff = at - now;
  if (Math.abs(diff) < 30000) return 'now';
  return diff > 0 ? `in ${duration(diff)}` : `${duration(-diff)} ago`;
}

/** Operation minutes: "12 min". */
export function opMinutes(m: number): string {
  const v = Math.round(m * 10) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} min`;
}

/** Feet as 38'-0" (nearest inch). */
export function feetInches(ft: number): string {
  const totalIn = Math.round(ft * 12);
  const f = Math.floor(totalIn / 12);
  const i = totalIn % 12;
  return `${f}′-${i}″`;
}

export function sqft(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} sq ft`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Whole years of service: "17 yrs", "1 yr", "<1 yr". */
export function yearsText(y: number): string {
  if (y < 1) return '<1 yr';
  const n = Math.floor(y);
  return `${n} ${n === 1 ? 'yr' : 'yrs'}`;
}

/** Game days: "12 days", "1 day", "<1 day". */
export function gameDays(d: number): string {
  if (d < 1) return '<1 day';
  const n = Math.round(d);
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/** Percent from a 0..1 value: 85%. */
export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
