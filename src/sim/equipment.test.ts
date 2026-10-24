import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { HOUR_MS } from './economy';
import { ITEMS } from '../content/items';
import { gameDay } from './calendar';
import { createUnit, ownedCount } from './equipment';
import { readyCount, readyUnits, reserveLoadouts, settleRun, unitEffectiveness } from './inventory';
import { storeOptions, unitViews } from './department-selectors';
import type { Command, GameState, ItemUnit } from './types';
import { departmentUpkeep } from './equipment-manager-policy';

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0);

function run(state: GameState, cmd: Command, now: number) {
  return dispatch(state, cmd, { now });
}
function ok(state: GameState, cmd: Command, now: number): GameState {
  const r = run(state, cmd, now);
  expect(r.result, JSON.stringify(cmd)).toEqual({ ok: true });
  return r.state;
}
function refused(state: GameState, cmd: Command, now: number): string {
  const r = run(state, cmd, now);
  expect(r.result.ok).toBe(false);
  expect(r.state).toBe(state);
  return r.result.ok ? '' : r.result.reason;
}
const unitsOf = (s: GameState, itemId: string): ItemUnit[] => Object.values(s.units).filter((u) => u.itemId === itemId);

describe('starting units', () => {
  const s = createInitialState(T0);

  it('turns the starting stock into individual units with unique serials', () => {
    const counts = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, unitsOf(s, id).length]));
    // Basic kit is part of every officer (basic-kit.ts), never stock.
    expect(counts).toMatchObject({ radio_kit: 0, service_sidearm: 0, compact_carbine: 0, light_protection: 0, loud_hailer: 2, throw_phone: 1, ballistic_shield: 2, door_ram: 1, observation_binoculars: 2, trauma_kit: 6, thermal_imager: 0, camera_drone: 0 });
    const serials = Object.values(s.units).map((u) => u.serial);
    expect(new Set(serials).size).toBe(serials.length);
    // The retired basic kit's ids are still skipped, so serials are where they always were.
    expect(unitsOf(s, 'loud_hailer')[0].serial).toBe('LH-0107');
    expect(unitsOf(s, 'trauma_kit').every((u) => u.serial.startsWith('TK-'))).toBe(true);
  });

  it('puts game day 0 at creation (1 Jan 2026)', () => {
    expect(s.department.calendarEpoch).toBe(T0);
    expect(gameDay(s, T0)).toBe(0);
  });

  it('varies wear rate (0.8..1.25) and condition per unit, deterministically', () => {
    const rates = Object.values(s.units).map((u) => u.wearRate);
    expect(Math.min(...rates)).toBeGreaterThanOrEqual(0.8);
    expect(Math.max(...rates)).toBeLessThanOrEqual(1.25);
    expect(new Set(rates).size).toBeGreaterThan(rates.length * 0.8);
    expect(createInitialState(T0).units).toEqual(s.units);
    const reusable = Object.values(s.units).filter((u) => ITEMS[u.itemId].kind === 'equipment');
    const conditions = reusable.map((u) => u.condition);
    expect(Math.min(...conditions)).toBeLessThan(70);
    for (const u of reusable) expect(u.condition).toBeGreaterThan(ITEMS[u.itemId].wear.unreliableBelow);
    expect(Math.max(...conditions)).toBeGreaterThan(90);
  });

  it('includes power with equipment and keeps expiry on true consumables', () => {
    expect(unitsOf(s, 'battery_pack')).toEqual([]);
    expect(ITEMS.battery_pack).toBeUndefined();
    for (const u of unitsOf(s, 'trauma_kit')) expect(u.expiresAt).toBeGreaterThan(T0);
    for (const u of unitsOf(s, 'loud_hailer')) expect(u.expiresAt).toBeNull();
  });
});

