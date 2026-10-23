// The prepare screen's briefing, rebuilt (owner 2026-10-20) around what a player needs before
// choosing a team, in the order they need it: who is inside, what the threat is, what the team must
// do, and what is still unknown. Rendered from props alone so the Scenario Lab shows the player's
// real briefing. Only what the player is told at dispatch: intel.ts never reads truth. Store-free.
import type { JSX, ReactNode } from 'react';
import { FactStatusChip } from '../components/FactStatusChip';
import type { Briefing } from '../../sim/operation-selectors';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, KnowledgeStatus } from '../../sim/types';
import { DifficultyChip, EnvChips } from '../components/incident';
import { Face, type FaceKind } from '../components/Face';
import { PlateArt, sceneFor } from '../art/Plates';
import { familyBlurb } from '../components/incident';
import { Icon } from '../icons';
import { money } from '../format';
import { PeopleGlyph, PeopleText, usePeopleEntry } from '../people/PeopleText';
import { peopleLabel } from '../people/lexicon';
import { IncidentBriefContext } from './SupportContext';
import type { Intel, IntelLine } from './intel';
import { Disclosure } from '../components/Disclosure';
import { ColdOpen } from '../components/DepthBrief';
import './prep-briefing.css';

/** `built` is the call's building as the player sees it; the briefing reads it through `intel`. */
export function PrepBriefing({ scenario, brief, intel, aside }: { scenario: ScenarioDefinition | null | undefined; built: BuiltLocation; brief: Briefing; intel: Intel;
  /** Beside the orders' heading: the step ("Step 1 of 2"). */
  aside?: ReactNode }): JSX.Element {
  const knownRest = brief.known.filter((k) => !intel.covered.has(k));
  // A person report is the person's location fact; the story binding says whose.
  const personOf = new Map(Object.values(scenario?.story?.bindings.people ?? {}).map((person) => [person.locationFactId, person.id]));
  const whoText = new Map((scenario?.briefing.people ?? []).map((person) => [person.personId, person]));
  // People the dispatch names but no location report covers still belong on the card list.
  const reported = new Set(intel.people.map((line) => personOf.get(line.id) ?? line.id));
  const unplaced = (scenario?.briefing.people ?? []).filter((person) => !reported.has(person.personId));
  return (
    <div className="pb">
      {/* The scene plate: the call's painted place at the shared plate height, then the orders. */}
      <div className="plate pb-scene">
        <PlateArt src={sceneFor(scenario?.incident?.type)} />
        {familyBlurb(scenario?.locationFamilyId ?? null) && <span className="pb-scene-place"><Icon name="pin" size={16} />{familyBlurb(scenario?.locationFamilyId ?? null)}</span>}
        {scenario?.rewards && <span className="pb-scene-pay" aria-label={`Pays up to ${money(scenario.rewards.funding)} and ${scenario.rewards.xp} experience`}><b>{money(scenario.rewards.funding)}</b>{scenario.rewards.xp} XP</span>}
      </div>
      {/* Orders and the threat first (docs/ops-experience.md, Brief), then the cold open whole, then
          who is inside, what is unknown and the conditions. */}
      <section className="pb-block pb-orders-panel" aria-labelledby="pb-orders-h">
        <div className="pb-h-row">
          <h3 id="pb-orders-h" className="pb-h"><Icon name="flag" size={16} />Your orders</h3>
          {aside && <span className="pb-h-aside">{aside}</span>}
        </div>
        {brief.objectives.length ? <ol className="pb-orders">{brief.objectives.map((text, index) => <li key={index}><span className="pb-order-n" aria-hidden="true">{index + 1}</span><span><PeopleText text={text} /></span></li>)}</ol> : <p className="dim">No orders listed.</p>}
        {intel.threats.length > 0 && <ul className="pb-threats" aria-label="The threat">{intel.threats.map((line) => <ThreatRow key={line.id} line={line} />)}</ul>}
      </section>

      <ColdOpen text={scenario?.coldOpen} className="pb-cold-open" />

      {(intel.people.length > 0 || unplaced.length > 0) && <section className="pb-block" aria-labelledby="pb-people-h">
        <h3 id="pb-people-h" className="pb-h"><Icon name="people" size={16} />Who’s inside</h3>
        <ul className="pb-people">
          {intel.people.map((line) => { const id = personOf.get(line.id) ?? line.id; return <PersonCard key={line.id} personId={id} name={line.label} role={whoText.get(id)?.role} who={whoText.get(id)?.text} status={line.status} where={line.where} />; })}
          {unplaced.map((person) => <PersonCard key={person.personId} personId={person.personId} name={person.name} role={person.role} who={person.text} />)}
        </ul>
      </section>}

      {brief.unknown.length > 0 && <section className="pb-block pb-unknown" aria-labelledby="pb-unknown-h">
        <h3 id="pb-unknown-h" className="pb-h"><Icon name="search" size={16} />Still unknown</h3>
        <ul>{brief.unknown.map((text, index) => <li key={index}><PeopleText text={text} /></li>)}</ul>
      </section>}

      {(intel.difficulty || intel.environment) && <section className="pb-block pb-conditions" aria-label="Conditions">
        <div className="chips">
          {intel.difficulty && <DifficultyChip band={intel.difficulty.band} />}
          {intel.environment && <EnvChips env={intel.environment} />}
        </div>
        {!!intel.difficulty?.drivers.length && <ul className="pb-drivers">{intel.difficulty.drivers.slice(0, 3).map((driver, index) => <li key={index}><Icon name="gauge" size={16} />{driver}</li>)}</ul>}
      </section>}

      <Disclosure name="prep-briefing" className="pb-more" icon="intel" summary="Full dispatch" count={knownRest.length || undefined}>
        {scenario && <IncidentBriefContext scenario={scenario} />}
        {knownRest.length > 0 && <div className="pb-block">
          <h4 className="pb-h pb-h-sub"><Icon name="check" size={16} />Reported so far</h4>
          <ul>{knownRest.map((text, index) => <li key={index}><PeopleText text={text} /></li>)}</ul>
        </div>}
        {intel.threats.length === 0 && <p className="dim">{scenario ? 'No separate weapon details are listed. Check the dispatch account.' : 'No weapon reported. That does not mean none is present.'}</p>}
      </Disclosure>
    </div>
  );
}

