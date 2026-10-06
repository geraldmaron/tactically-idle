import type { IncidentType } from '../sim/scenario-types';
import { SCENARIO_TYPES_V10 } from './scenario-types-v10';

/** Content version 11 starts from the v10 catalog. Each drop adds frameworks,
 * setting modules and building types here, never to the frozen v9/v10 lists.
 * Extra building types per framework (for example new setting modules or `_g2`
 * building types) are appended through GENERATED_FAMILIES_V11. */
export const GENERATED_FAMILIES_V11: Partial<Record<IncidentType, readonly string[]>> = {};

/** New frameworks introduced in v11 or later drops (type, label, buildings, squads). */
export const NEW_FRAMEWORKS_V11: { type: IncidentType; label: string; families: string[]; squads: [number, number]; count: number }[] = [
  // First pipeline drop (docs/content-pipeline.md). Generated types are listed where at
  // least 30% of building seeds host the call at the drawn seed (content-gates tests).
  // count is the framework's situations times pacings, as in v10 draws.
  { type: 'fall_at_home', label: 'Fall at home', families: ['cedar_close', 'harbour_court', 'willow_terrace_v1', 'ash_grove_v1', 'juniper_court_v1', 'bungalow_g1', 'two_storey_house_g1', 'semi_detached_g1', 'apartment_unit_g1'], squads: [1, 2], count: 6 },
  { type: 'water_leak', label: 'Water leak', families: ['harbour_court', 'market_row', 'apartment_unit_g1', 'corner_store_flat_g1', 'small_office_g1', 'bar_restaurant_g1', 'motel_row_g1'], squads: [1, 2], count: 6 },
  { type: 'lost_child', label: 'Lost child', families: ['market_row', 'corner_store_flat_g1', 'bar_restaurant_g1', 'motel_row_g1'], squads: [1, 2], count: 6 },
];

export const SCENARIO_TYPES_V11: { type: IncidentType; label: string; families: string[]; squads: [number, number]; count: number }[] = [
  ...SCENARIO_TYPES_V10.map(info => ({ ...info, families: [...new Set([...info.families, ...(GENERATED_FAMILIES_V11[info.type] ?? [])])] })),
  ...NEW_FRAMEWORKS_V11,
];
