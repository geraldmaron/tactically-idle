import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { CivilianOutcomeView, ForceOutcome, GameState, Id, OfficerCasualtyRecord, OperationRun, OutcomeBand, PersonCasualtyRecord } from './types';
import { protectedOfficerEffects, selectedForceRisk, selectedProtection, validForceOutcome } from './force-risk';
import { ITEMS } from '../content/items';
import type { Use } from './resolution';

/** Game recovery balance, in real hours; these are not medical predictions. */
export const INJURY_RECOVERY_HOURS = { wounded: 2, serious: 8 } as const;
const HOUR = 3_600_000;
const CASUALTY_FLAGS = ['casualty:officers', 'casualty:untreated', 'casualty:awaiting_transport', 'casualty:evacuated'];

export function incidentOfficerUnavailable(state: GameState, run: OperationRun, officerId: Id): boolean {
  if (run.scenarioVersion < 4) return false;
  return !!run.officerCasualties?.[officerId]
    || !!(state.officers[officerId]?.injury && state.officers[officerId].injury!.until > state.department.clockHighWater);
}

export function casualtyFlags(records: Record<Id, OfficerCasualtyRecord>): string[] {
  const people = Object.values(records);
  if (!people.length) return [];
  return ['casualty:officers',
    ...(people.some(person => person.care === 'needed') ? ['casualty:untreated'] : []),
    ...(people.some(person => person.care !== 'evacuated') ? ['casualty:awaiting_transport'] : []),
    ...(people.every(person => person.care === 'evacuated') ? ['casualty:evacuated'] : []),
  ];
}

export function syncCasualtyFlags(run: Pick<OperationRun, 'flags' | 'officerCasualties'>): void {
  run.flags = [...run.flags.filter(flag => !CASUALTY_FLAGS.includes(flag)), ...casualtyFlags(run.officerCasualties ?? {})];
}

export function civilianOutcomeViews(scenario: ScenarioDefinition, run: Pick<OperationRun, 'flags' | 'knowledge' | 'personCasualties'>): CivilianOutcomeView[] {
  return (scenario.civilianOutcomes ?? []).map(person => {
    const knowledge = run.knowledge[person.factId] ?? 'unknown';
    const casualty = scenario.version >= 7 ? run.personCasualties?.[person.id] : undefined;
    const status: CivilianOutcomeView['status'] = casualty?.severity === 'fatal' ? 'deceased'
      : casualty ? casualty.care === 'accepted' ? 'care_accepted' : 'injured_needs_care'
      : run.flags.includes(person.careFlag) ? 'care_accepted'
      : run.flags.includes(person.injuredFlag) ? 'injured_needs_care'
      : run.flags.includes(person.safeFlag) ? 'safe'
      : knowledge === 'disproved' ? 'accounted_elsewhere'
      : knowledge === 'confirmed' ? 'needs_help' : 'unaccounted';
    return { id: person.id, label: person.label, status };
  });
}

/** No treatment is offered without an actual recorded injury and its actual resources. */
export function casualtyActionIssue(run: OperationRun, scenario: ScenarioDefinition, action: ActionDefinition): string | null {
  const effects = Object.values(action.outcomes).flat();
  const people = Object.values(run.officerCasualties ?? {});
  if (effects.some(effect => effect.officerCare === 'stabilize')) {
    if (!people.some(person => person.care === 'needed')) return 'No injured officer needs field care';
    if (!action.requires.certs?.includes('advanced_first_aid') || !action.consumes?.some(use => use.tag === 'medkit' && use.qty >= 1))
      return 'Officer care needs a qualified first aider and one trauma kit';
  }
  if (effects.some(effect => effect.officerCare === 'evacuate')) {
    if (!people.some(person => person.care !== 'evacuated')) return 'No injured officer is awaiting medical transport';
    const receiver = scenario.externalServices?.find(service => service.kind === 'medical'
      && action.requires.externalSupport?.some(requirement => requirement.serviceId === service.id && requirement.status === 'available')
      && effects.some(effect => effect.officerCare === 'evacuate' && effect.acceptSupport?.includes(service.id)));
    if (!receiver) return 'Medical evacuation needs an available ambulance crew accepting the injured officers';
  }
  return null;
}

