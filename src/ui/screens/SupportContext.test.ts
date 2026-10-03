import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getScenario } from '../../sim/scenario-registry';
import { actionViews } from '../../sim/operation-selectors';
import { externalSupportViews } from '../../sim/external-support';
import type { ActionView } from '../../sim/types';
import type { ActionDefinition } from '../../sim/scenario-types';
import { makeState, NOW, startRun } from '../../sim/test-fixtures';
import { contextualSupportAction, IncidentBriefContext, SupportContext, supportStatusLine } from './SupportContext';

vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, createElement('button', { 'aria-label': 'Close' }, 'Close'), children, footer) : null }));
const noop = () => {};
const render = (node: ReactNode) => renderToStaticMarkup(node);
function fixture() {
  const state = startRun(makeState(), 'ms_occupancy', ['A']);
  const scenario = structuredClone(getScenario('ms_occupancy')!);
  scenario.briefing.dispatchReason = 'The first crew could not safely reach the resident.';
  scenario.briefing.teamResponsibilities = ['Check access and keep the route clear.', 'Stay with the resident until care is accepted.'];
  scenario.externalServices = [{ id: 'medics', label: 'City paramedic crew', kind: 'medical', description: 'Can receive the resident when access is ready.', available: true, arrivalMinutes: 6 }];
  const base = scenario.stages.assess.actions[0];
  const request: ActionDefinition = { ...base, id: 'request_medics', title: 'Request the paramedic crew', outcomes: { favorable: [{ requestSupport: ['medics'] }], mixed: [{ requestSupport: ['medics'] }], adverse: [{ requestSupport: ['medics'] }] } };
  const wait: ActionDefinition = { ...base, id: 'wait_medics', title: 'Keep the route clear while waiting', awaitSupport: 'medics' };
  const accept: ActionDefinition = { ...base, id: 'accept_medics', title: 'Complete the handover', outcomes: { favorable: [{ acceptSupport: ['medics'] }], mixed: [], adverse: [] } };
  scenario.stages.assess.actions = [request, wait, accept];
  const view = actionViews(state, NOW, 'A')[0];
  const actions: ActionView[] = [request, wait, accept].map((entry) => ({ ...view, id: entry.id, title: entry.title, eligible: true, reason: null }));
  return { scenario, run: state.activeRun!, actions };
}
function support(open = false) {
  const data = fixture();
  return { ...data, props: { ...data, open, onOpen: noop, onClose: noop, onPickAction: noop } };
}

describe('external service context beside the next decision', () => {
  it('keeps unrequested, waiting, available and accepted states distinct with actual operation-time ETA', () => {
    const { scenario, run } = fixture();
    expect(supportStatusLine(externalSupportViews(scenario, run)[0])).toBe('Not requested');
    run.externalSupport = { medics: { requestedAt: 2, availableAt: 8, acceptedAt: null } };
    run.clock = 3.5;
    expect(supportStatusLine(externalSupportViews(scenario, run)[0])).toBe('Requested · waiting 4.5 min');
    run.clock = 8;
    expect(supportStatusLine(externalSupportViews(scenario, run)[0])).toBe('Available · awaiting acceptance');
    run.externalSupport.medics.acceptedAt = 10;
    run.clock = 10;
    expect(supportStatusLine(externalSupportViews(scenario, run)[0])).toBe('Accepted');
  });

  it('keeps the named-service status compact and details closed until requested', () => {
    const { props } = support();
    const html = render(createElement(SupportContext, props));
    expect(html).toContain('City paramedic crew');
    expect(html).toContain('Not requested');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('Expected response:');
    expect(html).not.toContain('The first crew');
  });

  it('opens the actual authored request, wait or acceptance choice without introducing another command', () => {
    const { scenario, run, actions } = fixture();
    expect(contextualSupportAction(scenario, actions, externalSupportViews(scenario, run)[0])?.id).toBe('request_medics');
    run.externalSupport = { medics: { requestedAt: 2, availableAt: 8, acceptedAt: null } };
    run.clock = 3.5;
    expect(contextualSupportAction(scenario, actions, externalSupportViews(scenario, run)[0])?.id).toBe('wait_medics');
    run.clock = 8;
    expect(contextualSupportAction(scenario, actions, externalSupportViews(scenario, run)[0])?.id).toBe('accept_medics');
    const hidden = actions.filter((action) => action.id !== 'accept_medics');
    expect(contextualSupportAction(scenario, hidden, externalSupportViews(scenario, run)[0])).toBeNull();
    run.externalSupport.medics.acceptedAt = 10;
    expect(contextualSupportAction(scenario, actions, externalSupportViews(scenario, run)[0])).toBeNull();
  });

  it('finds the authored continuation when help was requested earlier but care arrangements are not open yet', () => {
    const { scenario, run, actions } = fixture();
    const original = scenario.stages.assess.actions[0];
    scenario.stages.assess.actions = [{ ...original, id: 'continue_care', requires: { externalSupport: [{ serviceId: 'medics', status: 'requested', reason: 'Request the crew first' }] }, outcomes: { favorable: [], mixed: [], adverse: [] } }];
    run.externalSupport = { medics: { requestedAt: 2, availableAt: 8, acceptedAt: null } };
    run.clock = 9;
    const visible = [{ ...actions[0], id: 'continue_care', title: 'Continue the care plan' }];
    expect(contextualSupportAction(scenario, visible, externalSupportViews(scenario, run)[0])?.id).toBe('continue_care');
  });

  it('provides dispatch context, concrete responsibilities, action review and a way back', () => {
    const { props } = support(true);
    const html = render(createElement(SupportContext, props));
    for (const text of ['Why your team was requested', 'The first crew could not safely reach the resident.', 'Your team’s responsibilities', 'Stay with the resident until care is accepted.', 'Response times use operation minutes.', 'Expected response: 6 min after your request.', 'Review: Request the paramedic crew', 'Back to decisions', 'aria-label="Close"']) expect(html).toContain(text);
    expect(html).not.toContain('Confirm:');
  });

  it('explains a blocked contextual choice while keeping it reviewable', () => {
    const { props } = support(true);
    props.actions[0].eligible = false;
    props.actions[0].reason = 'Confirm where the resident is first';
    const html = render(createElement(SupportContext, props));
    expect(html).toContain('Review: Request the paramedic crew');
    expect(html).toContain('Confirm where the resident is first');
    expect(html).not.toContain('disabled');
  });

  it('does not create support mechanics or alter briefing text for legacy scenarios', () => {
    const { props } = support();
    props.scenario = getScenario('ms_occupancy')!;
    expect(render(createElement(SupportContext, props))).toBe('');
    expect(render(createElement(IncidentBriefContext, { scenario: props.scenario }))).toBe('');
  });

  it('never claims an unavailable response is on its way', () => {
    const { props } = support(true);
    props.scenario.externalServices![0].available = false;
    const html = render(createElement(SupportContext, props));
    expect(html).toContain('No response available');
    expect(html).not.toContain('Expected response:');
    expect(html).not.toContain('Review: Request');
    expect(html).not.toContain('on its way');
  });
});
