import { Children, createElement, isValidElement, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { budget } from '../../sim/department-selectors';
import { makeState } from '../../sim/test-fixtures';
import { moneyFull } from '../format';
import { createPlayerNavigation, PLAYER_NAV_HISTORY_KEY } from './nav';
import { Sheet, type SheetProps } from './Sheet';
import { createDepartmentHelpNavigation, DepartmentStatHelp, DepartmentStatusBar, TOPBAR_HELP_HISTORY_KEY, type DepartmentStat } from './TopBar';

vi.mock('../store', () => ({ useGame: () => makeState() }));
// The real Sheet owns portal placement, focus containment and Escape handling.
vi.mock('./Sheet', () => ({ Sheet: ({ open, title, children, onClose }: SheetProps) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, createElement('button', { onClick: onClose }, 'Close'), children) : null }));

type Element = ReactElement<{ children?: ReactNode; onClick?: (event: MouseEvent<HTMLButtonElement>) => void; onClose?: () => void; open?: boolean }>;
function elements(node: ReactNode): Element[] {
  if (!isValidElement<Element['props']>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elements)];
}
const render = (node: ReactNode) => renderToStaticMarkup(node);

describe('department status explanations', () => {
  it('keeps the compact values and brand, with four named native help buttons', () => {
    const state = makeState();
    state.department.funding = 12400;
    const html = render(createElement(DepartmentStatusBar, { g: state, topic: null, onOpen: vi.fn(), onClose: vi.fn() }));
    expect(html).toContain('alt="Tactically Idle"');
    expect(html).toContain('>$12.4K</span>');
    expect(html).toContain('Funding: $12,400. Show explanation');
    expect(html).toContain(`Income after costs: ${moneyFull(budget(state).net)} per real hour. Show explanation`);
    expect(html).toContain(`Public trust: ${Math.round(state.department.trust)} out of 100. Show explanation`);
    expect(html).toContain(`Department level: ${state.department.level}. Show explanation`);
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(4);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(4);
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('title="Public trust"');
  });

  it('opens the requested explanation and gives the shared Sheet the close handler without mutating game data', () => {
    const g = makeState();
    const before = structuredClone(g);
    const onOpen = vi.fn(), onClose = vi.fn();
    const tree = DepartmentStatusBar({ g, topic: null, onOpen, onClose });
    const buttons = elements(tree).filter((element) => element.type === 'button');
    const focus = vi.fn();
    buttons.forEach((button) => button.props.onClick?.({ currentTarget: { focus } } as unknown as MouseEvent<HTMLButtonElement>));
    expect(onOpen.mock.calls.map(([topic]) => topic)).toEqual(['funding', 'income', 'trust', 'level']);
    expect(focus).toHaveBeenCalledTimes(4);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    const sheets = elements(tree).filter((element) => element.type === Sheet);
    expect(sheets).toHaveLength(1);
    sheets[0].props.onClose?.();
    expect(onClose).toHaveBeenCalledOnce();
    expect(g).toEqual(before);
  });

  it.each(['funding', 'income', 'trust', 'level'] as const)('opens exactly one shared dialog for %s and marks only its trigger expanded', (topic) => {
    const html = render(createElement(DepartmentStatusBar, { g: makeState(), topic, onOpen: vi.fn(), onClose: vi.fn() }));
    expect(html.match(/role="dialog"/g)).toHaveLength(1);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(3);
    expect(html).toContain('>Close</button>');
  });

  it('shows full funding and its uses without introducing a purchase or claiming a forecast', () => {
    const state = makeState();
    state.department.funding = 125678;
    const html = render(createElement(DepartmentStatHelp, { g: state, topic: 'funding' }));
    expect(html).toContain('$125,678');
    expect(html).toContain('Hiring, training, equipment and development purchases');
    expect(html).toContain('over real time');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('125.7K');
  });

  it.each([620, 0, -42])('explains a net income of %s per real hour using the current budget components', (net) => {
    const state = makeState();
    state.officers.off_chen.wage += budget(state).net - net;
    const current = budget(state);
    const html = render(createElement(DepartmentStatHelp, { g: state, topic: 'income' }));
    expect(current.net).toBe(net);
    expect(html).toContain(`${net > 0 ? '+' : ''}${moneyFull(net)} <span>per real hour`);
    for (const [label, value] of [['Base allocation', current.base], ['Patrol income', current.patrol], ['Development income', current.nodeIncome], ['Total income', current.gross], ['Officer wages', current.wages], ['Operating costs', current.operating], ['Supply costs', current.supplies]] as const) {
      expect(html).toContain(`<dt>${label}</dt><dd>${moneyFull(value)} / real hour</dd>`);
    }
    expect(html).toContain(net > 0 ? 'Funding grows' : net < 0 ? 'Funding falls' : 'covers wages and running costs exactly');
    expect(html).toContain('One-off purchases reduce your balance separately.');
  });

  it.each([0, 78, 100])('explains public trust at %s on its actual 0–100 scale', (trust) => {
    const state = makeState();
    state.department.trust = trust;
    const html = render(createElement(DepartmentStatHelp, { g: state, topic: 'trust' }));
    expect(html).toContain(`${trust} <span>out of 100</span>`);
    expect(html).toContain('Public confidence');
    expect(html).toContain('Completed operations can raise or lower public trust.');
  });

  it('shows the recorded department level without inventing advancement requirements', () => {
    const state = makeState();
    state.department.level = 7;
    const html = render(createElement(DepartmentStatHelp, { g: state, topic: 'level' }));
    expect(html).toContain('Level 7');
    expect(html).toContain('separate from public trust and an individual officer');
    expect(html).not.toMatch(/XP needed|next level|role="progressbar"/i);
  });
});

