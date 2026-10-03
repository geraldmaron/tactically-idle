import type { Id } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { MS_OCCUPANCY } from './ms-occupancy';
import { MS_URGENT } from './ms-urgent';
import { CAPABILITY_PRACTICE_SCENARIOS } from './capability-practice';

export const SCENARIOS: Record<Id, ScenarioDefinition> = {
  [MS_OCCUPANCY.id]: MS_OCCUPANCY,
  [MS_URGENT.id]: MS_URGENT,
  ...Object.fromEntries(CAPABILITY_PRACTICE_SCENARIOS.map((scenario) => [scenario.id, scenario])),
};

export const SCENARIO_ORDER: Id[] = [MS_OCCUPANCY.id, MS_URGENT.id, ...CAPABILITY_PRACTICE_SCENARIOS.map((scenario) => scenario.id)];
