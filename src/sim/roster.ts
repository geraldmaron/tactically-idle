// Recruitment, dismissal, and persistent squads. Handlers mutate the draft and
// return ok/reason; checks are pure so selectors can preview exactly what the
// handler will do. What the hire depends on in the department's books (its hourly
// net, the candidate pool its upgrades allow) is handed in by the department.
import type {
  Department,
  GameState,
  HandlerResult,
  Id,
  Officer,
  Squad,
  SquadDuty,
  SquadId,
} from './types';
import { SQUAD_IDS } from './types';
import type { Projection } from './department-selectors';
import { fullNameKey, generateBatch, RECRUIT_TUNING, type RecruitGen } from '../content/recruits';
import { formatDuration, money } from './format';
import { squadDeployed } from './squads';
import { fullName } from './officer';
import { gameDay, simNow } from './calendar';
import { PERSONAS } from '../content/personas';
import { applyRetention, CAREER_TUNING, retentionCheck, mandatoryRetirementDay } from './career';
import { markEmployed } from './personnel';
import { applySquadArrangement, setSquadArrangementLock, undoSquadArrangement } from './squad-optimizer';
import { tunable } from './tuning';

/** Tunable (sim/tuning.ts), except `maxSquads`: the squad slots are SQUAD_IDS, so it only names them. */
export const ROSTER_TUNING = tunable('ROSTER_TUNING', {
  /** Owner decision (2026-10-02): up to four squads. */
  maxSquads: SQUAD_IDS.length,
  squadSize: 4,
  nameMax: 20,
  /** Severance, in hours of wage. */
  severanceHours: 8,
}, { deny: [{ path: 'maxSquads', kind: 'structural', reason: 'The squad slots are SQUAD_IDS (types.ts); this only names how many there are.' }] });

/** The department's hourly net, after wages, for a state at its settled clock (economy.ts netRate). */
export type NetRate = (state: GameState) => number;

const DUTIES: SquadDuty[] = ['patrol', 'standby', 'rest'];

/** Department plus the one field this module adds (frozen contract: optional, JSON-safe). */
type DepartmentExt = Department & { candidateRefreshedAt?: number };

const refusal = (reason: string): HandlerResult => ({ ok: false, reason });
const OK: HandlerResult = { ok: true };

function rosterSize(state: GameState): number {
  return Object.keys(state.officers).length;
}

function severanceFor(o: Officer): number {
  return o.wage * ROSTER_TUNING.severanceHours;
}

function lastRefreshAt(state: GameState): number {
  return (state.department as DepartmentExt).candidateRefreshedAt ?? Number.NEGATIVE_INFINITY;
}

// ---------------------------------------------------------------- hire

export function hireCheck(state: GameState, candidateId: Id, netRate: NetRate): Projection {
  const t = simNow(state);
  const netBefore = netRate(state);
  const cand = state.candidates.find((c) => c.id === candidateId);
  if (!cand) return { ok: false, reason: 'That candidate is no longer available', upfront: 0, wageDelta: 0, netBefore, netAfter: netBefore };
  const wage = cand.officer.wage;
  const netAfter = netBefore - wage;
  const base = { upfront: cand.signingCost, wageDelta: wage, netBefore, netAfter };
  if (cand.officer.identityId && state.personnel?.employedIdentityIds.includes(cand.officer.identityId)) return { ...base, ok: false, reason: 'That officer has already served in this campaign' };
  if (gameDay(state, t) >= mandatoryRetirementDay(cand.officer)) return { ...base, ok: false, reason: 'That candidate has reached retirement age; refresh the pool' };
  const cap = state.department.rosterCap;
  if (rosterSize(state) >= cap) return { ...base, ok: false, reason: `Roster is full (${rosterSize(state)}/${cap})` };
  if (state.department.funding < cand.signingCost) {
    return { ...base, ok: false, reason: `Signing cost ${money(cand.signingCost)} exceeds funding ${money(state.department.funding)}` };
  }
  if (netAfter < 0) {
    return { ...base, ok: false, reason: `Would leave the department ${money(-netAfter)}/h short once wages are paid` };
  }
  return { ...base, ok: true, reason: null };
}

function hire(d: GameState, candidateId: Id, netRate: NetRate): HandlerResult {
  const check = hireCheck(d, candidateId, netRate);
  if (!check.ok) return refusal(check.reason ?? 'Cannot hire');
  const idx = d.candidates.findIndex((c) => c.id === candidateId);
  const cand = d.candidates[idx];
  markEmployed(d, cand.officer);
  d.department.funding -= cand.signingCost;
  d.candidates.splice(idx, 1);
  d.officers[cand.officer.id] = { ...cand.officer, squadId: null, assignment: null, hiredAt: simNow(d) };
  return OK;
}

