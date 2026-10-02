// Read-only views of department state for the UI. Export names and signatures are
// a fixed contract; the bodies here preview exactly what the handlers will do.
import type {
  Candidate,
  Course,
  DevelopmentNode,
  GameState,
  Id,
  ItemDefinition,
  Officer,
  SquadId,
} from './types';
import type { StressBand } from './officer';
import { deployability, stressBand, STRESS_BANDS } from './officer';
import { COURSES } from '../content/courses';
import { DEV_NODES } from '../content/dev-tree';
import { ITEMS } from '../content/items';
import { courseCheck, describeEffect, itemCheck, nodeCheck } from './develop';
import {
  ECONOMY_TUNING,
  HOUR_MS,
  formatDuration,
  isInjured,
  ratesAt,
  recoveryDuty,
  recoveryMultiplier,
  recoveryRate,
  squadDeployed,
} from './economy';
import { ROSTER_TUNING, dismissCheck, hireCheck, retentionOffer } from './roster';
import { EXPERIENCE_LABEL, experienceBand, formatGameDate, gameDay, serviceYears } from './calendar';
import {
  CAREER_TUNING,
  ageEffectLine,
  mandatoryRetirementDay,
  recentAdverse,
  retirementReasonLabel,
  serviceEligibleDay,
  spanLabel,
  upcomingWageSteps,
  wholeAge,
  xpProgress,
  LEARNING_MULTIPLIER,
} from './career';
import { daysToUnreliable, projectedCondition, scrapCheck, serviceCheck, stateLabelFor } from './equipment';
import { readyUnits, unitEffectiveness } from './inventory';
import { boardSummaryOf, type BoardSummary } from './incidents';

export interface Budget {
  /** All figures are funding per hour. */
  base: number;
  patrol: number;
  nodeIncome: number;
  gross: number;
  wages: number;
  operating: number;
  supplies: number;
  net: number;
  devPointsPerHour: number;
  /** Extra wages per hour from service anniversaries landing in the next 30 game days. */
  wageStepsNext30d: number;
}

export interface Projection {
  ok: boolean;
  reason: string | null;
  /** One-off cost (signing fee or severance). */
  upfront: number;
  wageDelta: number;
  netBefore: number;
  netAfter: number;
}

export interface RecoveryInfo {
  band: StressBand;
  /** null when deployable now or blocked by something time cannot fix. */
  deployableAt: number | null;
  /** Why the officer cannot deploy now, if they cannot. */
  blocker: string | null;
  /** Plain-language factors that change recovery, e.g. 'Squad on rest: 6/h'. */
  factors: string[];
}

export interface CourseOption {
  course: Course;
  available: boolean;
  reason: string | null;
}

export interface NodeOption {
  node: DevelopmentNode;
  /**
   * 'available' means prerequisites are met. When it cannot be bought yet
   * (points or funding), `reason` says what is missing; a null reason means buy now.
   */
  status: 'unlocked' | 'available' | 'locked';
  reason: string | null;
  /** Player-language effect lines. */
  effects: string[];
}

export interface StoreOption {
  item: ItemDefinition;
  /** Counts over physical units (scrapped excluded). */
  owned: number;
  ready: number;
  reserved: number;
  inService: number;
  /** Ready but below unreliableBelow. */
  unreliable: number;
  expired: number;
  /** Mean condition of owned, non-scrapped units (0..100), null when none. */
  meanCondition: number | null;
  available: number;
  canBuy: boolean;
  reason: string | null;
}

export interface SquadReadiness {
  squadId: SquadId;
  ready: number;
  total: number;
  deployable: boolean;
  issues: string[];
}

export type { BoardSummary };

/** Incident board at a glance: live cards, unseen ones, next arrival (null when full), cards expiring within 2h. */
export function boardSummary(state: GameState, now: number): BoardSummary {
  return boardSummaryOf(state, now);
}

export function budget(state: GameState): Budget {
  const t = state.department.clockHighWater;
  return { ...ratesAt(state, t), wageStepsNext30d: upcomingWageSteps(state, t, 30) };
}

export function projectHire(state: GameState, candidateId: Id): Projection {
  return hireCheck(state, candidateId);
}

