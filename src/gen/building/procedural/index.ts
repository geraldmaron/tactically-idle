import type { LocationDefinition } from '../../../sim/types';
import { generate } from './generate';
export { GENERATION, generatePair, publicFamilyId, type GeneratedBuilding } from './generate';
import { FAMILIES } from './families';

export interface BuildingFamilyInfo {
  id: string;
  label: string;
  setting: LocationDefinition['setting'];
  floors: [min: number, max: number];
  /** Short line for incident cards, e.g. 'Two-story house'. */
  blurb: string;
}

export const BUILDING_FAMILIES: BuildingFamilyInfo[] = FAMILIES.map((f) => ({ id: f.id, label: f.label, setting: f.setting, floors: f.floors, blurb: f.blurb }));

/**
 * Deterministic: same (familyId, seed) → identical, validated LocationDefinition, unfurnished
 * (generatePair also returns its furnishLocationV7 form).
 * Implementations retry internally on validation/plausibility failure and fall back
 * to a known-valid layout; they never return an invalid building.
 */
export function generateBuilding(familyId: string, seed: number): LocationDefinition {
  return generate(familyId, seed);
}

export function isGeneratedFamily(familyId: string): boolean {
  return BUILDING_FAMILIES.some((f) => f.id === familyId);
}

export { plausibilityReport } from './plausibility';
