import { SCENARIOS } from '../../../content/scenarios';
import { createInitialState } from '../../../sim/department';
import { cascadeStates, drawnKey, incomingFireCuts, incomingFireOdds } from '../../../sim/drawn-effects';
import { cascadeKey } from '../drawn-model';
import type { DrawnDistribution, ForceProfile } from '../../../sim/drawn-effects';
import { cutFor, forceCuts } from '../../../sim/force-risk';
import { buildLocation } from '../../../sim/location';
import { actionViews, drawnDistributionAt } from '../../../sim/operation-selectors';
import { RESOLUTION_TUNING } from '../../../sim/resolution';
import { responseFailurePlan } from '../../../sim/response-failure';
import { next } from '../../../sim/rng';
import { getScenario } from '../../../sim/scenario-registry';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { apply, NOW, startCmd, stockKit } from '../../../sim/test-fixtures';
import type { ActionView, CertId, GameState, Id, OutcomeBand } from '../../../sim/types';
import { isLapse } from '../../../sim/types';
import { lapsedThreat, openThreat } from '../../../sim/clocks';

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

/** What a lab run changes about the gate's start (Scenario Lab, src/dev/lab/model/squads.ts):
 * `items` stocks these instead of every item the department can field; `certs` are granted to
 * squad A's first officer before stocking. Without options the run is the gate's own. */
export interface GateRunOptions { items?: readonly Id[]; certs?: readonly CertId[] }

/** Start a live run of `scenarioId` with one squad at the first entry. A generated call is
 * the only card on a new campaign's board, and squad A carries one fresh owned unit of every
 * item the department can field (stockKit), so no choice is closed for want of gear. */
