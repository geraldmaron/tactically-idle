// Officer careers: ageing, service anniversaries, experience-driven learning and
// announced retirement. Pure of the economy module (callers pass recovery rates
// and the budget in) so economy.settle can call it without an import cycle.
//
// Everything runs on the game calendar (src/sim/calendar.ts). Scheduled events
// (anniversaries, birthdays, retirement days, the 20-day burnout clock) are
// returned by nextCareerEventTime so the settlement cuts its segments there;
// condition-based rules (burnout, mandatory age, xp growth) are evaluated at every
// sweep. Both are functions of state and time only, so online ticks and one
// offline settlement land in the same place.
import type { DebriefResult, GameState, Id, Officer, RatingKey, Role, ShiftReport } from './types';
import { CALENDAR, EXPERIENCE_LABEL, ageYears, experienceBand, formatGameDate, gameDay, msForGameDay, serviceYears, type ExperienceBand } from './calendar';
import { next, hashSeed } from './rng';
import { fullName } from './officer';

export const CAREER_TUNING = {
  /** Mandatory retirement age. */
  retireAge: 60,
  /** Retirements are announced this many game days ahead. */
  noticeDays: 30,
  /** Service years from which an officer may choose to retire. */
  serviceEligibleYears: 25,
  /** Chance of choosing to retire at the Nth service anniversary from 25: base + step x (N - 25), capped. */
  serviceRetireBase: 0.12,
  serviceRetireStep: 0.06,
  serviceRetireCap: 0.75,
  /** Retention offer: wage raise share, and how far the retirement day moves. */
  retentionRaise: 0.12,
  retentionDays: 365,
  /** Burnout: stress above this for this many game days, or adverse operations in a recent window. */
  burnoutStress: 70,
  burnoutSustainDays: 20,
  burnoutAdverse: 3,
  burnoutWindow: 5,
  /** A full service year adds this to the hourly wage, up to wageCap. */
  wageStep: 1,
  wageCap: 70,
  /** Stress recovery slows 1% per year of age past 45, never below 80% of the base rate. */
  ageRecoveryStart: 45,
  ageRecoveryPerYear: 0.01,
  ageRecoveryFloor: 0.8,
  /** Birthdays are reported only when they reach one of these ages (the effect band changes). */
  ageBands: [50, 55, 60],
  /** xp -> rating growth: every 100 xp is +1 to the officer's main rating, scaled by the learning multiplier. */
  xpPerPoint: 100,
  xpRatingCeiling: 90,
  /** Debrief outcome score thresholds (0.55 objective + 0.45 safety). */
  favorableAt: 0.6,
  adverseBelow: 0.4,
};

/** Experience band -> how fast xp becomes rating growth. */
export const LEARNING_MULTIPLIER: Record<ExperienceBand, number> = {
  rookie: 1.3,
  developing: 1.0,
  seasoned: 0.85,
  veteran: 0.7,
};

/** The rating an officer's xp improves, by role. */
export const ROLE_MAIN_RATING: Record<Role, RatingKey> = {
  comms: 'communication',
  breach: 'shooting',
  medic: 'medical',
  recon: 'awareness',
  lead: 'coordination',
};

/**
 * Hidden bookkeeping stored on officers as optional JSON-safe fields (same pattern
 * as Department.candidateRefreshedAt), because the Officer type is frozen:
 * - xpBanked: xp already converted into rating growth (or present at creation).
 * - highStressSince: epoch ms when stress first went above the burnout line, if it still is.
 * - lastRunCounted: runId of the newest debrief already counted into `career`.
 */
export type OfficerExt = Officer & { xpBanked?: number; highStressSince?: number | null; lastRunCounted?: string | null };
const ext = (o: Officer) => o as OfficerExt;

const EPS_DAY = 1e-6;
const DAY = CALENDAR.daysPerYear;

type PersonnelEvent = ShiftReport['personnel'][number];

/** Officers carrying the career fields (older fixtures may lack them; they are skipped, never crashed on). */
function hasCareer(o: Officer): boolean {
  return Boolean(o.career) && Number.isFinite(o.bornDay) && Number.isFinite(o.serviceStartDay);
}

// ---------------------------------------------------------------- age, experience, learning

/** Whole years of age at the given game day. */
export function wholeAge(o: Pick<Officer, 'bornDay'>, day: number): number {
  return Math.floor(ageYears(o, day + EPS_DAY));
}

