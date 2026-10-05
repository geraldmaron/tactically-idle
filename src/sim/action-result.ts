import type { ActionDefinition } from './scenario-types';
import type { OutcomeBand } from './types';

/** Compare the complete authored tables without evaluating public or hidden conditions.
 * Object key order is immaterial; effect and condition array order is preserved. */
function sameStructure(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => sameStructure(value, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && sameStructure(a[key], b[key]));
}

function inferredResultLabel(action: ActionDefinition, scenarioVersion: number): string | undefined {
  // V1–V5 definitions, previews and historical records keep their established behavior.
  // Equal prose alone is insufficient: time, harm, flags and every branch must also match.
  if (scenarioVersion !== 6 || !action.outcomes.favorable.length
    || !sameStructure(action.outcomes.favorable, action.outcomes.mixed)
    || !sameStructure(action.outcomes.favorable, action.outcomes.adverse)) return undefined;
  const alwaysEnds = action.outcomes.favorable.some(effect => effect.ending && !effect.when && !effect.truth?.length);
  // A fixed event is not evidence of goal completion or a favorable effort check.
  return alwaysEnds ? 'Response ended' : 'Result recorded';
}

/** A common event hides success odds; real effort odds, time, strain and harm stay intact. */
export function actionEventResult(action: ActionDefinition, scenarioVersion: number): string | undefined {
  if (scenarioVersion >= 5 && action.resultLabels) {
    return new Set(Object.values(action.resultLabels)).size === 1 ? action.resultLabels.favorable : undefined;
  }
  return inferredResultLabel(action, scenarioVersion);
}

/** Saved only on new commits. Never reinterpret or relabel a historical decision. */
export function actionResultLabel(action: ActionDefinition, scenarioVersion: number, band: OutcomeBand): string | undefined {
  if (scenarioVersion >= 5 && action.resultLabels) return action.resultLabels[band];
  return inferredResultLabel(action, scenarioVersion);
}