describe('time wear', () => {
  it('two hailers with different wear rates diverge over 10 game days', () => {
    const s = createInitialState(T0);
    const [a, b] = unitsOf(s, 'loud_hailer');
    a.condition = 80;
    b.condition = 80;
    a.wearRate = 0.8;
    b.wearRate = 1.25;
    const next = ok(s, { type: 'tick' }, T0 + 10 * HOUR_MS); // 1 real hour = 1 game day
    const perDay = ITEMS.loud_hailer.wear.perDay;
    expect(next.units[a.id].condition).toBeCloseTo(80 - perDay * 0.8 * 10, 6);
    expect(next.units[b.id].condition).toBeCloseTo(80 - perDay * 1.25 * 10, 6);
    expect(next.units[a.id].condition).toBeGreaterThan(next.units[b.id].condition);
  });

  it('wear is linear: one settlement and many ticks agree', () => {
    const s = createInitialState(T0);
    let online = s;
    for (let t = T0 + 600_000; t <= T0 + 20 * HOUR_MS; t += 600_000) online = ok(online, { type: 'tick' }, t);
    const offline = ok(s, { type: 'tick' }, T0 + 20 * HOUR_MS);
    for (const id of Object.keys(s.units)) expect(online.units[id].condition).toBeCloseTo(offline.units[id].condition, 6);
  });

  it('condition never goes below zero', () => {
    const s = createInitialState(T0);
    const hailer = unitsOf(s, 'loud_hailer')[0];
    hailer.condition = 0.5;
    const next = ok(s, { type: 'tick' }, T0 + 24 * HOUR_MS);
    expect(next.units[hailer.id].condition).toBe(0);
  });

  it('units in service do not age', () => {
    let s = createInitialState(T0);
    const hailer = unitsOf(s, 'loud_hailer').find((u) => u.condition < ITEMS.loud_hailer.wear.restoreTo)!;
    s = ok(s, { type: 'serviceUnit', unitId: hailer.id }, T0);
    const during = ok(s, { type: 'tick' }, T0 + HOUR_MS); // mid-service: a hailer takes 2 hours
    expect(during.units[hailer.id].condition).toBe(hailer.condition);
  });
});

describe('per-use wear', () => {
  it('only the unit the decision used wears at debrief, scaled by its own rate', () => {
    const s = createInitialState(T0);
    const [a, b] = readyUnits(s, 'loud_hailer', departmentUpkeep(s)); // best condition first
    expect(reserveLoadouts(s, 'run_1', { A: { loud_hailer: 2 } }, undefined, T0, departmentUpkeep(s))).toEqual({ ok: true });
    expect(s.units[a.id].status).toBe('reserved');
    expect(s.units[b.id].status).toBe('reserved');
    const before = { a: s.units[a.id].condition, b: s.units[b.id].condition, usesA: a.uses, usesB: b.uses };
    // Nothing degrades by merely being reserved.
    expect(before.a).toBe(a.condition);
    const out = settleRun(s, 'run_1', [a.id], departmentUpkeep(s));
    const perUse = ITEMS.loud_hailer.wear.perUse;
    expect(s.units[a.id].condition).toBeCloseTo(before.a - perUse * a.wearRate, 1);
    expect(s.units[a.id].uses).toBe(before.usesA + 1);
    expect(s.units[b.id].condition).toBe(before.b);
    expect(s.units[b.id].uses).toBe(before.usesB);
    expect(s.units[a.id].status).toBe('ready');
    expect(out.unitWear.map((w) => w.unitId)).toEqual([a.id]);
    // A second settle finds nothing to do.
    const again = settleRun(s, 'run_1', [a.id], departmentUpkeep(s));
    expect(again.unitWear).toEqual([]);
  });

  it('a used consumable leaves inventory; an unused one returns', () => {
    const s = createInitialState(T0);
    const [k1, k2] = readyUnits(s, 'trauma_kit', departmentUpkeep(s));
    reserveLoadouts(s, 'run_1', { A: { trauma_kit: 2 } }, undefined, T0, departmentUpkeep(s));
    settleRun(s, 'run_1', [k1.id], departmentUpkeep(s));
    expect(s.units[k1.id]).toBeUndefined();
    expect(s.units[k2.id].status).toBe('ready');
  });
});

