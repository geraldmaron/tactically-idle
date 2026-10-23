// Patrol (station rebuild): the garage scene says who is covering and who is training, each person carries a
// recorded line, and a hire or a training start plays its beat in place of the success toast.
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personaNote } from '../../content/personas';
import { createInitialState } from '../../sim/department';
import { PATROL_GRADES, employedPatrol, patrolCandidates, patrolProfile } from '../../sim/patrol';
import type { Command, HandlerResult } from '../../sim/types';
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
  it('opens on the garage with the section switch and says who is covering', () => {
    const html = page();
    const people = employedPatrol(state);
    expect(html).toContain('data-team-scene="patrol"');
    expect(html).toContain('aria-label="Team sections"');
    expect(html).toContain(`${people.length} of 6 positions`);
    expect(html).toContain(`Covering: ${people.map((p) => patrolProfile(p.profileId)!.firstName).join(', ')}.`);
    expect(html).not.toContain('In training:');
  });

  it('shows who is in training, by name, and pauses their coverage', () => {
    const [first] = employedPatrol(state);
    first.training = { toGrade: 2, startedAt: NOW, endsAt: NOW + 8 * 3_600_000 };
    const html = page();
    expect(html).toContain(`In training: ${patrolProfile(first.profileId)!.firstName}.`);
    expect(html).toContain('data-patrol-scene-state="training"');
  });
});

describe('patrol people have a story', () => {
  it('gives each person their note, or the state they are in, from what the game records', () => {
    const [first, second] = employedPatrol(state);
    first.training = { toGrade: 2, startedAt: NOW, endsAt: NOW + 8 * 3_600_000 };
    const html = page();
    expect(html).toContain(`Training for ${PATROL_GRADES[2].name}.`);
    const note = personaNote(second.profileId);
    if (note) expect(html).toContain(note.replace(/'/g, '&#x27;'));
    expect(html).toContain('data-story="state"');
    expect(html).toContain('data-story="persona"');
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
