// Department economy and time. One code path serves online ticks and offline
// return: settle() walks [lastSettledAt, now] event by event (course completions,
// injury ends, equipment servicing and expiry, anniversaries, birthdays,
// retirements, incident arrivals and expiries, the funding-cap boundary, hourly restock) and recomputes hourly
// rates for every segment. A final hourly rate is never multiplied across a whole
// absence. Equipment wear is linear in game days, so it is split at the same
// boundaries and online ticks match one offline settlement.
import type { GameState, Id, NodeEffect, Officer, ShiftReport, SquadDuty, SquadId } from './types';
import { DEV_NODES } from '../content/dev-tree';
import { COURSES } from '../content/courses';
import { ITEMS } from '../content/items';
import { STRESS_BANDS } from './officer';
import { gameDay } from './calendar';
import { ageRecoveryFactor, applyCareerDue, nextCareerEventTime } from './career';
import { applyUnitDue, applyUnitWear, createUnit, nextUnitEventTime, ownedCount } from './equipment';
import { applyIncidentsDue, nextIncidentEventTime } from './incidents';

export const HOUR_MS = 3_600_000;

export const ECONOMY_TUNING = {
  /** Income and recurring costs accrue only this long after the last player command. */
  capMs: 24 * HOUR_MS,
  /** Department allocation per hour (funding). */
  baseAllocation: 600,
  /** Routine patrol income per available officer in a squad on patrol, per hour. */
  patrolPerOfficer: 150,
  /** Facilities, per hour. */
  facilities: 120,
  /** Routine supplies, per hour. */
  supplies: 80,
  /** Passive development points per hour; most come from operations. */
  devPointsPerHour: 0.25,
  /** Stress recovered per hour by the squad duty of the officer. */
  recoveryPerHour: { rest: 6, standby: 3, patrol: 1 } as Record<SquadDuty, number>,
  /** A settlement shorter than this does not produce a shift report (unless something notable happened). */
  reportMinMs: 15 * 60_000,
  /** Restock rules run on this absolute-clock grid, so tick size cannot change results. */
  restockIntervalMs: HOUR_MS,
};

// ---------------------------------------------------------------- formatting helpers

export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

