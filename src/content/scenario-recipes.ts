import type { IncidentSpec, IncidentType } from '../sim/scenario-types';
import { CALL_TREE_CONTENT_VERSION, CALL_TREES } from './call-trees';
import { hashSeed } from '../sim/rng';

export type ScenarioCharacteristic = 'ordinary' | 'deliberate_answers';
export interface ScenarioRecipe {
  id: string;
  type: IncidentType;
  familyId: string;
  variant: 0 | 1 | 2;
  characteristic: ScenarioCharacteristic;
}
function recipe(type: IncidentType, familyId: string, variant: 0 | 1 | 2, characteristic: ScenarioCharacteristic): ScenarioRecipe {
  return { id: `${type}/${familyId}/${variant}/${characteristic}`, type, familyId, variant, characteristic };
}
export type ScenarioSituation = Pick<ScenarioRecipe, 'variant' | 'characteristic'>;
export function scenarioSituations(type: IncidentType): ScenarioSituation[] {
  const tree = CALL_TREES[type];
  if (!tree) return [];
  return ([0, 1, 2] as const).filter(variant => variant < tree.situations.length).flatMap(variant => (['deliberate_answers', 'ordinary'] as const).map(characteristic => ({ variant, characteristic })));
}
/** Situation and pacing depend on the call seed, independently of building hosting. */
export function scenarioRecipe(spec: IncidentSpec): ScenarioRecipe {
  const situations = scenarioSituations(spec.type);
  if (!situations.length) throw new Error(`No recipe for ${spec.type}`);
  const picked = situations[hashSeed(`${spec.seed}:recipe-v10`) % situations.length];
  return recipe(spec.type, spec.familyId, picked.variant, picked.characteristic);
}
export function specForSituation(type: IncidentType, familyId: string, situation: ScenarioSituation, buildingSeed = 7, tier = 2): IncidentSpec {
  for (let seed = 0; seed < 10000; seed++) {
    const spec = { type, familyId, buildingSeed, seed, tier, contentVersion: CALL_TREE_CONTENT_VERSION };
    const picked = scenarioRecipe(spec);
    if (picked.variant === situation.variant && picked.characteristic === situation.characteristic) return spec;
  }
  throw new Error(`No seed found for ${type}/${familyId}/${situation.variant}/${situation.characteristic}`);
}
