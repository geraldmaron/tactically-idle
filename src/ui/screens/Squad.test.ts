import { Children, createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../sim/department';
import { CampaignSlots } from '../../sim/campaign-slots';
import { dispatch } from '../../sim/game';
import type { Command, SquadId } from '../../sim/types';
import { DEFAULT_NAV, NavContext, type NavApi } from '../components/nav';
import { INITIAL_SQUAD_VIEW, updateSquadView, type SquadViewAction } from '../components/squad-view';
import { Button } from '../components/ui';
import { SquadPanel, SquadScreen } from './Squad';
import { App } from '../App';
import { certLegend, rosterCounts, rosterLine, squadCrest, tileStatus } from './team-model';

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
vi.mock('../components/Beat', () => ({ useBeat: () => ({ play: vi.fn(), act: vi.fn() }) }));

type Element = ReactElement<ComponentProps<'input'> & ComponentProps<'form'> & { children?: ReactNode }>;
function elements(node: ReactNode): Element[] {
  // Row keeps its controls in the title, detail and trail props, so those are walked as children.
  return isValidElement<Element['props']>(node) ? [node, ...Children.toArray(node.props.children).flatMap(elements), ...(['lead', 'title', 'detail', 'trail'] as const).flatMap((slot) => elements((node.props as Record<string, ReactNode>)[slot]))] : [];
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
beforeEach(() => { state = createInitialState(NOW, 120); view = INITIAL_SQUAD_VIEW; act.mockClear(); });

describe('squads as blocks with separate rename drafts', () => {
  it('keeps A’s open draft away from B, including an immediate submit of B', () => {
    const originalB = state.squads[1].name;
    startRename('A');
    typeName('A', 'Alpha draft');
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

  it('recovers drafts on returning from Training or another destination', () => {
    startRename('B'); typeName('B', 'Keep my draft');
    const before = capture(SquadScreen).html;
    expect(capture(SquadScreen, { squadSection: 'training' }).html).toContain('Search courses');
    const after = capture(SquadScreen).html;
    expect(after).toBe(before);
    expect(after).toContain('value="Keep my draft"');
  });

  it('shows every squad as a block and each officer once in Squads and once in Roster', () => {
    const officers = Object.keys(state.officers).length;
    const squads = capture(SquadScreen).html;
    for (const squad of state.squads) expect(squads).toContain(`aria-label="Squad ${squad.id}, ${squad.name}"`);
    expect(squads.match(/class="ocard ocard-tile/g)).toHaveLength(officers);
    const roster = capture(SquadScreen, { squadSection: 'roster' }).html;
    expect(roster.match(/ui-row officer-row/g)).toHaveLength(officers);
  });

  it('opens on the locker-room scene with one line of counts and one segmented row, Hire and Training one tap away', () => {
    const html = capture(SquadScreen).html;
    expect(html).toContain('data-team-scene="swat"');
    expect(html).toContain('aria-label="Team sections"');
    expect(html).toContain('aria-label="SWAT sections"');
    for (const name of ['Squads', 'Roster', 'Hire', 'Training']) expect(html).toContain(name);
    expect(html).toContain(rosterLine(rosterCounts(Object.values(state.officers), Date.now())));
    // The counts are visual badges; each segment keeps its plain name.
    expect(html).toContain(`<span class="team-scene-count" aria-hidden="true">${state.candidates.length}</span>`);
    expect(html).not.toContain('aria-label="Hire,');
  });

  it('gives each squad its crest and callsign, and a quiet two-choice duty control', () => {
    const html = capture(SquadScreen).html;
    for (const squad of state.squads) {
      expect(html).toContain(squadCrest(squad.id));
      expect(html).toContain(`aria-label="Duty for ${squad.name}"`);
    }
    expect(html).not.toContain('role="switch"');
  });

  it('shows a tile status only when an officer is not ready, and explains the qualification marks', () => {
    const [first, second] = Object.values(state.officers);
    first.stress = 40;
    second.assignment = { kind: 'training', courseId: 'composure_workshop', startedAt: NOW, endsAt: NOW + 3_600_000 };
    const html = capture(SquadScreen).html;
    const tiles = new Map([...html.matchAll(/<button[^>]*data-officer-tile="([^"]+)"[\s\S]*?<\/button>/g)].map((m) => [m[1], m[0]]));
    expect(tiles.size).toBe(Object.keys(state.officers).length);
    // A flag on exactly the officers who are not simply ready, and never one that says Ready.
    for (const officer of Object.values(state.officers)) {
      expect(tiles.get(officer.id)!.includes('otile-flag'), officer.surname).toBe(tileStatus(officer, Date.now()) !== null);
    }
    expect(tiles.get(first.id)).toContain('otile-flag');
    expect(tiles.get(second.id)).toContain('otile-flag');
    expect([...tiles.values()].filter((tile) => tile.includes('kit-mark-label">Ready<'))).toHaveLength(0);
    // The glyphs are explained: a legend lists each qualification held, and each tile names them aloud.
    expect(html).toContain('What the qualification marks mean');
    for (const entry of certLegend(Object.values(state.officers))) expect(html).toContain(entry.name);
  });

  it('recreates the navigation owner on New and Load even though campaigns share squad A/B ids', () => {
    const entries = new Map<string, string>();
    const saves = new CampaignSlots({ getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); } }, NOW, () => 120);
    const ownerKey = () => { session = saves.getSnapshot().session; return App().key; };
    const first = ownerKey();
    startRename('A'); typeName('A', 'First campaign only');
    expect(INITIAL_SQUAD_VIEW).toEqual({ selectedId: null, renameDrafts: {} });
    expect(saves.newGame(2, 'Second campaign', NOW).ok).toBe(true);
    const next = ownerKey();
    expect(next).not.toBe(first);
    expect(saves.getSnapshot().state.squads.map((squad) => squad.id)).toEqual(['A', 'B']);
    expect(saves.load(1, NOW).ok).toBe(true);
    expect(ownerKey()).not.toBe(next);
  });
});
