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
    expect(counts).toMatchObject({ radio_kit: 6, loud_hailer: 2, throw_phone: 1, ballistic_shield: 2, door_ram: 1, trauma_kit: 6, battery_pack: 6, thermal_imager: 0, camera_drone: 0 });
    const serials = Object.values(s.units).map((u) => u.serial);
    expect(new Set(serials).size).toBe(serials.length);
    expect(unitsOf(s, 'radio_kit')[0].serial).toBe('RH-0101');
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
    const radios = unitsOf(s, 'radio_kit').map((u) => u.condition);
    expect(Math.min(...radios)).toBeLessThan(60);
    expect(Math.min(...radios)).toBeGreaterThan(ITEMS.radio_kit.wear.unreliableBelow);
    expect(Math.max(...radios)).toBeGreaterThan(90);
  });

  it('has one battery close to fading and consumables with an expiry', () => {
    const batteries = unitsOf(s, 'battery_pack');
    expect(Math.min(...batteries.map((u) => u.condition))).toBeLessThan(65);
    expect(Math.min(...batteries.map((u) => u.condition))).toBeGreaterThan(ITEMS.battery_pack.wear.failAt);
    for (const u of [...batteries, ...unitsOf(s, 'trauma_kit')]) expect(u.expiresAt).toBeGreaterThan(T0);
    for (const u of unitsOf(s, 'radio_kit')) expect(u.expiresAt).toBeNull();
  });
});

