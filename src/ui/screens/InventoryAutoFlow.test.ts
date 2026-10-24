import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeState, NOW, unitId } from '../../sim/test-fixtures';
import { OpsPrepare } from './OpsPrepare';
import { SupportPreparation } from './SupportPreparation';
import { Button, Stepper } from '../components/ui';
import type { StartOperationCommand } from '../../sim/operation-selectors';
import type { SquadId } from '../../sim/types';
import { callFlow } from './call-flow';
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
  useLayoutEffect: () => {},
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === 'function' ? next(hooks.values[index]) : next; }];
  },
}));
let state = makeState();
const act = vi.fn();
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act, notify: vi.fn() }) }));
// These tests call the screens as plain functions with hand-made hooks, so the store-subscribed tie choice (a warrant's
// part for the knowing officer) answers with its default.
vi.mock('./operations/view', async (importOriginal) => ({ ...(await importOriginal<typeof import('./operations/view')>()), useTieChoice: () => 'talks' as const }));

type Element = ReactElement<Record<string, any>>;
/** Every element under a node, including the ones a component takes in a named slot (a Section's `action`, a Row's `trail`). */
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, any>>(node)) return [];
  const slots = Object.entries(node.props).filter(([key, value]) => key !== 'children' && (isValidElement(value) || (Array.isArray(value) && value.length > 0 && value.every((item) => isValidElement(item))))).map(([, value]) => value as ReactNode);
  return [node, ...nodes(node.props.children), ...slots.flatMap(nodes)];
}
const render = () => { hooks.cursor = 0; return OpsPrepare({ scenarioId: 'ms_occupancy', onCancel: () => {}, step: 'deploy' }); };
const find = (root: ReactNode, test: (element: Element) => boolean) => {
  const element = nodes(root).find(test);
  if (!element) throw new Error('Expected preparation control was not found');
  return element;
};
/** A squad's kit workspace, open in its Adjust sheet. */
const squad = (sid: string) => find(render(), (element) => element.props.className?.toString().includes('cl-kit-workspace') && element.props['data-squad'] === sid);
const toggleSquad = (sid: string) => find(render(), (element) => element.type === 'button' && element.props.className?.toString().startsWith('cl-squad') && element.props['data-squad'] === sid).props.onClick();
/** Open a squad's Adjust sheet: only that squad's kit shows. */
const selectSetup = (sid: SquadId) => {
  find(render(), (element) => element.type === 'button' && element.props.children === 'Adjust' && element.props['data-squad'] === sid).props.onClick();
  expect(squad(sid)).toBeDefined();
};
/** Open a squad's Change sheet, for its starting position and staging. */
const goingIn = (sid: SquadId) => {
  find(render(), (element) => element.type === 'button' && element.props.children === 'Change' && element.props['data-squad'] === sid).props.onClick();
  return find(render(), (element) => element.props.className === 'cl-going-workspace' && element.props['data-squad'] === sid);
};
const quantity = (sid: string, label: string) => find(squad(sid), (element) => element.type === Stepper && element.props.label === label).props;
const auto = (sid: string) => find(squad(sid), (element) => element.type === Button && element.props.icon === 'wand').props;
const command = (): StartOperationCommand => find(render(), (element) => element.type === SupportPreparation).props.cmd;
const undo = () => find(render(), (element) => element.type === Button && element.props.children === 'Undo auto-equip').props.onClick();

