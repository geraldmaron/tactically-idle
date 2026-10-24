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
import { funding } from './format';
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
import { accruePatrolService, applyPatrolDue, nextPatrolEventTime, patrolRates } from './patrol';
import { allocationRate, finishFirstReturn, newWorldAcc, nextWorldEventTime, settleWorld, worldReport } from './world';
import { activeShifts, shiftGrantPerHour } from './world/shifts';
import { ALLOCATION } from '../content/city/tuning';
import { nextPeopleEventTime, settlePeople } from './people';

export const HOUR_MS = 3_600_000;

/** Tunable (sim/tuning.ts). */
export const ECONOMY_TUNING = tunable('ECONOMY_TUNING', {
  /** Income and recurring costs accrue only this long after the last player command (72 hours free;
   * Night Watch Office extends funding, never the world's opportunities: see worldCapMs). */
  capMs: 72 * HOUR_MS,
  nightWatchCapMs: 7 * 24 * HOUR_MS,
  /** Contacts, crime drift and recruitment stop this long after the last command, whatever is owned. */
  worldCapMs: 72 * HOUR_MS,
  /** Stress a proactive shift adds per hour to each officer on it. */
  proactiveStrainPerHour: 2,
  /** Department allocation per hour (funding). */
  baseAllocation: 600,
  /** Facilities, per hour. */
  facilities: 120,
  /** Routine supplies, per hour. */
  supplies: 80,
  /** Stress recovered per hour by the squad duty of the officer. */
  recoveryPerHour: { rest: 6, standby: 3 } as Record<SquadDuty, number>,
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
  // A proactive shift strains instead of resting; a stand-down rests at the rest rate (save v19).
  if (o.assignment?.kind === 'proactive') return -ECONOMY_TUNING.proactiveStrainPerHour;
  const duty = o.assignment?.kind === 'standdown' ? 'rest' : recoveryDuty(state, o);
  const base = ECONOMY_TUNING.recoveryPerHour[duty] * recoveryMultiplier(state) * restBonus(state, o);
  return Number.isFinite(o.bornDay) ? base * ageRecoveryFactor(o, gameDay(state, t)) : base;
}

// ---------------------------------------------------------------- rates

export interface Rates {
  /** City allocation: the base per open district, scaled by how calm the city is (world/core.ts). */
  base: number;
  /** Grants from squads on a proactive shift at this time. Zero when pricing a permanent commitment. */
  proactive: number;
  patrol: number;
  patrolBase: number;
  patrolBoost: number;
  patrolWages: number;
  patrolOperating: number;
  nodeIncome: number;
  gross: number;
  wages: number;
  operating: number;
  supplies: number;
  /** Command Staff salaries, paid with payroll while each manager is on. */
  staff: number;
  net: number;
}

/**
 * Hourly rates implied by the state at time t. Pure. `boosted` false is the sustainable view every permanent
 * commitment is checked against: allocation at its floor, patrol without temporary boosts, no shift grants
 * (docs/world-redesign.md, "Earnings"). The Department Charter is a lifetime entitlement and counts in both.
 */
export function ratesAt(state: GameState, t: number, boosted = true): Rates {
  const workforce = patrolRates(state, t, boosted);
  const charter = state.department.entitlements?.charter ? ALLOCATION.charterFactor : 1;
  let nodeIncome = 0;
  for (const e of unlockedEffects(state)) if (e.kind === 'income') nodeIncome += e.perHour;
  let wages = 0;
  for (const o of Object.values(state.officers)) wages += o.wage;

  const base = allocationRate(state.world, ECONOMY_TUNING.baseAllocation, !boosted);
  const patrol = workforce.gross * charter;
  const grant = state.world && boosted ? shiftGrantPerHour(state.department.level) * activeShifts(state.world).filter((shift) => shift.startedAt <= t && t < shift.endsAt).length : 0;
  const gross = base + grant + patrol + nodeIncome;
  const operating = ECONOMY_TUNING.facilities;
  const staff = commandStaffSalaries(state);
  const supplies = ECONOMY_TUNING.supplies;
  return {
    base,
    proactive: grant,
    patrol,
    patrolBase: workforce.baseGross,
    patrolBoost: patrol - workforce.baseGross,
    patrolWages: workforce.wages,
    patrolOperating: workforce.operating,
    nodeIncome,
    gross,
    wages,
    operating,
    supplies,
    staff,
    net: gross - wages - workforce.wages - workforce.operating - staff - operating - supplies,
  };
}

/** A tactical officer's instructor detail against their wage. Patrol staff have separate rates. */
export interface OfficerRate {
  detail: number;
  wage: number;
  net: number;
}

/** Hourly rate of every SWAT officer at time t. Pure. */
export function officerRates(state: GameState, _t: number): Record<Id, OfficerRate> {
  const out: Record<Id, OfficerRate> = {};
  for (const o of Object.values(state.officers)) {
    const a = o.assignment;
    const detail = a?.kind === 'detail' && a.endsAt > a.startedAt ? a.fee / ((a.endsAt - a.startedAt) / HOUR_MS) : 0;
    out[o.id] = { detail, wage: o.wage, net: detail - o.wage };
  }
  return out;
}

/** What each squad duty is worth, for the squad builder's preview (squad-optimizer.ts DutyRates). */
export function dutyRates(): DutyRates {
  return { recoveryPerHour: ECONOMY_TUNING.recoveryPerHour };
}

/** Sustainable hourly net at the settled clock. Temporary boosts never fund permanent commitments. */
export function netRate(state: GameState): number {
  return ratesAt(state, simNow(state), false).net;
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
  patrolTraining: NonNullable<ShiftReport['patrolTraining']>;
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
      const why = byCeiling < need && byCeiling <= byFunds ? `spending ceiling ${funding(rule.budgetCeiling)}` : 'not enough funding';
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
  acc.patrolTraining.push(...applyPatrolDue(d, t));
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
  consider(nextPatrolEventTime(d, t));
  if (d.world) consider(nextWorldEventTime(d, t));
  if (d.people) consider(nextPeopleEventTime(d, t));
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
    else if (rate < 0) o.stress = Math.min(100, o.stress - rate * hours);
  }
}

