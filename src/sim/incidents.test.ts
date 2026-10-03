import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { boardSummary } from './department-selectors';
import { HOUR_MS } from './economy';
import { INCIDENT_TUNING, TIER_REWARD_MULTIPLIERS, nextIncidentAt, takeIncident, tierRewardMultiplier } from './incidents';
import { drawIncidentSpec, incidentId, parseIncidentId } from '../gen/incident';
import type { Command, GameState, IncidentCard, OperationRun } from './types';
import type { IncidentSpec } from './scenario-types';

// Wrap (not replace) the generator so tests can observe the ctx it receives and
// override its answer where a test needs a specific spec. The default is the real one.
vi.mock('../gen/incident', async (importOriginal) => {
  const m = await importOriginal<typeof import('../gen/incident')>();
  return { ...m, drawIncidentSpec: vi.fn(m.drawIncidentSpec) };
});
const draw = vi.mocked(drawIncidentSpec);
const realDraw = draw.getMockImplementation()!;

beforeEach(() => {
  draw.mockReset();
  draw.mockImplementation(realDraw);
});

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0);
const MIN = 60_000;

function ok(state: GameState, cmd: Command, now: number): GameState {
  const r = dispatch(state, cmd, { now });
  expect(r.result, JSON.stringify(cmd)).toEqual({ ok: true });
  return r.state;
}

/** Tick to every time in `times` (ascending), one dispatch each. */
function tickThrough(state: GameState, times: number[]): GameState {
  let s = state;
  for (const t of times) s = ok(s, { type: 'tick' }, t);
  return s;
}

function every(from: number, to: number, stepMs: number): number[] {
  const out: number[] = [];
  for (let t = from + stepMs; t < to; t += stepMs) out.push(t);
  out.push(to);
  return out;
}

/** A tiny deterministic jitter so tick sizes are irregular. */
function irregular(from: number, to: number, seed: number): number[] {
  const out: number[] = [];
  let t = from;
  let x = seed >>> 0;
  while (t < to) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    t = Math.min(to, t + 30_000 + (x % (3 * HOUR_MS)));
    out.push(t);
  }
  return out;
}

const boardOf = (s: GameState) => ({ incidents: s.incidents, next: nextIncidentAt(s), rng: s.rngState });

describe('initial board', () => {
  it('seeds three unseen cards at now with 6-12h lifetimes and a schedule', () => {
    const s = createInitialState(T0);
    expect(s.incidents).toHaveLength(3);
    expect(new Set(s.incidents.map((c) => c.id)).size).toBe(3);
    for (const c of s.incidents) {
      expect(c).toMatchObject({ arrivedAt: T0, seen: false });
      expect(c.expiresAt - c.arrivedAt).toBeGreaterThanOrEqual(INCIDENT_TUNING.minLifetimeMs);
      expect(c.expiresAt - c.arrivedAt).toBeLessThanOrEqual(INCIDENT_TUNING.maxLifetimeMs);
      expect(parseIncidentId(c.id)).toMatchObject({ type: c.type, familyId: c.familyId, tier: c.tier });
      expect(c.tier).toBeGreaterThanOrEqual(1);
      expect(c.tier).toBeLessThanOrEqual(5);
    }
    const at = nextIncidentAt(s)!;
    expect(at - T0).toBeGreaterThanOrEqual(INCIDENT_TUNING.minIntervalMs);
    expect(at - T0).toBeLessThanOrEqual(INCIDENT_TUNING.maxIntervalMs);
  });

  it('passes department level, trust and content version to the generator', () => {
    createInitialState(T0);
    expect(draw).toHaveBeenCalled();
    for (const call of draw.mock.calls) expect(call[1]).toMatchObject({ level: 3, trust: 78, contentVersion: 2 });
  });

  it('is deterministic and leaves the starting candidates unchanged by the board', () => {
    expect(createInitialState(T0)).toEqual(createInitialState(T0));
    expect(createInitialState(T0).candidates.map((c) => c.id)).toEqual(createInitialState(T0 + 1).candidates.map((c) => c.id));
  });
});

