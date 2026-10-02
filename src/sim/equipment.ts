// Equipment units: creation, time-based wear, servicing and scrapping.
// Per-use wear is applied at debrief by inventory.settleRun (frozen). This module
// owns the time side: every owned unit ages by perDay x wearRate per game day, and
// servicing / shelf-life expiry are events the settlement walks in time order.
// Wear is linear in time, so splitting a span at any boundary changes nothing.
import type { GameState, HandlerResult, Id, ItemDefinition, ItemUnit, ShiftReport, UnitStatus } from './types';
import { ITEMS } from '../content/items';
import { CALENDAR } from './calendar';
import { next } from './rng';

const REAL_HOUR_MS = 3_600_000;

export const EQUIPMENT_TUNING = {
  /** Per-unit manufacturing variance on wear. */
  wearRateMin: 0.8,
  wearRateMax: 1.25,
  /** Scrapping equipment returns this share of its purchase price. */
  salvageRate: 0.05,
  /** At or above this a working unit reads "Good"; below it (but above unreliableBelow) "Worn". */
  goodAtOrAbove: 75,
};

/** Serial prefix per item: 'RH-0142'. The number comes from the department id counter, so it never repeats. */
export const SERIAL_PREFIX: Record<Id, string> = {
  radio_kit: 'RH',
  loud_hailer: 'LH',
  throw_phone: 'TP',
  thermal_imager: 'TI',
  camera_drone: 'CD',
  ballistic_shield: 'BS',
  door_ram: 'DR',
  trauma_kit: 'TK',
  battery_pack: 'BP',
};

export type EquipmentEvent = ShiftReport['equipment'][number];

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- creation

export interface UnitSeed {
  /** Explicit starting condition. Default derives from age and the unit's own wear rate. */
  condition?: number;
  /** Game days since acquisition. */
  ageDays?: number;
  uses?: number;
}

/**
 * Create one unit on the draft: id and serial from the id counter, wearRate from
 * the department PRNG (deterministic), expiry for consumables. Returns the unit,
 * already stored in draft.units.
 */
export function createUnit(d: GameState, itemId: Id, now: number, seed: UnitSeed = {}): ItemUnit {
  const def = ITEMS[itemId];
  const r = next(d.rngState);
  d.rngState = r.state;
  const wearRate = Math.round((EQUIPMENT_TUNING.wearRateMin + r.value * (EQUIPMENT_TUNING.wearRateMax - EQUIPMENT_TUNING.wearRateMin)) * 1000) / 1000;
  const n = d.nextId++;
  const prefix = SERIAL_PREFIX[itemId] ?? itemId.slice(0, 2).toUpperCase();
  const ageDays = seed.ageDays ?? 0;
  const acquiredAt = now - ageDays * CALENDAR.gameDayMs;
  const aged = def ? 100 - def.wear.perDay * wearRate * ageDays : 100;
  const condition = round2(Math.max(0, Math.min(100, seed.condition ?? aged)));
  const unit: ItemUnit = {
    id: `unit_${n}`,
    itemId,
    serial: `${prefix}-${String(100 + n).padStart(4, '0')}`,
    condition,
    acquiredAt,
    uses: seed.uses ?? 0,
    status: 'ready',
    serviceUntil: null,
    wearRate,
    expiresAt: def?.wear.shelfLifeDays != null ? acquiredAt + def.wear.shelfLifeDays * CALENDAR.gameDayMs : null,
    lastWearAt: now,
  };
  d.units[unit.id] = unit;
  return unit;
}

/** Starting stock: varied condition and age so wear is visible from day one. */
const STARTING_UNITS: Record<Id, UnitSeed[]> = {
  // One radio sits close to unreliable (45): about 90 game days at its wear rate.
  radio_kit: [
    { condition: 96, ageDays: 40, uses: 3 },
    { condition: 91, ageDays: 120, uses: 8 },
    { condition: 84, ageDays: 210, uses: 11 },
    { condition: 78, ageDays: 260, uses: 14 },
    { condition: 71, ageDays: 330, uses: 19 },
    { condition: 58, ageDays: 480, uses: 27 },
  ],
  loud_hailer: [
    { condition: 88, ageDays: 300, uses: 9 },
    { condition: 69, ageDays: 500, uses: 20 },
  ],
  throw_phone: [{ condition: 81, ageDays: 150, uses: 4 }],
  ballistic_shield: [
    { condition: 93, ageDays: 400, uses: 6 },
    { condition: 77, ageDays: 700, uses: 14 },
  ],
  door_ram: [{ condition: 85, ageDays: 600, uses: 12 }],
  // Consumables derive condition from age; trauma kits do not fade, only expire (540 days).
  trauma_kit: [{ ageDays: 20 }, { ageDays: 90 }, { ageDays: 150 }, { ageDays: 260 }, { ageDays: 350 }, { ageDays: 490 }],
  // Batteries fade fastest: the oldest is ~25 days from unreliable (50).
  battery_pack: [{ ageDays: 15 }, { ageDays: 40 }, { ageDays: 70 }, { ageDays: 95 }, { ageDays: 115 }, { ageDays: 124 }],
};

