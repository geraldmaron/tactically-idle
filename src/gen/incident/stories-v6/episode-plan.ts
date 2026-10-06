import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation } from '../../../sim/types';
import { hashSeed } from '../../../sim/rng';
import { scenarioRecipe } from '../../../content/scenario-recipes';

/** A whole compatible situation, not independently shuffled motive fragments. */
export interface EpisodePlan {
  id: string;
  type: IncidentType;
  variant: 0 | 1 | 2;
  cast: Record<string, string>;
  environment: NonNullable<ScenarioDefinition['environment']>;
}
export interface AppliedEpisodeModule {
  variantId: string;
  modules: string[];
  publicContext: string[];
}
const CAST: Partial<Record<IncidentType, readonly Record<string, string>[]>> = {
  welfare_check: [{}, { 'Ada Reyes': 'Leah Moreno', Ada: 'Leah', 'Len Moss': 'Owen Bell', Len: 'Owen' }, { 'Ada Reyes': 'Nora Singh', Ada: 'Nora', 'Len Moss': 'Amir West', Len: 'Amir' }],
  medical_complication: [{}, { 'Rosa Bell': 'Helen Duarte', Rosa: 'Helen', 'Daniel Price': 'Samir Cole', Daniel: 'Samir' }, { 'Rosa Bell': 'Imani Reed', Rosa: 'Imani', 'Daniel Price': 'Jonas Hart', Daniel: 'Jonas' }],
  barricaded: [{}, { 'Mina Voss': 'Elena Hart', Mina: 'Elena', 'Cal Voss': 'Adrian Hart', Cal: 'Adrian' }, { 'Mina Voss': 'Sana Patel', Mina: 'Sana', 'Cal Voss': 'Ravi Patel', Cal: 'Ravi' }],
  active_armed_incident: [{}, { 'Eli Tran': 'Noah Ramos', Eli: 'Noah', Grant: 'Colin' }, { 'Eli Tran': 'Daniel Mensah', Eli: 'Daniel', Grant: 'Vincent' }],
  hostage_crisis: [{}, { 'Ben Flores': 'Omar Ellis', Ben: 'Omar', 'Mara Holt': 'Celia Brooks', Mara: 'Celia', Lewis: 'Aaron' }, { 'Ben Flores': 'Jonah Reed', Ben: 'Jonah', 'Mara Holt': 'Nadia Chen', Mara: 'Nadia', Lewis: 'Simon' }],
  protected_rescue: [{}, { 'Jun Park': 'Alex Rivera', Jun: 'Alex' }, { 'Jun Park': 'Robin Ahmed', Jun: 'Robin' }],
};
export function planEpisode(spec: IncidentSpec, _built: BuiltLocation): EpisodePlan {
  const cast = CAST[spec.type];
  if (!cast) throw new Error('No compatible episode recipe');
  const key = `${spec.type}:${spec.familyId}:${spec.seed}:v6`;
  const variant = spec.contentVersion >= 9 ? scenarioRecipe(spec).variant : hashSeed(`${key}:situation`) % 3 as 0 | 1 | 2;
  // A quiet evening is a premise constraint for the repeated-report story. Other
  // compatible scenes can occur by day or night; lighting has real engine effects.
  const timeOfDay = spec.type === 'welfare_check' ? 'night' : hashSeed(`${key}:light`) % 2 ? 'day' : 'night';
  return { id: `${spec.type}:${variant}:${spec.seed}`, type: spec.type, variant, cast: spec.contentVersion >= 9 ? {} : cast[hashSeed(`${key}:cast`) % cast.length],
    environment: { timeOfDay, weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: spec.type === 'medical_complication', plansOnFile: false, alarm: 'none', cctv: false } };
}
/** Only display strings are rebound. IDs, flags, truth and capability rules stay opaque. */
export function bindEpisodeCast(s: ScenarioDefinition, replacements: Record<string, string>): ScenarioDefinition {
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  if (!keys.length) return s;
  const pattern = new RegExp(`\\b(?:${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
  const visit = (value: unknown): unknown => typeof value === 'string' ? value.replace(pattern, m => replacements[m]) : Array.isArray(value) ? value.map(visit) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k, visit(v)])) : value;
  return visit(s) as ScenarioDefinition;
}

/** Explicit display-field traversal. Machine IDs, conditions, flags, routes and
 * selectors are never interpolated. Legacy v6–v8 retain their original binder.
 */
export function bindScenarioText(input: ScenarioDefinition, replacements: Record<string, string>): ScenarioDefinition {
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b(?:${keys.map(escape).join('|')})\\b`, 'g');
  return mapScenarioText(input, value => keys.length ? value.replace(pattern, match => replacements[match]) : value);
}

