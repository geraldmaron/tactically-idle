import { useEffect, useState } from 'react';
import { useGame } from '../store';
import { storeOptions, unitViews } from '../../sim/department-selectors';
import type { StoreOption, UnitView } from '../../sim/department-selectors';
import type { GameState, Id, RestockRule, Squad } from '../../sim/types';
import { CALENDAR } from '../../sim/calendar';
import { ITEMS } from '../../content/items';
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
  return (
    <div className="page">
      <Section title="Inventory" icon="box" hint="Every item is a set of individual units that wear at their own pace. Tap a tile to see each unit, service it or scrap it.">
        {opts.length === 0 ? (
          <Card>
            <EmptyState icon="box" title="No equipment catalogue yet" />
          </Card>
        ) : (
          <div className="gear-grid">
            {opts.map((o) => (
              <GearTile key={o.item.id} o={o} onOpen={() => setUnitsFor(o.item.id)} />
            ))}
          </div>
        )}
      </Section>

      <UnitSheet itemId={unitsFor} onClose={() => setUnitsFor(null)} />

      <Section title="Loadout presets" icon="list" hint="A preset is the gear a squad takes by default. Apply it on the prepare screen.">
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

      <Section title="Restock rules" icon="refresh" hint="Refill an item up to a target after each operation, spending no more than the ceiling. Rules never take funding below zero.">
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
    </div>
  );
}

function GearTile({ o, onOpen }: { o: StoreOption; onOpen: () => void }) {
  const { act } = useToast();
  const hasUnits = o.owned > 0;
  const tone = o.meanCondition === null ? 'neutral' : conditionTone(o.meanCondition, o.item.wear);
  return (
    <article className="gear">
      {hasUnits && (
        <button type="button" className="gear-open" onClick={onOpen} aria-label={`${o.item.name}: view ${o.owned} unit${o.owned === 1 ? '' : 's'}`} />
      )}
      <div className="gear-hit">
        <span className="gear-row">
          <span className="gear-art" aria-hidden="true">
            <Icon name={itemIcon(o.item.id)} size={40} strokeWidth={1.5} />
          </span>
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
        <Button size="sm" variant="primary" icon="plus" disabled={!o.canBuy} onClick={() => act({ type: 'buyItem', itemId: o.item.id, qty: 1 }, `Bought ${o.item.name}`)}>
          Buy · {money(o.item.cost)}
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
      {item && <UnitList itemId={item.id} />}
    </Sheet>
  );
}

function UnitList({ itemId }: { itemId: Id }) {
  const g = useGame();
  const now = Date.now();
  const views = unitViews(g, itemId, now);
  const item = ITEMS[itemId];
  const w = item.wear;
  return (
    <div className="units">
      <p className="dim units-note">
        <Icon name="info" size={14} />
        Each unit wears on its own. Used units lose {w.perUse} per operation and {w.perDay} per game day; below {w.unreliableBelow} they turn unreliable, at {w.failAt} or lower they need service.
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
              Service · {money(w.serviceCost)} · {w.serviceHours}h
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
              ? `Service ${u.serial}? It costs ${money(w.serviceCost)} and is away for ${w.serviceHours}h, then returns at up to ${w.restoreTo}% condition.`
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
  const rows = opts.filter((o) => o.owned > 0 && o.item.kind !== 'infrastructure');
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
