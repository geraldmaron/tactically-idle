import type { DepartmentCommandType, GameState, HandlerMap, HandlerResult, Id, SquadId } from './types';
import { startingOfficers, startingSquads } from '../content/officers';
import { candidatePoolSize, hasEffect, isNodeUnlocked, netRate, settle } from './economy';
import { ITEMS } from '../content/items';
import { DEVELOP_HANDLERS } from './develop';
import { EQUIPMENT_HANDLERS, createStartingUnits } from './equipment';
import { fillCandidates, ROSTER_HANDLERS } from './roster';
import { RECRUIT_TUNING } from '../content/recruits';
import { CURRENT_SAVE_VERSION } from './save';
import { createPersonnel } from './personnel';
import { INCIDENT_HANDLERS, dropExcludedCards, seedIncidentBoard, type ContentExclusion } from './incidents';
import { setMaintenanceBudget } from './equipment-manager';
import { START_LEVEL } from './department-level';
import { INCIDENT_CONTENT_VERSION } from '../gen/incident';
import { COMMAND_STAFF_HANDLERS, createCommandStaff } from './command-staff';
import { departmentUpkeep } from './equipment-manager-policy';
import { startDetail } from './detail';
import { createTapState, tapEarn } from './department-taps';

const fail = (reason: string): HandlerResult => ({ ok: false, reason });

// Department standing orders that its upgrades unlock: a squad's loadout preset and supply restocking.
function setLoadoutPreset(d: GameState, squadId: SquadId, items: Record<Id, number>): HandlerResult {
  if (!hasEffect(d, 'loadoutPresets')) return fail('Loadout presets are not unlocked yet');
  const sq = d.squads.find((s) => s.id === squadId);
  if (!sq) return fail('No such squad');
  const preset: Record<Id, number> = {};
  for (const [itemId, qty] of Object.entries(items)) {
    const def = ITEMS[itemId];
    if (!def) return fail(`Unknown item ${itemId}`);
    if (!Number.isInteger(qty) || qty < 0 || qty > 99) return fail(`Invalid quantity for ${def.name}`);
    if (def.requiresNode && !isNodeUnlocked(d, def.requiresNode)) return fail(`${def.name} is not unlocked yet`);
    if (qty > 0) preset[itemId] = qty;
  }
  sq.loadoutPreset = preset;
  return { ok: true };
}

function setRestockRule(d: GameState, rule: { itemId: Id; target: number; budgetCeiling: number } | { itemId: Id; remove: true }): HandlerResult {
  if (!hasEffect(d, 'restockRules')) return fail('Supply restocking is not unlocked yet');
  const def = ITEMS[rule.itemId];
  if (!def) return fail(`Unknown item ${rule.itemId}`);
  const rules = d.department.restockRules;
  if ('remove' in rule) {
    if (!rules.some((r) => r.itemId === rule.itemId)) return fail(`No restock rule for ${def.name}`);
    d.department.restockRules = rules.filter((r) => r.itemId !== rule.itemId);
    return { ok: true };
  }
  if (!Number.isInteger(rule.target) || rule.target < 0 || rule.target > 99) return fail('Target stock must be a whole number from 0 to 99');
  if (!Number.isFinite(rule.budgetCeiling) || rule.budgetCeiling < 0) return fail('Spending ceiling cannot be negative');
  if (def.requiresNode && !isNodeUnlocked(d, def.requiresNode)) return fail(`${def.name} is not unlocked yet`);
  const entry = { itemId: rule.itemId, target: rule.target, budgetCeiling: Math.round(rule.budgetCeiling) };
  const i = rules.findIndex((r) => r.itemId === rule.itemId);
  if (i >= 0) rules[i] = entry;
  else rules.push(entry);
  return { ok: true };
}

