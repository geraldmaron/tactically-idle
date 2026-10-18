// One worker job for a panel: paints from the pool's cache when it can, otherwise runs once per key
// with progress, and cancels on unmount or when the key changes. Outcomes uses it for the four styles
// of this type and for the explorer's shortest paths.
import { useEffect, useMemo, useState } from 'react';
import { useLab } from '../../context';
import { isJobCancelled, jobKey } from '../../jobs/pool';
import type { JobResult, LabJob } from '../../jobs/protocol';

export interface JobState { status: 'idle' | 'running' | 'done' | 'error'; result: JobResult | null; done: number; total: number; error: string | null; at: number | null }

export function useJob(job: LabJob | null, contentKey: string): JobState {
  const { jobs, tuning } = useLab();
  const patch = tuning.patch;
  const key = useMemo(() => (job ? jobKey(job, { patch, contentKey }) : ''), [job, patch, contentKey]);
  const [state, setState] = useState<JobState>({ status: 'idle', result: null, done: 0, total: 0, error: null, at: null });
  useEffect(() => {
    if (!job) { setState({ status: 'idle', result: null, done: 0, total: 0, error: null, at: null }); return; }
    const hit = jobs.cached?.(job, { patch, contentKey });
    if (hit) { setState({ status: 'done', result: hit.result, done: 1, total: 1, error: null, at: hit.at }); return; }
    let live = true;
    setState({ status: 'running', result: null, done: 0, total: 0, error: null, at: null });
    const handle = jobs.run(job, { patch, contentKey, onProgress: (done, total) => { if (live) setState(prev => ({ ...prev, done, total })); } });
    handle.promise.then(result => { if (live) setState({ status: 'done', result, done: 1, total: 1, error: null, at: Date.now() }); },
      error => { if (live && !isJobCancelled(error)) setState(prev => ({ ...prev, status: 'error', error: error instanceof Error ? error.message : String(error) })); });
    return () => { live = false; handle.cancel(); };
  }, [key]);
  return state;
}
