import { Children, createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../sim/department';
import { CampaignSlots } from '../../sim/campaign-slots';
import { dispatch } from '../../sim/game';
import type { Command, SquadId } from '../../sim/types';
import { ChoiceRail } from '../components/ChoiceRail';
import { DEFAULT_NAV, NavContext, type NavApi } from '../components/nav';
import { INITIAL_SQUAD_VIEW, updateSquadView, type SquadViewAction } from '../components/squad-view';
import { Button } from '../components/ui';
import { SquadPanel, SquadScreen } from './Squad';
import { App } from '../App';

const NOW = Date.UTC(2026, 9, 5);
let state = createInitialState(NOW, 120);
let view = INITIAL_SQUAD_VIEW;
let session = 0;
const changeView = (action: SquadViewAction) => { view = updateSquadView(view, action); };
const act = vi.fn((command: Command) => {
  const result = dispatch(state, command, { now: NOW });
  state = result.state;
  return result.result;
});
vi.mock('../store', () => ({ useGame: () => state, getState: () => state, useCampaigns: () => ({ session }) }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act, notify: vi.fn() }) }));

type Element = ReactElement<ComponentProps<'input'> & ComponentProps<'form'> & { children?: ReactNode }>;
function elements(node: ReactNode): Element[] {
  return isValidElement<Element['props']>(node) ? [node, ...Children.toArray(node.props.children).flatMap(elements)] : [];
}
function capture(render: () => ReactElement, extra: Partial<NavApi> = {}) {
  let tree!: ReactElement;
  function Capture() { tree = render(); return tree; }
  const html = renderToStaticMarkup(createElement(NavContext.Provider, { value: { ...DEFAULT_NAV, ...extra, squadView: view, updateSquadView: changeView } }, createElement(Capture)));
  return { tree, html };
}
function panel(squadId: SquadId) {
  return capture(() => SquadPanel({ squad: state.squads.find((squad) => squad.id === squadId)!, onOpen: vi.fn() }));
}
function startRename(squadId: SquadId) {
  const rename = elements(panel(squadId).tree).find((element) => element.props['aria-label']?.startsWith('Rename '))!;
  rename.props.onClick?.({} as never);
}
function typeName(squadId: SquadId, value: string) {
  const input = elements(panel(squadId).tree).find((element) => element.type === 'input')!;
  input.props.onChange?.({ target: { value } } as never);
}
function selectSquad(squadId: SquadId) {
  const screen = capture(SquadScreen);
  const rail = elements(screen.tree).find((element) => element.type === ChoiceRail && (element.props as { label?: string }).label === 'Squads')!;
  (rail.props as unknown as { onChange: (id: SquadId) => void }).onChange(squadId);
}

beforeEach(() => { state = createInitialState(NOW, 120); view = INITIAL_SQUAD_VIEW; act.mockClear(); });

describe('immediate squad navigation and separate rename drafts', () => {
  it('keeps A’s open draft away from B through repeated switches, including immediate submit', () => {
    const originalB = state.squads[1].name;
    startRename('A');
    typeName('A', 'Alpha draft');
    for (const id of ['B', 'A', 'B'] as const) selectSquad(id);
    expect(view.selectedId).toBe('B');
    expect(panel('B').html).not.toContain('<form');
    expect(panel('B').html).not.toContain('Alpha draft');
    expect(state.squads[1].name).toBe(originalB);
    expect(act).not.toHaveBeenCalled();

    startRename('B');
    typeName('B', 'Bravo draft');
    const form = elements(panel('B').tree).find((element) => element.type === 'form')!;
    form.props.onSubmit?.({ preventDefault: vi.fn() } as never);
    expect(act).toHaveBeenCalledExactlyOnceWith({ type: 'renameSquad', squadId: 'B', name: 'Bravo draft' }, 'Squad renamed');
    expect(state.squads[0].name).toBe('Alpha');
    expect(state.squads[1].name).toBe('Bravo draft');
    expect(view.renameDrafts).toEqual({ A: 'Alpha draft' });
    selectSquad('A');
    expect(panel('A').html).toContain('value="Alpha draft"');
    expect(panel('A').html).not.toContain('autofocus');
  });

  it.each(['Cancel', 'Escape'])('%s discards only the current squad draft and reveals its latest saved name', (action) => {
    startRename('A'); typeName('A', 'Unsent A');
    startRename('B'); typeName('B', 'Unsent B');
    state.squads[1].name = 'Updated Bravo';
    const current = panel('B');
    expect(current.html).toContain('value="Unsent B"');
    if (action === 'Escape') elements(current.tree).find((element) => element.type === 'form')!.props.onKeyDown?.({ key: 'Escape', preventDefault: vi.fn() } as never);
    else elements(current.tree).find((element) => element.type === Button && element.props.children === 'Cancel')!.props.onClick?.({} as never);
    expect(view.renameDrafts).toEqual({ A: 'Unsent A' });
    expect(panel('B').html).toContain('Updated Bravo');
    expect(act).not.toHaveBeenCalled();
  });

  it('keeps a refused rename open and leaves the saved squad unchanged', () => {
    startRename('A'); typeName('A', '   ');
    elements(panel('A').tree).find((element) => element.type === 'form')!.props.onSubmit?.({ preventDefault: vi.fn() } as never);
    expect(view.renameDrafts.A).toBe('   ');
    expect(state.squads[0].name).toBe('Alpha');
    expect(panel('A').html).toContain('<form');
  });

  it('recovers selection and drafts on returning from Training or another destination', () => {
    selectSquad('B'); startRename('B'); typeName('B', 'Keep my draft');
    const before = capture(SquadScreen).html;
    expect(capture(SquadScreen, { squadSection: 'training' }).html).toContain('Search courses');
    const after = capture(SquadScreen).html;
    expect(after).toBe(before);
    expect(after).toContain('id="selected-squad-panel-tab-B" aria-label="Squad B, Bravo" aria-selected="true"');
    expect(after).toContain('role="tabpanel" aria-labelledby="selected-squad-panel-tab-B" tabindex="0"');
    expect(after).toContain('value="Keep my draft"');
  });

  it('uses a valid first squad immediately when the remembered squad no longer exists', () => {
    selectSquad('D');
    const html = capture(SquadScreen).html;
    expect(html).toContain('role="tabpanel" aria-labelledby="selected-squad-panel-tab-A"');
    expect(html).toContain('aria-label="Squad A, Alpha" aria-selected="true"');
  });

  it('reserves roster portrait geometry before the first width measurement', () => {
    const html = panel('A').html;
    expect(html.match(/class="ocard-art" style="aspect-ratio:1 \/ 1\.04;max-height:124px"/g)).toHaveLength(4);
    expect(html).not.toContain('class="ocard-art" style="height:83px"');
  });

  it('recreates the navigation owner on New and Load even though campaigns share squad A/B ids', () => {
    const entries = new Map<string, string>();
    const saves = new CampaignSlots({ getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); } }, NOW, () => 120);
    const ownerKey = () => { session = saves.getSnapshot().session; return App().key; };
    const first = ownerKey();
    startRename('A'); typeName('A', 'First campaign only'); selectSquad('B');
    expect(INITIAL_SQUAD_VIEW).toEqual({ selectedId: null, renameDrafts: {} });
    expect(saves.newGame(2, 'Second campaign', NOW).ok).toBe(true);
    const next = ownerKey();
    expect(next).not.toBe(first);
    expect(saves.getSnapshot().state.squads.map((squad) => squad.id)).toEqual(['A', 'B']);
    expect(saves.load(1, NOW).ok).toBe(true);
    expect(ownerKey()).not.toBe(next);
  });
});
