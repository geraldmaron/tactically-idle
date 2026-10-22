import type { IncidentType } from '../sim/scenario-types';
import { SCENARIO_TYPES } from './scenario-types';
import type { CertId, GameState, Id } from '../sim/types';

/** What a department needs before a framework is dispatched to it (content v11 and later), or
 * before a development is granted free (sim/grants.ts, save v12). Every listed part must hold:
 * the department level, at least one officer holding any of `anyCert`, at least one owned unit
 * of any of `anyItem`, `resolved` live calls closed resolved, and trust at `trust` or more. A
 * framework with no rule here uses DEFAULT_UNLOCK. Requirements name capabilities, never the
 * content of a call. */
export interface UnlockRule {
  level: number;
  anyCert?: readonly CertId[];
  anyItem?: readonly Id[];
  resolved?: number;
  trust?: number;
}

/** New or unknown frameworks are ordinary calls until a drop gives them a rule. */
export const DEFAULT_UNLOCK: UnlockRule = { level: 1 };

/** Tactical calls open at level 1 when their required capability is available. */
const UNLOCK_RULES: Partial<Record<IncidentType, UnlockRule>> = {
  // Tactical calls are the reason the team exists, so they open from the first day (2026-10-06).
  // Capability gates stay: the starting roster holds negotiation and entry certs and a shield;
  // protected rescue still waits for a vehicle-trained officer.
  barricaded: { level: 1, anyCert: ['crisis_negotiation', 'deescalation'] },
  // The urgent response needs an entry-qualified officer with a response firearm, so the call waits for one.
  // Every officer is armed (sim/basic-kit.ts), so only the training gates the call.
  active_armed_incident: { level: 1, anyCert: ['entry_team', 'less_lethal'] },
  protected_rescue: { level: 1, anyCert: ['vehicle_operations'] },
  hostage_crisis: { level: 1, anyCert: ['crisis_negotiation'] },
};

/** A tactical team is sent only where the call earns it: a person armed or able to reach a
 * weapon, a stated threat or crime, a position of advantage, and a refusal to come out. Since
 * 2026-10-07 only these frameworks are dispatched; every patrol, welfare and medical framework is
 * retired from the board. Other incident types are unsupported. */
export const TACTICAL_FRAMEWORKS: ReadonlySet<IncidentType> = new Set<IncidentType>(['barricaded', 'active_armed_incident', 'hostage_crisis', 'protected_rescue']);

export function unlockRule(type: IncidentType): UnlockRule {
  return UNLOCK_RULES[type] ?? DEFAULT_UNLOCK;
}

/** The parts of a rule a department does not meet yet; empty when the framework is unlocked. */
export interface MissingRequirement {
  level?: number;
  anyCert?: readonly CertId[];
  anyItem?: readonly Id[];
  resolved?: number;
  trust?: number;
}

type UnlockState = Pick<GameState, 'department' | 'officers' | 'units'>;

export function missingRequirements(state: UnlockState, type: IncidentType): MissingRequirement {
  return missingFor(state, unlockRule(type));
}

/** The parts of any rule a department does not meet yet; empty when it holds. */
export function missingFor(state: UnlockState, rule: UnlockRule): MissingRequirement {
  const missing: MissingRequirement = {};
  if (state.department.level < rule.level) missing.level = rule.level;
  if (rule.resolved !== undefined && (state.department.callsResolved ?? 0) < rule.resolved) missing.resolved = rule.resolved;
  if (rule.trust !== undefined && state.department.trust < rule.trust) missing.trust = rule.trust;
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
  const types = allTypes.filter((type) => TACTICAL_FRAMEWORKS.has(type));
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
  return SCENARIO_TYPES.flatMap((info) => {
    const rule = unlockRule(info.type);
    if (rule.level !== level) return [];
    const parts = [rule.anyCert?.length ? 'a certified officer' : '', rule.anyItem?.length ? 'the right equipment' : ''].filter(Boolean);
    const needs = parts.length ? ` (with ${parts.join(' and ')})` : '';
    return [`${info.label.toLowerCase()}${needs}`];
  });
}
