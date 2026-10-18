// What a lab worker does with each job (spec 9.5), as plain functions Node can test. lab.worker.ts is
// a thin shell around createJobHost; the tests run the same host in-process.
//
// - Every request starts with applyTuningPatch(request.patch), so a job never inherits the previous
//   job's patch, and a host serves one request at a time (a job yields between chunks, and another
//   job's patch must not apply while it waits).
// - Long jobs yield every `yieldEvery` runs (RUN_DEFAULTS.chunk; population jobs every
//   chunk / CALL_COST calls), post progress with a partial tally, and stop at the next chunk once
//   cancelled.
// - "This call" runs: run k plays a copy of one start state with its own dice
//   (activeRun.rngState = runRngState(scenarioId, k)) and roll seed k + 1, so saved and patched runs
//   with the same k are paired and a run's result doesn't depend on which worker played it.
// - "This type" and gate runs play trees-v13/balance.ts drawCalls populations with playCalls, exactly
//   as `measure` does. The drawn call list is memoized per type and tier (generation never reads a
//   tunable table: those fields are denied in the registry), and a 40-call list is the first 40 of
//   the 60-call one.
import '../../../sim/tuning-tables';
import { CALL_TREES, callTreeAt } from '../../../content/call-trees';
import type { CallTree } from '../../../content/call-trees/types';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import { incidentId, INCIDENT_CONTENT_VERSION, parseIncidentId } from '../../../gen/incident';
import { NOW } from '../../../gen/incident/gates/engine-driver';
import { instanceOf } from '../../../gen/incident/instance';
import { drawCalls, playCalls, playToEnd, summarize, weigh } from '../../../gen/incident/trees-v13/balance';
import type { CallResult, GateJob, Policy } from '../../../gen/incident/trees-v13/balance';
import { buildLocation } from '../../../sim/location';
import { actionViews } from '../../../sim/operation-selectors';
import { getScenario } from '../../../sim/scenario-registry';
import type { IncidentType } from '../../../sim/scenario-types';
import { applyTuningPatch } from '../../../sim/tuning';
import type { GameState } from '../../../sim/types';
import { resolveScenario } from '../model/call';
import { createExplorer, EXPLORE_CAP } from '../model/explore';
import type { ExploreProgress } from '../model/explore';
import { seekCallSeed, seekSquadSeed } from '../model/seek';
import { playPath } from '../model/session';
import { focusSquad, startCall } from '../model/squads';
import { defaultCall, REFERENCE_SQUAD } from '../url';
import { CALL_COST, RUN_DEFAULTS } from './budgets';
import type { CastSample, ExploreResult, JobCancel, JobEvent, JobRequest, JobResult, LabJob, StartRef } from './protocol';
import { addRun, emptyTally, recordStep, runRngState } from './tally';
import type { ReachTally, StepRecord } from './tally';

export interface RunnerContext { shouldStop(): boolean; progress(done: number, total: number, partial?: ReachTally): void; yieldEvery: number }

/** The error message of a job stopped by a cancel. */
export const CANCELLED = 'cancelled';
/** How long an explore slice runs before the walk yields (ms). */
const EXPLORE_SLICE_MS = 40;
/** Seeds tried between yields by a squad search. */
const SEEK_SLICE = 50;
/** The bench: this-call runs and drawn calls per type, and where its drawn population starts (away
 * from the gate's, so its generation is measured cold). */
export const BENCH = { runs: 40, calls: 6, from: 9001 } as const;

const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));
/** Yield intervals: every `yieldEvery` this-call runs; a drawn call (a fresh start, often a fresh
 * generation) costs about CALL_COST runs, so population jobs yield that much more often. */
const runsEvery = (ctx: RunnerContext) => Math.max(1, Math.floor(ctx.yieldEvery));
const callsEvery = (ctx: RunnerContext) => Math.max(1, Math.round(ctx.yieldEvery / CALL_COST));
const stopped = () => new Error(CANCELLED);

/** The call tree a scenario id runs on. */
function treeOf(scenarioId: string): CallTree {
  const spec = parseIncidentId(scenarioId);
  const type = spec?.type ?? getScenario(scenarioId)?.incident?.type;
  const tree = spec ? callTreeAt(spec.type) : type ? CALL_TREES[type] : undefined;
  if (!tree) throw new Error(`${scenarioId} doesn't run on a call tree.`);
  return tree;
}
function treeFor(type: IncidentType): CallTree {
  const tree = CALL_TREES[type];
  if (!tree) throw new Error(`${type} has no call tree.`);
  return tree;
}

