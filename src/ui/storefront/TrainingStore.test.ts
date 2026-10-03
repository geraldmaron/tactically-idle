import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COURSES } from '../../content/courses';
import { createInitialState } from '../../sim/department';
import { DEFAULT_NAV, NavContext, type NavApi } from '../components/nav';
import { TrainingOfficerCard, TrainingStore } from './TrainingStore';
import { trainingCandidates } from './training-officers';

const NOW = Date.UTC(2026, 9, 3, 12);
let state = createInitialState(NOW, 1);
vi.mock('../store', () => ({ useGame: () => state }));
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
});
