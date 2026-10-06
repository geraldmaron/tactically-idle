import { baseFamilyIdV7 } from '../../building';
import { buildLocation } from '../../../sim/location';
import { pendingDebrief } from '../../../sim/operation-selectors';
import { hashSeed } from '../../../sim/rng';
import { deserialize, serialize } from '../../../sim/save';
import { getScenario } from '../../../sim/scenario-registry';
import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../../sim/scenario-types';
import { routeBetween } from '../../../sim/spatial-factors';
import { validateStoryBindings } from '../../../sim/story-bindings';
import type { BuiltLocation, GameState, Id, Vec } from '../../../sim/types';
import { generateIncident, incidentId } from '../index';
import { GATE_CONTENT_VERSION, specForSituation } from './catalog';
import type { Variant } from './catalog';
import { applyNaturalMove, firstMove, NOW, startPractice } from './engine-driver';

/** Playability gate (docs/content-pipeline.md): binding, squad reachability and real
 * dispatch journeys with a save and reload after every step. */

/** Squads move between staging points, so a spot counts as reachable when a route exists
 * from a staging point in the entry zone to that spot (as in v10-locations.test.ts). */
export function reachableFromEntry(built: BuiltLocation, spaceId: Id, at: Vec): boolean {
  const entry = built.location.entries[0];
  return built.derived.stagingPoints.filter(point => point.spaceId === entry)
    .some(start => routeBetween(built, entry, start.at, spaceId, at, null).reachable);
}

/** Problems with one generated call: binding errors, and people squads cannot reach. */
export function bindingProblems(s: ScenarioDefinition): string[] {
  const built = buildLocation(s.locationFamilyId, s.locationSeed);
  const problems = [...built.issues.filter(issue => issue.severity === 'error').map(issue => `${issue.code}: ${issue.message}`), ...validateStoryBindings(s, built)];
  for (const person of Object.values(s.story?.bindings.people ?? {})) {
    if (!reachableFromEntry(built, person.initial.spaceId, person.initial.at)) problems.push(`${person.id} starts in ${person.initial.spaceId}, which squads cannot reach`);
    if (person.reported && !reachableFromEntry(built, person.reported.spaceId, person.reported.at)) problems.push(`${person.id} is reported in ${person.reported.spaceId}, which squads cannot reach`);
  }
  return problems;
}

export interface HostingReport { type: IncidentType; familyId: string; total: number; hosted: number; problems: string[] }
/** Generate `count` buildings of one type for a framework at the current version. Every
 * call must bind and be reachable wherever it lands; `hosted` counts calls that play on
 * the drawn building seed (the 30% listing rule), not on a fallback building. */
export function hostingReport(type: IncidentType, familyId: string, count = 50): HostingReport {
  const report: HostingReport = { type, familyId, total: count, hosted: 0, problems: [] };
  for (let i = 0; i < count; i++) {
    const spec: IncidentSpec = { type, familyId, buildingSeed: hashSeed(`${familyId}:${i}:gate-building`), seed: hashSeed(`${type}:${i}:gate-call`), tier: 2, contentVersion: GATE_CONTENT_VERSION };
    let s: ScenarioDefinition;
    try { s = generateIncident(spec); } catch (error) { report.problems.push(`${incidentId(spec)}: ${String(error).slice(0, 160)}`); continue; }
    if (s.locationSeed === spec.buildingSeed && baseFamilyIdV7(s.locationFamilyId) === familyId) report.hosted++;
    for (const problem of bindingProblems(s)) report.problems.push(`${incidentId(spec)}: ${problem}`);
  }
  return report;
}

/** Order-independent comparison that, like a save file, ignores undefined fields. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.entries(entry as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
    : entry);
}

export interface JourneyResult { id: string; campaignSeed: number | null; steps: string[]; endingId: string | null; completed: boolean; saveRoundTrips: number; problems: string[] }
/** One untouched run: the engine's own dice from a campaign seed, the first eligible step
 * each time (then a stage continuation, then the failed-response report), with a save and
 * reload after every step that must restore the run exactly. */
function playOnce(id: string, campaignSeed: number, checkSaves: boolean): JourneyResult {
  const result: JourneyResult = { id, campaignSeed, steps: [], endingId: null, completed: false, saveRoundTrips: 0, problems: [] };
  let state: GameState = startPractice(id, campaignSeed);
  for (let step = 0; step < 40 && state.activeRun!.status === 'active'; step++) {
    const move = firstMove(state);
    if (!move) { result.problems.push(`stuck at ${state.activeRun!.stage} with no move`); break; }
    const after = applyNaturalMove(state, move);
    if (!after) { result.problems.push(`the engine refused ${move.actionId}`); break; }
    result.steps.push(move.kind === 'decide' ? `${move.actionId} (${after.activeRun!.history.at(-1)!.band})` : move.kind);
    if (!checkSaves) { state = after; continue; }
    const restored = deserialize(serialize(after, NOW));
    result.saveRoundTrips++;
    if (!restored || canonical(restored.activeRun) !== canonical(after.activeRun)) { result.problems.push(`save and reload changed the run after ${move.actionId}`); break; }
    state = restored;
  }
  const run = state.activeRun!;
  if (run.status !== 'debrief') result.problems.push(`ended in status ${run.status}, not debrief`);
  const debrief = pendingDebrief(state);
  result.endingId = run.endingId; result.completed = !!debrief?.completionAchieved;
  if (debrief && (debrief.fundingReward !== 0 || debrief.devPointReward !== 0)) result.problems.push('practice paid a reward');
  return result;
}

/** Play `id` until a run reaches the wanted kind of ending: 'complete' (the agreed step done)
 * or 'fail' (closed through the failed-response report). Campaign seeds are tried in order,
 * so the dice stay the engine's and every save is a valid save; the run found is then
 * replayed with a save and reload after every step. */
export function journey(id: string, mode: 'complete' | 'fail', seeds = 6000): JourneyResult {
  let last: JourneyResult | null = null;
  for (let campaignSeed = 1; campaignSeed <= seeds; campaignSeed++) {
    const run = playOnce(id, campaignSeed, false);
    if (run.problems.length) return playOnce(id, campaignSeed, true);
    const wanted = mode === 'complete' ? run.completed && run.endingId !== 'handed_over' : !run.completed && run.endingId === 'handed_over' && run.steps.includes('fail');
    if (wanted) return playOnce(id, campaignSeed, true);
    last = run;
  }
  return { ...last!, campaignSeed: null, problems: [`no campaign seed up to ${seeds} reached a ${mode === 'complete' ? 'completed' : 'failed-response'} ending`] };
}

/** The journeys a framework must pass on one building type: each situation completes, and
 * each situation's failed response closes honestly as unfinished. */
export function frameworkJourneys(type: IncidentType, familyId: string, variants: readonly Variant[] = [0, 1, 2]): JourneyResult[] {
  return variants.flatMap(variant => {
    const id = incidentId(specForSituation(type, familyId, variant));
    if (!getScenario(id)) return [{ id, campaignSeed: null, steps: [], endingId: null, completed: false, saveRoundTrips: 0, problems: ['does not generate'] }];
    return [journey(id, 'complete'), journey(id, 'fail')];
  });
}
