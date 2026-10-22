// Plays a call through the real engine to produce what path-measures.ts counts. Three populations,
// each a different question: `played:<style>` (real dice, the balance styles, drawn calls: what a
// player meets), `uniform` (every choice and band equally likely: the structure's own paths, which
// overweights bad results the way a reachability walk does) and the engine walk (every state the
// call can reach, deduplicated by path key, for the odds a node offers on arrival). Nothing here
// decides a result: every step is a dispatched move, as the Lab's Play and Explore do.
import type { CallTree } from '../../../content/call-trees/types';
import { applyMove, availableMoves, NOW } from '../../../gen/incident/gates/engine-driver';
import type { Move } from '../../../gen/incident/gates/engine-driver';
import { playToEnd } from '../../../gen/incident/trees-v13/balance';
import type { Policy } from '../../../gen/incident/trees-v13/balance';
import { dependencyIndex } from '../../../gen/incident/trees-v13/dependencies';
import { choiceIndex } from '../../../gen/incident/trees-v13/graph';
import { stageProgress } from '../../../sim/operation-selectors';
import { getScenario } from '../../../sim/scenario-registry';
import type { GameState } from '../../../sim/types';
import { isLapse } from '../../../sim/types';
import { liveDecisions } from '../../../ui/screens/live-model';
import { dilemma } from './dilemma';
import { createExplorer } from './explore';
import type { DominanceNode, PathRecord, PathStep } from './path-measures';
import { nodeAt } from './session';
import type { Frame, Session } from './session';
import { xrayChoices } from './xray';
import { focusSquad } from './squads';

/** The engine ends a result with `Next: <the next prompt>` (sim/operation.ts); the next step records that prompt itself. */
const NEXT = /^Next: /;

/** One decision as a path step: the node and prompt before it, the choice and band, the lines the
 * result committed, the facts it settled and where it led. Null when the engine left no entry. */
export function stepOf(tree: CallTree, before: GameState, after: GameState): PathStep | null {
  const run = after.activeRun, was = before.activeRun, h = run?.history.at(-1);
  if (!run || !was || !h || run.history.length !== was.history.length + 1) return null;
  const committed = h.committed;
  const choice = isLapse(h) ? 'lapse' : choiceIndex(tree).get(h.actionId)?.choice ?? h.actionId;
  return {
    node: nodeAt(before, tree) ?? '?', stage: was.stage, choice, band: isLapse(h) ? 'lapse' : h.band, prompt: stageProgress(before).prompt,
    to: nodeAt(after, tree) ?? `end:${run.endingId ?? 'none'}`,
    lines: [...committed?.consequences ?? [], ...(committed?.exchange ?? []).map(entry => entry.line), ...(committed?.heard ?? []).map(entry => entry.line)].filter(line => line && !NEXT.test(line)),
    revealed: h.knowledgeChanges.map(change => ({ fact: change.factId, status: change.status })),
  };
}

/** The cast's first names and surnames (cosmetic bindings), for masking out of the echo count. */
export function castNames(scenarioId: string): string[] {
  const cast = getScenario(scenarioId)?.story?.cast ?? {};
  return [...new Set(Object.values(cast).flatMap(who => [who.firstName, who.surname]))];
}

function recordOf(source: string, scenarioId: string, steps: PathStep[], final: GameState): PathRecord {
  const run = final.activeRun;
  return { source, scenarioId, steps, ending: run?.endingId ?? null, knowledge: { ...run?.knowledge }, names: castNames(scenarioId) };
}

/** Each drawn call played to its end in each style, with the engine's own dice and a day-one squad
 * that follows from the call's seed (trees-v13/balance.ts playToEnd). */
export function playedPaths(tree: CallTree, calls: readonly { scenarioId: string; seed: number }[], styles: readonly Policy[],
  progress?: (style: Policy, done: number, total: number) => void): PathRecord[] {
  const out: PathRecord[] = [];
  for (const style of styles) calls.forEach(({ scenarioId, seed }, i) => {
    const steps: PathStep[] = [];
    const final = playToEnd(scenarioId, style, seed, { onStep: step => { const record = stepOf(tree, step.before, step.after); if (record) steps.push(record); } });
    out.push(recordOf(`played:${style}`, scenarioId, steps, final));
    progress?.(style, i + 1, calls.length);
  });
  return out;
}

/** A small generator for the walks' picks (the same one the balance styles use). */
const lcg = (roll: number) => (Math.imul(roll, 1664525) + 1013904223) >>> 0;

/** `walks` walks from the session's start, each move picked as the teardown's walker did: a choice
 * equally likely among those offered, then a band equally likely among those it can come out, and a
 * run-out one time in ten when the open decision has one. */
