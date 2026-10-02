import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { ECONOMY_TUNING, HOUR_MS, ratesAt } from './economy';
import { deployability } from './officer';
import { recoveryInfo } from './department-selectors';
import { ownedCount } from './equipment';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0); // on the hour grid
const TICK = 5000;

function ok(state: GameState, cmd: Command, now: number): GameState {
  const r = dispatch(state, cmd, { now });
  expect(r.result, JSON.stringify(cmd)).toEqual({ ok: true });
  return r.state;
}

/** Tick in 5-second steps from `from` to `to` inclusive (to must be reachable). */
function tickSteps(state: GameState, from: number, to: number): GameState {
  let s = state;
  for (let t = from + TICK; t <= to; t += TICK) s = ok(s, { type: 'tick' }, t);
  if ((to - from) % TICK !== 0) s = ok(s, { type: 'tick' }, to);
  return s;
}

function firstUnit(s: GameState, itemId: string) {
  return Object.values(s.units).find((u) => u.itemId === itemId)!;
}

/**
 * A start with a course finishing partway through, an injury and a maintenance
 * return, so every segment boundary is exercised. Commands run at T0.
 */
function scenario(): GameState {
  let s = createInitialState(T0);
  s = ok(s, { type: 'startCourse', officerId: 'off_chen', courseId: 'communication_refresher' }, T0); // 4h, patrol officer
  s.officers.off_vale.injury = { label: 'sprain', until: T0 + 1.7 * HOUR_MS };
  const radio = firstUnit(s, 'radio_kit');
  radio.status = 'service';
  radio.serviceUntil = T0 + 2.5 * HOUR_MS;
  return s;
}

function expectEquivalent(a: GameState, b: GameState) {
  expect(a.department.funding).toBeCloseTo(b.department.funding, 3);
  expect(a.department.devPoints).toBeCloseTo(b.department.devPoints, 6);
  expect(a.department.lastSettledAt).toBe(b.department.lastSettledAt);
  expect(Object.keys(a.units).sort()).toEqual(Object.keys(b.units).sort());
  for (const id of Object.keys(a.units)) {
    const { condition: ca, lastWearAt: la, ...ra } = a.units[id];
    const { condition: cb, lastWearAt: lb, ...rb } = b.units[id];
    expect(ra, `${id} unit`).toEqual(rb);
    expect(ca, `${id} condition`).toBeCloseTo(cb, 6);
    expect(la).toBe(lb);
  }
  for (const id of Object.keys(a.officers)) {
    const x = a.officers[id];
    const y = b.officers[id];
    expect(x.stress, `${id} stress`).toBeCloseTo(y.stress, 6);
    expect(x.certs, `${id} certs`).toEqual(y.certs);
    expect(x.ratings, `${id} ratings`).toEqual(y.ratings);
    expect(x.assignment, `${id} assignment`).toEqual(y.assignment);
    expect(x.injury, `${id} injury`).toEqual(y.injury);
    expect(x.xp).toBe(y.xp);
    expect(x.wage, `${id} wage`).toBe(y.wage);
    expect(x.retirement, `${id} retirement`).toEqual(y.retirement);
  }
}

describe('start budget', () => {
  it('lands on the illustrative hourly budget', () => {
    const r = ratesAt(createInitialState(T0), T0);
    expect(r).toMatchObject({ base: 600, patrol: 600, nodeIncome: 0, gross: 1200, wages: 380, operating: 120, supplies: 80, net: 620 });
  });
  it('a course frees patrol income when it ends (rates per segment)', () => {
    const s = scenario();
    expect(ratesAt(s, T0).patrol).toBe(2 * 150); // Chen in training, Vale injured
    expect(ratesAt(s, T0).net).toBe(320);
    expect(ratesAt(s, T0 + 2 * HOUR_MS).patrol).toBe(3 * 150); // Vale back, Chen still away
    expect(ratesAt(s, T0 + 5 * HOUR_MS).net).toBe(470);
  });
});

