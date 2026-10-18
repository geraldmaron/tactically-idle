// The message contract between the lab page and its worker pool (spec section 9.3, Stream J). Types
// only: the page posts a JobRequest or JobCancel, the worker answers with JobEvents. Every request
// carries the tuning patch and the content key, so a worker never inherits a previous job's patch
// and a cached result never outlives an edit to the call.
import type { CastIdentity } from '../../../gen/incident/trees-v13/compile';
import type { ReqNode, ReqTarget } from '../../../gen/incident/trees-v13/dependencies';
import type { CallResult, Distribution, GateJob, Policy } from '../../../gen/incident/trees-v13/balance';
import type { IncidentType } from '../../../sim/scenario-types';
import type { TuningPatch } from '../../../sim/tuning';
import type { GameState } from '../../../sim/types';
import type { Kit } from '../types';
import type { ReachTally } from './tally';

/** A reference squad: day-one squad A of this campaign seed, plus lab cert grants to its first officer. */
export interface SquadSpec { seed: number; certs: string[] }
/** Where a run starts: a fresh call (optionally replaying a path) or an exact engine state. */
export type StartRef = { kind: 'fresh'; scenarioId: string; kit: Kit; squad: SquadSpec; path?: string } | { kind: 'state'; state: GameState };
export type Goal = { node: string } | { ending: string } | { flags: string[] } | { offered: string } | { eligible: string } | { req: ReqNode; target: ReqTarget };
/** `unforced`: results the dice allow at a walked state that no forced step can take (a band whose
 * margin window is under 1%: sampleFor in gates/engine-driver.ts), so the walk didn't follow them and
 * can't say it covered every state the call reaches. */
export interface ExploreResult { path: string | null; states: number; truncated: boolean; unforced?: number }
export interface CastSample { call: number; cast: Record<string, CastIdentity>; groups: Record<string, readonly string[]>; place: string; rooms: Record<string, string> }

export type LabJob =
  | { kind: 'reach-call'; start: StartRef; firstChoice?: string; style: Policy; runs: [from: number, to: number] }
  | { kind: 'reach-type'; type: IncidentType; tier: number; style: Policy; calls: number }
  | { kind: 'gate'; job: GateJob }
  | { kind: 'explore'; start: StartRef; goal: Goal | null; cap: number }
  | { kind: 'seek-squad'; cert: string; from: number; limit: number }
  | { kind: 'casts'; type: IncidentType; family: string; seed: number; tier: number; variant: 0 | 1 | 2; n: number }
  | { kind: 'bench' };

export type JobResult =
  | { kind: 'reach'; tally: ReachTally }
  | { kind: 'gate'; results: CallResult[]; distribution: Distribution }
  | { kind: 'explore'; result: ExploreResult }
  | { kind: 'seek-squad'; seed: number | null; tried: number }
  | { kind: 'casts'; casts: CastSample[] }
  | { kind: 'bench'; ms: Record<string, number> };

export interface JobRequest { id: string; job: LabJob; patch: TuningPatch; contentKey: string }
export interface JobCancel { id: string; cancel: true }
export type JobEvent =
  | { id: string; type: 'progress'; done: number; total: number; partial?: ReachTally }
  | { id: string; type: 'result'; result: JobResult; ms: number }
  | { id: string; type: 'error'; message: string };
