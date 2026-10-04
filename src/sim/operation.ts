import { reserveSupportVehicle, supportStartCheck } from './support-vehicles';
import { currentStoryPrompt } from './story-context';
import { storyMovedAlongRoute } from './story-people';
import { validateStoryBindings } from './story-bindings';
import { applyIncidentConsequences, civilianOutcomeViews } from './incident-consequences';
import { applyExternalSupportEffects, completionEvidence, COMPLETION_DISPOSITIONS, hasCompletionConditions, MAX_EXTERNAL_RESPONSE_MINUTES } from './external-support';
// Operation engine: start, cancel, decide, closeDebrief. The run record is the
// save: every committed decision stores its sample and result, so resuming never
// rerolls. Resolution math lives in resolution.ts; content in content/scenarios.
import type {
  BuiltLocation,
  Command,
  DebriefResult,
  DecisionResolution,
  DecisionView,
  GameState,
  HandlerMap,
  ItemUnit,
  HandlerResult,
  Id,
  KnowledgeStatus,
  OperationCommandType,
  OperationRun,
  OutcomeBand,
  OpeningState,
  SquadId,
  StageId,
  Vec,
} from './types';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import { scenarioActions } from './scenario-types';
import { getScenario } from './scenario-registry';
import { INCIDENT_TUNING, takeIncident } from './incidents';
import { ITEMS } from '../content/items';
import { legacyItemDefinition } from './compatibility/retirement';
import { hashSeed, next } from './rng';
import { deployability, fullName } from './officer';
import { releaseRun, reserveLoadouts, settleRun, squadUnits } from './inventory';
import { withStandardRadios } from './standard-kit';
import { spaceAt, stagingPointById } from './spatial';
import { centroidOf, defaultStagingFor, reachableOverGround } from './spatial-factors';
import {
  bandFor,
  builtFor,
  conditionHolds,
  evaluateAction,
  getBuilt,
  openingFlag,
  openingOverrides,
  practiceUnits,
  spaceName,
  squadLabel,
  strainFor,
  vantageZones,
  type Evaluation,
} from './resolution';

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const STAGES: StageId[] = ['assess', 'adapt', 'resolve'];
/** Outcome factor (objective and civilian safety blended) at or above which a run counts as favorable for careers. */
export const CAREER_FAVORABLE_AT = 0.6;
/** Below this it counts as adverse. Between the two it counts as an operation only. */
export const CAREER_ADVERSE_BELOW = 0.4;
/** V4 partial service retains credit, but unfinished responsibility cannot earn full settlement. */
export const INCOMPLETE_SERVICE_FACTOR_MAX = 0.65;
/** Ending used when a stage runs out of options (every scenario must define it). */
export const FALLBACK_ENDING = 'handed_over';

// ---------------------------------------------------------------- scenario checks

