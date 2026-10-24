// What the Store says about a purchase, worked out from the player's own department. Pure: it reads a
// state and returns numbers, and the Store screen words them.
import { ALLOCATION } from '../../content/city/tuning';
import { simNow } from '../../sim/calendar';
import { ECONOMY_TUNING } from '../../sim/economy';
import { patrolRates } from '../../sim/patrol';
import type { GameState } from '../../sim/types';

const HOUR_MS = 3_600_000;

/** What the Department Charter adds to net funding each hour for this department now: the extra quarter
 * on the patrol service grant, on today's productive patrol staff and without temporary boosts. The same
 * number whether the Charter is owned or not, so the Store can show it before and after. */
export function charterGainPerHour(state: Pick<GameState, 'patrol' | 'department'>): number {
  const base = patrolRates(state, simNow(state), false).baseGross;
  return Math.round(base * (ALLOCATION.charterFactor - 1));
}

/** The funding window in hours, without and with Night Watch Office. */
export function fundingWindowHours(): { free: number; watch: number } {
  return { free: ECONOMY_TUNING.capMs / HOUR_MS, watch: ECONOMY_TUNING.nightWatchCapMs / HOUR_MS };
}