// ---------------------------------------------------------------- dismiss

export function dismissCheck(state: GameState, officerId: Id, netRate: NetRate): Projection {
  const netBefore = netRate(state);
  const o = state.officers[officerId];
  if (!o) return { ok: false, reason: 'No such officer', upfront: 0, wageDelta: 0, netBefore, netAfter: netBefore };
  const rest = { ...state.officers };
  delete rest[officerId];
  const after: GameState = {
    ...state,
    officers: rest,
    squads: state.squads.map((s) => ({ ...s, officerIds: s.officerIds.filter((id) => id !== officerId) })),
  };
  const base = { upfront: severanceFor(o), wageDelta: -o.wage, netBefore, netAfter: netRate(after) };
  if (o.assignment?.kind === 'operation') return { ...base, ok: false, reason: `${fullName(o)} is deployed and cannot be dismissed` };
  if (state.department.funding < base.upfront) {
    return { ...base, ok: false, reason: `Severance ${money(base.upfront)} exceeds funding ${money(state.department.funding)}` };
  }
  return { ...base, ok: true, reason: null };
}

function detachFromSquad(d: GameState, officerId: Id): void {
  for (const sq of d.squads) {
    if (!sq.officerIds.includes(officerId)) continue;
    sq.officerIds = sq.officerIds.filter((id) => id !== officerId);
    // Never leave a dangling leader id: the next member steps up, or none.
    if (sq.leaderId === officerId) sq.leaderId = sq.officerIds[0] ?? null;
  }
}

function dismiss(d: GameState, officerId: Id, netRate: NetRate): HandlerResult {
  const check = dismissCheck(d, officerId, netRate);
  if (!check.ok) return refusal(check.reason ?? 'Cannot dismiss');
  d.department.funding -= check.upfront;
  detachFromSquad(d, officerId);
  delete d.officers[officerId];
  // Dismissed officers are never added back to the candidate pool.
  return OK;
}

// ---------------------------------------------------------------- retention

/** Preview of a retention offer: the same check the handler runs. */
export function retentionOffer(state: GameState, officerId: Id, netRate: NetRate) {
  return retentionCheck(state, officerId, simNow(state), netRate(state));
}

function offerRetention(d: GameState, officerId: Id, netRate: NetRate): HandlerResult {
  const check = retentionOffer(d, officerId, netRate);
  if (!check.ok) return refusal(check.reason ?? 'Cannot make a retention offer');
  applyRetention(d, officerId, check);
  return OK;
}

// ---------------------------------------------------------------- candidates

function shortlist(d: GameState, candidateId: Id, on: boolean): HandlerResult {
  const c = d.candidates.find((x) => x.id === candidateId);
  if (!c) return refusal('That candidate is no longer available');
  c.shortlisted = on;
  return OK;
}

function refreshCheck(state: GameState, poolSize: number): { ok: boolean; reason: string | null; availableAt: number } {
  const availableAt = lastRefreshAt(state) + RECRUIT_TUNING.refreshCooldownMs;
  const t = simNow(state);
  if (t < availableAt) {
    return { ok: false, reason: `Next free candidate search in ${formatDuration(availableAt - t)}`, availableAt };
  }
  const kept = state.candidates.filter((c) => c.shortlisted && gameDay(state, t) < mandatoryRetirementDay(c.officer)).length;
  if (kept >= poolSize) {
    return { ok: false, reason: 'Every candidate slot is shortlisted; remove one to search again', availableAt };
  }
  return { ok: true, reason: null, availableAt };
}

/** The reserve can grow by adding authored identities; absent portraits do not block a career. */
export function recruitmentStatus(state: GameState, now: number) {
  const employed = new Set(state.personnel?.employedIdentityIds ?? []);
  const day = gameDay(state, now);
  let unseen = 0;
  let available = 0;
  for (const person of PERSONAS) {
    if (employed.has(person.id)) continue;
    const build = state.personnel?.builds[person.id];
    if (!build) { unseen++; available++; }
    else if (day < mandatoryRetirementDay(build)) available++;
  }
  return { total: PERSONAS.length, unseen, available, exhausted: available === 0 };
}

/** Fill the pool up to `poolSize` (economy.ts candidatePoolSize) with deterministic candidates; shortlisted ones stay. */
export function fillCandidates(d: GameState, now: number, poolSize: number): void {
  const kept = d.candidates.filter((c) => c.shortlisted && gameDay(d, now) < mandatoryRetirementDay(c.officer));
  const personnel = d.personnel!;
  const gen: RecruitGen = { rng: d.rngState, nextId: d.nextId, campaignSeed: personnel.campaignSeed, builds: personnel.builds, unavailable: personnel.employedIdentityIds };
  const taken = new Set<string>();
  for (const o of Object.values(d.officers)) taken.add(fullNameKey(o.firstName, o.surname));
  for (const c of kept) taken.add(fullNameKey(c.officer.firstName, c.officer.surname));
  const fresh = generateBatch(gen, now, Math.max(0, poolSize - kept.length), kept.map((c) => c.officer.role), taken, gameDay(d, now), CAREER_TUNING.retireAge);
  d.candidates = [...kept, ...fresh];
  d.rngState = gen.rng;
  d.nextId = gen.nextId;
  (d.department as DepartmentExt).candidateRefreshedAt = now;
}

