// gear-armory: the Armory's one filter rail and what an owned tile says about its stock.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeState } from '../../sim/test-fixtures';
import { DEFAULT_NAV, NavContext } from '../components/nav';
import { EquipmentStore } from './EquipmentStore';
import { armoryView, catalogEntries, DEFAULT_EQUIPMENT_QUERY, equipmentFacets, queryEquipment, withArmoryView, type EquipmentQuery } from './store-query';

let state = makeState();
let query: EquipmentQuery = { ...DEFAULT_EQUIPMENT_QUERY };
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn() }) }));
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children, footer) : null }));

const render = () => renderToStaticMarkup(createElement(NavContext.Provider, { value: { ...DEFAULT_NAV, equipmentQuery: query, setEquipmentQuery: (next) => { query = next; } } }, createElement(EquipmentStore, { active: true })));

beforeEach(() => {
  state = makeState();
  query = { ...DEFAULT_EQUIPMENT_QUERY };
});

describe('Armory filter rail', () => {
  it('replaces the collapsed filter box with an always visible rail that counts each view', () => {
    const html = render();
    const facets = equipmentFacets(catalogEntries(state), DEFAULT_EQUIPMENT_QUERY);
    expect(html).not.toContain('<details');
    expect(html).toContain('aria-label="Show equipment"');
    expect(html).toContain(`aria-label="Owned, ${facets.ownership.owned}"`);
    expect(html).toContain(`aria-label="Buy now, ${facets.availability.buy_now}"`);
  });

  it('maps each view onto the query and back, clearing the other views', () => {
    for (const view of ['all', 'owned', 'attention', 'buy'] as const) {
      const next = withArmoryView({ ...DEFAULT_EQUIPMENT_QUERY, ownership: 'owned', availability: 'buy_now', affordable: true }, view);
      expect(armoryView(next)).toBe(view);
      expect(next.affordable).toBe(false);
    }
  });

  it('flags owned stock that needs looking at, and the attention view shows only that', () => {
    const radio = Object.values(state.units).find((unit) => unit.itemId === 'radio_kit')!;
    radio.condition = 30; // below unreliableBelow (45), above failAt (15)
    const entries = catalogEntries(state);
    const radios = entries.find((entry) => entry.item.id === 'radio_kit')!;
    expect(radios.needsAttention).toBe(true);
    const shown = queryEquipment(entries, withArmoryView(DEFAULT_EQUIPMENT_QUERY, 'attention'));
    expect(shown.every((entry) => entry.needsAttention)).toBe(true);
    expect(shown.map((entry) => entry.item.id)).toContain('radio_kit');
    expect(render()).toMatch(/aria-label="Radio headset[^"]*\d+ owned, \d+ ready, condition \d+%, \d+ unreliable/);
  });

  it('opens one sheet for an owned item that holds purchase, stock and units', () => {
    const html = renderToStaticMarkup(createElement(NavContext.Provider, { value: { ...DEFAULT_NAV, equipmentItemId: 'radio_kit', equipmentQuery: query, setEquipmentQuery: () => {} } }, createElement(EquipmentStore, { active: true })));
    expect(html).toContain('aria-label="Your stock"');
    expect(html).toContain('aria-label="Units"');
    expect(html).toMatch(/Buy 1 ·/);
  });
});
