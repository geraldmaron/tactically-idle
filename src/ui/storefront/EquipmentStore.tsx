import { useEffect, useMemo, useRef, useState } from 'react';
import { CAPABILITIES, ITEM_CATEGORIES, ITEM_CATEGORY_LABELS } from '../../content/capabilities';
import { ITEMS } from '../../content/items';
import { itemCapabilityPreview } from '../../sim/capabilities';
import { itemCheck } from '../../sim/develop';
import { equipmentWearMultiplier } from '../../sim/equipment-manager-policy';
import type { CertId, Id } from '../../sim/types';
import { GearArtFrame } from '../art/GearArt';
import { useNav } from '../components/nav';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/toast';
import { Button, Chip, EmptyState } from '../components/ui';
import { money as moneyShort, moneyFull as money } from '../format';
import { Icon } from '../icons';
import { GEAR_CATEGORY_ICON } from '../icons/kit';
import { hasNodeEffect } from '../screens/helpers';
import '../screens/gear-visual.css';
import { RestockRuleEditor } from './RestockRuleEditor';
import { useGame } from '../store';
import {
  activeEquipmentFilterCount, armoryView, catalogEntries, DEFAULT_EQUIPMENT_QUERY, equipmentFacets, queryEquipment, withArmoryView,
  type CatalogEntry, type EquipmentQuery, type StoreSort,
} from './store-query';
import { useEquipmentDetail } from './useEquipmentDetail';
import { CERT_NAME } from '../../content/certs';
import { Disclosure } from '../components/Disclosure';
import { ChoiceRail } from '../components/ChoiceRail';
import { conditionTone } from '../components/labels';
import { StockBar, UnitList } from './ItemUnits';
import './storefront.css';

interface EquipmentReceipt { itemId: Id; quantity: number }

interface EquipmentStoreProps {
  active: boolean;
  compactControls?: boolean;
  onDevelopment?: (nodeId: Id) => void;
  onTraining?: (cert?: CertId) => void;
}

