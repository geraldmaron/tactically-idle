import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apply, makeState, startRun } from '../../sim/test-fixtures';
import { getScenario } from '../../sim/scenario-registry';
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
});

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
    next.props.children[0].props.onConfirm();
    expect(act).toHaveBeenCalledTimes(2);
    expect(state.activeRun!.revision).toBe(firstRevision + 1);
  });
});
