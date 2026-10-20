// Shortest path to any moment of a call (spec 2.3 "Play here", 6.4 "Find a path"): a breadth-first
// walk of every move the engine allows from a start state (each band an eligible choice can come out,
// split into each drawn result that band can settle on, stage continuations, the failed-response
// report), deduplicated by pathStateKey, so states a clock cue or a subject's stance has forked stay
// apart. Among paths of the same length the walk keeps the likeliest: each step weighs the natural
// chance of its band and drawn results, and each depth is walked most likely first. Each move goes
// through the content gates' driver, offered as the player's cards offer it (liveDecisions for the
// focus squad), exactly as a Session steps; a path found here replays move for move. The walk runs
// in slices (createExplorer) so a worker can yield between them and hear a cancel; `explore` runs it
// to the end.
import { aimedMoves, applyMove, NOW, sampleFor } from '../../../gen/incident/gates/engine-driver';
import type { Move } from '../../../gen/incident/gates/engine-driver';
import { choiceActionId } from '../../../gen/incident/trees-v13/compile';
import { pathStateKey } from '../../../gen/incident/trees-v13/path-key';
import type { GameState, OutcomeBand } from '../../../sim/types';
import { liveDecisions } from '../../../ui/screens/live-model';
import type { ExploreResult, Goal } from '../jobs/protocol';
import { encodePath } from './call';
import type { LabMove } from './call';
import { nodeAt } from './session';
import { focusSquad } from './squads';
import { holdsIn, stateContext } from './why';

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

/** Spec 9.5: the default cap of an explore job. Raised from 6000 when the hostage depth pilot
 * (2026-10-19) took its third situation to 6010 states with the lie, the speaker and the confession,
 * and to 12000 when the officer and bystander options took it to 8576. */
export const EXPLORE_CAP = 12000;

export interface ExploreOptions { cap?: number; shouldStop?: () => boolean; holds?: (state: GameState) => boolean }
/** `states`: states taken off the queue. `endings`: the shortest path found to each ending reached.
 * `done`: the walk ended (goal found, nothing left, cap hit or stopped). */
export interface ExploreProgress extends ExploreResult { endings: Record<string, string>; done: boolean }

type Check = (state: GameState) => boolean;

/** The goal as a test on one state. Views (the engine's offer) are computed only for goals that
 * read them. */
function goalCheck(start: GameState, goal: Goal | null, holds: Check | undefined): Check | null {
  if (holds) return holds;
  if (!goal) return null;
  const run = (state: GameState) => state.activeRun;
  const views = (state: GameState) => liveDecisions(state, NOW, focusSquad(state));
  if ('ending' in goal) return state => run(state)?.endingId === goal.ending;
  if ('flags' in goal) return state => !!run(state) && goal.flags.every(flag => run(state)!.flags.includes(flag));
  if ('offered' in goal) return state => views(state).some(view => view.id === goal.offered);
  if ('eligible' in goal) return state => views(state).some(view => view.id === goal.eligible && view.eligible);
  const ctx = stateContext(start);
  if (!ctx) return () => false;
  if ('node' in goal) return state => nodeAt(state, ctx.tree) === goal.node;
  // A requirement: a choice is the engine's to offer; anything else holds when no clause fails here.
  if ('choice' in goal.target) {
    const [node, choice] = goal.target.choice;
    const id = choiceActionId(ctx.tree.type, node, choice);
    return state => views(state).some(view => view.id === id && view.eligible);
  }
  if ('ending' in goal.target) { const ending = goal.target.ending; return state => run(state)?.endingId === ending; }
  if ('node' in goal.target) { const node = goal.target.node; return state => nodeAt(state, ctx.tree) === node; }
  return state => holdsIn(goal.req, state, ctx);
}

/** A path token's move for an engine move, keeping an aimed decision's drawn results. */
const labMove = (move: Move): LabMove => move.kind === 'decide'
  ? { kind: 'decide', actionId: move.actionId, band: move.band, ...move.drawn?.length ? { drawn: [...move.drawn] } : {} }
  : { kind: move.kind, actionId: move.actionId };

