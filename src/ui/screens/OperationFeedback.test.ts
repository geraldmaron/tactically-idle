import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ActionView, DebriefResult, DecisionView } from '../../sim/types';
import { apply, makeState, NOW, startRun } from '../../sim/test-fixtures';
import { actionViews, currentBuilt, decisionViews, pendingDebrief, previewAction, spaceViews, stageProgress } from '../../sim/operation-selectors';
import { planActionResupply } from '../../sim/equipment-resupply';
import { ActionSheet, LiveView, type LiveViewProps } from './LiveView';
import { DecisionCard, OperationFeedback, OperationLogContents, OutcomeForecast } from './OperationFeedback';
import { OpsDebrief, SavedDebriefContents, SavedDebriefReview } from './OpsDebrief';
import { Debriefs } from './HQ';
import { generateIncident } from '../../gen/incident';
import { outcomePercentages, visibleDecisions } from './liveModels';

let state = makeState();
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
// SSR cannot use a portal. Preserve the sheet's title, region/dialog semantics and pinned footer.
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer, modal = true, className }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode; modal?: boolean; className?: string }) => open ? createElement('section', { role: modal ? 'dialog' : 'region', 'aria-label': title, className }, createElement('h2', null, title), children, createElement('footer', null, footer)) : null }));
const noop = () => {};
const render = (node: ReactNode) => renderToStaticMarkup(node);
const action = (patch: Partial<ActionView> = {}): ActionView => ({
  id: 'treat', stage: 'adapt', title: 'Prepare medical access', icon: 'medic', summary: 'Keep access open while preparing aid.', requirementLine: 'Qualified medic + trauma supplies',
  actingSquadIds: ['A'], supportSquadIds: [], officerIds: ['off_ortiz'], targetId: null, eligible: true, reason: null, risk: 'low',
  timeCost: 5, timeRange: { min: 4, max: 8 }, likelihood: { favorable: .73, mixed: .19, adverse: .08 }, consequenceLevel: 'high',
  outcomePreview: { favorable: 'Prepare aid without losing access.', mixed: 'Aid takes longer and pressure rises.', adverse: 'Medical access remains unresolved.' }, suppliesRequired: [{ label: 'Trauma supplies', qty: 1 }],
  contributors: [], uncertainty: ['Patient condition is unconfirmed.'], details: [], overlays: [], ...patch,
});
const decision = (patch: Partial<DecisionView> = {}): DecisionView => ({
  revision: 1, actionId: 'treat', title: 'Prepare medical access', stageLabel: 'Adapt', band: 'mixed',
  timeCost: 8, objectiveDelta: 12, civilianSafetyDelta: -4, pressureDelta: 5, actualStressDeltas: true,
  stressDeltas: [{ officerId: 'off_ortiz', label: 'Ortiz', delta: 3 }, { officerId: 'off_chen', label: 'Chen', delta: 1.5 }],
  supplies: [{ itemId: 'trauma_kit', label: 'Trauma supplies', qty: 1 }], knowledgeChanges: [{ factId: 'patient', label: 'Patient condition', status: 'confirmed' }],
  contributors: [{ source: 'rating', label: 'Ortiz medical rating', value: 12, ref: 'off_ortiz' }],
  consequences: ['The patient received aid, but the route is still unresolved.', 'The delay leaves the squad with less time.', 'Next: choose how to preserve access.'],
  explanation: ['The patient received aid, but the route is still unresolved.', 'Pressure reduced the margin.'], endingTitle: null, ...patch,
});
function sheet(view: ActionView, all = [view]) {
  return createElement(ActionSheet, { open: true, onClose: noop, view, all, onPick: noop, squads: makeState().squads, acting: ['A'], support: [], onToggleActing: noop, onToggleSupport: noop, targetLabel: null, onConfirm: noop });
}
function liveProps(actions: ActionView[], selectedAction = actions[0]): LiveViewProps {
  const g = startRun(makeState(), 'ms_occupancy', ['A']);
  return { g, now: NOW, title: 'Operation test', subtitle: 'RESIDENTIAL', practice: false, progress: { ...stageProgress(g), prompt: 'How will you verify the report before committing?' }, built: currentBuilt(g)!, spaces: spaceViews(g), squadTasks: g.activeRun!.squadTasks, deployedSquads: [g.squads[0]], focusSquadId: 'A', onFocusSquad: noop, officers: [], actions, selectedAction, onSelectAction: noop, activeOfficerId: null, onSelectOfficer: noop, selectedSpaceId: null, onSelectSpace: noop, highlightSpaceIds: [], floor: 0, onFloorChange: noop, environment: null, lastChange: null, showRooms: true, onToggleRooms: noop, clock: 0, pressure: 15, canCancel: true, onCancel: noop, onOpenDetails: noop, detailsOpen: false };
}

