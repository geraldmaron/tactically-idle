import type { CivilianOutcomeView, GameState, OfficerCasualtyRecord, OperationRun, PersonCasualtyRecord } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { civilianOutcomeViews } from '../../sim/incident-consequences';
import type { ReactNode } from 'react';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { Portrait } from '../portraits/Portrait';
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

type PersonTone = 'pending' | 'warn' | 'ok' | 'danger';
type PersonStatus = CivilianOutcome['status'];

/** Unlocated people use the same dashed amber as reported people on the map. */
const PERSON_TONE: Record<PersonStatus, PersonTone> = {
  unaccounted: 'pending',
  needs_help: 'warn',
  injured_needs_care: 'warn',
  safe: 'ok',
  care_accepted: 'ok',
  accounted_elsewhere: 'ok',
  deceased: 'danger',
};

const PERSON_ICON: Record<PersonStatus, IconName> = {
  unaccounted: 'question',
  needs_help: 'warning',
  injured_needs_care: 'bandage',
  safe: 'check',
  care_accepted: 'medic',
  accounted_elsewhere: 'check',
  deceased: 'x',
};

/** Two initials from a name, or the first two letters of a single-word label such as "Resident". */
export function personInitials(label: string): string {
  const words = label.replace(/[^\p{L}\s'-]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function PersonTile({ label, status, tone, icon, avatar, data, children }: { label: string; status: string; tone: PersonTone; icon: IconName; avatar?: ReactNode; data: Record<string, string>; children?: ReactNode }) {
  return <li className="person-tile" data-tone={tone} {...data}>
    <span className="person-avatar" aria-hidden="true">{avatar ?? personInitials(label)}</span>
    <div className="person-text">
      <strong>{label}</strong>
      <span className="person-status"><Icon name={icon} size={13} />{status}</span>
      {children}
    </div>
  </li>;
}

export function CivilianOutcomeList({ outcomes }: { outcomes: CivilianOutcome[] }) {
  return <ul className="incident-people-list" aria-label="Civilian outcomes">{outcomes.map((person) =>
    <PersonTile key={person.id} label={person.label} status={CIVILIAN_OUTCOME_LABEL[person.status]} tone={PERSON_TONE[person.status]} icon={PERSON_ICON[person.status]} data={{ 'data-person-status': person.status }} />)}</ul>;
}

/** A saved fatality remains deceased even if an older care field says otherwise. */
export function PersonCasualtyList({ casualties }: { casualties: PersonCasualtyRecord[] }) {
  if (!casualties.length) return null;
  return <ul className="incident-people-list incident-person-casualties" aria-label="Recorded injuries and deaths">{casualties.map((person) => {
    const fatal = person.severity === 'fatal' || person.care === 'deceased';
    const status: PersonStatus = fatal ? 'deceased' : person.care === 'accepted' ? 'care_accepted' : 'injured_needs_care';
    const line = fatal ? 'Deceased' : `${person.severity === 'serious' ? 'Serious injury' : 'Wounded'} · ${person.care === 'stabilized' ? 'Stabilized' : person.care === 'accepted' ? 'Care accepted' : 'Needs care'}`;
    return <PersonTile key={person.personId} label={person.label} status={line} tone={fatal ? 'danger' : 'warn'} icon={fatal ? 'x' : 'bandage'} data={{ 'data-person-casualty': person.personId, 'data-person-status': status }} />;
  })}</ul>;
}

/** Only tracked public outcomes are shown; a global safety score is never a head count. */
export function IncidentPeopleStatus({ scenario, run, state }: { scenario: ScenarioDefinition; run: OperationRun; state: GameState }) {
  const civilians = civilianOutcomeViews(scenario, run);
  const officers = Object.values(run.officerCasualties ?? {});
  const additionalCasualties = Object.values(run.personCasualties ?? {}).filter((person) => !civilians.some((civilian) => civilian.id === person.personId));
  if (!civilians.length && !officers.length && !additionalCasualties.length) return null;
  const located = civilians.filter((person) => person.status !== 'unaccounted').length;
  const needCare = civilians.filter((person) => PERSON_TONE[person.status] === 'warn').length;
  return <section className="incident-people-status" aria-label="People at this call">
    <div className="incident-people-head">
      <h2><Icon name="people" size={16} />People at this call</h2>
      {civilians.length > 0 && <span className="incident-people-tally"><strong>{located}</strong> of {civilians.length} located{needCare > 0 && <span className="incident-people-care"> · {needCare} need{needCare === 1 ? 's' : ''} help</span>}</span>}
    </div>
    {civilians.length > 0 && <div className="incident-people-meter" role="img" aria-label={`${located} of ${civilians.length} people located`}>
      {civilians.map((person) => <i key={person.id} data-tone={PERSON_TONE[person.status]} />)}
    </div>}
    {civilians.length > 0 && <CivilianOutcomeList outcomes={civilians} />}
    <PersonCasualtyList casualties={additionalCasualties} />
    {officers.length > 0 && <ul className="incident-people-list incident-wounded-list" aria-label="Officers out of action">{officers.map((casualty) => {
      const officer = state.officers[casualty.officerId];
      return <PersonTile key={casualty.officerId} label={`${officer ? `${officer.firstName} ${officer.surname}` : 'Officer'} · out of action`} status={`${casualty.severity === 'serious' ? 'Serious injury · ' : ''}${casualty.label} · ${CASUALTY_CARE_LABEL[casualty.care]}`} tone="warn" icon="bandage"
        avatar={officer ? <Portrait officer={officer} size={36} /> : undefined} data={{ 'data-officer-casualty': casualty.officerId }} />;
    })}</ul>}
  </section>;
}

/** Archived results use the saved injury and recovery date, never current roster condition. */
export function OfficerInjuryResult({ casualty }: { casualty: OfficerCasualty }) {
  const recovery = new Date(casualty.recoveryUntil).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return <div className="result-officer-injury" aria-label="Injury and recovery">
    <strong><Icon name="bandage" size={15} /><span>{casualty.severity === 'serious' ? 'Serious injury · ' : ''}{casualty.label}</span></strong>
    <span>{CASUALTY_CARE_LABEL[casualty.care]} · out of action from {opMinutes(casualty.at)}</span>
    <p>Recovery scheduled until <time dateTime={new Date(casualty.recoveryUntil).toISOString()}>{recovery}</time>.</p>
  </div>;
}
