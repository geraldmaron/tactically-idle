// The CI balance gate as verdicts (spec 3.4 "Gate panel", 3.7 "Impact", section 5 rules 6 and 7):
// each GATE_SUITE check read from the saved and the patched runs of its job. Pass or fail is only
// ever said for this population (tier 2, drawCalls from 1, day-one squads, 60 calls, 40 for best
// odds), and the two sides are paired call by call (same calls, dice and roll seeds), so the delta
// interval comes from per-call differences.
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import { GATE_SUITE, gateJobKey, gateJobs, gateMetric, gatePasses, runMetric, summarize } from '../../../gen/incident/trees-v13/balance';
import type { CallResult, Distribution, GateCheck, GateJob, GateMetric, Policy, Weight } from '../../../gen/incident/trees-v13/balance';
import type { IncidentType } from '../../../sim/scenario-types';
import type { TuningPatch } from '../../../sim/tuning';
import type { JobHandle, JobPool } from '../jobs/pool';
import { pairedRuns } from '../jobs/tally';
import type { ReachTally } from '../jobs/tally';
import { contentKey } from './call';
import { percent } from './label';
import { pairedDelta } from './stats';
import type { PairedDelta } from './stats';

export interface GateRun { job: GateJob; side: 'saved' | 'patch'; results: readonly CallResult[] }
/** `saved` and `patch`: the check's metric on each side (null when that side wasn't run). `pass`
 * judges the tuning in force: the patched side while a patch is pending (null until that side has
 * run, never the saved side standing in for it), else the saved side. `delta`: patch − saved, paired
 * call by call. `text`: the verdict in words; `deltaText`: the delta in words (an addition to 9.3). */
export interface GateVerdict { check: GateCheck; saved: number | null; patch: number | null; pass: boolean | null; delta: PairedDelta | null; text: string;
  deltaText: string | null }

const SUBJECT: Record<Policy, string> = { random: 'the random style', best_odds: 'best odds', patient: 'the patient style', fast: 'the fast style' };
const VERB: Record<GateMetric, string> = {
  clean: 'reaches clean', bad: 'ends unresolved, hurt or dead', harm: 'leaves someone hurt or killed', death: 'leaves someone killed', officerHurt: 'gets an officer hurt',
};
const typeNoun = (type: IncidentType) => (INCIDENT_TEMPLATES[type]?.label ?? type.replace(/_/g, ' ')).toLowerCase();

/** A share as a whole percent, or to a tenth when whole-percent rounding would hide which side of
 * the band it is on (61% failing a 60% cap reads 60.4%). */
function shareText(check: GateCheck, value: number): string {
  const whole = Math.round(value * 100) / 100;
  return gatePasses(check, whole) === gatePasses(check, value) ? percent(value) : `${(value * 100).toFixed(1)}%`;
}
function bandText(check: GateCheck): string {
  if (check.min !== undefined && check.max !== undefined) return `allows ${percent(check.min)} to ${percent(check.max)}`;
  if (check.max !== undefined) return `allows at most ${percent(check.max)}`;
  return `needs at least ${percent(check.min ?? 0)}`;
}
const points = (share: number) => `${share < 0 ? '−' : '+'}${Math.abs(share * 100).toFixed(1)}`;

/** The delta in words: "Δ +3.1 points (+1.0 to +5.2), paired over 60 calls", greyed "within noise"
 * when its interval holds zero. */
export function deltaText(delta: PairedDelta, unit = 'calls'): string {
  const range = Number.isFinite(delta.lo) && Number.isFinite(delta.hi) ? ` (${points(delta.lo)} to ${points(delta.hi)})` : '';
  return `Δ ${points(delta.mean)} points${range}, paired over ${delta.n} ${delta.n === 1 ? unit.replace(/s$/, '') : unit}${delta.withinNoise ? ', within noise' : ''}`;
}

/** One verdict per check of `suite` (GATE_SUITE: 24), in the suite's order. `pending`: whether an
 * unsaved patch is in force. It defaults to whether any run is on the patched side; a caller that
 * knows a patch is pending passes it, since the saved side is cached across patches and may be all
 * there is. */
