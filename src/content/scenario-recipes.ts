import type { IncidentSpec, IncidentType } from '../sim/scenario-types';
import { hashSeed } from '../sim/rng';

export type ScenarioCharacteristic = 'ordinary' | 'deliberate_answers';
export interface ScenarioRecipe {
  id: string;
  type: IncidentType;
  familyId: string;
  variant: 0 | 1 | 2;
  characteristic: ScenarioCharacteristic;
}
/** This v9 manifest is frozen. New recipes ship under the next content version,
 * preserving the ordered candidate lists used by already-issued seed tuples.
 * A recipe combines a reviewed situation, a real layout and a causal constraint.
 * Cast/seed changes alone do not add a recipe to this count.
 */
const HOMES = ['cedar_close', 'harbour_court', 'willow_terrace_v1', 'ash_grove_v1', 'juniper_court_v1'];
export const SCENARIO_TYPES_V9: { type: IncidentType; label: string; families: string[]; squads: [number, number]; count: number }[] = [
  { type: 'welfare_check', label: 'Conflicting reports', families: HOMES, squads: [1, 2], count: 10 },
  { type: 'barricaded', label: 'Protective response', families: HOMES, squads: [1, 3], count: 10 },
  { type: 'medical_complication', label: 'Medical assistance', families: ['market_row'], squads: [1, 2], count: 6 },
  { type: 'active_armed_incident', label: 'Active armed incident', families: ['market_row'], squads: [1, 3], count: 6 },
  { type: 'hostage_crisis', label: 'Hostage crisis', families: ['market_row'], squads: [1, 3], count: 6 },
  { type: 'protected_rescue', label: 'Protected rescue', families: ['juniper_court_v1', 'willow_terrace_v1', 'harbour_court'], squads: [1, 3], count: 10 },
  { type: 'missing_vulnerable', label: 'Missing-person search', families: HOMES, squads: [1, 2], count: 7 },
  { type: 'person_in_crisis', label: 'Voluntary crisis support', families: HOMES, squads: [1, 2], count: 7 },
  { type: 'domestic', label: 'Household separation', families: HOMES, squads: [1, 2], count: 7 },
  { type: 'disturbance', label: 'Neighbor mediation', families: HOMES, squads: [1, 2], count: 7 },
  { type: 'burglary', label: 'Alarm and keyholder response', families: ['market_row'], squads: [1, 2], count: 6 },
  { type: 'false_intruder', label: 'Mistaken-intruder report', families: HOMES, squads: [1, 2], count: 6 },
  { type: 'vacant_occupancy', label: 'Occupancy dispute', families: HOMES, squads: [1, 2], count: 6 },
  { type: 'business_robbery', label: 'Robbery witness reconciliation', families: ['market_row'], squads: [1, 2], count: 6 },
];
function recipe(type: IncidentType, familyId: string, variant: 0 | 1 | 2, characteristic: ScenarioCharacteristic): ScenarioRecipe {
  return { id: `${type}/${familyId}/${variant}/${characteristic}`, type, familyId, variant, characteristic };
}
/** Balanced coverage of every family, situation and supported characteristic.
 * No random seed or name is counted as a new recipe. */
export const SCENARIO_RECIPES_V9: readonly ScenarioRecipe[] = SCENARIO_TYPES_V9.flatMap(info => {
  const pool = info.families.flatMap(family => ([0, 1, 2] as const).flatMap(variant =>
    (['ordinary', 'deliberate_answers'] as const).map(characteristic => recipe(info.type, family, variant, characteristic))));
  const chosen: ScenarioRecipe[] = [];
  const count = (key: 'familyId' | 'variant' | 'characteristic', value: string | number) => chosen.filter(recipe => recipe[key] === value).length;
  while (chosen.length < info.count) {
    const score = (r: ScenarioRecipe) => count('familyId', r.familyId) * 5 + count('variant', r.variant) * 3 + count('characteristic', r.characteristic);
    pool.sort((a, b) => score(a) - score(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const next = pool.shift(); if (!next) throw new Error(`Insufficient recipes for ${info.type}`);
    chosen.push(next);
  }
  return chosen;
});
export function scenarioRecipe(spec: IncidentSpec): ScenarioRecipe {
  if (spec.contentVersion >= 10) {
    // v10 decouples the situation from the building: any reviewed situation and
    // pacing of this framework can occur in whichever building the call was drawn to.
    const situations = SCENARIO_RECIPES_V9.filter(recipe => recipe.type === spec.type)
      .filter((recipe, index, all) => all.findIndex(other => other.variant === recipe.variant && other.characteristic === recipe.characteristic) === index)
      .sort((a, b) => a.variant - b.variant || (a.characteristic < b.characteristic ? -1 : 1));
    if (!situations.length) throw new Error(`No recipe for ${spec.type}`);
    const picked = situations[hashSeed(`${spec.seed}:${spec.buildingSeed}:recipe-v10`) % situations.length];
    return recipe(spec.type, spec.familyId, picked.variant, picked.characteristic);
  }
  const candidates = SCENARIO_RECIPES_V9.filter(recipe => recipe.type === spec.type && recipe.familyId === spec.familyId);
  if (!candidates.length) throw new Error(`No recipe for ${spec.type}/${spec.familyId}`);
  return candidates[hashSeed(`${spec.seed}:${spec.buildingSeed}:recipe-v9`) % candidates.length];
}
/** Stable authoring/QA entry point through the same public seeded generator. */
export function specForRecipe(recipe: ScenarioRecipe, buildingSeed = 7, tier = 2): IncidentSpec {
  for (let seed = 0; seed < 10000; seed++) {
    const spec = { type: recipe.type, familyId: recipe.familyId, buildingSeed, seed, tier, contentVersion: 9 };
    if (scenarioRecipe(spec).id === recipe.id) return spec;
  }
  throw new Error(`No seed found for recipe ${recipe.id}`);
}