/** Authoring diagnostics for a scenario against its location. Errors block play. */
export function validateScenario(s: ScenarioDefinition, built: BuiltLocation): string[] {
  const errs: string[] = [];
  const spaces = built.derived.spaces;
  const factIds = new Set(s.facts.map((f) => f.id));
  const space = (id: Id, what: string) => {
    if (!spaces[id]) errs.push(`${s.id}: ${what} references unknown space ${id}`);
  };
  const fact = (id: Id, what: string) => {
    if (!factIds.has(id)) errs.push(`${s.id}: ${what} references unknown fact ${id}`);
  };
  if (s.squadRange.min < 1 || s.squadRange.max > 3 || s.squadRange.min > s.squadRange.max) errs.push(`${s.id}: squad range must sit within 1..3`);
  if (!s.endings[FALLBACK_ENDING]) errs.push(`${s.id}: missing fallback ending ${FALLBACK_ENDING}`);
  const serviceIds = new Set((s.externalServices ?? []).map((service) => service.id));
  if (s.version >= 4) {
    if (serviceIds.size !== (s.externalServices ?? []).length) errs.push(`${s.id}: duplicate external service`);
    for (const service of s.externalServices ?? []) {
      if (!service.id || !service.label.trim() || !service.kind.trim() || !service.description.trim()) errs.push(`${s.id}: external service needs a name, kind and description`);
      if (!Number.isFinite(service.arrivalMinutes) || service.arrivalMinutes <= 0 || service.arrivalMinutes > MAX_EXTERNAL_RESPONSE_MINUTES || round1(service.arrivalMinutes) !== service.arrivalMinutes)
        errs.push(`${s.id}: external response time must be between 0.1 and ${MAX_EXTERNAL_RESPONSE_MINUTES} minutes at one decimal precision`);
      for (const requirement of service.acceptWhen?.facts ?? []) fact(requirement.factId, `service ${service.id} acceptance`);
    }
    for (const ending of Object.values(s.endings)) {
      if (!ending.disposition || !COMPLETION_DISPOSITIONS.includes(ending.disposition)) errs.push(`${s.id}: ending ${ending.id} needs an explicit disposition`);
      if (['resolved', 'care_accepted', 'followup_agreed'].includes(ending.disposition ?? '') && !hasCompletionConditions(ending)) errs.push(`${s.id}: ending ${ending.id} needs authored completion conditions`);
      if (ending.disposition === 'care_accepted' && !ending.completion?.acceptedServiceId) errs.push(`${s.id}: care ending ${ending.id} needs its receiving service`);
      if (ending.completion?.acceptedServiceId && !serviceIds.has(ending.completion.acceptedServiceId)) errs.push(`${s.id}: ending ${ending.id} has an unknown receiver`);
      for (const requirement of ending.completion?.facts ?? []) fact(requirement.factId, `ending ${ending.id} completion`);
    }
    if (s.endings[FALLBACK_ENDING]?.disposition !== 'unresolved') errs.push(`${s.id}: exhausted choices must end unresolved`);
  }
  for (const f of s.facts) {
    space(f.spaceId, `fact ${f.id}`);
    if (!f.claim.trim()) errs.push(`${s.id}: fact ${f.id} has no claim sentence`);
    for (const [label, at] of [['position', f.person?.at], ['reported position', f.person?.reportedAt]] as const) {
      const floor = s.version >= 5 ? built.location.rooms.find(room => room.id === f.spaceId)?.floor ?? 0 : 0;
      if (at && spaceAt(built, at, floor) !== f.spaceId) errs.push(`${s.id}: fact ${f.id} ${label} is not inside ${f.spaceId}`);
    }
  }
  const seen = new Set<Id>();
  for (const stage of STAGES) {
    const st = s.stages[stage];
    if (!st || st.actions.length === 0) {
      errs.push(`${s.id}: stage ${stage} has no actions`);
      continue;
    }
    const always = st.actions.some((a) => !a.requires.certs && !a.requires.anyTags && !a.requires.allTags && !a.requires.minSquads && !a.requires.facts && !a.requires.flags && !a.requires.openings && !a.consumes);
    if (!always) errs.push(`${s.id}: stage ${stage} has no always-available action`);
    for (const a of st.actions) {
      if (seen.has(a.id)) errs.push(`${s.id}: duplicate action id ${a.id}`);
      seen.add(a.id);
      if (a.stage !== stage) errs.push(`${a.id}: declared stage ${a.stage} but listed under ${stage}`);
      if (s.version >= 4) {
        if (a.commandOnly && (a.approach !== 'none' || a.consumes?.length || a.check.kind === 'execution' || Object.values(a.outcomes).flat().some(effect => effect.officerHarm))) errs.push(`${a.id}: command decisions cannot perform field work or cause injury`);
        for (const requirement of a.requires.externalSupport ?? []) if (!serviceIds.has(requirement.serviceId)) errs.push(`${a.id}: unknown required service ${requirement.serviceId}`);
        if (a.awaitSupport && !serviceIds.has(a.awaitSupport)) errs.push(`${a.id}: unknown service to await ${a.awaitSupport}`);
        const requests = Object.values(a.outcomes).flat().flatMap((effect) => effect.requestSupport ?? []);
        const accepts = Object.values(a.outcomes).flat().flatMap((effect) => effect.acceptSupport ?? []);
        if (requests.some((id) => accepts.includes(id))) errs.push(`${a.id}: a request cannot also accept responsibility`);
        for (const id of accepts) if (!a.requires.externalSupport?.some((requirement) => requirement.serviceId === id && requirement.status === 'available')) errs.push(`${a.id}: acceptance requires its available receiving service`);
        if (a.awaitSupport && (a.approach !== 'none' || a.consumes?.length)) errs.push(`${a.id}: waiting must be remote and cannot consume supplies`);
      }
      space(a.targetId, `action ${a.id}`);
      for (const id of a.capacityBound ?? []) space(id, `action ${a.id} capacityBound`);
      for (const id of a.workload.areaSpaces ?? []) space(id, `action ${a.id} areaSpaces`);
      if (a.support) space(a.support.coverSpaceId, `action ${a.id} support`);
      if (a.spatial?.subjectFactId) fact(a.spatial.subjectFactId, `action ${a.id} spatial subject`);
      if (a.entry?.subjectFactId) fact(a.entry.subjectFactId, `action ${a.id} entry subject`);
      for (const oid of [a.spatial?.openingId, a.support?.openingId]) if (oid && !built.location.openings.some((x) => x.id === oid)) errs.push(`${a.id}: unknown opening ${oid}`);
      if (a.spatial && a.approach !== 'none' && a.approach !== 'window' && a.approach !== 'path') errs.push(`${a.id}: spatial action needs an approach`);
      for (const o of a.requires.openings ?? []) if (!built.location.openings.some((x) => x.id === o.openingId)) errs.push(`${a.id}: unknown opening ${o.openingId}`);
      if (a.approach === 'window' && spaces[a.targetId] && vantageZones(built.location, a.targetId).length === 0)
        errs.push(`${a.id}: no exterior opening onto ${a.targetId} for a window approach`);
      if (a.check.kind !== 'execution' && a.check.ratings.some((r) => r.key === 'shooting' && r.weight > 0)) errs.push(`${a.id}: shooting counts only toward execution checks`);
      if (a.check.ratings.every((r) => r.weight <= 0)) errs.push(`${a.id}: no relevant ratings`);
      for (const f of a.requires.facts ?? []) fact(f.factId, `action ${a.id}`);
      for (const f of a.visibleWhen?.facts ?? []) fact(f.factId, `action ${a.id} visibility`);
      for (const m of a.modifiers ?? []) for (const f of m.when.facts ?? []) fact(f.factId, `action ${a.id} modifier`);
      for (const band of ['favorable', 'mixed', 'adverse'] as OutcomeBand[]) {
        const effects = a.outcomes[band];
        if (!effects) {
          errs.push(`${a.id}: missing ${band} outcome`);
          continue;
        }
        for (const e of effects) {
          if (s.version >= 4) {
            if (e.officerHarm && (!['wounded', 'serious'].includes(e.officerHarm.severity) || !e.officerHarm.label.trim())) errs.push(`${a.id}: invalid officer injury`);
            if (e.officerCare === 'stabilize' && (!a.requires.certs?.includes('advanced_first_aid') || !a.consumes?.some(use => use.tag === 'medkit' && use.qty >= 1))) errs.push(`${a.id}: field care needs a first aider and trauma kit`);
            if (e.officerCare === 'evacuate' && !s.externalServices?.some(service => service.kind === 'medical' && e.acceptSupport?.includes(service.id))) errs.push(`${a.id}: injured officers need an explicit medical receiver`);
            for (const id of [...e.requestSupport ?? [], ...e.acceptSupport ?? []]) if (!serviceIds.has(id)) errs.push(`${a.id}: unknown external service ${id}`);
            if (effects.some((effect) => effect.requestSupport?.length) && (e.ending || e.objective)) errs.push(`${a.id}: requesting support cannot complete or reward the objective`);
            if (a.awaitSupport && e.extraMinutes) errs.push(`${a.id}: a response wait must use exactly the remaining time`);
          }
          for (const k of e.knowledge ?? []) fact(k.factId, `action ${a.id} outcome`);
          for (const id of e.reveal ?? []) fact(id, `action ${a.id} reveal`);
          for (const entry of e.truth ?? []) fact(entry.factId, `action ${a.id} truth`);
          for (const f of e.when?.facts ?? []) fact(f.factId, `action ${a.id} outcome`);
          if (e.ending && !s.endings[e.ending]) errs.push(`${a.id}: unknown ending ${e.ending}`);
          for (const o of e.openings ?? []) if (!built.location.openings.some((x) => x.id === o.openingId)) errs.push(`${a.id}: unknown opening ${o.openingId}`);
          if (e.storyExitState && (s.version < 5 || !a.storyRoute || !s.story?.bindings.routes[a.storyRoute])) errs.push(`${a.id}: a story exit change needs a bound movement route`);
        }
        if (stage === 'resolve' && !effects.some((e) => (e.ending || (s.version >= 3 && e.stage === 'resolve')) && !e.when && !e.truth)) errs.push(`${a.id}: resolve action must always reach an ending (${band})`);
      }
    }
  }
  return [...errs, ...validateStoryBindings(s, built)];
}

// ---------------------------------------------------------------- start

export function initialKnowledge(s: ScenarioDefinition): Record<Id, KnowledgeStatus> {
  const k: Record<Id, KnowledgeStatus> = {};
  for (const f of s.facts) k[f.id] = f.initial;
  return k;
}

export interface StartCheck {
  issues: string[];
  warnings: string[];
  scenario: ScenarioDefinition | null;
  built: BuiltLocation | null;
}

type StartCmd = Extract<Command, { type: 'startOperation' }>;

