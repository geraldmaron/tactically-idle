import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { addService, departmentService, levelForService, levelProgress, MAX_LEVEL, serviceEarned, serviceForLevel, START_LEVEL } from './department-level';
import { deserialize, serialize } from './save';
import { apply, NOW, startCmd } from './test-fixtures';
import { buildLocation } from './location';
import { getScenario } from './scenario-registry';
import { applyNaturalMove, firstMove } from '../gen/incident/gates/engine-driver';
import { incidentId } from '../gen/incident';
import { specForSituation } from '../gen/incident/gates/catalog';
import { frameworksOpeningAt } from '../content/unlocks';
import type { GameState } from './types';

describe('department level from service', () => {
  it('has rising thresholds and never skips or exceeds the top level', () => {
    expect([1, 2, 3, 4, 5, 6].map(serviceForLevel)).toEqual([0, 10, 30, 60, 100, 150]);
    expect(levelForService(0)).toBe(1);
    expect(levelForService(9)).toBe(1);
    expect(levelForService(10)).toBe(2);
    expect(levelForService(59)).toBe(3);
    expect(levelForService(1e9)).toBe(MAX_LEVEL);
    for (let service = 0; service < 600; service++) expect(serviceForLevel(levelForService(service))).toBeLessThanOrEqual(service);
  });

  it('pays more for completing harder calls, a little for any live call, and nothing for practice', () => {
    expect(serviceEarned({ practice: true, completed: true, failed: false }, 5)).toBe(0);
    expect(serviceEarned({ practice: false, completed: true, failed: false }, 1)).toBe(3);
    expect(serviceEarned({ practice: false, completed: true, failed: false }, 5)).toBe(7);
    expect(serviceEarned({ practice: false, completed: false, failed: false }, 4)).toBe(3);
    expect(serviceEarned({ practice: false, completed: false, failed: true }, 5)).toBe(1);
  });

  it('starts new campaigns at level 1 and reads older departments from the level they hold', () => {
    const s = createInitialState(NOW);
    expect(s.department.level).toBe(START_LEVEL);
    expect(s.department.service).toBe(0);
    const older = { level: 3 } as GameState['department'];
    expect(departmentService(older)).toBe(30);
    expect(levelProgress(older)).toEqual({ level: 3, service: 30, floor: 30, next: 60 });
    const raised = addService(older, 31);
    expect(raised).toEqual({ before: 3, after: 4 });
    expect(older.service).toBe(61);
    // A grandfathered level above what service reaches is never lowered.
    const lifted = { level: 5, service: 0 } as GameState['department'];
    expect(addService(lifted, 3)).toEqual({ before: 5, after: 5 });
  });

  it('names what the next level opens, by framework label only', () => {
    expect([...frameworksOpeningAt(2)].sort()).toEqual(['alarm and keyholder response', 'medical assistance']);
    expect(frameworksOpeningAt(4).some(line => line.startsWith('active armed incident (with a certified officer and the right equipment)'))).toBe(true);
    expect(frameworksOpeningAt(99)).toEqual([]);
  });
});

describe('earning service on a live call', () => {
  /** Play a live v12 call to its debrief with the run's own dice, as a player would. */
  function playLive(seed: number): { before: GameState; after: GameState } {
    const id = incidentId(specForSituation('domestic', 'cedar_close', 1));
    const s = getScenario(id)!;
    const before = createInitialState(NOW, seed);
    before.incidents = [{ id, type: 'domestic', familyId: 'cedar_close', tier: s.incident!.tier, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
    const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
    let state = apply(before, startCmd(id, ['A'], { positions: { A: entry }, loadouts: { A: {} } })).state;
    expect(state.activeRun?.practice).toBe(false);
    for (let i = 0; i < 30 && state.activeRun?.status === 'active'; i++) {
      const move = firstMove(state);
      const next = move && applyNaturalMove(state, move);
      if (!next) break;
      state = next;
    }
    expect(state.activeRun?.status).toBe('debrief');
    const closed = apply(state, { type: 'closeDebrief' });
    expect(closed.result.ok).toBe(true);
    return { before: state, after: closed.state };
  }

  it('adds the service the debrief reports, and records a level reached', () => {
    const { before, after } = playLive(17);
    const report = after.debriefs[0];
    expect(report.practice).toBe(false);
    expect(report.serviceEarned).toBeGreaterThan(0);
    expect(after.department.service).toBe((before.department.service ?? 0) + report.serviceEarned!);
    expect(after.department.level).toBe(levelForService(after.department.service!));
    expect(report.levelReached === undefined).toBe(after.department.level === before.department.level);
    expect(deserialize(serialize(after, NOW))).toEqual(after);
  });
});

describe('save v7 migration', () => {
  it('keeps every framework an older campaign met or could already be sent to', () => {
    const s = createInitialState(NOW, 3);
    s.department.level = 3;
    delete s.department.service;
    s.casebook = { frameworksSeen: ['domestic', 'active_armed_incident'], recipes: {} };
    for (const officer of Object.values(s.officers)) officer.certs = officer.certs.filter(cert => cert !== 'crisis_negotiation');
    s.saveVersion = 6;
    const migrated = deserialize(serialize(s, NOW))!;
    expect(migrated.saveVersion).toBe(7);
    // Armed incidents were met (level 4). Hostage crises need a negotiator nobody holds, so
    // they wait for level 5 like any campaign's.
    expect(migrated.department.level).toBe(4);
    expect(migrated.department.service).toBe(serviceForLevel(4));
    // With a negotiator on the roster, the department could already be sent hostage calls.
    const negotiator = structuredClone(s);
    Object.values(negotiator.officers)[0].certs.push('crisis_negotiation');
    expect(deserialize(serialize(negotiator, NOW))!.department.level).toBe(5);
    // Nothing met and nothing specialist possible: the level is kept as it was.
    const plain = structuredClone(s);
    plain.casebook = { frameworksSeen: ['domestic'], recipes: {} };
    for (const officer of Object.values(plain.officers)) officer.certs = [];
    expect(deserialize(serialize(plain, NOW))!.department.level).toBe(3);
  });
});
