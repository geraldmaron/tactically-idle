import { describe, expect, it } from 'vitest';
import type { JobPool, RunOptions } from './jobs/pool';
import type { LabJob } from './jobs/protocol';
import type { ReachTally } from './jobs/tally';
import { contentKey } from './model/call';
import type { Session } from './model/session';
import { parseLabUrl } from './url';
import { createLabDebug, distributionOf } from './debug';

const tally = (over: Partial<ReachTally>): ReachTally => ({
  runs: 0, visits: {}, choices: {}, edges: {}, nodeEdges: {}, endings: {}, weights: { clean: 0, costly: 0, unresolved: 0, hurt: 0, death: 0 },
  keysSet: {}, locked: {}, odds: {}, flatVisits: {}, nodeFate: {}, stuck: 0, minutes: 0, officerHurt: 0, runWeights: [], ...over,
});

describe('distributionOf', () => {
  it('summarizes a tally the way measure() does', () => {
    const t = tally({
      runs: 6,
      weights: { clean: 2, costly: 1, unresolved: 2, hurt: 1, death: 0 },
      endings: {
        everyone_out: { n: 3, weights: { clean: 2, costly: 1, unresolved: 0, hurt: 0, death: 0 } },
        handed_over: { n: 2, weights: { clean: 0, costly: 0, unresolved: 2, hurt: 0, death: 0 } },
        out_hurt: { n: 1, weights: { clean: 0, costly: 0, unresolved: 0, hurt: 1, death: 0 } },
      },
      officerHurt: 1, minutes: 251,
    });
    expect(distributionOf(t)).toEqual({
      calls: 6,
      weights: { death: 0, hurt: 0.167, unresolved: 0.333, costly: 0.167, clean: 0.333 },
      endings: { everyone_out: 0.5, handed_over: 0.333, out_hurt: 0.167 },
      officerHurtRate: 0.167,
      meanMinutes: 42,
    });
  });

  it('an empty tally is all zeros, never NaN', () => {
    const d = distributionOf(tally({}));
    expect(d.calls).toBe(0);
    expect(d.meanMinutes).toBe(0);
    expect(Object.values(d.weights).every(v => v === 0)).toBe(true);
  });
});

describe('__lab.run content keys', () => {
  it('keys a job that names a call type by that type, and other jobs by the open call', async () => {
    const seen: string[] = [];
    const pool: JobPool = {
      size: 1, active: () => 0, dispose() {},
      run(_job: LabJob, opts: RunOptions) { seen.push(opts.contentKey); return { id: 'x', promise: Promise.resolve({ kind: 'bench', ms: {} }), cancel() {} }; },
    };
    const session = { contentKey: 'open-hostage-call' } as Session;
    const lab = createLabDebug(() => ({ url: parseLabUrl('?type=hostage_crisis').url, session, deps: null, pool, patch: {} }));
    await lab.run({ kind: 'reach-type', type: 'barricaded', tier: 2, style: 'random', calls: 6 });
    await lab.run({ kind: 'gate', job: { type: 'protected_rescue', style: 'random', calls: 60, tier: 2 } });
    await lab.run({ kind: 'bench' });
    expect(seen).toEqual([contentKey('barricaded'), contentKey('protected_rescue'), 'open-hostage-call']);
  });
});