/** Applied once from matched effects. The existing action sample chooses the outcome band. */
export function applyIncidentConsequences(state: GameState, run: OperationRun, scenario: ScenarioDefinition, effects: OutcomeEffect[], participantIds: Id[]): { records: OfficerCasualtyRecord[]; text: string[] } {
  const records: OfficerCasualtyRecord[] = [];
  const text: string[] = [];
  for (const effect of effects) {
    if (effect.officerHarm) {
      const id = participantIds.find(candidate => state.officers[candidate] && !run.officerCasualties?.[candidate]);
      if (id) {
        const officer = state.officers[id];
        const { severity, label } = effect.officerHarm;
        const recoveryUntil = Math.max(officer.injury?.until ?? 0, state.department.clockHighWater + INJURY_RECOVERY_HOURS[severity] * HOUR);
        const record: OfficerCasualtyRecord = { officerId: id, severity, label, at: run.clock, care: 'needed', recoveryUntil };
        run.officerCasualties ??= {};
        run.officerCasualties[id] = record;
        if (!run.practice) officer.injury = { label, until: recoveryUntil };
        records.push({ ...record });
        text.push(`${officer.firstName} ${officer.surname} was ${severity === 'serious' ? 'seriously wounded' : 'wounded'} and is out of action. Medical care and transport are still needed.`);
      }
    }
    if (effect.officerCare === 'stabilize') {
      const person = Object.values(run.officerCasualties ?? {}).filter(candidate => candidate.care === 'needed')
        .sort((a, b) => Number(b.severity === 'serious') - Number(a.severity === 'serious') || a.at - b.at || a.officerId.localeCompare(b.officerId))[0];
      if (person) {
        person.care = 'stabilized';
        person.recoveryUntil = Math.min(person.recoveryUntil, Math.max(state.department.clockHighWater, Math.round(state.department.clockHighWater + (person.recoveryUntil - state.department.clockHighWater) * 0.8)));
        const officer = state.officers[person.officerId];
        if (!run.practice && officer) officer.injury = { label: person.label, until: person.recoveryUntil };
        records.push({ ...person });
        text.push(`${officer?.firstName ?? ''} ${officer?.surname ?? person.officerId} received field care. They remain out of action and still need transport.`.trim());
      }
    }
    if (effect.officerCare === 'evacuate') {
      const receiver = scenario.externalServices?.find(service => service.kind === 'medical' && effect.acceptSupport?.includes(service.id) && run.externalSupport?.[service.id]?.acceptedAt !== null && run.externalSupport?.[service.id]?.acceptedAt !== undefined);
      if (receiver) for (const person of Object.values(run.officerCasualties ?? {}).filter(candidate => candidate.care !== 'evacuated')) {
        person.care = 'evacuated';
        records.push({ ...person });
        const officer = state.officers[person.officerId];
        text.push(`${receiver.label} accepted ${officer ? `${officer.firstName} ${officer.surname}` : person.officerId} for care. They remain unavailable for the rest of this operation.`);
      }
    }
  }
  syncCasualtyFlags(run);
  return { records, text };
}

export function validCasualtyRecord(value: unknown): value is OfficerCasualtyRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const person = value as OfficerCasualtyRecord;
  return typeof person.officerId === 'string' && ['wounded', 'serious'].includes(person.severity)
    && typeof person.label === 'string' && person.label.trim().length > 0
    && Number.isFinite(person.at) && person.at >= 0
    && ['needed', 'stabilized', 'evacuated'].includes(person.care)
    && Number.isFinite(person.recoveryUntil) && person.recoveryUntil >= 0;
}

const PERSON_CASUALTY_FLAGS = ['casualty:people', 'casualty:person_fatality', 'casualty:person_needs_care'];