beforeEach(() => {
  hooks.values = [];
  callFlow.close('ms_occupancy');
  state = makeState();
  act.mockClear();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => vi.restoreAllMocks());

describe('Auto-equip squad inventory controls', () => {
  it('only updates the requested squad inventory and keeps manual zeros, exact units, positions and support choices', () => {
    toggleSquad('A');
    toggleSquad('B');
    selectSetup('B');
    expect(nodes(render()).some(element => element.props.className?.toString().includes('cl-kit-workspace') && element.props['data-squad'] === 'A')).toBe(false);
    selectSetup('A');
    quantity('A', 'Throw phone').onChange(0);
    quantity('A', 'Trauma kit').onChange(1);
    selectSetup('B');
    quantity('B', 'Throw phone').onChange(1);
    find(goingIn('A'), (element) => element.type === 'select').props.onChange({ target: { value: 'side_yard_e' } });
    selectSetup('A');
    find(render(), (element) => element.type === SupportPreparation).props.onSelect(unitId('support_van'));
    const before = structuredClone(command());
    const stateBefore = structuredClone(state);
    auto('A').onClick();
    const after = command();
    expect(after.squadIds).toEqual(before.squadIds);
    expect(after.positions).toEqual(before.positions);
    expect(after.staging).toEqual(before.staging);
    expect(after.supportUnitIds).toEqual(before.supportUnitIds);
    expect(after.loadouts.B).toEqual(before.loadouts.B);
    expect(after.units!.B).toEqual(before.units!.B);
    expect(quantity('A', 'Throw phone').value).toBe(0);
    expect(quantity('A', 'Trauma kit').value).toBe(1);
    expect(after.units!.A).toEqual(expect.arrayContaining(before.units!.A!));
    expect(after.units!.A!.length).toBeGreaterThan(before.units!.A!.length);
    const units = Object.values(after.units!).flat();
    expect(new Set(units).size).toBe(units.length);
    expect(state).toEqual(stateBefore);
    expect(act).not.toHaveBeenCalled();
    selectSetup('B');
    expect(quantity('B', 'Throw phone').value).toBe(1);
    selectSetup('A');
    expect(quantity('A', 'Throw phone').value).toBe(0);
    expect(command()).toEqual(after);
    undo();
    expect(command()).toEqual(before);
    expect(state).toEqual(stateBefore);
  });

  it('repeated Auto-equip keeps the allocation and the original undo point', () => {
    toggleSquad('A');
    const before = structuredClone(command());
    selectSetup('A');
    const firstControl = auto('A');
    // The kit sheet shows a short visible label; the accessible name keeps the squad.
    expect(firstControl.children).toBe('Auto-equip');
    expect(firstControl['aria-label']).toBe(`Auto-equip ${state.squads.find((s) => s.id === 'A')!.name}`);
    firstControl.onClick();
    const equipped = structuredClone(command());
    firstControl.onClick();
    auto('A').onClick();
    expect(command()).toEqual(equipped);
    expect(act).not.toHaveBeenCalled();
    undo();
    expect(command()).toEqual(before);
    expect(nodes(render()).some((element) => element.props.children === 'Undo auto-equip')).toBe(false);
  });

  it('keeps later manual changes and clears an undo that would replace them', () => {
    toggleSquad('A');
    selectSetup('A');
    auto('A').onClick();
    quantity('A', 'Throw phone').onChange(0);
    expect(nodes(render()).some((element) => element.props.children === 'Undo auto-equip')).toBe(false);
    auto('A').onClick();
    expect(quantity('A', 'Throw phone').value).toBe(0);
    expect(command().units!.A).not.toContain(unitId('throw_phone'));
    expect(act).not.toHaveBeenCalled();
  });

  it('cannot allocate unowned, serviced, failed or another squad’s selected stock', () => {
    state = makeState({ inventory: { thermal_imager: 1, throw_phone: 1, loud_hailer: 1, trauma_kit: 1 } });
    state.units[unitId('thermal_imager')].status = 'service';
    state.units[unitId('loud_hailer')].condition = 0;
    toggleSquad('A');
    toggleSquad('B');
    selectSetup('B');
    quantity('B', 'Throw phone').onChange(1);
    selectSetup('A');
    auto('A').onClick();
    const cmd = command();
    for (const id of [unitId('thermal_imager'), unitId('loud_hailer'), unitId('throw_phone')]) expect(cmd.units!.A).not.toContain(id);
    for (const id of cmd.units!.A ?? []) {
      expect(state.units[id]).toBeDefined();
      expect(state.units[id].status).toBe('ready');
      expect(state.units[id].condition).toBeGreaterThan(0);
    }
    expect(cmd.units!.B).toContain(unitId('throw_phone'));
    expect(act).not.toHaveBeenCalled();
  });

  it('offers auto-equip only in a chosen squad’s kit', () => {
    expect(nodes(render()).some((element) => element.type === Button && element.props.icon === 'wand')).toBe(false);
    toggleSquad('A');
    selectSetup('A');
    expect(auto('A').children).toBe('Auto-equip');
    expect(act).not.toHaveBeenCalled();
  });
});
