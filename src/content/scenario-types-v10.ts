import type { IncidentType } from '../sim/scenario-types';
import { SCENARIO_TYPES_V9 } from './scenario-recipes';
import { PROCEDURAL_FAMILIES } from '../gen/building';

/** Content version 10 sends calls to generated buildings as well as the authored ones.
 * A framework lists a generated building type only when its location needs can be met
 * there; the board still proves each drawn incident by generating it, and redraws the
 * building seed (then falls back to an authored family) when one seed cannot host it.
 * v9 lists are frozen; extend these lists, never SCENARIO_TYPES_V9. */
const generated = (setting: 'home' | 'business') => PROCEDURAL_FAMILIES
  .filter(family => setting === 'business' ? family.setting === 'business' : family.setting !== 'business')
  .map(family => family.id);
export const GENERATED_HOMES = generated('home');
export const GENERATED_BUSINESSES = generated('business');

/** Generated building types each framework can use today. Frameworks absent here keep
 * their authored v9 locations until their location needs are expressed as selectors. */
export const GENERATED_FAMILIES_V10: Partial<Record<IncidentType, readonly string[]>> = {
  missing_vulnerable: GENERATED_HOMES,
  person_in_crisis: GENERATED_HOMES,
  domestic: GENERATED_HOMES,
  disturbance: GENERATED_HOMES,
  false_intruder: GENERATED_HOMES,
  vacant_occupancy: GENERATED_HOMES,
  burglary: GENERATED_BUSINESSES,
  business_robbery: GENERATED_BUSINESSES,
};

export const SCENARIO_TYPES_V10: { type: IncidentType; label: string; families: string[]; squads: [number, number]; count: number }[] =
  SCENARIO_TYPES_V9.map(info => ({ ...info, families: [...info.families, ...(GENERATED_FAMILIES_V10[info.type] ?? [])] }));
