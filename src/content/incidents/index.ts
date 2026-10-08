import { callTreeAt } from '../call-trees';
import type { IncidentType } from '../../sim/scenario-types';
import { ARMED_TEMPLATE } from './armed';
import { BARRICADE_TEMPLATE } from './barricade';
import { HOSTAGE_TEMPLATE } from './hostage';
import { RESCUE_TEMPLATE } from './rescue';
import type { IncidentTemplate } from './types';

/** Every dispatched call type as an incident template (docs/incident-domain-model.md). */
export const INCIDENT_TEMPLATES: Partial<Record<IncidentType, IncidentTemplate>> = {
  hostage_crisis: HOSTAGE_TEMPLATE,
  barricaded: BARRICADE_TEMPLATE,
  active_armed_incident: ARMED_TEMPLATE,
  protected_rescue: RESCUE_TEMPLATE,
};

/** The template a call of this type and content version is drawn from, when it is a call tree. */
export function templateAt(type: IncidentType, contentVersion: number): IncidentTemplate | undefined {
  const tree = callTreeAt(type, contentVersion);
  const template = INCIDENT_TEMPLATES[type];
  return tree && template?.tree === tree ? template : undefined;
}
