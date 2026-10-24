// A call's spoken lines as a radio log: who speaks, then what they said. The engine binds every
// line and speaker to display text already (a first name, 'Negotiator', 'Radio' or 'Dispatch'), so
// this only lays them out. No colons and no quotation marks: the speaker column does that work.
import type { JSX } from 'react';
import { PeopleText } from '../people/PeopleText';
import { Icon } from '../icons';
import './transcript.css';

export interface SpokenLine { speaker: string; line: string }

const VOICES: Record<string, string> = { Negotiator: 'negotiator', Radio: 'radio', Dispatch: 'radio' };

export function Transcript({ lines, label = 'What was said' }: { lines?: readonly SpokenLine[]; label?: string }): JSX.Element | null {
  if (!lines?.length) return null;
  return <ol className="transcript" aria-label={label}>
    {lines.map((entry, index) => {
      // A speaker who also spoke the line before keeps the column empty, as a script would.
      const repeat = index > 0 && lines[index - 1].speaker === entry.speaker;
      return <li key={index} className={`transcript-row transcript-${VOICES[entry.speaker] ?? 'person'}${repeat ? ' transcript-repeat' : ''}`}>
        <span className="transcript-speaker" aria-hidden={repeat || undefined}>{VOICES[entry.speaker] === 'radio' && <Icon name="radio" size={12} />}<PeopleText text={entry.speaker} /></span>
        <span className="transcript-line">{repeat && <span className="sr-only">{entry.speaker}. </span>}<PeopleText text={entry.line} /></span>
      </li>;
    })}
  </ol>;
}
