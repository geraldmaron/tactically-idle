// Gate verdicts from fixture runs: one per GATE_SUITE check in its order, pass or fail on the patched
// side when there is one, paired deltas with "within noise", and the verdicts in words. Plus the
// suite runner and the cache reader against a stand-in pool.
import { describe, expect, it } from 'vitest';
import { GATE_SUITE, gateJobKey, gateJobs, gateMetric, summarize } from '../../../gen/incident/trees-v13/balance';
import type { CallResult, GateCheck, GateJob, Weight } from '../../../gen/incident/trees-v13/balance';
import type { JobHandle, JobPool, RunOptions } from '../jobs/pool';
import type { JobResult, LabJob } from '../jobs/protocol';
import { addRun, emptyTally } from '../jobs/tally';
import { cachedGateRuns, deltaText, gateVerdicts, runGateSuite, tallyDelta } from './gate-view';
import type { GateRun } from './gate-view';

/** `n` calls: the given counts of each run class first, the rest clean; the first `officers` calls hurt an officer. */
function calls(n: number, counts: Partial<Record<Weight, number>>, officers = 0): CallResult[] {
  const weights = (Object.entries(counts) as [Weight, number][]).flatMap(([w, k]) => Array<Weight>(k).fill(w));
  return Array.from({ length: n }, (_, i) => ({ weight: weights[i] ?? 'clean', ending: 'e', minutes: 30, officersHurt: i < officers ? 1 : 0, peopleHurt: 0, deaths: 0, decisions: 3 }));
}
/** 30% clean, 30% costly, 20% unresolved, 15% hurt, 5% dead: inside every band of the suite. */
const typical = (job: GateJob) => {
  const n = job.calls;
  return calls(n, { death: Math.round(n * 0.05), hurt: Math.round(n * 0.15), unresolved: Math.round(n * 0.2), costly: Math.round(n * 0.3) }, job.style === 'fast' ? n / 2 : 0);
};
const savedRuns = (): GateRun[] => gateJobs().map(job => ({ job, side: 'saved', results: typical(job) }));
const hostageRandom = gateJobs().find(job => job.type === 'hostage_crisis' && job.style === 'random')!;

