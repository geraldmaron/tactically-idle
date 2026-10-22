// officer-profile: the contract the rebuilt profile keeps. Cost and value up front, readiness in
// view, three tabs, and the actions that change something (teach, dismiss, move, retain) behave
// exactly once and only through the engine.
import { rankedName } from '../components/OfficerRow';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../sim/department';
import { dispatch } from '../../sim/game';
import { gameDay } from '../../sim/calendar';
import { detailRate } from '../../sim/detail';
import type { Command } from '../../sim/types';
import { Button } from '../components/ui';
import { createPlayerNavigation, DEFAULT_NAV, type PlayerRoute } from '../components/nav';
import { DismissConfirm, OfficerSheet } from './OfficerSheet';

const NOW = Date.UTC(2026, 9, 3, 12);
let state = createInitialState(NOW);
const act = vi.fn((command: Command, _message?: string) => {
  const result = dispatch(state, command, { now: NOW });
  state = result.state;
  return result.result;
});
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act, notify: vi.fn() }) }));
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children, createElement('footer', null, footer)) : null }));

type El = ReactElement<{ children?: ReactNode; onClick?: () => void; footer?: ReactNode; 'aria-label'?: string }>;
function elements(node: ReactNode): El[] {
  if (!isValidElement<El['props']>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elements)];
}
const html = (officerId: string, initialTab: 'overview' | 'career' | 'care' = 'overview') => renderToStaticMarkup(createElement(OfficerSheet, { officerId, onClose: () => {}, initialTab }));
/** The footer's actions, rendered through their component so their buttons can be pressed. */
function footerButtons(officerId: string) {
  let tree!: ReactElement;
  function Capture() { tree = OfficerSheet({ officerId, onClose: () => {} }); return tree; }
  renderToStaticMarkup(createElement(Capture));
  const actions = (tree as El).props.footer as ReactElement<Record<string, unknown>>;
  let rendered!: ReactElement;
  function CaptureActions() { rendered = (actions.type as (props: unknown) => ReactElement)(actions.props); return rendered; }
  renderToStaticMarkup(createElement(CaptureActions));
  return elements(rendered).filter((element) => element.type === Button);
}
const press = (buttons: El[], label: RegExp) => {
  const button = buttons.find((b) => label.test(String(b.props['aria-label'] ?? Children.toArray(b.props.children).join(''))));
  expect(button, String(label)).toBeDefined();
  button!.props.onClick?.();
};

beforeEach(() => {
  state = createInitialState(NOW);
  act.mockClear();
});

describe('officer profile', () => {
  it('leads with cost and value, readiness, and three tabs', () => {
    const o = state.officers.off_brooks;
    const page = html(o.id);
    expect(page).toContain('aria-label="Cost and value"');
    expect(page).toContain(`>$${o.wage}/h<`);
    expect(page).toContain(`+$${detailRate(o)}/h`);
    expect(page).toContain('aria-label="Readiness"');
    expect(page).toContain(`Ready · stress ${Math.floor(o.stress)}`);
    expect(page).toContain(rankedName(o));
    for (const tab of ['Overview', 'Career', 'Care']) expect(page).toContain(`>${tab}</`);
    expect(page).not.toContain('<details class="osheet-more"');
  });

  it('says an uncertified officer cannot teach, and sends a certified one on a detail once', () => {
    expect(html('off_reyes')).toContain('No cert');
    press(footerButtons('off_brooks'), /instructor detail/);
    expect(act).toHaveBeenCalledExactlyOnceWith({ type: 'startDetail', officerId: 'off_brooks' }, expect.stringContaining('teaches'));
    expect(state.officers.off_brooks.assignment?.kind).toBe('detail');
    expect(html('off_brooks')).toContain('Teaching, back');
  });

  it('dismisses only after a confirmation that shows severance, and only once', () => {
    press(footerButtons('off_reyes'), /^Dismiss/);
    expect(act).not.toHaveBeenCalled();
    const onDone = vi.fn();
    let tree!: ReactElement;
    function Capture() { tree = DismissConfirm({ officer: state.officers.off_reyes, onCancel: () => {}, onDone }); return tree; }
    const confirm = renderToStaticMarkup(createElement(Capture));
    expect(confirm).toMatch(/Severance \$[\d,]+/);
    press(elements(tree).filter((element) => element.type === Button), /Confirm dismissal/);
    expect(act).toHaveBeenCalledExactlyOnceWith({ type: 'dismiss', officerId: 'off_reyes' }, expect.stringContaining('dismissed'));
    expect(onDone).toHaveBeenCalledOnce();
    expect(state.officers.off_reyes).toBeUndefined();
  });

  it('shows a queued squad move for an officer out on a call', () => {
    state.officers.off_chen.assignment = { kind: 'operation', runId: 'run_x' };
    state.pendingSquadMoves = [{ officerId: 'off_chen', squadId: 'B', queuedAt: NOW }];
    const page = html('off_chen');
    expect(page).toContain('After this call, joins Bravo');
    expect(page).toContain('Remove after the call');
  });

  it('offers retention once, on the Career tab, for a service retirement', () => {
    const o = state.officers.off_okafor;
    o.retirement = { day: gameDay(state, NOW) + 20, reason: 'service', announcedDay: gameDay(state, NOW), extended: false };
    expect(html(o.id, 'career')).toContain('Offer retention');
    o.retirement.extended = true;
    const once = html(o.id, 'career');
    expect(once).not.toContain('Offer retention');
    expect(once).toContain('already been persuaded to stay once');
  });
});

describe('profile navigation', () => {
  it('opens over the current tab and Back closes it without leaving the tab', () => {
    const entries: Record<string, unknown>[] = [{}];
    let position = 0, backs = 0;
    let current: PlayerRoute = { ...DEFAULT_NAV };
    const history = {
      get state() { return entries[position]; },
      pushState(data: Record<string, unknown>) { entries.splice(position + 1); entries.push(data); position++; },
      replaceState(data: Record<string, unknown>) { entries[position] = data; },
      back() { backs++; position--; nav.onPop(); },
    };
    const nav = createPlayerNavigation(history, 'p', (route) => { current = route; });
    nav.initialize();
    nav.go('squad');
    nav.openOfficer('off_chen');
    expect(current).toMatchObject({ tab: 'squad', officerId: 'off_chen' });
    nav.closeOfficer();
    expect(backs).toBe(1);
    expect(current).toMatchObject({ tab: 'squad', officerId: null });
    nav.openOfficer('off_chen');
    nav.go('gear');
    expect(current).toMatchObject({ tab: 'gear', officerId: null });
  });
});
