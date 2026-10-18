// A pool of lab workers with an in-memory LRU and de-duplicated in-flight jobs (spec 9.5).
//
// - Size min(4, max(1, hardwareConcurrency − 1)); workers start on the first job, not on load.
// - Routing: a `reach-call` splits into contiguous run ranges of at least MIN_SPLIT runs, one per
//   worker, each to the least busy worker, merged with mergeTally (runs are indexed by k, so the
//   totals don't depend on the pool size). `gate` and `reach-type` go to the worker bound to their
//   call type, which keeps its scenarios and drawn calls warm. Everything else goes to the least
//   busy worker. A worker serves one job at a time; the rest wait in its queue.
// - Cache: results keyed by jobKey (the job, the content key, and the tuning hash of saved plus
//   patch). 64 in memory; `gate` and `reach-type` also in sessionStorage (about 2 MB, oldest
//   evicted) so a reload paints from cache. The saved side of a paired run has an empty patch, so it
//   is the same key, and the same cached result, under every patch. A result is shared by every
//   caller that asked for it and by the cache, so treat it as read-only.
// - When a call type's content key changes (an edit reached the page), the workers are replaced:
//   a worker keeps the modules it loaded, so it would keep playing the old call.
import { tuningHash, withTuning } from '../../../sim/tuning';
import type { TuningPatch } from '../../../sim/tuning';
import type { JobCancel, JobEvent, JobRequest, JobResult, LabJob } from './protocol';
import { mergeTally } from './tally';
import type { ReachTally } from './tally';

export interface RunOptions { patch: TuningPatch; contentKey: string; onProgress?: (done: number, total: number, partial?: ReachTally) => void;
  cache?: 'memory' | 'session' | 'none' }
export interface JobHandle { id: string; promise: Promise<JobResult>; cancel(): void }
/** A finished result and when it was computed (`Date.now()`). */
export interface CachedResult { result: JobResult; at: number; from: 'memory' | 'session' }
/** `cached` (an addition to spec 9.3) reads a finished result without running anything: the Calls
 * page and the call strip paint from it ("from cache, n min ago"). `stored` counts the results the
 * cache has taken, and `watch` calls back after each, so a reader of `cached` can read again when a
 * job another surface started finishes (usePoolStored in use-pool.ts). */
export interface JobPool { size: number; run(job: LabJob, opts: RunOptions): JobHandle; active(): number; dispose(): void;
  cached?(job: LabJob, opts: Pick<RunOptions, 'patch' | 'contentKey' | 'cache'>): CachedResult | null;
  stored?(): number; watch?(listener: () => void): () => void }

/** How the pool talks to one worker: the browser's Worker, or an in-process host in tests. */
export interface WorkerPort {
  post(message: JobRequest | JobCancel): void;
  listen(onEvent: (event: JobEvent) => void, onCrash: (message: string) => void): void;
  terminate(): void;
}

/** A handle's promise rejects with this when it is cancelled. */
export class JobCancelled extends Error {
  constructor() { super('cancelled'); this.name = 'JobCancelled'; }
}
export const isJobCancelled = (error: unknown): boolean => error instanceof JobCancelled;

/** A reach-call is split into ranges of at least this many runs. */
export const MIN_SPLIT = 50;
export const MEMORY_ENTRIES = 64;
/** sessionStorage budget in characters (UTF-16, so about 2 MB). */
export const SESSION_CHARS = 1_000_000;
const STORE_PREFIX = 'ti-lab-job:';
const STORE_INDEX = 'ti-lab-job-index';

type CacheMode = NonNullable<RunOptions['cache']>;
const MODE_RANK: Record<CacheMode, number> = { none: 0, memory: 1, session: 2 };
/** Gate and this-type results outlive a reload; a bench is always measured afresh. */
const defaultMode = (job: LabJob): CacheMode => job.kind === 'gate' || job.kind === 'reach-type' ? 'session' : job.kind === 'bench' ? 'none' : 'memory';

