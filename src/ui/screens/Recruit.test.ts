import { Children, createElement, isValidElement, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../sim/department';
import { dispatch } from '../../sim/game';
import { projectHire } from '../../sim/department-selectors';
import type { Command } from '../../sim/types';
import { Button } from '../components/ui';
import { ROLE_META } from '../components/labels';
import { money, perHour, rate } from '../format';
import { CandidateCard, candidatesWithHireReceipt, dismissHireReceipt, HireContract, Recruit, RecruitRefresh, type HireReceipt } from './Recruit';
import { CERT_NAME } from '../../content/certs';
import { personaNote } from '../../content/personas';
import { standoutLine } from './team-model';

const NOW = Date.UTC(2026, 9, 3, 12);
let state = createInitialState(NOW);
const act = vi.fn((command: Command, _message?: string) => {
  const result = dispatch(state, command, { now: NOW });
  state = result.state;
  return result.result;
});
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act }) }));
// A beat replaces the success toast: its act sends the command and plays the beat. The test records the beat spec.
const beatAct = vi.fn((command: Command, _beat: unknown) => act(command));
vi.mock('../components/Beat', () => ({ useBeat: () => ({ play: vi.fn(), act: beatAct }) }));
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children, footer) : null }));

type CapturedElement = ReactElement<{ children?: ReactNode; onClick?: (event: MouseEvent<HTMLButtonElement>) => void; disabled?: boolean }>;
function elements(node: ReactNode): CapturedElement[] {
  if (!isValidElement<CapturedElement['props']>(node)) return [];
  // Row keeps its controls in the title, detail and trail props, so those are walked as children.
  return [node, ...Children.toArray(node.props.children).flatMap(elements), ...(['lead', 'title', 'detail', 'trail'] as const).flatMap((slot) => elements((node.props as Record<string, ReactNode>)[slot]))];
}
function capture(render: () => ReactElement) {
  let tree!: ReactElement;
  function Capture() { tree = render(); return tree; }
  const html = renderToStaticMarkup(createElement(Capture));
  return { tree, html };
}
function button(tree: ReactNode, label: string) {
  const match = elements(tree).find((element) => (element.type === Button || element.type === 'button') && Children.toArray(element.props.children).join('').startsWith(label));
  expect(match, `button ${label}`).toBeDefined();
  return match!;
}
function card(open: boolean, onToggle = vi.fn(), onHired = vi.fn()) {
  const c = state.candidates[0];
  const view = capture(() => CandidateCard({ c, now: NOW, open, onToggle, onHired }));
  // The contract is its own component: render it with the props the card gave it.
  const contract = elements(view.tree).find((element) => element.type === HireContract) as ReactElement<Parameters<typeof HireContract>[0]> | undefined;
  const sheet = contract ? capture(() => HireContract(contract.props)) : null;
  return { ...view, html: view.html + (sheet?.html ?? ''), contract: contract?.props, sheet: sheet?.tree, c, onToggle, onHired };
}
const confirmHire = (view: ReturnType<typeof card>) => ({ props: { disabled: button((view.sheet as ReactElement<{ footer: ReactNode }>).props.footer, 'Confirm hire').props.disabled, onClick: (_event?: unknown) => view.contract!.onConfirm() } });

beforeEach(() => {
  state = createInitialState(NOW);
  act.mockClear();
  beatAct.mockClear();
});

