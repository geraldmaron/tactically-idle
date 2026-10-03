import { MaterialGuide } from '../art/MaterialGuide';
import { GearArtFrame } from '../art/GearArt';
import { useEffect, useState } from 'react';
import { useGame } from '../store';
import { useNav } from '../components/nav';
import { EquipmentStore } from '../storefront/EquipmentStore';
import { ChoiceRail } from '../components/ChoiceRail';
import { storeOptions, unitViews } from '../../sim/department-selectors';
import type { StoreOption, UnitView } from '../../sim/department-selectors';
import type { GameState, Id, RestockRule, Squad } from '../../sim/types';
import { CALENDAR } from '../../sim/calendar';
import { ITEMS } from '../../content/items';
import { EQUIPMENT_MANAGER, equipmentManagerBenefits, equipmentWearMultiplier, hasEquipmentManager, maintenanceBudget } from '../../sim/equipment-manager-policy';
import { Button, Card, Chip, EmptyState, Section, Stepper, UnitBar } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/toast';
import { UNIT_STATE_META, conditionTone } from '../components/labels';
import { Icon, itemIcon } from '../icons';
import type { IconName } from '../icons';
import { gameDays, money, pct, relativeTime } from '../format';
import { hasNodeEffect } from './helpers';

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
      <Section title="Inventory" icon="box" hint="Every item is a set of individual units that wear at their own pace. Tap a tile to see each unit, service it or scrap it.">
        {owned.length === 0 ? (
          <Card>
            <EmptyState icon="box" title="No owned equipment">Browse Equipment to inspect capabilities and buy stock.</EmptyState><Button onClick={() => setSurface('equipment')}>Browse Equipment</Button>
          </Card>
        ) : (
          <div className="gear-grid">
            {owned.map((o) => (
              <GearTile key={o.item.id} o={o} onOpen={() => setUnitsFor(o.item.id)} onRestock={() => { setUnitsFor(null); nav.openEquipment({ itemId: o.item.id }); }} />
            ))}
          </div>
        )}
      </Section>

      <Button block onClick={() => setSurface('equipment')}>Browse Equipment</Button>
      <UnitSheet itemId={unitsFor} onClose={() => setUnitsFor(null)} />
      <details className="gear-maintenance"><summary>Maintenance &amp; loadouts<span className="dim">Service budgets, presets and hourly restock rules</span></summary><div className="gear-maintenance-body">
      <EquipmentManager />
      <MaterialGuide />

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

      <Section title="Restock rules" icon="refresh" hint="At each clock hour, refill held stock up to the target (excluding expired units) within each rule’s spending ceiling. Rules never take funding below zero and stop after 24 hours without orders.">
        {!restock.unlocked ? (
          <p className="note note-warn">
            <Icon name="lock" size={16} />
            {restock.reason}
          </p>
        ) : (
          <div className="stack">
            {opts
              .filter((o) => o.item.kind !== 'infrastructure')
              .map((o) => (
                <RuleRow key={o.item.id} o={o} g={g} />
              ))}
          </div>
        )}
      </Section>
      </div></details>
      </div>
    </div>
  );
}

function EquipmentManager() {
  const g = useGame();
  const { act } = useToast();
  const hired = hasEquipmentManager(g);
  const benefits = equipmentManagerBenefits(g);
  const nav = useNav();
  const budget = maintenanceBudget(g);
  const [draft, setDraft] = useState(budget || 200);
  if (!hired) return <Card className="equipment-manager-locked">
    <span><strong>Equipment manager</strong><span className="dim">Unlock service and wear benefits.</span></span>
    <Button size="sm" onClick={() => nav.openDevelopment(EQUIPMENT_MANAGER.nodeId)}>Unlock in Develop</Button>
  </Card>;
  return (
    <Section title="Equipment manager" icon="wrench" hint={`Tier ${benefits.tier}: ${Math.round((1 - benefits.repairMultiplier) * 100)}% cheaper servicing and ${Math.round((1 - benefits.wearMultiplier) * 100)}% less wear on reusable equipment.`}>
      <Card>

          <p><strong>{budget ? `Automatic service: up to ${money(budget)}/hour` : 'Automatic service paused'}</strong></p>
          <p className="dim">Checks at the next clock hour, services worn idle gear below {EQUIPMENT_MANAGER.serviceBelow}% condition, and keeps {money(EQUIPMENT_MANAGER.fundingReserve)} in reserve. The manager starts a job only while fewer than {benefits.maxConcurrentServices} repairs are underway, counting manual jobs. You can order additional manual repairs separately. Working radios are kept ready for assigned officers; spare radios allow routine servicing.</p>
          <label className="field">
            <span className="field-label">Hourly service spending ceiling</span>
            <select value={draft} onChange={(e) => setDraft(Number(e.target.value))}>
              {[...new Set([50, 100, 200, 300, 500, budget || 200])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{money(n)}/hour maximum</option>)}
            </select>
          </label>
          <div className="row-actions">
            <Button variant="primary" disabled={budget === draft} onClick={() => act({ type: 'setMaintenanceBudget', perHour: draft }, `Automatic service budget set to ${money(draft)}/hour`)}>{budget ? 'Update ceiling' : 'Enable automatic service'}</Button>
            {budget > 0 && <Button onClick={() => act({ type: 'setMaintenanceBudget', perHour: 0 }, 'Automatic service paused. Existing repairs will finish.')}>Pause automatic service</Button>}
          </div>
          <p className="dim">The ceiling includes the repair discount. No purchases are made. Pausing stops new repairs; current repairs finish normally. Automatic spending stops after 24 hours without orders.</p>
      </Card>
    </Section>
  );
}

