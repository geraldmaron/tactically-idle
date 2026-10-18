// Finding a call or a squad that has what a check needs (spec 3.2 Director, 6.4 fixes). A call's
// situation, pacing, group sizes and turns are all hash draws of its call seed, so the search reads
// them without generating anything (scenarioRecipe, drawMemberCounts, resolveNext); only a seed that
// matches is generated, once, to check its building can host it. A squad's certs come from the
// day-one roster of a campaign seed.
import type { ScenarioCharacteristic } from '../../../content/scenario-recipes';
import { scenarioRecipe } from '../../../content/scenario-recipes';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { INCIDENT_CONTENT_VERSION, incidentId } from '../../../gen/incident';
import { specForSituation } from '../../../gen/incident/gates/catalog';
import { NOW } from '../../../gen/incident/gates/engine-driver';
import { drawMemberCounts, instanceOf } from '../../../gen/incident/instance';
import { resolveNext } from '../../../gen/incident/trees-v13/compile';
import { createInitialState } from '../../../sim/department';
import { buildLocation } from '../../../sim/location';
import { getScenario } from '../../../sim/scenario-registry';
import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../../sim/scenario-types';
import type { LabCall } from '../types';

export interface DrawWant { variant?: 0 | 1 | 2; pacing?: ScenarioCharacteristic; turns?: Record<string, string>; counts?: Record<string, number> }

/** The call a Director or call strip search keeps the rest of: the open call's own seed, else the
 * URL's call seed, else its situation and pacing draw. */
export function seekBase(draw: LabCall, session: { resolved: { spec?: { seed: number } | null } } | null): Parameters<typeof seekCallSeed>[1] {
  const keep = session?.resolved.spec ? { call: session.resolved.spec.seed } : draw.call !== null ? { call: draw.call } : { variant: draw.variant, pacing: draw.pacing };
  return { family: draw.family, seed: draw.seed, tier: draw.tier, ...keep };
}

/** How far a search looks by default: every turn member and group size turns up well within it. */
export const CALL_SEEK_LIMIT = 20000;
export const SQUAD_SEEK_LIMIT = 500;

/** The draw a call seed makes: situation, pacing, group sizes and the node each turn group drew. */
export function drawOf(template: IncidentTemplate, spec: IncidentSpec): Required<DrawWant> {
  const recipe = scenarioRecipe(spec);
  const turns = Object.fromEntries(Object.keys(template.tree.turns ?? {}).map(group => [group, (resolveNext(template.tree, { turn: group }, spec.seed) as { node: string }).node]));
  return { variant: recipe.variant, pacing: recipe.characteristic, counts: drawMemberCounts(template, spec), turns };
}

function matches(draw: Required<DrawWant>, want: DrawWant): boolean {
  return (want.variant === undefined || draw.variant === want.variant) && (want.pacing === undefined || draw.pacing === want.pacing)
    && Object.entries(want.counts ?? {}).every(([group, n]) => draw.counts[group] === n)
    && Object.entries(want.turns ?? {}).every(([group, node]) => draw.turns[group] === node);
}

/** The generated call, when the drawn building hosts it in place (generation moves a call it can't
 * host to another seed; a search keeps looking instead). */
function hostedInPlace(spec: IncidentSpec): ScenarioDefinition | null {
  const scenario = getScenario(incidentId(spec));
  return scenario && scenario.locationFamilyId.split('__')[0] === spec.familyId && scenario.locationSeed === spec.buildingSeed ? scenario : null;
}

/** The first names of the tree's roles in a call, for "names Lee → Omar". */
function namesOf(template: IncidentTemplate, scenario: ScenarioDefinition | null): Record<string, string> {
  if (!scenario) return {};
  const instance = instanceOf(scenario, buildLocation(scenario.locationFamilyId, scenario.locationSeed));
  return Object.fromEntries(template.tree.roles.flatMap(role => { const who = instance?.placed.cast[role.id]; return who ? [[role.id, who.firstName]] : []; }));
}

/** The nearest call seed (from `from`, default the base call seed, upwards) whose draw has what
 * `want` asks and keeps the rest of the base call's draw: its situation, pacing, group sizes and
 * turns are never overridden. The base call is `base.call`, or the seed the situation draw picks
 * when `base.variant` is given; with neither, only `want` constrains the search. `changed` names
 * what else the new seed changes ("names Lee → Omar"). Null when no seed within `limit` (20,000)
 * matches and hosts on this building. */
export function seekCallSeed(type: IncidentType, base: { family: string; seed: number; tier: number; call?: number; variant?: 0 | 1 | 2; pacing?: ScenarioCharacteristic }, want: DrawWant,
  opts: { from?: number; limit?: number } = {}): { call: number; changed: string[] } | null {
  const template = INCIDENT_TEMPLATES[type];
  if (!template) return null;
  const specAt = (call: number): IncidentSpec => ({ type, familyId: base.family, buildingSeed: base.seed, seed: call, tier: base.tier, contentVersion: INCIDENT_CONTENT_VERSION });
  const baseCall = base.call ?? (base.variant !== undefined ? specForSituation(type, base.family, base.variant, base.seed, base.pacing ?? 'ordinary', base.tier).seed : undefined);
  const kept: DrawWant = baseCall === undefined ? {} : drawOf(template, specAt(baseCall));
  const wanted: DrawWant = { variant: want.variant ?? kept.variant, pacing: want.pacing ?? kept.pacing,
    counts: { ...kept.counts, ...want.counts }, turns: { ...kept.turns, ...want.turns } };
  const from = Math.max(0, Math.floor(opts.from ?? baseCall ?? 0));
  const limit = opts.limit ?? CALL_SEEK_LIMIT;
  for (let call = from; call < from + limit; call++) {
    const spec = specAt(call);
    if (!matches(drawOf(template, spec), wanted)) continue;
    const scenario = hostedInPlace(spec);
    if (!scenario) continue;
    const changed: string[] = [];
    if (baseCall !== undefined && call !== baseCall) {
      const before = namesOf(template, getScenario(incidentId(specAt(baseCall)))), after = namesOf(template, scenario);
      const renamed = template.tree.roles.filter(role => before[role.id] && after[role.id] && before[role.id] !== after[role.id]).slice(0, 3);
      if (renamed.length) changed.push(`names ${renamed.map(role => `${before[role.id]} → ${after[role.id]}`).join(', ')}`);
    }
    return { call, changed };
  }
  return null;
}

/** The first campaign seed (from `from`, default 1) whose day-one squad A holds `cert`, trying at most
 * `limit` (500) seeds. */
export function seekSquadSeed(cert: string, opts: { from?: number; limit?: number } = {}): { seed: number | null; tried: number } {
  const from = Math.max(0, Math.floor(opts.from ?? 1));
  const limit = opts.limit ?? SQUAD_SEEK_LIMIT;
  for (let k = 0; k < limit; k++) {
    const state = createInitialState(NOW, from + k);
    const squad = state.squads.find(entry => entry.id === 'A');
    if (squad?.officerIds.some(id => (state.officers[id]?.certs as readonly string[] | undefined)?.includes(cert))) return { seed: from + k, tried: k + 1 };
  }
  return { seed: null, tried: limit };
}
