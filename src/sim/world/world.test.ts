import { describe, expect, it } from 'vitest';
import { createInitialState } from '../department';
import { dispatch } from '../game';
import { HOUR_MS, ratesAt } from '../economy';
import type { Command, GameState } from '../types';
import { closeCase, openCase } from './cases';
import { newWorldAcc, settleWorld, validWorldState, createWorld, nextWorldEventTime } from './index';
import { activeShifts } from './shifts';
import { allocationFactor, fundingScale } from './core';

const T0 = 1_800_000_000_000 + 20 * 60_000;
const H = HOUR_MS;

const run = (state: GameState, cmd: Command, now: number): GameState => {
  const out = dispatch(state, cmd, { now });
  if (!out.result.ok) throw new Error(`${cmd.type} refused: ${out.result.reason}`);
  return out.state;
};
const tick = (state: GameState, now: number): GameState => run(state, { type: 'tick' }, now);

/** A campaign past its first call, founded at T0 in Pike Street. */
function founded(seed = 7): GameState {
  let s = createInitialState(T0, seed);
  s.world.onboarding.stage = 'founding';
  s = run(s, { type: 'foundDepartment', name: 'Westhaven SWAT', districtId: 'pike' }, T0);
  return s;
}

/** The same, past the first return so shifts are open. */
function open(seed = 7): GameState {
  const s = founded(seed);
  s.world.onboarding.stage = 'done';
  return s;
}

// Patrol service hours are summed per segment, so they agree to rounding only.
const snapshot = (s: GameState) => JSON.stringify({ world: s.world, officers: s.officers, patrol: s.patrol.personnel.map((p) => ({ ...p, serviceHours: Math.round(p.serviceHours * 1e6) / 1e6 })) });

describe('founding and the first contact', () => {
  it('opens one real case on its ordinary one hour clock, and it pays when the clock ends', () => {
    let s = founded();
    expect(s.world.onboarding.stage).toBe('first_shift');
    const first = s.world.cases.find((c) => c.id === s.world.onboarding.firstCaseId)!;
    expect(first.status).toBe('review');
    expect(first.tier).toBe(1);
    expect(first.closesAt).toBe(T0 + H);
    const before = s.department.funding;
    s = tick(s, T0 + H - 1);
    expect(s.world.cases.find((c) => c.id === first.id)!.status).toBe('review');
    s = tick(s, T0 + H + 60_000);
    const closed = s.world.cases.find((c) => c.id === first.id)!;
    expect(closed.status).toBe('closed');
    expect(closed.paidEventId).toBeDefined();
    expect(s.world.onboarding.stage).toBe('first_return');
    expect(s.department.funding).toBeGreaterThan(before);
  });

  it('refuses shifts until the first return is done, and finishes the journey on a report after time away', () => {
    let s = founded();
    expect(() => run(s, { type: 'startProactiveShift', squadId: 'A', districtId: 'pike', hours: 2 }, T0)).toThrow(/first return/);
    s = tick(s, T0 + 2 * H);
    expect(s.world.onboarding.stage).toBe('done');
  });

  it('stays quiet before the department is founded', () => {
    let s = createInitialState(T0, 3);
    const quiet = (x: GameState) => JSON.stringify({ c: x.world.cases, e: x.world.events, l: x.world.leads, k: x.world.districts.pike.crime, n: x.world.nextId });
    const before = quiet(s);
    s = tick(s, T0 + 20 * H);
    expect(quiet(s)).toBe(before);
  });
});