export function gateVerdicts(runs: readonly GateRun[], suite: readonly GateCheck[] = GATE_SUITE,
  pending: boolean = runs.some(run => run.side === 'patch')): GateVerdict[] {
  const summaries = new Map<readonly CallResult[], Distribution>();
  const summary = (results: readonly CallResult[]) => {
    let d = summaries.get(results);
    if (!d) { d = summarize(results); summaries.set(results, d); }
    return d;
  };
  const find = (check: GateCheck, side: GateRun['side']) => runs.find(run => run.side === side && gateJobKey(run.job) === gateJobKey(check) && run.results.length > 0);
  return suite.map(check => {
    const savedRun = find(check, 'saved'), patchRun = find(check, 'patch');
    const saved = savedRun ? gateMetric(summary(savedRun.results), check.metric) : null;
    const patch = patchRun ? gateMetric(summary(patchRun.results), check.metric) : null;
    const value = pending ? patch : saved;
    const pass = value === null ? null : gatePasses(check, value);
    const delta = savedRun && patchRun && savedRun.results.length === patchRun.results.length
      ? pairedDelta(savedRun.results.map(r => runMetric(r, check.metric)), patchRun.results.map(r => runMetric(r, check.metric))) : null;
    const says = (shown: string) => `${SUBJECT[check.style]} ${VERB[check.metric]} in ${shown} of ${typeNoun(check.type)} calls; the gate ${bandText(check)}.`;
    let text = 'Not run yet.';
    if (value !== null) {
      const shown = pending && saved !== null ? `${shareText(check, value)} (saved ${shareText(check, saved)})` : shareText(check, value);
      text = `${pass ? 'Passes' : 'Fails'}: ${says(shown)}`;
    } else if (saved !== null) {
      const savedPass = gatePasses(check, saved);
      text = `Not run for this change yet. Saved tuning ${savedPass ? 'passes' : 'fails'}: ${says(shareText(check, saved))}`;
    }
    return { check, saved, patch, pass, delta, text, deltaText: delta ? deltaText(delta) : null };
  });
}

/** Paired delta of a run-class share between two this-call tallies (the quick tier): runs with the
 * same k on both sides, `metric` as the gate defines it (officerHurt isn't in a run's class). */
export function tallyDelta(saved: ReachTally, patch: ReachTally, metric: Exclude<GateMetric, 'officerHurt'>): PairedDelta {
  const hit = (weight: Weight) => runMetric({ weight, ending: '', minutes: 0, officersHurt: 0, peopleHurt: 0, deaths: 0, decisions: 0 }, metric) === 1;
  const pairs = pairedRuns(saved, patch, hit);
  return pairedDelta(pairs.before, pairs.after);
}

export interface GateOptions { patch: TuningPatch; suite?: readonly GateCheck[]; keyOf?: (type: IncidentType) => string }
export interface GateProgress { done: number; total: number; jobs: { job: GateJob; side: GateRun['side']; done: number; total: number }[] }

const sidesOf = (patch: TuningPatch): GateRun['side'][] => Object.keys(patch).length ? ['saved', 'patch'] : ['saved'];

/** Runs the suite's jobs on the saved side and, with a non-empty patch, the patched side, through
 * the pool (each job keyed by its own call type's content key). The saved side of a job is cached
 * across patches. */
export function runGateSuite(pool: JobPool, opts: GateOptions & { onProgress?: (p: GateProgress) => void }): { promise: Promise<GateRun[]>; cancel(): void } {
  const keyOf = opts.keyOf ?? contentKey;
  const entries = gateJobs(opts.suite).flatMap(job => sidesOf(opts.patch).map(side => ({ job, side, done: 0, total: job.calls })));
  const report = () => opts.onProgress?.({ done: entries.reduce((sum, e) => sum + e.done, 0), total: entries.reduce((sum, e) => sum + e.total, 0), jobs: entries.map(e => ({ ...e })) });
  const handles: JobHandle[] = entries.map(entry => pool.run({ kind: 'gate', job: entry.job }, {
    patch: entry.side === 'saved' ? {} : opts.patch, contentKey: keyOf(entry.job.type),
    onProgress: (done, total) => { entry.done = done; entry.total = total; report(); },
  }));
  const promise = Promise.all(handles.map((handle, i) => handle.promise.then(result => {
    if (result.kind !== 'gate') throw new Error(`A gate job returned ${result.kind}.`);
    entries[i].done = entries[i].total;
    report();
    return { job: entries[i].job, side: entries[i].side, results: result.results };
  })));
  promise.catch(() => {});
  return { promise, cancel: () => handles.forEach(handle => handle.cancel()) };
}

/** What the cache already holds for the suite, without running anything, and the oldest `at` among
 * them (for "from cache, n min ago"). */
export function cachedGateRuns(pool: JobPool, opts: GateOptions): { runs: GateRun[]; at: number | null } {
  const keyOf = opts.keyOf ?? contentKey;
  const runs: GateRun[] = [];
  let at: number | null = null;
  for (const job of gateJobs(opts.suite)) for (const side of sidesOf(opts.patch)) {
    const hit = pool.cached?.({ kind: 'gate', job }, { patch: side === 'saved' ? {} : opts.patch, contentKey: keyOf(job.type) });
    if (!hit || hit.result.kind !== 'gate') continue;
    runs.push({ job, side, results: hit.result.results });
    at = at === null ? hit.at : Math.min(at, hit.at);
  }
  return { runs, at };
}
