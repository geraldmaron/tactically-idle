// Patrol coverage is a separate workforce, settled by the department's one economy clock.
// Quotes and commands share the same checks; identities survive dismissal and never enter SWAT.
import { PERSONA_BY_ID, PERSONAS, shuffledPersonas } from '../content/personas';
import type { Persona } from '../content/personas';
import type { GameState, HandlerResult, Id, PatrolEmployee, PatrolGrade, PatrolReceipt, PatrolState, PatrolTrainingCompletion } from './types';
import { ECONOMY_TUNING, HOUR_MS, ratesAt } from './economy';
import { postFunding } from './ledger';
import { money } from './format';

export interface PatrolGradeDefinition {
  name: string;
  gross: number;
  wage: number;
  operating: number;
  serviceHours: number;
  departmentLevel: number;
  trainingHours: number;
  trainingCost: number;
}

export const PATROL_GRADES: Readonly<Record<PatrolGrade, PatrolGradeDefinition>> = {
  1: { name: 'Patrol Officer', gross: 210, wage: 45, operating: 15, serviceHours: 0, departmentLevel: 1, trainingHours: 0, trainingCost: 0 },
  2: { name: 'Senior Patrol Officer', gross: 250, wage: 55, operating: 18, serviceHours: 100, departmentLevel: 3, trainingHours: 4, trainingCost: 1200 },
  3: { name: 'Field Training Officer', gross: 300, wage: 70, operating: 22, serviceHours: 300, departmentLevel: 6, trainingHours: 8, trainingCost: 3000 },
};
export const PATROL_HIRE_COST = 900;
export const PATROL_SEVERANCE_HOURS = 24;
export const PATROL_TRAINING_SLOTS = 1;
export const MAX_PATROL_BOOST_FACTOR = 2;
export const PATROL_BOOSTS: Readonly<Record<string, { factor: number; hours: number; cost: number }>> = {
  'community-grant': { factor: 1.5, hours: 4, cost: 2000 },
};

export function patrolProfile(profileId: Id): Persona | undefined { return Object.hasOwn(PERSONA_BY_ID, profileId) ? PERSONA_BY_ID[profileId] : undefined; }
export function patrolCapacity(state: Pick<GameState, 'department'>): number {
  return capacityForLevel(state.department.level);
}
const capacityForLevel = (level: number) => level >= 6 ? 12 : level >= 3 ? 8 : 6;
export function employedPatrol(state: Pick<GameState, 'patrol'>): PatrolEmployee[] {
  return (state.patrol?.personnel ?? []).filter((person) => person.dismissedAt === null);
}

/** All people held by either workforce or a Command Staff offer are unavailable to patrol. */
function unavailableProfiles(state: GameState): Set<Id> {
  const ids = new Set(state.personnel?.employedIdentityIds ?? []);
  for (const officer of Object.values(state.officers)) if (officer.identityId) ids.add(officer.identityId);
  for (const candidate of state.candidates) if (candidate.officer.identityId) ids.add(candidate.officer.identityId);
  for (const person of state.patrol?.personnel ?? []) ids.add(person.profileId);
  for (const record of Object.values(state.commandStaff ?? {})) {
    const post = (record as { post?: { holder: { person: { identityId: Id } } | null; pool: { person: { identityId: Id } }[] } }).post;
    if (post?.holder) ids.add(post.holder.person.identityId);
    for (const candidate of post?.pool ?? []) ids.add(candidate.person.identityId);
  }
  return ids;
}

/** Three deterministic offers, without another refresh clock or a stored copy of authored profiles. */
export function patrolCandidates(state: GameState): Persona[] {
  const excluded = unavailableProfiles(state);
  return shuffledPersonas(state.personnel?.campaignSeed ?? state.rngState, 'recruitment')
    .filter((person) => !excluded.has(person.id)).slice(0, 3);
}

