// Recruitment, dismissal, and persistent squads. Handlers mutate the draft and
// return ok/reason; checks are pure so selectors can preview exactly what the
// handler will do. What the hire depends on in the department's books (its hourly
// net, the candidate pool its upgrades allow) is handed in by the department.
import type { StaffPost } from './staff-pool';
import type {
  Candidate,
  Department,
  GameState,
  HandlerResult,
  Id,
  Officer,
  PendingSquadMove,
  Squad,
  SquadDuty,
  SquadId,
} from './types';
import { SQUAD_IDS } from './types';
import type { Projection } from './department-selectors';
import { fullNameKey, generateBatch, RECRUIT_TUNING, type RecruitGen } from '../content/recruits';
import { hashSeed } from './rng';
import { formatDuration, funding, fundingPerHour } from './format';
import { fullName } from './officer';
import { gameDay, simNow } from './calendar';
import { PERSONAS } from '../content/personas';
import { applyRetention, CAREER_TUNING, retentionCheck, mandatoryRetirementDay } from './career';
import { markEmployed } from './personnel';
import { eligibleRehires, isRehire, onOfficerDeparted, onOfficerHired, rehireCandidate, rehireCandidateId, rehireCandidates, rehireCheck } from './people/records';
import { applySquadArrangement, setSquadArrangementLock, undoSquadArrangement } from './squad-optimizer';
import { tunable } from './tuning';
import { postFunding } from './ledger';
import { issueKit } from '../content/issue-kit';
import { createUnit } from './equipment';

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

const DUTIES: SquadDuty[] = ['standby', 'rest'];

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
  // Anyone who has served is closed to hire, except a dismissed officer past the cooldown (people/records.ts).
  if (cand.officer.identityId && state.personnel?.employedIdentityIds.includes(cand.officer.identityId)) {
    const returning = rehireCheck(state, cand.officer, t);
    if (!returning.ok) return { ...base, ok: false, reason: returning.reason };
  }
  if (cand.officer.identityId && state.patrol?.personnel.some((person) => person.profileId === cand.officer.identityId)) return { ...base, ok: false, reason: 'That person has served in the patrol workforce' };
  if (gameDay(state, t) >= mandatoryRetirementDay(cand.officer)) return { ...base, ok: false, reason: 'That candidate has reached retirement age; refresh the pool' };
  const cap = state.department.rosterCap;
  if (rosterSize(state) >= cap) return { ...base, ok: false, reason: `Roster is full (${rosterSize(state)}/${cap})` };
  if (state.department.funding < cand.signingCost) {
    return { ...base, ok: false, reason: `Signing cost ${funding(cand.signingCost)} exceeds the department's ${funding(state.department.funding)}` };
  }
  if (netAfter < 0) {
    return { ...base, ok: false, reason: `Would leave the department ${fundingPerHour(-netAfter)} short once wages are paid` };
  }
  return { ...base, ok: true, reason: null };
}

