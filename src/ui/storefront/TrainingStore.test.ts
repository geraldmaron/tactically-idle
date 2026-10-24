import { createElement, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COURSES } from '../../content/courses';
import { establishedDepartment } from '../../sim/department-test-fixtures';
import { dispatch } from '../../sim/game';
import { HOUR_MS } from '../../sim/economy';
import { DEFAULT_NAV, NavContext, type NavApi } from '../components/nav';
import { TrainingEnrolmentActions, TrainingEnrolmentReceipt, TrainingOfficerCard, TrainingPlaces, TrainingStore, sharedHoldBack } from './TrainingStore';
import { trainingCandidates } from './training-officers';
import { splitCourses } from './training-picks';

const NOW = Date.UTC(2026, 9, 3, 12);
let state = establishedDepartment(NOW, 1);
vi.mock('../store', () => ({ useGame: () => state, getState: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('../components/Beat', () => ({ useBeat: () => ({ play: vi.fn(), act: vi.fn() }) }));
beforeEach(() => { state = establishedDepartment(NOW, 1); });

function markup(child: ReactNode, nav: Partial<NavApi> = {}) {
  return renderToStaticMarkup(createElement(NavContext.Provider, { value: { ...DEFAULT_NAV, ...nav } }, child));
}

describe('course-first Training presentation', () => {
  it('shows the course catalogue, gains, price and time before asking for an officer', () => {
    const html = markup(createElement(TrainingStore));
    expect(html).not.toContain('<select');
    expect(html).not.toContain('Enrol officer');
    expect([...html.matchAll(/data-course-id=/g)]).toHaveLength(Object.keys(COURSES).length);
    expect(html).toContain('Choose officer for Communication refresher');
    expect(html).toContain('+3 Communication');
    expect(html).toContain('For ratings under 85');
    expect(html).toContain('600');
    expect(html).toContain('4h');
    expect(html).toContain('+20 XP');
    expect(html).toContain('0 of 1 training places in use');
    expect(html).toContain('Earns Drone operator');
  });

  it('splits Start now from Opens later, and a course that is not open never offers Choose officer', () => {
    const html = markup(createElement(TrainingStore));
    const { start, later } = splitCourses(state, Object.values(COURSES));
    expect(start.length).toBeGreaterThan(0);
    expect(later.length).toBeGreaterThan(0);
    expect(html.indexOf('Start now')).toBeGreaterThan(-1);
    expect(html.indexOf('Start now')).toBeLessThan(html.indexOf('Opens later'));
    for (const { course } of later) {
      expect(html).not.toContain(`Choose officer for ${course.name}`);
      expect(html).toContain(`aria-label="${course.name}, opens later"`);
    }
    for (const { course } of start) expect(html).toContain(`Choose officer for ${course.name}`);
    // A locked course teases what it needs and links to the Build room that opens it.
    expect(html).toContain('Opens with Negotiation training in Build');
    expect(html).toContain('View development program for Crisis negotiation');
    expect(html).toContain('Open in Build');
  });

  it('shows the two officers an open course would help most, with the course data’s own gains', () => {
    const html = markup(createElement(TrainingStore));
    expect(html).toContain('Most to gain:');
    expect(html).toMatch(/Review [A-Z][^"]+ for Communication refresher/);
  });

  it('says so when an open course has nobody free to take it', () => {
    Object.values(state.officers).forEach((o) => { o.assignment = { kind: 'operation', runId: 'run-1' }; });
    const html = markup(createElement(TrainingStore));
    expect(html).toContain('Nobody is free to take this now.');
    expect(html).not.toContain('Most to gain:');
  });

  it('preserves an officer deep link as a portrait summary and a course-specific preview', () => {
    state.officers.off_chen.ratings.communication = 84;
    const html = markup(createElement(TrainingStore), { trainingRequest: 3, trainingFocus: { officerId: 'off_chen', courseId: 'communication_refresher' } });
    expect(html).toContain('data-training-officer-id="off_chen"');
    expect(html).toContain('data-portrait=');
    expect(html).toContain('Highest ratings:');
    expect(html).toContain('Stress');
    expect(html).not.toContain('Readiness');
    expect(html).toContain('For Mei');
    expect(html).toContain('Communication: 84 → 87');
    expect(html).not.toContain('data-course-id="drone_course"');
  });

  it('says once that the chosen officer is already in training, on the officer and not on every course', () => {
    state.officers.off_chen.assignment = { kind: 'training', courseId: 'communication_refresher', startedAt: NOW, endsAt: NOW + 4 * HOUR_MS };
    const html = markup(createElement(TrainingStore), { trainingRequest: 4, trainingFocus: { officerId: 'off_chen' } });
    expect(html).toContain('In training');
    expect(html).not.toContain('Mei Chen is already in training');
  });

  it('hoists only a reason that names the officer and repeats; course reasons stay on their cards', () => {
    expect(sharedHoldBack(['Mei Chen is deployed', 'Mei Chen is deployed', null], 'Mei Chen')).toBe('Mei Chen is deployed');
    expect(sharedHoldBack(['Mei Chen is deployed', null], 'Mei Chen')).toBeNull();
    expect(sharedHoldBack(['No free training slot', 'No free training slot'], 'Mei Chen')).toBeNull();
    expect(sharedHoldBack(['Needs $600 (have $0)', 'Needs $600 (have $0)'], 'Mei Chen')).toBeNull();
  });

  it('labels the training places in words, for the eye and for assistive technology', () => {
    const html = markup(createElement(TrainingPlaces, { used: 1, total: 2 }));
    expect(html).toContain('>Training places<');
    expect(html).toContain('aria-label="1 of 2 training places in use"');
  });

  it('shows unavailable officers with actual ratings and reasons, without an enabled Select', () => {
    state.officers.off_chen.assignment = { kind: 'operation', runId: 'run-1' };
    state.officers.off_chen.injury = { label: 'Shoulder strain', until: NOW + 1000 };
    state.officers.off_chen.ratings.communication = 70;
    const candidate = trainingCandidates(state, 'communication_refresher').find(({ officer }) => officer.id === 'off_chen')!;
    const html = markup(createElement(TrainingOfficerCard, { candidate, now: NOW, onSelect: vi.fn() }));
    expect(html).toContain('data-training-candidate="off_chen"');
    expect(html).toContain('data-portrait=');
    expect(html).toContain('Deployed · Injured: Shoulder strain');
    expect(html).toContain('Current relevant ratings');
    // Relevant ratings are bars; an unavailable officer still sees the projected course gain.
    expect(html).toContain('Communication 70 of 100, 73 after');
    expect(html).toContain('Mei Chen is deployed');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Select Mei Chen for Communication refresher');
  });

  it('distinguishes an existing certificate from a missing prerequisite', () => {
    state.department.unlockedNodes.push('personnel_negotiation', 'field_specialist_response');
    for (const id of state.department.unlockedNodes) state.department.developmentTiers[id] ??= 1;
    const certified = trainingCandidates(state, 'crisis_negotiation_course').find(({ officer }) => officer.id === 'off_chen')!;
    const certifiedHtml = markup(createElement(TrainingOfficerCard, { candidate: certified, now: NOW, onSelect: vi.fn() }));
    expect(certifiedHtml).toContain('Already certified: Crisis negotiation');
    expect(certifiedHtml).toContain('already holds this certification');
    const missing = trainingCandidates(state, 'precision_support_course').find(({ officer }) => officer.id === 'off_chen')!;
    expect(markup(createElement(TrainingOfficerCard, { candidate: missing, now: NOW }))).toContain('Entry team (needed)');
  });

  it('keeps an empty roster and no search results explicit', () => {
    state.officers = {};
    const empty = markup(createElement(TrainingStore));
    expect(empty).toContain('No officers to train');
    expect([...empty.matchAll(/disabled=""/g)]).toHaveLength(splitCourses(state, Object.values(COURSES)).start.length);
    const noResults = markup(createElement(TrainingStore), { trainingDraft: { officerId: '', search: 'no-such-course' } });
    expect(noResults).toContain('No courses match');
    expect(noResults).toContain('Show all training');
  });

  it('keeps the old Enrol hit area inert and lets an intentional Done or keyboard activation dismiss the receipt', () => {
    const onDone = vi.fn();
    const actions = TrainingEnrolmentActions({ course: COURSES.composure_workshop, onDone });
    const buttons = actions.props.children[1].props.children as ReactElement<ComponentProps<'button'>>[];
    expect(buttons[1].props.disabled).toBe(true);
    expect(buttons[1].props.onClick).toBeUndefined();
    const click = (detail: number) => buttons[0].props.onClick?.({ detail } as MouseEvent<HTMLButtonElement>);
    click(2); click(3);
    expect(onDone).not.toHaveBeenCalled();
    click(1);
    expect(onDone).toHaveBeenCalledOnce();
    click(0);
    expect(onDone).toHaveBeenCalledTimes(2);
    const html = markup(actions);
    expect(html).toContain('training-confirm-actions');
    expect(html).toContain('disabled="">Enrolled</button>');
    expect(html).toContain('600 funding paid');
    expect(html).not.toContain('Enrol officer');
  });

  it('shows the named course, real remaining training time and pending benefit without granting it early', () => {
    const course = COURSES.composure_workshop;
    const before = state.officers.off_chen.ratings.composure;
    const originalXp = state.officers.off_chen.xp;
    const started = dispatch(state, { type: 'startCourse', officerId: 'off_chen', courseId: course.id }, { now: NOW });
    expect(started.result.ok).toBe(true);
    state = started.state;
    const officer = state.officers.off_chen;
    const assignment = officer.assignment!;
    if (assignment.kind !== 'training') throw new Error('Expected a real training assignment');
    const enrolment = { officerName: 'Mei Chen', startedAt: assignment.startedAt, endsAt: assignment.endsAt };
    const html = markup(createElement(TrainingEnrolmentReceipt, { course, enrolment, officer, now: NOW + HOUR_MS }));
    expect(html).toContain('Mei Chen');
    expect(html).toContain('Composure workshop');
    expect(html).toContain('In training · 3h remaining');
    expect(html).toContain('On completion');
    expect(html).toContain('+3 Composure');
    expect(html).toContain('+20 XP');
    expect(html).not.toContain('Can enrol');
    expect(html).not.toContain('already in training');
    expect(officer.ratings.composure).toBe(before);
    expect(officer.xp).toBe(originalXp);

    state = dispatch(state, { type: 'tick' }, { now: assignment.endsAt }).state;
    const completed = markup(createElement(TrainingEnrolmentReceipt, { course, enrolment, officer: state.officers.off_chen, now: state.department.clockHighWater }));
    expect(completed).toContain('Course completed');
    expect(completed).toContain('Course gains and XP have been applied');
    expect(completed).not.toContain('In training');
    expect(completed).not.toContain('Can enrol');
    const completedState = structuredClone(state);
    // Reopening a completed receipt is presentation only, including after the course finishes.
    markup(createElement(TrainingEnrolmentReceipt, { course, enrolment, officer: state.officers.off_chen, now: state.department.clockHighWater }));
    expect(state).toEqual(completedState);
    expect(state.officers.off_chen.ratings.composure).toBe(before + 3);
  });

  it('shows certification benefits and does not claim a missing officer completed their course', () => {
    const course = COURSES.drone_course;
    const enrolment = { officerName: 'Mei Chen', startedAt: NOW, endsAt: NOW + 10 * HOUR_MS };
    const html = markup(createElement(TrainingEnrolmentReceipt, { course, enrolment, now: enrolment.endsAt }));
    expect(html).toContain('Mei Chen');
    expect(html).toContain('Drone operator license');
    expect(html).toContain('No longer on the roster');
    expect(html).toContain('Earn Drone operator');
    expect(html).toContain('+50 XP');
    expect(html).not.toContain('Course completed');
  });
});
