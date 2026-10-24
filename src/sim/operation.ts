import { playerProfile, recordStall, sourceStarts } from './player-profile';
import { applyWorldDebrief, fundingScale } from './world';
import { applyPeopleDebrief } from './people';
import { findBond } from './people/bonds';
import { activeImprint } from './people/imprints';
import { reserveSupportVehicle, supportStartCheck } from './support-vehicles';
import { isGenericResponseExit, responseFailurePlan } from './response-failure';
import { currentStoryPrompt } from './story-context';
import { observingAction, storyMovedAlongRoute } from './story-people';
import { validateStoryBindings } from '../gen/incident/story-bindings';
import { actionResultLabel, harmResultLabel } from './action-result';
import { applyIncidentConsequences, applyPersonConsequences, civilianOutcomeViews, syncCasualtyFlags, syncPersonCasualtyFlags } from './incident-consequences';
import { protectedOfficerEffects } from './force-risk';
import { drawnKeys, forceSuppliesSpent, resolveDrawn } from './drawn-effects';
import { withVariants } from '../gen/incident/drawn-model';
import { advanceClocks, audienceFactor, bumpClocks, CLOCK_RULES_V1, clockConditionsHold, clockErrors, clockOutEffects, cueEffects, decisionMinutes, ditherCap, filling, fillGauge, fillPressureRate, fillViews, forkMinutes, initialClocks, landingEffects, lapsedThreat, lapseEffects, openThreat, stalledRun, stallFeed, teamMinutes, threatById } from './clocks';
import { applyMoves, driftMeters, initialMeters, meterConditionsHold } from './meters';
import { applyCommitments, breakCommitments } from './commitments';
import { forceLines, OUTCOME_SCORE_V1, scoreCall } from './outcome-score';
import { CAREER_TUNING, awardXp, learnedXp, promotionText } from './career';
import { creditXp } from './ranks';
import { applyGrants } from './grants';
import { applyExternalSupportEffects, completionEvidence, COMPLETION_DISPOSITIONS, hasCompletionConditions, MAX_EXTERNAL_RESPONSE_MINUTES, savedDrawnEffects } from './external-support';
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
  HistoryEntry,
  Id,
  KnowledgeStatus,
  LapseRecord,
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
import { decisionsOf, isLapse } from './types';
import { getScenario } from './scenario-registry';
import { INCIDENT_TUNING, takeIncident } from './incidents';
import { foldDebriefs } from './casebook';
import { addService, departmentService, levelForService, serviceEarned } from './department-level';
import { ITEMS } from '../content/items';
import { hashSeed, next } from './rng';
import { fullName } from './officer';
import { deployRoster, runRoster } from './squads';
import { flushSquadMoves } from './roster';
import { squadName } from './squad-names';
import { crewFlags, leadFlags } from './crew';
import { LEAD_PREFIX } from './crew-flags';
import { releaseRun, reserveLoadouts, settleRun, squadUnits } from './inventory';
import { isBasicUnit, withoutBasicKit } from './basic-kit';
import { spaceAt, stagingPointById } from './spatial';
import { centroidOf, defaultStagingFor, reachableOverGround, spaceLabel } from './spatial-factors';
import {
  availableUnits,
  bandFor,
  builtFor,
  evaluateAction,
  getBuilt,
  openingFlag,
  openingOverrides,
  strainFor,
  type Evaluation,
} from './resolution';
import { conditionHolds, liveThreat, stableFlag, withFlag } from './conditions';
import { departmentUpkeep } from './equipment-manager-policy';
import { vantageZones } from './sightlines';
import { sightings } from './sightings';
import { postFunding } from './ledger';
import { postureOf, recordPosture } from './reputation';
import type { TimerSetting } from './timer-setting';

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const STAGES: StageId[] = ['assess', 'adapt', 'resolve'];
// Careers count a run as favorable at an outcome factor of CAREER_TUNING.favorableAt or more and as
// adverse below CAREER_TUNING.adverseBelow (sim/career.ts); between the two, as an operation only.
// V4 partial service retains credit, but unfinished responsibility can't earn full settlement: the
// factor is capped at OUTCOME_SCORE_V1.factor.unfinishedMax (sim/outcome-score.ts).
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
  {
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
  // v13: the incident's people are the story's people, standing where the story puts them.
  for (const person of s.incidentPeople ?? []) {
    const bound = s.story?.bindings.people[person.id];
    if (!bound) { errs.push(`${s.id}: incident person ${person.id} is not a v13 story-bound person`); continue; }
    if (bound.initial.spaceId !== person.spaceId || bound.initial.at.x !== person.at.x || bound.initial.at.y !== person.at.y) errs.push(`${s.id}: incident person ${person.id} is not where the story puts them`);
    for (const factId of [person.armamentFactId, person.dispositionFactId]) if (factId && !factIds.has(factId)) errs.push(`${s.id}: incident person ${person.id} reads unknown fact ${factId}`);
  }
  errs.push(...clockErrors(s));
  const meterIds = new Set((s.incidentPeople ?? []).filter(person => person.meters).map(person => person.id));
  for (const f of s.facts) {
    space(f.spaceId, `fact ${f.id}`);
    if (!f.claim.trim()) errs.push(`${s.id}: fact ${f.id} has no claim sentence`);
    for (const [label, at] of [['position', f.person?.at], ['reported position', f.person?.reportedAt]] as const) {
      const floor = built.location.rooms.find(room => room.id === f.spaceId)?.floor ?? 0;
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
    for (const a of st.actions) {
      if (seen.has(a.id)) errs.push(`${s.id}: duplicate action id ${a.id}`);
      seen.add(a.id);
      if (a.stage !== stage) errs.push(`${a.id}: declared stage ${a.stage} but listed under ${stage}`);
      if (a.forceProfile || a.personCare) {
        const personId = a.forceProfile?.personId ?? a.personCare?.personId;
        if (!Object.values(s.story?.bindings.people ?? {}).some(person => person.id === personId)) errs.push(`${a.id}: force or care needs a V7 bound person`);
        if (a.forceProfile && (a.check.kind !== 'execution' || a.commandOnly || a.storyTargetPersonId !== a.forceProfile.personId || !['firearm', 'less_lethal_device', 'less_lethal_impact'].includes(a.forceProfile.kind) || !['subject', 'civilian'].includes(a.forceProfile.personRole))) errs.push(`${a.id}: force must explicitly identify its execution target and profile`);
        if (a.forceProfile && !a.capabilities?.required?.some(capability => a.forceProfile!.kind === 'firearm'
          ? capability === 'authorized_response' || capability === 'specialist_support' : capability === a.forceProfile!.kind)) errs.push(`${a.id}: force needs an explicit matching required equipment capability`);
        if (a.personCare?.kind === 'stabilize' && (!a.requires.certs?.includes('advanced_first_aid') || !a.consumes?.some(use => use.tag === 'medkit' && use.qty >= 1))) errs.push(`${a.id}: person care needs a qualified first aider and trauma kit`);
        if (a.personCare?.kind === 'accept' && !s.externalServices?.some(service => service.id === a.personCare?.serviceId && service.kind === 'medical')) errs.push(`${a.id}: injured people need a medical receiving service`);
      }
      if (a.consumes?.some(use => !Number.isSafeInteger(use.qty) || use.qty <= 0)) errs.push(`${a.id}: consumption must request positive whole units`);
      for (const harm of withVariants(Object.values(a.outcomes).flat()).flatMap(effect => effect.personHarm ?? []))
        if (!s.story?.bindings.people[harm.personId]) errs.push(`${a.id}: authored harm needs a v13 bound person, not ${harm.personId}`);
      {
        if (a.commandOnly && (a.approach !== 'none' || a.consumes?.length || a.check.kind === 'execution' || withVariants(Object.values(a.outcomes).flat()).some(effect => effect.officerHarm || effect.drawn))) errs.push(`${a.id}: command decisions cannot perform field work or cause injury`);
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
        for (const e of effects) if (e.drawn) {
          // v13 drawn consequences: a person the engine can read, and a variant for every result.
          const id = e.drawn.model === 'incoming_fire' ? e.drawn.from : e.drawn.on;
          const person = s.incidentPeople?.find(entry => entry.id === id);
          if (!person) errs.push(`${a.id}: a drawn ${e.drawn.model} needs a v13 incident person, not ${id}`);
          else if (e.drawn.model === 'incoming_fire' && !person.threat) errs.push(`${a.id}: incoming fire from ${id}, who carries no threat`);
          for (const key of drawnKeys(e, s)) if (!e.variants?.[key]) errs.push(`${a.id}: drawn ${e.drawn.model} has no ${key} variant (${band})`);
        }
        for (const e of withVariants(effects)) {
          {
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
          // A clock this call doesn't have never runs out, so a fork on one is legal; a meter event
          // on someone without meters is an authoring slip.
          for (const move of e.moves ?? []) if (!meterIds.has(move.personId)) errs.push(`${a.id}: meter event on ${move.personId}, who has no meters`);
          for (const f of e.when?.facts ?? []) fact(f.factId, `action ${a.id} outcome`);
          if (e.ending && !s.endings[e.ending]) errs.push(`${a.id}: unknown ending ${e.ending}`);
          for (const o of e.openings ?? []) if (!built.location.openings.some((x) => x.id === o.openingId)) errs.push(`${a.id}: unknown opening ${o.openingId}`);
          if (e.storyExitState && (!a.storyRoute || !s.story?.bindings.routes[a.storyRoute])) errs.push(`${a.id}: a story exit change needs a bound movement route`);
        }
        if (stage === 'resolve' && !effects.some((e) => (e.ending || (e.stage === 'resolve')) && !e.when && !e.truth)) errs.push(`${a.id}: resolve action must always reach an ending (${band})`);
      }
    }
  }
  return [...errs, ...validateStoryBindings(s, built)];
}

// ---------------------------------------------------------------- start

function initialKnowledge(s: ScenarioDefinition): Record<Id, KnowledgeStatus> {
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
export function checkStart(state: GameState, now: number, cmd: StartCmd, timer: TimerSetting = 'off'): StartCheck {
  const squadLabel = (sid: SquadId) => squadName(state.squads, sid);
  const issues: string[] = [];
  const warnings: string[] = [];
  const scenario = getScenario(cmd.scenarioId);
  let built: BuiltLocation | null = null;
  if (state.activeRun) issues.push('An operation is already in progress');
  if (!scenario) {
    issues.push(`Unknown operation ${cmd.scenarioId}`);
    return { issues, warnings, scenario, built };
  }
  if (scenario.incident && !state.incidents?.some((c) => c.id === scenario.id && c.expiresAt > Math.max(now, state.department.clockHighWater))) {
    issues.push('This incident is no longer on the board.');
  }
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
    }
    // A squad deploys with the officers who are ready; the rest stay home (short-squad-deploys).
    const roster = deployRoster(state, sid, now);
    if (squad.officerIds.length && !roster.goes.length) issues.push(`${squadLabel(sid)}: nobody is ready (${roster.staysHome.map(entry => entry.reason).join('; ')})`);
    else for (const entry of roster.staysHome) warnings.push(`${squadLabel(sid)}: ${entry.reason} and stays home`);
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
        const st = resolveStart(built, cmd, sid, squadLabel(sid));
        if ('error' in st) issues.push(st.error);
      }
    }
    for (const sid of Object.keys(cmd.staging ?? {}) as SquadId[]) if (!ids.includes(sid)) issues.push(`Staging given for ${squadLabel(sid)}, which is not deployed`);
  }

  const upkeep = departmentUpkeep(state);
  cmd = { ...cmd, ...withoutBasicKit(state, cmd.loadouts, cmd.units) };
  for (const sid of Object.keys(cmd.units ?? {}) as SquadId[]) if (!ids.includes(sid)) issues.push(`Equipment given for ${squadLabel(sid)}, which is not deployed`);
  for (const sid of Object.keys(cmd.loadouts) as SquadId[]) if (!ids.includes(sid)) issues.push(`Loadout given for ${squadLabel(sid)}, which is not deployed`);
  const probe = structuredClone(state);
  const r = reserveLoadouts(probe, 'probe', cmd.loadouts, cmd.units, now, upkeep);
  if (!r.ok) issues.push(r.reason);

  if (issues.length === 0 && built) warnings.push(...startWarnings(state, now, scenario, built, cmd, timer));
  return { issues, warnings, scenario, built };
}

