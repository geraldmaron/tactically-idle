import { scenarioRecipe } from '../../../content/scenario-recipes';
import type { ScenarioCharacteristic } from '../../../content/scenario-recipes';
import type { IncidentSpec, IncidentType } from '../../../sim/scenario-types';
import { INCIDENT_CONTENT_VERSION } from '../index';
export const GATE_CONTENT_VERSION = INCIDENT_CONTENT_VERSION;

export const VARIANTS = [0, 1, 2] as const;
export type Variant = typeof VARIANTS[number];

/** A seed that presents this situation and pacing, found through the public draw (the
 * situation is keyed by the call seed alone from v10 on, so any building type works). */
/** `count`: the template's own number of situations, when it isn't the curated call's. */
export function specForSituation(type: IncidentType, familyId: string, variant: Variant, buildingSeed = 7, characteristic: ScenarioCharacteristic = 'ordinary', tier = 2, count?: number): IncidentSpec {
  for (let seed = 0; seed < 10000; seed++) {
    const spec = { type, familyId, buildingSeed, seed, tier, contentVersion: GATE_CONTENT_VERSION };
    const picked = scenarioRecipe(spec, count);
    if (picked.variant === variant && picked.characteristic === characteristic) return spec;
  }
  throw new Error(`No seed found for ${type}/${variant}/${characteristic}`);
}