export function createPatrolState(): PatrolState { return { personnel: [], boosts: [], nextId: 1 }; }
export function seedPatrol(state: GameState, at: number): void {
  for (let i = 0; i < 4; i++) {
    const person = patrolCandidates(state)[0];
    if (!person) throw new Error('Not enough distinct identities for the starting patrol workforce');
    state.patrol.personnel.push({ id: `patrol_${state.patrol.nextId++}`, profileId: person.id, grade: 1, serviceHours: 0, hiredAt: at, dismissedAt: null, training: null });
  }
}

export interface PatrolRates {
  gross: number;
  baseGross: number;
  boostAmount: number;
  wages: number;
  operating: number;
  net: number;
  factor: number;
  employed: number;
  productive: number;
}

export function patrolRates(state: Pick<GameState, 'patrol'>, at: number, boosted = true): PatrolRates {
  const people = employedPatrol(state);
  const productive = people.filter((person) => !person.training || person.training.endsAt <= at);
  const gradeAt = (person: PatrolEmployee) => PATROL_GRADES[person.training && person.training.endsAt <= at ? person.training.toGrade : person.grade];
  const baseGross = productive.reduce((sum, person) => sum + gradeAt(person).gross, 0);
  const factor = boosted ? Math.min(MAX_PATROL_BOOST_FACTOR, 1 + (state.patrol?.boosts ?? [])
    .filter((boost) => boost.grantedAt <= at && boost.expiresAt > at).reduce((sum, boost) => sum + boost.factor - 1, 0)) : 1;
  const gross = baseGross * factor;
  const wages = people.reduce((sum, person) => sum + gradeAt(person).wage, 0);
  const operating = people.reduce((sum, person) => sum + gradeAt(person).operating, 0);
  return { gross, baseGross, boostAmount: gross - baseGross, wages, operating, net: gross - wages - operating, factor, employed: people.length, productive: productive.length };
}

export interface PatrolQuote {
  ok: boolean;
  reason: string | null;
  upfront: number;
  wageDelta: number;
  operatingDelta: number;
  grossDelta: number;
  netBefore: number;
  netAfter: number;
  netDelta: number;
  /** Productive hours; null when the commitment does not increase sustainable net income. */
  paybackHours: number | null;
}

function quote(state: GameState, upfront: number, grossDelta = 0, wageDelta = 0, operatingDelta = 0): PatrolQuote {
  const netBefore = ratesAt(state, state.department.clockHighWater, false).net;
  const netDelta = grossDelta - wageDelta - operatingDelta;
  return { ok: true, reason: null, upfront, grossDelta, wageDelta, operatingDelta, netBefore, netAfter: netBefore + netDelta, netDelta, paybackHours: netDelta > 0 ? upfront / netDelta : null };
}
function refuse<T extends PatrolQuote>(value: T, reason: string): T { return { ...value, ok: false, reason }; }
function affordability<T extends PatrolQuote>(state: GameState, value: T): T {
  return state.department.funding < value.upfront ? refuse(value, `Needs ${value.upfront} funding`) : value;
}

export function patrolHireQuote(state: GameState, profileId: Id): PatrolQuote {
  const grade = PATROL_GRADES[1];
  const value = quote(state, PATROL_HIRE_COST, grade.gross, grade.wage, grade.operating);
  if (!patrolCandidates(state).some((person) => person.id === profileId)) return refuse(value, 'That patrol candidate is no longer available');
  if (employedPatrol(state).length >= patrolCapacity(state)) return refuse(value, 'Every authorized patrol position is filled');
  // A profitable hire is also a recovery route from a deficit; it cannot increase that deficit.
  return affordability(state, value);
}

export function patrolDismissQuote(state: GameState, employeeId: Id): PatrolQuote {
  const person = employedPatrol(state).find((entry) => entry.id === employeeId);
  if (!person) return refuse(quote(state, 0), 'No such employed patrol officer');
  const grade = PATROL_GRADES[person.grade];
  return affordability(state, quote(state, grade.wage * PATROL_SEVERANCE_HOURS, person.training ? 0 : -grade.gross, -grade.wage, -grade.operating));
}

