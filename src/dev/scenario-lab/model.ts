// Scenario lab model (/story.html). Pure helpers between the URL, the content catalog and the
// real operation engine. Every odds figure and every result here comes from the engine's own
// selectors and dispatcher through the content gates' driver (gen/incident/gates/engine-driver);
// nothing is re-implemented, and a forced band is applied only when the engine produces it.
import { RETIRED_FROM_DISPATCH, unlockRule } from '../../content/unlocks';
import type { UnlockRule } from '../../content/unlocks';
import { SCENARIO_TYPES_V11 } from '../../content/scenario-types-v11';
import { SCENARIO_TYPES_V10 } from '../../content/scenario-types-v10';
import { ADDITIONAL_FRAMEWORK_BY_TYPE } from '../../content/incident-frameworks-v9';
import { scenarioRecipe, scenarioSituationsV10 } from '../../content/scenario-recipes';
import type { ScenarioCharacteristic, ScenarioSituation } from '../../content/scenario-recipes';
import { ITEMS } from '../../content/items';
import { ALL_BUILDING_FAMILIES } from '../../gen/building';
import { generateIncident, incidentId, INCIDENT_CONTENT_VERSION, parseIncidentId } from '../../gen/incident';
import { specForSituation } from '../../gen/incident/gates/catalog';
import type { Variant } from '../../gen/incident/gates/catalog';
import { applyMove, applyNaturalMove, availableMoves, NOW, startGateRun } from '../../gen/incident/gates/engine-driver';
import type { Move } from '../../gen/incident/gates/engine-driver';
import { createInitialState } from '../../sim/department';
import { buildLocation } from '../../sim/location';
import { actionViews } from '../../sim/operation-selectors';
import { FALLBACK_ENDING } from '../../sim/operation';
import { isGenericResponseExit } from '../../sim/response-failure';
import { getScenario } from '../../sim/scenario-registry';
import type { IncidentSpec, IncidentType, OutcomeEffect, ScenarioDefinition } from '../../sim/scenario-types';
import { apply, startCmd, stockKit } from '../../sim/test-fixtures';
import type { ActionView, GameState, Id, OutcomeBand, StageId } from '../../sim/types';

export { FALLBACK_ENDING, NOW };
export const STAGES: readonly StageId[] = ['assess', 'adapt', 'resolve'];
export const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

// ---------------------------------------------------------------- catalog

export interface CatalogEntry {
  type: IncidentType;
  label: string;
  families: string[];
  squads: [number, number];
  rule: UnlockRule;
  /** In RETIRED_FROM_DISPATCH: still generates and loads, never drawn as a new live call. */
  retired: boolean;
  /** Typed framework package (frameworks-v9) or a hand-authored story (stories-v5/v6). */
  source: 'typed' | 'story';
  /** First content version that lists the type in its current form. */
  since: number;
}

/** Every type the current content version draws from: the v11 catalog, which v12 keeps
 * (drawIncidentSpec reads SCENARIO_TYPES_V11 from v11 on). */
export const CATALOG: CatalogEntry[] = SCENARIO_TYPES_V11.map(info => ({
  type: info.type, label: info.label, families: info.families, squads: info.squads,
  rule: unlockRule(info.type), retired: RETIRED_FROM_DISPATCH.has(info.type),
  source: ADDITIONAL_FRAMEWORK_BY_TYPE[info.type] ? 'typed' : 'story',
  since: SCENARIO_TYPES_V10.some(entry => entry.type === info.type) ? 9 : 11,
}));
export const catalogEntry = (type: string): CatalogEntry | undefined => CATALOG.find(entry => entry.type === type);

const FAMILY_INFO = new Map(ALL_BUILDING_FAMILIES.map(family => [family.id, family]));
export const familyLabel = (id: string): string => FAMILY_INFO.get(id)?.label ?? id;
export const familyGeneration = (id: string): string => /_g\d+$/.test(id) ? `generated ${id.slice(-2)}` : 'authored';

export function ruleText(rule: UnlockRule): string {
  const parts = [`level ${rule.level}`];
  if (rule.anyCert?.length) parts.push(`any cert: ${rule.anyCert.join(' / ')}`);
  if (rule.anyItem?.length) parts.push(`any item: ${rule.anyItem.join(' / ')}`);
  return parts.join(' · ');
}