/** A sliced walk: call step(ms) until `done`. */
export function createExplorer(start: GameState, goal: Goal | null, opts: Omit<ExploreOptions, 'shouldStop'> = {}): { step(budgetMs: number, shouldStop?: () => boolean): ExploreProgress } {
  const cap = opts.cap ?? EXPLORE_CAP;
  const check = goalCheck(start, goal, opts.holds);
  // `p`: the natural chance of the path to this node (the product of its steps' chances).
  const nodes: { parent: number; move: LabMove | null; p: number }[] = [{ parent: -1, move: null, p: 1 }];
  type Entry = { state: GameState; node: number };
  // One depth at a time: `level` is being walked, `coming` collects the next depth (one entry per
  // state key, the likeliest way there), and `seen` holds every key at this depth or above.
  let level: Entry[] = [{ state: start, node: 0 }], coming: Entry[] = [];
  const comingAt = new Map<string, number>();
  const seen = new Set([pathStateKey(start)]);
  const endings: Record<string, string> = {};
  const progress: ExploreProgress = { path: null, states: 0, truncated: false, unforced: 0, endings, done: false };
  let head = 0;
  const pathTo = (node: number): string => {
    const moves: LabMove[] = [];
    for (let at = node; at > 0; at = nodes[at].parent) moves.unshift(nodes[at].move!);
    return encodePath(moves);
  };
  const finish = (patch: Partial<ExploreProgress>) => { Object.assign(progress, patch, { done: true }); level = []; coming = []; };

  const step = (budgetMs: number, shouldStop?: () => boolean): ExploreProgress => {
    const until = performance.now() + budgetMs;
    while (!progress.done) {
      if (head >= level.length) {
        if (!coming.length) { finish({}); break; }
        // The next depth, likeliest first (ties keep the order they were found in).
        level = coming.map((entry, i) => ({ entry, i })).sort((a, b) => nodes[b.entry.node].p - nodes[a.entry.node].p || a.i - b.i).map(({ entry }) => entry);
        for (const key of comingAt.keys()) seen.add(key);
        coming = [];
        comingAt.clear();
        head = 0;
        continue;
      }
      if (progress.states >= cap) { finish({ truncated: true }); break; }
      if (shouldStop?.()) { finish({ truncated: true }); break; }
      const { state, node } = level[head];
      level[head++] = undefined as never;
      progress.states++;
      // Shortest first, and at one length likeliest first.
      if (check?.(state)) { finish({ path: pathTo(node) }); break; }
      const run = state.activeRun;
      if (!run || run.status !== 'active' || run.stage === 'debrief') {
        if (run?.endingId && endings[run.endingId] === undefined) endings[run.endingId] = pathTo(node);
        continue;
      }
      const views = liveDecisions(state, NOW, focusSquad(state));
      // A band the dice allow but no forced step can take (its margin window is too narrow to aim
      // at) isn't walked; count it, so a "no path" never claims every state was covered.
      for (const view of views) if (view.eligible) for (const band of BANDS) if (view.likelihood[band] > 1e-9 && sampleFor(view, band) === null) progress.unforced!++;
      // Every band an eligible choice can come out, each drawn result it can bring (aimed, so an
      // ending only a drawn result reaches is found), continuations and the failed-response report.
      for (const move of aimedMoves(state, views)) {
        const after = applyMove(state, move, views);
        if (!after) continue;
        const key = pathStateKey(after);
        if (seen.has(key)) continue;
        const p = nodes[node].p * move.p, at = comingAt.get(key);
        if (at !== undefined && p <= nodes[coming[at].node].p) continue;
        nodes.push({ parent: node, move: labMove(move), p });
        if (at !== undefined) coming[at] = { state: after, node: nodes.length - 1 };
        else { comingAt.set(key, coming.length); coming.push({ state: after, node: nodes.length - 1 }); }
      }
      if (performance.now() >= until) break;
    }
    return { ...progress, endings: { ...endings } };
  };
  return { step };
}

/** The shortest path (URL tokens) from `start` to the goal, or null when none is found within the
 * cap; with no goal, the walk visits everything (up to the cap) and reports the shortest path to
 * each ending. `holds` replaces the goal's own test. */
export function explore(start: GameState, goal: Goal | null, opts: ExploreOptions = {}): ExploreResult & { endings?: Record<string, string> } {
  const explorer = createExplorer(start, goal, opts);
  let result = explorer.step(Infinity, opts.shouldStop);
  while (!result.done) result = explorer.step(Infinity, opts.shouldStop);
  return { path: result.path, states: result.states, truncated: result.truncated, unforced: result.unforced, endings: result.endings };
}

/** Why an explore found no path, in words: the walk's limit when it stopped early, else that it
 * covered every state, with what in the call's draw or squad rules the goal out when that is what
 * does (`blocker`, from why.ts blockedBecause). */
export function noPathText(result: ExploreResult, cap: number, blocker: string | null): string {
  if (result.truncated) return `No path within ${cap.toLocaleString('en-US')} states reaches that in this call.`;
  const states = result.states.toLocaleString('en-US');
  // Results too narrow to force weren't walked: the walk covered every state the lab can force, not
  // every state the dice can reach.
  const skipped = result.unforced ?? 0;
  const covered = skipped ? `the walk covered all ${states} states it can force, and skipped ${skipped.toLocaleString('en-US')} ${skipped === 1 ? 'result' : 'results'} the dice allow but no forced step can take` : `the walk covered all ${states} states`;
  const lead = skipped ? 'No path the lab can force reaches that in this call' : 'No path reaches that in this call';
  return blocker ? `${lead}. ${blocker} (${covered.charAt(0).toUpperCase()}${covered.slice(1)}.)` : `${lead} (${covered}).`;
}