function startWarnings(state: GameState, now: number, scenario: ScenarioDefinition, built: BuiltLocation, cmd: StartCmd, timer: TimerSetting): string[] {
  const out: string[] = [];
  const probe = structuredClone(state);
  const unitOverride = {} as Record<SquadId, ItemUnit[]>;
  reserveLoadouts(probe, 'preview', cmd.loadouts, cmd.units, now, departmentUpkeep(state));
  for (const sid of cmd.squadIds) unitOverride[sid] = squadUnits(probe, 'preview', sid);
  // The probe sends who Deploy would send, so the preview's odds use who goes (runRoster).
  for (const sid of cmd.squadIds) for (const oid of deployRoster(probe, sid, now).goes) probe.officers[oid].assignment = { kind: 'operation', runId: 'preview' };
  const run = makeRun(state, built, scenario, cmd, 'preview', 0, 0, timer);
  // The probe is mid-run, as the run it previews will be: equipment qualification reads the run's roster.
  probe.activeRun = run;
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
  return out;
}

/**
 * Where a squad starts: its position zone plus a staging point. A chosen staging point
 * must lie in that zone, or on open ground reachable from it (the squad then starts
 * there). The default is the nearest door staging point to the position.
 */
function resolveStart(built: BuiltLocation, cmd: StartCmd, sid: SquadId, label: string): { positionId: Id; stagingId: Id | null; at: Vec } | { error: string } {
  const pos = cmd.positions[sid] ?? '';
  const chosen = cmd.staging?.[sid];
  if (chosen) {
    const sp = stagingPointById(built, chosen);
    if (!sp) return { error: `${label}: unknown staging point` };
    if (sp.spaceId === pos) return { positionId: pos, stagingId: sp.id, at: sp.at };
    const isZone = built.location.zones.some((z) => z.id === sp.spaceId);
    if (isZone && reachableOverGround(built, pos, sp.spaceId)) return { positionId: sp.spaceId, stagingId: sp.id, at: sp.at };
    return { error: `${label} cannot stage there: that point is not in the ${spaceLabel(built, pos).toLowerCase()} or on open ground reachable from it` };
  }
  const sp = defaultStagingFor(built, pos);
  return sp ? { positionId: pos, stagingId: sp.id, at: sp.at } : { positionId: pos, stagingId: null, at: centroidOf(built, pos) };
}

function makeRun(state: GameState, built: BuiltLocation, scenario: ScenarioDefinition, cmd: StartCmd, runId: Id, rngState: number, now: number, timer: TimerSetting): OperationRun {
  // The department's name and habits move where the pressure sources start (sim/player-profile.ts).
  const sourceStart = sourceStarts(scenario, playerProfile(state), timer);
  return {
    id: runId,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    ...(state.incidents?.some((c) => c.id === scenario.id)
      ? { sourceIncident: structuredClone(state.incidents.find((c) => c.id === scenario.id)!) }
      : {}),
    ...(state.incidents?.find((c) => c.id === scenario.id)?.world ? { world: { ...structuredClone(state.incidents.find((c) => c.id === scenario.id)!.world!), ...(cmd.tieRole ? { tieRole: cmd.tieRole } : {}) } } : {}),
    locationFamilyId: scenario.locationFamilyId,
    locationSeed: scenario.locationSeed,
    contentVersion: state.contentVersion,
    rngState,
    squadIds: [...cmd.squadIds],
    squadTasks: cmd.squadIds.map((sid) => {
      const st = resolveStart(built, cmd, sid, squadName(state.squads, sid));
      return 'error' in st ? { squadId: sid, positionId: cmd.positions[sid] ?? '', task: 'Staging', stagingId: null, at: null } : { squadId: sid, positionId: st.positionId, task: 'Staging', stagingId: st.stagingId, at: st.at };
    }),
    reservationIds: [],
    supportUnitIds: [...cmd.supportUnitIds ?? []],
    supportPositionId: cmd.positions[cmd.squadIds[0]],
    stage: 'assess',
    knowledge: initialKnowledge(scenario),
    flags: [],
    ...({ externalSupport: {} }),
    clock: 0,
    ...(sourceStart ? { sourceStart } : {}),
    ...(initialClocks(scenario, sourceStart) ? { clocks: initialClocks(scenario, sourceStart) } : {}),
    ...(initialMeters(scenario) ? { meters: initialMeters(scenario) } : {}),
    pressure: scenario.pressure.start,
    objective: 0,
    civilianSafety: 100,
    history: [],
    revision: 0,
    status: 'active',
    endingId: null,
    settled: false,
    startedAt: now,
    decisionOpenedAt: Math.max(now, state.department.clockHighWater),
  };
}

// ---------------------------------------------------------------- effects and time

/** Advance operation time: pressure rises; civilian safety falls above the threshold; v13 clocks run
 * down, and the cues they pass come back as effects for the caller to apply (applyClockCues). */
export function advanceTime(run: Pick<OperationRun, 'clock' | 'pressure' | 'civilianSafety'> & Partial<Pick<OperationRun, 'clocks' | 'flags' | 'meters' | 'fillPeak'>>, s: ScenarioDefinition, minutes: number): { civilianLoss: number; crossed: boolean; cues: OutcomeEffect[] } {
  const m = s.pressure;
  const p0 = run.pressure;
  // A gauge that fills pushes the call too (sim/clocks.ts fillPressureRate): its pressure counts in
  // the minutes above the threshold as the call's own does. Zero for a call with no gauge, so the
  // sum is the call's own rate exactly.
  const rate = m.perMinute + fillPressureRate(s, run.clocks, run.flags ?? [], minutes);
  let over = 0;
  if (p0 >= m.threshold) over = minutes;
  else if (rate > 0) over = Math.max(0, minutes - (m.threshold - p0) / rate);
  const loss = round1(over * m.civilianPerMinute);
  run.clock = round1(run.clock + minutes);
  run.pressure = round1(clamp(p0 + rate * minutes, 0, 100));
  run.civilianSafety = round1(clamp(run.civilianSafety - loss, 0, 100));
  if (run.meters) { run.meters = structuredClone(run.meters); driftMeters(run, s, minutes); }
  const cues = run.clocks && run.flags ? advanceClocks(run as Pick<OperationRun, 'clocks' | 'flags'>, s, minutes) : [];
  // The highest a gauge reaches once its first cue is heard is kept for the debrief's audience
  // factor: one the team has not been warned of changes nothing. Calls with none are untouched.
  if (run.clocks && s.clocks?.some(filling)) {
    const heard = s.clocks.filter(def => filling(def) && (run.clocks![def.id]?.cued ?? 0) > 0).map(def => run.clocks![def.id].value);
    if (heard.length) run.fillPeak = Math.max(run.fillPeak ?? 0, ...heard);
  }
  return { civilianLoss: loss, crossed: p0 < m.threshold && run.pressure >= m.threshold, cues };
}

/** Hidden truth is consulted only when committing/replaying an outcome, never in previews. So are
 * the v13 engine-only branches: clocks at the end of the decision's minutes (`clockBase`, the
 * team's minutes: sim/clocks.ts teamMinutes), and the subjects' meters as they stand at the start
 * of the decision (escalation, sim/meters.ts). */
