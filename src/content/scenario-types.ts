import { CALL_TREES } from './call-trees';
import type { IncidentType } from '../sim/scenario-types';

/** The current tactical catalog: only the types that have a curated call. Building support belongs
 * to each call tree, and the squads a call takes are derived from its choices when it compiles
 * (squadRange in trees-v13/compile.ts). */
export const SCENARIO_TYPES: { type: IncidentType; label: string; families: string[]; count: number }[] = [
  { type: 'barricaded', label: 'Barricade', count: 6 },
  { type: 'active_armed_incident', label: 'Active armed incident', count: 6 },
  { type: 'hostage_crisis', label: 'Hostage crisis', count: 6 },
  { type: 'protected_rescue', label: 'Protected rescue', count: 6 },
].flatMap(info => {
  const tree = CALL_TREES[info.type as IncidentType];
  return tree ? [{ ...info, type: info.type as IncidentType, families: [...tree.families] }] : [];
});
