// The names of the crew flags a run can carry (sim/crew.ts sets them; call trees read them through
// TreeState.crew). Constants only, so the compiler can validate a tree without the engine.
import type { ExperienceBand } from './calendar';
import type { TraitId } from './types';

export const CREW_TRAITS: readonly TraitId[] = ['steady', 'observant', 'mentor', 'impatient', 'calm_voice', 'rookie'];
export const CREW_BANDS: readonly ExperienceBand[] = ['rookie', 'developing', 'seasoned', 'veteran'];
/** A crew mark: a trait, or an experience band as `band_<band>`. */
export const CREW_MARKS: readonly string[] = [...CREW_TRAITS, ...CREW_BANDS.map(band => `band_${band}`)];
export const crewFlag = (mark: string) => `crew:${mark}`;
/** Every flag a crew can set, for validation of the call trees that read them. */
export const CREW_FLAGS: readonly string[] = CREW_MARKS.map(crewFlag);
/** A lead mark: the same names, for the one officer leading the current decision (sim/crew.ts leadFlags). */
export const LEAD_PREFIX = 'lead:';
export const leadFlag = (mark: string) => `${LEAD_PREFIX}${mark}`;
