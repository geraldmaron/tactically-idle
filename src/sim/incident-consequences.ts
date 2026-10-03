import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { CivilianOutcomeView, GameState, Id, OfficerCasualtyRecord, OperationRun } from './types';

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

export function civilianOutcomeViews(scenario: ScenarioDefinition, run: Pick<OperationRun, 'flags' | 'knowledge'>): CivilianOutcomeView[] {
  return (scenario.civilianOutcomes ?? []).map(person => {
    const knowledge = run.knowledge[person.factId] ?? 'unknown';
    const status: CivilianOutcomeView['status'] = run.flags.includes(person.careFlag) ? 'care_accepted'
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
    const possible = action.outcomes[decision.band];
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
