/** The current procedural generation, used in public building IDs. */
export type Generation = 'g2';
export const GENERATION: Generation = 'g2';
export const GENERATIONS: readonly Generation[] = [GENERATION];
export const LATEST_GENERATION = GENERATION;
export const publicFamilyId = (specId: string, generation: Generation = GENERATION): string => `${specId}_${generation}`;