export const situationsOf = (type: IncidentType): ScenarioSituation[] => scenarioSituationsV10(type);
export const situationKey = (s: ScenarioSituation) => `${s.variant}/${s.characteristic}`;
export const pacingLabel = (c: ScenarioCharacteristic) => c === 'deliberate_answers' ? 'thinks before answering' : 'ordinary pacing';

// ---------------------------------------------------------------- URL parameters

/** 'day1': startGateRun exactly (one owned unit of each item a new department can field).
 * 'full': the same start with one unit of every non-support item, so options behind gear a
 * new department has not unlocked (firearms, less-lethal, door charges) can be evaluated. */
export type Kit = 'day1' | 'full';

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

export function readParams(q: URLSearchParams): LabParams {
  const entry = catalogEntry(q.get('type') ?? '') ?? CATALOG[0];
  const family = entry.families.includes(q.get('family') ?? '') ? q.get('family')! : entry.families[0];
  const situations = situationsOf(entry.type);
  const pacing: ScenarioCharacteristic = q.get('pacing') === 'deliberate_answers' ? 'deliberate_answers' : 'ordinary';
  let variant = int(q.get('variant'), 0, 0, 2) as Variant;
  if (!situations.some(s => s.variant === variant && s.characteristic === pacing)) variant = (situations.find(s => s.characteristic === pacing)?.variant ?? 0) as Variant;
  return {
    type: entry.type, family, seed: int(q.get('seed'), 7, 0, 0xffffffff), variant, pacing, tier: int(q.get('tier'), 2, 1, 5),
    call: q.get('call') === null ? null : int(q.get('call'), 0, 0, 0xffffffff), id: q.get('id') || null,
    kit: q.get('kit') === 'full' ? 'full' : 'day1', path: q.get('path') ?? '',
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
      if (!spec) return { spec: null, id: p.id, scenario: null, error: `Not a valid incident ID at any supported content version (1–${INCIDENT_CONTENT_VERSION})`, situation: null, recipeId: null };
    } else if (p.call !== null) spec = { type: p.type, familyId: p.family, buildingSeed: p.seed, seed: p.call, tier: p.tier, contentVersion: INCIDENT_CONTENT_VERSION };
    else spec = specForSituation(p.type, p.family, p.variant, p.seed, p.pacing, p.tier);
  } catch (error) {
    return { spec, id: null, scenario: null, error: String(error), situation: null, recipeId: null };
  }
  const id = incidentId(spec);
  let situation: ScenarioSituation | null = null, recipeId: string | null = null;
  // Recipes (situation and pacing) exist from content v9; older IDs predate them.
  if (spec.contentVersion >= 9) try { const recipe = scenarioRecipe(spec); situation = { variant: recipe.variant, characteristic: recipe.characteristic }; recipeId = recipe.id; } catch { /* no recipe */ }
  try {
    // generateIncident first for its error message; the registry copy is the one the engine uses.
    generateIncident(spec);
    return { spec, id, scenario: getScenario(id), error: null, situation, recipeId };
  } catch (error) {
    return { spec, id, scenario: null, error: String(error), situation, recipeId };
  }
}

/** The next call seed after `from` that draws the same situation (a different cast and room). */
export function nextCallSeed(spec: IncidentSpec, situation: ScenarioSituation, from: number): number {
  for (let seed = from + 1; seed < from + 20000; seed++) {
    const picked = scenarioRecipe({ ...spec, seed });
    if (picked.variant === situation.variant && picked.characteristic === situation.characteristic) return seed;
  }
  return from + 1;
}

// ---------------------------------------------------------------- runs

export const KIT_ITEMS_FULL: Id[] = Object.keys(ITEMS).filter(id => !ITEMS[id].supportOnly);

/** A live run of the call with squad A at the first entry. 'day1' is startGateRun itself;
 * 'full' repeats its steps with one unit of every item (same campaign seed, so the same dice). */
