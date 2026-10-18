// The dev-only debug handle `window.__lab` (spec 9.4), which the browser checks of every job read:
// the URL focus, the open session and frame, the player's visible choice ids, the X-ray and dilemma
// rows, static lint, and the worker pool (run a job, measure a type). Each getter asks the live shell
// through `source()`, so the handle never holds stale state.
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import { NOW } from '../../gen/incident/gates/engine-driver';
import { WEIGHTS } from '../../gen/incident/trees-v13/balance';
import type { Distribution, Policy } from '../../gen/incident/trees-v13/balance';
import { lintTree } from '../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, LintFinding } from '../../gen/incident/trees-v13/dependencies';
import type { IncidentType } from '../../sim/scenario-types';
import type { TuningPatch } from '../../sim/tuning';
import { visibleDecisions } from '../../ui/screens/liveModels';
import { liveDecisions } from '../../ui/screens/live-model';
import type { JobPool } from './jobs/pool';
import type { JobResult, LabJob } from './jobs/protocol';
import type { ReachTally } from './jobs/tally';
import { contentKey } from './model/call';
import { dilemma } from './model/dilemma';
import type { DilemmaRow } from './model/dilemma';
import { currentFrame } from './model/session';
import type { Frame, Session } from './model/session';
import { xrayChoices } from './model/xray';
import type { ChoiceXray } from './model/xray';
import type { LabUrl } from './types';

export interface LabDebug {
  url(): LabUrl; session(): Session | null; frame(): Frame | null;
  /** visibleDecisions(liveDecisions(state, NOW, 'A'), null, false).map(a => a.id): the cards the player sees. */
  visibleIds(): string[];
  xray(): ChoiceXray[]; dilemma(): DilemmaRow[]; lint(): LintFinding[];
  run(job: LabJob, patch?: TuningPatch): Promise<JobResult>;
  /** A reach-type job at tier 2, summarized the way trees-v13/balance.ts `measure` summarizes. */
  measure(type: IncidentType, style: Policy, calls: number): Promise<Distribution>;
  jobs: { active(): number };
}

declare global {
  interface Window { __lab?: LabDebug }
}

export interface DebugSource { url: LabUrl; session: Session | null; deps: DependencyIndex | null; pool: JobPool; patch: TuningPatch }

/** A reach tally as `measure` reports it: shares to three decimals, the share of calls with an officer
 * hurt, and mean minutes rounded. */
export function distributionOf(t: ReachTally): Distribution {
  const calls = t.runs;
  const share = (n: number) => (calls ? Math.round((1000 * n) / calls) / 1000 : 0);
  return {
    calls,
    weights: Object.fromEntries(WEIGHTS.map(weight => [weight, share(t.weights[weight] ?? 0)])) as Distribution['weights'],
    endings: Object.fromEntries(Object.entries(t.endings).map(([ending, entry]) => [ending, share(entry.n)])),
    officerHurtRate: share(t.officerHurt),
    meanMinutes: calls ? Math.round(t.minutes / calls) : 0,
  };
}

const keyFor = (type: IncidentType) => { try { return contentKey(type); } catch { return `unkeyed:${type}`; } };

export function createLabDebug(source: () => DebugSource): LabDebug {
  const frame = () => { const s = source().session; return s ? currentFrame(s) : null; };
  const run = (job: LabJob, patch?: TuningPatch) => {
    const { pool, session, url, patch: current } = source();
    // A job that names its call type is keyed by that type's content, whatever call is open.
    const key = job.kind === 'reach-type' ? keyFor(job.type) : job.kind === 'gate' ? keyFor(job.job.type)
      : session?.contentKey ?? (url.call ? keyFor(url.call.type) : 'none');
    return pool.run(job, { patch: patch ?? current, contentKey: key }).promise;
  };
  return {
    url: () => source().url,
    session: () => source().session,
    frame,
    visibleIds: () => { const f = frame(); return f ? visibleDecisions(liveDecisions(f.state, NOW, 'A'), null, false).map(view => view.id) : []; },
    xray: () => { const { session, deps } = source(); const f = frame(); return session && f && deps ? xrayChoices(session, f, deps) : []; },
    dilemma: () => {
      const { session, deps } = source(); const f = frame();
      return session && f && deps && f.state.activeRun ? dilemma(xrayChoices(session, f, deps), deps, f.state.activeRun) : [];
    },
    lint: () => {
      const { url, deps } = source();
      const template = url.call ? INCIDENT_TEMPLATES[url.call.type] : undefined;
      return template ? lintTree(template, deps ?? undefined) : [];
    },
    run,
    measure: async (type, style, calls) => {
      const result = await run({ kind: 'reach-type', type, tier: 2, style, calls });
      if (result.kind !== 'reach') throw new Error(`measure expected a reach result, got ${result.kind}`);
      return distributionOf(result.tally);
    },
    jobs: { active: () => source().pool.active() },
  };
}
