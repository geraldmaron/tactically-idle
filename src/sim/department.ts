import type { DepartmentCommandType, GameState, HandlerMap } from './types';
import { startingOfficers, startingSquads } from '../content/officers';
import { settle } from './economy';
import { DEVELOP_HANDLERS } from './develop';
import { EQUIPMENT_HANDLERS, createStartingUnits } from './equipment';
import { fillCandidates, ROSTER_HANDLERS } from './roster';
import { RECRUIT_TUNING } from '../content/recruits';
import { CURRENT_SAVE_VERSION } from './save';
import { INCIDENT_HANDLERS, seedIncidentBoard } from './incidents';

export const DEPARTMENT_HANDLERS: HandlerMap<DepartmentCommandType> = {
  tick: (d, _cmd, ctx) => {
    settle(d, ctx.now);
    return { ok: true };
  },
  acknowledgeReport: (d) => {
    d.report = null;
    return { ok: true };
  },
  hire: (d, c) => ROSTER_HANDLERS.hire(d, c.candidateId),
  dismiss: (d, c) => ROSTER_HANDLERS.dismiss(d, c.officerId),
  shortlist: (d, c) => ROSTER_HANDLERS.shortlist(d, c.candidateId, c.on),
  refreshCandidates: (d, c) => ROSTER_HANDLERS.refreshCandidates(d, c.targetRole),
  startCourse: (d, c) => DEVELOP_HANDLERS.startCourse(d, c.officerId, c.courseId),
  unlockNode: (d, c) => DEVELOP_HANDLERS.unlockNode(d, c.nodeId),
  buyItem: (d, c) => DEVELOP_HANDLERS.buyItem(d, c.itemId, c.qty),
  createSquad: (d, c) => ROSTER_HANDLERS.createSquad(d, c.name),
  renameSquad: (d, c) => ROSTER_HANDLERS.renameSquad(d, c.squadId, c.name),
  assignToSquad: (d, c) => ROSTER_HANDLERS.assignToSquad(d, c.officerId, c.squadId),
  setLeader: (d, c) => ROSTER_HANDLERS.setLeader(d, c.squadId, c.officerId),
  setSquadDuty: (d, c) => ROSTER_HANDLERS.setSquadDuty(d, c.squadId, c.duty),
  setLoadoutPreset: (d, c) => ROSTER_HANDLERS.setLoadoutPreset(d, c.squadId, c.items),
  setRestockRule: (d, c) => ROSTER_HANDLERS.setRestockRule(d, c.rule),
  serviceUnit: (d, c) => EQUIPMENT_HANDLERS.serviceUnit(d, c.unitId),
  scrapUnit: (d, c) => EQUIPMENT_HANDLERS.scrapUnit(d, c.unitId),
  offerRetention: (d, c) => ROSTER_HANDLERS.offerRetention(d, c.officerId),
  markIncidentsSeen: (d) => INCIDENT_HANDLERS.markIncidentsSeen(d),
};

export function createInitialState(now: number): GameState {
  const state: GameState = {
    saveVersion: CURRENT_SAVE_VERSION,
    contentVersion: 1,
    department: {
      name: 'Westhaven Department',
      funding: 12400,
      devPoints: 3,
      trust: 78,
      level: 3,
      rosterCap: 12,
      trainingSlots: 1,
      unlockedNodes: [],
      restockRules: [],
      lastSettledAt: now,
      lastInteractionAt: now,
      clockHighWater: now,
      // Game day 0 (1 Jan 2026) is the moment the department is created.
      calendarEpoch: now,
    },
    officers: startingOfficers(now),
    squads: startingSquads(),
    candidates: [],
    units: {},
    reservations: [],
    activeRun: null,
    incidents: [],
    debriefs: [],
    report: null,
    nextId: 1,
    rngState: 12345,
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