/** Everything startOperation validates, without mutating. Selectors reuse it. */
export function checkStart(state: GameState, now: number, cmd: StartCmd): StartCheck {
  const issues: string[] = [];
  const warnings: string[] = [];
  const scenario = getScenario(cmd.scenarioId);
  let built: BuiltLocation | null = null;
  if (state.activeRun) issues.push('An operation is already in progress');
  if (!scenario) {
    issues.push(`Unknown operation ${cmd.scenarioId}`);
    return { issues, warnings, scenario, built };
  }
  if (scenario.incident && !cmd.practice && !state.incidents?.some((c) => c.id === scenario.id && c.expiresAt > Math.max(now, state.department.clockHighWater))) {
    issues.push('This incident is no longer on the board. Replay it in practice.');
  }
  if (scenario.practiceOnly && !cmd.practice) issues.push('This training exercise is practice only');
  issues.push(...supportStartCheck(state, now, cmd));
  const ids = cmd.squadIds;
  if (ids.length < 1) issues.push('Choose at least one squad');
  if (ids.length > 3) issues.push('At most three squads can deploy');
  if (new Set(ids).size !== ids.length) issues.push('A squad cannot be deployed twice');
  if (ids.length >= 1 && (ids.length < scenario.squadRange.min || ids.length > scenario.squadRange.max))
    issues.push(`${scenario.code} takes ${scenario.squadRange.min === scenario.squadRange.max ? scenario.squadRange.min : `${scenario.squadRange.min} to ${scenario.squadRange.max}`} squad${scenario.squadRange.max === 1 ? '' : 's'}`);

  const seenOfficers = new Map<Id, SquadId>();
  for (const sid of new Set(ids)) {
    const squad = state.squads.find((s) => s.id === sid);
    if (!squad) {
      issues.push(`${squadLabel(sid)} does not exist`);
      continue;
    }
    if (squad.officerIds.length === 0) issues.push(`${squadLabel(sid)} has no officers`);
    for (const oid of squad.officerIds) {
      const o = state.officers[oid];
      if (!o) {
        issues.push(`${squadLabel(sid)} lists an unknown officer`);
        continue;
      }
      const prev = seenOfficers.get(oid);
      if (prev) issues.push(`${fullName(o)} is in both ${squadLabel(prev)} and ${squadLabel(sid)}`);
      seenOfficers.set(oid, sid);
      if (cmd.practice) {
        if (o.assignment?.kind === 'training') issues.push(`${squadLabel(sid)}: ${o.surname} is in training`);
        else if (o.assignment?.kind === 'operation') issues.push(`${squadLabel(sid)}: ${o.surname} is already deployed`);
      } else {
        const d = deployability(o, now);
        if (!d.ok) issues.push(`${squadLabel(sid)}: ${d.reason}`);
      }
    }
  }

  try {
    built = getBuilt(scenario.locationFamilyId, scenario.locationSeed);
  } catch (e) {
    issues.push(`Location unavailable: ${(e as Error).message}`);
  }
  if (built) {
    const errs = built.issues.filter((i) => i.severity === 'error');
    if (errs.length) issues.push(`Location failed validation: ${errs[0].message}`);
    for (const e of validateScenario(scenario, built)) issues.push(`Scenario error: ${e}`);
    for (const sid of ids) {
      const pos = cmd.positions[sid];
      if (!pos) issues.push(`Choose a starting point for ${squadLabel(sid)}`);
      else if (!built.location.entries.includes(pos)) issues.push(`${squadLabel(sid)} cannot start from that location`);
      else {
        const st = resolveStart(built, cmd, sid);
        if ('error' in st) issues.push(st.error);
      }
    }
    for (const sid of Object.keys(cmd.staging ?? {}) as SquadId[]) if (!ids.includes(sid)) issues.push(`Staging given for ${squadLabel(sid)}, which is not deployed`);
  }

  if (!cmd.practice) {
    const standard = withStandardRadios(state, ids, cmd.loadouts, cmd.units, now);
    if (standard.issue) issues.push(standard.issue);
    cmd = { ...cmd, loadouts: standard.loadouts, units: standard.units };
    for (const sid of Object.keys(cmd.units ?? {}) as SquadId[]) if (!ids.includes(sid)) issues.push(`Equipment given for ${squadLabel(sid)}, which is not deployed`);
    for (const sid of Object.keys(cmd.loadouts) as SquadId[]) if (!ids.includes(sid)) issues.push(`Loadout given for ${squadLabel(sid)}, which is not deployed`);
    const probe = structuredClone(state);
    const r = reserveLoadouts(probe, 'probe', cmd.loadouts, cmd.units, now);
    if (!r.ok && !standard.issue) issues.push(r.reason);
  }

  if (issues.length === 0 && built) warnings.push(...startWarnings(state, now, scenario, built, cmd));
  return { issues, warnings, scenario, built };
}

function startWarnings(state: GameState, now: number, scenario: ScenarioDefinition, built: BuiltLocation, cmd: StartCmd): string[] {
  const out: string[] = [];
  const probe = structuredClone(state);
  const unitOverride = {} as Record<SquadId, ItemUnit[]>;
  if (!cmd.practice) reserveLoadouts(probe, 'preview', cmd.loadouts, cmd.units, now);
  for (const sid of cmd.squadIds) unitOverride[sid] = cmd.practice ? practiceUnits(state) : squadUnits(probe, 'preview', sid);
  const run = makeRun(state, built, scenario, cmd, 'preview', 0, 0);
  for (const a of scenarioActions(scenario)) {
    const perm: OperationRun = { ...run, knowledge: { ...run.knowledge }, flags: [...run.flags] };
    for (const f of a.requires.flags ?? []) perm.flags.push(f.flag);
    for (const f of a.requires.facts ?? []) perm.knowledge[f.factId] = f.in[0];
    const evs = cmd.squadIds.map((sid) =>
      evaluateAction({ state: probe, run: perm, scenario, action: a, built, acting: [sid], support: defaultSupport(perm, a, [sid]), unitOverride }),
    );
    if (evs.length > 0 && evs.every((e) => !e.eligible)) {
      const best = evs[0];
      out.push(`${a.title}: ${best.reason}`);
    }
  }
  if (cmd.squadIds.length > 1 && !cmd.practice) {
    for (const sid of cmd.squadIds) {
      const hasKit = unitOverride[sid].some((u) => ITEMS[u.itemId]?.tags.includes('comms_kit'));
      if (!hasKit) out.push(`${squadLabel(sid)} has no radio kit: coordination with other squads will be slower`);
    }
  }
  return out;
}

/**
 * Where a squad starts: its position zone plus a staging point. A chosen staging point
 * must lie in that zone, or on open ground reachable from it (the squad then starts
 * there). The default is the nearest door staging point to the position.
 */
export function resolveStart(built: BuiltLocation, cmd: StartCmd, sid: SquadId): { positionId: Id; stagingId: Id | null; at: Vec } | { error: string } {
  const pos = cmd.positions[sid] ?? '';
  const chosen = cmd.staging?.[sid];
  if (chosen) {
    const sp = stagingPointById(built, chosen);
    if (!sp) return { error: `${squadLabel(sid)}: unknown staging point` };
    if (sp.spaceId === pos) return { positionId: pos, stagingId: sp.id, at: sp.at };
    const isZone = built.location.zones.some((z) => z.id === sp.spaceId);
    if (isZone && reachableOverGround(built, pos, sp.spaceId)) return { positionId: sp.spaceId, stagingId: sp.id, at: sp.at };
    return { error: `${squadLabel(sid)} cannot stage there: that point is not in the ${spaceName(built, pos).toLowerCase()} or on open ground reachable from it` };
  }
  const sp = defaultStagingFor(built, pos);
  return sp ? { positionId: pos, stagingId: sp.id, at: sp.at } : { positionId: pos, stagingId: null, at: centroidOf(built, pos) };
}

