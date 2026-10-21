// The pool, driven through in-process workers (the same host lab.worker.ts runs, with messages
// cloned and delivered on a later tick as a real worker would): splitting a this-call job across
// workers gives the one-worker tally, identical jobs in flight run once, results come from the
// memory and session caches, a cancel stops the work, call types stick to a worker, and a content
// edit replaces the workers.
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { applyTuningPatch, tuningHash } from '../../../sim/tuning';
import { openSession } from '../model/session';
import type { Session } from '../model/session';
import { parseLabUrl } from '../url';
import { createPool, isJobCancelled, jobKey, runPaired } from './pool';
import type { WorkerPort } from './pool';
import type { JobCancel, JobEvent, JobRequest, LabJob, StartRef } from './protocol';
import { createJobHost, runJob } from './runners';

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}
const later = (fn: () => void) => setTimeout(fn, 0);

/** In-process workers, with a log of what each was sent. */
function workers() {
  const ports: { posted: (JobRequest | JobCancel)[]; terminated: boolean }[] = [];
  const spawn = (): WorkerPort => {
    const record = { posted: [] as (JobRequest | JobCancel)[], terminated: false };
    ports.push(record);
    let listener: ((event: JobEvent) => void) | null = null;
    const host = createJobHost(event => later(() => listener?.(structuredClone(event))), 10);
    return {
      post: message => { record.posted.push(message); later(() => { if (!record.terminated) host.receive(structuredClone(message)); }); },
      listen: onEvent => { listener = onEvent; },
      terminate: () => { record.terminated = true; listener = null; },
    };
  };
  const requests = () => ports.flatMap(port => port.posted.filter((m): m is JobRequest => !('cancel' in m)));
  return { ports, spawn, requests };
}

/** A sessionStorage stand-in for Node. */
function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(), key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, String(value)); }, removeItem: key => { data.delete(key); },
  };
}
const globals = globalThis as { sessionStorage?: Storage };
afterEach(() => { delete globals.sessionStorage; });
// The in-process workers share this realm's tuning tables.
afterAll(() => { applyTuningPatch({}); });

const barricade = open('type=hostage_crisis');
const start: StartRef = { kind: 'fresh', scenarioId: barricade.scenario.id, kit: 'day1', squad: { seed: 719, certs: [] } };
const opts = { patch: {}, contentKey: barricade.contentKey };
const reachCall = (runs: [number, number]): LabJob => ({ kind: 'reach-call', start, style: 'random', runs });

