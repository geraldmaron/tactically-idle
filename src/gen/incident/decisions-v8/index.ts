import type { BuiltLocation } from '../../../sim/types';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { isGenericResponseExit } from '../../../sim/response-failure';
import { withConcreteCommitmentsV8 } from './commitments';

/** A versioned decision graph; issued earlier graphs and committed history stay frozen. */
export function withVersionEightDecisions(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  const scenario = structuredClone(input);
  scenario.version = 8;
  withConcreteCommitmentsV8(scenario, built);
  for (const stage of Object.values(scenario.stages)) {
    stage.actions = stage.actions.filter(action => !isGenericResponseExit(scenario, action));
  }
  return scenario;
}