describe('time wear', () => {
  it('two radios with different wear rates diverge over 10 game days', () => {
    const s = createInitialState(T0);
    const [a, b] = unitsOf(s, 'radio_kit');
    a.condition = 80;
    b.condition = 80;
    a.wearRate = 0.8;
    b.wearRate = 1.25;
    const next = ok(s, { type: 'tick' }, T0 + 10 * HOUR_MS); // 1 real hour = 1 game day
    const perDay = ITEMS.radio_kit.wear.perDay;
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
    const battery = unitsOf(s, 'battery_pack')[0];
    battery.condition = 1;
    const next = ok(s, { type: 'tick' }, T0 + 24 * HOUR_MS);
    expect(next.units[battery.id].condition).toBe(0);
  });

  it('units in service do not age', () => {
    let s = createInitialState(T0);
    const radio = unitsOf(s, 'radio_kit').find((u) => u.condition < ITEMS.radio_kit.wear.restoreTo)!;
    s = ok(s, { type: 'serviceUnit', unitId: radio.id }, T0);
    const during = ok(s, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(during.units[radio.id].condition).toBe(radio.condition);
  });
});

describe('per-use wear', () => {
  it('only the unit the decision used wears at debrief, scaled by its own rate', () => {
    const s = createInitialState(T0);
    const [a, b] = readyUnits(s, 'radio_kit'); // best condition first
    expect(reserveLoadouts(s, 'run_1', { A: { radio_kit: 2 } }, undefined, T0)).toEqual({ ok: true });
    expect(s.units[a.id].status).toBe('reserved');
    expect(s.units[b.id].status).toBe('reserved');
    const before = { a: s.units[a.id].condition, b: s.units[b.id].condition, usesA: a.uses, usesB: b.uses };
    // Nothing degrades by merely being reserved.
    expect(before.a).toBe(a.condition);
    const out = settleRun(s, 'run_1', [a.id], T0);
    const perUse = ITEMS.radio_kit.wear.perUse;
    expect(s.units[a.id].condition).toBeCloseTo(before.a - perUse * a.wearRate, 1);
    expect(s.units[a.id].uses).toBe(before.usesA + 1);
    expect(s.units[b.id].condition).toBe(before.b);
    expect(s.units[b.id].uses).toBe(before.usesB);
    expect(s.units[a.id].status).toBe('ready');
    expect(out.unitWear.map((w) => w.unitId)).toEqual([a.id]);
    // A second settle finds nothing to do.
    const again = settleRun(s, 'run_1', [a.id], T0);
    expect(again.unitWear).toEqual([]);
  });

  it('a used consumable leaves inventory; an unused one returns', () => {
    const s = createInitialState(T0);
    const [k1, k2] = readyUnits(s, 'trauma_kit');
    reserveLoadouts(s, 'run_1', { A: { trauma_kit: 2 } }, undefined, T0);
    settleRun(s, 'run_1', [k1.id], T0);
    expect(s.units[k1.id]).toBeUndefined();
    expect(s.units[k2.id].status).toBe('ready');
  });
});

describe('expiry', () => {
  it('a consumable past its shelf life becomes expired, is reported, and cannot be deployed', () => {
    const s = createInitialState(T0);
    const kit = readyUnits(s, 'trauma_kit')[0];
    s.units[kit.id].expiresAt = T0 + 3 * HOUR_MS;
    const before = readyCount(s, 'trauma_kit');
    const mid = ok(s, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(mid.units[kit.id].status).toBe('ready');
    const next = ok(s, { type: 'tick' }, T0 + 4 * HOUR_MS);
    expect(next.units[kit.id].status).toBe('expired');
    expect(readyCount(next, 'trauma_kit')).toBe(before - 1);
    expect(next.report!.equipment).toContainEqual({ unitId: kit.id, event: 'expired' });
    expect(unitEffectiveness(next.units[kit.id], ITEMS.trauma_kit)).toBe(0);
    // Expiry is reported once, and an expired unit can be scrapped.
    const later = ok(next, { type: 'tick' }, T0 + 6 * HOUR_MS);
    expect(later.report!.equipment.filter((e) => e.unitId === kit.id)).toHaveLength(1);
    expect(unitViews(later, 'trauma_kit', T0 + 6 * HOUR_MS).find((v) => v.unit.id === kit.id)).toMatchObject({ stateLabel: 'Expired', canScrap: true, canService: false });
  });

  it('a reserved consumable does not expire until it is released', () => {
    const s = createInitialState(T0);
    const kit = readyUnits(s, 'trauma_kit')[0];
    s.units[kit.id].expiresAt = T0 + HOUR_MS;
    reserveLoadouts(s, 'run_1', { A: { trauma_kit: 6 } }, undefined, T0);
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
    const [a, b, c] = unitsOf(s, 'radio_kit');
    a.condition = 40; // unreliable (below 45)
    b.condition = 10; // failed (at or below 15)
    const ready = readyUnits(s, 'radio_kit').map((u) => u.id);
    expect(ready).toContain(a.id);
    expect(ready).not.toContain(b.id);
    expect(ready).toContain(c.id);
    expect(unitEffectiveness(a, ITEMS.radio_kit)).toBeGreaterThan(0.4);
    expect(unitEffectiveness(a, ITEMS.radio_kit)).toBeLessThan(1);
    expect(unitEffectiveness(b, ITEMS.radio_kit)).toBe(0);
    const views = unitViews(s, 'radio_kit', T0);
    expect(views.find((v) => v.unit.id === a.id)!.stateLabel).toBe('Unreliable');
    expect(views.find((v) => v.unit.id === b.id)!.stateLabel).toBe('Failed');
    expect(views[0].unit.id).toBe(b.id); // worst first
    // Reservation refuses the failed unit by name.
    expect(reserveLoadouts(s, 'run_9', {}, { A: [b.id] }, T0)).toMatchObject({ ok: false });
  });

  it('the shift report lists a unit once when it crosses unreliable, then failed', () => {
    const s = createInitialState(T0);
    const radio = unitsOf(s, 'radio_kit')[0];
    radio.wearRate = 1;
    radio.condition = 45.5; // 0.15/day: unreliable after ~4 days, failed ~200 days later
    const a = ok(s, { type: 'tick' }, T0 + 10 * HOUR_MS);
    expect(a.report!.equipment.filter((e) => e.unitId === radio.id)).toEqual([{ unitId: radio.id, event: 'unreliable' }]);
    const b = ok(a, { type: 'tick' }, T0 + 12 * HOUR_MS);
    expect(b.report!.equipment.filter((e) => e.unitId === radio.id)).toHaveLength(1);
    const failing = createInitialState(T0);
    const r2 = unitsOf(failing, 'radio_kit')[0];
    r2.wearRate = 1;
    r2.condition = 15.5;
    const c = ok(failing, { type: 'tick' }, T0 + 10 * HOUR_MS);
    expect(c.report!.equipment.filter((e) => e.unitId === r2.id).map((e) => e.event)).toEqual(['failed']);
  });

  it('a short settlement still reports a threshold crossing', () => {
    const s = createInitialState(T0);
    const radio = unitsOf(s, 'radio_kit')[0];
    radio.wearRate = 1;
    radio.condition = 45.001;
    const next = ok(s, { type: 'tick' }, T0 + 5 * 60_000); // 5 minutes: below the report threshold
    expect(next.report?.equipment).toEqual([{ unitId: radio.id, event: 'unreliable' }]);
  });
});

describe('servicing', () => {
  it('costs the service fee, takes real time, and restores to restoreTo, never above', () => {
    let s = createInitialState(T0);
    const radio = unitsOf(s, 'radio_kit').sort((a, b) => a.condition - b.condition)[0];
    const { serviceCost, serviceHours, restoreTo } = ITEMS.radio_kit.wear;
    const funding = s.department.funding;
    s = ok(s, { type: 'serviceUnit', unitId: radio.id }, T0);
    expect(s.department.funding).toBe(funding - serviceCost);
    expect(s.units[radio.id]).toMatchObject({ status: 'service', serviceUntil: T0 + serviceHours * HOUR_MS });
    expect(readyUnits(s, 'radio_kit').map((u) => u.id)).not.toContain(radio.id);
    expect(unitViews(s, 'radio_kit', T0).find((v) => v.unit.id === radio.id)).toMatchObject({ stateLabel: 'In service', canService: false, canScrap: false });

    const mid = ok(s, { type: 'tick' }, T0 + (serviceHours - 1) * HOUR_MS);
    expect(mid.units[radio.id].status).toBe('service');
    const done = ok(s, { type: 'tick' }, T0 + serviceHours * HOUR_MS);
    expect(done.units[radio.id].status).toBe('ready');
    expect(done.units[radio.id].serviceUntil).toBeNull();
    expect(done.units[radio.id].condition).toBeCloseTo(restoreTo, 6);
    // It restores up to restoreTo, never above it: a 96 radio keeps its 96.
    expect(done.report!.equipment).toContainEqual({ unitId: radio.id, event: 'serviced' });

    const better = unitsOf(createInitialState(T0), 'radio_kit').sort((a, b) => b.condition - a.condition)[0];
    expect(better.condition).toBeGreaterThan(restoreTo);
    expect(refused(createInitialState(T0), { type: 'serviceUnit', unitId: better.id }, T0)).toMatch(/already in better condition/);
  });

  it('is refused for consumables, reserved units, funds shortfalls and unknown units', () => {
    const s = createInitialState(T0);
    const kit = unitsOf(s, 'trauma_kit')[0];
    expect(refused(s, { type: 'serviceUnit', unitId: kit.id }, T0)).toMatch(/Consumables/);
    expect(refused(s, { type: 'serviceUnit', unitId: 'nope' }, T0)).toMatch(/No such unit/);
    const radio = unitsOf(s, 'radio_kit').sort((a, b) => a.condition - b.condition)[0];
    s.department.funding = 10;
    expect(refused(s, { type: 'serviceUnit', unitId: radio.id }, T0)).toMatch(/Needs \$60/);
    s.department.funding = 5000;
    s.units[radio.id].status = 'reserved';
    expect(refused(s, { type: 'serviceUnit', unitId: radio.id }, T0)).toMatch(/deployed/);
  });

  it('a failed unit can be serviced back into the ready pool', () => {
    let s = createInitialState(T0);
    const radio = unitsOf(s, 'radio_kit')[0];
    radio.condition = 5;
    expect(readyUnits(s, 'radio_kit').map((u) => u.id)).not.toContain(radio.id);
    s = ok(s, { type: 'serviceUnit', unitId: radio.id }, T0);
    s = ok(s, { type: 'tick' }, T0 + 4 * HOUR_MS);
    expect(readyUnits(s, 'radio_kit').map((u) => u.id)).toContain(radio.id);
  });
});

describe('scrapping', () => {
  it('removes the unit from the department for a small salvage refund', () => {
    let s = createInitialState(T0);
    const radio = unitsOf(s, 'radio_kit')[0];
    const funding = s.department.funding;
    const owned = ownedCount(s, 'radio_kit');
    s = ok(s, { type: 'scrapUnit', unitId: radio.id }, T0);
    expect(s.units[radio.id].status).toBe('scrapped');
    expect(ownedCount(s, 'radio_kit')).toBe(owned - 1);
    expect(readyUnits(s, 'radio_kit').map((u) => u.id)).not.toContain(radio.id);
    expect(s.department.funding).toBe(funding + Math.round(ITEMS.radio_kit.cost * 0.05));
    expect(unitViews(s, 'radio_kit', T0).map((v) => v.unit.id)).not.toContain(radio.id);
    expect(refused(s, { type: 'scrapUnit', unitId: radio.id }, T0)).toMatch(/already scrapped/);
  });

  it('refuses reserved units', () => {
    const s = createInitialState(T0);
    const radio = readyUnits(s, 'radio_kit')[0];
    reserveLoadouts(s, 'run_1', { A: { radio_kit: 1 } }, undefined, T0);
    expect(refused(s, { type: 'scrapUnit', unitId: radio.id }, T0)).toMatch(/deployed/);
  });

  it('restock rules replace scrapped and expired units', () => {
    let s = createInitialState(T0);
    s = ok(s, { type: 'unlockNode', nodeId: 'logistics_presets' }, T0);
    s = ok(s, { type: 'unlockNode', nodeId: 'logistics_restock' }, T0);
    s = ok(s, { type: 'setRestockRule', rule: { itemId: 'radio_kit', target: 6, budgetCeiling: 2000 } }, T0);
    s = ok(s, { type: 'scrapUnit', unitId: unitsOf(s, 'radio_kit')[0].id }, T0);
    const next = ok(s, { type: 'tick' }, T0 + HOUR_MS);
    expect(ownedCount(next, 'radio_kit')).toBe(6);
    const fresh = unitsOf(next, 'radio_kit').filter((u) => u.acquiredAt >= T0);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].condition).toBeGreaterThan(99);
  });
});

