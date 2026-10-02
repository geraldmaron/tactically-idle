import type { GameState, SaveEnvelope } from './types';
import { SQUAD_IDS as SQUAD_ID_LIST } from './types';
import { CAREER_SEEDS } from '../content/officers';
import { ITEMS } from '../content/items';
import { createUnit } from './equipment';
import { seedIncidentBoard } from './incidents';
import { hashSeed } from './rng';
import { initializePersonnel } from './personnel';

export const SAVE_KEY = 'tactically-idle/save';

/** Version written by this build. Older versions pass through migrate(). */
export const CURRENT_SAVE_VERSION = 4;

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

const SQUAD_IDS: readonly string[] = SQUAD_ID_LIST;
const RATING_KEYS = ['shooting', 'composure', 'communication', 'awareness', 'medical', 'coordination'];
const DUTIES = ['patrol', 'standby', 'rest'];
const UNIT_STATUSES = ['ready', 'reserved', 'service', 'expired', 'scrapped'];
const RETIREMENT_REASONS = ['age', 'service', 'burnout'];

/** Fields every version has. `v2` adds the career fields introduced in version 2. */
function validOfficer(o: unknown, key: string, v2: boolean): boolean {
  if (!isObj(o)) return false;
  if (o.identityId !== undefined && !isStr(o.identityId)) return false;
  if (o.id !== key || !isStr(o.firstName) || !isStr(o.surname) || !isStr(o.role) || !isStr(o.portrait)) return false;
  if (!isObj(o.ratings) || !RATING_KEYS.every((k) => isNum((o.ratings as Record<string, unknown>)[k]))) return false;
  if (!Array.isArray(o.certs) || !Array.isArray(o.traits)) return false;
  if (!isNum(o.wage) || !isNum(o.xp) || !isNum(o.stress) || !isNum(o.hiredAt)) return false;
  if (o.injury !== null && !(isObj(o.injury) && isStr(o.injury.label) && isNum(o.injury.until))) return false;
  if (o.squadId !== null && !(isStr(o.squadId) && SQUAD_IDS.includes(o.squadId))) return false;
  if (o.assignment !== null) {
    const a = o.assignment;
    const training = isObj(a) && a.kind === 'training' && isStr(a.courseId) && isNum(a.startedAt) && isNum(a.endsAt);
    const op = isObj(a) && a.kind === 'operation' && isStr(a.runId);
    if (!training && !op) return false;
  }
  if (!v2) return true;
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
  if (u.id !== key || !isStr(u.itemId) || !isStr(u.serial)) return false;
  if (!['condition', 'acquiredAt', 'uses', 'wearRate', 'lastWearAt'].every((f) => isNum(u[f]))) return false;
  if (!isStr(u.status) || !UNIT_STATUSES.includes(u.status)) return false;
  if (u.serviceUntil !== null && !isNum(u.serviceUntil)) return false;
  if (u.expiresAt !== null && !isNum(u.expiresAt)) return false;
  return true;
}

/** Structural checks shared by every version. */
function validBase(s: unknown, v2: boolean): s is Record<string, unknown> {
  if (!isObj(s)) return false;
  const dep = s.department;
  if (!isObj(dep)) return false;
  const depNums = ['funding', 'devPoints', 'trust', 'level', 'rosterCap', 'trainingSlots', 'lastSettledAt', 'lastInteractionAt', 'clockHighWater'];
  if (!isStr(dep.name) || !depNums.every((k) => isNum(dep[k]))) return false;
  if (v2 && !isNum(dep.calendarEpoch)) return false;
  if (!Array.isArray(dep.unlockedNodes) || !Array.isArray(dep.restockRules)) return false;
  if (!isObj(s.officers)) return false;
  const officers = s.officers as Record<string, unknown>;
  if (!Object.entries(officers).every(([k, o]) => validOfficer(o, k, v2))) return false;
  if (!Array.isArray(s.squads)) return false;
  const seen = new Set<string>();
  for (const sq of s.squads as unknown[]) {
    if (!isObj(sq) || !isStr(sq.id) || !SQUAD_IDS.includes(sq.id) || seen.has(sq.id)) return false;
    seen.add(sq.id);
    if (!isStr(sq.name) || !DUTIES.includes(sq.duty as string) || !isObj(sq.loadoutPreset)) return false;
    if (!Array.isArray(sq.officerIds) || !sq.officerIds.every((id) => isStr(id) && id in officers)) return false;
    if (sq.leaderId !== null && !(isStr(sq.leaderId) && sq.officerIds.includes(sq.leaderId))) return false;
  }
  if (!Array.isArray(s.candidates)) return false;
  for (const c of s.candidates as unknown[]) {
    if (!isObj(c) || !isStr(c.id) || !isNum(c.signingCost) || !isNum(c.expiresAt) || typeof c.shortlisted !== 'boolean') return false;
    if (!validOfficer(c.officer, (c.officer as { id?: string } | null)?.id ?? '', v2)) return false;
  }
  if (!Array.isArray(s.reservations) || !Array.isArray(s.debriefs)) return false;
  if (s.activeRun !== null && !isObj(s.activeRun)) return false;
  if (s.report !== null && !isObj(s.report)) return false;
  return isNum(s.nextId) && isNum(s.rngState) && isNum(s.saveVersion) && isNum(s.contentVersion);
}

