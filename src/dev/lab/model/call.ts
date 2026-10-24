// Scenario Lab call model (/lab). Pure helpers between the URL, the content catalog and the real
// operation engine: the call draw's URL fields, resolving a draw to its generated call, the content
// key, the day-one or full-kit start, path tokens and flat odds. Every odds figure and every result
// comes from the engine's own selectors and dispatcher through the content gates' driver
// (gen/incident/gates/engine-driver); nothing is re-implemented.
import { unlockRule } from '../../../content/unlocks';
import type { UnlockRule } from '../../../content/unlocks';
import { SCENARIO_TYPES } from '../../../content/scenario-types';
import { scenarioRecipe, scenarioSituations } from '../../../content/scenario-recipes';
import type { ScenarioCharacteristic, ScenarioSituation } from '../../../content/scenario-recipes';
import { ITEMS } from '../../../content/items';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import { ALL_BUILDING_FAMILIES } from '../../../gen/building';
import { generateIncident, incidentId, INCIDENT_CONTENT_VERSION, parseIncidentId } from '../../../gen/incident';
import { specForSituation } from '../../../gen/incident/gates/catalog';
import type { Variant } from '../../../gen/incident/gates/catalog';
import { NOW, startGateRun } from '../../../gen/incident/gates/engine-driver';
import type { Move } from '../../../gen/incident/gates/engine-driver';
import { getScenario } from '../../../sim/scenario-registry';
import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../../sim/scenario-types';
import { hashSeed } from '../../../sim/rng';
import type { ActionView, GameState, Id, OutcomeBand } from '../../../sim/types';

export { NOW };

// ---------------------------------------------------------------- catalog

export interface CatalogEntry {
  type: IncidentType;
  label: string;
  families: string[];
  rule: UnlockRule;

}

/** Every current tactical type, with buildings owned by its call tree. */
export const CATALOG: CatalogEntry[] = SCENARIO_TYPES.map(info => ({
  type: info.type, label: info.label, families: info.families,
  rule: unlockRule(info.type),
}));
export const catalogEntry = (type: string): CatalogEntry | undefined => CATALOG.find(entry => entry.type === type);

const FAMILY_INFO = new Map(ALL_BUILDING_FAMILIES.map(family => [family.id, family]));
export const familyLabel = (id: string): string => FAMILY_INFO.get(id)?.label ?? id;

export const situationsOf = (type: IncidentType): ScenarioSituation[] => scenarioSituations(type);

// ---------------------------------------------------------------- URL parameters

/** 'none': squad A deploys carrying nothing, as the items-none wiring probe restarts it.
 * 'day1': startGateRun exactly (one owned unit of each item a new department can field).
 * 'full': the same start with one unit of every non-support item, so options behind gear a
 * new department has not unlocked (firearms, less-lethal, door charges) can be evaluated. */
export type Kit = 'none' | 'day1' | 'full';

/** The kit as the lab's controls name it. */
export const KIT_WORDS: Record<Kit, string> = { none: 'No items', day1: 'Day one', full: 'Every item' };
export const isKit = (value: string | null): value is Kit => value === 'none' || value === 'day1' || value === 'full';

export interface LabParams {
  type: IncidentType;
  family: string;
  /** Building seed. */
  seed: number;
  variant: Variant;
  pacing: ScenarioCharacteristic;
  tier: number;
  /** Exact call seed; when set the situation is whatever this seed draws. */
  call: number | null;
  /** Exact incident ID (any supported content version); overrides every field above. */
  id: string | null;
  kit: Kit;
  /** Step-through moves, encoded by encodePath. */
  path: string;
}

const int = (value: string | null, fallback: number, lo: number, hi: number) => {
  const n = Number(value);
  return value !== null && value !== '' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.floor(n))) : fallback;
};

const HOSTING_SEEDS = new Map<string, number>();
/** The building seed a link without one opens: 7 where that building hosts the call, else the next that
 * does (a call that needs an upstairs, like the warrant, is not hosted by every house), so the default
 * link opens a call and not a notice that the generator moved it. */
function defaultSeed(type: IncidentType, family: string, variant: Variant, pacing: ScenarioCharacteristic, tier: number): number {
  const key = `${type}|${family}|${variant}|${pacing}|${tier}`;
  const known = HOSTING_SEEDS.get(key);
  if (known !== undefined) return known;
  let found = 7;
  for (let seed = 7; seed < 7 + 200; seed++) {
    try {
      const made = generateIncident(specForSituation(type, family, variant, seed, pacing, tier));
      if (made.locationSeed === seed && made.locationFamilyId.split('__')[0] === family) { found = seed; break; }
    } catch { /* this building cannot host the call; try the next */ }
  }
  HOSTING_SEEDS.set(key, found);
  return found;
}

