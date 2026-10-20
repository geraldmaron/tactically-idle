// Equipment units: creation, time-based wear, servicing and scrapping.
// Per-use wear is applied at debrief by inventory.settleRun (frozen). This module
// owns the time side: every owned unit ages by perDay x wearRate per game day, and
// servicing / shelf-life expiry are events the settlement walks in time order.
// Wear is linear in time, so splitting a span at any boundary changes nothing.
import type { GameState, HandlerResult, Id, ItemDefinition, ItemUnit, Officer, ShiftReport, UnitStatus } from './types';
import { issueKit } from '../content/issue-kit';
import { ITEMS } from '../content/items';
import { CALENDAR } from './calendar';
import { hashSeed, next } from './rng';
import { tunable } from './tuning';
import { postFunding } from './ledger';

const REAL_HOUR_MS = 3_600_000;

/** What the department's upkeep does to its equipment: a wear multiplier and a service price
 * multiplier. The department works it out (equipment-manager-policy.ts departmentUpkeep) and hands it
 * in, so wear never reads department upgrades. Consumables ignore it. */
export interface Upkeep { wearMultiplier: number; repairMultiplier: number }

/** The share of a unit's wear that lands, after the department's upkeep. */
export function wearFactor(def: ItemDefinition, upkeep: Upkeep): number {
  return def.kind === 'equipment' ? upkeep.wearMultiplier : 1;
}

export function serviceCost(def: ItemDefinition, upkeep: Upkeep): number {
  const base = def.wear.serviceCost;
  // Integer percentages avoid charging $56 for a $100 repair at 45% off
  // because binary floating point represents 100 * 0.55 just above 55.
  const percent = Math.round(upkeep.repairMultiplier * 100);
  return base > 0 ? Math.max(1, Math.ceil(base * percent / 100)) : 0;
}

/** Tunable (sim/tuning.ts). A unit's wear rate is drawn and stored when it is made. */
export const EQUIPMENT_TUNING = tunable('EQUIPMENT_TUNING', {
  /** Per-unit manufacturing variance on wear. */
  wearRateMin: 0.8,
  wearRateMax: 1.25,
  /** Scrapping equipment returns this share of its purchase price. */
  salvageRate: 0.05,
  /** At or above this a working unit reads "Good"; below it (but above unreliableBelow) "Worn". */
  goodAtOrAbove: 75,
}, { guard: next => next.wearRateMin <= 0 || next.wearRateMin > next.wearRateMax ? 'Wear rates need 0 < wearRateMin ≤ wearRateMax.' : null });

/** Serial prefix per item: 'RH-0142'. The number comes from the department id counter, so it never repeats. */
const SERIAL_PREFIX: Record<Id, string> = {
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
  /** A fixed 0..1 draw for the wear rate instead of the department's dice. */
  wearRoll?: number;
}

/**
 * Create one unit on the draft: id and serial from the id counter, wearRate from
 * the department PRNG (deterministic), expiry for consumables. Returns the unit,
 * already stored in draft.units.
 */
