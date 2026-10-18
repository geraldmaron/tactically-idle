// What a batch of played runs visited (spec 9.3 "Stream J", 9.5): nodes, choices, edges, endings and
// run classes, state keys set, locks, the odds spread and flat visits, counted per tree node id so
// runs of different compiled calls add up. A tally is plain data: it crosses the worker boundary,
// merges across workers (mergeTally) and goes to sessionStorage as JSON.
//
// Merging is exact and associative: every count is an integer, odds are kept to 1/4096 so their sums
// are exact in floating point, run classes and minutes are kept by run index (minutes are re-added
// in run order). Runs [0, 50) merged with [50, 100) give the same tally as [0, 100) played in one
// go, whatever the pool size.
import type { CallTree } from '../../../content/call-trees/types';
import { WEIGHTS } from '../../../gen/incident/trees-v13/balance';
import type { CallResult, PlayStep, Weight } from '../../../gen/incident/trees-v13/balance';
import { choiceIndex, drawnRoute, matchKey } from '../../../gen/incident/trees-v13/graph';
import { hashSeed } from '../../../sim/rng';
import type { OutcomeBand } from '../../../sim/types';
import { flatness } from '../model/call';
import { nodeAt } from '../model/session';

/** One decision as the tally counts it. `offered`: every choice the engine showed at this visit,
 * locked ones with their reason, and its odds of going well. `drawn`: `force:hurt`, `cascade:some`,
 * `fire:wounded` (a cascade with nobody to follow routes like a plain `next` and records nothing).
 * `to`: the node reached, or `end:<ending>`. `marks`: state keys this step set (`mark:`, `safe:`,
 * `out:` flags). `flat`: the eligible choices' odds were within 5 points, or all at 90% or more. */
export interface StepRecord { node: string; offered: { choice: string; eligible: boolean; reason?: string; favorable: number }[];
  choice: string; band: OutcomeBand; drawn: string[] /* 'force:hurt', 'cascade:some', 'fire:wounded' */; to: string /* node id or 'end:<id>' */; marks: string[]; flat: boolean }

/** Counts over `runs` played runs. Keys: `visits`, `flatVisits`, `nodeFate` by node id; `choices`,
 * `locked`, `odds` by `node/choice`; `edges` by matchKey (trees-v13/graph.ts), so a graph edge and a
 * recorded step give the same key; `nodeEdges` by `from>to`; `endings` by ending id (`none` for a
 * run that stopped without one, also counted in `stuck`). `visits`, `choices`, `edges`, `nodeEdges`,
 * `locked`, `odds` and `flatVisits` count steps; `keysSet` and `nodeFate` count runs (a key set twice
 * in one run counts once). `minutes`: total minutes. `officerHurt`: runs with an officer hurt.
 * `runWeights[k]`: run k's class as an index into WEIGHTS (death 0 … clean 4), -1 where run k is not
 * in this tally; saved and patched runs with the same k are paired. `edgeFate` (optional): the run
 * classes of the runs that took each edge, for Flow's fate coloring. `runMinutes` (optional): run k's
 * minutes, -1 where absent; minutes are tenths, so their float sum depends on the order of addition,
 * and a merge re-adds them in run order to give the same total as one tally played in one go. */
export interface ReachTally { runs: number; visits: Record<string, number>; choices: Record<string, number>;
  edges: Record<string, number> /* matchKey */; nodeEdges: Record<string, number> /* 'from>to' */;
  endings: Record<string, { n: number; weights: Record<Weight, number> }>; weights: Record<Weight, number>;
  keysSet: Record<string, number>; locked: Record<string, { offered: number; locked: number; reasons: Record<string, number> }>;
  odds: Record<string, { min: number; max: number; sum: number; n: number }>; flatVisits: Record<string, number>;
  nodeFate: Record<string, Record<Weight, number>>; stuck: number; minutes: number; officerHurt: number; runWeights: number[];
  edgeFate?: Record<string, Record<Weight, number>>; runMinutes?: number[] }

/** Odds are kept to 1/4096 (0.02 points): sums of such numbers are exact, so merging is associative. */
const ODDS_STEP = 4096;
const quantize = (p: number) => Math.round(p * ODDS_STEP) / ODDS_STEP;
/** Flags whose names are state keys (trees-v13/dependencies.ts StateKey). */
const KEY_FLAG = /^(mark|safe|out):/;

const zeroWeights = (): Record<Weight, number> => ({ death: 0, hurt: 0, unresolved: 0, costly: 0, clean: 0 });
const bump = (into: Record<string, number>, key: string, by = 1) => { into[key] = (into[key] ?? 0) + by; };

export function emptyTally(): ReachTally {
  return { runs: 0, visits: {}, choices: {}, edges: {}, nodeEdges: {}, endings: {}, weights: zeroWeights(), keysSet: {}, locked: {}, odds: {},
    flatVisits: {}, nodeFate: {}, stuck: 0, minutes: 0, officerHurt: 0, runWeights: [], edgeFate: {}, runMinutes: [] };
}

