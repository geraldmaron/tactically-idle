import { useMemo, useState } from 'react';
import { ITEM_CATEGORIES, ITEM_CATEGORY_LABELS } from '../../content/capabilities';
import { ITEMS } from '../../content/items';
import { itemCapabilityPreview } from '../../sim/capabilities';
import { itemCheck } from '../../sim/develop';
import { equipmentWearMultiplier } from '../../sim/equipment-manager-policy';
import type { CertId, Id } from '../../sim/types';
import { GearArtFrame } from '../art/GearArt';
import { useNav } from '../components/nav';
import { CERT_LABEL } from '../components/labels';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/toast';
import { Button, Chip, EmptyState } from '../components/ui';
import { moneyFull as money } from '../format';
import { useGame } from '../store';
import {
  activeEquipmentFilterCount, catalogEntries, DEFAULT_EQUIPMENT_QUERY, equipmentFacets, queryEquipment,
  type AvailabilityFilter, type CatalogEntry, type EquipmentQuery, type OwnershipFilter, type StoreSort,
} from './store-query';
import { useEquipmentDetail } from './useEquipmentDetail';

interface EquipmentStoreProps {
  active: boolean;
  onDevelopment?: (nodeId: Id) => void;
  onTraining?: (cert?: CertId) => void;
}

export function EquipmentStore({ active, onDevelopment, onTraining }: EquipmentStoreProps) {
  const game = useGame();
  const nav = useNav();
  const query = nav.equipmentQuery;
  const setQuery = nav.setEquipmentQuery;
  const detail = useEquipmentDetail(active);
  const entries = useMemo(() => catalogEntries(game), [game]);
  const shown = useMemo(() => queryEquipment(entries, query), [entries, query]);
  const facets = useMemo(() => equipmentFacets(entries, query), [entries, query]);
  const selected = entries.find((entry) => entry.item.id === detail.detailId);
  const activeFilters = activeEquipmentFilterCount(query);
  const patch = (value: Partial<EquipmentQuery>) => setQuery({ ...query, ...value });
  return <div className="store-equipment" hidden={!active}>
    <p className="dim store-intro">Browse every equipment unlock. Funding buys stock; training qualifies officers. Each item has a specific use and limits.</p>
    <label className="field store-search">
      <span className="field-label">Search equipment</span>
      <input type="search" placeholder="Search equipment or what it helps with" value={query.search} onChange={(event) => patch({ search: event.target.value })} />
    </label>
    <details className="store-filters">
      <summary>Filters{activeFilters ? ` · ${activeFilters} active` : ''}<span className="dim">{query.category === 'all' ? 'Search and filters combine' : `Category: ${ITEM_CATEGORY_LABELS[query.category]}`}</span></summary>
      <div className="store-filter-body">
        <label className="field">
          <span className="field-label">Category</span>
          <select name="equipment-category" value={query.category} onChange={(event) => patch({ category: event.target.value as EquipmentQuery['category'] })}>
            {(['all', ...ITEM_CATEGORIES] as const).map((category) => <option key={category} value={category}>
              {category === 'all' ? 'All equipment' : ITEM_CATEGORY_LABELS[category]} ({facets.categories[category]})
            </option>)}
          </select>
        </label>
        <div className="store-filter-row">
          <label className="field"><span className="field-label">Availability</span>
            <select value={query.availability} onChange={(event) => patch({ availability: event.target.value as AvailabilityFilter })}>
              <option value="all">All ({facets.availability.all})</option><option value="buy_now">Buy now ({facets.availability.buy_now})</option><option value="locked">Purchase locked ({facets.availability.locked})</option>
            </select>
          </label>
          <label className="field"><span className="field-label">Ownership</span>
            <select value={query.ownership} onChange={(event) => patch({ ownership: event.target.value as OwnershipFilter })}>
              <option value="all">All ({facets.ownership.all})</option><option value="not_owned">Not owned ({facets.ownership.not_owned})</option><option value="owned">Owned ({facets.ownership.owned})</option><option value="replenish">Needs replenishment ({facets.ownership.replenish})</option>
            </select>
          </label>
        </div>
        <label className="store-toggle"><input type="checkbox" checked={query.affordable} onChange={(event) => patch({ affordable: event.target.checked })} />Affordable with current funding ({facets.affordable})</label>
        <p className="dim store-filter-help">Needs replenishment means ready stock is below your restock target, or an owned item has no ready units. Purchase-locked items can still be affordable. Ready stock describes owned units that can be used.</p>
      </div>
    </details>
    <div className="store-results-head">
      <span role="status" aria-live="polite">{shown.length} of {entries.length} items</span>
      <Button size="sm" variant="ghost" disabled={!activeFilters && query.sort === 'recommended'} onClick={() => setQuery(DEFAULT_EQUIPMENT_QUERY)}>Clear all</Button>
      <label className="field store-sort"><span className="field-label">Sort equipment</span>
        <select value={query.sort} onChange={(event) => patch({ sort: event.target.value as StoreSort })}>
          <option value="recommended">Available first</option><option value="cost_asc">Funding: low to high</option><option value="cost_desc">Funding: high to low</option><option value="name">Name</option><option value="recent">Recently unlocked</option>
        </select>
      </label>
    </div>
    {shown.length ? <div className="store-grid">{shown.map((entry) => <EquipmentCard key={entry.item.id} entry={entry} onOpen={(button) => detail.open(entry.item.id, button)} />)}</div>
      : <div className="card"><EmptyState icon="search" title="No equipment matches these filters">Try a broader search or clear your filters. Locked equipment is included when availability is set to All.</EmptyState><Button block onClick={() => setQuery(DEFAULT_EQUIPMENT_QUERY)}>Clear all filters</Button></div>}
    {selected && active && <EquipmentDetail key={selected.item.id} entry={selected} onClose={() => detail.close()} onDevelopment={onDevelopment ?? nav.openDevelopment} onTraining={onTraining ?? ((certId) => nav.openTraining({ certId }))} />}
  </div>;
}