export function syncPersonCasualtyFlags(run: Pick<OperationRun, 'flags' | 'personCasualties'>, scenario: ScenarioDefinition): void {
  if (scenario.version < 7) return;
  const people = Object.values(run.personCasualties ?? {});
  run.flags = run.flags.filter(flag => !PERSON_CASUALTY_FLAGS.includes(flag) && !flag.startsWith('person_harm:') && !flag.startsWith('person_care:'));
  if (people.length) run.flags.push('casualty:people');
  if (people.some(person => person.severity === 'fatal')) run.flags.push('casualty:person_fatality');
  if (people.some(person => person.care === 'needed' || person.care === 'stabilized')) run.flags.push('casualty:person_needs_care');
  for (const person of people) {
    run.flags.push(`person_harm:${person.personId}:${person.severity}`, `person_care:${person.personId}:${person.care}`);
    const civilian = scenario.civilianOutcomes?.find(candidate => candidate.id === person.personId);
    if (civilian) {
      run.flags = run.flags.filter(flag => flag !== civilian.safeFlag && flag !== civilian.careFlag && flag !== civilian.injuredFlag);
      if (person.severity !== 'fatal') run.flags.push(civilian.injuredFlag);
      if (person.care === 'accepted') run.flags.push(civilian.careFlag);
    }
  }
}

/** These are committed injuries, never hidden medical facts or predictions. */
export function personCasualtyActionIssue(run: Pick<OperationRun, 'personCasualties'>, scenario: ScenarioDefinition, action: ActionDefinition): string | null {
  if (scenario.version < 7) return null;
  const care = action.personCare;
  const person = run.personCasualties?.[care?.personId ?? action.forceProfile?.personId ?? action.storyTargetPersonId ?? ''];
  if (care) {
    if (!person) return 'No recorded injury needs this care';
    if (person.severity === 'fatal') return `${person.label} has died; medical care cannot reverse that outcome`;
    if (care.kind === 'stabilize') {
      if (person.care !== 'needed') return `${person.label} has already received field care`;
      if (!action.requires.certs?.includes('advanced_first_aid') || !action.consumes?.some(use => use.tag === 'medkit' && use.qty >= 1)) return 'Field care needs a qualified first aider and one trauma kit';
    } else {
      if (person.care === 'accepted') return `${person.label} is already in medical care`;
      if (!scenario.externalServices?.some(service => service.id === care.serviceId && service.kind === 'medical')
        || !action.requires.externalSupport?.some(requirement => requirement.serviceId === care.serviceId && requirement.status === 'available')
        || !Object.values(action.outcomes).flat().some(effect => effect.acceptSupport?.includes(care.serviceId ?? ''))) return 'Injured people need an available medical crew explicitly accepting responsibility';
    }
    return null;
  }
  if (person?.severity === 'fatal') return `${person.label} has died and cannot take part in this action`;
  if (person && (action.check.kind === 'contact' || action.forceProfile || action.storyRouteActor === 'person')) return `${person.label} is injured; medical care must take priority over this action`;
  // Generic civilian choices may identify their recipient only through outcome flags.
  for (const casualty of Object.values(run.personCasualties ?? {})) {
    const civilian = scenario.civilianOutcomes?.find(candidate => candidate.id === casualty.personId);
    if (civilian && Object.values(action.outcomes).flat().some(effect => effect.setFlags?.some(flag => flag === civilian.safeFlag || flag === civilian.careFlag)))
      return `${casualty.label} ${casualty.severity === 'fatal' ? 'has died' : 'needs recorded medical care'}; this ordinary safe-outcome choice no longer applies`;
    const binding = Object.values(scenario.story?.bindings.people ?? {}).find(person => person.id === casualty.personId);
    if (casualty.severity === 'fatal' && binding?.transitions.some(transition => transition.when.flags?.some(flag => Object.values(action.outcomes).flat().some(effect => effect.setFlags?.includes(flag)))))
      return `${casualty.label} has died; this movement or departure no longer applies`;
  }
  return null;
}