describe('store and unit views', () => {
  it('storeOptions counts units and reports mean condition', () => {
    let s = createInitialState(T0);
    const radios = unitsOf(s, 'radio_kit');
    radios[0].condition = 40; // unreliable
    radios[1].condition = 10; // failed
    s = ok(s, { type: 'serviceUnit', unitId: radios[2].id }, T0);
    const opt = storeOptions(s).find((o) => o.item.id === 'radio_kit')!;
    expect(opt).toMatchObject({ owned: 6, ready: 4, inService: 1, unreliable: 1, reserved: 0, expired: 0 });
    expect(opt.meanCondition).toBeGreaterThan(50);
    expect(opt.meanCondition).toBeLessThan(95);
    expect(storeOptions(s).find((o) => o.item.id === 'thermal_imager')!.meanCondition).toBeNull();
  });

  it('unitViews gives days to unreliable from the unit\'s own rate, and reasons for what is not allowed', () => {
    const s = createInitialState(T0);
    const radio = unitsOf(s, 'radio_kit')[0];
    radio.condition = 60;
    radio.wearRate = 1.25;
    unitsOf(s, 'radio_kit')[1].condition = 97;
    const v = unitViews(s, 'radio_kit', T0).find((x) => x.unit.id === radio.id)!;
    expect(v.daysToUnreliable).toBeCloseTo((60 - 45) / (0.15 * 1.25), 6);
    expect(v.stateLabel).toBe('Worn');
    expect(v.canService).toBe(true);
    expect(v.canScrap).toBe(true);
    expect(v.effectiveness).toBe(1);
    const good = unitViews(s, 'radio_kit', T0).find((x) => x.unit.condition >= 95)!;
    expect(good.stateLabel).toBe('Good');
    expect(good.canService).toBe(false);
    expect(good.serviceReason).toMatch(/better condition/);
    // Trauma kits do not fade: no forecast, only expiry.
    const kit = unitViews(s, 'trauma_kit', T0)[0];
    expect(kit.daysToUnreliable).toBeNull();
    expect(kit.expiresAt).not.toBeNull();
    // Between ticks the view projects the unsettled time, so it stays exact.
    const later = unitViews(s, 'radio_kit', T0 + 10 * HOUR_MS).find((x) => x.unit.id === radio.id)!;
    expect(later.unit.condition).toBeCloseTo(60 - 0.15 * 1.25 * 10, 6);
  });

  it('buyItem creates separate units at condition 100 with their own wear rates', () => {
    const s = ok(createInitialState(T0), { type: 'buyItem', itemId: 'radio_kit', qty: 3 }, T0);
    const fresh = unitsOf(s, 'radio_kit').filter((u) => u.condition === 100);
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