export function readParams(q: URLSearchParams): LabParams {
  const entry = catalogEntry(q.get('type') ?? '') ?? CATALOG[0];
  const family = entry.families.includes(q.get('family') ?? '') ? q.get('family')! : entry.families[0];
  const situations = situationsOf(entry.type);
  const pacing: ScenarioCharacteristic = q.get('pacing') === 'deliberate_answers' ? 'deliberate_answers' : 'ordinary';
  let variant = int(q.get('variant'), 0, 0, 2) as Variant;
  if (!situations.some(s => s.variant === variant && s.characteristic === pacing)) variant = (situations.find(s => s.characteristic === pacing)?.variant ?? 0) as Variant;
  const tier = int(q.get('tier'), 2, 1, 5);
  const seedGiven = q.get('seed') !== null && q.get('seed') !== '';
  return {
    type: entry.type, family, seed: seedGiven ? int(q.get('seed'), 7, 0, 0xffffffff) : defaultSeed(entry.type, family, variant, pacing, tier), variant, pacing, tier,
    call: q.get('call') === null ? null : int(q.get('call'), 0, 0, 0xffffffff), id: q.get('id') || null,
    kit: isKit(q.get('kit')) ? q.get('kit') as Kit : 'day1', path: q.get('path') ?? '',
  };
}

/** Parameters for the URL, defaults left out so a shared link stays short. */
export function paramsToQuery(p: LabParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.id) out.id = p.id;
  else {
    out.type = p.type; out.family = p.family; out.seed = String(p.seed); out.tier = String(p.tier);
    if (p.call !== null) out.call = String(p.call);
    else { out.variant = String(p.variant); if (p.pacing !== 'ordinary') out.pacing = p.pacing; }
  }
  if (p.kit !== 'day1') out.kit = p.kit;
  if (p.path) out.path = p.path;
  return out;
}

// ---------------------------------------------------------------- the scenario

export interface Resolved {
  spec: IncidentSpec | null;
  id: string | null;
  scenario: ScenarioDefinition | null;
  error: string | null;
  situation: ScenarioSituation | null;
  recipeId: string | null;
}

export function resolveScenario(p: LabParams): Resolved {
  let spec: IncidentSpec | null = null;
  try {
    if (p.id) {
      spec = parseIncidentId(p.id);
      if (!spec) return { spec: null, id: p.id, scenario: null, error: `Not a valid current incident ID (version ${INCIDENT_CONTENT_VERSION})`, situation: null, recipeId: null };
    } else if (p.call !== null) spec = { type: p.type, familyId: p.family, buildingSeed: p.seed, seed: p.call, tier: p.tier, contentVersion: INCIDENT_CONTENT_VERSION };
    else spec = specForSituation(p.type, p.family, p.variant, p.seed, p.pacing, p.tier);
  } catch (error) {
    return { spec, id: null, scenario: null, error: String(error), situation: null, recipeId: null };
  }
  const id = incidentId(spec);
  let situation: ScenarioSituation | null = null, recipeId: string | null = null;
  // Recipes (situation and pacing) exist from content v9; older IDs predate them.
  try { const recipe = scenarioRecipe(spec); situation = { variant: recipe.variant, characteristic: recipe.characteristic }; recipeId = recipe.id; } catch { /* no recipe */ }
  try {
    // generateIncident first for its error message; the registry copy is the one the engine uses.
    generateIncident(spec);
    return { spec, id, scenario: getScenario(id), error: null, situation, recipeId };
  } catch (error) {
    return { spec, id, scenario: null, error: String(error), situation, recipeId };
  }
}

const CONTENT_KEYS = new WeakMap<object, string>();
/** A hash of the call tree and template a type draws from (FNV-1a over their JSON, plus its length);
 * it changes on any content edit (HMR replaces the template object), so cached runs and baselines
 * know they are stale. `none:<type>` for a type with no call tree. */
export function contentKey(type: IncidentType): string {
  const template = INCIDENT_TEMPLATES[type];
  if (!template) return `none:${type}`;
  let key = CONTENT_KEYS.get(template);
  if (!key) {
    const json = JSON.stringify(template);
    key = `${type}:${(hashSeed(json) >>> 0).toString(16).padStart(8, '0')}${json.length.toString(36)}`;
    CONTENT_KEYS.set(template, key);
  }
  return key;
}

