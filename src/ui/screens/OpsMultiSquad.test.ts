import { decisionsOf } from '../../sim/types';
import { SCENARIOS } from '../../content/scenarios';
import { buildLocation } from '../../sim/location';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apply, makeState, NOW, setRun, startRun, testCallId, withCallOnBoard } from '../../sim/test-fixtures';
import { previewAction } from '../../sim/operation-selectors';
import { getScenario } from '../../sim/scenario-registry';
import { scenarioActions } from '../../sim/scenario-types';
import type { Command, GameState, SquadId } from '../../sim/types';
import { Sheet, type SheetProps } from '../components/Sheet';
import { Button, Stepper } from '../components/ui';
import { ActionSheet, ActionSquadAssignment, type ActionSheetProps, type LiveViewProps } from './LiveView';
import { OpsLive } from './OpsLive';
import { OpsPrepare } from './OpsPrepare';
import { SupportPreparation } from './SupportPreparation';
import { callFlow } from './call-flow';
import { focusActingSquad, toggleActingSquad, toggleDeploymentSquad, toggleSupportingSquad } from './operation-squads';
// The shell's chrome (components/chrome.tsx) is drawn by App; here the flow's head and footer render inline.
vi.mock('../components/chrome', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    useChromeMode: () => {},
    ChromeFoot: ({ children }: { children: unknown }) => children,
    FlowScreen: ({ title, footer, trailing, children }: Record<string, never>) => createElement(Fragment, null, createElement('h1', { className: 'flow-title' }, title), trailing, children, footer),
  };
});


const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, state: null as GameState | null, act: vi.fn(), notify: vi.fn() }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === 'function' ? next(hooks.values[index]) : next; }];
  },
  useMemo: (fn: () => unknown) => fn(), useRef: (value: unknown) => ({ current: value }), useEffect: () => {}, useLayoutEffect: () => {},
}));
vi.mock('../store', () => ({ useGame: () => hooks.state, getState: () => hooks.state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: hooks.act, notify: hooks.notify }) }));

type Element = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
function descendants(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap(child => isValidElement(child) ? [child as Element, ...descendants((child as Element).props.children)] : []);
}
function live() {
  hooks.cursor = 0;
  const element = OpsLive() as ReactElement<LiveViewProps>;
  const sheet = descendants(element.props.children).find(child => child.type === ActionSheet) as unknown as ReactElement<ActionSheetProps>;
  return { view: element.props, sheet: sheet.props };
}
function prepare() {
  hooks.cursor = 0;
  const nodes = descendants(OpsPrepare({ scenarioId: 'ms_occupancy', onCancel: () => {}, step: 'deploy' }));
  const command = (nodes.find(node => node.type === SupportPreparation) as ReactElement<Parameters<typeof SupportPreparation>[0]>).props.cmd;
  const button = (label: string, id: SquadId) => nodes.find(node => node.type === 'button' && node.props.children === label && node.props['data-squad'] === id)!.props.onClick as () => void;
  const choose = (id: SquadId) => (nodes.find(node => node.type === 'button' && node.props.className?.toString().startsWith('cl-squad') && node.props['data-squad'] === id)!.props.onClick as () => void)();
  /** Open a squad's Adjust sheet (its kit) or Change sheet (its way in). */
  const adjust = (id: SquadId) => button('Adjust', id)();
  const change = (id: SquadId) => button('Change', id)();
  const open = nodes.find(node => node.props.className?.toString().includes('cl-kit-workspace'))?.props['data-squad'] as SquadId | undefined;
  const quantity = (name: string) => (nodes.find(node => node.type === Stepper && node.props.label === name) as ReactElement<Parameters<typeof Stepper>[0]>).props;
  return { nodes, command, choose, adjust, change, open, quantity };
}

beforeEach(() => {
  callFlow.close('ms_occupancy');
  hooks.values = []; hooks.cursor = 0; hooks.state = makeState({ squadC: true }); hooks.act.mockReset(); hooks.notify.mockReset();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  hooks.act.mockImplementation((command: Command) => {
    const next = apply(hooks.state!, command); hooks.state = next.state; return next.result;
  });
});
afterEach(() => vi.restoreAllMocks());

