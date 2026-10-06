import type { LocationDefinition } from '../../sim/types';
import { NEIGHBOURHOOD_FAMILIES } from '../../content/locations/neighbourhood';
import { RESIDENTIAL_FAMILIES_V1 } from '../../content/locations/residential-v1';
import { applyVariations } from '../../sim/location-variation';
import { MAPLE_STREET } from '../../content/locations/maple-street';
import { baseFamilyIdV7, furnishLocationV7, FURNISHING_V7_SUFFIX } from './furnishing-v7';
export { furnishedFamilyIdV7, baseFamilyIdV7 } from './furnishing-v7';
import { FAMILIES as PROCEDURAL_SPECS } from './procedural/families';
import { generate as generateProceduralPlan } from './procedural/generate';

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

/** Procedurally generated building types, first generation. The `_g1` suffix is part of
 * the content identity: a change to the generator, its shared geometry or furnishing
 * that alters any output for these IDs must ship as `_g2` families instead, because
 * issued incidents regenerate their building from (familyId, seed) alone. Kept out of
 * BUILDING_FAMILIES so v1-v9 incident family lists stay unchanged. */
export const PROCEDURAL_GENERATION = 'g1';
export const PROCEDURAL_FAMILIES: BuildingFamilyInfo[] = PROCEDURAL_SPECS.map((spec) => ({
  id: `${spec.id}_${PROCEDURAL_GENERATION}`, label: spec.label, setting: spec.setting, floors: spec.floors, blurb: spec.blurb,
}));
const proceduralSpecId = (familyId: string) => PROCEDURAL_FAMILIES.some((f) => f.id === familyId) ? familyId.slice(0, -(PROCEDURAL_GENERATION.length + 1)) : null;
/** Every building type a player can be sent to, authored and generated. */
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
  const furnished = familyId.endsWith(FURNISHING_V7_SUFFIX);
  const baseId = furnished ? baseFamilyIdV7(familyId) : familyId;
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('Building seed must be a non-negative integer');
  const key = `${familyId}:${seed}`;
  const specId = proceduralSpecId(baseId);
  if (specId) {
    // Generation runs a bounded search per seed; selectors rebuild locations several
    // times per render, so both the plan and its furnished form are cached.
    if (!proceduralCache.has(key)) {
      const plan = generateProceduralPlan(specId, seed);
      const location = { ...plan, id: baseId, familyId: baseId };
      if (proceduralCache.size >= 128) proceduralCache.delete(proceduralCache.keys().next().value!);
      proceduralCache.set(key, furnished ? furnishLocationV7(location) : location);
    }
    return structuredClone(proceduralCache.get(key)!);
  }
  const family = GENERATED_LOCATION_FAMILIES.find((f) => f.id === baseId) ?? (furnished && baseId === MAPLE_STREET.id ? MAPLE_STREET : undefined);
  if (!family) throw new Error(`Unknown building family ${familyId}`);
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
  return ALL_BUILDING_FAMILIES.some((f) => f.id === baseId) || (familyId.endsWith(FURNISHING_V7_SUFFIX) && baseId === MAPLE_STREET.id);
}
