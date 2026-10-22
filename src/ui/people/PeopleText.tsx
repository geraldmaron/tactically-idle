// Call text with people's names colored by public kind (spec 8), behind one switch. The game wraps
// each Ops screen in GamePeopleProvider, which reads the "Color names by role" preference; the
// Scenario Lab uses PeopleProvider directly with its own `names` switch. With no lexicon (switch
// off, or outside any provider) PeopleText renders the plain string, so there is no other path.
// Names in prose never carry a symbol; PeopleGlyph is for labels only.
import { createContext, useContext, useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { peopleLabel, segmentPeople, type Lexicon, type LexiconEntry, type PeopleKind } from './lexicon';
import { peopleColorOn, subscribePeopleColor } from './prefs';
import './people.css';

const PeopleContext = createContext<Lexicon | null>(null);

/** `lexicon` is null when the switch is off. */
export function PeopleProvider({ lexicon, children }: { lexicon: Lexicon | null; children: ReactNode }): JSX.Element {
  return <PeopleContext.Provider value={lexicon}>{children}</PeopleContext.Provider>;
}

/** The game's provider: the lexicon while "Color names by role" is on, null while it is off. */
export function GamePeopleProvider({ lexicon, children }: { lexicon: Lexicon | null; children: ReactNode }): JSX.Element {
  const on = usePeopleColor();
  return <PeopleProvider lexicon={on ? lexicon : null}>{children}</PeopleProvider>;
}

/** The preference, kept current when it changes anywhere on this page. */
export function usePeopleColor(): boolean {
  const [on, setOn] = useState(peopleColorOn);
  useEffect(() => {
    setOn(peopleColorOn());
    return subscribePeopleColor(() => setOn(peopleColorOn()));
  }, []);
  return on;
}

/** Who a person id is in the current lexicon (null when the switch is off or they aren't colored):
 * person tiles use it for their avatar ring. */
export function usePeopleEntry(id: string | null | undefined): LexiconEntry | null {
  const lexicon = useContext(PeopleContext);
  return (id && lexicon?.entries.find((entry) => entry.id === id)) || null;
}

/** A person's kind as a mark, for places where a name stands alone as a label: person tiles and
 * legends. Never inside running text (owner, 2026-10-20: "The symbols should not appear in prose");
 * there the name carries its kind by color and weight. `tone` colors it by kind. */
export function PeopleGlyph({ kind, tone = false }: { kind: PeopleKind; tone?: boolean }) {
  return <svg className={`people-glyph${tone ? ' people-glyph-tone' : ''}`} data-kind={tone ? kind : undefined} viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
    {kind === 'subject' && <path d="M5 .8 9.2 5 5 9.2.8 5Z" fill="currentColor" />}
    {kind === 'withheld' && <path d="M5 1.6 8.4 5 5 8.4 1.6 5Z" fill="none" stroke="currentColor" strokeWidth="1.4" />}
    {kind === 'civilian' && <circle cx="5" cy="5" r="3.6" fill="currentColor" />}
    {kind === 'person' && <circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />}
    {kind === 'officer' && <path d="M5 .9 8.8 2.3v2.6c0 2.2-1.6 3.6-3.8 4.3C2.8 8.5 1.2 7.1 1.2 4.9V2.3Z" fill="currentColor" />}
  </svg>;
}

export function PeopleText({ text }: { text: string }): JSX.Element {
  const lexicon = useContext(PeopleContext);
  if (!lexicon || !text) return <>{text}</>;
  const parts = segmentPeople(text, lexicon);
  if (!parts.some((part) => part.person)) return <>{text}</>;
  return <>{parts.map((part, index) => {
    if (!part.person) return part.text;
    const { id, kind } = part.person;
    const squad = kind === 'officer' ? lexicon.entries.find((entry) => entry.id === id)?.squadName : undefined;
    // Prose gets no mark: the name's color and weight say who they are.
    return <span key={index} className="people-name" data-kind={kind} data-person={id} title={peopleLabel(kind, squad)}>{part.text}</span>;
  })}</>;
}
