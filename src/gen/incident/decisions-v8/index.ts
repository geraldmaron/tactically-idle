import type { BuiltLocation } from '../../../sim/types';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { isGenericResponseExit } from '../../../sim/response-failure';
import { withConcreteCommitmentsV8 } from './commitments';
import { withSecondChoicesV12 } from './choices-v12';
import { FRAMEWORK_DEPTH_CONTENT_VERSION } from '../../../content/framework-depth-v12';
import { withLocationTextV10 } from '../stories-v6/hosts-v10';
import { withSettingTextV11 } from '../stories-v6/setting-modules-v11';

/** A versioned decision graph; issued earlier graphs and committed history stay frozen. */
export function withVersionEightDecisions(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  const scenario = structuredClone(input);
  scenario.version = 8;
  withConcreteCommitmentsV8(scenario, built);
  // v12: a second real choice where a story opened a stage with only one (choices-v12.ts).
  if (scenario.incident!.contentVersion >= FRAMEWORK_DEPTH_CONTENT_VERSION) withSecondChoicesV12(scenario, built);
  for (const stage of Object.values(scenario.stages)) {
    stage.actions = stage.actions.filter(action => !isGenericResponseExit(scenario, action));
  }
  // Last authored layers: v11 swaps in the chosen setting module's lines (a no-op for the
  // source module and for v10 and earlier), then v10 rebinds building names to the location.
  return withLocationTextV10(withSettingTextV11(scenario, built), built);
}
