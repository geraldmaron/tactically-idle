import { CALL_TREES } from './call-trees';
import type { IncidentType } from '../sim/scenario-types';

/** The current tactical catalog. Building support belongs to each call tree. */
export const SCENARIO_TYPES: { type: IncidentType; label: string; families: string[]; squads: [number, number]; count: number }[] = [
  { type: 'barricaded', label: 'Protective response', squads: [1, 3], count: 6 },
  { type: 'active_armed_incident', label: 'Active armed incident', squads: [1, 3], count: 6 },
  { type: 'hostage_crisis', label: 'Hostage crisis', squads: [1, 3], count: 6 },
  { type: 'protected_rescue', label: 'Protected rescue', squads: [1, 3], count: 6 },
].map(info => ({ ...info, type: info.type as IncidentType, squads: info.squads as [number, number], families: [...CALL_TREES[info.type as IncidentType]!.families] }));
