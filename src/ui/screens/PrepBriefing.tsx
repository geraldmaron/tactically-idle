// The prepare screen's briefing (rebuilt 2026-10-23 from the owner's "it is weak"): what a player
// needs before choosing a team, in the order they need it. The place and the clock on the plate, what
// the call pays and asks, what the team faces and does not know, then who is inside with the order
// each person carries (one list, owner 2026-10-24: orders apart from the people were a second set
// of data to take in), the cold open and the conditions. Rendered from props alone so the Scenario
// Lab shows the player's real briefing. Only what the player is told at dispatch: intel.ts never
// reads truth. Store-free.
import type { JSX, ReactNode } from 'react';
import { FactStatusChip } from '../components/FactStatusChip';
import { callTier, type Briefing } from '../../sim/operation-selectors';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, KnowledgeStatus } from '../../sim/types';
import { waitsForPlayer } from './operations/model';
import { countdown, EnvChips, placeTags, TierChevrons, useNow } from '../components/incident';
import { Face, type FaceKind } from '../components/Face';
import { PlateArt, placeFor, sceneFor } from '../art/Plates';
import { Icon } from '../icons';
import { money } from '../format';
import { Chip, Row, Section } from '../components/ui';
import { PeopleGlyph, PeopleText, usePeopleEntry } from '../people/PeopleText';
import { peopleLabel } from '../people/lexicon';
import { IncidentBriefContext } from './SupportContext';
import type { Intel, IntelLine } from './intel';
import { Disclosure } from '../components/Disclosure';
import { ColdOpen } from '../components/DepthBrief';
import './prep-briefing.css';

/** `built` is the call's building as the player sees it; the briefing reads it through `intel`.
 * `openUntil` is when the call leaves the board (epoch ms); the Lab has no board, so it passes none. */
