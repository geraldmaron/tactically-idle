import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ActionView, DebriefResult, DecisionView } from '../../sim/types';
import { apply, makeState, NOW, setRun, startRun, withCallOnBoard } from '../../sim/test-fixtures';
import { registerCapabilityFixtures } from '../../sim/fixtures/capability-scenarios';
import { actionViews, briefing, currentBuilt, decisionViews, pendingDebrief, previewAction, spaceViews, stageProgress } from '../../sim/operation-selectors';
import { planActionResupply } from '../../sim/equipment-resupply';
import { ActionSheet, LiveView, PersonRow, revealStageStep, StageSteps, type LiveViewProps } from './LiveView';
import { DecisionCard, OperationFeedback, OperationLogContents, OutcomeForecast } from './OperationFeedback';
import { OpsDebrief, SavedDebriefContents, SavedDebriefReview } from './OpsDebrief';
import { Debriefs } from './HQ';
import { generateIncident } from '../../gen/incident';
import { startGateRun } from '../../gen/incident/gates/engine-driver';
import { fixtureCalls } from '../../gen/incident/trees-v13/house-call-fixture';
import { ARMED_TEMPLATE } from '../../gen/incident/trees-v13/armed-fixture';
import { outcomePercentages, visibleDecisions } from './liveModels';
// The shell's chrome (components/chrome.tsx) is drawn by App; here the flow's head and footer render inline.
vi.mock('../components/chrome', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    useChromeMode: () => {},
    ChromeFoot: ({ children }: { children: unknown }) => children,
    FlowScreen: ({ title, footer, trailing, children }: Record<string, never>) => createElement(Fragment, null, createElement('h1', { className: 'flow-title' }, title), trailing, children, footer),
  };
});


