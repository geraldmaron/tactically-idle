import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { establishedDepartment as createInitialState } from './department-test-fixtures';
import { ECONOMY_TUNING, HOUR_MS, ratesAt, recoveryRate } from './economy';
import { CALENDAR, experienceBand, formatGameDate, gameDay } from './calendar';
import {
  CAREER_TUNING,
  ageRecoveryFactor,
  applyXpGrowth,
  countNewDebriefs,
  debriefBand,
  recentAdverse,
  servicePicksRetirement,
} from './career';
import { careerInfo, budget, projectDismiss, recoveryInfo } from './department-selectors';
import { fillCandidates } from './roster';
import type { Command, DebriefResult, GameState } from './types';

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0);
/** Wall time of a game day: 1 real hour = 1 game day. */
const at = (day: number) => T0 + day * CALENDAR.gameDayMs;
const DAYS = CALENDAR.daysPerYear;

function ok(state: GameState, cmd: Command, now: number): GameState {
  const r = dispatch(state, cmd, { now });
  expect(r.result, JSON.stringify(cmd)).toEqual({ ok: true });
  return r.state;
}
function refused(state: GameState, cmd: Command, now: number): string {
  const r = dispatch(state, cmd, { now });
  expect(r.result.ok).toBe(false);
  expect(r.state).toBe(state);
  return r.result.ok ? '' : r.result.reason;
}
const tick = (s: GameState, day: number) => ok(s, { type: 'tick' }, at(day));
const events = (s: GameState, kind: string, id?: string) => (s.report?.personnel ?? []).filter((e) => e.event === kind && (!id || e.officerId === id));

/** Put an officer's 60th birthday `days` game days from now. */
function turnsSixtyIn(s: GameState, officerId: string, days: number): void {
  s.officers[officerId].bornDay = days - CAREER_TUNING.retireAge * DAYS;
}

/** A debrief the officer took part in, as the operation module records them. */
function debrief(runId: string, officerIds: string[], objective: number, safety: number): DebriefResult {
  return {
    runId,
    scenarioId: 's',
    endingId: 'e',
    endingTitle: 'e',
    objective: { score: objective, label: '' },
    civilianSafety: { score: safety, label: '' },
    officerCondition: officerIds.map((officerId) => ({ officerId, stressBefore: 0, stressAfter: 0, xpGained: 0 })),
    informationPreserved: [],
    resources: [],
    unitWear: [],
    trustDelta: 0,
    fundingReward: 0,
    devPointReward: 0,
    causes: [],
  };
}

describe('starting careers', () => {
  const s = createInitialState(T0);
  const band = (id: string) => experienceBand(s.officers[id], 0);
  const age = (id: string) => -s.officers[id].bornDay / DAYS;
  const service = (id: string) => -s.officers[id].serviceStartDay / DAYS;

  it('spreads ages 24..57 with matching service', () => {
    const ages = Object.keys(s.officers).map(age);
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(24);
    expect(Math.min(...ages)).toBeLessThan(25);
    expect(Math.max(...ages)).toBeGreaterThan(57);
    expect(Math.max(...ages)).toBeLessThan(58);
    for (const id of Object.keys(s.officers)) expect(service(id)).toBeLessThan(age(id) - 17);
  });

  it('puts Park at rookie, Okafor at veteran, Brooks at seasoned', () => {
    expect(band('off_park')).toBe('rookie');
    expect(band('off_okafor')).toBe('veteran');
    expect(band('off_brooks')).toBe('seasoned');
    expect(band('off_chen')).toBe('seasoned');
    expect(band('off_ortiz')).toBe('developing');
    expect(new Set(Object.keys(s.officers).map(band))).toEqual(new Set(['rookie', 'developing', 'seasoned', 'veteran']));
    expect(s.officers.off_okafor.retirement).toBeNull();
  });

  it('starts the calendar on 1 January 2026', () => {
    expect(formatGameDate(gameDay(s, T0))).toBe('1 Jan 2026');
  });
});

