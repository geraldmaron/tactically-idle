import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { HOUR_MS } from './economy';
import { ITEMS } from '../content/items';
import { createUnit, projectedCondition, serviceCheck } from './equipment';
import { reserveLoadouts, settleRun } from './inventory';
import { equipmentServiceCost, equipmentWearMultiplier, maintenanceBudget } from './equipment-manager-policy';
import { deserialize, serialize } from './save';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 9, 2, 12);
const ok = (state: GameState, command: Command, now = T0) => {
  const result = dispatch(state, command, { now });
  expect(result.result).toEqual({ ok: true });
  return result.state;
};
const hired = () => ok(createInitialState(T0, 71), { type: 'unlockNode', nodeId: 'logistics_equipment_manager' });
function workshop() {
  const state = hired();
  state.units = {};
  for (let i = 0; i < 5; i++) createUnit(state, 'ballistic_shield', T0, { condition: 20 + i * 5, ageDays: 0 });
  return state;
}

describe('equipment manager', () => {
  it('charges a real one-time hire, starts automatic spending paused, and never stacks benefits', () => {
    const original = createInitialState(T0, 71);
    const next = ok(original, { type: 'unlockNode', nodeId: 'logistics_equipment_manager' });
    expect(next.department.funding).toBe(original.department.funding - 2500);
    expect(next.department.devPoints).toBe(original.department.devPoints - 3);
    expect(maintenanceBudget(next)).toBe(0);
    expect(dispatch(next, { type: 'unlockNode', nodeId: 'logistics_equipment_manager' }, { now: T0 }).result.ok).toBe(false);
    expect(equipmentServiceCost(next, ITEMS.radio_kit)).toBe(45);
    next.department.unlockedNodes.push('logistics_equipment_manager');
    expect(equipmentServiceCost(next, ITEMS.radio_kit)).toBe(45);
    expect(equipmentWearMultiplier(next, ITEMS.radio_kit)).toBe(0.8);
    expect(equipmentWearMultiplier(next, ITEMS.trauma_kit)).toBe(1);
  });

  it('uses the same discounted quote and charge, rounds upward, and does not refund pre-hire repairs', () => {
    let state = createInitialState(T0, 71);
    const radio = Object.values(state.units).find((u) => u.itemId === 'radio_kit' && u.condition < 75)!;
    const before = state.department.funding;
    state = ok(state, { type: 'serviceUnit', unitId: radio.id });
    expect(state.department.funding).toBe(before - 60);
    const until = state.units[radio.id].serviceUntil;
    state = ok(state, { type: 'unlockNode', nodeId: 'logistics_equipment_manager' });
    expect(state.units[radio.id].serviceUntil).toBe(until);
    const other = Object.values(state.units).find((u) => u.itemId === 'radio_kit' && u.status === 'ready' && u.condition < 75)!;
    expect(serviceCheck(state, other.id, T0).cost).toBe(45);
    const funds = state.department.funding;
    state = ok(state, { type: 'serviceUnit', unitId: other.id });
    expect(state.department.funding).toBe(funds - 45);
    expect(equipmentServiceCost(state, { ...ITEMS.radio_kit, wear: { ...ITEMS.radio_kit.wear, serviceCost: 3 } })).toBe(3);
    expect(equipmentServiceCost(state, { ...ITEMS.radio_kit, wear: { ...ITEMS.radio_kit.wear, serviceCost: 1 } })).toBe(1);
  });

  it('reduces reusable time and per-use wear once, while consumables retain their normal aging and consumption', () => {
    const state = hired();
    const radio = Object.values(state.units).find((u) => u.itemId === 'radio_kit')!;
    const consumable = Object.values(state.units).find((u) => u.itemId === 'trauma_kit')!;
    const next = ok(state, { type: 'tick' }, T0 + HOUR_MS);
    expect(next.units[radio.id].condition).toBeCloseTo(radio.condition - ITEMS.radio_kit.wear.perDay * radio.wearRate * 0.8, 8);
    expect(projectedCondition(state, radio, T0 + HOUR_MS)).toBeCloseTo(next.units[radio.id].condition, 8);
    expect(next.units[consumable.id].condition).toBeCloseTo(consumable.condition - ITEMS.trauma_kit.wear.perDay * consumable.wearRate, 8);
    expect(reserveLoadouts(next, 'wear-test', { A: { radio_kit: 1, trauma_kit: 1 } }, { A: [radio.id, consumable.id] }, T0 + HOUR_MS)).toEqual({ ok: true });
    const radioBefore = next.units[radio.id].condition;
    settleRun(next, 'wear-test', [radio.id, consumable.id], T0 + HOUR_MS);
    expect(next.units[radio.id].condition).toBe(Math.round((radioBefore - 6 * radio.wearRate * 0.8) * 10) / 10);
    expect(next.units[consumable.id]).toBeUndefined();
  });

  it('does not spend automatically until a budget is explicitly enabled and cannot enable without a manager', () => {
    const original = createInitialState(T0);
    expect(dispatch(original, { type: 'setMaintenanceBudget', perHour: 200 }, { now: T0 }).result.ok).toBe(false);
    const state = workshop();
    const paused = ok(state, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(Object.values(paused.units).every((u) => u.status === 'ready')).toBe(true);
    expect(paused.report?.maintenanceSpend).toBe(0);
    for (const perHour of [-1, 501, 2.5, NaN, Infinity]) expect(dispatch(state, { type: 'setMaintenanceBudget', perHour }, { now: T0 }).result.ok).toBe(false);
  });

  it('runs once per absolute hour, respects the ceiling and two service slots, and produces a transparent report', () => {
    const start = ok(workshop(), { type: 'setMaintenanceBudget', perHour: 60 });
    const beforeHour = ok(start, { type: 'tick' }, T0 + HOUR_MS - 1);
    expect(Object.values(beforeHour.units).filter((u) => u.status === 'service')).toHaveLength(0);
    const oneHour = ok(beforeHour, { type: 'tick' }, T0 + HOUR_MS);
    expect(Object.values(oneHour.units).filter((u) => u.status === 'service')).toHaveLength(1);
    expect(oneHour.report?.maintenanceSpend).toBe(60);
    expect(oneHour.report?.maintenanceStarted).toHaveLength(1);
    const repeated = ok(oneHour, { type: 'tick' }, T0 + HOUR_MS);
    expect(repeated.units).toEqual(oneHour.units);
    expect(repeated.department.funding).toBe(oneHour.department.funding);
    const later = ok(repeated, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(Object.values(later.units).filter((u) => u.status === 'service')).toHaveLength(2);
    expect(later.report?.maintenanceSpend).toBe(120);
  });

  it('preserves the treasury floor and skips quotes above the chosen ceiling', () => {
    for (const [funding, budget] of [[999, 500], [1000, 500], [2000, 59]]) {
      const state = ok(workshop(), { type: 'setMaintenanceBudget', perHour: budget });
      state.department.funding = funding;
      // Start one millisecond before the grid so income cannot fund a repair.
      state.department.lastSettledAt = T0 + HOUR_MS - 1;
      state.department.clockHighWater = T0 + HOUR_MS - 1;
      const result = ok(state, { type: 'tick' }, T0 + HOUR_MS);
      expect(result.report?.maintenanceSpend ?? 0).toBe(0);
      expect(Object.values(result.units).every((u) => u.status === 'ready')).toBe(true);
    }
  });

  it('never services deployed/reserved units or consumables, and keeps working radios for assigned officers', () => {
    const state = ok(hired(), { type: 'setMaintenanceBudget', perHour: 500 });
    for (const u of Object.values(state.units)) u.condition = u.itemId === 'radio_kit' ? 50 : 100;
    const shield = Object.values(state.units).find((u) => u.itemId === 'ballistic_shield')!;
    shield.condition = 20;
    shield.status = 'reserved';
    const otherShield = Object.values(state.units).find((u) => u.itemId === 'ballistic_shield' && u.id !== shield.id)!;
    otherShield.condition = 20;
    state.reservations.push({ id: 'held', runId: 'elsewhere', squadId: 'A', itemId: otherShield.itemId, unitId: otherShield.id });
    const next = ok(state, { type: 'tick' }, T0 + HOUR_MS);
    expect(Object.values(next.units).filter((u) => u.status === 'service')).toHaveLength(0);
    expect(Object.values(next.units).filter((u) => u.itemId === 'radio_kit' && u.status === 'ready')).toHaveLength(6);
    const failedRadio = Object.values(next.units).find((u) => u.itemId === 'radio_kit')!;
    failedRadio.condition = 0;
    const repaired = ok(next, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(repaired.units[failedRadio.id].status).toBe('service');
  });

  it('pausing prevents new charges while allowing a paid repair to finish', () => {
    let state = ok(workshop(), { type: 'setMaintenanceBudget', perHour: 60 });
    state = ok(state, { type: 'tick' }, T0 + HOUR_MS);
    const running = Object.values(state.units).find((u) => u.status === 'service')!;
    state = ok(state, { type: 'setMaintenanceBudget', perHour: 0 }, T0 + HOUR_MS);
    const spent = state.report?.maintenanceSpend;
    state = ok(state, { type: 'tick' }, T0 + 7 * HOUR_MS);
    expect(state.units[running.id].status).toBe('ready');
    expect(state.report?.maintenanceSpend).toBe(spent);
    expect(Object.values(state.units).filter((u) => u.uses === 0 && u.status === 'service')).toHaveLength(0);
  });

  it('matches online and offline service events and stops automatic spending beyond the 24-hour income window', () => {
    const start = ok(workshop(), { type: 'setMaintenanceBudget', perHour: 200 });
    let online = start;
    for (let now = T0 + 10 * 60_000; now <= T0 + 30 * HOUR_MS; now += 10 * 60_000) online = ok(online, { type: 'tick' }, now);
    const offline = ok(start, { type: 'tick' }, T0 + 30 * HOUR_MS);
    expect(online.department.funding).toBeCloseTo(offline.department.funding, 6);
    expect(online.report?.maintenanceSpend).toBe(offline.report?.maintenanceSpend);
    for (const id of Object.keys(online.units)) {
      expect(online.units[id].condition).toBeCloseTo(offline.units[id].condition, 6);
      expect(online.units[id].status).toBe(offline.units[id].status);
      expect(online.units[id].serviceUntil).toBe(offline.units[id].serviceUntil);
    }
    const atCap = ok(start, { type: 'tick' }, T0 + 24 * HOUR_MS);
    expect(offline.report?.maintenanceSpend).toBe(atCap.report?.maintenanceSpend);
    expect(offline.department.funding).toBeCloseTo(atCap.department.funding, 6);
  });

  it('preserves legacy saves with paused defaults and persists manager settings, repairs and reporting', () => {
    const legacy = createInitialState(T0);
    const migrated = deserialize(serialize(legacy, T0))!;
    expect(maintenanceBudget(migrated)).toBe(0);
    let active = ok(workshop(), { type: 'setMaintenanceBudget', perHour: 200 });
    active = ok(active, { type: 'tick' }, T0 + HOUR_MS);
    const restored = deserialize(serialize(active, T0 + HOUR_MS));
    expect(restored).toEqual(active);
    for (const invalid of [-1, 501, 1.5, '200']) {
      const broken = JSON.parse(serialize(active, T0));
      broken.state.department.maintenanceBudgetPerHour = invalid;
      expect(deserialize(JSON.stringify(broken))).toBeNull();
    }
  });

  it('makes the same service decision at the wear threshold for online and offline time', () => {
    for (const itemId of ['radio_kit', 'ballistic_shield', 'loud_hailer']) {
      const start = ok(hired(), { type: 'setMaintenanceBudget', perHour: 200 });
      start.units = {};
      start.squads = [];
      createUnit(start, itemId, T0, { condition: 75 + ITEMS[itemId].wear.perDay * 0.8, ageDays: 0 });
      const unit = Object.values(start.units)[0];
      unit.wearRate = 1;
      unit.condition = 75 + ITEMS[itemId].wear.perDay * 0.8;
      let online = start;
      for (let t = T0 + 5000; t <= T0 + HOUR_MS; t += 5000) online = ok(online, { type: 'tick' }, t);
      const offline = ok(start, { type: 'tick' }, T0 + HOUR_MS);
      expect(online.units[unit.id].status).toBe('ready');
      expect(offline.units[unit.id].status).toBe('ready');
      expect(online.report?.maintenanceSpend ?? 0).toBe(0);
      expect(offline.report?.maintenanceSpend ?? 0).toBe(0);
      const onlineNext = ok(online, { type: 'tick' }, T0 + 2 * HOUR_MS);
      const offlineNext = ok(start, { type: 'tick' }, T0 + 2 * HOUR_MS);
      expect(onlineNext.units[unit.id].status).toBe('service');
      expect(onlineNext.units[unit.id].serviceUntil).toBe(offlineNext.units[unit.id].serviceUntil);
      expect(onlineNext.report?.maintenanceSpend).toBe(offlineNext.report?.maintenanceSpend);
      expect(onlineNext.department.funding).toBeCloseTo(offlineNext.department.funding, 6);
    }
  });

  it('permits separately requested manual repairs but does not open more automatic jobs while they occupy capacity', () => {
    let state = ok(workshop(), { type: 'setMaintenanceBudget', perHour: 200 });
    state = ok(state, { type: 'tick' }, T0 + HOUR_MS);
    expect(Object.values(state.units).filter((u) => u.status === 'service')).toHaveLength(2);
    const manual = Object.values(state.units).find((u) => u.status === 'ready')!;
    state = ok(state, { type: 'serviceUnit', unitId: manual.id }, T0 + HOUR_MS);
    expect(Object.values(state.units).filter((u) => u.status === 'service')).toHaveLength(3);
    const managerSpend = state.report?.maintenanceSpend;
    state = ok(state, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(state.report?.maintenanceSpend).toBe(managerSpend);
    expect(Object.values(state.units).filter((u) => u.status === 'service')).toHaveLength(3);
  });

  it('makes identical service decisions exactly at the treasury floor without granting extra funding', () => {
    for (const itemId of ['ballistic_shield', 'loud_hailer', 'door_ram']) {
      const start = ok(hired(), { type: 'setMaintenanceBudget', perHour: 500 });
      start.units = {};
      createUnit(start, itemId, T0, { condition: 20, ageDays: 0 });
      const unit = Object.values(start.units)[0];
      const price = equipmentServiceCost(start, ITEMS[itemId]);
      start.department.funding = 1000 + price - 620;
      let online = start;
      for (let t = T0 + 5000; t <= T0 + HOUR_MS; t += 5000) online = ok(online, { type: 'tick' }, t);
      const offline = ok(start, { type: 'tick' }, T0 + HOUR_MS);
      expect(online.units[unit.id].status).toBe('service');
      expect(online.units[unit.id].serviceUntil).toBe(offline.units[unit.id].serviceUntil);
      expect(online.department.funding).toBeCloseTo(1000, 6);
      expect(online.department.funding).toBeGreaterThanOrEqual(1000);
      expect(offline.department.funding).toBeCloseTo(1000, 6);
      expect(online.report?.maintenanceSpend).toBe(price);
      expect(offline.report?.maintenanceSpend).toBe(price);
    }
  });

  it('does not mistake floating-point residue for a working radio at the failure boundary', () => {
    const start = ok(hired(), { type: 'setMaintenanceBudget', perHour: 200 });
    start.units = {};
    createUnit(start, 'radio_kit', T0, { condition: 20, ageDays: 0 });
    const radio = Object.values(start.units)[0];
    radio.wearRate = 1.25;
    radio.condition = 15.15;
    let online = start;
    for (let t = T0 + 5000; t <= T0 + HOUR_MS; t += 5000) online = ok(online, { type: 'tick' }, t);
    const offline = ok(start, { type: 'tick' }, T0 + HOUR_MS);
    expect(online.units[radio.id].status).toBe('service');
    expect(offline.units[radio.id].status).toBe('service');
    expect(online.units[radio.id].serviceUntil).toBe(offline.units[radio.id].serviceUntil);
    expect(online.report?.maintenanceSpend).toBe(offline.report?.maintenanceSpend);
  });
});
