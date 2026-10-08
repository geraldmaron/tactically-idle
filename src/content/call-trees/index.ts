import type { IncidentType } from '../../sim/scenario-types';
import { ARMED_NOISE } from './armed-noise';
import { BARRICADE_ORDER } from './barricade-order';
import { HOSTAGE_SIGNATURE } from './hostage-signature';
import { RESCUE_CHAIR } from './rescue-chair';
import type { CallTree } from './types';

export type { CallTree } from './types';

/** Content version 13: calls authored as trees (docs/call-trees-v13.md). From this version a
 * type listed here generates from its tree; other types keep their earlier generators. */
export const CALL_TREE_CONTENT_VERSION = 13;

export const CALL_TREES: Partial<Record<IncidentType, CallTree>> = {
  hostage_crisis: HOSTAGE_SIGNATURE,
  barricaded: BARRICADE_ORDER,
  active_armed_incident: ARMED_NOISE,
  protected_rescue: RESCUE_CHAIR,
};

export function callTreeAt(type: IncidentType, contentVersion: number): CallTree | undefined {
  return contentVersion >= CALL_TREE_CONTENT_VERSION ? CALL_TREES[type] : undefined;
}
