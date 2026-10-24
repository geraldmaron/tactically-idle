// Patrol (station rebuild): the garage scene says who is covering and who is training, each person carries a
// recorded line, and a hire or a training start plays its beat in place of the success toast.
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personaNote } from '../../content/personas';
import { createInitialState } from '../../sim/department';
import { PATROL_GRADES, employedPatrol, patrolCandidates, patrolProfile, patrolRates } from '../../sim/patrol';
import { rotation } from '../people/story-line';
import type { Command, HandlerResult, PatrolGrade } from '../../sim/types';
import { DEFAULT_NAV, NavContext } from '../components/nav';
import { Button } from '../components/ui';
import { PatrolCommitment, PatrolScreen } from './Patrol';

const NOW = Date.UTC(2026, 9, 3, 12);
let state = createInitialState(NOW);
const beatAct = vi.fn((_cmd: Command, _beat: unknown): HandlerResult => ({ ok: true }));
vi.mock('../store', () => ({ useGame: () => state, getState: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('../components/Beat', () => ({ useBeat: () => ({ play: vi.fn(), act: beatAct }) }));
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children, footer) : null }));
beforeEach(() => { state = createInitialState(NOW); beatAct.mockClear(); });

const page = () => renderToStaticMarkup(createElement(NavContext.Provider, { value: DEFAULT_NAV }, createElement(PatrolScreen)));
type El = ReactElement<{ children?: ReactNode; onClick?: () => void }>;
const walk = (node: ReactNode): El[] => isValidElement<El['props']>(node) ? [node, ...Children.toArray(node.props.children).flatMap(walk)] : [];

describe('the patrol garage scene', () => {
  it('opens on the garage with the division switch and says how many are covering', () => {
    const html = page();
    const people = employedPatrol(state);
    const covering = patrolRates(state, state.department.clockHighWater).productive;
    expect(html).toContain('data-team-scene="patrol"');
    expect(html).toContain('aria-label="Team divisions"');
    expect(html).toContain(`${people.length} of 6 positions · ${covering} providing coverage`);
    for (const person of people) expect(html).toContain(`View ${patrolProfile(person.profileId)!.firstName} ${patrolProfile(person.profileId)!.surname}, providing coverage`);
    expect(html).toContain('data-patrol-scene-state="covering"');
    expect(html).not.toContain('in training');
  });

  it('shows who is in training, by name, and pauses their coverage', () => {
    const [first] = employedPatrol(state);
    const before = patrolRates(state, state.department.clockHighWater).productive;
    first.training = { toGrade: 2, startedAt: NOW, endsAt: NOW + 8 * 3_600_000 };
    const html = page();
    const person = patrolProfile(first.profileId)!;
    expect(html).toContain(`View ${person.firstName} ${person.surname}, in training`);
    expect(html).toContain(`${patrolRates(state, state.department.clockHighWater).productive} providing coverage`);
    expect(patrolRates(state, state.department.clockHighWater).productive).toBe(before - 1);
    expect(html).toContain('data-patrol-scene-state="training"');
  });
});

describe('patrol people have a story', () => {
  it('shows each person\u2019s state on their row, and their state first in the lines the sheet turns through', () => {
    const [first, second] = employedPatrol(state);
    first.training = { toGrade: 2, startedAt: NOW, endsAt: NOW + 8 * 3_600_000 };
    const html = page();
    const row = (employeeId: string) => html.split(`data-patrol-employee="${employeeId}"`)[1].split('</article>')[0];
    expect(row(first.id)).toContain('in training');
    expect(row(second.id)).toContain('covering');
    // The sheet that opens from the row speaks these lines (people/story-line.ts): the state leads, then the note.
    const gradeName = (grade: PatrolGrade) => PATROL_GRADES[grade].name;
    const lines = rotation({ kind: 'patrol', employee: first, gradeName }, state.department.clockHighWater);
    expect(lines[0].kind).toBe('state');
    expect(lines[0].text).toContain(`Training for ${PATROL_GRADES[2].name}.`);
    const note = personaNote(second.profileId);
    const secondLines = rotation({ kind: 'patrol', employee: second, gradeName }, state.department.clockHighWater);
    if (note) expect(secondLines.some((line) => line.kind === 'persona' && line.text === note)).toBe(true);
  });
});

describe('a patrol hire or training start plays its beat', () => {
  it('SIGNED with the new person’s painted face for a hire, and no success toast', () => {
    const profileId = patrolCandidates(state)[0].id;
    const view = renderToStaticMarkup(createElement(PatrolCommitment, { selection: { kind: 'hire', profileId }, onClose: () => {} }));
    expect(view).toContain('Confirm hire');
    let tree!: ReactElement;
    function Capture() { tree = PatrolCommitment({ selection: { kind: 'hire', profileId }, onClose: () => {} }); return tree; }
    renderToStaticMarkup(createElement(Capture));
    const confirm = walk((tree as ReactElement<{ footer: ReactNode }>).props.footer).find((el) => el.type === Button && String(Children.toArray(el.props.children).join('')).startsWith('Confirm hire'))!;
    confirm.props.onClick!();
    expect(beatAct).toHaveBeenCalledOnce();
    const [command, spec] = beatAct.mock.calls[0] as [Command, (result: HandlerResult) => unknown];
    expect(command).toEqual({ type: 'hirePatrol', profileId });
    const profile = patrolProfile(profileId)!;
    expect(spec({ ok: true, patrolReceipt: { kind: 'hire', amount: -1, sequence: 1, netDelta: 1 } })).toMatchObject({ stamp: 'Signed', sting: 'hire', face: { kind: 'patrol', name: `${profile.firstName} ${profile.surname}` }, line: PATROL_GRADES[1].name });
  });

  it('plays nothing when the hire comes back without a receipt', () => {
    const profileId = patrolCandidates(state)[0].id;
    let tree!: ReactElement;
    function Capture() { tree = PatrolCommitment({ selection: { kind: 'hire', profileId }, onClose: () => {} }); return tree; }
    renderToStaticMarkup(createElement(Capture));
    walk((tree as ReactElement<{ footer: ReactNode }>).props.footer).find((el) => el.type === Button && String(Children.toArray(el.props.children).join('')).startsWith('Confirm hire'))!.props.onClick!();
    const [, spec] = beatAct.mock.calls[0] as [Command, (result: HandlerResult) => unknown];
    expect(spec({ ok: true })).toBeNull();
  });
});
