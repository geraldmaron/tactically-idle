// Read-only views of department state for the UI. Export names and signatures are
// a fixed contract; the bodies here preview exactly what the handlers will do.
import { isBasicKit } from './basic-kit';
import type {
  Candidate,
  Course,
  DevelopmentNode,
  GameState,
  Id,
  ItemDefinition,
  GrantRecord,
  Officer,
  SquadId,
} from './types';
import type { StressBand } from './officer';
import { deployability, stressBand, STRESS_BANDS } from './officer';
import { COURSES } from '../content/courses';
import { DEV_NODES } from '../content/dev-tree';
import { ITEMS } from '../content/items';
import { courseCheck, describeEffect, itemCheck, nodeCheck } from './develop';
import { quoteDevelopment, type DevelopmentQuote } from './development-tiers';
import { ECONOMY_TUNING, HOUR_MS, isInjured, netRate, ratesAt, recoveryMultiplier, recoveryRate } from './economy';
import { formatDuration } from './format';
import { deployRoster, recoveryDuty, squadDeployed } from './squads';
import { ROSTER_TUNING, dismissCheck, hireCheck, retentionOffer } from './roster';
import { formatGameDate, gameDay, serviceYears } from './calendar';
import { RANKS } from '../content/ranks';
import { EXPERIENCE_LABEL, experienceBand, rankProgress, type ExperienceBand, type RankId } from './ranks';
import { grantOf, nextMilestone, type MilestoneView } from './grants';
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
} from './career';
import { daysToUnreliable, projectedCondition, scrapCheck, serviceCheck, stateLabelFor } from './equipment';
import { departmentUpkeep, equipmentWearMultiplier } from './equipment-manager-policy';
import { readyUnits, unitEffectiveness } from './inventory';
import { boardSummaryOf, type BoardSummary } from './incidents';

export interface Budget {
  /** All figures are funding per hour. */
  base: number;
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
  /** Command Staff salaries while on duty. */
  staff: number;
  net: number;
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
  quote: DevelopmentQuote;
  currentTier: number;
  targetTier: number | null;
  maxTier: number;
  currentEffects: string[];
  /**
   * 'available' means prerequisites are met. When it cannot be bought yet
   * (funding), `reason` says what is missing; a null reason means buy now.
   */
  status: 'unlocked' | 'available' | 'locked';
  reason: string | null;
  /** Player-language effect lines. */
  effects: string[];
  /** The milestone that grants the next tier free (sim/grants.ts), null when complete. */
  milestone: MilestoneView | null;
  /** How the current tier was granted, when a milestone gave it. */
  granted: GrantRecord | null;
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
  /** Held and not reserved or in service, but worn to failAt or below: needs service before use. */
  failed: number;
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
  /** Officers who aren't ready stay home when the squad deploys, with why (deployRoster). */
  staysHome: { officerId: Id; reason: string }[];
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
  return hireCheck(state, candidateId, netRate);
}

export function projectDismiss(state: GameState, officerId: Id, _now: number): Projection {
  return dismissCheck(state, officerId, netRate);
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
  if (o.assignment?.kind === 'training' || o.assignment?.kind === 'detail') at = Math.max(at, o.assignment.endsAt);
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
    const quote = quoteDevelopment(state, node.id);
    return {
      node, quote, currentTier: quote.currentTier, targetTier: quote.targetTier, maxTier: quote.maxTier,
      status: c.status, reason: c.reason,
      currentEffects: quote.currentEffects.map(describeEffect),
      effects: (quote.targetTier ? quote.effects : quote.currentEffects).map(describeEffect),
      milestone: nextMilestone(state, node.id)?.view ?? null,
      granted: quote.currentTier ? grantOf(state, node.id, quote.currentTier) : null,
    };
  });
}