function hire(d: GameState, candidateId: Id, netRate: NetRate): HandlerResult {
  const check = hireCheck(d, candidateId, netRate);
  if (!check.ok) return refusal(check.reason ?? 'Cannot hire');
  const idx = d.candidates.findIndex((c) => c.id === candidateId);
  const cand = d.candidates[idx];
  // A returning officer comes back as they left (the candidate holds their snapshot), with their old kit.
  const returning = isRehire(d, cand.officer, simNow(d));
  markEmployed(d, cand.officer);
  postFunding(d.department, -cand.signingCost, 'signing', `${returning ? 'Rehired' : 'Signed'} ${fullName(cand.officer)}`, simNow(d));
  d.candidates.splice(idx, 1);
  d.officers[cand.officer.id] = { ...cand.officer, squadId: null, assignment: null, hiredAt: simNow(d) };
  // The officer's issue kit joins the department pool (its cost is part of the signing).
  if (!returning) for (const itemId of issueKit(cand.officer)) createUnit(d, itemId, simNow(d));
  onOfficerHired(d, cand.officer.id);
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
  if (o.assignment?.kind === 'proactive') return { ...base, ok: false, reason: `${fullName(o)} is on a proactive shift. Recall the squad first` };
  if (o.assignment?.kind === 'standdown' || o.assignment?.kind === 'peer_support') return { ...base, ok: false, reason: `${fullName(o)} is on aftercare. Wait until it ends` };
  if (state.department.funding < base.upfront) {
    return { ...base, ok: false, reason: `Severance ${funding(base.upfront)} exceeds the department's ${funding(state.department.funding)}` };
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
  postFunding(d.department, -check.upfront, 'severance', `Severance for ${fullName(d.officers[officerId])}`, simNow(d));
  detachFromSquad(d, officerId);
  // The people layer stores the officer as they leave, so a rehire brings back this person and no other.
  onOfficerDeparted(d, officerId, 'dismissed');
  delete d.officers[officerId];
  // A dismissed officer returns to the pool only through rehireCandidates, after the cooldown.
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
  const employed = new Set([...(state.personnel?.employedIdentityIds ?? []), ...(state.patrol?.personnel ?? []).map((person) => person.profileId)]);
  const day = gameDay(state, now);
  let unseen = 0;
  let available = 0;
  for (const person of PERSONAS) {
    if (employed.has(person.id)) continue;
    const build = state.personnel?.builds[person.id];
    if (!build) { unseen++; available++; }
    else if (day < mandatoryRetirementDay(build)) available++;
  }
  // Dismissed officers past their cooldown can be hired back.
  available += rehireCandidates(state, now).length;
  return { total: PERSONAS.length, unseen, available, exhausted: available === 0 };
}

/** People in or offered a Command Staff post: the officer market leaves them out. Read structurally,
 * so the officer system does not depend on the staff module at runtime. */
function staffIdentityIds(state: GameState): string[] {
  return Object.values(state.commandStaff ?? {}).flatMap((record) => {
    const post = (record as { post?: StaffPost }).post;
    return post ? [...(post.holder ? [post.holder.person.identityId] : []), ...post.pool.map((c) => c.person.identityId)] : [];
  });
}

/** The officer market draws from people who have never served, hold no staff post and are not on patrol. */
function marketGen(d: GameState, rng: number, nextId: number): RecruitGen {
  const personnel = d.personnel!;
  const patrol = (d.patrol?.personnel ?? []).map((p) => p.profileId);
  return { rng, nextId, campaignSeed: personnel.campaignSeed, builds: personnel.builds, unavailable: [...personnel.employedIdentityIds, ...staffIdentityIds(d), ...patrol] };
}

function takenNames(d: GameState, candidates: Candidate[]): Set<string> {
  const taken = new Set<string>();
  for (const o of Object.values(d.officers)) taken.add(fullNameKey(o.firstName, o.surname));
  for (const c of candidates) taken.add(fullNameKey(c.officer.firstName, c.officer.surname));
  return taken;
}

/** Returning officers are listed beside the pool, not counted in its size (ids from people/records.ts). */
const isRehireCandidate = (c: Candidate): boolean => c.id.startsWith('cand_rehire_');

/** List the dismissed officers who can be hired back now. Shortlisted ones keep their place. */
function addRehireCandidates(d: GameState, now: number): void {
  if (!d.people) return;
  const wanted = eligibleRehires(d, now);
  const wantedIds = new Set(wanted.map((r) => rehireCandidateId(r.officerId)));
  d.candidates = d.candidates.filter((c) => !isRehireCandidate(c) || c.shortlisted || wantedIds.has(c.id));
  for (const r of wanted) if (!d.candidates.some((c) => c.id === rehireCandidateId(r.officerId))) d.candidates.push(rehireCandidate(d, r, now));
}

/** Fill the pool up to `poolSize` (economy.ts candidatePoolSize) with deterministic candidates; shortlisted ones stay. */
export function fillCandidates(d: GameState, now: number, poolSize: number): void {
  const kept = d.candidates.filter((c) => c.shortlisted && gameDay(d, now) < mandatoryRetirementDay(c.officer));
  const keptNew = kept.filter((c) => !isRehireCandidate(c));
  const gen = marketGen(d, d.rngState, d.nextId);
  const fresh = generateBatch(gen, now, Math.max(0, poolSize - keptNew.length), keptNew.map((c) => c.officer.role), takenNames(d, kept), gameDay(d, now), CAREER_TUNING.retireAge, keptNew.map((c) => c.officer));
  d.candidates = [...kept, ...fresh];
  addRehireCandidates(d, now);
  d.rngState = gen.rng;
  d.nextId = gen.nextId;
  (d.department as DepartmentExt).candidateRefreshedAt = now;
}

/** Between searches the pool stays full: whoever is hired or leaves is replaced at the next
 * settlement. The draw has its own seed and its own ids, so it never moves the
 * shared rng or id counter that incidents and equipment draw on, and offline return still matches
 * online ticks. A search (refreshCandidates) still replaces everyone not shortlisted. */
export function topUpCandidates(d: GameState, now: number, poolSize: number): void {
  addRehireCandidates(d, now);
  const missing = poolSize - d.candidates.filter((c) => !isRehireCandidate(c)).length;
  if (missing <= 0 || !d.personnel) return;
  // Seeded by how many people the campaign has met, not the clock, so the same state draws the same people.
  const gen = marketGen(d, hashSeed(`${d.personnel.campaignSeed}:pool:${Object.keys(d.personnel.builds).length}`), 0);
  const fresh = generateBatch(gen, now, missing, d.candidates.map((c) => c.officer.role), takenNames(d, d.candidates), gameDay(d, now), CAREER_TUNING.retireAge, d.candidates.map((c) => c.officer));
  // Keyed by identity: one person is on offer at most once, and a hired person never returns.
  d.candidates.push(...fresh.map((c) => ({ ...c, id: `cand_${c.officer.identityId ?? c.id}` })));
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
  if (o.assignment?.kind === 'operation') return queueSquadMove(d, o, squadId);
  const from = o.squadId ? squadOf(d, o.squadId) : undefined;

  if (squadId === null) {
    if (!from) return refusal(`${fullName(o)} is not in a squad`);
    detachFromSquad(d, officerId);
    o.squadId = null;
    clearPendingMove(d, officerId);
    return OK;
  }
  const to = squadOf(d, squadId);
  if (!to) return refusal('No such squad');
  if (to.id === o.squadId) return refusal(`${fullName(o)} is already in ${to.name}`);
  if (to.officerIds.length >= ROSTER_TUNING.squadSize) return refusal(`${to.name} already has ${ROSTER_TUNING.squadSize} officers`);

  detachFromSquad(d, officerId);
  to.officerIds.push(officerId);
  if (!to.leaderId) to.leaderId = officerId;
  o.squadId = to.id;
  clearPendingMove(d, officerId);
  return OK;
}

/** Trade places in one step, so a full squad never needs an open place first: `officerId` takes
 * `withId`'s place in their squad, and their lead if they held it; `withId` takes `officerId`'s old
 * place and lead, or goes to Unassigned when `officerId` had no squad. */
export function swapCheck(state: GameState, officerId: Id, withId: Id): { ok: true; reason: null } | { ok: false; reason: string } {
  const a = state.officers[officerId], b = state.officers[withId];
  if (!a || !b) return { ok: false, reason: 'No such officer' };
  if (a.id === b.id) return { ok: false, reason: 'Choose a different officer' };
  const to = b.squadId ? state.squads.find((s) => s.id === b.squadId) : undefined;
  if (!to) return { ok: false, reason: `${fullName(b)} is not in a squad` };
  if (a.squadId === b.squadId) return { ok: false, reason: `${fullName(a)} and ${fullName(b)} are both in ${to.name}` };
  for (const o of [a, b]) if (o.assignment?.kind === 'operation') return { ok: false, reason: `${fullName(o)} is on a call. Swap them once it ends` };
  return { ok: true, reason: null };
}

function swapSquadMembers(d: GameState, officerId: Id, withId: Id): HandlerResult {
  const check = swapCheck(d, officerId, withId);
  if (!check.ok) return refusal(check.reason);
  const a = d.officers[officerId], b = d.officers[withId];
  const to = squadOf(d, b.squadId!)!;
  const from = a.squadId ? squadOf(d, a.squadId) : undefined;
  const takeSeat = (sq: Squad, out: Id, into: Id) => {
    sq.officerIds = sq.officerIds.map((id) => id === out ? into : id);
    if (sq.leaderId === out) sq.leaderId = into;
  };
  takeSeat(to, b.id, a.id);
  if (from) takeSeat(from, a.id, b.id);
  a.squadId = to.id;
  b.squadId = from?.id ?? null;
  clearPendingMove(d, a.id);
  clearPendingMove(d, b.id);
  return OK;
}

// An officer out on a call keeps their squad until it ends: the run's own records follow them there.
// Their move waits in the queue, one per officer, the latest choice replacing an earlier one.
function queueSquadMove(d: GameState, o: Officer, squadId: SquadId | null): HandlerResult {
  if (squadId !== null && !squadOf(d, squadId)) return refusal('No such squad');
  if (squadId === null && !o.squadId) return refusal(`${fullName(o)} is not in a squad`);
  clearPendingMove(d, o.id);
  // Choosing the squad they are already in withdraws the queued move.
  if (squadId === o.squadId) return OK;
  (d.pendingSquadMoves ??= []).push({ officerId: o.id, squadId, queuedAt: d.department.clockHighWater });
  return OK;
}

function clearPendingMove(d: GameState, officerId: Id): void {
  if (d.pendingSquadMoves?.some((m) => m.officerId === officerId)) d.pendingSquadMoves = d.pendingSquadMoves.filter((m) => m.officerId !== officerId);
}

function cancelPendingSquadMove(d: GameState, officerId: Id): HandlerResult {
  if (!d.pendingSquadMoves?.some((m) => m.officerId === officerId)) return refusal('No squad move is waiting for that officer');
  clearPendingMove(d, officerId);
  return OK;
}

/** Apply the queued moves of officers no longer on a call, in the order they were queued. A move
 * that no longer holds (the squad filled up, the officer left) stays with its reason. */
export function flushSquadMoves(d: GameState): void {
  if (!d.pendingSquadMoves?.length) return;
  const kept: PendingSquadMove[] = [];
  for (const move of d.pendingSquadMoves) {
    const o = d.officers[move.officerId];
    if (move.dropped) { kept.push(move); continue; }
    if (!o) { kept.push({ ...move, dropped: 'No longer with the department' }); continue; }
    if (o.assignment?.kind === 'operation') { kept.push(move); continue; }
    if (move.squadId === o.squadId) continue;
    const result = assignToSquad(d, o.id, move.squadId);
    if (!result.ok) kept.push({ ...move, dropped: result.reason });
  }
  d.pendingSquadMoves = kept;
}

function setLeader(d: GameState, squadId: SquadId, officerId: Id): HandlerResult {
  const sq = squadOf(d, squadId);
  if (!sq) return refusal('No such squad');
  if (!sq.officerIds.includes(officerId)) return refusal('The leader must be a member of the squad');
  sq.leaderId = officerId;
  return OK;
}

function setSquadDuty(d: GameState, squadId: SquadId, duty: SquadDuty): HandlerResult {
  const sq = squadOf(d, squadId);
  if (!sq) return refusal('No such squad');
  if (!DUTIES.includes(duty)) return refusal('Unknown duty');
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
  swapSquadMembers,
  cancelPendingSquadMove,
  setLeader,
  setSquadDuty,
  offerRetention,
};
