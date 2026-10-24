// Relational validation of a saved WorldState (the lead wires it into save.ts). A save is rejected, never
// repaired, so every check here is a property the rules above keep true.
import { ARCHETYPES } from '../../content/city/archetypes';
import { EVENT_CAP, SHIFT } from '../../content/city/tuning';
import { DISTRICT_IDS } from './types';
import type { WorldState } from './types';

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const TIERS = [1, 2, 3, 4];
const SQUADS = ['A', 'B', 'C', 'D'];
const MAX_AWARD = 8000 * 1.6 * 3;

/** `at` is the department's clock; nothing in a save may be dated after it by more than the clocks it holds. */
export function validWorldState(value: unknown, at: number): value is WorldState {
  if (!obj(value)) return false;
  const w = value as unknown as WorldState;
  if (!finite(w.seed) || !finite(w.rolledThroughHour) || !Number.isSafeInteger(w.nextId) || w.nextId < 1) return false;
  if (!Array.isArray(w.crews) || !Array.isArray(w.cases) || !Array.isArray(w.leads) || !Array.isArray(w.shifts) || !Array.isArray(w.events) || !obj(w.subjects) || !obj(w.districts)) return false;

  // Ids: one namespaced counter, every id below it, none repeated.
  const seen = new Set<string>();
  const idOk = (id: unknown, prefix: string): id is string => {
    if (typeof id !== 'string' || !new RegExp(`^${prefix}[1-9]\\d*$`).test(id) || Number(id.slice(1)) >= w.nextId || seen.has(id)) return false;
    seen.add(id);
    return true;
  };

  for (const id of DISTRICT_IDS) {
    const state = w.districts[id];
    if (!obj(state) || state.id !== id || typeof state.open !== 'boolean' || !finite(state.crime) || state.crime < 0 || state.crime > 100 || !Number.isInteger(state.patrolUnits) || state.patrolUnits < 0) return false;
    if (state.open ? !finite(state.openedAt) : state.openedAt !== null) return false;
  }
  if (!w.districts.pike.open) return false;

  const crews = new Map<string, WorldState['crews'][number]>();
  for (const crew of w.crews) {
    if (!obj(crew) || !idOk(crew.id, 'k') || !(crew.archetype in ARCHETYPES) || typeof crew.name !== 'string' || !crew.name || !DISTRICT_IDS.includes(crew.districtId)) return false;
    if (!finite(crew.strength) || crew.strength < 0 || crew.strength > 100 || !finite(crew.formedAt) || !obj(crew.intel)) return false;
    if (crew.status !== 'active' && crew.status !== 'collapsed') return false;
    if ((crew.status === 'collapsed') !== (crew.collapsedAt !== undefined)) return false;
    const need = ARCHETYPES[crew.archetype].intelNeeded;
    for (const [sid, n] of Object.entries(crew.intel)) if (!finite(n) || n < 0 || n > Math.max(need[3], need[4]) || !w.subjects[sid]) return false;
    crews.set(crew.id, crew);
  }

  for (const [key, s] of Object.entries(w.subjects)) {
    if (!obj(s) || s.id !== key || !idOk(s.id, 's') || typeof s.firstName !== 'string' || typeof s.surname !== 'string' || !s.firstName || !s.surname) return false;
    if (!['she', 'he', 'they'].includes(s.pronouns) || !obj(s.nameKey) || !Number.isInteger(s.nameKey.first) || !Number.isInteger(s.nameKey.last)) return false;
    if (!TIERS.includes(s.tier) || !DISTRICT_IDS.includes(s.districtId) || !['free', 'held', 'resolved', 'gone'].includes(s.status)) return false;
    if (s.crewId !== null && !crews.has(s.crewId)) return false;
    if (!Array.isArray(s.traits) || !Array.isArray(s.history) || typeof s.known !== 'boolean') return false;
    if (s.reservedBy !== null && typeof s.reservedBy !== 'string') return false;
    if (s.backAt !== undefined && !finite(s.backAt)) return false;
    if (s.status === 'held' && s.reservedBy === null) return false;
  }

  const cases = new Map<string, WorldState['cases'][number]>();
  const paid = new Set<string>();
  for (const c of w.cases) {
    if (!obj(c) || !idOk(c.id, 'c') || !w.subjects[c.subjectId] || !TIERS.includes(c.tier) || !DISTRICT_IDS.includes(c.districtId)) return false;
    if (c.crewId !== null && !crews.has(c.crewId)) return false;
    if (!['patrol', 'proactive', 'call', 'warrant'].includes(c.source) || !['charged', 'diverted', 'care', 'released', 'cleared'].includes(c.resolution)) return false;
    if (!finite(c.openedAt) || c.openedAt > at + 1 || !finite(c.award) || c.award < 0 || c.award > MAX_AWARD || typeof c.repeat !== 'boolean' || !Array.isArray(c.officerIds)) return false;
    if (c.status === 'open' && (c.closesAt !== null || c.paidEventId !== undefined || c.tier < 3)) return false;
    if (c.status === 'review' && (!finite(c.closesAt) || c.closesAt < c.openedAt || c.paidEventId !== undefined)) return false;
    if (c.status === 'closed') {
      if (!finite(c.closesAt) || typeof c.paidEventId !== 'string' || !finite(c.paidAt) || paid.has(c.paidEventId)) return false;
      paid.add(c.paidEventId);
    } else if (c.paidEventId !== undefined || c.paidAt !== undefined) return false;
    if (!['open', 'review', 'closed'].includes(c.status)) return false;
    cases.set(c.id, c);
  }
  // A person is in at most one unclosed investigation, and holds its reservation.
  const unclosed = new Set<string>();
  for (const c of w.cases) {
    if (c.status === 'closed') continue;
    if (unclosed.has(c.subjectId) || w.subjects[c.subjectId].reservedBy !== c.id) return false;
    unclosed.add(c.subjectId);
  }
  for (const s of Object.values(w.subjects)) if (s.reservedBy !== null && cases.get(s.reservedBy)?.status === undefined) return false;

  const caseLeads = new Set<string>();
  for (const l of w.leads) {
    if (!obj(l) || !idOk(l.id, 'l')) return false;
    const c = cases.get(l.caseId);
    if (!c || c.subjectId !== l.subjectId || !finite(l.foundAt) || !TIERS.includes(l.tier) || !DISTRICT_IDS.includes(l.districtId)) return false;
    if (!['sighting', 'proactive', 'intel', 'armed_contact'].includes(l.source) || !['open', 'warrant', 'served'].includes(l.status)) return false;
    if (l.status === 'warrant' && typeof l.cardId !== 'string') return false;
    if (l.status !== 'warrant' && l.cardId !== undefined) return false;
    if (l.liveUntil !== undefined && (l.source !== 'armed_contact' || !finite(l.liveUntil))) return false;
    if (l.status !== 'served') {
      if (caseLeads.has(l.caseId) || c.status !== 'open') return false;
      caseLeads.add(l.caseId);
    }
  }

  const activeSquads = new Set<string>();
  for (const s of w.shifts) {
    if (!obj(s) || !idOk(s.id, 'p') || !SQUADS.includes(s.squadId) || !DISTRICT_IDS.includes(s.districtId) || !w.districts[s.districtId].open) return false;
    if (!finite(s.startedAt) || !finite(s.endsAt) || s.endsAt <= s.startedAt || !SHIFT.hours.includes((s.endsAt - s.startedAt) / 3_600_000)) return false;
    if (!Number.isInteger(s.contacts) || s.contacts < 0 || !Array.isArray(s.caseIds) || !Array.isArray(s.leadIds)) return false;
    if (s.caseIds.some((id) => !cases.has(id)) || s.leadIds.some((id) => !w.leads.some((l) => l.id === id))) return false;
    if ((s.stoppedAt === undefined) !== (s.stopReason === undefined)) return false;
    if (s.stoppedAt === undefined) {
      if (activeSquads.has(s.squadId)) return false;
      activeSquads.add(s.squadId);
    } else if (!finite(s.stoppedAt) || s.stoppedAt < s.startedAt || s.stoppedAt > s.endsAt || !['ended', 'recalled', 'strain'].includes(s.stopReason!)) return false;
  }

  if (w.events.length > EVENT_CAP) return false;
  for (const e of w.events) {
    if (!obj(e) || !idOk(e.id, 'e') || !finite(e.at) || typeof e.kind !== 'string') return false;
  }
  // An event id that paid a case can have left the capped log, but a paid id must still be a real id.
  for (const id of paid) if (!/^e[1-9]\d*$/.test(id) || Number(id.slice(1)) >= w.nextId) return false;

  const o = w.onboarding;
  if (!obj(o) || !['cold_open', 'founding', 'first_shift', 'first_return', 'done'].includes(o.stage)) return false;
  if (o.firstCaseId !== undefined && !cases.has(o.firstCaseId)) return false;
  if (o.stage === 'first_shift' && (!o.firstCaseId || cases.get(o.firstCaseId)!.status === 'closed')) return false;
  if ((o.stage === 'cold_open' || o.stage === 'founding') && (w.shifts.length || w.leads.length)) return false;
  return true;
}
