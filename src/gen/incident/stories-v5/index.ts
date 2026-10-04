import type { ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation } from '../../../sim/types';
import { withSignatureStory } from './signature';

/** New authored stories own their graphs; previously issued versions stay untouched. */
export function withVersionFiveStory(scenario: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  if (scenario.incident?.type === 'hostage_crisis') return withSignatureStory(scenario, built);
  throw new Error('No authored story for this incident type');
}