describe('gateVerdicts', () => {
  it('gives the 24 checks in suite order; saved runs alone judge the saved side', () => {
    const verdicts = gateVerdicts(savedRuns());
    expect(verdicts).toHaveLength(24);
    expect(verdicts.map(v => v.check.id)).toEqual(GATE_SUITE.map(c => c.id));
    expect(verdicts.every(v => v.pass === true && v.patch === null && v.delta === null && v.deltaText === null)).toBe(true);
    const clean = verdicts.find(v => v.check.id === 'hostage_crisis.random.clean')!;
    expect(clean.saved).toBe(0.3);
    expect(clean.text).toBe('Passes: the random style reaches clean in 30% of hostage crisis calls; the gate allows 15% to 60%.');
    expect(verdicts.find(v => v.check.id === 'hostage_crisis.random.bad')!.text)
      .toBe('Passes: the random style ends unresolved, hurt or dead in 40% of hostage crisis calls; the gate allows 15% to 65%.');
    expect(verdicts.find(v => v.check.id === 'active_armed_incident.fast.officerHurt')!.text)
      .toBe('Passes: the fast style gets an officer hurt in 50% of active armed incident calls; the gate needs at least 25%.');
    expect(verdicts.find(v => v.check.id === 'protected_rescue.best_odds.clean')!.text)
      .toBe('Passes: best odds reaches clean in 30% of protected rescue calls; the gate allows at most 75%.');
  });

  it('judges the patched side, with a paired delta call by call', () => {
    const patch = calls(60, { death: 3, hurt: 9, unresolved: 9 });   // 39 clean: 21 costly or unresolved calls came out clean
    const runs = [...savedRuns(), { job: hostageRandom, side: 'patch' as const, results: patch }];
    const clean = gateVerdicts(runs).find(v => v.check.id === 'hostage_crisis.random.clean')!;
    expect(clean).toMatchObject({ saved: 0.3, patch: 0.65, pass: false });
    expect(clean.text).toBe('Fails: the random style reaches clean in 65% (saved 30%) of hostage crisis calls; the gate allows 15% to 60%.');
    expect(clean.delta!.mean).toBeCloseTo(0.35, 10);
    expect(clean.delta!.withinNoise).toBe(false);
    expect(clean.deltaText).toMatch(/^Δ \+35\.0 points \(\+\d+\.\d to \+\d+\.\d\), paired over 60 calls$/);
    // Death didn't change on any call: a zero delta is within noise.
    const death = gateVerdicts(runs).find(v => v.check.id === 'hostage_crisis.random.death')!;
    expect(death.delta).toMatchObject({ mean: 0, withinNoise: true });
    expect(death.deltaText).toBe('Δ +0.0 points (+0.0 to +0.0), paired over 60 calls, within noise');
    // Checks of other jobs have no patched side yet, so no verdict for the patch either.
    expect(gateVerdicts(runs).find(v => v.check.id === 'barricaded.random.clean')).toMatchObject({ patch: null, pass: null });
  });

  it('gives no verdict for a pending patch until its side runs; the cached saved side never stands in (review finding gate-pending-verdict-from-saved)', () => {
    // A failing saved side: the patched tuning may differ, so neither pass nor fail is claimed for it.
    const runs = savedRuns().map(run => gateJobKey(run.job) === gateJobKey(hostageRandom) ? { ...run, results: calls(60, { costly: 10 }) } : run);
    const pending = gateVerdicts(runs, undefined, true);
    expect(pending.every(v => v.pass === null && v.patch === null && v.saved !== null)).toBe(true);
    const clean = pending.find(v => v.check.id === 'hostage_crisis.random.clean')!;
    expect(clean.saved).toBe(0.833);
    expect(clean.text).toBe('Not run for this change yet. Saved tuning fails: the random style reaches clean in 83% of hostage crisis calls; the gate allows 15% to 60%.');
    expect(pending.find(v => v.check.id === 'barricaded.random.clean')!.text).toMatch(/^Not run for this change yet\. Saved tuning passes: /);
    // Without a patch the same runs are the verdict.
    expect(gateVerdicts(runs, undefined, false).find(v => v.check.id === 'hostage_crisis.random.clean')!.pass).toBe(false);
    expect(gateVerdicts(runs).find(v => v.check.id === 'hostage_crisis.random.clean')!.pass).toBe(false);
    // Once one job's patched side has run, that check is judged on it and the others still wait.
    const withPatch = [...runs, { job: hostageRandom, side: 'patch' as const, results: calls(60, { costly: 30 }) }];
    const after = gateVerdicts(withPatch, undefined, true);
    expect(after.find(v => v.check.id === 'hostage_crisis.random.clean')).toMatchObject({ patch: 0.5, pass: true });
    expect(after.find(v => v.check.id === 'barricaded.random.clean')!.pass).toBeNull();
    expect(gateVerdicts(withPatch).map(v => v.pass)).toEqual(after.map(v => v.pass));
  });

  it('says a check has not run, and shows a tenth when whole percents would hide a fail', () => {
    expect(gateVerdicts([]).every(v => v.pass === null && v.text === 'Not run yet.')).toBe(true);
    const check: GateCheck = { id: 'x', label: 'Clean endings', type: 'barricaded', style: 'random', calls: 500, tier: 2, metric: 'clean', max: 0.6, why: '' };
    const job: GateJob = { type: 'barricaded', style: 'random', calls: 500, tier: 2 };
    const [verdict] = gateVerdicts([{ job, side: 'saved', results: calls(500, { costly: 198 }) }], [check]);
    expect(verdict.saved).toBe(0.604);
    expect(verdict.text).toBe('Fails: the random style reaches clean in 60.4% of protective response calls; the gate allows at most 60%.');
  });

  it('reads the gate metric from the rounded shares, as CI does', () => {
    const runs = savedRuns();
    const d = summarize(runs[0].results);
    expect(gateVerdicts(runs)[1].saved).toBe(gateMetric(d, 'bad'));
    expect(gateVerdicts(runs)[1].saved).toBe(d.weights.unresolved + (d.weights.hurt + d.weights.death));
  });
});

