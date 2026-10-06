import type { ActionDefinition, ScenarioDefinition } from './scenario-types';
import type { GameState, OperationRun, ResponseFailureRecord, SquadId } from './types';
import { getScenario } from './scenario-registry';
import { builtFor, conditionHolds, evaluateAction } from './resolution';
import { availableStageContinuations } from './compatibility/legacy-choices';
import { civilianOutcomeViews, incidentOfficerUnavailable } from './incident-consequences';
import { planActionResupply } from './equipment-resupply';
import { externalSupportStatus } from './external-support';

// These old menu exits claim a handover or award progress merely for stopping.
// Definitions and committed history stay frozen; new orders use a guarded failure report.
const LEGACY_EXIT_IDS = new Set([
  'ms_handover', 'mu_handover', 'gen_handover',
  'v3_welfare_handover', 'v3_welfare_withdraw', 'assist_informed_handover', 'assist_withdraw',
  'v3_protect_handover', 'v3_protect_withdraw', 'v4_record_unresolved', 'v4_record_care_pending',
]);
export function isGenericResponseExit(scenario: ScenarioDefinition, action: ActionDefinition): boolean {
  if (scenario.version <= 7 && LEGACY_EXIT_IDS.has(action.id)) return true;
  if (action.title === 'End with the progress made' || action.title === 'Withdraw and record unfinished duties') return true;
  return scenario.version >= 4 && action.commandOnly === true
    && Object.values(action.outcomes).every(effects => effects.some(effect => effect.ending
      && ['relief_partial', 'unresolved'].includes(scenario.endings[effect.ending]?.disposition ?? '')))
    && !Object.values(action.outcomes).flat().some(effect => effect.acceptSupport?.length || effect.officerCare);
}

export interface ResponseFailurePlan extends ResponseFailureRecord { runId: string; consequence: string }

function subsets(ids: SquadId[], max: number): SquadId[][] {
  const result: SquadId[][] = [[]];
  for (const id of ids) for (const group of [...result]) if (group.length < max) result.push([...group, id]);
  return result;
}