describe('arrivals and expiry are event-ordered', () => {
  it('one 24h offline settlement equals hourly, 7-minute and irregular online ticks', () => {
    const start = createInitialState(T0);
    const end = T0 + 24 * HOUR_MS;
    const offline = ok(start, { type: 'tick' }, end);
    for (const times of [every(T0, end, HOUR_MS), every(T0, end, 7 * MIN), irregular(T0, end, 1), irregular(T0, end, 99)]) {
      expect(boardOf(tickThrough(start, times))).toEqual(boardOf(offline));
    }
    // Something really happened: arrivals ran and the original three have expired.
    expect(offline.incidents.length).toBeGreaterThan(0);
    expect(offline.incidents.every((c) => c.arrivedAt > T0)).toBe(true);
    expect(offline.rngState).not.toBe(start.rngState);
  });

  it('stays identical when restocking also draws from the shared PRNG', () => {
    let start = createInitialState(T0);
    start.department.devPoints = 10;
    start = ok(start, { type: 'unlockNode', nodeId: 'logistics_presets' }, T0);
    start = ok(start, { type: 'unlockNode', nodeId: 'logistics_restock' }, T0);
    start = ok(start, { type: 'setRestockRule', rule: { itemId: 'trauma_kit', target: 40, budgetCeiling: 400 } }, T0);
    const end = T0 + 24 * HOUR_MS;
    const offline = ok(start, { type: 'tick' }, end);
    expect(Object.keys(offline.units).length).toBeGreaterThan(Object.keys(start.units).length);
    for (const times of [every(T0, end, HOUR_MS), every(T0, end, 7 * MIN), irregular(T0, end, 5)]) {
      const online = tickThrough(start, times);
      expect(boardOf(online)).toEqual(boardOf(offline));
      expect(Object.keys(online.units)).toEqual(Object.keys(offline.units));
    }
  });

  it('holds for 7 days away too, and for later arrivals when ticked from a mid-point', () => {
    const start = createInitialState(T0);
    const end = T0 + 7 * 24 * HOUR_MS;
    const offline = ok(start, { type: 'tick' }, end);
    expect(boardOf(tickThrough(start, every(T0, end, 5 * HOUR_MS + 17 * MIN)))).toEqual(boardOf(offline));
    const mid = ok(start, { type: 'tick' }, T0 + 9 * HOUR_MS);
    expect(boardOf(tickThrough(mid, every(T0 + 9 * HOUR_MS, end, 41 * MIN)))).toEqual(boardOf(offline));
  });

  it('is deterministic for a given state and differs for a different rngState', () => {
    const a = createInitialState(T0);
    const b = structuredClone(a);
    const end = T0 + 30 * HOUR_MS;
    expect(boardOf(ok(a, { type: 'tick' }, end))).toEqual(boardOf(ok(b, { type: 'tick' }, end)));
    const c = structuredClone(a);
    c.rngState = 777;
    expect(ok(c, { type: 'tick' }, end).incidents.map((x) => x.id)).not.toEqual(ok(a, { type: 'tick' }, end).incidents.map((x) => x.id));
  });

  it('arrives at the scheduled instant, not at the tick that noticed it', () => {
    const start = createInitialState(T0);
    const scheduled = nextIncidentAt(start)!;
    // Settle a long way past it in one step; the new card must carry the scheduled time.
    const s = ok(start, { type: 'tick' }, scheduled + 10 * MIN + 123);
    const fresh = s.incidents.filter((c) => !start.incidents.some((o) => o.id === c.id));
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.map((c) => c.arrivedAt)).toContain(scheduled);
    expect(fresh.every((c) => c.arrivedAt <= scheduled + 10 * MIN + 123 && !c.seen)).toBe(true);
    // The following arrival is 45-90 minutes later.
    expect(nextIncidentAt(s)! - scheduled).toBeGreaterThanOrEqual(INCIDENT_TUNING.minIntervalMs);
    expect(nextIncidentAt(s)! - scheduled).toBeLessThanOrEqual(INCIDENT_TUNING.maxIntervalMs);
  });

  it('admits arrivals no closer than 45 minutes, observed live, newest first', () => {
    // Tick one minute at a time and record when each new id first shows up.
    let s = createInitialState(T0);
    const arrivals: number[] = [];
    const seen = new Set(s.incidents.map((c) => c.id));
    for (let t = T0 + MIN; t <= T0 + 30 * HOUR_MS; t += MIN) {
      s = ok(s, { type: 'tick' }, t);
      for (const c of s.incidents) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          arrivals.push(c.arrivedAt);
          expect(c.arrivedAt).toBeGreaterThan(t - MIN);
          expect(c.arrivedAt).toBeLessThanOrEqual(t);
        }
      }
    }
    expect(arrivals.length).toBeGreaterThanOrEqual(6);
    const gaps = arrivals.slice(1).map((a, i) => a - arrivals[i]);
    // A full board loses arrivals, so observed gaps can be longer than 90 minutes, never shorter than 45.
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(INCIDENT_TUNING.minIntervalMs);
    const order = s.incidents.map((c) => c.arrivedAt);
    expect(order).toEqual([...order].sort((x, y) => y - x));
  });

  it('never holds more than five cards', () => {
    let s = createInitialState(T0);
    let max = 0;
    for (const t of every(T0, T0 + 72 * HOUR_MS, 20 * MIN)) {
      s = ok(s, { type: 'tick' }, t);
      max = Math.max(max, s.incidents.length);
    }
    expect(max).toBe(INCIDENT_TUNING.boardMax);
  });

  it('expires silently: no report line, no trust or funding penalty, and the card is gone at its time', () => {
    const base = createInitialState(T0);
    const s0 = structuredClone(base);
    (s0.department as { nextIncidentAt?: number }).nextIncidentAt = T0 + 400 * 24 * HOUR_MS; // no arrivals muddying this test
    s0.incidents.sort((a, b) => a.expiresAt - b.expiresAt);
    const first = s0.incidents[0];
    const before = ok(s0, { type: 'tick' }, first.expiresAt - 1);
    expect(before.incidents.map((c) => c.id)).toContain(first.id);
    const after = ok(before, { type: 'tick' }, first.expiresAt);
    expect(after.incidents.map((c) => c.id)).not.toContain(first.id);
    expect(after.incidents).toHaveLength(2);
    expect(after.department.trust).toBe(base.department.trust);
    expect(after.report?.shortages ?? []).toEqual([]);
    // Everything expires eventually and the board just empties.
    const gone = ok(after, { type: 'tick' }, T0 + 13 * HOUR_MS);
    expect(gone.incidents).toEqual([]);
    expect(gone.department.trust).toBe(base.department.trust);
  });

  it('skips an arrival whose id is already on the board', () => {
    const spec: IncidentSpec = { type: 'welfare_check', familyId: 'maple_street', buildingSeed: 1, seed: 2, tier: 1, contentVersion: 1 };
    draw.mockImplementation((rng) => ({ spec, state: rng }));
    const s = ok(createInitialState(T0), { type: 'tick' }, T0 + 5 * HOUR_MS);
    expect(s.incidents.filter((c) => c.id === incidentId(spec))).toHaveLength(1);
    expect(s.incidents).toHaveLength(1);
  });

  it('drops the card of the run in progress at settlement', () => {
    const s0 = createInitialState(T0);
    const target = s0.incidents[1];
    s0.activeRun = { id: 'run_1', scenarioId: target.id, status: 'active', squadIds: ['A'] } as unknown as OperationRun;
    const s = ok(s0, { type: 'tick' }, T0 + 20 * MIN);
    expect(s.incidents.map((c) => c.id)).not.toContain(target.id);
    expect(s.incidents).toHaveLength(2);
  });

  it('an arrival never re-adds the active run scenario', () => {
    const spec: IncidentSpec = { type: 'burglary', familyId: 'maple_street', buildingSeed: 3, seed: 4, tier: 2, contentVersion: 1 };
    draw.mockImplementation((rng) => ({ spec, state: rng }));
    const s0 = createInitialState(T0);
    s0.incidents = [];
    s0.activeRun = { id: 'run_1', scenarioId: incidentId(spec), status: 'active', squadIds: ['A'] } as unknown as OperationRun;
    const s = ok(s0, { type: 'tick' }, T0 + 10 * HOUR_MS);
    expect(s.incidents).toEqual([]);
  });
});

