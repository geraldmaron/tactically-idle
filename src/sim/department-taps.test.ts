// tap-earn: one tap credits the base times the held multipliers, as its own ledger line, and puts
// strain on the free patrol officers up to the strained line; power-ups stop counting when they run
// out; the books credit at most TAP_TUNING.maxPerSecond taps a second; taps never accrue offline;
// and the tap state survives a save round trip.
import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { deserialize, serialize } from './save';
import { HOUR_MS } from './economy';
import { validatePatch } from './tuning';
import { ratesAt } from './economy';
import {
  DETAIL_STRAIN_LINE, detailRoom, strainPerTap, LEDGER_TAP_LABEL, MAX_COMBINED_MULTIPLIER, MAX_MULTIPLIER_FACTOR, MAX_TAP_BATCH, TAP_MULTIPLIERS, TAP_TUNING, grantEntitlement, grantMultiplier, tapAllowance, tapValue,
  type MultiplierDef,
} from './department-taps';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 0, 1, 8);
const send = (s: GameState, cmd: Command, now = T0) => dispatch(s, cmd, { now });
const tap = (s: GameState, count: number, now = T0) => send(s, { type: 'tapEarn', count }, now);
const tapLines = (s: GameState) => (s.department.ledger ?? []).filter((e) => e.kind === 'tap');

/** Test-owned multipliers of each kind; none of them ship. */
const FIXTURES: Record<string, MultiplierDef> = {
  desk_upgrade: { id: 'desk_upgrade', source: 'upgrade', factor: 2 },
  coffee_run: { id: 'coffee_run', source: 'powerup', factor: 1.5, durationMs: 60_000 },
  supporter_pack: { id: 'supporter_pack', source: 'entitlement', factor: 3 },
};

function withAll(s: GameState, at = T0): GameState {
  const next = structuredClone(s);
  for (const def of Object.values(FIXTURES)) expect(grantMultiplier(next.department.taps!, def, at).ok).toBe(true);
  return next;
}

describe('a tap', () => {
  it('adds $1 of funding on its own ledger line', () => {
    const s = createInitialState(T0);
    const r = tap(s, 1);
    expect(r.result.ok).toBe(true);
    expect(r.state.department.funding).toBe(s.department.funding + 1);
    expect(r.state.department.ledger!.at(-1)).toMatchObject({ kind: 'tap', label: LEDGER_TAP_LABEL, amount: 1 });
  });

  it('ships the base multiplier only, at factor 1', () => {
    expect(TAP_MULTIPLIERS).toEqual({ base: { id: 'base', source: 'upgrade', factor: 1 } });
    expect(createInitialState(T0).department.taps!.multipliers).toMatchObject([{ id: 'base', factor: 1 }]);
    expect(tapValue(createInitialState(T0).department, T0)).toBe(TAP_TUNING.base);
  });

  it('refuses a batch that is not a whole number from 1 to the batch limit', () => {
    const s = createInitialState(T0);
    for (const count of [0, -1, 1.5, Number.NaN, MAX_TAP_BATCH + 1]) {
      const r = tap(s, count);
      expect(r.result.ok, String(count)).toBe(false);
      expect(r.state).toBe(s);
    }
  });
});

