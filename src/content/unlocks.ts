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

/** The arc from scale plan §5. Levels are earned on live calls (sim/department-level.ts):
 * - Levels 1-2: ordinary calls on homes, then shops (an alarm, a medical call).
 * - Level 3: business calls and the first protective response.
 * - Levels 4-5, with certification or equipment: armed incidents and protected rescue at 4,
 *   hostage crises at 5.
 * Saves from before levels were earned are lifted to the level of every framework they had
 * already met or could already be sent to (save v7), so an update never takes a call away. */
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
  // The first protective response needs someone trained to talk a situation down.
  barricaded: { level: 3, anyCert: ['crisis_negotiation', 'deescalation'] },
  // Specialist calls.
  active_armed_incident: { level: 4, anyCert: ['entry_team', 'less_lethal'], anyItem: ['ballistic_shield', 'light_protection', 'rescue_shield'] },
  protected_rescue: { level: 4, anyCert: ['vehicle_operations'] },
  hostage_crisis: { level: 5, anyCert: ['crisis_negotiation'] },
};

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
export function unlockedTypes(state: UnlockState, types: readonly IncidentType[]): IncidentType[] {
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
    const rule = unlockRule(info.type);
    if (rule.level !== level) return [];
    const parts = [rule.anyCert?.length ? 'a certified officer' : '', rule.anyItem?.length ? 'the right equipment' : ''].filter(Boolean);
    const needs = parts.length ? ` (with ${parts.join(' and ')})` : '';
    return [`${info.label.toLowerCase()}${needs}`];
  });
}
