// The CI gate run, shared by Calls and Outcomes and kept across surface switches (spec 3.1, 3.4): what
// the pool's cache already holds for the current tuning, a run in progress with its per-job progress,
// and the finished runs. One store for the page, so starting the gate on Calls and opening Outcomes
// shows the same run filling in.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { gateJobs } from '../../../../gen/incident/trees-v13/balance';
import { useLab } from '../../context';
import { isJobCancelled } from '../../jobs/pool';
import { cachedGateRuns, runGateSuite } from '../../model/gate-view';
import type { GateProgress, GateRun } from '../../model/gate-view';

export interface GateState {
  /** idle: nothing cached; partial: some jobs cached; done: every job on every side. */
  status: 'idle' | 'partial' | 'running' | 'done' | 'error';
  runs: GateRun[]; at: number | null; fromCache: boolean; progress: GateProgress | null; error: string | null;
  /** The tuning hash these runs belong to. */
  key: string;
}

let state: GateState = { status: 'idle', runs: [], at: null, fromCache: false, progress: null, error: null, key: '' };
let running: { cancel(): void } | null = null;
const listeners = new Set<() => void>();
const set = (next: GateState) => { state = next; for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

const sidesOf = (patch: object) => (Object.keys(patch).length ? 2 : 1);

export function useGate(): { gate: GateState; run(): void; cancel(): void; expected: number } {
  const { jobs, tuning } = useLab();
  const gate = useSyncExternalStore(subscribe, () => state, () => state);
  const expected = gateJobs().length * sidesOf(tuning.patch);

  // Paint from the cache for this tuning whenever the tuning changes (never runs anything).
  useEffect(() => {
    if (state.key === tuning.hash && state.status !== 'idle') return;
    if (state.status === 'running') { running?.cancel(); running = null; }
    const cached = cachedGateRuns(jobs, { patch: tuning.patch });
    set({ status: cached.runs.length === 0 ? 'idle' : cached.runs.length >= expected ? 'done' : 'partial', runs: cached.runs, at: cached.at,
      fromCache: true, progress: null, error: null, key: tuning.hash });
  }, [tuning.hash, jobs]);

  const run = useCallback(() => {
    running?.cancel();
    const key = tuning.hash;
    const handle = runGateSuite(jobs, { patch: tuning.patch, onProgress: progress => { if (state.key === key && state.status === 'running') set({ ...state, progress }); } });
    running = handle;
    set({ ...state, status: 'running', progress: null, error: null, key });
    handle.promise.then(runs => {
      if (running !== handle) return;
      running = null;
      set({ status: 'done', runs, at: Date.now(), fromCache: false, progress: null, error: null, key });
    }, error => {
      if (running !== handle) return;
      running = null;
      if (isJobCancelled(error)) return;
      set({ ...state, status: 'error', progress: null, error: error instanceof Error ? error.message : String(error) });
    });
  }, [jobs, tuning.hash, tuning.patch]);

  const cancel = useCallback(() => {
    running?.cancel();
    running = null;
    const cached = cachedGateRuns(jobs, { patch: tuning.patch });
    set({ status: cached.runs.length === 0 ? 'idle' : cached.runs.length >= expected ? 'done' : 'partial', runs: cached.runs, at: cached.at, fromCache: true,
      progress: null, error: null, key: tuning.hash });
  }, [jobs, tuning.hash, tuning.patch, expected]);

  return { gate, run, cancel, expected };
}
