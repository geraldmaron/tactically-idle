// Training, split into Start now and Opens later, with the officers each open course would help most.
import { describe, expect, it } from 'vitest';
import { COURSES, COURSE_RATING_CEILING } from '../../content/courses';
import { establishedDepartment } from '../../sim/department-test-fixtures';
import type { GameState } from '../../sim/types';
import { courseGate, coursePicks, picksLine, splitCourses } from './training-picks';

const NOW = Date.UTC(2026, 9, 3, 12);
let g: GameState;
const fresh = () => { g = establishedDepartment(NOW, 1); return g; };
/** Builds a development node the way the game records it: unlocked and at tier one. */
const build = (...nodes: string[]) => { for (const id of nodes) { g.department.unlockedNodes.push(id); g.department.developmentTiers[id] ??= 1; } };

describe('course gates', () => {
  it('holds a course behind its development node and names the node', () => {
    fresh();
    const gate = courseGate(g, COURSES.crisis_negotiation_course);
    expect(gate).toMatchObject({ state: 'locked', kind: 'node', nodeId: 'personnel_negotiation', nodeName: 'Negotiation training' });
    expect(gate.state === 'locked' && gate.line).toBe('Opens with Negotiation training in Build');
  });

  it('opens a course once its node is built', () => {
    fresh();
    build('personnel_negotiation');
    expect(courseGate(g, COURSES.crisis_negotiation_course)).toEqual({ state: 'open' });
    expect(courseGate(g, COURSES.composure_workshop)).toEqual({ state: 'open' });
  });

  it('holds a course behind a qualification nobody holds and links to the course that grants it', () => {
    fresh();
    build('field_specialist_response');
    for (const o of Object.values(g.officers)) o.certs = o.certs.filter((c) => c !== 'entry_team');
    const gate = courseGate(g, COURSES.precision_support_course);
    expect(gate).toMatchObject({ state: 'locked', kind: 'cert', certId: 'entry_team', via: 'entry_course' });
    // Someone holding it opens the course.
    Object.values(g.officers)[0].certs.push('entry_team');
    expect(courseGate(g, COURSES.precision_support_course)).toEqual({ state: 'open' });
  });
});

describe('who a course would help most', () => {
  it('ranks a rating course by the recorded gain, then by the most room, and names two', () => {
    fresh();
    const [a, b, c, d] = Object.values(g.officers);
    Object.values(g.officers).forEach((o) => { o.assignment = null; o.ratings.communication = 80; });
    a.ratings.communication = 40; b.ratings.communication = 50; c.ratings.communication = 60; d.ratings.communication = 70;
    const picks = coursePicks(g, COURSES.communication_refresher);
    expect(picks.map((p) => p.officer.id)).toEqual([a.id, b.id]);
    expect(picks[0].gain).toMatchObject({ before: 40, after: 43, delta: 3, short: 'Communication' });
    expect(picksLine(picks)).toBe(`Most to gain: ${a.surname} 40 to 43, ${b.surname} 50 to 53`);
  });

  it('leaves out officers the simulation would refuse (at the ceiling, deployed or already training)', () => {
    fresh();
    const [a, b, c] = Object.values(g.officers);
    Object.values(g.officers).forEach((o) => { o.assignment = null; o.ratings.shooting = COURSE_RATING_CEILING; });
    a.ratings.shooting = 60; b.ratings.shooting = 50; c.ratings.shooting = 40;
    b.assignment = { kind: 'operation', runId: 'run' };
    c.assignment = { kind: 'training', courseId: 'composure_workshop', startedAt: NOW, endsAt: NOW + 1000 };
    expect(coursePicks(g, COURSES.range_qualification).map((p) => p.officer.id)).toEqual([a.id]);
  });

  it('keeps naming officers when the department has no free place or funds, since the pick is about the person', () => {
    fresh();
    g.department.funding = 0;
    expect(coursePicks(g, COURSES.composure_workshop).length).toBeGreaterThan(0);
    g.department.trainingSlots = 0;
    expect(coursePicks(g, COURSES.composure_workshop).length).toBeGreaterThan(0);
  });

  it('ranks a qualification by the best-fit rating, and skips anyone already holding it', () => {
    fresh();
    build('intel_drone');
    const [a, b, c] = Object.values(g.officers);
    Object.values(g.officers).forEach((o) => { o.assignment = null; o.certs = o.certs.filter((x) => x !== 'drone_operator'); o.ratings.awareness = 30; o.ratings.coordination = 30; o.ratings.composure = 30; });
    a.ratings.awareness = 90; b.ratings.awareness = 80; c.certs.push('drone_operator'); c.ratings.awareness = 99;
    const picks = coursePicks(g, COURSES.drone_course);
    expect(picks.map((p) => p.officer.id)).toEqual([a.id, b.id]);
    expect(picks[0].gain).toBeNull();
    expect(picks[0].fit).toEqual({ short: 'Awareness', value: 90 });
    expect(picksLine(picks)).toBe(`Best placed: ${a.surname}, Awareness 90 · ${b.surname}, Awareness 80`);
  });

  it('says nothing when nobody is eligible', () => {
    fresh();
    Object.values(g.officers).forEach((o) => { o.assignment = { kind: 'operation', runId: 'run' }; });
    expect(picksLine(coursePicks(g, COURSES.composure_workshop))).toBeNull();
  });
});

describe('Start now and Opens later', () => {
  it('splits the catalogue by gate and puts courses somebody can take first', () => {
    fresh();
    Object.values(g.officers).forEach((o) => { o.assignment = null; });
    const { start, later } = splitCourses(g, Object.values(COURSES));
    expect(start.length + later.length).toBe(Object.keys(COURSES).length);
    expect(later.every(({ course }) => courseGate(g, course).state === 'locked')).toBe(true);
    expect(start.every(({ course }) => courseGate(g, course).state === 'open')).toBe(true);
    expect(later.some(({ course }) => course.id === 'crisis_negotiation_course')).toBe(true);
    expect(start.map(({ course }) => course.id)).toContain('composure_workshop');
  });

  it('moves a course to Start now when its node is built', () => {
    fresh();
    build('personnel_negotiation');
    const { start } = splitCourses(g, Object.values(COURSES));
    expect(start.map(({ course }) => course.id)).toContain('crisis_negotiation_course');
  });
});
