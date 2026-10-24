// Plain text formatting shared by every system: funding and durations.
// Funding never wears a currency symbol; "$" is for real store prices only.

function bare(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

/** '1,600 funding'. */
export function funding(n: number): string {
  return `${bare(n)} funding`;
}

/** '40 funding an hour'. */
export function fundingPerHour(n: number): string {
  return `${bare(n)} funding an hour`;
}

/** Rounds up: '~3h', '~40m'. */
export function formatDuration(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
