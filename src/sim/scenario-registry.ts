// Single lookup for authored and generated scenarios. Every module resolves a
// scenario id through here (never SCENARIOS[id] directly) so generated incidents
// work everywhere. Generated scenarios are memoized by id.
import type { Id } from './types';
import type { ScenarioDefinition } from './scenario-types';
import { SCENARIOS } from '../content/scenarios';
import { generateIncident, parseIncidentId } from '../gen/incident';
import { admitScenario } from '../content/policy';
import { mapScenarioText } from '../gen/incident/scenario-text';

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

// What a screen reads. The simulation keeps the raw text (`getScenario`, which every rule and every write uses);
// the player's text choices, strong language today, are applied on the way to the screen. The UI installs the
// presenter once (ui/language.ts). `key` names the choice in force, so a changed setting is a new reading and
// the same choice reuses its reading.
export interface TextPresenter {
  key: () => string;
  text: (text: string) => string;
}
let presenter: TextPresenter | null = null;
const read = new Map<string, WeakMap<ScenarioDefinition, ScenarioDefinition>>();

export function setTextPresenter(next: TextPresenter | null): void {
  presenter = next;
  read.clear();
}

/** A line of recorded text as the player should read it. Text a run saved at the time is raw, so screens pass it here. */
export const presentText = (text: string): string => (presenter ? presenter.text(text) : text);

/** `getScenario` for a screen or a selector that feeds one: the same scenario with every display field presented. */
export const readScenario = (id: Id): ScenarioDefinition | null => presentScenario(getScenario(id));

/** A scenario with every display field presented (the same object while nothing needs changing). */
export function presentScenario(raw: ScenarioDefinition | null): ScenarioDefinition | null {
  if (!raw || !presenter) return raw;
  const key = presenter.key();
  if (key === '') return raw;
  const bucket = read.get(key) ?? read.set(key, new WeakMap()).get(key)!;
  const hit = bucket.get(raw);
  if (hit) return hit;
  const shown = mapScenarioText(raw, presenter.text);
  bucket.set(raw, shown);
  return shown;
}
