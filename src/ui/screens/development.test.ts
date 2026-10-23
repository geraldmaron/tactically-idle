import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEV_NODES } from '../../content/dev-tree';
import { createInitialState } from '../../sim/department';
import { DEVELOP_HANDLERS } from '../../sim/develop';
import { nodeOptions } from '../../sim/department-selectors';
import { UpgradeIndex } from './Develop';
import { defaultStep, ladder } from './build/RoomSheet';
import { roomViews } from './build/room-model';

const NOW = Date.UTC(2026, 9, 3, 12);
const state = createInitialState(NOW, 1);
state.department.funding = 100_000;
vi.mock('../store', () => ({ useGame: () => state, send: vi.fn() }));

describe('All upgrades, the plain index', () => {
  it('lists every development once, grouped by room, with the price and what blocks it', () => {
    const views = roomViews(state);
    const html = renderToStaticMarkup(createElement(UpgradeIndex, { views, funding: state.department.funding, onOpen: () => {} }));
    expect((html.match(/data-development-node=/g) ?? [])).toHaveLength(Object.keys(DEV_NODES).length);
    for (const name of ['Personnel office', 'Training floor', 'Information room', 'Recovery room', 'Equipment bay']) expect(html).toContain(name);
    expect(html).toContain('data-ui-list');
    expect(html).toMatch(/data-development-node="intel_drone"[^>]*data-state="locked"/);
    expect(html).toContain('Needs Thermal imaging');
    expect(html).not.toMatch(/Tier ladder|Next up|role="tab"/);
  });

  it('marks what is built', () => {
    const sample = structuredClone(state);
    expect(DEVELOP_HANDLERS.unlockNode(sample, 'personnel_negotiation', 1)).toEqual({ ok: true });
    const html = renderToStaticMarkup(createElement(UpgradeIndex, { views: roomViews(sample), funding: sample.department.funding, onOpen: () => {} }));
    expect(html).toMatch(/data-development-node="personnel_negotiation"[^>]*data-state="owned"/);
  });
});

describe('the room ladder and the step a sheet opens on', () => {
  const views = roomViews(state);
  const find = (id: string) => views.find((v) => v.room.id === id)!;

  it('lays a room out as one ladder: each step right after what it needs, one level deeper', () => {
    for (const view of views) {
      const rows = ladder(view.options);
      expect(rows.map((r) => r.option.node.id).sort()).toEqual(view.options.map((o) => o.node.id).sort());
      rows.forEach((row, index) => {
        if (row.depth === 0) return;
        const parent = rows.slice(0, index).reverse().find((r) => r.depth === row.depth - 1)!;
        expect(row.option.node.requires).toContain(parent.option.node.id);
      });
    }
    const intel = ladder(find('information').options);
    expect(intel.find((r) => r.option.node.id === 'intel_drone')!.depth).toBe(1);
  });

  it('opens on the step asked for, else the next affordable one, else the last one built', () => {
    expect(defaultStep(find('information'), 'intel_drone')!.node.id).toBe('intel_drone');
    const next = defaultStep(find('recovery'))!;
    expect(next.quote.ok).toBe(true);
    const done = structuredClone(state);
    for (const id of ['wellbeing_peer_support', 'wellbeing_first_aid']) {
      for (let tier = 1; tier <= (DEV_NODES[id].tiers?.length ?? 1); tier++) expect(DEVELOP_HANDLERS.unlockNode(done, id, tier)).toEqual({ ok: true });
    }
    const view = roomViews(done).find((v) => v.room.id === 'recovery')!;
    expect(view.complete).toBe(true);
    expect(defaultStep(view)!.node.id).toBe('wellbeing_first_aid');
    expect(nodeOptions(done).filter((o) => o.node.branch === 'wellbeing').every((o) => !o.targetTier)).toBe(true);
  });
});
