// The worker's job runners, run in Node: this-type tallies summarize exactly like `measure`, gate jobs
// equal `measure`, this-call runs are deterministic per run range, a cancel stops within one chunk,
// and the host applies each request's tuning patch on its own (a patched job differs, the next job
// without a patch matches the saved tuning).
import { afterAll, describe, expect, it } from 'vitest';
import { CALL_TREES } from '../../../content/call-trees';
import { bindRoleTokens, memberCounts, textBinder } from '../../../gen/incident/trees-v13/compile';
import { drawCalls, measure, playCalls } from '../../../gen/incident/trees-v13/balance';
import { callStringRows } from '../../../gen/incident/trees-v13/strings';
import { incidentId, INCIDENT_CONTENT_VERSION } from '../../../gen/incident';
import { clockNextsOf, instanceOf } from '../../../gen/incident/instance';
import { buildLocation } from '../../../sim/location';
import { getScenario } from '../../../sim/scenario-registry';
import { applyTuningPatch, tuningLayers } from '../../../sim/tuning';
import type { TuningPatch } from '../../../sim/tuning';
import { distributionOf } from '../debug';
import { explore } from '../model/explore';
import { seekSquadSeed } from '../model/seek';
import { openSession } from '../model/session';
import type { Session } from '../model/session';
import { startCall } from '../model/squads';
import { parseLabUrl } from '../url';
import type { JobEvent, JobResult, LabJob, StartRef } from './protocol';
import { CALL_COST } from './budgets';
import { CANCELLED, createJobHost, runJob } from './runners';
import type { RunnerContext } from './runners';

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}
const ctx = (over: Partial<RunnerContext> = {}): RunnerContext => ({ shouldStop: () => false, progress: () => {}, yieldEvery: 25, ...over });
const fresh = (s: Session): StartRef => ({ kind: 'fresh', scenarioId: s.scenario.id, kit: 'day1', squad: { seed: 719, certs: [] } });
const tallyOf = (result: JobResult) => { if (result.kind !== 'reach') throw new Error(`expected a tally, got ${result.kind}`); return result.tally; };

afterAll(() => { applyTuningPatch({}); });