export function applyPersonConsequences(run: OperationRun, scenario: ScenarioDefinition, action: ActionDefinition, band: OutcomeBand, effects: OutcomeEffect[], force?: ForceOutcome): { records: PersonCasualtyRecord[]; text: string[] } {
  const records: PersonCasualtyRecord[] = [];
  const text: string[] = [];
  if (scenario.version < 7) return { records, text };
  if (force) {
    if (force.severity === 'none') text.push(`${force.personLabel}: no new injury was recorded from ${ITEMS[force.itemId].name.toLowerCase()} use. The task result is separate.`);
    else {
      const person: PersonCasualtyRecord = { personId: force.personId, personRole: force.personRole, label: force.personLabel,
        severity: force.severity, at: run.clock, care: force.severity === 'fatal' ? 'deceased' : 'needed', causeRevision: run.revision };
      run.personCasualties ??= {};
      run.personCasualties[person.personId] = person;
      records.push({ ...person });
      const penalty = { wounded: 10, serious: 24, fatal: 60 }[person.severity];
      run.civilianSafety = Math.max(0, Math.round((run.civilianSafety - penalty) * 10) / 10);
      text.push(`${person.label} (${person.personRole}) ${person.severity === 'fatal' ? 'died' : person.severity === 'serious' ? 'was seriously injured' : 'was injured'} following ${ITEMS[force.itemId].name.toLowerCase()} use. ${person.severity === 'fatal' ? 'The fatality remains part of the incident; ordinary safe resolution is no longer possible.' : 'Medical care and an accepting medical crew are still needed.'}`);
    }
  }
  const care = action.personCare;
  const person = care ? run.personCasualties?.[care.personId] : undefined;
  if (care && person && person.severity !== 'fatal') {
    if (care.kind === 'stabilize' && person.care === 'needed' && band !== 'adverse') {
      person.care = 'stabilized'; records.push({ ...person });
      text.push(`${person.label} received field care. The injury remains recorded and a medical crew must still accept responsibility.`);
    } else if (care.kind === 'accept' && person.care !== 'accepted' && effects.some(effect => effect.acceptSupport?.includes(care.serviceId ?? ''))
      && run.externalSupport?.[care.serviceId ?? '']?.acceptedAt === run.clock) {
      person.care = 'accepted'; records.push({ ...person });
      text.push(`${scenario.externalServices?.find(service => service.id === care.serviceId)?.label ?? 'The medical crew'} accepted ${person.label} for care. The injury remains recorded.`);
    }
  }
  syncPersonCasualtyFlags(run, scenario);
  return { records, text };
}

export function validPersonCasualtyRecord(value: unknown): value is PersonCasualtyRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const person = value as PersonCasualtyRecord;
  return [person.personId, person.label].every(text => typeof text === 'string' && text.trim().length > 0)
    && ['subject', 'civilian'].includes(person.personRole) && ['wounded', 'serious', 'fatal'].includes(person.severity)
    && Number.isFinite(person.at) && person.at >= 0 && Number.isSafeInteger(person.causeRevision) && person.causeRevision >= 0
    && (person.severity === 'fatal' ? person.care === 'deceased' : ['needed', 'stabilized', 'accepted'].includes(person.care));
}

/** Rebuild V7 causal records from immutable decisions; reject detached gear, supplies,
 * invented targets, changed severity, resurrection and unearned care transitions. */