export function matchedEffects(action: ActionDefinition, band: OutcomeBand, run: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure'> & Partial<Pick<OperationRun, 'clocks' | 'meters'>>, scenario: ScenarioDefinition, clockBase?: number, dither = 0): OutcomeEffect[] {
  // The decision point's threat (NodeThreat): a decision that takes its minutes, travel and the band's
  // delay included, lets it happen. Its effects are addenda; they never route, so where the call
  // goes still rests on the choice and the truth. One place, so a replay matches the live commit.
  // Landing reaches the subjects too (sim/clocks.ts landingEffects), as the stall's projection showed.
  // A threat a lapse already spent never lands again.
  const live = liveThreat(action.threat, run.flags);
  const threat = live && clockBase !== undefined && clockBase >= live.minutes
    ? landingEffects(scenario, live.effects.filter((effect) => conditionHolds(effect.when, run))) : [];
  // The beats (TreeBeat): each one whose stall threshold the decision's dither reached fires once,
  // as its spoken line, marks, moves and bumps, beside the threat. The decision records its dither,
  // so a replay reads the same beats; a decision with none replays as before.
  const beats = dither > 0 ? (live?.beats ?? []).filter((line) => line.at <= dither)
    .flatMap((line) => line.effects.filter((effect) => conditionHolds(effect.when, run))) : [];
  return [...matchedOutcomeIndices(action, band, run, scenario, clockBase).map((index) => {
    const effect = action.outcomes[band][index];
    return effect.reveal?.length ? { ...effect, knowledge: [...effect.knowledge ?? [], ...effect.reveal.map((factId) => ({ factId, status: scenario.facts.find((fact) => fact.id === factId)?.truth ? 'confirmed' as const : 'disproved' as const }))] } : effect;
  }), ...threat, ...beats];
}

/** Which of the band's authored outcomes apply (their indices, in order): matchedEffects' filter. */
export function matchedOutcomeIndices(action: ActionDefinition, band: OutcomeBand, run: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure'> & Partial<Pick<OperationRun, 'clocks' | 'meters'>>, scenario: ScenarioDefinition, clockBase?: number): number[] {
  return action.outcomes[band].flatMap((effect, index) => conditionHolds(effect.when, run) && (effect.truth ?? []).every((entry) => scenario.facts.find((fact) => fact.id === entry.factId)?.truth === entry.is)
    && clockConditionsHold(effect.clocks, scenario, run, forkMinutes(action, band, effect, clockBase)) && meterConditionsHold(effect.meters, run) ? [index] : []);
}

/** Resolve an authored exit change from this evaluation's route, never a stale binding path. */
function storyExitEffects(scenario: ScenarioDefinition, action: ActionDefinition, built: BuiltLocation, effects: OutcomeEffect[], personMoved: boolean): OutcomeEffect[] {
  if (!personMoved || !action.storyRoute || !effects.some(effect => effect.storyExitState)) return effects;
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
  run: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure' | 'objective' | 'civilianSafety'> & Partial<Pick<OperationRun, 'clocks'>>,
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
    for (const f of e.setFlags ?? []) run.flags = withFlag(run.flags, f);
    for (const f of e.clearFlags ?? []) run.flags = run.flags.filter((x) => x !== f);
    for (const o of e.openings ?? []) {
      run.flags = run.flags.filter((x) => !x.startsWith(`opening:${o.openingId}=`));
      run.flags.push(openingFlag(o.openingId, o.state));
    }
    if (e.objective) run.objective = round1(clamp(run.objective + e.objective, 0, 100));
    if (e.civilian) run.civilianSafety = round1(clamp(run.civilianSafety + e.civilian, 0, 100));
    if (e.pressure) run.pressure = round1(clamp(run.pressure + e.pressure, 0, 100));
    if (e.clockBump?.length && run.clocks) run.clocks = bumpClocks(run.clocks, e.clockBump);
    if (e.stage) stage = e.stage;
    if (e.ending) ending = e.ending;
  }
  return { changes, stage, ending };
}

/** Apply the cues a stretch of time fired (advanceTime): marks, and the facts they settle. */
export function applyClockCues(run: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure' | 'objective' | 'civilianSafety'> & Partial<Pick<OperationRun, 'meters'>>, scenario: ScenarioDefinition, fired: OutcomeEffect[]): { effects: OutcomeEffect[]; changes: { factId: Id; status: KnowledgeStatus }[] } {
  const effects = cueEffects(fired, scenario, run);
  const changes = applyEffects(run, effects).changes;
  // A cue can move a subject (a gauge that fills: `watched`), wherever the time passed: a commit, a
  // resupply and their replays all come through here, so it happens exactly once.
  applyMoves(run, scenario, effects);
  return { effects, changes };
}

export interface StepTrace {
  resolution: HistoryEntry;
  /** Null for a lapse, and for a decision whose action this content no longer has. */
  action: ActionDefinition | null;
  /** Null for a lapse: nobody chose. */
  band: OutcomeBand | null;
  objectiveDelta: number;
  civilianDelta: number;
  pressureDelta: number;
  /** Civilian safety lost to elapsed time above the pressure threshold. */
  pressureLoss: number;
  effects: OutcomeEffect[];
}