describe('expiry', () => {
  it('a consumable past its shelf life becomes expired, is reported, and cannot be deployed', () => {
    const s = createInitialState(T0);
    const kit = readyUnits(s, 'trauma_kit', departmentUpkeep(s))[0];
    s.units[kit.id].expiresAt = T0 + 3 * HOUR_MS;
    const before = readyCount(s, 'trauma_kit', departmentUpkeep(s));
    const mid = ok(s, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(mid.units[kit.id].status).toBe('ready');
    const next = ok(s, { type: 'tick' }, T0 + 4 * HOUR_MS);
    expect(next.units[kit.id].status).toBe('expired');
    expect(readyCount(next, 'trauma_kit', departmentUpkeep(next))).toBe(before - 1);
    expect(next.report!.equipment).toContainEqual({ unitId: kit.id, event: 'expired' });
    expect(unitEffectiveness(next.units[kit.id], ITEMS.trauma_kit)).toBe(0);
    // Expiry is reported once, and an expired unit can be scrapped.
    const later = ok(next, { type: 'tick' }, T0 + 6 * HOUR_MS);
    expect(later.report!.equipment.filter((e) => e.unitId === kit.id)).toHaveLength(1);
    expect(unitViews(later, 'trauma_kit', T0 + 6 * HOUR_MS).find((v) => v.unit.id === kit.id)).toMatchObject({ stateLabel: 'Expired', canScrap: true, canService: false });
  });

  it('a reserved consumable does not expire until it is released', () => {
    const s = createInitialState(T0);
    const kit = readyUnits(s, 'trauma_kit', departmentUpkeep(s))[0];
    s.units[kit.id].expiresAt = T0 + HOUR_MS;
    reserveLoadouts(s, 'run_1', { A: { trauma_kit: 6 } }, undefined, T0, departmentUpkeep(s));
    const next = ok(s, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(next.units[kit.id].status).toBe('reserved');
  });

  it('new consumables bought later expire from their own purchase time', () => {
    const s = ok(createInitialState(T0), { type: 'buyItem', itemId: 'trauma_kit', qty: 2 }, T0 + 5 * HOUR_MS);
    const fresh = unitsOf(s, 'trauma_kit').filter((u) => u.acquiredAt === T0 + 5 * HOUR_MS);
    expect(fresh).toHaveLength(2);
    for (const u of fresh) expect(u.expiresAt).toBe(T0 + 5 * HOUR_MS + ITEMS.trauma_kit.wear.shelfLifeDays! * 3_600_000);
  });
});

describe('thresholds and the ready pool', () => {
  it('unreliable units stay deployable with reduced effect; failed ones are excluded', () => {
    const s = createInitialState(T0);
    const [a, b] = unitsOf(s, 'loud_hailer');
    const c = createUnit(s, 'loud_hailer', T0);
    a.condition = 35; // unreliable (below 40)
    b.condition = 5; // failed (at or below 10)
    const ready = readyUnits(s, 'loud_hailer', departmentUpkeep(s)).map((u) => u.id);
    expect(ready).toContain(a.id);
    expect(ready).not.toContain(b.id);
    expect(ready).toContain(c.id);
    expect(unitEffectiveness(a, ITEMS.loud_hailer)).toBeGreaterThan(0.4);
    expect(unitEffectiveness(a, ITEMS.loud_hailer)).toBeLessThan(1);
    expect(unitEffectiveness(b, ITEMS.loud_hailer)).toBe(0);
    const views = unitViews(s, 'loud_hailer', T0);
    expect(views.find((v) => v.unit.id === a.id)!.stateLabel).toBe('Unreliable');
    expect(views.find((v) => v.unit.id === b.id)!.stateLabel).toBe('Failed');
    expect(views[0].unit.id).toBe(b.id); // worst first
    // Reservation refuses the failed unit by name.
    expect(reserveLoadouts(s, 'run_9', {}, { A: [b.id] }, T0, departmentUpkeep(s))).toMatchObject({ ok: false });
  });

  it('the shift report lists a unit once when it crosses unreliable, then failed', () => {
    const s = createInitialState(T0);
    const hailer = unitsOf(s, 'loud_hailer')[0];
    hailer.wearRate = 1;
    hailer.condition = 40.2; // 0.05/day: unreliable after ~4 days, failed ~600 days later
    const a = ok(s, { type: 'tick' }, T0 + 10 * HOUR_MS);
    expect(a.report!.equipment.filter((e) => e.unitId === hailer.id)).toEqual([{ unitId: hailer.id, event: 'unreliable' }]);
    const b = ok(a, { type: 'tick' }, T0 + 12 * HOUR_MS);
    expect(b.report!.equipment.filter((e) => e.unitId === hailer.id)).toHaveLength(1);
    const failing = createInitialState(T0);
    const r2 = unitsOf(failing, 'loud_hailer')[0];
    r2.wearRate = 1;
    r2.condition = 10.2;
    const c = ok(failing, { type: 'tick' }, T0 + 10 * HOUR_MS);
    expect(c.report!.equipment.filter((e) => e.unitId === r2.id).map((e) => e.event)).toEqual(['failed']);
  });

  it('a short settlement still reports a threshold crossing', () => {
    const s = createInitialState(T0);
    const hailer = unitsOf(s, 'loud_hailer')[0];
    hailer.wearRate = 1;
    hailer.condition = 40.001;
    const next = ok(s, { type: 'tick' }, T0 + 5 * 60_000); // 5 minutes: below the report threshold
    expect(next.report?.equipment).toEqual([{ unitId: hailer.id, event: 'unreliable' }]);
  });
});

describe('servicing', () => {
  it('costs the service fee, takes real time, and restores to restoreTo, never above', () => {
    let s = createInitialState(T0);
    const hailer = unitsOf(s, 'loud_hailer').sort((a, b) => a.condition - b.condition)[0];
    const { serviceCost, serviceHours, restoreTo } = ITEMS.loud_hailer.wear;
    const funding = s.department.funding;
    s = ok(s, { type: 'serviceUnit', unitId: hailer.id }, T0);
    expect(s.department.funding).toBe(funding - serviceCost);
    expect(s.units[hailer.id]).toMatchObject({ status: 'service', serviceUntil: T0 + serviceHours * HOUR_MS });
    expect(readyUnits(s, 'loud_hailer', departmentUpkeep(s)).map((u) => u.id)).not.toContain(hailer.id);
    expect(unitViews(s, 'loud_hailer', T0).find((v) => v.unit.id === hailer.id)).toMatchObject({ stateLabel: 'In service', canService: false, canScrap: false });

    const mid = ok(s, { type: 'tick' }, T0 + (serviceHours - 1) * HOUR_MS);
    expect(mid.units[hailer.id].status).toBe('service');
    const done = ok(s, { type: 'tick' }, T0 + serviceHours * HOUR_MS);
    expect(done.units[hailer.id].status).toBe('ready');
    expect(done.units[hailer.id].serviceUntil).toBeNull();
    expect(done.units[hailer.id].condition).toBeCloseTo(restoreTo, 6);
    // It restores up to restoreTo, never above it: a 97 hailer keeps its 97.
    expect(done.report!.equipment).toContainEqual({ unitId: hailer.id, event: 'serviced' });

    const fresh = createInitialState(T0);
    const better = unitsOf(fresh, 'loud_hailer')[0];
    better.condition = 97;
    expect(better.condition).toBeGreaterThan(restoreTo);
    expect(refused(fresh, { type: 'serviceUnit', unitId: better.id }, T0)).toMatch(/already in better condition/);
  });

  it('is refused for consumables, reserved units, funds shortfalls and unknown units', () => {
    const s = createInitialState(T0);
    const kit = unitsOf(s, 'trauma_kit')[0];
    expect(refused(s, { type: 'serviceUnit', unitId: kit.id }, T0)).toMatch(/Consumables/);
    expect(refused(s, { type: 'serviceUnit', unitId: 'nope' }, T0)).toMatch(/No such unit/);
    const hailer = unitsOf(s, 'loud_hailer').sort((a, b) => a.condition - b.condition)[0];
    s.department.funding = 10;
    expect(refused(s, { type: 'serviceUnit', unitId: hailer.id }, T0)).toMatch(/Needs 30 funding/);
    s.department.funding = 5000;
    s.units[hailer.id].status = 'reserved';
    expect(refused(s, { type: 'serviceUnit', unitId: hailer.id }, T0)).toMatch(/deployed/);
  });

  it('a failed unit can be serviced back into the ready pool', () => {
    let s = createInitialState(T0);
    const hailer = unitsOf(s, 'loud_hailer')[0];
    hailer.condition = 5;
    expect(readyUnits(s, 'loud_hailer', departmentUpkeep(s)).map((u) => u.id)).not.toContain(hailer.id);
    s = ok(s, { type: 'serviceUnit', unitId: hailer.id }, T0);
    s = ok(s, { type: 'tick' }, T0 + 4 * HOUR_MS);
    expect(readyUnits(s, 'loud_hailer', departmentUpkeep(s)).map((u) => u.id)).toContain(hailer.id);
  });
});

describe('scrapping', () => {
  it('removes the unit from the department for a small salvage refund', () => {
    let s = createInitialState(T0);
    const hailer = unitsOf(s, 'loud_hailer')[0];
    const funding = s.department.funding;
    const owned = ownedCount(s, 'loud_hailer');
    s = ok(s, { type: 'scrapUnit', unitId: hailer.id }, T0);
    expect(s.units[hailer.id].status).toBe('scrapped');
    expect(ownedCount(s, 'loud_hailer')).toBe(owned - 1);
    expect(readyUnits(s, 'loud_hailer', departmentUpkeep(s)).map((u) => u.id)).not.toContain(hailer.id);
    expect(s.department.funding).toBe(funding + Math.round(ITEMS.loud_hailer.cost * 0.05));
    expect(unitViews(s, 'loud_hailer', T0).map((v) => v.unit.id)).not.toContain(hailer.id);
    expect(refused(s, { type: 'scrapUnit', unitId: hailer.id }, T0)).toMatch(/already scrapped/);
  });

  it('refuses reserved units', () => {
    const s = createInitialState(T0);
    const hailer = readyUnits(s, 'loud_hailer', departmentUpkeep(s))[0];
    reserveLoadouts(s, 'run_1', { A: { loud_hailer: 1 } }, undefined, T0, departmentUpkeep(s));
    expect(refused(s, { type: 'scrapUnit', unitId: hailer.id }, T0)).toMatch(/deployed/);
  });

  it('restock rules replace scrapped and expired units', () => {
    let s = createInitialState(T0);
    s = ok(s, { type: 'unlockNode', nodeId: 'logistics_presets' }, T0);
    s = ok(s, { type: 'unlockNode', nodeId: 'logistics_restock' }, T0);
    s = ok(s, { type: 'setRestockRule', rule: { itemId: 'loud_hailer', target: 2, budgetCeiling: 2000 } }, T0);
    s = ok(s, { type: 'scrapUnit', unitId: unitsOf(s, 'loud_hailer')[0].id }, T0);
    const next = ok(s, { type: 'tick' }, T0 + HOUR_MS);
    expect(ownedCount(next, 'loud_hailer')).toBe(2);
    const fresh = unitsOf(next, 'loud_hailer').filter((u) => u.acquiredAt >= T0);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].condition).toBeGreaterThan(99);
  });
});

