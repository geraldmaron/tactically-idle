import type { IncidentType } from '../sim/scenario-types';
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

/** Department level does not progress yet (every campaign is level 3), so no rule asks
 * for more than level 3: a higher level would hide a framework for good. Specialist
 * calls are gated by certification and equipment instead. When level progression lands,
 * raise the high-risk levels here (the scale plan proposes 4 to 5). */
export const UNLOCK_RULES: Partial<Record<IncidentType, UnlockRule>> = {
  // Ordinary calls on homes: from the first day.
  welfare_check: { level: 1 },
  missing_vulnerable: { level: 1 },
  person_in_crisis: { level: 1 },
  domestic: { level: 1 },
  disturbance: { level: 1 },
  false_intruder: { level: 1 },
  vacant_occupancy: { level: 1 },
  // Business settings.
  burglary: { level: 3 },
  business_robbery: { level: 3 },
  medical_complication: { level: 3 },
  // The first protective response needs someone trained to talk a situation down.
  barricaded: { level: 3, anyCert: ['crisis_negotiation', 'deescalation'] },
  // Specialist calls.
  active_armed_incident: { level: 3, anyCert: ['entry_team', 'less_lethal'], anyItem: ['ballistic_shield', 'light_protection', 'rescue_shield'] },
  hostage_crisis: { level: 3, anyCert: ['crisis_negotiation'] },
  protected_rescue: { level: 3, anyCert: ['vehicle_operations'] },
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