export function startGateRun(scenarioId: string, campaignSeed = 719, opts: GateRunOptions = {}): GameState {
  const s = getScenario(scenarioId);
  if (!s) throw new Error(`Unknown scenario ${scenarioId}`);
  const before = createInitialState(NOW, campaignSeed);
  if (s.incident) before.incidents = [{ id: s.id, type: s.incident.type, familyId: s.incident.familyId, tier: s.incident.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
  const first = before.squads.find(squad => squad.id === 'A')?.officerIds[0];
  const officer = first === undefined ? undefined : before.officers[first];
  if (opts.certs?.length && !officer) throw new Error('Squad A has no officer to grant certifications to');
  // Certs live on the officer record only; granting them draws nothing, so the dice are unchanged.
  if (officer) for (const cert of opts.certs ?? []) if (!officer.certs.includes(cert)) officer.certs = [...officer.certs, cert];
  const kit = opts.items ? stockKit(before, ['A'], [...opts.items]) : stockKit(before, ['A']);
  const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
  const started = apply(kit.state, startCmd(s.id, ['A'], { positions: { A: entry }, loadouts: kit.loadouts, units: kit.units }));
  if (!started.result.ok) throw new Error(`Could not start ${scenarioId}: ${started.result.reason}`);
  return started.state;
}

/** `drawn` (Scenario Lab only): with a band, the drawn result each drawn effect of that band
 * settles on, as compiled variant keys in the band's effect order (`['firearm:none', 'wounded']`,
 * `['follows+stays']`). Without it a forced band takes whatever drawn result its sample brings. */
/** `lapse`: the open decision point's time runs out with no choice made; `actionId` is the threat's
 * id (NodeThreat.id). */
export interface Move { kind: 'decide' | 'fail' | 'lapse'; actionId: string; band?: OutcomeBand; drawn?: readonly string[] }

/** The timer a driven lapse runs at. The stall is an input (OperationRun.decisionOpenedAt) and the
 * engine caps it at the threat's minutes, so the rate never changes what the lapse does. */
export const LAPSE_TIMER = 'standard' as const;

/** `state` with its open decision's window run out by NOW: opened a day earlier, nothing pending or
 * paused. The same as waiting, without moving the department's clock. */
export function withLapsedWindow(state: GameState): GameState {
  const run = state.activeRun!;
  const { decisionPending: _pending, decisionPausedAt: _paused, ...rest } = run;
  return { ...state, activeRun: { ...rest, decisionOpenedAt: Math.max(NOW, state.department.clockHighWater) - 24 * 3600_000 } };
}

/** The open decision point's threat when letting it run out would move the call (it has a timeout). */
export function lapseMove(state: GameState): Move | null {
  const run = state.activeRun;
  const scenario = run && run.status === 'active' ? getScenario(run.scenarioId) : null;
  const threat = run && scenario ? openThreat(scenario, run) : null;
  return threat?.timeout?.length ? { kind: 'lapse', actionId: threat.id } : null;
}
/** Every move the engine allows from here, with each reachable band of each eligible action.
 * Pass the state's views when already computed; evaluating them is the expensive part. */
export function availableMoves(state: GameState, views: ActionView[] = actionViews(state, NOW, 'A')): Move[] {
  const moves: Move[] = [];
  for (const view of views.filter(view => view.eligible))
    for (const band of ['favorable', 'mixed', 'adverse'] as const) if (sampleFor(view, band) !== null) moves.push({ kind: 'decide', actionId: view.id, band });
  const lapse = lapseMove(state);
  if (lapse) moves.push(lapse);
  if (!moves.length && responseFailurePlan(state)) moves.push({ kind: 'fail', actionId: 'response_failure' });
  return moves;
}

/** Apply one move through the dispatcher. Returns null when the engine refuses it or the
 * sampled band differs from the one aimed at. */
/** `state` with the run's dice set to `rngState`, for a decide through `apply`. A shallow copy is
 * enough because `apply` deep-clones before the handler runs; a deep clone here doubled the cost of
 * every commit in the coverage walk. */
export function withDice(state: GameState, rngState: number): GameState {
  return { ...state, activeRun: { ...state.activeRun!, rngState } };
}

export function applyMove(state: GameState, move: Move, views?: ActionView[]): GameState | null {
  if (move.kind === 'lapse') {
    const run = state.activeRun;
    const ready = run ? withLapsedWindow(state) : null;
    const scenario = run ? getScenario(run.scenarioId) : null;
    const due = ready && scenario ? lapsedThreat(scenario, ready.activeRun!, ready.department.clockHighWater, NOW, LAPSE_TIMER) : null;
    if (!run || !ready || due?.id !== move.actionId) return null;
    const result = apply(ready, { type: 'lapse', revision: run.revision, threatId: move.actionId }, NOW, { timer: LAPSE_TIMER });
    return result.result.ok ? result.state : null;
  }
  if (move.kind === 'fail') {
    const plan = responseFailurePlan(state);
    const result = plan && apply(state, { type: 'endFailedResponse', runId: plan.runId, revision: plan.revision });
    return result?.result.ok ? result.state : null;
  }
  const view = (views ?? actionViews(state, NOW, 'A')).find(entry => entry.id === move.actionId && entry.eligible);
  const sample = view && sampleFor(view, move.band!);
  if (!view || sample === null || sample === undefined) return null;
  if (move.drawn?.length) return applyAimedDrawn(state, view, move.band!, move.drawn);
  const result = apply(withDice(state, stateForSample(sample)), { type: 'decide', actionId: view.id, actingSquadIds: view.actingSquadIds, supportSquadIds: view.supportSquadIds });
  const h = result.state.activeRun!.history.at(-1);
  if (!result.result.ok || isLapse(h) || h?.band !== move.band) return null;
  return result.state;
}

// ---------------------------------------------------------------- aimed drawn results (Scenario Lab)
// A forced band also fixes the drawn results that follow it (incoming fire, team force, a cascade),
// because they take the next samples of the same dice. The lab asks for both: it looks for a dice
// state whose samples, taken in the order decide() takes them (the band sample, the v7 force-risk
// roll when the action carries one, then one sample per drawn effect in matched order;
// sim/operation.ts decide, sim/drawn-effects.ts resolveDrawn), land in the band and settle every
// drawn effect on the key asked for. The cuts and the cascade states are the engine's own exports,
// and the commit is checked against what the engine recorded, so nothing here decides a result.

/** The drawn results decide() would settle if `view` came out `band` now, one entry per drawn
 * effect in matched order, each result with its natural chance (drawnDistributionAt, committing with
 * the view's squads). Empty when the band draws nothing. */
export function drawnAt(state: GameState, view: ActionView, band: OutcomeBand): DrawnDistribution[] {
  return drawnDistributionAt(state, view.id, band, view.actingSquadIds);
}

/** Every combination of the drawn results in `dists` with its natural chance: the effects take
 * separate samples, so the chances multiply. One empty combination when nothing is drawn. */
export function drawnCombos(dists: readonly DrawnDistribution[]): { keys: string[]; p: number }[] {
  let combos: { keys: string[]; p: number }[] = [{ keys: [], p: 1 }];
  for (const dist of dists) combos = combos.flatMap(combo => dist.results.filter(result => result.p > 0)
    .map(result => ({ keys: [...combo.keys, result.key], p: combo.p * result.p })));
  return combos;
}

/** The natural chance of these drawn keys, or 0 when one can't happen (or the count is wrong). */
export function drawnChance(dists: readonly DrawnDistribution[], keys: readonly string[]): number {
  if (dists.length !== keys.length) return 0;
  return dists.reduce((p, dist, i) => p * (dist.results.find(result => result.key === keys[i])?.p ?? 0), 1);
}

/** How many rng states the search looks at before giving up: about 4 million, a few hundred ms at
 * worst, enough for any combination with a natural chance above about 1 in a million. */
export const DRAWN_SCAN_LIMIT = 1 << 22;

/** The dice state for an aimed decision: its first sample lands in `band` for this view's odds and
 * the drawn samples after it settle on `keys`; null when that can't happen (a band the margin can't
 * produce, a key with no chance, the wrong number of keys) or no state within the scan does it.
 * `from` resumes the scan after an earlier state. */
export function aimedDrawnState(state: GameState, view: ActionView, band: OutcomeBand, keys: readonly string[], from = 1): number | null {
  const run = state.activeRun;
  if (!run || run.status !== 'active' || run.stage === 'debrief' || sampleFor(view, band) === null) return null;
  const scenario = getScenario(run.scenarioId);
  const action = scenario?.stages[run.stage].actions.find(entry => entry.id === view.id);
  if (!scenario || !action) return null;
  const dists = drawnAt(state, view, band);
  if (!(drawnChance(dists, keys) > 0)) return null;
  // What one sample settles each drawn effect on: drawPlan and planKey in sim/drawn-effects.ts,
  // read through the same exported cuts and cascade states.
  const person = (id: Id) => scenario.incidentPeople?.find(entry => entry.id === id);
  const settle = dists.map((dist, i): ((sample: number) => string) => {
    const drawn = action.outcomes[band][dist.effect].drawn!;
    if (drawn.model === 'incoming_fire') {
      const shooter = person(drawn.from);
      const { hit, serious } = shooter ? incomingFireOdds(shooter) : { hit: 0, serious: 0 };
      const cuts = incomingFireCuts(hit, serious);
      return sample => cutFor(cuts, sample);
    }
    if (drawn.model === 'cascade') return sample => cascadeKey(cascadeStates(scenario, run, drawn.members, sample));
    // Every result of one force carries the profile the engine picked (teamForceProfile).
    const profile = keys[i].slice(0, keys[i].indexOf(':')) as ForceProfile;
    const cuts = forceCuts(profile, person(drawn.on)?.noFatal ?? false);
    return sample => drawnKey('team_force', cutFor(cuts, sample), profile);
  });
  // The band's window on the first sample, from the view's odds (bandFor is monotone in the
  // sample: badly, then mixed, then well), kept a hair inside its edges.
  const { favorable, adverse } = view.likelihood, edge = 1e-9;
  const lo = band === 'adverse' ? 0 : (band === 'mixed' ? adverse : 1 - favorable) + edge;
  const hi = band === 'favorable' ? 1 : (band === 'mixed' ? 1 - favorable : adverse) - edge;
  const forceRoll = !!view.forceRisk;
  for (let k = Math.max(1, Math.floor(from)); k <= DRAWN_SCAN_LIMIT; k++) {
    const first = next(k);
    if (first.value < lo || first.value >= hi) continue;
    let at = forceRoll ? next(first.state).state : first.state, hit = true;
    for (let i = 0; i < settle.length && hit; i++) {
      const roll = next(at);
      hit = settle[i](roll.value) === keys[i];
      at = roll.state;
    }
    if (hit) return k;
  }
  return null;
}

/** Commit an aimed decision: the band and every drawn result as asked, checked against what the
 * engine recorded. Null when the engine refuses it or can't produce it. */
function applyAimedDrawn(state: GameState, view: ActionView, band: OutcomeBand, keys: readonly string[]): GameState | null {
  // A state the search found settles as asked unless a sample sits on a cut's float edge; then the
  // next one will do.
  for (let tries = 0, from = 1; tries < 4; tries++) {
    const k = aimedDrawnState(state, view, band, keys, from);
    if (k === null) return null;
    const result = apply(withDice(state, k), { type: 'decide', actionId: view.id, actingSquadIds: view.actingSquadIds, supportSquadIds: view.supportSquadIds });
    if (!result.result.ok) return null;
    const h = result.state.activeRun!.history.at(-1);
    if (isLapse(h)) return null;
    const got = h?.committed?.drawn?.map(record => record.key) ?? [];
    if (h?.band === band && got.length === keys.length && got.every((key, i) => key === keys[i])) return result.state;
    from = k + 1;
  }
  return null;
}

/** Every move availableMoves lists, with each forced band that draws a result split into one move
 * per drawn combination (`drawn` set), and the natural chance of what each move asks for: the band's
 * chance times the drawn results' (1 for continuations and the failed-response report). */
export function aimedMoves(state: GameState, views: ActionView[] = actionViews(state, NOW, 'A')): (Move & { p: number })[] {
  const byId = new Map(views.map(view => [view.id, view]));
  // A lapse is the player not choosing, not a result with a chance: the Lab's explore and x-ray
  // walk the choices (the call-tree gates walk the lapses through availableMoves).
  return availableMoves(state, views).filter(move => move.kind !== 'lapse').flatMap(move => {
    const view = move.kind === 'decide' ? byId.get(move.actionId) : undefined;
    if (!view || !move.band) return [{ ...move, p: 1 }];
    const pBand = view.likelihood[move.band];
    const dists = drawnAt(state, view, move.band);
    if (!dists.length) return [{ ...move, p: pBand }];
    return drawnCombos(dists).map(combo => ({ ...move, drawn: combo.keys, p: pBand * combo.p }));
  });
}

/** The first move a player could make: the first eligible action, else a stage
 * continuation, else the failed-response report. */
export function firstMove(state: GameState): Move | null {
  const view = actionViews(state, NOW, 'A').find(entry => entry.eligible);
  if (view) return { kind: 'decide', actionId: view.id };
  return responseFailurePlan(state) ? { kind: 'fail', actionId: 'response_failure' } : null;
}
/** Apply a move with the run's own dice (no band aimed at), as a player would. Pass the views the
 * choice was offered in (the squads it commits with) when they are not squad A's defaults. */
export function applyNaturalMove(state: GameState, move: Move, views?: ActionView[]): GameState | null {
  if (move.kind !== 'decide') return applyMove(state, move);
  const view = (views ?? actionViews(state, NOW, 'A')).find(entry => entry.id === move.actionId && entry.eligible);
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