export function EquipmentStore({ active, compactControls = false, onDevelopment, onTraining }: EquipmentStoreProps) {
  const game = useGame();
  const [receipt, setReceipt] = useState<EquipmentReceipt | null>(null);
  const nav = useNav();
  const query = nav.equipmentQuery;
  const setQuery = nav.setEquipmentQuery;
  const detail = useEquipmentDetail(active);
  const entries = useMemo(() => catalogEntries(game), [game]);
  const shown = useMemo(() => queryEquipment(entries, query), [entries, query]);
  // Rail counts ignore the rail's own choice, so each tab says what it would show.
  const facets = useMemo(() => equipmentFacets(entries, withArmoryView(query, 'all')), [entries, query]);
  const selected = entries.find((entry) => entry.item.id === detail.detailId);
  const activeFilters = activeEquipmentFilterCount(query);
  const patch = (value: Partial<EquipmentQuery>) => setQuery({ ...query, ...value });
  const grouped = query.sort === 'recommended';
  const ownedTypes = entries.filter((entry) => entry.owned > 0).length;
  const controls = <>
    <div className="store-collection" role="img" aria-label={`${ownedTypes} of ${entries.length} equipment types owned`}>
      <span className="store-collection-label"><Icon name="box" size={16} />Collection</span>
      <span className="store-bar" aria-hidden="true"><i style={{ width: `${(ownedTypes / Math.max(1, entries.length)) * 100}%` }} /></span>
      <strong aria-hidden="true">{ownedTypes}/{entries.length}</strong>
    </div>
    <label className="field store-search">
      <span className="field-label sr-only">Search equipment</span>
      <input type="search" placeholder="Search equipment or what it helps with" value={query.search} onChange={(event) => patch({ search: event.target.value })} />
    </label>
    <ChoiceRail kind="filter" label="Show equipment" grow value={armoryView(query)} onChange={(view) => setQuery(withArmoryView(query, view))} options={[
      { value: 'all', label: <>All <span className="choice-rail-count">{entries.length}</span></>, accessibleLabel: `All, ${entries.length}` },
      { value: 'owned', label: <>Owned <span className="choice-rail-count">{facets.ownership.owned}</span></>, accessibleLabel: `Owned, ${facets.ownership.owned}` },
      { value: 'attention', label: <>Attention <span className="choice-rail-count">{facets.ownership.attention}</span></>, accessibleLabel: `Needs attention, ${facets.ownership.attention}` },
      { value: 'buy', label: <>Buy now <span className="choice-rail-count">{facets.availability.buy_now}</span></>, accessibleLabel: `Buy now, ${facets.availability.buy_now}` },
    ]} />
    <div className="store-results-head">
      <span role="status" aria-live="polite">{shown.length} of {entries.length} items</span>
      <label className="store-sort-inline">
        <span className="sr-only">Sort equipment</span>
        <Icon name="list" size={16} />
        <select value={query.sort} onChange={(event) => patch({ sort: event.target.value as StoreSort })}>
          <option value="recommended">By category</option><option value="cost_asc">Cheapest first</option><option value="cost_desc">Dearest first</option><option value="name">Name</option><option value="recent">Recently unlocked</option>
        </select>
      </label>
      {(activeFilters > 0 || query.sort !== 'recommended') && <Button size="sm" variant="ghost" onClick={() => setQuery(DEFAULT_EQUIPMENT_QUERY)}>Clear</Button>}
    </div>
  </>;
  return <div className="store-equipment" hidden={!active}>
    {compactControls ? <Disclosure name="equipment-controls" summary="Find equipment" icon="filter" className="equipment-controls">{controls}</Disclosure> : controls}
    {!shown.length ? <div className="card"><EmptyState spot="nothingInStock" title="No equipment matches these filters">Try a broader search or clear your filters. Locked equipment is included when availability is set to All.</EmptyState><Button block onClick={() => setQuery(DEFAULT_EQUIPMENT_QUERY)}>Clear all filters</Button></div>
      : grouped ? ITEM_CATEGORIES.map((category) => {
        const tiles = shown.filter((entry) => entry.item.category === category);
        if (!tiles.length) return null;
        const set = entries.filter((entry) => entry.item.category === category);
        const have = set.filter((entry) => entry.owned > 0).length;
        return <section key={category} className="store-group" aria-label={ITEM_CATEGORY_LABELS[category]}>
          <h3 className="store-group-head">
            <span><Icon name={GEAR_CATEGORY_ICON[category]} size={16} />{ITEM_CATEGORY_LABELS[category]}</span>
            <span className="store-bar" aria-hidden="true"><i style={{ width: `${(have / set.length) * 100}%` }} /></span>
            <span className="store-group-count" aria-label={`${have} of ${set.length} owned`}>{have}/{set.length}</span>
          </h3>
          <div className="inv-grid">{tiles.map((entry) => <EquipmentTile key={entry.item.id} entry={entry} acquired={receipt?.itemId === entry.item.id ? receipt.quantity : undefined} onOpen={(button) => detail.open(entry.item.id, button)} />)}</div>
        </section>;
      })
      : <div className="inv-grid">{shown.map((entry) => <EquipmentTile key={entry.item.id} entry={entry} acquired={receipt?.itemId === entry.item.id ? receipt.quantity : undefined} onOpen={(button) => detail.open(entry.item.id, button)} />)}</div>}
    {selected && active && <EquipmentDetail key={selected.item.id} entry={selected} onPurchase={(quantity) => setReceipt({ itemId: selected.item.id, quantity })} onClose={() => detail.close()} onDevelopment={onDevelopment ?? nav.openDevelopment} onTraining={onTraining ?? ((certId) => nav.openTraining({ certId }))} />}
  </div>;
}

type TileState = 'buy' | 'short' | 'locked';

/** Art, stock, price and purchase eligibility stay visible together. Qualifications and use live
 * in the item sheet; an acquired marker is supplied only by a successful command receipt. */
function EquipmentTile({ entry, acquired, onOpen }: { entry: CatalogEntry; acquired?: number; onOpen: (button: HTMLButtonElement) => void }) {
  const { item } = entry;
  const state: TileState = !entry.unlocked ? 'locked' : entry.canBuy ? 'buy' : 'short';
  const condition = entry.meanCondition === null ? null : Math.round(entry.meanCondition);
  const certs = item.requiresCerts?.length ? `. Certification needed to use: ${entry.qualified} certified officer${entry.qualified === 1 ? '' : 's'}` : '';
  const label = `${item.name}, ${ITEM_CATEGORY_LABELS[item.category]}. ${money(item.cost)} funding. ${entry.unlocked ? 'Purchase unlocked' : `Purchase locked: requires ${entry.unlockName}`}. ${entry.affordable ? 'Affordable' : 'Needs funding'}. ${entry.owned} owned, ${entry.ready} ready${condition === null ? '' : `, condition ${condition}%`}${entry.attention ? `, ${entry.attention}` : ''}${certs}.`;
  return <button type="button" className={`inv-tile store-tile store-tile-${state}${entry.needsAttention ? ' inv-tile-alert' : ''}`} data-item-id={item.id} title={item.name} aria-label={label} aria-haspopup="dialog" onClick={(event) => onOpen(event.currentTarget)}>
    <span className="inv-art"><GearArtFrame itemId={item.id} size={78} /></span>
    {entry.owned > 0 && <span className="inv-count" aria-hidden="true">×{entry.owned}</span>}
    {entry.needsAttention && <span className="inv-alert" aria-hidden="true"><Icon name="warning" size={16} /></span>}
    {!!item.requiresCerts?.length && <span className={`store-tile-cert${entry.qualified ? '' : ' store-tile-cert-none'}`} aria-hidden="true"><Icon name="mortarboard" size={16} /></span>}
    <span className="inv-name" aria-hidden="true">{item.name}</span>
    <span className="store-tile-stock" aria-hidden="true">{entry.owned > 0 ? `${entry.owned} owned · ${entry.ready} ready` : 'Not owned'}</span>
    <span className="store-tile-price" aria-hidden="true">{state === 'locked' ? <Icon name="lock" size={16} /> : <Icon name="cash" size={16} />}{moneyShort(item.cost)}</span>
    <span className="store-tile-availability" aria-hidden="true">{state === 'locked' ? entry.unlockName : state === 'short' ? 'Needs funding' : 'Available now'}</span>
    {acquired !== undefined && <span className="store-tile-acquired"><Icon name="check" size={16} />+{acquired} acquired</span>}
    {condition !== null && <span className={`inv-cond inv-cond-${conditionTone(condition, item.wear)}`} aria-hidden="true"><i style={{ width: `${Math.max(4, condition)}%` }} /></span>}
  </button>;
}