function GearTile({ o, onOpen, onRestock }: { o: StoreOption; onOpen: () => void; onRestock: () => void }) {
  const hasUnits = o.owned > 0;
  const tone = o.meanCondition === null ? 'neutral' : conditionTone(o.meanCondition, o.item.wear);
  return (
    <article className="gear">
      {hasUnits && (
        <button type="button" className="gear-open" onClick={onOpen} aria-label={`${o.item.name}: view ${o.owned} unit${o.owned === 1 ? '' : 's'}`} />
      )}
      <div className="gear-hit">
        <span className="gear-row">
          <GearArtFrame itemId={o.item.id} />
          <span className="gear-main">
            <span className="gear-top">
              <strong>{o.item.name}</strong>
              <Chip icon={o.item.kind === 'consumable' ? 'battery' : o.item.kind === 'equipment' ? 'wrench' : 'gear'}>{o.item.kind === 'consumable' ? 'Supply' : o.item.kind === 'equipment' ? 'Gear' : 'Facility'}</Chip>
            </span>
            <span className="gear-desc">{o.item.description}</span>
          </span>
        </span>
        <dl className="counts">
          <Count icon="box" label="Owned" value={o.owned} />
          <Count icon="checkcircle" label="Ready" value={o.ready} tone={o.ready > 0 ? 'mint' : undefined} />
          <Count icon="lock" label="Reserved" value={o.reserved} />
          <Count icon="wrench" label="In service" value={o.inService} />
          <Count icon="warning" label="Unreliable" value={o.unreliable} tone={o.unreliable > 0 ? 'warn' : undefined} />
        </dl>
        {hasUnits && (
          <span className="gear-cond">
            <span className="gear-cond-label">
              <Icon name="gauge" size={14} />
              Mean condition {o.meanCondition === null ? 'n/a' : `${Math.round(o.meanCondition)}%`}
              {o.expired > 0 && <b className="tone-danger"> · {o.expired} expired</b>}
            </span>
            {o.meanCondition !== null && <UnitBar value={o.meanCondition} tone={tone} label={tone === 'good' ? 'Good' : tone === 'worn' ? 'Worn' : 'Low'} />}
            <span className="gear-more">
              Units
              <Icon name="chevronRight" size={14} />
            </span>
          </span>
        )}
      </div>
      <div className="gear-buy">
        <Button size="sm" variant="primary" icon="plus" onClick={onRestock}>
          Restock · {money(o.item.cost)} each
        </Button>
        {!o.canBuy && o.reason && <span className="reason">{o.reason}</span>}
      </div>
    </article>
  );
}

