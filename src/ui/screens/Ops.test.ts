import type { DependencyList, EffectCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpsScreen } from './Ops';
import { OpsBoard } from './OpsBoard';
import { OpsPrepare } from './OpsPrepare';
import { OpsLive } from './OpsLive';
import { OpsDebrief } from './OpsDebrief';

const hooks = vi.hoisted(() => ({
  prep: null as string | null,
  state: { activeRun: null as { status: 'active' | 'debrief'; revision: number; clock: number; stage: string } | null },
  dependencies: undefined as DependencyList | undefined,
  effects: [] as EffectCallback[],
}));

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: () => [hooks.prep, (next: string | null) => { hooks.prep = next; }],
  // The node suite has no DOM renderer. Commit the component's actual layout
  // effect only when its dependencies change, as React does between renders.
  useLayoutEffect: (effect: EffectCallback, dependencies?: DependencyList) => {
    if (!dependencies || !hooks.dependencies || dependencies.length !== hooks.dependencies.length
      || dependencies.some((value, index) => !Object.is(value, hooks.dependencies![index]))) hooks.effects.push(effect);
    hooks.dependencies = dependencies;
  },
}));
vi.mock('../store', () => ({ useGame: () => hooks.state }));
vi.mock('./OpsBoard', () => ({ OpsBoard: () => null }));
vi.mock('./OpsPrepare', () => ({ OpsPrepare: () => null }));
vi.mock('./OpsLive', () => ({ OpsLive: () => null }));
vi.mock('./OpsDebrief', () => ({ OpsDebrief: () => null }));

function render() {
  const element = OpsScreen();
  hooks.effects.splice(0).forEach((effect) => effect());
  return element;
}

function fixture() {
  const screen = { scrollTop: 960 };
  const querySelector = vi.fn((selector: string) => selector === 'main.screen-ops' ? screen : null);
  vi.stubGlobal('document', { querySelector });
  return { screen, querySelector };
}

beforeEach(() => {
  hooks.prep = null;
  hooks.state = { activeRun: null };
  hooks.dependencies = undefined;
  hooks.effects = [];
});
afterEach(() => vi.unstubAllGlobals());

describe('operation surface scroll transitions', () => {
  it('opens board, preparation, live operation, and results at the top of the shared screen', () => {
    const { screen } = fixture();
    const board = render();
    expect(board.type).toBe(OpsBoard);
    expect(screen.scrollTop).toBe(0);

    screen.scrollTop = 1400;
    board.props.onPrepare('ms_occupancy');
    const preparation = render();
    expect(preparation.type).toBe(OpsPrepare);
    expect(screen.scrollTop).toBe(0);

    screen.scrollTop = 1700;
    hooks.state.activeRun = { status: 'active', revision: 0, clock: 0, stage: 'arrival' };
    expect(render().type).toBe(OpsLive);
    expect(screen.scrollTop).toBe(0);

    // Reproduces confirming a terminal decision while deep in the live screen.
    screen.scrollTop = 1250;
    hooks.state.activeRun = { status: 'debrief', revision: 3, clock: 18, stage: 'debrief' };
    expect(render().type).toBe(OpsDebrief);
    expect(screen.scrollTop).toBe(0);

    screen.scrollTop = 1100;
    hooks.state.activeRun = null;
    // Closing results must return to the library, not the stale preparation.
    expect(render().type).toBe(OpsBoard);
    expect(hooks.prep).toBeNull();
    expect(screen.scrollTop).toBe(0);
  });

  it('preserves live scroll and component identity across ticks, decisions, and stage changes', () => {
    const { screen, querySelector } = fixture();
    hooks.state.activeRun = { status: 'active', revision: 0, clock: 0, stage: 'arrival' };
    const initial = render();
    screen.scrollTop = 640;
    for (const patch of [{ clock: 1 }, { revision: 1, clock: 6 }, { revision: 2, stage: 'entry' }]) {
      hooks.state = { activeRun: { ...hooks.state.activeRun!, ...patch } };
      const next = render();
      expect(next.type).toBe(initial.type);
      expect(next.key).toBe(initial.key);
      expect(screen.scrollTop).toBe(640);
    }
    expect(querySelector).toHaveBeenCalledExactlyOnceWith('main.screen-ops');
  });

  it.each(['board', 'prepare', 'debrief'] as const)('preserves the reading position during %s updates', (surface) => {
    const { screen, querySelector } = fixture();
    if (surface === 'prepare') hooks.prep = 'ms_occupancy';
    if (surface === 'debrief') hooks.state.activeRun = { status: 'debrief', revision: 3, clock: 18, stage: 'debrief' };
    render();
    screen.scrollTop = 780;
    hooks.state = { ...hooks.state };
    render();
    render();
    expect(screen.scrollTop).toBe(780);
    expect(querySelector).toHaveBeenCalledOnce();
  });

  it('does not fall back to scrolling the document when the operation screen is absent', () => {
    const documentScroll = { scrollTop: 300 };
    const querySelector = vi.fn(() => null);
    vi.stubGlobal('document', { querySelector, scrollingElement: documentScroll });
    vi.stubGlobal('window', { scrollTo: vi.fn() });
    expect(() => render()).not.toThrow();
    expect(querySelector).toHaveBeenCalledExactlyOnceWith('main.screen-ops');
    expect(documentScroll.scrollTop).toBe(300);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