function EquipmentCard({ entry, onOpen }: { entry: CatalogEntry; onOpen: (button: HTMLButtonElement) => void }) {
  const { item } = entry;
  return <article className="store-card">
    <div className="store-card-heading"><GearArtFrame itemId={item.id} /><div><span className="kicker">{ITEM_CATEGORY_LABELS[item.category]}</span><h3>{item.name}</h3><span className="dim">{item.supportOnly ? 'Operation support asset' : item.kind === 'consumable' ? 'Single-use supply' : 'Reusable equipment'}</span></div></div>
    <p className="store-card-use">{item.helpsWith?.[0] ?? item.description}</p>
    <div className="store-stock"><span>{entry.owned} owned</span><span className={entry.ready ? 'tone-mint' : 'dim'}>{entry.ready} ready</span></div>
    <div className="chips"><Chip tone={entry.unlocked ? 'mint' : 'neutral'} icon={entry.unlocked ? 'unlock' : 'lock'}>{entry.unlocked ? 'Purchase unlocked' : 'Purchase locked'}</Chip><Chip tone={entry.affordable ? 'mint' : 'neutral'}>{entry.affordable ? 'Affordable' : 'Needs funding'}</Chip></div>
    {!entry.unlocked && <p className="reason">Requires {entry.unlockName}</p>}
    {!!item.requiresCerts?.length && <p className="dim store-qualification">{entry.qualified} certified officer{entry.qualified === 1 ? '' : 's'} · certification needed to use</p>}
    <div className="store-card-foot"><strong>{money(item.cost)} <span className="dim">funding</span></strong><Button size="sm" onClick={(event) => onOpen(event.currentTarget)}>Details &amp; buy</Button></div>
  </article>;
}