/** One person on scene as a card: who they are, their role, and where the team thinks they are. */
function PersonCard({ personId, name, role, who, status, where }: { personId: string; name: string; role?: string; who?: string; status?: KnowledgeStatus; where?: string | null }) {
  const entry = usePeopleEntry(personId);
  return <li className="pb-person" data-kind={entry?.kind}>
    <Face size="md" kind={faceKind(entry?.kind)} name={entry ? `${name}, ${peopleLabel(entry.kind, entry.squadName)}` : undefined} />
    <div className="pb-person-text">
      <strong>{entry && <PeopleGlyph kind={entry.kind} tone />}{name}</strong>
      {role && <span className="pb-role">{role}</span>}
      {who && <p><PeopleText text={who} /></p>}
      {status && <span className="pb-where"><FactStatusChip status={status} />{where && <span className="pb-where-place"><Icon name="pin" size={16} />{where}</span>}</span>}
    </div>
  </li>;
}

/** The silhouette a person on scene gets: their public kind, or a plain person when it is withheld. */
function faceKind(kind: string | undefined): FaceKind {
  return kind === 'subject' || kind === 'civilian' || kind === 'officer' ? kind : 'person';
}

/** One weapon report in one line: what the report says and where, then who said it and how sure. */
function ThreatRow({ line }: { line: IntelLine }) {
  return <li className="pb-threat-row">
    <Icon name="warning" size={20} className="pb-threat-icon" />
    <div>
      <p className="pb-threat-claim"><PeopleText text={line.claim.replace(/\.$/, '')} />{line.where ? <span className="pb-threat-where"> · {line.where}</span> : null}</p>
      <p className="pb-threat-source">{line.source ? `Reported by ${line.source}. ` : ''}<FactStatusChip status={line.status} /></p>
    </div>
  </li>;
}
