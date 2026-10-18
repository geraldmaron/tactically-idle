import type { LocationDefinition } from '../../sim/types';
import { NEIGHBOURHOOD_FAMILIES } from '../../content/locations/neighbourhood';
import { RESIDENTIAL_FAMILIES } from '../../content/locations/residential';
import { applyVariations } from '../../sim/location-variation';
import { baseFamilyId, furnishedFamilyId, furnishLocation, FURNISHING_SUFFIX } from './furnishing';
export { furnishedFamilyId, baseFamilyId } from './furnishing';
import { FAMILIES as PROCEDURAL_SPECS } from './procedural/families';
import { generatePair as generateProceduralPair } from './procedural/generate';
import { GENERATION, publicFamilyId } from './procedural/generation';

export interface BuildingFamilyInfo {
  id: string;
  label: string;
  setting: LocationDefinition['setting'];
  floors: [min: number, max: number];
  /** Short line for incident cards, e.g. 'Two-story house'. */
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

export const GENERATED_LOCATION_FAMILIES = [...NEIGHBOURHOOD_FAMILIES, ...RESIDENTIAL_FAMILIES];

/** Current procedural building catalog. */
export const PROCEDURAL_GENERATION = GENERATION;
export const PROCEDURAL_FAMILIES: BuildingFamilyInfo[] = PROCEDURAL_SPECS.map(spec => ({
  id: publicFamilyId(spec.id), label: spec.label, setting: spec.setting, floors: spec.floors, blurb: spec.blurb,
}));
const PROCEDURAL_IDS = new Set(PROCEDURAL_FAMILIES.map(f => f.id));
export const isProceduralFamily = (familyId: string): boolean => PROCEDURAL_IDS.has(familyId);
export const ALL_BUILDING_FAMILIES: BuildingFamilyInfo[] = [...BUILDING_FAMILIES, ...PROCEDURAL_FAMILIES];
const proceduralCache = new Map<string, LocationDefinition>();
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
  const furnished = familyId.endsWith(FURNISHING_SUFFIX);
  const baseId = furnished ? baseFamilyId(familyId) : familyId;
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('Building seed must be a non-negative integer');
  const key = `${familyId}:${seed}`;
  if (PROCEDURAL_IDS.has(baseId)) {
    // Generation runs a bounded search per seed that already furnishes each candidate with
    // furnishLocationG1 to accept it; selectors rebuild locations several times per render,
    // so both forms of the accepted building are cached.
    if (!proceduralCache.has(key)) {
      const pair = generateProceduralPair(baseId, seed);
      for (const [k, loc] of [[`${baseId}:${seed}`, pair.plain], [`${furnishedFamilyId(baseId)}:${seed}`, pair.furnished]] as const) {
        if (proceduralCache.size >= 128) proceduralCache.delete(proceduralCache.keys().next().value!);
        proceduralCache.set(k, loc);
      }
    }
    return structuredClone(proceduralCache.get(key)!);
  }
  const family = GENERATED_LOCATION_FAMILIES.find((f) => f.id === baseId);
  if (!family) throw new Error(`Unknown building family ${familyId}`);
  if (furnished && furnishedCache.has(key)) return structuredClone(furnishedCache.get(key)!);
  const location = applyVariations(family, seed);
  if (!furnished) return location;
  const result = furnishLocation(location);
  if (furnishedCache.size >= 128) furnishedCache.delete(furnishedCache.keys().next().value!);
  furnishedCache.set(key, result);
  return structuredClone(result);
}

export function isGeneratedFamily(familyId: string): boolean {
  const baseId = baseFamilyId(familyId);
  return ALL_BUILDING_FAMILIES.some((f) => f.id === baseId);
}
