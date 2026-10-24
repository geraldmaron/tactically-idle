// The game clock as the city screens print it: a day number and a 12 hour time. The calendar runs one game
// day per real hour (sim/calendar.ts), so the radio and the headers read the same clock the dates do.
import { gameDay } from '../../../sim/calendar';
import type { GameState } from '../../../sim/types';

export interface ClockStamp {
  /** Day 1 is the day the department was created. */
  day: number;
  /** '9:40 PM' */
  time: string;
}

export function clockStamp(g: Pick<GameState, 'department'>, at: number): ClockStamp {
  const fraction = gameDay(g, at);
  const whole = Math.floor(fraction);
  const minutes = Math.min(1439, Math.floor((fraction - whole) * 1440 + 1e-6));
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { day: whole + 1, time: `${hour12}:${String(minute).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}` };
}

/** Real hours and minutes as the reports say them: '8 h 12 m', '45 m', '3 days 4 h'. */
export function awayText(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} m`;
  const days = Math.floor(hours / 24);
  return `${days} days ${hours % 24} h`;
}
