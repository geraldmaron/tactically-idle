import { callTreeAt } from '../../content/call-trees';
import { scenarioRecipe } from '../../content/scenario-recipes';
import { parseIncidentId } from '../../gen/incident';
import { SUPPORT_TEXT } from './labels';
import './settings.css';

/** Whether the situation a call played carries suicide or self-harm. A call that isn't a generated
 * one does not. */
export function debriefNeedsSupport(scenarioId: string): boolean {
  const spec = parseIncidentId(scenarioId);
  if (!spec) return false;
  return (callTreeAt(spec.type)?.situations[scenarioRecipe(spec).variant]?.descriptors ?? []).includes('suicide_self_harm');
}

/** The support line in the debrief of any such situation, whatever the warning setting. It names no
 * outcome, so it reads the same after every ending, and it is never clamped. */
export function DebriefSupport({ scenarioId }: { scenarioId: string }) {
  if (!debriefNeedsSupport(scenarioId)) return null;
  return <p className="debrief-support" role="note">{SUPPORT_TEXT.debrief}</p>;
}
