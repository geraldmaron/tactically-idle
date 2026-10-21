// Department economy and time. One code path serves online ticks and offline
// return: settle() walks [lastSettledAt, now] event by event (course completions,
// injury ends, equipment servicing and expiry, anniversaries, birthdays,
// retirements, incident arrivals and expiries, the funding-cap boundary, hourly restock and
// Command Staff checks) and recomputes hourly
// rates for every segment. A final hourly rate is never multiplied across a whole
// absence. Equipment wear is linear in game days, so it is split at the same
// boundaries and online ticks match one offline settlement.
import type { GameState, Id, NodeEffect, Officer, ShiftReport, SquadDuty } from './types';
import { developmentTier, effectiveDevelopmentEffects } from './development-tiers';
import { COURSES, courseRatingAfter, courseXpGain } from '../content/courses';
import { ITEMS } from '../content/items';
import { STRESS_BANDS } from './officer';
import { gameDay, simNow } from './calendar';
import { money } from './format';
import { recoveryDuty } from './squads';
import type { DutyRates } from './squad-optimizer';
import { ageRecoveryFactor, applyCareerDue, awardXp, learnedXp, nextCareerEventTime } from './career';
import { applyUnitDue, applyUnitWear, createUnit, nextUnitEventTime, ownedCount } from './equipment';
import { applyIncidentsDue, nextIncidentEventTime, type ContentExclusion } from './incidents';
import { runEquipmentMaintenance } from './equipment-manager';
import { departmentUpkeep, maintenanceBudget } from './equipment-manager-policy';
import { commandStaffActive, commandStaffSalaries, logQuartermaster, runCommandStaff } from './command-staff';
import { tunable } from './tuning';
import { staffLever } from './staff-pool';
import { RECRUIT_TUNING } from '../content/recruits';
import { postFunding } from './ledger';
import { completeDetails } from './detail';

export const HOUR_MS = 3_600_000;

/** Tunable (sim/tuning.ts). */
export const ECONOMY_TUNING = tunable('ECONOMY_TUNING', {
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
  /** Stress recovered per hour by the squad duty of the officer. */
  recoveryPerHour: { rest: 6, standby: 3, patrol: 1 } as Record<SquadDuty, number>,
  /** A settlement shorter than this does not produce a shift report (unless something notable happened). */
  reportMinMs: 15 * 60_000,
  /** Restock rules run on this absolute-clock grid, so tick size cannot change results. */
  restockIntervalMs: HOUR_MS,
});

// ---------------------------------------------------------------- department queries

export function unlockedEffects(state: GameState): NodeEffect[] {
  return effectiveDevelopmentEffects(state);
}

export function isNodeUnlocked(state: GameState, nodeId: Id): boolean {
  return developmentTier(state, nodeId) > 0;
}

export function hasEffect(state: GameState, kind: NodeEffect['kind']): boolean {
  return unlockedEffects(state).some((e) => e.kind === kind);
}

export function recoveryMultiplier(state: GameState): number {
  let m = 1;
  for (const e of unlockedEffects(state)) if (e.kind === 'recoveryRate') m *= e.mult;
  return m;
}

/** How many candidates the recruit pool holds: the base pool plus what upgrades add. */
export function candidatePoolSize(state: GameState): number {
  let n = RECRUIT_TUNING.basePool;
  for (const e of unlockedEffects(state)) if (e.kind === 'candidatePool') n += e.delta;
  return n;
}

export function isInjured(o: Officer, t: number): boolean {
  return !!o.injury && o.injury.until > t;
}

/**
 * Stress recovered per hour: duty rate x wellbeing multiplier x age factor (1% slower
 * per year past 45, floor 80%). Deployed officers recover nothing. `t` is the instant
 * the rate applies to (default: the settled clock), because age steps at birthdays.
 */
/** The Watch Commander's recovery lever, on squads they sent to rest. */
function restBonus(state: GameState, o: Officer): number {
  const lever = staffLever(state, 'watch_commander', 0);
  if (!lever || !o.squadId) return 1;
  return state.commandStaff?.watch_commander.rested[o.squadId] && state.squads.some((s) => s.id === o.squadId && s.duty === 'rest') ? 1 + lever : 1;
}

