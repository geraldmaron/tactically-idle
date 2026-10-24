// Crisis calls per shift (hostage review N21), measured on the board's own schedule. Report only:
// the counts print, and the assertions hold the sampler itself honest, never the content.
import { boardTypes } from '../../../sim/incidents';
import { describe, expect, it } from 'vitest';
import { CRISIS_CAP, CRISIS_TYPES, sampleShifts, shiftReport } from './shift-sampler';

const SHIFTS = 200;

describe('shift sampler: crisis calls per shift', () => {
  it('names the crisis calls as the content-note list does', () => {
    expect([...CRISIS_TYPES].sort()).toEqual(['barricaded', 'hostage_crisis']);
    expect(CRISIS_CAP).toBe(1);
  });

  it('reports crisis calls per shift for each player and department (report only)', () => {
    const lines: string[] = [];
    for (const department of ['new', 'every-type'] as const) for (const player of ['takes-every-call', 'takes-crisis-calls', 'takes-nothing'] as const) {
      const sample = sampleShifts({ shifts: SHIFTS, player, department });
      expect(sample.crisis).toHaveLength(SHIFTS);
      expect(Object.values(sample.histogram).reduce((a, b) => a + b, 0)).toBe(SHIFTS);
      lines.push(shiftReport(sample));
    }
    console.info(`Crisis calls per shift (one game day each, ${SHIFTS} shifts; no policy is a proven bound):\n${lines.join('\n')}`);
  }, 120000);

  it('is deterministic for a seed', () => {
    expect(sampleShifts({ shifts: 40 })).toEqual(sampleShifts({ shifts: 40 }));
  });

  it('takes only crisis calls when asked, leaving the other cards to steer the draw', () => {
    // A selective player meets at least as many crisis calls as one who takes every call (Codex
    // review: every type unlocked, seed 719, 200 days, 142 against 94), so neither bounds the other.
    const total = (player: 'takes-every-call' | 'takes-crisis-calls') => sampleShifts({ shifts: 200, player, department: 'every-type' }).crisis.reduce((x, y) => x + y, 0);
    // With every call on the board a crisis call (the curated set is one hostage call today), the two
    // players meet the same calls; with more kinds on the board the selective one meets more.
    expect(total('takes-crisis-calls')).toBeGreaterThanOrEqual(total('takes-every-call'));
  }, 120000);

  it('opens every type the board draws when the department can answer them', () => {
    // The warrant call only the world sends never comes onto the board at random.
    const types = new Set(sampleShifts({ shifts: SHIFTS, department: 'every-type' }).calls.flatMap(byType => Object.keys(byType)));
    expect([...types].sort()).toEqual(boardTypes().sort());
  }, 120000);
});
