import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../sim/department';
import type { ShiftReport } from '../../sim/types';
import { welcomeLines } from './WelcomeBack';
import { OfficerTile } from './OfficerTile';
import { DepartmentContext } from './department-context';

const NOW = Date.UTC(2026, 9, 3);
const state = createInitialState(NOW, 1);
const [first, second] = Object.keys(state.officers);

function report(patch: Partial<ShiftReport> = {}): ShiftReport {
  return {
    from: NOW - 6 * 3600_000, to: NOW, accruedHours: 6, gross: 7000, wages: 3000, operating: 500, restockSpend: 0,
    net: 3500, completedCourses: [], recovered: [], shortages: [], capped: false, equipment: [], personnel: [], ...patch,
  };
}

describe('welcome back (welcome-back)', () => {
  it('leads with what changed and names one officer by name', () => {
    const lines = welcomeLines(report({ completedCourses: [{ officerId: first, courseId: 'crisis_negotiation_course' }], recovered: [second],
      grants: [{ nodeId: 'intel_thermal', tier: 1, at: NOW, milestone: 'Level 3' }],
      personnel: [{ officerId: first, event: 'promoted', detail: 'Mei Chen promoted to Sergeant after a call. Communication +3' }] }), state);
    expect(lines.map((line) => line.key)).toEqual(['grant:intel_thermal:1', 'promoted', 'courses', 'rec']);
    expect(lines[0].text).toBe('Thermal imaging granted at level 3');
    expect(lines[1].text).toBe('Mei Chen promoted to Sergeant after a call');
    expect(lines[2].text).toMatch(/finished Crisis negotiation/i);
    expect(lines[3].text).toContain('back on the roster');
  });

  it('flags kit and restocks that need a look, and says when pay stopped at the cap', () => {
    const lines = welcomeLines(report({ capped: true, accruedHours: 24, shortages: ['Radio headset: not enough funding'],
      equipment: [{ unitId: 'u1', event: 'failed' }, { unitId: 'u2', event: 'serviced' }] }), state);
    expect(lines.map((line) => [line.key, line.tone])).toEqual([['kit', 'warn'], ['short', 'warn'], ['cap', undefined]]);
    expect(lines[0].text).toBe('1 piece of kit needs service');
  });

  it('never offers to collect earnings that were already applied', () => {
    for (const line of welcomeLines(report(), state)) expect(line.text).not.toMatch(/collect|claim/i);
  });
});

describe('officer character card (squad-cards)', () => {
  it('badges the rank with an XP ring toward the next rank and says both aloud, with no invented level', () => {
    const officer = structuredClone(state.officers[first]);
    const html = renderToStaticMarkup(createElement(DepartmentContext.Provider, { value: state.department },
      createElement(OfficerTile, { officer, now: NOW })));
    expect(html).toContain('class="ring');
    expect(html).toMatch(/--ring-fill:\d+(\.\d+)?/);
    expect(html).toMatch(/aria-label="[^"]*, (Probationary Officer|Officer|Corporal|Sergeant)(, \d+% to [A-Z][a-z]+)?|Lieutenant/);
    expect(html).toContain('class="rank-insignia');
    expect(html).not.toMatch(/level/i);
  });
});
