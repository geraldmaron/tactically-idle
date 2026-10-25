// Single lookup for authored and generated scenarios. Every module resolves a
// scenario id through here (never SCENARIOS[id] directly) so generated incidents
// work everywhere. Generated scenarios are memoized by id.
import type { Id } from './types';
import type { ScenarioDefinition } from './scenario-types';
import { SCENARIOS } from '../content/scenarios';
import { generateIncident, parseIncidentId } from '../gen/incident';
import { admitScenario } from '../content/policy';

const cache = new Map<Id, ScenarioDefinition>();
/** Authored scenarios the content policy has already read (it reads each once, as it reads a generated one). */
const admitted = new Set<Id>();

// The content policy's runtime boundary (docs/content-policy.md): a scenario with a blocking finding in any
// string, authored or generated, is not returned, so no screen can show it.
export function getScenario(id: Id): ScenarioDefinition | null {
  const authored = SCENARIOS[id];
  if (authored) {
    if (admitted.has(id)) return authored;
    if (!admitScenario(id, authored)) return null;
    admitted.add(id);
    return authored;
  }
  const hit = cache.get(id);
  if (hit) return hit;
  const spec = parseIncidentId(id);
  if (!spec) return null;
  try {
    const s = generateIncident(spec);
    if (!admitScenario(id, s)) return null;
    cache.set(id, s);
    return s;
  } catch {
    return null;
  }
}
