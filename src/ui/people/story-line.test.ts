// StoryLine: one true line per person, in priority order, from recorded facts only.
import { describe, expect, it } from 'vitest';
import { PERSONAS, personaNote } from '../../content/personas';
import { STRESS_BANDS } from '../../sim/officer';
import { PATROL_GRADES } from '../../sim/patrol';
import { makeState, NOW } from '../../sim/test-fixtures';
import type { Officer, PatrolEmployee } from '../../sim/types';
import { officerFaceStatus } from '../components/face-status';
import { rotation, STORY_TURN_MS, storyLine, turnedLine, turnIndex, type StoryPerson } from './story-line';

const HOUR = 3_600_000;
const PERSON_A = PERSONAS[0].id;
const PERSON_B = PERSONAS[1].id;

function base(): Officer {
  const g = makeState();
  const o = Object.values(g.officers)[0];
  return { ...o, identityId: PERSON_A, traits: [], promotions: [], stress: 0, injury: null, assignment: null, career: { operations: 0, favorable: 0, adverse: 0 } };
}

/** The officer as the game would show them: status comes from the real face-status rules. */
function officerPerson(patch: Partial<Officer>): StoryPerson {
  const g = makeState();
  const o = { ...base(), ...patch };
  g.officers[o.id] = o;
  return { kind: 'officer', officer: o, status: officerFaceStatus(g, o.id, NOW) };
}

const patrol = (patch: Partial<PatrolEmployee> = {}): StoryPerson => ({
  kind: 'patrol',
  gradeName: (grade) => PATROL_GRADES[grade].name,
  employee: { id: 'patrol_1', profileId: PERSON_B, grade: 1, serviceHours: 0, training: null, dismissedAt: null, ...patch },
});

describe('storyLine priority', () => {
  it('leads with a current state over a trait and the persona note', () => {
    const person = officerPerson({ injury: { label: 'Sprained wrist', until: NOW + 3 * HOUR }, traits: ['mentor'], promotions: [{ rank: 'sergeant', day: 10, cause: 'after Barricade on Wren Court' }] });
    expect(storyLine(person, NOW)).toEqual({ kind: 'state', text: 'Injured. Back in 3h.' });
  });

  it('falls to the earned trait with its recorded cause when nothing is wrong', () => {
    const person = officerPerson({ traits: ['mentor'], promotions: [{ rank: 'sergeant', day: 10, cause: 'after Barricade on Wren Court' }] });
    expect(storyLine(person, NOW)).toEqual({ kind: 'trait', text: 'Earned the Mentor trait on promotion to Sergeant, after Barricade on Wren Court.' });
  });

  it('falls to the persona note when there is no state and no earned trait', () => {
    expect(storyLine(officerPerson({}), NOW)).toEqual({ kind: 'persona', text: personaNote(PERSON_A) });
  });

  it('falls to a counted fact for a person with no persona note, and to null with nothing recorded', () => {
    expect(storyLine(officerPerson({ identityId: undefined, career: { operations: 1, favorable: 1, adverse: 0 } }), NOW)).toEqual({ kind: 'record', text: '1 call worked with this department.' });
    expect(storyLine(officerPerson({ identityId: undefined }), NOW)).toBeNull();
  });
});

describe('current states', () => {
  it('says what the face badge says, for each mark', () => {
    expect(storyLine(officerPerson({ assignment: { kind: 'operation', runId: 'run_1' } }), NOW)?.text).toBe('On a call right now.');
    expect(storyLine(officerPerson({ assignment: { kind: 'training', courseId: 'c', startedAt: NOW, endsAt: NOW + 2 * HOUR } as Officer['assignment'] }), NOW)?.text).toBe('In training. Back in 2h.');
    expect(storyLine(officerPerson({ assignment: { kind: 'detail', endsAt: NOW + HOUR } as Officer['assignment'] }), NOW)?.text).toBe('Teaching a detail. Back in 1h.');
    expect(storyLine(officerPerson({ stress: STRESS_BANDS.strained }), NOW)).toEqual({ kind: 'state', text: 'Strained. A quiet shift would help.' });
    expect(storyLine(officerPerson({ stress: STRESS_BANDS.overloaded }), NOW)?.text).toBe('Overloaded, so no high-risk actions until rested.');
  });

  it('does not say a state once its time has passed', () => {
    const person = officerPerson({ injury: { label: 'Sprained wrist', until: NOW - HOUR } });
    expect(storyLine(person, NOW)?.kind).toBe('persona');
  });
});