describe('runJob', () => {
  const barricade = open('type=hostage_crisis');

  it('a this-type tally summarizes exactly as measure() does', async () => {
    const result = await runJob({ kind: 'reach-type', type: 'hostage_crisis', tier: 2, style: 'random', calls: 6 }, ctx());
    const tally = tallyOf(result);
    const expected = measure(CALL_TREES.hostage_crisis!, 2, 'random', 6);
    expect(tally.runs).toBe(6);
    expect(distributionOf(tally)).toEqual(expected);
    expect(distributionOf(tally).endings).toEqual(expected.endings);
    expect(distributionOf(tally).weights).toEqual(expected.weights);
  }, 120000);

  it('a gate job equals measure() and plays the drawn calls in order; a shorter job is the longer one\'s prefix', async () => {
    const tree = CALL_TREES.hostage_crisis!;
    const long = await runJob({ kind: 'gate', job: { type: 'hostage_crisis', style: 'random', calls: 8, tier: 2 } }, ctx());
    if (long.kind !== 'gate') throw new Error(long.kind);
    expect(long.distribution).toEqual(measure(tree, 2, 'random', 8));
    expect(long.results).toEqual(playCalls(tree, 'random', drawCalls(tree, 2, 8, 1)));
    const short = await runJob({ kind: 'gate', job: { type: 'hostage_crisis', style: 'random', calls: 5, tier: 2 } }, ctx());
    if (short.kind !== 'gate') throw new Error(short.kind);
    expect(short.results).toEqual(long.results.slice(0, 5));
  }, 120000);

  it('this-call runs are deterministic for a run range, and runs differ from each other', async () => {
    const job: LabJob = { kind: 'reach-call', start: fresh(barricade), style: 'random', runs: [10, 40] };
    const [a, b] = [tallyOf(await runJob(job, ctx())), tallyOf(await runJob(job, ctx()))];
    expect(a).toEqual(b);
    expect(a.runs).toBe(30);
    expect(a.runWeights.slice(0, 10).every(w => w === -1)).toBe(true);
    expect(Object.keys(a.endings).length).toBeGreaterThan(1);
  }, 120000);

  it('from this step: a path start plays from the end of the path, and a first choice is taken first', async () => {
    const first = barricade.frames[0].views.find(view => view.eligible)!;
    const path = `${first.id}~favorable`;
    const tally = tallyOf(await runJob({ kind: 'reach-call', start: { ...fresh(barricade), path } as StartRef, style: 'random', runs: [0, 20] }, ctx()));
    expect(tally.visits[barricade.tree.root] ?? 0).toBe(0);
    const second = tallyOf(await runJob({ kind: 'reach-call', start: fresh(barricade), firstChoice: first.id, style: 'random', runs: [0, 20] }, ctx()));
    const rootChoices = Object.keys(second.choices).filter(key => key.startsWith(`${barricade.tree.root}/`));
    expect(rootChoices).toHaveLength(1);
    await expect(runJob({ kind: 'reach-call', start: fresh(barricade), firstChoice: 'not_a_choice', style: 'random', runs: [0, 5] }, ctx())).rejects.toThrow("isn't offered");
    await expect(runJob({ kind: 'reach-call', start: { ...fresh(barricade), path: 'not_a_choice~favorable' } as StartRef, style: 'random', runs: [0, 5] }, ctx())).rejects.toThrow('The path stops at step 1');
  }, 120000);

  it('a cancel stops a job within one chunk', async () => {
    const done: number[] = [];
    let stop = false;
    const job = runJob({ kind: 'reach-call', start: fresh(barricade), style: 'random', runs: [0, 200] }, ctx({
      yieldEvery: 10, shouldStop: () => stop, progress: n => { done.push(n); stop = true; },
    }));
    await expect(job).rejects.toThrow(CANCELLED);
    expect(done).toEqual([10]);
    stop = false;
    const gateDone: number[] = [];
    // A drawn call costs about CALL_COST runs, so a population job yields every chunk / CALL_COST calls.
    const gate = runJob({ kind: 'gate', job: { type: 'hostage_crisis', style: 'random', calls: 8, tier: 2 } }, ctx({
      yieldEvery: 3 * CALL_COST, shouldStop: () => stop, progress: n => { gateDone.push(n); stop = true; },
    }));
    await expect(gate).rejects.toThrow(CANCELLED);
    expect(gateDone).toEqual([3]);
  }, 120000);

  it('explore matches the run model\'s explore; seek-squad matches seekSquadSeed', async () => {
    const start = startCall(barricade.scenario.id, 'day1', { seed: 719, certs: [] });
    const goal = { ending: Object.keys(barricade.tree.endings)[0] };
    const result = await runJob({ kind: 'explore', start: fresh(barricade), goal, cap: 6000 }, ctx());
    if (result.kind !== 'explore') throw new Error(result.kind);
    const direct = explore(start, goal, { cap: 6000 });
    // The worker carries the walk's count of results too narrow to force, so its no-path text matches.
    expect(result.result).toEqual({ path: direct.path, states: direct.states, truncated: direct.truncated, unforced: direct.unforced });
    const all = await runJob({ kind: 'explore', start: fresh(barricade), goal: null, cap: 6000 }, ctx());
    if (all.kind !== 'explore') throw new Error(all.kind);
    expect((all.result as { endings?: Record<string, string> }).endings).toEqual(explore(start, null, { cap: 6000 }).endings);
    for (const cert of ['vehicle_operations', 'crisis_negotiation']) {
      const found = await runJob({ kind: 'seek-squad', cert, from: 1, limit: 120 }, ctx());
      expect(found).toEqual({ kind: 'seek-squad', ...seekSquadSeed(cert, { from: 1, limit: 120 }) });
    }
  }, 120000);

  it('casts: the first calls with the situation, each binding every string row exactly as the compiler does', async () => {
    const result = await runJob({ kind: 'casts', type: 'hostage_crisis', family: barricade.resolved.spec!.familyId, seed: barricade.resolved.spec!.buildingSeed,
      tier: 2, variant: 0, n: 3 }, ctx());
    if (result.kind !== 'casts') throw new Error(result.kind);
    expect(result.casts).toHaveLength(3);
    expect(result.casts.map(c => c.call)).toEqual([...result.casts.map(c => c.call)].sort((a, b) => a - b));
    const tree = CALL_TREES.hostage_crisis!;
    for (const sample of result.casts) {
      const spec = barricade.resolved.spec!;
      const scenario = getScenario(incidentId({ type: 'hostage_crisis', familyId: spec.familyId, buildingSeed: spec.buildingSeed, seed: sample.call, tier: 2, contentVersion: INCIDENT_CONTENT_VERSION }))!;
      const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
      const instance = instanceOf(scenario, built)!, placed = instance.placed;
      expect(scenario.incident).toBeDefined();
      const counts = memberCounts(placed);
      const ours = callStringRows(tree, text => bindRoleTokens(text, sample.cast, sample.place, sample.rooms, sample.groups), counts, clockNextsOf(instance.clocks));
      const compiler = callStringRows(tree, textBinder(tree, built, placed), counts, clockNextsOf(instance.clocks));
      expect(ours.map(row => row.text)).toEqual(compiler.map(row => row.text));
      expect(ours.length).toBeGreaterThan(20);
    }
  }, 120000);
});