// ---------------------------------------------------------------- runs

export const KIT_ITEMS_FULL: Id[] = Object.keys(ITEMS).filter(id => !ITEMS[id].supportOnly);

/** A live run of the call with squad A at the first entry. 'day1' is startGateRun itself;
 * 'full' is the same start with one unit of every item and 'none' with no items (same campaign
 * seed, so the same dice). */
export function startLabRun(id: string, kit: Kit, campaignSeed = 719): GameState {
  return kit === 'day1' ? startGateRun(id, campaignSeed) : startGateRun(id, campaignSeed, { items: kit === 'full' ? KIT_ITEMS_FULL : [] });
}

/** A step: a decision aimed at a band, a decision with the run's own dice ('roll'), a free
 * stage continuation, or the failed-response report. An aimed decision may also name its drawn
 * results (`drawn`): compiled variant keys in the band's effect order (`['firearm:none']`,
 * `['wounded']`, `['follows+stays']`); without them the band's sample fixes them. */
export interface LabMove { kind: 'decide' | 'roll' | 'fail' | 'lapse'; actionId: string; band?: OutcomeBand; drawn?: string[] }

/** Path tokens: `actionId~band`, `actionId~roll|continue|fail`, `threatId~lapse` (the decision
 * point's time runs out with no choice made, the threat named by its node), and an aimed decision's drawn
 * results after its band, each after a `/`: `actionId~adverse/firearm:none/wounded`. No action id,
 * band or drawn key contains `/`, and the URL keeps it unescaped. A cascade key's `+` is written `.`
 * (`follows.stays`), since a query string reads `+` as a space; `.`, `+` and a space all read back
 * as `+`. Everything before the last `~` is the action id, as before. */
export function encodePath(moves: LabMove[]): string {
  return moves.map(m => `${m.actionId}~${m.kind === 'decide' ? m.band : m.kind}${m.kind === 'decide' && m.drawn?.length ? `/${m.drawn.map(key => key.replace(/\+/g, '.')).join('/')}` : ''}`).join(',');
}
export function decodePath(text: string): LabMove[] {
  return text.split(',').filter(Boolean).flatMap((token): LabMove[] => {
    const at = token.lastIndexOf('~');
    if (at <= 0) return [];
    const actionId = token.slice(0, at), [tail, ...drawn] = token.slice(at + 1).split('/');
    if (tail === 'favorable' || tail === 'mixed' || tail === 'adverse') {
      if (drawn.some(key => !key.trim())) return [];
      return [{ kind: 'decide', actionId, band: tail, ...drawn.length ? { drawn: drawn.map(key => key.trim().replace(/[. ]/g, '+')) } : {} }];
    }
    if (drawn.length) return [];
    if (tail === 'roll' || tail === 'fail' || tail === 'lapse') return [{ kind: tail, actionId }];
    return [];
  });
}

export const toLab = (move: Move): LabMove => move.kind === 'decide' ? { kind: 'decide', actionId: move.actionId, band: move.band } : { kind: move.kind, actionId: move.actionId };

// ---------------------------------------------------------------- odds review

export const FLAT_POINTS = 0.05;
export const HIGH_ODDS = 0.9;

export interface Flatness {
  eligible: number;
  /** Eligible options whose favourable odds are within FLAT_POINTS of each other. */
  pairs: { a: string; b: string; diff: number }[];
  /** Every eligible option is at least HIGH_ODDS favourable (two or more options). */
  allHigh: boolean;
  flatIds: Set<string>;
}

export function flatness(views: ActionView[]): Flatness {
  const eligible = views.filter(view => view.eligible);
  const pairs: Flatness['pairs'] = [];
  for (let i = 0; i < eligible.length; i++) for (let j = i + 1; j < eligible.length; j++) {
    const diff = Math.abs(eligible[i].likelihood.favorable - eligible[j].likelihood.favorable);
    if (diff <= FLAT_POINTS + 1e-9) pairs.push({ a: eligible[i].id, b: eligible[j].id, diff });
  }
  return {
    eligible: eligible.length, pairs, flatIds: new Set(pairs.flatMap(pair => [pair.a, pair.b])),
    allHigh: eligible.length >= 2 && eligible.every(view => view.likelihood.favorable >= HIGH_ODDS),
  };
}