let state = makeState();
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
// SSR cannot use a portal. Preserve the sheet's title, region/dialog semantics and pinned footer.
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer, modal = true, className }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode; modal?: boolean; className?: string }) => open ? createElement('section', { role: modal ? 'dialog' : 'region', 'aria-label': title, className }, createElement('h2', null, title), children, createElement('footer', null, footer)) : null }));
const noop = () => {};
const render = (node: ReactNode) => renderToStaticMarkup(node);
// The native details boundary separates the default result from its complete saved evidence.
const defaultResult = (html: string) => html.split('<details class="disclosure decision-causes decision-record"')[0];
const action = (patch: Partial<ActionView> = {}): ActionView => ({
  id: 'treat', stage: 'adapt', title: 'Prepare medical access', icon: 'medic', summary: 'Keep access open while preparing aid.', requirementLine: 'Qualified medic + trauma supplies',
  actingSquadIds: ['A'], supportSquadIds: [], support: null, officerIds: ['off_ortiz'], targetId: null, eligible: true, reason: null, risk: 'low',
  timeCost: 5, travelMinutes: 0, timeRange: { min: 4, max: 8 }, likelihood: { favorable: .73, mixed: .19, adverse: .08 }, consequenceLevel: 'high',
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

it('shows an authored completed event without a contradictory failure badge, preserving costs and the sampled check', () => {
  const saved = decision({
    title: 'Receive Ben', band: 'adverse', resultLabel: 'Ben reached safety',
    consequences: ['Ben reaches patrol with the unsigned delivery slip. Mara is still inside.'],
    civilianSafetyDelta: -2, pressureDelta: 4,
  });
  const before = structuredClone(saved);
  const html = render(createElement(DecisionCard, { decision: saved }));
  const visible = defaultResult(html);
  expect(visible).toContain('Ben reached safety');
  expect(visible).toContain('Mara is still inside');
  expect(visible).toContain('decision-event');
  expect(visible).not.toContain('decision-adverse');
  expect(visible).not.toContain('Went badly');
  expect(visible).toContain('Civilian safety');
  expect(visible).toContain('-2');
  expect(html).toContain('Task check: went badly');
  expect(saved).toEqual(before);
});

it('collapses repeated forecasts only when the selector identifies a common event', () => {
  const text = 'Ben reaches safety; Mara remains inside.';
  const same = action({ outcomePreview: { favorable: text, mixed: text, adverse: text } });
  expect(render(createElement(OutcomeForecast, { action: same }))).toContain('Goes badly');
  const fixed = render(createElement(OutcomeForecast, { action: { ...same, eventResult: 'Ben reached safety' } }));
  expect(fixed).toContain('Expected event');
  expect(fixed.split(text)).toHaveLength(2);
  expect(fixed).not.toContain('Goes badly');
  const distinct = render(createElement(OutcomeForecast, { action: action({ eventResult: 'A response was recorded' }) }));
  expect(distinct).toContain('Medical access remains unresolved.');
  expect(distinct).toContain('With difficulty');
});
function sheet(view: ActionView, all = [view]) {
  return createElement(ActionSheet, { open: true, onClose: noop, view, all, onPick: noop, squads: makeState().squads, acting: ['A'], support: [], onToggleActing: noop, onToggleSupport: noop, targetLabel: null, onConfirm: noop });
}
function liveProps(actions: ActionView[], selectedAction: ActionView | null = actions[0]): LiveViewProps {
  const g = startRun(makeState(), 'ms_occupancy', ['A']);
  return { g, now: NOW, title: 'Operation test', subtitle: 'RESIDENTIAL', progress: { ...stageProgress(g), prompt: 'How will you verify the report before committing?' }, built: currentBuilt(g)!, spaces: spaceViews(g), squadTasks: g.activeRun!.squadTasks, deployedSquads: [g.squads[0]], focusSquadId: 'A', onFocusSquad: noop, officers: [], actions, selectedAction, onSelectAction: noop, activeOfficerId: null, onSelectOfficer: noop, selectedSpaceId: null, onSelectSpace: noop, highlightSpaceIds: [], floor: 0, onFloorChange: noop, environment: null, lastChange: null, showRooms: true, onToggleRooms: noop, clock: 0, pressure: 15, canCancel: true, onCancel: noop, onOpenDetails: noop, detailsOpen: false };
}



describe('reviewing a decision', () => {
  it('shows every initial option without highlighting a decision the player has not chosen', () => {
    const html = render(createElement(LiveView, liveProps([action(), action({ id: 'wait', title: 'Wait for an update' })], null)));
    expect(html).toContain('Prepare medical access');
    expect(html).toContain('Wait for an update');
    expect(html).not.toContain('callbtn-on');
    expect(html).not.toContain('Review decision');
    expect(html).not.toContain('Confirm:');
  });


  it('hides unsupported squad controls while preserving the acting-squad choice', () => {
    const g = startRun(makeState(), 'ms_occupancy', ['A', 'B']);
    const view = previewAction(g, NOW, 'ms_contact_hall', ['A'], [])!;
    expect(view.support).toBeNull();
    const html = render(sheet(view));
    expect(html).toContain('Squad taking action');
    expect(html).not.toContain('Supporting squad');
    expect(html).toContain('aria-pressed="true"');
    expect(previewAction(g, NOW, view.id, ['B'], [])!.actingSquadIds).toEqual(['B']);
  });

  it('keeps optional coverage and genuinely required support controls', () => {
    const optionalState = setRun(startRun(makeState(), 'ms_occupancy', ['A', 'B']), { stage: 'resolve' });
    const optional = actionViews(optionalState, NOW, 'A').find(a => a.support)!;
    expect(optional.support).toEqual({ minSquads: 0, maxSquads: 2 });
    expect(render(sheet(optional))).toContain('Supporting squad (optional)');

    const jointState = setRun(startRun(makeState(), 'ms_urgent', ['A', 'B']), { stage: 'adapt' });
    const joint = previewAction(jointState, NOW, 'mu_two_point', ['A'], ['B'])!;
    expect(joint.support).toEqual({ minSquads: 1, maxSquads: 2 });
    expect(joint.eligible).toBe(true);
    const html = render(createElement(ActionSheet, { ...sheet(joint).props, support: ['B'] }));
    expect(html).toContain('Supporting squad (1 required)');
    expect(html).not.toContain('Supporting squad (optional)');
    expect(previewAction(jointState, NOW, joint.id, ['A'], [])!.reason).toContain('Needs a second squad');
  });

  it('keeps qualified specialist support visible even while another requirement is missing', () => {
    registerCapabilityFixtures();
    const g = setRun(startRun(makeState(), 'capability_response_v2', ['A', 'B'], {
      positions: { A: 'front_yard', B: 'front_yard' }, loadouts: { A: {}, B: {} },
    }), { stage: 'adapt' });
    const view = previewAction(g, NOW, 'capability_specialist_clear', ['A'], ['B'])!;
    expect(view.support).toEqual({ minSquads: 1, maxSquads: 1 });
    expect(render(sheet(view))).toContain('Supporting squad (1 required)');
  });

  it('separates high consequence severity from a favorable forecast and preserves authored possibilities', () => {
    const html = render(createElement(OutcomeForecast, { action: action() }));
    expect(html).toContain('>73%<');
    expect(html).toContain('>19%<');
    expect(html).toContain('>8%<');
    expect(html).toContain('Prepare aid without losing access.');
    expect(html).toContain('Medical access remains unresolved.');
    expect(html).not.toContain('Low risk');
    // The harm is said once, in the review's action bar, not beside the outcomes.
    expect(html).not.toContain('harm');
    expect(render(sheet(action()))).toContain('Harm high');
  });

  it('shows public duration bounds and exact supplies before the primary confirmation', () => {
    const html = render(sheet(action()));
    // The estimate once, in the action bar's summary; the range, which depends on the result, in the sheet.
    expect(html).toContain('about 5 min');
    expect(html).not.toContain('Estimated time');
    expect(html).toContain('Takes 4–8 min depending on the result.');
    expect(html).toContain('Supplies used when confirmed');
    expect(html).toContain('1 × Trauma supplies');
    expect(html.indexOf('1 × Trauma supplies')).toBeLessThan(html.indexOf('aria-label="Confirm Prepare medical access"'));
    expect(html).toContain('<footer><div class="operation-commit">');
    expect(html).toContain('btn-primary');
    expect(html).toContain('role="region"');
  });

  it('keeps support-origin reviews in a focused dialog with a way back to their context', () => {
    const html = render(createElement(ActionSheet, { ...sheet(action()).props, onBackToSupport: noop }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Back to care &amp; support');
    expect(html).toContain('aria-label="Confirm Prepare medical access">Confirm<');
  });

  it('keeps locked actions inspectable, explains the blocker and offers an available alternative', () => {
    const locked = action({ eligible: false, reason: 'Needs a qualified medic. Squad A has none' });
    const alternative = action({ id: 'wait', title: 'Reassess the report', suppliesRequired: [] });
    const html = render(sheet(locked, [locked, alternative]));
    expect(html).toContain('Needs a qualified medic. Squad A has none');
    expect(html).toContain('Available now: Reassess the report');
    expect(html).toMatch(/<button[^>]+disabled=""[^>]*aria-label="Confirm Prepare medical access">Confirm</);
    expect(html).toContain('Check what is missing to see the chances for this choice.');
    expect(html).not.toContain('% chance');
  });

  it('keeps the authored stage prompt and all five contextual choices visible', () => {
    const choices = Array.from({ length: 5 }, (_, index) => action({ id: `choice_${index}`, title: `Decision ${index + 1}` }));
    const html = render(createElement(LiveView, liveProps(choices)));
    expect(html).toContain('How will you verify the report before committing?');
    for (let index = 1; index <= 5; index++) expect(html).toContain(`aria-label="Review Decision ${index}"`);
    expect(html).not.toContain('Show all');
    expect(html).toContain('73% goes well');
    expect(html).toContain('Harm high');
  });

  it('keeps exact owned equipment and delivery consequences in the locked action sheet', () => {
    const g = startRun(makeState(), 'ms_occupancy', ['A'], { loadouts: { A: {} } });
    const view = previewAction(g, NOW, 'ms_contact_hall', ['A'], [])!;
    const resupply = planActionResupply(g, NOW, view.id, ['A'], []);
    expect(resupply.ok).toBe(true);
    const html = render(createElement(ActionSheet, { ...sheet(view).props, resupply, onResupply: noop }));
    expect(html).toContain('Equipment from stores');
    expect(html).toContain(`Alpha: Throw phone · ${resupply.items[0].serial}`);
    expect(html).toContain('Equip Throw phone · +3 min');
    expect(html).toContain('You can no longer cancel after delivery.');
    expect(html).toMatch(/<button[^>]+disabled=""[^>]*>Confirm</);
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
    expect(html).toContain('90% goes well');
    expect(html).not.toContain('73% chance to go well');
    expect(html).toContain('~3 min');
  });
});

describe('persistent decision results', () => {
  it('keeps actual changes and specific consequences visible after the toast is gone', () => {
    const html = render(createElement(OperationFeedback, { decisions: [decision()] }));
    for (const expected of ['What happened', 'Had complications', 'The patient received aid, but the route is still unresolved.', '+8 min', 'Call progress', '+12', 'Civilian safety', '-4', 'Pressure', '+5', '1 × Trauma supplies', 'Patient condition', 'Decision log (1)']) expect(html).toContain(expected);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });

  it('retains every decision, explanation, officer and contributor in the full log', () => {
    const last = decision({ revision: 2, title: 'Preserve access', band: 'favorable', endingTitle: 'Assistance completed' });
    const html = render(createElement(OperationLogContents, { decisions: [decision(), last] }));
    expect(html).toContain('2 decisions, in order');
    expect(html.indexOf('Decision 1')).toBeLessThan(html.indexOf('Decision 2'));
    for (const expected of ['Ortiz', '+3 stress', 'Chen', '+1.5 stress', 'The delay leaves the squad with less time.', 'Pressure reduced the margin.', 'Ortiz medical rating', 'Operation ended:', 'Assistance completed']) expect(html).toContain(expected);
    // Each thing is told once: the story isn't retold from the saved explanation.
    expect(html.split('The delay leaves the squad with less time.').length - 1).toBe(2);
  });

  it('shows the engine\'s camera strain line from a gauge that fills in the recorded explanation', () => {
    const line = 'Cameras on the scene (The crowd with phones at 60) added 24% to everyone\'s strain.';
    const html = render(createElement(OperationLogContents, { decisions: [decision({ explanation: ['Prepare medical access only partly worked (Squad A).', line] })] }));
    expect(html.replace(/&#x27;/g, "'")).toContain(line);
  });

  it('leads a quiet result with its saved consequence and time, and shows no empty changes', () => {
    const quiet = decision({ timeCost: .5, objectiveDelta: 0, civilianSafetyDelta: 0, pressureDelta: 0, stressDeltas: [], supplies: [], knowledgeChanges: [], consequences: ['The resident agrees to speak at the door.'], explanation: ['The resident agrees to speak at the door.'] });
    const before = structuredClone(quiet);
    const html = render(createElement(DecisionCard, { decision: quiet, explicitCompletion: true }));
    const visible = defaultResult(html);
    expect(visible).toContain('The resident agrees to speak at the door.');
    expect(visible).toContain('+0.5 min');
    for (const absent of ['Civilian safety', 'Pressure', 'Supplies used', 'What you learned', 'Stress on the team', 'No change', 'Nothing new']) expect(visible).not.toContain(absent);
    expect(html).toContain('<details class="disclosure decision-causes decision-record" data-disclosure="decision-record">');
    expect(html.split('The resident agrees to speak at the door.').length - 1, 'told once').toBe(1);
    expect(quiet).toEqual(before);
  });

  it('keeps all authored consequences, discoveries and real costs ahead of the collapsed explanation', () => {
    const saved = decision({
      consequences: ['The team reaches the landing.', 'Mei Chen is injured by falling debris.', 'The resident confirms her son is waiting outside.', 'Next: arrange care for Chen.'],
      knowledgeChanges: [{ factId: 'son', label: 'Son waiting outside', status: 'confirmed' }, { factId: 'fire', label: 'Fire in the kitchen', status: 'disproved' }],
      explanation: ['The team reaches the landing.', 'Mei Chen is injured by falling debris.', 'Helped most: Ortiz medical rating (+12).', 'Most strain: Chen (+1.5).'],
    });
    const html = render(createElement(DecisionCard, { decision: saved }));
    const visible = defaultResult(html);
    for (const line of saved.consequences) expect(visible).toContain(line);
    expect(visible.indexOf(saved.consequences[1])).toBeLessThan(visible.indexOf('aria-label="What changed"'));
    for (const expected of ['Son waiting outside', 'confirmed', 'Fire in the kitchen', 'ruled out', '1 × Trauma supplies', '+8 min', '-4', '+5']) expect(visible).toContain(expected);
    for (const told of ['Helped most', 'Most strain']) expect(html).not.toContain(told);
    expect(html).toContain('Ortiz medical rating: +12 points');
    expect(visible).not.toContain('Operation ended');
  });

  it('retains exact legacy deltas without claiming unknown stress levels or an injury from scores alone', () => {
    const old = decision({ actualStressDeltas: false, stressDeltas: [{ officerId: 'off_chen', label: 'Chen', delta: 2 }], supplies: [], knowledgeChanges: [], consequences: ['The route stays open.'] });
    const visible = defaultResult(render(createElement(DecisionCard, { decision: old })));
    for (const expected of ['+2 recorded strain', '-4']) expect(visible).toContain(expected);
    for (const absent of ['Officer stress', 'stress-scale', 'Low stress', 'injured', 'Nothing new']) expect(visible).not.toContain(absent);
    const emptyOld = render(createElement(DecisionCard, { decision: { ...old, stressDeltas: [] } }));
    expect(emptyOld).not.toContain('recorded strain');
  });

  it('preserves zero-delta officer snapshots and all evidence in the expanded full log', () => {
    const saved = decision({ objectiveDelta: 0, civilianSafetyDelta: 0, pressureDelta: 0, stressDeltas: [{ officerId: 'off_chen', label: 'Chen', delta: 0, stressBefore: 80, stressAfter: 80 }], supplies: [], knowledgeChanges: [], explanation: ['The room is empty.', 'Helped most: Chen: coordination 65, composure 67 (+36.2).', 'Most strain: Chen (+0).'], consequences: ['The room is empty.'] });
    const visible = defaultResult(render(createElement(DecisionCard, { decision: saved })));
    expect(visible).not.toContain('Stress on the team');
    const log = render(createElement(OperationLogContents, { decisions: [saved], explicitCompletion: true }));
    expect(log).toContain('Each choice records the time, supplies and changes it caused.');
    expect(log).toContain('<details class="disclosure decision-causes decision-record" data-disclosure="decision-record" open="">');
    for (const expected of ['Call progress', 'Civilian safety', 'Pressure', 'before 80, change 0', 'Needs rest', 'Ortiz medical rating: +12 points']) expect(log).toContain(expected);
  });

  it('keeps current completion separate from recorded numeric progress without changing legacy feedback', () => {
    const html = render(createElement(DecisionCard, { decision: decision(), explicitCompletion: true }));
    expect(defaultResult(html)).not.toContain('Call progress');
    expect(html).toContain('Call progress');
    expect(html).toContain('depends on the work done');
    expect(defaultResult(html)).toContain('The patient received aid, but the route is still unresolved.');
    expect(defaultResult(html)).toContain('Civilian safety');
    expect(defaultResult(render(createElement(DecisionCard, { decision: decision() })))).toContain('Call progress');
  });

  it('uses saved explanation only when there is no consequence and does not invent an empty-result story', () => {
    const fallback = decision({ consequences: [], explanation: ['The caller answered the second attempt.'] });
    expect(defaultResult(render(createElement(DecisionCard, { decision: fallback })))).toContain('The caller answered the second attempt.');
    const absent = defaultResult(render(createElement(DecisionCard, { decision: { ...fallback, explanation: [], band: 'favorable' } })));
    expect(absent).toContain('Went well');
    for (const invented of ['decision-lead', 'decision-narrative', 'Successfully completed', 'Everyone is safe', 'Operation ended']) expect(absent).not.toContain(invented);
  });

  it('shows no empty feedback panel before the first decision, only the empty live region', () => {
    // The live region is rendered empty from the start so the first result is announced.
    expect(render(createElement(OperationFeedback, { decisions: [] }))).toBe('<p class="sr-only" role="status" aria-live="polite"></p>');
  });

  it('renders the ending summary and preserves the saved log in the real debrief', () => {
    const scenario = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 3, tier: 1, contentVersion: 13 });
    state = startRun(withCallOnBoard(makeState(), scenario.id), scenario.id, ['A'], { positions: { A: briefing(scenario.id).entries[0].id } });
    for (let step = 0; step < 12 && state.activeRun?.status === 'active'; step++) {
      const chosen = actionViews(state, NOW, 'A').find((view) => view.eligible);
      expect(chosen).toBeDefined();
      const result = apply(state, { type: 'decide', actionId: chosen!.id, actingSquadIds: chosen!.actingSquadIds, supportSquadIds: chosen!.supportSquadIds });
      expect(result.result.ok).toBe(true);
      state = result.state;
    }
    const debrief = pendingDebrief(state)!;
    expect(debrief).not.toBeNull();
    const html = render(createElement(OpsDebrief));
    expect(html).toContain(debrief.endingTitle);
    expect(debrief.endingSummary).toBeTruthy();
    expect(html.replace(/<[^>]*>/g, '')).toContain(debrief.endingSummary);
    expect(html).toContain(`Decision log<span class="disclosure-count">${decisionViews(state).length}</span>`);
    expect(html).toContain('>Next call<');
    expect(html).not.toContain('Battery pack');
    const closed = apply(state, { type: 'closeDebrief' });
    expect(closed.result.ok).toBe(true);
    expect(closed.state.activeRun).toBeNull();
    const saved = closed.state.debriefs[0];
    expect(saved.decisions).toHaveLength(debrief.decisions!.length);
    const review = render(createElement(SavedDebriefReview, { debrief: saved, officers: closed.state.officers, onClose: noop }));
    expect(review.replace(/<[^>]*>/g, '')).toContain(saved.endingSummary);
    expect(review).toContain(`${saved.decisions!.length} decisions`);
    expect(review).toContain('>Done<');
    expect(review).toContain('role="dialog"');
    const hq = render(createElement(Debriefs, { g: closed.state, now: NOW }));
    expect(hq).toContain('Review result');
    expect(hq).toContain(`aria-label="Review result: ${saved.endingTitle}"`);
  });
});

describe('saved result review', () => {
  const saved: DebriefResult = { runId: 'run_older', scenarioId: 'ms_occupancy', endingId: 'old', endingTitle: 'Assistance completed', objective: { score: 75, label: 'Completed' }, civilianSafety: { score: 88, label: 'Safe' }, officerCondition: [], informationPreserved: [], resources: [{ itemId: 'battery_pack', used: 1, returned: 0 }], unitWear: [], trustDelta: 2, fundingReward: 100, causes: ['The squad verified the report.'] };
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

describe('operation stage rail', () => {
  it('keeps complete narrative stage labels and exposes the current stage in a keyboard-reachable rail', () => {
    const html = render(createElement(StageSteps, { progress: {
      stage: 'resolve', index: 2, prompt: '', stages: [
        { id: 'assess', label: 'She stepped back', state: 'done' },
        { id: 'adapt', label: 'Her terms', state: 'done' },
        { id: 'resolve', label: 'The promised conversation', state: 'current' },
      ],
    } }));
    expect(html).toContain('aria-label="Operation stages" tabindex="0"');
    expect(html).toContain('>The promised conversation<');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain('step-current" aria-current="step"');
    expect(html).not.toContain('<button');
  });

  it.each([
    { left: 370, right: 600, before: 0, after: 230 },
    { left: -100, right: 110, before: 200, after: 80 },
    { left: 20, right: 230, before: 150, after: 150 },
  ])('reveals the active stage horizontally without moving a visible stage ($left–$right)', ({ left, right, before, after }) => {
    const strip = { scrollLeft: before, getBoundingClientRect: () => ({ left: 16, right: 374 }) } as unknown as HTMLOListElement;
    const step = { getBoundingClientRect: () => ({ left, right }) } as unknown as HTMLLIElement;
    revealStageStep(strip, step);
    expect(strip.scrollLeft).toBe(after);
  });
});

describe('force forecast and recorded harm', () => {
  const forceRisk = { profile: 'less_lethal_device' as const, itemId: 'conducted_energy_device', unitId: 'issued-device', personId: 'mara', personRole: 'subject' as const, personLabel: 'Mara Bell', lethalRisk: 'low_but_present' as const, summary: 'Serious injury or death remains possible.' };
  it('separates task chances from qualitative harm without exposing a numeric injury model', () => {
    const html = render(createElement(OutcomeForecast, { action: action({ forceRisk }) }));
    expect(html).toContain('Task outcome');
    expect(html).toContain('Risk from force');
    expect(html).toContain('Serious injury or death remains possible.');
    expect(html).toContain('Harm is resolved separately');
    expect(html).not.toContain('issued-device');
    expect(html).not.toContain('low_but_present');
  });
  it.each(['none', 'wounded', 'serious', 'fatal'] as const)('shows saved %s harm separately even when the task went well', (severity) => {
    const forceOutcome = { ...forceRisk, version: 1 as const, sample: .9876543, severity };
    const html = defaultResult(render(createElement(DecisionCard, { decision: decision({ band: 'favorable', forceOutcome }) })));
    expect(html).toContain('Task check: went well');
    expect(html).toContain('Recorded harm');
    expect(html).toContain(({ none: 'No injury recorded', wounded: 'Wounded', serious: 'Serious injury', fatal: 'Deceased' } as const)[severity]);
    expect(html).not.toContain('decision-favorable');
    expect(html).not.toContain('0.9876543');
  });
});


it('shows all possessions and their own certainty in the selected-person inspector', () => {
  const html = render(createElement(PersonRow, { m: { id: 'mara', at: { x: 2, y: 2 }, label: 'Mara Bell', kind: 'subject', status: 'confirmed', armament: 'unknown', condition: 'injured', carried: [{ id: 'phone', glyph: 'phone', label: 'Cracked phone', status: 'reported' }, { id: 'keys', glyph: 'keys', label: 'House keys', status: 'confirmed' }] } }));
  expect(html).toContain('Position confirmed');
  expect(html).toContain('Cracked phone');
  expect(html).toContain('Reported item · unverified');
  expect(html).toContain('House keys');
  expect(html).toContain('Confirmed item');
  expect(html).toContain('Armament not known');
  expect(html).toContain('Injured');
  expect(html).not.toContain('Unarmed');
});

it('keeps saved subject deaths in a debrief even when a newer active call exists', () => {
  const d: DebriefResult = { runId: 'archived_force', scenarioId: 'ms_occupancy', endingId: 'closed', endingTitle: 'Closed', objective: { score: 100, label: 'Complete' }, civilianSafety: { score: 50, label: 'Consequences' }, officerCondition: [], informationPreserved: [], resources: [], unitWear: [], trustDelta: 0, fundingReward: 0, causes: [], personCasualties: [{ personId: 'mara', personRole: 'subject', label: 'Mara Bell', severity: 'fatal', at: 8, care: 'deceased', causeRevision: 2 }] };
  const html = render(createElement(SavedDebriefContents, { debrief: d, officers: {} }));
  expect(html).toContain('data-person-casualty="mara"');
  expect(html).toContain('Mara Bell');
  expect(html).toContain('Deceased');
});


describe('command’s answer on a choice (sim/authorization.ts)', () => {
  const approved = { allowed: true, rule: 'entry:threat', reason: 'Command approves it because Ash fired at the lock.' };
  const refused = { allowed: false, rule: 'entry:none', reason: 'Command won’t approve it until someone sees a threat to life.' };
  it('shows an approval under the summary on the card and in the sheet', () => {
    const view = action({ authority: approved });
    for (const html of [render(createElement(LiveView, liveProps([view], null))), render(sheet(view))]) {
      expect(html).toContain('Keep access open while preparing aid.');
      expect(html).toContain(approved.reason);
    }
    expect(render(createElement(LiveView, liveProps([view], null)))).toContain('callbtn-command');
    expect(render(sheet(view))).toContain('operation-command-line');
  });
  it('locks a refused choice with command’s line where the lock reason goes', () => {
    const view = action({ authority: refused, eligible: false, reason: refused.reason, summary: refused.reason });
    const card = render(createElement(LiveView, liveProps([view], null)));
    expect(card).toContain(refused.reason);
    expect(card).not.toContain('callbtn-command');
    const opened = render(sheet(view));
    expect(opened).toContain('note note-warn');
    expect(opened).not.toContain('operation-command-line');
  });
  it('carries a real call’s approval from the engine to the card', () => {
    // Going Live opens on talk, so the frozen armed fixture supplies an entry command can approve.
    const [s] = fixtureCalls(ARMED_TEMPLATE, 1, 1312, 'armed', 2);
    const views = actionViews(startGateRun(s.id, 719), NOW, 'A');
    const entry = views.find(view => view.authority?.allowed);
    expect(entry, 'an approved entry at the first decision of the armed call').toBeDefined();
    const html = render(createElement(LiveView, liveProps(views, null)));
    expect(html).toContain(entry!.authority!.reason);
    expect(entry!.authority!.reason).toMatch(/^Command approves it because .+\.$/);
  });
});

it.each(['reported', 'confirmed'] as const)('uses a public %s weapon item without a contradictory armament-unknown claim', (status) => {
  const html = render(createElement(PersonRow, { m: { id: 'mara', at: { x: 2, y: 2 }, label: 'Mara Bell', kind: 'subject', status: 'confirmed', carried: [{ id: 'firearm', glyph: 'weapon', label: 'Firearm', status }] } }));
  expect(html).toContain('Firearm');
  expect(html).toContain(status === 'reported' ? 'Reported item · unverified' : 'Confirmed item');
  expect(html).not.toContain('Armament not known');
});

describe('the live call on one screen, in two beats (docs/call-presentation.md)', () => {
  const threat = { id: 'door', label: 'Indigo edges for the door', minutes: 4 };
  const props = (patch: Partial<LiveViewProps> = {}): LiveViewProps => {
    const base = liveProps([action()], null);
    return { ...base, progress: { ...base.progress, threat }, ...patch };
  };

  it('reads in order: strip, moment, on-scene comms, choices, then the scene with map and faces', () => {
    // Owner challenge, 2026-10-23: the moment and the choices come first on every beat; the scene follows.
    const html = render(createElement(LiveView, props()));
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tabpanel"');
    expect(html).toContain('aria-label="Threat: Indigo edges for the door in 4 minutes"');
    const strip = html.indexOf('class="live-bar live-strip"'), scene = html.indexOf('aria-label="The scene"'), map = html.indexOf('class="live-map live-map-compact"');
    const faces = html.indexOf('class="live-squad-faces"'), comms = html.indexOf('class="comms-log');
    const prompt = html.indexOf('How will you verify the report before committing?'), choice = html.indexOf('aria-label="Review Prepare medical access"');
    expect(strip).toBeGreaterThan(-1);
    expect(html.indexOf('class="threat-pill ')).toBeGreaterThan(strip);
    expect(html.indexOf('class="threat-pill ')).toBeLessThan(prompt);
    expect(choice).toBeLessThan(scene);
    expect(scene).toBeLessThan(map);
    expect(map).toBeLessThan(faces);
    expect(comms).toBeGreaterThan(-1);
    expect(prompt).toBeLessThan(comms);
    expect(comms).toBeLessThan(choice);
    expect(html.indexOf('class="hud-btn live-map-access"')).toBeLessThan(prompt);
    expect(prompt).toBeLessThan(choice);
    // Folded by default so the choices fit the first screen; the toggle and the head's Full map open it.
    expect(html).toMatch(/id="live-map"[^>]*hidden=""/);
    expect(html).toContain('aria-controls="live-map"');
  });

  it('reads the result on its own beat, with no choices and no threat until Continue', () => {
    const html = render(createElement(LiveView, props({ beat: 'result', onContinue: noop, continueLabel: 'Continue to The till', feedback: createElement(OperationFeedback, { decisions: [decision()] }) })));
    expect(html).toContain('What happened');
    expect(html).toContain('Continue to The till');
    expect(html).not.toContain('Review Prepare medical access');
    expect(html).not.toContain('class="threat-pill ');
  });

  it('folds the last result to one row on the decide beat, the full record inside', () => {
    const html = render(createElement(OperationFeedback, { decisions: [decision()], folded: true }));
    expect(html).toContain('Last decision');
    expect(html).toMatch(/<details class="disclosure last-decision last-decision-mixed" data-disclosure="last-decision">/);
    expect(html).toContain('Had complications');
    expect(html).toContain('The patient received aid, but the route is still unresolved.');
  });
});
