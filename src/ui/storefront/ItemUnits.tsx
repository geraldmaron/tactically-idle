// An owned item's physical units: the stock bar and each unit's condition, service and scrap.
// Shown inside the item's Armory sheet (gear-armory), the one place an item is bought and kept.
import { useState } from 'react';
import { unitViews } from '../../sim/department-selectors';
import type { StoreOption, UnitView } from '../../sim/department-selectors';
import type { Id } from '../../sim/types';
import { CALENDAR } from '../../sim/calendar';
import { ITEMS } from '../../content/items';
import { equipmentWearMultiplier } from '../../sim/equipment-manager-policy';
import { useGame } from '../store';
import { useToast } from '../components/toast';
import { Button, EmptyState, UnitBar } from '../components/ui';
import { Disclosure } from '../components/Disclosure';
import { UNIT_STATE_META } from '../components/labels';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { gameDays, money, pct, relativeTime } from '../format';

/** Stock as one segmented bar: ready, unreliable, reserved, in service and expired. */
export function StockBar({ o }: { o: StoreOption }) {
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

export function UnitList({ itemId }: { itemId: Id }) {
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
        <EmptyState spot="nothingInStock" title="No units to show">
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
      <Disclosure name="unit" row="unit-row" summary={<>
          <strong className="unit-serial">{u.serial}</strong>
          <span className="unit-cond">
            <UnitBar value={u.condition} tone={meta.tone} label={v.stateLabel} />
          </span>
          <span className="unit-pct">{Math.round(u.condition)}%</span>
          <span className={`unit-state unit-state-${meta.tone}`} title={v.stateLabel}><Icon name={meta.icon} size={13} /><span className="unit-state-text">{v.stateLabel}</span></span>
          {busyLine && <span className="unit-busy dim">{busyLine}</span>}
        </>}>
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
      </Disclosure>
    </li>
  );
}

