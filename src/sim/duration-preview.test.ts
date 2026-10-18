// The minutes a choice shows must count its publicly known delays and never fall outside the range
// shown beside them (ported from the open PR #29, "Count known delays in decision time estimates").
// No call tree sets outcome minutes today, so this holds the rule with a choice built here.
import { describe, expect, it } from 'vitest';
import { durationPreview } from './operation-selectors';
import type { ActionDefinition, OutcomeEffect } from './scenario-types';
import type { OperationRun } from './types';
import type { Evaluation } from './resolution';

const run = { knowledge: {}, flags: [], pressure: 0 } as unknown as OperationRun;
const ev = (over: Partial<Evaluation> = {}) => ({ timeBase: 4, timeExpected: 4.6, pFavorable: 0.6, pAdverse: 0.2, ...over }) as Evaluation;
const action = (outcomes: Partial<Record<'favorable' | 'mixed' | 'adverse', Partial<OutcomeEffect>[]>>) =>
  ({ id: 'probe', outcomes: { favorable: [], mixed: [], adverse: [], ...outcomes } }) as unknown as ActionDefinition;

describe('durationPreview', () => {
  it('counts a known delay in the estimate, not only in the range', () => {
    const plain = durationPreview(action({}), ev(), run);
    const delayed = durationPreview(action({ favorable: [{ extraMinutes: 6 }], mixed: [{ extraMinutes: 6 }], adverse: [{ extraMinutes: 6 }] }), ev(), run);
    expect(delayed.timeRange.min).toBe(plain.timeRange.min + 6);
    expect(delayed.timeCost).toBeGreaterThanOrEqual(plain.timeCost + 5);
  });

  it('keeps the estimate inside the range it is shown with', () => {
    for (const extra of [0, 3, 12]) for (const pFavorable of [0.05, 0.5, 0.95]) {
      const { timeCost, timeRange } = durationPreview(action({ adverse: [{ extraMinutes: extra }] }), ev({ pFavorable, pAdverse: (1 - pFavorable) / 2 }), run);
      expect(timeCost, `extra ${extra}, favorable ${pFavorable}`).toBeGreaterThanOrEqual(timeRange.min);
      expect(timeCost, `extra ${extra}, favorable ${pFavorable}`).toBeLessThanOrEqual(timeRange.max);
    }
  });

  it('widens the range for a hidden branch\'s delay but never plans on it', () => {
    const plain = durationPreview(action({}), ev(), run);
    const hidden = durationPreview(action({ adverse: [{ extraMinutes: 10, truth: [{ fact: 'f', is: true }] } as unknown as Partial<OutcomeEffect>] }), ev(), run);
    expect(hidden.timeRange.max).toBe(plain.timeRange.max + 10);
    expect(hidden.timeCost).toBe(plain.timeCost);
  });
});