describe('age and learning', () => {
  it('recovery slows 1% per year past 45, with a floor of 80%', () => {
    const o = (age: number) => ({ bornDay: -age * DAYS });
    expect(ageRecoveryFactor(o(40), 0)).toBe(1);
    expect(ageRecoveryFactor(o(45.5), 0)).toBe(1);
    expect(ageRecoveryFactor(o(53.2), 0)).toBeCloseTo(0.92, 9);
    expect(ageRecoveryFactor(o(70), 0)).toBe(0.8);
  });

  it('shows up in the real recovery rate and the recovery view', () => {
    const s = createInitialState(T0);
    const okafor = s.officers.off_okafor; // standby: 3/h, age 57 -> x0.88
    expect(recoveryRate(s, okafor)).toBeCloseTo(3 * 0.88, 9);
    expect(recoveryRate(s, s.officers.off_chen)).toBe(1); // patrol, age 33
    expect(recoveryInfo(s, 'off_okafor', T0).factors.join(' ')).toMatch(/Recovers 12% slower \(age 57\)/);
  });

  it('age steps at a birthday, not continuously (so settlement segments stay exact)', () => {
    const s = createInitialState(T0);
    const o = s.officers.off_okafor;
    o.bornDay = 5 - 46 * DAYS; // 46th birthday on day 5
    expect(recoveryRate(s, o, at(4.9))).toBeCloseTo(3, 9);
    expect(recoveryRate(s, o, at(5.1))).toBeCloseTo(3 * 0.99, 9);
  });

  it('xp becomes rating growth scaled by experience band: rookies faster, veterans slower', () => {
    const s = createInitialState(T0);
    const park = s.officers.off_park; // rookie medic: 100/1.3 = 77 xp per point
    const medical = park.ratings.medical;
    park.xp += 76;
    expect(applyXpGrowth(park, 0)).toBe(0);
    park.xp += 1;
    expect(applyXpGrowth(park, 0)).toBe(1);
    expect(park.ratings.medical).toBe(medical + 1);

    const okafor = s.officers.off_okafor; // veteran lead: 100/0.7 = 143 xp per point
    const coordination = okafor.ratings.coordination;
    okafor.xp += 142;
    expect(applyXpGrowth(okafor, 0)).toBe(0);
    okafor.xp += 1;
    expect(applyXpGrowth(okafor, 0)).toBe(1);
    expect(okafor.ratings.coordination).toBe(coordination + 1);
    // The same 100 xp is worth more to a rookie than to a veteran.
    const gain = (id: string) => {
      const x = createInitialState(T0).officers[id];
      x.xp += 300;
      return applyXpGrowth(x, 0);
    };
    expect(gain('off_park')).toBeGreaterThan(gain('off_okafor'));
  });

  it('starting xp is already banked: nobody jumps on the first tick', () => {
    const s = createInitialState(T0);
    const next = tick(s, 3);
    for (const id of Object.keys(s.officers)) expect(next.officers[id].ratings).toEqual(s.officers[id].ratings);
  });

  it('xp earned (here, from a finished course) converts to growth during settlement', () => {
    const s = createInitialState(T0);
    s.officers.off_park.xp += 80; // a debrief would add this; settlement banks it
    const next = tick(s, 1);
    expect(next.officers.off_park.ratings.medical).toBe(s.officers.off_park.ratings.medical + 1);
  });
});

