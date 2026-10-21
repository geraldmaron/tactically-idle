// Incident board. Generated incidents arrive on a seeded schedule and expire if
// ignored (silently, never penalised). Settlement treats every arrival and every
// expiry as an event boundary (economy.settle splits segments there), so one long
// offline settlement and many short online ticks produce the same board.
//
// Only specs and ids live here. Full scenarios are generated later, on demand,
// through scenario-registry; settlement never builds one.
//
// This module must not import economy.ts (economy imports it).
import { comebackTier, playerProfile } from './player-profile';
import type { Department, GameState, HandlerResult, Id, IncidentCard } from './types';
import { next } from './rng';
import { drawIncidentSpec, incidentId, parseIncidentId } from '../gen/incident';
import { SCENARIO_TYPES } from '../content/scenario-types';
import { unlockedTypes } from '../content/unlocks';
import { noveltyWeights, recordArrival, recordDispatch } from './casebook';
import { reputationWeights } from './reputation';
import type { IncidentType } from './scenario-types';
import { tunable } from './tuning';
import { callTreeAt } from '../content/call-trees';
import { scenarioRecipe } from '../content/scenario-recipes';
import type { ContentDescriptor } from '../content/content-descriptors';

/** Content v11 gates board draws by capability and weights unseen frameworks first. */

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Tunable (sim/tuning.ts). Arrival times and card expiries are stored when drawn, so a change
 * reaches new arrivals and new cards only. */
export const INCIDENT_TUNING = tunable('INCIDENT_TUNING', {
  /** Gap between scheduled arrivals, uniform in [min, max]. */
  minIntervalMs: 45 * MINUTE,
  maxIntervalMs: 90 * MINUTE,
  /** How long a card stays on the board, uniform in [min, max]. */
  minLifetimeMs: 6 * HOUR,
  maxLifetimeMs: 12 * HOUR,
  /** The board holds at most this many cards. An arrival on a full board is lost. */
  boardMax: 5,
  /** Cards seeded by createInitialState. */
  initialCount: 3,
  /** boardSummary counts a card as expiring soon inside this window. */
  expiringSoonMs: 2 * HOUR,
}, { guard: next => next.minIntervalMs <= 0 || next.minIntervalMs > next.maxIntervalMs ? 'Arrival gaps need 0 < minIntervalMs ≤ maxIntervalMs.'
  : next.minLifetimeMs <= 0 || next.minLifetimeMs > next.maxLifetimeMs ? 'Card lifetimes need 0 < minLifetimeMs ≤ maxLifetimeMs.' : null });


// ---------------------------------------------------------------- content filter

/** What the player keeps off the board (docs/content-rating.md): any set of descriptors. A situation
 * carrying any of them is left out. A pure input: the store owns the setting and passes it in. */
export interface ContentExclusion { avoid: readonly ContentDescriptor[] }

/** The descriptors an exclusion rules out. */
export function excludedDescriptors(exclusion: ContentExclusion): Set<ContentDescriptor> {
  return new Set<ContentDescriptor>(exclusion.avoid);
}

const SITUATIONS = [0, 1, 2] as const;
type SituationIndex = (typeof SITUATIONS)[number];

/** Per kind of call, the situations an exclusion leaves drawable. A situation is drawn whole or not
 * at all, read from its declared descriptors (the content gate holds them to what the tree derives).
 * A kind with no call tree has no descriptors and stays whole. */
export function drawableSituations(exclusion: ContentExclusion): Record<IncidentType, SituationIndex[]> {
  const out = excludedDescriptors(exclusion);
  return Object.fromEntries(SCENARIO_TYPES.map(({ type }) => {
    const tree = callTreeAt(type);
    return [type, SITUATIONS.filter(index => (!tree || index < tree.situations.length) && !(tree?.situations[index]?.descriptors ?? []).some(descriptor => out.has(descriptor)))];
  })) as Record<IncidentType, SituationIndex[]>;
}

/** The kinds of call that can still reach the board under an exclusion, in SCENARIO_TYPES order.
 * Unlocks aside: a caller intersects these with what the department has unlocked. */
export function drawableKinds(exclusion: ContentExclusion): IncidentType[] {
  const situations = drawableSituations(exclusion);
  return SCENARIO_TYPES.map(({ type }) => type).filter(type => situations[type].length > 0);
}

/** Whether a card's situation survives an exclusion. A card that can't be read stays. */
export function cardFits(card: IncidentCard, exclusion: ContentExclusion): boolean {
  const spec = parseIncidentId(card.id);
  if (!spec) return true;
  return drawableSituations(exclusion)[spec.type].includes(scenarioRecipe(spec).variant as SituationIndex);
}

/** Clear the cards the player's content settings no longer allow. A call in progress is not on
 * the board and finishes. */
export function dropExcludedCards(d: GameState, exclusion: ContentExclusion): void {
  if (!exclusion.avoid.length) return;
  const kept = board(d).filter(card => cardFits(card, exclusion));
  if (kept.length !== board(d).length) d.incidents = kept;
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
  recordDispatch(d, id, d.department.clockHighWater);
  return card;
}

/**
 * Draw one spec from the department PRNG and add its card, arriving at `at`.
 * Returns false (after still advancing the PRNG deterministically) when the id is
 * already on the board or is the active run's scenario.
 *
 * `exclusion` leaves out the situations the player's content settings rule out, and any kind left
 * with none. When no kind the department can draw is left, nothing is drawn and the PRNG doesn't
 * move. Without one the draw is exactly the unfiltered draw.
 */
