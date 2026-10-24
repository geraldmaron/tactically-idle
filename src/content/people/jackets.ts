// Service jackets (docs/world-redesign.md, "The service jacket"). Authored per persona under the
// swat-officer-stories skill and revealed in three pages as the player serves with the officer.
//
// Page 1 (open at hire): a pressure line, one light contradiction, three voice markers and a radio sample.
// Page 2 (after shared operations): a habit or object, and the part of the city the officer comes from.
// Page 3 (after a ledger fact of a set kind): a line with a {place} slot filled from that fact.
//
// Rules this file holds to (swat-officer-stories SKILL.md and references/profile-patterns.md):
// - Pressure lines open with She, He or They, run 18 words at most, name a thing a player can picture and
//   carry no virtue word, trauma, years of service, rank or role. Nothing here states a role or a trait.
// - Contradictions run 12 words at most, one pattern row each, and no two officers share a pattern.
// - Radio samples are position, status, need, 10 words at most. Strained drops the habit, Overloaded keeps
//   the noticed thing, 4 words at most. No officer shares a noticed-first marker with another here.
// - Home districts are an arbitrary spread, never derived from culture, appearance or pronouns: every
//   district has a home officer, and the opening district (pike) has three.
// - No dashes, and no colons except clock times in a radio sample.
//
// Personas without an authored jacket take the template path (templateJacket): page 1 is the persona's own
// note and nothing is invented, so a templated officer shows page 1 only.
import type { FactKind, TieKind } from '../../sim/people/types';
import type { DistrictId } from '../../sim/world/types';
import { PERSONA_BY_ID } from '../personas';
import { AUTHORED_B } from './jackets-b';
import { AUTHORED_C } from './jackets-c';
import { AUTHORED_D } from './jackets-d';

export type VoiceLength = 'short' | 'medium';
export type NoticesFirst = 'exits' | 'hands' | 'sound' | 'time' | 'gear' | 'words' | 'faces' | 'light' | 'count';
export type VoiceHabit =
  | 'counts out loud' | 'names the person' | 'ends on a question' | 'reports gear before people' | 'gives the clock time'
  | 'repeats the last thing said' | 'names the street' | 'says copy and nothing else' | 'describes hands first' | 'names the next step';

export interface VoiceMarkers {
  length: VoiceLength;
  noticesFirst: NoticesFirst;
  habit: VoiceHabit;
  /** The words of the pressure line each marker grows from, for review. Never shown. */
  grewFrom: string;
}

export type ContradictionPattern =
  | 'careful here, careless there' | 'good at what they avoid' | 'precise with objects, loose with time'
  | 'loud off duty, spare on the radio' | 'fixes for others' | 'open about others, closed about self'
  | 'tidy kit, chaotic locker' | 'gives advice, skips it' | 'keeps things, then gives them away';

export interface JacketPage1 {
  pressureLine: string;
  contradiction: string | null;
  pattern: ContradictionPattern | null;
  markers: VoiceMarkers | null;
  /** The same sample at each stress band the radio shows (Mandatory recovery has no lines). */
  radio: { ready: string; strained: string; overloaded: string } | null;
}

export interface JacketPage2 {
  /** A habit or an object, one sentence, no because clause. */
  line: string;
  district: DistrictId;
}

export interface JacketPage3 {
  /** The ledger kind that opens this page. */
  kind: FactKind;
  /** `{place}` is filled from the newest fact of that kind. */
  line: string;
}

export interface Jacket {
  personaId: string;
  page1: JacketPage1;
  page2: JacketPage2 | null;
  page3: JacketPage3 | null;
  /** Authored, never inferred. Off-screen personal life the officer allows in play. */
  openToRelationship: boolean;
  /** Kinds of acquaintance this officer may have with people from their home district. */
  tieKinds: TieKind[];
}

