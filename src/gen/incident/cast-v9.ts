import { AMERICAN_ENGLISH } from '../../content/american-english';
import { ADDITIONAL_FRAMEWORKS } from '../../content/incident-frameworks-v9';
import { SCENARIO_FIRST_NAMES, SCENARIO_SURNAMES } from '../../content/scenario-names';
import { hashSeed } from '../../sim/rng';
import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import { applyRecipeCharacteristic } from './characteristics-v9';
import { bindScenarioText } from './stories-v6/episode-plan';

export interface CastSlot {
  /** Stable role key; prose names must never serve as entity IDs. */
  id: string;
  authoredName: string;
  pronouns: keyof typeof SCENARIO_FIRST_NAMES;
  /** Explicit relationship constraint, independent of danger or behavior. */
  surnameGroup?: string;
}
/** Register cast slots alongside the existing geometry and coherent episode recipes.
 * Pronouns agree with authored sentences; new pronoun variants need reviewed prose.
 */
export const SCENARIO_CAST: Partial<Record<IncidentType, readonly CastSlot[]>> = {
  ...Object.fromEntries(ADDITIONAL_FRAMEWORKS.map(framework => [framework.type, [{ id: framework.personId, authoredName: framework.name, pronouns: 'they' as const }]])),
  welfare_check: [{ id: 'ada', authoredName: 'Ada Reyes', pronouns: 'she' }, { id: 'len', authoredName: 'Len Moss', pronouns: 'he' }],
  medical_complication: [{ id: 'rosa', authoredName: 'Rosa Bell', pronouns: 'she' }, { id: 'daniel', authoredName: 'Daniel Price', pronouns: 'he' }],
  barricaded: [{ id: 'mina', authoredName: 'Mina Voss', pronouns: 'she', surnameGroup: 'voss' }, { id: 'cal', authoredName: 'Cal Voss', pronouns: 'he', surnameGroup: 'voss' }],
  active_armed_incident: [{ id: 'eli', authoredName: 'Eli Tran', pronouns: 'he' }, { id: 'grant', authoredName: 'Grant', pronouns: 'he' }],
  hostage_crisis: [{ id: 'ben', authoredName: 'Ben Flores', pronouns: 'he' }, { id: 'mara', authoredName: 'Mara Holt', pronouns: 'she' }, { id: 'lewis', authoredName: 'Lewis', pronouns: 'he' }],
  protected_rescue: [{ id: 'jun', authoredName: 'Jun Park', pronouns: 'they' }],
};
export interface CastIdentity { firstName: string; surname: string; pronouns: CastSlot['pronouns'] }

/** Independent cosmetic stream: adding names cannot consume a mechanics RNG draw. */
export function drawScenarioCast(spec: IncidentSpec): Record<string, CastIdentity> {
  const slots = SCENARIO_CAST[spec.type];
  if (!slots) throw new Error(`No cast recipe for ${spec.type}`);
  const key = `${spec.type}:${spec.familyId}:${spec.buildingSeed}:${spec.seed}:cast-v9`;
  const used = new Set<string>();
  const cast: Record<string, CastIdentity> = {};
  for (const slot of slots) {
    const names = SCENARIO_FIRST_NAMES[slot.pronouns].filter(name => !used.has(name));
    if (!names.length) throw new Error(`Name pool exhausted for ${slot.id}`);
    const firstName = names[hashSeed(`${key}:${slot.id}:first`) % names.length];
    used.add(firstName);
    const surname = SCENARIO_SURNAMES[hashSeed(`${key}:${slot.surnameGroup ?? slot.id}:surname`) % SCENARIO_SURNAMES.length];
    cast[slot.id] = { firstName, surname, pronouns: slot.pronouns };
  }
  return cast;
}

/** Bind once, after every scene/decision module, so later care choices share the same names. */
export function withVersionNineCast(input: ScenarioDefinition): ScenarioDefinition {
  const source = structuredClone(input);
  applyRecipeCharacteristic(source);
  const spec = source.incident!;
  const cast = drawScenarioCast(spec);
  const replacements: Record<string, string> = {};
  for (const slot of SCENARIO_CAST[spec.type]!) {
    const name = cast[slot.id];
    replacements[slot.authoredName] = `${name.firstName} ${name.surname}`;
    replacements[slot.authoredName.split(' ')[0]] = name.firstName;
  }
  const scenario = bindScenarioText(bindScenarioText(source, AMERICAN_ENGLISH), replacements);
  scenario.version = 9;
  scenario.story!.cast = cast;
  // Short-only authored names still have a full public identity in the inspector.
  for (const [id, person] of Object.entries(scenario.story!.bindings.people)) {
    const name = cast[id];
    if (name) {
      person.label = `${name.firstName} ${name.surname}`;
      const fact = scenario.facts.find(fact => fact.id === person.locationFactId);
      if (fact?.person) fact.person.label = person.label;
    }
  }
  return scenario;
}
