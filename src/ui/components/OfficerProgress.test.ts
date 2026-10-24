import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../sim/department';
import { creditXp } from '../../sim/ranks';
import { RANK_TUNING } from '../../content/ranks';
import type { Officer } from '../../sim/types';
import { OfficerProgress, RankLadder, officerGrowth } from './OfficerProgress';

function officer(xp = 200): Officer {
  const o = structuredClone(createInitialState(Date.UTC(2026, 9, 3), 1).officers.off_chen);
  o.role = 'comms';
  o.ratings.communication = 60;
  o.ratings.composure = 50;
  o.traits = [];
  o.xp = xp;
  delete o.promotions;
  return o;
}

const render = (o: Officer) => renderToStaticMarkup(createElement(OfficerProgress, { officer: o }));

describe('officer rank progress (officer-ranks)', () => {
  it('shows the rank, the XP to the next one and what that promotion gives, without changing the officer', () => {
    const o = officer(200);
    const before = structuredClone(o);
    const html = render(o);
    expect(html).toContain('Officer');
    expect(html).toContain('250 XP to Corporal');
    expect(html).toContain('50 / 300');
    expect(html).toContain('Corporal brings communication +3, earns steady, wage +2 funding an hour');
    expect(html).toContain('50 of 300 XP toward Corporal; 250 XP to go');
    expect(o).toEqual(before);
  });

  it('matches the engine: one XP short shows one to go, and the award that crosses promotes', () => {
    const o = officer(RANK_TUNING.xp[3] - 1);
    expect(officerGrowth(o)).toMatchObject({ rank: 'corporal', next: 'sergeant', toGo: 1 });
    const promotions = creditXp(o, 1, { label: 'after a test call', day: 10 });
    expect(promotions.map((p) => p.rank)).toEqual(['sergeant']);
    expect(officerGrowth(o)).toMatchObject({ rank: 'sergeant', next: 'lieutenant', progress: 0 });
  });

  it('says XP stops at the top rank and promises nothing more', () => {
    const o = officer(RANK_TUNING.xp[4]);
    const html = render(o);
    expect(html).toContain('Lieutenant');
    expect(html).toContain('Top rank. XP no longer rises.');
    expect(html).not.toContain('role="img"');
    expect(creditXp(o, 500, { label: 'x', day: 0 })).toEqual([]);
    expect(o.xp).toBe(RANK_TUNING.xp[4]);
  });

  it('draws the ladder with the cause of a rank reached in play', () => {
    const o = officer(RANK_TUNING.xp[2] - 5);
    creditXp(o, 10, { label: 'after Barricade on Wren Court', day: 400 });
    const html = renderToStaticMarkup(createElement(RankLadder, { officer: o }));
    for (const title of ['Probationary Officer', 'Officer', 'Corporal', 'Sergeant', 'Lieutenant']) expect(html).toContain(title);
    expect(html).toContain('Made 5 Feb 2027, after Barricade on Wren Court');
    expect(html).toContain('aria-current="step"');
    expect((html.match(/data-state="next"/g) ?? [])).toHaveLength(1);
  });
});