/** Version 1: items were stacks with owned / reserved / maintenance counts. */
function validV1(s: unknown): boolean {
  if (!validBase(s, false)) return false;
  if (!isObj(s.inventory)) return false;
  for (const [k, st] of Object.entries(s.inventory as Record<string, unknown>)) {
    if (!isObj(st) || st.itemId !== k) return false;
    if (!['owned', 'reserved', 'maintenance', 'uses'].every((f) => isNum(st[f]))) return false;
    if (st.maintenanceUntil !== null && !isNum(st.maintenanceUntil)) return false;
  }
  return true;
}

/** Version 3: the incident board and its optional arrival schedule. */
function validIncidents(s: Record<string, unknown>): boolean {
  if (!Array.isArray(s.incidents)) return false;
  const ids = new Set<string>();
  for (const c of s.incidents as unknown[]) {
    if (!isObj(c) || !isStr(c.id) || !isStr(c.type) || !isStr(c.familyId) || ids.has(c.id)) return false;
    ids.add(c.id);
    if (!isNum(c.tier) || !isNum(c.arrivedAt) || !isNum(c.expiresAt) || typeof c.seen !== 'boolean') return false;
  }
  const dep = s.department as Record<string, unknown>;
  return dep.nextIncidentAt === undefined || isNum(dep.nextIncidentAt);
}