describe('tier gating', () => {
  it('passes the live level and trust of each arrival to the generator', () => {
    const calls: { level: number; trust: number }[] = [];
    draw.mockImplementation((rng, ctx) => {
      calls.push({ level: ctx.level, trust: ctx.trust });
      return { spec: { type: 'burglary', familyId: 'maple_street', buildingSeed: 0, seed: rng, tier: 1, contentVersion: ctx.contentVersion }, state: rng };
    });
    let s = createInitialState(T0);
    calls.length = 0;
    s = ok(s, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.level === 3 && c.trust === 78)).toBe(true);
    s.department.level = 6;
    s.department.trust = 40;
    s.incidents = []; // room on the board, so arrivals are drawn
    calls.length = 0;
    ok(s, { type: 'tick' }, T0 + 6 * HOUR_MS);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.level === 6 && c.trust === 40)).toBe(true);
  });

  it('cards carry the generator tier, clamped to 1..5', () => {
    const tiers = [4, 9, 0, 3, 2];
    let i = 0;
    draw.mockImplementation((rng) => ({
      spec: { type: 'barricaded', familyId: 'maple_street', buildingSeed: i, seed: i, tier: tiers[i++ % tiers.length], contentVersion: 1 },
      state: rng,
    }));
    const s = createInitialState(T0);
    expect(s.incidents.map((c) => c.tier).sort()).toEqual([1, 4, 5]);
    for (const c of s.incidents) expect(c.id.endsWith(`:${c.tier}:1`)).toBe(true);
  });

  it('reward multiplier rises with tier and clamps', () => {
    expect(TIER_REWARD_MULTIPLIERS).toEqual([1.0, 1.35, 1.8, 2.4, 3.2]);
    expect([1, 2, 3, 4, 5].map(tierRewardMultiplier)).toEqual([1.0, 1.35, 1.8, 2.4, 3.2]);
    for (let t = 1; t < 5; t++) expect(tierRewardMultiplier(t + 1)).toBeGreaterThan(tierRewardMultiplier(t));
    expect(tierRewardMultiplier(0)).toBe(1.0);
    expect(tierRewardMultiplier(9)).toBe(3.2);
    expect(tierRewardMultiplier(Number.NaN)).toBe(1.0);
  });
});

