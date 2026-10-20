import type { GameState, Officer } from './types';

// Game calendar. Proposed tuning: 1 real hour = 1 game day, so a game year is
// ~15 real days and careers (ageing, anniversaries, retirement) are visible in
// an idle game's lifetime. The calendar runs on wall time and is not capped by
// the 24h funding window.

export const CALENDAR = {
  gameDayMs: 3600_000,
  daysPerYear: 365,
  /** Display: game day 0 is 1 January of this year. */
  startYear: 2026,
} as const;

/** The clock this state has been settled to; handlers treat it as "now". */
export function simNow(state: Pick<GameState, 'department'>): number {
  return state.department.clockHighWater;
}

export function gameDay(state: Pick<GameState, 'department'>, t: number): number {
  return (t - state.department.calendarEpoch) / CALENDAR.gameDayMs;
}

export function msForGameDay(state: Pick<GameState, 'department'>, day: number): number {
  return state.department.calendarEpoch + day * CALENDAR.gameDayMs;
}

export function ageYears(o: Pick<Officer, 'bornDay'>, day: number): number {
  return (day - o.bornDay) / CALENDAR.daysPerYear;
}

export function serviceYears(o: Pick<Officer, 'serviceStartDay'>, day: number): number {
  return Math.max(0, (day - o.serviceStartDay) / CALENDAR.daysPerYear);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** '14 Mar 2027' for a (possibly fractional or negative) game day. */
export function formatGameDate(day: number): string {
  const whole = Math.floor(day);
  const year = CALENDAR.startYear + Math.floor(whole / CALENDAR.daysPerYear);
  let d = ((whole % CALENDAR.daysPerYear) + CALENDAR.daysPerYear) % CALENDAR.daysPerYear;
  let m = 0;
  while (d >= MONTH_DAYS[m]) d -= MONTH_DAYS[m++];
  return `${d + 1} ${MONTHS[m]} ${year}`;
}