/** Re-derive each committed decision's deltas from stored bands. Deterministic. */
export function traceRun(scenario: ScenarioDefinition, run: OperationRun): { steps: StepTrace[]; end: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure' | 'objective' | 'civilianSafety' | 'clock'> } {
  const sim: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure' | 'objective' | 'civilianSafety' | 'clock' | 'clocks' | 'personCasualties' | 'officerCasualties' | 'meters' | 'commitments'> = { knowledge: initialKnowledge(scenario), flags: [...run.crew ?? []], pressure: scenario.pressure.start, objective: 0, civilianSafety: 100, clock: 0,
    ...(initialClocks(scenario, run.sourceStart) ? { clocks: initialClocks(scenario, run.sourceStart) } : {}), ...(initialMeters(scenario) ? { meters: initialMeters(scenario) } : {}) };
  const actions = new Map(scenarioActions(scenario).map((a) => [a.id, a]));
  const steps: StepTrace[] = [];
  for (const resupply of run.resupplies ?? []) applyClockCues(sim, scenario, advanceTime(sim, scenario, resupply.minutes).cues);
  for (const h of run.history) {
    if (isLapse(h)) { steps.push(traceLapse(scenario, sim, h)); continue; }
    const a = actions.get(h.actionId) ?? null;
    // Who led this decision, as the commit saw it (the stored lead flags).
    sim.flags = [...sim.flags.filter((flag) => !flag.startsWith(LEAD_PREFIX)), ...h.leadFlags ?? []];
    const matched = a ? matchedEffects(a, h.band, sim, scenario, h.clockBaseMinutes, h.ditherMinutes ?? 0) : [];
    const pressure0 = sim.pressure;
    const obj0 = sim.objective;
    const civ0 = sim.civilianSafety;
    const clocksBefore = sim.clocks;
    const timed = advanceTime(sim, scenario, h.timeCost);
    const civAfterTime = sim.civilianSafety;
    // v13: the drawn variants the commit applied, its clock outs, and the meters and commitments
    // it moved, in the commit's order, so later meter and clock branches match what the engine saw.
    const applied = savedDrawnEffects(matched, h.committed?.drawn).effects;
    // Who the team saw, read before the outcome moves anyone, as the commit reads it (sim/sightings.ts):
    // its seen flags keep a re-sighting in the replay (R-B3).
    const seen = a ? sightings(scenario, sim, observingAction(scenario, () => getBuilt(scenario.locationFamilyId, scenario.locationSeed), sim, a), h.band, applied) : null;
    if (seen) applyEffects(sim, [seen]);
    applyEffects(sim, applied);
    applyClockCues(sim, scenario, timed.cues);
    {
      applyEffects(sim, clockOutEffects(scenario, clocksBefore, sim.clocks, sim, applied));
      applyMoves(sim, scenario, applied);
      if (a) {
        const view = { flags: sim.flags, clock: sim.clock, revision: h.revision, meters: sim.meters, commitments: sim.commitments };
        applyCommitments(view, scenario, a, h.band, applied, h.committed?.drawn ?? [], h.revision);
        if (view.meters) sim.meters = view.meters;
        if (view.commitments) sim.commitments = view.commitments;
      }
    }
    // Saved v3 deltas are authoritative, including clamping. Older histories retain
    // the original replay through their versioned content and stored outcome bands.
    if (h.committed) {
      {
        for (const person of h.committed.personCasualties ?? []) { sim.personCasualties ??= {}; sim.personCasualties[person.personId] = { ...person }; }
        for (const officer of h.committed.officerCasualties ?? []) { sim.officerCasualties ??= {}; sim.officerCasualties[officer.officerId] = { ...officer }; }
        syncCasualtyFlags(sim); syncPersonCasualtyFlags(sim, scenario);
      }
      if (h.committed.openingChanges) applyEffects(sim, [{ openings: h.committed.openingChanges }]);
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

/** Replay one lapse on the trace's state as the commit applied it (OPERATION_HANDLERS.lapse): the
 * stall's pressure, the window's minutes, the route and the landing, the cues and the clock outs.
 * The saved deltas and knowledge changes are authoritative, as a decision's are. */
function traceLapse(scenario: ScenarioDefinition, sim: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure' | 'objective' | 'civilianSafety' | 'clock' | 'clocks' | 'personCasualties' | 'meters' | 'commitments'>, h: LapseRecord): StepTrace {
  const threat = threatById(scenario, h.threatId);
  const matched = threat ? lapseEffects(scenario, threat, sim) : [];
  const pressure0 = sim.pressure, obj0 = sim.objective, civ0 = sim.civilianSafety;
  const clocksBefore = sim.clocks;
  sim.flags = sim.flags.filter((flag) => !flag.startsWith(LEAD_PREFIX));
  sim.pressure = round1(clamp(sim.pressure + CLOCK_RULES_V1.stallPressurePerMinute * h.timeCost, 0, 100));
  const timed = advanceTime(sim, scenario, h.timeCost);
  const civAfterTime = sim.civilianSafety;
  applyEffects(sim, matched);
  applyClockCues(sim, scenario, timed.cues);
  applyEffects(sim, clockOutEffects(scenario, clocksBefore, sim.clocks, sim, matched));
  applyMoves(sim, scenario, matched);
  breakCommitments(sim, scenario, matched);
  for (const person of h.committed.personCasualties ?? []) { sim.personCasualties ??= {}; sim.personCasualties[person.personId] = { ...person }; }
  syncPersonCasualtyFlags(sim, scenario);
  sim.objective = round1(clamp(obj0 + h.committed.objectiveDelta, 0, 100));
  sim.civilianSafety = round1(clamp(civ0 + h.committed.civilianSafetyDelta, 0, 100));
  sim.pressure = round1(clamp(pressure0 + h.committed.pressureDelta, 0, 100));
  for (const change of h.knowledgeChanges) sim.knowledge[change.factId] = change.status;
  return { resolution: h, action: null, band: null, objectiveDelta: round1(sim.objective - obj0), pressureDelta: round1(sim.pressure - pressure0),
    civilianDelta: round1(sim.civilianSafety - civ0), pressureLoss: round1(civ0 - civAfterTime), effects: matched };
}

/** Build a detached display snapshot from a versioned trace; safe to retain after closing the run. */
export function decisionViewsFor(state: GameState, run: OperationRun, scenario: ScenarioDefinition, steps = traceRun(scenario, run).steps): DecisionView[] {
  return steps.map((step): DecisionView => {
    const record = step.resolution;
    if (isLapse(record)) return lapseView(scenario, record);
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
      supplies: record.itemsConsumed.filter((use) => ITEMS[use.itemId]?.kind === 'consumable').map((use) => ({ ...use, label: ITEMS[use.itemId]?.name ?? use.itemId })),
      knowledgeChanges: record.knowledgeChanges.map((change) => ({ ...change, label: scenario.facts.find((fact) => fact.id === change.factId)?.label ?? change.factId })),
      contributors: record.inputs.map((input) => ({ ...input })),
      consequences: committed ? [...committed.consequences] : step.effects.map((effect) => effect.text).filter((text): text is string => !!text),
      ...((committed ? committed.exchange : step.effects.flatMap(effect => effect.exchange ?? []))?.length
        ? { exchange: (committed?.exchange ?? step.effects.flatMap(effect => effect.exchange ?? [])).map(line => ({ ...line })) } : {}),
      ...(committed?.heard?.length ? { heard: committed.heard.map(line => ({ ...line })) } : {}),
      ...(committed?.officerCasualties !== undefined ? { officerCasualties: committed.officerCasualties.map(person => ({ ...person })) } : {}),
      ...(committed?.forceOutcome ? { forceOutcome: { ...committed.forceOutcome } } : {}),
      ...(committed?.personCasualties ? { personCasualties: committed.personCasualties.map(person => ({ ...person })) } : {}),
      endingTitle: committed ? committed.endingTitle : (ending ? scenario.endings[ending]?.title ?? ending : null),
    };
  });
}

/** What the live screen already showed while the player decided (sim/clocks.ts stallFeed: the
 * beats and cues the stall reached, then the threat's landing once it did), read before the commit
 * changes anything. The result names these once, folded, instead of telling them again. */
function heardLive(scenario: ScenarioDefinition, run: OperationRun, dither: number, lead: string): { speaker?: string; line: string }[] {
  if (!(dither > 0)) return [];
  const lines: { speaker?: string; line: string }[] = stallFeed(scenario, run, dither).map(line => line.kind === 'beat' ? { speaker: (line.speaker ?? '').replace('{lead}', lead), line: line.text } : { line: line.text });
  const threat = openThreat(scenario, run);
  if (threat && dither >= threat.minutes) for (const effect of threat.effects) if (effect.text && conditionHolds(effect.when, run)) lines.push({ line: effect.text });
  return lines;
}
const notHeard = (heard: readonly { line: string }[]) => { const said = new Set(heard.map(entry => entry.line)); return (line: string) => !said.has(line); };

/** The log's line for a lapse: nobody chose, so no band, strain, supplies or contributors. */
export const LAPSE_TITLE = (label: string) => `No call made: ${label}`;
function lapseView(scenario: ScenarioDefinition, record: LapseRecord): DecisionView {
  const committed = record.committed;
  return {
    revision: record.revision, actionId: record.threatId, title: LAPSE_TITLE(record.label), stageLabel: scenario.stages[record.stage].label,
    band: null, lapse: true, explanation: [...record.explanation], timeCost: record.timeCost,
    objectiveDelta: committed.objectiveDelta, civilianSafetyDelta: committed.civilianSafetyDelta, pressureDelta: committed.pressureDelta,
    actualStressDeltas: true, stressDeltas: [], supplies: [],
    knowledgeChanges: record.knowledgeChanges.map((change) => ({ ...change, label: scenario.facts.find((fact) => fact.id === change.factId)?.label ?? change.factId })),
    contributors: [], consequences: [...committed.consequences],
    ...(committed.exchange?.length ? { exchange: committed.exchange.map(line => ({ ...line })) } : {}),
    ...(committed.heard?.length ? { heard: committed.heard.map(line => ({ ...line })) } : {}),
    ...(committed.personCasualties ? { personCasualties: committed.personCasualties.map(person => ({ ...person })) } : {}),
    endingTitle: committed.endingTitle,
  };
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
  fillNote: string | null = null,
  fillMult = 1,
): string[] {
  const out: string[] = [];
  const label = (sid: SquadId) => squadName(state.squads, sid);
  const who = ev.acting.map(label).join(' + ') + (ev.support.length ? ` with ${ev.support.map(label).join(' + ')}` : '');
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
  if (fillNote) out.push(`Cameras on the scene (${fillNote}) added ${Math.round((fillMult - 1) * 100)}% to everyone's strain.`);
  if (stageNote) out.push(stageNote);
  return out;
}

// ---------------------------------------------------------------- debrief

const objectiveLabel = (n: number) => (n >= 80 ? 'Resolved' : n >= 60 ? 'Largely resolved' : n >= 35 ? 'Partly resolved' : 'Unresolved');
const civilianLabel = (n: number) => (n >= 90 ? 'Everyone safe' : n >= 70 ? 'Minor risk' : n >= 45 ? 'Safety was strained' : 'Serious risk');

export function outcomeFactor(run: Pick<OperationRun, 'objective' | 'civilianSafety'>): number {
  const W = CAREER_TUNING.debriefWeights;
  return clamp((W.objective * run.objective + W.civilianSafety * run.civilianSafety) / 100, 0, 1);
}

/** Compute the debrief for a run in 'debrief' status without mutating state. */
export function computeDebrief(state: GameState, run: OperationRun): DebriefResult | null {
  const scenario = getScenario(run.scenarioId);
  if (!scenario || !run.endingId) return null;
  const authoredEnding = scenario.endings[run.endingId];
  const ending = run.responseFailure && authoredEnding ? { ...authoredEnding, title: run.responseFailure.title,
    summary: `${run.responseFailure.reason} ${run.responseFailure.remainingTasks.join(' ')}`, strain: 0, trustAdjust: -2,
    disposition: 'unresolved' as const, completion: undefined, remainingTasks: run.responseFailure.remainingTasks } : authoredEnding;
  if (!ending) return null;
  const { steps } = traceRun(scenario, run);
  // v13: one scoring function sets the disposition, trust, closing strain and rewards factor from
  // people's end states, the force used, commitments and time (sim/outcome-score.ts). A resolved
  // call is complete; harm to someone who came out is scored, not left as an open task.
  const score = scenario.incidentPeople?.length && !run.responseFailure ? scoreCall(scenario, run, { officers: state.officers, steps }) : undefined;
  const evidence = completionEvidence(scenario, run, ending);
  const completion = score && evidence ? { ...evidence, disposition: score.disposition, completionAchieved: score.disposition === 'resolved',
    remainingTasks: score.disposition === 'resolved' ? [] : evidence.remainingTasks } : evidence;
  const factor = score ? score.factor : completion && !completion.completionAchieved ? Math.min(OUTCOME_SCORE_V1.factor.unfinishedMax, outcomeFactor(run)) : outcomeFactor(run);
  const endingStrain = score ? score.strain : ending.strain;
  // v13: which force the team used, on whom, and the rule's reason (slice 2 saved it on each commit).
  const force = forceLines(scenario, run);

  // officers: stress from decisions is already on the officer; the ending adds its strain.
  const delta: Record<Id, number> = {};
  const participation: Record<Id, number> = {};
  // A lapse strains nobody and nobody took part in it, so it adds no experience either.
  for (const h of decisionsOf(run.history)) {
    for (const [id, d] of Object.entries(h.stressDeltas)) delta[id] = (delta[id] ?? 0) + d;
    for (const id of h.officerIds) participation[id] = (participation[id] ?? 0) + 1;
  }
  const officerCondition: DebriefResult['officerCondition'] = [];
  for (const sq of run.squadIds) {
    for (const id of runRoster(state, run, sq)) {
      const o = state.officers[id];
      if (!o) continue;
      const after = clamp(round1(o.stress + endingStrain), 0, 100);
      const before = clamp(round1(o.stress - (delta[id] ?? 0)), 0, 100);
      const share = Math.min(1, 0.4 + 0.3 * (participation[id] ?? 0));
      // A call nobody acted in (every decision ran out) teaches nothing: no tactical experience.
      const xp = run.responseFailure || !decisionsOf(run.history).length ? 0 : learnedXp(o, scenario.rewards.xp * share * (0.5 + 0.5 * factor));
      // The promotions closing this debrief brings, worked on a copy so the preview is what close applies.
      const promotions = creditXp(structuredClone(o), xp, { label: '', day: 0 }).map((p) => ({ rank: p.rank, line: promotionText(p) }));
      officerCondition.push({ officerId: id, stressBefore: before, stressAfter: after, xpGained: xp, ...(promotions.length ? { promotions } : {}) });
    }
  }

  // resources: settle on a throwaway clone so preview and commit agree.
  const { resources, unitWear } = settleRun(structuredClone(state), run.id, unitsUsedTotals(run), departmentUpkeep(state));

  // Gauges that fill make the result count for more, either way (the scored path carries it as a line).
  const proposedTrust = run.responseFailure ? -2 : score ? score.trust : Math.round((Math.round(scenario.rewards.trust * (2 * factor - 1)) + ending.trustAdjust) * audienceFactor(run.fillPeak));
  const trustDelta = clamp(state.department.trust + proposedTrust, 0, 100) - state.department.trust;
  const fundingReward = run.responseFailure ? 0 : Math.round(callFee(state, run, scenario) * (0.4 + 0.6 * factor));
  // Department service (save v7), shown on the debrief before it closes and added at close.
  const service = serviceEarned({ completed: completion?.completionAchieved ?? factor >= CAREER_TUNING.favorableAt, failed: !!run.responseFailure }, scenario.incident?.tier ?? 1);
  const levelAfter = service === null ? state.department.level : Math.max(state.department.level, levelForService(departmentService(state.department) + service));
  const causes = debriefCauses(scenario, run, steps);
  const peopleOutcomes = civilianOutcomeViews(scenario, run);
  const casualtySafety = Object.values(run.personCasualties ?? {}).some(person => person.severity === 'fatal') ? 'Fatality recorded'
      : Object.keys(run.personCasualties ?? {}).length || Object.keys(run.officerCasualties ?? {}).length || peopleOutcomes.some(person => person.status === 'injured_needs_care') ? 'Injuries recorded'
      : !completion?.completionAchieved && run.civilianSafety >= 90 ? 'Care and safety duties remain' : undefined;
  for (const person of Object.values(run.personCasualties ?? {}).reverse()) causes.unshift(`${person.label}: ${person.severity === 'fatal' ? 'fatality recorded' : `${person.severity === 'serious' ? 'serious injury' : 'injury'}; ${person.care === 'accepted' ? 'medical crew accepted care' : 'medical responsibility remains'}`}.`);
  {
    const closingStrain = officerCondition.map((officer) => ({ ...officer, delta: round1(officer.stressAfter - (state.officers[officer.officerId]?.stress ?? officer.stressAfter)) })).filter((officer) => officer.delta !== 0);
    if (closingStrain.length) causes.unshift(`Ending adjustment at close: ${closingStrain.map((officer) => `${state.officers[officer.officerId]?.surname ?? officer.officerId} ${officer.delta > 0 ? '+' : ''}${officer.delta} strain`).join('; ')}.`);
  }

  // The ending's epilogue, or the first variant whose state holds at the end of the call (E11.2).
  const epilogue = ending.epilogueIf?.find(entry => conditionHolds(entry.when, run))?.epilogue ?? ending.epilogue;
  return {
    runId: run.id,
    scenarioId: run.scenarioId,
    endingId: run.endingId,
    endingTitle: ending.title,
    decisions: decisionViewsFor(state, run, scenario, steps),
    ...({ endingSummary: ending.summary }),
    ...(epilogue ? { endingEpilogue: epilogue } : {}),
    ...completion,
    ...(run.responseFailure ? { disposition: 'unresolved' as const, completionAchieved: false, remainingTasks: run.responseFailure.remainingTasks } : {}),
    ...({ officerCasualties: Object.values(run.officerCasualties ?? {}).map(person => ({ ...person })), civilianOutcomes: civilianOutcomeViews(scenario, run) }),
    ...({ personCasualties: Object.values(run.personCasualties ?? {}).map(person => ({ ...person })) }),
    ...(score ? { scoreLines: score.lines.map(line => ({ ...line })) } : {}),
    ...(force.length ? { forceLines: force } : {}),
    objective: { score: Math.round(run.objective), label: completion ? ({ resolved: 'Resolved', care_accepted: 'Care accepted', followup_agreed: 'Follow-up agreed', relief_partial: 'Partial progress', unresolved: 'Unresolved' } as const)[completion.disposition!] : objectiveLabel(run.objective) },
    civilianSafety: { score: Math.round(run.civilianSafety), label: casualtySafety ?? civilianLabel(run.civilianSafety) },
    officerCondition,
    informationPreserved: scenario.facts.map((f) => ({ factId: f.id, label: f.label, status: run.knowledge[f.id] ?? f.initial })),
    resources,
    unitWear,
    trustDelta,
    fundingReward,
    ...(service !== null ? { serviceEarned: service } : {}),
    ...(levelAfter > state.department.level ? { levelReached: levelAfter } : {}),
    causes: causes.slice(0, 7),
  };
}

/** Every specific unit the run's decisions used, once each. */
export function unitsUsedTotals(run: OperationRun): Id[] {
  return [...new Set([...decisionsOf(run.history).flatMap((h) => h.unitsUsed), ...(run.resupplies ?? []).flatMap((r) => r.supportUnitId ? [r.supportUnitId] : [])])];
}

function debriefCauses(scenario: ScenarioDefinition, run: OperationRun, steps: StepTrace[]): string[] {
  const scored: { w: number; text: string }[] = [];
  for (const s of steps) {
    const texts = s.effects.map((e) => e.text).filter((t): t is string => Boolean(t));
    const record = s.resolution;
    const title = isLapse(record) ? LAPSE_TITLE(record.label) : s.action?.title ?? record.actionId;
    const knowledge = record.knowledgeChanges.length;
    // Indecision weighs like a setback: the debrief names it (owner 2026-10-21).
    const w = Math.abs(s.objectiveDelta) + Math.abs(s.civilianDelta - 0) + 4 * knowledge + (s.band === 'adverse' || isLapse(record) ? 4 : 0);
    const text = isLapse(record) ? `${title}. ${texts.join(' ')}`.trim() : texts.length ? `${title}: ${texts.join(' ')}` : `${title} ${BAND_WORD[s.band ?? 'mixed']}.`;
    scored.push({ w, text });
    if (s.pressureLoss > 0) scored.push({ w: s.pressureLoss + 2, text: `Time pressure passed ${scenario.pressure.threshold} during "${title}", costing ${s.pressureLoss} civilian safety.` });
  }
  const sorted = scored.sort((a, b) => b.w - a.w).map((s) => s.text);
  const unresolved = scenario.facts.filter((f) => ['unknown', 'reported'].includes(run.knowledge[f.id] ?? f.initial));
  for (const f of unresolved) sorted.push(`Never confirmed: ${f.label.toLowerCase()}.`);
  const head: string[] = [];
  const resupplyMinutes = (run.resupplies ?? []).reduce((sum, delivery) => sum + delivery.minutes, 0);
  if (resupplyMinutes > 0) head.push(`Equipment resupply took ${resupplyMinutes} min before the first decision; time pressure continued while squads waited.`);
  return [...head, ...sorted].slice(0, 7);
}

// ---------------------------------------------------------------- call fee and callback

/** The call fee by tier before the funding scale and the outcome factor (docs/world-redesign.md, "Case awards
 * and call fees"). The case award is the world's and is paid once at review close; closeDebrief posts only
 * this fee. */
export const CALL_FEE: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 800, 2: 1600, 3: 3200, 4: 6400 };

