import type { IncidentType } from '../../sim/scenario-types';
import { ARMED_NOISE } from './armed-noise';
import { BARRICADE_ORDER } from './barricade-order';
import { HOSTAGE_SIGNATURE } from './hostage-signature';
import { RESCUE_CHAIR } from './rescue-chair';
import type { CallTree } from './types';

export type { CallTree } from './types';

/** The current call-tree content stamp used in incident IDs and saves. */
export const CALL_TREE_CONTENT_VERSION = 13;

export const CALL_TREES: Partial<Record<IncidentType, CallTree>> = {
  hostage_crisis: HOSTAGE_SIGNATURE,
  barricaded: BARRICADE_ORDER,
  active_armed_incident: ARMED_NOISE,
  protected_rescue: RESCUE_CHAIR,
};

export function callTreeAt(type: IncidentType): CallTree | undefined {
  return CALL_TREES[type];
}
