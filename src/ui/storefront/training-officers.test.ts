import { describe, expect, it } from 'vitest';
import { COURSES, COURSE_RATING_CEILING } from '../../content/courses';
import { createInitialState } from '../../sim/department';
import { courseOptions } from '../../sim/department-selectors';
import { trainingCandidates, trainingOfficerCondition, trainingRatingGain, trainingRatingKeys, trainingStrongestRatings } from './training-officers';

const NOW = Date.UTC(2026, 9, 3, 12);

describe('course-aware officer comparisons', () => {
  it('shows the real full gain near the enrolment cutoff, and no promised gain when ineligible at the cutoff', () => {
    const officer = createInitialState(NOW, 1).officers.off_chen;
    officer.ratings.communication = 84;
    expect(trainingRatingGain(COURSES.communication_refresher, officer)).toEqual({ key: 'communication', before: 84, after: 87, delta: 3 });
    for (const rating of [COURSE_RATING_CEILING, 96, 100]) {
      officer.ratings.communication = rating;
      expect(trainingRatingGain(COURSES.communication_refresher, officer)).toMatchObject({ before: rating, after: rating, delta: 0 });
    }
  });

  it('does not promise a rating gain for a certification', () => {
    const officer = createInitialState(NOW, 1).officers.off_chen;
    expect(trainingRatingGain(COURSES.drone_course, officer)).toBeNull();
    expect(trainingRatingKeys(COURSES.crisis_negotiation_course)).toEqual(['communication', 'composure']);
    expect(trainingRatingKeys(COURSES.first_aid_course)).toEqual(['medical', 'composure', 'coordination']);
  });

  it('includes the trained rating and only two or three actual ratings in every comparison', () => {
    const officer = createInitialState(NOW, 1).officers.off_chen;
    for (const course of Object.values(COURSES)) {
      const keys = trainingRatingKeys(course);
      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys.length).toBeLessThanOrEqual(3);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(officer.ratings[key]).toEqual(expect.any(Number));
      if (course.grants.rating) expect(keys).toContain(course.grants.rating.key);
    }
  });

  it('keeps every officer visible with the exact simulation eligibility and reason', () => {
    const state = createInitialState(NOW, 1);
    state.officers.off_chen.assignment = { kind: 'operation', runId: 'active-run' };
    state.officers.off_brooks.assignment = { kind: 'training', courseId: 'composure_workshop', startedAt: NOW, endsAt: NOW + 1000 };
    state.officers.off_ortiz.ratings.composure = COURSE_RATING_CEILING;
    state.department.funding = 0;
    const before = JSON.stringify(state);
    for (const course of Object.values(COURSES)) {
      const candidates = trainingCandidates(state, course.id);
      expect(candidates).toHaveLength(Object.keys(state.officers).length);
      for (const candidate of candidates) expect(candidate.option).toEqual(courseOptions(state, candidate.officer.id, NOW).find((option) => option.course.id === course.id));
    }
    expect(JSON.stringify(state)).toBe(before);
  });

  it('exposes already-qualified, rating cutoff, slot and funding refusals', () => {
    const state = createInitialState(NOW, 1);
    state.department.unlockedNodes.push('personnel_negotiation');
    expect(trainingCandidates(state, 'crisis_negotiation_course').find(({ officer }) => officer.id === 'off_chen')?.option.reason).toContain('already holds');
    state.officers.off_chen.ratings.communication = 85;
    expect(trainingCandidates(state, 'communication_refresher').find(({ officer }) => officer.id === 'off_chen')?.option.reason).toContain('course ceiling');
    state.department.trainingSlots = 0;
    expect(trainingCandidates(state, 'composure_workshop').every(({ option }) => option.reason === 'No free training slot')).toBe(true);
    state.department.trainingSlots = 1;
    state.department.funding = 0;
    expect(trainingCandidates(state, 'composure_workshop').every(({ option }) => option.reason?.includes('Needs $600'))).toBe(true);
  });

  it('shows current injury/deployment independently without inventing training restrictions', () => {
    const state = createInitialState(NOW, 1);
    const officer = state.officers.off_chen;
    officer.injury = { label: 'Shoulder strain', until: NOW + 1000 };
    expect(trainingOfficerCondition(officer, NOW)).toBe('Injured: Shoulder strain');
    expect(trainingCandidates(state, 'composure_workshop').find((candidate) => candidate.officer.id === officer.id)?.option.available).toBe(true);
    officer.assignment = { kind: 'operation', runId: 'active-run' };
    expect(trainingOfficerCondition(officer, NOW)).toBe('Deployed · Injured: Shoulder strain');
    expect(trainingCandidates(state, 'composure_workshop').find((candidate) => candidate.officer.id === officer.id)?.option.reason).toContain('deployed');
    officer.assignment = null;
    expect(trainingOfficerCondition(officer, NOW + 1000)).toBe('Ready');
  });

  it('reports strengths from actual ratings and supports an empty roster', () => {
    const state = createInitialState(NOW, 1);
    Object.assign(state.officers.off_chen.ratings, { communication: 99, composure: 98, coordination: 97 });
    expect(trainingStrongestRatings(state.officers.off_chen).map(({ key }) => key)).toEqual(['communication', 'composure']);
    state.officers = {};
    expect(trainingCandidates(state, 'composure_workshop')).toEqual([]);
  });
});