describe('board commands and selectors', () => {
  it('markIncidentsSeen marks every card, and unseen counts follow', () => {
    let s = createInitialState(T0);
    expect(boardSummary(s, T0).newCount).toBe(3);
    s = ok(s, { type: 'markIncidentsSeen' }, T0 + MIN);
    expect(s.incidents.every((c) => c.seen)).toBe(true);
    expect(boardSummary(s, T0 + MIN).newCount).toBe(0);
    // Cards that arrive later are new again.
    s = ok(s, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(s.incidents.some((c) => !c.seen)).toBe(true);
  });

  it('takeIncident removes exactly one card and reports what it took', () => {
    const s = createInitialState(T0);
    const draft = structuredClone(s);
    const card = draft.incidents[1];
    const taken = takeIncident(draft, card.id) as IncidentCard;
    expect(taken).toEqual(card);
    expect(draft.incidents.map((c) => c.id)).toEqual([s.incidents[0].id, s.incidents[2].id]);
    expect(takeIncident(draft, card.id)).toBeNull();
    expect(takeIncident(draft, 'authored_scenario')).toBeNull();
    expect(draft.incidents).toHaveLength(2);
  });

  it('boardSummary reports count, new, next arrival and expiring-soon', () => {
    const s = createInitialState(T0);
    const sum = boardSummary(s, T0);
    expect(sum).toEqual({ count: 3, newCount: 3, nextArrivalAt: nextIncidentAt(s), expiringSoon: 0 });
    // Close to the earliest expiry, that card is expiring soon.
    const first = Math.min(...s.incidents.map((c) => c.expiresAt));
    const near = boardSummary(s, first - HOUR_MS);
    expect(near.expiringSoon).toBeGreaterThanOrEqual(1);
    expect(near.count).toBe(3);
    // Past the latest expiry nothing is live, even before settlement has removed them.
    const last = Math.max(...s.incidents.map((c) => c.expiresAt));
    expect(boardSummary(s, last)).toMatchObject({ count: 0, newCount: 0, expiringSoon: 0 });
  });

  it('boardSummary gives no next arrival while the board is full', () => {
    let s = createInitialState(T0);
    for (let i = 0; i < 20 && s.incidents.length < INCIDENT_TUNING.boardMax; i++) s = ok(s, { type: 'tick' }, T0 + (i + 1) * 30 * MIN);
    expect(s.incidents).toHaveLength(INCIDENT_TUNING.boardMax);
    expect(boardSummary(s, s.department.clockHighWater).nextArrivalAt).toBeNull();
  });

  it('a state without a schedule or board (older fixtures) still settles', () => {
    const s0 = createInitialState(T0) as unknown as { incidents?: unknown; department: object };
    delete s0.incidents;
    delete (s0.department as { nextIncidentAt?: number }).nextIncidentAt;
    const s = ok(s0 as unknown as GameState, { type: 'tick' }, T0 + 8 * HOUR_MS);
    expect(Array.isArray(s.incidents)).toBe(true);
    expect(nextIncidentAt(s)).not.toBeNull();
  });
});