describe('createPool', () => {
  it('splits a this-call job into contiguous ranges of at least 50 runs and merges them into the one-worker tally', async () => {
    const w = workers();
    const pool = createPool(3, w.spawn);
    const progress: number[] = [];
    const result = await pool.run(reachCall([0, 120]), { ...opts, onProgress: done => progress.push(done) }).promise;
    expect(w.requests().map(r => r.job.kind === 'reach-call' ? r.job.runs : null)).toEqual([[0, 60], [60, 120]]);
    expect(w.ports).toHaveLength(2);
    expect(result).toEqual(await runJob(reachCall([0, 120]), { shouldStop: () => false, progress: () => {}, yieldEvery: 10 }));
    expect(progress.at(-1)).toBe(120);
    expect(Math.max(...progress)).toBeLessThanOrEqual(120);
    // Under 100 runs there is one range.
    await pool.run(reachCall([0, 99]), opts).promise;
    expect(w.requests().map(r => r.job.kind === 'reach-call' ? r.job.runs : null)).toEqual(expect.arrayContaining([[0, 99]]));
    expect(w.requests()).toHaveLength(3);
    pool.dispose();
  }, 120000);

  it('runs identical jobs in flight once, then answers from memory, with the time it was computed', async () => {
    const w = workers();
    const pool = createPool(2, w.spawn);
    const a = pool.run(reachCall([0, 20]), opts), b = pool.run(reachCall([0, 20]), opts);
    expect(pool.active()).toBe(1);
    const [x, y] = await Promise.all([a.promise, b.promise]);
    expect(x).toEqual(y);
    expect(w.requests()).toHaveLength(1);
    expect(pool.active()).toBe(0);
    expect(await pool.run(reachCall([0, 20]), opts).promise).toEqual(x);
    expect(w.requests()).toHaveLength(1);
    expect(pool.cached!(reachCall([0, 20]), opts)).toMatchObject({ result: x, from: 'memory', at: expect.any(Number) });
    expect(pool.cached!(reachCall([0, 21]), opts)).toBeNull();
    // `none` neither reads nor writes the cache.
    await pool.run(reachCall([0, 20]), { ...opts, cache: 'none' }).promise;
    expect(w.requests()).toHaveLength(2);
    pool.dispose();
  }, 120000);

  it('tells cache readers when a result is stored, so a strip read on mount can read again (review finding usually-strip-stale)', async () => {
    const w = workers();
    const pool = createPool(1, w.spawn);
    const seen: number[] = [];
    const stop = pool.watch!(() => seen.push(pool.stored!()));
    expect(pool.stored!()).toBe(0);
    expect(pool.cached!(reachCall([0, 10]), opts)).toBeNull();
    await pool.run(reachCall([0, 10]), opts).promise;
    // The reader that saw nothing on mount hears the store and finds the result.
    expect(seen).toEqual([1]);
    expect(pool.cached!(reachCall([0, 10]), opts)).not.toBeNull();
    // A cache hit stores nothing new; a job kept out of the cache doesn't count.
    await pool.run(reachCall([0, 10]), opts).promise;
    await pool.run(reachCall([0, 12]), { ...opts, cache: 'none' }).promise;
    expect(seen).toEqual([1]);
    stop();
    await pool.run(reachCall([0, 11]), opts).promise;
    expect(seen).toEqual([1]);
    expect(pool.stored!()).toBe(2);
    pool.dispose();
  }, 120000);

  it('keeps this-type and gate results in sessionStorage, so a new pool paints them without running', async () => {
    globals.sessionStorage = fakeStorage();
    const job: LabJob = { kind: 'reach-type', type: 'hostage_crisis', tier: 2, style: 'random', calls: 2 };
    const first = workers();
    const result = await createPool(2, first.spawn).run(job, opts).promise;
    const second = workers();
    const pool = createPool(2, second.spawn);
    expect(pool.cached!(job, opts)).toMatchObject({ result, from: 'session' });
    expect(await pool.run(job, opts).promise).toEqual(result);
    expect(second.requests()).toHaveLength(0);
    // A this-call result stays in memory only.
    await createPool(1, first.spawn).run(reachCall([0, 5]), opts).promise;
    expect(createPool(1, second.spawn).cached!(reachCall([0, 5]), opts)).toBeNull();
  }, 120000);

  it('cancel rejects the handle, stops the worker and frees the pool', async () => {
    const w = workers();
    const pool = createPool(1, w.spawn);
    const handle = pool.run(reachCall([0, 400]), opts);
    const queued = pool.run(reachCall([0, 30]), opts);
    await new Promise(resolve => setTimeout(resolve, 20));
    handle.cancel();
    await expect(handle.promise).rejects.toSatisfy(isJobCancelled);
    expect(w.ports[0].posted.some(m => 'cancel' in m)).toBe(true);
    // The queued job runs once the worker has stopped the cancelled one.
    expect((await queued.promise).kind).toBe('reach');
    expect(pool.active()).toBe(0);
    pool.dispose();
  }, 120000);

  it('one subscriber cancelling leaves the shared job running for the other', async () => {
    const w = workers();
    const pool = createPool(1, w.spawn);
    const a = pool.run(reachCall([0, 30]), opts), b = pool.run(reachCall([0, 30]), opts);
    a.cancel();
    await expect(a.promise).rejects.toSatisfy(isJobCancelled);
    expect((await b.promise).kind).toBe('reach');
    expect(w.ports[0].posted.some(m => 'cancel' in m)).toBe(false);
    pool.dispose();
  }, 120000);

  // With one curated call there is no second type to route elsewhere; the same-worker half still holds.
  it('sends a call type\'s this-type and gate jobs to the same worker', async () => {
    const w = workers();
    const pool = createPool(3, w.spawn);
    await Promise.all([
      pool.run({ kind: 'reach-type', type: 'hostage_crisis', tier: 2, style: 'random', calls: 1 }, opts).promise,
      pool.run({ kind: 'gate', job: { type: 'hostage_crisis', style: 'random', calls: 2, tier: 2 } }, opts).promise,
    ]);
    const portOf = (match: (job: LabJob) => boolean) => w.ports.findIndex(port => port.posted.some(m => !('cancel' in m) && match(m.job)));
    expect(portOf(job => job.kind === 'gate')).toBe(portOf(job => job.kind === 'reach-type'));
    pool.dispose();
  }, 120000);

  it('replaces the workers when a call type\'s content key changes', async () => {
    const w = workers();
    const pool = createPool(2, w.spawn);
    await pool.run(reachCall([0, 3]), opts).promise;
    expect(w.ports.filter(p => !p.terminated)).toHaveLength(1);
    await pool.run(reachCall([0, 3]), { ...opts, contentKey: `${barricade.contentKey}x` }).promise;
    expect(w.ports[0].terminated).toBe(true);
    expect(w.ports).toHaveLength(2);
    pool.dispose();
    expect(w.ports.every(p => p.terminated)).toBe(true);
  }, 120000);

  it('fails the job of a worker that stops, and gives the next job a fresh worker', async () => {
    const w = workers();
    let spawned = 0;
    const pool = createPool(1, () => {
      const port = w.spawn();
      if (spawned++ > 0) return port;
      // The first worker fails to load.
      let crash: ((message: string) => void) | null = null;
      return { ...port, listen: (onEvent, onCrash) => { port.listen(onEvent, onCrash); crash = onCrash; }, post: () => later(() => crash?.('Failed to fetch')) };
    });
    await expect(pool.run(reachCall([0, 3]), opts).promise).rejects.toThrow('The lab worker stopped: Failed to fetch');
    expect(w.ports[0].terminated).toBe(true);
    expect((await pool.run(reachCall([0, 3]), opts).promise).kind).toBe('reach');
    expect(pool.active()).toBe(0);
    pool.dispose();
  }, 120000);

  it('rejects everything after dispose', async () => {
    const pool = createPool(1, workers().spawn);
    const handle = pool.run(reachCall([0, 200]), opts);
    pool.dispose();
    await expect(handle.promise).rejects.toThrow('closed');
    await expect(pool.run(reachCall([0, 2]), opts).promise).rejects.toThrow('closed');
  });

  it('answers without workers in a browser that has none', async () => {
    const pool = createPool();
    expect(pool.size).toBe(0);
    await expect(pool.run(reachCall([0, 2]), opts).promise).rejects.toThrow('Web Workers');
  });
});