export const DEPARTMENT_HANDLERS: HandlerMap<DepartmentCommandType> = {
  tick: (d, _cmd, ctx) => {
    if (ctx.exclusion) dropExcludedCards(d, ctx.exclusion);
    settle(d, ctx.now, ctx.exclusion);
    return { ok: true };
  },
  acknowledgeReport: (d) => {
    d.report = null;
    return { ok: true };
  },
  hire: (d, c) => ROSTER_HANDLERS.hire(d, c.candidateId, netRate),
  dismiss: (d, c) => ROSTER_HANDLERS.dismiss(d, c.officerId, netRate),
  shortlist: (d, c) => ROSTER_HANDLERS.shortlist(d, c.candidateId, c.on),
  refreshCandidates: (d) => ROSTER_HANDLERS.refreshCandidates(d, candidatePoolSize(d)),
  startCourse: (d, c) => DEVELOP_HANDLERS.startCourse(d, c.officerId, c.courseId),
  unlockNode: (d, c) => DEVELOP_HANDLERS.unlockNode(d, c.nodeId, c.expectedTier),
  buyItem: (d, c) => DEVELOP_HANDLERS.buyItem(d, c.itemId, c.qty),
  createSquad: (d, c) => ROSTER_HANDLERS.createSquad(d, c.name),
  renameSquad: (d, c) => ROSTER_HANDLERS.renameSquad(d, c.squadId, c.name),
  assignToSquad: (d, c) => ROSTER_HANDLERS.assignToSquad(d, c.officerId, c.squadId),
  cancelPendingSquadMove: (d, c) => ROSTER_HANDLERS.cancelPendingSquadMove(d, c.officerId),
  setSquadArrangementLock: (d, c) => ROSTER_HANDLERS.setSquadArrangementLock(d, c.target, c.locked),
  applySquadArrangement: (d, c) => ROSTER_HANDLERS.applySquadArrangement(d, c.proposal),
  undoSquadArrangement: (d) => ROSTER_HANDLERS.undoSquadArrangement(d),
  setLeader: (d, c) => ROSTER_HANDLERS.setLeader(d, c.squadId, c.officerId),
  setSquadDuty: (d, c) => ROSTER_HANDLERS.setSquadDuty(d, c.squadId, c.duty),
  setLoadoutPreset: (d, c) => setLoadoutPreset(d, c.squadId, c.items),
  setRestockRule: (d, c) => setRestockRule(d, c.rule),
  serviceUnit: (d, c) => EQUIPMENT_HANDLERS.serviceUnit(d, c.unitId, departmentUpkeep(d)),
  setMaintenanceBudget: (d, c) => setMaintenanceBudget(d, c.perHour),
  scrapUnit: (d, c) => EQUIPMENT_HANDLERS.scrapUnit(d, c.unitId),
  offerRetention: (d, c) => ROSTER_HANDLERS.offerRetention(d, c.officerId, netRate),
  startDetail: (d, c) => startDetail(d, c.officerId),
  markIncidentsSeen: (d) => INCIDENT_HANDLERS.markIncidentsSeen(d),
  tapEarn: (d, c) => tapEarn(d, c.count, d.department.clockHighWater),
  setManagerEnabled: (d, c) => COMMAND_STAFF_HANDLERS.setManagerEnabled(d, c.managerId, c.enabled),
  setManagerPolicy: (d, c) => COMMAND_STAFF_HANDLERS.setManagerPolicy(d, c.patch),
  hireStaff: (d, c) => COMMAND_STAFF_HANDLERS.hireStaff(d, c.managerId, c.candidateId),
  dismissStaff: (d, c) => COMMAND_STAFF_HANDLERS.dismissStaff(d, c.managerId),
  refreshStaffPool: (d, c) => COMMAND_STAFF_HANDLERS.refreshStaffPool(d, c.managerId),
};

export function createInitialState(now: number, campaignSeed = 12345, exclusion?: ContentExclusion): GameState {
  const officers = startingOfficers(now, campaignSeed);
  const state: GameState = {
    saveVersion: CURRENT_SAVE_VERSION,
    personnel: createPersonnel(campaignSeed, officers),
    contentVersion: INCIDENT_CONTENT_VERSION,
    department: {
      name: 'Westhaven Department',
      funding: 12400,
      ledger: [],
      callsResolved: 0,
      grants: [],
      trust: 78,
      level: START_LEVEL,
      service: 0,
      rosterCap: 12,
      trainingSlots: 1,
      unlockedNodes: [],
      developmentTiers: {},
      restockRules: [],
      lastSettledAt: now,
      lastInteractionAt: now,
      clockHighWater: now,
      // Game day 0 (1 Jan 2026) is the moment the department is created.
      calendarEpoch: now,
      taps: createTapState(now),
    },
    officers,
    squads: startingSquads(),
    candidates: [],
    units: {},
    reservations: [],
    activeRun: null,
    incidents: [],
    debriefs: [],
    report: null,
    commandStaff: createCommandStaff(),
    nextId: 1,
    rngState: campaignSeed >>> 0,
  };
  createStartingUnits(state, now);
  fillCandidates(state, now, candidatePoolSize(state));
  // Three generated incidents are waiting from the first minute (the authored Maple Street
  // scenarios stay available alongside them). Seeded after the candidates so the starting
  // recruit pool is unchanged.
  seedIncidentBoard(state, now, undefined, exclusion);
  // The first free candidate search is available immediately.
  (state.department as { candidateRefreshedAt?: number }).candidateRefreshedAt = now - RECRUIT_TUNING.refreshCooldownMs;
  return state;
}
