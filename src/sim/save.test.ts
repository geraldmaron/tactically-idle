import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { CURRENT_SAVE_VERSION, SAVE_KEY, deserialize, loadGame, migrate, saveGame, serialize, type SaveStorage } from './save';
import { HOUR_MS } from './economy';
import { ownedCount } from './equipment';
import { readyUnits } from './inventory';
import { boardSummary, careerInfo } from './department-selectors';
import type { Command, GameState } from './types';
import { actionViews, briefing } from './operation-selectors';
import { playPolicy, startCmd } from './test-fixtures';

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

function operationState(generated = false): GameState {
  const s = createInitialState(T0);
  const scenarioId = generated ? s.incidents[0].id : 'ms_occupancy';
  const positions = { A: briefing(scenarioId).entries[0].id };
  const started = ok(s, startCmd(scenarioId, ['A'], { positions }), T0);
  const action = actionViews(started, T0, 'A').find((a) => a.eligible)!;
  return ok(started, { type: 'decide', actionId: action.id, actingSquadIds: action.actingSquadIds, supportSquadIds: action.supportSquadIds }, T0);
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

  it('keeps authored and generated operation history, positions and source cards unchanged', () => {
    for (const generated of [false, true]) {
      const s = operationState(generated);
      expect(s.activeRun!.history.length).toBeGreaterThan(0);
      expect(!!s.activeRun!.sourceIncident).toBe(generated);
      const loaded = deserialize(serialize(s, T0))!;
      expect(loaded).toEqual(s);
      expect(actionViews(loaded, T0, 'A')).toEqual(actionViews(s, T0, 'A'));
      expect(ok(loaded, { type: 'tick' }, T0 + HOUR_MS)).toEqual(ok(s, { type: 'tick' }, T0 + HOUR_MS));
    }
  });

  it('preserves a version 2 or 3 in-progress operation through migration', () => {
    for (const version of [2, 3]) {
      const s = operationState();
      const envelope = JSON.parse(serialize(s, T0));
      envelope.saveVersion = envelope.state.saveVersion = version;
      delete envelope.state.personnel;
      if (version === 2) { delete envelope.state.incidents; delete envelope.state.department.nextIncidentAt; }
      const loaded = deserialize(JSON.stringify(envelope))!;
      expect(loaded).not.toBeNull();
      expect(loaded.activeRun).toEqual(s.activeRun);
      expect(loaded.reservations).toEqual(s.reservations);
      expect(actionViews(loaded, T0, 'A')).toEqual(actionViews(s, T0, 'A'));
    }
  });

  it('restores a complete finished debrief', () => {
    const s = playPolicy(operationState(), {}).state;
    expect(s.debriefs).toHaveLength(1);
    expect(deserialize(serialize(s, T0))).toEqual(s);
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

  it('rejects nested reports, collection entries and UI enums before runtime uses them', () => {
    const changes: [string, (s: any) => void][] = [
      ['empty report', (s) => { s.report = {}; }],
      ['report courses', (s) => { s.report.completedCourses = [null]; }],
      ['report recovered', (s) => { s.report.recovered = {}; }],
      ['equipment event', (s) => { s.report.equipment = [{ unitId: 'unit_1', event: 'lost' }]; }],
      ['personnel event', (s) => { s.report.personnel = [{ officerId: 'off_chen', event: 'unknown', detail: 'Unknown' }]; }],
      ['restock entry', (s) => { s.department.restockRules = [null]; }],
      ['unlocked entry', (s) => { s.department.unlockedNodes = [{}]; }],
      ['prototype development node', (s) => { s.department.unlockedNodes = ['__proto__']; }],
      ['prototype training course', (s) => { s.officers.off_chen.assignment = { kind: 'training', courseId: '__proto__', startedAt: T0, endsAt: T0 }; }],
      ['loadout quantity', (s) => { s.squads[0].loadoutPreset = { radio_kit: {} }; }],
      ['officer role', (s) => { s.officers.off_chen.role = 'unknown'; }],
      ['officer trait', (s) => { s.officers.off_chen.traits = ['unknown']; }],
      ['officer certificate', (s) => { s.officers.off_chen.certs = [null]; }],
      ['unknown unit item', (s) => { s.units.unit_1.itemId = 'missing'; }],
      ['prototype officer reference', (s) => { s.squads[0].officerIds.push('__proto__'); }],
      ['unknown incident', (s) => { s.incidents[0].id = 'gen:unknown:maple_street:1:1:1:1'; }],
      ['empty debrief', (s) => { s.debriefs = [{}]; }],
    ];
    for (const [label, mutate] of changes) {
      const s = structuredClone(busyState());
      mutate(s);
      expect(deserialize(serialize(s, T0)), label).toBeNull();
    }
  });

  it('rejects corrupt active-run records, nested decisions and source cards', () => {
    const goodRun = operationState(true);
    const changes: [string, (r: any) => void][] = [
      ['squad collection', (r) => { r.squadIds = {}; }],
      ['empty squad collection', (r) => { r.squadIds = []; }],
      ['task entry', (r) => { r.squadTasks = [null]; }],
      ['task point', (r) => { r.squadTasks[0].at = { x: 1 }; }],
      ['stage', (r) => { r.stage = 'unknown'; }],
      ['status', (r) => { r.status = 'unknown'; }],
      ['knowledge', (r) => { r.knowledge = { fact: 'certain' }; }],
      ['history', (r) => { r.history = [{}]; }],
      ['decision inputs', (r) => { r.history[0].inputs = [null]; }],
      ['decision band', (r) => { r.history[0].band = 'unknown'; }],
      ['decision stress', (r) => { r.history[0].stressDeltas = { off_chen: {} }; }],
      ['decision explanation', (r) => { r.history[0].explanation = [{}]; }],
      ['last seen point', (r) => { r.lastSeen = { person: { spaceId: 'kitchen', at: null, revision: 0 } }; }],
      ['unknown map', (r) => { r.locationFamilyId = 'missing'; }],
      ['unknown scenario', (r) => { r.scenarioId = '__proto__'; }],
      ['source card shape', (r) => { r.sourceIncident = {}; }],
      ['source card identity', (r) => { r.sourceIncident.id = 'gen:welfare_check:maple_street:1:1:1:1'; }],
    ];
    for (const [label, mutate] of changes) {
      const s = structuredClone(goodRun);
      mutate(s.activeRun);
      expect(deserialize(serialize(s, T0)), label).toBeNull();
    }
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
  s.debriefs = [{ runId: 'run_0', scenarioId: 'ms_occupancy', endingId: 'handed_over', endingTitle: 'Handed over', practice: false,
    objective: { score: 50, label: 'Partial' }, civilianSafety: { score: 100, label: 'Safe' }, officerCondition: [],
    informationPreserved: [], resources: [], trustDelta: 0, fundingReward: 0, devPointReward: 0, causes: [] }];
  return { saveVersion: 1, contentVersion: 1, savedAt: T0, state: s };
}

describe('migration from version 1', () => {
  it('writes the current version', () => {
    expect(CURRENT_SAVE_VERSION).toBe(6);
    expect(createInitialState(T0).saveVersion).toBe(6);
  });

  it('turns stacks into units, adds the calendar and careers, and releases the in-flight run', () => {
    const text = JSON.stringify(v1Envelope());
    const s = deserialize(text)!;
    expect(s).not.toBeNull();
    expect(s.saveVersion).toBe(6);
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
    expect(migrate(env)?.saveVersion).toBe(6);
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

/** A version 2 save as it sits on disk: no incident board, no arrival schedule. */
function v2Envelope(savedAt = T0 + 5 * HOUR_MS) {
  const s = JSON.parse(JSON.stringify(createInitialState(T0)));
  delete s.incidents;
  delete s.department.nextIncidentAt;
  s.saveVersion = 2;
  s.rngState = 424242;
  return { saveVersion: 2, contentVersion: 1, savedAt, state: s };
}

describe('migration from version 2 to 3', () => {
  it('adds a deterministic three-card board arriving at the save time, plus a schedule', () => {
    const a = deserialize(JSON.stringify(v2Envelope()))!;
    const b = deserialize(JSON.stringify(v2Envelope()))!;
    expect(a).not.toBeNull();
    expect(a.saveVersion).toBe(6);
    expect(a).toEqual(b);
    expect(a.incidents).toHaveLength(3);
    for (const c of a.incidents) {
      expect(c).toMatchObject({ arrivedAt: T0 + 5 * HOUR_MS, seen: false });
      expect(c.expiresAt).toBeGreaterThan(c.arrivedAt);
    }
    expect(new Set(a.incidents.map((c) => c.id)).size).toBe(3);
    expect(boardSummary(a, T0 + 5 * HOUR_MS)).toMatchObject({ count: 3, newCount: 3 });
    expect(boardSummary(a, T0 + 5 * HOUR_MS).nextArrivalAt).toBeGreaterThan(T0 + 5 * HOUR_MS);
    // Everything else is carried over untouched.
    const fresh = createInitialState(T0);
    expect(a.officers).toEqual(fresh.officers);
    expect(a.squads).toEqual(fresh.squads);
    expect(a.units).toEqual(fresh.units);
  });

  it('seeds from rngState and savedAt: either one changing changes the board', () => {
    const base = deserialize(JSON.stringify(v2Envelope()))!;
    const later = deserialize(JSON.stringify(v2Envelope(T0 + 9 * HOUR_MS)))!;
    expect(later.incidents.map((c) => c.id)).not.toEqual(base.incidents.map((c) => c.id));
    const other = v2Envelope();
    other.state.rngState = 99;
    const changed = deserialize(JSON.stringify(other))!;
    expect(changed.incidents.map((c) => c.id)).not.toEqual(base.incidents.map((c) => c.id));
  });

  it('migrate() reports the current version, and the result round-trips and settles', () => {
    const m = migrate(v2Envelope() as any)!;
    expect(m.saveVersion).toBe(6);
    expect(m.state.saveVersion).toBe(6);
    const s = deserialize(JSON.stringify(v2Envelope()))!;
    expect(deserialize(serialize(s, T0))).toEqual(s);
    // Away for 15 hours: the migrated cards expire and the board keeps going.
    const later = ok(s, { type: 'tick' }, T0 + 20 * HOUR_MS);
    expect(later.incidents.every((c) => !s.incidents.some((o) => o.id === c.id))).toBe(true);
    expect(later.incidents.length).toBeGreaterThan(0);
  });

  it('a v2 save with a corrupt shape is still refused after migration', () => {
    const bad = v2Envelope() as any;
    bad.state.officers.off_chen.career = null;
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });
});

describe('migration chains from version 1 to 3', () => {
  it('a v1 save arrives at the current version with a board and the v2 conversions applied', () => {
    const s = deserialize(JSON.stringify(v1Envelope()))!;
    expect(s.saveVersion).toBe(6);
    expect(s.incidents).toHaveLength(3);
    expect(s.incidents.every((c) => c.arrivedAt === T0 && !c.seen)).toBe(true);
    expect(Object.keys(s.units).length).toBeGreaterThan(0);
    expect(Number.isFinite(s.officers.off_chen.bornDay)).toBe(true);
    expect(deserialize(JSON.stringify(v1Envelope()))).toEqual(s);
    expect(deserialize(serialize(s, T0))).toEqual(s);
  });
});

describe('version 3 validation and squad D', () => {
  const good = () => JSON.parse(serialize(createInitialState(T0), T0));

  it('a four-squad department round-trips', () => {
    let s = busyState();
    s = ok(s, { type: 'createSquad', name: 'Delta' }, T0 + 3 * HOUR_MS);
    s = ok(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: 'D' }, T0 + 3 * HOUR_MS);
    expect(s.squads.map((q) => q.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(deserialize(serialize(s, T0))).toEqual(s);
    expect(deserialize(serialize(s, T0))!.officers.off_chen.squadId).toBe('D');
  });

  it('refuses a squad outside A to D', () => {
    const e = good();
    e.state.squads.push({ id: 'E', name: 'Echo', officerIds: [], leaderId: null, duty: 'standby', loadoutPreset: {} });
    expect(deserialize(JSON.stringify(e))).toBeNull();
  });

  it('refuses a missing or malformed board', () => {
    const noBoard = good();
    delete noBoard.state.incidents;
    expect(deserialize(JSON.stringify(noBoard))).toBeNull();
    const badCard = good();
    badCard.state.incidents[0].expiresAt = 'soon';
    expect(deserialize(JSON.stringify(badCard))).toBeNull();
    const dupes = good();
    dupes.state.incidents[1].id = dupes.state.incidents[0].id;
    expect(deserialize(JSON.stringify(dupes))).toBeNull();
    const badSchedule = good();
    badSchedule.state.department.nextIncidentAt = 'later';
    expect(deserialize(JSON.stringify(badSchedule))).toBeNull();
  });

  it('a reload mid-schedule does not double or lose arrivals', () => {
    const s = busyState();
    const loaded = deserialize(serialize(s, T0 + 3 * HOUR_MS))!;
    const end = T0 + 30 * HOUR_MS;
    expect(ok(loaded, { type: 'tick' }, end).incidents).toEqual(ok(s, { type: 'tick' }, end).incidents);
  });
});