describe('tallyDelta and deltaText', () => {
  it('pairs this-call runs by run index', () => {
    const result = (weight: Weight): CallResult => ({ weight, ending: 'e', minutes: 1, officersHurt: 0, peopleHurt: 0, deaths: 0, decisions: 1 });
    const saved = emptyTally(), patch = emptyTally();
    (['clean', 'hurt', 'clean', 'death'] as Weight[]).forEach((w, k) => addRun(saved, [], result(w), k));
    (['clean', 'clean', 'clean', 'hurt'] as Weight[]).forEach((w, k) => addRun(patch, [], result(w), k));
    expect(tallyDelta(saved, patch, 'clean')).toMatchObject({ mean: 0.25, n: 4 });
    expect(tallyDelta(saved, patch, 'harm')).toMatchObject({ mean: -0.25, n: 4 });
    expect(tallyDelta(saved, patch, 'death').mean).toBe(-0.25);
  });
  it('writes an unbounded interval without numbers', () => {
    expect(deltaText({ mean: 0, lo: -Infinity, hi: Infinity, n: 1, withinNoise: true })).toBe('Δ +0.0 points, paired over 1 call, within noise');
    expect(deltaText({ mean: -0.031, lo: -0.061, hi: -0.001, n: 200, withinNoise: false }, 'runs')).toBe('Δ −3.1 points (−6.1 to −0.1), paired over 200 runs');
  });
});

/** A pool that answers gate jobs at once with typical runs, and remembers what it was asked. */
function standIn(cachedAt: number | null = null) {
  const asked: { job: GateJob; opts: RunOptions }[] = [];
  const answer = (job: LabJob): JobResult => {
    if (job.kind !== 'gate') throw new Error(job.kind);
    const results = typical(job.job);
    return { kind: 'gate', results, distribution: summarize(results) };
  };
  const pool: JobPool = {
    size: 1, active: () => 0, dispose: () => {},
    run(job, opts): JobHandle {
      if (job.kind === 'gate') asked.push({ job: job.job, opts });
      opts.onProgress?.(1, 2);
      return { id: 'x', promise: Promise.resolve(answer(job)), cancel: () => {} };
    },
    cached: (job, opts) => cachedAt === null || (job.kind === 'gate' && Object.keys(opts.patch).length) ? null
      : { result: answer(job), at: cachedAt + (job.kind === 'gate' ? job.job.calls : 0), from: 'session' },
  };
  return { pool, asked };
}

describe('runGateSuite and cachedGateRuns', () => {
  it('runs the saved side only without a patch, both sides with one, each keyed by its own type', async () => {
    const { pool, asked } = standIn();
    const progress: number[] = [];
    const saved = await runGateSuite(pool, { patch: {}, keyOf: type => `key:${type}`, onProgress: p => progress.push(p.total) }).promise;
    expect(saved).toHaveLength(11);
    expect(saved.every(run => run.side === 'saved' && run.results.length === run.job.calls)).toBe(true);
    expect(asked.every(a => Object.keys(a.opts.patch).length === 0 && a.opts.contentKey === `key:${a.job.type}`)).toBe(true);
    expect(progress.length).toBeGreaterThan(0);
    const patch = { RESOLUTION_TUNING: { favorableAt: 10 } };
    const both = await runGateSuite(pool, { patch, keyOf: type => `key:${type}` }).promise;
    expect(both).toHaveLength(22);
    expect(asked.slice(11).filter(a => a.opts.patch === patch)).toHaveLength(11);
    expect(gateVerdicts(both).every(v => v.delta?.withinNoise === true)).toBe(true);
    expect(new Set(both.map(run => `${gateJobKey(run.job)}:${run.side}`)).size).toBe(22);
  });

  it('reads what the cache holds, with the oldest time among the hits', () => {
    expect(cachedGateRuns(standIn().pool, { patch: {} })).toEqual({ runs: [], at: null });
    const { runs, at } = cachedGateRuns(standIn(1000).pool, { patch: {}, keyOf: type => type });
    expect(runs).toHaveLength(11);
    expect(at).toBe(1040);
    // The patched side isn't cached here: only the saved runs come back.
    expect(cachedGateRuns(standIn(1000).pool, { patch: { RESOLUTION_TUNING: { favorableAt: 10 } }, keyOf: type => type }).runs).toHaveLength(11);
  });
});