function makeRun(state: GameState, built: BuiltLocation, scenario: ScenarioDefinition, cmd: StartCmd, runId: Id, rngState: number, now: number): OperationRun {
  return {
    id: runId,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    ...(!cmd.practice && state.incidents?.some((c) => c.id === scenario.id)
      ? { sourceIncident: structuredClone(state.incidents.find((c) => c.id === scenario.id)!) }
      : {}),
    locationFamilyId: scenario.locationFamilyId,
    locationSeed: scenario.locationSeed,
    contentVersion: state.contentVersion,
    rngState,
    practice: cmd.practice,
    squadIds: [...cmd.squadIds],
    squadTasks: cmd.squadIds.map((sid) => {
      const st = resolveStart(built, cmd, sid);
      return 'error' in st ? { squadId: sid, positionId: cmd.positions[sid] ?? '', task: 'Staging', stagingId: null, at: null } : { squadId: sid, positionId: st.positionId, task: 'Staging', stagingId: st.stagingId, at: st.at };
    }),
    reservationIds: [],
    supportUnitIds: [...cmd.supportUnitIds ?? []],
    supportPositionId: cmd.positions[cmd.squadIds[0]],
    stage: 'assess',
    knowledge: initialKnowledge(scenario),
    flags: [],
    ...(scenario.version >= 4 ? { externalSupport: {} } : {}),
    clock: 0,
    pressure: scenario.pressure.start,
    objective: 0,
    civilianSafety: 100,
    history: [],
    revision: 0,
    status: 'active',
    endingId: null,
    settled: false,
    startedAt: now,
  };
}

// ---------------------------------------------------------------- effects and time

/** Advance operation time: pressure rises; civilian safety falls above the threshold. */
export function advanceTime(run: Pick<OperationRun, 'clock' | 'pressure' | 'civilianSafety'>, s: ScenarioDefinition, minutes: number): { civilianLoss: number; crossed: boolean } {
  const m = s.pressure;
  const p0 = run.pressure;
  let over = 0;
  if (p0 >= m.threshold) over = minutes;
  else if (m.perMinute > 0) over = Math.max(0, minutes - (m.threshold - p0) / m.perMinute);
  const loss = round1(over * m.civilianPerMinute);
  run.clock = round1(run.clock + minutes);
  run.pressure = round1(clamp(p0 + m.perMinute * minutes, 0, 100));
  run.civilianSafety = round1(clamp(run.civilianSafety - loss, 0, 100));
  return { civilianLoss: loss, crossed: p0 < m.threshold && run.pressure >= m.threshold };
}

/** Hidden truth is consulted only when committing/replaying an outcome, never in previews. */
export function matchedEffects(action: ActionDefinition, band: OutcomeBand, run: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure'>, scenario: ScenarioDefinition): OutcomeEffect[] {
  return action.outcomes[band]
    .filter((effect) => conditionHolds(effect.when, run) && (effect.truth ?? []).every((entry) => scenario.facts.find((fact) => fact.id === entry.factId)?.truth === entry.is))
    .map((effect) => effect.reveal?.length ? { ...effect, knowledge: [...effect.knowledge ?? [], ...effect.reveal.map((factId) => ({ factId, status: scenario.facts.find((fact) => fact.id === factId)?.truth ? 'confirmed' as const : 'disproved' as const }))] } : effect);
}

/** Resolve an authored exit change from this evaluation's route, never a stale binding path. */
function storyExitEffects(scenario: ScenarioDefinition, action: ActionDefinition, built: BuiltLocation, effects: OutcomeEffect[], personMoved: boolean): OutcomeEffect[] {
  if (!personMoved || scenario.version < 5 || !action.storyRoute || !effects.some(effect => effect.storyExitState)) return effects;
  const route = scenario.story?.bindings.routes[action.storyRoute];
  if (!route) return effects;
  const rooms = new Set(built.location.rooms.map(room => room.id));
  const exterior = new Set(built.location.zones.map(zone => zone.id));
  let current = route.fromSpaceId;
  let exitId: Id | null = null;
  for (const { openingId } of action.requires.openings ?? []) {
    const opening = built.location.openings.find(opening => opening.id === openingId);
    if (!opening) return effects;
    const next = opening.a === current ? opening.b : opening.b === current ? opening.a : null;
    if (!next) return effects;
    if (rooms.has(current) && exterior.has(next) && ['door', 'doorway', 'sliding'].includes(opening.type)) exitId = openingId;
    current = next;
  }
  if (!exitId || current !== route.toSpaceId || effects.some(effect => effect.openings?.some(change => change.openingId === exitId))) return effects;
  const openingId = exitId;
  return effects.map(effect => effect.storyExitState ? { ...effect, openings: [...effect.openings ?? [], { openingId, state: effect.storyExitState }] } : effect);
}

const RANK: Record<KnowledgeStatus, number> = { unknown: 0, reported: 1, confirmed: 2, disproved: 2 };

/** Apply matched effects to run state. Knowledge only moves forward. */
function applyEffects(
  run: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure' | 'objective' | 'civilianSafety'>,
  effects: OutcomeEffect[],
): { changes: { factId: Id; status: KnowledgeStatus }[]; stage: StageId | null; ending: Id | null } {
  const changes: { factId: Id; status: KnowledgeStatus }[] = [];
  let stage: StageId | null = null;
  let ending: Id | null = null;
  for (const e of effects) {
    for (const k of e.knowledge ?? []) {
      const cur = run.knowledge[k.factId] ?? 'unknown';
      if (RANK[k.status] > RANK[cur]) {
        run.knowledge[k.factId] = k.status;
        changes.push({ factId: k.factId, status: k.status });
      }
    }
    for (const f of e.setFlags ?? []) if (!run.flags.includes(f)) run.flags.push(f);
    for (const f of e.clearFlags ?? []) run.flags = run.flags.filter((x) => x !== f);
    for (const o of e.openings ?? []) {
      run.flags = run.flags.filter((x) => !x.startsWith(`opening:${o.openingId}=`));
      run.flags.push(openingFlag(o.openingId, o.state));
    }
    if (e.objective) run.objective = round1(clamp(run.objective + e.objective, 0, 100));
    if (e.civilian) run.civilianSafety = round1(clamp(run.civilianSafety + e.civilian, 0, 100));
    if (e.pressure) run.pressure = round1(clamp(run.pressure + e.pressure, 0, 100));
    if (e.stage) stage = e.stage;
    if (e.ending) ending = e.ending;
  }
  return { changes, stage, ending };
}

export interface StepTrace {
  resolution: DecisionResolution;
  action: ActionDefinition | null;
  band: OutcomeBand;
  objectiveDelta: number;
  civilianDelta: number;
  pressureDelta: number;
  /** Civilian safety lost to elapsed time above the pressure threshold. */
  pressureLoss: number;
  effects: OutcomeEffect[];
}