export function projectDismiss(state: GameState, officerId: Id, _now: number): Projection {
  return dismissCheck(state, officerId);
}

/** Stress after the time since the last settlement, so a view between ticks stays exact. */
function projectedStress(state: GameState, o: Officer, t: number): number {
  const gap = Math.max(0, t - state.department.clockHighWater);
  return Math.max(0, o.stress - recoveryRate(state, o) * (gap / HOUR_MS));
}

export function recoveryInfo(state: GameState, officerId: Id, now: number): RecoveryInfo {
  const o = state.officers[officerId];
  if (!o) return { band: 'ready', deployableAt: null, blocker: 'No such officer', factors: [] };
  const t = Math.max(now, state.department.clockHighWater);
  const stress = projectedStress(state, o, t);
  const band = stressBand(stress);
  const rate = recoveryRate(state, o);

  const factors: string[] = [];
  if (o.assignment?.kind === 'operation') {
    factors.push('Deployed: condition does not recover during an operation');
  } else {
    const duty = recoveryDuty(state, o);
    const base = ECONOMY_TUNING.recoveryPerHour[duty];
    const where = o.squadId ? `Squad on ${duty}` : 'Not in a squad (rests)';
    factors.push(`${where}: ${base}/h`);
    const mult = recoveryMultiplier(state);
    if (mult !== 1) factors.push(`Peer support program: x${mult} (${Math.round(rate * 10) / 10}/h in total)`);
    const ageLine = Number.isFinite(o.bornDay) ? ageEffectLine(wholeAge(o, gameDay(state, t))) : null;
    if (ageLine) factors.push(ageLine);
    if (duty !== 'rest' && band !== 'ready') factors.push(`Resting recovers ${ECONOMY_TUNING.recoveryPerHour.rest * mult}/h`);
  }

  const view: Officer = { ...o, stress };
  const dep = deployability(view, t);
  if (dep.ok) return { band, deployableAt: null, blocker: null, factors };

  let at: number | null = t;
  let fixable = true;
  if (isInjured(o, t)) at = Math.max(at, o.injury!.until);
  if (o.assignment?.kind === 'training') at = Math.max(at, o.assignment.endsAt);
  if (o.assignment?.kind === 'operation') fixable = false;
  if (stress >= STRESS_BANDS.recovery) {
    if (rate > 0) at = Math.max(at, t + ((stress - STRESS_BANDS.recovery) / rate) * HOUR_MS + 1000);
    else fixable = false;
  }
  return { band, deployableAt: fixable ? Math.ceil(at) : null, blocker: dep.reason, factors };
}

export function courseOptions(state: GameState, officerId: Id | null, _now: number): CourseOption[] {
  const officer = officerId ? (state.officers[officerId] ?? null) : null;
  return Object.values(COURSES).map((course) => {
    const c = courseCheck(state, course, officer);
    return { course, available: c.ok, reason: c.reason };
  });
}

export function nodeOptions(state: GameState): NodeOption[] {
  return Object.values(DEV_NODES).map((node) => {
    const c = nodeCheck(state, node);
    return { node, status: c.status, reason: c.reason, effects: node.effects.map(describeEffect) };
  });
}

export function storeOptions(state: GameState): StoreOption[] {
  const now = state.department.clockHighWater;
  return Object.values(ITEMS).map((item) => {
    const units = Object.values(state.units).filter((u) => u.itemId === item.id && u.status !== 'scrapped');
    const ready = readyUnits(state, item.id);
    const conditions = units.filter((u) => u.status !== 'expired').map((u) => projectedCondition(state, u, now));
    const c = itemCheck(state, item, 1);
    return {
      item,
      owned: units.length,
      ready: ready.length,
      reserved: units.filter((u) => u.status === 'reserved').length,
      inService: units.filter((u) => u.status === 'service').length,
      unreliable: ready.filter((u) => u.condition < item.wear.unreliableBelow).length,
      expired: units.filter((u) => u.status === 'expired').length,
      meanCondition: conditions.length ? Math.round((conditions.reduce((a, x) => a + x, 0) / conditions.length) * 10) / 10 : null,
      available: ready.length,
      canBuy: c.ok,
      reason: c.reason,
    };
  });
}