/** The state a job starts from: a fresh call for the squad (with the path replayed), or the state given. */
export function startOf(ref: StartRef): GameState {
  if (ref.kind === 'state') return ref.state;
  const state = startCall(ref.scenarioId, ref.kit, ref.squad);
  if (!ref.path) return state;
  const played = playPath(state, ref.path);
  if (played.stopped) throw new Error(`The path stops at step ${played.stopped.step}: ${played.stopped.why}`);
  return played.frames[played.frames.length - 1].state;
}

/** Run k of a this-call population: a copy of `start` with run k's dice, played in `style` with roll
 * seed k + 1 (spec 9.5), recorded step by step. */
export function playRun(start: GameState, tree: CallTree, style: Policy, k: number, firstChoice?: string): { steps: StepRecord[]; result: CallResult } {
  const state = structuredClone(start);
  const scenarioId = state.activeRun!.scenarioId;
  state.activeRun!.rngState = runRngState(scenarioId, k);
  const steps: StepRecord[] = [];
  const end = playToEnd(scenarioId, style, k + 1, { start: state, rollSeed: k + 1, firstChoice, onStep: step => steps.push(recordStep(tree, step)) });
  return { steps, result: weigh(tree, end) };
}

const DRAWN = new Map<string, { scenarioId: string; seed: number }[]>();
/** drawCalls(tree, tier, n, 1), memoized per type and tier: a shorter list is a prefix of a longer one. */
function drawnCalls(tree: CallTree, tier: number, n: number): { scenarioId: string; seed: number }[] {
  const key = `${tree.type}:${tier}`;
  const have = DRAWN.get(key);
  if (have && have.length >= n) return have.slice(0, n);
  const calls = drawCalls(tree, tier, n, 1);
  DRAWN.set(key, calls);
  return calls;
}

/** Calls `each(i)` for i in [0, total), yielding every `every` with progress, stopping at the next
 * chunk once cancelled. */
async function chunked(total: number, every: number, ctx: RunnerContext, each: (i: number) => void, partial?: () => ReachTally): Promise<void> {
  if (ctx.shouldStop()) throw stopped();
  for (let i = 0; i < total; i++) {
    if (i > 0 && i % every === 0) {
      ctx.progress(i, total, partial?.());
      await pause();
      if (ctx.shouldStop()) throw stopped();
    }
    each(i);
  }
  ctx.progress(total, total, partial?.());
}

async function reachCall(job: Extract<LabJob, { kind: 'reach-call' }>, ctx: RunnerContext): Promise<JobResult> {
  const start = startOf(job.start);
  const run = start.activeRun;
  if (!run) throw new Error('No call is running in that state.');
  const tree = treeOf(run.scenarioId);
  if (run.status === 'active' && run.stage !== 'debrief') {
    // playToEnd plays squad A's choices, as the balance gate does.
    const views = actionViews(start, NOW, 'A');
    const focus = focusSquad(start);
    if (!views.some(view => view.eligible) && focus !== 'A') throw new Error(`Reach runs play squad A's choices; this state deploys squad ${focus}.`);
    if (job.firstChoice !== undefined && !views.some(view => view.id === job.firstChoice && view.eligible))
      throw new Error(`${job.firstChoice} isn't offered to squad A in that state.`);
  }
  const [from, to] = job.runs;
  const tally = emptyTally();
  await chunked(Math.max(0, to - from), runsEvery(ctx), ctx, i => {
    const { steps, result } = playRun(start, tree, job.style, from + i, job.firstChoice);
    addRun(tally, steps, result, from + i);
  }, () => tally);
  return { kind: 'reach', tally };
}

async function reachType(job: Extract<LabJob, { kind: 'reach-type' }>, ctx: RunnerContext): Promise<JobResult> {
  const tree = treeFor(job.type);
  const calls = drawnCalls(tree, job.tier, job.calls);
  const tally = emptyTally();
  await chunked(calls.length, callsEvery(ctx), ctx, i => {
    playCalls(tree, job.style, [calls[i]], (result, steps) => addRun(tally, steps.map(step => recordStep(tree, step)), result, i));
  }, () => tally);
  return { kind: 'reach', tally };
}

async function gate(job: GateJob, ctx: RunnerContext): Promise<JobResult> {
  const tree = treeFor(job.type);
  const calls = drawnCalls(tree, job.tier, job.calls);
  const results: CallResult[] = [];
  await chunked(calls.length, callsEvery(ctx), ctx, i => { results.push(...playCalls(tree, job.style, [calls[i]])); });
  return { kind: 'gate', results, distribution: summarize(results) };
}

