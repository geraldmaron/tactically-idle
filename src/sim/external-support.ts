import type { ActionDefinition, Condition, EndingDefinition, ExternalServiceDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { CompletionDisposition, DebriefResult, ExternalSupportEvent, ExternalSupportState, OperationRun } from './types';
import { next } from './rng';

type SupportRun = Pick<OperationRun, 'clock' | 'externalSupport'>;
type PublicRun = Pick<OperationRun, 'knowledge' | 'flags' | 'pressure'>;
export type ExternalSupportStatus = 'unrequested' | 'requested' | 'available' | 'accepted' | 'unavailable';
const round1 = (value: number) => Math.round(value * 10) / 10;
export const MAX_EXTERNAL_RESPONSE_MINUTES = 20;

/** Public-state conditions only. Kept independent of resolution's equipment evaluator. */
function conditionsHold(condition: Condition | undefined, run: PublicRun): boolean {
  if (!condition) return true;
  return (condition.facts ?? []).every((fact) => fact.in.includes(run.knowledge[fact.factId] ?? 'unknown'))
    && (condition.flags ?? []).every((flag) => run.flags.includes(flag))
    && (condition.notFlags ?? []).every((flag) => !run.flags.includes(flag))
    && (condition.pressureAtLeast === undefined || run.pressure >= condition.pressureAtLeast)
    && (condition.pressureBelow === undefined || run.pressure < condition.pressureBelow);
}

export function externalSupportStatus(run: SupportRun, service: ExternalServiceDefinition): ExternalSupportStatus {
  const state = run.externalSupport?.[service.id];
  if (!service.available) return 'unavailable';
  if (!state) return 'unrequested';
  if (state.acceptedAt !== null) return 'accepted';
  return state.availableAt !== null && run.clock >= state.availableAt ? 'available' : 'requested';
}

export function externalSupportViews(scenario: ScenarioDefinition, run: SupportRun) {
  return (scenario.externalServices ?? []).map((service) => {
    const state = run.externalSupport?.[service.id];
    return {
      id: service.id, label: service.label, kind: service.kind, description: service.description,
      status: externalSupportStatus(run, service),
      minutesRemaining: state?.availableAt == null ? null : round1(Math.max(0, state.availableAt - run.clock)),
      requestedAt: state?.requestedAt ?? null, availableAt: state?.availableAt ?? null, acceptedAt: state?.acceptedAt ?? null,
    };
  });
}

export function remainingSupportWait(run: SupportRun, scenario: ScenarioDefinition, serviceId: string): number | null {
  const service = scenario.externalServices?.find((entry) => entry.id === serviceId);
  if (!service || externalSupportStatus(run, service) !== 'requested') return null;
  const availableAt = run.externalSupport?.[serviceId]?.availableAt;
  return availableAt == null ? null : round1(Math.max(0, availableAt - run.clock));
}

/** Checked before sampling, advancing time, consuming supplies, or touching any state. */
export function externalSupportActionIssue(run: SupportRun & PublicRun, scenario: ScenarioDefinition, action: ActionDefinition): string | null {
  const services = new Map((scenario.externalServices ?? []).map((service) => [service.id, service]));
  for (const requirement of action.requires.externalSupport ?? []) {
    const service = services.get(requirement.serviceId);
    const status = service ? externalSupportStatus(run, service) : null;
    const matches = requirement.status === 'requested' ? status === 'requested' || status === 'available' : status === requirement.status;
    if (!matches) return requirement.reason;
  }
  const effects = Object.values(action.outcomes).flat();
  for (const id of new Set(effects.flatMap((effect) => effect.requestSupport ?? []))) {
    const service = services.get(id);
    if (!service) return 'That response service is not part of this incident';
    if (run.externalSupport?.[id]) return `${service.label} has already been requested`;
  }
  for (const id of new Set(effects.flatMap((effect) => effect.acceptSupport ?? []))) {
    const service = services.get(id);
    if (!service) return 'That receiving service is not part of this incident';
    if (externalSupportStatus(run, service) !== 'available') return `${service.label} must be available before accepting responsibility`;
    if (!conditionsHold(service.acceptWhen, run)) return `${service.label} cannot accept responsibility until the care and safety preparations are complete`;
    if (!action.requires.externalSupport?.some((requirement) => requirement.serviceId === id && requirement.status === 'available'))
      return 'This action does not identify the available receiving service';
  }
  if (action.awaitSupport && remainingSupportWait(run, scenario, action.awaitSupport) === null) return 'There is no pending response to wait for';
  return null;
}

/** Call only after the action passed its gates; every request and acceptance is one-shot. */
export function applyExternalSupportEffects(run: SupportRun, scenario: ScenarioDefinition, effects: OutcomeEffect[]): ExternalSupportEvent[] {
  const events: ExternalSupportEvent[] = [];
  const services = new Map((scenario.externalServices ?? []).map((service) => [service.id, service]));
  for (const effect of effects) {
    for (const id of effect.requestSupport ?? []) {
      const service = services.get(id);
      if (!service || run.externalSupport?.[id]) continue;
      run.externalSupport ??= {};
      run.externalSupport[id] = {
        requestedAt: run.clock,
        availableAt: service.available ? round1(run.clock + service.arrivalMinutes) : null,
        acceptedAt: null,
      };
      events.push({ serviceId: id, kind: 'requested', at: run.clock });
    }
    for (const id of effect.acceptSupport ?? []) {
      const service = services.get(id);
      const state = run.externalSupport?.[id];
      if (!service || !state || externalSupportStatus(run, service) !== 'available') continue;
      state.acceptedAt = run.clock;
      events.push({ serviceId: id, kind: 'accepted', at: run.clock });
    }
  }
  return events;
}

const FULL_DISPOSITIONS: CompletionDisposition[] = ['resolved', 'care_accepted', 'followup_agreed'];
export const COMPLETION_DISPOSITIONS: CompletionDisposition[] = [...FULL_DISPOSITIONS, 'relief_partial', 'unresolved'];

export function hasCompletionConditions(ending: EndingDefinition): boolean {
  const c = ending.completion;
  return !!c && !!(c.acceptedServiceId || c.facts?.length || c.flags?.length || c.notFlags?.length || c.pressureAtLeast !== undefined || c.pressureBelow !== undefined);
}

export function completionEvidence(scenario: ScenarioDefinition, run: SupportRun & PublicRun, ending: EndingDefinition): Pick<DebriefResult, 'disposition' | 'completionAchieved' | 'receivingService' | 'remainingTasks'> {
  const serviceId = ending.completion?.acceptedServiceId;
  const service = scenario.externalServices?.find((entry) => entry.id === serviceId);
  const state = serviceId ? run.externalSupport?.[serviceId] : undefined;
  const receiverAccepted = !!service && externalSupportStatus(run, service) === 'accepted' && state?.acceptedAt != null;
  const disposition = ending.disposition ?? 'unresolved';
  const completionAchieved = FULL_DISPOSITIONS.includes(disposition) && hasCompletionConditions(ending)
    && conditionsHold(ending.completion, run)
    && (!serviceId || receiverAccepted) && (disposition !== 'care_accepted' || receiverAccepted);
  return {
    disposition: FULL_DISPOSITIONS.includes(disposition) && !completionAchieved ? 'unresolved' : disposition,
    completionAchieved,
    ...(receiverAccepted ? { receivingService: { id: service!.id, label: service!.label, kind: service!.kind, acceptedAt: state!.acceptedAt! } } : {}),
    remainingTasks: completionAchieved ? [] : [
      ...ending.remainingTasks ?? [],
      ...(serviceId && !receiverAccepted ? [`${service?.label ?? 'The receiving service'} has not accepted responsibility.`] : []),
      ...(!ending.remainingTasks?.length && !serviceId ? ['Incident responsibilities remain unfinished.'] : []),
    ],
  };
}

/** Legacy saves omit these fields. V4 timers are reconstructed solely from committed events. */
export function validExternalSupportState(run: OperationRun, scenario: ScenarioDefinition): boolean {
  if (scenario.version < 4) return run.externalSupport === undefined;
  if (!run.externalSupport || typeof run.externalSupport !== 'object' || Array.isArray(run.externalSupport)) return false;
  const expected: Record<string, ExternalSupportState> = {};
  let clock = (run.resupplies ?? []).reduce((sum, delivery) => round1(sum + delivery.minutes), 0);
  const publicState: PublicRun = { knowledge: Object.fromEntries(scenario.facts.map((fact) => [fact.id, fact.initial])), flags: [], pressure: scenario.pressure.start };
  for (const delivery of run.resupplies ?? []) publicState.pressure = round1(Math.max(0, Math.min(100, publicState.pressure + scenario.pressure.perMinute * delivery.minutes)));
  const decisions = new Set<string>();
  if (!Number.isSafeInteger(run.rngState) || run.rngState < 0 || run.rngState > 0xffffffff) return false;
  // Mulberry32 advances by a fixed uint32 increment. Check the whole saved sample sequence.
  let rngState = (run.rngState - Math.imul(run.history.length, 0x6d2b79f5)) >>> 0;
  for (const decision of run.history) {
    if (!Number.isFinite(decision.timeCost) || decision.timeCost <= 0) return false;
    const beforeClock = clock;
    clock = round1(clock + decision.timeCost);
    const events = decision.committed?.externalSupport;
    if (!Array.isArray(events)) return false;
    const action = scenario.stages[decision.stage].actions.find((candidate) => candidate.id === decision.actionId);
    if (!action) return false;
    const decisionKey = `${decision.stage}:${decision.actionId}`;
    if (decisions.has(decisionKey)) return false;
    decisions.add(decisionKey);
    const sample = next(rngState);
    if (sample.value !== decision.sample) return false;
    rngState = sample.state;
    if (externalSupportActionIssue({ ...publicState, clock: beforeClock, externalSupport: expected }, scenario, action)) return false;
    if (action.awaitSupport && decision.timeCost !== remainingSupportWait({ clock: beforeClock, externalSupport: expected }, scenario, action.awaitSupport)) return false;
    const effects = action.outcomes[decision.band].filter((effect) => conditionsHold(effect.when, publicState)
      && (effect.truth ?? []).every((truth) => scenario.facts.find((fact) => fact.id === truth.factId)?.truth === truth.is));
    const expectedEvents = effects.flatMap((effect) => [
      ...(effect.requestSupport ?? []).map((serviceId) => ({ kind: 'requested', serviceId })),
      ...(effect.acceptSupport ?? []).map((serviceId) => ({ kind: 'accepted', serviceId })),
    ]);
    if (events.length !== expectedEvents.length || events.some((event, index) => event.kind !== expectedEvents[index].kind || event.serviceId !== expectedEvents[index].serviceId)) return false;
    for (const event of events) {
      const service = scenario.externalServices?.find((entry) => entry.id === event.serviceId);
      if (!service || event.at !== clock) return false;
      if (event.kind === 'requested') {
        if (expected[event.serviceId] || !effects.some((effect) => effect.requestSupport?.includes(event.serviceId))) return false;
        expected[event.serviceId] = { requestedAt: clock, availableAt: service.available ? round1(clock + service.arrivalMinutes) : null, acceptedAt: null };
      } else if (event.kind === 'accepted') {
        const state = expected[event.serviceId];
        if (!state || state.availableAt === null || state.availableAt > beforeClock || state.acceptedAt !== null
          || !effects.some((effect) => effect.acceptSupport?.includes(event.serviceId))) return false;
        state.acceptedAt = clock;
      } else return false;
    }
    for (const effect of effects) {
      for (const flag of effect.setFlags ?? []) if (!publicState.flags.includes(flag)) publicState.flags.push(flag);
      for (const flag of effect.clearFlags ?? []) publicState.flags = publicState.flags.filter((entry) => entry !== flag);
      for (const opening of effect.openings ?? []) {
        publicState.flags = publicState.flags.filter((entry) => !entry.startsWith(`opening:${opening.openingId}=`));
        publicState.flags.push(`opening:${opening.openingId}=${opening.state}`);
      }
    }
    for (const change of decision.knowledgeChanges) publicState.knowledge[change.factId] = change.status;
    publicState.pressure = round1(publicState.pressure + decision.committed!.pressureDelta);
  }
  if (clock !== run.clock || Object.keys(expected).length !== Object.keys(run.externalSupport).length) return false;
  return Object.entries(expected).every(([id, state]) => {
    const actual = run.externalSupport?.[id];
    return actual && actual.requestedAt === state.requestedAt && actual.availableAt === state.availableAt && actual.acceptedAt === state.acceptedAt;
  });
}