describe('offline equivalence', () => {
  for (const hours of [4, 24, 30]) {
    it(`${hours}h by 5-second ticks equals one settlement`, () => {
      const start = scenario();
      const end = T0 + hours * HOUR_MS;
      const online = tickSteps(start, T0, end);
      const offline = ok(start, { type: 'tick' }, end);
      expectEquivalent(online, offline);
      // The course finished partway through in both.
      expect(online.officers.off_chen.assignment).toBeNull();
      expect(online.officers.off_chen.ratings.communication).toBe(start.officers.off_chen.ratings.communication + 3);
      expect(offline.officers.off_vale.injury).toBeNull();
      expect(firstUnit(offline, 'radio_kit').status).toBe('ready');
    });
  }

  it('funding is the sum of per-segment rates, not the final rate times the absence', () => {
    const start = scenario();
    const s = ok(start, { type: 'tick' }, T0 + 4 * HOUR_MS);
    // Chen trains 0-4h (470/h net), Vale injured 0-1.7h so patrol drops by 150 then.
    const expected = 12400 - 600 + 1.7 * (470 - 150) + (4 - 1.7) * 470;
    expect(s.department.funding).toBeCloseTo(expected, 3);
    expect(s.department.funding).not.toBeCloseTo(12400 - 600 + 4 * 620, 0);
  });

  it('produces a shift report for the offline window', () => {
    const s = ok(createInitialState(T0), { type: 'tick' }, T0 + 4 * HOUR_MS);
    expect(s.report).toMatchObject({ from: T0, to: T0 + 4 * HOUR_MS, accruedHours: 4, capped: false, shortages: [] });
    expect(s.report!.gross).toBeCloseTo(4800, 3);
    expect(s.report!.wages).toBeCloseTo(1520, 3);
    expect(s.report!.operating).toBeCloseTo(800, 3);
    expect(s.report!.net).toBeCloseTo(2480, 3);
    expect(s.report!.devPoints).toBeCloseTo(1, 6);
  });

  it('short settlements do not make a report; acknowledgeReport clears one', () => {
    let s = ok(createInitialState(T0), { type: 'tick' }, T0 + 10 * 60_000);
    expect(s.report).toBeNull();
    s = ok(s, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(s.report).not.toBeNull();
    s = ok(s, { type: 'acknowledgeReport' }, T0 + 2 * HOUR_MS);
    expect(s.report).toBeNull();
  });
});

describe('funding cap', () => {
  it('accrues nothing beyond 24h after the last command, and says so', () => {
    const start = createInitialState(T0);
    const at24 = ok(start, { type: 'tick' }, T0 + 24 * HOUR_MS);
    const at30 = ok(start, { type: 'tick' }, T0 + 30 * HOUR_MS);
    expect(at30.department.funding).toBeCloseTo(at24.department.funding, 3);
    expect(at30.department.funding).toBeCloseTo(12400 + 24 * 620, 3);
    expect(at30.department.devPoints).toBeCloseTo(3 + 24 * 0.25, 6);
    expect(at30.report).toMatchObject({ capped: true, accruedHours: 24 });
    expect(at24.report).toMatchObject({ capped: false });
  });

  it('payroll does not continue independently of income beyond the cap', () => {
    const start = createInitialState(T0);
    const at30 = ok(start, { type: 'tick' }, T0 + 30 * HOUR_MS);
    // Wages and income stop together: net over 30h equals net over 24h, never 24h income minus 30h wages.
    expect(at30.report!.wages).toBeCloseTo(24 * 380, 3);
    expect(at30.report!.gross).toBeCloseTo(24 * 1200, 3);
  });

  it('a later command restarts the window', () => {
    let s = ok(createInitialState(T0), { type: 'tick' }, T0 + 30 * HOUR_MS);
    const before = s.department.funding;
    s = ok(s, { type: 'createSquad', name: 'Charlie' }, T0 + 30 * HOUR_MS);
    s = ok(s, { type: 'tick' }, T0 + 32 * HOUR_MS);
    expect(s.department.funding).toBeCloseTo(before + 2 * 620, 3);
  });

  it('training and recovery continue beyond the cap, including a course ending past it', () => {
    const s = createInitialState(T0);
    s.officers.off_park.assignment = { kind: 'training', courseId: 'composure_workshop', startedAt: T0, endsAt: T0 + 27 * HOUR_MS };
    const end = T0 + 30 * HOUR_MS;
    const online = tickSteps(s, T0, end);
    const offline = ok(s, { type: 'tick' }, end);
    expectEquivalent(online, offline);
    expect(offline.officers.off_park.assignment).toBeNull();
    expect(offline.officers.off_park.ratings.composure).toBe(s.officers.off_park.ratings.composure + 3);
    expect(offline.officers.off_reyes.stress).toBe(0); // standby recovers fully over 30h
    expect(offline.department.funding).toBeCloseTo(
      ok(s, { type: 'tick' }, T0 + 24 * HOUR_MS).department.funding,
      3,
    );
  });

  it('funding never goes below zero and a shortage is recorded', () => {
    const s = createInitialState(T0);
    for (const o of Object.values(s.officers)) o.wage = 600; // wages far above income
    s.department.funding = 1000;
    const next = ok(s, { type: 'tick' }, T0 + 5 * HOUR_MS);
    expect(next.department.funding).toBe(0);
    expect(next.report!.shortages.join(' ')).toMatch(/Funding ran out/);
    const online = tickSteps(s, T0, T0 + 5 * HOUR_MS);
    expect(online.department.funding).toBe(0);
  });
});

describe('time safety', () => {
  it('moving the clock backward grants nothing, then catching up grants nothing twice', () => {
    let s = createInitialState(T0);
    s = ok(s, { type: 'tick' }, T0 + 2 * HOUR_MS);
    const snapshot = structuredClone(s);
    s = ok(s, { type: 'tick' }, T0 + 1 * HOUR_MS);
    expect(s.department.funding).toBe(snapshot.department.funding);
    expect(s.department.devPoints).toBe(snapshot.department.devPoints);
    expect(s.department.clockHighWater).toBe(T0 + 2 * HOUR_MS);
    s = ok(s, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(s).toEqual(snapshot);
    // And a real tick afterwards only grants the new time.
    s = ok(s, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(s.department.funding).toBeCloseTo(snapshot.department.funding + 620, 3);
  });

  it('the same time twice grants nothing the second time', () => {
    const a = ok(createInitialState(T0), { type: 'tick' }, T0 + 6 * HOUR_MS);
    const b = ok(a, { type: 'tick' }, T0 + 6 * HOUR_MS);
    expect(b).toEqual(a);
  });

  it('a command at an earlier clock is judged against the high-water mark', () => {
    let s = ok(createInitialState(T0), { type: 'tick' }, T0 + 5 * HOUR_MS);
    s = ok(s, { type: 'startCourse', officerId: 'off_vale', courseId: 'composure_workshop' }, T0 + HOUR_MS);
    const a = s.officers.off_vale.assignment;
    expect(a && a.kind === 'training' ? a.startedAt : 0).toBe(T0 + 5 * HOUR_MS);
  });
});

describe('recovery', () => {
  it('an officer at stress 85 cannot deploy until the displayed deployableAt', () => {
    let s = createInitialState(T0);
    s.officers.off_vale.stress = 85; // Alpha is on patrol: 1/h
    expect(deployability(s.officers.off_vale, T0).ok).toBe(false);
    const info = recoveryInfo(s, 'off_vale', T0);
    expect(info.band).toBe('recovery');
    const at = info.deployableAt!;
    expect(at - T0).toBeGreaterThan(5 * HOUR_MS);
    expect(at - T0).toBeLessThan(5 * HOUR_MS + 2 * 60_000);

    s = tickSteps(s, T0, at - TICK);
    expect(deployability(s.officers.off_vale, at - TICK).ok).toBe(false);
    s = ok(s, { type: 'tick' }, at + TICK);
    expect(deployability(s.officers.off_vale, at + TICK).ok).toBe(true);
    // One settlement lands in the same place.
    const jump = createInitialState(T0);
    jump.officers.off_vale.stress = 85;
    expect(deployability(ok(jump, { type: 'tick' }, at + TICK).officers.off_vale, at + TICK).ok).toBe(true);
    expect(deployability(ok(jump, { type: 'tick' }, at - TICK).officers.off_vale, at - TICK).ok).toBe(false);
  });

  it('squad duty sets the rate: rest > standby > patrol; peer support multiplies', () => {
    const s = createInitialState(T0);
    for (const o of Object.values(s.officers)) o.stress = 70;
    s.squads[0].duty = 'rest';
    const bravo = s.squads[1]; // standby
    expect(bravo.duty).toBe('standby');
    s.officers.off_park.squadId = null; // no squad rests like rest
    s.squads[1].officerIds = s.squads[1].officerIds.filter((id) => id !== 'off_park');
    const next = ok(s, { type: 'tick' }, T0 + HOUR_MS);
    expect(next.officers.off_chen.stress).toBeCloseTo(70 - ECONOMY_TUNING.recoveryPerHour.rest, 6);
    expect(next.officers.off_okafor.stress).toBeCloseTo(70 - 3 * 0.88, 6); // age 57: recovers 12% slower
    expect(next.officers.off_park.stress).toBeCloseTo(70 - 6, 6);

    let p = createInitialState(T0);
    p = ok(p, { type: 'unlockNode', nodeId: 'wellbeing_peer_support' }, T0);
    for (const o of Object.values(p.officers)) o.stress = 70;
    p = ok(p, { type: 'tick' }, T0 + HOUR_MS);
    expect(p.officers.off_okafor.stress).toBeCloseTo(70 - 3 * 1.5 * 0.88, 6); // standby x1.5, age 57
    expect(p.officers.off_chen.stress).toBeCloseTo(70 - 1.5, 6); // patrol x1.5
  });

  it('deployed officers do not recover or earn patrol income', () => {
    const s = createInitialState(T0);
    s.officers.off_chen.assignment = { kind: 'operation', runId: 'run_1' };
    s.officers.off_chen.stress = 60;
    const next = ok(s, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(next.officers.off_chen.stress).toBe(60);
    expect(ratesAt(s, T0).patrol).toBe(450);
  });

  it('the report lists officers who left mandatory recovery', () => {
    const s = createInitialState(T0);
    s.officers.off_vale.stress = 82;
    const next = ok(s, { type: 'tick' }, T0 + 4 * HOUR_MS);
    expect(next.report!.recovered).toEqual(['off_vale']);
  });
});

describe('restock rules', () => {
  function withRestock(): GameState {
    let s = createInitialState(T0);
    s = ok(s, { type: 'unlockNode', nodeId: 'logistics_presets' }, T0);
    s = ok(s, { type: 'unlockNode', nodeId: 'logistics_restock' }, T0);
    s = ok(s, { type: 'setRestockRule', rule: { itemId: 'trauma_kit', target: 20, budgetCeiling: 300 } }, T0);
    return s;
  }

  it('respects the budget ceiling per cycle and reports the shortage', () => {
    const s = withRestock();
    const funding = s.department.funding;
    const next = ok(s, { type: 'tick' }, T0 + HOUR_MS); // one cycle: ceiling $300 -> 2 kits at $120
    expect(ownedCount(next, 'trauma_kit')).toBe(8);
    expect(next.department.funding).toBeCloseTo(funding + 620 - 240, 3);
    const later = ok(s, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(ownedCount(later, 'trauma_kit')).toBe(12);
    expect(later.report!.restockSpend).toBe(720);
    expect(later.report!.shortages.join(' ')).toMatch(/Trauma kit: restocked 2 of 14 wanted \(spending ceiling \$300\)/);
  });

  it('never drives funding below zero and reports a funds shortage', () => {
    const s = withRestock();
    s.department.funding = 50;
    for (const o of Object.values(s.officers)) o.wage = 600;
    const next = ok(s, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(next.department.funding).toBeGreaterThanOrEqual(0);
    expect(ownedCount(next, 'trauma_kit')).toBe(6);
    expect(next.report!.shortages.join(' ')).toMatch(/Trauma kit/);
  });

  it('tick size does not change what gets restocked', () => {
    const s = withRestock();
    const end = T0 + 6 * HOUR_MS + 1234;
    const online = tickSteps(s, T0, end);
    const offline = ok(s, { type: 'tick' }, end);
    expectEquivalent(online, offline);
    expect(ownedCount(offline, 'trauma_kit')).toBe(18);
  });

  it('does nothing without a rule, past the cap, or once at target', () => {
    const idle = ok(createInitialState(T0), { type: 'tick' }, T0 + 5 * HOUR_MS);
    expect(ownedCount(idle, 'trauma_kit')).toBe(6);
    const capped = ok(withRestock(), { type: 'tick' }, T0 + 40 * HOUR_MS);
    expect(ownedCount(capped, 'trauma_kit')).toBe(20); // 24 cycles of up to 2 kits reach the target inside the window
    const s = withRestock();
    s.department.restockRules[0].target = 6;
    expect(ownedCount(ok(s, { type: 'tick' }, T0 + 5 * HOUR_MS), 'trauma_kit')).toBe(6);
  });

  it('rules can be replaced and removed', () => {
    let s = withRestock();
    s = ok(s, { type: 'setRestockRule', rule: { itemId: 'trauma_kit', target: 10, budgetCeiling: 500 } }, T0);
    expect(s.department.restockRules).toEqual([{ itemId: 'trauma_kit', target: 10, budgetCeiling: 500 }]);
    s = ok(s, { type: 'setRestockRule', rule: { itemId: 'trauma_kit', remove: true } }, T0);
    expect(s.department.restockRules).toEqual([]);
    const r = dispatch(s, { type: 'setRestockRule', rule: { itemId: 'trauma_kit', remove: true } }, { now: T0 });
    expect(r.result.ok).toBe(false);
  });
});
