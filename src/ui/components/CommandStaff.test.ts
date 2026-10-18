import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../sim/department';
import { DEVELOP_HANDLERS } from '../../sim/develop';
import { COMMAND_STAFF } from '../../sim/command-staff';
import type { GameState } from '../../sim/types';
import { CommandStaff, ManagerSheet } from './CommandStaff';

const NOW = Date.UTC(2026, 9, 3, 12);
let state: GameState = createInitialState(NOW, 1);
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('./toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('./Sheet', () => ({ Sheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children) : null }));

function hire(nodeId: string) {
  expect(DEVELOP_HANDLERS.unlockNode(state, nodeId, 1)).toEqual({ ok: true });
}

describe('Command Staff on HQ', () => {
  it('shows a card per manager with a face, status pill and the loop it automates', () => {
    state = createInitialState(NOW, 1);
    const html = renderToStaticMarkup(createElement(CommandStaff));
    expect((html.match(/class="staff-card /g) ?? [])).toHaveLength(3);
    expect((html.match(/>Not hired</g) ?? [])).toHaveLength(3);
    for (const text of ['Watch Commander', 'Training Sergeant', 'Quartermaster', 'Squad duty and rest', 'Course enrolment', 'Servicing and restock']) expect(html).toContain(text);
    expect(html).toContain('data-portrait="unavailable"');
    expect(html).toContain('aria-label="0 of 3 hired"');
  });

  it('marks hired managers On or Off and shows their latest action', () => {
    state = createInitialState(NOW, 1);
    state.department.devPoints = 20;
    hire(COMMAND_STAFF.watchCommander.nodeId);
    hire('logistics_equipment_manager');
    state.commandStaff!.watch_commander.log.unshift({ at: NOW - 2 * 3_600_000, text: 'Rested Alpha: Lim reached 64 stress' });
    const html = renderToStaticMarkup(createElement(CommandStaff));
    expect(html).toContain('staff-card staff-card-on');
    expect(html).toContain('staff-card staff-card-off'); // the Quartermaster has no service budget yet
    expect(html).toContain('Rested Alpha: Lim reached 64 stress');
  });

  it('opens a sheet with the switch, policy and log for a hired manager, and a Develop link for the rest', () => {
    state = createInitialState(NOW, 1);
    state.department.devPoints = 20;
    hire(COMMAND_STAFF.watchCommander.nodeId);
    const hired = renderToStaticMarkup(createElement(ManagerSheet, { id: 'watch_commander', g: state, now: NOW, onClose: () => {} }));
    expect(hired).toContain('role="switch" aria-checked="true" aria-label="Watch Commander on duty"');
    expect(hired).toContain('aria-label="Stress limit"');
    expect(hired).toContain('aria-label="Watch Commander manages Alpha"');
    expect(hired).toContain('Activity log');
    expect(hired).toContain('Salary $45/h while on');
    const locked = renderToStaticMarkup(createElement(ManagerSheet, { id: 'training_sergeant', g: state, now: NOW, onClose: () => {} }));
    expect(locked).toContain('Hire in Develop');
    expect(locked).toContain('Requires Training academy');
    expect(locked).not.toContain('role="switch"');
  });
});