export function PrepBriefing({ scenario, built, brief, intel, openUntil, fee = 0, children }: { scenario: ScenarioDefinition | null | undefined; built: BuiltLocation; brief: Briefing; intel: Intel;
  openUntil?: number;
  /** What the call pays at best, from `callFee`. The caller works it out, so this screen never loads the game's store (the Lab renders it). */
  fee?: number;
  /** Who goes and what they carry, right after what the team faces, so one screen briefs and deploys. */
  children?: ReactNode }): JSX.Element {
  const knownRest = brief.known.filter((k) => !intel.covered.has(k));
  // A person report is the person's location fact; the story binding says whose.
  const personOf = new Map(Object.values(scenario?.story?.bindings.people ?? {}).map((person) => [person.locationFactId, person.id]));
  const whoText = new Map((scenario?.briefing.people ?? []).map((person) => [person.personId, person]));
  // People the dispatch names but no location report covers still belong on the list.
  const reported = new Set(intel.people.map((line) => personOf.get(line.id) ?? line.id));
  const unplaced = (scenario?.briefing.people ?? []).filter((person) => !reported.has(person.personId));
  // An order's id is the id of the person it is about (the content's convention: `clerk`, `manager`,
  // `rider` in the hostage call), so each order rides on that person's row, in the order they are
  // numbered. An order about nobody listed follows the people.
  const cards = [
    ...intel.people.map((line) => { const id = personOf.get(line.id) ?? line.id; return { id, name: line.label, role: whoText.get(id)?.role, who: whoText.get(id)?.text, status: line.status, where: line.where }; }),
    ...unplaced.map((person) => ({ id: person.personId, name: person.name, role: person.role, who: person.text, status: undefined, where: undefined })),
  ];
  const orders = brief.objectiveRefs.map((objective, index) => ({ ...objective, n: index + 1 }));
  const ordersOf = new Map(orders.filter((order) => cards.some((card) => card.id === order.id)).map((order) => [order.id, order]));
  const loose = orders.filter((order) => !ordersOf.has(order.id));
  const listed = [...cards].sort((a, b) => (ordersOf.get(a.id)?.n ?? Infinity) - (ordersOf.get(b.id)?.n ?? Infinity));
  const range = scenario?.squadRange;
  const place = placeTags(scenario?.locationFamilyId, built?.location?.name);
  // The call's tier, never called difficulty or risk: tiers do not compare across call types. Authored calls have none.
  const tier = scenario ? callTier(scenario.id) : null;
  return (
    <div className="pb">
      {/* The scene plate: the call's painted place at the shared plate height. What the call pays and
          asks runs along its top; the place is a caption at its foot and the board clock sits opposite. */}
      <div className="plate pb-scene">
        <PlateArt src={placeFor(scenario?.locationFamilyId) ?? sceneFor(scenario?.incident?.type)} />
        {(scenario?.rewards || tier !== null || range) && <ul className="pb-stakes" aria-label="What the call pays and asks">
          {scenario?.rewards && <li><Chip tone="amber" icon="funds" title="What the call pays at best"><span className="pb-pay"><span className="pb-pay-up">Up to</span> <b>{money(fee)}</b> · {scenario.rewards.xp} XP</span></Chip></li>}
          {tier !== null && <li><Chip title="The call's tier"><TierChevrons tier={tier} />Tier {tier}</Chip></li>}
          {range && <li><Chip icon="people">{`Takes ${range.min === range.max ? range.min : `${range.min} to ${range.max}`} ${range.max > 1 ? 'squads' : 'squad'}`}</Chip></li>}
        </ul>}
        {(place.name || place.kind) && <span className="pb-scene-place"><Icon name="pin" size={16} /><span className="pb-scene-tags">{place.name && <b>{place.name}</b>}{place.kind && <small>{place.kind}</small>}</span></span>}
        {openUntil !== undefined && <OpenFor until={openUntil} />}
      </div>
      {/* The situation comes before anything is asked of the player (owner, 2026-10-24: the background
          sat at the end, after the squad). The call's hook under the plate, then the cold open whole. */}
      {scenario?.summary && <p className="pb-hook"><PeopleText text={scenario.summary} /></p>}
      <ColdOpen text={scenario?.coldOpen} className="pb-cold-open" icon="book" />

      {/* Each block is a framed panel (canvas "Depth and Framed Sections"): its title in the bar, its
          list pressed into a well. */}
      {/* What the team faces: the weapon report as an alert row, then what nobody knows yet. */}
      {(intel.threats.length > 0 || brief.unknown.length > 0) && <Section className="pb-block pb-faces" id="pb-faces-h" level="h3" title="What the team faces" icon="warning" well>
        <ul className="pb-list" data-ui-list>
          {intel.threats.map((line) => <ThreatRow key={line.id} line={line} />)}
          {brief.unknown.map((text, index) => <li key={`u${index}`} className="pb-unknown"><Row className="pb-row pb-unknown-row"
            lead={<span className="pb-well"><Icon name="search" size={24} /></span>}
            title={<PeopleText text={text} />}
            trail={<FactStatusChip status="unknown" />} /></li>)}
        </ul>
      </Section>}

      {/* Who is inside, one compact row each: face, name, role, where the team thinks they are, and the
          order the team carries for them. A person's history opens on a tap. */}
      {(cards.length > 0 || loose.length > 0) && <Section className="pb-block" id="pb-people-h" level="h3" title="Who’s inside" icon="people" tone="people" count={orders.length ? `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}` : `${cards.length} named`} well>
        <ul className="pb-people" data-ui-list>
          {listed.map((card) => <PersonCard key={card.id} personId={card.id} name={card.name} role={card.role} who={card.who} status={card.status} where={card.where} order={ordersOf.get(card.id)} />)}
          {loose.map((order) => <li key={order.id} className="pb-person pb-person-loose"><span className="pb-well pb-well-n" aria-label={`Order ${order.n}`}>{order.n}</span>
            <div className="pb-person-text"><span className="pb-person-order"><PeopleText text={order.label} /></span></div></li>)}
        </ul>
      </Section>}

      {children}

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

/** How long the call stays on the board, ticking: the one live thing on the brief. */
function OpenFor({ until }: { until: number }) {
  const left = until - useNow(1000);
  if (waitsForPlayer(until)) return <span className="pb-scene-time"><Icon name="clock" size={16} /><span>Waits until you serve it</span></span>;
  if (left <= 0) return <span className="pb-scene-time pb-scene-time-soon"><Icon name="clock" size={16} /><span>Call closed</span></span>;
  const soon = left < 15 * 60000;
  return <span className={`pb-scene-time${soon ? ' pb-scene-time-soon' : ''}`}><Icon name="clock" size={16} /><span>{countdown(left)} left</span></span>;
}

/** One person on scene as a compact row: face, name, role, where the team thinks they are, and the
 * order the team carries for them, numbered on the face's corner. Their history, when the call has
 * one, opens under the row on a tap. */
function PersonCard({ personId, name, role, who, status, where, order }: { personId: string; name: string; role?: string; who?: string; status?: KnowledgeStatus; where?: string | null; order?: { n: number; label: string } }) {
  const entry = usePeopleEntry(personId);
  const face = <Face size="md" kind={faceKind(entry?.kind)} seed={personId} role={role} name={entry ? `${name}, ${peopleLabel(entry.kind, entry.squadName)}` : undefined} />;
  const row = <>
    {order ? <span className="pb-lead">{face}<b className="pb-n" aria-label={`Order ${order.n}`}>{order.n}</b></span> : face}
    <div className="pb-person-text">
      {order && <span className="pb-person-order"><PeopleText text={order.label} /></span>}
      <strong>{entry && <PeopleGlyph kind={entry.kind} tone />}{name}{role && <span className="pb-role">{role}</span>}</strong>
      {status && <span className="pb-where"><FactStatusChip status={status} />{where && <span className="pb-where-place"><Icon name="pin" size={16} />{where}</span>}</span>}
    </div>
  </>;
  if (!who) return <li className="pb-person" data-kind={entry?.kind}>{row}</li>;
  return <li className="pb-person-item" data-kind={entry?.kind}>
    <Disclosure name={`pb-person-${personId}`} className="pb-person-more" row="pb-person" summary={row}>
      <p className="pb-person-who"><PeopleText text={who} /></p>
    </Disclosure>
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
