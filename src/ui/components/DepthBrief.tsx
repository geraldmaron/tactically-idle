// The depth register's briefing pieces (call-depth): the cold open, read once before the briefing,
// and "Who they are", the people's history above why the team was sent. Both are optional fields
// on the scenario; a call without them renders nothing here.
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { PeopleText } from '../people/PeopleText';
import { Icon } from '../icons';
import './depth-brief.css';

/** The scene before the call, set as prose with room to breathe and never clamped. */
export function ColdOpen({ text, className }: { text: string | undefined; className?: string }) {
  if (!text) return null;
  return <section className={`cold-open${className ? ` ${className}` : ''}`} aria-label="Before the call">
    <span className="cold-open-kicker">Before the call</span>
    <p className="cold-open-text"><PeopleText text={text} /></p>
  </section>;
}

/** "Who they are": one entry per key person, a bound full name and one to three sentences. */
export function WhoTheyAre({ people, heading = 'h3' }: { people: NonNullable<ScenarioDefinition['briefing']['people']> | undefined; heading?: 'h3' | 'h4' }) {
  if (!people?.length) return null;
  const H = heading;
  return <div className="who-they-are">
    <H className="who-they-are-h"><Icon name="people" size={15} />Who they are</H>
    <ul>{people.map((person) => <li key={person.personId}>
      <strong><PeopleText text={person.name} /></strong>
      <p><PeopleText text={person.text} /></p>
    </li>)}</ul>
  </div>;
}
