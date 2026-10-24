import type { CivilianOutcomeView, GameState, OfficerCasualtyRecord, OperationRun, PersonCasualtyRecord } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { civilianOutcomeViews } from '../../sim/incident-consequences';
import { clockViews } from '../../sim/clocks';
import { stanceOf } from '../../sim/meters';
import type { Stance } from '../../sim/meters';
import type { ReactNode } from 'react';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { Portrait } from '../portraits/Portrait';
import { Face, type FaceKind } from './Face';
import { opMinutes, signed } from '../format';
import { PeopleGlyph, usePeopleEntry } from '../people/PeopleText';
import { peopleLabel } from '../people/lexicon';
import './incident-people.css';

type CivilianOutcome = CivilianOutcomeView;
type OfficerCasualty = OfficerCasualtyRecord;

export const CIVILIAN_OUTCOME_LABEL: Record<CivilianOutcome['status'], string> = {
  unaccounted: 'Not yet located',
  reported: 'Reported, not yet confirmed',
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
  reported: 'pending',
  needs_help: 'warn',
  injured_needs_care: 'warn',
  safe: 'ok',
  care_accepted: 'ok',
  accounted_elsewhere: 'ok',
  deceased: 'danger',
};

const PERSON_ICON: Record<PersonStatus, IconName> = {
  unaccounted: 'question',
  reported: 'pin',
  needs_help: 'warning',
  injured_needs_care: 'bandage',
  safe: 'check',
  care_accepted: 'medic',
  accounted_elsewhere: 'check',
  deceased: 'x',
};

/** How a subject sounds to the team, once the team has heard from them (sim/meters.ts). */
export const STANCE_LABEL: Record<Exclude<Stance, 'unheard'>, string> = {
  calm: 'Calm',
  tense: 'Tense',
  volatile: 'Agitated',
  breaking: 'Near breaking point',
  yielding: 'Open to talking',
};
const STANCE_TONE: Record<Exclude<Stance, 'unheard'>, PersonTone> = { calm: 'ok', yielding: 'ok', tense: 'pending', volatile: 'warn', breaking: 'danger' };

/** The silhouette a person tile draws: their public kind while it is known, otherwise a plain person. */
function tileFace(kind: string | undefined, tone: PersonTone): FaceKind {
  if (kind === 'subject' || kind === 'civilian' || kind === 'person') return kind;
  return tone === 'pending' ? 'person' : 'civilian';
}

/** `personId` finds the person's public kind while names are colored: a ring around the avatar in
 * the kind's color, and the kind's glyph before the name. */
function PersonTile({ label, status, tone, icon, avatar, data, personId, children }: { label: string; status: string; tone: PersonTone; icon: IconName; avatar?: ReactNode; data: Record<string, string>; personId?: string; children?: ReactNode }) {
  const who = usePeopleEntry(personId);
  return <li className="person-tile" data-tone={tone} {...data}>
    <span className="person-avatar" aria-hidden="true" data-kind={who?.kind} title={who ? peopleLabel(who.kind, who.squadName) : undefined}>{avatar ?? <Face size="sm" kind={tileFace(who?.kind, tone)} seed={personId ?? label} />}</span>
    <div className="person-text">
      <strong>{who && <PeopleGlyph kind={who.kind} tone />}{label}</strong>
      <span className="person-status"><Icon name={icon} size={13} />{status}</span>
      {children}
    </div>
  </li>;
}

/** `values` (the debrief) adds what each person's outcome paid or cost, so it is said on the tile once. */
export function CivilianOutcomeList({ outcomes, values }: { outcomes: CivilianOutcome[]; values?: ReadonlyMap<string, { trust: number; strain: number }> }) {
  return <ul className="incident-people-list" aria-label="Civilian outcomes">{outcomes.map((person) => {
    const paid = values?.get(person.id);
    return <PersonTile key={person.id} personId={person.id} label={person.label} status={CIVILIAN_OUTCOME_LABEL[person.status]} tone={PERSON_TONE[person.status]} icon={PERSON_ICON[person.status]} data={{ 'data-person-status': person.status }}>
      {paid && (paid.trust !== 0 || paid.strain !== 0) && <span className="person-note">{[paid.trust !== 0 ? `${signed(paid.trust, 1)} trust` : '', paid.strain !== 0 ? `${signed(paid.strain, 1)} strain` : ''].filter(Boolean).join(' · ')}</span>}
    </PersonTile>;
  })}</ul>;
}

/** A saved fatality remains deceased even if an older care field says otherwise. */
export function PersonCasualtyList({ casualties }: { casualties: PersonCasualtyRecord[] }) {
  if (!casualties.length) return null;
  return <ul className="incident-people-list incident-person-casualties" aria-label="Recorded injuries and deaths">{casualties.map((person) => {
    const fatal = person.severity === 'fatal' || person.care === 'deceased';
    const status: PersonStatus = fatal ? 'deceased' : person.care === 'accepted' ? 'care_accepted' : 'injured_needs_care';
    const line = fatal ? 'Deceased' : `${person.severity === 'serious' ? 'Serious injury' : 'Wounded'} · ${person.care === 'stabilized' ? 'Stabilized' : person.care === 'accepted' ? 'Care accepted' : 'Needs care'}`;
    return <PersonTile key={person.personId} personId={person.personId} label={person.label} status={line} tone={fatal ? 'danger' : 'warn'} icon={fatal ? 'x' : 'bandage'} data={{ 'data-person-casualty': person.personId, 'data-person-status': status }} />;
  })}</ul>;
}