describe('reviewing a decision', () => {
  it('separates high consequence severity from a favorable forecast and preserves authored possibilities', () => {
    const html = render(createElement(OutcomeForecast, { action: action() }));
    expect(html).toContain('73% chance');
    expect(html).toContain('19% chance');
    expect(html).toContain('8% chance');
    expect(html).toContain('Possible harm: high');
    expect(html).toContain('Prepare aid without losing access.');
    expect(html).toContain('Medical access remains unresolved.');
    expect(html).toContain('Even when a choice goes well, there may be more work to do');
    expect(html).not.toContain('Low risk');
  });

  it('shows public duration bounds and exact supplies before the primary confirmation', () => {
    const html = render(sheet(action()));
    expect(html).toContain('Estimated time: 5 min');
    expect(html).toContain('4–8 min depending on the result.');
    expect(html).toContain('Supplies used when confirmed');
    expect(html).toContain('1 × Trauma supplies');
    expect(html.indexOf('1 × Trauma supplies')).toBeLessThan(html.indexOf('Confirm: Prepare medical access'));
    expect(html).toContain('<footer><div class="operation-commit">');
    expect(html).toContain('btn-primary');
    expect(html).toContain('role="region"');
  });

  it('keeps locked actions inspectable, explains the blocker and offers an available alternative', () => {
    const locked = action({ eligible: false, reason: 'Needs a qualified medic — Squad A has none' });
    const alternative = action({ id: 'wait', title: 'Reassess the report', suppliesRequired: [] });
    const html = render(sheet(locked, [locked, alternative]));
    expect(html).toContain('Needs a qualified medic — Squad A has none');
    expect(html).toContain('Available now: Reassess the report');
    expect(html).toMatch(/<button[^>]+disabled=""[^>]*>Confirm: Prepare medical access/);
    expect(html).toContain('Check what is missing to see the chances for this choice.');
    expect(html).not.toContain('% chance');
  });

  it('keeps the authored stage prompt and all five contextual choices visible', () => {
    const choices = Array.from({ length: 5 }, (_, index) => action({ id: `choice_${index}`, title: `Decision ${index + 1}` }));
    const html = render(createElement(LiveView, liveProps(choices)));
    expect(html).toContain('How will you verify the report before committing?');
    for (let index = 1; index <= 5; index++) expect(html).toContain(`aria-label="Review Decision ${index}"`);
    expect(html).not.toContain('Show all');
    expect(html).toContain('73% chance to go well');
    expect(html).toContain('possible harm: high');
  });

  it('keeps exact owned equipment and delivery consequences in the locked action sheet', () => {
    const g = startRun(makeState(), 'ms_occupancy', ['A'], { loadouts: { A: {} } });
    const view = previewAction(g, NOW, 'ms_contact_hall', ['A'], [])!;
    const resupply = planActionResupply(g, NOW, view.id, ['A'], []);
    expect(resupply.ok).toBe(true);
    const html = render(createElement(ActionSheet, { ...sheet(view).props, resupply, onResupply: noop }));
    expect(html).toContain('Equipment from stores');
    expect(html).toContain(`Squad A: Throw phone · ${resupply.items[0].serial}`);
    expect(html).toContain('Equip Throw phone · +3 min');
    expect(html).toContain('You can no longer cancel after delivery.');
    expect(html).toMatch(/<button[^>]+disabled=""[^>]*>Confirm:/);
  });

  it('does not present equipment delivery as a solution to a missing qualification', () => {
    const g = startRun(makeState(), 'ms_occupancy', ['A'], { loadouts: { A: {} } });
    g.officers.off_chen.certs = [];
    const view = previewAction(g, NOW, 'ms_contact_hall', ['A'], [])!;
    const resupply = planActionResupply(g, NOW, view.id, ['A'], []);
    expect(resupply.ok).toBe(false);
    const html = render(createElement(ActionSheet, { ...sheet(view).props, resupply, onResupply: noop }));
    expect(html).toContain('Equipment alone');
    expect(html).toContain('crisis negotiator');
    expect(html).not.toContain('Equip Throw phone');
  });

  it('uses the recomputed selected squad forecast instead of stale default odds', () => {
    const base = action();
    const selected = action({ likelihood: { favorable: .9, mixed: .08, adverse: .02 }, timeCost: 3 });
    const html = render(createElement(LiveView, liveProps([base], selected)));
    expect(html).toContain('90% chance to go well');
    expect(html).not.toContain('73% chance to go well');
    expect(html).toContain('~3 min');
  });
});