async function exploreJob(job: Extract<LabJob, { kind: 'explore' }>, ctx: RunnerContext): Promise<JobResult> {
  const explorer = createExplorer(startOf(job.start), job.goal, { cap: job.cap });
  if (ctx.shouldStop()) throw stopped();
  let at: ExploreProgress = explorer.step(EXPLORE_SLICE_MS, ctx.shouldStop);
  while (!at.done) {
    ctx.progress(at.states, job.cap);
    await pause();
    if (ctx.shouldStop()) throw stopped();
    at = explorer.step(EXPLORE_SLICE_MS, ctx.shouldStop);
  }
  // A stop ends the walk as truncated; that is a cancel, not a result.
  if (ctx.shouldStop()) throw stopped();
  ctx.progress(at.states, job.cap);
  // Without a goal the walk also reports the shortest path to each ending (Outcomes reads it).
  const result: ExploreResult & { endings?: Record<string, string> } = { path: at.path, states: at.states, truncated: at.truncated, unforced: at.unforced, ...(job.goal === null ? { endings: at.endings } : {}) };
  return { kind: 'explore', result };
}

async function seekSquad(job: Extract<LabJob, { kind: 'seek-squad' }>, ctx: RunnerContext): Promise<JobResult> {
  let tried = 0;
  while (tried < job.limit) {
    if (ctx.shouldStop()) throw stopped();
    const n = Math.min(SEEK_SLICE, job.limit - tried);
    const found = seekSquadSeed(job.cert, { from: job.from + tried, limit: n });
    if (found.seed !== null) return { kind: 'seek-squad', seed: found.seed, tried: tried + found.tried };
    tried += n;
    ctx.progress(tried, job.limit);
    await pause();
  }
  return { kind: 'seek-squad', seed: null, tried };
}

/** The names, groups, place and rooms the compiler binds tree text with for one generated call:
 * the arguments compile.ts textBinder passes to bindRoleTokens (runners.test.ts holds the two equal
 * on every string row). */
export function castSample(type: IncidentType, family: string, seed: number, tier: number, call: number): CastSample {
  const template = INCIDENT_TEMPLATES[type];
  if (!template) throw new Error(`${type} has no call tree.`);
  const scenario = getScenario(incidentId({ type, familyId: family, buildingSeed: seed, seed: call, tier, contentVersion: INCIDENT_CONTENT_VERSION }));
  if (!scenario) throw new Error(`Call ${call} of ${type} doesn't generate.`);
  const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
  const placed = instanceOf(scenario, built)?.placed;
  if (!placed) throw new Error(`Call ${call} of ${type} has no placed cast.`);
  const { room, roomOf, outside, cast, groups = {} } = placed;
  const roomLabel = (id: string) => (built.location.rooms.find(entry => entry.id === id)?.label ?? 'room').toLowerCase();
  const rooms: Record<string, string> = {
    scene: roomLabel(room.id),
    ...Object.fromEntries(template.tree.roles.filter(role => role.place !== 'offsite' && roomOf[role.id] !== outside).map(role => [role.id, roomLabel(roomOf[role.id])])),
    ...Object.fromEntries(Object.entries(groups).flatMap(([group, ids]) => ids.length ? [[group, roomLabel(roomOf[ids[0]])], ...ids.map(id => [id, roomLabel(roomOf[id])])] : [])),
  };
  return { call, cast, groups, place: built.location.name, rooms };
}

async function casts(job: Extract<LabJob, { kind: 'casts' }>, ctx: RunnerContext): Promise<JobResult> {
  const out: CastSample[] = [];
  let from = 1;
  for (let i = 0; i < job.n; i++) {
    if (ctx.shouldStop()) throw stopped();
    // Only the situation is asked for: names, group sizes and turns vary from call to call.
    const found = seekCallSeed(job.type, { family: job.family, seed: job.seed, tier: job.tier }, { variant: job.variant }, { from });
    if (!found) break;
    out.push(castSample(job.type, job.family, job.seed, job.tier, found.call));
    from = found.call + 1;
    ctx.progress(i + 1, job.n);
    await pause();
  }
  return { kind: 'casts', casts: out };
}