describe('multi-squad review and commitment', () => {
  it('switches one actor in one tap, synchronizes officer focus, and commits that exact visible review once', () => {
    hooks.state = startRun(hooks.state!, 'ms_occupancy', ['A', 'B']);
    expect(live().view.selectedAction).toBeNull();
    const action = live().view.actions.find(action => action.eligible && previewAction(hooks.state!, NOW, action.id, ['B'], [])?.eligible)!;
    live().view.onSelectAction(action.id);
    expect(live().sheet.acting).toEqual(['A']);
    live().sheet.onToggleActing('B');
    const reviewed = live();
    expect(reviewed.view.focusSquadId).toBe('B');
    expect(reviewed.view.officers.map(officer => officer.id)).toEqual(hooks.state.squads[1].officerIds);
    expect(reviewed.sheet.acting).toEqual(['B']);
    expect(reviewed.sheet.view).toEqual(previewAction(hooks.state, NOW, action.id, ['B'], []));
    expect(reviewed.sheet.view!.eligible).toBe(true);
    reviewed.sheet.onConfirm(); reviewed.sheet.onConfirm();
    expect(hooks.act).toHaveBeenCalledTimes(1);
    expect(decisionsOf(hooks.state!.activeRun!.history)[0].actingSquadIds).toEqual(['B']);
    expect(live().view.selectedAction).toBeNull();
  });

  it('keeps an open decision while focus changes, retaining explicit support until it becomes the actor', () => {
    hooks.state = setRun(startRun(hooks.state!, 'ms_urgent', ['A', 'B', 'C']), { stage: 'adapt' });
    live().view.onSelectAction('mu_two_point');
    live().sheet.onToggleSupport('B');
    live().view.onFocusSquad('C');
    expect(live().sheet.view!.id).toBe('mu_two_point');
    expect(live().sheet.acting).toEqual(['C']);
    expect(live().sheet.support).toEqual(['B']);
    expect(live().sheet.view).toEqual(previewAction(hooks.state, NOW, 'mu_two_point', ['C'], ['B']));
    live().view.onFocusSquad('B');
    expect(live().sheet.acting).toEqual(['B']);
    expect(live().sheet.support).toEqual([]);
    expect(live().sheet.view!.reason).toContain('Needs a second squad');
  });

  it('honors authored joint action capacity and resumes the last committed actor without choosing a decision', () => {
    hooks.state = setRun(startRun(hooks.state!, 'ms_occupancy', ['A', 'B', 'C']), { stage: 'adapt' });
    live().view.onSelectAction('ms_perimeter_watch');
    expect(live().sheet.maxActing).toBe(3);
    live().sheet.onToggleActing('B'); live().sheet.onToggleActing('C');
    expect(live().sheet.acting).toEqual(['A', 'B', 'C']);
    live().sheet.onToggleActing('A'); live().sheet.onToggleActing('C');
    expect(live().sheet.acting).toEqual(['B']);
    live().sheet.onConfirm();
    hooks.values = [];
    expect(live().view.focusSquadId).toBe('B');
    expect(live().view.selectedAction).toBeNull();
  });

  it('keeps a fully injured squad out of field roles while preserving command-only emergency choices', () => {
    // A v13 call deploys one squad (compile.ts squadRange), so the two-squad fixture carries this.
    const scenario = getScenario('ms_occupancy')!;
    hooks.state = startRun(hooks.state!, scenario.id, ['A', 'B']);
    for (const id of hooks.state.squads[1].officerIds) hooks.state.officers[id].injury = { label: 'Wounded', until: NOW + 100000 };
    const fieldAction = live().view.actions.find(view => !scenarioActions(scenario).find(action => action.id === view.id)?.commandOnly)!;
    live().view.onSelectAction(fieldAction.id);
    expect(live().sheet.unavailableActors).toContain('B');
    live().sheet.onToggleActing('B');
    expect(live().sheet.acting).toEqual(['A']);
    live().view.onFocusSquad('B');
    expect(live().view.focusSquadId).toBe('A');
    const isolated = structuredClone(scenario); isolated.id = 'command_ui_fixture';
    const commandDefinition = { ...isolated.stages.assess.actions[0], id: 'test_officer_request', commandOnly: true, storyTargetPersonId: undefined, storyRoute: undefined, approach: 'none' as const, authority: undefined, requires: {}, visibleWhen: undefined, outcomes: { favorable: [{ text: 'Request recorded.' }], mixed: [{ text: 'Request recorded.' }], adverse: [{ text: 'Request recorded.' }] } };
    isolated.stages.assess.actions.push(commandDefinition);
    SCENARIOS[isolated.id] = isolated; hooks.state.activeRun!.scenarioId = isolated.id;
    hooks.state.activeRun!.stage = commandDefinition.stage;
    const command = live().view.actions.find(view => view.id === commandDefinition.id)!;
    expect(command).toBeDefined();
    live().view.onSelectAction(command.id);
    expect(live().sheet.unavailableActors).not.toContain('B');
    expect(live().sheet.unavailableSupport).toContain('B');
    live().sheet.onToggleActing('B');
    expect(live().sheet.acting).toEqual(['B']);
  });

  it('shows current locations, real participant names and bystanders without claiming they rest for free', () => {
    hooks.state = startRun(hooks.state!, 'ms_occupancy', ['A', 'B']);
    live().view.onSelectAction(live().view.actions[0].id);
    const sheet = live().sheet;
    const html = renderToStaticMarkup(createElement(ActionSquadAssignment, { ...sheet, view: sheet.view! }));
    expect(html).toContain('At Front');
    expect(html).toContain('Mara Chen');
    expect(html).toContain('Bravo stays at');
    expect(html).toContain('time and strain');
  });

  it('keeps failure outside story choices, reviews unresolved duties, and rejects stale or repeated confirmation', () => {
    hooks.state = startRun(withCallOnBoard(hooks.state!, testCallId('armed')), testCallId('armed'), ['A'], { positions: { A: buildLocation(getScenario(testCallId('armed'))!.locationFamilyId, getScenario(testCallId('armed'))!.locationSeed).location.entries[0] }, loadouts: { A: {} } });
    expect(live().view.failedResponse).toBeNull();
    for (const squad of hooks.state.squads.filter(squad => squad.id === 'A')) for (const id of squad.officerIds) hooks.state.officers[id].injury = { label: 'Wounded', until: NOW + 100000 };
    const panel = () => descendants(live().view.failedResponse);
    const open = () => (panel().find(node => node.type === Button)!.props.onClick as () => void)();
    const confirmation = () => descendants(live().view.children).find(node => node.type === Sheet && node.props.title === 'Report the team unable to continue') as unknown as ReactElement<SheetProps>;
    const submit = (sheet: ReactElement<SheetProps>) => descendants(sheet.props.footer).find(node => node.type === Button && node.props.variant === 'danger')!.props.onClick as () => void;
    expect(panel()[0].props['aria-label']).toBe('Failed response');
    expect(live().view.selectedAction).toBeNull();
    open();
    const original = confirmation();
    expect(original.props.open).toBe(true);
    const details = renderToStaticMarkup(createElement('div', null, original.props.children));
    expect(details).toContain('Still unresolved');
    expect(details).toContain('Department trust falls by 2.');
    hooks.state.activeRun!.revision++;
    expect(confirmation().props.open).toBe(false);
    submit(original)();
    expect(hooks.act).not.toHaveBeenCalled();
    open();
    const current = confirmation();
    hooks.act.mockImplementation((command: Command) => {
      if (command.type === 'endFailedResponse') hooks.state!.activeRun!.status = 'debrief';
      return { ok: true };
    });
    submit(current)(); submit(current)();
    expect(hooks.act).toHaveBeenCalledExactlyOnceWith({ type: 'endFailedResponse', runId: hooks.state.activeRun!.id, revision: hooks.state.activeRun!.revision });
  });
});

