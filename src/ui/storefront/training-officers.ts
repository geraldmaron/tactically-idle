import { COURSE_RATING_CEILING, courseRatingAfter } from '../../content/courses';
import { courseOptions, type CourseOption } from '../../sim/department-selectors';
import { stressBand } from '../../sim/officer';
import type { CertId, Course, GameState, Officer, RatingKey } from '../../sim/types';
import { BAND_SHORT, RATING_META } from '../components/labels';

// These are comparison context, never eligibility rules or a fitness score.
// Contact, entry and medical checks use these ratings in the authored scenarios;
// capability exercises also use coordination/composure for specialist work.
const CERT_RATINGS: Record<CertId, RatingKey[]> = {
  crisis_negotiation: ['communication', 'composure'],
  deescalation: ['communication', 'composure'],
  entry_team: ['coordination', 'shooting', 'composure'],
  advanced_first_aid: ['medical', 'composure', 'coordination'],
  surveillance: ['awareness', 'coordination', 'composure'],
  drone_operator: ['awareness', 'coordination', 'composure'],
  less_lethal: ['coordination', 'composure'],
  advanced_less_lethal: ['coordination', 'composure'],
  vehicle_operations: ['coordination', 'composure'],
  precision_support: ['coordination', 'composure'],
  controlled_access: ['coordination', 'composure'],
};

export function trainingRatingKeys(course: Course): RatingKey[] {
  if (course.grants.rating) {
    return [...new Set<RatingKey>([course.grants.rating.key, 'composure', 'coordination'])].slice(0, 3);
  }
  return course.grants.cert ? CERT_RATINGS[course.grants.cert] : ['coordination', 'composure'];
}

export function trainingRatingGain(course: Course, officer: Officer) {
  const grant = course.grants.rating;
  if (!grant) return null;
  const before = officer.ratings[grant.key];
  // An existing higher rating must never be displayed as a downgrade.
  const after = before >= COURSE_RATING_CEILING ? before : courseRatingAfter(before, grant.delta);
  return { key: grant.key, before, after, delta: after - before };
}

export function trainingOfficerCondition(officer: Officer, now: number): string {
  const conditions: string[] = [];
  if (officer.assignment?.kind === 'operation') conditions.push('Deployed');
  if (officer.assignment?.kind === 'training') conditions.push('In training');
  if (officer.injury && officer.injury.until > now) conditions.push(`Injured: ${officer.injury.label}`);
  if (!conditions.length) conditions.push(BAND_SHORT[stressBand(officer.stress)]);
  return conditions.join(' · ');
}

/** Highest ratings first; ties keep the usual skill order. */
export function trainingStrongestRatings(officer: Pick<Officer, 'ratings'>, count = 2) {
  return [...RATING_META].sort((a, b) => officer.ratings[b.key] - officer.ratings[a.key]).slice(0, count);
}

export interface TrainingCandidate {
  officer: Officer;
  option: CourseOption;
}

/** Keep all officers visible and names stable; eligibility comes from the simulation. */
export function trainingCandidates(game: GameState, courseId: string): TrainingCandidate[] {
  return Object.values(game.officers)
    .sort((a, b) => a.surname.localeCompare(b.surname) || a.id.localeCompare(b.id))
    .flatMap((officer) => {
      const option = courseOptions(game, officer.id, game.department.clockHighWater).find((item) => item.course.id === courseId);
      return option ? [{ officer, option }] : [];
    });
}