describe('persistent decision results', () => {
  it('keeps actual changes and specific consequences visible after the toast is gone', () => {
    const html = render(createElement(OperationFeedback, { decisions: [decision()], practice: false }));
    for (const expected of ['Last decision', 'Had complications', 'The patient received aid, but the route is still unresolved.', '+8 min', 'Call progress', '+12', 'Civilian safety', '-4', 'Pressure', '+5', 'Officer stress', '+1.5 stress', '1 × Trauma supplies', 'Patient condition: Confirmed', 'Decision log (1)']) expect(html).toContain(expected);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });

  it('retains every decision, explanation, officer and contributor in the full log', () => {
    const last = decision({ revision: 2, title: 'Preserve access', band: 'favorable', endingTitle: 'Assistance completed' });
    const html = render(createElement(OperationLogContents, { decisions: [decision(), last], practice: false }));
    expect(html).toContain('2 decisions, in order');
    expect(html.indexOf('Decision 1')).toBeLessThan(html.indexOf('Decision 2'));
    for (const expected of ['Ortiz', '+3 stress', 'Chen', '+1.5 stress', 'The delay leaves the squad with less time.', 'Pressure reduced the margin.', 'Ortiz medical rating', 'Operation ended:', 'Assistance completed']) expect(html).toContain(expected);
  });

  it('distinguishes zero changes and older recorded strain from exact new stress deltas', () => {
    const html = render(createElement(DecisionCard, { decision: decision({ actualStressDeltas: false, stressDeltas: [], supplies: [], knowledgeChanges: [] }) }));
    expect(html).toContain('Recorded strain');
    expect(html).toContain('No change');
    expect(html).toContain('Nothing new confirmed');
    expect(html).toContain('Older record: strain may differ from the applied change.');
    expect(html).not.toContain('Officer stress');
  });

  it('shows no empty feedback panel before the first decision', () => {
    expect(render(createElement(OperationFeedback, { decisions: [], practice: false }))).toBe('');
  });

  it('renders the ending summary and preserves the saved log in the real debrief', () => {
    const scenario = generateIncident({ type: 'welfare_check', familyId: 'cedar_close', buildingSeed: 7, seed: 3, tier: 1, contentVersion: 3 });
    state = startRun(makeState(), scenario.id, ['A'], { practice: true });
    for (let step = 0; step < 12 && state.activeRun?.status === 'active'; step++) {
      const chosen = actionViews(state, NOW, 'A').find((view) => view.eligible)!;
      const result = apply(state, { type: 'decide', actionId: chosen.id, actingSquadIds: chosen.actingSquadIds, supportSquadIds: chosen.supportSquadIds });
      expect(result.result.ok).toBe(true);
      state = result.state;
    }
    const debrief = pendingDebrief(state)!;
    expect(debrief).not.toBeNull();
    const html = render(createElement(OpsDebrief));
    expect(html).toContain(debrief.endingTitle);
    expect(debrief.endingSummary).toBeTruthy();
    expect(html).toContain(debrief.endingSummary);
    expect(html).toContain(`Decision log (${decisionViews(state).length})`);
    expect(html).toContain('Close debrief');
    expect(html).not.toContain('Battery pack');
    const closed = apply(state, { type: 'closeDebrief' });
    expect(closed.result.ok).toBe(true);
    expect(closed.state.activeRun).toBeNull();
    const saved = closed.state.debriefs[0];
    expect(saved.decisions).toHaveLength(debrief.decisions!.length);
    const review = render(createElement(SavedDebriefReview, { debrief: saved, officers: closed.state.officers, onClose: noop }));
    expect(review).toContain(saved.endingSummary);
    expect(review).toContain(`${saved.decisions!.length} decisions`);
    expect(review).toContain('Return to HQ');
    expect(review).toContain('role="dialog"');
    const hq = render(createElement(Debriefs, { g: closed.state, now: NOW }));
    expect(hq).toContain('Review result');
    expect(hq).toContain(`aria-label="Review result: ${saved.endingTitle}"`);
  });
});