export function createStartingUnits(d: GameState, now: number): void {
  for (const [itemId, seeds] of Object.entries(STARTING_UNITS)) {
    for (const seed of seeds) createUnit(d, itemId, now, seed);
  }
}

// ---------------------------------------------------------------- queries

/** Units the department still holds: not scrapped, not expired. */
export function ownedUnits(state: GameState, itemId: Id): ItemUnit[] {
  return Object.values(state.units).filter((u) => u.itemId === itemId && u.status !== 'scrapped' && u.status !== 'expired');
}

export function ownedCount(state: GameState, itemId: Id): number {
  return ownedUnits(state, itemId).length;
}

/** Condition now, projecting unsettled time since the last settlement for units that age. */
export function projectedCondition(state: GameState, u: ItemUnit, now: number): number {
  const def = ITEMS[u.itemId];
  if (!def || (u.status !== 'ready' && u.status !== 'reserved')) return u.condition;
  const gapDays = Math.max(0, now - state.department.clockHighWater) / CALENDAR.gameDayMs;
  return Math.max(0, u.condition - def.wear.perDay * u.wearRate * gapDays);
}

export function stateLabelFor(u: ItemUnit, def: ItemDefinition, condition: number): string {
  if (u.status === 'reserved') return 'Reserved';
  if (u.status === 'service') return 'In service';
  if (u.status === 'expired') return 'Expired';
  if (condition <= def.wear.failAt) return 'Failed';
  if (condition < def.wear.unreliableBelow) return 'Unreliable';
  return condition >= EQUIPMENT_TUNING.goodAtOrAbove ? 'Good' : 'Worn';
}

/** Game days until the unit drops below unreliableBelow at its own daily rate; null when it never will or already has. */
export function daysToUnreliable(def: ItemDefinition, u: ItemUnit, condition: number): number | null {
  if (u.status === 'expired' || u.status === 'scrapped' || u.status === 'service') return null;
  const rate = def.wear.perDay * u.wearRate;
  if (rate <= 0 || def.wear.unreliableBelow <= 0) return null;
  if (condition < def.wear.unreliableBelow) return null;
  return (condition - def.wear.unreliableBelow) / rate;
}

// ---------------------------------------------------------------- settlement hooks

/** Apply every unit event due at or before t: finished servicing, then shelf-life expiry. */
export function applyUnitDue(d: GameState, t: number, events: EquipmentEvent[]): void {
  for (const u of Object.values(d.units)) {
    const def = ITEMS[u.itemId];
    if (u.status === 'service' && u.serviceUntil !== null && u.serviceUntil <= t) {
      if (def) u.condition = Math.max(u.condition, def.wear.restoreTo);
      u.status = 'ready';
      u.serviceUntil = null;
      u.lastWearAt = t;
      events.push({ unitId: u.id, event: 'serviced' });
    } else if (u.status === 'ready' && u.expiresAt !== null && u.expiresAt <= t) {
      u.status = 'expired';
      events.push({ unitId: u.id, event: 'expired' });
    }
  }
}

/** Earliest unit event strictly after t, or null. Reserved units do not expire until released. */
export function nextUnitEventTime(d: GameState, t: number): number | null {
  let e: number | null = null;
  for (const u of Object.values(d.units)) {
    const x = u.status === 'service' ? u.serviceUntil : u.status === 'ready' ? u.expiresAt : null;
    if (x !== null && x > t && (e === null || x < e)) e = x;
  }
  return e;
}