export function uniformPaths(s: Session, walks: number, seed = 1, maxSteps = 30): PathRecord[] {
  const tree = s.tree, out: PathRecord[] = [];
  for (let walk = 0; walk < walks; walk++) {
    let state = s.frames[0].state, roll = (Math.imul(seed * 7919 + walk + 1, 2654435761) >>> 0) || 1;
    const steps: PathStep[] = [];
    for (let n = 0; n < maxSteps; n++) {
      const run = state.activeRun;
      if (!run || run.status !== 'active' || run.stage === 'debrief') break;
      const views = liveDecisions(state, NOW, focusSquad(state));
      const moves = availableMoves(state, views);
      if (!moves.length) break;
      const lapse = moves.find(move => move.kind === 'lapse');
      const byChoice = new Map<string, Move[]>();
      for (const move of moves) if (move.kind !== 'lapse') byChoice.set(move.actionId, [...byChoice.get(move.actionId) ?? [], move]);
      roll = lcg(roll);
      let pick: Move | undefined;
      if (lapse && roll / 4294967296 < 0.1) pick = lapse;
      else {
        const choices = [...byChoice.values()];
        if (!choices.length) pick = lapse;
        else { roll = lcg(roll); const bands = choices[Math.floor(roll / 4294967296 * choices.length)]; roll = lcg(roll); pick = bands[Math.floor(roll / 4294967296 * bands.length)]; }
      }
      const after = pick ? applyMove(state, pick, views) : null;
      const record = after ? stepOf(tree, state, after) : null;
      if (!after || !record) break;
      steps.push(record);
      state = after;
    }
    out.push(recordOf('uniform', s.scenario.id, steps, state));
  }
  return out;
}

// ---------------------------------------------------------------- arrivals and dominance

export interface WalkSummary { states: number; truncated: boolean; arrivals: Map<string, number> }

/** Walks every state the engine can reach from the session's start (the Lab's explorer, goal-less)
 * and tells `visit` each state in breadth-first order, so a node's first visit is its shortest
 * arrival. */
export function walkStates(s: Session, cap: number, visit: (state: GameState, node: string) => void): WalkSummary {
  const arrivals = new Map<string, number>();
  const explorer = createExplorer(s.frames[0].state, null, { cap, holds: state => {
    const node = nodeAt(state, s.tree);
    if (node) { arrivals.set(node, (arrivals.get(node) ?? 0) + 1); visit(state, node); }
    return false;
  } });
  let progress = explorer.step(Infinity);
  while (!progress.done) progress = explorer.step(Infinity);
  return { states: progress.states, truncated: !!progress.truncated, arrivals };
}

const meanFavorable = (state: GameState): number => {
  const open = liveDecisions(state, NOW, focusSquad(state)).filter(view => view.eligible);
  return open.length ? open.reduce((sum, view) => sum + view.likelihood.favorable, 0) / open.length : 0;
};

/** The dilemma rows of every node at its first arrival and at its median arrival. Median: the
 * arrival whose offered options' mean odds of going well sits in the middle of that node's arrivals
 * (the lower middle for an even count), found in a first pass and captured in a second, so no state
 * but the two kept is held. */
export function dominanceNodes(s: Session, cap: number): { nodes: DominanceNode[]; walk: WalkSummary } {
  const deps = (() => { try { return dependencyIndex(s.template); } catch { return null; } })();
  const odds = new Map<string, number[]>();
  const first = new Map<string, GameState>();
  const walk = walkStates(s, cap, (state, node) => {
    if (!first.has(node)) first.set(node, state);
    odds.set(node, [...odds.get(node) ?? [], meanFavorable(state)]);
  });
  const medianAt = new Map<string, number>();
  for (const [node, list] of odds) {
    const order = list.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value || a.i - b.i);
    medianAt.set(node, order[Math.floor((order.length - 1) / 2)].i);
  }
  const median = new Map<string, GameState>(), seen = new Map<string, number>();
  walkStates(s, cap, (state, node) => {
    const i = seen.get(node) ?? 0; seen.set(node, i + 1);
    if (i === medianAt.get(node)) median.set(node, state);
  });

  const rowsAt = (state: GameState, node: string, at: DominanceNode['at']): DominanceNode | null => {
    const run = state.activeRun;
    if (!run) return null;
    const frame: Frame = { state, move: null, views: liveDecisions(state, NOW, focusSquad(state)), band: null, pBand: null, drawn: [], pDrawn: null, forced: false };
    const x = xrayChoices(s, frame, deps);
    const rows = dilemma(x, deps, run).filter(row => x.find(entry => entry.actionId === row.actionId)?.view.eligible);
    return { situation: s.situation, node, at, arrivals: walk.arrivals.get(node) ?? 0, rows, titles: Object.fromEntries(x.map(entry => [entry.actionId, entry.title])) };
  };
  const nodes: DominanceNode[] = [];
  for (const [node, state] of first) {
    const a = rowsAt(state, node, 'first'), b = median.has(node) ? rowsAt(median.get(node)!, node, 'median') : null;
    if (a) nodes.push(a);
    if (b) nodes.push(b);
  }
  return { nodes, walk };
}
