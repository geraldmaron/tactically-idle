import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../content/items';
import { DEV_NODES } from '../../content/dev-tree';
import { itemCheck } from '../../sim/develop';
import { makeState, NOW } from '../../sim/test-fixtures';
import { activeEquipmentFilterCount, catalogEntries, DEFAULT_EQUIPMENT_QUERY, equipmentFacets, queryEquipment, type CatalogEntry, type EquipmentQuery } from './store-query';

const query = (patch: Partial<EquipmentQuery> = {}): EquipmentQuery => ({ ...DEFAULT_EQUIPMENT_QUERY, ...patch });
const ids = (rows: CatalogEntry[]) => rows.map((row) => row.item.id);

describe('store catalog queries', () => {
  it('keeps the entire playable catalog discoverable, including zero-owned and locked equipment', () => {
    const state = makeState();
    const entries = catalogEntries(state);
    expect(entries).toHaveLength(Object.keys(ITEMS).length);
    expect(ids(entries)).not.toContain('battery_pack');
    expect(ids(queryEquipment(entries, query()))).toContain('armored_rescue_vehicle');
    const locked = entries.find((row) => row.item.id === 'armored_rescue_vehicle')!;
    expect(locked.owned).toBe(0);
    expect(locked.unlocked).toBe(false);
    expect(locked.canBuy).toBe(false);
  });

  it('searches case-insensitive aliases, categories, effects and multiple words', () => {
    const entries = catalogEntries(makeState());
    expect(ids(queryEquipment(entries, query({ search: 'BeArCaT' })))).toEqual(['armored_rescue_vehicle']);
    expect(queryEquipment(entries, query({ search: 'vehicles' })).length).toBeGreaterThan(0);
    const binoculars = entries.find((row) => row.item.id === 'observation_binoculars')!;
    const firstEffectWord = binoculars.item.helpsWith![0].split(/\s+/)[0];
    expect(ids(queryEquipment(entries, query({ search: `binoculars ${firstEffectWord}` })))).toContain('observation_binoculars');
    expect(queryEquipment(entries, query({ search: 'binoculars impossiblematchingword' }))).toEqual([]);
  });

  it('combines search, category, availability, affordability and ownership with AND', () => {
    const state = makeState();
    state.department.funding = 500;
    const entries = catalogEntries(state);
    expect(ids(queryEquipment(entries, query({ search: 'radio', category: 'comms', availability: 'buy_now', affordable: true, ownership: 'owned' })))).toEqual(['radio_kit']);
    expect(queryEquipment(entries, query({ search: 'radio', category: 'vehicles', affordable: true, ownership: 'owned' }))).toEqual([]);
    expect(queryEquipment(entries, query({ search: 'radio', category: 'comms', ownership: 'not_owned', availability: 'buy_now' }))).toEqual([]);
  });

  it('keeps unlock, affordability, certification and ready stock independent', () => {
    const state = makeState({ inventory: { camera_drone: 0 } });
    state.department.funding = 100_000;
    const locked = catalogEntries(state).find((row) => row.item.id === 'camera_drone')!;
    expect(locked).toMatchObject({ unlocked: false, affordable: true, owned: 0, ready: 0 });
    expect(locked.qualified).toBeGreaterThan(0);
    state.department.unlockedNodes.push('intel_drone');
    const available = catalogEntries(state).find((row) => row.item.id === 'camera_drone')!;
    expect(available).toMatchObject({ unlocked: true, affordable: true, canBuy: true, ready: 0 });
  });

  it('counts each facet with every other filter still applied', () => {
    const entries = catalogEntries(makeState());
    const selection = query({ search: 'radio', category: 'vehicles', ownership: 'owned' });
    const facets = equipmentFacets(entries, selection);
    expect(queryEquipment(entries, selection)).toHaveLength(0);
    expect(facets.categories.comms).toBe(1);
    expect(facets.categories.all).toBe(1);
    expect(facets.categories.vehicles).toBe(0);
    expect(facets.ownership.all).toBe(0);
    expect(facets.availability.all).toBe(0);
  });

  it('sorts funding in both directions and breaks equal names deterministically by ID', () => {
    const entries = catalogEntries(makeState());
    const ascending = queryEquipment(entries, query({ sort: 'cost_asc' }));
    expect(ascending[0].item.cost).toBe(Math.min(...entries.map((entry) => entry.item.cost)));
    expect(queryEquipment(entries, query({ sort: 'cost_desc' }))[0].item.cost).toBe(Math.max(...entries.map((entry) => entry.item.cost)));
    const same = entries[0];
    const a = { ...same, item: { ...same.item, id: 'a', name: 'Same' } };
    const z = { ...same, item: { ...same.item, id: 'z', name: 'Same' } };
    expect(ids(queryEquipment([z, a], query({ sort: 'name' })))).toEqual(['a', 'z']);
  });

  it('orders recently unlocked by recorded node order without mutating campaign state', () => {
    const state = makeState({ unlockedNodes: ['intel_drone', 'field_contact_kit'] });
    const before = structuredClone(state);
    const sorted = queryEquipment(catalogEntries(state), query({ sort: 'recent' }));
    expect(sorted.findIndex((row) => row.item.id === 'throw_phone')).toBeLessThan(sorted.findIndex((row) => row.item.id === 'camera_drone'));
    expect(state).toEqual(before);
  });

  it('flags shortages against ready units and explicit targets, not simply unowned catalog entries', () => {
    const state = makeState({ inventory: { trauma_kit: 0 } });
    state.department.restockRules.push({ itemId: 'trauma_kit', target: 3, budgetCeiling: ITEMS.trauma_kit.cost * 3 });
    const radio = Object.values(state.units).filter((unit) => unit.itemId === 'radio_kit');
    for (const unit of radio) { unit.status = 'service'; unit.serviceUntil = NOW + 60_000; }
    const entries = catalogEntries(state);
    const shortages = ids(queryEquipment(entries, query({ ownership: 'replenish' })));
    expect(shortages).toContain('trauma_kit');
    expect(shortages).toContain('radio_kit');
    expect(shortages).not.toContain('armored_rescue_vehicle');
  });

  it('clear defaults remove every filter and restore the complete catalog', () => {
    expect(activeEquipmentFilterCount(query({ search: 'test', category: 'comms', availability: 'locked', affordable: true, ownership: 'owned' }))).toBe(5);
    expect(activeEquipmentFilterCount(DEFAULT_EQUIPMENT_QUERY)).toBe(0);
    expect(queryEquipment(catalogEntries(makeState()), DEFAULT_EQUIPMENT_QUERY)).toHaveLength(Object.keys(ITEMS).length);
  });

  it('checks the exact integer quantity and combined funding, with one vehicle per purchase', () => {
    const state = makeState({ unlockedNodes: Object.keys(DEV_NODES) });
    state.department.funding = ITEMS.trauma_kit.cost * 12;
    expect(itemCheck(state, ITEMS.trauma_kit, 12).ok).toBe(true);
    expect(itemCheck(state, ITEMS.trauma_kit, 13).ok).toBe(false);
    for (const quantity of [0, -1, 1.5, 100, NaN]) expect(itemCheck(state, ITEMS.trauma_kit, quantity).ok).toBe(false);
    state.department.funding = 100_000;
    expect(itemCheck(state, ITEMS.support_van, 1).ok).toBe(true);
    expect(itemCheck(state, ITEMS.support_van, 2).ok).toBe(false);
  });
});