/** Stress recovery multiplier from age. Steps once per birthday so it only changes at events. */
export function ageRecoveryFactor(o: Pick<Officer, 'bornDay'>, day: number): number {
  const over = Math.max(0, wholeAge(o, day) - CAREER_TUNING.ageRecoveryStart);
  return Math.max(CAREER_TUNING.ageRecoveryFloor, 1 - CAREER_TUNING.ageRecoveryPerYear * over);
}

export function learningMultiplier(o: Pick<Officer, 'serviceStartDay' | 'career'>, day: number): number {
  return LEARNING_MULTIPLIER[experienceBand(o, day)];
}

/**
 * Convert banked-up xp into rating growth: `xpPerPoint / multiplier` xp buys +1 to the
 * role's main rating (rookies need ~77, developing 100, seasoned ~118, veterans ~143).
 * Returns the rating points gained. Stops at the ceiling; courses can still go higher.
 */
export function applyXpGrowth(o: Officer, day: number): number {
  const e = ext(o);
  const key = ROLE_MAIN_RATING[o.role];
  if (!key || !hasCareer(o)) return 0;
  const need = Math.max(1, Math.round(CAREER_TUNING.xpPerPoint / learningMultiplier(o, day)));
  let banked = e.xpBanked ?? 0;
  let gained = 0;
  while (o.xp - banked >= need && o.ratings[key] < CAREER_TUNING.xpRatingCeiling) {
    banked += need;
    o.ratings[key] += 1;
    gained++;
  }
  e.xpBanked = banked;
  return gained;
}

/** Share of xp still to go for the next rating point, for display (0..1). */
export function xpProgress(o: Officer, day: number): number {
  const need = Math.max(1, Math.round(CAREER_TUNING.xpPerPoint / learningMultiplier(o, day)));
  return Math.max(0, Math.min(1, (o.xp - (ext(o).xpBanked ?? 0)) / need));
}

// ---------------------------------------------------------------- operation history (derived from debriefs)

export type DebriefBand = 'favorable' | 'mixed' | 'adverse';

export function debriefBand(d: Pick<DebriefResult, 'objective' | 'civilianSafety'>): DebriefBand {
  const f = (0.55 * d.objective.score + 0.45 * d.civilianSafety.score) / 100;
  if (f >= CAREER_TUNING.favorableAt) return 'favorable';
  if (f < CAREER_TUNING.adverseBelow) return 'adverse';
  return 'mixed';
}

/** Debriefs an officer took part in, newest first. */
function officerDebriefs(state: GameState, officerId: Id): DebriefResult[] {
  return state.debriefs.filter((db) => db.officerCondition.some((c) => c.officerId === officerId));
}

/** Adverse outcomes among the officer's last `burnoutWindow` operations still on record. */
export function recentAdverse(state: GameState, officerId: Id): { adverse: number; total: number } {
  const recent = officerDebriefs(state, officerId).slice(0, CAREER_TUNING.burnoutWindow);
  return { adverse: recent.filter((db) => debriefBand(db) === 'adverse').length, total: recent.length };
}

/**
 * Count debriefs the officer has not been credited with yet into career.operations /
 * favorable / adverse. Idempotent through `lastRunCounted`, so the operation module
 * may also call it from closeDebrief without double counting.
 */
export function countNewDebriefs(state: GameState, o: Officer): void {
  if (!hasCareer(o)) return;
  const e = ext(o);
  const mine = officerDebriefs(state, o.id); // newest first
  if (mine.length === 0) return;
  let fresh: DebriefResult[];
  if (e.lastRunCounted == null) fresh = mine;
  else {
    const at = mine.findIndex((db) => db.runId === e.lastRunCounted);
    fresh = at < 0 ? [] : mine.slice(0, at);
  }
  for (const db of fresh) {
    const band = debriefBand(db);
    o.career.operations += 1;
    if (band === 'favorable') o.career.favorable += 1;
    if (band === 'adverse') o.career.adverse += 1;
  }
  e.lastRunCounted = mine[0].runId;
}

// ---------------------------------------------------------------- retirement

export function mandatoryRetirementDay(o: Pick<Officer, 'bornDay'>): number {
  return o.bornDay + CAREER_TUNING.retireAge * DAY;
}

export function serviceEligibleDay(o: Pick<Officer, 'serviceStartDay'>): number {
  return o.serviceStartDay + CAREER_TUNING.serviceEligibleYears * DAY;
}

const RETIREMENT_REASON_LABEL = {
  age: `Reached the mandatory retirement age of ${CAREER_TUNING.retireAge}`,
  service: 'Chose to retire after a long career',
  burnout: 'Worn down by sustained strain',
} as const;
export const retirementReasonLabel = (r: keyof typeof RETIREMENT_REASON_LABEL) => RETIREMENT_REASON_LABEL[r];