function drawCard(d: GameState, at: number, exclusion?: ContentExclusion): IncidentCard | null {
  const dep = d.department;
  const situations = exclusion ? drawableSituations(exclusion) : undefined;
  const run = d.activeRun;
  const activeStory = run ? parseIncidentId(run.scenarioId) : null;
  const avoidTypes = [...board(d).flatMap(card => { const spec = parseIncidentId(card.id); return spec ? [spec.type] : []; }), ...(activeStory ? [activeStory.type] : [])];
  const recentTypes = d.debriefs.slice(0, 2).flatMap(report => { const spec = parseIncidentId(report.scenarioId); return spec ? [spec.type] : []; });
  const arc = playerArcContext(d);
  if (situations) {
    // The draw's own unlock rule: the unlocked kinds, or every kind when none is unlocked.
    const open = SCENARIO_TYPES.map((info) => info.type).filter((type) => arc.unlockedTypes.includes(type));
    if (!(open.length ? open : SCENARIO_TYPES.map((info) => info.type)).some((type) => situations[type].length)) return null;
  }
  const drawn = drawIncidentSpec(d.rngState, { level: dep.level, trust: dep.trust, avoidFamilies: [...board(d).map((c) => c.familyId), ...(run ? [activeStory?.familyId ?? run.locationFamilyId] : [])], ...(avoidTypes ? { avoidTypes } : {}), ...(recentTypes ? { recentTypes } : {}), ...arc, ...(situations ? { situations } : {}) });
  // After a run of bad results the next call comes in a tier lower, and its card says why
  // (sim/player-profile.ts comebackTier).
  const comeback = comebackTier(playerProfile(d), Math.min(5, Math.max(1, Math.round(drawn.spec.tier))));
  const spec = { ...drawn.spec, tier: comeback.tier };
  const life = drawBetween(drawn.state, INCIDENT_TUNING.minLifetimeMs, INCIDENT_TUNING.maxLifetimeMs);
  d.rngState = life.state;
  const id = incidentId(spec);
  const cards = board(d);
  if (cards.some((c) => c.id === id) || d.activeRun?.scenarioId === id) return null;
  // The board holds one live call per kind of call, never the kind in progress, so a department
  // with two kinds unlocked sees two call-outs instead of the same call twice. While the curated
  // catalog has fewer kinds than the board's opening cards (owner 2026-10-21, `one-card-board`), a
  // kind may hold more than one card, each on another building (avoidFamilies), so the board fills.
  const oneEach = SCENARIO_TYPES.length >= INCIDENT_TUNING.initialCount;
  if (oneEach && (cards.some((c) => c.type === spec.type) || activeStory?.type === spec.type)) return null;
  const card: IncidentCard = {
    id,
    type: spec.type,
    familyId: spec.familyId,
    tier: spec.tier,
    arrivedAt: at,
    expiresAt: at + life.ms,
    seen: false,
    ...(comeback.eased ? { eased: true as const } : {}),
  };
  if (recordArrival(d, spec.type)) card.newKind = true;
  cards.unshift(card); // newest first
  return card;
}

/** Unlocked frameworks and unseen-first weights for a v11+ draw. Reads state only. */
export function playerArcContext(d: GameState): { unlockedTypes: IncidentType[]; typeWeights: Partial<Record<IncidentType, number>> } {
  const types = SCENARIO_TYPES.map((info) => info.type);
  const open = unlockedTypes(d, types);
  return { unlockedTypes: open, typeWeights: reputationWeights(d.department, noveltyWeights(d, open)) };
}

/** Draw the gap to the following arrival and store the new schedule. */
function scheduleAfter(d: GameState, from: number): void {
  const iv = drawBetween(d.rngState, INCIDENT_TUNING.minIntervalMs, INCIDENT_TUNING.maxIntervalMs);
  d.rngState = iv.state;
  setNextIncidentAt(d, from + iv.ms);
}

/**
 * Fill the board with `count` cards arriving at `now` and start the schedule.
 * Used for a new game. Deterministic in
 * (rngState, level, trust, now). `exclusion`: the player's content settings (drawCard).
 */
export function seedIncidentBoard(d: GameState, now: number, count: number = INCIDENT_TUNING.initialCount, exclusion?: ContentExclusion): void {
  board(d).length = 0;
  let attempts = 0;
  while (board(d).length < count && attempts < count * 8) {
    attempts++;
    drawCard(d, now, exclusion);
  }
  scheduleAfter(d, now);
}

/**
 * Apply every board event due at or before `t`: arrivals in schedule order (each
 * after the expiries that precede it), then final expiries, and drop the card of
 * the run in progress. `_prev` is unused: arrivals follow the stored schedule, not
 * the sweep; it keeps the signature parallel to the other settlement hooks. `exclusion`: the
 * player's content settings (drawCard).
 */
export function applyIncidentsDue(d: GameState, _prev: number, t: number, exclusion?: ContentExclusion): void {
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
    if (board(d).length < INCIDENT_TUNING.boardMax) drawCard(d, at, exclusion);
    scheduleAfter(d, at);
    at = nextIncidentAt(d)!;
  }
  const run = d.activeRun;
  d.incidents = board(d).filter((c) => c.expiresAt > t && !(run && c.id === run.scenarioId));
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
  /** Most cards the board holds (INCIDENT_TUNING.boardMax). */
  max: number;
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
    max: INCIDENT_TUNING.boardMax,
  };
}
