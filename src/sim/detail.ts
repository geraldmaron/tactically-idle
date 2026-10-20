// Instructor details (officer-value, owner decision 2026-10-19). A certified officer can spend a few
// hours teaching for a neighbouring department, which pays the department a fee when the detail
// ends. The fee per hour rises with the officer's wage and certifications, so pricier, better
// qualified officers earn faster. While on a detail the officer cannot deploy and earns no patrol
// pay, so the fee is a trade against readiness, never free money.
import type { GameState, HandlerResult, Id, Officer, ShiftReport } from './types';
import { awardXp, learnedXp } from './career';
import { deployability, fullName } from './officer';
import { postFunding } from './ledger';
import { simNow } from './calendar';
import { tunable } from './tuning';
import { money } from './format';

const HOUR_MS = 3_600_000;

/** Tunable (sim/tuning.ts). Fee per hour = base + perWage x wage + perCert x certifications. */
export const DETAIL_TUNING = tunable('DETAIL_TUNING', { hours: 4, base: 110, perWage: 1.5, perCert: 15, xpPerHour: 3 });

/** The fee an hour this officer earns on a detail, or null when they hold no certification to teach. */
export function detailRate(o: Pick<Officer, 'wage' | 'certs'>): number | null {
  if (!o.certs.length) return null;
  return Math.round(DETAIL_TUNING.base + DETAIL_TUNING.perWage * o.wage + DETAIL_TUNING.perCert * o.certs.length);
}

export interface DetailQuote { ok: boolean; reason: string | null; hours: number; fee: number }
export function detailCheck(state: GameState, officerId: Id): DetailQuote {
  const o = state.officers[officerId];
  const hours = DETAIL_TUNING.hours;
  if (!o) return { ok: false, reason: 'No such officer', hours, fee: 0 };
  const rate = detailRate(o);
  const fee = (rate ?? 0) * hours;
  if (rate === null) return { ok: false, reason: `${fullName(o)} needs a certification to teach`, hours, fee };
  if (o.assignment?.kind === 'detail') return { ok: false, reason: `${fullName(o)} is already on a detail`, hours, fee };
  const ready = deployability(o, simNow(state));
  if (!ready.ok) return { ok: false, reason: ready.reason, hours, fee };
  return { ok: true, reason: null, hours, fee };
}

export function startDetail(d: GameState, officerId: Id): HandlerResult {
  const quote = detailCheck(d, officerId);
  if (!quote.ok) return { ok: false, reason: quote.reason ?? 'Cannot start a detail' };
  const t = simNow(d);
  d.officers[officerId].assignment = { kind: 'detail', startedAt: t, endsAt: t + quote.hours * HOUR_MS, fee: quote.fee };
  return { ok: true };
}

/** Pay and release every detail that has ended by `t`, in the order they end. */
export function completeDetails(d: GameState, t: number, ev?: ShiftReport['personnel']): void {
  const due = Object.values(d.officers)
    .filter((o) => o.assignment?.kind === 'detail' && o.assignment.endsAt <= t)
    .sort((a, b) => (a.assignment!.kind === 'detail' ? a.assignment!.endsAt : 0) - (b.assignment!.kind === 'detail' ? b.assignment!.endsAt : 0) || a.id.localeCompare(b.id));
  for (const o of due) {
    const a = o.assignment;
    if (a?.kind !== 'detail') continue;
    postFunding(d.department, a.fee, 'detail', `Instructor detail, ${fullName(o)}`, a.endsAt);
    o.career.earned = (o.career.earned ?? 0) + a.fee;
    awardXp(d, o, learnedXp(o, DETAIL_TUNING.xpPerHour * (a.endsAt - a.startedAt) / HOUR_MS), 'after an instructor detail', a.endsAt, ev);
    o.assignment = null;
  }
}

/** One line for the player: what a detail would pay this officer. */
export function detailLine(o: Pick<Officer, 'wage' | 'certs'>): string {
  const rate = detailRate(o);
  return rate === null ? 'Needs a certification to teach' : `Instructor detail ${money(rate)}/h`;
}
