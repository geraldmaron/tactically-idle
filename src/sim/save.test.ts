import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { CURRENT_SAVE_VERSION, SAVE_KEY, deserialize, loadGame, migrate, saveGame, serialize, type SaveStorage } from './save';
import { HOUR_MS } from './economy';
import { ownedCount } from './equipment';
import { readyUnits } from './inventory';
import { careerInfo } from './department-selectors';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0);

function ok(state: GameState, cmd: Command, now: number): GameState {
  const r = dispatch(state, cmd, { now });
  expect(r.result).toEqual({ ok: true });
  return r.state;
}

function memoryStorage(): SaveStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

/** A state with training, a report, a shortlist, restock rules, and a third squad. */
function busyState(): GameState {
  let s = createInitialState(T0);
  s = ok(s, { type: 'unlockNode', nodeId: 'personnel_negotiation' }, T0);
  s = ok(s, { type: 'startCourse', officerId: 'off_reyes', courseId: 'crisis_negotiation_course' }, T0);
  s = ok(s, { type: 'shortlist', candidateId: s.candidates[1].id, on: true }, T0);
  s = ok(s, { type: 'createSquad', name: 'Charlie' }, T0);
  return ok(s, { type: 'tick' }, T0 + 3 * HOUR_MS);
}

describe('save round trip', () => {
  it('restores an identical state', () => {
    for (const s of [createInitialState(T0), busyState()]) {
      expect(deserialize(serialize(s, T0 + 1000))).toEqual(s);
    }
  });

  it('saveGame / loadGame go through storage under SAVE_KEY', () => {
    const storage = memoryStorage();
    expect(loadGame(storage)).toBeNull();
    const s = busyState();
    saveGame(s, T0, storage);
    expect(storage.map.has(SAVE_KEY)).toBe(true);
    expect(loadGame(storage)).toEqual(s);
  });

  it('a tick after load at the same time grants nothing (no duplicate offline grant)', () => {
    const s = busyState();
    const loaded = deserialize(serialize(s, T0 + 3 * HOUR_MS))!;
    const again = ok(loaded, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(again).toEqual(s);
    // Closing and reopening later grants only the elapsed time, once.
    const reopened = ok(deserialize(serialize(s, T0 + 3 * HOUR_MS))!, { type: 'tick' }, T0 + 5 * HOUR_MS);
    const direct = ok(s, { type: 'tick' }, T0 + 5 * HOUR_MS);
    expect(reopened.department.funding).toBeCloseTo(direct.department.funding, 6);
    expect(reopened.department.devPoints).toBeCloseTo(direct.department.devPoints, 6);
    // Loading the same save a second time and ticking again does not stack.
    const second = ok(deserialize(serialize(s, T0 + 3 * HOUR_MS))!, { type: 'tick' }, T0 + 5 * HOUR_MS);
    expect(second.department.funding).toBeCloseTo(reopened.department.funding, 6);
  });

  it('a reload between a course start and its end still completes it exactly once', () => {
    const s = busyState();
    const loaded = deserialize(serialize(s, T0 + 3 * HOUR_MS))!;
    const done = ok(loaded, { type: 'tick' }, T0 + 7 * HOUR_MS);
    expect(done.officers.off_reyes.certs.filter((c) => c === 'crisis_negotiation')).toHaveLength(1);
    expect(done.report!.completedCourses).toEqual([{ officerId: 'off_reyes', courseId: 'crisis_negotiation_course' }]);
  });
});

describe('corrupt saves', () => {
  const good = JSON.parse(serialize(createInitialState(T0), T0));

  it('returns null for text that is not a save', () => {
    for (const bad of ['', 'not json', '{"saveVersion":1', '[]', 'null', '42', '{}', '{"state":{}}']) {
      expect(deserialize(bad), bad).toBeNull();
    }
  });

  it('returns null for bad shapes and unknown versions', () => {
    const mutate = (fn: (e: any) => void) => {
      const e = structuredClone(good);
      fn(e);
      return JSON.stringify(e);
    };
    expect(deserialize(mutate((e) => (e.state.department.funding = 'lots')))).toBeNull();
    expect(deserialize(mutate((e) => delete e.state.officers))).toBeNull();
    expect(deserialize(mutate((e) => (e.state.officers.off_chen.ratings = {})))).toBeNull();
    expect(deserialize(mutate((e) => (e.state.squads[0].officerIds = ['off_ghost'])))).toBeNull();
    expect(deserialize(mutate((e) => (e.state.squads[0].leaderId = 'off_reyes')))).toBeNull();
    expect(deserialize(mutate((e) => (e.state.units.unit_1.condition = null)))).toBeNull();
    expect(deserialize(mutate((e) => (e.saveVersion = 99)))).toBeNull();
    expect(deserialize(mutate((e) => (e.saveVersion = 0)))).toBeNull();
    expect(deserialize(JSON.stringify(good))).not.toBeNull();
  });

  it('loadGame treats corrupt storage as no save', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{broken');
    expect(loadGame(storage)).toBeNull();
  });
});

describe('migrate', () => {
  it('passes the current version through and refuses others', () => {
    const env = JSON.parse(serialize(createInitialState(T0), T0));
    expect(migrate(env)?.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrate({ ...env, saveVersion: CURRENT_SAVE_VERSION + 1 })).toBeNull();
  });
});


/**
 * Hand-built version 1 save: item stacks instead of units, no calendar, no career
 * fields, an in-flight operation holding reservations. This is the shape a player's
 * old save has on disk.
 */
function v1Envelope() {
  const s = createInitialState(T0) as any;
  const stacks: Record<string, any> = {};
  for (const u of Object.values(s.units) as any[]) {
    const st = (stacks[u.itemId] ??= { itemId: u.itemId, owned: 0, reserved: 0, maintenance: 0, uses: 0, maintenanceUntil: null });
    st.owned += 1;
  }
  stacks.radio_kit.reserved = 2;
  stacks.radio_kit.uses = 9;
  stacks.loud_hailer.maintenance = 1;
  stacks.loud_hailer.maintenanceUntil = T0 + 2.5 * HOUR_MS;
  stacks.thermal_imager = { itemId: 'thermal_imager', owned: 0, reserved: 0, maintenance: 0, uses: 0, maintenanceUntil: null };
  delete s.units;
  s.inventory = stacks;
  s.saveVersion = 1;
  delete s.department.calendarEpoch;
  for (const o of [...Object.values(s.officers), ...s.candidates.map((c: any) => c.officer)] as any[]) {
    for (const k of ['bornDay', 'serviceStartDay', 'career', 'retirement', 'xpBanked']) delete o[k];
  }
  s.reservations = [{ id: 'res_1', runId: 'run_1', squadId: 'A', itemId: 'radio_kit', qty: 2 }];
  s.activeRun = { id: 'run_1', status: 'active', squadIds: ['A'], reservationIds: ['res_1'] };
  s.officers.off_chen.assignment = { kind: 'operation', runId: 'run_1' };
  s.debriefs = [{ runId: 'run_0', practice: false, officerCondition: [], resources: [] }];
  return { saveVersion: 1, contentVersion: 1, savedAt: T0, state: s };
}

describe('migration from version 1', () => {
  it('writes the current version', () => {
    expect(CURRENT_SAVE_VERSION).toBe(3);
    expect(createInitialState(T0).saveVersion).toBe(3);
  });

  it('turns stacks into units, adds the calendar and careers, and releases the in-flight run', () => {
    const text = JSON.stringify(v1Envelope());
    const s = deserialize(text)!;
    expect(s).not.toBeNull();
    expect(s.saveVersion).toBe(3);
    expect((s as any).inventory).toBeUndefined();

    // Same stock, now as individual units.
    expect(ownedCount(s, 'radio_kit')).toBe(6);
    expect(ownedCount(s, 'loud_hailer')).toBe(2);
    expect(ownedCount(s, 'thermal_imager')).toBe(0);
    expect(new Set(Object.values(s.units).map((u) => u.serial)).size).toBe(Object.keys(s.units).length);
    for (const u of Object.values(s.units)) {
      expect(u.wearRate).toBeGreaterThanOrEqual(0.8);
      expect(u.wearRate).toBeLessThanOrEqual(1.25);
      expect(u.condition).toBeGreaterThan(25);
      expect(u.condition).toBeLessThanOrEqual(100);
    }
    expect(Object.values(s.units).filter((u) => u.itemId === 'radio_kit').reduce((a, u) => a + u.uses, 0)).toBe(9);
    // Maintenance carries on as servicing with its return time.
    const hailers = Object.values(s.units).filter((u) => u.itemId === 'loud_hailer');
    expect(hailers.filter((u) => u.status === 'service').map((u) => u.serviceUntil)).toEqual([T0 + 2.5 * HOUR_MS]);
    expect(Object.values(s.units).filter((u) => u.itemId === 'trauma_kit').every((u) => u.expiresAt !== null)).toBe(true);

    // The v1 run is dropped: reservations gone, units ready, assignment cleared.
    expect(s.activeRun).toBeNull();
    expect(s.reservations).toEqual([]);
    expect(s.officers.off_chen.assignment).toBeNull();
    expect(Object.values(s.units).filter((u) => u.status === 'reserved')).toHaveLength(0);
    expect(readyUnits(s, 'radio_kit')).toHaveLength(6);
    // Old debriefs gain the per-unit wear list.
    expect(s.debriefs[0].unitWear).toEqual([]);

    // The calendar starts at the saved moment; known officers keep their authored careers.
    expect(s.department.calendarEpoch).toBe(s.department.clockHighWater);
    expect(s.officers.off_okafor.bornDay).toBeLessThan(-57 * 365);
    expect(s.officers.off_park.career.operations).toBeLessThan(5);
    for (const o of [...Object.values(s.officers), ...s.candidates.map((c) => c.officer)]) {
      expect(Number.isFinite(o.bornDay) && Number.isFinite(o.serviceStartDay)).toBe(true);
      expect(o.retirement).toBeNull();
      expect(o.serviceStartDay).toBeGreaterThan(o.bornDay);
    }
    expect(careerInfo(s, 'off_okafor', T0)).toMatchObject({ age: 57, experience: 'veteran' });
  });

  it('migrates to something that settles, round-trips, and does not jump ratings', () => {
    const s = deserialize(JSON.stringify(v1Envelope()))!;
    const ratings = Object.fromEntries(Object.values(s.officers).map((o) => [o.id, o.ratings]));
    const later = ok(s, { type: 'tick' }, T0 + 30 * HOUR_MS);
    for (const o of Object.values(later.officers)) expect(o.ratings).toEqual(ratings[o.id]);
    expect(later.department.lastSettledAt).toBe(T0 + 30 * HOUR_MS);
    expect(deserialize(serialize(later, T0))).toEqual(later);
  });

  it('migrate() converts a v1 envelope and refuses a malformed one without throwing', () => {
    const env = v1Envelope() as any;
    expect(migrate(env)?.saveVersion).toBe(3);
    expect(migrate({ ...v1Envelope(), state: { ...v1Envelope().state, inventory: null } } as any)).toBeNull();
  });

  it('rejects a corrupt v1 save and a v2 save that lost its units', () => {
    const bad = v1Envelope() as any;
    bad.state.inventory.radio_kit.owned = null;
    expect(deserialize(JSON.stringify(bad))).toBeNull();
    const noUnits = JSON.parse(serialize(createInitialState(T0), T0));
    delete noUnits.state.units;
    expect(deserialize(JSON.stringify(noUnits))).toBeNull();
    const badOfficer = JSON.parse(serialize(createInitialState(T0), T0));
    badOfficer.state.officers.off_chen.career = null;
    expect(deserialize(JSON.stringify(badOfficer))).toBeNull();
    const badRet = JSON.parse(serialize(createInitialState(T0), T0));
    badRet.state.officers.off_chen.retirement = { day: 'soon' };
    expect(deserialize(JSON.stringify(badRet))).toBeNull();
    const badUnit = JSON.parse(serialize(createInitialState(T0), T0));
    badUnit.state.units.unit_1.status = 'lost';
    expect(deserialize(JSON.stringify(badUnit))).toBeNull();
  });

  it('a v2 save with career, retirement and service units round-trips', () => {
    let s = createInitialState(T0);
    s.officers.off_okafor.retirement = { day: 20, reason: 'service', announcedDay: -10, extended: false };
    s = ok(s, { type: 'offerRetention', officerId: 'off_okafor' }, T0);
    const radio = Object.values(s.units).find((u) => u.itemId === 'radio_kit' && u.condition < 92)!;
    s = ok(s, { type: 'serviceUnit', unitId: radio.id }, T0);
    s = ok(s, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(deserialize(serialize(s, T0))).toEqual(s);
  });
});