/** The one word a person's chip says about them, from the same public outcome the status panel shows. */
const PERSON_SHORT: Record<PersonStatus, string> = {
  unaccounted: 'Not located',
  reported: 'Reported',
  needs_help: 'Needs help',
  safe: 'Safe',
  injured_needs_care: 'Injured',
  care_accepted: 'In care',
  accounted_elsewhere: 'Accounted for',
  deceased: 'Deceased',
};

function ScenePerson({ id, name, role, word, tone, fallback }: { id: string; name: string; role?: string; word: string; tone: PersonTone; fallback: FaceKind }) {
  const who = usePeopleEntry(id);
  const kind = who?.kind === 'subject' || who?.kind === 'civilian' || who?.kind === 'person' ? who.kind : fallback;
  return <li className="scene-person" data-tone={tone} data-kind={who?.kind}>
    <Face size="sm" kind={kind} seed={id} role={role} />
    <span className="scene-person-text"><b>{name.split(/\s+/)[0]}</b><span>{word}</span></span>
  </li>;
}

/** The people the call is about, as faces on the live screen: the civilians the team tracks and the
 * subjects it has heard from, each with one word of how they are. Only what the status panel already
 * shows, so it never says more than the team knows. */
export function IncidentPeopleStrip({ scenario, run }: { scenario: ScenarioDefinition; run: OperationRun }) {
  const civilians = civilianOutcomeViews(scenario, run);
  const roles = new Map((scenario.briefing.people ?? []).map((person) => [person.personId, person.role]));
  const subjects = Object.entries(run.meters ?? {}).flatMap(([id, meters]) => {
    const stance = stanceOf(meters);
    const person = scenario.incidentPeople?.find((entry) => entry.id === id);
    return stance === 'unheard' || !person || run.flags.includes(`out:${id}`) ? [] : [{ id, label: person.label, stance }];
  });
  if (!civilians.length && !subjects.length) return null;
  return <ul className="scene-people" aria-label="People at the scene">
    {subjects.map((subject) => <ScenePerson key={subject.id} id={subject.id} name={subject.label} role={roles.get(subject.id)} word={STANCE_LABEL[subject.stance]} tone={STANCE_TONE[subject.stance]} fallback="subject" />)}
    {civilians.map((person) => <ScenePerson key={person.id} id={person.id} name={person.label} role={roles.get(person.id)} word={PERSON_SHORT[person.status]} tone={PERSON_TONE[person.status]} fallback="civilian" />)}
  </ul>;
}

/** Only tracked public outcomes are shown; a global safety score is never a head count. */
export function IncidentPeopleStatus({ scenario, run, state }: { scenario: ScenarioDefinition; run: OperationRun; state: GameState }) {
  const civilians = civilianOutcomeViews(scenario, run);
  const officers = Object.values(run.officerCasualties ?? {});
  const additionalCasualties = Object.values(run.personCasualties ?? {}).filter((person) => !civilians.some((civilian) => civilian.id === person.personId));
  // Subjects the team has heard from, and clocks the team has heard a cue from: nothing earlier,
  // so the panel never shows what the team can't know yet.
  const subjects = Object.entries(run.meters ?? {}).flatMap(([id, meters]) => {
    const stance = stanceOf(meters);
    const person = scenario.incidentPeople?.find((entry) => entry.id === id);
    return stance === 'unheard' || !person || run.flags.includes(`out:${id}`) ? [] : [{ id, label: person.label, stance }];
  });
  const clocks = clockViews(scenario, run).filter((clock) => clock.latest && !clock.stopped);
  if (!civilians.length && !officers.length && !additionalCasualties.length && !subjects.length && !clocks.length) return null;
  const located = civilians.filter((person) => person.status !== 'unaccounted' && person.status !== 'reported').length;
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
    {subjects.length > 0 && <ul className="incident-people-list incident-subject-list" aria-label="Subjects">{subjects.map((subject) =>
      <PersonTile key={subject.id} personId={subject.id} label={subject.label} status={STANCE_LABEL[subject.stance]} tone={STANCE_TONE[subject.stance]} icon="ear" data={{ 'data-subject-stance': subject.stance }} />)}</ul>}
    {clocks.length > 0 && <ul className="incident-people-list incident-clock-list" aria-label="Running down">{clocks.map((clock) =>
      <PersonTile key={clock.id} label={clock.label} status={clock.out ? 'Out' : 'Running low'} tone={clock.out ? 'danger' : 'warn'} icon="hourglass" avatar={<Icon name="hourglass" size={18} />} data={{ 'data-clock': clock.id }}>
        <span className="person-note">{clock.latest}</span>
      </PersonTile>)}</ul>}
    {officers.length > 0 && <ul className="incident-people-list incident-wounded-list" aria-label="Officers out of action">{officers.map((casualty) => {
      const officer = state.officers[casualty.officerId];
      return <PersonTile key={casualty.officerId} personId={casualty.officerId} label={`${officer ? `${officer.firstName} ${officer.surname}` : 'Officer'} · out of action`} status={`${casualty.severity === 'serious' ? 'Serious injury · ' : ''}${casualty.label} · ${CASUALTY_CARE_LABEL[casualty.care]}`} tone="warn" icon="bandage"
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