const CHOICES = new WeakMap<CallTree, ReadonlyMap<string, { node: string; choice: string }>>();
function choicesOf(tree: CallTree) {
  let index = CHOICES.get(tree);
  if (!index) { index = choiceIndex(tree); CHOICES.set(tree, index); }
  return index;
}

/** The drawn results of a committed decision, in the tally's words. */
function drawnWords(drawn: readonly { model: 'incoming_fire' | 'team_force' | 'cascade'; key: string }[] | undefined): string[] {
  return (drawn ?? []).flatMap(d => {
    if (d.model === 'incoming_fire') return [`fire:${d.key}`];
    // The compiler makes a cascade with nobody to follow a plain route (its key is empty).
    if (d.model === 'cascade' && d.key === '') return [];
    return [`${d.model === 'team_force' ? 'force' : 'cascade'}:${drawnRoute(d.model, d.key)}`];
  });
}

/** One played decision in the tally's terms. */
export function recordStep(tree: CallTree, step: PlayStep): StepRecord {
  const index = choicesOf(tree);
  const choiceOf = (actionId: string) => index.get(actionId)?.choice ?? actionId;
  const node = nodeAt(step.before, tree) ?? '?';
  const run = step.after.activeRun;
  const h = run?.history.at(-1);
  if (!run || !h) throw new Error(`recordStep: ${step.choice.id} left no decision in the run's history`);
  const before = new Set(step.before.activeRun?.flags ?? []);
  const flat = flatness(step.views);
  return {
    node,
    offered: step.views.map(view => ({ choice: choiceOf(view.id), eligible: view.eligible, ...(!view.eligible && view.reason ? { reason: view.reason } : {}),
      favorable: quantize(view.likelihood.favorable) })),
    choice: choiceOf(step.choice.id),
    band: h.band,
    drawn: drawnWords(h.committed?.drawn),
    to: nodeAt(step.after, tree) ?? `end:${run.endingId ?? 'none'}`,
    marks: run.flags.filter(flag => KEY_FLAG.test(flag) && !before.has(flag)),
    flat: flat.pairs.length > 0 || flat.allHigh,
  };
}

/** The tally's edge key for a step: matchKey with the drawn result that routes (force or cascade). */
export function stepEdge(s: StepRecord): string {
  return matchKey({ node: s.node, choice: s.choice, band: s.band, drawn: s.drawn.find(d => d.startsWith('force:') || d.startsWith('cascade:')), to: s.to });
}

/** Add one played run: its steps and how it ended. `runIndex` is the run's k (or the call's index in
 * a this-type population), so the same run lands in the same place whichever worker played it. */
export function addRun(t: ReachTally, steps: readonly StepRecord[], result: CallResult, runIndex: number): void {
  const weight = result.weight;
  const nodes = new Set<string>(), keys = new Set<string>(), edges = new Set<string>();
  for (const s of steps) {
    bump(t.visits, s.node);
    nodes.add(s.node);
    bump(t.choices, `${s.node}/${s.choice}`);
    const edge = stepEdge(s);
    bump(t.edges, edge);
    edges.add(edge);
    bump(t.nodeEdges, `${s.node}>${s.to}`);
    for (const offer of s.offered) {
      const key = `${s.node}/${offer.choice}`;
      const lock = t.locked[key] ??= { offered: 0, locked: 0, reasons: {} };
      lock.offered++;
      if (!offer.eligible) {
        lock.locked++;
        if (offer.reason) bump(lock.reasons, offer.reason);
        continue;
      }
      const odds = t.odds[key];
      if (!odds) t.odds[key] = { min: offer.favorable, max: offer.favorable, sum: offer.favorable, n: 1 };
      else { odds.min = Math.min(odds.min, offer.favorable); odds.max = Math.max(odds.max, offer.favorable); odds.sum += offer.favorable; odds.n++; }
    }
    if (s.flat) bump(t.flatVisits, s.node);
    for (const key of s.marks) keys.add(key);
  }
  for (const node of nodes) bump(t.nodeFate[node] ??= zeroWeights(), weight);
  t.edgeFate ??= {};
  for (const edge of edges) bump(t.edgeFate[edge] ??= zeroWeights(), weight);
  for (const key of keys) bump(t.keysSet, key);
  const ending = t.endings[result.ending] ??= { n: 0, weights: zeroWeights() };
  ending.n++;
  ending.weights[weight]++;
  t.weights[weight]++;
  t.runs++;
  if (result.ending === 'none') t.stuck++;
  t.minutes += result.minutes;
  if (result.officersHurt > 0) t.officerHurt++;
  setRun(t.runWeights, runIndex, WEIGHTS.indexOf(weight));
  setRun(t.runMinutes ??= [], runIndex, result.minutes);
}