describe('earned trait', () => {
  it('names a trait only when a promotion granted it and the officer still holds it', () => {
    const promoted = [{ rank: 'sergeant' as const, day: 10, cause: 'on finishing a course' }];
    expect(rotation(officerPerson({ traits: [], promotions: promoted }), NOW).some((l) => l.kind === 'trait')).toBe(false);
    expect(rotation(officerPerson({ traits: ['steady'], promotions: promoted }), NOW).some((l) => l.kind === 'trait')).toBe(false);
    expect(rotation(officerPerson({ traits: ['mentor'], promotions: promoted }), NOW).find((l) => l.kind === 'trait')?.text)
      .toBe('Earned the Mentor trait on promotion to Sergeant, on finishing a course.');
  });

  it('takes the latest promotion that granted a held trait, and drops an empty cause cleanly', () => {
    const person = officerPerson({ traits: ['steady', 'mentor'], promotions: [{ rank: 'corporal', day: 5, cause: 'after a call' }, { rank: 'sergeant', day: 9, cause: '' }] });
    expect(rotation(person, NOW).find((l) => l.kind === 'trait')?.text).toBe('Earned the Mentor trait on promotion to Sergeant.');
  });

  it('never invents a trait for a starting officer who holds traits they were built with', () => {
    expect(rotation(officerPerson({ traits: ['steady', 'mentor'], promotions: undefined }), NOW).some((l) => l.kind === 'trait')).toBe(false);
  });
});

describe('patrol staff', () => {
  it('gets the persona note they had none of, then the recorded grade and hours', () => {
    const lines = rotation(patrol({ serviceHours: 142.6 }), NOW);
    expect(lines).toEqual([
      { kind: 'persona', text: personaNote(PERSON_B) },
      { kind: 'record', text: 'Patrol Officer, 142 hours on patrol.' },
    ]);
  });

  it('says a new hire is new, and a training course in progress first', () => {
    expect(storyLine(patrol({ training: { toGrade: 2, startedAt: NOW - HOUR, endsAt: NOW + 3 * HOUR } }), NOW))
      .toEqual({ kind: 'state', text: 'Training for Senior Patrol Officer. Done in 3h.' });
    expect(rotation(patrol(), NOW).at(-1)?.text).toBe('Patrol Officer. New to the beat.');
  });

  it('ignores a course that already finished', () => {
    expect(storyLine(patrol({ training: { toGrade: 2, startedAt: NOW - 5 * HOUR, endsAt: NOW - HOUR } }), NOW)?.kind).toBe('persona');
  });
});

describe('rotation', () => {
  it('lists state, trait, persona and record in priority order, once each', () => {
    const person = officerPerson({
      assignment: { kind: 'operation', runId: 'run_1' }, traits: ['mentor'],
      promotions: [{ rank: 'sergeant', day: 10, cause: 'after Barricade on Wren Court' }], career: { operations: 12, favorable: 9, adverse: 1 },
    });
    expect(rotation(person, NOW).map((l) => l.kind)).toEqual(['state', 'trait', 'persona', 'record']);
    expect(rotation(person, NOW).at(-1)?.text).toBe('12 calls worked with this department.');
  });

  it('turns over on a steady period and holds still for reduced motion', () => {
    const person = officerPerson({ traits: ['mentor'], promotions: [{ rank: 'sergeant', day: 10, cause: 'after a call' }], career: { operations: 3, favorable: 3, adverse: 0 } });
    const count = rotation(person, NOW).length;
    const seen = new Set<string>();
    for (let i = 0; i < count; i++) seen.add(turnedLine(person, NOW + i * STORY_TURN_MS)!.text);
    expect(seen.size).toBe(count);
    expect(turnedLine(person, NOW, true)).toEqual(rotation(person, NOW)[0]);
    expect(turnedLine(person, NOW + 7 * STORY_TURN_MS, true)).toEqual(rotation(person, NOW)[0]);
  });

  it('staggers people so a roster does not turn over in unison', () => {
    const starts = new Set(['off_a', 'off_b', 'off_c', 'off_d', 'off_e'].map((id) => turnIndex(4, NOW, id)));
    expect(starts.size).toBeGreaterThan(1);
    expect(turnIndex(1, NOW, 'off_a')).toBe(0);
    expect(turnIndex(0, NOW, 'off_a')).toBe(0);
  });
});

describe('house rules for the lines it writes', () => {
  it('uses no dashes, no colons, and no stock tells', () => {
    const persons: StoryPerson[] = [
      officerPerson({ injury: { label: 'x', until: NOW + 3 * HOUR } }), officerPerson({ assignment: { kind: 'operation', runId: 'r' } }),
      officerPerson({ stress: STRESS_BANDS.strained }), officerPerson({ stress: STRESS_BANDS.overloaded }),
      officerPerson({ traits: ['mentor'], promotions: [{ rank: 'sergeant', day: 1, cause: 'after Barricade on Wren Court' }], career: { operations: 4, favorable: 2, adverse: 1 } }),
      patrol({ serviceHours: 1 }), patrol({ training: { toGrade: 3, startedAt: NOW, endsAt: NOW + HOUR } }),
    ];
    for (const person of persons) {
      for (const line of rotation(person, NOW)) {
        expect(line.text, line.text).not.toMatch(/[–—:]| - /);
        expect(line.text).toMatch(/[.!?]$/);
      }
    }
  });

  it('treats a mark the game does not record as no state at all', () => {
    expect(storyLine({ kind: 'officer', officer: base(), status: { mark: null, band: 'ready', until: null } }, NOW)?.kind).toBe('persona');
    expect(storyLine({ kind: 'officer', officer: base() }, NOW)?.kind).toBe('persona');
  });
});
