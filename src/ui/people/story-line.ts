// One short, true line about a person, for the tile that shows their face (station rebuild: "people
// first"). Pure: the caller passes the person and the clock, nothing here reads the store or writes
// the sim. Every line comes from a field the game records, so no line invents call history:
//
//   1. state     what is true right now: injured, on a call, in training, resting, strained
//   2. trait     a trait a promotion granted, with the promotion's recorded cause
//   3. persona   the authored note in src/content/personas.json (patrol staff share the persona
//                catalog, so they get one too)
//   4. record    a counted fact: calls worked for an officer, hours on patrol for a patrol officer
//
// `storyLine` is the first line that applies; `rotation` is all of them for a tile to cycle through.
// Wording follows .agents/skills/swat-officer-stories and the house rules in AGENTS.md: no dashes,
// colons only in fixed formats (there are none here), nothing a person on scene could not see.
import { personaNote } from '../../content/personas';
import { RANKS } from '../../content/ranks';
import type { Officer, PatrolEmployee, PatrolGrade } from '../../sim/types';
import { TRAIT_INFO } from '../components/labels';
import type { FaceStatus } from '../components/face-status';
import { duration } from '../format';

export type StoryKind = 'state' | 'trait' | 'persona' | 'record';

export interface StoryLine {
  kind: StoryKind;
  text: string;
}

export type StoryOfficer = Pick<Officer, 'id' | 'identityId' | 'traits' | 'promotions' | 'career' | 'assignment'>;
export type StoryEmployee = Pick<PatrolEmployee, 'id' | 'profileId' | 'grade' | 'serviceHours' | 'training' | 'dismissedAt'>;

/** Who the line is about. An officer's `status` is `officerFaceStatus(g, id, now)`, which is where the
 * game decides injured, on a call, in training, resting or strained. A patrol person comes with
 * `gradeName`, `(grade) => PATROL_GRADES[grade].name` (sim/patrol.ts), passed in so this module stays
 * out of the economy's system (src/architecture). */
export type StoryPerson =
  | { kind: 'officer'; officer: StoryOfficer; status?: Pick<FaceStatus, 'mark' | 'band' | 'until'> | null }
  | { kind: 'patrol'; employee: StoryEmployee; gradeName: (grade: PatrolGrade) => string };

const wait = (until: number | null | undefined, now: number): string => until !== null && until !== undefined && until > now ? ` Back in ${duration(until - now)}.` : '';

function officerState(officer: StoryOfficer, status: NonNullable<Extract<StoryPerson, { kind: 'officer' }>['status']>, now: number): string | null {
  switch (status.mark) {
    case 'injured': return `Injured.${wait(status.until, now)}`;
    case 'deployed': return 'On a call right now.';
    case 'training':
      return officer.assignment?.kind === 'detail' ? `Teaching a detail.${wait(status.until, now)}` : `In training.${wait(status.until, now)}`;
    case 'resting': return `Resting to recover.${wait(status.until, now)}`;
    case 'strained': return status.band === 'overloaded' ? 'Overloaded, so no high-risk actions until rested.' : 'Strained. A quiet shift would help.';
    default: return null;
  }
}

function patrolState(employee: StoryEmployee, gradeName: (grade: PatrolGrade) => string, now: number): string | null {
  if (employee.training && employee.training.endsAt > now) {
    return `Training for ${gradeName(employee.training.toGrade)}. Done in ${duration(employee.training.endsAt - now)}.`;
  }
  return null;
}

/** The most recent promotion that granted a trait this officer still holds. */
function earnedTrait(officer: StoryOfficer): string | null {
  const promotions = officer.promotions ?? [];
  for (let i = promotions.length - 1; i >= 0; i--) {
    const trait = RANKS[promotions[i].rank]?.trait;
    if (!trait || !officer.traits.includes(trait)) continue;
    const cause = promotions[i].cause.trim();
    return `Earned the ${TRAIT_INFO[trait].label} trait on promotion to ${RANKS[promotions[i].rank].title}${cause ? `, ${cause}` : ''}.`;
  }
  return null;
}

const calls = (n: number) => `${n} ${n === 1 ? 'call' : 'calls'}`;

function officerRecord(officer: StoryOfficer): string | null {
  const done = officer.career.operations;
  return done > 0 ? `${calls(done)} worked with this department.` : null;
}

function patrolRecord(employee: StoryEmployee, gradeName: (grade: PatrolGrade) => string): string {
  const hours = Math.floor(employee.serviceHours);
  const grade = gradeName(employee.grade);
  return hours > 0 ? `${grade}, ${hours} ${hours === 1 ? 'hour' : 'hours'} on patrol.` : `${grade}. New to the beat.`;
}

/** Every line that is true of this person now, in priority order, without repeats. */
export function rotation(person: StoryPerson, now: number): StoryLine[] {
  const lines: StoryLine[] = [];
  const add = (kind: StoryKind, text: string | null) => { if (text && !lines.some((l) => l.text === text)) lines.push({ kind, text }); };
  if (person.kind === 'officer') {
    const { officer, status } = person;
    add('state', status ? officerState(officer, status, now) : null);
    add('trait', earnedTrait(officer));
    add('persona', personaNote(officer.identityId));
    add('record', officerRecord(officer));
  } else {
    const { employee, gradeName } = person;
    add('state', patrolState(employee, gradeName, now));
    add('persona', personaNote(employee.profileId));
    add('record', patrolRecord(employee, gradeName));
  }
  return lines;
}

/** The one line to show when a tile has room for a single line. Null only when nothing is recorded. */
export function storyLine(person: StoryPerson, now: number): StoryLine | null {
  return rotation(person, now)[0] ?? null;
}

/** How long a tile holds one line before it turns to the next. */
export const STORY_TURN_MS = 8000;

/** Which of `count` lines a tile shows at `now`. Each person starts at a different place in the
 * cycle (from their id), so a roster of tiles does not turn over in unison. */
export function turnIndex(count: number, now: number, id: string, period = STORY_TURN_MS): number {
  if (count <= 1) return 0;
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  return (Math.floor(now / period) + seed) % count;
}

/** The line a rotating tile shows at `now`; a tile that is held still (reduced motion) passes `still`
 * and always gets the first, highest-priority line. */
export function turnedLine(person: StoryPerson, now: number, still = false): StoryLine | null {
  const lines = rotation(person, now);
  if (!lines.length) return null;
  return lines[still ? 0 : turnIndex(lines.length, now, person.kind === 'officer' ? person.officer.id : person.employee.id)];
}
