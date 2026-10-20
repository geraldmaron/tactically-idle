// officer-value: officers learn at a pace set by who they are, and pricier, better-qualified officers
// earn faster through instructor details, at the cost of being off the board while they teach.
import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { learnedXp, learningAptitude, learningMultiplier, learningPace } from './career';
import { DETAIL_TUNING, detailCheck, detailRate } from './detail';
import { deployability } from './officer';
import { budget } from './department-selectors';
import { ECONOMY_TUNING } from './economy';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 0, 1, 8);
const HOUR = 3_600_000;
const send = (s: GameState, cmd: Command, now = T0) => dispatch(s, cmd, { now });

describe('learning pace from attributes', () => {
  it('scales the XP an award gives by composure and awareness on top of experience band', () => {
    const s = createInitialState(T0);
    const calm = structuredClone(s.officers.off_chen), rattled = structuredClone(s.officers.off_chen);
    calm.ratings.composure = calm.ratings.awareness = 90;
    rattled.ratings.composure = rattled.ratings.awareness = 20;
    expect(learningAptitude(calm)).toBeGreaterThan(1);
    expect(learningAptitude(rattled)).toBeLessThan(1);
    expect(learningMultiplier(calm)).toBeGreaterThan(learningMultiplier(rattled));
    expect(learnedXp(calm, 100)).toBeGreaterThan(learnedXp(rattled, 100));
    expect(learningPace(calm)).not.toBe('slow');
    expect(learningPace(rattled)).not.toBe('fast');
  });
});

describe('instructor details', () => {
  it('pay more per hour for a higher wage and more certifications, and nothing without one', () => {
    expect(detailRate({ wage: 50, certs: [] })).toBeNull();
    expect(detailRate({ wage: 60, certs: ['entry_team'] })!).toBeGreaterThan(detailRate({ wage: 40, certs: ['entry_team'] })!);
    expect(detailRate({ wage: 50, certs: ['entry_team', 'surveillance'] })!).toBeGreaterThan(detailRate({ wage: 50, certs: ['entry_team'] })!);
    // A detail must beat the patrol pay the officer gives up, or it is never worth choosing.
    expect(detailRate({ wage: 38, certs: ['surveillance'] })!).toBeGreaterThan(ECONOMY_TUNING.patrolPerOfficer);
  });

  it('takes the officer off the board and off patrol, then pays its fee through the ledger', () => {
    let s = createInitialState(T0);
    s = send(s, { type: 'setSquadDuty', squadId: 'A', duty: 'patrol' }).state;
    const before = budget(s).patrol;
    const quote = detailCheck(s, 'off_brooks');
    expect(quote.ok).toBe(true);
    const r = send(s, { type: 'startDetail', officerId: 'off_brooks' });
    expect(r.result.ok).toBe(true);
    s = r.state;
    expect(deployability(s.officers.off_brooks, T0).ok).toBe(false);
    expect(budget(s).patrol).toBe(before - ECONOMY_TUNING.patrolPerOfficer);
    expect(send(s, { type: 'startDetail', officerId: 'off_brooks' }).result.ok).toBe(false);
    const xp = s.officers.off_brooks.xp;
    const done = send(s, { type: 'tick' }, T0 + DETAIL_TUNING.hours * HOUR + 1).state;
    expect(done.officers.off_brooks.assignment).toBeNull();
    expect(done.officers.off_brooks.xp).toBeGreaterThan(xp);
    expect(done.department.ledger!.find((e) => e.kind === 'detail')).toMatchObject({ amount: quote.fee });
  });

  it('refuses an officer with no certification', () => {
    const s = createInitialState(T0);
    expect(s.officers.off_reyes.certs).toEqual([]);
    expect(send(s, { type: 'startDetail', officerId: 'off_reyes' }).result).toMatchObject({ ok: false, reason: expect.stringContaining('certification') });
  });
});

describe('no candidate is a dead option on money', () => {
  it('a cheaper candidate always costs less on patrol, and a dearer one with as many certifications earns at least as much on a detail', () => {
    for (const seed of [1, 7, 42, 719, 12345]) {
      const pool = createInitialState(T0, seed).candidates.map((c) => c.officer);
      for (const a of pool) for (const b of pool) {
        if (a.wage >= b.wage) continue;
        expect(ECONOMY_TUNING.patrolPerOfficer - a.wage).toBeGreaterThan(ECONOMY_TUNING.patrolPerOfficer - b.wage);
        if (b.certs.length >= a.certs.length && a.certs.length > 0) expect(detailRate(b)!).toBeGreaterThanOrEqual(detailRate(a)!);
      }
    }
  });
});
