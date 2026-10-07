import type { DepartmentCommandType, GameState, HandlerMap } from './types';
import { startingOfficers, startingSquads } from '../content/officers';
import { settle } from './economy';
import { DEVELOP_HANDLERS } from './develop';
import { EQUIPMENT_HANDLERS, createStartingUnits } from './equipment';
import { fillCandidates, ROSTER_HANDLERS } from './roster';
import { RECRUIT_TUNING } from '../content/recruits';
import { CURRENT_SAVE_VERSION } from './save';
import { createPersonnel } from './personnel';
import { INCIDENT_HANDLERS, seedIncidentBoard } from './incidents';
import { setMaintenanceBudget } from './equipment-manager';
import { START_LEVEL } from './department-level';
import { INCIDENT_CONTENT_VERSION } from '../gen/incident';

export const DEPARTMENT_HANDLERS: HandlerMap<DepartmentCommandType> = {
  tick: (d, _cmd, ctx) => {
    settle(d, ctx.now);
    return { ok: true };
  },
  acknowledgeReport: (d) => {
    d.report = null;
    return { ok: true };
  },
  acknowledgePowerUpgrade: (d) => { delete d.equipmentPowerUpgrade; return { ok: true }; },
  hire: (d, c) => ROSTER_HANDLERS.hire(d, c.candidateId),
  dismiss: (d, c) => ROSTER_HANDLERS.dismiss(d, c.officerId),
  shortlist: (d, c) => ROSTER_HANDLERS.shortlist(d, c.candidateId, c.on),
  refreshCandidates: (d) => ROSTER_HANDLERS.refreshCandidates(d),
  startCourse: (d, c) => DEVELOP_HANDLERS.startCourse(d, c.officerId, c.courseId),
  unlockNode: (d, c) => DEVELOP_HANDLERS.unlockNode(d, c.nodeId, c.expectedTier),
  buyItem: (d, c) => DEVELOP_HANDLERS.buyItem(d, c.itemId, c.qty),
  createSquad: (d, c) => ROSTER_HANDLERS.createSquad(d, c.name),
  renameSquad: (d, c) => ROSTER_HANDLERS.renameSquad(d, c.squadId, c.name),
  assignToSquad: (d, c) => ROSTER_HANDLERS.assignToSquad(d, c.officerId, c.squadId),
  setSquadArrangementLock: (d, c) => ROSTER_HANDLERS.setSquadArrangementLock(d, c.target, c.locked),
  applySquadArrangement: (d, c) => ROSTER_HANDLERS.applySquadArrangement(d, c.proposal),
  undoSquadArrangement: (d) => ROSTER_HANDLERS.undoSquadArrangement(d),
  setLeader: (d, c) => ROSTER_HANDLERS.setLeader(d, c.squadId, c.officerId),
  setSquadDuty: (d, c) => ROSTER_HANDLERS.setSquadDuty(d, c.squadId, c.duty),
  setLoadoutPreset: (d, c) => ROSTER_HANDLERS.setLoadoutPreset(d, c.squadId, c.items),
  setRestockRule: (d, c) => ROSTER_HANDLERS.setRestockRule(d, c.rule),
  serviceUnit: (d, c) => EQUIPMENT_HANDLERS.serviceUnit(d, c.unitId),
  setMaintenanceBudget: (d, c) => setMaintenanceBudget(d, c.perHour),
  scrapUnit: (d, c) => EQUIPMENT_HANDLERS.scrapUnit(d, c.unitId),
  offerRetention: (d, c) => ROSTER_HANDLERS.offerRetention(d, c.officerId),
  markIncidentsSeen: (d) => INCIDENT_HANDLERS.markIncidentsSeen(d),
};

export function createInitialState(now: number, campaignSeed = 12345): GameState {
  const officers = startingOfficers(now, campaignSeed);
  const state: GameState = {
    saveVersion: CURRENT_SAVE_VERSION,
    personnel: createPersonnel(campaignSeed, officers),
    contentVersion: INCIDENT_CONTENT_VERSION,
    department: {
      name: 'Westhaven Department',
      funding: 12400,
      devPoints: 3,
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
    nextId: 1,
    rngState: campaignSeed >>> 0,
  };
  createStartingUnits(state, now);
  fillCandidates(state, now);
  // Three generated incidents are waiting from the first minute (the authored Maple Street
  // scenarios stay available alongside them). Seeded after the candidates so the starting
  // recruit pool is unchanged.
  seedIncidentBoard(state, now);
  // The first free candidate search is available immediately.
  (state.department as { candidateRefreshedAt?: number }).candidateRefreshedAt = now - RECRUIT_TUNING.refreshCooldownMs;
  return state;
}
