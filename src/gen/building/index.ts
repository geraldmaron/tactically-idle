// STUB (owned by the building-generator agent). Export names and signatures are fixed.
import type { LocationDefinition } from '../../sim/types';

export interface BuildingFamilyInfo {
  id: string;
  label: string;
  setting: LocationDefinition['setting'];
  floors: [min: number, max: number];
  /** Short line for incident cards, e.g. 'Two-storey house'. */
  blurb: string;
}

export const BUILDING_FAMILIES: BuildingFamilyInfo[] = [];

/**
 * Deterministic: same (familyId, seed) → identical, validated LocationDefinition.
 * Implementations retry internally on validation/plausibility failure and fall back
 * to a known-valid layout; they never return an invalid building.
 */
export function generateBuilding(familyId: string, seed: number): LocationDefinition {
  throw new Error(`No generator for ${familyId} (seed ${seed})`);
}

export function isGeneratedFamily(familyId: string): boolean {
  return BUILDING_FAMILIES.some((f) => f.id === familyId);
}
