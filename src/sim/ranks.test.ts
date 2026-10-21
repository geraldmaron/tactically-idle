import { describe, expect, it } from 'vitest';
import { RANKS, RANK_IDS, RANK_TUNING, rankForService, rankForXp, rankPay, xpCap } from '../content/ranks';
import { createInitialState } from './department';
import { creditXp, experienceBand, promotionEffects, rankOf, rankProgress } from './ranks';
import type { Officer } from './types';
import { SOURCES } from '../dev/import-graph';

const T0 = Date.UTC(2026, 0, 5, 12);
function officer(xp: number, patch: Partial<Officer> = {}): Officer {
  const o = structuredClone(createInitialState(T0, 3).officers.off_brooks);
  Object.assign(o, { xp, role: 'breach', traits: [], promotions: undefined, wage: 50 }, patch);
  o.ratings.shooting = 60;
  o.ratings.composure = 60;
  return o;
}

describe('the rank ladder (officer-ranks)', () => {
  it('maps XP to five real US police ranks, each band read from the rank', () => {
    expect(RANK_IDS.map((rank) => RANKS[rank].title)).toEqual(['Probationary Officer', 'Officer', 'Corporal', 'Sergeant', 'Lieutenant']);
    expect(RANK_IDS.map((rank) => RANKS[rank].band)).toEqual(['rookie', 'developing', 'developing', 'seasoned', 'veteran']);
    RANK_TUNING.xp.forEach((xp, i) => {
      expect(rankForXp(xp)).toBe(RANK_IDS[i]);
      if (i > 0) expect(rankForXp(xp - 1)).toBe(RANK_IDS[i - 1]);
    });
    expect(experienceBand(officer(0))).toBe('rookie');
    expect(experienceBand(officer(xpCap()))).toBe('veteran');
  });

  it('places service years on the same bands the calendar used to give (2, 8 and 15 years)', () => {
    expect([0, 1.9, 2, 4.9, 5, 7.9, 8, 14.9, 15, 30].map((years) => RANKS[rankForService(years)].band))
      .toEqual(['rookie', 'rookie', 'developing', 'developing', 'developing', 'developing', 'seasoned', 'seasoned', 'veteran', 'veteran']);
  });

  it('caps XP at the top rank', () => {
    const o = officer(xpCap() - 10);
    creditXp(o, 500, { label: 'after a call', day: 1 });
    expect(o.xp).toBe(xpCap());
    expect(rankProgress(o)).toMatchObject({ rank: 'lieutenant', next: null, progress: 1 });
    expect(creditXp(o, 50, { label: 'after a call', day: 2 })).toEqual([]);
  });

  it('promotes once per threshold with the role rating, composure at command ranks, wage and a named trait', () => {
    const o = officer(RANK_TUNING.xp[3] - 1, { traits: ['impatient'] });
    const [p] = creditXp(o, 1, { label: 'after Barricade on Wren Court', day: 300 });
    expect(p).toMatchObject({ rank: 'sergeant', from: 'corporal', ratings: { shooting: 3, composure: 2 }, wage: 3, trait: 'mentor', drops: null });
    expect(o.ratings.shooting).toBe(63);
    expect(o.ratings.composure).toBe(62);
    expect(o.wage).toBe(53);
    expect(o.traits).toEqual(['impatient', 'mentor']);
    expect(o.promotions).toEqual([{ rank: 'sergeant', day: 300, cause: 'after Barricade on Wren Court' }]);
    expect(creditXp(o, 1, { label: 'again', day: 301 })).toEqual([]);
  });

  it('reaches several ranks in order from one large award', () => {
    const o = officer(0, { traits: ['rookie'] });
    const ranks = creditXp(o, RANK_TUNING.xp[3], { label: 'on finishing a course', day: 5 }).map((p) => p.rank);
    expect(ranks).toEqual(['officer', 'corporal', 'sergeant']);
    expect(o.traits).toEqual(['steady', 'mentor']);
    expect(o.wage).toBe(50 + rankPay('sergeant'));
  });

  it('respects the rating ceiling, a trait already held, and the trait cap', () => {
    const high = officer(RANK_TUNING.xp[2] - 1);
    high.ratings.shooting = RANK_TUNING.ratingCeiling - 1;
    expect(promotionEffects(high, 'corporal').ratings).toEqual({ shooting: 1 });
    expect(promotionEffects(officer(0, { traits: ['steady'] }), 'corporal').trait).toBeNull();
    expect(promotionEffects(officer(0, { traits: ['impatient', 'observant', 'calm_voice'] }), 'corporal').trait).toBeNull();
    // Dropping rookie makes room: a full officer losing rookie still has no room for a fourth.
    expect(promotionEffects(officer(0, { traits: ['rookie', 'steady', 'observant'] }), 'officer')).toMatchObject({ drops: 'rookie', trait: null });
  });

  it('keeps the experience band in one place: no module reads service years for it', () => {
    const o = officer(RANK_TUNING.xp[1]);
    o.serviceStartDay = -40 * 365;
    expect(rankOf(o)).toBe('officer');
    expect(experienceBand(o)).toBe('developing');
  });
});

describe('one XP writer', () => {
  it('only sim/ranks.ts changes officer XP in the game; every award goes through creditXp', () => {
    // test-fixtures.ts places fixture officers at the XP of their service, as officers.ts does.
    const offenders = Object.entries(SOURCES).filter(([path, source]) => path !== '/src/sim/ranks.ts' && path !== '/src/sim/test-fixtures.ts' && /\.xp\s*(\+|-)?=(?!=)/.test(source)).map(([path]) => path);
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });
});
