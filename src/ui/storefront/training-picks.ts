// Training, split the way the station rebuild reads it: what can start now, what opens later, and for
// each open course the officers it would help most. Pure selectors over the game state: eligibility is
// the simulation's own (courseOptions), the gains are the course data's own deltas (trainingRatingGain),
// and nothing here is a score, a fitness rule or an eligibility rule of its own.
import { COURSES } from '../../content/courses';
import { CERT_NAME } from '../../content/certs';
import { DEV_NODES } from '../../content/dev-tree';
import { courseOptions } from '../../sim/department-selectors';
import type { CertId, Course, GameState, Id, Officer } from '../../sim/types';
import { RATING_META } from '../components/labels';
import { trainingRatingGain, trainingRatingKeys } from './training-officers';

/** Why a course is not open to start: its development node is not built, or nobody holds the
 * qualification it asks for. A course held back only by funds or free places is still open. */
export type CourseGate =
  | { state: 'open' }
  | { state: 'locked'; kind: 'node'; nodeId: Id; nodeName: string; line: string }
  | { state: 'locked'; kind: 'cert'; certId: CertId; certName: string; via: Id | null; line: string };

export function courseGate(game: GameState, course: Course): CourseGate {
  if (course.requiresNode && !game.department.unlockedNodes.includes(course.requiresNode)) {
    const nodeName = DEV_NODES[course.requiresNode]?.name ?? course.requiresNode;
    return { state: 'locked', kind: 'node', nodeId: course.requiresNode, nodeName, line: `Opens with ${nodeName} in Build` };
  }
  const held = new Set<CertId>(Object.values(game.officers).flatMap((officer) => officer.certs));
  const missing = (course.requiresCerts ?? []).find((cert) => !held.has(cert));
  if (missing) {
    const via = Object.values(COURSES).find((other) => other.grants.cert === missing)?.id ?? null;
    return { state: 'locked', kind: 'cert', certId: missing, certName: CERT_NAME[missing], via, line: `Needs one officer qualified in ${CERT_NAME[missing]} first` };
  }
  return { state: 'open' };
}

export interface CoursePick {
  officer: Officer;
  /** A rating course's own delta for this officer, from course data. Null for a qualification. */
  gain: { key: string; short: string; before: number; after: number; delta: number } | null;
  /** A qualification's best-fit rating for this officer, the one the comparison already uses. */
  fit: { short: string; value: number } | null;
}

/** Reasons the course check gives for the department as a whole, not for one officer. */
const DEPARTMENT_WIDE = /^(No free training slot|Needs [\d,.]+K? funding)/;

/** The officers a course would help most, best first. For a rating course that is the largest recorded
 * gain, then the lowest current rating (most room). For a qualification it is the best relevant rating.
 * Only officers the simulation would let enrol (apart from a full roster of places or short funds). */
export function coursePicks(game: GameState, course: Course, count = 2): CoursePick[] {
  const keys = trainingRatingKeys(course);
  const picks: CoursePick[] = [];
  for (const officer of Object.values(game.officers)) {
    const option = courseOptions(game, officer.id, game.department.clockHighWater).find((item) => item.course.id === course.id);
    if (!option || (!option.available && !(option.reason && DEPARTMENT_WIDE.test(option.reason)))) continue;
    const grant = trainingRatingGain(course, officer);
    if (grant) {
      if (grant.delta <= 0) continue;
      picks.push({ officer, gain: { ...grant, short: RATING_META.find((meta) => meta.key === grant.key)?.short ?? grant.key }, fit: null });
      continue;
    }
    const best = keys.map((key) => ({ key, value: Math.round(officer.ratings[key]) })).sort((a, b) => b.value - a.value)[0];
    picks.push({ officer, gain: null, fit: best ? { short: RATING_META.find((meta) => meta.key === best.key)?.short ?? best.key, value: best.value } : null });
  }
  const byName = (a: CoursePick, b: CoursePick) => a.officer.surname.localeCompare(b.officer.surname) || a.officer.id.localeCompare(b.officer.id);
  picks.sort((a, b) => {
    if (a.gain && b.gain) return b.gain.delta - a.gain.delta || a.gain.before - b.gain.before || byName(a, b);
    return (b.fit?.value ?? 0) - (a.fit?.value ?? 0) || byName(a, b);
  });
  return picks.slice(0, count);
}

/** "Medical: Thomas 41 to 44, Seo 48 to 51" or "Best placed: Lee, Awareness 74". The numbers are the
 * course data's own and the officers' own ratings. */
export function picksLine(picks: readonly CoursePick[]): string | null {
  if (picks.length === 0) return null;
  if (picks[0].gain) return `Most to gain: ${picks.map((p) => `${p.officer.surname} ${Math.round(p.gain!.before)} to ${Math.round(p.gain!.after)}`).join(', ')}`;
  return `Best placed: ${picks.map((p) => `${p.officer.surname}${p.fit ? `, ${p.fit.short} ${p.fit.value}` : ''}`).join(' · ')}`;
}

export interface CourseSplit {
  start: { course: Course; picks: CoursePick[] }[];
  later: { course: Course; gate: Exclude<CourseGate, { state: 'open' }> }[];
}

/** Courses that can start now (with who they would help), then courses that open later (with what they
 * wait for). Start-now courses someone could enrol in come first, in catalog order. */
export function splitCourses(game: GameState, courses: readonly Course[]): CourseSplit {
  const start: CourseSplit['start'] = [];
  const later: CourseSplit['later'] = [];
  for (const course of courses) {
    const gate = courseGate(game, course);
    if (gate.state === 'open') start.push({ course, picks: coursePicks(game, course) });
    else later.push({ course, gate });
  }
  start.sort((a, b) => Number(b.picks.length > 0) - Number(a.picks.length > 0));
  return { start, later };
}