export interface PatrolTrainingQuote extends PatrolQuote { toGrade: PatrolGrade | null; endsAt: number | null; trainingNet: number }
export function patrolTrainingQuote(state: GameState, employeeId: Id): PatrolTrainingQuote {
  const person = employedPatrol(state).find((entry) => entry.id === employeeId);
  const value: PatrolTrainingQuote = { ...quote(state, 0), toGrade: null, endsAt: null, trainingNet: ratesAt(state, state.department.clockHighWater, false).net };
  if (!person) return refuse(value, 'No such employed patrol officer');
  if (person.training) return refuse(value, 'This patrol officer is already training');
  if (person.grade === 3) return refuse(value, 'This patrol officer holds the highest grade');
  const toGrade = (person.grade + 1) as PatrolGrade;
  const next = PATROL_GRADES[toGrade], previous = PATROL_GRADES[person.grade];
  const base = quote(state, next.trainingCost, next.gross - previous.gross, next.wage - previous.wage, next.operating - previous.operating);
  const trainingNet = base.netBefore - previous.gross;
  const result: PatrolTrainingQuote = { ...base, toGrade, endsAt: state.department.clockHighWater + next.trainingHours * HOUR_MS, trainingNet,
    paybackHours: base.netDelta > 0 ? (base.upfront + previous.gross * next.trainingHours) / base.netDelta : null };
  if (state.department.level < next.departmentLevel) return refuse(result, `Requires department level ${next.departmentLevel}`);
  if (person.serviceHours + 1e-9 < next.serviceHours) return refuse(result, `Requires ${next.serviceHours} eligible patrol service hours`);
  if (employedPatrol(state).filter((entry) => entry.training).length >= PATROL_TRAINING_SLOTS) return refuse(result, 'The patrol training place is occupied');
  if (trainingNet < 0 || base.netAfter < 0) return refuse(result, 'Unboosted income cannot cover payroll during this training');
  return affordability(state, result);
}

export interface PatrolBoostQuote extends PatrolQuote { factor: number; expiresAt: number | null; incrementalReturn: number }
/** Value only the newly purchased interval, at known training/boost boundaries and the renewed cap. */
function boostReturn(state: GameState, boostId: Id, at: number, from: number, expiresAt: number): number {
  const end = Math.min(expiresAt, at + ECONOMY_TUNING.capMs);
  if (end <= from) return 0;
  const definition = PATROL_BOOSTS[boostId];
  const trial: GameState = { ...state, patrol: { ...state.patrol, boosts: [...state.patrol.boosts.filter((boost) => boost.id !== boostId), { id: boostId, factor: definition.factor, grantedAt: at, expiresAt }] } };
  const boundaries = [...new Set([from, end,
    ...employedPatrol(state).flatMap((person) => person.training ? [person.training.endsAt] : []),
    ...state.patrol.boosts.map((boost) => boost.expiresAt),
  ].filter((time) => time >= from && time <= end))].sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const t = boundaries[i];
    total += (patrolRates(trial, t).gross - patrolRates(state, t).gross) * (boundaries[i + 1] - t) / HOUR_MS;
  }
  return total;
}
export function patrolBoostQuote(state: GameState, boostId: Id): PatrolBoostQuote {
  const definition = Object.hasOwn(PATROL_BOOSTS, boostId) ? PATROL_BOOSTS[boostId] : undefined;
  const at = state.department.clockHighWater;
  const base: PatrolBoostQuote = { ...quote(state, definition?.cost ?? 0), factor: definition?.factor ?? 1, expiresAt: null, incrementalReturn: 0 };
  if (!definition) return refuse(base, 'Unknown patrol funding boost');
  const rate = patrolRates(state, at);
  const held = state.patrol.boosts.find((entry) => entry.id === boostId && entry.expiresAt > at);
  const expiresAt = Math.max(at, held?.expiresAt ?? at) + definition.hours * HOUR_MS;
  const nextFactor = held ? rate.factor : Math.min(MAX_PATROL_BOOST_FACTOR, rate.factor + definition.factor - 1);
  const netDelta = rate.baseGross * (nextFactor - rate.factor);
  const incrementalReturn = boostReturn(state, boostId, at, held?.expiresAt ?? at, expiresAt);
  const result: PatrolBoostQuote = { ...base, expiresAt, factor: nextFactor, grossDelta: netDelta, netDelta,
    incrementalReturn, netBefore: ratesAt(state, at).net, netAfter: ratesAt(state, at).net + netDelta };
  if (rate.baseGross <= 0) return refuse(result, 'No patrol service is currently earning funding');
  if (!held && netDelta <= 0) return refuse(result, 'Patrol funding already has the maximum boost');
  if (incrementalReturn < definition.cost) return refuse(result, `Current patrol staffing would return only ${money(incrementalReturn)} during this boost`);
  if (!Number.isFinite(expiresAt)) return refuse(result, 'This patrol boost cannot be extended further');
  return affordability(state, result);
}

