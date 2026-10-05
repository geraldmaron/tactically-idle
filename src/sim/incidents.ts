// Incident board. Generated incidents arrive on a seeded schedule and expire if
// ignored (silently, never penalised). Settlement treats every arrival and every
// expiry as an event boundary (economy.settle splits segments there), so one long
// offline settlement and many short online ticks produce the same board.
//
// Only specs and ids live here. Full scenarios are generated later, on demand,
// through scenario-registry; settlement never builds one.
//
// This module must not import economy.ts (economy imports it).
import type { Department, GameState, HandlerResult, Id, IncidentCard } from './types';
import { next } from './rng';
import { drawIncidentSpec, incidentId, parseIncidentId } from '../gen/incident';
import { DECISION_EXERCISES } from '../content/scenarios/decision-exercises';

const HOUR = 3_600_000;
const MINUTE = 60_000;

export const INCIDENT_TUNING = {
  /** Gap between scheduled arrivals, uniform in [min, max]. */
  minIntervalMs: 45 * MINUTE,
  maxIntervalMs: 90 * MINUTE,
  /** How long a card stays on the board, uniform in [min, max]. */
  minLifetimeMs: 6 * HOUR,
  maxLifetimeMs: 12 * HOUR,
  /** The board holds at most this many cards. An arrival on a full board is lost. */
  boardMax: 5,
  /** Cards seeded by createInitialState / the v2 -> v3 migration. */
  initialCount: 3,
  /** boardSummary counts a card as expiring soon inside this window. */
  expiringSoonMs: 2 * HOUR,
};

/** Reward multiplier by tier 1..5, for the engine and the generator. */
export const TIER_REWARD_MULTIPLIERS: readonly number[] = [1.0, 1.35, 1.8, 2.4, 3.2];

/** Tier 1..5 (clamped, rounded) -> reward multiplier applied to funding, dev points and trust. */
export function tierRewardMultiplier(tier: number): number {
  const t = Number.isFinite(tier) ? Math.min(5, Math.max(1, Math.round(tier))) : 1;
  return TIER_REWARD_MULTIPLIERS[t - 1];
}

/** Department plus the one field this module adds (JSON-safe, optional like candidateRefreshedAt). */
type DepartmentExt = Department & { nextIncidentAt?: number };