/** Per-unit costs on this machine, in ms (budgets.ts records them): for each call type with a tree,
 * `open` (generate the default draw), `start` (startCall for squad 719), `run` (one this-call run,
 * mean of BENCH.runs), `steps` (decisions per run, a count), `draw` (one drawCalls generation),
 * `playCold` and `playWarm` (one played gate call before and after its scenario is cached),
 * `explore` (the whole walk from the default call) and `exploreStates` (its size, a count). */
async function bench(ctx: RunnerContext): Promise<JobResult> {
  const ms: Record<string, number> = {};
  const round = (n: number) => Math.round(n * 100) / 100;
  const timed = <R>(key: string, fn: () => R, per = 1): R => {
    const t0 = performance.now();
    const out = fn();
    ms[key] = round((performance.now() - t0) / per);
    return out;
  };
  const types = (Object.keys(CALL_TREES) as IncidentType[]).filter(type => INCIDENT_TEMPLATES[type]);
  if (ctx.shouldStop()) throw stopped();
  for (const [i, type] of types.entries()) {
    const tree = treeFor(type);
    const { scenario } = timed(`open:${type}`, () => resolveScenario({ ...defaultCall(type), path: '' }));
    if (!scenario) throw new Error(`The default ${type} call doesn't generate.`);
    const start = timed(`start:${type}`, () => startCall(scenario.id, 'day1', { seed: REFERENCE_SQUAD, certs: [] }));
    const tally = emptyTally();
    timed(`run:${type}`, () => {
      for (let k = 0; k < BENCH.runs; k++) { const { steps, result } = playRun(start, tree, 'random', k); addRun(tally, steps, result, k); }
    }, BENCH.runs);
    ms[`steps:${type}`] = round(Object.values(tally.visits).reduce((sum, n) => sum + n, 0) / tally.runs);
    const calls = timed(`draw:${type}`, () => drawCalls(tree, 2, BENCH.calls, BENCH.from), BENCH.calls);
    timed(`playCold:${type}`, () => playCalls(tree, 'random', calls), BENCH.calls);
    timed(`playWarm:${type}`, () => playCalls(tree, 'random', calls), BENCH.calls);
    const walk = timed(`explore:${type}`, () => {
      const explorer = createExplorer(start, null, { cap: EXPLORE_CAP });
      let at = explorer.step(Infinity);
      while (!at.done) at = explorer.step(Infinity);
      return at;
    });
    ms[`exploreStates:${type}`] = walk.states;
    ctx.progress(i + 1, types.length);
    await pause();
    if (ctx.shouldStop()) throw stopped();
  }
  return { kind: 'bench', ms };
}

/** Run one job. The caller has applied the job's tuning patch. */
export function runJob(job: LabJob, ctx: RunnerContext): Promise<JobResult> {
  switch (job.kind) {
    case 'reach-call': return reachCall(job, ctx);
    case 'reach-type': return reachType(job, ctx);
    case 'gate': return gate(job.job, ctx);
    case 'explore': return exploreJob(job, ctx);
    case 'seek-squad': return seekSquad(job, ctx);
    case 'casts': return casts(job, ctx);
    case 'bench': return bench(ctx);
  }
}

export interface JobHost { receive(message: JobRequest | JobCancel): void }

/** The worker's message loop: requests are served one at a time, each under its own tuning patch;
 * a cancel stops the job at its next chunk (or before it starts). Every request ends in exactly
 * one `result` or `error` event, so the pool always knows when a worker is free again. */
export function createJobHost(post: (event: JobEvent) => void, yieldEvery = RUN_DEFAULTS.chunk): JobHost {
  const pending = new Set<string>(), cancelled = new Set<string>();
  let queue: Promise<void> = Promise.resolve();
  const serve = async (request: JobRequest) => {
    const { id } = request;
    const started = performance.now();
    try {
      if (cancelled.has(id)) throw stopped();
      applyTuningPatch(request.patch);
      const result = await runJob(request.job, {
        shouldStop: () => cancelled.has(id),
        progress: (done, total, partial) => post({ id, type: 'progress', done, total, ...(partial ? { partial } : {}) }),
        yieldEvery,
      });
      post({ id, type: 'result', result, ms: Math.round(performance.now() - started) });
    } catch (error) {
      post({ id, type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      pending.delete(id);
      cancelled.delete(id);
    }
  };
  return {
    receive(message) {
      // A cancel for a request already answered (or never sent) has nothing to stop.
      if ('cancel' in message) { if (pending.has(message.id)) cancelled.add(message.id); return; }
      pending.add(message.id);
      queue = queue.then(() => serve(message));
    },
  };
}
