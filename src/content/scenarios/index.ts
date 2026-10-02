import type { Id } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { MS_OCCUPANCY } from './ms-occupancy';
import { MS_URGENT } from './ms-urgent';

export const SCENARIOS: Record<Id, ScenarioDefinition> = {
  [MS_OCCUPANCY.id]: MS_OCCUPANCY,
  [MS_URGENT.id]: MS_URGENT,
};

export const SCENARIO_ORDER: Id[] = [MS_OCCUPANCY.id, MS_URGENT.id];
