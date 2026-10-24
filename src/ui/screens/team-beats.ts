// The payoff for each Team commitment, as data for useBeat() (components/Beat.tsx). Pure: each builder
// takes the records it speaks from and returns the stamp, the face and one line. Every line is a fact
// the game recorded (role, wage, course hours, a rank and its cause); no line invents a reaction.
import type { BeatSpec } from '../components/beat-controller';
import type { RankId } from '../../content/ranks';
import type { Course, Officer } from '../../sim/types';
import { ROLE_META } from '../components/labels';
import { duration, fundingPerHour } from '../format';
import { promotionLine } from './team-model';

const name = (o: Pick<Officer, 'firstName' | 'surname'>) => `${o.firstName} ${o.surname}`;

/** SIGNED: the officer's face, their role and wage. */
export function signedBeat(officer: Officer): BeatSpec {
  return { stamp: 'Signed', face: { officer, name: name(officer) }, line: `${ROLE_META[officer.role].label}, ${fundingPerHour(officer.wage)}`, sting: 'hire' };
}

/** ENROLLED: the officer's face, the course and when they are back. */
export function enrolledBeat(officer: Officer, course: Pick<Course, 'name' | 'hours'>): BeatSpec {
  return { stamp: 'Enrolled', face: { officer, name: name(officer) }, line: `${course.name}, back in ${duration(course.hours * 3_600_000)}`, sting: 'enrol' };
}

/** PROMOTED: the officer's face, the new rank and the cause the game recorded for it. */
export function promotedBeat(officer: Pick<Officer, 'id' | 'identityId' | 'firstName' | 'surname' | 'portrait' | 'role'>, rank: RankId, cause: string): BeatSpec {
  return { stamp: 'Promoted', face: { officer, name: name(officer) }, line: promotionLine(rank, cause), sting: 'promotion' };
}

/** SIGNED for patrol: the hire's face and grade. `portrait` is the painted file path. */
export function patrolSignedBeat(who: { firstName: string; surname: string; portrait?: string }, gradeName: string): BeatSpec {
  return { stamp: 'Signed', face: { src: who.portrait, kind: 'patrol', name: `${who.firstName} ${who.surname}` }, line: gradeName, sting: 'hire' };
}

/** A patrol person's training started: the grade they are training for. */
export function patrolEnrolledBeat(who: { firstName: string; surname: string; portrait?: string }, toGradeName: string, endsIn: number): BeatSpec {
  return { stamp: 'Enrolled', face: { src: who.portrait, kind: 'patrol', name: `${who.firstName} ${who.surname}` }, line: `${toGradeName}, back in ${duration(endsIn)}`, sting: 'enrol' };
}

/** SIGNED for a Command Staff post: the manager's painted face, then who they are for and the post. */
export function staffSignedBeat(person: { firstName: string; surname: string; portrait: string }, postTitle: string): BeatSpec {
  return { stamp: 'Signed', face: { src: person.portrait, kind: 'person', name: `${person.firstName} ${person.surname}` }, line: postTitle, sting: 'hire' };
}