export function squadReadiness(state: GameState, squadId: SquadId, now: number): SquadReadiness {
  const squad = state.squads.find((s) => s.id === squadId);
  if (!squad) return { squadId, ready: 0, total: 0, deployable: false, issues: ['No such squad'] };
  const t = Math.max(now, state.department.clockHighWater);
  const issues: string[] = [];
  let ready = 0;
  for (const id of squad.officerIds) {
    const o = state.officers[id];
    if (!o) continue;
    const info = recoveryInfo(state, id, t);
    if (info.blocker === null) {
      ready++;
      continue;
    }
    const wait = info.deployableAt !== null ? ` ~${formatDuration(info.deployableAt - t)}` : '';
    if (o.assignment?.kind === 'operation') issues.push(`${o.surname}: deployed`);
    else if (o.assignment?.kind === 'training') issues.push(`${o.surname}: in training${wait}`);
    else if (isInjured(o, t)) issues.push(`${o.surname}: injured (${o.injury!.label})${wait}`);
    else issues.push(`${o.surname}: mandatory recovery${wait}`);
  }
  const total = squad.officerIds.length;
  if (total === 0) issues.push('No officers assigned');
  else if (!squad.leaderId) issues.push('No squad leader');
  const size = ROSTER_TUNING.squadSize;
  if (total > 0 && total < size) issues.push(`Short ${size - total} officer${size - total === 1 ? '' : 's'} of ${size}`);
  const deployed = squadDeployed(state, squadId);
  if (deployed) issues.unshift('Squad is on an operation');
  return { squadId, ready, total, deployable: ready >= 1 && !deployed, issues };
}