/** The fee for a call before the outcome factor: the table by the investigation's tier for a world call and
 * by the call's own tier otherwise (clamped to the table), times the funding scale. */
export function callFee(state: Pick<GameState, 'department'>, run: Pick<OperationRun, 'world'>, scenario: Pick<ScenarioDefinition, 'incident'>): number {
  const tier = Math.min(4, Math.max(1, Math.round(run.world?.caseTier ?? scenario.incident?.tier ?? 1))) as 1 | 2 | 3 | 4;
  return CALL_FEE[tier] * fundingScale(state.department.level);
}

/** The one character callback this call carries, chosen when it is dispatched and kept on the run so replays
 * agree: an officer's on-record tie to the call's subject, else two bonded officers, else an officer's
 * active imprint (docs/world-redesign.md, "How calls plug in"). Officers are read in squad and seat order. */
export function chooseCallback(d: GameState, run: OperationRun): NonNullable<OperationRun['callback']> | null {
  const roster = run.squadIds.flatMap((sid) => runRoster(d, run, sid)).filter((id, i, all) => !!d.officers[id] && all.indexOf(id) === i);
  const people = d.people;
  if (!people) return null;
  const ref = run.world;
  if (ref) {
    for (const id of roster) {
      const tie = people.ties.find((t) => t.officerId === id && t.subjectId === ref.subjectId && t.onRecord);
      if (tie) return { kind: 'tie', officerIds: [id], refId: tie.id };
    }
  }
  for (let i = 0; i < roster.length; i++) {
    for (let j = i + 1; j < roster.length; j++) {
      const bond = findBond(people, roster[i], roster[j]);
      if (bond && (bond.state === 'trusted' || bond.state === 'close' || bond.state === 'mentor')) return { kind: 'pair', officerIds: [bond.a, bond.b], refId: `${bond.a}:${bond.b}` };
    }
  }
  for (const id of roster) {
    const imprint = activeImprint(d, id);
    if (imprint) return { kind: 'imprint', officerIds: [id], refId: imprint.id };
  }
  return null;
}

// ---------------------------------------------------------------- handlers

const fail = (reason: string): HandlerResult => ({ ok: false, reason });