describe('determinism', () => {
  const END = T0 + 60 * H;
  const steps = [7 * 60_000, 25 * 60_000, 61 * 60_000, 3 * 60_000, 130 * 60_000];

  function partitions() {
    const base = open();
    base.world.onboarding.stage = 'done';
    // One settlement.
    const one = tick(structuredClone(base), END);
    // Hour by hour.
    let hourly = structuredClone(base);
    for (let t = T0 + H; t < END; t += H) hourly = tick(hourly, t);
    hourly = tick(hourly, END);
    // Uneven ticks with a save and load between them.
    let uneven = structuredClone(base);
    let t = T0;
    for (let i = 0; t + steps[i % steps.length] < END; i++) {
      t += steps[i % steps.length];
      uneven = tick(uneven, t);
      if (i % 9 === 0) uneven = JSON.parse(JSON.stringify(uneven)) as GameState;
    }
    uneven = tick(uneven, END);
    return { one, hourly, uneven };
  }

  it('settles to the same city, funding and officers however the time is cut', () => {
    const { one, hourly, uneven } = partitions();
    expect(one.world.events.length).toBeGreaterThan(5);
    expect(snapshot(hourly)).toBe(snapshot(one));
    expect(snapshot(uneven)).toBe(snapshot(one));
    expect(hourly.department.funding).toBeCloseTo(one.department.funding, 3);
    expect(uneven.department.funding).toBeCloseTo(one.department.funding, 3);
  });

  it('agrees through proactive shifts, including the strain stop', () => {
    const base = open();
    for (const id of base.squads[0].officerIds) base.officers[id].stress = 44;
    const started = run(base, { type: 'startProactiveShift', squadId: 'A', districtId: 'pike', hours: 8 }, T0);
    const one = tick(structuredClone(started), T0 + 40 * H);
    let many = structuredClone(started);
    for (let t = T0 + 17 * 60_000; t < T0 + 40 * H; t += 17 * 60_000) many = tick(many, t);
    many = tick(many, T0 + 40 * H);
    expect(snapshot(many)).toBe(snapshot(one));
    expect(one.world.shifts[0].stopReason).toBe('strain');
  });

  it('draws from the campaign seed and the hour, not from the department rng', () => {
    const a = open(11);
    const b = structuredClone(a);
    b.rngState = 99;
    expect(snapshot(tick(a, T0 + 30 * H))).toBe(snapshot(tick(b, T0 + 30 * H)));
  });
});

describe('payment', () => {
  it('pays each investigation once, at close', () => {
    const END = T0 + 70 * H;
    const s = tick(open(), END);
    const closed = s.world.cases.filter((c) => c.status === 'closed');
    expect(closed.length).toBeGreaterThan(2);
    const ids = closed.map((c) => c.paidEventId);
    expect(new Set(ids).size).toBe(ids.length);
    const report = s.report!.world!;
    expect(report.awardsPaid).toBe(closed.length);
    expect(report.awardFunding).toBe(closed.reduce((sum, c) => sum + c.award, 0));
    // Closing again, or settling the same instant again, pays nothing.
    const again = structuredClone(s);
    for (const c of again.world.cases) closeCase(again, again.world, c);
    expect(again.department.funding).toBe(s.department.funding);
    expect(tick(s, END).department.funding).toBe(s.department.funding);
  });

  it('pays a repeat investigation of the same person a quarter', () => {
    const s = open();
    const w = s.world;
    const target = Object.values(w.subjects).find((x) => x.tier === 1)!;
    const first = openCaseForTest(s, target.id, 1);
    first.status = 'closed';
    first.paidEventId = 'e999';
    w.nextId = 1000;
    const second = openCaseForTest(s, target.id, 1);
    expect(second.repeat).toBe(true);
    expect(second.award).toBe(Math.round(100 * fundingScale(s.department.level) * 0.25));
  });
});