export function sortedCandidates(state: GameState): Candidate[] {
  const order = new Map(state.candidates.map((c, i) => [c.id, i]));
  return [...state.candidates].sort(
    (a, b) => Number(b.shortlisted) - Number(a.shortlisted) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
}

export function rosterOfficers(state: GameState): Officer[] {
  const rank = (o: Officer) => (o.squadId ? o.squadId.charCodeAt(0) : 999);
  return Object.values(state.officers).sort(
    (a, b) => rank(a) - rank(b) || a.surname.localeCompare(b.surname) || a.firstName.localeCompare(b.firstName),
  );
}

export interface UnitView {
  unit: import('./types').ItemUnit;
  item: ItemDefinition;
  /** 'Good' | 'Worn' | 'Unreliable' | 'Failed' | 'Expired' | 'In service' | 'Reserved'. */
  stateLabel: string;
  effectiveness: number;
  /** Projected game days until unreliable at the current daily rate, null if not applicable. */
  daysToUnreliable: number | null;
  /** When servicing finishes / expires (epoch ms), if relevant. */
  serviceUntil: number | null;
  expiresAt: number | null;
  canService: boolean;
  serviceReason: string | null;
  canScrap: boolean;
  scrapReason: string | null;
}

/** Every non-scrapped unit of one item, worst condition first. */
export function unitViews(state: GameState, itemId: Id, now: number): UnitView[] {
  const def = ITEMS[itemId];
  if (!def) return [];
  const t = Math.max(now, state.department.clockHighWater);
  const rank = (v: UnitView) => (v.unit.status === 'expired' ? -1 : v.unit.condition);
  return Object.values(state.units)
    .filter((u) => u.itemId === itemId && u.status !== 'scrapped')
    .map((u): UnitView => {
      const condition = projectedCondition(state, u, t);
      const shown = { ...u, condition };
      const svc = serviceCheck(state, u.id, t);
      const scrap = scrapCheck(state, u.id);
      return {
        unit: shown,
        item: def,
        stateLabel: stateLabelFor(u, def, condition),
        effectiveness: unitEffectiveness(shown, def),
        daysToUnreliable: daysToUnreliable(def, u, condition),
        serviceUntil: u.serviceUntil,
        expiresAt: u.expiresAt,
        canService: svc.ok,
        serviceReason: svc.reason,
        canScrap: scrap.ok,
        scrapReason: scrap.reason,
      };
    })
    .sort((a, b) => rank(a) - rank(b) || a.unit.serial.localeCompare(b.unit.serial));
}

export interface CareerInfo {
  age: number;
  serviceYears: number;
  experience: import('./calendar').ExperienceBand;
  experienceLabel: string;
  /** Player-language effects of experience/age currently applied in operations and training. */
  effects: string[];
  /** Formatted game date strings. */
  born: string;
  serviceStart: string;
  retirement: { date: string; inDays: number; reason: string; canRetain: boolean; retainReason: string | null; retainCost: string | null } | null;
  /** When the officer becomes eligible / reaches mandatory retirement, for planning. */
  outlook: string;
}

const EXPERIENCE_EFFECT: Record<import('./calendar').ExperienceBand, string> = {
  rookie: 'Rookie: rattles more easily under pressure, but learns fast (+30% from xp)',
  developing: 'Developing: steady, learns at the normal rate',
  seasoned: 'Seasoned: holds up better under pressure, learns 15% slower',
  veteran: 'Veteran: steadier under pressure and mentors others, learns 30% slower',
};

export function careerInfo(state: GameState, officerId: Id, now: number): CareerInfo | null {
  const o = state.officers[officerId];
  if (!o || !Number.isFinite(o.bornDay) || !o.career) return null;
  const t = Math.max(now, state.department.clockHighWater);
  const day = gameDay(state, t);
  const age = wholeAge(o, day);
  const band = experienceBand(o, day);
  const years = serviceYears(o, day);

  const effects: string[] = [EXPERIENCE_EFFECT[band]];
  const ageLine = ageEffectLine(age);
  if (ageLine) effects.push(ageLine);
  const need = Math.round(CAREER_TUNING.xpPerPoint / LEARNING_MULTIPLIER[band]);
  effects.push(`Needs ${need} xp per rating point (${Math.round(xpProgress(o, day) * 100)}% of the way to the next)`);
  const { adverse, total } = recentAdverse(state, o.id);
  if (adverse >= 2) effects.push(`Strained by recent operations: ${adverse} of the last ${total} went badly`);
  if (o.stress > CAREER_TUNING.burnoutStress) effects.push(`Burnout risk: stress above ${CAREER_TUNING.burnoutStress}`);
  if (o.wage < CAREER_TUNING.wageCap) effects.push(`Next service anniversary: wage +$${CAREER_TUNING.wageStep}/h`);

  let retirement: CareerInfo['retirement'] = null;
  if (o.retirement) {
    const r = o.retirement;
    const offer = r.reason === 'service' ? retentionOffer(state, o.id) : null;
    retirement = {
      date: formatGameDate(r.day),
      inDays: Math.max(0, Math.ceil(r.day - day)),
      reason: retirementReasonLabel(r.reason),
      canRetain: Boolean(offer?.ok),
      retainReason: r.reason === 'service' ? (offer?.reason ?? null) : r.reason === 'age' ? 'Mandatory retirement cannot be deferred' : 'Burnout retirement cannot be deferred',
      retainCost: offer && offer.raise > 0 && r.reason === 'service' ? `+$${offer.raise}/h` : null,
    };
  }

  const ageDay = mandatoryRetirementDay(o);
  const leftToAge = ageDay - day;
  const eligibleIn = serviceEligibleDay(o) - day;
  let outlook: string;
  if (o.retirement) {
    const left = Math.max(0, Math.ceil(o.retirement.day - day));
    outlook = `Retiring ${formatGameDate(o.retirement.day)}${left > 0 ? ` (in ${spanLabel(left)})` : ''}`;
  } else {
    outlook = `Mandatory retirement in ${spanLabel(Math.max(0, leftToAge))} (age ${CAREER_TUNING.retireAge})`;
    if (eligibleIn > 0 && eligibleIn < leftToAge) outlook += `. May choose to retire after ${CAREER_TUNING.serviceEligibleYears} years of service (in ${spanLabel(eligibleIn)})`;
    else if (eligibleIn <= 0 && leftToAge > 0) outlook += `. Past ${CAREER_TUNING.serviceEligibleYears} years of service: may choose to retire at any anniversary`;
  }

  return {
    age,
    serviceYears: Math.round(years * 10) / 10,
    experience: band,
    experienceLabel: EXPERIENCE_LABEL[band],
    effects,
    born: formatGameDate(o.bornDay),
    serviceStart: formatGameDate(o.serviceStartDay),
    retirement,
    outlook,
  };
}