function receipt(state: GameState, data: Omit<PatrolReceipt, 'sequence'>): HandlerResult {
  return { ok: true, patrolReceipt: { ...data, sequence: state.department.ledger!.at(-1)!.seq } };
}
export function hirePatrol(state: GameState, profileId: Id): HandlerResult {
  const value = patrolHireQuote(state, profileId);
  if (!value.ok) return { ok: false, reason: value.reason! };
  const at = state.department.clockHighWater;
  const employeeId = `patrol_${state.patrol.nextId++}`;
  state.patrol.personnel.push({ id: employeeId, profileId, grade: 1, serviceHours: 0, hiredAt: at, dismissedAt: null, training: null });
  const person = patrolProfile(profileId)!;
  postFunding(state.department, -value.upfront, 'signing', `Patrol hire ${person.firstName} ${person.surname}`, at);
  return receipt(state, { kind: 'hire', employeeId, profileId, amount: -value.upfront, netDelta: value.netDelta });
}
export function dismissPatrol(state: GameState, employeeId: Id): HandlerResult {
  const value = patrolDismissQuote(state, employeeId);
  if (!value.ok) return { ok: false, reason: value.reason! };
  const person = state.patrol.personnel.find((entry) => entry.id === employeeId)!;
  person.dismissedAt = state.department.clockHighWater;
  person.training = null;
  const profile = patrolProfile(person.profileId)!;
  postFunding(state.department, -value.upfront, 'severance', `Patrol severance ${profile.firstName} ${profile.surname}`, person.dismissedAt);
  return receipt(state, { kind: 'dismiss', employeeId, profileId: person.profileId, amount: -value.upfront, netDelta: value.netDelta });
}
export function startPatrolTraining(state: GameState, employeeId: Id): HandlerResult {
  const value = patrolTrainingQuote(state, employeeId);
  if (!value.ok || value.toGrade === null || value.endsAt === null) return { ok: false, reason: value.reason ?? 'No patrol promotion is available' };
  const person = state.patrol.personnel.find((entry) => entry.id === employeeId)!;
  const at = state.department.clockHighWater;
  person.training = { toGrade: value.toGrade, startedAt: at, endsAt: value.endsAt };
  const profile = patrolProfile(person.profileId)!;
  postFunding(state.department, -value.upfront, 'training', `Patrol training ${profile.firstName} ${profile.surname}`, at);
  return receipt(state, { kind: 'training', employeeId, profileId: person.profileId, amount: -value.upfront, netDelta: value.netDelta, endsAt: value.endsAt });
}
export function activatePatrolBoost(state: GameState, boostId: Id): HandlerResult {
  const value = patrolBoostQuote(state, boostId);
  if (!value.ok || value.expiresAt === null) return { ok: false, reason: value.reason ?? 'No patrol boost is available' };
  const at = state.department.clockHighWater;
  const held = state.patrol.boosts.find((entry) => entry.id === boostId && entry.expiresAt > at);
  if (held) held.expiresAt = value.expiresAt;
  else state.patrol.boosts.push({ id: boostId, factor: PATROL_BOOSTS[boostId].factor, grantedAt: at, expiresAt: value.expiresAt });
  postFunding(state.department, -value.upfront, 'purchase', 'Community patrol grant', at);
  return receipt(state, { kind: 'boost', boostId, amount: -value.upfront, netDelta: value.netDelta, endsAt: value.expiresAt });
}