/** The funding accrual window: 72 hours, or 7 days with Night Watch Office (synced entitlements). */
export function fundingCapMs(d: Pick<GameState, 'department'>): number {
  return d.department.entitlements?.nightWatch ? ECONOMY_TUNING.nightWatchCapMs : ECONOMY_TUNING.capMs;
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

  const W = dep.lastInteractionAt + fundingCapMs(d);
  const worldW = dep.lastInteractionAt + ECONOMY_TUNING.worldCapMs;
  const fundingBefore = dep.funding;
  const acc: Acc = {
    gross: 0,
    wages: 0,
    operating: 0,
    restock: 0,
    maintenance: 0,
    maintenanceStarted: [],
    courses: [],
    patrolTraining: [],
    shortages: new Set(),
    equipment: [],
    personnel: [],
  };
  const wasRecovering = new Set(
    Object.values(d.officers)
      .filter((o) => o.assignment?.kind !== 'operation' && o.stress >= STRESS_BANDS.recovery)
      .map((o) => o.id),
  );

  const worldAcc = d.world ? newWorldAcc(d) : null;
  const peopleBeats: Id[] = [];
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
      acc.wages += (r.wages + r.patrolWages + r.staff) * accrualHours;
      acc.operating += (r.operating + r.supplies + r.patrolOperating) * accrualHours;
      const earned = r.net * accrualHours;
      const credited = Math.max(-dep.funding, earned);
      postFunding(dep, credited, 'patrol', 'Department service funding', Math.min(e, W), { foldAcrossAccrual: true });
      accruePatrolService(d, accrualHours);
      if (credited > earned) {
        acc.shortages.add('Funding ran out: payroll and operating costs were not fully covered');
      }
    }
    recover(d, (e - t) / HOUR_MS, t);
    applyUnitWear(d, t, e, acc.equipment, departmentUpkeep(d));

    applyDue(d, t, e, acc, restockActive && e % I === 0 && e <= W, exclusion);
    // The world and the people settle on the same walk: one clock, one accrual window.
    if (worldAcc) settleWorld(d, t, e, worldW, worldAcc);
    if (d.people) settlePeople(d, t, e, peopleBeats);
    // A shift or an aftercare shift that just ended released its officers at e. A retirement that was waiting on
    // them happens now, in the same boundary, not at the next event or the next tick (which would make a long
    // settlement and many short ones pay and recover differently).
    if (d.world || d.people) applyCareerDue(d, e, e, acc.personnel);
    t = e;
  }
  if (worldAcc) finishFirstReturn(d, L, T);

  // Unshortlisted candidates who have waited too long leave the pool.
  d.candidates = d.candidates.filter((c) => c.shortlisted || c.expiresAt > T);
  dep.lastSettledAt = T;

  // A short settlement is not worth a report unless something happened that the player should see.
  const world = worldAcc ? worldReport(d, worldAcc) : undefined;
  const notable = acc.courses.length > 0 || acc.patrolTraining.length > 0 || acc.equipment.length > 0 || acc.personnel.length > 0 || acc.maintenanceStarted.length > 0 || !!world || peopleBeats.length > 0;
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
    patrolTraining: acc.patrolTraining,
    recovered,
    shortages: [...acc.shortages],
    capped: T > W,
    equipment: acc.equipment,
    personnel: acc.personnel,
    ...(world ? { world } : {}),
    ...(peopleBeats.length ? { people: peopleBeats } : {}),
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
    patrolTraining: [...(prev.patrolTraining ?? []), ...(rep.patrolTraining ?? [])],
    recovered: [...new Set([...prev.recovered, ...rep.recovered])],
    shortages: [...new Set([...prev.shortages, ...rep.shortages])],
    capped: prev.capped || rep.capped,
    equipment: [...(prev.equipment ?? []), ...rep.equipment],
    personnel: [...(prev.personnel ?? []), ...rep.personnel],
    ...(mergeWorld(prev.world, rep.world) ? { world: mergeWorld(prev.world, rep.world) } : {}),
    ...(prev.people?.length || rep.people?.length ? { people: [...(prev.people ?? []), ...(rep.people ?? [])] } : {}),
  };
}

function mergeWorld(a: ShiftReport['world'], b: ShiftReport['world']): ShiftReport['world'] {
  if (!a || !b) return a ?? b;
  const crime: NonNullable<ShiftReport['world']>['crime'] = { ...b.crime };
  for (const [id, pair] of Object.entries(a.crime)) if (pair) crime[id as keyof typeof crime] = [pair[0], b.crime[id as keyof typeof crime]?.[1] ?? pair[1]];
  return { contacts: a.contacts + b.contacts, casesOpened: a.casesOpened + b.casesOpened, casesClosed: a.casesClosed + b.casesClosed, awardsPaid: a.awardsPaid + b.awardsPaid, awardFunding: a.awardFunding + b.awardFunding, leads: [...new Set([...a.leads, ...b.leads])], crime };
}