describe('anniversaries and birthdays', () => {
  it('an anniversary adds a wage step, is reported once, and is in the budget preview', () => {
    const s = createInitialState(T0);
    s.officers.off_chen.serviceStartDay = 5 - 9 * DAYS; // 9th anniversary on day 5
    const wage = s.officers.off_chen.wage;
    expect(budget(s).wageStepsNext30d).toBe(1 * 1); // only Chen's anniversary lands inside 30 days
    const day4 = tick(s, 4);
    expect(day4.officers.off_chen.wage).toBe(wage);
    expect(events(day4, 'anniversary', 'off_chen')).toHaveLength(0);
    const day6 = tick(day4, 6);
    expect(day6.officers.off_chen.wage).toBe(wage + 1);
    const rep = events(day6, 'anniversary', 'off_chen');
    expect(rep).toHaveLength(1);
    expect(rep[0].detail).toMatch(/9 years of service.*Wage \+\$1\/h \(now \$49\/h\)/);
    // Later ticks neither repeat the step nor the report.
    const day9 = tick(day6, 9);
    expect(day9.officers.off_chen.wage).toBe(wage + 1);
    expect(events(day9, 'anniversary', 'off_chen')).toHaveLength(1);
  });

  it('the wage step lands at the exact moment: funding is the sum of per-segment rates', () => {
    const s = createInitialState(T0);
    s.officers.off_chen.serviceStartDay = 5 - 9 * DAYS;
    const offline = tick(s, 10);
    // 10 hours at 620/h net, minus one extra wage dollar for the last 5 hours.
    expect(offline.department.funding).toBeCloseTo(12400 + 10 * 620 - 5 * 1, 3);
  });

  it('a wage step never exceeds the cap', () => {
    const s = createInitialState(T0);
    s.officers.off_chen.serviceStartDay = 5 - 9 * DAYS;
    s.officers.off_chen.wage = CAREER_TUNING.wageCap;
    const next = tick(s, 6);
    expect(next.officers.off_chen.wage).toBe(CAREER_TUNING.wageCap);
    expect(events(next, 'anniversary', 'off_chen')[0].detail).not.toMatch(/Wage/);
  });

  it('a birthday is reported only when it reaches an effect band (50, 55, 60)', () => {
    const s = createInitialState(T0);
    s.officers.off_reyes.bornDay = 3 - 27 * DAYS; // turns 27: no effect change
    s.officers.off_vale.bornDay = 3 - 50 * DAYS; // turns 50
    s.officers.off_ortiz.bornDay = 3 - 48 * DAYS; // turns 48: recovery already slowing, but not a new band
    const next = tick(s, 5);
    const birthdays = events(next, 'birthday');
    expect(birthdays.map((b) => b.officerId)).toEqual(['off_vale']);
    expect(birthdays[0].detail).toMatch(/Vale turned 50: Recovers 5% slower/);
  });
});