describe('saved result review', () => {
  const saved: DebriefResult = { runId: 'run_older', scenarioId: 'ms_occupancy', endingId: 'old', endingTitle: 'Assistance completed', practice: false, objective: { score: 75, label: 'Completed' }, civilianSafety: { score: 88, label: 'Safe' }, officerCondition: [], informationPreserved: [], resources: [{ itemId: 'battery_pack', used: 1, returned: 0 }], unitWear: [], trustDelta: 2, fundingReward: 100, devPointReward: 1, causes: ['The squad verified the report.'] };
  it('shows old saved totals and causes without inventing a per-decision log', () => {
    const html = render(createElement(SavedDebriefContents, { debrief: saved, officers: {} }));
    expect(html).toContain('75/100');
    expect(html).toContain('88/100');
    expect(html).toContain('The squad verified the report.');
    expect(html).toContain('No per-decision log is stored for this operation.');
    expect(html).not.toContain('committed decisions');
    expect(html).not.toContain('Battery pack');
  });
  it('never borrows another operation’s history when reopening a saved result', () => {
    const html = render(createElement(SavedDebriefContents, { debrief: { ...saved, decisions: [decision({ title: 'Saved original choice' })] }, officers: {} }));
    expect(html).toContain('Saved original choice');
    expect(html).toContain('1 decision');
    expect(html).not.toContain('No per-decision log');
  });
});

describe('decision display models', () => {
  it('keeps rounded percentages consistent without changing engine likelihoods', () => {
    for (const likelihood of [{ favorable: 1 / 3, mixed: 1 / 3, adverse: 1 / 3 }, { favorable: .0001, mixed: .9998, adverse: .0001 }, { favorable: .73, mixed: .19, adverse: .08 }]) {
      const before = { ...likelihood };
      const rounded = outcomePercentages(likelihood);
      expect(Object.values(rounded).reduce((sum, value) => sum + value, 0)).toBe(100);
      expect(likelihood).toEqual(before);
    }
  });

  it('preserves an explicitly selected locked option in legacy stages with many alternatives', () => {
    const actions = Array.from({ length: 8 }, (_, index) => action({ id: `choice_${index}`, eligible: index < 6 }));
    const before = [...actions];
    expect(visibleDecisions(actions, 'choice_7', false).map((view) => view.id)).toContain('choice_7');
    expect(visibleDecisions(actions, 'choice_7', false)).toHaveLength(5);
    expect(visibleDecisions(actions, 'choice_7', true)).toHaveLength(8);
    expect(actions).toEqual(before);
  });
});