/** Rounds up: '~3h', '~40m'. */
export function formatDuration(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ---------------------------------------------------------------- department queries

/** The clock this state has been settled to; handlers treat it as "now". */
export function simNow(state: GameState): number {
  return state.department.clockHighWater;
}

export function unlockedEffects(state: GameState): NodeEffect[] {
  const out: NodeEffect[] = [];
  for (const id of state.department.unlockedNodes) {
    const node = DEV_NODES[id];
    if (node) out.push(...node.effects);
  }
  return out;
}

export function isNodeUnlocked(state: GameState, nodeId: Id): boolean {
  return state.department.unlockedNodes.includes(nodeId);
}

export function hasEffect(state: GameState, kind: NodeEffect['kind']): boolean {
  return unlockedEffects(state).some((e) => e.kind === kind);
}

export function recoveryMultiplier(state: GameState): number {
  let m = 1;
  for (const e of unlockedEffects(state)) if (e.kind === 'recoveryRate') m *= e.mult;
  return m;
}

export function candidatePoolSize(state: GameState, basePool: number): number {
  let n = basePool;
  for (const e of unlockedEffects(state)) if (e.kind === 'candidatePool') n += e.delta;
  return n;
}

/** Is any member of the squad deployed (assignment or active run)? */
export function squadDeployed(state: GameState, squadId: SquadId): boolean {
  const run = state.activeRun;
  if (run && run.status !== 'closed' && run.squadIds.includes(squadId)) return true;
  const squad = state.squads.find((s) => s.id === squadId);
  if (!squad) return false;
  return squad.officerIds.some((id) => state.officers[id]?.assignment?.kind === 'operation');
}

export function isInjured(o: Officer, t: number): boolean {
  return !!o.injury && o.injury.until > t;
}

export function recoveryDuty(state: GameState, o: Officer): SquadDuty {
  const squad = o.squadId ? state.squads.find((s) => s.id === o.squadId) : undefined;
  return squad ? squad.duty : 'rest';
}

/**
 * Stress recovered per hour: duty rate x wellbeing multiplier x age factor (1% slower
 * per year past 45, floor 80%). Deployed officers recover nothing. `t` is the instant
 * the rate applies to (default: the settled clock), because age steps at birthdays.
 */
export function recoveryRate(state: GameState, o: Officer, t: number = simNow(state)): number {
  if (o.assignment?.kind === 'operation') return 0;
  const base = ECONOMY_TUNING.recoveryPerHour[recoveryDuty(state, o)] * recoveryMultiplier(state);
  return Number.isFinite(o.bornDay) ? base * ageRecoveryFactor(o, gameDay(state, t)) : base;
}

// ---------------------------------------------------------------- rates

export interface Rates {
  base: number;
  patrol: number;
  nodeIncome: number;
  gross: number;
  wages: number;
  operating: number;
  supplies: number;
  net: number;
  devPointsPerHour: number;
}

/** Hourly rates implied by the state at time t. Pure. */
export function ratesAt(state: GameState, t: number): Rates {
  let patrolMembers = 0;
  for (const sq of state.squads) {
    if (sq.duty !== 'patrol') continue;
    for (const id of sq.officerIds) {
      const o = state.officers[id];
      if (o && !o.assignment && !isInjured(o, t)) patrolMembers++;
    }
  }
  let nodeIncome = 0;
  for (const e of unlockedEffects(state)) if (e.kind === 'income') nodeIncome += e.perHour;
  let wages = 0;
  for (const o of Object.values(state.officers)) wages += o.wage;

  const base = ECONOMY_TUNING.baseAllocation;
  const patrol = patrolMembers * ECONOMY_TUNING.patrolPerOfficer;
  const gross = base + patrol + nodeIncome;
  const operating = ECONOMY_TUNING.facilities;
  const supplies = ECONOMY_TUNING.supplies;
  return {
    base,
    patrol,
    nodeIncome,
    gross,
    wages,
    operating,
    supplies,
    net: gross - wages - operating - supplies,
    devPointsPerHour: ECONOMY_TUNING.devPointsPerHour,
  };
}

// ---------------------------------------------------------------- settlement

interface Acc {
  gross: number;
  wages: number;
  operating: number;
  restock: number;
  dp: number;
  courses: { officerId: Id; courseId: Id }[];
  shortages: Set<string>;
  equipment: ShiftReport['equipment'];
  personnel: ShiftReport['personnel'];
}

function applyCourseCompletion(o: Officer, acc: Acc): void {
  const a = o.assignment;
  if (!a || a.kind !== 'training') return;
  const course = COURSES[a.courseId];
  if (course) {
    const { cert, rating } = course.grants;
    if (cert && !o.certs.includes(cert)) o.certs.push(cert);
    if (rating) o.ratings[rating.key] = Math.min(100, o.ratings[rating.key] + rating.delta);
    o.xp += Math.round(course.hours * 5);
  }
  o.assignment = null;
  acc.courses.push({ officerId: o.id, courseId: a.courseId });
}

function runRestock(d: GameState, acc: Acc, t: number): void {
  if (!hasEffect(d, 'restockRules')) return;
  const dep = d.department;
  for (const rule of dep.restockRules) {
    const def = ITEMS[rule.itemId];
    if (!def) continue;
    if (def.requiresNode && !isNodeUnlocked(d, def.requiresNode)) continue;
    // Count units still held (not scrapped, not expired), so expired stock gets replaced.
    const need = rule.target - ownedCount(d, rule.itemId);
    if (need <= 0) continue;
    const byCeiling = Math.floor(Math.max(0, rule.budgetCeiling) / def.cost);
    const byFunds = Math.floor(Math.max(0, dep.funding) / def.cost);
    const n = Math.min(need, byCeiling, byFunds);
    if (n > 0) {
      for (let i = 0; i < n; i++) createUnit(d, rule.itemId, t);
      dep.funding -= n * def.cost;
      acc.restock += n * def.cost;
    }
    if (n < need) {
      const why = byCeiling < need && byCeiling <= byFunds ? `spending ceiling ${money(rule.budgetCeiling)}` : 'not enough funding';
      acc.shortages.add(`${def.name}: restocked ${n} of ${need} wanted (${why})`);
    }
  }
}

/**
 * Apply every event due at or before t. `prev` is the previous sweep time of this
 * settlement, so scheduled career events (anniversaries, birthdays) in (prev, t] are
 * processed exactly once.
 */
function applyDue(d: GameState, prev: number, t: number, acc: Acc, restock: boolean): void {
  const due = Object.values(d.officers)
    .filter((o) => o.assignment?.kind === 'training' && o.assignment.endsAt <= t)
    .sort((a, b) => {
      const ea = a.assignment?.kind === 'training' ? a.assignment.endsAt : 0;
      const eb = b.assignment?.kind === 'training' ? b.assignment.endsAt : 0;
      return ea - eb || a.id.localeCompare(b.id);
    });
  for (const o of due) applyCourseCompletion(o, acc);
  for (const o of Object.values(d.officers)) {
    if (o.injury && o.injury.until <= t) o.injury = null;
  }
  applyUnitDue(d, t, acc.equipment);
  applyCareerDue(d, prev, t, acc.personnel);
  if (restock) runRestock(d, acc, t);
  applyIncidentsDue(d, prev, t);
}

function nextEventTime(d: GameState, t: number, T: number, W: number, restockActive: boolean): number {
  let e = T;
  const consider = (x: number | null) => {
    if (x !== null && x > t && x < e) e = x;
  };
  for (const o of Object.values(d.officers)) {
    if (o.assignment?.kind === 'training') consider(o.assignment.endsAt);
    if (o.injury) consider(o.injury.until);
  }
  consider(nextUnitEventTime(d, t));
  consider(nextCareerEventTime(d, t, (o) => recoveryRate(d, o, t)));
  consider(nextIncidentEventTime(d, t));
  consider(W);
  if (restockActive) {
    const I = ECONOMY_TUNING.restockIntervalMs;
    const g = (Math.floor(t / I) + 1) * I;
    if (g <= Math.min(T, W)) consider(g);
  }
  return e;
}

function recover(d: GameState, hours: number, t: number): void {
  if (hours <= 0) return;
  for (const o of Object.values(d.officers)) {
    const rate = recoveryRate(d, o, t);
    if (rate > 0) o.stress = Math.max(0, o.stress - rate * hours);
  }
}

/**
 * Settle department time up to max(now, clockHighWater). Mutates the draft.
 * Moving the clock backward grants nothing. Idempotent for equal times.
 */
export function settle(d: GameState, now: number): void {
  const dep = d.department;
  const T = Math.max(now, dep.clockHighWater);
  const L = dep.lastSettledAt;
  dep.clockHighWater = T;
  if (T <= L) return;

  const W = dep.lastInteractionAt + ECONOMY_TUNING.capMs;
  const fundingBefore = dep.funding;
  const acc: Acc = {
    gross: 0,
    wages: 0,
    operating: 0,
    restock: 0,
    dp: 0,
    courses: [],
    shortages: new Set(),
    equipment: [],
    personnel: [],
  };
  const wasRecovering = new Set(
    Object.values(d.officers)
      .filter((o) => o.assignment?.kind !== 'operation' && o.stress >= STRESS_BANDS.recovery)
      .map((o) => o.id),
  );

  const I = ECONOMY_TUNING.restockIntervalMs;
  applyDue(d, L, L, acc, false);
  let t = L;
  while (t < T) {
    const restockActive = hasEffect(d, 'restockRules');
    const e = nextEventTime(d, t, T, W, restockActive);

    const r = ratesAt(d, t);
    const accrualHours = t < W ? (Math.min(e, W) - t) / HOUR_MS : 0;
    if (accrualHours > 0) {
      acc.gross += r.gross * accrualHours;
      acc.wages += r.wages * accrualHours;
      acc.operating += (r.operating + r.supplies) * accrualHours;
      dep.funding += r.net * accrualHours;
      dep.devPoints += r.devPointsPerHour * accrualHours;
      acc.dp += r.devPointsPerHour * accrualHours;
      if (dep.funding < 0) {
        dep.funding = 0;
        acc.shortages.add('Funding ran out: payroll and operating costs were not fully covered');
      }
    }
    recover(d, (e - t) / HOUR_MS, t);
    applyUnitWear(d, t, e, acc.equipment);

    applyDue(d, t, e, acc, restockActive && e % I === 0 && e <= W);
    t = e;
  }

  // Unshortlisted candidates who have waited too long leave the pool.
  d.candidates = d.candidates.filter((c) => c.shortlisted || c.expiresAt > T);
  dep.lastSettledAt = T;

  // A short settlement is not worth a report unless something happened that the player should see.
  const notable = acc.courses.length > 0 || acc.equipment.length > 0 || acc.personnel.length > 0;
  if (T - L < ECONOMY_TUNING.reportMinMs && !notable) return;
  const recovered = [...wasRecovering].filter((id) => d.officers[id] && d.officers[id].stress < STRESS_BANDS.recovery);
  const rep: ShiftReport = {
    from: L,
    to: T,
    accruedHours: Math.max(0, Math.min(T, W) - L) / HOUR_MS,
    gross: acc.gross,
    wages: acc.wages,
    operating: acc.operating,
    restockSpend: acc.restock,
    net: dep.funding - fundingBefore,
    devPoints: acc.dp,
    completedCourses: acc.courses,
    recovered,
    shortages: [...acc.shortages],
    capped: T > W,
    equipment: acc.equipment,
    personnel: acc.personnel,
  };
  const prev = d.report;
  if (!prev) {
    d.report = rep;
    return;
  }
  d.report = {
    from: Math.min(prev.from, rep.from),
    to: rep.to,
    accruedHours: prev.accruedHours + rep.accruedHours,
    gross: prev.gross + rep.gross,
    wages: prev.wages + rep.wages,
    operating: prev.operating + rep.operating,
    restockSpend: prev.restockSpend + rep.restockSpend,
    net: prev.net + rep.net,
    devPoints: prev.devPoints + rep.devPoints,
    completedCourses: [...prev.completedCourses, ...rep.completedCourses],
    recovered: [...new Set([...prev.recovered, ...rep.recovered])],
    shortages: [...new Set([...prev.shortages, ...rep.shortages])],
    capped: prev.capped || rep.capped,
    equipment: [...(prev.equipment ?? []), ...rep.equipment],
    personnel: [...(prev.personnel ?? []), ...rep.personnel],
  };
}