/** The same display-field traversal with any text function (v11 setting modules replace
 * whole authored sentences, which word-boundary matching cannot end on punctuation). */
export function mapScenarioText(input: ScenarioDefinition, text: (value: string) => string): ScenarioDefinition {
  const s = structuredClone(input);
  const fields = <T extends object>(value: T, names: readonly (keyof T)[]) => {
    for (const key of names) if (typeof value[key] === 'string') value[key] = text(value[key] as string) as T[keyof T];
  };
  fields(s, ['title', 'summary', 'variantLabel', 'pressureLabel']);
  s.briefing.known = s.briefing.known.map(text); s.briefing.unknown = s.briefing.unknown.map(text);
  fields(s.briefing, ['dispatchReason']);
  if (s.briefing.teamResponsibilities) s.briefing.teamResponsibilities = s.briefing.teamResponsibilities.map(text);
  for (const f of s.facts) {
    fields(f, ['label', 'markerSource', 'claim', 'source', 'note', 'reportedText', 'uncertainty']);
    fields(f.markers, ['unknown', 'reported', 'confirmed', 'disproved']);
    if (f.resolved) fields(f.resolved, ['confirmed', 'disproved']);
    if (f.person) fields(f.person, ['label']);
  }
  for (const o of s.objectives) fields(o, ['label']);
  for (const c of s.civilianOutcomes ?? []) fields(c, ['label']);
  for (const service of s.externalServices ?? []) fields(service, ['label', 'description']);
  if (s.difficulty) s.difficulty.drivers = s.difficulty.drivers.map(text);
  for (const stage of Object.values(s.stages)) {
    fields(stage, ['label', 'prompt']);
    for (const entry of stage.contextPrompts ?? []) fields(entry, ['prompt']);
    for (const a of stage.actions) {
      fields(a, ['title', 'summary', 'task', 'hazardReason']);
      for (const map of [a.outcomePreview, a.resultLabels]) if (map) fields(map, ['favorable', 'mixed', 'adverse']);
      for (const list of [a.requires.facts, a.requires.flags, a.requires.notFlags, a.requires.storyProps, a.requires.externalSupport])
        for (const item of list ?? []) fields(item, ['reason']);
      if (a.requires.minSquads) fields(a.requires.minSquads, ['reason']);
      for (const opening of a.requires.openings ?? []) fields(opening, ['blockedReason', 'lockedNote']);
      for (const list of [a.equipment, a.modifiers]) for (const item of list ?? []) fields(item, ['label']);
      if (a.certBonus) fields(a.certBonus, ['label']);
      if (a.support) fields(a.support, ['label', 'task']);
      if (a.spatial) fields(a.spatial, ['noun']);
      for (const effect of Object.values(a.outcomes).flat()) {
        fields(effect, ['text']); if (effect.officerHarm) fields(effect.officerHarm, ['label']);
      }
    }
  }
  for (const ending of Object.values(s.endings)) {
    fields(ending, ['title', 'summary']); if (ending.remainingTasks) ending.remainingTasks = ending.remainingTasks.map(text);
  }
  if (s.story) {
    if (s.story.episode) s.story.episode.publicContext = s.story.episode.publicContext.map(text);
    for (const person of Object.values(s.story.bindings.people)) {
      fields(person, ['label']);
      for (const transition of person.transitions) {
        fields(transition, ['label']); if ('label' in transition.to) fields(transition.to, ['label']);
      }
    }
    for (const prop of Object.values(s.story.bindings.props)) fields(prop, ['label']);
  }
  return s;
}