export function startLabRun(id: string, kit: Kit, campaignSeed = 719): GameState {
  if (kit === 'day1') return startGateRun(id, campaignSeed);
  const s = getScenario(id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  const before = createInitialState(NOW, campaignSeed);
  if (s.incident) before.incidents = [{ id: s.id, type: s.incident.type, familyId: s.incident.familyId, tier: s.incident.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
  const stocked = stockKit(before, ['A'], KIT_ITEMS_FULL);
  const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
  const started = apply(stocked.state, startCmd(s.id, ['A'], { positions: { A: entry }, loadouts: stocked.loadouts, units: stocked.units }));
  if (!started.result.ok) throw new Error(`Could not start ${id}: ${started.result.reason}`);
  return started.state;
}

/** A step: a decision aimed at a band, a decision with the run's own dice ('roll'), a free
 * stage continuation, or the failed-response report. */
export interface LabMove { kind: 'decide' | 'roll' | 'continue' | 'fail'; actionId: string; band?: OutcomeBand }

export const viewsOf = (state: GameState): ActionView[] => actionViews(state, NOW, 'A');

/** Apply through the dispatcher. Null when the engine refuses the move, or (for an aimed
 * decision) when the sampled band is not the one asked for. Never a simulated result. */
export function applyLabMove(state: GameState, move: LabMove, views?: ActionView[]): GameState | null {
  if (move.kind === 'roll') return applyNaturalMove(state, { kind: 'decide', actionId: move.actionId });
  return applyMove(state, move as Move, views);
}

export function encodePath(moves: LabMove[]): string {
  return moves.map(m => `${m.actionId}~${m.kind === 'decide' ? m.band : m.kind}`).join(',');
}
export function decodePath(text: string): LabMove[] {
  return text.split(',').filter(Boolean).flatMap((token): LabMove[] => {
    const at = token.lastIndexOf('~');
    if (at <= 0) return [];
    const actionId = token.slice(0, at), tail = token.slice(at + 1);
    if (tail === 'favorable' || tail === 'mixed' || tail === 'adverse') return [{ kind: 'decide', actionId, band: tail }];
    if (tail === 'roll' || tail === 'continue' || tail === 'fail') return [{ kind: tail, actionId }];
    return [];
  });
}

const stateKey = (state: GameState) => {
  const run = state.activeRun!;
  return JSON.stringify([run.stage, run.status, run.endingId, [...run.flags].sort(), Object.entries(run.knowledge).sort()]);
};
const toLab = (move: Move): LabMove => ({ kind: move.kind, actionId: move.actionId, band: move.band });

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

// ---------------------------------------------------------------- reference stage entries

export interface StageEntry { state: GameState; views: ActionView[]; path: LabMove[] }

/** The shallowest state where each stage is current, found breadth first through the engine:
 * favourable results first (the clean path), then every band for stages that path misses. */
export const STAGE_WALK_CAP = 400;
export interface StageWalk {
  entries: Partial<Record<StageId, StageEntry>>;
  /** The every-band walk visited every reachable state: a missing stage is unreachable for
   * this squad and kit, not merely beyond the cap. */
  complete: boolean;
}
export function stageEntries(id: string, kit: Kit): StageWalk {
  const start = startLabRun(id, kit);
  const found: Partial<Record<StageId, StageEntry>> = {};
  let complete = false;
  for (const bands of [['favorable'], ['favorable', 'mixed', 'adverse']] as const) {
    const queue: { state: GameState; path: LabMove[] }[] = [{ state: start, path: [] }];
    const seen = new Set([stateKey(start)]);
    for (let n = 0; queue.length && n < STAGE_WALK_CAP && STAGES.some(stage => !found[stage]); n++) {
      const { state, path } = queue.shift()!;
      const run = state.activeRun!;
      if (run.status !== 'active' || run.stage === 'debrief') continue;
      const views = viewsOf(state);
      found[run.stage] ??= { state, views, path };
      for (const move of availableMoves(state, views)) {
        if (move.kind === 'fail' || (move.band && !(bands as readonly string[]).includes(move.band))) continue;
        const after = applyMove(state, move, views);
        if (!after || seen.has(stateKey(after))) continue;
        seen.add(stateKey(after));
        queue.push({ state: after, path: [...path, toLab(move)] });
      }
    }
    if (STAGES.every(stage => found[stage])) break;
    complete = bands.length === 3 && queue.length === 0;
  }
  return { entries: found, complete };
}

// ---------------------------------------------------------------- endings

export interface EndingSource { stage: StageId; actionId: string; title: string; bands: OutcomeBand[]; conditional: boolean; retiredExit: boolean }

/** Authored outcome effects that name each ending (conditional when the effect has a `when`
 * or `truth` branch). A failed-response report always ends in FALLBACK_ENDING. */
export function endingSources(s: ScenarioDefinition): Record<string, EndingSource[]> {
  const out: Record<string, EndingSource[]> = {};
  for (const stage of STAGES) for (const action of s.stages[stage].actions) {
    const byEnding = new Map<string, { bands: Set<OutcomeBand>; conditional: boolean }>();
    for (const band of BANDS) for (const effect of action.outcomes[band] as OutcomeEffect[]) {
      if (!effect.ending) continue;
      const entry = byEnding.get(effect.ending) ?? { bands: new Set<OutcomeBand>(), conditional: false };
      entry.bands.add(band);
      entry.conditional ||= !!(effect.when || effect.truth?.length);
      byEnding.set(effect.ending, entry);
    }
    const retiredExit = isGenericResponseExit(s, action);
    for (const [ending, entry] of byEnding) (out[ending] ??= []).push({ stage, actionId: action.id, title: action.title, bands: BANDS.filter(band => entry.bands.has(band)), conditional: entry.conditional, retiredExit });
  }
  return out;
}

// ---------------------------------------------------------------- exploration

export interface FlatPoint { key: string; stage: StageId; note: string; path: LabMove[] }
export interface Exploration {
  states: number;
  done: boolean;
  truncated: boolean;
  /** Shortest move list found to each ending. */
  endings: Record<string, LabMove[]>;
  decisionPoints: number;
  flatPairs: number;
  allHigh: number;
  single: number;
  /** Distinct flat decision points (stage + options offered), first path that reached each. */
  flat: FlatPoint[];
}

/** Breadth-first walk of every move the engine allows (each reachable band of each eligible
 * option, continuations, the failed-response report), deduplicated like the content gates by
 * stage, flags and knowledge. Run in slices with step(); `cap` bounds the states visited. */
export function createExplorer(id: string, kit: Kit, cap = 6000) {
  interface Node { parent: number; move: LabMove | null }
  const nodes: Node[] = [{ parent: -1, move: null }];
  const start = startLabRun(id, kit);
  const queue: { state: GameState; node: number }[] = [{ state: start, node: 0 }];
  const seen = new Set([stateKey(start)]);
  const result: Exploration = { states: 0, done: false, truncated: false, endings: {}, decisionPoints: 0, flatPairs: 0, allHigh: 0, single: 0, flat: [] };
  const flatKeys = new Set<string>();
  const pathTo = (node: number, last?: LabMove): LabMove[] => {
    const out: LabMove[] = last ? [last] : [];
    for (let at = node; at > 0; at = nodes[at].parent) out.unshift(nodes[at].move!);
    return out;
  };
  const step = (budgetMs: number): Exploration => {
    const until = performance.now() + budgetMs;
    while (queue.length && performance.now() < until) {
      if (result.states >= cap) { result.truncated = true; queue.length = 0; break; }
      const { state, node } = queue.shift()!;
      result.states++;
      const run = state.activeRun!;
      if (run.status !== 'active' || run.stage === 'debrief') {
        if (run.endingId && !result.endings[run.endingId]) result.endings[run.endingId] = pathTo(node);
        continue;
      }
      const views = viewsOf(state);
      const flat = flatness(views);
      if (flat.eligible > 0) {
        result.decisionPoints++;
        if (flat.eligible === 1) result.single++;
        if (flat.pairs.length) result.flatPairs++;
        if (flat.allHigh) result.allHigh++;
        const note = flat.eligible === 1 ? 'single option' : flat.allHigh ? `every option ≥ ${HIGH_ODDS * 100}%` : flat.pairs.length ? 'options within 5 points' : '';
        const key = `${run.stage}|${views.filter(view => view.eligible).map(view => view.id).sort().join('+')}|${note}`;
        if (note && !flatKeys.has(key) && result.flat.length < 40) { flatKeys.add(key); result.flat.push({ key, stage: run.stage, note, path: pathTo(node) }); }
      }
      for (const move of availableMoves(state, views)) {
        const after = applyMove(state, move, views);
        if (!after) continue;
        const key = stateKey(after);
        if (seen.has(key)) continue;
        seen.add(key);
        nodes.push({ parent: node, move: toLab(move) });
        queue.push({ state: after, node: nodes.length - 1 });
      }
    }
    result.done = queue.length === 0;
    return { ...result, endings: { ...result.endings }, flat: [...result.flat] };
  };
  return { step };
}