/** Epoch ms of the next scheduled arrival, or null when no schedule exists yet. */
export function nextIncidentAt(state: GameState): number | null {
  const v = (state.department as DepartmentExt).nextIncidentAt;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function setNextIncidentAt(d: GameState, at: number): void {
  (d.department as DepartmentExt).nextIncidentAt = at;
}

function board(d: GameState): IncidentCard[] {
  // Older in-memory states (test fixtures) may not have a board yet.
  if (!Array.isArray(d.incidents)) d.incidents = [];
  return d.incidents;
}

/** Uniform draw in [lo, hi], whole milliseconds. */
function drawBetween(rng: number, lo: number, hi: number): { ms: number; state: number } {
  const r = next(rng);
  return { ms: Math.round(lo + r.value * (hi - lo)), state: r.state };
}

/**
 * Remove a card from the board (the engine calls this when an operation starts
 * from it). Returns the removed card, or null when it was not on the board.
 */
export function takeIncident(d: GameState, id: Id): IncidentCard | null {
  const cards = board(d);
  const i = cards.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const [card] = cards.splice(i, 1);
  return card;
}

/**
 * Draw one spec from the department PRNG and add its card, arriving at `at`.
 * Returns false (after still advancing the PRNG deterministically) when the id is
 * already on the board or is the active run's scenario.
 */
function drawCard(d: GameState, at: number): IncidentCard | null {
  const dep = d.department;
  const run = d.activeRun;
  const activeStory = run && run.scenarioVersion >= 5
    ? parseIncidentId(run.scenarioId) ?? DECISION_EXERCISES.find(exercise => exercise.id === run.scenarioId)?.spec
    : null;
  const avoidTypes = d.contentVersion >= 5
    ? [...board(d).flatMap(card => { const spec = parseIncidentId(card.id); return spec && spec.contentVersion >= 5 ? [spec.type] : []; }), ...(activeStory ? [activeStory.type] : [])]
    : undefined;
  const recentTypes = d.contentVersion >= 6 ? d.debriefs.filter(report => !report.practice).slice(0, 2).flatMap(report => { const spec = parseIncidentId(report.scenarioId); return spec ? [spec.type] : []; }) : undefined;
  const drawn = drawIncidentSpec(d.rngState, { level: dep.level, trust: dep.trust, contentVersion: d.contentVersion, avoidFamilies: [...board(d).map((c) => c.familyId), ...(run ? [run.locationFamilyId] : [])], ...(avoidTypes ? { avoidTypes } : {}), ...(recentTypes ? { recentTypes } : {}) });
  const spec = { ...drawn.spec, tier: Math.min(5, Math.max(1, Math.round(drawn.spec.tier))) };
  const life = drawBetween(drawn.state, INCIDENT_TUNING.minLifetimeMs, INCIDENT_TUNING.maxLifetimeMs);
  d.rngState = life.state;
  const id = incidentId(spec);
  const cards = board(d);
  if (cards.some((c) => c.id === id) || d.activeRun?.scenarioId === id) return null;
  const card: IncidentCard = {
    id,
    type: spec.type,
    familyId: spec.familyId,
    tier: spec.tier,
    arrivedAt: at,
    expiresAt: at + life.ms,
    seen: false,
  };
  cards.unshift(card); // newest first
  return card;
}

/** Draw the gap to the following arrival and store the new schedule. */
function scheduleAfter(d: GameState, from: number): void {
  const iv = drawBetween(d.rngState, INCIDENT_TUNING.minIntervalMs, INCIDENT_TUNING.maxIntervalMs);
  d.rngState = iv.state;
  setNextIncidentAt(d, from + iv.ms);
}

/**
 * Fill the board with `count` cards arriving at `now` and start the schedule.
 * Used for a new game and for the v2 -> v3 migration. Deterministic in
 * (rngState, level, trust, now).
 */
export function seedIncidentBoard(d: GameState, now: number, count: number = INCIDENT_TUNING.initialCount): void {
  board(d).length = 0;
  let attempts = 0;
  while (board(d).length < count && attempts < count * 8) {
    attempts++;
    drawCard(d, now);
  }
  scheduleAfter(d, now);
}

/**
 * Apply every board event due at or before `t`: arrivals in schedule order (each
 * after the expiries that precede it), then final expiries, and drop the card of
 * the run in progress. `_prev` is unused: arrivals follow the stored schedule, not
 * the sweep; it keeps the signature parallel to the other settlement hooks.
 */
export function applyIncidentsDue(d: GameState, _prev: number, t: number): void {
  if (nextIncidentAt(d) === null) {
    // A state without a schedule (older fixture or hand-built save): start one from the
    // settled clock without consuming the PRNG, so existing sequences are not disturbed.
    const L = d.department.lastSettledAt;
    const r = next(((d.rngState ^ Math.imul(Math.floor(L / 1000) | 0, 0x9e3779b1)) >>> 0) || 1);
    setNextIncidentAt(d, L + Math.round(INCIDENT_TUNING.minIntervalMs + r.value * (INCIDENT_TUNING.maxIntervalMs - INCIDENT_TUNING.minIntervalMs)));
  }
  let at = nextIncidentAt(d)!;
  while (at <= t) {
    // Slots freed by expiry before this arrival count before it.
    d.incidents = board(d).filter((c) => c.expiresAt > at);
    if (board(d).length < INCIDENT_TUNING.boardMax) drawCard(d, at);
    scheduleAfter(d, at);
    at = nextIncidentAt(d)!;
  }
  const run = d.activeRun;
  d.incidents = board(d).filter((c) => c.expiresAt > t && !(run && !run.practice && c.id === run.scenarioId));
}

/** Earliest future board event after `t` (an arrival or an expiry), or null. */
export function nextIncidentEventTime(d: GameState, t: number): number | null {
  let e: number | null = null;
  const consider = (x: number | null) => {
    if (x !== null && x > t && (e === null || x < e)) e = x;
  };
  consider(nextIncidentAt(d));
  for (const c of board(d)) consider(c.expiresAt);
  return e;
}

// ---------------------------------------------------------------- commands

function markIncidentsSeen(d: GameState): HandlerResult {
  for (const c of board(d)) c.seen = true;
  return { ok: true };
}

export const INCIDENT_HANDLERS = { markIncidentsSeen };

// ---------------------------------------------------------------- views

export interface BoardSummary {
  /** Cards still live at `now`. */
  count: number;
  /** Live cards the player has not seen yet. */
  newCount: number;
  /**
   * Epoch ms of the next scheduled arrival (never before `now`). Null when the board is
   * full (an arrival would be lost until a slot opens) or no schedule exists.
   */
  nextArrivalAt: number | null;
  /** Live cards that expire within INCIDENT_TUNING.expiringSoonMs. */
  expiringSoon: number;
}

export function boardSummaryOf(state: GameState, now: number): BoardSummary {
  const t = Math.max(now, state.department.clockHighWater);
  const live = (state.incidents ?? []).filter((c) => c.expiresAt > t);
  const at = nextIncidentAt(state);
  return {
    count: live.length,
    newCount: live.filter((c) => !c.seen).length,
    nextArrivalAt: live.length >= INCIDENT_TUNING.boardMax || at === null ? null : Math.max(at, t),
    expiringSoon: live.filter((c) => c.expiresAt - t <= INCIDENT_TUNING.expiringSoonMs).length,
  };
}
