import { ADDITIONAL_FRAMEWORKS } from '../../../content/incident-frameworks-v9';
import type { IncidentFramework } from '../../../content/incident-frameworks-v9';
import { frameworkAt } from '../../../content/framework-depth-v12';
import { scenarioRecipe } from '../../../content/scenario-recipes';
import type { ScenarioCharacteristic } from '../../../content/scenario-recipes';
import { SCENARIO_TYPES_V11 } from '../../../content/scenario-types-v11';
import { SCENARIO_TYPES_V10 } from '../../../content/scenario-types-v10';
import { isProceduralFamily } from '../../building';
import type { IncidentSpec, IncidentType } from '../../../sim/scenario-types';
import { INCIDENT_CONTENT_VERSION } from '../index';

/** The content gates (docs/content-pipeline.md) judge the current content version: every
 * framework compiled from typed data by frameworks-v9.ts, existing and new alike. */
export const GATE_CONTENT_VERSION = INCIDENT_CONTENT_VERSION;

export interface GateFramework {
  framework: IncidentFramework;
  label: string;
  families: string[];
  generated: string[];
  squads: [number, number];
  /** First content version that lists the framework. */
  since: number;
}

export const isGeneratedFamily = (familyId: string) => isProceduralFamily(familyId);

/** Every typed framework in the current catalog, in registry order. */
export function gateFrameworks(): GateFramework[] {
  return ADDITIONAL_FRAMEWORKS.flatMap(issued => {
    const info = SCENARIO_TYPES_V11.find(entry => entry.type === issued.type);
    if (!info) return [];
    // The package as it compiles at the gated version, with any later decision depth.
    const framework = frameworkAt(issued.type, GATE_CONTENT_VERSION) ?? issued;
    return [{ framework, label: info.label, families: info.families, generated: info.families.filter(isGeneratedFamily), squads: info.squads,
      since: SCENARIO_TYPES_V10.some(entry => entry.type === framework.type) ? 9 : 11 }];
  });
}

export const VARIANTS = [0, 1, 2] as const;
export type Variant = typeof VARIANTS[number];

/** A seed that presents this situation and pacing, found through the public draw (the
 * situation is keyed by the call seed alone from v10 on, so any building type works). */
export function specForSituation(type: IncidentType, familyId: string, variant: Variant, buildingSeed = 7, characteristic: ScenarioCharacteristic = 'ordinary', tier = 2): IncidentSpec {
  for (let seed = 0; seed < 10000; seed++) {
    const spec = { type, familyId, buildingSeed, seed, tier, contentVersion: GATE_CONTENT_VERSION };
    const picked = scenarioRecipe(spec);
    if (picked.variant === variant && picked.characteristic === characteristic) return spec;
  }
  throw new Error(`No seed found for ${type}/${variant}/${characteristic}`);
}