export function recoveryRate(state: GameState, o: Officer, t: number = simNow(state)): number {
  if (o.assignment?.kind === 'operation') return 0;
  const base = ECONOMY_TUNING.recoveryPerHour[recoveryDuty(state, o)] * recoveryMultiplier(state) * restBonus(state, o);
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
  /** Command Staff salaries, paid with payroll while each manager is on. */
  staff: number;
  net: number;
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
  const staff = commandStaffSalaries(state);
  const supplies = ECONOMY_TUNING.supplies;
  return {
    base,
    patrol,
    nodeIncome,
    gross,
    wages,
    operating,
    supplies,
    staff,
    net: gross - wages - staff - operating - supplies,
  };
}

/** One officer's hourly money: what they bring in (patrol, or a detail's fee spread over its hours)
 * against their wage. Patrol pay is flat per officer (docs/patrol-work.md, owner 2026-10-19), so
 * rates differ by wage, duty and instructor details, never by skill on patrol. */
export interface OfficerRate {
  patrol: number;
  detail: number;
  wage: number;
  net: number;
}

/** Hourly rate of every officer at time t. Their patrol column sums to ratesAt().patrol. Pure. */
export function officerRates(state: GameState, t: number): Record<Id, OfficerRate> {
  const patrolling = new Set<Id>();
  for (const sq of state.squads) if (sq.duty === 'patrol') for (const id of sq.officerIds) patrolling.add(id);
  const out: Record<Id, OfficerRate> = {};
  for (const o of Object.values(state.officers)) {
    const patrol = patrolling.has(o.id) && !o.assignment && !isInjured(o, t) ? ECONOMY_TUNING.patrolPerOfficer : 0;
    const a = o.assignment;
    const detail = a?.kind === 'detail' && a.endsAt > a.startedAt ? a.fee / ((a.endsAt - a.startedAt) / HOUR_MS) : 0;
    out[o.id] = { patrol, detail, wage: o.wage, net: patrol + detail - o.wage };
  }
  return out;
}

/** What each squad duty is worth, for the squad builder's preview (squad-optimizer.ts DutyRates). */
export function dutyRates(): DutyRates {
  return { recoveryPerHour: ECONOMY_TUNING.recoveryPerHour, patrolPerOfficer: ECONOMY_TUNING.patrolPerOfficer };
}

/** The hourly net at the state's settled clock: what the roster weighs a hire or dismissal against. */
export function netRate(state: GameState): number {
  return ratesAt(state, simNow(state)).net;
}

// ---------------------------------------------------------------- settlement

interface Acc {
  gross: number;
  wages: number;
  operating: number;
  restock: number;
  maintenance: number;
  maintenanceStarted: Id[];
  courses: { officerId: Id; courseId: Id }[];
  shortages: Set<string>;
  equipment: ShiftReport['equipment'];
  personnel: ShiftReport['personnel'];
}