describe('retirement by age', () => {
  it('is announced 30 game days ahead, reported, then executed on the day', () => {
    let s = createInitialState(T0);
    turnsSixtyIn(s, 'off_okafor', 40);
    s = tick(s, 9);
    expect(s.officers.off_okafor.retirement).toBeNull(); // 31 days out: not yet
    s = tick(s, 11);
    const r = s.officers.off_okafor.retirement!;
    expect(r).toMatchObject({ reason: 'age', extended: false });
    expect(r.day).toBe(40);
    expect(r.announcedDay).toBeCloseTo(10, 5);
    expect(events(s, 'retirement_announced', 'off_okafor')).toHaveLength(1);
    expect(events(s, 'retirement_announced', 'off_okafor')[0].detail).toMatch(/mandatory retirement age of 60/);
    // Still on the roster, and the career view says when.
    expect(careerInfo(s, 'off_okafor', at(11))!.retirement).toMatchObject({ date: formatGameDate(40), inDays: 29, canRetain: false });
    expect(careerInfo(s, 'off_okafor', at(11))!.outlook).toMatch(/^Retiring 10 Feb 2026 \(in 29 days\)/);

    s = tick(s, 39);
    expect(s.officers.off_okafor).toBeDefined();
    s = tick(s, 41);
    expect(s.officers.off_okafor).toBeUndefined();
    expect(s.squads.find((q) => q.id === 'B')!.officerIds).not.toContain('off_okafor');
    expect(s.squads.find((q) => q.id === 'B')!.leaderId).not.toBe('off_okafor');
    expect(s.squads.find((q) => q.id === 'B')!.leaderId === null || s.squads.find((q) => q.id === 'B')!.officerIds.includes(s.squads.find((q) => q.id === 'B')!.leaderId!)).toBe(true);
    expect(events(s, 'retired', 'off_okafor')[0].detail).toMatch(/Okafor retired after 31 years/);
  });

  it('removes the wage and charges no severance', () => {
    const s = createInitialState(T0);
    turnsSixtyIn(s, 'off_okafor', 40);
    const next = tick(s, 41);
    expect(next.officers.off_okafor).toBeUndefined();
    const wages = Object.values(next.officers).reduce((sum, o) => sum + o.wage, 0);
    expect(ratesAt(next, at(41)).wages).toBe(wages);
    // 41 hours of income and wages (55/h for Okafor until day 40), no severance line.
    expect(next.department.funding).toBeGreaterThan(s.department.funding);
    expect(next.report!.shortages).toEqual([]);
    expect(projectDismiss(s, 'off_okafor', T0).upfront).toBe(8 * 55); // dismissal is the path that costs severance
  });

  it('the starting roster: Okafor chooses to retire at her 33rd service anniversary, ahead of age 60', () => {
    // Her draws: year 32 stays, year 33 retires (day 584). Age 60 would only come on day 1022.
    let s = createInitialState(T0);
    s = tick(s, 583);
    expect(s.officers.off_okafor.retirement).toBeNull();
    s = tick(s, 586);
    expect(s.officers.off_okafor.retirement).toMatchObject({ reason: 'service', day: 614, extended: false });
    expect(careerInfo(s, 'off_okafor', at(586))!.retirement).toMatchObject({ canRetain: true, retainCost: '+$7/h' });
    // Retained, she runs on to day 979 and then hits the next draw or the age-60 rule.
    const kept = ok(s, { type: 'offerRetention', officerId: 'off_okafor' }, at(586));
    expect(kept.officers.off_okafor.retirement).toMatchObject({ day: 979, extended: true });
    expect(tick(kept, 700).officers.off_okafor).toBeDefined();
    expect(tick(kept, 1000).officers.off_okafor).toBeUndefined();
  });

  it('waits for the operation to close, then retires right after', () => {
    let s = createInitialState(T0);
    turnsSixtyIn(s, 'off_okafor', 40);
    s = tick(s, 20);
    s.officers.off_okafor.assignment = { kind: 'operation', runId: 'run_1' };
    s = tick(s, 45);
    expect(s.officers.off_okafor).toBeDefined(); // held while deployed
    expect(events(s, 'retired')).toHaveLength(0);
    s.officers.off_okafor.assignment = null; // closeDebrief clears assignments
    s = tick(s, 46);
    expect(s.officers.off_okafor).toBeUndefined();
    expect(events(s, 'retired', 'off_okafor')).toHaveLength(1);
  });

  it('an announced retiree can still be dismissed', () => {
    let s = createInitialState(T0);
    turnsSixtyIn(s, 'off_okafor', 40);
    s = tick(s, 20);
    expect(projectDismiss(s, 'off_okafor', at(20)).ok).toBe(true);
  });
});

describe('retirement by service', () => {
  /** Find an anniversary where the officer's deterministic draw says retire, and one where it says stay. */
  function drawYears(id: string) {
    const picks: number[] = [];
    const stays: number[] = [];
    for (let k = 25; k <= 40; k++) (servicePicksRetirement({ id }, k) ? picks : stays).push(k);
    return { picks, stays };
  }

  it('is deterministic per officer and year, and only possible from 25 years', () => {
    expect(servicePicksRetirement({ id: 'off_okafor' }, 24)).toBe(false);
    const a = drawYears('off_okafor');
    const b = drawYears('off_okafor');
    expect(a).toEqual(b);
    expect(a.picks.length).toBeGreaterThan(0);
    expect(a.stays.length).toBeGreaterThan(0);
  });

  it('announces on the anniversary when the draw says retire, for 30 days out, and never when it says stay', () => {
    const { picks, stays } = drawYears('off_okafor');
    const setup = (k: number) => {
      const s = createInitialState(T0);
      s.officers.off_okafor.bornDay = -45 * DAYS; // young enough that age is no factor
      s.officers.off_okafor.serviceStartDay = 10 - k * DAYS; // k-th anniversary on day 10
      return s;
    };
    const stay = tick(setup(stays[0]), 12);
    expect(stay.officers.off_okafor.retirement).toBeNull();
    expect(events(stay, 'anniversary', 'off_okafor')).toHaveLength(1);

    const go = tick(setup(picks[0]), 12);
    expect(go.officers.off_okafor.retirement).toMatchObject({ reason: 'service', extended: false });
    expect(go.officers.off_okafor.retirement!.day).toBeCloseTo(40, 5);
    expect(events(go, 'retirement_announced', 'off_okafor')[0].detail).toMatch(/retention offer is possible/);
    expect(tick(go, 39).officers.off_okafor).toBeDefined();
    expect(tick(go, 41).officers.off_okafor).toBeUndefined();
  });

  it('does not trigger below 25 years of service', () => {
    const s = createInitialState(T0);
    s.officers.off_chen.serviceStartDay = 5 - 24 * DAYS;
    s.officers.off_chen.bornDay = -45 * DAYS;
    expect(tick(s, 6).officers.off_chen.retirement).toBeNull();
  });
});