describe('runPaired', () => {
  it('runs the saved side with an empty patch and pairs it with the patched side; with no patch both are one job', async () => {
    const w = workers();
    const pool = createPool(1, w.spawn);
    const same = await runPaired(pool, reachCall([0, 10]), opts).promise;
    expect(same.saved).toEqual(same.patch);
    expect(w.requests()).toHaveLength(1);
    const patch = { RESOLUTION_TUNING: { favorableAt: 30 } };
    const sides = await runPaired(pool, reachCall([0, 10]), { ...opts, patch }).promise;
    expect(w.requests().map(r => r.patch)).toEqual([{}, patch]);
    expect(sides.saved).toEqual(same.saved);
    expect(sides.patch).not.toEqual(sides.saved);
    pool.dispose();
  }, 120000);
});

describe('jobKey', () => {
  const job = reachCall([0, 10]);
  it('names the job, the content key and the tuning hash of saved plus patch', () => {
    const key = jobKey(job, opts);
    expect(key.startsWith('reach-call:')).toBe(true);
    expect(key).toContain(`|${barricade.contentKey}|`);
    expect(key.endsWith(`|${tuningHash('saved')}`)).toBe(true);
    expect(jobKey({ runs: [0, 10], style: 'random', start: { squad: { certs: [], seed: 719 }, kit: 'day1', scenarioId: start.kind === 'fresh' ? start.scenarioId : '', kind: 'fresh' }, kind: 'reach-call' }, opts)).toBe(key);
    expect(jobKey(reachCall([0, 11]), opts)).not.toBe(key);
    expect(jobKey(job, { ...opts, contentKey: 'other' })).not.toBe(key);
    const patched = jobKey(job, { ...opts, patch: { RESOLUTION_TUNING: { favorableAt: 12 } } });
    expect(patched).not.toBe(key);
    expect(jobKey(job, { ...opts, patch: { RESOLUTION_TUNING: { favorableAt: 12 } } })).toBe(patched);
  });
});
