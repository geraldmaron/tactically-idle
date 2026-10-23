import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { SAVE_KEY, deserialize, loadGame, saveGame, serialize, type SaveStorage } from './save';
import { HOUR_MS } from './economy';
import type { Command, GameState } from './types';
import { actionViews, briefing } from './operation-selectors';
import { makeState, NOW, playPolicy, startCmd, startRun, testCallId, withCallOnBoard } from './test-fixtures';

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
    expect(deserialize(mutate((e) => (e.state.units[Object.keys(e.state.units)[0]].condition = null)))).toBeNull();
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
      ['equipment event', (s) => { s.report.equipment = [{ unitId: Object.keys(s.units)[0], event: 'lost' }]; }],
      ['personnel event', (s) => { s.report.personnel = [{ officerId: 'off_chen', event: 'unknown', detail: 'Unknown' }]; }],
      ['restock entry', (s) => { s.department.restockRules = [null]; }],
      ['unlocked entry', (s) => { s.department.unlockedNodes = [{}]; }],
      ['prototype development node', (s) => { s.department.unlockedNodes = ['__proto__']; }],
      ['prototype training course', (s) => { s.officers.off_chen.assignment = { kind: 'training', courseId: '__proto__', startedAt: T0, endsAt: T0 }; }],
      ['loadout quantity', (s) => { s.squads[0].loadoutPreset = { loud_hailer: {} }; }],
      ['officer role', (s) => { s.officers.off_chen.role = 'unknown'; }],
      ['officer trait', (s) => { s.officers.off_chen.traits = ['unknown']; }],
      ['officer certificate', (s) => { s.officers.off_chen.certs = [null]; }],
      ['unknown unit item', (s) => { s.units[Object.keys(s.units)[0]].itemId = 'missing'; }],
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
    dupes.state.incidents.push({ ...dupes.state.incidents[0] });
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



describe('roster membership', () => {
  const good = () => JSON.parse(serialize(createInitialState(T0), T0));
  const squad = (e: ReturnType<typeof good>, id: string) => e.state.squads.find((q: { id: string }) => q.id === id);
  const loads = (e: unknown) => deserialize(JSON.stringify(e)) !== null;

  it('loads a roster that agrees with itself', () => {
    expect(loads(good())).toBe(true);
  });

  it('refuses a squad that lists one officer twice', () => {
    const e = good();
    const alpha = squad(e, 'A');
    alpha.officerIds.push(alpha.officerIds[1]);
    expect(loads(e)).toBe(false);
  });

  it('refuses an officer listed in two squads', () => {
    const e = good();
    const alpha = squad(e, 'A');
    squad(e, 'B').officerIds.push(alpha.officerIds[1]);
    expect(loads(e)).toBe(false);
  });

  it('refuses an officer whose own squad reference disagrees with the squad that lists them', () => {
    const wrongSquad = good();
    const id = squad(wrongSquad, 'A').officerIds[1];
    wrongSquad.state.officers[id].squadId = 'B';
    expect(loads(wrongSquad)).toBe(false);

    const noReference = good();
    noReference.state.officers[squad(noReference, 'A').officerIds[1]].squadId = null;
    expect(loads(noReference)).toBe(false);

    const unlisted = good();
    const alpha = squad(unlisted, 'A');
    const left = alpha.officerIds.pop();
    expect(alpha.leaderId).not.toBe(left);
    expect(loads(unlisted)).toBe(false);
  });

  it('keeps a move queued during a call loading, with membership unchanged', () => {
    const callId = testCallId('barricade');
    const running = startRun(withCallOnBoard(makeState(), callId), callId, ['A']);
    const mover = 'off_brooks';
    expect(running.officers[mover].assignment?.kind).toBe('operation');
    const queued = ok(running, { type: 'assignToSquad', officerId: mover, squadId: 'B' }, NOW);
    expect(queued.pendingSquadMoves).toMatchObject([{ officerId: mover, squadId: 'B' }]);
    expect(queued.officers[mover].squadId).toBe('A');
    const loaded = deserialize(serialize(queued, NOW));
    expect(loaded).toEqual(queued);
    expect(loaded!.squads.find((q) => q.id === 'A')!.officerIds).toContain(mover);
    // A queued move out of every squad loads too.
    const toNone = ok(running, { type: 'assignToSquad', officerId: mover, squadId: null }, NOW);
    expect(deserialize(serialize(toNone, NOW))).toEqual(toNone);
  });

  it('does not hold the squad arrangement history to the live roster rule', () => {
    const e = good();
    const [a, b] = [squad(e, 'A').officerIds[0], squad(e, 'B').officerIds[0]];
    const doubled = { squads: [{ squadId: 'A', officerIds: [a, b], leaderId: a }, { squadId: 'B', officerIds: [b], leaderId: b }], unassignedIds: [] };
    e.state.squadArrangement = { officerLocks: [], squadLocks: [], undo: { before: doubled, after: doubled } };
    const loaded = deserialize(JSON.stringify(e));
    // The unusable history record is dropped on read; the roster beside it still loads.
    expect(loaded).not.toBeNull();
    expect(loaded!.squads.map((q) => q.officerIds)).toEqual(e.state.squads.map((q: { officerIds: string[] }) => q.officerIds));
  });
});

describe('current version boundary', () => {
  it('rejects every historical or future envelope and state version without migrating', () => {
    const current = JSON.parse(serialize(createInitialState(T0), T0));
    for (const [field, values] of [['saveVersion', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]], ['contentVersion', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14]]] as const) {
      for (const value of values) for (const target of ['envelope', 'state'] as const) {
        const bad = structuredClone(current);
        if (target === 'envelope') bad[field] = value; else bad.state[field] = value;
        const text = JSON.stringify(bad);
        expect(deserialize(text), `${target}.${field}=${value}`).toBeNull();
        expect(JSON.stringify(bad)).toBe(text);
      }
    }
  });
});
