import type { IncidentType } from '../sim/scenario-types';
import { SCENARIO_TYPES_V10 } from './scenario-types-v10';

/** Content version 11 starts from the v10 catalog. Each drop adds frameworks,
 * setting modules and building types here, never to the frozen v9/v10 lists.
 * Extra building types per framework (for example new setting modules or `_g2`
 * building types) are appended through GENERATED_FAMILIES_V11. */
export const GENERATED_FAMILIES_V11: Partial<Record<IncidentType, readonly string[]>> = {
  // Setting modules (content/setting-modules-armed.ts) let the armed story play an office
  // late worker, a warehouse night picker and a motel night clerk. Listed where at least
  // 30% of building seeds host it at the drawn seed (setting-modules-v11.test.ts).
  active_armed_incident: ['small_office_g1', 'warehouse_g1', 'motel_row_g1'],
  // `_g2` apartments record unit level and elevators; step-free units can host the
  // wheelchair rescue (stories-v6/hosts-v10.ts).
  protected_rescue: ['apartment_unit_g2'],
};

/** New frameworks introduced in v11 or later drops (type, label, buildings, squads). */
export const NEW_FRAMEWORKS_V11: { type: IncidentType; label: string; families: string[]; squads: [number, number]; count: number }[] = [];

/** v11 draws use the second building generation (exact geometry, access metadata);
 * `_g1` stays frozen for the v10 incidents that reference it. */
const toG2 = (familyId: string) => familyId.endsWith('_g1') ? `${familyId.slice(0, -3)}_g2` : familyId;
export const SCENARIO_TYPES_V11: { type: IncidentType; label: string; families: string[]; squads: [number, number]; count: number }[] = [
  ...SCENARIO_TYPES_V10.map(info => ({ ...info, families: [...new Set([...info.families, ...(GENERATED_FAMILIES_V11[info.type] ?? [])].map(toG2))] })),
  ...NEW_FRAMEWORKS_V11.map(info => ({ ...info, families: [...new Set(info.families.map(toG2))] })),
];