function EquipmentDetail({ entry, onPurchase, onClose, onDevelopment, onTraining }: {
  entry: CatalogEntry; onPurchase: (quantity: number) => void; onClose: () => void; onDevelopment: (nodeId: Id) => void; onTraining: (cert?: CertId) => void;
}) {
  const game = useGame();
  const { act } = useToast();
  const { item } = entry;
  const nav = useNav();
  const quantity = nav.equipmentQuantities[item.id] ?? '1';
  const setQuantity = (value: string) => nav.setEquipmentQuantity(item.id, value);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (feedback?.ok) objectRef.current?.scrollIntoView({ block: 'start' }); }, [feedback]);
  const qty = quantity.trim() ? Number(quantity) : NaN;
  const max = item.supportOnly ? 1 : 99;
  const quantityValid = Number.isInteger(qty) && qty >= 1 && qty <= max;
  const check = quantityValid ? itemCheck(game, item, qty) : { ok: false, reason: `Enter a whole-number quantity from 1 to ${max}.` };
  const failureMessage = feedback && !feedback.ok ? feedback.text : check.reason;
  const preview = itemCapabilityPreview(game, item.id);
  const wear = equipmentWearMultiplier(game, item);
  const restock = hasNodeEffect(game, 'restockRules');
  return <Sheet open onClose={onClose} title={item.name} className="store-item-sheet" subtitle={<span className="chips"><Chip>{ITEM_CATEGORY_LABELS[item.category]}</Chip><Chip>{entry.owned} owned · {entry.ready} ready</Chip></span>} footer={<div className="store-purchase">
    <div className="store-purchase-line"><label className="field"><span className="field-label">Quantity</span><input aria-label={`Quantity of ${item.name}`} type="number" inputMode="numeric" min={1} max={max} step={1} value={quantity} disabled={item.supportOnly} onChange={(event) => { setQuantity(event.target.value); setFeedback(null); }} /></label><div><span className="dim">Total funding</span><strong>{quantityValid ? money(item.cost * qty) : '—'}</strong></div></div>
    {item.supportOnly && <p className="dim">Vehicles are purchased one at a time. One support asset can be assigned per operation.</p>}
    <Button block variant="primary" disabled={!check.ok} onClick={() => {
      const result = act({ type: 'buyItem', itemId: item.id, qty }, `Bought ${qty} × ${item.name}`);
      setFeedback({ ok: result.ok, text: result.ok ? `${qty} ${qty === 1 ? 'unit added' : 'units added'} to the Armory for ${money(item.cost * qty)} funding.` : result.reason });
      if (result.ok) onPurchase(qty);
    }}>{quantityValid ? `Buy ${qty} · ${money(item.cost * qty)} funding` : 'Enter quantity to buy'}</Button>
    {failureMessage && <p className="reason" role="status">{failureMessage}</p>}
  </div>}>
    <div ref={objectRef} className={`store-detail-art${feedback?.ok ? ' store-detail-acquired' : ''}`}><GearArtFrame itemId={item.id} size={128} /><div className="store-detail-hero">
      {feedback?.ok && <div className="store-purchase-receipt" role="status"><Icon name="check" size={20} /><div><strong>{item.name} acquired</strong><p>{feedback.text}</p></div></div>}
      <p>{item.description}</p>
      <span className="chips">
        <Chip tone={entry.unlocked ? 'mint' : 'neutral'} icon={entry.unlocked ? 'unlock' : 'lock'}>{entry.unlocked ? 'Purchase unlocked' : 'Purchase locked'}</Chip>
        <Chip tone={entry.affordable ? 'mint' : 'warn'} icon="cash">{money(item.cost)}{entry.affordable ? '' : ' · needs funding'}</Chip>
        {!!item.requiresCerts?.length && <Chip tone={entry.qualified ? 'blue' : 'warn'} icon="mortarboard">{entry.qualified} certified</Chip>}
      </span>
    </div></div>
    {entry.owned > 0 && <section className="store-detail-section store-owned" aria-label="Your stock"><h3>Your stock</h3><StockBar o={entry} />{entry.attention && <p className="note note-warn"><Icon name="warning" size={16} />{entry.attention}</p>}</section>}
    {!!item.capabilities?.length && <div className="chips store-capabilities" aria-label="Capabilities">{item.capabilities.map((id) => <Chip key={id} tone="blue" title={CAPABILITIES[id]?.description}>{CAPABILITIES[id]?.name ?? id}</Chip>)}</div>}
    <DetailSection title="Helps with" lines={item.helpsWith ?? [item.description]} />
    <DetailSection title="When it won’t help" lines={item.counters ?? []} />
    <section className="store-detail-section"><h3>Unlock and qualifications</h3>
      <p>{entry.unlocked ? 'Purchase unlocked.' : `Purchase requires ${entry.unlockName}.`} {entry.affordable ? 'One unit is affordable with current funding.' : 'Current funding is below the unit price.'}</p>
      {item.requiresNode && <Button size="sm" onClick={() => onDevelopment(item.requiresNode!)}>View {entry.unlockName}</Button>}
      {item.requiresCerts?.length ? <><p>Use requires {item.requiresCerts.map((cert) => CERT_NAME[cert]).join(' + ')}. {entry.qualified} officer{entry.qualified === 1 ? '' : 's'} currently hold{entry.qualified === 1 ? 's' : ''} all required certifications.</p><p className="dim">Buying stock does not qualify an officer. Certified officers may still be unavailable or unsuitable for a particular action.</p><Button size="sm" onClick={() => onTraining(item.requiresCerts?.[0])}>Find qualification training</Button></> : <p>No item-specific certification required. Individual action requirements still apply.</p>}
    </section>
    {restock.unlocked && item.kind !== 'infrastructure' && <div className="store-detail-section"><RestockRuleEditor itemId={item.id} /></div>}
    {entry.owned > 0 && <UnitList itemId={item.id} />}
    <Disclosure name="item-more" className="store-detail-more" summary="Supplies, upkeep and action fit">
    <section className="store-detail-section"><h3>Supplies used</h3>
      {item.supplies?.length ? <ul className="bullets">{item.supplies.map((supply) => <li key={supply.itemId}>{supply.qty} × {ITEMS[supply.itemId]?.name ?? supply.itemId} each time this equipment is used. Buy these supplies separately.</li>)}</ul> : <p>{item.kind === 'consumable' ? 'Used once when you confirm an action that needs it.' : 'No separate supply needed for this item. A particular action may still need other equipment.'}</p>}
    </section>
    <section className="store-detail-section"><h3>Upkeep</h3>
      {item.kind === 'consumable' ? <p>Single-use; cannot be serviced.{item.wear.shelfLifeDays ? ` Shelf life: ${item.wear.shelfLifeDays} game days.` : ''}{item.wear.perDay ? ` Condition also falls ${item.wear.perDay} per game day.` : ''}</p>
        : <p>Base wear: {Math.round(item.wear.perUse * wear * 100) / 100} per use and {Math.round(item.wear.perDay * wear * 1000) / 1000} per game day, adjusted by each unit’s wear rate. Service takes {item.wear.serviceHours} real hours; base cost {money(item.wear.serviceCost)} funding before any manager discount. No automatic hourly equipment charge.</p>}
      <p className="dim">Service or scrap a unit from its row under Units.</p>
    </section>
    <section className="store-detail-section"><h3>Action compatibility</h3><p>{preview.reasons.join(' ')}</p><p className="dim">This store view has no selected action. It does not claim a score bonus or reveal unconfirmed scene information. Check the action preview during an operation.</p></section>
    </Disclosure>
  </Sheet>;
}

function DetailSection({ title, lines }: { title: string; lines: string[] }) {
  return <section className="store-detail-section"><h3>{title}</h3>{lines.length ? <ul className="bullets">{lines.map((line, index) => <li key={index}>{line}</li>)}</ul> : <p>Effect depends on the selected action and current scene.</p>}</section>;
}