/** Re-derive each committed decision's deltas from stored bands. Deterministic. */
export function traceRun(scenario: ScenarioDefinition, run: OperationRun): { steps: StepTrace[]; end: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure' | 'objective' | 'civilianSafety' | 'clock'> } {
  const sim = { knowledge: initialKnowledge(scenario), flags: [] as string[], pressure: scenario.pressure.start, objective: 0, civilianSafety: 100, clock: 0 };
  const actions = new Map(scenarioActions(scenario).map((a) => [a.id, a]));
  const steps: StepTrace[] = [];
  for (const resupply of run.resupplies ?? []) advanceTime(sim, scenario, resupply.minutes);
  for (const h of run.history) {
    const a = actions.get(h.actionId) ?? null;
    const matched = a ? matchedEffects(a, h.band, sim, scenario) : [];
    const pressure0 = sim.pressure;
    const obj0 = sim.objective;
    const civ0 = sim.civilianSafety;
    advanceTime(sim, scenario, h.timeCost);
    const civAfterTime = sim.civilianSafety;
    applyEffects(sim, matched);
    // Saved v3 deltas are authoritative, including clamping. Older histories retain
    // the original replay through their versioned content and stored outcome bands.
    if (h.committed) {
      if (scenario.version >= 5 && h.committed.openingChanges) applyEffects(sim, [{ openings: h.committed.openingChanges }]);
      sim.objective = round1(clamp(obj0 + h.committed.objectiveDelta, 0, 100));
      sim.civilianSafety = round1(clamp(civ0 + h.committed.civilianSafetyDelta, 0, 100));
      sim.pressure = round1(clamp(pressure0 + h.committed.pressureDelta, 0, 100));
      for (const change of h.knowledgeChanges) sim.knowledge[change.factId] = change.status;
    }
    steps.push({
      resolution: h,
      action: a,
      band: h.band,
      objectiveDelta: round1(sim.objective - obj0),
      pressureDelta: round1(sim.pressure - pressure0),
      civilianDelta: round1(sim.civilianSafety - civ0),
      pressureLoss: round1(civ0 - civAfterTime),
      effects: matched,
    });
  }
  return { steps, end: sim };
}

/** Build a detached display snapshot from a versioned trace; safe to retain after closing the run. */
export function decisionViewsFor(state: GameState, run: OperationRun, scenario: ScenarioDefinition, steps = traceRun(scenario, run).steps): DecisionView[] {
  return steps.map((step) => {
    const record = step.resolution;
    const committed = record.committed;
    const ending = [...step.effects].reverse().find((effect) => effect.ending)?.ending ?? (record === run.history.at(-1) ? run.endingId : null);
    return {
      revision: record.revision, actionId: record.actionId,
      title: step.action?.title ?? record.actionId,
      stageLabel: scenario.stages[record.stage].label,
      band: record.band, explanation: [...record.explanation], timeCost: record.timeCost,
      ...(committed?.resultLabel ? { resultLabel: committed.resultLabel } : {}),
      objectiveDelta: committed?.objectiveDelta ?? step.objectiveDelta,
      civilianSafetyDelta: committed?.civilianSafetyDelta ?? step.civilianDelta,
      pressureDelta: committed?.pressureDelta ?? step.pressureDelta,
      actualStressDeltas: committed !== undefined || record.stressLevels !== undefined,
      stressDeltas: Object.entries(record.stressDeltas).map(([officerId, delta]) => {
        const levels = record.stressLevels?.[officerId];
        return {
          officerId, label: state.officers[officerId]?.surname ?? officerId,
          delta: levels ? round1(levels.stressAfter - levels.stressBefore) : delta,
          ...(levels ? { stressBefore: levels.stressBefore, stressAfter: levels.stressAfter } : {}),
        };
      }),
      supplies: record.itemsConsumed.filter((use) => legacyItemDefinition(use.itemId)?.kind === 'consumable').map((use) => ({ ...use, label: legacyItemDefinition(use.itemId)?.name ?? use.itemId })),
      knowledgeChanges: record.knowledgeChanges.map((change) => ({ ...change, label: scenario.facts.find((fact) => fact.id === change.factId)?.label ?? change.factId })),
      contributors: record.inputs.map((input) => ({ ...input })),
      consequences: committed ? [...committed.consequences] : step.effects.map((effect) => effect.text).filter((text): text is string => !!text),
      ...(committed?.officerCasualties !== undefined ? { officerCasualties: committed.officerCasualties.map(person => ({ ...person })) } : {}),
      endingTitle: committed ? committed.endingTitle : (ending ? scenario.endings[ending]?.title ?? ending : null),
    };
  });
}

// ---------------------------------------------------------------- squad choice helpers

/** Default support squads for an action: every other deployed squad up to the rule's limit. */
export function defaultSupport(run: OperationRun, action: ActionDefinition, acting: SquadId[]): SquadId[] {
  if (!action.support) return [];
  return run.squadIds.filter((s) => !acting.includes(s)).slice(0, action.support.maxSquads);
}

/** Evaluate an action for a focus squad (or the best eligible squad when none is focused). */
export function evaluateDefault(state: GameState, run: OperationRun, scenario: ScenarioDefinition, built: BuiltLocation, action: ActionDefinition, focus: SquadId | null): { ev: Evaluation; alternates: SquadId[] } {
  const order = focus && run.squadIds.includes(focus) ? [focus, ...run.squadIds.filter((s) => s !== focus)] : [...run.squadIds];
  const evs = order.map((sq) => evaluateAction({ state, run, scenario, action, built, acting: [sq], support: defaultSupport(run, action, [sq]) }));
  const alternates = evs.filter((e, i) => i > 0 && e.eligible).map((e) => e.acting[0]);
  if (focus && run.squadIds.includes(focus)) return { ev: evs[0], alternates: evs[0].eligible ? [] : alternates };
  const eligible = evs.filter((e) => e.eligible).sort((a, b) => b.margin - a.margin);
  return { ev: eligible[0] ?? evs[0], alternates: [] };
}