describe('retention', () => {
  function announced(): GameState {
    const s = createInitialState(T0);
    s.officers.off_okafor.bornDay = -45 * DAYS;
    s.officers.off_okafor.retirement = { day: 20, reason: 'service', announcedDay: -10, extended: false };
    return s;
  }

  it('raises the wage by 12%, pushes the retirement a year, and works once', () => {
    let s = announced();
    const wage = s.officers.off_okafor.wage; // 55 -> +7
    const info = careerInfo(s, 'off_okafor', T0)!;
    expect(info.retirement).toMatchObject({ canRetain: true, retainCost: '+$7/h', reason: 'Chose to retire after a long career' });
    s = ok(s, { type: 'offerRetention', officerId: 'off_okafor' }, T0);
    expect(s.officers.off_okafor.wage).toBe(wage + 7);
    expect(s.officers.off_okafor.retirement).toMatchObject({ day: 20 + DAYS, extended: true, reason: 'service' });
    expect(refused(s, { type: 'offerRetention', officerId: 'off_okafor' }, T0)).toMatch(/already been persuaded/);
    expect(careerInfo(s, 'off_okafor', T0)!.retirement).toMatchObject({ canRetain: false });
    // She is still here when the original day passes, and leaves on the new one.
    s = tick(s, 30);
    expect(s.officers.off_okafor).toBeDefined();
    s = tick(s, 20 + DAYS - 1);
    expect(s.officers.off_okafor).toBeDefined();
    s = tick(s, 20 + DAYS + 1);
    expect(s.officers.off_okafor).toBeUndefined();
  });

  it('the raise shows in the budget and never leaves the department in deficit', () => {
    const s = announced();
    const before = budget(s).net;
    const next = ok(s, { type: 'offerRetention', officerId: 'off_okafor' }, T0);
    expect(budget(next).net).toBeCloseTo(before - 7, 9);
    // With a thin budget the offer is refused with the shortfall, and nothing changes.
    const thin = announced();
    for (const o of Object.values(thin.officers)) o.wage = 150;
    expect(refused(thin, { type: 'offerRetention', officerId: 'off_okafor' }, T0)).toMatch(/short/);
  });

  it('is refused for mandatory age retirement and burnout, and when not retiring', () => {
    const s = createInitialState(T0);
    expect(refused(s, { type: 'offerRetention', officerId: 'off_okafor' }, T0)).toMatch(/not retiring/);
    s.officers.off_okafor.retirement = { day: 20, reason: 'age', announcedDay: -10, extended: false };
    expect(refused(s, { type: 'offerRetention', officerId: 'off_okafor' }, T0)).toMatch(/mandatory retirement age/);
    expect(careerInfo(s, 'off_okafor', T0)!.retirement).toMatchObject({ canRetain: false, retainReason: expect.stringMatching(/cannot be deferred/) });
    s.officers.off_okafor.retirement = { day: 20, reason: 'burnout', announcedDay: -10, extended: false };
    expect(refused(s, { type: 'offerRetention', officerId: 'off_okafor' }, T0)).toMatch(/strain/);
    expect(refused(s, { type: 'offerRetention', officerId: 'nobody' }, T0)).toMatch(/No such officer/);
  });

  it('is refused if the extra year would pass the mandatory age', () => {
    const s = announced();
    s.officers.off_okafor.bornDay = 100 - 60 * DAYS; // turns 60 on day 100: one more year is too long
    const reason = refused(s, { type: 'offerRetention', officerId: 'off_okafor' }, T0);
    expect(reason).toMatch(/mandatory retirement/);
  });
});

