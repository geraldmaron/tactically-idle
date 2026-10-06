import { SCENARIOS } from '../../../content/scenarios';
import { createInitialState } from '../../../sim/department';
import { buildLocation } from '../../../sim/location';
import { actionViews, stageContinuations } from '../../../sim/operation-selectors';
import { RESOLUTION_TUNING } from '../../../sim/resolution';
import { responseFailurePlan } from '../../../sim/response-failure';
import { next } from '../../../sim/rng';
import { getScenario } from '../../../sim/scenario-registry';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { apply, NOW, startCmd } from '../../../sim/test-fixtures';
import type { ActionView, GameState, OutcomeBand } from '../../../sim/types';

/** Drives the real operation engine for the content gates.
 * - Distinctness exploration aims each decision at an outcome band by choosing the run's
 *   dice before it commits, so every branch is reached on purpose. Such a run is never
 *   saved: the save validator rightly rejects a sample stream that was tampered with.
 * - Journeys use the engine's own dice from a campaign seed and save after every step.
 * Either way the dispatcher evaluates eligibility, applies effects and ends the call. */
export { NOW };

/** One rng state per 1/400th of the sample range, found by scanning the generator. */
const SAMPLE_STATES: number[] = (() => {
  const bins = 400, out = new Array<number>(bins).fill(-1);
  let filled = 0;
  for (let k = 1; filled < bins && k < 5_000_000; k++) {
    const bin = Math.floor(next(k).value * bins);
    if (out[bin] < 0) { out[bin] = k; filled++; }
  }
  return out;
})();
function stateForSample(sample: number): number {
  const bin = Math.max(0, Math.min(SAMPLE_STATES.length - 1, Math.floor(sample * SAMPLE_STATES.length)));
  return SAMPLE_STATES[bin];
}

/** A sample that lands in `band` for this view's odds, or null when the band cannot occur. */
export function sampleFor(view: ActionView, band: OutcomeBand): number | null {
  const T = RESOLUTION_TUNING, core = 1 - T.setbackChance - T.luckChance;
  if (band === 'adverse') return T.setbackChance / 2;
  if (band === 'favorable') return 1 - T.luckChance / 2;
  if (view.likelihood.mixed <= 1e-9) return null;
  // Recover the margin from the displayed odds, then aim at the middle of the mixed range.
  const rawFav = (view.likelihood.favorable - T.luckChance) / core, rawAdv = (view.likelihood.adverse - T.setbackChance) / core;
  const margin = rawFav > 1e-9 && rawFav < 1 - 1e-9 ? T.favorableAt + T.span * (rawFav - 0.5)
    : rawAdv > 1e-9 && rawAdv < 1 - 1e-9 ? T.adverseAt - T.span * (rawAdv - 0.5) : null;
  if (margin === null) return null;
  const lo = Math.max(0, 0.5 + (T.adverseAt - margin) / T.span), hi = Math.min(1, 0.5 + (T.favorableAt - margin) / T.span);
  if (hi - lo < 0.01) return null;
  return T.setbackChance + core * ((lo + hi) / 2);
}

/** Start a practice run of `scenarioId` with one squad at the first entry. */
export function startPractice(scenarioId: string, campaignSeed = 719): GameState {
  const s = getScenario(scenarioId);
  if (!s) throw new Error(`Unknown scenario ${scenarioId}`);
  const before = createInitialState(NOW, campaignSeed);
  if (s.incident) before.incidents = [{ id: s.id, type: s.incident.type, familyId: s.incident.familyId, tier: s.incident.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
  const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
  const started = apply(before, startCmd(s.id, ['A'], { positions: { A: entry }, practice: true }));
  if (!started.result.ok) throw new Error(`Could not start ${scenarioId}: ${started.result.reason}`);
  return started.state;
}

export interface Move { kind: 'decide' | 'continue' | 'fail'; actionId: string; band?: OutcomeBand }
/** Every move the engine allows from here, with each reachable band of each eligible action.
 * Pass the state's views when already computed; evaluating them is the expensive part. */
export function availableMoves(state: GameState, views: ActionView[] = actionViews(state, NOW, 'A')): Move[] {
  const moves: Move[] = [];
  for (const view of views.filter(view => view.eligible))
    for (const band of ['favorable', 'mixed', 'adverse'] as const) if (sampleFor(view, band) !== null) moves.push({ kind: 'decide', actionId: view.id, band });
  for (const continuation of stageContinuations(state)) moves.push({ kind: 'continue', actionId: continuation.actionId });
  if (!moves.length && responseFailurePlan(state)) moves.push({ kind: 'fail', actionId: 'response_failure' });
  return moves;
}

/** Apply one move through the dispatcher. Returns null when the engine refuses it or the
 * sampled band differs from the one aimed at. */
export function applyMove(state: GameState, move: Move, views?: ActionView[]): GameState | null {
  if (move.kind === 'continue') {
    const continuation = stageContinuations(state).find(entry => entry.actionId === move.actionId);
    const result = continuation && apply(state, { type: 'continueStage', actionId: continuation.actionId, revision: continuation.revision });
    return result?.result.ok ? result.state : null;
  }
  if (move.kind === 'fail') {
    const plan = responseFailurePlan(state);
    const result = plan && apply(state, { type: 'endFailedResponse', runId: plan.runId, revision: plan.revision });
    return result?.result.ok ? result.state : null;
  }
  const view = (views ?? actionViews(state, NOW, 'A')).find(entry => entry.id === move.actionId && entry.eligible);
  const sample = view && sampleFor(view, move.band!);
  if (!view || sample === null || sample === undefined) return null;
  const aimed = structuredClone(state);
  aimed.activeRun!.rngState = stateForSample(sample);
  const result = apply(aimed, { type: 'decide', actionId: view.id, actingSquadIds: view.actingSquadIds, supportSquadIds: view.supportSquadIds });
  if (!result.result.ok || result.state.activeRun!.history.at(-1)?.band !== move.band) return null;
  return result.state;
}

/** The first move a player could make: the first eligible action, else a stage
 * continuation, else the failed-response report. */
export function firstMove(state: GameState): Move | null {
  const view = actionViews(state, NOW, 'A').find(entry => entry.eligible);
  if (view) return { kind: 'decide', actionId: view.id };
  const continuation = stageContinuations(state)[0];
  if (continuation) return { kind: 'continue', actionId: continuation.actionId };
  return responseFailurePlan(state) ? { kind: 'fail', actionId: 'response_failure' } : null;
}
/** Apply a move with the run's own dice (no band aimed at), as a player would. */
export function applyNaturalMove(state: GameState, move: Move): GameState | null {
  if (move.kind !== 'decide') return applyMove(state, move);
  const view = actionViews(state, NOW, 'A').find(entry => entry.id === move.actionId && entry.eligible);
  const result = view && apply(state, { type: 'decide', actionId: view.id, actingSquadIds: view.actingSquadIds, supportSquadIds: view.supportSquadIds });
  return result?.result.ok ? result.state : null;
}

/** Make a draft definition (never issued) resolvable by ID for the length of `run`, so the
 * gates can play a package before it is registered. Issued and generated IDs are refused. */
export function withDraftScenario<T>(scenario: ScenarioDefinition, run: (id: string) => T): T {
  const id = `draft:${scenario.id}`;
  if (SCENARIOS[id]) throw new Error(`Draft ${id} is already registered`);
  SCENARIOS[id] = { ...scenario, id };
  try { return run(id); } finally { delete SCENARIOS[id]; }
}
