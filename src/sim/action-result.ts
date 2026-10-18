import type { ActionDefinition } from './scenario-types';
import type { OfficerCasualtyRecord, OutcomeBand, PersonCasualtyRecord } from './types';

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

function inferredResultLabel(action: ActionDefinition): string | undefined {
  // Equal prose alone is insufficient: time, harm, flags and every branch must also match.
  if (action.forceProfile || action.personCare?.kind === 'stabilize' || !action.outcomes.favorable.length
    || !sameStructure(action.outcomes.favorable, action.outcomes.mixed)
    || !sameStructure(action.outcomes.favorable, action.outcomes.adverse)) return undefined;
  const alwaysEnds = action.outcomes.favorable.some(effect => effect.ending && !effect.when && !effect.truth?.length);
  // A fixed event is not evidence of goal completion or a favorable effort check.
  return alwaysEnds ? 'Response ended' : 'Result recorded';
}

/** A common event hides success odds; real effort odds, time, strain and harm stay intact. */
export function actionEventResult(action: ActionDefinition): string | undefined {
  if (action.resultLabels) {
    return new Set(Object.values(action.resultLabels)).size === 1 ? action.resultLabels.favorable : undefined;
  }
  return inferredResultLabel(action);
}

/** V13: when someone is hurt or killed in a decision, its result says so, whatever the band. A
 * green "Went well" chip never sits on a collapse or a shot: the team's part can go well while a
 * person pays for the wait. The most serious harm is named. */
export function harmResultLabel(people: readonly PersonCasualtyRecord[], officers: readonly OfficerCasualtyRecord[]): string | undefined {
  const fresh = people.filter(person => person.care === 'needed' || person.care === 'deceased');
  const order = ['fatal', 'serious', 'wounded'] as const;
  for (const severity of order) {
    const person = fresh.find(entry => entry.severity === severity);
    if (person) return severity === 'fatal' ? `${person.label} died` : severity === 'serious' ? `${person.label} was badly hurt` : `${person.label} was hurt`;
    if (severity !== 'fatal' && officers.some(entry => entry.care === 'needed' && entry.severity === severity))
      return severity === 'serious' ? 'An officer was badly hurt' : 'An officer was hurt';
  }
  return undefined;
}

/** A committed result uses its authored label or the fixed-event inference. */
export function actionResultLabel(action: ActionDefinition, band: OutcomeBand): string | undefined {
  if (action.resultLabels) return action.resultLabels[band];
  return inferredResultLabel(action);
}