/** Basic structural validation: enough that the UI and sim cannot crash on a loaded state. */
function validState(s: unknown): s is GameState {
  if (!validBase(s, true)) return false;
  if (!validIncidents(s)) return false;
  const people = s.personnel;
  if (!isObj(people) || !isNum(people.campaignSeed) || !Number.isInteger(people.campaignSeed) || people.campaignSeed < 0 || people.campaignSeed > 0xffffffff || !isNum(people.catalogVersion)) return false;
  if (!Array.isArray(people.employedIdentityIds) || !people.employedIdentityIds.every(isStr) || new Set(people.employedIdentityIds).size !== people.employedIdentityIds.length || !isObj(people.builds)) return false;
  for (const [identityId, officer] of Object.entries(people.builds)) {
    if (!isObj(officer) || officer.identityId !== identityId || !isStr(officer.id) || !validOfficer(officer, officer.id, true)) return false;
  }
  const activePeople = [...Object.values(s.officers as Record<string, { identityId?: string }>), ...(s.candidates as { officer: { identityId?: string } }[]).map((c) => c.officer)].map((o) => o.identityId).filter(Boolean);
  if (new Set(activePeople).size !== activePeople.length) return false;
  if (!isObj(s.units)) return false;
  const units = s.units as Record<string, unknown>;
  if (!Object.entries(units).every(([k, u]) => validUnit(u, k))) return false;
  for (const r of s.reservations as unknown[]) {
    if (!isObj(r) || !isStr(r.id) || !isStr(r.runId) || !isStr(r.itemId) || !isStr(r.unitId) || !isStr(r.squadId)) return false;
    if (!(r.unitId in units)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- v1 -> v2

/** Hash-based but stable career defaults for an officer the seed table does not know. */
function defaultCareer(id: string, hiredAt: number): { age: number; service: number; operations: number } {
  const h = hashSeed(`${id}:${hiredAt}`);
  const age = 24 + (h % 20);
  const service = Math.max(0.5, Math.min(age - 22, 1 + ((h >>> 8) % 12)));
  return { age, service, operations: Math.floor(service * 4) };
}

function migrateOfficer(o: Record<string, unknown>): void {
  const seed = CAREER_SEEDS[o.id as string] ?? defaultCareer(o.id as string, o.hiredAt as number);
  // The migrated calendar starts now (day 0), so birth and service dates are negative year counts.
  o.bornDay = -Math.round(seed.age * 365);
  o.serviceStartDay = -Math.round(seed.service * 365);
  o.career = { operations: seed.operations, favorable: Math.round(seed.operations * 0.55), adverse: Math.round(seed.operations * 0.12) };
  o.retirement = null;
  o.xpBanked = o.xp; // existing xp predates xp-to-rating growth; nobody gets a retroactive jump
}

/**
 * v1 -> v2. Stacks become individual units (deterministic wear rates and modest
 * age-based condition), the calendar starts now, officers gain career fields.
 * An in-flight operation is dropped: its reservations and officer assignments are
 * released and the units return ready, because a v1 run lacks the spatial records
 * the v2 engine resolves against.
 */
function migrateV1toV2(env: SaveEnvelope): SaveEnvelope {
  const raw = structuredClone(env.state) as unknown as Record<string, unknown> & {
    inventory: Record<string, { itemId: string; owned: number; reserved: number; maintenance: number; uses: number; maintenanceUntil: number | null }>;
  };
  const dep = raw.department as unknown as Record<string, unknown>;
  const now = dep.clockHighWater as number;
  dep.calendarEpoch = now;

  const draft = raw as unknown as GameState & { inventory?: unknown };
  draft.units = {};
  let index = 0;
  for (const stack of Object.values(raw.inventory)) {
    const def = ITEMS[stack.itemId];
    if (!def) continue;
    const owned = Math.max(0, Math.floor(stack.owned));
    for (let i = 0; i < owned; i++, index++) {
      const ageDays = 20 + (index % 6) * 14;
      const uses = Math.floor(stack.uses / Math.max(1, owned)) + (i < stack.uses % Math.max(1, owned) ? 1 : 0);
      const unit = createUnit(draft, stack.itemId, now, { ageDays, uses });
      if (def.kind === 'equipment') unit.condition = Math.max(30, Math.round((unit.condition - def.wear.perUse * unit.wearRate * uses) * 100) / 100);
      // Units that were in maintenance carry on with that servicing.
      if (i >= owned - Math.max(0, Math.floor(stack.maintenance)) && def.kind === 'equipment') {
        unit.status = 'service';
        unit.serviceUntil = stack.maintenanceUntil ?? now + def.wear.serviceHours * 3_600_000;
      }
    }
  }
  delete draft.inventory;

  if (draft.activeRun || draft.reservations.length > 0) {
    for (const o of Object.values(draft.officers)) {
      if (o.assignment?.kind === 'operation') o.assignment = null;
    }
    draft.reservations = [];
    draft.activeRun = null;
  }

  for (const o of Object.values(draft.officers)) migrateOfficer(o as unknown as Record<string, unknown>);
  for (const c of draft.candidates) migrateOfficer(c.officer as unknown as Record<string, unknown>);
  for (const db of draft.debriefs) {
    const x = db as unknown as Record<string, unknown>;
    if (!Array.isArray(x.unitWear)) x.unitWear = [];
  }
  if (draft.report) {
    const r = draft.report as unknown as Record<string, unknown>;
    if (!Array.isArray(r.equipment)) r.equipment = [];
    if (!Array.isArray(r.personnel)) r.personnel = [];
  }
  draft.saveVersion = 2;
  return { ...env, saveVersion: 2, state: draft };
}

// ---------------------------------------------------------------- v2 -> v3

/**
 * v2 -> v3. Squad 'D' becomes valid (nothing to convert) and the department gains an
 * incident board: three cards arriving at the save time, drawn deterministically from
 * the save's rngState mixed with savedAt, plus the arrival schedule. Settlement then
 * carries on from the save time, expiring and arriving cards for the time away.
 */
function migrateV2toV3(env: SaveEnvelope): SaveEnvelope {
  const draft = structuredClone(env.state) as GameState;
  const at = Number.isFinite(env.savedAt) ? env.savedAt : draft.department.clockHighWater;
  draft.rngState = ((draft.rngState >>> 0) ^ hashSeed(`incidents:${at}`)) >>> 0;
  seedIncidentBoard(draft, at);
  draft.saveVersion = 3;
  return { ...env, saveVersion: 3, state: draft };
}

/**
 * Bring an older envelope up to CURRENT_SAVE_VERSION, one version at a time.
 * Returns null for unknown (newer) versions and for input it cannot convert.
 * Callers that load from storage should validate the result (deserialize does).
 */
export function migrate(envelope: SaveEnvelope): SaveEnvelope | null {
  let env = envelope;
  if (!Number.isInteger(env.saveVersion) || env.saveVersion < 1 || env.saveVersion > CURRENT_SAVE_VERSION) return null;
  try {
    while (env.saveVersion < CURRENT_SAVE_VERSION) {
      switch (env.saveVersion) {
        case 1:
          env = migrateV1toV2(env);
          break;
        case 2:
          env = migrateV2toV3(env);
          break;
        case 3: {
          const state = structuredClone(env.state);
          initializePersonnel(state);
          state.saveVersion = 4;
          env = { ...env, saveVersion: 4, state };
          break;
        }
        default:
          return null;
      }
    }
  } catch {
    return null;
  }
  env = { ...env, state: { ...env.state, saveVersion: env.saveVersion } };
  return env;
}

export function deserialize(text: string): GameState | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw) || !isNum(raw.saveVersion) || !isNum(raw.contentVersion) || !isNum(raw.savedAt) || !isObj(raw.state)) return null;
  // Older versions are checked against their own shape before they are migrated.
  if (raw.saveVersion === 1 && !validV1(raw.state)) return null;
  const migrated = migrate(raw as unknown as SaveEnvelope);
  if (!migrated || !validState(migrated.state)) return null;
  return migrated.state;
}

export function saveGame(state: GameState, now: number, storage: SaveStorage = localStorage): void {
  storage.setItem(SAVE_KEY, serialize(state, now));
}

export function loadGame(storage: SaveStorage = localStorage): GameState | null {
  const text = storage.getItem(SAVE_KEY);
  return text ? deserialize(text) : null;
}