function openCaseForTest(s: GameState, subjectId: string, tier: 1 | 2 | 3 | 4) {
  const w = s.world;
  const subject = w.subjects[subjectId];
  subject.reservedBy = null;
  subject.status = 'free';
  return openCase(s, w, { subject, tier, source: 'patrol', at: T0, status: 'review' });
}
describe('crime and income', () => {
  it('never pays less net at lower crime, with the same staffing', () => {
    let last = Infinity;
    for (const crime of [0, 10, 25, 40, 50, 60, 75, 90, 100]) {
      const s = open();
      s.world.districts.pike.crime = crime;
      const net = ratesAt(s, T0).net;
      expect(net).toBeLessThanOrEqual(last + 1e-9);
      last = net;
    }
  });

  it('keeps the allocation between 0.8 and 1.25 of its base per open district', () => {
    expect(allocationFactor(0)).toBe(1.25);
    expect(allocationFactor(100)).toBe(0.8);
    expect(allocationFactor(50)).toBe(1);
    const calm = open();
    calm.world.districts.pike.crime = 50;
    expect(ratesAt(calm, T0).base).toBe(600);
    calm.world.districts.larkin.open = true;
    calm.world.districts.larkin.crime = 50;
    expect(ratesAt(calm, T0).base).toBe(1200 * allocationFactor((50 + 50) / 2));
  });

  it('prices commitments at the floor and without shift grants, and counts the charter', () => {
    const s = open();
    s.world.districts.pike.crime = 20;
    const actual = ratesAt(s, T0, true);
    const sustainable = ratesAt(s, T0, false);
    expect(sustainable.base).toBe(480);
    expect(actual.base).toBeGreaterThan(sustainable.base);
    s.department.entitlements = { charter: true, nightWatch: false };
    expect(ratesAt(s, T0, false).patrol).toBeCloseTo(sustainable.patrol * 1.25, 6);
  });

  it('does not let crime raise the contact rate', () => {
    // The hourly contact draw never reads crime: the same units on the same hours meet the same contacts.
    const low = open(5);
    const high = structuredClone(low);
    low.world.districts.pike.crime = 10;
    high.world.districts.pike.crime = 90;
    const a = newWorldAcc(low);
    const b = newWorldAcc(high);
    settleWorld(low, T0, T0 + H, Infinity, a);
    settleWorld(high, T0, T0 + H, Infinity, b);
    for (let t = T0 + H; t < T0 + 40 * H; t += H) {
      settleWorld(low, t, t + H, Infinity, a);
      settleWorld(high, t, t + H, Infinity, b);
    }
    expect(a.contacts).toBe(b.contacts);
  });

  it('meets people at about 0.15 contacts per productive unit hour', () => {
    const s = open(21);
    const acc = newWorldAcc(s);
    const hours = 800;
    for (let i = 0; i < hours; i++) settleWorld(s, T0 + i * H, T0 + (i + 1) * H, Infinity, acc);
    const units = s.patrol.personnel.length;
    const expected = 0.15 * units * hours;
    expect(acc.contacts).toBeGreaterThan(expected * 0.75);
    expect(acc.contacts).toBeLessThan(expected * 1.25);
  });
});

describe('proactive shifts', () => {
  const start = (s: GameState, hours: 2 | 4 | 8 = 8, now = T0) => run(s, { type: 'startProactiveShift', squadId: 'A', districtId: 'pike', hours }, now);

  it('stops before any officer reaches 60, and frees them', () => {
    const base = open();
    const squad = base.squads[0].officerIds;
    squad.forEach((id, i) => { base.officers[id].stress = 40 + i * 3; });
    let s = start(base);
    let worst = 0;
    for (let t = T0; t <= T0 + 12 * H; t += 3 * 60_000) {
      s = tick(s, t);
      worst = Math.max(worst, ...squad.map((id) => s.officers[id].stress));
    }
    expect(worst).toBeLessThan(60);
    expect(worst).toBeGreaterThan(57);
    const shift = s.world.shifts[0];
    expect(shift.stopReason).toBe('strain');
    expect(squad.every((id) => s.officers[id].assignment === null)).toBe(true);
  });

  it('runs its hours when nobody is near the line, and grants 200 an hour', () => {
    const base = open();
    base.squads[0].officerIds.forEach((id) => { base.officers[id].stress = 10; });
    base.world.districts.pike.crime = 50;
    const s = start(base, 4);
    expect(ratesAt(s, T0).proactive).toBe(200);
    expect(ratesAt(s, T0 + 4 * H).proactive).toBe(0);
    const done = tick(s, T0 + 5 * H);
    expect(done.world.shifts[0].stopReason).toBe('ended');
    expect(done.world.shifts[0].stoppedAt).toBe(T0 + 4 * H);
    expect(done.officers[base.squads[0].officerIds[0]].stress).toBeGreaterThan(10);
  });

  it('refuses a strained squad, a second shift, and more than 8 hours in a rolling day', () => {
    const base = open();
    base.officers[base.squads[0].officerIds[0]].stress = 52;
    expect(() => start(base)).toThrow(/too strained/);
    base.officers[base.squads[0].officerIds[0]].stress = 5;
    base.squads[0].officerIds.forEach((id) => { base.officers[id].stress = 5; });
    const s = start(base, 4);
    expect(() => start(s, 2)).toThrow(/already on a shift/);
    let after = run(s, { type: 'recallProactiveShift', squadId: 'A' }, T0 + 1 * H);
    expect(after.world.shifts[0].stopReason).toBe('recalled');
    after.squads[0].officerIds.forEach((id) => { after.officers[id].stress = 5; });
    after = start(after, 4, T0 + 1 * H);
    const recalled = run(after, { type: 'recallProactiveShift', squadId: 'A' }, T0 + 2 * H);
    expect(() => run(recalled, { type: 'startProactiveShift', squadId: 'A', hours: 8, districtId: 'pike' }, T0 + 2 * H)).toThrow(/shift hours a day/);
  });

  it('keeps the officers off other work while it runs', () => {
    const base = open();
    base.squads[0].officerIds.forEach((id) => { base.officers[id].stress = 5; });
    const s = start(base);
    const id = s.squads[0].officerIds[0];
    expect(s.officers[id].assignment?.kind).toBe('proactive');
    expect(() => run(s, { type: 'startDetail', officerId: id }, T0)).toThrow();
  });
});

