// Plain-text descriptions of authored scenario data for the Scenario Lab. Developer wording; never
// shown in the game.
import type { CallTree } from '../../../content/call-trees/types';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import type { Id } from '../../../sim/types';

/** What tells an ending apart in the lab's lists (Flow, Outcomes, the palette) when another ending
 * of the call has the same authored title: its first remaining task ("Get a medic to {owner.first}"),
 * else its id. Null when its title is its own. The player's debrief shows the title alone. */
export function endingTwinCrumb(tree: CallTree, id: string): string | null {
  const ending = tree.endings[id];
  if (!ending || !Object.entries(tree.endings).some(([other, entry]) => other !== id && entry.title === ending.title)) return null;
  return ending.remainingTasks?.[0] ?? id.replace(/_/g, ' ');
}

/** An ending's title as the lab lists it: the bound title, with endingTwinCrumb after it when another
 * ending shares the title. */
export function endingListTitle(tree: CallTree, id: string, bind: (text: string) => string): string {
  const ending = tree.endings[id];
  if (!ending) return id;
  const crumb = endingTwinCrumb(tree, id);
  return crumb ? `${bind(ending.title)} · ${bind(crumb)}` : bind(ending.title);
}

/** An action's title, or its id when the call has no such action. */
export function actionTitle(s: ScenarioDefinition, id: Id): string {
  for (const stage of [s.stages.assess, s.stages.adapt, s.stages.resolve]) { const action = stage.actions.find(a => a.id === id); if (action) return action.title; }
  return id;
}
