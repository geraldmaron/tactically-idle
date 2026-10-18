import { MaterialGuide } from '../art/MaterialGuide';
import { GearArtFrame } from '../art/GearArt';
import { useEffect, useState } from 'react';
import { useGame } from '../store';
import { useNav } from '../components/nav';
import { EquipmentStore } from '../storefront/EquipmentStore';
import { ChoiceRail } from '../components/ChoiceRail';
import { storeOptions, unitViews } from '../../sim/department-selectors';
import type { StoreOption, UnitView } from '../../sim/department-selectors';
import type { GameState, Id, Squad } from '../../sim/types';
import { CALENDAR } from '../../sim/calendar';
import { ITEMS } from '../../content/items';
import { equipmentManagerBenefits, equipmentWearMultiplier, maintenanceBudget } from '../../sim/equipment-manager-policy';
import { managerView } from '../../sim/command-staff';
import { ManagerPortrait } from '../art/ManagerArt';
import { ManagerSheet } from '../components/CommandStaff';
import { RestockRuleEditor } from '../storefront/RestockRuleEditor';
import { Button, Card, Chip, EmptyState, Section, Stepper, UnitBar } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/toast';
import { UNIT_STATE_META, conditionTone } from '../components/labels';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { gameDays, money, pct, relativeTime } from '../format';
import { hasNodeEffect } from './helpers';
import './gear-visual.css';

export function GearScreen() {
  const g = useGame();
  const opts = storeOptions(g);
  const presets = hasNodeEffect(g, 'loadoutPresets');
  const restock = hasNodeEffect(g, 'restockRules');
  const [unitsFor, setUnitsFor] = useState<Id | null>(null);
  const nav = useNav();
  const surface = nav.gearSection;
  const setSurface = nav.setGearSection;
  const owned = opts.filter((option) => option.owned > 0);
  return (
    <div className="page gear-page">
      <ChoiceRail value={surface} kind="navigation" label="Gear sections" grow onChange={(next) => { setUnitsFor(null); setSurface(next); }} options={[
        { value: 'inventory', label: <>Inventory <span className="choice-rail-count">{owned.length}</span></> },
        { value: 'equipment', label: <>Equipment <span className="choice-rail-count">{opts.length}</span></> },
      ]} />
      {surface === 'equipment' && <EquipmentStore active />}
      <div className="gear-inventory" hidden={surface !== 'inventory'}>
      <Section title="Inventory" icon="box" hint="Tap an item for its units, restock and service.">
        {owned.length === 0 ? (
          <Card>
            <EmptyState icon="box" title="No owned equipment">Browse Equipment to inspect capabilities and buy stock.</EmptyState><Button onClick={() => setSurface('equipment')}>Browse Equipment</Button>
          </Card>
        ) : (<>
          <InventorySummary owned={owned} />
          <div className="inv-grid">
            {owned.map((o) => (
              <InventoryTile key={o.item.id} o={o} onOpen={() => setUnitsFor(o.item.id)} />
            ))}
            <button type="button" className="inv-tile inv-tile-add" onClick={() => setSurface('equipment')}>
              <span className="inv-add-icon" aria-hidden="true"><Icon name="plus" size={22} /></span>
              <span className="inv-name">Buy equipment</span>
            </button>
          </div>
        </>)}
      </Section>

      <UnitSheet itemId={unitsFor} onClose={() => setUnitsFor(null)} onRestock={(itemId) => { setUnitsFor(null); nav.openEquipment({ itemId }); }} />
      <details className="gear-maintenance"><summary>Maintenance &amp; loadouts<span className="dim">Quartermaster, restock rules and squad presets</span></summary><div className="gear-maintenance-body">
      <QuartermasterCard />

      <Section title="Restock rules" icon="refresh" hint="At each clock hour, refill held stock up to the target (excluding expired units) within each rule’s spending ceiling. Rules never take funding below zero and stop after 24 hours without orders.">
        {!restock.unlocked ? (
          <p className="note note-warn">
            <Icon name="lock" size={16} />
            {restock.reason}
          </p>
        ) : (
          <RuleList g={g} onOpen={(itemId) => owned.some((o) => o.item.id === itemId) ? setUnitsFor(itemId) : nav.openEquipment({ itemId })} />
        )}
      </Section>

      <Section title="Loadout presets" icon="list" hint="Save specialist gear choices here and apply them on preparation. Radios are standard kit: one per deployed officer is loaded automatically.">
        {!presets.unlocked ? (
          <p className="note note-warn">
            <Icon name="lock" size={16} />
            {presets.reason}
          </p>
        ) : g.squads.length === 0 ? (
          <Card>
            <EmptyState icon="people" title="No squads to set presets for" />
          </Card>
        ) : (
          <div className="stack">
            {g.squads.map((s) => (
              <PresetEditor key={s.id} squad={s} opts={opts} />
            ))}
          </div>
        )}
      </Section>
      <MaterialGuide />
      </div></details>
      </div>
    </div>
  );
}