function Count({ icon, label, value, tone }: { icon: IconName; label: string; value: number; tone?: 'mint' | 'warn' }) {
  return (
    <div>
      <dt>
        <Icon name={icon} size={12} />
        {label}
      </dt>
      <dd className={tone ? `tone-${tone}` : ''}>{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- unit sheet

function UnitSheet({ itemId, onClose }: { itemId: Id | null; onClose: () => void }) {
  const g = useGame();
  const item = itemId ? ITEMS[itemId] : undefined;
  const opt = itemId ? storeOptions(g).find((o) => o.item.id === itemId) : undefined;
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={item?.name ?? ''}
      subtitle={
        item && opt ? (
          <span className="chips">
            <Chip icon="box">{opt.owned} owned</Chip>
            {opt.meanCondition !== null && <Chip icon="gauge">Mean {Math.round(opt.meanCondition)}%</Chip>}
          </span>
        ) : undefined
      }
    >
      {item && <>
        <div className="gear-dossier"><GearArtFrame itemId={item.id} size={104} /><p className="dim">{item.description}</p></div>
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
    <div className="units">
      <p className="dim units-note">
        <Icon name="info" size={14} />
        Each unit wears on its own. Base wear is {Math.round(w.perUse * wearMultiplier * 100) / 100} per use and {Math.round(w.perDay * wearMultiplier * 1000) / 1000} per game day, adjusted by the unit's wear rate; below {w.unreliableBelow} it turns unreliable, at {w.failAt} or lower it needs service.{wearMultiplier < 1 && ' Equipment manager wear reduction is included.'}
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
    </div>
  );
}

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
  return (
    <li className={`unit unit-${meta.tone}`}>
      <div className="unit-top">
        <strong className="unit-serial">{u.serial}</strong>
        <Chip tone={meta.tone === 'good' ? 'mint' : meta.tone === 'worn' ? 'amber' : meta.tone === 'bad' ? 'danger' : 'neutral'} icon={meta.icon}>
          {v.stateLabel}
        </Chip>
      </div>
      <div className="unit-cond">
        <UnitBar value={u.condition} tone={meta.tone} label={v.stateLabel} />
        <span className="unit-pct">{Math.round(u.condition)}%</span>
      </div>
      <dl className="unit-facts">
        <div>
          <dt>
            <Icon name="bolt" size={12} />
            Effectiveness
          </dt>
          <dd>{pct(v.effectiveness)}</dd>
        </div>
        <div>
          <dt>
            <Icon name="refresh" size={12} />
            Uses
          </dt>
          <dd>{u.uses}</dd>
        </div>
        <div>
          <dt>
            <Icon name="calendar" size={12} />
            Age
          </dt>
          <dd>{gameDays(ageDays)}</dd>
        </div>
        <div>
          <dt>
            <Icon name="warning" size={12} />
            Unreliable in
          </dt>
          <dd>{v.daysToUnreliable === null ? 'n/a' : v.daysToUnreliable <= 0 ? 'now' : `~${gameDays(v.daysToUnreliable)}`}</dd>
        </div>
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
              <Icon name={itemIcon(o.item.id)} size={22} />
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

function RuleRow({ o, g }: { o: StoreOption; g: GameState }) {
  const { act } = useToast();
  const existing = g.department.restockRules.find((r) => r.itemId === o.item.id);
  const [target, setTarget] = useState(existing?.target ?? 1);
  const [ceiling, setCeiling] = useState(existing?.budgetCeiling ?? o.item.cost * 2);
  useEffect(() => {
    if (existing) {
      setTarget(existing.target);
      setCeiling(existing.budgetCeiling);
    }
  }, [existing]);
  const rule: RestockRule = { itemId: o.item.id, target, budgetCeiling: Math.max(0, Math.round(ceiling)) };
  const same = !!existing && existing.target === rule.target && existing.budgetCeiling === rule.budgetCeiling;
  return (
    <Card className="rule">
      <div className="rule-top">
        <Icon name={itemIcon(o.item.id)} size={22} />
        <strong>{o.item.name}</strong>
        <span className="dim">{o.owned} owned</span>
        {existing && <Chip tone="mint">Rule on</Chip>}
      </div>
      <div className="rule-controls">
        <div className="rule-field">
          <span>Keep at least</span>
          <Stepper label={`${o.item.name} target`} value={target} max={20} onChange={setTarget} />
        </div>
        <label className="rule-field">
          <span>Spend up to ($)</span>
          <input className="num" inputMode="numeric" type="number" min={0} step={50} value={ceiling} onChange={(e) => setCeiling(Number(e.target.value) || 0)} />
        </label>
      </div>
      <div className="row-actions">
        {existing && (
          <Button size="sm" variant="ghost" onClick={() => act({ type: 'setRestockRule', rule: { itemId: o.item.id, remove: true } }, 'Rule removed')}>
            Remove
          </Button>
        )}
        <Button size="sm" variant="primary" disabled={same} onClick={() => act({ type: 'setRestockRule', rule }, 'Rule saved')}>
          {existing ? 'Update rule' : 'Add rule'}
        </Button>
      </div>
    </Card>
  );
}
