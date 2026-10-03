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
      return `${e.delta >= 0 ? '+' : ''}${e.delta} training slot`;
    case 'recoveryRate':
      return `Officers recover from stress x${e.mult} faster`;
    case 'income':
      return `+${money(e.perHour)}/h funding`;
    case 'loadoutPresets':
      return 'Unlocks saved squad loadout presets';
    case 'restockRules':
      return 'Unlocks automatic restocking with a spending ceiling';
    case 'equipmentManager':
      return '25% cheaper repairs, 20% less reusable-gear wear; opt-in automatic servicing on Gear';
    case 'candidatePool':
      return `+${e.delta} recruit candidate in the pool`;
  }
}

export interface NodeCheck {
  status: 'unlocked' | 'available' | 'locked';
  reason: string | null;
}

export function nodeCheck(state: GameState, node: DevelopmentNode): NodeCheck {
  if (isNodeUnlocked(state, node.id)) return { status: 'unlocked', reason: null };
  const missing = node.requires.filter((id) => !isNodeUnlocked(state, id));
  if (missing.length > 0) {
    return { status: 'locked', reason: `Requires ${missing.map((id) => DEV_NODES[id]?.name ?? id).join(', ')}` };
  }
  const dep = state.department;
  if (dep.devPoints < node.cost.dp) {
    return { status: 'available', reason: `Needs ${node.cost.dp} development points (have ${Math.floor(dep.devPoints * 10) / 10})` };
  }
  if (dep.funding < node.cost.funding) {
    return { status: 'available', reason: `Needs ${money(node.cost.funding)} (have ${money(dep.funding)})` };
  }
  return { status: 'available', reason: null };
}

function unlockNode(d: GameState, nodeId: Id): HandlerResult {
  const node = DEV_NODES[nodeId];
  if (!node) return refusal('Unknown development node');
  const check = nodeCheck(d, node);
  if (check.status === 'unlocked') return refusal(`${node.name} is already unlocked`);
  if (check.reason) return refusal(check.reason);
  const dep = d.department;
  dep.devPoints -= node.cost.dp;
  dep.funding -= node.cost.funding;
  dep.unlockedNodes.push(node.id);
  // Capacity effects live on the department record; the rest are derived from unlockedNodes.
  for (const e of node.effects) {
    if (e.kind === 'rosterCap') dep.rosterCap += e.delta;
    if (e.kind === 'trainingSlots') dep.trainingSlots += e.delta;
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