describe('ordinary recruitment refresh', () => {
  it('offers a single refresh action while keeping candidate roles and qualifications', () => {
    const html = renderToStaticMarkup(createElement(Recruit));
    expect(html).toContain('Refresh candidates');
    expect(html).not.toContain('Role for next');
    expect(html).not.toContain('role to target');
    // The role rail filters the list on screen; it never targets the next search.
    expect(html).toContain('Show candidates by role');
    for (const c of state.candidates) {
      const name = `${c.officer.firstName} ${c.officer.surname}`;
      expect(html).toContain(name.replace(/'/g, '&#x27;'));
      expect(html).toContain(ROLE_META[c.officer.role].label);
      for (const cert of c.officer.certs) expect(html).toContain(CERT_NAME[cert]);
    }
    expect(html).not.toContain('Hire…');
  });

  it('shows each candidate as a dossier: their own note, one standout strength and the terms', () => {
    const html = renderToStaticMarkup(createElement(Recruit));
    const plain = html.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'");
    for (const c of state.candidates) {
      expect(html).toContain(`data-candidate="${c.id}"`);
      expect(html).toContain(`<span class="dossier-stand-label">BEST AT</span> ${standoutLine(c.officer).replace(/'/g, "&#x27;")}`);
      // The terms are funding amounts in their own markup (glyph and a spoken word), so they read as text, not as one string.
      expect(plain).toContain(`${c.officer.wage}/h funding \u00b7 ${c.signingCost.toLocaleString('en-US')} funding to sign`);
      const note = personaNote(c.officer.identityId);
      if (note) expect(html).toContain(note.replace(/'/g, '&#x27;'));
    }
    // One standout each, not a ratings table, on the list.
    expect(html).not.toContain('rating-bars');
  });

  it('only refreshes the candidate pool after the explicit refresh action', () => {
    const before = structuredClone(state);
    const { tree } = capture(() => RecruitRefresh());
    expect(act).not.toHaveBeenCalled();
    expect(state).toEqual(before);

    button(tree, 'Refresh candidates').props.onClick?.({ detail: 0 } as MouseEvent<HTMLButtonElement>);
    expect(act).toHaveBeenCalledExactlyOnceWith({ type: 'refreshCandidates' });
  });
});

describe('candidate hire review', () => {
  it('opens the contract as a sheet and closes it without hiring or charging', () => {
    const before = structuredClone(state);
    const closed = card(false);
    expect(closed.html).toContain('>Review</button>');
    expect(closed.html).toContain(`aria-label="Review hire for ${closed.c.officer.firstName} ${closed.c.officer.surname}"`);
    expect(closed.html).toContain('aria-expanded="false"');
    expect(closed.html).toContain('aria-haspopup="dialog"');
    expect(closed.html).not.toContain('Confirm hire');
    button(closed.tree, 'Review').props.onClick?.({ detail: 0 } as MouseEvent<HTMLButtonElement>);
    expect(closed.onToggle).toHaveBeenCalledOnce();

    const open = card(true);
    expect(open.html).toContain(`role="dialog" aria-label="Hire ${open.c.officer.firstName} ${open.c.officer.surname}"`);
    open.contract!.onClose();
    expect(open.onToggle).toHaveBeenCalledOnce();
    expect(act).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });

  it('shows signing, the hourly wage, the net rate before and after, and the kit before confirmation', () => {
    const view = card(true);
    const projection = projectHire(state, view.c.id);
    for (const text of ['Due at signing', money(projection.upfront), 'Every hour', `-${perHour(projection.wageDelta)}`, rate(projection.netBefore), rate(projection.netAfter), 'Brings', 'Radio headset']) {
      const plain = view.html.replace(/<[^>]+>/g, '');
      expect(plain).toContain(text);
      expect(plain.indexOf(text)).toBeLessThan(plain.indexOf('Confirm hire'));
    }
    if (view.c.issueKit) expect(view.html.replace(/<[^>]+>/g, '')).toContain(`Includes ${money(view.c.issueKit)} funding of issue kit`);
  });

  it('confirms and charges exactly once even when the same confirmation handler repeats', () => {
    const before = state.department.funding;
    const view = card(true);
    const confirm = confirmHire(view);
    confirm.props.onClick({ detail: 0 });
    confirm.props.onClick({ detail: 0 });
    // SIGNED replaces the success toast: the hire goes through the beat, with the officer's face and the hire sting.
    expect(beatAct).toHaveBeenCalledExactlyOnceWith({ type: 'hire', candidateId: view.c.id }, expect.objectContaining({ stamp: 'Signed', sting: 'hire', face: expect.objectContaining({ name: `${view.c.officer.firstName} ${view.c.officer.surname}` }) }));
    expect(act).toHaveBeenCalledExactlyOnceWith({ type: 'hire', candidateId: view.c.id });
    expect(view.onHired).toHaveBeenCalledOnce();
    expect(state.department.funding).toBe(before - view.c.signingCost);
    expect(state.candidates.some((c) => c.id === view.c.id)).toBe(false);
    expect(state.officers[view.c.officer.id]).toBeDefined();
  });

  it('retains the hired candidate at the original position, including when the pool becomes empty', () => {
    const before = state.candidates.slice();
    for (const index of [0, 1, before.length - 1]) {
      const candidate = before[index];
      const receipt = { candidate, index, projection: projectHire(state, candidate.id) };
      const remaining = before.filter((c) => c.id !== candidate.id);
      expect(candidatesWithHireReceipt(remaining, receipt).map((c) => c.id)).toEqual(before.map((c) => c.id));
      expect(candidatesWithHireReceipt(before, receipt)).toBe(before);
      expect(candidatesWithHireReceipt([], receipt)).toEqual([candidate]);
      expect(candidatesWithHireReceipt(remaining, null)).toBe(remaining);
    }
  });

  it.each([[0, 1], [1, 0]])('keeps a later live candidate after two hire receipts when Done follows order %j', (first, second) => {
    const [a, b, c] = state.candidates;
    const original: HireReceipt[] = [a, b].map((candidate, index) => ({ candidate, index, projection: projectHire(state, candidate.id) }));
    const live = [c];
    const before = structuredClone({ receipts: original, live, state });
    const displayed = (receipts: HireReceipt[]) => [...receipts].sort((x, y) => x.index - y.index).reduce(candidatesWithHireReceipt, live).map((candidate) => candidate.id);
    expect(displayed(original)).toEqual([a.id, b.id, c.id]);
    const afterFirst = dismissHireReceipt(original, original[first].candidate.id);
    expect(displayed(afterFirst)).toEqual([original[second].candidate.id, c.id]);
    const afterSecond = dismissHireReceipt(afterFirst, original[second].candidate.id);
    expect(displayed(afterSecond)).toEqual([c.id]);
    expect({ receipts: original, live, state }).toEqual(before);
    expect(dismissHireReceipt(afterFirst, original[first].candidate.id)).toBe(afterFirst);
    expect(act).not.toHaveBeenCalled();
  });

  it.each([[0, 1, 2], [2, 0, 1], [1, 2, 0]])('preserves every remaining receipt order through Done sequence %j', (first, second, third) => {
    const candidates = state.candidates.slice(0, 3);
    const original: HireReceipt[] = candidates.map((candidate, index) => ({ candidate, index, projection: projectHire(state, candidate.id) }));
    // Hiring out of display order must not make insertion order dictate the result.
    let receipts = [original[2], original[0], original[1]];
    const before = structuredClone(receipts);
    let remaining = candidates.map((candidate) => candidate.id);
    for (const index of [first, second, third]) {
      const id = candidates[index].id;
      const previous = receipts;
      const snapshot = structuredClone(previous);
      receipts = dismissHireReceipt(previous, id);
      remaining = remaining.filter((candidateId) => candidateId !== id);
      const displayed = [...receipts].sort((x, y) => x.index - y.index).reduce(candidatesWithHireReceipt, []);
      expect(displayed.map((candidate) => candidate.id)).toEqual(remaining);
      expect(previous).toEqual(snapshot);
    }
    expect([original[2], original[0], original[1]]).toEqual(before);
    expect(dismissHireReceipt(original, 'not-a-receipt')).toBe(original);
  });

  it('after a hire the contract shows success and Done, and the card keeps a receipt until dismissed', () => {
    const original = card(true);
    const projection = projectHire(state, original.c.id);
    confirmHire(original).props.onClick({ detail: 1 });
    const fundingAfterHire = state.department.funding;
    const onDone = vi.fn(), onHired = vi.fn(), onToggle = vi.fn();
    const receipt = capture(() => CandidateCard({ c: original.c, now: NOW, open: true, onToggle, onHired, receipt: projection, onDone }));
    const contract = elements(receipt.tree).find((element) => element.type === HireContract) as ReactElement<Parameters<typeof HireContract>[0]>;
    const sheet = capture(() => HireContract(contract.props));
    expect(sheet.html).toContain(`${original.c.officer.firstName} ${original.c.officer.surname} is now on your roster`);
    // The sheet's title turns to the signed state; it no longer asks to hire someone already hired.
    expect(sheet.html).toContain(`aria-label="${original.c.officer.firstName} ${original.c.officer.surname} signed"`);
    expect(sheet.html).not.toContain(`aria-label="Hire ${original.c.officer.firstName}`);
    expect(sheet.html).not.toContain('Confirm hire');
    expect(receipt.html.replace(/<[^>]+>/g, '')).toContain(`Signing ${money(projection.upfront)} funding paid`);
    expect(receipt.html).toContain('Unassigned');
    expect(receipt.html).toContain('Put them in a squad');
    // The squads are offered right on the card too, with the unassigned wage note until they are placed.
    expect(receipt.html).toContain(`Put ${original.c.officer.firstName} in a squad`);
    expect(receipt.html).toContain(`aria-label="Squad for ${original.c.officer.surname}"`);
    expect(receipt.html).toContain('Still paid');
    expect(receipt.html).not.toContain('leaves ');
    contract.props.onConfirm();
    expect(act).toHaveBeenCalledOnce();
    expect(state.department.funding).toBe(fundingAfterHire);
    const done = button(receipt.tree, 'Done');
    done.props.onClick?.({ detail: 2 } as MouseEvent<HTMLButtonElement>);
    expect(onDone).not.toHaveBeenCalled();
    done.props.onClick?.({ detail: 0 } as MouseEvent<HTMLButtonElement>);
    expect(onDone).toHaveBeenCalledOnce();
    expect(act).toHaveBeenCalledOnce();
  });

  it('rechecks a changed roster at confirmation and permits retry after a refused hire', () => {
    const before = state.department.funding;
    const view = card(true);
    const confirm = confirmHire(view);
    state.department.rosterCap = Object.keys(state.officers).length;
    confirm.props.onClick({ detail: 0 });
    expect(state.department.funding).toBe(before);
    expect(view.onHired).not.toHaveBeenCalled();
    state.department.rosterCap += 1;
    confirm.props.onClick({ detail: 0 });
    expect(act).toHaveBeenCalledTimes(2);
    expect(view.onHired).toHaveBeenCalledOnce();
    expect(state.department.funding).toBe(before - view.c.signingCost);
  });

  it('keeps an unaffordable review closable and prevents an invalid confirmation', () => {
    state.department.funding = 0;
    const view = card(true);
    const confirm = confirmHire(view);
    expect(view.html).toContain('exceeds the department');
    expect(confirm.props.disabled).toBe(true);
    confirm.props.onClick({ detail: 0 });
    view.contract!.onClose();
    expect(act).not.toHaveBeenCalled();
    expect(view.onToggle).toHaveBeenCalledOnce();
    expect(state.department.funding).toBe(0);
  });
});
