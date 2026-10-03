import { Children, createElement, isValidElement, type ChangeEvent, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_CATEGORIES, ITEM_CATEGORY_LABELS } from '../../content/capabilities';
import { ITEMS } from '../../content/items';
import { beginService } from '../../sim/equipment';
import { makeState, NOW } from '../../sim/test-fixtures';
import { DEFAULT_NAV, NavContext, type NavApi } from '../components/nav';
import { Button } from '../components/ui';
import { EquipmentStore } from './EquipmentStore';
import { catalogEntries, DEFAULT_EQUIPMENT_QUERY, equipmentFacets, type EquipmentQuery } from './store-query';

let state = makeState();
let query: EquipmentQuery = { ...DEFAULT_EQUIPMENT_QUERY };
const setQuery = vi.fn((next: EquipmentQuery) => { query = next; });
vi.mock('../store', () => ({ useGame: () => state }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn() }) }));
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children, footer) : null }));

type Element = ReactElement<{ children?: ReactNode; name?: string; onChange?: (event: ChangeEvent<HTMLSelectElement>) => void; onClick?: () => void }>;
function elements(node: ReactNode): Element[] {
  if (!isValidElement<Element['props']>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elements)];
}
function renderStore(nav: Partial<NavApi> = {}) {
  let tree!: ReactElement;
  function Capture() { tree = EquipmentStore({ active: true }); return tree; }
  const html = renderToStaticMarkup(createElement(NavContext.Provider, { value: { ...DEFAULT_NAV, equipmentQuery: query, setEquipmentQuery: setQuery, ...nav } }, createElement(Capture)));
  return { tree, html };
}
function changeCategory(tree: ReactNode, category: EquipmentQuery['category']) {
  const select = elements(tree).find((element) => element.type === 'select' && element.props.name === 'equipment-category');
  expect(select).toBeDefined();
  select!.props.onChange?.({ target: { value: category } } as ChangeEvent<HTMLSelectElement>);
}

beforeEach(() => {
  state = makeState();
  query = { ...DEFAULT_EQUIPMENT_QUERY };
  setQuery.mockClear();
});

describe('compact equipment category filter', () => {
  it('uses one labeled native select with every category and contextual item counts', () => {
    const { html } = renderStore();
    const facets = equipmentFacets(catalogEntries(state), query);
    expect(html).toContain('<label class="field"><span class="field-label">Category</span><select name="equipment-category">');
    expect(html).toContain(`<option value="all" selected="">All equipment (${facets.categories.all})</option>`);
    for (const category of ITEM_CATEGORIES) expect(html).toContain(`<option value="${category}">${ITEM_CATEGORY_LABELS[category]} (${facets.categories[category]})</option>`);
    expect(html).not.toContain('store-category-list');
    expect(html).not.toContain('class="store-category');
    expect(html).toContain('<details class="store-filters">');
    expect(html).toContain('<article class="store-card">');
  });

  it('changes only category and retains search, availability, ownership, affordability and sort', () => {
    query = { ...query, search: 'radio', availability: 'buy_now', ownership: 'owned', affordable: true, sort: 'cost_desc' };
    const previousQuery = { ...query };
    const before = structuredClone(state);
    changeCategory(renderStore().tree, 'comms');
    expect(setQuery).toHaveBeenCalledExactlyOnceWith({ ...previousQuery, category: 'comms' });
    expect(state).toEqual(before);
    const { html } = renderStore();
    expect(html).toContain('Category: Communication');
    expect(html).toContain('<option value="comms" selected="">Communication (1)</option>');
    expect(html).toContain('1 of ');
    expect(html).toContain(`<h3>${ITEMS.radio_kit.name}</h3>`);
    expect(html).not.toContain(`<h3>${ITEMS.armored_rescue_vehicle.name}</h3>`);
    expect(html).toContain('value="cost_desc" selected=""');
  });

  it('keeps zero-count categories selectable and the chosen category visible while filters are collapsed', () => {
    query = { ...query, search: 'radio', ownership: 'owned' };
    changeCategory(renderStore().tree, 'vehicles');
    const { html } = renderStore();
    expect(html).toContain('<details class="store-filters"><summary>Filters · 3 active<span class="dim">Category: Vehicles</span></summary>');
    expect(html).toContain('<option value="vehicles" selected="">Vehicles (0)</option>');
    expect(html).toContain('<option value="comms">Communication (1)</option>');
    expect(html).toContain('No equipment matches these filters');
  });

  it('keeps purchase lock, affordability and owned/ready stock distinct', () => {
    state = makeState({ inventory: { camera_drone: 0 } });
    state.department.funding = 100_000;
    query = { ...query, search: 'camera drone', category: 'intel', availability: 'locked', ownership: 'not_owned', affordable: true };
    const { html } = renderStore();
    expect(html).toContain(`<h3>${ITEMS.camera_drone.name}</h3>`);
    expect(html).toContain('Purchase locked');
    expect(html).toContain('>Affordable</span>');
    expect(html).toContain('<span>0 owned</span>');
    expect(html).toContain('>0 ready</span>');
    expect(html).toContain('Purchase-locked items can still be affordable.');
  });

  it('clears the category with every other filter and restores the default catalog', () => {
    query = { search: 'radio', category: 'vehicles', availability: 'locked', ownership: 'owned', affordable: true, sort: 'name' };
    const { tree } = renderStore();
    const clear = elements(tree).find((element) => element.type === Button && element.props.children === 'Clear all');
    expect(clear).toBeDefined();
    clear!.props.onClick?.();
    expect(query).toEqual(DEFAULT_EQUIPMENT_QUERY);
    const { html } = renderStore();
    expect(html).toContain(`<option value="all" selected="">All equipment (${Object.keys(ITEMS).length})</option>`);
    expect(html.match(/<article class="store-card">/g)).toHaveLength(Object.keys(ITEMS).length);
  });

  it('describes service duration in real hours, matching the actual service timer', () => {
    const unit = Object.values(state.units).find((unit) => unit.itemId === 'radio_kit')!;
    unit.condition = 20;
    const started = beginService(state, unit.id, NOW);
    expect(started.ok).toBe(true);
    expect(unit.serviceUntil! - NOW).toBe(ITEMS.radio_kit.wear.serviceHours * 3_600_000);
    const { html } = renderStore({ equipmentItemId: 'radio_kit' });
    expect(html).toContain(`Service takes ${ITEMS.radio_kit.wear.serviceHours} real hours`);
    expect(html).not.toContain(`Service takes ${ITEMS.radio_kit.wear.serviceHours} game hours`);
  });
});
