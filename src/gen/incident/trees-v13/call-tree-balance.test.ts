import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../../../content/call-trees';
import { GATE_SUITE, gateJobKey, gateJobs, gateMetric, measure } from './balance';

// The balance gate (docs/call-trees-v13.md, "Balance"). Its checks live in balance.ts (GATE_SUITE),
// so the Scenario Lab paints the same bands CI holds. Every call is played through the real engine
// with real dice and a different day-one squad each time, at tier 2, under four player styles. The
// dice and squads come from fixed seeds, so these numbers are exact for the content as written: a
// change that makes the game softer or crueler fails here and has to be argued.
//
// The target, per call, for the random style: about a third clean, a third resolved at a cost, the
// rest unresolved, hurt or dead. Someone dies in a few percent of calls, most of them armed
// incidents. Waiting is safe only when it should be, and so is rushing.

describe('call tree balance (tier 2, day-one squads)', () => {
  // One run of calls per job; every check on that job reads it.
  for (const job of gateJobs(GATE_SUITE)) {
    const checks = GATE_SUITE.filter(check => gateJobKey(check) === gateJobKey(job));
    it(`${job.type}, ${job.style} style, ${job.calls} calls: ${[...new Set(checks.map(check => check.why))].join(' ')}`, () => {
      const d = measure(CALL_TREES[job.type]!, job.tier, job.style, job.calls);
      for (const check of checks) {
        const value = gateMetric(d, check.metric);
        if (check.min !== undefined) expect(value, `${check.label.toLowerCase()} (${check.id})`).toBeGreaterThanOrEqual(check.min);
        if (check.max !== undefined) expect(value, `${check.label.toLowerCase()} (${check.id})`).toBeLessThanOrEqual(check.max);
      }
    }, 300000);
  }
});