export function createUnit(d: GameState, itemId: Id, now: number, seed: UnitSeed = {}, historicalDefinition?: ItemDefinition): ItemUnit {
  const def = historicalDefinition ?? ITEMS[itemId];
  let roll = seed.wearRoll;
  if (roll === undefined) {
    const r = next(d.rngState);
    d.rngState = r.state;
    roll = r.value;
  }
  const wearRate = Math.round((EQUIPMENT_TUNING.wearRateMin + roll * (EQUIPMENT_TUNING.wearRateMax - EQUIPMENT_TUNING.wearRateMin)) * 1000) / 1000;
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

/** Start-up grant: every starting officer's issue kit (content/issue-kit.ts) plus department kit.
 * Seeds give varied condition and age so wear is visible from day one; an item with more units
 * than seeds starts the rest new. */
const DEPARTMENT_KIT: Record<Id, number> = { throw_phone: 1, ballistic_shield: 2, trauma_kit: 4 };
const STARTING_SEEDS: Record<Id, UnitSeed[]> = {
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
  service_sidearm: [
    { condition: 90, ageDays: 500, uses: 10 },
    { condition: 82, ageDays: 650, uses: 18 },
  ],
  // Issued to everyone; the oldest is due for service soon. Fixed draws keep the department's dice
  // where they were before light protection joined the grant.
  light_protection: [
    { condition: 92, ageDays: 180, uses: 5, wearRoll: 0.42 },
    { condition: 86, ageDays: 360, uses: 11, wearRoll: 0.67 },
    { condition: 74, ageDays: 620, uses: 19, wearRoll: 0.31 },
    { condition: 63, ageDays: 900, uses: 26, wearRoll: 0.85 },
  ],
  ballistic_shield: [
    { condition: 93, ageDays: 400, uses: 6 },
    { condition: 77, ageDays: 700, uses: 14 },
  ],
  door_ram: [{ condition: 85, ageDays: 600, uses: 12 }],
  // Consumables derive condition from age; trauma kits do not fade, only expire (540 days).
  trauma_kit: [{ ageDays: 20 }, { ageDays: 90 }, { ageDays: 150 }, { ageDays: 260 }, { ageDays: 350 }, { ageDays: 490 }],
};

/** Spare stock beyond the seeded units: serviceable, a few years in the store room. */
const SPARE_SEED: UnitSeed = { condition: 70, ageDays: 720, uses: 6 };

/** How many of each item the start-up grant holds for this roster. */
export function startingGrant(officers: Iterable<Pick<Officer, 'role' | 'certs'>>): Record<Id, number> {
  const grant: Record<Id, number> = { ...DEPARTMENT_KIT };
  for (const o of officers) for (const itemId of issueKit(o)) grant[itemId] = (grant[itemId] ?? 0) + 1;
  return grant;
}

export function createStartingUnits(d: GameState, now: number): void {
  const grant = startingGrant(Object.values(d.officers));
  // The seeded units come first, in seed order, on the department's dice as they always have. Kit
  // beyond the seeds is older spare stock with its own fixed draw, so how much a department starts
  // with never moves the dice its recruits, board and later purchases use.
  for (const [itemId, seeds] of Object.entries(STARTING_SEEDS)) {
    for (const seed of seeds.slice(0, grant[itemId] ?? 0)) createUnit(d, itemId, now, seed);
  }
  for (const itemId of Object.keys(grant).sort()) {
    for (let i = STARTING_SEEDS[itemId]?.length ?? 0; i < grant[itemId]; i++) {
      createUnit(d, itemId, now, { ...SPARE_SEED, wearRoll: next(hashSeed(`start-grant:${itemId}:${i}`)).value });
    }
  }
}

// ---------------------------------------------------------------- queries

/** Units the department still holds: not scrapped, not expired. */
function ownedUnits(state: GameState, itemId: Id): ItemUnit[] {
  return Object.values(state.units).filter((u) => u.itemId === itemId && u.status !== 'scrapped' && u.status !== 'expired');
}

export function ownedCount(state: GameState, itemId: Id): number {
  return ownedUnits(state, itemId).length;
}

/** Condition now, projecting unsettled time since the last settlement for units that age. */
export function projectedCondition(state: GameState, u: ItemUnit, now: number, upkeep: Upkeep): number {
  const def = ITEMS[u.itemId];
  if (!def || (u.status !== 'ready' && u.status !== 'reserved')) return u.condition;
  const gapDays = Math.max(0, now - state.department.clockHighWater) / CALENDAR.gameDayMs;
  return Math.max(0, u.condition - def.wear.perDay * u.wearRate * wearFactor(def, upkeep) * gapDays);
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
export function daysToUnreliable(def: ItemDefinition, u: ItemUnit, condition: number, wearMultiplier = 1): number | null {
  if (u.status === 'expired' || u.status === 'scrapped' || u.status === 'service') return null;
  const rate = def.wear.perDay * u.wearRate * wearMultiplier;
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
export function applyUnitWear(d: GameState, t: number, e: number, events: EquipmentEvent[], upkeep: Upkeep): void {
  const days = (e - t) / CALENDAR.gameDayMs;
  if (!(days > 0)) return;
  for (const u of Object.values(d.units)) {
    if (u.status !== 'ready' && u.status !== 'reserved') continue;
    const def = ITEMS[u.itemId];
    if (!def) continue;
    const loss = def.wear.perDay * u.wearRate * wearFactor(def, upkeep) * days;
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

export function serviceCheck(state: GameState, unitId: Id, now: number, upkeep: Upkeep): UnitActionCheck & { cost: number; hours: number } {
  const u = state.units[unitId];
  const no = (reason: string, cost = 0, hours = 0) => ({ ok: false, reason, cost, hours });
  if (!u) return no('No such unit');
  const def = ITEMS[u.itemId];
  if (!def) return no('Unknown item');
  const { serviceHours: hours, restoreTo } = def.wear;
  const cost = serviceCost(def, upkeep);
  if (def.kind !== 'equipment') return no('Consumables cannot be serviced', cost, hours);
  if (hours <= 0) return no(`${def.name} cannot be serviced`, cost, hours);
  if (u.status !== 'ready') return no(`${u.serial} is ${STATUS_WORD[u.status]}`, cost, hours);
  const cond = projectedCondition(state, u, now, upkeep);
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

export function beginService(d: GameState, unitId: Id, now: number, upkeep: Upkeep): HandlerResult {
  const c = serviceCheck(d, unitId, now, upkeep);
  if (!c.ok) return { ok: false, reason: c.reason ?? 'Cannot service this unit' };
  const u = d.units[unitId];
  postFunding(d.department, -c.cost, 'service', `Service for ${ITEMS[u.itemId]?.name ?? u.serial}`, now);
  u.status = 'service';
  u.serviceUntil = now + c.hours * REAL_HOUR_MS;
  u.lastWearAt = now;
  return { ok: true };
}

function serviceUnit(d: GameState, unitId: Id, upkeep: Upkeep): HandlerResult {
  return beginService(d, unitId, d.department.clockHighWater, upkeep);
}

function scrapUnit(d: GameState, unitId: Id): HandlerResult {
  const c = scrapCheck(d, unitId);
  if (!c.ok) return { ok: false, reason: c.reason ?? 'Cannot scrap this unit' };
  const u = d.units[unitId];
  u.status = 'scrapped';
  u.serviceUntil = null;
  postFunding(d.department, c.salvage, 'salvage', `Salvage from ${ITEMS[u.itemId]?.name ?? u.serial}`, d.department.clockHighWater);
  return { ok: true };
}

export const EQUIPMENT_HANDLERS = { serviceUnit, scrapUnit };
