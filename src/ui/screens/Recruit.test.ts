import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../sim/department';
import { dispatch } from '../../sim/game';
import { projectHire } from '../../sim/department-selectors';
import type { Command, Role } from '../../sim/types';
import { ChoiceRail } from '../components/ChoiceRail';
import { Button } from '../components/ui';
import { money, perHour, rate } from '../format';
import { CandidateCard, Recruit, RecruitRefresh } from './Recruit';

const NOW = Date.UTC(2026, 9, 3, 12);
let state = createInitialState(NOW);
const act = vi.fn((command: Command, _message?: string) => {
  const result = dispatch(state, command, { now: NOW });
  state = result.state;
  return result.result;
});
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act }) }));

type CapturedElement = ReactElement<{ children?: ReactNode; onClick?: () => void; onChange?: (role: Role | 'any') => void; disabled?: boolean }>;
function elements(node: ReactNode): CapturedElement[] {
  if (!isValidElement<CapturedElement['props']>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elements)];
}
function capture(render: () => ReactElement) {
  let tree!: ReactElement;
  function Capture() { tree = render(); return tree; }
  const html = renderToStaticMarkup(createElement(Capture));
  return { tree, html };
}
function button(tree: ReactNode, label: string) {
  const match = elements(tree).find((element) => element.type === Button && Children.toArray(element.props.children).join('').startsWith(label));
  expect(match, `button ${label}`).toBeDefined();
  return match!;
}
function card(open: boolean, onToggle = vi.fn(), onHired = vi.fn()) {
  const c = state.candidates[0];
  return { ...capture(() => CandidateCard({ c, now: NOW, open, onToggle, onHired })), c, onToggle, onHired };
}

beforeEach(() => {
  state = createInitialState(NOW);
  act.mockClear();
});

describe('recruitment role selection', () => {
  it('uses one accessible choice rail with six complete labels and next-refresh context', () => {
    const html = renderToStaticMarkup(createElement(Recruit));
    expect(html).toContain('Role for next refresh');
    expect(html).toContain('Choose the role to target when you refresh candidates.');
    expect(html).toContain('class="choice-rail choice-rail-grow" role="radiogroup" aria-label="Role for next candidate refresh"');
    expect(html.match(/role="radio"/g)).toHaveLength(6);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    for (const label of ['Any', 'Communication', 'Entry', 'Medical', 'Observation', 'Leadership']) expect(html).toContain(`>${label}</button>`);
    for (const c of state.candidates) expect(html).toContain(`${c.officer.firstName} ${c.officer.surname}`);
    expect(html).not.toContain('Hire…');
  });

  it.each([null, 'medic'] as const)('only refreshes the candidate pool after the explicit refresh action (%s)', (target) => {
    const onTargetChange = vi.fn();
    const before = structuredClone(state);
    const { tree } = capture(() => RecruitRefresh({ target, onTargetChange }));
    const rail = elements(tree).find((element) => element.type === ChoiceRail)!;
    rail.props.onChange?.('recon');
    expect(onTargetChange).toHaveBeenLastCalledWith('recon');
    rail.props.onChange?.('any');
    expect(onTargetChange).toHaveBeenLastCalledWith(null);
    expect(act).not.toHaveBeenCalled();
    expect(state).toEqual(before);

    button(tree, 'Refresh candidates').props.onClick?.();
    expect(act).toHaveBeenCalledExactlyOnceWith(target ? { type: 'refreshCandidates', targetRole: target } : { type: 'refreshCandidates' });
    if (target) expect(state.candidates.some((c) => c.officer.role === target)).toBe(true);
  });
});

describe('candidate hire review', () => {
  it('opens an explicit review and cancels without hiring or charging', () => {
    const before = structuredClone(state);
    const closed = card(false);
    expect(closed.html).toContain('>Review hire</button>');
    expect(closed.html).toContain('aria-expanded="false"');
    expect(closed.html).not.toContain('Confirm hire');
    button(closed.tree, 'Review hire').props.onClick?.();
    expect(closed.onToggle).toHaveBeenCalledOnce();

    const open = card(true);
    expect(open.html).toContain('>Cancel</button>');
    expect(open.html).toContain(`aria-controls="hire-review-${open.c.id}"`);
    expect(open.html).toContain(`id="hire-review-${open.c.id}" role="region"`);
    button(open.tree, 'Cancel').props.onClick?.();
    expect(open.onToggle).toHaveBeenCalledOnce();
    expect(act).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });

  it('shows the full signing, wage and net projection before confirmation', () => {
    const view = card(true);
    const projection = projectHire(state, view.c.id);
    for (const text of ['Signing cost', money(projection.upfront), 'Wage change', `+${perHour(projection.wageDelta)}`, 'Net funding', `${rate(projection.netBefore)} → ${rate(projection.netAfter)}`]) {
      expect(view.html).toContain(text);
      expect(view.html.indexOf(text)).toBeLessThan(view.html.indexOf('Confirm hire'));
    }
  });

  it('confirms and charges exactly once even when the same confirmation handler repeats', () => {
    const before = state.department.funding;
    const view = card(true);
    const confirm = button(view.tree, 'Confirm hire');
    confirm.props.onClick?.();
    confirm.props.onClick?.();
    expect(act).toHaveBeenCalledExactlyOnceWith({ type: 'hire', candidateId: view.c.id }, `${view.c.officer.surname} hired`);
    expect(view.onHired).toHaveBeenCalledOnce();
    expect(state.department.funding).toBe(before - view.c.signingCost);
    expect(state.candidates.some((c) => c.id === view.c.id)).toBe(false);
    expect(state.officers[view.c.officer.id]).toBeDefined();
  });

  it('rechecks a changed roster at confirmation and permits retry after a refused hire', () => {
    const before = state.department.funding;
    const view = card(true);
    const confirm = button(view.tree, 'Confirm hire');
    state.department.rosterCap = Object.keys(state.officers).length;
    confirm.props.onClick?.();
    expect(state.department.funding).toBe(before);
    expect(view.onHired).not.toHaveBeenCalled();
    state.department.rosterCap += 1;
    confirm.props.onClick?.();
    expect(act).toHaveBeenCalledTimes(2);
    expect(view.onHired).toHaveBeenCalledOnce();
    expect(state.department.funding).toBe(before - view.c.signingCost);
  });

  it('keeps an unaffordable review cancelable and prevents an invalid confirmation', () => {
    state.department.funding = 0;
    const view = card(true);
    const confirm = button(view.tree, 'Confirm hire');
    expect(view.html).toContain('exceeds funding');
    expect(confirm.props.disabled).toBe(true);
    confirm.props.onClick?.();
    button(view.tree, 'Cancel').props.onClick?.();
    expect(act).not.toHaveBeenCalled();
    expect(view.onToggle).toHaveBeenCalledOnce();
    expect(state.department.funding).toBe(0);
  });
});