/** Spec 9.5: min(4, max(1, hardwareConcurrency − 1)). */
export function defaultPoolSize(): number {
  const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 2;
  return Math.min(4, Math.max(1, cores - 1));
}

function browserWorker(): WorkerPort {
  const worker = new Worker(new URL('../lab.worker.ts', import.meta.url), { type: 'module' });
  return {
    post: message => worker.postMessage(message),
    listen(onEvent, onCrash) {
      worker.onmessage = (event: MessageEvent<JobEvent>) => onEvent(event.data);
      worker.onerror = event => { event.preventDefault(); onCrash(event.message || 'The lab worker failed to load.'); };
      worker.onmessageerror = () => onCrash('A message from the lab worker could not be read.');
    },
    terminate: () => worker.terminate(),
  };
}

// ---------------------------------------------------------------- keys

/** Plain data with sorted keys, so equal jobs serialize the same. */
function canonical(value: unknown): string {
  const sort = (item: unknown): unknown => Array.isArray(item) ? item.map(sort)
    : item !== null && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort((item as Record<string, unknown>)[key])])) : item;
  return JSON.stringify(sort(value)) ?? '';
}
/** 64 bits of FNV-1a (two 32-bit passes with different offsets), as 16 hex digits. */
function digest(text: string): string {
  let a = 0x811c9dc5, b = 0x050c5d1f;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

const PATCH_HASH = new WeakMap<TuningPatch, string>();
/** tuningHash of the saved overrides with this patch laid over them (the registry's own hash). */
function patchHash(patch: TuningPatch): string {
  if (!Object.keys(patch).length) return tuningHash('saved');
  let hash = PATCH_HASH.get(patch);
  if (!hash) { hash = withTuning(patch, () => tuningHash('current')); PATCH_HASH.set(patch, hash); }
  return hash;
}

/** The cache key: the job, the content key, and the tuning hash of saved plus patch. */
export function jobKey(job: LabJob, opts: Pick<RunOptions, 'patch' | 'contentKey'>): string {
  return `${job.kind}:${digest(canonical(job))}|${opts.contentKey}|${patchHash(opts.patch)}`;
}

// ---------------------------------------------------------------- sessionStorage

interface IndexEntry { key: string; size: number; at: number }
function store(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}
function readIndex(s: Storage): IndexEntry[] {
  try {
    const list: unknown = JSON.parse(s.getItem(STORE_INDEX) ?? '[]');
    return Array.isArray(list) ? list.filter((e): e is IndexEntry => !!e && typeof e.key === 'string' && typeof e.size === 'number' && typeof e.at === 'number') : [];
  } catch { return []; }
}
function sessionGet(key: string): CachedResult | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(STORE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { at?: unknown; result?: { kind?: unknown } };
    if (typeof entry.at !== 'number' || !entry.result || typeof entry.result.kind !== 'string') return null;
    return { result: entry.result as JobResult, at: entry.at, from: 'session' };
  } catch { return null; }
}
function sessionPut(key: string, result: JobResult, at: number): void {
  const s = store();
  if (!s) return;
  try {
    const text = JSON.stringify({ at, result });
    if (text.length > SESSION_CHARS) return;
    const index = readIndex(s).filter(entry => entry.key !== key).sort((x, y) => x.at - y.at);
    let used = index.reduce((sum, entry) => sum + entry.size, 0);
    while (index.length && used + text.length > SESSION_CHARS) {
      const old = index.shift()!;
      s.removeItem(STORE_PREFIX + old.key);
      used -= old.size;
    }
    s.setItem(STORE_PREFIX + key, text);
    index.push({ key, size: text.length, at });
    s.setItem(STORE_INDEX, JSON.stringify(index));
  } catch { /* storage full or blocked: memory only */ }
}

// ---------------------------------------------------------------- the pool

