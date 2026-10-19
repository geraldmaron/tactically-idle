import { parseRecipeKey } from './casebook';
import { validCommandStaff } from './command-staff';
import type { GameState, OperationRun, SaveEnvelope } from './types';
import { COMPLETION_DISPOSITIONS, validExternalSupportState } from './external-support';
import { validCasualtyRecord, validIncidentConsequences, validPersonCasualtyRecord, validPersonConsequences } from './incident-consequences';
import { validForceOutcome } from './force-risk';
import { SQUAD_IDS as SQUAD_ID_LIST } from './types';
import { ITEMS } from '../content/items';
import { COURSES } from '../content/courses';
import { DEV_NODES } from '../content/dev-tree';
import { getScenario } from './scenario-registry';
import { parseIncidentId, INCIDENT_CONTENT_VERSION } from '../gen/incident';
import { maxDevelopmentTier } from './development-tiers';
import { normalizeSquadArrangementState } from './squad-optimizer';
import { validResponseFailure } from './response-failure';

export const SAVE_KEY = 'tactically-idle/save';

/** Version written by this build. Other versions are rejected. */
export const CURRENT_SAVE_VERSION = 10;

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function serialize(state: GameState, now: number): string {
  const env: SaveEnvelope = { saveVersion: state.saveVersion, contentVersion: state.contentVersion, savedAt: now, state };
  return JSON.stringify(env);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isList = (v: unknown, valid: (entry: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.every(valid);
const isStrings = (v: unknown): v is string[] => isList(v, isStr);
const oneOf = (v: unknown, choices: readonly string[]): v is string => isStr(v) && choices.includes(v);
const numbers = (v: Record<string, unknown>, keys: string[]) => keys.every((key) => isNum(v[key]));
const strings = (v: Record<string, unknown>, keys: string[]) => keys.every((key) => isStr(v[key]));
const validPoint = (v: unknown) => isObj(v) && numbers(v, ['x', 'y']);
const validNumericRecord = (v: unknown) => isObj(v) && Object.values(v).every(isNum);
const validStressLevel = (v: unknown) => isNum(v) && v >= 0 && v <= 100;
const validStressPair = (v: unknown) => isObj(v) && validStressLevel(v.stressBefore) && validStressLevel(v.stressAfter);

function validStressLevels(levels: unknown, deltas: unknown): boolean {
  return levels === undefined || (isObj(levels) && isObj(deltas)
    && Object.keys(levels).length === Object.keys(deltas).length
    && Object.entries(levels).every(([id, pair]) => Object.hasOwn(deltas, id) && validStressPair(pair)));
}

const SQUAD_IDS: readonly string[] = SQUAD_ID_LIST;
const RATING_KEYS = ['shooting', 'composure', 'communication', 'awareness', 'medical', 'coordination'];
const DUTIES = ['patrol', 'standby', 'rest'];
const UNIT_STATUSES = ['ready', 'reserved', 'service', 'expired', 'scrapped'];
const RETIREMENT_REASONS = ['age', 'service', 'burnout'];
const ROLES = ['comms', 'breach', 'medic', 'recon', 'lead'];
const CERTS = ['crisis_negotiation', 'entry_team', 'advanced_first_aid', 'surveillance', 'drone_operator', 'less_lethal', 'advanced_less_lethal', 'deescalation', 'vehicle_operations', 'precision_support', 'controlled_access'];
const TRAITS = ['steady', 'observant', 'mentor', 'impatient', 'calm_voice', 'rookie'];
const KNOWLEDGE = ['unknown', 'reported', 'confirmed', 'disproved'];
const STAGES = ['assess', 'adapt', 'resolve'];
const CONTRIBUTOR_SOURCES = ['rating', 'condition', 'trait', 'equipment', 'space', 'support', 'familiarity', 'preparation', 'difficulty', 'pressure'];

function validReport(r: unknown): boolean {
  return isObj(r) && numbers(r, ['from', 'to', 'accruedHours', 'gross', 'wages', 'operating', 'restockSpend', 'net', 'devPoints'])
    && (r.maintenanceSpend === undefined || (isNum(r.maintenanceSpend) && r.maintenanceSpend >= 0))
    && (r.maintenanceStarted === undefined || isStrings(r.maintenanceStarted))
    && isBool(r.capped) && isStrings(r.recovered) && isStrings(r.shortages)
    && isList(r.completedCourses, (c) => isObj(c) && strings(c, ['officerId', 'courseId']))
    && isList(r.equipment, (e) => isObj(e) && isStr(e.unitId) && oneOf(e.event, ['unreliable', 'failed', 'expired', 'serviced']))
    && isList(r.personnel, (p) => isObj(p) && strings(p, ['officerId', 'detail'])
      && oneOf(p.event, ['retirement_announced', 'retired', 'anniversary', 'birthday']));
}

function validDecision(d: unknown): boolean {
  return isObj(d) && numbers(d, ['revision', 'score', 'difficulty', 'sample', 'timeCost', 'clockBaseMinutes']) && (d.clockBaseMinutes as number) >= 0
    && isStr(d.actionId) && oneOf(d.stage, STAGES) && oneOf(d.band, ['favorable', 'mixed', 'adverse'])
    && isList(d.actingSquadIds, (id) => oneOf(id, SQUAD_IDS)) && isList(d.supportSquadIds, (id) => oneOf(id, SQUAD_IDS))
    && isStrings(d.officerIds) && (d.targetId === null || isStr(d.targetId)) && validNumericRecord(d.stressDeltas)
    && validStressLevels(d.stressLevels, d.stressDeltas)
    && isStrings(d.unitsUsed) && isStrings(d.explanation)
    && isList(d.inputs, (c) => isObj(c) && isStr(c.label) && isNum(c.value) && oneOf(c.source, CONTRIBUTOR_SOURCES)
      && (c.ref === undefined || isStr(c.ref)))
    && isList(d.itemsConsumed, (i) => isObj(i) && isStr(i.itemId) && isNum(i.qty))
    && isList(d.knowledgeChanges, (k) => isObj(k) && isStr(k.factId) && oneOf(k.status, KNOWLEDGE))
    && (d.committed === undefined || (isObj(d.committed) && numbers(d.committed, ['objectiveDelta', 'civilianSafetyDelta', 'pressureDelta']) && isStrings(d.committed.consequences) && (d.committed.endingTitle === null || isStr(d.committed.endingTitle))
      && (d.committed.resultLabel === undefined || (isStr(d.committed.resultLabel) && d.committed.resultLabel.length > 0 && d.committed.resultLabel.length <= 100))
      && (d.committed.openingChanges === undefined || isList(d.committed.openingChanges, (change) => isObj(change) && isStr(change.openingId) && oneOf(change.state, ['open', 'closed', 'locked', 'blocked'])))
      && (d.committed.externalSupport === undefined || isList(d.committed.externalSupport, (event) => isObj(event) && isStr(event.serviceId) && oneOf(event.kind, ['requested', 'accepted']) && isNum(event.at) && event.at >= 0))
      && (d.committed.forceOutcome === undefined || validForceOutcome(d.committed.forceOutcome))
      && (d.committed.personCasualties === undefined || isList(d.committed.personCasualties, validPersonCasualtyRecord))
      && (d.committed.protectionUsed === undefined || isObj(d.committed.protectionUsed) && strings(d.committed.protectionUsed, ['itemId', 'unitId']))
      && (d.committed.exchange === undefined || isList(d.committed.exchange, (line) => isObj(line) && strings(line, ['speaker', 'line'])))
      && (d.committed.drawn === undefined || isList(d.committed.drawn, (r) => isObj(r) && oneOf(r.model, ['incoming_fire', 'team_force', 'cascade']) && strings(r, ['personId', 'key']) && (r.reason === undefined || isStr(r.reason))))
      && (d.committed.officerCasualties === undefined || isList(d.committed.officerCasualties, validCasualtyRecord))));
}

function validDecisionView(d: unknown): boolean {
  return isObj(d) && strings(d, ['actionId', 'title', 'stageLabel']) && numbers(d, ['revision', 'timeCost', 'objectiveDelta', 'civilianSafetyDelta', 'pressureDelta'])
    && oneOf(d.band, ['favorable', 'mixed', 'adverse']) && isBool(d.actualStressDeltas) && isStrings(d.explanation) && isStrings(d.consequences)
    && (d.officerCasualties === undefined || isList(d.officerCasualties, validCasualtyRecord))
    && (d.exchange === undefined || isList(d.exchange, (line) => isObj(line) && strings(line, ['speaker', 'line'])))
    && (d.forceOutcome === undefined || validForceOutcome(d.forceOutcome))
    && (d.personCasualties === undefined || isList(d.personCasualties, validPersonCasualtyRecord))
    && (d.endingTitle === null || isStr(d.endingTitle))
    && (d.resultLabel === undefined || (isStr(d.resultLabel) && d.resultLabel.length > 0 && d.resultLabel.length <= 100))
    && isList(d.stressDeltas, (x) => isObj(x) && strings(x, ['officerId', 'label']) && isNum(x.delta)
      && ((x.stressBefore === undefined && x.stressAfter === undefined) || validStressPair(x)))
    && isList(d.supplies, (x) => isObj(x) && strings(x, ['itemId', 'label']) && isNum(x.qty) && x.qty >= 0)
    && isList(d.knowledgeChanges, (x) => isObj(x) && strings(x, ['factId', 'label']) && oneOf(x.status, KNOWLEDGE))
    && isList(d.contributors, (x) => isObj(x) && isStr(x.label) && isNum(x.value) && oneOf(x.source, CONTRIBUTOR_SOURCES) && (x.ref === undefined || isStr(x.ref)));
}

function validIncident(c: unknown): c is Record<string, unknown> {
  if (!isObj(c) || !strings(c, ['id', 'type', 'familyId']) || !numbers(c, ['tier', 'arrivedAt', 'expiresAt']) || !isBool(c.seen)) return false;
  if (c.newKind !== undefined && !isBool(c.newKind)) return false;
  const spec = parseIncidentId(c.id as string);
  return !!spec && spec.type === c.type && spec.familyId === c.familyId && spec.tier === c.tier;
}

function validRun(r: unknown): boolean {
  if (!isObj(r) || !strings(r, ['id', 'scenarioId', 'locationFamilyId'])
    || !numbers(r, ['scenarioVersion', 'locationSeed', 'contentVersion', 'rngState', 'clock', 'pressure', 'objective', 'civilianSafety', 'revision', 'startedAt'])
    || !isBool(r.settled) || !oneOf(r.stage, [...STAGES, 'debrief'])
    || !oneOf(r.status, ['active', 'debrief', 'closed']) || !(r.endingId === null || isStr(r.endingId))
    || !isList(r.squadIds, (id) => oneOf(id, SQUAD_IDS)) || r.squadIds.length === 0
    || new Set(r.squadIds).size !== r.squadIds.length || !isStrings(r.reservationIds) || !isStrings(r.flags)
    || !isObj(r.knowledge) || !Object.values(r.knowledge).every((status) => oneOf(status, KNOWLEDGE))
    || !isList(r.history, validDecision)) return false;
  if (!isList(r.squadTasks, (t) => isObj(t) && oneOf(t.squadId, SQUAD_IDS) && strings(t, ['positionId', 'task'])
    && (t.stagingId === null || isStr(t.stagingId)) && (t.at === null || validPoint(t.at)))) return false;
  for (const key of ['people', 'lastSeen']) {
    const positions = r[key];
    if (positions !== undefined && (!isObj(positions) || !Object.values(positions).every((p) => isObj(p)
      && isStr(p.spaceId) && validPoint(p.at) && (key !== 'lastSeen' || isNum(p.revision))))) return false;
  }
  // v13 clocks and subject meters (sim/clocks.ts, sim/meters.ts).
  const within = (n: unknown) => isNum(n) && n >= 0 && n <= 100;
  if (r.clocks !== undefined && (!isObj(r.clocks) || !Object.values(r.clocks).every((c) => isObj(c) && within(c.value) && Number.isSafeInteger(c.cued) && (c.cued as number) >= 0))) return false;
  if (r.meters !== undefined && (!isObj(r.meters) || !Object.values(r.meters).every((m) => isObj(m) && within(m.agitation) && within(m.rapport)
    && isObj(m.moved) && Object.values(m.moved).every((v) => isObj(v) && numbers(v, ['agitation', 'rapport']))))) return false;
  if (r.commitments !== undefined && (!isObj(r.commitments) || !Object.values(r.commitments).every((c) => isObj(c) && strings(c, ['personId', 'kind'])
    && numbers(c, ['madeAt', 'revision']) && oneOf(c.status, ['open', 'kept', 'broken'])))) return false;
  if (r.supportUnitIds !== undefined && (!isStrings(r.supportUnitIds) || r.supportUnitIds.length > 1)) return false;
  if (r.supportPositionId !== undefined && !isStr(r.supportPositionId)) return false;
  if (r.sourceIncident !== undefined && (!validIncident(r.sourceIncident) || r.sourceIncident.id !== r.scenarioId)) return false;
  if (r.resupplies !== undefined && !isList(r.resupplies, (delivery) => isObj(delivery)
    && (delivery.supportUnitId === undefined || isStr(delivery.supportUnitId))
    && isNum(delivery.minutes) && delivery.minutes > 0 && delivery.minutes <= 60
    && isList(delivery.allocations, (allocation) => isObj(allocation) && oneOf(allocation.squadId, SQUAD_IDS)
      && (r.squadIds as unknown[]).includes(allocation.squadId) && isStrings(allocation.unitIds)
      && allocation.unitIds.length > 0 && new Set(allocation.unitIds).size === allocation.unitIds.length))) return false;
  // A structurally sound run still needs a resolvable map; selectors rebuild it immediately.
  const scenario = getScenario(r.scenarioId as string);
  return !!scenario && scenario.locationFamilyId === r.locationFamilyId && Number.isSafeInteger(r.locationSeed)
    && (r.locationSeed as number) >= 0
    && validResponseFailure(r as unknown as OperationRun, scenario)
    && validExternalSupportState(r as unknown as OperationRun, scenario)
    && (r.contentVersion === INCIDENT_CONTENT_VERSION && r.scenarioVersion === scenario.version && r.locationSeed === scenario.locationSeed
      && Number.isSafeInteger(r.revision) && r.revision === r.history.length + ((r.resupplies as unknown[] | undefined)?.length ?? 0)
      && (r.clock as number) >= 0 && (r.objective as number) >= 0 && (r.objective as number) <= 100
      && (r.civilianSafety as number) >= 0 && (r.civilianSafety as number) <= 100
      && (r.pressure as number) >= 0 && (r.pressure as number) <= 100
      && r.history.every((entry, index) => (entry as Record<string, unknown>).revision === index + ((r.resupplies as unknown[] | undefined)?.length ?? 0))
      && (r.status === 'active' ? r.stage !== 'debrief' && r.endingId === null : r.stage === 'debrief' && isStr(r.endingId) && !!scenario.endings[r.endingId]));
}

function validDebrief(d: unknown): boolean {
  return isObj(d) && strings(d, ['runId', 'scenarioId', 'endingId', 'endingTitle'])
    && numbers(d, ['trustDelta', 'fundingReward', 'devPointReward']) && isStrings(d.causes)
    && [d.objective, d.civilianSafety].every((v) => isObj(v) && isNum(v.score) && isStr(v.label))
    && isList(d.officerCondition, (o) => isObj(o) && isStr(o.officerId) && numbers(o, ['stressBefore', 'stressAfter', 'xpGained']))
    && isList(d.informationPreserved, (f) => isObj(f) && strings(f, ['factId', 'label']) && oneOf(f.status, KNOWLEDGE))
    && isList(d.resources, (i) => isObj(i) && isStr(i.itemId) && numbers(i, ['used', 'returned']))
    && isList(d.unitWear, (u) => isObj(u) && strings(u, ['unitId', 'itemId', 'serial']) && numbers(u, ['before', 'after']))
    && (d.endingSummary === undefined || isStr(d.endingSummary)) && (d.endingEpilogue === undefined || isStr(d.endingEpilogue)) && (d.decisions === undefined || isList(d.decisions, validDecisionView))
    && (d.officerCasualties === undefined || isList(d.officerCasualties, validCasualtyRecord))
    && (d.personCasualties === undefined || isList(d.personCasualties, validPersonCasualtyRecord))
    && (d.civilianOutcomes === undefined || isList(d.civilianOutcomes, person => isObj(person) && strings(person, ['id', 'label']) && oneOf(person.status, ['unaccounted', 'needs_help', 'safe', 'injured_needs_care', 'care_accepted', 'accounted_elsewhere', 'deceased'])))
    && (d.scoreLines === undefined || isList(d.scoreLines, line => isObj(line) && strings(line, ['key', 'text']) && numbers(line, ['trust', 'strain'])))
    && (d.forceLines === undefined || isList(d.forceLines, line => isObj(line) && isStr(line.text) && (line.reason === undefined || isStr(line.reason))))
    && (d.disposition === undefined || oneOf(d.disposition, COMPLETION_DISPOSITIONS))
    && (d.serviceEarned === undefined || (Number.isSafeInteger(d.serviceEarned) && (d.serviceEarned as number) >= 0))
    && (d.levelReached === undefined || Number.isSafeInteger(d.levelReached))
    && (d.completionAchieved === undefined || isBool(d.completionAchieved))
    && (d.remainingTasks === undefined || isStrings(d.remainingTasks))
    && (d.receivingService === undefined || (isObj(d.receivingService) && strings(d.receivingService, ['id', 'label', 'kind']) && isNum(d.receivingService.acceptedAt) && d.receivingService.acceptedAt >= 0))
    && (d.disposition === undefined || (isBool(d.completionAchieved)
      && (d.completionAchieved ? ['resolved', 'care_accepted', 'followup_agreed'].includes(d.disposition as string) : ['relief_partial', 'unresolved'].includes(d.disposition as string))
      && (d.disposition !== 'care_accepted' || d.receivingService !== undefined)));
}

/** Current officer shape, including career and assignment records. */
function validOfficer(o: unknown, key: string): boolean {
  if (!isObj(o)) return false;
  if (o.identityId !== undefined && !isStr(o.identityId)) return false;
  if (o.id !== key || !isStr(o.firstName) || !isStr(o.surname) || !oneOf(o.role, ROLES) || !isStr(o.portrait)) return false;
  if (!isObj(o.ratings) || !RATING_KEYS.every((k) => isNum((o.ratings as Record<string, unknown>)[k]))) return false;
  if (!isList(o.certs, (c) => oneOf(c, CERTS)) || !isList(o.traits, (t) => oneOf(t, TRAITS))) return false;
  if (!isNum(o.wage) || !isNum(o.xp) || !isNum(o.stress) || !isNum(o.hiredAt)) return false;
  if (o.injury !== null && !(isObj(o.injury) && isStr(o.injury.label) && isNum(o.injury.until))) return false;
  if (o.squadId !== null && !(isStr(o.squadId) && SQUAD_IDS.includes(o.squadId))) return false;
  if (o.assignment !== null) {
    const a = o.assignment;
    const training = isObj(a) && a.kind === 'training' && isStr(a.courseId) && Object.hasOwn(COURSES, a.courseId) && isNum(a.startedAt) && isNum(a.endsAt);
    const op = isObj(a) && a.kind === 'operation' && isStr(a.runId);
    if (!training && !op) return false;
  }
  if ((o.xpBanked !== undefined && !isNum(o.xpBanked))
    || (o.highStressSince !== undefined && o.highStressSince !== null && !isNum(o.highStressSince))
    || (o.lastRunCounted !== undefined && o.lastRunCounted !== null && !isStr(o.lastRunCounted))) return false;
  if (!isNum(o.bornDay) || !isNum(o.serviceStartDay)) return false;
  const c = o.career;
  if (!isObj(c) || !isNum(c.operations) || !isNum(c.favorable) || !isNum(c.adverse)) return false;
  if (o.retirement !== null) {
    const r = o.retirement;
    if (!isObj(r) || !isNum(r.day) || !isNum(r.announcedDay) || typeof r.extended !== 'boolean') return false;
    if (!isStr(r.reason) || !RETIREMENT_REASONS.includes(r.reason)) return false;
  }
  return true;
}

function validUnit(u: unknown, key: string): boolean {
  if (!isObj(u)) return false;
  if (u.id !== key || !isStr(u.itemId) || !Object.hasOwn(ITEMS, u.itemId) || !isStr(u.serial)) return false;
  if (!['condition', 'acquiredAt', 'uses', 'wearRate', 'lastWearAt'].every((f) => isNum(u[f]))) return false;
  if (!isStr(u.status) || !UNIT_STATUSES.includes(u.status)) return false;
  if (u.serviceUntil !== null && !isNum(u.serviceUntil)) return false;
  if (u.expiresAt !== null && !isNum(u.expiresAt)) return false;
  return true;
}

/** Structural checks shared by every version. */
function validBase(s: unknown): s is Record<string, unknown> {
  if (!isObj(s)) return false;
  const dep = s.department;
  if (!isObj(dep)) return false;
  const depNums = ['funding', 'devPoints', 'trust', 'level', 'rosterCap', 'trainingSlots', 'lastSettledAt', 'lastInteractionAt', 'clockHighWater'];
  if (!isStr(dep.name) || !depNums.every((k) => isNum(dep[k]))) return false;
  if (!isNum(dep.calendarEpoch)) return false;
  if (!isStrings(dep.unlockedNodes) || !dep.unlockedNodes.every((id) => Object.hasOwn(DEV_NODES, id))
    || !isList(dep.restockRules, (r) => isObj(r) && isStr(r.itemId) && Object.hasOwn(ITEMS, r.itemId) && numbers(r, ['target', 'budgetCeiling']))) return false;
  if (dep.candidateRefreshedAt !== undefined && !isNum(dep.candidateRefreshedAt)) return false;
  if (dep.service !== undefined && (!Number.isSafeInteger(dep.service) || (dep.service as number) < 0)) return false;
  if (dep.maintenanceBudgetPerHour !== undefined && (!isNum(dep.maintenanceBudgetPerHour) || !Number.isInteger(dep.maintenanceBudgetPerHour) || dep.maintenanceBudgetPerHour < 0 || dep.maintenanceBudgetPerHour > 500)) return false;
  if (!isObj(s.officers)) return false;
  const officers = s.officers as Record<string, unknown>;
  if (!Object.entries(officers).every(([k, o]) => validOfficer(o, k))) return false;
  if (!Array.isArray(s.squads)) return false;
  const seen = new Set<string>();
  for (const sq of s.squads as unknown[]) {
    if (!isObj(sq) || !isStr(sq.id) || !SQUAD_IDS.includes(sq.id) || seen.has(sq.id)) return false;
    seen.add(sq.id);
    if (!isStr(sq.name) || !DUTIES.includes(sq.duty as string) || !validNumericRecord(sq.loadoutPreset)) return false;
    if (!Array.isArray(sq.officerIds) || !sq.officerIds.every((id) => isStr(id) && Object.hasOwn(officers, id))) return false;
    if (sq.leaderId !== null && !(isStr(sq.leaderId) && sq.officerIds.includes(sq.leaderId))) return false;
  }
  if (!Array.isArray(s.candidates)) return false;
  for (const c of s.candidates as unknown[]) {
    if (!isObj(c) || !isStr(c.id) || !isNum(c.signingCost) || !isNum(c.expiresAt) || typeof c.shortlisted !== 'boolean') return false;
    if (!validOfficer(c.officer, (c.officer as { id?: string } | null)?.id ?? '')) return false;
  }
  if (!Array.isArray(s.reservations) || !Array.isArray(s.debriefs)) return false;
  if (s.activeRun !== null && !isObj(s.activeRun)) return false;
  if (s.report !== null && !isObj(s.report)) return false;
  return isNum(s.nextId) && isNum(s.rngState) && isNum(s.saveVersion) && isNum(s.contentVersion);
}

/** The incident board and its arrival schedule. */
function validIncidents(s: Record<string, unknown>): boolean {
  if (!Array.isArray(s.incidents)) return false;
  const ids = new Set<string>();
  for (const c of s.incidents as unknown[]) {
    if (!validIncident(c) || !isStr(c.id) || ids.has(c.id)) return false;
    ids.add(c.id);
  }
  const dep = s.department as Record<string, unknown>;
  return dep.nextIncidentAt === undefined || isNum(dep.nextIncidentAt);
}

/** The current casebook, created on the first board draw. */
function validCasebook(c: unknown): boolean {
  if (c === undefined) return true;
  if (!isObj(c) || !isStrings(c.frameworksSeen) || new Set(c.frameworksSeen).size !== c.frameworksSeen.length || !isObj(c.recipes)) return false;
  return Object.entries(c.recipes).every(([key, entry]) => !!parseRecipeKey(key) && isObj(entry) && isNum(entry.firstAt)
    && (entry.best === undefined || (isObj(entry.best) && isBool(entry.best.completed) && numbers(entry.best, ['objective', 'safety']) && isStr(entry.best.label))));
}

/** Basic structural validation: enough that the UI and sim cannot crash on a loaded state. */
function validState(s: unknown): s is GameState {
  if (!validBase(s)) return false;
  const dep = s.department as Record<string, unknown>;
  {
    if (!isObj(dep.developmentTiers) || !isStrings(dep.unlockedNodes) || new Set(dep.unlockedNodes).size !== dep.unlockedNodes.length) return false;
    if (!Object.entries(dep.developmentTiers).every(([id, tier]) => Object.hasOwn(DEV_NODES, id) && Number.isInteger(tier) && (tier as number) >= 1 && (tier as number) <= maxDevelopmentTier(DEV_NODES[id]) && (dep.unlockedNodes as string[]).includes(id))) return false;
    if (!dep.unlockedNodes.every((id) => Object.hasOwn(dep.developmentTiers as object, id))) return false;
  }
  if (!validIncidents(s)) return false;
  if (!validCasebook(s.casebook)) return false;
  if (!validCommandStaff(s.commandStaff)) return false;
  if (s.report !== null && !validReport(s.report)) return false;
  if (s.activeRun !== null && !validRun(s.activeRun)) return false;
  if (s.activeRun !== null && !validIncidentConsequences(s.activeRun as unknown as OperationRun, getScenario((s.activeRun as unknown as OperationRun).scenarioId)!, s.officers as GameState['officers'], s.squads as GameState['squads'], (s.department as GameState['department']).clockHighWater)) return false;
  if (s.activeRun !== null && !validPersonConsequences(s.activeRun as unknown as OperationRun, getScenario((s.activeRun as unknown as OperationRun).scenarioId)!, s as unknown as GameState)) return false;
  if (!isList(s.debriefs, validDebrief)) return false;
  const people = s.personnel;
  if (!isObj(people) || !isNum(people.campaignSeed) || !Number.isInteger(people.campaignSeed) || people.campaignSeed < 0 || people.campaignSeed > 0xffffffff || !isNum(people.catalogVersion)) return false;
  if (!Array.isArray(people.employedIdentityIds) || !people.employedIdentityIds.every(isStr) || new Set(people.employedIdentityIds).size !== people.employedIdentityIds.length || !isObj(people.builds)) return false;
  for (const [identityId, officer] of Object.entries(people.builds)) {
    if (!isObj(officer) || officer.identityId !== identityId || !isStr(officer.id) || !validOfficer(officer, officer.id)) return false;
  }
  const activePeople = [...Object.values(s.officers as Record<string, { identityId?: string }>), ...(s.candidates as { officer: { identityId?: string } }[]).map((c) => c.officer)].map((o) => o.identityId).filter(Boolean);
  if (new Set(activePeople).size !== activePeople.length) return false;
  if (!isObj(s.units)) return false;
  const units = s.units as Record<string, unknown>;
  if (!Object.entries(units).every(([k, u]) => validUnit(u, k))) return false;
  for (const r of s.reservations as unknown[]) {
    if (!isObj(r) || !isStr(r.id) || !isStr(r.runId) || !isStr(r.itemId) || !isStr(r.unitId) || !oneOf(r.squadId, SQUAD_IDS)) return false;
    if (!Object.hasOwn(units, r.unitId)) return false;
  }
  return true;
}

/** Load only the current envelope and state; historical saves are intentionally unsupported. */
export function deserialize(text: string): GameState | null {
  try {
    const raw: unknown = JSON.parse(text);
    if (!isObj(raw) || raw.saveVersion !== CURRENT_SAVE_VERSION || raw.contentVersion !== INCIDENT_CONTENT_VERSION
      || !isNum(raw.savedAt) || !isObj(raw.state) || raw.state.saveVersion !== CURRENT_SAVE_VERSION
      || raw.state.contentVersion !== INCIDENT_CONTENT_VERSION || !validState(raw.state)) return null;
    normalizeSquadArrangementState(raw.state);
    return raw.state;
  } catch { return null; }
}

export function saveGame(state: GameState, now: number, storage: SaveStorage = localStorage): void {
  storage.setItem(SAVE_KEY, serialize(state, now));
}

export function loadGame(storage: SaveStorage = localStorage): GameState | null {
  const text = storage.getItem(SAVE_KEY);
  return text ? deserialize(text) : null;
}
