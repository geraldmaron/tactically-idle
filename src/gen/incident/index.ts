import { CALL_TREE_CONTENT_VERSION as INCIDENT_CONTENT_VERSION } from '../../content/call-trees';
import { SCENARIO_TYPES } from '../../content/scenario-types';
import { templateAt } from '../../content/incidents';
import { compileIncident } from './instance';
import { furnishedFamilyId } from '../building/furnishing';
import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import { buildLocation } from '../../sim/location';
import { hashSeed, next, pick } from '../../sim/rng';
import { ALL_BUILDING_FAMILIES, isProceduralFamily } from '../building';

export interface IncidentTypeInfo {
  type: IncidentType;
  label: string;
  families: string[];
  squads: [min: number, max: number];
}
/** Current call-tree content stamped in incident IDs and saves. */
export { CALL_TREE_CONTENT_VERSION as INCIDENT_CONTENT_VERSION } from '../../content/call-trees';
export const INCIDENT_TYPES = SCENARIO_TYPES;

/** The saved ID carries the entire deterministic seed tuple. */
export function incidentId(spec: IncidentSpec): string {
  return `gen:${spec.type}:${spec.familyId}:${spec.buildingSeed}:${spec.seed}:${spec.tier}:${spec.contentVersion}`;
}
export function parseIncidentId(id: string): IncidentSpec | null {
  const m = /^gen:([a-z_]+):([a-z0-9_]+):(\d+):(\d+):(\d+):(\d+)$/.exec(id);
  if (!m) return null;
  const [buildingSeed, seed, tier, contentVersion] = m.slice(3).map(Number);
  if (![buildingSeed, seed, tier, contentVersion].every(Number.isSafeInteger) || tier < 1 || tier > 5 || contentVersion !== INCIDENT_CONTENT_VERSION) return null;
  if (!SCENARIO_TYPES.some(info => info.type === m[1] && info.families.includes(m[2]))) return null;
  return { type: m[1] as IncidentType, familyId: m[2], buildingSeed, seed, tier, contentVersion };
}

/** Generated buildings vary in rooms, routes and floors, so not every building seed can
 * host every call. A call on a generated building is resolved lazily, when its
 * definition is first needed: the drawn seed, then further seeds of the same building
 * type from a hash stream, then the framework's authored locations. The incident ID
 * stays exactly as drawn (board draws and saves are unchanged); the definition records
 * the building actually used in locationFamilyId/locationSeed, which every run and map
 * reads. Deterministic, so the same ID always resolves to the same building. */
const HOSTING_SEEDS = 12;
export function generateIncident(spec: IncidentSpec): ScenarioDefinition {
  if (!isProceduralFamily(spec.familyId)) return generateIncidentAt(spec);
  const places: Pick<IncidentSpec, 'familyId' | 'buildingSeed'>[] = [{ familyId: spec.familyId, buildingSeed: spec.buildingSeed }];
  for (let attempt = 1; attempt < HOSTING_SEEDS; attempt++) places.push({ familyId: spec.familyId, buildingSeed: hashSeed(`${spec.buildingSeed}:${spec.seed}:host-v10:${attempt}`) });
  const authored = SCENARIO_TYPES.find(info => info.type === spec.type)?.families.filter(id => !isProceduralFamily(id)) ?? [];
  const start = authored.length ? hashSeed(`${spec.seed}:host-v10:authored`) % authored.length : 0;
  for (let k = 0; k < authored.length; k++) places.push({ familyId: authored[(start + k) % authored.length], buildingSeed: spec.buildingSeed });
  let failure: unknown = new Error('Unsupported incident and building combination');
  for (const place of places) {
    try {
      const hosted = generateIncidentAt({ ...spec, ...place });
      return place === places[0] ? hosted : { ...hosted, id: incidentId(spec), incident: { ...spec } };
    } catch (error) { failure = error; }
  }
  throw failure;
}

function generateIncidentAt(spec: IncidentSpec): ScenarioDefinition {
  if (!parseIncidentId(incidentId(spec))) throw new Error('Invalid incident specification');
  const locationFamilyId = furnishedFamilyId(spec.familyId);
  const built = buildLocation(locationFamilyId, spec.buildingSeed);
  if (built.issues.some((i) => i.severity === 'error')) throw new Error('Incident location is invalid');
  const template = templateAt(spec.type);
  if (!template) throw new Error('No current incident template');
  const tree = template.tree;
  // The compiler fills facts, stages and endings after placing the template's people.
  const scenario: ScenarioDefinition = {
    id: incidentId(spec), version: INCIDENT_CONTENT_VERSION, code: `CALL ${String(spec.seed % 10000).padStart(4, '0')}`,
    title: tree.title, setting: built.location.setting, locationFamilyId, locationSeed: spec.buildingSeed,
    summary: tree.summary, variantLabel: tree.title, pressureLabel: tree.pressureLabel,
    squadRange: { ...tree.squads },
    briefing: { known: [...tree.briefing.known], unknown: [...tree.briefing.unknown] },
    facts: [], objectives: tree.objectives.map(objective => ({ ...objective })), pressure: { ...tree.pressure },
    stages: {
      assess: { id: 'assess', label: 'Assess', prompt: '', actions: [] },
      adapt: { id: 'adapt', label: 'Adapt', prompt: '', actions: [] },
      resolve: { id: 'resolve', label: 'Resolve', prompt: '', actions: [] },
    },
    endings: {}, rewards: { ...tree.rewards }, incident: { ...spec },
  };
  return compileIncident(scenario, built, template);
}

export function drawIncidentSpec(
  rngState: number,
  ctx: { level: number; trust: number; avoidFamilies?: readonly string[]; avoidTypes?: readonly IncidentType[]; recentTypes?: readonly IncidentType[]; unlockedTypes?: readonly IncidentType[]; typeWeights?: Partial<Record<IncidentType, number>> },
): { spec: IncidentSpec; state: number } {
  let pool = SCENARIO_TYPES.flatMap(info => Array.from({ length: info.type === 'barricaded' ? 4 : 3 }, () => info));
  if (ctx.unlockedTypes) {
    const open = pool.filter(info => ctx.unlockedTypes!.includes(info.type));
    if (open.length) pool = open;
  }
  const unused = pool.filter(info => !ctx.avoidTypes?.includes(info.type));
  if (unused.length) pool = unused;
  const lessRecent = pool.filter(info => !ctx.recentTypes?.includes(info.type));
  if (lessRecent.length) pool = lessRecent;
  if (ctx.typeWeights) {
    const weights = ctx.typeWeights;
    pool = pool.flatMap(info => Array.from({ length: Math.min(8, Math.max(1, Math.round(weights[info.type] ?? 1))) }, () => info));
  }
  const type = pick(rngState, pool);
  const own = ALL_BUILDING_FAMILIES.map(info => info.id).filter(id => type.value.families.includes(id));
  const fresh = own.filter(id => !ctx.avoidFamilies?.includes(id));
  const family = pick(type.state, fresh.length ? fresh : own);
  const [info, familyId, drawn] = [type.value, family.value, family.state];
  const building = next(drawn);
  const seed = next(building.state);
  const tier = next(seed.state);
  const cap = Math.max(1, Math.min(5, 1 + Math.floor(ctx.level / 2), ctx.trust < 40 ? 2 : 5));
  const spec: IncidentSpec = { type: info.type, familyId, buildingSeed: Math.floor(building.value * 0x100000000), seed: Math.floor(seed.value * 0x100000000), tier: 1 + Math.floor(tier.value * cap), contentVersion: INCIDENT_CONTENT_VERSION };
  return { spec, state: tier.state };
}
