import type { IncidentType } from '../sim/scenario-types';
import { SCENARIO_TYPES_V11 } from './scenario-types-v11';
import type { CertId, GameState, Id } from '../sim/types';

/** What a department needs before a framework is dispatched to it (content v11 and later).
 * Every listed part must hold: the department level, at least one officer holding any of
 * `anyCert`, and at least one owned unit of any of `anyItem`. A framework with no rule
 * here uses DEFAULT_UNLOCK. Requirements name capabilities, never the content of a call. */
export interface UnlockRule {
  level: number;
  anyCert?: readonly CertId[];
  anyItem?: readonly Id[];
}

/** New or unknown frameworks are ordinary calls until a drop gives them a rule. */
export const DEFAULT_UNLOCK: UnlockRule = { level: 1 };

/** Levels are earned on live calls (sim/department-level.ts). Since 2026-10-06 tactical calls
 * (barricade, armed incident, hostage crisis, protected rescue) open at level 1, gated only by the
 * capability they need; shops open at level 2 and business calls at level 3. Saves from before
 * levels were earned are lifted by the frozen v7 table in sim/save.ts, so this arc can change
 * without changing how an old save migrates. */
export const UNLOCK_RULES: Partial<Record<IncidentType, UnlockRule>> = {
  // Ordinary calls on homes: from the first day.
  welfare_check: { level: 1 },
  missing_vulnerable: { level: 1 },
  person_in_crisis: { level: 1 },
  domestic: { level: 1 },
  disturbance: { level: 1 },
  false_intruder: { level: 1 },
  vacant_occupancy: { level: 1 },
  // Shops and urgent help.
  burglary: { level: 2 },
  medical_complication: { level: 2 },
  // Business settings.
  business_robbery: { level: 3 },
  // Tactical calls are the reason the team exists, so they open from the first day (2026-10-06).
  // Capability gates stay: the starting roster holds negotiation and entry certs and a shield;
  // protected rescue still waits for a vehicle-trained officer.
  barricaded: { level: 1, anyCert: ['crisis_negotiation', 'deescalation'] },
  // The urgent response needs an entry-qualified officer with a response firearm, so the call waits for one.
  active_armed_incident: { level: 1, anyCert: ['entry_team', 'less_lethal'], anyItem: ['service_sidearm', 'compact_carbine', 'response_shotgun'] },
  protected_rescue: { level: 1, anyCert: ['vehicle_operations'] },
  hostage_crisis: { level: 1, anyCert: ['crisis_negotiation'] },
};

/** No longer dispatched as new live calls: a tactical team would never be sent to them. Their ids
 * stay valid everywhere else, so issued cards, saved runs, debriefs and casebook finds still load. */
export const RETIRED_FROM_DISPATCH: ReadonlySet<IncidentType> = new Set<IncidentType>(['water_leak', 'disturbance']);

export function unlockRule(type: IncidentType): UnlockRule {
  return UNLOCK_RULES[type] ?? DEFAULT_UNLOCK;
}

/** The parts of a rule a department does not meet yet; empty when the framework is unlocked. */
export interface MissingRequirement {
  level?: number;
  anyCert?: readonly CertId[];
  anyItem?: readonly Id[];
}

type UnlockState = Pick<GameState, 'department' | 'officers' | 'units'>;

export function missingRequirements(state: UnlockState, type: IncidentType): MissingRequirement {
  const rule = unlockRule(type);
  const missing: MissingRequirement = {};
  if (state.department.level < rule.level) missing.level = rule.level;
  if (rule.anyCert?.length) {
    const held = new Set(Object.values(state.officers ?? {}).flatMap((officer) => officer.certs ?? []));
    if (!rule.anyCert.some((cert) => held.has(cert))) missing.anyCert = rule.anyCert;
  }
  if (rule.anyItem?.length) {
    const owned = new Set(Object.values(state.units ?? {}).filter((unit) => unit.status !== 'scrapped' && unit.status !== 'expired').map((unit) => unit.itemId));
    if (!rule.anyItem.some((item) => owned.has(item))) missing.anyItem = rule.anyItem;
  }
  return missing;
}

export function isUnlocked(state: UnlockState, type: IncidentType): boolean {
  return Object.keys(missingRequirements(state, type)).length === 0;
}

/** Frameworks this department can be sent to, in catalog order. Never empty for a
 * non-empty catalog: a department that meets no rule (for example a hand-built level 0
 * state) still gets the frameworks with the easiest plain level rule. */
export function unlockedTypes(state: UnlockState, allTypes: readonly IncidentType[]): IncidentType[] {
  const types = allTypes.filter((type) => !RETIRED_FROM_DISPATCH.has(type));
  const open = types.filter((type) => isUnlocked(state, type));
  if (open.length || !types.length) return open;
  const plain = types.filter((type) => !unlockRule(type).anyCert?.length && !unlockRule(type).anyItem?.length);
  const pool = plain.length ? plain : [...types];
  const lowest = Math.min(...pool.map((type) => unlockRule(type).level));
  return pool.filter((type) => unlockRule(type).level === lowest);
}

/** Player-facing names of the frameworks that first become possible at exactly `level`,
 * with the capability each also needs. Names only, never call content. */
export function frameworksOpeningAt(level: number): string[] {
  return SCENARIO_TYPES_V11.flatMap((info) => {
    if (RETIRED_FROM_DISPATCH.has(info.type)) return [];
    const rule = unlockRule(info.type);
    if (rule.level !== level) return [];
    const parts = [rule.anyCert?.length ? 'a certified officer' : '', rule.anyItem?.length ? 'the right equipment' : ''].filter(Boolean);
    const needs = parts.length ? ` (with ${parts.join(' and ')})` : '';
    return [`${info.label.toLowerCase()}${needs}`];
  });
}