export function validPersonConsequences(run: OperationRun, scenario: ScenarioDefinition, state: GameState): boolean {
  if (scenario.version < 7) return run.personCasualties === undefined && run.history.every(decision => decision.committed?.forceOutcome === undefined && decision.committed?.personCasualties === undefined && decision.committed?.protectionUsed === undefined);
  if (run.personCasualties !== undefined && (!run.personCasualties || typeof run.personCasualties !== 'object' || Array.isArray(run.personCasualties))) return false;
  const expected: Record<Id, PersonCasualtyRecord> = {};
  const spent = new Set<Id>();
  let clock = (run.resupplies ?? []).reduce((sum, delivery) => Math.round((sum + delivery.minutes) * 10) / 10, 0);
  for (const decision of run.history) {
    clock = Math.round((clock + decision.timeCost) * 10) / 10;
    const action = scenario.stages[decision.stage].actions.find(candidate => candidate.id === decision.actionId);
    if (!action || !decision.committed) return false;
    const force = decision.committed.forceOutcome;
    if (!!action.forceProfile !== !!force || personCasualtyActionIssue({ personCasualties: expected }, scenario, action)) return false;
    if (new Set(decision.unitsUsed).size !== decision.unitsUsed.length) return false;
    const uses: Use[] = [];
    for (const unitId of decision.unitsUsed) {
      const itemId = run.practice && unitId.startsWith('practice_') ? unitId.slice('practice_'.length) : state.units[unitId]?.itemId;
      const item = itemId ? ITEMS[itemId] : undefined;
      const reservation = state.reservations.find(reservation => reservation.runId === run.id && reservation.unitId === unitId);
      if (!item || !run.practice && !reservation || item.kind === 'consumable' && spent.has(unitId)) return false;
      const squadId = reservation?.squadId ?? decision.actingSquadIds[0];
      if (!decision.actingSquadIds.includes(squadId) && !decision.supportSquadIds.includes(squadId) && !item.supportOnly) return false;
      uses.push({ unitId, itemId: item.id, qty: 1, consumable: item.kind === 'consumable', squadId });
      if (item.kind === 'consumable') spent.add(unitId);
    }
    const counts = new Map<Id, number>();
    for (const use of uses) counts.set(use.itemId, (counts.get(use.itemId) ?? 0) + 1);
    if (decision.itemsConsumed.length !== counts.size || decision.itemsConsumed.some(use => counts.get(use.itemId) !== use.qty || use.qty <= 0)) return false;
    const events: PersonCasualtyRecord[] = [];
    if (force) {
      if (!validForceOutcome(force)) return false;
      const risk = selectedForceRisk(scenario, action, uses);
      if (!risk || (Object.keys(risk) as (keyof typeof risk)[]).some(key => risk[key] !== force[key])) return false;
      const item = ITEMS[force.itemId];
      const user = uses.find(use => use.unitId === force.unitId)!;
      if (!decision.actingSquadIds.includes(user.squadId) || !decision.officerIds.some(id => state.squads.find(squad => squad.id === user.squadId)?.officerIds.includes(id)
        && (item.requiresCerts ?? []).every(cert => state.officers[id]?.certs.includes(cert)))) return false;
      if ((item.supplies ?? []).some(supply => supply.itemId !== 'battery_pack' && uses.filter(use => use.itemId === supply.itemId && use.consumable).length < supply.qty)) return false;
      if (force.severity !== 'none') events.push({ personId: force.personId, personRole: force.personRole, label: force.personLabel, severity: force.severity, at: clock,
        care: force.severity === 'fatal' ? 'deceased' : 'needed', causeRevision: decision.revision });
    }
    const care = action.personCare;
    const person = care ? expected[care.personId] : undefined;
    if (care && person && person.severity !== 'fatal') {
      if (care.kind === 'stabilize' && decision.band !== 'adverse') {
        if (!uses.some(use => use.itemId === 'trauma_kit' && use.consumable)) return false;
        events.push({ ...person, care: 'stabilized' });
      } else if (care.kind === 'accept' && decision.committed.externalSupport?.some(event => event.kind === 'accepted' && event.serviceId === care.serviceId)) events.push({ ...person, care: 'accepted' });
    }
    const actual = decision.committed.personCasualties ?? [];
    if (events.length !== actual.length || events.some((event, index) => !validPersonCasualtyRecord(actual[index]) || (Object.keys(event) as (keyof PersonCasualtyRecord)[]).some(key => event[key] !== actual[index][key]))) return false;
    events.forEach(event => { expected[event.personId] = { ...event }; });
    const protection = decision.committed.protectionUsed;
    const expectedProtection = selectedProtection(scenario, action, uses);
    if (protection?.unitId !== expectedProtection?.unitId || protection?.itemId !== expectedProtection?.itemId) return false;
  }
  const actual = run.personCasualties ?? {};
  if (Object.keys(expected).length !== Object.keys(actual).length || Object.entries(expected).some(([id, event]) => !validPersonCasualtyRecord(actual[id]) || (Object.keys(event) as (keyof PersonCasualtyRecord)[]).some(key => event[key] !== actual[id][key]))) return false;
  const copy = { flags: [...run.flags], personCasualties: expected };
  syncPersonCasualtyFlags(copy, scenario);
  return new Set(copy.flags).size === new Set(run.flags).size && copy.flags.every(flag => run.flags.includes(flag));
}