/** Write run k's value into a per-run array, -1 in the gaps before it. */
function setRun(values: number[], k: number, value: number) {
  for (let i = values.length; i < k; i++) values[i] = -1;
  values[k] = value;
}
/** Two per-run arrays as one: run k's value from whichever side has it. */
function mergeRuns(a: readonly number[], b: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? -1;
    out.push(x >= 0 ? x : b[i] ?? -1);
  }
  return out;
}

const addCounts = (a: Record<string, number>, b: Record<string, number>): Record<string, number> => {
  const out = { ...a };
  for (const [key, n] of Object.entries(b)) bump(out, key, n);
  return out;
};
const addWeights = (a: Record<Weight, number>, b: Record<Weight, number>): Record<Weight, number> =>
  Object.fromEntries(WEIGHTS.map(w => [w, (a[w] ?? 0) + (b[w] ?? 0)])) as Record<Weight, number>;
function addByWeight(a: Record<string, Record<Weight, number>> = {}, b: Record<string, Record<Weight, number>> = {}) {
  const out: Record<string, Record<Weight, number>> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) out[key] = addWeights(a[key] ?? zeroWeights(), b[key] ?? zeroWeights());
  return out;
}

/** Two tallies as one. Associative and commutative; `runWeights` merged by run index (two tallies of
 * the same run index would be the same run, so either value is kept). */
export function mergeTally(a: ReachTally, b: ReachTally): ReachTally {
  const endings: ReachTally['endings'] = {};
  for (const key of new Set([...Object.keys(a.endings), ...Object.keys(b.endings)])) {
    const x = a.endings[key], y = b.endings[key];
    endings[key] = { n: (x?.n ?? 0) + (y?.n ?? 0), weights: addWeights(x?.weights ?? zeroWeights(), y?.weights ?? zeroWeights()) };
  }
  const locked: ReachTally['locked'] = {};
  for (const key of new Set([...Object.keys(a.locked), ...Object.keys(b.locked)])) {
    const x = a.locked[key], y = b.locked[key];
    locked[key] = { offered: (x?.offered ?? 0) + (y?.offered ?? 0), locked: (x?.locked ?? 0) + (y?.locked ?? 0), reasons: addCounts(x?.reasons ?? {}, y?.reasons ?? {}) };
  }
  const odds: ReachTally['odds'] = {};
  for (const key of new Set([...Object.keys(a.odds), ...Object.keys(b.odds)])) {
    const x = a.odds[key], y = b.odds[key];
    odds[key] = !x ? { ...y! } : !y ? { ...x } : { min: Math.min(x.min, y.min), max: Math.max(x.max, y.max), sum: x.sum + y.sum, n: x.n + y.n };
  }
  // Minutes re-added in run order when both sides kept them per run, so the total doesn't depend on
  // how the runs were split.
  const runMinutes = a.runMinutes && b.runMinutes ? mergeRuns(a.runMinutes, b.runMinutes) : undefined;
  const minutes = runMinutes ? runMinutes.reduce((sum, m) => m >= 0 ? sum + m : sum, 0) : a.minutes + b.minutes;
  return {
    runs: a.runs + b.runs, visits: addCounts(a.visits, b.visits), choices: addCounts(a.choices, b.choices), edges: addCounts(a.edges, b.edges),
    nodeEdges: addCounts(a.nodeEdges, b.nodeEdges), endings, weights: addWeights(a.weights, b.weights), keysSet: addCounts(a.keysSet, b.keysSet),
    locked, odds, flatVisits: addCounts(a.flatVisits, b.flatVisits), nodeFate: addByWeight(a.nodeFate, b.nodeFate),
    stuck: a.stuck + b.stuck, minutes, officerHurt: a.officerHurt + b.officerHurt, runWeights: mergeRuns(a.runWeights, b.runWeights),
    edgeFate: addByWeight(a.edgeFate, b.edgeFate), ...(runMinutes ? { runMinutes } : {}),
  };
}

/** The dice of this-call run k: an rng state of its own, the same for the saved and the patched side
 * and for any pool size. */
export function runRngState(scenarioId: string, k: number): number {
  return hashSeed(`${scenarioId}:${k}:lab-reach`) >>> 0;
}

/** Per-run 0/1 values of a weight test, for runs present in both tallies, in run order: the two
 * arrays pairedDelta (model/stats.ts) compares run by run. */
export function pairedRuns(before: ReachTally, after: ReachTally, hit: (weight: Weight) => boolean): { before: number[]; after: number[] } {
  const out = { before: [] as number[], after: [] as number[] };
  for (let i = 0; i < Math.min(before.runWeights.length, after.runWeights.length); i++) {
    const x = before.runWeights[i], y = after.runWeights[i];
    if (x === undefined || y === undefined || x < 0 || y < 0) continue;
    out.before.push(hit(WEIGHTS[x]) ? 1 : 0);
    out.after.push(hit(WEIGHTS[y]) ? 1 : 0);
  }
  return out;
}