describe('store and unit views', () => {
  it('storeOptions counts units and reports mean condition', () => {
    let s = createInitialState(T0);
    createUnit(s, 'loud_hailer', T0, { condition: 90 });
    createUnit(s, 'loud_hailer', T0, { condition: 90 });
    const hailers = unitsOf(s, 'loud_hailer');
    hailers[0].condition = 35; // unreliable
    hailers[1].condition = 5; // failed
    s = ok(s, { type: 'serviceUnit', unitId: hailers[2].id }, T0);
    const opt = storeOptions(s).find((o) => o.item.id === 'loud_hailer')!;
    expect(opt).toMatchObject({ owned: 4, ready: 2, inService: 1, unreliable: 1, failed: 1, reserved: 0, expired: 0 });
    expect(opt.meanCondition).toBeGreaterThan(50);
    expect(opt.meanCondition).toBeLessThan(95);
    expect(storeOptions(s).find((o) => o.item.id === 'thermal_imager')!.meanCondition).toBeNull();
  });

  it('unitViews gives days to unreliable from the unit\'s own rate, and reasons for what is not allowed', () => {
    const s = createInitialState(T0);
    const hailer = unitsOf(s, 'loud_hailer')[0];
    hailer.condition = 60;
    hailer.wearRate = 1.25;
    unitsOf(s, 'loud_hailer')[1].condition = 97;
    const v = unitViews(s, 'loud_hailer', T0).find((x) => x.unit.id === hailer.id)!;
    expect(v.daysToUnreliable).toBeCloseTo((60 - 40) / (0.05 * 1.25), 6);
    expect(v.stateLabel).toBe('Worn');
    expect(v.canService).toBe(true);
    expect(v.canScrap).toBe(true);
    expect(v.effectiveness).toBe(1);
    const good = unitViews(s, 'loud_hailer', T0).find((x) => x.unit.condition >= 95)!;
    expect(good.stateLabel).toBe('Good');
    expect(good.canService).toBe(false);
    expect(good.serviceReason).toMatch(/better condition/);
    // Trauma kits do not fade: no forecast, only expiry.
    const kit = unitViews(s, 'trauma_kit', T0)[0];
    expect(kit.daysToUnreliable).toBeNull();
    expect(kit.expiresAt).not.toBeNull();
    // Between ticks the view projects the unsettled time, so it stays exact.
    const later = unitViews(s, 'loud_hailer', T0 + 10 * HOUR_MS).find((x) => x.unit.id === hailer.id)!;
    expect(later.unit.condition).toBeCloseTo(60 - 0.05 * 1.25 * 10, 6);
  });

  it('buyItem creates separate units at condition 100 with their own wear rates', () => {
    const s = ok(createInitialState(T0), { type: 'buyItem', itemId: 'loud_hailer', qty: 3 }, T0);
    const fresh = unitsOf(s, 'loud_hailer').filter((u) => u.condition === 100);
    expect(fresh).toHaveLength(3);
    expect(new Set(fresh.map((u) => u.wearRate)).size).toBeGreaterThan(1);
    expect(new Set(Object.values(s.units).map((u) => u.serial)).size).toBe(Object.keys(s.units).length);
    for (const u of fresh) expect(u).toMatchObject({ status: 'ready', uses: 0, serviceUntil: null, lastWearAt: T0 });
  });

  it('createUnit is deterministic from the department rng', () => {
    const a = createInitialState(T0);
    const b = createInitialState(T0);
    expect(createUnit(a, 'door_ram', T0)).toEqual(createUnit(b, 'door_ram', T0));
  });
});
