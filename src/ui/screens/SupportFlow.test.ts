import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { ActionSheet } from './LiveView';
import { SupportContext } from './SupportContext';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apply, makeState, NOW, setRun, startRun, unitId } from '../../sim/test-fixtures';
import { getScenario } from '../../sim/scenario-registry';
import { RESUPPLY_HANDLERS } from '../../sim/equipment-resupply';

import { previewAction } from '../../sim/operation-selectors';
import { OpsLive } from './OpsLive';
// The shell's chrome (components/chrome.tsx) is drawn by App; here the flow's head and footer render inline.
vi.mock('../components/chrome', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    useChromeMode: () => {},
    ChromeFoot: ({ children }: { children: unknown }) => children,
    FlowScreen: ({ title, footer, trailing, children }: Record<string, never>) => createElement(Fragment, null, createElement('h1', { className: 'flow-title' }, title), trailing, children, footer),
  };
});


const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === 'function' ? next(hooks.values[index]) : next; }];
  },
}));
let state = startRun(makeState(), 'ms_occupancy', ['A']);
const act = vi.fn((command: Parameters<typeof apply>[1]) => {
  if (command.type === 'resupplyAction') {
    const draft = structuredClone(state);
    const result = RESUPPLY_HANDLERS.resupplyAction(draft, command, { now: NOW });
    if (result.ok) state = draft;
    return result;
  }
  const next = apply(state, command);
  state = next.state;
  return next.result;
});
vi.mock('../store', () => ({ useGame: () => state, getState: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act, notify: vi.fn() }) }));
const render = () => { hooks.cursor = 0; return OpsLive(); };
type Element = ReactElement<{ children?: ReactNode }>;
function descendants(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap((child) => isValidElement<Element['props']>(child) ? [child, ...descendants(child.props.children)] : []);
}
function componentOf<Props>(node: ReactNode, type: (props: Props) => ReactNode): Props {
  const matches = descendants(node).filter((child) => child.type === type);
  expect(matches, 'exactly one intended component').toHaveLength(1);
  return (matches[0] as ReactElement<Props>).props;
}
const supportOf = (view: ReturnType<typeof render>) => componentOf(view.props.supportContext, SupportContext);
const actionOf = (view: ReturnType<typeof render>) => componentOf(view.props.children, ActionSheet);

