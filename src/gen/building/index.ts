import type { LocationDefinition } from '../../sim/types';
import { NEIGHBOURHOOD_FAMILIES } from '../../content/locations/neighbourhood';
import { RESIDENTIAL_FAMILIES_V1 } from '../../content/locations/residential-v1';
import { applyVariations } from '../../sim/location-variation';
import { MAPLE_STREET } from '../../content/locations/maple-street';
import { baseFamilyIdV7, furnishLocationV7, FURNISHING_V7_SUFFIX } from './furnishing-v7';
export { furnishedFamilyIdV7, baseFamilyIdV7 } from './furnishing-v7';

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
// Selectors rebuild a location several times per render. Cache only the new
// expensive furnishing solve, bounded in memory, and never expose cached data
// to callers that may change door states during an operation.
const furnishedCache = new Map<string, LocationDefinition>();

/**
 * Deterministic: same (familyId, seed) → identical, validated LocationDefinition.
 * Authored variation choices are exhaustively validated in generation.test.ts.
 * buildLocation derives metrics and validates the resulting building before play.
 */
export function generateBuilding(familyId: string, seed: number): LocationDefinition {
  const furnished = familyId.endsWith(FURNISHING_V7_SUFFIX);
  const baseId = furnished ? baseFamilyIdV7(familyId) : familyId;
  const family = GENERATED_LOCATION_FAMILIES.find((f) => f.id === baseId) ?? (furnished && baseId === MAPLE_STREET.id ? MAPLE_STREET : undefined);
  if (!family) throw new Error(`Unknown building family ${familyId}`);
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('Building seed must be a non-negative integer');
  const key = `${familyId}:${seed}`;
  if (furnished && furnishedCache.has(key)) return structuredClone(furnishedCache.get(key)!);
  const location = applyVariations(family, seed);
  if (!furnished) return location;
  const result = furnishLocationV7(location);
  if (furnishedCache.size >= 128) furnishedCache.delete(furnishedCache.keys().next().value!);
  furnishedCache.set(key, result);
  return structuredClone(result);
}

export function isGeneratedFamily(familyId: string): boolean {
  const baseId = baseFamilyIdV7(familyId);
  return BUILDING_FAMILIES.some((f) => f.id === baseId) || (familyId.endsWith(FURNISHING_V7_SUFFIX) && baseId === MAPLE_STREET.id);
}