/** Three numbers as shapes above the grid: units ready, units busy, items needing attention. */
function InventorySummary({ owned }: { owned: StoreOption[] }) {
  const ready = owned.reduce((n, o) => n + o.ready, 0);
  const busy = owned.reduce((n, o) => n + o.reserved + o.inService, 0);
  const attention = owned.filter((o) => inventoryAlert(o)).length;
  return (
    <div className="inv-summary">
      <span className="inv-stat inv-stat-ready"><Icon name="checkcircle" size={14} /><b>{ready}</b> ready</span>
      <span className="inv-stat"><Icon name="wait" size={14} /><b>{busy}</b> busy</span>
      <span className={`inv-stat${attention ? ' inv-stat-warn' : ''}`}><Icon name="warning" size={14} /><b>{attention}</b> {attention === 1 ? 'needs' : 'need'} attention</span>
    </div>
  );
}

function inventoryAlert(o: StoreOption): string | null {
  return o.ready === 0 ? 'None ready' : o.unreliable > 0 ? `${o.unreliable} unreliable` : o.expired > 0 ? `${o.expired} expired` : null;
}

/** The Quartermaster is a Command Staff manager: the same face and sheet as on HQ, so the service
 * budget lives in one place. The card shows tier benefits as chips and the latest action. */