describe('multipliers', () => {
  it('add within a kind and multiply across kinds', () => {
    const s = withAll(createInitialState(T0));
    grantMultiplier(s.department.taps!, { id: 'filing_cabinet', source: 'upgrade', factor: 1.5 }, T0);
    expect(tapValue(s.department, T0)).toBe((1 + 1 + 0.5) * 1.5 * 3);
  });

  it('multiply across kinds, one of each', () => {
    const s = withAll(createInitialState(T0));
    expect(tapValue(s.department, T0)).toBe(1 * 2 * 1.5 * 3);
    const r = tap(s, 4);
    expect(r.state.department.funding - s.department.funding).toBe(4 * 9);
    expect(tapLines(r.state).at(-1)!.amount).toBe(36);
  });

  it('drop an expired power-up on settlement, and it stops counting', () => {
    const s = withAll(createInitialState(T0));
    const later = T0 + FIXTURES.coffee_run.durationMs! + 1;
    expect(tapValue(s.department, later)).toBe(6);
    const r = tap(s, 1, later);
    expect(r.state.department.taps!.multipliers.map((m) => m.id).sort()).toEqual(['base', 'desk_upgrade', 'supporter_pack']);
    expect(tapLines(r.state).at(-1)!.amount).toBe(6);
  });

  it('extend a running power-up instead of stacking it with itself, and restart a spent one', () => {
    const taps = structuredClone(createInitialState(T0).department.taps!);
    grantMultiplier(taps, FIXTURES.coffee_run, T0);
    grantMultiplier(taps, FIXTURES.coffee_run, T0 + 10_000);
    expect(taps.multipliers.filter((m) => m.id === 'coffee_run')).toEqual([expect.objectContaining({ expiresAt: T0 + 120_000, factor: 1.5 })]);
    grantMultiplier(taps, FIXTURES.coffee_run, T0 + 500_000);
    expect(taps.multipliers.find((m) => m.id === 'coffee_run')!.expiresAt).toBe(T0 + 560_000);
  });

  it('refuse a bad entry, and an entitlement only by an entitlement id', () => {
    const taps = structuredClone(createInitialState(T0).department.taps!);
    expect(grantMultiplier(taps, { id: 'x', source: 'upgrade', factor: 0 }, T0).ok).toBe(false);
    expect(grantMultiplier(taps, { id: 'x', source: 'upgrade', factor: 0.9 }, T0).ok).toBe(false);
    expect(grantMultiplier(taps, { id: 'x', source: 'powerup', factor: 2 }, T0).ok).toBe(false);
    expect(grantMultiplier(taps, { id: 'x', source: 'upgrade', factor: 2, durationMs: 5 }, T0).ok).toBe(false);
    expect(grantEntitlement(taps, 'base', T0).ok).toBe(false);
    expect(grantEntitlement(taps, 'missing', T0).ok).toBe(false);
    expect(grantEntitlement(taps, 'supporter_pack', T0, FIXTURES).ok).toBe(true);
    expect(taps.multipliers.map((m) => m.id)).toEqual(['base', 'supporter_pack']);
  });
});

describe('overflow guards (Codex review)', () => {
  it('refuses a grant that would combine past the limit, and a save that holds one', () => {
    const s = createInitialState(T0);
    const taps = s.department.taps!;
    let refused = false;
    for (let i = 0; i < 300 && !refused; i++) refused = !grantMultiplier(taps, { id: `big_${i % 3}_${i}`, source: (['upgrade', 'powerup', 'entitlement'] as const)[i % 3], factor: MAX_MULTIPLIER_FACTOR, ...(i % 3 === 1 ? { durationMs: 60_000 } : {}) }, T0).ok;
    expect(refused).toBe(true);
    expect(tapValue(s.department, T0)).toBeLessThanOrEqual(MAX_COMBINED_MULTIPLIER * TAP_TUNING.base);
    for (let i = 0; i < 9; i++) expect(Number.isFinite(tap(s, 20, T0 + i * 1000).state.department.funding)).toBe(true);
    const crafted = structuredClone(s);
    crafted.department.taps!.multipliers = Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, source: (['upgrade', 'entitlement'] as const)[i % 2], factor: MAX_MULTIPLIER_FACTOR, grantedAt: T0 }));
    expect(deserialize(serialize(crafted, T0))).toBeNull();
  });

  it('refuses a tap whose credit would leave the books non-finite, spending no allowance', () => {
    const s = createInitialState(T0);
    s.department.funding = Number.POSITIVE_INFINITY;
    const r = tap(s, 20);
    expect(r.result.ok).toBe(false);
    expect(r.state).toBe(s);
  });

  it('refuses a factor below 1, so an expiry can never lift the stack past what was granted (second pass)', () => {
    const s = createInitialState(T0);
    expect(grantMultiplier(s.department.taps!, { id: 'drag', source: 'powerup', factor: 0.01, durationMs: 1000 }, T0).ok).toBe(false);
    const crafted = structuredClone(s);
    crafted.department.taps!.multipliers.push({ id: 'drag', source: 'powerup', factor: 0.5, grantedAt: T0, expiresAt: T0 + 1000 });
    expect(deserialize(serialize(crafted, T0))).toBeNull();
  });

  it('refuses an extension that would run the expiry past a finite time, changing nothing (second pass)', () => {
    const taps = structuredClone(createInitialState(T0).department.taps!);
    const forever: MultiplierDef = { id: 'forever', source: 'powerup', factor: 2, durationMs: 1e308 };
    expect(grantMultiplier(taps, forever, T0).ok).toBe(true);
    const before = structuredClone(taps);
    expect(grantMultiplier(taps, forever, T0).ok).toBe(false);
    expect(taps).toEqual(before);
    const s = createInitialState(T0);
    s.department.taps = taps;
    expect(deserialize(serialize(s, T0))!.department.taps).toEqual(before);
  });

  it('refuses tuning whose burst holds less than one whole tap', () => {
    expect(validatePatch({ TAP_TUNING: { maxPerSecond: 1, burstSeconds: 0.25 } }).length).toBeGreaterThan(0);
    expect(validatePatch({ TAP_TUNING: { maxPerSecond: 4, burstSeconds: 0.25 } })).toEqual([]);
  });
});