function navigationFixture() {
  const entries: Record<string, unknown>[] = [{ campaign: 3 }];
  let index = 0;
  const history = {
    get state() { return entries[index]; },
    pushState: vi.fn((next: Record<string, unknown>) => { entries.splice(index + 1); entries.push(next); index++; }),
    replaceState: vi.fn((next: Record<string, unknown>) => { entries[index] = next; }),
    back: vi.fn(),
  };
  const onRoute = vi.fn();
  const player = createPlayerNavigation(history, 'player', onRoute);
  player.initialize();
  player.setSquadSection('training');
  let topic: DepartmentStat | null = null;
  const help = createDepartmentHelpNavigation(history, 'header', (next) => { topic = next; });
  const pop = (direction: number) => { index += direction; player.onPop(); help.onPop(); };
  return { history, entries, player, help, topic: () => topic, back: () => pop(-1), forward: () => pop(1) };
}

describe('department help navigation', () => {
  it('reconciles a retained help entry on reload so the same metric can reopen without changing the player route', () => {
    const state = navigationFixture();
    state.help.open('trust');
    const savedRoute = structuredClone(state.history.state[PLAYER_NAV_HISTORY_KEY]);
    let reloadedTopic: DepartmentStat | null = null;
    // A real reload retains history but recreates component state and may repeat useId.
    const reloaded = createDepartmentHelpNavigation(state.history, 'header', (next) => { reloadedTopic = next; });
    reloaded.initialize();
    expect(reloadedTopic).toBeNull();
    expect(state.history.state[TOPBAR_HELP_HISTORY_KEY]).toBeUndefined();
    expect(state.history.state[PLAYER_NAV_HISTORY_KEY]).toEqual(savedRoute);
    expect(state.history.state.campaign).toBe(3);
    expect(state.history.back).not.toHaveBeenCalled();
    expect(reloaded.open('trust')).toBe(true);
    expect(reloadedTopic).toBe('trust');
    expect(state.history.state[PLAYER_NAV_HISTORY_KEY]).toEqual(savedRoute);
    reloaded.close();
    expect(state.history.back).toHaveBeenCalledOnce();
    state.back();
    reloaded.onPop();
    expect(reloadedTopic).toBeNull();
    expect(state.history.state[PLAYER_NAV_HISTORY_KEY]).toEqual(savedRoute);
    expect(reloaded.open('trust')).toBe(true);
    expect(reloadedTopic).toBe('trust');
  });

  it('recovers a matching retained topic even before mount reconciliation without stacking history', () => {
    const state = navigationFixture();
    state.help.open('funding');
    const select = vi.fn();
    const reloaded = createDepartmentHelpNavigation(state.history, 'header', select);
    expect(reloaded.open('funding')).toBe(false);
    expect(select).toHaveBeenCalledExactlyOnceWith('funding');
    expect(state.entries).toHaveLength(3);
  });

  it('initialization preserves unrelated owners and malformed markers and tolerates remount lifecycle replay', () => {
    const state = navigationFixture();
    state.help.open('level');
    const foreign = createDepartmentHelpNavigation(state.history, 'another-header', vi.fn());
    const before = structuredClone(state.history.state);
    foreign.initialize();
    expect(state.history.state).toEqual(before);
    state.help.initialize();
    state.help.dispose();
    state.help.initialize();
    expect(state.help.open('level')).toBe(true);
    expect(state.topic()).toBe('level');
    state.history.replaceState({ ...state.history.state, [TOPBAR_HELP_HISTORY_KEY]: { owner: 'header', topic: 'invalid' } });
    const malformed = structuredClone(state.history.state);
    state.help.initialize();
    expect(state.history.state).toEqual(malformed);
    expect(state.help.open('income')).toBe(true);
    expect(state.topic()).toBe('income');
  });

  it('uses one shared history entry, ignores repeated opening and keeps the current player route', () => {
    const state = navigationFixture();
    const before = state.player.getRoute();
    expect(state.help.open('funding')).toBe(true);
    expect(state.help.open('funding')).toBe(false);
    expect(state.help.open('trust')).toBe(true);
    expect(state.entries).toHaveLength(3);
    expect(state.topic()).toBe('trust');
    expect(state.player.getRoute()).toEqual(before);
    expect(state.history.state.campaign).toBe(3);
    expect(state.history.state[PLAYER_NAV_HISTORY_KEY]).toMatchObject({ owner: 'player', route: before });
  });

  it('Back dismisses only help, Forward restores it, and repeated Close requests only one Back', () => {
    const state = navigationFixture();
    state.help.open('income');
    const route = state.player.getRoute();
    state.back();
    expect(state.topic()).toBeNull();
    expect(state.player.getRoute()).toEqual(route);
    state.forward();
    expect(state.topic()).toBe('income');
    state.help.close();
    state.help.close();
    expect(state.history.back).toHaveBeenCalledOnce();
    expect(state.help.open('trust')).toBe(false);
    state.back();
    expect(state.topic()).toBeNull();
    expect(state.player.getRoute()).toEqual(route);
    expect(state.help.open('trust')).toBe(true);
    expect(state.entries).toHaveLength(3);
  });

  it('removes only its own history marker on disposal and never goes Back for a foreign entry', () => {
    const state = navigationFixture();
    state.help.open('level');
    state.help.dispose();
    expect(state.history.state[TOPBAR_HELP_HISTORY_KEY]).toBeUndefined();
    expect(state.history.state[PLAYER_NAV_HISTORY_KEY]).toBeDefined();
    expect(state.history.state.campaign).toBe(3);
    state.help.close();
    expect(state.history.back).not.toHaveBeenCalled();
    expect(state.topic()).toBeNull();
  });
});