const AUTHORED: Jacket[] = [
  {
    personaId: 'person_001', // Mei Chen
    page1: {
      pressureLine: "She sketches shopfronts on her days off. She's the first to say a lock is new.",
      contradiction: 'Fills a sketchbook a month. Gives the finished pages to shop owners.',
      pattern: 'keeps things, then gives them away',
      markers: { length: 'medium', noticesFirst: 'exits', habit: 'names the street', grewFrom: 'shopfronts and locks to exits, sketching a street to naming it' },
      radio: { ready: 'Rear door, Ninth Street side. New lock, shut. Holding.', strained: 'Rear door. New lock, shut. Holding.', overloaded: 'Rear door. New lock.' },
    },
    page2: { line: 'She keeps a charcoal stub in her sleeve and sketches on the back of every sign-in sheet.', district: 'harbor' },
    page3: { kind: 'rescue', line: 'Since {place}, she draws the way out before she draws the room.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'school'],
  },
  {
    personaId: 'person_002', // Marcus Brooks
    page1: {
      pressureLine: "He restores old radios and trusts nothing he hasn't opened up himself. He checks every handset twice.",
      contradiction: 'Fixes every radio in the building. Lets his own phone ring out.',
      pattern: 'fixes for others',
      markers: { length: 'medium', noticesFirst: 'gear', habit: 'reports gear before people', grewFrom: 'radios and handsets to gear, checking twice to reporting gear first' },
      radio: { ready: 'Rear door. Both handsets good. Two of us. Your word.', strained: 'Rear door. Handsets good. Two of us.', overloaded: 'Rear door. Handsets good.' },
    },
    page2: { line: 'He keeps a spare handset in his bag, wrapped in a dish towel.', district: 'pike' },
    page3: { kind: 'negotiated', line: 'Since {place}, he hands the spare to whoever is doing the talking.' },
    openToRelationship: false,
    tieKinds: ['gym', 'old_job'],
  },
  {
    personaId: 'person_003', // Ana Ortiz
    page1: {
      pressureLine: 'She trades plant cuttings with her neighbors. On a landing she notices who is waiting for someone.',
      contradiction: 'Tells new officers to sit when they can. Never sits herself.',
      pattern: 'gives advice, skips it',
      markers: { length: 'medium', noticesFirst: 'faces', habit: 'ends on a question', grewFrom: 'neighbors on a landing to faces, asking before acting to ending on a question' },
      radio: { ready: 'Hallway. Man on the stairs watching us. Ask him?', strained: 'Hallway. Man on the stairs watching us.', overloaded: 'Man on the stairs.' },
    },
    page2: { line: 'She carries a cutting wrapped in damp paper towel in her jacket pocket.', district: 'larkin' },
    page3: { kind: 'first_call', line: 'Since {place}, she keeps a cutting on the squad room sill.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_004', // Daniel Vale
    page1: {
      pressureLine: 'He repairs old clocks. In a quiet room he hears the one thing still running.',
      contradiction: 'Winds eleven clocks every Sunday. Wears no watch.',
      pattern: 'precise with objects, loose with time',
      markers: { length: 'short', noticesFirst: 'sound', habit: 'gives the clock time', grewFrom: 'the one thing still running to sound, clocks to giving the time' },
      radio: { ready: 'Kitchen, 2:14. Only a fan running. Holding.', strained: 'Kitchen. Only a fan running.', overloaded: 'Kitchen. Fan only.' },
    },
    page2: { line: 'He carries a loupe in his shirt pocket and a screwdriver the size of a toothpick.', district: 'oldmill' },
    page3: { kind: 'injured', line: 'Since {place}, he winds the clock in the squad room before he does anything else.' },
    openToRelationship: true,
    tieKinds: ['old_job', 'neighbor'],
  },
  {
    personaId: 'person_005', // Naomi Okafor
    page1: {
      pressureLine: "She keeps her grandmother's recipes in pencil, and she won't sign a form she hasn't read.",
      contradiction: 'Reads every line of every form. Never opens her own mail.',
      pattern: 'careful here, careless there',
      markers: { length: 'medium', noticesFirst: 'words', habit: 'repeats the last thing said', grewFrom: 'pencil recipes and unsigned forms to words, reading back to repeating' },
      radio: { ready: "Side door. Caller says 'nobody inside.' Nobody inside. Holding.", strained: "Side door. Caller says 'nobody inside.' Holding.", overloaded: 'Side door. Nobody inside.' },
    },
    page2: { line: 'She reads the labels aloud in the supply room, every one, left to right.', district: 'eastgate' },
    page3: { kind: 'favorable_under_pressure', line: 'Since {place}, she reads the plan back once before anyone moves.' },
    openToRelationship: false,
    tieKinds: ['school', 'family_friend'],
  },
  {
    personaId: 'person_006', // Sofia Lindqvist
    page1: {
      pressureLine: 'She photographs small urban gardens at dusk. She notices which window just came on and which went dark.',
      contradiction: 'Every print is labeled by date. Her phone holds a thousand blurs.',
      pattern: 'tidy kit, chaotic locker',
      markers: { length: 'short', noticesFirst: 'light', habit: 'says copy and nothing else', grewFrom: 'dusk and windows to light, short acknowledgements to copy' },
      radio: { ready: 'Side yard. Upstairs window just lit. Copy.', strained: 'Side yard. Upstairs window just lit.', overloaded: 'Upstairs window lit.' },
    },
    page2: { line: 'She carries a folding reflector in her bag and checks every window for glare.', district: 'pike' },
    page3: { kind: 'negotiated', line: 'Since {place}, she asks for the porch light to be left on.' },
    openToRelationship: false,
    tieKinds: ['neighbor', 'gym'],
  },
  {
    personaId: 'person_007', // Tomas Reyes
    page1: {
      pressureLine: 'He collects used paperbacks and reads the last page first. On a call he asks where it ends.',
      contradiction: 'Retells whole novels at lunch. Gives dispatch a single word.',
      pattern: 'loud off duty, spare on the radio',
      markers: { length: 'short', noticesFirst: 'time', habit: 'names the next step', grewFrom: 'last pages and where it ends to time, planning ahead to naming the next step' },
      radio: { ready: 'Landing, 9:40. Door shut. Stairs next.', strained: 'Landing, 9:40. Door shut.', overloaded: 'Landing, 9:40.' },
    },
    page2: { line: 'He keeps a paperback in the van door pocket, spine creased at the last page.', district: 'pike' },
    page3: { kind: 'rescue', line: 'Since {place}, he asks who is last out before he asks who is first in.' },
    openToRelationship: true,
    tieKinds: ['gym', 'school'],
  },
  {
    personaId: 'person_008', // Hana Park
    page1: {
      pressureLine: "She folds paper buildings and notices when a real one has a window that doesn't match.",
      contradiction: 'Freezes at open mics. Still volunteers to read the sign-in sheet aloud.',
      pattern: 'good at what they avoid',
      markers: { length: 'medium', noticesFirst: 'count', habit: 'counts out loud', grewFrom: 'folding buildings and matching windows to counting, counting to saying the count' },
      radio: { ready: 'Rear wall. Three windows, one boarded. Two floors. Holding.', strained: 'Rear wall. Three windows, one boarded. Holding.', overloaded: 'Rear wall. Three windows.' },
    },
    page2: { line: 'She leaves a small paper house on the dash of every van she rides in.', district: 'larkin' },
    page3: { kind: 'mentored', line: 'Since {place}, she keeps a spare paper house for the next new officer.' },
    openToRelationship: false,
    tieKinds: ['school', 'neighbor'],
  },
];

export const JACKETS: Readonly<Record<string, Jacket>> = Object.fromEntries([...AUTHORED, ...AUTHORED_B, ...AUTHORED_C, ...AUTHORED_D].map((j) => [j.personaId, j]));

/** The template path for every persona without an authored jacket: page 1 is the persona's own note and
 * nothing is invented. No markers, no radio sample (in-call lines stay neutral), no contradiction, no
 * home district and no later pages, so a templated officer has no jacket ties and opens no further page. */
export function templateJacket(personaId: string): Jacket {
  const note = PERSONA_BY_ID[personaId]?.personalNote ?? '';
  return { personaId, page1: { pressureLine: note, contradiction: null, pattern: null, markers: null, radio: null }, page2: null, page3: null, openToRelationship: false, tieKinds: [] };
}

/** The authored jacket for a persona, or the template. Officers built outside the cast (test fixtures)
 * get an empty template. */
export function jacketFor(identityId: string | undefined): Jacket {
  if (!identityId) return templateJacket('');
  return JACKETS[identityId] ?? templateJacket(identityId);
}

/** Pages this jacket can ever show: a templated officer has one. */
export function authoredPages(jacket: Jacket): 1 | 2 | 3 {
  return jacket.page3 ? 3 : jacket.page2 ? 2 : 1;
}
