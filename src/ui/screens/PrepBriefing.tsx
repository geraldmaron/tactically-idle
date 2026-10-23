// The prepare screen's briefing (rebuilt 2026-10-23 from the owner's "it is weak"): what a player
// needs before choosing a team, in the order they need it. The place and the clock on the plate, what
// the call pays and asks, the orders with the faces of the people they name, what the team faces
// and does not know, then the cold open whole, who is inside and the conditions. Rendered from props
// alone so the Scenario Lab shows the player's real briefing. Only what the player is told at
// dispatch: intel.ts never reads truth. Store-free.
import { useMemo } from 'react';
import type { JSX, ReactNode } from 'react';
import { FactStatusChip } from '../components/FactStatusChip';
import { callTier, type Briefing } from '../../sim/operation-selectors';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, KnowledgeStatus } from '../../sim/types';
import { countdown, EnvChips, familyBlurb, TierChevrons, useNow } from '../components/incident';
import { Face, type FaceKind } from '../components/Face';
import { PlateArt, sceneFor } from '../art/Plates';
import { Icon } from '../icons';
import { money } from '../format';
import { Card, Chip, Row } from '../components/ui';
import { PeopleGlyph, PeopleText, usePeopleEntry } from '../people/PeopleText';
import { lexiconFor, peopleLabel, segmentPeople, type Lexicon, type LexiconEntry } from '../people/lexicon';
import { IncidentBriefContext } from './SupportContext';
import type { Intel, IntelLine } from './intel';
import { Disclosure } from '../components/Disclosure';
import { ColdOpen } from '../components/DepthBrief';
import './prep-briefing.css';

/** `built` is the call's building as the player sees it; the briefing reads it through `intel`.
 * `openUntil` is when the call leaves the board (epoch ms); the Lab has no board, so it passes none. */
