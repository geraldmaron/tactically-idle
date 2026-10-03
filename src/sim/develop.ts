// Development tree, courses, and the store. Unlocking a node never qualifies an
// officer: certifications and rating gains are granted only when a course finishes
// (economy.settle), so completion is time-ordered.
import type { Course, DevelopmentNode, GameState, HandlerResult, Id, ItemDefinition, NodeEffect, Officer } from './types';
import { DEV_NODES } from '../content/dev-tree';
import { COURSES, COURSE_RATING_CEILING } from '../content/courses';
import { ITEMS } from '../content/items';
import { HOUR_MS, isNodeUnlocked, money, ratesAt, simNow } from './economy';
import { fullName } from './officer';
import { createUnit } from './equipment';
import { quoteDevelopment } from './development-tiers';

export const DEVELOP_TUNING = {
  maxPurchase: 99,
};

const refusal = (reason: string): HandlerResult => ({ ok: false, reason });
const OK: HandlerResult = { ok: true };

// ---------------------------------------------------------------- nodes

export function describeEffect(e: NodeEffect): string {
  switch (e.kind) {
    case 'unlockCourse':
      return `Unlocks course: ${COURSES[e.courseId]?.name ?? e.courseId}`;
    case 'unlockItem':
      return `Unlocks purchase: ${ITEMS[e.itemId]?.name ?? e.itemId}`;
    case 'rosterCap':
      return `${e.delta >= 0 ? '+' : ''}${e.delta} roster slots`;
    case 'trainingSlots':
      return `${1 + e.delta} total training slots`;
    case 'recoveryRate':
      return `Officers recover from stress x${e.mult} faster`;
    case 'income':
      return `+${money(e.perHour)}/h funding`;
    case 'loadoutPresets':
      return 'Unlocks saved squad loadout presets';
    case 'restockRules':
      return 'Unlocks automatic restocking with a spending ceiling';
    case 'equipmentManager':
      return `${Math.round((1 - e.repairMultiplier) * 100)}% cheaper repairs, ${Math.round((1 - e.wearMultiplier) * 100)}% slower reusable-gear wear, ${e.maxConcurrentServices} automatic service jobs`;
    case 'candidatePool':
      return `+${e.delta} recruit candidate in the pool`;
  }
}

export interface NodeCheck {
  status: 'unlocked' | 'available' | 'locked';
  reason: string | null;
}

export function nodeCheck(state: GameState, node: DevelopmentNode): NodeCheck {
  const quote = quoteDevelopment(state, node.id);
  return {
    status: quote.targetTier === null ? 'unlocked' : quote.missingPrerequisites.length ? 'locked' : 'available',
    reason: quote.targetTier === null ? null : quote.reason,
  };
}

function unlockNode(d: GameState, nodeId: Id, expectedTier = 1): HandlerResult {
  const quote = quoteDevelopment(d, nodeId, expectedTier);
  if (!quote.ok) return refusal(quote.reason ?? 'Cannot buy this development');
  const { node, cost, targetTier, effects, currentEffects } = quote;
  const dep = d.department;
  dep.devPoints -= cost!.dp;
  dep.funding -= cost!.funding;
  dep.developmentTiers ??= {};
  dep.developmentTiers[node!.id] = targetTier!;
  if (!dep.unlockedNodes.includes(node!.id)) dep.unlockedNodes.push(node!.id);
  // Persist only the difference: migration never replays purchased capacities.
  for (const kind of ['rosterCap', 'trainingSlots'] as const) {
    const total = (list: NodeEffect[]) => list.reduce((sum, effect) => sum + (effect.kind === kind ? effect.delta : 0), 0);
    const difference = total(effects) - total(currentEffects);
    if (kind === 'rosterCap') dep.rosterCap += difference;
    else dep.trainingSlots += difference;
  }
  return OK;
}

// ---------------------------------------------------------------- courses

export function trainingCount(state: GameState): number {
  return Object.values(state.officers).filter((o) => o.assignment?.kind === 'training').length;
}

export interface CourseCheck {
  ok: boolean;
  reason: string | null;
}