/** Deterministic: does the officer choose to retire at their Nth service anniversary (N >= 25)? */
export function servicePicksRetirement(o: Pick<Officer, 'id'>, anniversary: number): boolean {
  if (anniversary < CAREER_TUNING.serviceEligibleYears) return false;
  const p = Math.min(
    CAREER_TUNING.serviceRetireCap,
    CAREER_TUNING.serviceRetireBase + CAREER_TUNING.serviceRetireStep * (anniversary - CAREER_TUNING.serviceEligibleYears),
  );
  return next(hashSeed(`${o.id}:service:${anniversary}`)).value < p;
}

/** No age retirement announced yet, and any other announced date falls after the mandatory one. */
function needsAgeAnnouncement(o: Officer, ageDay: number): boolean {
  return !o.retirement || (o.retirement.reason !== 'age' && o.retirement.day > ageDay);
}

function setRetirement(o: Officer, day: number, reason: 'age' | 'service' | 'burnout', announcedDay: number): void {
  o.retirement = { day, reason, announcedDay, extended: false };
}

function removeFromRoster(d: GameState, officerId: Id): void {
  for (const sq of d.squads) {
    if (!sq.officerIds.includes(officerId)) continue;
    sq.officerIds = sq.officerIds.filter((id) => id !== officerId);
    if (sq.leaderId === officerId) sq.leaderId = sq.officerIds[0] ?? null;
  }
  delete d.officers[officerId];
}

// ---------------------------------------------------------------- scheduled events

const annivMs = (d: GameState, o: Officer, k: number) => msForGameDay(d, o.serviceStartDay + k * DAY);
const birthMs = (d: GameState, o: Officer, k: number) => msForGameDay(d, o.bornDay + k * DAY);

/** Smallest k >= 1 whose event time is strictly after t. */
function firstAfter(d: GameState, o: Officer, t: number, ms: (d: GameState, o: Officer, k: number) => number, startDay: number): number {
  let k = Math.max(1, Math.floor((gameDay(d, t) - startDay) / DAY) - 1);
  while (ms(d, o, k) <= t) k++;
  return k;
}

/**
 * Earliest career event strictly after t, as epoch ms, or null. `rateOf` returns an
 * officer's stress recovery per hour at t (it knows duty, deployment and age).
 */
export function nextCareerEventTime(d: GameState, t: number, rateOf: (o: Officer) => number): number | null {
  let e: number | null = null;
  const consider = (x: number) => {
    if (Number.isFinite(x) && x > t && (e === null || x < e)) e = x;
  };
  for (const o of Object.values(d.officers)) {
    if (!hasCareer(o)) continue;
    consider(annivMs(d, o, firstAfter(d, o, t, annivMs, o.serviceStartDay)));
    consider(birthMs(d, o, firstAfter(d, o, t, birthMs, o.bornDay)));
    if (o.retirement) consider(msForGameDay(d, o.retirement.day));
    const ageDay = mandatoryRetirementDay(o);
    if (needsAgeAnnouncement(o, ageDay)) consider(msForGameDay(d, ageDay - CAREER_TUNING.noticeDays));
    const since = ext(o).highStressSince;
    if (since != null) consider(since + CAREER_TUNING.burnoutSustainDays * CALENDAR.gameDayMs);
    if (o.stress > CAREER_TUNING.burnoutStress + 1e-9) {
      const rate = rateOf(o);
      if (rate > 0) consider(t + ((o.stress - CAREER_TUNING.burnoutStress) / rate) * 3_600_000);
    }
  }
  return e;
}

