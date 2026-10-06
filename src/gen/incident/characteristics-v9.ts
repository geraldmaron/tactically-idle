import { ADDITIONAL_FRAMEWORK_BY_TYPE } from '../../content/incident-frameworks-v9';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { scenarioActions } from '../../sim/scenario-types';
import { scenarioRecipe } from '../../content/scenario-recipes';
import { SCENARIO_CAST } from './cast-v9';

/** Coherent reported characteristics affect actual work, never a demographic score.
 * These are public reports, not hidden intent or a diagnosis. They do not imply danger.
 */
export function applyRecipeCharacteristic(s: ScenarioDefinition): void {
  const recipe = scenarioRecipe(s.incident!);
  s.story!.recipeId = recipe.id;
  s.story!.characteristics = [];
  if (recipe.characteristic === 'ordinary') return;
  const slots = SCENARIO_CAST[s.incident!.type]!;
  // Pick a participant who actually has a contact choice, not an off-scene caller.
  const candidates = slots.map(slot => ({ slot, actions: scenarioActions(s).filter(action =>
    action.check.kind === 'contact' && (!ADDITIONAL_FRAMEWORK_BY_TYPE[s.incident!.type] || action.storyTargetPersonId === slot.id) && new RegExp(`\\b${slot.authoredName.split(' ')[0]}\\b`).test(`${action.title} ${action.summary}`)) }));
  const selected = candidates.find(candidate => candidate.actions.length > 0);
  if (!selected) throw new Error(`No supported conversation for ${recipe.id}`);
  const name = selected.slot.authoredName.split(' ')[0];
  s.briefing.known.push(`Dispatch reports that ${name} takes time to consider questions before answering. Allow two extra operation minutes for each conversation with ${name}; this says nothing about cooperation or danger.`);
  s.story!.characteristics.push({ id: 'deliberate_answers', personId: selected.slot.id, label: 'Takes time to consider questions', source: 'Dispatch conversation report' });
  for (const action of selected.actions) {
    action.workload.base += 2;
    action.summary += ` Allow extra time for ${name} to consider the questions.`;
  }
}