/** General availability, plus officer-specific reasons when an officer is given. */
export function courseCheck(state: GameState, course: Course, officer: Officer | null): CourseCheck {
  const no = (reason: string): CourseCheck => ({ ok: false, reason });
  if (course.requiresNode && !isNodeUnlocked(state, course.requiresNode)) {
    return no(`Requires ${DEV_NODES[course.requiresNode]?.name ?? course.requiresNode}`);
  }
  if (officer) {
    if (officer.assignment?.kind === 'operation') return no(`${fullName(officer)} is deployed`);
    if (officer.assignment?.kind === 'training') return no(`${fullName(officer)} is already in training`);
    const missing = (course.requiresCerts ?? []).filter((cert) => !officer.certs.includes(cert));
    if (missing.length) return no(`Requires prior qualification: ${missing.map((cert) => cert.replaceAll('_', ' ')).join(', ')}`);
    const { cert, rating } = course.grants;
    if (cert && officer.certs.includes(cert)) return no(`${fullName(officer)} already holds this certification`);
    if (rating && officer.ratings[rating.key] >= COURSE_RATING_CEILING) {
      return no(`${fullName(officer)} is already at the course ceiling for ${rating.key}`);
    }
  }
  if (trainingCount(state) >= state.department.trainingSlots) return no('No free training slot');
  if (state.department.funding < course.cost) {
    return no(`Needs ${money(course.cost)} (have ${money(state.department.funding)})`);
  }
  if (officer) {
    // Training takes the officer off patrol income; refuse if that would push the budget into deficit.
    const t = simNow(state);
    const trial: GameState = {
      ...state,
      officers: {
        ...state.officers,
        [officer.id]: { ...officer, assignment: { kind: 'training', courseId: course.id, startedAt: t, endsAt: t + course.hours * HOUR_MS } },
      },
    };
    const net = ratesAt(trial, t).net;
    if (net < 0) return no(`Training would leave the department ${money(-net)}/h short while ${officer.surname} is away`);
  }
  return { ok: true, reason: null };
}

function startCourse(d: GameState, officerId: Id, courseId: Id): HandlerResult {
  const course = COURSES[courseId];
  if (!course) return refusal('Unknown course');
  const officer = d.officers[officerId];
  if (!officer) return refusal('No such officer');
  const check = courseCheck(d, course, officer);
  if (!check.ok) return refusal(check.reason ?? 'Cannot start this course');
  const t = simNow(d);
  d.department.funding -= course.cost;
  officer.assignment = { kind: 'training', courseId, startedAt: t, endsAt: t + Math.round(course.hours * HOUR_MS) };
  return OK;
}

// ---------------------------------------------------------------- store

export interface ItemCheck {
  ok: boolean;
  reason: string | null;
}

export function itemCheck(state: GameState, item: ItemDefinition, qty: number): ItemCheck {
  if (!Number.isInteger(qty) || qty < 1 || qty > DEVELOP_TUNING.maxPurchase) return { ok: false, reason: `Quantity must be a whole number from 1 to ${DEVELOP_TUNING.maxPurchase}` };
  if (item.supportOnly && qty !== 1) return { ok: false, reason: 'Buy one support vehicle at a time' };
  if (item.requiresNode && !isNodeUnlocked(state, item.requiresNode)) {
    return { ok: false, reason: `Requires ${DEV_NODES[item.requiresNode]?.name ?? item.requiresNode}` };
  }
  const total = item.cost * qty;
  if (state.department.funding < total) {
    return { ok: false, reason: `Needs ${money(total)} (have ${money(state.department.funding)})` };
  }
  return { ok: true, reason: null };
}

function buyItem(d: GameState, itemId: Id, qty: number): HandlerResult {
  const item = ITEMS[itemId];
  if (!item) return refusal('Unknown item');
  if (!Number.isInteger(qty) || qty < 1 || qty > DEVELOP_TUNING.maxPurchase) return refusal(`Quantity must be a whole number from 1 to ${DEVELOP_TUNING.maxPurchase}`);
  const check = itemCheck(d, item, qty);
  if (!check.ok) return refusal(check.reason ?? 'Cannot buy this item');
  d.department.funding -= item.cost * qty;
  // Every purchase is individual units: condition 100, their own wear rate, and a shelf life for consumables.
  const now = simNow(d);
  for (let i = 0; i < qty; i++) createUnit(d, itemId, now);
  return OK;
}

export const DEVELOP_HANDLERS = { unlockNode, startCourse, buyItem };