interface Sub { resolve(result: JobResult): void; reject(error: unknown): void; onProgress?: RunOptions['onProgress'] }
interface Task { key: string; job: LabJob; contentKey: string; mode: CacheMode; parts: Part[]; subs: Set<Sub>; settled: boolean }
interface Part { id: string; task: Task; request: JobRequest; slot: Slot | null; done: number; total: number; partial?: ReachTally; result?: JobResult }
interface Slot { index: number; port: WorkerPort | null; running: Part | null; queue: Part[]; retire: boolean }

const typeOf = (job: LabJob): string | null => job.kind === 'gate' ? job.job.type : job.kind === 'reach-type' ? job.type : null;
const contentType = (key: string): string | null => { const type = key.split(':')[0]; return type && type !== 'none' && type !== 'unkeyed' && type !== key ? type : null; };

/** The lab's worker pool. `spawn` makes one worker (tests pass an in-process host). In a browser
 * without workers the pool still answers: every job fails with a plain message. */
export function createPool(size: number = defaultPoolSize(), spawn?: () => WorkerPort): JobPool {
  if (!spawn && typeof Worker === 'undefined') {
    return {
      size: 0, active: () => 0, dispose: () => {}, cached: () => null,
      run: () => { const promise = Promise.reject(new Error("This browser can't run Web Workers, so the lab can't run simulations.")); promise.catch(() => {}); return { id: 'unavailable', promise, cancel: () => {} }; },
    };
  }
  const makePort = spawn ?? browserWorker;
  const slots: Slot[] = Array.from({ length: Math.max(1, Math.floor(size)) }, (_, index) => ({ index, port: null, running: null, queue: [], retire: false }));
  const inflight = new Map<string, Task>();
  const memory = new Map<string, CachedResult>();
  const affinity = new Map<string, Slot>();
  const contentKeys = new Map<string, string>();
  const watchers = new Set<() => void>();
  let seq = 0, disposed = false, stored = 0;

  const load = (slot: Slot) => (slot.running ? 1 : 0) + slot.queue.length;
  const leastBusy = (among: readonly Slot[] = slots) => among.reduce((best, slot) => load(slot) < load(best) ? slot : best);

  function remember(key: string, entry: CachedResult) {
    memory.delete(key);
    memory.set(key, entry);
    while (memory.size > MEMORY_ENTRIES) memory.delete(memory.keys().next().value!);
  }
  function lookup(key: string, mode: CacheMode): CachedResult | null {
    if (mode === 'none') return null;
    const hit = memory.get(key);
    if (hit) { remember(key, hit); return hit; }
    if (mode !== 'session') return null;
    const stored = sessionGet(key);
    if (stored) remember(key, { ...stored, from: 'memory' });
    return stored;
  }

  function portOf(slot: Slot): WorkerPort {
    if (slot.port) return slot.port;
    const port = makePort();
    slot.port = port;
    port.listen(event => { if (slot.port === port) onEvent(slot, event); }, message => { if (slot.port === port) onCrash(slot, message); });
    return port;
  }
  function replacePort(slot: Slot) {
    slot.port?.terminate();
    slot.port = null;
    slot.retire = false;
    for (const [type, bound] of affinity) if (bound === slot) affinity.delete(type);
  }
  function pump(slot: Slot) {
    if (disposed || slot.running) return;
    if (slot.retire) replacePort(slot);
    const part = slot.queue.shift();
    if (!part) return;
    slot.running = part;
    portOf(slot).post(part.request);
  }
  function enqueue(part: Part, slot: Slot) {
    part.slot = slot;
    slot.queue.push(part);
    pump(slot);
  }

  function progress(task: Task) {
    if (task.settled) return;
    const done = task.parts.reduce((sum, part) => sum + part.done, 0);
    const total = task.parts.reduce((sum, part) => sum + part.total, 0);
    const partials = task.parts.flatMap(part => part.partial ? [part.partial] : []);
    const partial = partials.length > 1 ? partials.reduce(mergeTally) : partials[0];
    for (const sub of task.subs) sub.onProgress?.(done, total, partial);
  }
  function settle(task: Task, outcome: { result: JobResult } | { error: unknown }) {
    if (task.settled) return;
    task.settled = true;
    if (inflight.get(task.key) === task) inflight.delete(task.key);
    if ('result' in outcome) {
      const at = Date.now();
      if (task.mode !== 'none') remember(task.key, { result: outcome.result, at, from: 'memory' });
      if (task.mode === 'session') sessionPut(task.key, outcome.result, at);
      for (const sub of task.subs) sub.resolve(outcome.result);
      if (task.mode !== 'none') { stored++; for (const watcher of [...watchers]) watcher(); }
    } else {
      stopParts(task);
      for (const sub of task.subs) sub.reject(outcome.error);
    }
    task.subs.clear();
  }
  /** Drop a task's queued parts and ask its running parts to stop; a worker stays busy until it answers. */
  function stopParts(task: Task) {
    for (const part of task.parts) {
      if (part.result || !part.slot) continue;
      const slot = part.slot;
      if (slot.running === part) slot.port?.post({ id: part.id, cancel: true });
      else slot.queue = slot.queue.filter(entry => entry !== part);
    }
  }
  function finishPart(part: Part, result: JobResult) {
    const task = part.task;
    part.result = result;
    if (result.kind === 'reach') { part.partial = result.tally; part.done = part.total = result.tally.runs; }
    if (task.settled || task.parts.some(entry => !entry.result)) { progress(task); return; }
    if (task.parts.length === 1) { settle(task, { result }); return; }
    const tallies = task.parts.map(entry => entry.result!.kind === 'reach' ? (entry.result as { tally: ReachTally }).tally : null);
    if (tallies.some(tally => !tally)) { settle(task, { error: new Error('A split job returned something other than a tally.') }); return; }
    settle(task, { result: { kind: 'reach', tally: (tallies as ReachTally[]).reduce(mergeTally) } });
  }
  function onEvent(slot: Slot, event: JobEvent) {
    const part = slot.running;
    if (!part || part.id !== event.id) return;
    if (event.type === 'progress') {
      part.done = event.done;
      part.total = event.total;
      if (event.partial) part.partial = event.partial;
      progress(part.task);
      return;
    }
    slot.running = null;
    if (event.type === 'result') finishPart(part, event.result);
    else settle(part.task, { error: new Error(event.message) });
    pump(slot);
  }
  function onCrash(slot: Slot, message: string) {
    const part = slot.running;
    slot.running = null;
    replacePort(slot);
    if (part) settle(part.task, { error: new Error(`The lab worker stopped: ${message}`) });
    pump(slot);
  }

  /** A content edit reached the page: replace every worker (idle now, busy ones after their job),
   * and don't cache what still runs on the old content. */
  function contentChanged(oldKey: string) {
    for (const task of inflight.values()) if (task.contentKey === oldKey) task.mode = 'none';
    for (const slot of slots) { if (slot.running) slot.retire = true; else if (slot.port) replacePort(slot); }
    affinity.clear();
  }

  function schedule(task: Task, opts: RunOptions) {
    const request = (job: LabJob, index: number): JobRequest => ({ id: `${job.kind}-${++seq}.${index}`, job, patch: opts.patch, contentKey: opts.contentKey });
    const job = task.job;
    if (job.kind === 'reach-call') {
      const [from, to] = job.runs;
      const n = Math.max(0, to - from);
      const count = Math.max(1, Math.min(slots.length, Math.floor(n / MIN_SPLIT)));
      let start = from;
      for (let i = 0; i < count; i++) {
        const runs = Math.floor(n / count) + (i < n % count ? 1 : 0);
        const part: Part = { id: '', task, request: request({ ...job, runs: [start, start + runs] }, i), slot: null, done: 0, total: runs };
        part.id = part.request.id;
        task.parts.push(part);
        start += runs;
      }
      for (const part of task.parts) enqueue(part, leastBusy());
      return;
    }
    const part: Part = { id: '', task, request: request(job, 0), slot: null, done: 0, total: 0 };
    part.id = part.request.id;
    task.parts.push(part);
    const type = typeOf(job);
    if (!type) { enqueue(part, leastBusy()); return; }
    let slot = affinity.get(type);
    if (!slot) {
      // Spread the call types over the workers: an unbound worker first.
      const bound = new Set(affinity.values());
      const free = slots.filter(entry => !bound.has(entry));
      slot = leastBusy(free.length ? free : slots);
      affinity.set(type, slot);
    }
    enqueue(part, slot);
  }

  function run(job: LabJob, opts: RunOptions): JobHandle {
    const id = `job-${++seq}`;
    if (disposed) {
      const promise = Promise.reject(new Error('The lab worker pool was closed.'));
      promise.catch(() => {});
      return { id, promise, cancel: () => {} };
    }
    const mode = opts.cache ?? defaultMode(job);
    const key = jobKey(job, opts);
    const hit = lookup(key, mode);
    if (hit) return { id, promise: Promise.resolve(hit.result), cancel: () => {} };
    const type = contentType(opts.contentKey);
    if (type) {
      const seen = contentKeys.get(type);
      if (seen !== undefined && seen !== opts.contentKey) contentChanged(seen);
      contentKeys.set(type, opts.contentKey);
    }
    let task = inflight.get(key);
    const fresh = !task;
    if (!task) {
      task = { key, job, contentKey: opts.contentKey, mode, parts: [], subs: new Set(), settled: false };
      inflight.set(key, task);
    } else if (MODE_RANK[mode] > MODE_RANK[task.mode]) task.mode = mode;
    const owner = task;
    let sub!: Sub;
    const promise = new Promise<JobResult>((resolve, reject) => { sub = { resolve, reject, onProgress: opts.onProgress }; });
    promise.catch(() => {});
    owner.subs.add(sub);
    if (fresh) schedule(owner, opts);
    return {
      id, promise,
      cancel: () => {
        if (!owner.subs.delete(sub)) return;
        sub.reject(new JobCancelled());
        if (!owner.subs.size && !owner.settled) {
          owner.settled = true;
          if (inflight.get(owner.key) === owner) inflight.delete(owner.key);
          stopParts(owner);
        }
      },
    };
  }

  return {
    size: slots.length,
    run,
    active: () => inflight.size,
    cached: (job, opts) => lookup(jobKey(job, opts), opts.cache ?? defaultMode(job)),
    stored: () => stored,
    watch: listener => { watchers.add(listener); return () => { watchers.delete(listener); }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const task of [...inflight.values()]) settle(task, { error: new Error('The lab worker pool was closed.') });
      for (const slot of slots) { slot.port?.terminate(); slot.port = null; slot.queue = []; slot.running = null; }
    },
  };
}