describe('createJobHost', () => {
  const rescue = open('type=hostage_crisis');
  /** Sends requests to a host and collects its events per request id. */
  function host() {
    const events: JobEvent[] = [];
    const waiting = new Map<string, (event: JobEvent) => void>();
    const h = createJobHost(event => { events.push(event); if (event.type !== 'progress') waiting.get(event.id)?.(event); }, 10);
    const send = (id: string, job: LabJob, patch: TuningPatch = {}) => new Promise<JobEvent>(resolve => { waiting.set(id, resolve); h.receive({ id, job, patch, contentKey: 'test' }); });
    return { h, events, send };
  }
  const job: LabJob = { kind: 'reach-call', start: fresh(rescue), style: 'random', runs: [0, 40] };

  it('applies each request\'s patch: a patched job differs, and the next job without a patch matches saved tuning', async () => {
    const saved = tallyOf(await runJob(job, ctx()));
    const favorableAt = (tuningLayers().defaults.RESOLUTION_TUNING as { favorableAt: number }).favorableAt;
    const { send } = host();
    const patched = await send('a', job, { RESOLUTION_TUNING: { favorableAt: favorableAt + 30 } });
    const after = await send('b', job);
    if (patched.type !== 'result' || after.type !== 'result') throw new Error('expected results');
    expect(tallyOf(patched.result)).not.toEqual(saved);
    expect(tallyOf(after.result)).toEqual(saved);
    expect(after.ms).toBeGreaterThanOrEqual(0);
  }, 120000);

  it('serves one request at a time, answers a cancel with an error event, and keeps serving', async () => {
    const { h, events, send } = host();
    const first = send('one', { ...job, runs: [0, 200] } as LabJob);
    const second = send('two', { ...job, runs: [0, 5] } as LabJob);
    h.receive({ id: 'one', cancel: true });
    expect(await first).toMatchObject({ id: 'one', type: 'error', message: CANCELLED });
    expect(await second).toMatchObject({ id: 'two', type: 'result' });
    // Progress came in chunks of 10 with a partial tally, and 'two' started only after 'one' answered.
    const progress = events.filter(e => e.type === 'progress' && e.id === 'one');
    expect(progress.every(e => e.type === 'progress' && e.done % 10 === 0 && !!e.partial)).toBe(true);
    expect(events.findIndex(e => e.id === 'two')).toBeGreaterThan(events.findIndex(e => e.id === 'one' && e.type === 'error'));
    // A cancel for a request already answered changes nothing.
    h.receive({ id: 'two', cancel: true });
    expect(await send('three', { ...job, runs: [0, 3] } as LabJob)).toMatchObject({ type: 'result' });
  }, 120000);

  it('reports a job error as an error event', async () => {
    const { send } = host();
    expect(await send('bad', { kind: 'reach-call', start: { kind: 'fresh', scenarioId: 'no_such_call', kit: 'day1', squad: { seed: 719, certs: [] } }, style: 'random', runs: [0, 2] }))
      .toMatchObject({ type: 'error', message: expect.stringContaining('no_such_call') });
  }, 120000);
});