describe('leads', () => {
  it('never expire, however long the player is away or the world is open', () => {
    let s = open(31);
    // Arm the ladder: shifts find leads quickly with a skilled squad over many days of play.
    const seen = new Set<string>();
    let now = T0;
    for (let day = 0; day < 14; day++) {
      for (const id of s.squads[0].officerIds) s.officers[id].stress = 5;
      if (activeShifts(s.world).length === 0) {
        try { s = run(s, { type: 'startProactiveShift', squadId: 'A', districtId: 'pike', hours: 8 }, now); } catch { /* a squad at its daily limit waits */ }
      }
      now += 20 * H;
      s = tick(s, now);
      s = run(s, { type: 'markIncidentsSeen' }, now);
      for (const l of s.world.leads) seen.add(l.id);
    }
    expect(seen.size).toBeGreaterThan(0);
    now += 400 * H;
    s = tick(s, now);
    for (const id of seen) expect(s.world.leads.some((l) => l.id === id)).toBe(true);
    expect(validWorldState(s.world, s.department.clockHighWater)).toBe(true);
  });
});

describe('windows', () => {
  it('stops rolling hours at the world window but still closes a review that was already open', () => {
    const s = founded();
    const w = s.world;
    const end = T0 + 200 * H;
    const next = tick(s, end);
    const last = Math.max(...next.world.events.filter((e) => e.kind === 'contact').map((e) => e.at), 0);
    expect(last).toBeLessThanOrEqual(T0 + 72 * H);
    expect(nextWorldEventTime(next, end)).toBeNull();
    expect(w.cases.length).toBeGreaterThan(0);
  });

  it('does not stretch the world window with Night Watch', () => {
    const s = founded();
    s.department.entitlements = { charter: false, nightWatch: true };
    const next = tick(s, T0 + 200 * H);
    const last = Math.max(...next.world.events.filter((e) => e.kind === 'contact').map((e) => e.at), 0);
    expect(last).toBeLessThanOrEqual(T0 + 72 * H);
  });
});

describe('records', () => {
  it('validates a fresh, a founded and a played city, and rejects forged payments', () => {
    expect(validWorldState(createWorld(5, T0), T0)).toBe(true);
    const played = tick(open(), T0 + 60 * H);
    expect(validWorldState(played.world, played.department.clockHighWater)).toBe(true);
    const closed = played.world.cases.filter((c) => c.status === 'closed');
    expect(closed.length).toBeGreaterThan(1);
    const dup = structuredClone(played.world);
    const target = dup.cases.filter((c) => c.status === 'closed');
    target[1].paidEventId = target[0].paidEventId;
    expect(validWorldState(dup, played.department.clockHighWater)).toBe(false);
    const unpaid = structuredClone(played.world);
    delete unpaid.cases.find((c) => c.status === 'closed')!.paidEventId;
    expect(validWorldState(unpaid, played.department.clockHighWater)).toBe(false);
    const gone = structuredClone(played.world);
    gone.leads.push({ id: 'l' + (gone.nextId - 1), caseId: 'c999', subjectId: 's1', crewId: null, districtId: 'pike', tier: 3, foundAt: T0, source: 'proactive', status: 'open' });
    expect(validWorldState(gone, played.department.clockHighWater)).toBe(false);
  });
});
