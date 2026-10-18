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
import type { IncidentType } from '../../../sim/scenario-types';

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
 * each is played with. The rng advances call by call, so the first 40 of a 60-call list are the
 * 40-call list. */
export function drawCalls(tree: CallTree, tier: number, calls: number, start = 1): { scenarioId: string; seed: number }[] {
  const out: { scenarioId: string; seed: number }[] = [];
  let rng = 7919 * start + tier;
  for (let i = 0; i < calls; i++) {
    const drawn = drawIncidentSpec(rng, { level: 10, trust: 90, unlockedTypes: [tree.type] });
    rng = drawn.state;
    out.push({ scenarioId: generateIncident({ ...drawn.spec, tier }).id, seed: start + i });
  }
  return out;
}

/** One decision `playToEnd` made: the state before it, the choices offered there, the one taken,
 * and the state after. */
export interface PlayStep { before: GameState; views: ActionView[]; choice: ActionView; after: GameState }
/** How `playToEnd` plays when it is not a plain gate run. `start`: play on from this state (it is
 * not changed; the engine copies) instead of a fresh run of the call for the campaign `seed`.
 * `rollSeed`: seeds the style's own picks (default `seed`). `firstChoice`: the first decision is
 * this action; when it is not eligible there, nothing is played. `onStep`: called after each
 * decision. `maxSteps`: at most this many decisions (default 30). */
export interface PlayOptions { start?: GameState; rollSeed?: number; firstChoice?: string; onStep?: (step: PlayStep) => void; maxSteps?: number }

/** Play one call to its end with one policy, and return the final state (the run still open in its
 * debrief). Without options this is the balance gate's play: a fresh run for campaign `seed`, whose
 * squad and dice both follow from it. The lab plays the same loop from any state with `opts`. */
export function playToEnd(scenarioId: string, policy: Policy, seed: number, opts: PlayOptions = {}): GameState {
  let state = opts.start ?? startGateRun(scenarioId, seed);
  let roll = (Math.imul(opts.rollSeed ?? seed, 2654435761) >>> 0) || 1;
  const steps = opts.maxSteps ?? 30;
  for (let step = 0; step < steps; step++) {
    const run = state.activeRun!;
    if (run.status !== 'active' || run.stage === 'debrief') break;
    const views = actionViews(state, NOW, 'A');
    if (!views.some(view => view.eligible)) break;
    roll = (Math.imul(roll, 1664525) + 1013904223) >>> 0;
    const choice = step === 0 && opts.firstChoice !== undefined ? views.find(view => view.id === opts.firstChoice && view.eligible) : pick(views, policy, roll / 4294967296);
    if (!choice) break;
    const after = applyNaturalMove(state, { kind: 'decide', actionId: choice.id });
    if (!after) break;
    opts.onStep?.({ before: state, views, choice, after });
    state = after;
  }
  return state;
}

export interface Distribution { calls: number; weights: Record<Weight, number>; endings: Record<string, number>; officerHurtRate: number; meanMinutes: number }

/** Play these calls with one policy, in order. `onRun` sees each result with the decisions that
 * led to it (steps are only kept when `onRun` is given). */
export function playCalls(tree: CallTree, policy: Policy, calls: readonly { scenarioId: string; seed: number }[],
  onRun?: (result: CallResult, steps: PlayStep[], index: number) => void): CallResult[] {
  return calls.map(({ scenarioId, seed }, index) => {
    const steps: PlayStep[] = [];
    const result = weigh(tree, playToEnd(scenarioId, policy, seed, onRun ? { onStep: step => steps.push(step) } : undefined));
    onRun?.(result, steps, index);
    return result;
  });
}

/** Shares of how the calls ended, rounded to a tenth of a point, as the balance gate reads them. */
export function summarize(results: readonly CallResult[]): Distribution {
  const calls = results.length;
  const weights = Object.fromEntries(WEIGHTS.map(weight => [weight, 0])) as Record<Weight, number>;
  const endings: Record<string, number> = {};
  let officerCalls = 0, minutes = 0;
  for (const result of results) {
    weights[result.weight]++;
    endings[result.ending] = (endings[result.ending] ?? 0) + 1;
    if (result.officersHurt) officerCalls++;
    minutes += result.minutes;
  }
  const share = (n: number) => Math.round(1000 * n / calls) / 1000;
  return { calls, weights: Object.fromEntries(WEIGHTS.map(weight => [weight, share(weights[weight])])) as Record<Weight, number>,
    endings: Object.fromEntries(Object.entries(endings).map(([ending, n]) => [ending, share(n)])), officerHurtRate: share(officerCalls), meanMinutes: Math.round(minutes / calls) };
}

/** Play `calls` drawn calls of one tree at one tier with one policy. */
export function measure(tree: CallTree, tier: number, policy: Policy, calls: number, start = 1): Distribution {
  return summarize(playCalls(tree, policy, drawCalls(tree, tier, calls, start)));
}

// ---------------------------------------------------------------- the balance gate

/** What a gate check reads from a distribution: clean endings; unresolved, hurt or dead; someone
 * hurt or killed; someone killed; calls where an officer was hurt. */
export type GateMetric = 'clean' | 'bad' | 'harm' | 'death' | 'officerHurt';
/** One bound of the balance gate (docs/call-trees-v13.md, "Balance"): `metric` of `calls` drawn
 * calls of `type` at `tier`, played in `style`, stays within `min` and `max`. */
