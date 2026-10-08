import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ActionView, DebriefResult, DecisionView } from '../../sim/types';
import { apply, makeState, NOW, setRun, startRun, withCallOnBoard } from '../../sim/test-fixtures';
import { registerCapabilityFixtures } from '../../sim/fixtures/capability-scenarios';
import { actionViews, currentBuilt, decisionViews, pendingDebrief, previewAction, spaceViews, stageContinuations, stageProgress } from '../../sim/operation-selectors';
import { planActionResupply } from '../../sim/equipment-resupply';
import { ActionSheet, LiveView, PersonRow, revealStageStep, StageSteps, type LiveViewProps } from './LiveView';
import { DecisionCard, OperationFeedback, OperationLogContents, OutcomeForecast } from './OperationFeedback';
import { OpsDebrief, SavedDebriefContents, SavedDebriefReview } from './OpsDebrief';
import { Debriefs } from './HQ';
import { drawIncidentSpec, generateIncident } from '../../gen/incident';
import { startGateRun } from '../../gen/incident/gates/engine-driver';
import { outcomePercentages, visibleDecisions } from './liveModels';

let state = makeState();
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
// SSR cannot use a portal. Preserve the sheet's title, region/dialog semantics and pinned footer.
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer, modal = true, className }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode; modal?: boolean; className?: string }) => open ? createElement('section', { role: modal ? 'dialog' : 'region', 'aria-label': title, className }, createElement('h2', null, title), children, createElement('footer', null, footer)) : null }));
const noop = () => {};
const render = (node: ReactNode) => renderToStaticMarkup(node);
// The native details boundary separates the default result from its complete saved evidence.
const defaultResult = (html: string) => html.split('<details class="decision-causes decision-record"')[0];
const action = (patch: Partial<ActionView> = {}): ActionView => ({
  id: 'treat', stage: 'adapt', title: 'Prepare medical access', icon: 'medic', summary: 'Keep access open while preparing aid.', requirementLine: 'Qualified medic + trauma supplies',
  actingSquadIds: ['A'], supportSquadIds: [], support: null, officerIds: ['off_ortiz'], targetId: null, eligible: true, reason: null, risk: 'low',
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
  expect(visible).toContain('Supplies used');
  expect(visible).toContain('Stress on the team');
  expect(html).toContain('Recorded check: adverse');
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

it('shows the v6 welfare partial ending without a success percentage or favorable result claim', () => {
  const scenario = generateIncident({ type: 'welfare_check', familyId: 'cedar_close', buildingSeed: 7, seed: 2, tier: 1, contentVersion: 6 });
  const g = startRun(withCallOnBoard(makeState(), scenario.id), scenario.id, ['A'], { positions: { A: 'front_yard' }, loadouts: { A: {} } });
  expect(actionViews(g, NOW, 'A').some(a => a.id.endsWith('assess_partial'))).toBe(false);
  // The retired card is hidden, but an already-issued historical decision keeps its exact presentation.
  const legacyId = scenario.stages.assess.actions.find(a => a.id.endsWith('assess_partial'))!.id;
  const view = previewAction(g, NOW, legacyId, ['A'], [])!;
  expect(view.eventResult).toBe('Response ended');
  const card = render(createElement(LiveView, liveProps([view])));
  expect(card).toContain('End with the progress made');
  expect(card).not.toContain('chance to go well');
  const forecast = render(createElement(OutcomeForecast, { action: view }));
  expect(forecast).toContain('Expected event');
  expect(forecast).not.toContain('% chance');
  expect(forecast).toContain('Possible harm');
  const committed = apply(g, { type: 'decide', actionId: view.id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(committed.result).toEqual({ ok: true });
  const recorded = decisionViews(committed.state)[0];
  const html = render(createElement(DecisionCard, { decision: recorded }));
  expect(defaultResult(html)).toContain('Response ended');
  expect(defaultResult(html)).toContain('Time');
  expect(defaultResult(html)).not.toMatch(/Went well|Went badly|Had complications/);
  expect(html).toContain(`Recorded check: ${recorded.band}`);
  expect(pendingDebrief(committed.state)?.completionAchieved).toBe(false);
});

describe('reviewing a decision', () => {
  it('shows every initial option without highlighting a decision the player has not chosen', () => {
    const html = render(createElement(LiveView, liveProps([action(), action({ id: 'wait', title: 'Wait for an update' })], null)));
    expect(html).toContain('Prepare medical access');
    expect(html).toContain('Wait for an update');
    expect(html).not.toContain('callbtn-on');
    expect(html).not.toContain('Review decision');
    expect(html).not.toContain('Confirm:');
  });

  it('renders free stage navigation outside decision cards without odds, squads or confirmation', () => {
    const props = liveProps([], null);
    const html = render(createElement(LiveView, { ...props, onContinueStage: noop, continuations: [{ actionId: 'continue', fromStage: 'adapt', toStage: 'resolve', revision: 1, label: 'Continue to response choices', description: 'Leaves the remaining preparation options behind. No operation time passes.' }] }));
    const continuation = html.split('aria-label="Next stage"')[1];
    expect(continuation).toContain('Continue to response choices');
    expect(continuation).toContain('No operation time passes');
    expect(continuation).toContain('Leaves the remaining preparation options behind');
    for (const excluded of ['callbtn', 'chance', 'Confirm:', 'Squad taking action', 'supplies']) expect(continuation).not.toContain(excluded);
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

  it('keeps support-origin reviews in a focused dialog with a way back to their context', () => {
    const html = render(createElement(ActionSheet, { ...sheet(action()).props, onBackToSupport: noop }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Back to care &amp; support');
    expect(html).toContain('Confirm: Prepare medical access');
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
    const html = render(createElement(OperationFeedback, { decisions: [decision()] }));
    for (const expected of ['Last decision', 'Had complications', 'The patient received aid, but the route is still unresolved.', '+8 min', 'Call progress', '+12', 'Civilian safety', '-4', 'Pressure', '+5', 'Officer stress', '+1.5 stress', '1 × Trauma supplies', 'Patient condition: Confirmed', 'Decision log (1)']) expect(html).toContain(expected);
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
  });

  it('keeps no-change sections in the record while a quiet result leads with its saved consequence and time', () => {
    const quiet = decision({ timeCost: .5, objectiveDelta: 0, civilianSafetyDelta: 0, pressureDelta: 0, stressDeltas: [], supplies: [], knowledgeChanges: [], consequences: ['The resident agrees to speak at the door.'], explanation: ['The resident agrees to speak at the door.'] });
    const before = structuredClone(quiet);
    const html = render(createElement(DecisionCard, { decision: quiet, explicitCompletion: true }));
    const visible = defaultResult(html);
    expect(visible).toContain('The resident agrees to speak at the door.');
    expect(visible).toContain('+0.5 min');
    expect(visible.match(/<dt>/g)).toHaveLength(1);
    for (const absent of ['Civilian safety', 'Pressure', 'Supplies used', 'What you learned', 'Stress on the team', 'No change', 'Nothing new']) expect(visible).not.toContain(absent);
    expect(html).toContain('<details class="decision-causes decision-record">');
    for (const saved of ['Civilian safety', 'Pressure', 'Supplies used', 'None', 'No knowledge changes recorded.', 'No change to officer stress.']) expect(html).toContain(saved);
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
    for (const expected of ['Son waiting outside: Confirmed', 'Fire in the kitchen: Ruled out', '1 × Trauma supplies', '+8 min', '-4', '+5', '+1.5 stress']) expect(visible).toContain(expected);
    expect(visible).not.toContain('Helped most');
    expect(visible).not.toContain('Most strain');
    for (const line of saved.explanation) expect(html).toContain(line);
    expect(html).toContain('Ortiz medical rating: +12 points');
    expect(visible).not.toContain('Operation ended');
  });

  it('retains exact legacy deltas without claiming unknown stress levels or an injury from scores alone', () => {
    const old = decision({ actualStressDeltas: false, stressDeltas: [{ officerId: 'off_chen', label: 'Chen', delta: 2 }], supplies: [], knowledgeChanges: [], consequences: ['The route stays open.'] });
    const visible = defaultResult(render(createElement(DecisionCard, { decision: old })));
    for (const expected of ['Recorded strain', '+2 recorded strain', 'Older record: strain may differ from the applied change.', '-4']) expect(visible).toContain(expected);
    for (const absent of ['Officer stress', 'stress-scale', 'Low stress', 'injured', 'Nothing new']) expect(visible).not.toContain(absent);
    const emptyOld = render(createElement(DecisionCard, { decision: { ...old, stressDeltas: [] } }));
    expect(defaultResult(emptyOld)).not.toContain('Recorded strain');
    expect(emptyOld).toContain('No strain entries were saved.');
    expect(emptyOld).not.toContain('No change to officer stress.');
  });

  it('preserves zero-delta officer snapshots and all evidence in the expanded full log', () => {
    const saved = decision({ objectiveDelta: 0, civilianSafetyDelta: 0, pressureDelta: 0, stressDeltas: [{ officerId: 'off_chen', label: 'Chen', delta: 0, stressBefore: 80, stressAfter: 80 }], supplies: [], knowledgeChanges: [], explanation: ['The room is empty.', 'Helped most: Chen: coordination 65, composure 67 (+36.2).', 'Most strain: Chen (+0).'], consequences: ['The room is empty.'] });
    const visible = defaultResult(render(createElement(DecisionCard, { decision: saved })));
    expect(visible).not.toContain('Stress on the team');
    const log = render(createElement(OperationLogContents, { decisions: [saved], explicitCompletion: true }));
    expect(log).toContain('Each choice records the time, supplies and changes it caused.');
    expect(log).toContain('<details class="decision-causes decision-record" open="">');
    for (const line of saved.explanation) expect(log).toContain(line);
    for (const expected of ['Call progress', 'Civilian safety', 'Pressure', 'before 80, change 0', 'Needs rest', 'No knowledge changes recorded.', 'Supplies used', 'None', 'Ortiz medical rating: +12 points']) expect(log).toContain(expected);
  });

  it('keeps current completion separate from recorded numeric progress without changing legacy feedback', () => {
    const html = render(createElement(DecisionCard, { decision: decision(), explicitCompletion: true }));
    expect(defaultResult(html)).not.toContain('Call progress');
    expect(html).toContain('Call progress');
    expect(html).toContain('Completion depends on the work done');
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

  it('shows no empty feedback panel before the first decision', () => {
    expect(render(createElement(OperationFeedback, { decisions: [] }))).toBe('');
  });

  it('renders the ending summary and preserves the saved log in the real debrief', () => {
    const scenario = generateIncident({ type: 'welfare_check', familyId: 'cedar_close', buildingSeed: 7, seed: 3, tier: 1, contentVersion: 3 });
    state = startRun(withCallOnBoard(makeState(), scenario.id), scenario.id, ['A']);
    for (let step = 0; step < 12 && state.activeRun?.status === 'active'; step++) {
      const chosen = actionViews(state, NOW, 'A').find((view) => view.eligible);
      const continuation = stageContinuations(state)[0];
      const result = apply(state, chosen
        ? { type: 'decide', actionId: chosen.id, actingSquadIds: chosen.actingSquadIds, supportSquadIds: chosen.supportSquadIds }
        : { type: 'continueStage', actionId: continuation.actionId, revision: continuation.revision });
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
  const saved: DebriefResult = { runId: 'run_older', scenarioId: 'ms_occupancy', endingId: 'old', endingTitle: 'Assistance completed', objective: { score: 75, label: 'Completed' }, civilianSafety: { score: 88, label: 'Safe' }, officerCondition: [], informationPreserved: [], resources: [{ itemId: 'battery_pack', used: 1, returned: 0 }], unitWear: [], trustDelta: 2, fundingReward: 100, devPointReward: 1, causes: ['The squad verified the report.'] };
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
    expect(html).toContain('THE PROMISED CONVERSATION');
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
  const d: DebriefResult = { runId: 'archived_force', scenarioId: 'ms_occupancy', endingId: 'closed', endingTitle: 'Closed', objective: { score: 100, label: 'Complete' }, civilianSafety: { score: 50, label: 'Consequences' }, officerCondition: [], informationPreserved: [], resources: [], unitWear: [], trustDelta: 0, fundingReward: 0, devPointReward: 0, causes: [], personCasualties: [{ personId: 'mara', personRole: 'subject', label: 'Mara Bell', severity: 'fatal', at: 8, care: 'deceased', causeRevision: 2 }] };
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
    const s = generateIncident(drawIncidentSpec(1312, { level: 10, trust: 90, contentVersion: 13, unlockedTypes: ['active_armed_incident'] }).spec);
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