describe('preparing several squads from shared stock', () => {
  it('preserves exact manual quantities, deliberate zeroes, positions and unit assignments across repeated tab changes', () => {
    prepare().choose('A'); prepare().choose('B');
    expect(prepare().open, 'no kit sheet until Adjust').toBeUndefined();
    prepare().adjust('A');
    expect(prepare().open).toBe('A');
    prepare().quantity('Trauma kit').onChange(2);
    prepare().quantity('Door ram').onChange(0);
    prepare().change('A');
    const select = prepare().nodes.find(node => node.type === 'select')!;
    (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'side_yard_e' } });
    const first = structuredClone(prepare().command);
    prepare().adjust('B');
    expect(prepare().quantity('Trauma kit').max).toBe(Object.values(hooks.state!.units).filter(unit => unit.itemId === 'trauma_kit').length - 2);
    prepare().quantity('Trauma kit').onChange(1);
    const both = structuredClone(prepare().command);
    for (let i = 0; i < 3; i++) { prepare().adjust('A'); prepare().change('A'); prepare().adjust('B'); prepare().change('B'); }
    expect(prepare().command).toEqual(both);
    expect(both.positions!.A).toBe('side_yard_e');
    expect(both.loadouts.A).toEqual(first.loadouts.A);
    expect(both.units!.A).toEqual(first.units!.A);
    expect(both.units!.A!.some(id => both.units!.B!.includes(id))).toBe(false);
    prepare().adjust('A');
    expect(prepare().quantity('Door ram').value).toBe(0);
    const auto = prepare().nodes.find(node => node.type === Button && node.props['aria-label'] === 'Auto-equip Alpha')!;
    (auto.props.onClick as () => void)();
    expect(prepare().quantity('Door ram').value).toBe(0);
    expect(prepare().command.loadouts.B).toEqual(both.loadouts.B);
    expect(prepare().command.units!.B).toEqual(both.units!.B);
  });
});

it('bounds repeated role and deployment choices without an empty actor set or overlapping assignments', () => {
  let selection = { acting: ['A'] as SquadId[], support: ['B'] as SquadId[] };
  selection = toggleActingSquad(selection, 'B', 1);
  expect(selection).toEqual({ acting: ['B'], support: [] });
  expect(toggleActingSquad(selection, 'B', 2)).toEqual(selection);
  selection = toggleActingSquad(selection, 'C', 2);
  expect(toggleActingSquad(selection, 'A', 2)).toEqual(selection);
  selection = toggleSupportingSquad(selection, 'A', 1);
  expect(toggleSupportingSquad(selection, 'B', 1)).toEqual(selection);
  expect(focusActingSquad(selection, 'A')).toEqual({ acting: ['A'], support: [] });
  expect(toggleDeploymentSquad(['A', 'B'], 'C', 2)).toEqual(['A', 'B']);
  expect(toggleDeploymentSquad(['A'], 'B', 1)).toEqual(['B']);
});