describe('burnout', () => {
  it('sustained stress above 70 for 20 game days announces a retirement 30 days out', () => {
    let s = createInitialState(T0);
    s.officers.off_chen.stress = 100; // patrol: recovers 1/h, so it is still above 70 after 20 hours (80)
    s = tick(s, 19);
    expect(s.officers.off_chen.retirement).toBeNull();
    s = tick(s, 21);
    expect(s.officers.off_chen.retirement).toMatchObject({ reason: 'burnout' });
    expect(s.officers.off_chen.retirement!.day).toBeCloseTo(50, 3);
    expect(events(s, 'retirement_announced', 'off_chen')[0].detail).toMatch(/stress above 70 for 20 days/);
    expect(refused(s, { type: 'offerRetention', officerId: 'off_chen' }, at(21))).toMatch(/strain/);
    s = tick(s, 49);
    expect(s.officers.off_chen).toBeDefined();
    s = tick(s, 51);
    expect(s.officers.off_chen).toBeUndefined();
  });

  it('stress that recovers below 70 resets the clock', () => {
    let s = createInitialState(T0);
    s.officers.off_chen.stress = 75; // patrol 1/h: below 70 after 5 hours
    s = tick(s, 25);
    expect(s.officers.off_chen.retirement).toBeNull();
    // Back up above 70 starts a fresh 20-day clock rather than resuming the old one.
    s.officers.off_chen.stress = 95;
    s = tick(s, 30);
    expect(s.officers.off_chen.retirement).toBeNull();
    s = tick(s, 46);
    expect(s.officers.off_chen.retirement).toMatchObject({ reason: 'burnout' });
  });

  it('three adverse operations among the last five triggers it; two do not', () => {
    const adverse = (n: string, ids = ['off_brooks']) => debrief(n, ids, 20, 30);
    const good = (n: string) => debrief(n, ['off_brooks'], 90, 90);
    expect(debriefBand(adverse('x'))).toBe('adverse');
    expect(debriefBand(good('x'))).toBe('favorable');
    expect(debriefBand(debrief('x', [], 50, 50))).toBe('mixed');

    const two = createInitialState(T0);
    two.debriefs = [adverse('r5'), good('r4'), adverse('r3'), good('r2'), good('r1')];
    expect(recentAdverse(two, 'off_brooks')).toEqual({ adverse: 2, total: 5 });
    expect(tick(two, 2).officers.off_brooks.retirement).toBeNull();

    const three = createInitialState(T0);
    three.debriefs = [adverse('r5'), adverse('r4'), good('r3'), adverse('r2'), good('r1')];
    const next = tick(three, 2);
    expect(next.officers.off_brooks.retirement).toMatchObject({ reason: 'burnout' });
    expect(events(next, 'retirement_announced', 'off_brooks')[0].detail).toMatch(/3 adverse operations in the last 5/);
    // Officers who were not on those operations are untouched.
    expect(next.officers.off_chen.retirement).toBeNull();
  });

  it('operation outcomes are counted into the career once, however often it settles', () => {
    const s = createInitialState(T0);
    const before = { ...s.officers.off_brooks.career };
    s.debriefs = [debrief('run_7', ['off_brooks'], 90, 90)];
    const a = tick(s, 1);
    const b = tick(a, 2);
    expect(b.officers.off_brooks.career.operations).toBe(before.operations + 1);
    expect(b.officers.off_brooks.career.favorable).toBe(before.favorable + 1);
    countNewDebriefs(b, b.officers.off_brooks);
    expect(b.officers.off_brooks.career.operations).toBe(before.operations + 1);
    // A newer debrief adds exactly one more.
    b.debriefs = [debrief('run_8', ['off_brooks'], 10, 10), ...b.debriefs];
    const c = tick(b, 3);
    expect(c.officers.off_brooks.career).toMatchObject({ operations: before.operations + 2, adverse: before.adverse + 1 });
  });
});

