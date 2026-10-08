// Balance measurement for call trees: play many calls through the real engine with real dice and
// a day-one roster (a different campaign, so a different squad, for every call), under several
// player styles, and count how calls end. Used by the balance gate and by `npm run balance`-style
// dev runs. Nothing here is a simulation of the engine: every step is a dispatched decision.
import type { CallTree } from '../../../content/call-trees/types';
import { traceRun } from '../../../sim/operation';
import { actionViews } from '../../../sim/operation-selectors';
import { scoreCall } from '../../../sim/outcome-score';
import { getScenario } from '../../../sim/scenario-registry';
import type { ActionView, GameState } from '../../../sim/types';
import { applyNaturalMove, NOW, startGateRun } from '../gates/engine-driver';
import { drawIncidentSpec, generateIncident } from '../index';

export type Policy = 'random' | 'best_odds' | 'patient' | 'fast';
export const POLICIES: readonly Policy[] = ['random', 'best_odds', 'patient', 'fast'];

/** How a call ended, worst first: somebody died; somebody was hurt (a civilian, the subject or an
 * officer); the call ended with someone still inside or the subject still holding out; resolved
 * at another cost the score charged (a long night, an entry under review, force, a broken
 * promise); or clean. */
export type Weight = 'death' | 'hurt' | 'unresolved' | 'costly' | 'clean';
export const WEIGHTS: readonly Weight[] = ['death', 'hurt', 'unresolved', 'costly', 'clean'];

/** `points`: what the call's score lines add up to (sim/outcome-score.ts), when it reached an ending. */
export interface CallResult { weight: Weight; ending: string; minutes: number; officersHurt: number; peopleHurt: number; deaths: number; decisions: number; points?: number }

function pick(views: ActionView[], policy: Policy, roll: number): ActionView {
  const eligible = views.filter(view => view.eligible);
  if (policy === 'random') return eligible[Math.floor(roll * eligible.length) % eligible.length];
  const by = (score: (view: ActionView) => number) => [...eligible].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
  if (policy === 'best_odds') return by(view => view.likelihood.favorable);
  if (policy === 'patient') return by(view => view.timeCost);
  return by(view => -view.timeCost);
}

/** Classify a finished run by how the call scored (sim/outcome-score.ts): partly resolved or still
 * open is unresolved; resolved with any line other than the call's result costing trust (a long
 * night, an entry under review, force, a broken promise) is costly; otherwise clean. */
export function weigh(tree: CallTree, state: GameState): CallResult {
  const run = state.activeRun!;
  const ending = run.endingId ?? 'none';
  const people = Object.values(run.personCasualties ?? {});
  const deaths = people.filter(person => person.severity === 'fatal').length;
  const peopleHurt = people.length - deaths;
  const officersHurt = Object.keys(run.officerCasualties ?? {}).length;
  const scenario = getScenario(run.scenarioId);
  const score = scenario && run.endingId && tree.endings[ending] ? scoreCall(scenario, run, { officers: state.officers, steps: traceRun(scenario, run).steps }) : undefined;
  const weight: Weight = deaths ? 'death'
    : peopleHurt || officersHurt ? 'hurt'
      : !score || score.disposition !== 'resolved' ? 'unresolved'
        : score.lines.some(line => line.key !== 'result' && line.trust < 0) ? 'costly' : 'clean';
  return { weight, ending, minutes: run.clock, officersHurt, peopleHurt, deaths, decisions: run.history.length, ...(score ? { points: score.points } : {}) };
}

/** Play one call to its end with one policy. `seed` picks the campaign (roster) and the dice. */
export function playCall(tree: CallTree, scenarioId: string, policy: Policy, seed: number): CallResult {
  return weigh(tree, playToEnd(scenarioId, policy, seed));
}

/** The calls `measure` plays, in order: `calls` drawn calls of one tree at one tier, and the seed
 * each is played with. */
export function drawCalls(tree: CallTree, tier: number, calls: number, start = 1): { scenarioId: string; seed: number }[] {
  const out: { scenarioId: string; seed: number }[] = [];
  let rng = 7919 * start + tier;
  for (let i = 0; i < calls; i++) {
    const drawn = drawIncidentSpec(rng, { level: 10, trust: 90, contentVersion: 13, unlockedTypes: [tree.type] });
    rng = drawn.state;
    out.push({ scenarioId: generateIncident({ ...drawn.spec, tier }).id, seed: start + i });
  }
  return out;
}

/** Play one call to its end with one policy, and return the final state (the run still open in its debrief). */
export function playToEnd(scenarioId: string, policy: Policy, seed: number): GameState {
  let state = startGateRun(scenarioId, seed);
  let roll = (Math.imul(seed, 2654435761) >>> 0) || 1;
  for (let step = 0; step < 30; step++) {
    const run = state.activeRun!;
    if (run.status !== 'active' || run.stage === 'debrief') break;
    const views = actionViews(state, NOW, 'A');
    if (!views.some(view => view.eligible)) break;
    roll = (Math.imul(roll, 1664525) + 1013904223) >>> 0;
    const choice = pick(views, policy, roll / 4294967296);
    const after = applyNaturalMove(state, { kind: 'decide', actionId: choice.id });
    if (!after) break;
    state = after;
  }
  return state;
}

export interface Distribution { calls: number; weights: Record<Weight, number>; endings: Record<string, number>; officerHurtRate: number; meanMinutes: number }

/** Play `calls` drawn calls of one tree at one tier with one policy. */
export function measure(tree: CallTree, tier: number, policy: Policy, calls: number, start = 1): Distribution {
  const weights = Object.fromEntries(WEIGHTS.map(weight => [weight, 0])) as Record<Weight, number>;
  const endings: Record<string, number> = {};
  let officerCalls = 0, minutes = 0;
  for (const { scenarioId, seed } of drawCalls(tree, tier, calls, start)) {
    const result = playCall(tree, scenarioId, policy, seed);
    weights[result.weight]++;
    endings[result.ending] = (endings[result.ending] ?? 0) + 1;
    if (result.officersHurt) officerCalls++;
    minutes += result.minutes;
  }
  const share = (n: number) => Math.round(1000 * n / calls) / 1000;
  return { calls, weights: Object.fromEntries(WEIGHTS.map(weight => [weight, share(weights[weight])])) as Record<Weight, number>,
    endings: Object.fromEntries(Object.entries(endings).map(([ending, n]) => [ending, share(n)])), officerHurtRate: share(officerCalls), meanMinutes: Math.round(minutes / calls) };
}
