import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../sim/department';
import { DEVELOP_HANDLERS } from '../../sim/develop';
import { nodeOptions } from '../../sim/department-selectors';
import { BeatContext } from '../components/Beat';
import { DEFAULT_NAV, NavContext } from '../components/nav';
import { BuildScreen } from './Build';
import { RoomSheet } from './build/RoomSheet';
import { Station, stationRooms } from './build/Station';
import { garageView, roomViews } from './build/room-model';

const NOW = Date.UTC(2026, 9, 3, 12);
const state = createInitialState(NOW, 1);
state.department.funding = 20_000;
vi.mock('../store', () => ({ useGame: () => state, send: vi.fn() }));
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children, footer) : null }));
const beat = { play: vi.fn(), act: vi.fn() };
const page = () => renderToStaticMarkup(createElement(NavContext.Provider, { value: DEFAULT_NAV }, createElement(BeatContext.Provider, { value: beat }, createElement(BuildScreen))));

describe('the Build screen as the station', () => {
  it('draws the dark diorama, a light per room, one tap target per room and the caption', () => {
    const html = page();
    expect(html).toContain('scene_facilities_plan_dark.webp');
    expect((html.match(/class="station-light"/g) ?? [])).toHaveLength(6);
    expect((html.match(/class="scene-spot /g) ?? [])).toHaveLength(6);
    expect(html).toContain('1 of 6 rooms open');
    expect(html).toContain('Westhaven Department');
    expect(html).toMatch(/data-room="garage" data-open="yes"/);
  });

  it('suggests one room, lists six cards and folds the plain index below them', () => {
    const html = page();
    expect((html.match(/Next for the station/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((html.match(/class="room-card"/g) ?? [])).toHaveLength(6);
    expect(html.indexOf('room-list')).toBeLessThan(html.indexOf('data-disclosure="all-department-upgrades"'));
    expect(html).toContain('data-ui-list');
    expect(html).not.toMatch(/\b\d+\/\d+\b[^<]*<\/span><\/span><span class="ui-row-trail/);
  });

  it('says what a room does for people and never uses the next step as its description', () => {
    const html = page();
    expect(html).toContain('Somewhere to sit down after a bad call.');
    expect(html).not.toContain('Department plan');
  });

  it('marks an affordable step with its price, never with the tick that means built', () => {
    const html = page();
    // A step that can be bought shows its price in a plain or hot capsule (the next step is hot); the tick
    // and the lock lead only the owned and locked capsules.
    expect(html).toMatch(/class="price-capsule" data-tone="(?:plain|hot)"><span class="funds">/);
    expect(html).not.toMatch(/class="price-capsule" data-tone="(?:plain|hot|short)"><svg/);
    expect(html).toMatch(/class="next-card"[^>]*aria-label="Next for the station:[^"]*Ready to build\./);
  });

  it('labels an unbuilt, affordable room as ready to build for assistive technology', () => {
    const rooms = stationRooms(roomViews(state), garageView(state));
    const html = renderToStaticMarkup(createElement(Station, { rooms, name: 'Test', fresh: null, onOpen: () => {} }));
    expect(html).toContain('aria-label="Recovery room, not built, ready to build"');
    expect(html).toContain('aria-label="Garage, open, 4 of 6 patrol positions filled"');
  });
});

describe('the room sheet', () => {
  const sheet = (nodeId: string, game = state) => {
    const view = roomViews(game).find((v) => v.options.some((o) => o.node.id === nodeId))!;
    const step = view.options.find((o) => o.node.id === nodeId)!;
    return renderToStaticMarkup(createElement(NavContext.Provider, { value: DEFAULT_NAV },
      createElement(RoomSheet, { game, view, step, now: NOW, pending: false, onSelect: () => {}, onOpenRoom: () => {}, onBuy: () => {}, onClose: () => {} })));
  };

  it('shows the painting, one effect line, who it helps with before and after, and the ladder', () => {
    const html = sheet('wellbeing_peer_support');
    expect(html).toContain('room_recovery_dark.webp');
    expect(html).toContain('Stress comes off 50% faster');
    expect(html).toContain('Who it helps');
    expect(html).toMatch(/<s>3\/h<\/s><b>4\.5\/h<\/b>/);
    expect(html).toContain('The ladder');
    expect(html).toContain('Build tier I for 2,600 funding');
    expect(html).not.toMatch(/You get|>Gives<|Tier ladder/);
  });

  it('teases a locked step and links to what it needs', () => {
    const html = sheet('wellbeing_first_aid');
    expect(html).toContain('Needs Peer support program');
    expect(html).toContain('Unlocks Advanced first aid');
    expect(html).not.toContain('btn-primary');
  });

  it('turns to a finished state once every tier is built', () => {
    const done = structuredClone(state);
    for (let tier = 1; tier <= 3; tier++) expect(DEVELOP_HANDLERS.unlockNode(done, 'wellbeing_peer_support', tier)).toEqual({ ok: true });
    const html = sheet('wellbeing_peer_support', done);
    expect(html).toContain('Fully built');
    expect(html).not.toContain('Build tier');
    expect(nodeOptions(done).find((o) => o.node.id === 'wellbeing_peer_support')!.targetTier).toBeNull();
  });
});