describe('paid details strain the free patrol officers', () => {
  const patrolIds = (s: GameState) => s.squads.filter((sq) => sq.duty === 'patrol').flatMap((sq) => sq.officerIds);
  const others = (s: GameState) => Object.keys(s.officers).filter((id) => !patrolIds(s).includes(id));
  const stressOf = (s: GameState, ids: string[]) => ids.map((id) => s.officers[id].stress);
  const total = (s: GameState, ids: string[]) => stressOf(s, ids).reduce((a, b) => a + b, 0);

  it('splits the strain across them and leaves every other squad alone', () => {
    const s = createInitialState(T0);
    const r = tap(s, 20);
    expect(total(r.state, patrolIds(s)) - total(s, patrolIds(s))).toBeCloseTo(20 * strainPerTap(), 9);
    expect(stressOf(r.state, others(s))).toEqual(stressOf(s, others(s)));
    for (const id of patrolIds(s)) expect(r.state.officers[id].stress - s.officers[id].stress).toBeCloseTo(20 * strainPerTap() / patrolIds(s).length, 9);
  });

  it('skips patrol officers who are on a detail, in training or hurt', () => {
    const s = createInitialState(T0);
    const [away, hurt, ...rest] = patrolIds(s);
    s.officers[away].assignment = { kind: 'training', courseId: 'x', startedAt: T0, endsAt: T0 + HOUR_MS };
    s.officers[hurt].injury = { ...(s.officers[hurt].injury ?? {}), label: 'sprain', until: T0 + HOUR_MS } as never;
    const r = tap(s, 10);
    expect(stressOf(r.state, [away, hurt])).toEqual(stressOf(s, [away, hurt]));
    expect(total(r.state, rest) - total(s, rest)).toBeCloseTo(10 * strainPerTap(), 9);
  });

  it('stops every officer at the strained line, then pays nothing and says why', () => {
    let s = createInitialState(T0);
    let at = T0;
    while (detailRoom(s, at).taps > 0) { at += 1000; s = tap(s, 20, at).state; }
    for (const id of patrolIds(s)) expect(s.officers[id].stress).toBeLessThanOrEqual(DETAIL_STRAIN_LINE);
    expect(Math.max(...patrolIds(s).map((id) => DETAIL_STRAIN_LINE - s.officers[id].stress))).toBeLessThan(strainPerTap());
    const blocked = tap(s, 1, at);
    expect(blocked.result).toEqual({ ok: false, reason: 'Every free patrol officer is at the strain line' });
    expect(blocked.state).toBe(s);
    expect(detailRoom(s, at).block).toBe('at-line');
  });

  it('pays nothing with no squad on patrol', () => {
    const s = createInitialState(T0);
    for (const sq of s.squads) sq.duty = 'standby';
    expect(tap(s, 1).result).toEqual({ ok: false, reason: 'No squad is on patrol to work paid details' });
    expect(detailRoom(s, T0).block).toBe('no-patrol');
  });

  it('raises pay with multipliers, not strain', () => {
    const s = withAll(createInitialState(T0));
    const r = tap(s, 10);
    expect(tapLines(r.state).at(-1)!.amount).toBe(90);
    expect(total(r.state, patrolIds(s)) - total(s, patrolIds(s))).toBeCloseTo(10 * strainPerTap(), 9);
  });

  it('refills while the officers recover, never while away tapping', () => {
    const s = createInitialState(T0);
    const room = detailRoom(s, T0).room;
    const back = send(s, { type: 'tick' }, T0 + 2 * HOUR_MS).state;
    expect(detailRoom(back, T0 + 2 * HOUR_MS).room).toBeGreaterThan(room);
    expect(tapLines(back)).toHaveLength(0);
  });
});