export function storeOptions(state: GameState): StoreOption[] {
  const upkeep = departmentUpkeep(state);
  const now = state.department.clockHighWater;
  // Basic kit is part of every officer (basic-kit.ts): never stocked, bought or listed.
  return Object.values(ITEMS).filter((item) => !isBasicKit(item.id)).map((item) => {
    const units = Object.values(state.units).filter((u) => u.itemId === item.id && u.status !== 'scrapped');
    const ready = readyUnits(state, item.id, upkeep);
    const conditions = units.filter((u) => u.status !== 'expired').map((u) => projectedCondition(state, u, now, upkeep));
    const c = itemCheck(state, item, 1);
    return {
      item,
      owned: units.length,
      ready: ready.length,
      reserved: units.filter((u) => u.status === 'reserved').length,
      inService: units.filter((u) => u.status === 'service').length,
      unreliable: ready.filter((u) => u.condition < item.wear.unreliableBelow).length,
      failed: units.filter((u) => u.status === 'ready' && !ready.includes(u)).length,
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
  if (!squad) return { squadId, ready: 0, total: 0, deployable: false, issues: ['No such squad'], staysHome: [] };
  const t = Math.max(now, state.department.clockHighWater);
  const issues: string[] = [];
  for (const id of squad.officerIds) {
    const o = state.officers[id];
    if (!o) continue;
    const info = recoveryInfo(state, id, t);
    if (info.blocker === null) continue;
    const wait = info.deployableAt !== null ? ` ~${formatDuration(info.deployableAt - t)}` : '';
    if (o.assignment?.kind === 'operation') issues.push(`${o.surname}: deployed`);
    else if (o.assignment?.kind === 'training') issues.push(`${o.surname}: in training${wait}`);
    else if (o.assignment?.kind === 'detail') issues.push(`${o.surname}: on an instructor detail${wait}`);
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
  // Deploy's own rule (deployRoster): who goes, and who stays home and why.
  const roster = deployRoster(state, squadId, now);
  return { squadId, ready: roster.goes.length, total, deployable: roster.goes.length >= 1 && !deployed, issues, staysHome: roster.staysHome };
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
  serviceCost: number;
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
  const upkeep = departmentUpkeep(state);
  return Object.values(state.units)
    .filter((u) => u.itemId === itemId && u.status !== 'scrapped')
    .map((u): UnitView => {
      const condition = projectedCondition(state, u, t, upkeep);
      const shown = { ...u, condition };
      const svc = serviceCheck(state, u.id, t, upkeep);
      const scrap = scrapCheck(state, u.id);
      return {
        unit: shown,
        item: def,
        stateLabel: stateLabelFor(u, def, condition),
        effectiveness: unitEffectiveness(shown, def),
        daysToUnreliable: daysToUnreliable(def, u, condition, equipmentWearMultiplier(state, def)),
        serviceUntil: u.serviceUntil,
        expiresAt: u.expiresAt,
        canService: svc.ok,
        serviceCost: svc.cost,
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
  experience: ExperienceBand;
  experienceLabel: string;
  rank: RankId;
  rankTitle: string;
  /** The next rank and the XP still needed for it; null at the top rank, where XP stops. */
  nextRank: { rank: RankId; title: string; xpToGo: number } | null;
  /** Player-language effects of experience/age currently applied in operations and training. */
  effects: string[];
  /** Formatted game date strings. */
  born: string;
  serviceStart: string;
  retirement: { date: string; inDays: number; reason: string; canRetain: boolean; retainReason: string | null; retainCost: string | null } | null;
  /** When the officer becomes eligible / reaches mandatory retirement, for planning. */
  outlook: string;
}

const EXPERIENCE_EFFECT: Record<ExperienceBand, string> = {
  rookie: 'Rookie: rattles more easily under pressure, but takes 30% more from each call',
  developing: 'Developing: steady, takes the normal share from each call',
  seasoned: 'Seasoned: holds up better under pressure, takes 15% less from each call',
  veteran: 'Veteran: steadier under pressure and mentors others, takes 30% less from each call',
};

export function careerInfo(state: GameState, officerId: Id, now: number): CareerInfo | null {
  const o = state.officers[officerId];
  if (!o || !Number.isFinite(o.bornDay) || !o.career) return null;
  const t = Math.max(now, state.department.clockHighWater);
  const day = gameDay(state, t);
  const age = wholeAge(o, day);
  const band = experienceBand(o);
  const years = serviceYears(o, day);

  const effects: string[] = [EXPERIENCE_EFFECT[band]];
  const ageLine = ageEffectLine(age);
  if (ageLine) effects.push(ageLine);
  const progress = rankProgress(o);
  const nextRankInfo = progress.next && progress.need !== null ? { rank: progress.next, title: RANKS[progress.next].title, xpToGo: Math.max(0, progress.need - o.xp) } : null;
  effects.push(nextRankInfo ? `${nextRankInfo.xpToGo} XP to ${nextRankInfo.title}` : `${RANKS[progress.rank].title}, the top rank. XP no longer rises`);
  const { adverse, total } = recentAdverse(state, o.id);
  if (adverse >= 2) effects.push(`Strained by recent operations: ${adverse} of the last ${total} went badly`);
  if (o.stress > CAREER_TUNING.burnoutStress) effects.push(`Burnout risk: stress above ${CAREER_TUNING.burnoutStress}`);
  if (o.wage < CAREER_TUNING.wageCap) effects.push(`Next service anniversary: wage +${CAREER_TUNING.wageStep} funding an hour`);

  let retirement: CareerInfo['retirement'] = null;
  if (o.retirement) {
    const r = o.retirement;
    const offer = r.reason === 'service' ? retentionOffer(state, o.id, netRate) : null;
    retirement = {
      date: formatGameDate(r.day),
      inDays: Math.max(0, Math.ceil(r.day - day)),
      reason: retirementReasonLabel(r.reason),
      canRetain: Boolean(offer?.ok),
      retainReason: r.reason === 'service' ? (offer?.reason ?? null) : r.reason === 'age' ? 'Mandatory retirement cannot be deferred' : 'Burnout retirement cannot be deferred',
      retainCost: offer && offer.raise > 0 && r.reason === 'service' ? `+${offer.raise} funding an hour` : null,
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
    rank: progress.rank,
    rankTitle: RANKS[progress.rank].title,
    nextRank: nextRankInfo,
    effects,
    born: formatGameDate(o.bornDay),
    serviceStart: formatGameDate(o.serviceStartDay),
    retirement,
    outlook,
  };
}