beforeEach(() => {
  hooks.values = [];
  state = startRun(makeState(), 'ms_occupancy', ['A']);
  act.mockClear();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => vi.restoreAllMocks());

describe('support review panel transitions and repeated confirmations', () => {
  it('opens support, returns to decisions and switches to an existing action without committing it', () => {
    const first = render();
    supportOf(first).onOpen();
    const support = render();
    expect(supportOf(support).open).toBe(true);
    expect(actionOf(support).open).toBe(false);
    supportOf(support).onClose();
    expect(supportOf(render()).open).toBe(false);

    supportOf(first).onOpen();
    const current = render();
    const id = current.props.actions[0].id;
    supportOf(current).onPickAction(id);
    const action = render();
    expect(supportOf(action).open).toBe(false);
    expect(actionOf(action).open).toBe(true);
    expect(actionOf(action).view!.id).toBe(id);
    actionOf(action).onBackToSupport!();
    const returnedSupport = render();
    expect(supportOf(returnedSupport).open).toBe(true);
    expect(actionOf(returnedSupport).open).toBe(false);
    supportOf(returnedSupport).onPickAction(id);
    actionOf(render()).onClose();
    expect(actionOf(render()).open).toBe(false);
    expect(act).not.toHaveBeenCalled();
    expect(state.activeRun!.revision).toBe(0);
    expect(getScenario(state.activeRun!.scenarioId)).not.toBeNull();
  });

  it('accepts one decision per rendered revision even when Confirm is tapped twice', () => {
    render().props.onSelectAction('ms_gather');
    const before = render();
    const confirm = actionOf(before).onConfirm;
    confirm();
    const firstRevision = state.activeRun!.revision;
    expect(firstRevision).toBe(1);
    const afterFirst = structuredClone(state);
    confirm();
    expect(act).toHaveBeenCalledTimes(1);
    expect(state).toEqual(afterFirst);

    const next = render();
    expect(next.props.selectedAction).toBeNull();
    next.props.onSelectAction(next.props.actions.find((action: { eligible: boolean }) => action.eligible).id);
    actionOf(render()).onConfirm();
    expect(act).toHaveBeenCalledTimes(2);
    expect(state.activeRun!.revision).toBe(firstRevision + 1);
  });
});

describe('player decisions and inventory are separate', () => {


  it('starts without a selected decision and cannot confirm through unopened or empty details', () => {
    const first = render();
    expect(first.props.selectedAction).toBeNull();
    expect(first.props.highlightSpaceIds).toEqual([]);
    expect(actionOf(first).acting).toEqual([]);
    actionOf(first).onConfirm();
    first.props.onOpenDetails();
    actionOf(render()).onConfirm();
    expect(act).not.toHaveBeenCalled();
    expect(state.activeRun!.history).toEqual([]);
  });

  it('keeps the explicit decision while focus changes its actor, and preserves those roles on same-option reviews', () => {
    state = setRun(startRun(makeState(), 'ms_occupancy', ['A', 'B']), { stage: 'resolve' });
    const before = structuredClone(state);
    const first = render();
    const supported = first.props.actions.find((action: { support: unknown }) => action.support);
    expect(supported.supportSquadIds).toEqual([]);
    first.props.onSelectAction(supported.id);
    expect(actionOf(render()).support).toEqual([]);
    actionOf(render()).onToggleSupport('B');
    expect(actionOf(render()).acting).toEqual(['A']);
    expect(actionOf(render()).support).toEqual(['B']);
    render().props.onFocusSquad('B');
    actionOf(render()).onPick(supported.id);
    const unchanged = render();
    expect(unchanged.props.selectedAction.id).toBe(supported.id);
    expect(unchanged.props.focusSquadId).toBe('B');
    expect(actionOf(unchanged).acting).toEqual(['B']);
    expect(actionOf(unchanged).support).toEqual([]);
    expect(unchanged.props.selectedAction).toEqual(previewAction(state, NOW, supported.id, ['B'], []));
    actionOf(unchanged).onToggleSupport('A');
    actionOf(render()).onPick(supported.id);
    expect(actionOf(render()).acting).toEqual(['B']);
    expect(actionOf(render()).support).toEqual(['A']);
    expect(state).toEqual(before);
    expect(act).not.toHaveBeenCalled();
    state = setRun(state, { stage: 'adapt' });
    expect(render().props.selectedAction).toBeNull();
  });

  it('requires a separate confirmation after stores delivery and preserves the reviewed action and acting squad', () => {
    state = startRun(makeState(), 'ms_occupancy', ['A', 'B'], { loadouts: { A: {}, B: {} } });
    render().props.onSelectAction('ms_contact_hall');
    render().props.onFocusSquad('B');
    const blocked = actionOf(render());
    expect(blocked.acting).toEqual(['B']);
    expect(blocked.resupply!.ok).toBe(false);
    expect(blocked.resupply!.reason).toContain('crisis negotiator');
    const beforeRefusal = structuredClone(state);
    blocked.onResupply!();
    blocked.onConfirm();
    expect(state).toEqual(beforeRefusal);
    expect(act).not.toHaveBeenCalled();
    // Bravo's missing qualification cannot be delivered from stores. Choose the
    // qualified squad explicitly; the same decision stays open for review.
    render().props.onFocusSquad('A');
    const review = render();
    const sheet = actionOf(review);
    expect(sheet.resupply!.ok).toBe(true);
    const before = structuredClone(state);
    const expectedUnits = sheet.resupply!.items.map((item: { unitId: string }) => item.unitId);
    sheet.onResupply!();
    expect(act.mock.calls.map(([command]) => command.type)).toEqual(['resupplyAction']);
    expect(state.activeRun!.history).toEqual([]);
    expect(state.activeRun!.squadTasks).toEqual(before.activeRun!.squadTasks);
    expect(state.activeRun!.rngState).toBe(before.activeRun!.rngState);
    expect(state.department.funding).toBe(before.department.funding);
    expect(state.activeRun!.clock).toBe(before.activeRun!.clock + sheet.resupply!.minutes);
    expect(state.reservations.filter((reservation) => expectedUnits.includes(reservation.unitId)).map((reservation) => reservation.squadId)).toEqual(['A']);
    expect(state.reservations.filter(reservation => reservation.squadId === 'B')).toEqual(before.reservations.filter(reservation => reservation.squadId === 'B'));
    expect(expectedUnits).toEqual([unitId('throw_phone')]);
    const delivered = structuredClone(state);
    sheet.onResupply!();
    expect(state).toEqual(delivered);
    expect(act).toHaveBeenCalledTimes(1);
    const after = render();
    expect(after.props.selectedAction.id).toBe('ms_contact_hall');
    expect(actionOf(after).acting).toEqual(['A']);
    expect(actionOf(after).support).toEqual([]);
    expect(actionOf(after).resupply).toBeNull();
    expect(after.props.canCancel).toBe(false);
    actionOf(after).onConfirm();
    actionOf(after).onConfirm();
    expect(act.mock.calls.map(([command]) => command.type)).toEqual(['resupplyAction', 'decide']);
    expect(state.activeRun!.history).toHaveLength(1);
    expect(render().props.selectedAction).toBeNull();
  });

  it('refuses stale delivery controls after a decision changes the phase', () => {
    state = startRun(makeState(), 'ms_occupancy', ['A'], { loadouts: { A: {} } });
    render().props.onSelectAction('ms_contact_hall');
    const stale = actionOf(render()).onResupply;
    state = apply(state, { type: 'decide', actionId: 'ms_gather', actingSquadIds: ['A'], supportSquadIds: [] }).state;
    const before = structuredClone(state);
    stale!();
    expect(act).not.toHaveBeenCalled();
    expect(state).toEqual(before);
    expect(render().props.selectedAction).toBeNull();
  });
});