function refreshCandidates(d: GameState, poolSize: number): HandlerResult {
  const check = refreshCheck(d, poolSize);
  if (!check.ok) return refusal(check.reason ?? 'Cannot search for candidates');
  fillCandidates(d, simNow(d), poolSize);
  return OK;
}

// ---------------------------------------------------------------- squads

function squadOf(d: GameState, id: SquadId): Squad | undefined {
  return d.squads.find((s) => s.id === id);
}

function validName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1) return { ok: false, reason: 'A squad name needs at least 1 character' };
  if (name.length > ROSTER_TUNING.nameMax) return { ok: false, reason: `Squad names are at most ${ROSTER_TUNING.nameMax} characters` };
  return { ok: true, name };
}

function createSquad(d: GameState, rawName: string): HandlerResult {
  const v = validName(rawName);
  if (!v.ok) return refusal(v.reason);
  const id = SQUAD_IDS.find((x) => !d.squads.some((s) => s.id === x));
  if (!id) return refusal(`All ${ROSTER_TUNING.maxSquads} squad slots are in use (a department fields at most ${ROSTER_TUNING.maxSquads} squads)`);
  d.squads.push({ id, name: v.name, officerIds: [], leaderId: null, duty: 'standby', loadoutPreset: {} });
  d.squads.sort((a, b) => a.id.localeCompare(b.id));
  return OK;
}

function renameSquad(d: GameState, squadId: SquadId, rawName: string): HandlerResult {
  const sq = squadOf(d, squadId);
  if (!sq) return refusal('No such squad');
  const v = validName(rawName);
  if (!v.ok) return refusal(v.reason);
  sq.name = v.name;
  return OK;
}

function assignToSquad(d: GameState, officerId: Id, squadId: SquadId | null): HandlerResult {
  const o = d.officers[officerId];
  if (!o) return refusal('No such officer');
  if (o.assignment?.kind === 'operation') return refusal(`${fullName(o)} is deployed and cannot change squads`);
  const from = o.squadId ? squadOf(d, o.squadId) : undefined;
  if (from && squadDeployed(d, from.id)) return refusal(`${from.name} is deployed; ${fullName(o)} cannot leave it now`);

  if (squadId === null) {
    if (!from) return refusal(`${fullName(o)} is not in a squad`);
    detachFromSquad(d, officerId);
    o.squadId = null;
    return OK;
  }
  const to = squadOf(d, squadId);
  if (!to) return refusal('No such squad');
  if (to.id === o.squadId) return refusal(`${fullName(o)} is already in ${to.name}`);
  if (squadDeployed(d, to.id)) return refusal(`${to.name} is deployed and cannot change roster`);
  if (to.officerIds.length >= ROSTER_TUNING.squadSize) return refusal(`${to.name} already has ${ROSTER_TUNING.squadSize} officers`);

  detachFromSquad(d, officerId);
  to.officerIds.push(officerId);
  if (!to.leaderId) to.leaderId = officerId;
  o.squadId = to.id;
  return OK;
}

function setLeader(d: GameState, squadId: SquadId, officerId: Id): HandlerResult {
  const sq = squadOf(d, squadId);
  if (!sq) return refusal('No such squad');
  if (!sq.officerIds.includes(officerId)) return refusal('The leader must be a member of the squad');
  if (squadDeployed(d, squadId)) return refusal(`${sq.name} is deployed and cannot change leader`);
  sq.leaderId = officerId;
  return OK;
}

function setSquadDuty(d: GameState, squadId: SquadId, duty: SquadDuty): HandlerResult {
  const sq = squadOf(d, squadId);
  if (!sq) return refusal('No such squad');
  if (!DUTIES.includes(duty)) return refusal('Unknown duty');
  if (squadDeployed(d, squadId)) return refusal(`${sq.name} is deployed and cannot change duty`);
  sq.duty = duty;
  return OK;
}

export const ROSTER_HANDLERS = {
  applySquadArrangement,
  setSquadArrangementLock,
  undoSquadArrangement,
  hire,
  dismiss,
  shortlist,
  refreshCandidates,
  createSquad,
  renameSquad,
  assignToSquad,
  setLeader,
  setSquadDuty,
  offerRetention,
};
