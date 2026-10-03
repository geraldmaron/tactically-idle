import { CAPABILITIES, ITEM_CATEGORIES, ITEM_CATEGORY_LABELS } from '../../content/capabilities';
import { DEV_NODES } from '../../content/dev-tree';
import { storeOptions, type StoreOption } from '../../sim/department-selectors';
import type { GameState, ItemDefinition } from '../../sim/types';

export type StoreCategory = ItemDefinition['category'];
export type AvailabilityFilter = 'all' | 'buy_now' | 'locked';
export type OwnershipFilter = 'all' | 'not_owned' | 'owned' | 'replenish';
export type StoreSort = 'recommended' | 'cost_asc' | 'cost_desc' | 'name' | 'recent';
export interface EquipmentQuery {
  search: string;
  category: StoreCategory | 'all';
  availability: AvailabilityFilter;
  affordable: boolean;
  ownership: OwnershipFilter;
  sort: StoreSort;
}
export const DEFAULT_EQUIPMENT_QUERY: EquipmentQuery = {
  search: '', category: 'all', availability: 'all', affordable: false, ownership: 'all', sort: 'recommended',
};
export interface CatalogEntry extends StoreOption {
  unlocked: boolean;
  affordable: boolean;
  qualified: number;
  needsReplenishment: boolean;
  unlockName: string | null;
  unlockOrder: number;
  searchText: string;
}

export function catalogEntries(state: GameState): CatalogEntry[] {
  return storeOptions(state).map((option) => {
    const item = option.item;
    const target = state.department.restockRules.find((rule) => rule.itemId === item.id)?.target;
    return {
      ...option,
      unlocked: !item.requiresNode || state.department.unlockedNodes.includes(item.requiresNode),
      affordable: state.department.funding >= item.cost,
      qualified: Object.values(state.officers).filter((officer) => (item.requiresCerts ?? []).every((cert) => officer.certs.includes(cert))).length,
      needsReplenishment: target !== undefined ? option.ready < target : option.owned > 0 && option.ready === 0,
      unlockName: item.requiresNode ? DEV_NODES[item.requiresNode]?.name ?? item.requiresNode : null,
      // Unlocks are appended in purchase order. This is ordering, not an invented timestamp.
      unlockOrder: item.requiresNode ? state.department.unlockedNodes.indexOf(item.requiresNode) : -1,
      searchText: [item.name, ...(item.aliases ?? []), ITEM_CATEGORY_LABELS[item.category], item.description,
        ...(item.helpsWith ?? []), ...(item.counters ?? []),
        ...(item.capabilities ?? []).flatMap((id) => [CAPABILITIES[id]?.name ?? id, CAPABILITIES[id]?.description ?? '']),
        ...(item.requiresCerts ?? []).map((cert) => cert.replaceAll('_', ' ')),
      ].join(' ').toLocaleLowerCase(),
    };
  });
}

/** All active dimensions combine with AND; words in search also combine with AND. */
export function matchesEquipment(entry: CatalogEntry, query: EquipmentQuery): boolean {
  const words = query.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return words.every((word) => entry.searchText.includes(word))
    && (query.category === 'all' || entry.item.category === query.category)
    && (query.availability === 'all' || (query.availability === 'buy_now' ? entry.canBuy : !entry.unlocked))
    && (!query.affordable || entry.affordable)
    && (query.ownership === 'all'
      || (query.ownership === 'owned' && entry.owned > 0)
      || (query.ownership === 'not_owned' && entry.owned === 0)
      || (query.ownership === 'replenish' && entry.needsReplenishment));
}

export function queryEquipment(entries: CatalogEntry[], query: EquipmentQuery): CatalogEntry[] {
  const compareText = (a: string, b: string) => a.localeCompare(b, 'en');
  return entries.filter((entry) => matchesEquipment(entry, query)).sort((a, b) => {
    let order = 0;
    switch (query.sort) {
      case 'cost_asc': order = a.item.cost - b.item.cost; break;
      case 'cost_desc': order = b.item.cost - a.item.cost; break;
      case 'name': order = compareText(a.item.name, b.item.name); break;
      case 'recent': order = Number(b.unlocked) - Number(a.unlocked) || b.unlockOrder - a.unlockOrder; break;
      case 'recommended': order = Number(b.canBuy) - Number(a.canBuy)
        || Number(b.unlocked) - Number(a.unlocked)
        || ITEM_CATEGORIES.indexOf(a.item.category) - ITEM_CATEGORIES.indexOf(b.item.category); break;
    }
    return order || compareText(a.item.name, b.item.name) || compareText(a.item.id, b.item.id);
  });
}

/** A facet count keeps every other active filter, and substitutes only its own dimension. */
export function equipmentFacets(entries: CatalogEntry[], query: EquipmentQuery) {
  const count = (patch: Partial<EquipmentQuery>) => entries.filter((entry) => matchesEquipment(entry, { ...query, ...patch })).length;
  return {
    categories: Object.fromEntries(['all', ...ITEM_CATEGORIES].map((category) => [category, count({ category: category as EquipmentQuery['category'] })])) as Record<EquipmentQuery['category'], number>,
    availability: Object.fromEntries(['all', 'buy_now', 'locked'].map((availability) => [availability, count({ availability: availability as AvailabilityFilter })])) as Record<AvailabilityFilter, number>,
    ownership: Object.fromEntries(['all', 'not_owned', 'owned', 'replenish'].map((ownership) => [ownership, count({ ownership: ownership as OwnershipFilter })])) as Record<OwnershipFilter, number>,
    affordable: count({ affordable: true }),
  };
}

export function activeEquipmentFilterCount(query: EquipmentQuery): number {
  return Number(!!query.search.trim()) + Number(query.category !== 'all') + Number(query.availability !== 'all') + Number(query.affordable) + Number(query.ownership !== 'all');
}