export interface GateCheck { id: string; label: string; type: IncidentType; style: Policy; calls: number; tier: number;
  metric: GateMetric; min?: number; max?: number; why: string }

const GATE_LABELS: Record<GateMetric, string> = {
  clean: 'Clean endings', bad: 'Unresolved, hurt or dead', harm: 'Someone hurt or killed', death: 'Someone killed', officerHurt: 'An officer hurt',
};
const GATE_TYPES: readonly IncidentType[] = ['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue'];
/** Harm and death bands per call type, for the random style. */
const GATE_BANDS: Record<string, { harm: [number, number]; death: [number, number] }> = {
  hostage_crisis: { harm: [0.03, 0.3], death: [0, 0.08] },
  barricaded: { harm: [0.01, 0.3], death: [0, 0.08] },
  active_armed_incident: { harm: [0.15, 0.55], death: [0.01, 0.16] },
  protected_rescue: { harm: [0.1, 0.5], death: [0, 0.12] },
};
const gateCheck = (type: IncidentType, style: Policy, calls: number, metric: GateMetric, bounds: { min?: number; max?: number }, why: string): GateCheck =>
  ({ id: `${type}.${style}.${metric}`, label: GATE_LABELS[metric], type, style, calls, tier: 2, metric, ...bounds, why });

/** The balance gate. Every call is played through the real engine with real dice and a different
 * day-one squad each time, at tier 2, under four player styles. The dice and squads come from
 * fixed seeds, so these numbers are exact for the content as written: a change that makes the game
 * softer or crueler fails here and has to be argued.
 *
 * The target, per call, for the random style: about a third clean, a third resolved at a cost, the
 * rest unresolved, hurt or dead. Someone dies in a few percent of calls, most of them armed
 * incidents. Waiting is safe only when it should be, and so is rushing. CI (call-tree-balance.test.ts)
 * and the Scenario Lab run these same checks. */
export const GATE_SUITE: readonly GateCheck[] = [
  ...GATE_TYPES.flatMap(type => {
    const why = 'The random style meets real consequences, not ruin.';
    return [
      gateCheck(type, 'random', 60, 'clean', { min: 0.15, max: 0.6 }, why),
      gateCheck(type, 'random', 60, 'bad', { min: 0.15, max: 0.65 }, why),
      gateCheck(type, 'random', 60, 'harm', { min: GATE_BANDS[type].harm[0], max: GATE_BANDS[type].harm[1] }, why),
      gateCheck(type, 'random', 60, 'death', { min: GATE_BANDS[type].death[0], max: GATE_BANDS[type].death[1] }, why),
    ];
  }),
  gateCheck('active_armed_incident', 'fast', 60, 'officerHurt', { min: 0.25 }, 'Rushing an armed subject hurts officers.'),
  gateCheck('active_armed_incident', 'patient', 60, 'officerHurt', { max: 0.05 }, 'Waiting an armed subject out keeps officers safe.'),
  gateCheck('active_armed_incident', 'patient', 60, 'harm', { min: 0.05 }, 'Waiting is not free either: when the door is splitting, the wait is what kills the person behind it.'),
  gateCheck('protected_rescue', 'patient', 60, 'harm', { min: 0.15 }, 'Waiting out a rescue costs the resident when their oxygen is short.'),
  ...GATE_TYPES.map(type => gateCheck(type, 'best_odds', 40, 'clean', { max: 0.75 }, 'No style of play guarantees a clean ending.')),
];

/** One set of played calls the gate reads: every check with the same type, style, count and tier
 * shares it. */
export interface GateJob { type: IncidentType; style: Policy; calls: number; tier: number }
/** The distinct runs a suite needs, in the suite's order: 11 for GATE_SUITE. */
export function gateJobs(suite: readonly GateCheck[] = GATE_SUITE): GateJob[] {
  const jobs = new Map<string, GateJob>();
  for (const { type, style, calls, tier } of suite) {
    const key = gateJobKey({ type, style, calls, tier });
    if (!jobs.has(key)) jobs.set(key, { type, style, calls, tier });
  }
  return [...jobs.values()];
}
/** Stable id of a job, for caches and for finding a check's job. */
export const gateJobKey = (job: GateJob): string => `${job.type}:${job.style}:${job.calls}:t${job.tier}`;

/** A check's metric from a distribution, added the way the gate always added it (the shares are
 * already rounded). */
export function gateMetric(d: Distribution, metric: GateMetric): number {
  const harm = d.weights.hurt + d.weights.death;
  return metric === 'clean' ? d.weights.clean : metric === 'bad' ? d.weights.unresolved + harm : metric === 'harm' ? harm
    : metric === 'death' ? d.weights.death : d.officerHurtRate;
}
/** Whether one call counts toward a metric: the per-run form of gateMetric, for paired deltas. */
export function runMetric(r: CallResult, metric: GateMetric): 0 | 1 {
  const hit = metric === 'clean' ? r.weight === 'clean' : metric === 'bad' ? r.weight === 'unresolved' || r.weight === 'hurt' || r.weight === 'death'
    : metric === 'harm' ? r.weight === 'hurt' || r.weight === 'death' : metric === 'death' ? r.weight === 'death' : r.officersHurt > 0;
  return hit ? 1 : 0;
}
/** Whether a value is inside a check's band. */
export function gatePasses(check: GateCheck, value: number): boolean {
  return (check.min === undefined || value >= check.min) && (check.max === undefined || value <= check.max);
}