export function PrepBriefing({ scenario, brief, intel, aside, openUntil }: { scenario: ScenarioDefinition | null | undefined; built: BuiltLocation; brief: Briefing; intel: Intel;
  /** Beside the orders' heading: the step ("Step 1 of 2"). */
  aside?: ReactNode;
  openUntil?: number }): JSX.Element {
  const knownRest = brief.known.filter((k) => !intel.covered.has(k));
  // A person report is the person's location fact; the story binding says whose.
  const personOf = new Map(Object.values(scenario?.story?.bindings.people ?? {}).map((person) => [person.locationFactId, person.id]));
  const whoText = new Map((scenario?.briefing.people ?? []).map((person) => [person.personId, person]));
  // People the dispatch names but no location report covers still belong on the card list.
  const reported = new Set(intel.people.map((line) => personOf.get(line.id) ?? line.id));
  const unplaced = (scenario?.briefing.people ?? []).filter((person) => !reported.has(person.personId));
  // The call's people as the team knows them at dispatch: the same lexicon that colors names in the
  // text. It does not depend on the color preference, which only decides whether prose is tinted.
  const lexicon = useMemo(() => scenario ? lexiconFor(scenario, null, []) : null, [scenario]);
  const range = scenario?.squadRange;
  // The call's tier, never called difficulty or risk: tiers do not compare across call types. Authored calls have none.
  const tier = scenario ? callTier(scenario.id) : null;
  return (
    <div className="pb">
      {/* The scene plate: the call's painted place at the shared plate height. The place is a
          caption on it and the board clock sits opposite; nothing else competes for the art. */}
      <div className="plate pb-scene">
        <PlateArt src={sceneFor(scenario?.incident?.type)} />
        {familyBlurb(scenario?.locationFamilyId ?? null) && <span className="pb-scene-place"><Icon name="pin" size={16} />{familyBlurb(scenario?.locationFamilyId ?? null)}</span>}
        {openUntil !== undefined && <OpenFor until={openUntil} />}
      </div>
      {/* The stakes under the plate: what it pays, how hard it reads, how many squads it takes. */}
      {(scenario?.rewards || tier !== null || range) && <ul className="pb-stakes" aria-label="What the call pays and asks">
        {scenario?.rewards && <li><Chip tone="amber" icon="cash" title="What the call pays at best"><span className="pb-pay"><span className="pb-pay-up">Up to</span> <b>{money(scenario.rewards.funding)}</b> · {scenario.rewards.xp} XP</span></Chip></li>}
        {tier !== null && <li><Chip title="The call's tier"><TierChevrons tier={tier} />Tier {tier}</Chip></li>}
        {range && <li><Chip icon="people">{`Takes ${range.min === range.max ? range.min : `${range.min} to ${range.max}`} ${range.max > 1 ? 'squads' : 'squad'}`}</Chip></li>}
      </ul>}
      {/* Orders first (docs/ops-experience.md, Brief), each with the face of the one person it names. */}
      <section className="pb-block pb-orders-panel" aria-labelledby="pb-orders-h">
        <div className="pb-h-row">
          <h3 id="pb-orders-h" className="pb-h"><Icon name="flag" size={16} />Your orders</h3>
          {aside && <span className="pb-h-aside">{aside}</span>}
        </div>
        {brief.objectiveRefs.length
          ? <Card className="pb-card"><ul className="pb-list pb-orders" data-ui-list>{brief.objectiveRefs.map((objective, index) => <li key={objective.id}><Row className="pb-row pb-order"
            lead={<OrderLead n={index + 1} entry={orderPerson(objective, lexicon)} role={whoText.get(objective.id)?.role} />}
            title={<PeopleText text={objective.label} />} /></li>)}</ul></Card>
          : <p className="dim">No orders listed.</p>}
      </section>

      {/* What the team faces: the weapon report as an alert row, then what nobody knows yet. */}
      {(intel.threats.length > 0 || brief.unknown.length > 0) && <section className="pb-block pb-faces" aria-labelledby="pb-faces-h">
        <h3 id="pb-faces-h" className="pb-h"><Icon name="warning" size={16} />What the team faces</h3>
        <Card className="pb-card"><ul className="pb-list" data-ui-list>
          {intel.threats.map((line) => <ThreatRow key={line.id} line={line} />)}
          {brief.unknown.map((text, index) => <li key={`u${index}`} className="pb-unknown"><Row className="pb-row pb-unknown-row"
            lead={<span className="pb-well"><Icon name="search" size={24} /></span>}
            title={<PeopleText text={text} />}
            trail={<FactStatusChip status="unknown" />} /></li>)}
        </ul></Card>
      </section>}

      <ColdOpen text={scenario?.coldOpen} className="pb-cold-open" icon="book" />

      {(intel.people.length > 0 || unplaced.length > 0) && <section className="pb-block" aria-labelledby="pb-people-h">
        <h3 id="pb-people-h" className="pb-h"><Icon name="people" size={16} />Who’s inside</h3>
        <ul className="pb-people" data-ui-list>
          {intel.people.map((line) => { const id = personOf.get(line.id) ?? line.id; return <PersonCard key={line.id} personId={id} name={line.label} role={whoText.get(id)?.role} who={whoText.get(id)?.text} status={line.status} where={line.where} />; })}
          {unplaced.map((person) => <PersonCard key={person.personId} personId={person.personId} name={person.name} role={person.role} who={person.text} />)}
        </ul>
      </section>}

      {intel.environment && <section className="pb-block pb-conditions" aria-label="Conditions">
        <div className="chips"><EnvChips env={intel.environment} /></div>
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

/** The one person an order is about, taken from the data: an order's id is the id of the person it is
 * about (the content's convention: `clerk`, `manager`, `rider` in the hostage call), and the person
 * counts only when the call's lexicon has them as located and public and the order's own words name
 * them. A name found in the text is never enough, since "Get Reuben out before Malik moves" names two
 * people and only one is its subject. Any other order has no face and gets its number. */
export function orderPerson(objective: { id: string; label: string }, lexicon: Lexicon | null): LexiconEntry | null {
  const entry = lexicon?.entries.find((e) => e.id === objective.id);
  if (!lexicon || !entry || entry.kind === 'officer') return null;
  return segmentPeople(objective.label, lexicon).some((part) => part.person?.id === entry.id) ? entry : null;
}

/** An order's picture: the person's role silhouette with the order number on its corner, or the
 * number in a well when the order is about nobody the team has located. */
function OrderLead({ n, entry, role }: { n: number; entry: LexiconEntry | null; role?: string }) {
  // The provider decides whether kinds show (the game's preference, the Lab's names switch): with it
  // off there is no colored entry and the face is the plain person, as on the person cards below.
  const shown = usePeopleEntry(entry?.id);
  if (!entry) return <span className="pb-well pb-well-n" aria-label={`Order ${n}`}>{n}</span>;
  const kind = shown?.kind ?? 'person';
  return <span className="pb-lead" data-kind={kind}>
    <Face size="md" kind={faceKind(kind)} seed={entry.id} role={role} name={peopleLabel(kind, entry.squadName)} />
    <b className="pb-n" aria-label={`Order ${n}`}>{n}</b>
  </span>;
}

/** How long the call stays on the board, ticking: the one live thing on the brief. */
function OpenFor({ until }: { until: number }) {
  const left = until - useNow(1000);
  if (left <= 0) return <span className="pb-scene-time pb-scene-time-soon"><Icon name="clock" size={16} /><span>Call closed</span></span>;
  const soon = left < 15 * 60000;
  return <span className={`pb-scene-time${soon ? ' pb-scene-time-soon' : ''}`}><Icon name="clock" size={16} /><span>{countdown(left)} left</span></span>;
}

/** One person on scene as a card: who they are, their role, and where the team thinks they are. */
function PersonCard({ personId, name, role, who, status, where }: { personId: string; name: string; role?: string; who?: string; status?: KnowledgeStatus; where?: string | null }) {
  const entry = usePeopleEntry(personId);
  return <li className="pb-person" data-kind={entry?.kind}>
    <Face size="md" kind={faceKind(entry?.kind)} seed={personId} role={role} name={entry ? `${name}, ${peopleLabel(entry.kind, entry.squadName)}` : undefined} />
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

/** One weapon report: what the report says and where, then who said it and how sure. */
function ThreatRow({ line }: { line: IntelLine }) {
  return <li className="pb-threat-row">
    <Icon name="warning" size={24} className="pb-threat-icon" />
    <div>
      <p className="pb-threat-claim"><PeopleText text={line.claim.replace(/\.$/, '')} />{line.where ? <span className="pb-threat-where"> · {line.where}</span> : null}</p>
      <p className="pb-threat-source">{line.source ? <span>Reported by {line.source}</span> : null}<FactStatusChip status={line.status} /></p>
    </div>
  </li>;
}