describe('balance: one full stretch for the starting department', () => {
  it('pays $600 at 0.1 strain a dollar, about an hour of the starting net', () => {
    let s = createInitialState(T0);
    const start = detailRoom(s, T0);
    // Alpha patrols at stress 12, 18, 8 and 22: 60 points under the line of 30.
    expect(start.room).toBe(60);
    expect(TAP_TUNING.stressPerDollar).toBe(0.1);
    let at = T0;
    while (detailRoom(s, at).taps > 0) { at += 1000; s = tap(s, MAX_TAP_BATCH, at).state; }
    const paid = tapLines(s).reduce((sum, e) => sum + e.amount, 0);
    expect(paid).toBe(600);
    expect(paid / ratesAt(createInitialState(T0), T0).net).toBeCloseTo(600 / 620, 6);
  });
});

describe('the rate cap', () => {
  const cap = TAP_TUNING.maxPerSecond * TAP_TUNING.burstSeconds;

  it('credits at most one burst at once and drops the rest', () => {
    const s = createInitialState(T0);
    const r = tap(s, 500);
    expect(r.state.department.funding - s.department.funding).toBe(cap);
    const again = tap(r.state, 5);
    expect(again.result.ok).toBe(false);
    const half = tap(r.state, 500, T0 + 500);
    expect(tapLines(half.state).at(-1)!.amount).toBe(cap + TAP_TUNING.maxPerSecond / 2);
  });

  it('holds an autoclicker to the rate over time', () => {
    let s = createInitialState(T0);
    const seconds = 10;
    for (let ms = 0; ms <= seconds * 1000; ms += 50) s = tap(s, 10, T0 + ms).state;
    const credited = tapLines(s).reduce((sum, e) => sum + e.amount, 0);
    expect(credited).toBeLessThanOrEqual(cap + TAP_TUNING.maxPerSecond * seconds);
    expect(credited).toBeGreaterThanOrEqual(TAP_TUNING.maxPerSecond * seconds);
  });

  it('folds a stream of taps into one line an hour, still balancing across accrual', () => {
    let s = createInitialState(T0);
    for (let i = 0; i < 40; i++) s = send(tap(s, 3, T0 + i * 5_000).state, { type: 'tick' }, T0 + i * 5_000 + 2_500).state;
    expect(tapLines(s)).toHaveLength(1);
    for (const e of s.department.ledger!) expect(e.before + e.amount).toBeCloseTo(e.after, 6);
    expect(tapLines(s)[0].amount).toBe(120);
  });
});

describe('offline', () => {
  it('settlement credits no taps, and a long absence saves up no more than one burst', () => {
    const s = createInitialState(T0);
    const tapped = tap(s, 1).state;
    const control = send(s, { type: 'markIncidentsSeen' }).state;
    const back = T0 + 30 * HOUR_MS;
    const a = send(tapped, { type: 'tick' }, back).state;
    const b = send(control, { type: 'tick' }, back).state;
    expect(a.department.funding - b.department.funding).toBeCloseTo(1, 6);
    expect(tapLines(a)).toHaveLength(1);
    expect(tapAllowance(a.department, back)).toBe(TAP_TUNING.maxPerSecond * TAP_TUNING.burstSeconds);
    const r = tap(a, MAX_TAP_BATCH, back);
    expect(r.state.department.funding - a.department.funding).toBe(TAP_TUNING.maxPerSecond * TAP_TUNING.burstSeconds);
  });
});

describe('the save', () => {
  it('round-trips the allowance and every kind of multiplier', () => {
    const s = tap(withAll(createInitialState(T0)), 3).state;
    const loaded = deserialize(serialize(s, T0));
    expect(loaded).not.toBeNull();
    expect(loaded!.department.taps).toEqual(s.department.taps);
    expect(tapValue(loaded!.department, T0)).toBe(9);
  });

  it('rejects a malformed tap state', () => {
    const s = withAll(createInitialState(T0));
    const broken: ((g: GameState) => void)[] = [
      (g) => { g.department.taps!.credit = -1; },
      (g) => { g.department.taps!.multipliers[0].factor = 0; },
      (g) => { g.department.taps!.multipliers[0].factor = Number.POSITIVE_INFINITY; },
      (g) => { delete g.department.taps!.multipliers.find((m) => m.source === 'powerup')!.expiresAt; },
      (g) => { g.department.taps!.multipliers[0].expiresAt = T0; },
      (g) => { g.department.taps!.multipliers.push({ ...g.department.taps!.multipliers[0] }); },
      (g) => { (g.department.taps!.multipliers[0] as { source: string }).source = 'gift'; },
    ];
    for (const [i, breakIt] of broken.entries()) {
      const g = structuredClone(s);
      breakIt(g);
      expect(deserialize(serialize(g, T0)), `case ${i}`).toBeNull();
    }
  });
});