function anyEligible(state: GameState, run: OperationRun, scenario: ScenarioDefinition, built: BuiltLocation): boolean {
  for (const a of scenario.stages[run.stage as StageId].actions) {
    if (run.history.some((h) => h.stage === run.stage && h.actionId === a.id)) continue;
    for (const sq of run.squadIds) {
      if (evaluateAction({ state, run, scenario, action: a, built, acting: [sq], support: defaultSupport(run, a, [sq]) }).eligible) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- explanation

const STATUS_WORD: Record<KnowledgeStatus, string> = { unknown: 'unknown', reported: 'reported, not confirmed', confirmed: 'confirmed', disproved: 'ruled out' };
const BAND_WORD: Record<OutcomeBand, string> = { favorable: 'went well', mixed: 'only partly worked', adverse: 'did not go as hoped' };

function explain(
  state: GameState,
  scenario: ScenarioDefinition,
  ev: Evaluation,
  band: OutcomeBand,
  texts: string[],
  timeCost: number,
  civilianLoss: number,
  changes: { factId: Id; status: KnowledgeStatus }[],
  consumed: { itemId: Id; qty: number }[],
  strain: Record<Id, number>,
  stageNote: string | null,
  practice: boolean,
): string[] {
  const out: string[] = [];
  const who = ev.acting.map(squadLabel).join(' + ') + (ev.support.length ? ` with ${ev.support.map(squadLabel).join(' + ')}` : '');
  out.push(`${ev.action.title} ${BAND_WORD[band]} (${who}).`);
  out.push(...texts);
  const body = ev.contributors.filter((c) => c.source !== 'difficulty' && c.value !== 0);
  const best = [...body].sort((a, b) => b.value - a.value)[0];
  const worst = [...body].sort((a, b) => a.value - b.value)[0];
  if (best && best.value >= 2) out.push(`Helped most: ${best.label} (+${round1(best.value)}).`);
  if (worst && worst.value <= -2) out.push(`Held back by: ${worst.label} (${round1(worst.value)}).`);
  for (const c of changes) {
    const f = scenario.facts.find((x) => x.id === c.factId);
    if (f) out.push(`${f.label}: now ${STATUS_WORD[c.status]}.`);
  }
  out.push(`Took ${timeCost} min.`);
  if (civilianLoss > 0) out.push(`Time pressure is past ${scenario.pressure.threshold}: civilian safety fell ${civilianLoss}.`);
  for (const c of consumed) out.push(`Used ${c.qty} ${ITEMS[c.itemId]?.name.toLowerCase() ?? c.itemId}.`);
  const top = Object.entries(strain).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 1) out.push(`Most strain: ${state.officers[top[0]]?.surname ?? top[0]} (+${top[1]}).`);
  if (practice) out.push('Practice run: nothing is recorded to the department.');
  if (stageNote) out.push(stageNote);
  return out;
}

// ---------------------------------------------------------------- debrief

const objectiveLabel = (n: number) => (n >= 80 ? 'Resolved' : n >= 60 ? 'Largely resolved' : n >= 35 ? 'Partly resolved' : 'Unresolved');
const civilianLabel = (n: number) => (n >= 90 ? 'Everyone safe' : n >= 70 ? 'Minor risk' : n >= 45 ? 'Safety was strained' : 'Serious risk');

export function outcomeFactor(run: Pick<OperationRun, 'objective' | 'civilianSafety'>): number {
  return clamp((0.55 * run.objective + 0.45 * run.civilianSafety) / 100, 0, 1);
}

/** Compute the debrief for a run in 'debrief' status without mutating state. */
export function computeDebrief(state: GameState, run: OperationRun): DebriefResult | null {
  const scenario = getScenario(run.scenarioId);
  if (!scenario || !run.endingId) return null;
  const ending = scenario.endings[run.endingId];
  if (!ending) return null;
  const { steps } = traceRun(scenario, run);
  const completion = scenario.version >= 4 ? completionEvidence(scenario, run, ending) : undefined;
  const factor = completion && !completion.completionAchieved ? Math.min(INCOMPLETE_SERVICE_FACTOR_MAX, outcomeFactor(run)) : outcomeFactor(run);

  // officers: stress from decisions is already on the officer; the ending adds its strain.
  const delta: Record<Id, number> = {};
  const participation: Record<Id, number> = {};
  for (const h of run.history) {
    for (const [id, d] of Object.entries(h.stressDeltas)) delta[id] = (delta[id] ?? 0) + d;
    for (const id of h.officerIds) participation[id] = (participation[id] ?? 0) + 1;
  }
  const officerCondition: DebriefResult['officerCondition'] = [];
  for (const sq of run.squadIds) {
    for (const id of state.squads.find((s) => s.id === sq)?.officerIds ?? []) {
      const o = state.officers[id];
      if (!o) continue;
      if (run.practice) {
        officerCondition.push({ officerId: id, stressBefore: o.stress, stressAfter: o.stress, xpGained: 0 });
        continue;
      }
      const after = clamp(round1(o.stress + ending.strain), 0, 100);
      const before = clamp(round1(o.stress - (delta[id] ?? 0)), 0, 100);
      const share = Math.min(1, 0.4 + 0.3 * (participation[id] ?? 0));
      const xp = Math.round(scenario.rewards.xp * share * (0.5 + 0.5 * factor));
      officerCondition.push({ officerId: id, stressBefore: before, stressAfter: after, xpGained: xp });
    }
  }

  // resources: settle on a throwaway clone so preview and commit agree.
  let resources: DebriefResult['resources'] = [];
  let unitWear: DebriefResult['unitWear'] = [];
  if (!run.practice) {
    const probe = structuredClone(state);
    ({ resources, unitWear } = settleRun(probe, run.id, unitsUsedTotals(run), 0));
  }

  const proposedTrust = run.practice ? 0 : Math.round(scenario.rewards.trust * (2 * factor - 1)) + ending.trustAdjust;
  const trustDelta = run.practice ? 0 : scenario.version >= 3 ? clamp(state.department.trust + proposedTrust, 0, 100) - state.department.trust : proposedTrust;
  const fundingReward = run.practice ? 0 : Math.round(scenario.rewards.funding * (0.4 + 0.6 * factor));
  const devPointReward = run.practice ? 0 : factor >= 0.6 && (!completion || completion.completionAchieved) ? scenario.rewards.devPoints : factor >= 0.4 ? Math.floor(scenario.rewards.devPoints / 2) : 0;
  const causes = debriefCauses(scenario, run, steps);
  if (scenario.version >= 3 && !run.practice) {
    const closingStrain = officerCondition.map((officer) => ({ ...officer, delta: round1(officer.stressAfter - (state.officers[officer.officerId]?.stress ?? officer.stressAfter)) })).filter((officer) => officer.delta !== 0);
    if (closingStrain.length) causes.unshift(`Ending adjustment at close: ${closingStrain.map((officer) => `${state.officers[officer.officerId]?.surname ?? officer.officerId} ${officer.delta > 0 ? '+' : ''}${officer.delta} strain`).join('; ')}.`);
  }

  return {
    runId: run.id,
    scenarioId: run.scenarioId,
    endingId: run.endingId,
    endingTitle: ending.title,
    decisions: decisionViewsFor(state, run, scenario, steps),
    ...(scenario.version >= 3 ? { endingSummary: ending.summary } : {}),
    ...completion,
    ...(scenario.version >= 4 ? { officerCasualties: Object.values(run.officerCasualties ?? {}).map(person => ({ ...person })), civilianOutcomes: civilianOutcomeViews(scenario, run) } : {}),
    practice: run.practice,
    objective: { score: Math.round(run.objective), label: completion ? ({ resolved: 'Resolved', care_accepted: 'Care accepted', followup_agreed: 'Follow-up agreed', relief_partial: 'Partial progress', unresolved: 'Unresolved' } as const)[completion.disposition!] : objectiveLabel(run.objective) },
    civilianSafety: { score: Math.round(run.civilianSafety), label: civilianLabel(run.civilianSafety) },
    officerCondition,
    informationPreserved: scenario.facts.map((f) => ({ factId: f.id, label: f.label, status: run.knowledge[f.id] ?? f.initial })),
    resources,
    unitWear,
    trustDelta,
    fundingReward,
    devPointReward,
    causes: causes.slice(0, 7),
  };
}

/** Every specific unit the run's decisions used, once each. */
export function unitsUsedTotals(run: OperationRun): Id[] {
  return [...new Set([...run.history.flatMap((h) => h.unitsUsed), ...(run.resupplies ?? []).flatMap((r) => r.supportUnitId ? [r.supportUnitId] : [])])];
}

export function consumedTotals(run: OperationRun): { itemId: Id; qty: number }[] {
  const tot: Record<Id, number> = {};
  for (const h of run.history) for (const c of h.itemsConsumed) tot[c.itemId] = (tot[c.itemId] ?? 0) + c.qty;
  return Object.entries(tot).map(([itemId, qty]) => ({ itemId, qty }));
}

function debriefCauses(scenario: ScenarioDefinition, run: OperationRun, steps: StepTrace[]): string[] {
  const scored: { w: number; text: string }[] = [];
  for (const s of steps) {
    const texts = s.effects.map((e) => e.text).filter((t): t is string => Boolean(t));
    const title = s.action?.title ?? s.resolution.actionId;
    const knowledge = s.resolution.knowledgeChanges.length;
    const w = Math.abs(s.objectiveDelta) + Math.abs(s.civilianDelta - 0) + 4 * knowledge + (s.band === 'adverse' ? 4 : 0);
    const text = texts.length ? `${title}: ${texts.join(' ')}` : `${title} ${BAND_WORD[s.band]}.`;
    scored.push({ w, text });
    if (s.pressureLoss > 0) scored.push({ w: s.pressureLoss + 2, text: `Time pressure passed ${scenario.pressure.threshold} during "${title}", costing ${s.pressureLoss} civilian safety.` });
  }
  const sorted = scored.sort((a, b) => b.w - a.w).map((s) => s.text);
  const unresolved = scenario.facts.filter((f) => ['unknown', 'reported'].includes(run.knowledge[f.id] ?? f.initial));
  for (const f of unresolved) sorted.push(`Never confirmed: ${f.label.toLowerCase()}.`);
  const head: string[] = run.practice ? ['Practice run: nothing here is recorded to the department.'] : [];
  const resupplyMinutes = (run.resupplies ?? []).reduce((sum, delivery) => sum + delivery.minutes, 0);
  if (resupplyMinutes > 0) head.push(`Equipment resupply took ${resupplyMinutes} min before the first decision; time pressure continued while squads waited.`);
  return [...head, ...sorted].slice(0, 7);
}

// ---------------------------------------------------------------- handlers

const fail = (reason: string): HandlerResult => ({ ok: false, reason });

export const OPERATION_HANDLERS: HandlerMap<OperationCommandType> = {
  startOperation(draft, cmd, ctx) {
    if (!cmd.practice) {
      const standard = withStandardRadios(draft, cmd.squadIds, cmd.loadouts, cmd.units, ctx.now);
      cmd = { ...cmd, loadouts: standard.loadouts, units: standard.units };
    }
    const chk = checkStart(draft, ctx.now, cmd);
    if (chk.issues.length > 0 || !chk.scenario) return fail(chk.issues[0] ?? 'Cannot start this operation');
    const scenario = chk.scenario;

    const runId = `run_${draft.nextId++}`;
    const d = next(draft.rngState);
    draft.rngState = d.state;
    const rngState = (hashSeed(`${scenario.id}:${scenario.locationSeed}`) ^ Math.floor(d.value * 4294967296)) >>> 0;
    const run = makeRun(draft, chk.built!, scenario, cmd, runId, rngState, ctx.now);

    if (!cmd.practice) {
      const before = draft.reservations.length;
      const r = reserveLoadouts(draft, runId, cmd.loadouts, cmd.units, ctx.now);
      if (!r.ok) return r;
      run.reservationIds = draft.reservations.slice(before).map((x) => x.id);
    }
    reserveSupportVehicle(draft, run);
    for (const sid of cmd.squadIds) {
      for (const oid of draft.squads.find((s) => s.id === sid)?.officerIds ?? []) {
        const o = draft.officers[oid];
        if (o) o.assignment = { kind: 'operation', runId };
      }
    }
    draft.activeRun = run;
    if (!cmd.practice) takeIncident(draft, scenario.id);
    return { ok: true };
  },

  cancelOperation(draft, _cmd, ctx) {
    const run = draft.activeRun;
    if (!run) return fail('No operation to cancel');
    if (run.status !== 'active') return fail('The operation is already over');
    if (run.history.length > 0) return fail('Cannot cancel after the first decision');
    if (run.resupplies?.length) return fail('Cannot cancel after equipment resupply; operation time has already advanced');
    releaseRun(draft, run.id);
    clearAssignments(draft, run);
    if (run.sourceIncident && run.sourceIncident.expiresAt > Math.max(ctx.now, draft.department.clockHighWater)) {
      // Give the player's cancelled call priority if idle arrivals filled the board.
      draft.incidents = [run.sourceIncident, ...draft.incidents.filter((c) => c.id !== run.scenarioId)].slice(0, INCIDENT_TUNING.boardMax);
    }
    draft.activeRun = null;
    return { ok: true };
  },

  decide(draft, cmd) {
    const run = draft.activeRun;
    if (!run) return fail('No operation in progress');
    if (run.status !== 'active' || run.stage === 'debrief') return fail('The operation is over; close the debrief');
    const scenario = getScenario(run.scenarioId);
    if (!scenario) return fail('Unknown scenario');
    const stage = run.stage;
    const action = scenario.stages[stage].actions.find((a) => a.id === cmd.actionId);
    if (!action) return fail('That option is not available at this stage');
    if (cmd.actingSquadIds.some((s) => cmd.supportSquadIds.includes(s))) return fail('A squad cannot both act and support');
    const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
    const input = { state: draft, run, scenario, action, built, acting: cmd.actingSquadIds, support: cmd.supportSquadIds };
    const ev = evaluateAction(input);
    if (!ev.eligible) return fail(ev.reason ?? 'Not available');

    // One saved sample per committed decision.
    const r = next(run.rngState);
    run.rngState = r.state;
    const sample = r.value;
    const band = bandFor(ev.margin, sample);

    let matched = matchedEffects(action, band, run, scenario);
    let personMoved = false;
    let storyRouteUsed = false;
    if (ev.storyMovementMinutes !== undefined) {
      const projected = structuredClone(run);
      applyEffects(projected, matched);
      personMoved = storyMovedAlongRoute(scenario, action, run, projected);
      storyRouteUsed = action.storyRouteActor === 'external_support' ? matched.some(effect => !!effect.acceptSupport?.length) : personMoved;
    }
    matched = storyExitEffects(scenario, ev.action, built, matched, personMoved);
    const openingChanges = new Map<Id, OpeningState>(matched.flatMap(effect => (effect.openings ?? []).map(change => [change.openingId, change.state] as const)));
    const before = { objective: run.objective, civilianSafety: run.civilianSafety, pressure: run.pressure };
    const extra = matched.reduce((s, e) => s + (e.extraMinutes ?? 0), 0);
    const movementTime = storyRouteUsed ? 0 : ev.storyMovementMinutes ?? 0;
    const proposedTime = (ev.timeBase - movementTime) * ({ favorable: 1, mixed: 1.2, adverse: 1.5 } as Record<OutcomeBand, number>)[band] + extra;
    const timeCost = round1(scenario.version >= 4 && action.awaitSupport ? ev.timeBase : scenario.version >= 3 ? Math.max(0.5, proposedTime) : proposedTime);
    const strain = run.practice ? {} : strainFor(input, ev, band);

    const t = advanceTime(run, scenario, timeCost);
    if (scenario.version >= 3) t.civilianLoss = round1(before.civilianSafety - run.civilianSafety);
    const { changes, stage: nextStage, ending } = applyEffects(run, matched);
    // Bound v5 movement records opened locks once; explicit outcome changes retain priority.
    for (const openingId of (storyRouteUsed ? ev.storyOpenedIds : ev.storySquadOpenedIds) ?? []) {
      if (matched.some(effect => effect.openings?.some(change => change.openingId === openingId))) continue;
      run.flags = run.flags.filter(flag => !flag.startsWith(`opening:${openingId}=`));
      run.flags.push(openingFlag(openingId, 'open'));
      openingChanges.set(openingId, 'open');
    }
    const externalSupportEvents = scenario.version >= 4 ? applyExternalSupportEffects(run, scenario, matched) : undefined;
    const incidentConsequences = scenario.version >= 4 ? applyIncidentConsequences(draft, run, scenario, matched, ev.participantIds) : undefined;

    // positions, staging points and task labels
    for (const arr of ev.arrivals) {
      const task = run.squadTasks.find((x) => x.squadId === arr.squadId);
      if (!task) continue;
      task.positionId = arr.spaceId;
      task.stagingId = arr.stagingId;
      task.at = arr.at;
      task.task = arr.role === 'support' ? (action.support?.task ?? 'Support') : action.task;
    }
    for (const sq of ev.acting) {
      const task = run.squadTasks.find((x) => x.squadId === sq);
      if (task && action.approach === 'none') task.task = action.task;
    }

    // strain lands on the officers now: later decisions see the real condition
    const stressLevels: NonNullable<DecisionResolution['stressLevels']> = {};
    for (const [id, dlt] of Object.entries(strain)) {
      const o = draft.officers[id];
      if (o) {
        const stressBefore = o.stress;
        o.stress = round1(clamp(o.stress + dlt, 0, 100));
        stressLevels[id] = { stressBefore, stressAfter: o.stress };
        if (scenario.version >= 3) strain[id] = round1(o.stress - stressBefore);
      }
    }

    const used: Record<Id, number> = {};
    const unitsUsed: Id[] = [];
    if (!run.practice)
      for (const u of ev.uses) {
        if (!storyRouteUsed && ev.storyMovementOnlyUnitIds?.includes(u.unitId)) continue;
        used[u.itemId] = (used[u.itemId] ?? 0) + u.qty;
        unitsUsed.push(u.unitId);
      }
    const consumed = Object.entries(used).map(([itemId, qty]) => ({ itemId, qty }));

    const knowledgeChanges = changes;
    const texts = [...matched.map((e) => e.text).filter((x): x is string => Boolean(x)), ...incidentConsequences?.text ?? []];
    const resolution: DecisionResolution = {
      revision: run.revision,
      stage,
      actionId: action.id,
      actingSquadIds: [...ev.acting],
      supportSquadIds: [...ev.support],
      officerIds: [...ev.participantIds],
      targetId: ev.action.targetId,
      inputs: ev.contributors,
      score: ev.score,
      difficulty: ev.difficulty,
      sample,
      band,
      timeCost,
      stressDeltas: strain,
      stressLevels,
      itemsConsumed: consumed,
      unitsUsed,
      knowledgeChanges,
      explanation: [],
    };
    run.history.push(resolution);
    run.revision += 1;

    // stage transition (the committed decision is already in history)
    let stageNote: string | null = null;
    if (ending) {
      const declared = scenario.endings[ending];
      const completion = scenario.version >= 4 && declared ? completionEvidence(scenario, run, declared) : undefined;
      const finalEnding = completion && ['resolved', 'care_accepted', 'followup_agreed'].includes(declared.disposition ?? '') && !completion.completionAchieved ? FALLBACK_ENDING : ending;
      run.stage = 'debrief';
      run.status = 'debrief';
      run.endingId = finalEnding;
      stageNote = `Ending: ${scenario.endings[finalEnding]?.title ?? finalEnding}.`;
    } else {
      if (nextStage) run.stage = nextStage;
      if (run.stage === stage && !anyEligible(draft, run, scenario, builtFor(run.locationFamilyId, run.locationSeed, run.flags))) {
        const idx = STAGES.indexOf(stage);
        if (idx < STAGES.length - 1) {
          run.stage = STAGES[idx + 1];
          stageNote = 'No options left here; the situation moved on.';
        } else {
          run.stage = 'debrief';
          run.status = 'debrief';
          run.endingId = FALLBACK_ENDING;
          stageNote = scenario.version >= 4 ? 'No options left; incident responsibilities remain unresolved.' : 'No options left; responsibility was handed over.';
        }
      } else if (run.stage !== stage) stageNote = `Moved on to ${scenario.stages[run.stage as StageId].label}.`;
    }
    if (scenario.version >= 3) resolution.committed = {
      objectiveDelta: round1(run.objective - before.objective),
      civilianSafetyDelta: round1(run.civilianSafety - before.civilianSafety),
      pressureDelta: round1(run.pressure - before.pressure),
      consequences: [
        ...texts,
        ...matched.flatMap((effect) => (effect.openings ?? []).map((change) => {
          const opening = built.location.openings.find((candidate) => candidate.id === change.openingId);
          return opening ? `${spaceName(built, opening.a)} to ${spaceName(built, opening.b)}: ${change.state}.` : `${change.openingId.replaceAll('_', ' ')}: ${change.state}.`;
        })),
        ...(run.stage !== 'debrief' ? [`Next: ${currentStoryPrompt(scenario, run)}`] : []),
      ],
      endingTitle: run.endingId ? scenario.endings[run.endingId]?.title ?? run.endingId : null,
      ...(scenario.version >= 5 && action.resultLabels?.[band] ? { resultLabel: action.resultLabels[band] } : {}),
      ...(scenario.version >= 5 && openingChanges.size ? { openingChanges: [...openingChanges].map(([openingId, state]) => ({ openingId, state })) } : {}),
      ...(externalSupportEvents ? { externalSupport: externalSupportEvents } : {}),
      ...(incidentConsequences ? { officerCasualties: incidentConsequences.records } : {}),
    };
    resolution.explanation = explain(draft, scenario, ev, band, texts, timeCost, t.civilianLoss, knowledgeChanges, consumed, strain, stageNote, run.practice);
    return { ok: true };
  },

  closeDebrief(draft, _cmd, ctx) {
    const run = draft.activeRun;
    if (!run) return fail('No debrief to close');
    if (run.status !== 'debrief') return fail('The operation is still running');
    if (run.settled) return fail('This debrief was already settled');
    const result = computeDebrief(draft, run);
    if (!result) return fail('Debrief unavailable');
    const scenario = getScenario(run.scenarioId);

    if (!run.practice) {
      const settled = settleRun(draft, run.id, unitsUsedTotals(run), ctx.now);
      result.resources = settled.resources;
      result.unitWear = settled.unitWear;
      const factor = outcomeFactor(run);
      const verdict: 'favorable' | 'adverse' | null = factor >= CAREER_FAVORABLE_AT && (scenario!.version < 4 || result.completionAchieved) ? 'favorable' : factor < CAREER_ADVERSE_BELOW ? 'adverse' : null;
      draft.department.funding += result.fundingReward;
      draft.department.devPoints += result.devPointReward;
      draft.department.trust = clamp(draft.department.trust + result.trustDelta, 0, 100);
      for (const oc of result.officerCondition) {
        const o = draft.officers[oc.officerId];
        if (!o) continue;
        o.xp += oc.xpGained;
        o.stress = oc.stressAfter;
        o.career.operations += 1;
        if (verdict) o.career[verdict] += 1;
      }
    }
    clearAssignments(draft, run);
    run.settled = true;
    run.status = 'closed';
    draft.debriefs = [result, ...draft.debriefs].slice(0, 10);
    draft.activeRun = null;
    void scenario;
    return { ok: true };
  },
};

function clearAssignments(draft: GameState, run: OperationRun): void {
  for (const o of Object.values(draft.officers)) {
    if (o.assignment?.kind === 'operation' && o.assignment.runId === run.id) o.assignment = null;
  }
}

export { openingOverrides };