/** Public-state capability check across every legal squad combination. No truth or RNG. */
export function responseFailurePlan(state: GameState): ResponseFailurePlan | null {
  const run = state.activeRun;
  if (!run || run.status !== 'active' || run.stage === 'debrief') return null;
  const scenario = getScenario(run.scenarioId);
  if (!scenario || availableStageContinuations(scenario, run).length) return null;
  const allUnavailable = run.squadIds.every(id => (state.squads.find(squad => squad.id === id)?.officerIds ?? [])
    .every(officerId => incidentOfficerUnavailable(state, run, officerId)));
  const reasons: string[] = [];
  {
    const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
    for (const action of scenario.stages[run.stage].actions) {
      if (isGenericResponseExit(scenario, action) || !conditionHolds(action.visibleWhen, run)
        || run.history.some(decision => decision.stage === run.stage && decision.actionId === action.id)) continue;
      for (const acting of subsets(run.squadIds, action.maxActing ?? 1).filter(group => group.length)) {
        const supports = action.support ? subsets(run.squadIds.filter(id => !acting.includes(id)), action.support.maxSquads) : [[]];
        for (const support of supports) {
          const evaluation = evaluateAction({ state, run, scenario, action, built, acting, support });
          if (evaluation.eligible) return null;
          if (planActionResupply(state, state.department.clockHighWater, action.id, acting, support).ok) return null;
          if (evaluation.reason && !/already (tried|attempted)/i.test(evaluation.reason)) reasons.push(evaluation.reason);
        }
      }
    }
  }
  const people = civilianOutcomeViews(scenario, run);
  const statusText: Record<string, string> = {
    unaccounted: 'has not been located', needs_help: 'still needs help', safe: 'has reached safety',
    injured_needs_care: 'is injured and still needs care', care_accepted: 'has an accepting care team',
    accounted_elsewhere: 'has been accounted for elsewhere', deceased: 'has died; the death and scene duties remain recorded',
  };
  const progressRetained: string[] = [];
  const remainingTasks: string[] = [];
  for (const person of people) (['safe', 'care_accepted', 'accounted_elsewhere'].includes(person.status) ? progressRetained : remainingTasks)
    .push(`${person.label}: ${statusText[person.status] ?? person.status.replaceAll('_', ' ')}.`);
  const careRole = ({ welfare_check: 'ada', medical_complication: 'rosa', barricaded: 'mina', active_armed_incident: 'eli', hostage_crisis: 'mara', protected_rescue: 'jun' } as Record<string, string>)[scenario.incident?.type ?? ''];
  const carePerson = scenario.civilianOutcomes?.find(person => person.id === careRole);
  const careFact = scenario.facts.find(fact => fact.id === 'f_care_needed' || /_(care_needed|assessment_needed)$/.test(fact.id));
  const reportedCarePending = !!carePerson && !run.flags.includes(carePerson.careFlag)
    && (!!careFact && run.knowledge[careFact.id] === 'confirmed' || run.flags.includes('hr_care_required'));
  if (reportedCarePending) remainingTasks.push(`${carePerson!.label} requested medical assessment; no receiving crew has accepted that care.`);
  for (const person of Object.values(run.personCasualties ?? {})) (person.care === 'accepted' ? progressRetained : remainingTasks).push(`${person.label}: ${person.severity === 'fatal' ? 'death remains recorded; scene follow-up is required' : `${person.severity === 'serious' ? 'serious injury' : 'wound'}; ${person.care === 'accepted' ? 'care accepted' : 'medical responsibility remains'}`}.`);
  for (const person of Object.values(run.officerCasualties ?? {})) {
    const officer = state.officers[person.officerId];
    (person.care === 'evacuated' ? progressRetained : remainingTasks).push(`${officer ? `${officer.firstName} ${officer.surname}` : 'An officer'}: ${person.care === 'evacuated' ? 'medical transport accepted' : 'injured and still needs medical transport'}.`);
  }
  if (!remainingTasks.length) remainingTasks.push(people.length ? 'The remaining agreed next step has not been completed.' : 'The incident objectives have not been completed.');
  const careReceiverIds = new Set(carePerson ? Object.values(scenario.stages).flatMap(stage => stage.actions).flatMap(action => Object.values(action.outcomes)
    .filter(effects => effects.some(effect => effect.setFlags?.includes(carePerson.careFlag)))
    .flatMap(effects => effects.flatMap(effect => effect.acceptSupport ?? []))) : []);
  const unavailableReceiver = (scenario.externalServices ?? []).find(service => careReceiverIds.has(service.id) && service.kind === 'medical' && !!run.externalSupport?.[service.id] && externalSupportStatus(run, service) === 'unavailable');
  const reason = allUnavailable ? 'No deployed officer can continue the scene work. Reporting this does not move injured officers or summon an accepting medical crew.'
    : unavailableReceiver && reportedCarePending ? `${unavailableReceiver.label} cannot attend in this response window. ${carePerson!.label} still needs an accepting medical receiver.`
      : [...new Set(reasons)].filter(reason => !/already|waiting|must have been requested/i.test(reason)).slice(0, 2).join(' ') || 'The available approaches have been tried without completing the call. No usable next step or equipment delivery remains.';
  const first = people.find(person => !['safe', 'care_accepted', 'accounted_elsewhere'].includes(person.status)
    && !run.flags.includes(scenario.civilianOutcomes?.find(entry => entry.id === person.id)?.safeFlag ?? ''));
  const title = allUnavailable ? 'Report the team unable to continue'
    : scenario.incident?.type === 'protected_rescue' && first ? `Report the blocked rescue of ${first.label}`
      : Object.values(run.personCasualties ?? {}).some(person => person.care !== 'accepted') ? 'Report the unresolved care and safety barrier'
        : 'Report that this response cannot be completed';
  return {
    version: 1, runId: run.id, revision: run.revision, atClock: run.clock,
    reasonKind: allUnavailable ? 'team_unavailable' : 'no_viable_approach', title, reason, remainingTasks, progressRetained,
    consequence: run.practice ? 'Ends this practice as an unsuccessful response. No lasting department changes.'
      : 'Ends this response without an incident funding bonus, development points or completion experience. Public trust falls by 2. Used supplies, wear, injuries and unfinished duties remain recorded.',
  };
}

export function validResponseFailure(run: OperationRun, scenario: ScenarioDefinition): boolean {
  const pending = run.flags.filter(flag => flag.startsWith('completion_pending:'));
  if (pending.length) {
    const id = pending[0].slice('completion_pending:'.length);
    if (scenario.version < 8 || pending.length !== 1 || run.status !== 'active' || run.stage !== 'resolve'
      || !['resolved', 'care_accepted', 'followup_agreed'].includes(scenario.endings[id]?.disposition ?? '')
      || !run.history.some(decision => scenario.stages[decision.stage].actions.find(action => action.id === decision.actionId)?.outcomes[decision.band].some(effect => effect.ending === id))) return false;
  }
  const record = run.responseFailure;
  if (record === undefined) return true;
  return !!record && record.version === 1 && record.revision === run.revision && record.atClock === run.clock
    && ['team_unavailable', 'no_viable_approach'].includes(record.reasonKind)
    && [record.title, record.reason].every(text => typeof text === 'string' && text.trim().length > 0 && text.length <= 3000)
    && Array.isArray(record.remainingTasks) && record.remainingTasks.length > 0 && record.remainingTasks.length <= 32
    && record.remainingTasks.every(text => typeof text === 'string' && text.length > 0 && text.length <= 1000)
    && (record.progressRetained === undefined || Array.isArray(record.progressRetained) && record.progressRetained.length <= 32 && record.progressRetained.every(text => typeof text === 'string' && text.length <= 1000))
    && run.stage === 'debrief' && run.status !== 'active' && run.endingId === 'handed_over';
}
