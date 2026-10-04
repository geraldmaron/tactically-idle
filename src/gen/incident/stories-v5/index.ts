import type { ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation } from '../../../sim/types';
import { withSignatureStory } from './signature';
import { withArmedStory } from './armed';
import { withWelfareStory } from './welfare';
import { withAssistanceStory } from './assistance';
import { withRescueStory } from './rescue';
import { withProtectiveStory } from './protective';
import { attachStoryBindings, prepareStoryShell } from './archetypes';

/** New authored stories own their graphs; previously issued versions stay untouched. */
export function withVersionFiveStory(scenario: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  const shell = prepareStoryShell(scenario, built);
  if (scenario.incident?.type === 'hostage_crisis') return attachStoryBindings(withSignatureStory(shell, built), built);
  if (scenario.incident?.type === 'active_armed_incident') return attachStoryBindings(withArmedStory(shell, built), built);
  if (scenario.incident?.type === 'welfare_check') return attachStoryBindings(withWelfareStory(shell, built), built);
  if (scenario.incident?.type === 'medical_complication') return attachStoryBindings(withAssistanceStory(shell, built), built);
  if (scenario.incident?.type === 'protected_rescue') return attachStoryBindings(withRescueStory(shell, built), built);
  if (scenario.incident?.type === 'barricaded') return attachStoryBindings(withProtectiveStory(shell, built), built);
  throw new Error('No authored story for this incident type');
}
