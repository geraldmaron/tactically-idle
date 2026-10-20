import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../sim/department';
import type { ShiftReport } from '../../sim/types';
import { welcomeLines } from './WelcomeBack';
import { OfficerCard } from './OfficerCard';
import { DepartmentContext } from './department-context';

const NOW = Date.UTC(2026, 9, 3);
const state = createInitialState(NOW, 1);
const [first, second] = Object.keys(state.officers);

function report(patch: Partial<ShiftReport> = {}): ShiftReport {
  return {
    from: NOW - 6 * 3600_000, to: NOW, accruedHours: 6, gross: 7000, wages: 3000, operating: 500, restockSpend: 0,
    net: 3500, devPoints: 1.6, completedCourses: [], recovered: [], shortages: [], capped: false, equipment: [], personnel: [], ...patch,
  };
}

describe('welcome back (welcome-back)', () => {
  it('leads with what changed and names one officer by name', () => {
    const lines = welcomeLines(report({ completedCourses: [{ officerId: first, courseId: 'crisis_negotiation_course' }], recovered: [second] }), state);
    expect(lines.map((line) => line.key)).toEqual(['dp', 'courses', 'rec']);
    expect(lines[1].text).toMatch(/finished Crisis negotiation/i);
    expect(lines[2].text).toContain('back on the roster');
  });

  it('flags kit and restocks that need a look, and says when pay stopped at the cap', () => {
    const lines = welcomeLines(report({ devPoints: 0, capped: true, accruedHours: 24, shortages: ['Radio headset: not enough funding'],
      equipment: [{ unitId: 'u1', event: 'failed' }, { unitId: 'u2', event: 'serviced' }] }), state);
    expect(lines.map((line) => [line.key, line.tone])).toEqual([['kit', 'warn'], ['short', 'warn'], ['cap', undefined]]);
    expect(lines[0].text).toBe('1 piece of kit needs service');
  });

  it('never offers to collect earnings that were already applied', () => {
    for (const line of welcomeLines(report(), state)) expect(line.text).not.toMatch(/collect|claim/i);
  });
});

describe('officer character card (squad-cards)', () => {
  it('badges the role rating with an XP ring and says both aloud, with no invented level', () => {
    const officer = structuredClone(state.officers[first]);
    const html = renderToStaticMarkup(createElement(DepartmentContext.Provider, { value: state.department },
      createElement(OfficerCard, { officer, now: NOW, variant: 'tile' })));
    expect(html).toContain('class="ocard-badge');
    expect(html).toMatch(/--xp:\d+(\.\d+)?%/);
    expect(html).toMatch(/aria-label="[^"]*, [A-Z][a-z]+ \d+, \d+% to the next point/);
    expect(html).not.toMatch(/level/i);
  });
});
