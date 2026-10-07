import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeState, NOW, unitId } from '../../sim/test-fixtures';
import { OpsPrepare } from './OpsPrepare';
import { SupportPreparation } from './SupportPreparation';
import { Button, Stepper } from '../components/ui';
import { ChoiceRail } from '../components/ChoiceRail';
import type { StartOperationCommand } from '../../sim/operation-selectors';
import type { SquadId } from '../../sim/types';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useMemo: (factory: () => unknown) => factory(),
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

type Element = ReactElement<Record<string, any>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, any>>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
const render = () => { hooks.cursor = 0; return OpsPrepare({ scenarioId: 'ms_occupancy', onCancel: () => {} }); };
const find = (root: ReactNode, test: (element: Element) => boolean) => {
  const element = nodes(root).find(test);
  if (!element) throw new Error('Expected preparation control was not found');
  return element;
};
const squad = (sid: string) => find(render(), (element) => element.props['aria-label'] === `Squad ${sid} setup`);
const toggleSquad = (sid: string) => find(render(), (element) => element.type === 'button' && element.key === sid && element.props.className?.startsWith('pickcard')).props.onClick();
const selectSetup = (sid: SquadId) => {
  const rail = find(render(), (element) => element.type === ChoiceRail && element.props.label === 'Squad setup');
  rail.props.onChange(sid);
  expect(find(render(), (element) => element.type === ChoiceRail && element.props.label === 'Squad setup').props.value).toBe(sid);
  expect(squad(sid).props.role).toBe('tabpanel');
};
const quantity = (sid: string, label: string) => find(squad(sid), (element) => element.type === Stepper && element.props.label === label).props;
const auto = (sid: string) => find(squad(sid), (element) => element.type === Button && element.props['aria-label'] === `Auto-equip squad ${sid}`).props;
const command = (): StartOperationCommand => find(render(), (element) => element.type === SupportPreparation).props.cmd;
const undo = () => find(render(), (element) => element.type === Button && element.props.children === 'Undo auto-equip').props.onClick();

beforeEach(() => {
  hooks.values = [];
  state = makeState();
  act.mockClear();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => vi.restoreAllMocks());

describe('Auto-equip squad inventory controls', () => {
  it('only updates the requested squad inventory and keeps manual zeros, exact units, positions and support choices', () => {
    toggleSquad('A');
    toggleSquad('B');
    expect(squad('B')).toBeDefined();
    expect(nodes(render()).some(element => element.props['aria-label'] === 'Squad A setup')).toBe(false);
    selectSetup('A');
    quantity('A', 'Throw phone').onChange(0);
    quantity('A', 'Trauma kit').onChange(1);
    selectSetup('B');
    quantity('B', 'Throw phone').onChange(1);
    selectSetup('A');
    find(squad('A'), (element) => element.type === 'select').props.onChange({ target: { value: 'side_yard_e' } });
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
    const firstControl = auto('A');
    // The squad card shows a short visible label; the accessible name keeps the squad.
    expect(firstControl.children).toBe('Auto-equip');
    expect(firstControl['aria-label']).toBe('Auto-equip squad A');
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

  it('does nothing with no selected squads', () => {
    const all = find(render(), (element) => element.type === Button && element.props.block && element.props.icon === 'wand').props;
    expect(all.disabled).toBe(true);
    all.onClick();
    expect(command().squadIds).toEqual([]);
    expect(act).not.toHaveBeenCalled();
  });
});