function QuartermasterCard() {
  const g = useGame();
  const [open, setOpen] = useState(false);
  const view = managerView(g, 'quartermaster');
  const benefits = equipmentManagerBenefits(g);
  const budget = maintenanceBudget(g);
  const latest = view.log[0];
  const line = !view.hired ? view.activity : budget ? `Services up to ${money(budget)}/hour` : 'Automatic service off';
  return (
    <>
      <button type="button" className={`qm-card qm-card-${view.status}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <ManagerPortrait id="quartermaster" size={52} hired={view.hired} />
        <span className="qm-main">
          <span className="qm-title"><strong>{view.profile.title}</strong><span className={`staff-pill staff-pill-${view.status}`}>{view.status === 'on' ? 'On' : view.status === 'off' ? 'Off' : 'Not hired'}</span></span>
          <span className="qm-line">{line}</span>
          {view.hired && (
            <span className="chips qm-chips">
              <Chip icon="star">Tier {benefits.tier}</Chip>
              <Chip tone="mint" icon="wrench">{Math.round((1 - benefits.repairMultiplier) * 100)}% cheaper service</Chip>
              <Chip tone="mint" icon="gauge">{Math.round((1 - benefits.wearMultiplier) * 100)}% less wear</Chip>
            </span>
          )}
          {latest && <span className="qm-log dim">{latest.text}</span>}
        </span>
        <Icon name="gear" size={18} />
      </button>
      {open && <ManagerSheet id="quartermaster" g={g} now={Date.now()} inGear onClose={() => setOpen(false)} />}
    </>
  );
}

/** Active restock rules as compact rows. Rules are set in each item's sheet. */
function RuleList({ g, onOpen }: { g: GameState; onOpen: (itemId: Id) => void }) {
  const rules = g.department.restockRules.filter((rule) => ITEMS[rule.itemId]);
  if (!rules.length) return <p className="dim rule-empty">No rules yet. Open any item and set <strong>Keep at least</strong> to add one.</p>;
  return (
    <ul className="rule-list">
      {rules.map((rule) => (
        <li key={rule.itemId}>
          <button type="button" onClick={() => onOpen(rule.itemId)} aria-label={`${ITEMS[rule.itemId].name}: keep at least ${rule.target}, spend up to ${money(rule.budgetCeiling)}. Edit`}>
            <GearArtFrame itemId={rule.itemId} size={26} />
            <span className="rule-list-main"><strong>{ITEMS[rule.itemId].name}</strong><span className="dim">Keep {rule.target} · up to {money(rule.budgetCeiling)}</span></span>
            <Icon name="edit" size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Game-style inventory tile: the art carries identity, one big count says how many, and a
 * condition strip plus an alert pip say whether it needs attention. Detail lives in the sheet. */
function InventoryTile({ o, onOpen }: { o: StoreOption; onOpen: () => void }) {
  const tone = o.meanCondition === null ? 'neutral' : conditionTone(o.meanCondition, o.item.wear);
  const alert = inventoryAlert(o);
  const condition = o.meanCondition === null ? null : Math.round(o.meanCondition);
  return (
    <button type="button" className={`inv-tile${alert ? ' inv-tile-alert' : ''}`} onClick={onOpen} title={o.item.name}
      aria-label={`${o.item.name}: ${o.owned} owned, ${o.ready} ready${o.reserved + o.inService > 0 ? `, ${o.reserved + o.inService} busy` : ''}${condition === null ? '' : `, condition ${condition}%`}${alert ? `, ${alert}` : ''}`}>
      <span className="inv-art"><GearArtFrame itemId={o.item.id} size={42} /></span>
      <span className="inv-count" aria-hidden="true">×{o.owned}</span>
      {alert && <span className="inv-alert" aria-hidden="true"><Icon name="warning" size={12} /></span>}
      <span className="inv-name">{o.item.name}</span>
      <span className="inv-ready" aria-hidden="true"><Icon name="checkcircle" size={11} />{o.ready}{o.reserved + o.inService > 0 ? <span className="dim"> +{o.reserved + o.inService}</span> : null}</span>
      {condition !== null && <span className={`inv-cond inv-cond-${tone}`} aria-hidden="true"><i style={{ width: `${Math.max(4, condition)}%` }} /></span>}
    </button>
  );
}

// ---------------------------------------------------------------- unit sheet

/** Stock as one segmented bar: ready, unreliable, reserved, in service and expired. */
function StockBar({ o }: { o: StoreOption }) {
  const parts = [
    { key: 'ready', label: 'Ready', n: o.ready - o.unreliable },
    { key: 'unreliable', label: 'Unreliable', n: o.unreliable },
    { key: 'reserved', label: 'Reserved', n: o.reserved },
    { key: 'service', label: 'In service', n: o.inService },
    { key: 'expired', label: 'Expired', n: o.expired },
  ].filter((part) => part.n > 0);
  const total = Math.max(1, parts.reduce((n, part) => n + part.n, 0));
  return (
    <div className="stock">
      <span className="stock-bar" role="img" aria-label={`${o.owned} owned: ${parts.map((part) => `${part.n} ${part.label.toLowerCase()}`).join(', ') || 'none'}`}>
        {parts.map((part) => <i key={part.key} className={`stock-${part.key}`} style={{ width: `${(part.n / total) * 100}%` }} />)}
      </span>
      <span className="stock-legend" aria-hidden="true">
        {parts.map((part) => <span key={part.key}><i className={`stock-${part.key}`} />{part.n} {part.label.toLowerCase()}</span>)}
      </span>
    </div>
  );
}

function UnitSheet({ itemId, onClose, onRestock }: { itemId: Id | null; onClose: () => void; onRestock: (itemId: Id) => void }) {
  const g = useGame();
  const item = itemId ? ITEMS[itemId] : undefined;
  const opt = itemId ? storeOptions(g).find((o) => o.item.id === itemId) : undefined;
  const restock = hasNodeEffect(g, 'restockRules');
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={item?.name ?? ''}
      subtitle={
        item && opt ? (
          <span className="chips">
            <Chip icon="box">{opt.owned} owned</Chip>
            <Chip tone={opt.ready ? 'mint' : 'warn'} icon="checkcircle">{opt.ready} ready</Chip>
            {opt.meanCondition !== null && <Chip icon="gauge">Mean {Math.round(opt.meanCondition)}%</Chip>}
          </span>
        ) : undefined
      }
    >
      {item && <>
        <div className="gear-dossier"><GearArtFrame itemId={item.id} size={84} /><div className="gear-dossier-main"><p className="dim">{item.description}</p>{opt && <StockBar o={opt} />}</div></div>
        {opt && <div className="gear-buy">
          <Button variant="primary" icon="plus" block onClick={() => onRestock(item.id)}>Restock · {money(item.cost)} each</Button>
          {!opt.canBuy && opt.reason && <span className="reason">{opt.reason}</span>}
        </div>}
        {restock.unlocked && item.kind !== 'infrastructure' && <RestockRuleEditor itemId={item.id} />}
        <UnitList itemId={item.id} />
      </>}
    </Sheet>
  );
}

function UnitList({ itemId }: { itemId: Id }) {
  const g = useGame();
  const now = Date.now();
  const views = unitViews(g, itemId, now);
  const item = ITEMS[itemId];
  const w = item.wear;
  const wearMultiplier = equipmentWearMultiplier(g, item);
  return (
    <section className="units" aria-label="Units">
      <h3 className="units-head">Units <span className="dim">Tap a unit to service or scrap</span></h3>
      <p className="dim units-note">
        <Icon name="info" size={13} />
        Wears {Math.round(w.perUse * wearMultiplier * 100) / 100} per use and {Math.round(w.perDay * wearMultiplier * 1000) / 1000} per game day, adjusted by each unit's wear rate. Unreliable below {w.unreliableBelow}; needs service at {w.failAt} or lower.{wearMultiplier < 1 && ' Quartermaster wear reduction included.'}
      </p>
      {views.length === 0 ? (
        <EmptyState icon="box" title="No units to show">
          Buy this item to add a unit.
        </EmptyState>
      ) : (
        <ul className="ulist">
          {views.map((v) => (
            <UnitRow key={v.unit.id} v={v} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One unit as a compact row (serial, condition, state). Facts and actions open beneath it. */
function UnitRow({ v, now }: { v: UnitView; now: number }) {
  const { act, notify } = useToast();
  const [pending, setPending] = useState<'service' | 'scrap' | null>(null);
  const u = v.unit;
  const w = v.item.wear;
  const meta = UNIT_STATE_META[v.stateLabel] ?? { icon: 'info' as IconName, tone: 'neutral' as const };
  const ageDays = Math.max(0, (now - u.acquiredAt) / CALENDAR.gameDayMs);
  const canServiceAtAll = w.serviceHours > 0;
  const tryOpen = (kind: 'service' | 'scrap') => {
    const ok = kind === 'service' ? v.canService : v.canScrap;
    const reason = kind === 'service' ? v.serviceReason : v.scrapReason;
    if (!ok) {
      notify(reason ?? `Cannot ${kind} ${u.serial} right now`, { tone: 'error' });
      return;
    }
    setPending(kind);
  };
  const busyLine = v.serviceUntil !== null ? `back ${relativeTime(v.serviceUntil, now)}` : v.expiresAt !== null && v.expiresAt <= now ? 'expired' : null;
  return (
    <li className={`unit unit-${meta.tone}`}>
      <details>
        <summary className="unit-row">
          <strong className="unit-serial">{u.serial}</strong>
          <span className="unit-cond">
            <UnitBar value={u.condition} tone={meta.tone} label={v.stateLabel} />
          </span>
          <span className="unit-pct">{Math.round(u.condition)}%</span>
          <span className={`unit-state unit-state-${meta.tone}`} title={v.stateLabel}><Icon name={meta.icon} size={13} /><span className="unit-state-text">{v.stateLabel}</span></span>
          {busyLine && <span className="unit-busy dim">{busyLine}</span>}
        </summary>
        <div className="unit-body">
          <dl className="unit-facts">
            <div><dt><Icon name="bolt" size={12} />Effect</dt><dd>{pct(v.effectiveness)}</dd></div>
            <div><dt><Icon name="refresh" size={12} />Uses</dt><dd>{u.uses}</dd></div>
            <div><dt><Icon name="calendar" size={12} />Age</dt><dd>{gameDays(ageDays)}</dd></div>
            <div><dt><Icon name="warning" size={12} />Unreliable</dt><dd>{v.daysToUnreliable === null ? 'n/a' : v.daysToUnreliable <= 0 ? 'now' : `~${gameDays(v.daysToUnreliable)}`}</dd></div>
          </dl>
          {v.expiresAt !== null && (
            <p className={`unit-line${v.expiresAt <= now ? ' tone-danger' : ''}`}>
              <Icon name="wait" size={13} />
              {v.expiresAt <= now ? 'Expired' : `Expires in ${gameDays((v.expiresAt - now) / CALENDAR.gameDayMs)}`}
            </p>
          )}
          {v.serviceUntil !== null && (
            <p className="unit-line">
              <Icon name="wrench" size={13} />
              In service, back {relativeTime(v.serviceUntil, now)}
            </p>
          )}
          {pending === null ? (
            <div className="row-actions unit-actions">
              {canServiceAtAll && (
                <Button size="sm" icon="wrench" aria-disabled={!v.canService} className={v.canService ? '' : 'btn-soft-off'} onClick={() => tryOpen('service')}>
                  Service · {money(v.serviceCost)} · {w.serviceHours}h
                </Button>
              )}
              <Button size="sm" variant="ghost" icon="trash" aria-disabled={!v.canScrap} className={v.canScrap ? '' : 'btn-soft-off'} onClick={() => tryOpen('scrap')}>
                Scrap
              </Button>
            </div>
          ) : (
            <div className="confirm unit-confirm">
              <p>
                {pending === 'service'
                  ? `Service ${u.serial}? It costs ${money(v.serviceCost)} and is away for ${w.serviceHours}h, then returns at up to ${w.restoreTo}% condition.`
                  : `Scrap ${u.serial}? It is removed from the department and cannot be recovered.`}
              </p>
              <div className="row-actions">
                <Button size="sm" onClick={() => setPending(null)}>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant={pending === 'scrap' ? 'danger' : 'primary'}
                  icon={pending === 'scrap' ? 'trash' : 'wrench'}
                  onClick={() => {
                    const res = act(pending === 'service' ? { type: 'serviceUnit', unitId: u.id } : { type: 'scrapUnit', unitId: u.id }, pending === 'service' ? `${u.serial} sent for service` : `${u.serial} scrapped`);
                    if (res.ok) setPending(null);
                  }}
                >
                  {pending === 'service' ? 'Confirm service' : 'Confirm scrap'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

function PresetEditor({ squad, opts }: { squad: Squad; opts: StoreOption[] }) {
  const { act } = useToast();
  const [draft, setDraft] = useState<Record<Id, number>>(squad.loadoutPreset);
  useEffect(() => setDraft(squad.loadoutPreset), [squad.loadoutPreset]);
  const rows = opts.filter((o) => o.owned > 0 && o.item.kind !== 'infrastructure' && !o.item.supportOnly && o.item.id !== 'radio_kit');
  const dirty = JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(squad.loadoutPreset));
  return (
    <Card className="preset">
      <div className="prepsquad-head">
        <span className="squad-badge">{squad.id}</span>
        <strong>{squad.name}</strong>
      </div>
      {rows.length === 0 ? (
        <p className="dim">Buy equipment to build a preset.</p>
      ) : (
        <ul className="loadout">
          {rows.map((o) => (
            <li key={o.item.id} className="lo">
              <GearArtFrame itemId={o.item.id} size={26} />
              <span className="lo-main">
                <strong>{o.item.name}</strong>
                <span className="dim">{o.owned} owned</span>
              </span>
              <Stepper label={o.item.name} value={draft[o.item.id] ?? 0} max={o.owned} onChange={(n) => setDraft((d) => ({ ...d, [o.item.id]: n }))} />
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="primary" disabled={!dirty} onClick={() => act({ type: 'setLoadoutPreset', squadId: squad.id, items: normalize(draft) }, `${squad.name} preset saved`)}>
        Save preset
      </Button>
    </Card>
  );
}

function normalize(r: Record<Id, number>): Record<Id, number> {
  return Object.fromEntries(Object.entries(r).filter(([, q]) => q > 0).sort(([a], [b]) => a.localeCompare(b)));
}