/**
 * Time wear across [t, e): condition -= perDay x wearRate x gameDays. Ready and
 * reserved units age; units in service, expired or scrapped do not. Records the
 * threshold crossings (unreliable, failed) that happen inside the span.
 */
export function applyUnitWear(d: GameState, t: number, e: number, events: EquipmentEvent[]): void {
  const days = (e - t) / CALENDAR.gameDayMs;
  if (!(days > 0)) return;
  for (const u of Object.values(d.units)) {
    if (u.status !== 'ready' && u.status !== 'reserved') continue;
    const def = ITEMS[u.itemId];
    if (!def) continue;
    const loss = def.wear.perDay * u.wearRate * days;
    if (loss > 0) {
      const before = u.condition;
      const after = Math.max(0, before - loss);
      u.condition = after;
      const { unreliableBelow, failAt } = def.wear;
      if (unreliableBelow > 0 && before >= unreliableBelow && after < unreliableBelow) events.push({ unitId: u.id, event: 'unreliable' });
      if (failAt > 0 && before > failAt && after <= failAt) events.push({ unitId: u.id, event: 'failed' });
    }
    u.lastWearAt = e;
  }
}

// ---------------------------------------------------------------- servicing and scrapping

export interface UnitActionCheck {
  ok: boolean;
  reason: string | null;
}

const STATUS_WORD: Record<UnitStatus, string> = {
  ready: 'ready',
  reserved: 'deployed on an operation',
  service: 'in service',
  expired: 'expired',
  scrapped: 'scrapped',
};

export function serviceCheck(state: GameState, unitId: Id, now: number): UnitActionCheck & { cost: number; hours: number } {
  const u = state.units[unitId];
  const no = (reason: string, cost = 0, hours = 0) => ({ ok: false, reason, cost, hours });
  if (!u) return no('No such unit');
  const def = ITEMS[u.itemId];
  if (!def) return no('Unknown item');
  const { serviceCost: cost, serviceHours: hours, restoreTo } = def.wear;
  if (def.kind !== 'equipment') return no('Consumables cannot be serviced', cost, hours);
  if (hours <= 0) return no(`${def.name} cannot be serviced`, cost, hours);
  if (u.status !== 'ready') return no(`${u.serial} is ${STATUS_WORD[u.status]}`, cost, hours);
  const cond = projectedCondition(state, u, now);
  if (cond >= restoreTo) return no(`${u.serial} is already in better condition than servicing restores (${restoreTo})`, cost, hours);
  if (state.department.funding < cost) return no(`Needs $${cost.toLocaleString('en-US')} (have $${Math.floor(state.department.funding).toLocaleString('en-US')})`, cost, hours);
  return { ok: true, reason: null, cost, hours };
}

export function scrapCheck(state: GameState, unitId: Id): UnitActionCheck & { salvage: number } {
  const u = state.units[unitId];
  const no = (reason: string) => ({ ok: false, reason, salvage: 0 });
  if (!u) return no('No such unit');
  const def = ITEMS[u.itemId];
  if (u.status === 'scrapped') return no(`${u.serial} is already scrapped`);
  if (u.status === 'reserved') return no(`${u.serial} is deployed on an operation`);
  if (u.status === 'service') return no(`${u.serial} is being serviced`);
  const salvage = def && def.kind === 'equipment' ? Math.round(def.cost * EQUIPMENT_TUNING.salvageRate) : 0;
  return { ok: true, reason: null, salvage };
}

function serviceUnit(d: GameState, unitId: Id): HandlerResult {
  const now = d.department.clockHighWater;
  const c = serviceCheck(d, unitId, now);
  if (!c.ok) return { ok: false, reason: c.reason ?? 'Cannot service this unit' };
  const u = d.units[unitId];
  d.department.funding -= c.cost;
  u.status = 'service';
  u.serviceUntil = now + c.hours * REAL_HOUR_MS;
  u.lastWearAt = now;
  return { ok: true };
}

function scrapUnit(d: GameState, unitId: Id): HandlerResult {
  const c = scrapCheck(d, unitId);
  if (!c.ok) return { ok: false, reason: c.reason ?? 'Cannot scrap this unit' };
  const u = d.units[unitId];
  u.status = 'scrapped';
  u.serviceUntil = null;
  d.department.funding += c.salvage;
  return { ok: true };
}

export const EQUIPMENT_HANDLERS = { serviceUnit, scrapUnit };
