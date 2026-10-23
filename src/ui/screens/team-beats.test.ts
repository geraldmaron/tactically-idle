// The beat each Team commitment plays: SIGNED, ENROLLED, PROMOTED, with a face and a line from recorded facts.
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../content/courses';
import { makeState } from '../../sim/test-fixtures';
import { beatAnnouncement } from '../components/beat-controller';
import { ROLE_META } from '../components/labels';
import { perHour } from '../format';
import { enrolledBeat, patrolEnrolledBeat, patrolSignedBeat, promotedBeat, signedBeat, staffSignedBeat } from './team-beats';

const officer = () => Object.values(makeState().officers)[0];

describe('Team beats', () => {
  it('SIGNED shows the new officer with their role and wage and plays the hire sting', () => {
    const o = officer();
    const beat = signedBeat(o);
    expect(beat).toMatchObject({ stamp: 'Signed', sting: 'hire', face: { officer: o, name: `${o.firstName} ${o.surname}` }, line: `${ROLE_META[o.role].label}, ${perHour(o.wage)}` });
    expect(beatAnnouncement(beat)).toBe(`Signed. ${o.firstName} ${o.surname}. ${ROLE_META[o.role].label}, ${perHour(o.wage)}`);
  });

  it('ENROLLED names the course and when the officer is back, with the enrol sting', () => {
    const o = officer();
    const beat = enrolledBeat(o, COURSES.composure_workshop);
    expect(beat).toMatchObject({ stamp: 'Enrolled', sting: 'enrol', line: 'Composure workshop, back in 4h' });
  });

  it('PROMOTED states the rank and the cause the game recorded, with the promotion sting', () => {
    const beat = promotedBeat(officer(), 'sergeant', 'after Barricade on Wren Court');
    expect(beat).toMatchObject({ stamp: 'Promoted', sting: 'promotion', line: 'Sergeant, after Barricade on Wren Court' });
  });

  it('a Command Staff hire is SIGNED with the manager’s painted face and the post', () => {
    const person = { firstName: 'Helena', surname: 'Teixeira', portrait: 'art/managers/recruiter.webp' };
    expect(staffSignedBeat(person, 'Recruiter')).toMatchObject({ stamp: 'Signed', sting: 'hire', face: { src: person.portrait, name: 'Helena Teixeira' }, line: 'Recruiter' });
  });

  it('patrol hires and training starts show the person’s painted face and the grade', () => {
    const who = { firstName: 'Priya', surname: 'Raman', portrait: 'art/portraits/person_001.webp' };
    expect(patrolSignedBeat(who, 'Patrol Officer')).toMatchObject({ stamp: 'Signed', sting: 'hire', face: { kind: 'patrol', src: who.portrait, name: 'Priya Raman' }, line: 'Patrol Officer' });
    expect(patrolEnrolledBeat(who, 'Patrol Sergeant', 8 * 3_600_000)).toMatchObject({ stamp: 'Enrolled', sting: 'enrol', line: 'Patrol Sergeant, back in 8h' });
  });
});
