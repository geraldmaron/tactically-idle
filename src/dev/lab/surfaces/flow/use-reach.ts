// Runs the population's reach job for Flow and Outcomes (spec 3.3, 3.4 "States"): paints at once
// from the pool's cache, streams partial tallies while it runs, keeps the last complete chunk on
// Stop, and cancels when the population, the call or the tuning patch changes. Both surfaces ask
// for the same job, so the pool runs it once and caches it for the other.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLab } from '../../context';
import { isJobCancelled, jobKey } from '../../jobs/pool';
import type { JobHandle } from '../../jobs/pool';
import type { LabJob } from '../../jobs/protocol';
import type { ReachTally } from '../../jobs/tally';
import type { Session } from '../../model/session';
import { countedText, populationOf, populationText, reachPlan, whoOf } from './reach';
import type { Population } from './reach';

export interface ReachState {
  pop: Population; job: LabJob | null; reason: string | null;
  status: 'idle' | 'running' | 'done' | 'stopped' | 'error';
  tally: ReachTally | null; done: number; total: number; ms: number | null; fromCache: boolean; error: string | null;
  /** What the numbers are: provenance for ProbValue (its runs are the runs counted so far), the
   * plain form and the header line (both the runs asked for). */
  text: ReturnType<typeof populationText>; pending: boolean;
  run(): void; stop(): void;
}

export function useReach(session: Session | null): ReachState {
  const { url, jobs, tuning } = useLab();
  const pop = populationOf(url);
  const plan = useMemo(() => (session ? reachPlan(url, session, pop) : null), [session, url.call?.kit, url.squad, url.certs.join(','), pop.scope, pop.style, pop.runs, session && pop.scope === 'step' ? url.path : '']);
  const job = plan && 'job' in plan ? plan.job : null;
  const contentKey = plan && 'job' in plan ? plan.contentKey : '';
  // A state start hashes a whole engine state, so the key is worked out once per plan, not per render.
  const key = useMemo(() => (job ? jobKey(job, { patch: tuning.patch, contentKey }) : ''), [job, tuning.patch, contentKey]);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<Pick<ReachState, 'status' | 'tally' | 'done' | 'total' | 'ms' | 'fromCache' | 'error'>>(
    { status: 'idle', tally: null, done: 0, total: 0, ms: null, fromCache: false, error: null });
  const handle = useRef<JobHandle | null>(null);

  useEffect(() => {
    if (!job) { setState({ status: 'idle', tally: null, done: 0, total: 0, ms: null, fromCache: false, error: null }); return; }
    const opts = { patch: tuning.patch, contentKey };
    const hit = nonce === 0 ? jobs.cached?.(job, opts) : null;
    if (hit && hit.result.kind === 'reach') {
      setState({ status: 'done', tally: hit.result.tally, done: hit.result.tally.runs, total: hit.result.tally.runs, ms: null, fromCache: true, error: null });
      return;
    }
    const total = job.kind === 'reach-call' ? job.runs[1] - job.runs[0] : job.kind === 'reach-type' ? job.calls : 0;
    setState({ status: 'running', tally: null, done: 0, total, ms: null, fromCache: false, error: null });
    const started = performance.now();
    let live = true;
    const h = jobs.run(job, { ...opts, onProgress: (done, all, partial) => {
      if (!live) return;
      setState(prev => prev.status === 'running' ? { ...prev, done, total: all || prev.total, tally: partial ?? prev.tally } : prev);
    } });
    handle.current = h;
    h.promise.then(result => {
      if (!live) return;
      if (result.kind !== 'reach') { setState(prev => ({ ...prev, status: 'error', error: `The job returned ${result.kind}, not runs.` })); return; }
      setState({ status: 'done', tally: result.tally, done: result.tally.runs, total: result.tally.runs, ms: Math.round(performance.now() - started), fromCache: false, error: null });
    }, error => {
      if (!live || isJobCancelled(error)) return;
      setState(prev => ({ ...prev, status: 'error', error: error instanceof Error ? error.message : String(error) }));
    });
    return () => { live = false; h.cancel(); if (handle.current === h) handle.current = null; };
  }, [key, nonce]);

  const asked = session ? populationText(pop, whoOf(session, pop.scope), url.call?.tier ?? 2) : populationText(pop, '', url.call?.tier ?? 2);
  const text = countedText(asked, state.tally);
  return {
    pop, job, reason: plan && 'reason' in plan ? plan.reason : null, ...state, text, pending: Object.keys(tuning.patch).length > 0,
    run: () => setNonce(n => n + 1),
    stop: () => { handle.current?.cancel(); handle.current = null; setState(prev => (prev.status === 'running' ? { ...prev, status: 'stopped' } : prev)); },
  };
}
