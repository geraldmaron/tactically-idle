// Casebook: which recipes a campaign has met on live calls and its best result on each.
// A recipe is framework × situation (variant and pacing) × the building type the call
// actually used. It is recorded when a squad is dispatched (takeIncident), so it never
// spoils a call that only sat on the board. Best results come from debriefs: the state
// keeps only the latest ten, but only one operation runs at a time, so folding the
// debriefs at every dispatch (and reading the current ones in views) misses none.
//
// This module must not import economy.ts or incidents.ts.
import type { CasebookBest, CasebookState, DebriefResult, GameState, Id } from './types';
import type { IncidentType } from './scenario-types';
import { parseIncidentId } from '../gen/incident';
import { baseFamilyIdV7 } from '../gen/building';
import { scenarioRecipe, scenarioSituationsV10 } from '../content/scenario-recipes';
import type { ScenarioCharacteristic } from '../content/scenario-recipes';
import { getScenario } from './scenario-registry';

/** Recipes are counted from content v10, when situations decoupled from buildings. */
export const CASEBOOK_MIN_CONTENT_VERSION = 10;

export interface RecipeRef {
  key: string;
  type: IncidentType;
  familyId: string;
  variant: number;
  characteristic: ScenarioCharacteristic;
}

export function emptyCasebook(): CasebookState {
  return { frameworksSeen: [], recipes: {} };
}

/** The persisted casebook, created on first use. */
export function ensureCasebook(d: GameState): CasebookState {
  if (!d.casebook) d.casebook = emptyCasebook();
  return d.casebook;
}

export const recipeKey = (type: string, familyId: string, variant: number, characteristic: string) => `${type}/${familyId}/${variant}/${characteristic}`;

export function parseRecipeKey(key: string): RecipeRef | null {
  const [type, familyId, variant, characteristic] = key.split('/');
  if (!type || !familyId || !/^\d$/.test(variant ?? '') || (characteristic !== 'ordinary' && characteristic !== 'deliberate_answers')) return null;
  return { key, type: type as IncidentType, familyId, variant: Number(variant), characteristic };
}

/** The recipe a v10+ generated call presents, with the building type it actually used. */
export function recipeOfScenario(scenarioId: Id): RecipeRef | null {
  const spec = parseIncidentId(scenarioId);
  if (!spec || spec.contentVersion < CASEBOOK_MIN_CONTENT_VERSION) return null;
  let variant = 0;
  let characteristic: ScenarioCharacteristic = 'ordinary';
  try {
    const picked = scenarioRecipe(spec);
    variant = picked.variant;
    characteristic = picked.characteristic;
  } catch {
    // A framework without authored situations has one situation.
  }
  const used = getScenario(scenarioId)?.locationFamilyId;
  const familyId = used ? baseFamilyIdV7(used) : spec.familyId;
  return { key: recipeKey(spec.type, familyId, variant, characteristic), type: spec.type, familyId, variant, characteristic };
}

export function bestOfDebrief(report: DebriefResult): CasebookBest {
  return { completed: report.completionAchieved === true, objective: report.objective.score, safety: report.civilianSafety.score, label: report.objective.label };
}

/** True when `a` is a better result than `b`. */
export function betterBest(a: CasebookBest, b: CasebookBest | undefined): boolean {
  if (!b) return true;
  if (a.completed !== b.completed) return a.completed;
  if (a.objective !== b.objective) return a.objective > b.objective;
  return a.safety > b.safety;
}

/** Live (non-practice) debriefs folded into a copy-free view: recipe key -> best. */
function liveBests(debriefs: readonly DebriefResult[]): Map<string, CasebookBest> {
  const out = new Map<string, CasebookBest>();
  for (const report of debriefs) {
    if (report.practice) continue;
    const ref = recipeOfScenario(report.scenarioId);
    if (!ref) continue;
    const best = bestOfDebrief(report);
    if (betterBest(best, out.get(ref.key))) out.set(ref.key, best);
  }
  return out;
}

/** Record the best results of the current live debriefs. Idempotent. Adds a recipe that
 * only a debrief knows about (migrated history), dated `at`. */
export function foldDebriefs(d: GameState, at: number): void {
  const book = ensureCasebook(d);
  for (const [key, best] of liveBests(d.debriefs ?? [])) {
    const entry = book.recipes[key] ??= { firstAt: at };
    if (betterBest(best, entry.best)) entry.best = best;
  }
}

/** A squad was dispatched to this live call: the recipe is discovered. */
export function recordDispatch(d: GameState, scenarioId: Id, at: number): void {
  foldDebriefs(d, at);
  const ref = recipeOfScenario(scenarioId);
  if (!ref) return;
  const book = ensureCasebook(d);
  book.recipes[ref.key] ??= { firstAt: at };
  if (!book.frameworksSeen.includes(ref.type)) book.frameworksSeen.push(ref.type);
}

/** A framework arrived on the board. Returns true the first time for this campaign. */
export function recordArrival(d: GameState, type: string): boolean {
  const book = ensureCasebook(d);
  if (book.frameworksSeen.includes(type)) return false;
  book.frameworksSeen.push(type);
  return true;
}

/** Discovered recipes with their best results, including debriefs not folded yet. Read-only. */
export function casebookRecipes(state: Pick<GameState, 'casebook' | 'debriefs'>): Map<string, { ref: RecipeRef; firstAt: number; best?: CasebookBest }> {
  const out = new Map<string, { ref: RecipeRef; firstAt: number; best?: CasebookBest }>();
  for (const [key, entry] of Object.entries(state.casebook?.recipes ?? {})) {
    const ref = parseRecipeKey(key);
    if (ref) out.set(key, { ref, firstAt: entry.firstAt, ...(entry.best ? { best: entry.best } : {}) });
  }
  for (const [key, best] of liveBests(state.debriefs ?? [])) {
    const ref = parseRecipeKey(key);
    if (!ref) continue;
    const entry = out.get(key) ?? { ref, firstAt: 0 };
    if (betterBest(best, entry.best)) entry.best = best;
    out.set(key, entry);
  }
  return out;
}

/** Situations (variants) a framework can present; pacing does not count as a new situation. */
export function situationCount(type: IncidentType): number {
  return Math.max(1, new Set(scenarioSituationsV10(type).map((situation) => situation.variant)).size);
}

/** Unseen-first draw weights: a framework never sent counts three times, one with
 * situations still to find twice, the rest once. Pure, so board draws stay deterministic. */
export function noveltyWeights(state: Pick<GameState, 'casebook'>, types: readonly IncidentType[]): Partial<Record<IncidentType, number>> {
  const seen = new Set(state.casebook?.frameworksSeen ?? []);
  const found = new Map<string, Set<number>>();
  for (const key of Object.keys(state.casebook?.recipes ?? {})) {
    const ref = parseRecipeKey(key);
    if (!ref) continue;
    if (!found.has(ref.type)) found.set(ref.type, new Set());
    found.get(ref.type)!.add(ref.variant);
  }
  const weights: Partial<Record<IncidentType, number>> = {};
  for (const type of types) weights[type] = !seen.has(type) ? 3 : (found.get(type)?.size ?? 0) < situationCount(type) ? 2 : 1;
  return weights;
}