describe('offline equivalence with careers and wear', () => {
  function scenario(): GameState {
    const s = createInitialState(T0);
    turnsSixtyIn(s, 'off_okafor', 400); // announced at day 370, leaves at 400
    s.officers.off_chen.serviceStartDay = 25 - 9 * DAYS; // anniversary on day 25
    s.officers.off_vale.bornDay = 90 - 50 * DAYS; // 50th birthday on day 90
    s.officers.off_ortiz.stress = 100; // burnout clock runs out at day 20 while recovering at 1/h
    s.officers.off_ortiz.squadId = 'A';
    s.officers.off_park.xp += 160;
    return s;
  }

  function sameState(a: GameState, b: GameState) {
    expect(Object.keys(a.officers).sort()).toEqual(Object.keys(b.officers).sort());
    for (const id of Object.keys(a.officers)) {
      const x = a.officers[id];
      const y = b.officers[id];
      expect(x.stress, `${id} stress`).toBeCloseTo(y.stress, 6);
      expect(x.wage, `${id} wage`).toBe(y.wage);
      expect(x.ratings, `${id} ratings`).toEqual(y.ratings);
      expect(x.retirement, `${id} retirement`).toEqual(y.retirement);
      expect(x.career, `${id} career`).toEqual(y.career);
    }
    for (const id of Object.keys(a.units)) {
      const { condition: ca, ...ra } = a.units[id];
      const { condition: cb, ...rb } = b.units[id];
      expect(ra, id).toEqual(rb);
      expect(ca, id).toBeCloseTo(cb, 6);
    }
    expect(a.department.funding).toBeCloseTo(b.department.funding, 3);
    expect(a.squads).toEqual(b.squads);
    const key = (e: { officerId?: string; unitId?: string; event: string }) => `${e.officerId ?? e.unitId}:${e.event}`;
    expect((a.report?.personnel ?? []).map(key).sort()).toEqual((b.report?.personnel ?? []).map(key).sort());
    expect((a.report?.equipment ?? []).map(key).sort()).toEqual((b.report?.equipment ?? []).map(key).sort());
  }

  it('420 game days by uneven ticks equals one settlement, including a retirement and a wage step', () => {
    const start = scenario();
    const end = at(420);
    let online = start;
    for (let t = T0 + 37 * 60_000; t < end; t += 37 * 60_000 + 123) online = ok(online, { type: 'tick' }, t);
    online = ok(online, { type: 'tick' }, end);
    const offline = ok(start, { type: 'tick' }, end);
    sameState(online, offline);
    expect(offline.officers.off_okafor).toBeUndefined(); // retired on day 400
    expect(offline.officers.off_chen.wage).toBe(start.officers.off_chen.wage + 2); // anniversaries on day 25 and 390
    expect(offline.officers.off_ortiz).toBeUndefined(); // burnout: announced day 20, retired day 50
    expect(events(offline, 'retirement_announced', 'off_ortiz')[0].detail).toMatch(/burning out/);
    expect(events(offline, 'retired', 'off_ortiz')).toHaveLength(1);
    expect(events(offline, 'birthday', 'off_vale')).toHaveLength(1);
    expect(offline.report!.equipment.length).toBeGreaterThan(0);
    // Funding stops with the 24h window, but careers and wear do not.
    expect(offline.department.lastSettledAt).toBe(end);
  });

  it('a reload mid-way changes nothing', () => {
    const start = scenario();
    const mid = ok(start, { type: 'tick' }, at(200));
    const reloaded = JSON.parse(JSON.stringify(mid)) as GameState;
    sameState(ok(reloaded, { type: 'tick' }, at(420)), ok(start, { type: 'tick' }, at(420)));
  });
});

