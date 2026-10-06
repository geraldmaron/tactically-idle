// Generator generations. No imports: the building index reads these while the generator and the
// shared location code are still loading (they import each other).

/**
 * Each generation is part of every public building type id (`bungalow_g1`, `bungalow_g2`) and its
 * output is frozen once released; see README.md before changing output.
 * - g1: the first release. Shared geometry measures with Math.hypot (no `geometry` field).
 * - g2: the same family draw streams with `geometry: 'exact'`, so validation, furnishing and routing
 *   compare engine-independent distances, and apartments carry `access`. Furnishing choices hash the
 *   public id, so a g2 seed often accepts a different draw from the stream than g1 did.
 */
export type Generation = 'g1' | 'g2';
export const GENERATIONS: readonly Generation[] = ['g1', 'g2'];
/** The first generation, which bare spec ids (`bungalow`) resolve to. */
export const GENERATION: Generation = 'g1';
/** The newest generation; new content versions should draw these types. */
export const LATEST_GENERATION: Generation = 'g2';
export const publicFamilyId = (specId: string, generation: Generation = GENERATION): string => `${specId}_${generation}`;