/** Validate immutable saved injury snapshots, their transitions and the final public flags. */
export function validIncidentConsequences(run: OperationRun, scenario: ScenarioDefinition, officers: GameState['officers'], squads: GameState['squads'], now: number): boolean {
  if (scenario.version < 4) return run.officerCasualties === undefined;
  if (run.officerCasualties === undefined) return !run.history.some(decision => decision.committed?.officerCasualties?.length);
  if (!run.officerCasualties || typeof run.officerCasualties !== 'object' || Array.isArray(run.officerCasualties)) return false;
  const expected: Record<Id, OfficerCasualtyRecord> = {};
  const deployed = new Set(run.squadIds.flatMap(id => squads.find(squad => squad.id === id)?.officerIds ?? []));
  let clock = (run.resupplies ?? []).reduce((sum, delivery) => Math.round((sum + delivery.minutes) * 10) / 10, 0);
  for (const decision of run.history) {
    clock = Math.round((clock + decision.timeCost) * 10) / 10;
    const action = scenario.stages[decision.stage].actions.find(candidate => candidate.id === decision.actionId);
    if (!action) return false;
    const possible = protectedOfficerEffects(action.outcomes[decision.band], scenario.version >= 7 ? decision.committed?.protectionUsed : undefined);
    for (const event of decision.committed?.officerCasualties ?? []) {
      if (!validCasualtyRecord(event) || !deployed.has(event.officerId) || event.at > clock) return false;
      const before = expected[event.officerId];
      if (!before) {
        const harm = possible.find(effect => effect.officerHarm?.severity === event.severity && effect.officerHarm.label === event.label)?.officerHarm;
        if (!harm || event.at !== clock || event.care !== 'needed' || !decision.officerIds.includes(event.officerId)) return false;
      } else {
        if (event.at !== before.at || event.severity !== before.severity || event.label !== before.label) return false;
        if (event.care === 'stabilized') {
          if (before.care !== 'needed' || !possible.some(effect => effect.officerCare === 'stabilize') || !decision.itemsConsumed.some(use => use.itemId === 'trauma_kit' && use.qty >= 1) && !run.practice) return false;
          if (event.recoveryUntil > before.recoveryUntil) return false;
        } else if (event.care === 'evacuated') {
          if (before.care === 'evacuated' || !possible.some(effect => effect.officerCare === 'evacuate') || event.recoveryUntil !== before.recoveryUntil) return false;
          if (!decision.committed?.externalSupport?.some(event => event.kind === 'accepted' && scenario.externalServices?.some(service => service.id === event.serviceId && service.kind === 'medical'))) return false;
        } else return false;
      }
      expected[event.officerId] = { ...event };
    }
  }
  if (Object.keys(expected).length !== Object.keys(run.officerCasualties).length) return false;
  for (const [id, person] of Object.entries(expected)) {
    const actual = run.officerCasualties[id];
    if (!actual || (Object.keys(person) as (keyof OfficerCasualtyRecord)[]).some(key => actual[key] !== person[key])) return false;
    if (!run.practice && person.recoveryUntil > now && (!officers[id]?.injury || officers[id].injury!.label !== person.label || officers[id].injury!.until !== person.recoveryUntil)) return false;
  }
  const flags = casualtyFlags(expected);
  return CASUALTY_FLAGS.every(flag => run.flags.includes(flag) === flags.includes(flag));
}
