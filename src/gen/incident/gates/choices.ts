import { actionViews, stageContinuations } from '../../../sim/operation-selectors';
import type { ActionView, GameState } from '../../../sim/types';
import { applyMove, availableMoves, NOW, startPractice } from './engine-driver';

/** Choices gate (content v12). A stage that opens with a single button is not a decision: in
 * v11 most typed calls ran "pick one of two approaches, press the only button, press the only
 * button". This plays every reachable path through the real engine, like the distinctness
 * gate, and records each time the run enters a stage (or starts) with fewer than two
 * choices the player can take. Steps a player can see but not take yet don't count. */
export interface ThinStage { stage: string; choices: string[]; path: string }

function choicesNow(state: GameState, views: ActionView[]): string[] {
  const actions = views.filter(view => view.eligible).map(view => view.id);
  return [...actions, ...stageContinuations(state).map(entry => `continue:${entry.actionId}`)];
}

export function thinStages(scenarioId: string): ThinStage[] {
  const out = new Map<string, ThinStage>();
  const seen = new Set<string>(), checked = new Set<string>();
  const keyOf = (state: GameState) => {
    const run = state.activeRun!;
    return JSON.stringify([run.stage, run.status, [...run.flags].sort(), Object.entries(run.knowledge).sort()]);
  };
  const walk = (state: GameState, entered: boolean, path: string, depth: number) => {
    const run = state.activeRun!;
    if (run.status !== 'active' || depth > 40) return;
    const key = keyOf(state);
    if (seen.has(key) && (!entered || checked.has(key))) return;
    const views = actionViews(state, NOW, 'A');
    if (entered) {
      checked.add(key);
      const choices = choicesNow(state, views);
      if (choices.length < 2 && !out.has(`${run.stage}|${key}`)) out.set(`${run.stage}|${key}`, { stage: run.stage, choices, path: path || 'start' });
    }
    if (seen.has(key)) return;
    seen.add(key);
    for (const move of availableMoves(state, views)) {
      const after = applyMove(state, move, views);
      if (!after) continue;
      walk(after, after.activeRun!.stage !== run.stage, `${path}${path ? ' > ' : ''}${move.actionId}:${move.band ?? move.kind}`, depth + 1);
    }
  };
  walk(startPractice(scenarioId), true, '', 0);
  return [...out.values()];
}