interface Scheduled {
  ms: number;
  officerId: Id;
  kind: 'anniversary' | 'birthday';
  k: number;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

const yearsWord = (n: number) => `${n} year${n === 1 ? '' : 's'}`;

/** Player-language effect of age on recovery at a given whole age ('Recovers 8% slower'), or null. */
export function ageEffectLine(age: number): string | null {
  const over = Math.max(0, age - CAREER_TUNING.ageRecoveryStart);
  if (over <= 0) return null;
  const pct = Math.round((1 - Math.max(CAREER_TUNING.ageRecoveryFloor, 1 - CAREER_TUNING.ageRecoveryPerYear * over)) * 100);
  return pct > 0 ? `Recovers ${pct}% slower (age ${age})` : null;
}

// ---------------------------------------------------------------- the sweep

/**
 * Apply career events due in (prev, t]: anniversaries and birthdays in time order,
 * then the condition-based rules at t (xp growth, operation counts, burnout,
 * announcements, retirement). Mutates the draft; reports go to `ev`.
 */
export function applyCareerDue(d: GameState, prev: number, t: number, ev: PersonnelEvent[]): void {
  const officers = Object.values(d.officers)
    .filter(hasCareer)
    .sort((a, b) => a.id.localeCompare(b.id));
  const day = gameDay(d, t);

  // 1. Scheduled events in (prev, t].
  const due: Scheduled[] = [];
  if (t > prev) {
    for (const o of officers) {
      const lo = (kind: 'anniversary' | 'birthday') => Math.max(1, Math.floor((gameDay(d, prev) - (kind === 'anniversary' ? o.serviceStartDay : o.bornDay)) / DAY) - 1);
      for (const kind of ['anniversary', 'birthday'] as const) {
        const ms = kind === 'anniversary' ? annivMs : birthMs;
        for (let k = lo(kind); ms(d, o, k) <= t; k++) {
          const x = ms(d, o, k);
          if (x > prev) due.push({ ms: x, officerId: o.id, kind, k });
        }
      }
    }
    due.sort((a, b) => a.ms - b.ms || a.officerId.localeCompare(b.officerId) || a.kind.localeCompare(b.kind));
  }
  for (const s of due) {
    const o = d.officers[s.officerId];
    if (!o) continue;
    const eventDay = gameDay(d, s.ms);
    if (s.kind === 'anniversary') {
      const before = experienceBand(o, eventDay - DAY);
      const after = experienceBand(o, eventDay);
      let detail = `${fullName(o)}: ${yearsWord(s.k)} of service`;
      if (o.wage < CAREER_TUNING.wageCap) {
        const raise = Math.min(CAREER_TUNING.wageStep, CAREER_TUNING.wageCap - o.wage);
        o.wage += raise;
        detail += `. Wage +${money(raise)}/h (now ${money(o.wage)}/h)`;
      }
      if (before !== after) detail += `. Now ${EXPERIENCE_LABEL[after]}`;
      ev.push({ officerId: o.id, event: 'anniversary', detail });
      // At 25+ years the officer may choose to retire; the draw is deterministic per officer and year.
      if (!o.retirement && servicePicksRetirement(o, s.k)) {
        const leaveDay = eventDay + CAREER_TUNING.noticeDays;
        if (leaveDay < mandatoryRetirementDay(o)) {
          setRetirement(o, leaveDay, 'service', eventDay);
          ev.push({
            officerId: o.id,
            event: 'retirement_announced',
            detail: `${fullName(o)} will retire on ${formatGameDate(leaveDay)} after ${yearsWord(s.k)} of service. A retention offer is possible.`,
          });
        }
      }
    } else if (CAREER_TUNING.ageBands.includes(s.k)) {
      const effect = ageEffectLine(s.k);
      ev.push({ officerId: o.id, event: 'birthday', detail: `${fullName(o)} turned ${s.k}${effect ? `: ${effect.replace(/ \(age \d+\)/, '')}` : ''}` });
    }
  }

  // 2. Condition-based rules at t.
  for (const o of officers) {
    if (!d.officers[o.id]) continue;
    const e = ext(o);
    countNewDebriefs(d, o);
    applyXpGrowth(o, day);

    // Burnout clock: starts when stress first goes above the line, resets when it drops back.
    const high = o.stress > CAREER_TUNING.burnoutStress + 1e-9;
    if (high && e.highStressSince == null) e.highStressSince = t;
    else if (!high) e.highStressSince = null;

    // Mandatory age: announce 30 days ahead; trumps a later service/burnout date.
    const ageDay = mandatoryRetirementDay(o);
    if (day + EPS_DAY >= ageDay - CAREER_TUNING.noticeDays && needsAgeAnnouncement(o, ageDay)) {
      // On time the leaving day is the birthday itself; if already past the notice window, give the full notice.
      const late = day > ageDay - CAREER_TUNING.noticeDays + EPS_DAY;
      const leaveDay = late ? day + CAREER_TUNING.noticeDays : ageDay;
      setRetirement(o, leaveDay, 'age', day);
      ev.push({
        officerId: o.id,
        event: 'retirement_announced',
        detail: `${fullName(o)} reaches the mandatory retirement age of ${CAREER_TUNING.retireAge}. Retiring on ${formatGameDate(leaveDay)}.`,
      });
    }

    // Burnout: sustained high stress, or too many adverse operations lately.
    if (!o.retirement) {
      const sustained = e.highStressSince != null && t >= e.highStressSince + CAREER_TUNING.burnoutSustainDays * CALENDAR.gameDayMs;
      const adverse = recentAdverse(d, o.id).adverse >= CAREER_TUNING.burnoutAdverse;
      const leaveDay = day + CAREER_TUNING.noticeDays;
      if ((sustained || adverse) && leaveDay < ageDay) {
        setRetirement(o, leaveDay, 'burnout', day);
        ev.push({
          officerId: o.id,
          event: 'retirement_announced',
          detail: `${fullName(o)} is burning out (${sustained ? `stress above ${CAREER_TUNING.burnoutStress} for ${CAREER_TUNING.burnoutSustainDays} days` : `${CAREER_TUNING.burnoutAdverse} adverse operations in the last ${CAREER_TUNING.burnoutWindow}`}) and will retire on ${formatGameDate(leaveDay)}.`,
        });
      }
    }

    // Retirement day: the officer leaves, unless deployed or in training; then right after.
    if (o.retirement && day + EPS_DAY >= o.retirement.day && !o.assignment) {
      ev.push({ officerId: o.id, event: 'retired', detail: `${fullName(o)} retired after ${yearsWord(Math.floor(serviceYears(o, day)))} of service.` });
      removeFromRoster(d, o.id);
    }
  }
}

// ---------------------------------------------------------------- retention

export interface RetentionCheck {
  ok: boolean;
  reason: string | null;
  /** Hourly wage raise and the new retirement day, when offerable. */
  raise: number;
  newDay: number | null;
}

/** Can the officer be persuaded to stay? `netBefore` is the department's hourly net now. */
export function retentionCheck(state: GameState, officerId: Id, now: number, netBefore: number): RetentionCheck {
  const o = state.officers[officerId];
  const no = (reason: string, raise = 0, newDay: number | null = null): RetentionCheck => ({ ok: false, reason, raise, newDay });
  if (!o || !hasCareer(o)) return no('No such officer');
  const r = o.retirement;
  if (!r) return no(`${fullName(o)} is not retiring`);
  const raise = Math.max(1, Math.round(o.wage * CAREER_TUNING.retentionRaise));
  if (r.reason === 'age') return no(`${fullName(o)} reaches the mandatory retirement age of ${CAREER_TUNING.retireAge}; that cannot be deferred`, raise);
  if (r.reason === 'burnout') return no(`${fullName(o)} is leaving from strain; a raise will not change that`, raise);
  if (r.extended) return no(`${fullName(o)} has already been persuaded to stay once`, raise);
  const day = gameDay(state, now);
  if (day + EPS_DAY >= r.day) return no(`${fullName(o)} is already leaving`, raise);
  const newDay = r.day + CAREER_TUNING.retentionDays;
  if (newDay >= mandatoryRetirementDay(o)) {
    return no(`A year more would pass ${fullName(o)}'s mandatory retirement on ${formatGameDate(mandatoryRetirementDay(o))}`, raise, newDay);
  }
  const netAfter = netBefore - raise;
  if (netAfter < 0) return no(`A ${money(raise)}/h raise would leave the department ${money(-netAfter)}/h short`, raise, newDay);
  return { ok: true, reason: null, raise, newDay };
}

/** Apply a retention offer that passed retentionCheck. */
export function applyRetention(d: GameState, officerId: Id, check: RetentionCheck): void {
  const o = d.officers[officerId];
  if (!o || !o.retirement || check.newDay === null) return;
  o.wage += check.raise;
  o.retirement = { ...o.retirement, day: check.newDay, extended: true };
}

// ---------------------------------------------------------------- planning

/** Funding per hour of anniversary wage steps landing within the next `days` game days. */
export function upcomingWageSteps(state: GameState, t: number, days: number): number {
  const start = gameDay(state, t);
  let total = 0;
  for (const o of Object.values(state.officers)) {
    if (!hasCareer(o) || o.wage >= CAREER_TUNING.wageCap) continue;
    const k = Math.floor((start - o.serviceStartDay) / DAY) + 1;
    const when = o.serviceStartDay + k * DAY;
    const leaves = o.retirement && o.retirement.day <= when;
    if (when > start && when <= start + days && !leaves) total += Math.min(CAREER_TUNING.wageStep, CAREER_TUNING.wageCap - o.wage);
  }
  return total;
}

/** Plain span for outlook lines: '3 years', '1.4 years', '200 days'. */
export function spanLabel(days: number): string {
  if (days >= 2 * DAY) return `${Math.round(days / DAY)} years`;
  if (days >= DAY) return `${Math.round((days / DAY) * 10) / 10} years`;
  return `${Math.max(1, Math.round(days))} days`;
}