describe('recruits', () => {
  it('have ages and prior service; experienced ones cost more and learn slower', () => {
    const s = createInitialState(T0);
    // Gather a larger pool deterministically.
    const pool: { c: GameState['candidates'][number]; day: number }[] = [];
    let t = T0;
    for (let i = 0; i < 12; i++) {
      fillCandidates(s, t);
      for (const c of s.candidates) pool.push({ c, day: gameDay(s, t) });
      t += 5 * HOUR_MS;
    }
    expect(pool.length).toBeGreaterThanOrEqual(30);
    const info = pool.map(({ c, day }) => ({
      c,
      age: (day - c.officer.bornDay) / DAYS,
      service: (day - c.officer.serviceStartDay) / DAYS,
      band: experienceBand(c.officer, day),
    }));
    for (const x of info) {
      expect(x.age).toBeGreaterThanOrEqual(21);
      expect(x.age).toBeLessThan(60);
      expect(x.service).toBeGreaterThanOrEqual(0);
      expect(x.service).toBeLessThanOrEqual(x.age - 16);
      expect(x.c.officer.career.operations).toBeGreaterThanOrEqual(0);
      expect(x.c.officer.retirement).toBeNull();
    }
    const rookies = info.filter((x) => x.c.officer.traits.includes('rookie'));
    expect(rookies.length).toBeGreaterThan(0);
    for (const x of rookies) expect(x.service).toBeLessThanOrEqual(1.5);
    expect(info.some((x) => x.band === 'veteran' || x.band === 'seasoned')).toBe(true);
    // Same ratings-based formula, so more service means a higher fee.
    const exp = info.filter((x) => x.service >= 15);
    const fresh = info.filter((x) => x.service <= 2 && !x.c.officer.traits.includes('rookie'));
    if (exp.length && fresh.length) {
      const avg = (xs: typeof info) => xs.reduce((a, x) => a + x.c.signingCost / x.c.officer.wage, 0) / xs.length;
      expect(avg(exp)).toBeGreaterThan(avg(fresh));
    }
    for (const x of info) expect(x.c.signingCost).toBeGreaterThan(x.c.officer.wage * 20);
    // Experienced recruits are slower learners than rookies (the multiplier table).
    const mult = (b: string) => ({ rookie: 1.3, developing: 1, seasoned: 0.85, veteran: 0.7 }[b as 'rookie']);
    expect(mult('veteran')).toBeLessThan(mult('rookie'));
  });

  it('are deterministic from the department rng and carry their calendar-day dates', () => {
    const a = createInitialState(T0);
    const b = createInitialState(T0);
    expect(a.candidates).toEqual(b.candidates);
    const later = ok(a, { type: 'refreshCandidates' }, at(10));
    const day10 = later.candidates[0].officer;
    expect(day10.bornDay).toBeLessThan(10 - 20 * DAYS); // born at least ~20 years before game day 10
  });
});

describe('careerInfo', () => {
  const s = createInitialState(T0);

  it('describes Okafor in player language with a mandatory-retirement outlook', () => {
    const info = careerInfo(s, 'off_okafor', T0)!;
    expect(info).toMatchObject({ age: 57, experience: 'veteran', experienceLabel: 'Veteran', born: expect.stringMatching(/1968$/) });
    expect(info.serviceYears).toBeCloseTo(31.4, 1);
    expect(info.effects.join(' | ')).toMatch(/Veteran: steadier under pressure/);
    expect(info.effects).toContain('Recovers 12% slower (age 57)');
    expect(info.outlook).toMatch(/^Mandatory retirement in 3 years \(age 60\)/);
    expect(info.retirement).toBeNull();
  });

  it('describes a rookie and a seasoned officer, and tells the service-retirement horizon', () => {
    const park = careerInfo(s, 'off_park', T0)!;
    expect(park.experienceLabel).toBe('Rookie');
    expect(park.effects.join(' ')).toMatch(/learns fast/);
    expect(park.effects.some((e) => /Recovers/.test(e))).toBe(false);
    expect(park.outlook).toMatch(/Mandatory retirement in 36 years \(age 60\)/);
    expect(park.outlook).toMatch(/after 25 years of service \(in 2[45] years\)/);
    expect(careerInfo(s, 'nobody', T0)).toBeNull();
  });

  it('experience bands move with service time', () => {
    const brooks = careerInfo(s, 'off_brooks', T0)!;
    expect(brooks.experience).toBe('seasoned');
    // About a year later Brooks crosses 15 effective years and becomes a veteran.
    expect(careerInfo(s, 'off_brooks', at(400))!.experience).toBe('veteran');
  });
});

describe('budget and recovery tuning stay sensible', () => {
  it('wage steps are small relative to the opening net budget', () => {
    expect(CAREER_TUNING.wageStep).toBeLessThanOrEqual(1);
    expect(ratesAt(createInitialState(T0), T0).net).toBe(620);
    expect(ECONOMY_TUNING.recoveryPerHour.patrol).toBe(1);
  });
});
