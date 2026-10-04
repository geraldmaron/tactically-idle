// Single lookup for authored and generated scenarios. Every module resolves a
// scenario id through here (never SCENARIOS[id] directly) so generated incidents
// work everywhere. Generated scenarios are memoized by id.
import type { Id } from './types';
import type { ScenarioDefinition } from './scenario-types';
import { SCENARIOS } from '../content/scenarios';
import { generateIncident, parseIncidentId } from '../gen/incident';
import { DECISION_EXERCISES, LEGACY_DECISION_EXERCISES } from '../content/scenarios/decision-exercises';

const cache = new Map<Id, ScenarioDefinition>();

export function getScenario(id: Id): ScenarioDefinition | null {
  const authored = SCENARIOS[id];
  if (authored) return authored;
  const hit = cache.get(id);
  if (hit) return hit;
  const exercise = [...DECISION_EXERCISES, ...LEGACY_DECISION_EXERCISES].find((entry) => entry.id === id);
  if (exercise) {
    const generated = generateIncident(exercise.spec);
    const scenario = exercise.spec.contentVersion >= 5
      ? { ...generated, id, code: exercise.code, practiceOnly: true }
      : { ...generated, id, code: exercise.code, title: exercise.title, summary: exercise.summary, variantLabel:'Decision exercise', practiceOnly:true };
    cache.set(id, scenario);
    return scenario;
  }
  const spec = parseIncidentId(id);
  if (!spec) return null;
  try {
    const s = generateIncident(spec);
    cache.set(id, s);
    return s;
  } catch {
    return null;
  }
}