export const OPERATION_HANDLERS: HandlerMap<OperationCommandType> = {
  startOperation(draft, cmd, ctx) {
    const upkeep = departmentUpkeep(draft);
    cmd = { ...cmd, ...withoutBasicKit(draft, cmd.loadouts, cmd.units) };
    const chk = checkStart(draft, ctx.now, cmd, ctx.timer ?? 'off');
    if (chk.issues.length > 0 || !chk.scenario) return fail(chk.issues[0] ?? 'Cannot start this operation');
    const scenario = chk.scenario;

    const runId = `run_${draft.nextId++}`;
    const d = next(draft.rngState);
    draft.rngState = d.state;
    const rngState = (hashSeed(`${scenario.id}:${scenario.locationSeed}`) ^ Math.floor(d.value * 4294967296)) >>> 0;
    const run = makeRun(draft, chk.built!, scenario, cmd, runId, rngState, ctx.now, ctx.timer ?? 'off');

    const before = draft.reservations.length;
    const r = reserveLoadouts(draft, runId, cmd.loadouts, cmd.units, ctx.now, upkeep);
    if (!r.ok) return r;
    run.reservationIds = draft.reservations.slice(before).map((x) => x.id);
    reserveSupportVehicle(draft, run);
    // Only the officers who are ready go; their assignment is the run's roster (runRoster).
    for (const sid of cmd.squadIds) {
      for (const oid of deployRoster(draft, sid, ctx.now).goes) draft.officers[oid].assignment = { kind: 'operation', runId };
    }
    // Who went: their traits and experience open choices and shape results (sim/crew.ts).
    run.crew = crewFlags(draft, run);
    run.flags.push(...run.crew);
    const callback = chooseCallback(draft, run);
    if (callback) run.callback = callback;
    draft.activeRun = run;
    takeIncident(draft, scenario.id);
    return { ok: true };
  },

  /** The player has read the result and the next decision shows: its stall starts now. Once per
   * decision, and only forward, so it can never take back time already counted. */
  openDecision(draft, cmd, ctx) {
    const run = draft.activeRun;
    if (!run || run.status !== 'active' || run.revision !== cmd.revision || !run.decisionPending) return fail('No decision waiting to open');
    run.decisionOpenedAt = Math.max(run.decisionOpenedAt, ctx.now, draft.department.clockHighWater);
    delete run.decisionPending;
    delete run.decisionPausedAt;
    return { ok: true };
  },

  /** The app is hidden with a decision open: its stall stops here (sim/clocks.ts openDither). */
  pauseDecision(draft, cmd, ctx) {
    const run = draft.activeRun;
    if (!run || run.status !== 'active' || run.revision !== cmd.revision || run.decisionPending || run.decisionPausedAt !== undefined) return fail('No running decision to pause');
    run.decisionPausedAt = Math.max(ctx.now, draft.department.clockHighWater);
    return { ok: true };
  },

  /** The app is back: the decision opened later by the time away, so that time never counts. */
  resumeDecision(draft, cmd, ctx) {
    const run = draft.activeRun;
    if (!run || run.status !== 'active' || run.revision !== cmd.revision || run.decisionPausedAt === undefined) return fail('No paused decision to resume');
    run.decisionOpenedAt += Math.max(0, Math.max(ctx.now, draft.department.clockHighWater) - run.decisionPausedAt);
    delete run.decisionPausedAt;
    return { ok: true };
  },

  cancelOperation(draft, _cmd, ctx) {
    const run = draft.activeRun;
    if (!run) return fail('No operation to cancel');
    if (run.status !== 'active') return fail('The operation is already over');
    if (run.history.length > 0) return fail('Cannot cancel after the first decision');
    if (run.resupplies?.length) return fail('Cannot cancel after equipment resupply; operation time has already advanced');
    abandonRun(draft, run, ctx.now);
    return { ok: true };
  },



  endFailedResponse(draft, cmd) {
    const run = draft.activeRun;
    if (!run || run.id !== cmd.runId || run.revision !== cmd.revision) return fail('The response has changed; review its current options');
    const plan = responseFailurePlan(draft);
    if (!plan) return fail('A usable response or equipment delivery remains. Review the available choices.');
    const { runId: _runId, consequence: _consequence, ...record } = plan;
    run.responseFailure = record;
    run.flags = run.flags.filter(flag => !flag.startsWith('completion_pending:'));
    run.stage = 'debrief'; run.status = 'debrief'; run.endingId = FALLBACK_ENDING;
    return { ok: true };
  },

  decide(draft, cmd, ctx) {
    const run = draft.activeRun;
    if (!run) return fail('No operation in progress');
    if (run.status !== 'active' || run.stage === 'debrief') return fail('The operation is over; close the debrief');
    const scenario = getScenario(run.scenarioId);
    if (!scenario) return fail('Unknown scenario');
    const stage = run.stage;
    // A choice made on a screen the call has moved past (a lapse, another commit) is refused.
    if (cmd.revision !== undefined && cmd.revision !== run.revision) return fail('The call moved on before that choice reached it');
    // Once the decision point's time has run out the lapse settles it, never a late choice
    // (sim/clocks.ts lapsedThreat, the one rule both read).
    if (lapsedThreat(scenario, run, draft.department.clockHighWater, ctx.now, ctx.timer ?? 'off')) return fail('Time ran out on this decision before the choice was made');
    const action = scenario.stages[stage].actions.find((a) => a.id === cmd.actionId);
    if (!action) return fail('That option is not available at this stage');
    if (isGenericResponseExit(scenario, action)) return fail('This generic exit is retired. Continue the scene, or review the failed-response report if no usable plan remains.');
    // Older UI callers use decide; they receive the same free navigation semantics.
    if (cmd.actingSquadIds.some((s) => cmd.supportSquadIds.includes(s))) return fail('A squad cannot both act and support');
    const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
    if (cmd.ditherMinutes !== undefined && !(Number.isFinite(cmd.ditherMinutes) && cmd.ditherMinutes >= 0)) return fail('Dither minutes must be 0 or more');
    // The stall's minutes (docs/call-pressure.md), stopped at the open threat. They join the
    // decision's own minutes below, so clocks, cues and the threat move through the one path.
    const dither = Math.min(ditherCap(scenario, run), Math.floor((cmd.ditherMinutes ?? 0) * 10) / 10);
    // The odds read the call as the stall left it (sim/clocks.ts stalledRun), as the card showed them.
    const stalledInput = stalledRun(scenario, run, dither);
    // A beat during the stall can close a choice (docs/call-pressure.md, "Beats"): the scene moved on.
    if (!conditionHolds(action.visibleWhen, stalledInput)) return fail('That option closed while you were deciding');
    const input = { state: draft, run: stalledInput, scenario, action, built, acting: cmd.actingSquadIds, support: cmd.supportSquadIds, ...(cmd.leadOfficerId ? { lead: cmd.leadOfficerId } : {}) };
    const ev = evaluateAction(input);
    if (!ev.eligible) return fail(ev.reason ?? 'Not available');
    if (cmd.leadOfficerId && ev.participantIds[0] !== cmd.leadOfficerId) return fail('That officer is not taking part in this decision');
    const heard = heardLive(scenario, run, dither, (ev.leadId && draft.officers[ev.leadId]?.surname) || 'Negotiator');
    // Who leads is part of the story: results can read the lead's traits and experience
    // (TreeState.lead → lead:<trait>, lead:band_<band>), replaced at every decision.
    run.flags = [...run.flags.filter((flag) => !flag.startsWith(LEAD_PREFIX)), ...leadFlags(draft, run, ev.participantIds[0])];

    // The department becomes known for how it works (sim/reputation.ts), and how long it takes to
    // decide (sim/player-profile.ts).
    recordPosture(draft.department, postureOf(action));
    const window = ditherCap(scenario, run);
    if (window > 0) recordStall(draft.department, dither / window);
    // One saved sample per committed decision.
    const r = next(run.rngState);
    run.rngState = r.state;
    const sample = r.value;
    const band = bandFor(ev.margin, sample);
    // Clock forks read the decision's own minutes, travel and forcing included (sim/clocks.ts).
    const clockBaseMinutes = teamMinutes(ev, action, band) + dither;
    let matched = matchedEffects(action, band, run, scenario, clockBaseMinutes, dither);
    // v13: drawn consequences (a subject firing at the team, the team's force) settle now, each
    // with its own saved sample, into the variant effects they choose (sim/drawn-effects.ts).
    const drawnContext = { state: draft, run, scenario, acting: ev.acting, participantIds: ev.participantIds, unitsOf: availableUnits };
    const drawn = resolveDrawn(matched, drawnContext);
    // A less-lethal draw spends a cartridge or supply from the acting squads (sim/drawn-effects.ts).
    const suppliesSpent = forceSuppliesSpent(drawn.records, drawnContext);
    matched = drawn.effects;
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
    const timeCost = decisionMinutes(teamMinutes(ev, action, band, storyRouteUsed) + dither, extra, action);
    // Gauges that fill add to everyone's strain, scaled by how full they are before this decision
    // (a gauge bites only once its first cue is heard); the breakdown says so below.
    const stalled = stalledRun(scenario, run, dither);
    // A threat that lands on this decision weighs on everyone on it (CLOCK_RULES_V1.threat.strain).
    const live = liveThreat(action.threat, run.flags);
    const landed = !!live && clockBaseMinutes >= live.minutes;
    const fillStrainMult = (1 + CLOCK_RULES_V1.fill.strain * fillGauge(scenario, stalled.clocks)) * (landed ? 1 + CLOCK_RULES_V1.threat.strain : 1);
    const fillNote = fillStrainMult > 1 ? fillViews(scenario, stalled).filter(view => view.effect).map(view => `${view.label} at ${Math.round(view.value)}`).join(', ') : null;
    const strain = strainFor({ ...input, run: stalled }, ev, band, fillStrainMult);

    const clocksBefore = run.clocks;
    // The stall's own pressure lands once, before its minutes pass with the decision's (stalledRun).
    if (dither > 0) run.pressure = round1(clamp(run.pressure + CLOCK_RULES_V1.stallPressurePerMinute * dither, 0, 100));
    const t = advanceTime(run, scenario, timeCost);
    t.civilianLoss = round1(before.civilianSafety - run.civilianSafety);
    // Who the team sees, read before the outcome moves anyone (sim/sightings.ts).
    // It lands before the outcome's own effects, so a move the outcome makes (seen or not) is the
    // latest word on where they are (R-B3).
    const seen = sightings(scenario, run, observingAction(scenario, built, run, action), band, matched);
    const seenChanges = seen ? applyEffects(run, [seen]).changes : [];
    const { changes: outcomeChanges, stage: outcomeStage, ending: outcomeEnding } = applyEffects(run, matched);
    const changes = [...seenChanges, ...outcomeChanges];
    // v13: cues the clocks passed during this decision land after its own outcome, and the
    // outcome's events move the subjects' meters (sim/clocks.ts, sim/meters.ts).
    const cues = applyClockCues(run, scenario, t.cues);
    changes.push(...cues.changes);
    // v13: a clock that ran out where no fork read it sets its mark, and hurts its owner if they
    // are still inside and this outcome didn't already (sim/clocks.ts); the harm is recorded below.
    // Its route, when it takes one, moves the call on after the outcome (R-G4).
    const outs = clockOutEffects(scenario, clocksBefore, run.clocks, run, matched);
    const routed = applyEffects(run, outs);
    changes.push(...routed.changes);
    const nextStage = routed.ending ? null : routed.stage ?? outcomeStage;
    const ending = routed.ending ?? outcomeEnding;
    applyMoves(run, scenario, matched);
    // v13: what command gave a person its word on is made, kept or broken by this decision (sim/commitments.ts).
    applyCommitments(run, scenario, action, band, matched, drawn.records, run.revision);
    // Bound v5 movement records opened locks once; explicit outcome changes retain priority.
    for (const openingId of (storyRouteUsed ? ev.storyOpenedIds : ev.storySquadOpenedIds) ?? []) {
      if (matched.some(effect => effect.openings?.some(change => change.openingId === openingId))) continue;
      run.flags = run.flags.filter(flag => !flag.startsWith(`opening:${openingId}=`));
      run.flags.push(openingFlag(openingId, 'open'));
      openingChanges.set(openingId, 'open');
    }
    const externalSupportEvents = applyExternalSupportEffects(run, scenario, matched);
    const casualtyPositions = Object.fromEntries(ev.arrivals.flatMap(arrival =>
      runRoster(draft, run, arrival.squadId).map(id => [id, { spaceId: arrival.spaceId, at: arrival.at }])));
    const incidentConsequences = applyIncidentConsequences(draft, run, scenario, protectedOfficerEffects(matched, ev.protectionUsed), ev.participantIds, casualtyPositions);
    const personConsequences = applyPersonConsequences(run, scenario, action, band, [...matched, ...outs]);

    // positions, staging points and task labels. A band that drives the team back leaves the
    // acting squads where they started; an action that ends elsewhere (an escort out) puts them there.
    const fellBack = matched.some(effect => effect.fallBack);
    for (const arr of ev.arrivals) {
      const task = run.squadTasks.find((x) => x.squadId === arr.squadId);
      if (!task) continue;
      const acting = arr.role === 'acting';
      if (!(acting && fellBack)) {
        const end = acting && action.endsAt;
        task.positionId = end ? end.spaceId : arr.spaceId;
        task.stagingId = end ? null : arr.stagingId;
        task.at = end ? { ...end.at } : arr.at;
      }
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
        strain[id] = round1(o.stress - stressBefore);
      }
    }

    const used: Record<Id, number> = {};
    const unitsUsed: Id[] = [];
    for (const u of [...ev.uses, ...suppliesSpent.map(supply => ({ ...supply, qty: 1, consumable: true }))]) {
      if (!storyRouteUsed && ev.storyMovementOnlyUnitIds?.includes(u.unitId)) continue;
      // Basic kit is part of the officer: nothing to wear, settle or count as spent.
      if (isBasicUnit(u.unitId)) continue;
      used[u.itemId] = (used[u.itemId] ?? 0) + u.qty;
      unitsUsed.push(u.unitId);
    }
    const consumed = Object.entries(used).map(([itemId, qty]) => ({ itemId, qty }));

    const knowledgeChanges = changes;
    const protectedWound = ev.protectionUsed && matched.some(effect => effect.officerHarm?.severity === 'serious');
    // A cue from a clock this outcome stops was heard while the decision played out, before the
    // stop, so it reads first ("Metro 6 reposts the stream" before "Silas ends the stream"). The
    // effects keep their order; only the words do.
    const stopped = new Set((scenario.clocks ?? []).filter(def => matched.some(effect => effect.setFlags?.includes(stableFlag(def.id)))).flatMap(def => def.cues.map(cue => cue.text)));
    const cueTexts = cues.effects.map((e) => e.text).filter((x): x is string => Boolean(x));
    const texts = [...cueTexts.filter(text => stopped.has(text)), ...matched.map((e) => e.text).filter((x): x is string => Boolean(x)),
      ...(protectedWound ? [`${ITEMS[ev.protectionUsed!.itemId].name} limited the officer's serious injury to a wound. Care and transport are still needed.`] : []),
      ...incidentConsequences?.text ?? [], ...personConsequences?.text ?? [],
      ...cueTexts.filter(text => !stopped.has(text))];
    const resolution: DecisionResolution = {
      revision: run.revision,
      stage,
      actionId: action.id,
      actingSquadIds: [...ev.acting],
      supportSquadIds: [...ev.support],
      officerIds: [...ev.participantIds],
      leadFlags: run.flags.filter((flag) => flag.startsWith(LEAD_PREFIX)),
      targetId: ev.action.targetId,
      inputs: ev.contributors,
      score: ev.score,
      difficulty: ev.difficulty,
      sample,
      band,
      timeCost,
      clockBaseMinutes,
      ...(dither > 0 ? { ditherMinutes: dither } : {}),
      stressDeltas: strain,
      stressLevels,
      itemsConsumed: consumed,
      unitsUsed,
      knowledgeChanges,
      explanation: [],
    };
    run.history.push(resolution);
    run.revision += 1;
    // The next decision opens now, and its stall waits while the result is read (openDecision).
    run.decisionOpenedAt = Math.max(ctx.now, draft.department.clockHighWater);
    delete run.decisionPausedAt;
    run.decisionPending = true;

    // stage transition (the committed decision is already in history)
    const stageNote = settleStage(run, scenario, stage, nextStage, ending);
    const resultLabel = (harmResultLabel(personConsequences?.records ?? [], incidentConsequences?.records ?? []))
      ?? actionResultLabel(action, band);
    // Lines spoken in this result, less the beats the live screen already played.
    const said = matched.flatMap(effect => effect.exchange ?? []).map(line => ({ ...line, speaker: line.speaker.replace('{lead}', (ev.leadId && draft.officers[ev.leadId]?.surname) || 'Negotiator') }))
      .filter(line => notHeard(heard)(line.line));
    resolution.committed = {
      objectiveDelta: round1(run.objective - before.objective),
      civilianSafetyDelta: round1(run.civilianSafety - before.civilianSafety),
      pressureDelta: round1(run.pressure - before.pressure),
      consequences: [
        ...texts.filter(notHeard(heard)),
        ...matched.flatMap((effect) => (effect.openings ?? []).map((change) => {
          const opening = built.location.openings.find((candidate) => candidate.id === change.openingId);
          return opening ? `${spaceLabel(built, opening.a)} to ${spaceLabel(built, opening.b)}: ${change.state}.` : `${change.openingId.replaceAll('_', ' ')}: ${change.state}.`;
        })),
        ...((run.stage as OperationRun['stage']) !== 'debrief' ? [`Next: ${currentStoryPrompt(scenario, run)}`] : []),
      ],
      endingTitle: run.endingId ? scenario.endings[run.endingId]?.title ?? run.endingId : null,
      ...(resultLabel ? { resultLabel } : {}),
      ...(openingChanges.size ? { openingChanges: [...openingChanges].map(([openingId, state]) => ({ openingId, state })) } : {}),
      ...(externalSupportEvents ? { externalSupport: externalSupportEvents } : {}),
      ...(incidentConsequences ? { officerCasualties: incidentConsequences.records } : {}),
      ...(personConsequences ? { personCasualties: personConsequences.records } : {}),
      ...(ev.protectionUsed ? { protectionUsed: { ...ev.protectionUsed } } : {}),
      ...(said.length ? { exchange: said } : {}),
      ...(heard.length ? { heard } : {}),
      ...(drawn.records.length ? { drawn: drawn.records.map(record => ({ ...record })) } : {}),
    };
    resolution.explanation = explain(draft, scenario, ev, band, texts, timeCost, t.civilianLoss, knowledgeChanges, consumed, strain, stageNote, fillNote, fillStrainMult);
    return { ok: true };
  },

  /** The open decision point's time ran out with no choice made (docs/call-pressure.md, "When the
   * time runs out"). Settled only when lapsedThreat says so, on the revision and threat the screen
   * showed: the threat lands with its full window, the call moves to the moment its timeout names
   * (a clock running out on the way can still route or end it first, as with a decision), and the
   * record says nobody chose. No roll, no strain, no experience. */
  lapse(draft, cmd, ctx) {
    const run = draft.activeRun;
    if (!run || run.status !== 'active' || run.stage === 'debrief') return fail('No decision is open');
    if (run.revision !== cmd.revision) return fail('The call moved on before the time ran out');
    const scenario = getScenario(run.scenarioId);
    if (!scenario) return fail('Unknown scenario');
    const threat = lapsedThreat(scenario, run, draft.department.clockHighWater, ctx.now, ctx.timer ?? 'off');
    if (!threat || threat.id !== cmd.threatId) return fail('There is still time on this decision');
    const stage = run.stage;
    // The whole window was stall: one sample for the department's habits (sim/player-profile.ts).
    recordStall(draft.department, 1);
    const minutes = threat.minutes;
    const heard = heardLive(scenario, run, minutes, 'Negotiator');
    const matched = lapseEffects(scenario, threat, run);
    const before = { objective: run.objective, civilianSafety: run.civilianSafety, pressure: run.pressure };
    const clocksBefore = run.clocks;
    // Nobody led this one, so no lead's traits are read in it.
    run.flags = run.flags.filter((flag) => !flag.startsWith(LEAD_PREFIX));
    // The same path a decision's stall takes (decide): its pressure once, then its minutes.
    run.pressure = round1(clamp(run.pressure + CLOCK_RULES_V1.stallPressurePerMinute * minutes, 0, 100));
    const t = advanceTime(run, scenario, minutes);
    const { changes, stage: routeStage, ending: routeEnding } = applyEffects(run, matched);
    const cues = applyClockCues(run, scenario, t.cues);
    changes.push(...cues.changes);
    const outs = clockOutEffects(scenario, clocksBefore, run.clocks, run, matched);
    const routed = applyEffects(run, outs);
    changes.push(...routed.changes);
    applyMoves(run, scenario, matched);
    // A route that names a commitment finds it out (sim/commitments.ts breakCommitments).
    breakCommitments(run, scenario, matched);
    const personConsequences = applyPersonConsequences(run, scenario, null, null, outs);
    const nextStage = routed.ending ? null : routed.stage ?? routeStage;
    const ending = routed.ending ?? routeEnding;

    const landing = threat.effects.map((effect) => effect.text).filter((text): text is string => !!text);
    const route = matched[0] && threat.timeout?.includes(matched[0]) && matched[0].text ? [matched[0].text] : [];
    const cueTexts = cues.effects.map((effect) => effect.text).filter((text): text is string => !!text);
    const texts = [...landing, ...route, ...personConsequences.text, ...cueTexts];
    const exchange = matched.flatMap((effect) => effect.exchange ?? []).map((line) => ({ ...line, speaker: line.speaker.replace('{lead}', 'Negotiator') })).filter((line) => notHeard(heard)(line.line));
    const record: LapseRecord = {
      kind: 'lapse', revision: run.revision, stage, threatId: threat.id, label: threat.label, timeCost: minutes,
      knowledgeChanges: changes, explanation: [],
      committed: { objectiveDelta: 0, civilianSafetyDelta: 0, pressureDelta: 0, consequences: [], endingTitle: null },
    };
    run.history.push(record);
    run.revision += 1;
    run.decisionOpenedAt = Math.max(ctx.now, draft.department.clockHighWater);
    delete run.decisionPausedAt;
    run.decisionPending = true;
    const stageNote = settleStage(run, scenario, stage, nextStage, ending);
    record.committed = {
      objectiveDelta: round1(run.objective - before.objective),
      civilianSafetyDelta: round1(run.civilianSafety - before.civilianSafety),
      pressureDelta: round1(run.pressure - before.pressure),
      consequences: [...texts.filter(notHeard(heard)), ...((run.stage as OperationRun['stage']) !== 'debrief' ? [`Next: ${currentStoryPrompt(scenario, run)}`] : [])],
      endingTitle: run.endingId ? scenario.endings[run.endingId]?.title ?? run.endingId : null,
      ...(personConsequences.records.length ? { personCasualties: personConsequences.records } : {}),
      ...(exchange.length ? { exchange } : {}),
      ...(heard.length ? { heard } : {}),
    };
    record.explanation = [`${LAPSE_TITLE(threat.label)}.`, ...texts, `Took ${minutes} min.`,
      ...(t.civilianLoss > 0 ? [`Time pressure is past ${scenario.pressure.threshold}: civilian safety fell ${t.civilianLoss}.`] : []), ...(stageNote ? [stageNote] : [])];
    return { ok: true };
  },

  closeDebrief(draft, _cmd, _ctx) {
    const run = draft.activeRun;
    if (!run) return fail('No debrief to close');
    if (run.status !== 'debrief') return fail('The operation is still running');
    if (run.settled) return fail('This debrief was already settled');
    const result = computeDebrief(draft, run);
    if (!result) return fail('Debrief unavailable');
    const scenario = getScenario(run.scenarioId);

    const settled = settleRun(draft, run.id, unitsUsedTotals(run), departmentUpkeep(draft));
    result.resources = settled.resources;
    result.unitWear = settled.unitWear;
    // v13 careers read the same scored factor the debrief paid out (sim/outcome-score.ts).
    const factor = scenario!.incidentPeople?.length && !run.responseFailure ? scoreCall(scenario!, run, { officers: draft.officers, steps: traceRun(scenario!, run).steps }).factor : outcomeFactor(run);
    const verdict: 'favorable' | 'adverse' | null = factor >= CAREER_TUNING.favorableAt && (result.completionAchieved) ? 'favorable' : factor < CAREER_TUNING.adverseBelow ? 'adverse' : null;
    postFunding(draft.department, result.fundingReward, 'payout', `Call payout, ${scenario?.title ?? result.endingTitle}`, draft.department.clockHighWater);
    draft.department.trust = clamp(draft.department.trust + result.trustDelta, 0, 100);
    if (result.serviceEarned !== undefined) addService(draft.department, result.serviceEarned);
    if (!run.responseFailure && (result.completionAchieved ?? factor >= CAREER_TUNING.favorableAt)) draft.department.callsResolved = (draft.department.callsResolved ?? 0) + 1;
    const payoutShare = result.officerCondition.length ? result.fundingReward / result.officerCondition.length : 0;
    for (const oc of result.officerCondition) {
      const o = draft.officers[oc.officerId];
      if (!o) continue;
      o.career.earned = (o.career.earned ?? 0) + payoutShare;
      awardXp(draft, o, oc.xpGained, `after ${scenario?.title ?? result.endingTitle}`, draft.department.clockHighWater);
      o.stress = oc.stressAfter;
      o.career.operations += 1;
      if (verdict) o.career[verdict] += 1;
      const type = scenario?.incident?.type;
      if (type) o.career.byType = { ...o.career.byType, [type]: (o.career.byType?.[type] ?? 0) + 1 };
    }
    applyWorldDebrief(draft, run, result);
    applyPeopleDebrief(draft, run, result, verdict);
    clearAssignments(draft, run);
    run.settled = true;
    run.status = 'closed';
    draft.debriefs = [result, ...draft.debriefs].slice(0, 10);
    // Fold now, not only at the next dispatch: the state keeps ten debriefs, so a later run
    // could otherwise push a best result out before it is recorded.
    foldDebriefs(draft, draft.department.clockHighWater);
    // Level, trust and resolved calls only move here, so this is where milestones are met.
    applyGrants(draft, draft.department.clockHighWater);
    draft.activeRun = null;
    return { ok: true };
  },
};

