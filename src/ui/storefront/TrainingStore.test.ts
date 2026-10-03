import { createElement, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COURSES } from '../../content/courses';
import { createInitialState } from '../../sim/department';
import { dispatch } from '../../sim/game';
import { HOUR_MS } from '../../sim/economy';
import { DEFAULT_NAV, NavContext, type NavApi } from '../components/nav';
import { TrainingEnrolmentActions, TrainingEnrolmentReceipt, TrainingOfficerCard, TrainingStore } from './TrainingStore';
import { trainingCandidates } from './training-officers';

const NOW = Date.UTC(2026, 9, 3, 12);
let state = createInitialState(NOW, 1);
vi.mock('../store', () => ({ useGame: () => state, getState: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
beforeEach(() => { state = createInitialState(NOW, 1); });

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
    expect(html).toContain('+3 Communication · enrol below 85');
    expect(html).toContain('$600');
    expect(html).toContain('4h');
    expect(html).toContain('+20 XP on completion');
    expect(html).toContain('+50 XP on completion');
    expect(html).toContain('Earn Drone operator');
  });

  it('preserves an officer deep link as a portrait summary and a course-specific preview', () => {
    state.officers.off_chen.ratings.communication = 84;
    const html = markup(createElement(TrainingStore), { trainingRequest: 3, trainingFocus: { officerId: 'off_chen', courseId: 'communication_refresher' } });
    expect(html).toContain('data-training-officer-id="off_chen"');
    expect(html).toContain('data-portrait=');
    expect(html).toContain('Highest ratings:');
    expect(html).toContain('Stress');
    expect(html).not.toContain('Readiness');
    expect(html).toContain('Direct course gain');
    expect(html).toContain('Comms: 84 → 87');
    expect(html).toContain('+3 on completion');
    expect(html).not.toContain('data-course-id="drone_course"');
  });

  it('shows unavailable officers with actual ratings and reasons, without an enabled Select', () => {
    state.officers.off_chen.assignment = { kind: 'operation', runId: 'run-1' };
    state.officers.off_chen.injury = { label: 'Shoulder strain', until: NOW + 1000 };
    const candidate = trainingCandidates(state, 'communication_refresher').find(({ officer }) => officer.id === 'off_chen')!;
    const html = markup(createElement(TrainingOfficerCard, { candidate, now: NOW, onSelect: vi.fn() }));
    expect(html).toContain('data-training-candidate="off_chen"');
    expect(html).toContain('data-portrait=');
    expect(html).toContain('Deployed · Injured: Shoulder strain');
    expect(html).toContain('Current relevant ratings');
    expect(html).toContain('Mei Chen is deployed');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Select Mei Chen for Communication refresher');
  });

  it('distinguishes an existing certificate from a missing prerequisite', () => {
    state.department.unlockedNodes.push('personnel_negotiation', 'field_specialist_response');
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
    expect([...empty.matchAll(/disabled=""/g)]).toHaveLength(Object.keys(COURSES).length);
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
    expect(html).toContain('$600 funding paid');
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
    expect(html).toContain('Drone operator licence');
    expect(html).toContain('No longer on the roster');
    expect(html).toContain('Earn Drone operator');
    expect(html).toContain('+50 XP');
    expect(html).not.toContain('Course completed');
  });
});
