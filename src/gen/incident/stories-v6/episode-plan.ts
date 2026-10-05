import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation } from '../../../sim/types';
import { hashSeed } from '../../../sim/rng';

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
  const variant = hashSeed(`${key}:situation`) % 3 as 0 | 1 | 2;
  // A quiet evening is a premise constraint for the repeated-report story. Other
  // compatible scenes can occur by day or night; lighting has real engine effects.
  const timeOfDay = spec.type === 'welfare_check' ? 'night' : hashSeed(`${key}:light`) % 2 ? 'day' : 'night';
  return { id: `${spec.type}:${variant}:${spec.seed}`, type: spec.type, variant, cast: cast[hashSeed(`${key}:cast`) % cast.length],
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
