import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apply, makeState, NOW, setRun, startRun, unitId } from '../../sim/test-fixtures';
import { getScenario } from '../../sim/scenario-registry';
import { RESUPPLY_HANDLERS } from '../../sim/equipment-resupply';
import { generateIncident } from '../../gen/incident';
import { OpsLive } from './OpsLive';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
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
const supportOf = (view: ReturnType<typeof render>) => view.props.supportContext.props.children[1].props;

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
    expect(support.props.children[0].props.open).toBe(false);
    supportOf(support).onClose();
    expect(supportOf(render()).open).toBe(false);

    supportOf(first).onOpen();
    const current = render();
    const id = current.props.actions[0].id;
    supportOf(current).onPickAction(id);
    const action = render();
    expect(supportOf(action).open).toBe(false);
    expect(action.props.children[0].props.open).toBe(true);
    expect(action.props.children[0].props.view.id).toBe(id);
    action.props.children[0].props.onBackToSupport();
    const returnedSupport = render();
    expect(supportOf(returnedSupport).open).toBe(true);
    expect(returnedSupport.props.children[0].props.open).toBe(false);
    supportOf(returnedSupport).onPickAction(id);
    render().props.children[0].props.onClose();
    expect(render().props.children[0].props.open).toBe(false);
    expect(act).not.toHaveBeenCalled();
    expect(state.activeRun!.revision).toBe(0);
    expect(getScenario(state.activeRun!.scenarioId)).not.toBeNull();
  });

  it('accepts one decision per rendered revision even when Confirm is tapped twice', () => {
    render().props.onSelectAction('ms_gather');
    const before = render();
    const confirm = before.props.children[0].props.onConfirm;
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
    render().props.children[0].props.onConfirm();
    expect(act).toHaveBeenCalledTimes(2);
    expect(state.activeRun!.revision).toBe(firstRevision + 1);
  });
});

describe('player decisions and inventory are separate', () => {
  it('opens legacy response choices without a decision, simulation costs or duplicate transitions', () => {
    const scenario = generateIncident({ type: 'welfare_check', familyId: 'cedar_close', buildingSeed: 7, seed: 3, tier: 1, contentVersion: 3 });
    const assessed = apply(startRun(makeState(), scenario.id, ['A'], { practice: true }), { type: 'decide', actionId: 'v3_welfare_contact', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(assessed.result.ok).toBe(true);
    state = assessed.state;
    const screen = render();
    const continuation = screen.props.continuations[0];
    expect(continuation).toBeDefined();
    expect(screen.props.actions.some((action: { id: string }) => action.id === continuation.actionId)).toBe(false);
    const before = structuredClone(state.activeRun!);
    screen.props.onContinueStage(continuation.actionId);
    const after = structuredClone(state.activeRun!);
    expect(after.stage).toBe('resolve');
    for (const key of ['clock', 'pressure', 'rngState', 'revision', 'history', 'squadTasks', 'reservationIds', 'knowledge'] as const) expect(after[key]).toEqual(before[key]);
    screen.props.onContinueStage(continuation.actionId);
    expect(state.activeRun).toEqual(after);
    expect(act.mock.calls.map(([command]) => command.type)).toEqual(['continueStage']);
    expect(render().props.selectedAction).toBeNull();
  });

  it('starts without a selected decision and cannot confirm through unopened or empty details', () => {
    const first = render();
    expect(first.props.selectedAction).toBeNull();
    expect(first.props.highlightSpaceIds).toEqual([]);
    expect(first.props.children[0].props.acting).toEqual([]);
    first.props.children[0].props.onConfirm();
    first.props.onOpenDetails();
    render().props.children[0].props.onConfirm();
    expect(act).not.toHaveBeenCalled();
    expect(state.activeRun!.history).toEqual([]);
  });

  it('preserves explicit decision and squad choices through rerenders, focus browsing and same-option reviews', () => {
    state = setRun(startRun(makeState(), 'ms_occupancy', ['A', 'B']), { stage: 'resolve' });
    const first = render();
    const supported = first.props.actions.find((action: { support: unknown }) => action.support);
    expect(supported.supportSquadIds).toEqual([]);
    first.props.onSelectAction(supported.id);
    expect(render().props.children[0].props.support).toEqual([]);
    render().props.children[0].props.onToggleSupport('B');
    render().props.onFocusSquad('B');
    render().props.children[0].props.onPick(supported.id);
    const unchanged = render();
    expect(unchanged.props.selectedAction.id).toBe(supported.id);
    expect(unchanged.props.children[0].props.acting).toEqual(['A']);
    expect(unchanged.props.children[0].props.support).toEqual(['B']);
    expect(act).not.toHaveBeenCalled();
    state = setRun(state, { stage: 'adapt' });
    expect(render().props.selectedAction).toBeNull();
  });

  it('requires a separate confirmation after stores delivery and preserves the reviewed action and acting squad', () => {
    state = startRun(makeState(), 'ms_occupancy', ['A', 'B'], { loadouts: { A: {}, B: {} } });
    render().props.onSelectAction('ms_contact_hall');
    render().props.onFocusSquad('B');
    const review = render();
    const sheet = review.props.children[0].props;
    expect(sheet.resupply.ok).toBe(true);
    const before = structuredClone(state);
    const expectedUnits = sheet.resupply.items.map((item: { unitId: string }) => item.unitId);
    sheet.onResupply();
    expect(act.mock.calls.map(([command]) => command.type)).toEqual(['resupplyAction']);
    expect(state.activeRun!.history).toEqual([]);
    expect(state.activeRun!.squadTasks).toEqual(before.activeRun!.squadTasks);
    expect(state.activeRun!.rngState).toBe(before.activeRun!.rngState);
    expect(state.department.funding).toBe(before.department.funding);
    expect(state.activeRun!.clock).toBe(before.activeRun!.clock + sheet.resupply.minutes);
    expect(state.reservations.filter((reservation) => expectedUnits.includes(reservation.unitId)).map((reservation) => reservation.squadId)).toEqual(['A']);
    expect(expectedUnits).toEqual([unitId('throw_phone')]);
    const delivered = structuredClone(state);
    sheet.onResupply();
    expect(state).toEqual(delivered);
    expect(act).toHaveBeenCalledTimes(1);
    const after = render();
    expect(after.props.selectedAction.id).toBe('ms_contact_hall');
    expect(after.props.children[0].props.acting).toEqual(['A']);
    expect(after.props.children[0].props.support).toEqual([]);
    expect(after.props.children[0].props.resupply).toBeNull();
    expect(after.props.canCancel).toBe(false);
    after.props.children[0].props.onConfirm();
    expect(act.mock.calls.map(([command]) => command.type)).toEqual(['resupplyAction', 'decide']);
    expect(state.activeRun!.history).toHaveLength(1);
    expect(render().props.selectedAction).toBeNull();
  });

  it('refuses stale delivery controls after a decision changes the phase', () => {
    state = startRun(makeState(), 'ms_occupancy', ['A'], { loadouts: { A: {} } });
    render().props.onSelectAction('ms_contact_hall');
    const stale = render().props.children[0].props.onResupply;
    state = apply(state, { type: 'decide', actionId: 'ms_gather', actingSquadIds: ['A'], supportSquadIds: [] }).state;
    const before = structuredClone(state);
    stale();
    expect(act).not.toHaveBeenCalled();
    expect(state).toEqual(before);
    expect(render().props.selectedAction).toBeNull();
  });
});
