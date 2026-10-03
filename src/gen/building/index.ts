import type { LocationDefinition } from '../../sim/types';
import { NEIGHBOURHOOD_FAMILIES } from '../../content/locations/neighbourhood';
import { RESIDENTIAL_FAMILIES_V1 } from '../../content/locations/residential-v1';
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
  { id: 'willow_terrace_v1', label: 'Willow Terrace', setting: 'residential', floors: [1, 1], blurb: 'Deep terrace · linked rooms and side passage' },
  { id: 'ash_grove_v1', label: 'Ash Grove', setting: 'residential', floors: [1, 1], blurb: 'L-shaped bungalow · dogleg hall and patio' },
  { id: 'juniper_court_v1', label: 'Juniper Court', setting: 'residential', floors: [1, 1], blurb: 'Courtyard house · two wings and cross hall' },
];

export const GENERATED_LOCATION_FAMILIES = [...NEIGHBOURHOOD_FAMILIES, ...RESIDENTIAL_FAMILIES_V1];

/**
 * Deterministic: same (familyId, seed) → identical, validated LocationDefinition.
 * Authored variation choices are exhaustively validated in generation.test.ts.
 * buildLocation derives metrics and validates the resulting building before play.
 */
export function generateBuilding(familyId: string, seed: number): LocationDefinition {
  const family = GENERATED_LOCATION_FAMILIES.find((f) => f.id === familyId);
  if (!family) throw new Error(`Unknown building family ${familyId}`);
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('Building seed must be a non-negative integer');
  return applyVariations(family, seed);
}

export function isGeneratedFamily(familyId: string): boolean {
  return BUILDING_FAMILIES.some((f) => f.id === familyId);
}