function applyCourseCompletion(d: GameState, o: Officer, acc: Acc): void {
  const a = o.assignment;
  if (!a || a.kind !== 'training') return;
  const course = COURSES[a.courseId];
  if (course) {
    const { cert, rating } = course.grants;
    if (cert && !o.certs.includes(cert)) o.certs.push(cert);
    if (rating) o.ratings[rating.key] = courseRatingAfter(o.ratings[rating.key], rating.delta);
    const base = courseXpGain(course.hours) * (1 + (staffLever(d, 'training_sergeant', 1) ?? 0));
    awardXp(d, o, learnedXp(o, base), `on finishing the ${course.name}`, a.endsAt, acc.personnel);
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
      postFunding(dep, -n * def.cost, 'restock', `Restocked ${def.name}`, t);
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
function applyDue(d: GameState, prev: number, t: number, acc: Acc, restock: boolean, exclusion?: ContentExclusion): void {
  const due = Object.values(d.officers)
    .filter((o) => o.assignment?.kind === 'training' && o.assignment.endsAt <= t)
    .sort((a, b) => {
      const ea = a.assignment?.kind === 'training' ? a.assignment.endsAt : 0;
      const eb = b.assignment?.kind === 'training' ? b.assignment.endsAt : 0;
      return ea - eb || a.id.localeCompare(b.id);
    });
  for (const o of due) applyCourseCompletion(d, o, acc);
  completeDetails(d, t, acc.personnel);
  for (const o of Object.values(d.officers)) {
    if (o.injury && o.injury.until <= t) o.injury = null;
  }
  applyUnitDue(d, t, acc.equipment);
  applyCareerDue(d, prev, t, acc.personnel);
  if (restock) {
    const restockBefore = acc.restock;
    runRestock(d, acc, t);
    const maintenance = runEquipmentMaintenance(d, t);
    acc.maintenance += maintenance.spent;
    acc.maintenanceStarted.push(...maintenance.started);
    logQuartermaster(d, t, maintenance.started, maintenance.spent, acc.restock - restockBefore);
    runCommandStaff(d, t);
  }
  applyIncidentsDue(d, prev, t, exclusion);
}

function nextEventTime(d: GameState, t: number, T: number, W: number, restockActive: boolean): number {
  let e = T;
  const consider = (x: number | null) => {
    if (x !== null && x > t && x < e) e = x;
  };
  for (const o of Object.values(d.officers)) {
    if (o.assignment?.kind === 'training' || o.assignment?.kind === 'detail') consider(o.assignment.endsAt);
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
export function settle(d: GameState, now: number, exclusion?: ContentExclusion): void {
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
    maintenance: 0,
    maintenanceStarted: [],
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
  applyDue(d, L, L, acc, false, exclusion);
  let t = L;
  while (t < T) {
    const restockActive = hasEffect(d, 'restockRules') || maintenanceBudget(d) > 0 || commandStaffActive(d);
    const e = nextEventTime(d, t, T, W, restockActive);

    const r = ratesAt(d, t);
    const accrualHours = t < W ? (Math.min(e, W) - t) / HOUR_MS : 0;
    if (accrualHours > 0) {
      acc.gross += r.gross * accrualHours;
      acc.wages += (r.wages + r.staff) * accrualHours;
      acc.operating += (r.operating + r.supplies) * accrualHours;
      dep.funding += r.net * accrualHours;
      if (dep.funding < 0) {
        dep.funding = 0;
        acc.shortages.add('Funding ran out: payroll and operating costs were not fully covered');
      }
    }
    recover(d, (e - t) / HOUR_MS, t);
    applyUnitWear(d, t, e, acc.equipment, departmentUpkeep(d));

    applyDue(d, t, e, acc, restockActive && e % I === 0 && e <= W, exclusion);
    t = e;
  }

  // Unshortlisted candidates who have waited too long leave the pool.
  d.candidates = d.candidates.filter((c) => c.shortlisted || c.expiresAt > T);
  dep.lastSettledAt = T;

  // A short settlement is not worth a report unless something happened that the player should see.
  const notable = acc.courses.length > 0 || acc.equipment.length > 0 || acc.personnel.length > 0 || acc.maintenanceStarted.length > 0;
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
    maintenanceSpend: acc.maintenance,
    maintenanceStarted: acc.maintenanceStarted,
    net: dep.funding - fundingBefore,
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
    maintenanceSpend: (prev.maintenanceSpend ?? 0) + (rep.maintenanceSpend ?? 0),
    maintenanceStarted: [...(prev.maintenanceStarted ?? []), ...(rep.maintenanceStarted ?? [])],
    net: prev.net + rep.net,
    ...(prev.grants?.length || rep.grants?.length ? { grants: [...(prev.grants ?? []), ...(rep.grants ?? [])] } : {}),
    completedCourses: [...prev.completedCourses, ...rep.completedCourses],
    recovered: [...new Set([...prev.recovered, ...rep.recovered])],
    shortages: [...new Set([...prev.shortages, ...rep.shortages])],
    capped: prev.capped || rep.capped,
    equipment: [...(prev.equipment ?? []), ...rep.equipment],
    personnel: [...(prev.personnel ?? []), ...rep.personnel],
  };
}
