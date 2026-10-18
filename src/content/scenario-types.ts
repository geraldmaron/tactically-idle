import { CALL_TREES } from './call-trees';
import type { IncidentType } from '../sim/scenario-types';

/** The current tactical catalog. Building support belongs to each call tree, and the squads a call
 * takes are derived from its choices when it compiles (squadRange in trees-v13/compile.ts). */
export const SCENARIO_TYPES: { type: IncidentType; label: string; families: string[]; count: number }[] = [
  { type: 'barricaded', label: 'Protective response', count: 6 },
  { type: 'active_armed_incident', label: 'Active armed incident', count: 6 },
  { type: 'hostage_crisis', label: 'Hostage crisis', count: 6 },
  { type: 'protected_rescue', label: 'Protected rescue', count: 6 },
].map(info => ({ ...info, type: info.type as IncidentType, families: [...CALL_TREES[info.type as IncidentType]!.families] }));
