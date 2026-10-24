// The depth register's briefing pieces (call-depth): the cold open, read once before the briefing,
// and "Who they are", the people's history above why the team was sent. Both are optional fields
// on the scenario; a call without them renders nothing here.
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { PeopleText } from '../people/PeopleText';
import { Icon, type IconName } from '../icons';
import { Section } from './ui';
import './depth-brief.css';

/** The scene before the call, set as prose with room to breathe and never clamped. */
export function ColdOpen({ text, className, icon }: { text: string | undefined; className?: string; /** A picture beside the kicker's words (the brief passes one). */ icon?: IconName }) {
  if (!text) return null;
  // A framed panel like every other block on the brief: the title in the bar, the story in the body.
  return <Section className={`cold-open${className ? ` ${className}` : ''}`} level="h3" title="Before the call" icon={icon ?? 'book'}>
    <p className="cold-open-text"><PeopleText text={text} /></p>
  </Section>;
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
