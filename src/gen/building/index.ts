import type { LocationDefinition } from '../../sim/types';
import { NEIGHBOURHOOD_FAMILIES } from '../../content/locations/neighbourhood';
import { applyVariations } from '../../sim/location-variation';

export interface BuildingFamilyInfo {
  id: string;
  label: string;
  setting: LocationDefinition['setting'];
  floors: [min: number, max: number];
  /** Short line for incident cards, e.g. 'Two-storey house'. */
  blurb: string;
}

export const BUILDING_FAMILIES: BuildingFamilyInfo[] = [
  { id: 'cedar_close', label: 'Cedar Close', setting: 'residential', floors: [1, 1], blurb: 'Narrow house · long central hall' },
  { id: 'harbour_court', label: 'Harbour Court', setting: 'apartment', floors: [1, 1], blurb: 'Garden flat · shared walkway' },
  { id: 'market_row', label: 'Market Row Stores', setting: 'business', floors: [1, 1], blurb: 'Corner shop · stockroom and delivery lane' },
];

/**
 * Deterministic: same (familyId, seed) → identical, validated LocationDefinition.
 * Authored variation choices are exhaustively validated in generation.test.ts.
 * buildLocation derives metrics and validates the resulting building before play.
 */
export function generateBuilding(familyId: string, seed: number): LocationDefinition {
  const family = NEIGHBOURHOOD_FAMILIES.find((f) => f.id === familyId);
  if (!family) throw new Error(`Unknown building family ${familyId}`);
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('Building seed must be a non-negative integer');
  return applyVariations(family, seed);
}

export function isGeneratedFamily(familyId: string): boolean {
  return BUILDING_FAMILIES.some((f) => f.id === familyId);
}