/** Settlement invokes these only for eligible intervals, before applying events at their end. */
export function accruePatrolService(state: GameState, hours: number): void {
  for (const person of employedPatrol(state)) if (!person.training) person.serviceHours += hours;
}
export function applyPatrolDue(state: GameState, at: number): PatrolTrainingCompletion[] {
  const completed: PatrolTrainingCompletion[] = [];
  for (const person of employedPatrol(state)) if (person.training && person.training.endsAt <= at) {
    person.grade = person.training.toGrade;
    completed.push({ employeeId: person.id, profileId: person.profileId, grade: person.grade, completedAt: person.training.endsAt });
    person.training = null;
  }
  if (state.patrol) state.patrol.boosts = state.patrol.boosts.filter((boost) => boost.expiresAt > at);
  return completed;
}
export function nextPatrolEventTime(state: GameState, at: number): number | null {
  const times = [...employedPatrol(state).flatMap((person) => person.training ? [person.training.endsAt] : []), ...(state.patrol?.boosts ?? []).map((boost) => boost.expiresAt)].filter((time) => time > at);
  return times.length ? Math.min(...times) : null;
}

/** Save v18 requires a workforce and rejects forged grades, overlapping identities and boost shapes. */
export function validPatrol(value: unknown, level: number, at: number): value is PatrolState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const patrol = value as PatrolState;
  if (!Array.isArray(patrol.personnel) || patrol.personnel.length > PERSONAS.length || !Array.isArray(patrol.boosts) || !Number.isSafeInteger(patrol.nextId) || patrol.nextId < 1) return false;
  const ids = new Set<Id>(), profiles = new Set<Id>();
  for (const person of patrol.personnel) {
    if (!person || typeof person !== 'object' || typeof person.id !== 'string' || ids.has(person.id) || !/^patrol_[1-9]\d*$/.test(person.id) || Number(person.id.slice(7)) >= patrol.nextId) return false;
    if (typeof person.profileId !== 'string' || !patrolProfile(person.profileId) || profiles.has(person.profileId)) return false;
    ids.add(person.id); profiles.add(person.profileId);
    if (![1, 2, 3].includes(person.grade) || !Number.isFinite(person.serviceHours) || person.serviceHours < 0 || !Number.isFinite(person.hiredAt) || person.hiredAt > at) return false;
    if (person.dismissedAt !== null && (!Number.isFinite(person.dismissedAt) || person.dismissedAt < person.hiredAt || person.dismissedAt > at)) return false;
    const grade = PATROL_GRADES[person.grade];
    if (level < grade.departmentLevel || person.serviceHours + 1e-9 < grade.serviceHours) return false;
    if (person.training !== null) {
      const training = person.training;
      if (!training || typeof training !== 'object' || person.dismissedAt !== null || person.grade === 3 || training.toGrade !== person.grade + 1 || !Number.isFinite(training.startedAt) || !Number.isFinite(training.endsAt) || training.startedAt < person.hiredAt || training.startedAt > at) return false;
      const next = PATROL_GRADES[training.toGrade];
      if (training.endsAt !== training.startedAt + next.trainingHours * HOUR_MS || person.serviceHours + 1e-9 < next.serviceHours || level < next.departmentLevel) return false;
    }
  }
  if (patrol.personnel.filter((person) => person.dismissedAt === null).length > capacityForLevel(level)
    || patrol.personnel.filter((person) => person.training).length > PATROL_TRAINING_SLOTS) return false;
  const boostIds = new Set<Id>();
  for (const boost of patrol.boosts) {
    if (!boost || typeof boost !== 'object' || typeof boost.id !== 'string' || !Object.hasOwn(PATROL_BOOSTS, boost.id) || boostIds.has(boost.id) || boost.factor !== PATROL_BOOSTS[boost.id].factor || !Number.isFinite(boost.grantedAt) || !Number.isFinite(boost.expiresAt) || boost.grantedAt > at || boost.expiresAt <= boost.grantedAt) return false;
    boostIds.add(boost.id);
  }
  return patrol.boosts.reduce((factor, boost) => factor + boost.factor - 1, 1) <= MAX_PATROL_BOOST_FACTOR;
}