/** Where the call stands once a commit has applied (a decision or a lapse, already in history): an
 * ending it reached, the next stage, or still here. The one place both settle, returning the line
 * the result adds. */
function settleStage(run: OperationRun, scenario: ScenarioDefinition, stage: StageId, nextStage: StageId | null | undefined, ending: Id | null | undefined): string | null {
  let stageNote: string | null = null;
  const pendingPrefix = 'completion_pending:';
  const intendedEnding = ending ?? (run.flags.find(flag => flag.startsWith(pendingPrefix) && !!scenario.endings[flag.slice(pendingPrefix.length)])?.slice(pendingPrefix.length));
  if (intendedEnding) {
    const declared = scenario.endings[intendedEnding];
    const completion = declared ? completionEvidence(scenario, run, declared) : undefined;
    const incomplete = completion && ['resolved', 'care_accepted', 'followup_agreed'].includes(declared.disposition ?? '') && !completion.completionAchieved;
    // A call tree (v13) ends where it says it ends. Outstanding harm still costs completion:
    // completionEvidence marks the ending partial and lists who still needs care.
    const treeEnding = !!declared && !!completion && completion.disposition === 'relief_partial';
    if (incomplete && !treeEnding) {
      run.flags = [...run.flags.filter(flag => !flag.startsWith(pendingPrefix)), `${pendingPrefix}${intendedEnding}`];
      run.stage = 'resolve';
      stageNote = 'The completed step is retained. Outstanding care and scene duties keep the call open.';
    } else {
      run.flags = run.flags.filter(flag => !flag.startsWith(pendingPrefix));
      const finalEnding = incomplete && !treeEnding ? FALLBACK_ENDING : intendedEnding;
      run.stage = 'debrief';
      run.status = 'debrief';
      run.endingId = finalEnding;
      stageNote = `Ending: ${scenario.endings[finalEnding]?.title ?? finalEnding}.`;
    }
  } else {
    if (nextStage) run.stage = nextStage;
    if (run.stage !== stage) stageNote = `Moved on to ${scenario.stages[run.stage as StageId].label}.`;
  }
  return stageNote;
}