// ---------------------------------------------------------------- paired runs

export interface PairedHandle { saved: JobHandle; patch: JobHandle; promise: Promise<{ saved: JobResult; patch: JobResult }>; cancel(): void }
export type PairedOptions = Omit<RunOptions, 'onProgress'> & { onProgress?: (side: 'saved' | 'patch', done: number, total: number, partial?: ReachTally) => void };

/** The same job on the saved tuning and under the patch (spec 5, rule 6): the same calls, dice and
 * roll seeds, so the two results pair run by run (runWeights for a tally, results for a gate). With
 * an empty patch both sides are one job. */
export function runPaired(pool: JobPool, job: LabJob, opts: PairedOptions): PairedHandle {
  const { onProgress, ...rest } = opts;
  const side = (name: 'saved' | 'patch') => onProgress && ((done: number, total: number, partial?: ReachTally) => onProgress(name, done, total, partial));
  const saved = pool.run(job, { ...rest, patch: {}, onProgress: side('saved') });
  const patch = pool.run(job, { ...rest, onProgress: side('patch') });
  const promise = Promise.all([saved.promise, patch.promise]).then(([s, p]) => ({ saved: s, patch: p }));
  promise.catch(() => {});
  return { saved, patch, promise, cancel: () => { saved.cancel(); patch.cancel(); } };
}
