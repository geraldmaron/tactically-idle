import { callTreeAt } from '../call-trees';
import type { IncidentType } from '../../sim/scenario-types';
import { HOSTAGE_TEMPLATE } from './hostage';
import type { IncidentTemplate } from './types';

/** Every dispatched call type as an incident template (docs/incident-domain-model.md). */
export const INCIDENT_TEMPLATES: Partial<Record<IncidentType, IncidentTemplate>> = {
  hostage_crisis: HOSTAGE_TEMPLATE,
};

/** The template a call of this type and content version is drawn from, when it is a call tree. */
export function templateAt(type: IncidentType): IncidentTemplate | undefined {
  const tree = callTreeAt(type);
  const template = INCIDENT_TEMPLATES[type];
  return tree && template?.tree === tree ? template : undefined;
}
