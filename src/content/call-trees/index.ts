import type { IncidentType } from '../../sim/scenario-types';
import { HOSTAGE_LIVE } from './hostage-live';
import type { CallTree } from './types';

export type { CallTree } from './types';

/** The current call-tree content stamp used in incident IDs and saves. */
export const CALL_TREE_CONTENT_VERSION = 13;

/** The curated calls. A type with no tree here is off the board (docs/backlog.md `curated-calls`). */
export const CALL_TREES: Partial<Record<IncidentType, CallTree>> = {
  hostage_crisis: HOSTAGE_LIVE,
};

export function callTreeAt(type: IncidentType): CallTree | undefined {
  return CALL_TREES[type];
}
