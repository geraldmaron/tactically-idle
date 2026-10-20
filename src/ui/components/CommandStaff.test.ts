import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../sim/department';
import { DEVELOP_HANDLERS } from '../../sim/develop';
import { COMMAND_STAFF } from '../../sim/command-staff';
import type { GameState } from '../../sim/types';
import { CommandStaff, ManagerSheet } from './CommandStaff';
import { fillOpenPostsForTest } from '../../sim/staff-fixtures';
import { fillOpenPosts } from '../../sim/command-staff';

const NOW = Date.UTC(2026, 9, 3, 12);
let state: GameState = createInitialState(NOW, 1);
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('./toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('./Sheet', () => ({ Sheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children) : null }));

function hire(nodeId: string) {
  expect(DEVELOP_HANDLERS.unlockNode(state, nodeId, 1)).toEqual({ ok: true });
  fillOpenPostsForTest(state);
}

describe('Command Staff on HQ', () => {
  it('shows a card per manager with a face, status pill and the loop it automates', () => {
    state = createInitialState(NOW, 1);
    const html = renderToStaticMarkup(createElement(CommandStaff));
    expect((html.match(/class="staff-card /g) ?? [])).toHaveLength(5);
    expect((html.match(/>Not hired</g) ?? [])).toHaveLength(5);
    for (const text of ['Watch Commander', 'Training Sergeant', 'Quartermaster', 'Squad duty and rest', 'Course enrolment', 'Servicing and restock', 'Peer Support Lead', 'Recruiter', 'Officer peer support', 'Hiring']) expect(html).toContain(text);
    // Vacant posts show no face: the person arrives with the hire.
    expect(html).not.toContain('data-portrait="painted"');
    expect(html).toContain('aria-label="0 of 5 hired"');
    // A post nobody holds shows no name: the person arrives with the hire.
    expect((html.match(/>Post vacant · </g) ?? [])).toHaveLength(5);
    expect(html).not.toContain('Sam Navarro');
  });

  it('marks hired managers On or Off and shows their latest action', () => {
    state = createInitialState(NOW, 1);

    hire(COMMAND_STAFF.watchCommander.nodeId);
    hire('logistics_equipment_manager');
    state.commandStaff!.watch_commander.log.unshift({ at: NOW - 2 * 3_600_000, text: 'Rested Alpha: Lim reached 64 stress' });
    const html = renderToStaticMarkup(createElement(CommandStaff));
    expect(html).toContain('staff-card staff-card-on');
    expect(html).toContain('src="/art/managers/watch_commander.webp"');
    expect(html).toContain('staff-card staff-card-off'); // the Quartermaster has no service budget yet
    expect(html).toContain('Rested Alpha: Lim reached 64 stress');
  });

  it('opens a sheet with the switch, policy and log for a hired manager, and a Develop link for the rest', () => {
    state = createInitialState(NOW, 1);

    hire(COMMAND_STAFF.watchCommander.nodeId);
    const hired = renderToStaticMarkup(createElement(ManagerSheet, { id: 'watch_commander', g: state, now: NOW, onClose: () => {} }));
    expect(hired).toContain('role="switch" aria-checked="true" aria-label="Watch Commander on duty"');
    expect(hired).toContain('aria-label="Stress limit"');
    expect(hired).toContain('aria-label="Watch Commander manages Alpha"');
    expect(hired).toContain('Activity log');
    expect(hired).toContain('$45/h while on');
    expect(hired).toContain('Replace ');
    const locked = renderToStaticMarkup(createElement(ManagerSheet, { id: 'training_sergeant', g: state, now: NOW, onClose: () => {} }));
    expect(locked).toContain('Open the post in Develop');
    expect(locked).toContain('Requires Training academy');
    expect(locked).not.toContain('role="switch"');
  });

  it('offers three candidates for an open, vacant post, compared on the same rows', () => {
    state = createInitialState(NOW, 1);

    expect(DEVELOP_HANDLERS.unlockNode(state, COMMAND_STAFF.watchCommander.nodeId, 1)).toEqual({ ok: true });
    fillOpenPosts(state);
    const card = renderToStaticMarkup(createElement(CommandStaff));
    expect(card).toContain('>Vacant<');
    const sheet = renderToStaticMarkup(createElement(ManagerSheet, { id: 'watch_commander', g: state, now: NOW, onClose: () => {} }));
    expect((sheet.match(/class="staff-candidate"/g) ?? [])).toHaveLength(3);
    for (const kind of ['Seasoned', 'Specialist', 'Steady']) expect(sheet).toContain(`>${kind}<`);
    expect((sheet.match(/Faster recovery on rest/g) ?? []).length).toBe(3);
    expect(sheet).toContain('Sam Navarro');
    expect(sheet).not.toContain('role="switch"');
  });
});