/** Every way a run ends comes through here, so queued squad moves apply once its officers are back. */
function clearAssignments(draft: GameState, run: OperationRun): void {
  for (const o of Object.values(draft.officers)) {
    if (o.assignment?.kind === 'operation' && o.assignment.runId === run.id) o.assignment = null;
  }
  flushSquadMoves(draft);
}

/** End a run without settling it: no rewards, its reservations and officers are released,
 * and its card returns to the board while it is still current. Used by cancelOperation. */
function abandonRun(draft: GameState, run: OperationRun, now: number): void {
  releaseRun(draft, run.id);
  clearAssignments(draft, run);
  if (run.world) {
    // A world call cancelled before its first decision gives the lead back: it returns to open, and the player
    // opens the warrant again when ready. The card does not return to the board (leads never expire, cards
    // would only strand them).
    const lead = draft.world.leads.find((l) => l.id === run.world!.leadId);
    if (lead && lead.status === 'warrant') {
      lead.status = 'open';
      delete lead.cardId;
    }
  } else if (run.sourceIncident && run.sourceIncident.expiresAt > Math.max(now, draft.department.clockHighWater)) {
    // Give the player's cancelled call priority if idle arrivals filled the board.
    draft.incidents = [run.sourceIncident, ...draft.incidents.filter((c) => c.id !== run.scenarioId)].slice(0, INCIDENT_TUNING.boardMax);
  }
  draft.activeRun = null;
}

export { openingOverrides };
