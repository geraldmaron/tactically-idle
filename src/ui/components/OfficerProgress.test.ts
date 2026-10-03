import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../sim/department';
import { applyXpGrowth } from '../../sim/career';
import type { Officer } from '../../sim/types';
import { OfficerProgress, officerGrowth } from './OfficerProgress';

function officer(years = 1): Officer {
  const o = structuredClone(createInitialState(Date.UTC(2026, 9, 3), 1).officers.off_chen);
  o.serviceStartDay = -years * 365;
  o.bornDay = -25 * 365;
  o.career = { operations: 0, favorable: 0, adverse: 0 };
  o.role = 'comms';
  o.ratings.communication = 60;
  o.xp = 130;
  o.xpBanked = 100;
  return o;
}

const render = (o: Officer) => renderToStaticMarkup(createElement(OfficerProgress, { officer: o, day: 0 }));

describe('real officer rating progress', () => {
  it('shows the unconverted bank, a named rating and lifetime XP without inventing a level', () => {
    const o = officer();
    const before = structuredClone(o);
    const html = render(o);
    expect(html).toContain('Communication');
    expect(html).toContain('30 / 77 XP');
    expect(html).toContain('47 XP to +1');
    expect(html).toContain('130 total XP');
    expect(html).toContain('XP toward the next communication point 30 of 77 XP; 47 XP remaining');
    expect(html).not.toMatch(/level|rank up/i);
    expect(o).toEqual(before);
  });

  it.each([[1, 77], [4, 100], [10, 118], [20, 143]])('matches engine conversion at %i service years', (years, threshold) => {
    const o = officer(years);
    o.xp = o.xpBanked! + threshold - 1;
    expect(officerGrowth(o, 0)).toMatchObject({ threshold, earned: threshold - 1, remaining: 1, current: 60 });
    expect(applyXpGrowth(o, 0)).toBe(0);
    o.xp++;
    expect(applyXpGrowth(o, 0)).toBe(1);
    expect(officerGrowth(o, 0)).toMatchObject({ current: 61, earned: 0, remaining: threshold, progress: 0 });
  });

  it.each([90, 95])('does not promise another XP rating point when the current rating is %i', (rating) => {
    const o = officer();
    o.ratings.communication = rating;
    o.xp = 800;
    const html = render(o);
    expect(html).toContain('Experience can’t raise this skill further');
    expect(html).toContain('Experience can raise this skill up to 90.');
    expect(html).toContain('800 total XP');
    expect(html).not.toContain('to +1');
    expect(html).not.toContain('role="img"');
    expect(applyXpGrowth(o, 0)).toBe(0);
  });

  it('handles an empty bank without implying zero-XP gains or a completed point', () => {
    const o = officer();
    o.xp = 0;
    o.xpBanked = 0;
    expect(render(o)).toContain('0 / 77 XP');
    expect(render(o)).toContain('77 XP to +1');
    expect(render(o)).not.toContain('Rating point ready');
  });

  it('does not fabricate progress for legacy records without career dates or history', () => {
    for (const key of ['career', 'bornDay', 'serviceStartDay'] as const) {
      const o = officer();
      delete (o as unknown as Record<string, unknown>)[key];
      expect(officerGrowth(o, 0)).toBeNull();
      expect(render(o)).toBe('');
    }
  });
});
