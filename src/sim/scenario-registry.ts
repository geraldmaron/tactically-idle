// Single lookup for authored and generated scenarios. Every module resolves a
// scenario id through here (never SCENARIOS[id] directly) so generated incidents
// work everywhere. Generated scenarios are memoized by id.
import type { Id } from './types';
import type { ScenarioDefinition } from './scenario-types';
import { SCENARIOS } from '../content/scenarios';
import { generateIncident, parseIncidentId } from '../gen/incident';

const cache = new Map<Id, ScenarioDefinition>();

export function getScenario(id: Id): ScenarioDefinition | null {
  const authored = SCENARIOS[id];
  if (authored) return authored;
  const hit = cache.get(id);
  if (hit) return hit;
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