function EquipmentDetail({ entry, onClose, onDevelopment, onTraining }: {
  entry: CatalogEntry; onClose: () => void; onDevelopment: (nodeId: Id) => void; onTraining: (cert?: CertId) => void;
}) {
  const game = useGame();
  const { act } = useToast();
  const { item } = entry;
  const nav = useNav();
  const quantity = nav.equipmentQuantities[item.id] ?? '1';
  const setQuantity = (value: string) => nav.setEquipmentQuantity(item.id, value);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const qty = quantity.trim() ? Number(quantity) : NaN;
  const max = item.supportOnly ? 1 : 99;
  const quantityValid = Number.isInteger(qty) && qty >= 1 && qty <= max;
  const check = quantityValid ? itemCheck(game, item, qty) : { ok: false, reason: `Enter a whole-number quantity from 1 to ${max}.` };
  const preview = itemCapabilityPreview(game, item.id);
  const wear = equipmentWearMultiplier(game, item);
  return <Sheet open onClose={onClose} title={item.name} className="store-item-sheet" subtitle={<span className="chips"><Chip>{ITEM_CATEGORY_LABELS[item.category]}</Chip><Chip>{entry.owned} owned · {entry.ready} ready</Chip></span>} footer={<div className="store-purchase">
    <div className="store-purchase-line"><label className="field"><span className="field-label">Quantity</span><input aria-label={`Quantity of ${item.name}`} type="number" inputMode="numeric" min={1} max={max} step={1} value={quantity} disabled={item.supportOnly} onChange={(event) => { setQuantity(event.target.value); setFeedback(null); }} /></label><div><span className="dim">Total funding</span><strong>{quantityValid ? money(item.cost * qty) : '—'}</strong></div></div>
    {item.supportOnly && <p className="dim">Vehicles are purchased one at a time. One support asset can be assigned per operation.</p>}
    <Button block variant="primary" disabled={!check.ok} onClick={() => {
      const result = act({ type: 'buyItem', itemId: item.id, qty }, `Bought ${qty} × ${item.name}`);
      setFeedback({ ok: result.ok, text: result.ok ? `${qty} ${qty === 1 ? 'unit added' : 'units added'} to Inventory for ${money(item.cost * qty)} funding.` : result.reason });
    }}>{quantityValid ? `Buy ${qty} · ${money(item.cost * qty)} funding` : 'Enter quantity to buy'}</Button>
    {check.reason && <p className="reason">{check.reason}</p>}
    {feedback && <p className={feedback.ok ? "store-purchase-feedback" : "reason"} role="status">{feedback.text}</p>}
  </div>}>
    <div className="store-detail-art"><GearArtFrame itemId={item.id} size={108} /><p>{item.description}</p></div>
    <DetailSection title="Helps with" lines={item.helpsWith ?? [item.description]} />
    <DetailSection title="When it won’t help" lines={item.counters ?? []} />
    <section className="store-detail-section"><h3>Unlock and qualifications</h3>
      <p>{entry.unlocked ? 'Purchase unlocked.' : `Purchase requires ${entry.unlockName}.`} {entry.affordable ? 'One unit is affordable with current funding.' : 'Current funding is below the unit price.'}</p>
      {item.requiresNode && <Button size="sm" onClick={() => onDevelopment(item.requiresNode!)}>View {entry.unlockName}</Button>}
      {item.requiresCerts?.length ? <><p>Use requires {item.requiresCerts.map((cert) => CERT_LABEL[cert]).join(' + ')}. {entry.qualified} officer{entry.qualified === 1 ? '' : 's'} currently hold{entry.qualified === 1 ? 's' : ''} all required certifications.</p><p className="dim">Buying stock does not qualify an officer. Certified officers may still be unavailable or unsuitable for a particular action.</p><Button size="sm" onClick={() => onTraining(item.requiresCerts?.[0])}>Find qualification training</Button></> : <p>No item-specific certification required. Individual action requirements still apply.</p>}
    </section>
    <section className="store-detail-section"><h3>Supplies used</h3>
      {item.supplies?.length ? <ul className="bullets">{item.supplies.map((supply) => <li key={supply.itemId}>{supply.qty} × {ITEMS[supply.itemId]?.name ?? supply.itemId} each time this equipment is used. Buy these supplies separately.</li>)}</ul> : <p>{item.kind === 'consumable' ? 'Used once when you confirm an action that needs it.' : 'No separate supply needed for this item. A particular action may still need other equipment.'}</p>}
    </section>
    <section className="store-detail-section"><h3>Upkeep</h3>
      {item.kind === 'consumable' ? <p>Single-use; cannot be serviced.{item.wear.shelfLifeDays ? ` Shelf life: ${item.wear.shelfLifeDays} game days.` : ''}{item.wear.perDay ? ` Condition also falls ${item.wear.perDay} per game day.` : ''}</p>
        : <p>Base wear: {Math.round(item.wear.perUse * wear * 100) / 100} per use and {Math.round(item.wear.perDay * wear * 1000) / 1000} per game day, adjusted by each unit’s wear rate. Service takes {item.wear.serviceHours} real hours; base cost {money(item.wear.serviceCost)} funding before any manager discount. No automatic hourly equipment charge.</p>}
      <p className="dim">Repair equipment and manage automatic restocking in Inventory.</p>
    </section>
    <section className="store-detail-section"><h3>Action compatibility</h3><p>{preview.reasons.join(' ')}</p><p className="dim">This store view has no selected action. It does not claim a score bonus or reveal unconfirmed scene information. Check the action preview during an operation.</p></section>
  </Sheet>;
}

function DetailSection({ title, lines }: { title: string; lines: string[] }) {
  return <section className="store-detail-section"><h3>{title}</h3>{lines.length ? <ul className="bullets">{lines.map((line, index) => <li key={index}>{line}</li>)}</ul> : <p>Effect depends on the selected action and current scene.</p>}</section>;
}
