import { createElement, type FunctionComponent, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../sim/department';
import { DEVELOP_HANDLERS } from '../../sim/develop';
import { COMMAND_STAFF, MANAGERS, MANAGER_IDS } from '../../sim/command-staff';
import { seatPreview } from '../screens/team-model';
import type { GameState } from '../../sim/types';
import { CommandStaff, ManagerSheet } from './CommandStaff';
import { fillOpenPostsForTest } from '../../sim/staff-fixtures';
import { fillOpenPosts } from '../../sim/command-staff';

const NOW = Date.UTC(2026, 9, 3, 12);
let state: GameState = createInitialState(NOW, 1);
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('./toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('./Beat', () => ({ useBeat: () => ({ play: vi.fn(), act: vi.fn() }) }));
vi.mock('./Sheet', () => ({ Sheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children) : null }));

function hire(nodeId: string) {
  expect(DEVELOP_HANDLERS.unlockNode(state, nodeId, 1)).toEqual({ ok: true });
  fillOpenPostsForTest(state);
}

describe('Command Staff on HQ', () => {
  it('shows the next post as a row on a new campaign, and every post behind Show all', () => {
    state = createInitialState(NOW, 1);
    const html = renderToStaticMarkup(createElement(CommandStaff));
    expect((html.match(/class="ui-row staff-row /g) ?? [])).toHaveLength(1);
    expect(html).toContain('0 of 5 hired');
    expect(html).toContain('Show all 5 posts');
    for (const text of ['Watch Commander', 'Automating squad duty and rest']) expect(html).toContain(text);
    // Vacant posts show no face and no name: the person arrives with the hire.
    expect(html).not.toContain('data-portrait="painted"');
    expect(html).not.toContain('Sam Navarro');
  });

  it('marks hired managers On or Off and shows their latest action', () => {
    state = createInitialState(NOW, 1);

    hire(COMMAND_STAFF.watchCommander.nodeId);
    hire('logistics_equipment_manager');
    state.commandStaff!.watch_commander.log.unshift({ at: NOW - 2 * 3_600_000, text: 'Rested Alpha: Lim reached 64 stress' });
    const html = renderToStaticMarkup(createElement(CommandStaff));
    expect(html).toContain('staff-row staff-row-on');
    expect(html).toContain('src="/art/managers/watch_commander.webp"');
    expect(html).toContain('staff-row staff-row-off'); // the Quartermaster has no service budget yet
    expect(html).toContain('Rested Alpha: Lim reached 64 stress');
  });

  it('opens a sheet with the switch, policy and log for a hired manager, and an Upgrades link for the rest', () => {
    state = createInitialState(NOW, 1);

    hire(COMMAND_STAFF.watchCommander.nodeId);
    const hired = renderToStaticMarkup(createElement(ManagerSheet, { id: 'watch_commander', g: state, now: NOW, onClose: () => {} }));
    expect(hired).toContain('role="switch" aria-checked="true" aria-label="Watch Commander on duty"');
    expect(hired).toContain('aria-label="Stress limit"');
    expect(hired).toContain('aria-label="Watch Commander manages Alpha"');
    expect(hired).toContain('Activity log');
    expect(hired).toMatch(/45\/h<span class=\"sr-only\"> funding<\/span><\/span> while on/);
    expect(hired).toContain('Replace ');
    const locked = renderToStaticMarkup(createElement(ManagerSheet, { id: 'training_sergeant', g: state, now: NOW, onClose: () => {} }));
    expect(locked).toContain('Open the post in Upgrades');
    expect(locked).toContain('Requires Training academy');
    expect(locked).not.toContain('role="switch"');
  });

  it('offers three candidates for an open, vacant post, compared on the same rows', () => {
    state = createInitialState(NOW, 1);

    expect(DEVELOP_HANDLERS.unlockNode(state, COMMAND_STAFF.watchCommander.nodeId, 1)).toEqual({ ok: true });
    fillOpenPosts(state);
    const card = renderToStaticMarkup(createElement(CommandStaff));
    expect(card).toContain('Post vacant · 3 candidates to choose from');
    const sheet = renderToStaticMarkup(createElement(ManagerSheet, { id: 'watch_commander', g: state, now: NOW, onClose: () => {} }));
    expect((sheet.match(/class="staff-candidate"/g) ?? [])).toHaveLength(3);
    for (const kind of ['Seasoned', 'Specialist', 'Steady']) expect(sheet).toContain(`>${kind}<`);
    expect((sheet.match(/Faster recovery on rest/g) ?? []).length).toBe(3);
    expect(sheet).toContain('Sam Navarro');
    expect(sheet).not.toContain('role="switch"');
  });
});

describe('Command Staff in the Team command room', () => {
  const Staff = CommandStaff as FunctionComponent<{ allPosts?: boolean; composition?: 'list' | 'room'; scene?: (posts: ReactNode) => ReactNode }>;
  const room = (scene = (posts: ReactNode) => createElement('div', { className: 'scene' }, posts)) => renderToStaticMarkup(createElement(Staff, { allPosts: true, composition: 'room', scene }));

  it('puts the posts in the scene it is given, with every seat present and the section heading kept for readers', () => {
    state = createInitialState(NOW, 1);
    const html = room();
    expect(html).toContain('<div class="scene">');
    expect(html).not.toContain('command-room" aria-label');
    expect((html.match(/class="command-room-post /g) ?? [])).toHaveLength(MANAGER_IDS.length);
    expect(html).toContain('id="command-staff-title"');
  });

  it('says on each empty seat what the post would do now, from the post’s own duty text', () => {
    state = createInitialState(NOW, 1);
    const html = room();
    for (const id of MANAGER_IDS) expect(html).toContain(seatPreview(state, id, MANAGERS[id].duty).replace(/'/g, '&#x27;'));
    expect(html).toContain('Would fill ');
  });

  it('shows a hired manager’s last logged action from their seat', () => {
    state = createInitialState(NOW, 1);
    hire(COMMAND_STAFF.watchCommander.nodeId);
    state.commandStaff!.watch_commander.log.unshift({ at: state.department.clockHighWater - 2 * 3_600_000, text: 'Rested Alpha: Lim reached 64 stress' });
    const html = room();
    expect(html).toContain('Rested Alpha: Lim reached 64 stress, ');
    expect(html).toContain('src="/art/managers/watch_commander.webp"');
  });

  it('keeps the room’s compact seats to their one short state, with what a post does and costs below the strip', () => {
    state = createInitialState(NOW, 1);
    const html = room();
    // Every post is a compact seat in the one strip (canvas pass, 2026-10-24): no seat carries a preview line.
    expect((html.match(/class="command-room-post [^"]*command-room-post-compact/g) ?? [])).toHaveLength(MANAGER_IDS.length);
    expect(html).not.toContain('command-room-said');
    expect((html.match(/class="command-room-state">(?:Build|Vacant|Locked|On duty|Off duty)/g) ?? [])).toHaveLength(MANAGER_IDS.length);
  });
});

