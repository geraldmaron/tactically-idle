import type { CivilianOutcomeView, GameState, OfficerCasualtyRecord, OperationRun, PersonCasualtyRecord } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { civilianOutcomeViews } from '../../sim/incident-consequences';
import { Icon } from '../icons';
import { opMinutes } from '../format';
import './incident-people.css';

type CivilianOutcome = CivilianOutcomeView;
type OfficerCasualty = OfficerCasualtyRecord;

export const CIVILIAN_OUTCOME_LABEL: Record<CivilianOutcome['status'], string> = {
  unaccounted: 'Not yet located',
  needs_help: 'Needs help',
  safe: 'Safe',
  injured_needs_care: 'Injured · needs care',
  care_accepted: 'Care accepted',
  accounted_elsewhere: 'Accounted for elsewhere',
  deceased: 'Deceased',
};
export const CASUALTY_CARE_LABEL: Record<OfficerCasualty['care'], string> = {
  needed: 'Needs care',
  stabilized: 'Stabilized',
  evacuated: 'Evacuated',
};

export function CivilianOutcomeList({ outcomes }: { outcomes: CivilianOutcome[] }) {
  return <ul className="incident-people-list" aria-label="Civilian outcomes">{outcomes.map((person) => <li key={person.id} data-person-status={person.status}>
    <Icon name={person.status === 'deceased' ? 'x' : person.status === 'injured_needs_care' ? 'bandage' : person.status === 'care_accepted' ? 'medic' : person.status === 'safe' || person.status === 'accounted_elsewhere' ? 'check' : 'user'} size={16} />
    <div><strong>{person.label}</strong><span>{CIVILIAN_OUTCOME_LABEL[person.status]}</span></div>
  </li>)}</ul>;
}

/** A saved fatality remains deceased even if an older care field says otherwise. */
export function PersonCasualtyList({ casualties }: { casualties: PersonCasualtyRecord[] }) {
  if (!casualties.length) return null;
  return <ul className="incident-people-list incident-person-casualties" aria-label="Recorded injuries and deaths">{casualties.map((person) => {
    const fatal = person.severity === 'fatal' || person.care === 'deceased';
    return <li key={person.personId} data-person-casualty={person.personId} data-person-status={fatal ? 'deceased' : person.care === 'accepted' ? 'care_accepted' : 'injured_needs_care'}>
      <Icon name={fatal ? 'x' : 'bandage'} size={16} />
      <div><strong>{person.label}</strong><span>{fatal ? 'Deceased' : `${person.severity === 'serious' ? 'Serious injury' : 'Wounded'} · ${person.care === 'stabilized' ? 'Stabilized' : person.care === 'accepted' ? 'Care accepted' : 'Needs care'}`}</span></div>
    </li>;
  })}</ul>;
}

/** Only tracked public outcomes are shown; a global safety score is never a head count. */
export function IncidentPeopleStatus({ scenario, run, state }: { scenario: ScenarioDefinition; run: OperationRun; state: GameState }) {
  const civilians = civilianOutcomeViews(scenario, run);
  const officers = Object.values(run.officerCasualties ?? {});
  const additionalCasualties = Object.values(run.personCasualties ?? {}).filter((person) => !civilians.some((civilian) => civilian.id === person.personId));
  if (!civilians.length && !officers.length && !additionalCasualties.length) return null;
  return <section className="incident-people-status" aria-label="People at this call">
    <h2><Icon name="people" size={16} />People at this call</h2>
    {civilians.length > 0 && <CivilianOutcomeList outcomes={civilians} />}
    <PersonCasualtyList casualties={additionalCasualties} />
    {officers.length > 0 && <ul className="incident-people-list incident-wounded-list" aria-label="Officers out of action">{officers.map((casualty) => {
      const officer = state.officers[casualty.officerId];
      return <li key={casualty.officerId} data-officer-casualty={casualty.officerId}>
        <Icon name="bandage" size={16} />
        <div><strong>{officer ? `${officer.firstName} ${officer.surname}` : 'Officer'} · out of action</strong><span>{casualty.severity === 'serious' ? 'Serious injury · ' : ''}{casualty.label} · {CASUALTY_CARE_LABEL[casualty.care]}</span></div>
      </li>;
    })}</ul>}
    {run.practice && officers.length > 0 && <p className="incident-practice-injury">Practice injuries last for this run only</p>}
  </section>;
}

/** Archived results use the saved injury and recovery date, never current roster condition. */
export function OfficerInjuryResult({ casualty, practice }: { casualty: OfficerCasualty; practice: boolean }) {
  const recovery = new Date(casualty.recoveryUntil).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return <div className="result-officer-injury" aria-label={practice ? 'Practice injury' : 'Injury and recovery'}>
    <strong><Icon name="bandage" size={15} /><span>{casualty.severity === 'serious' ? 'Serious injury · ' : ''}{casualty.label}</span></strong>
    <span>{CASUALTY_CARE_LABEL[casualty.care]} · out of action from {opMinutes(casualty.at)}</span>
    <p>{practice ? 'Practice only. No lasting injury or recovery timer.' : <>Recovery scheduled until <time dateTime={new Date(casualty.recoveryUntil).toISOString()}>{recovery}</time>.</>}</p>
  </div>;
}
