import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { HOUR_MS, ratesAt } from './economy';
import { deserialize, serialize } from './save';
import {
  PATROL_BOOSTS, PATROL_GRADES, employedPatrol, patrolBoostQuote, patrolCapacity,
  patrolCandidates, patrolRates, patrolTrainingQuote,
} from './patrol';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 0, 5, 12);
const run = (state: GameState, cmd: Command, now = T0) => dispatch(state, cmd, { now });
function ok(state: GameState, cmd: Command, now = T0): GameState {
  const result = run(state, cmd, now);
  expect(result.result, JSON.stringify(cmd)).toMatchObject({ ok: true });
  return result.state;
}
function refused(state: GameState, cmd: Command, now = T0): string {
  const result = run(state, cmd, now);
  expect(result.result.ok).toBe(false);
  expect(result.state).toBe(state);
  return result.result.ok ? '' : result.result.reason;
}

describe('patrol workforce', () => {
  it('opens with four separate patrol employees and reconciles to $620 net per hour', () => {
    const state = createInitialState(T0);
    expect(employedPatrol(state)).toHaveLength(4);
    expect(employedPatrol(state).every((person) => person.grade === 1 && person.serviceHours === 0)).toBe(true);
    expect(ratesAt(state, T0)).toMatchObject({
      base: 600, patrol: 840, patrolBase: 840, patrolBoost: 0,
      patrolWages: 180, patrolOperating: 60, gross: 1440,
      wages: 380, operating: 120, supplies: 80, net: 620,
    });
  });

  it('does not change patrol earnings when tactical squads change duty', () => {
    const state = createInitialState(T0);
    const before = ratesAt(state, T0);
    for (const squad of state.squads) squad.duty = 'standby';
    expect(ratesAt(state, T0)).toMatchObject({ patrol: before.patrol, patrolWages: before.patrolWages, patrolOperating: before.patrolOperating, net: before.net });
    state.squads[0].duty = 'rest';
    expect(ratesAt(state, T0).patrol).toBe(before.patrol);
  });

  it('authorizes 6, 8, and 12 patrol positions at department levels 1, 3, and 6', () => {
    const state = createInitialState(T0);
    expect([1, 3, 6].map((level) => patrolCapacity({ department: { ...state.department, level } } as GameState))).toEqual([6, 8, 12]);
  });

  it('hires a distinct offered candidate for $900 and pays the previewed recurring rate', () => {
    const state = createInitialState(T0);
    const candidate = patrolCandidates(state)[0];
    const hired = ok(state, { type: 'hirePatrol', profileId: candidate.id });
    expect(hired.department.funding).toBe(state.department.funding - 900);
    expect(employedPatrol(hired)).toHaveLength(5);
    expect(hired.patrol.personnel.at(-1)).toMatchObject({ profileId: candidate.id, grade: 1, serviceHours: 0, training: null });
    expect(hired.department.ledger!.at(-1)).toMatchObject({ kind: 'signing', amount: -900 });
    expect(ratesAt(hired, T0)).toMatchObject({ patrol: 1050, patrolWages: 225, patrolOperating: 75, net: 770 });
    expect(refused(hired, { type: 'hirePatrol', profileId: candidate.id })).toMatch(/no longer available/i);
  });

  it('dismisses an employee with 24 hours of grade-based severance', () => {
    const state = createInitialState(T0);
    const employee = employedPatrol(state)[0];
    const dismissed = ok(state, { type: 'dismissPatrol', employeeId: employee.id });
    expect(dismissed.department.funding).toBe(state.department.funding - 24 * PATROL_GRADES[1].wage);
    expect(dismissed.department.ledger!.at(-1)).toMatchObject({ kind: 'severance', amount: -1080 });
    expect(employedPatrol(dismissed)).toHaveLength(3);
    expect(dismissed.patrol.personnel.find((person) => person.id === employee.id)?.dismissedAt).toBe(T0);
    expect(ratesAt(dismissed, T0).patrol).toBe(630);
  });
});

describe('promotion and service', () => {
  it('requires level, service, funding, and the one available training place', () => {
    const state = createInitialState(T0);
    const employee = employedPatrol(state)[0];
    employee.serviceHours = 100;
    expect(patrolTrainingQuote(state, employee.id)).toMatchObject({ ok: false, reason: 'Requires department level 3' });
    state.department.level = 3;
    state.department.funding = 100;
    expect(patrolTrainingQuote(state, employee.id).reason).toMatch(/Needs 1200 funding/);
    state.department.funding = 20_000;
    const started = ok(state, { type: 'startPatrolTraining', employeeId: employee.id });
    expect(started.patrol.personnel[0].training).toMatchObject({ toGrade: 2, startedAt: T0, endsAt: T0 + 4 * HOUR_MS });
    const other = employedPatrol(started)[1];
    other.serviceHours = 100;
    expect(patrolTrainingQuote(started, other.id).reason).toMatch(/training place is occupied/);
    expect(patrolTrainingQuote(started, employee.id).reason).toMatch(/already training/);
  });

  it('promotes through the grade thresholds and changes gross, wages, and operations rates', () => {
    let state = createInitialState(T0);
    state.department.level = 6;
    state.department.funding = 20_000;
    const employee = employedPatrol(state)[0];
    employee.serviceHours = 100;
    state = ok(state, { type: 'startPatrolTraining', employeeId: employee.id });
    expect(ratesAt(state, T0)).toMatchObject({ patrol: 630, patrolWages: 180, patrolOperating: 60, net: 410 });
    state = ok(state, { type: 'tick' }, T0 + 4 * HOUR_MS);
    expect(state.patrol.personnel[0]).toMatchObject({ grade: 2, training: null });
    expect(state.report?.patrolTraining).toEqual([{ employeeId: employee.id, profileId: employee.profileId, grade: 2, completedAt: T0 + 4 * HOUR_MS }]);
    expect(deserialize(serialize(state, T0 + 4 * HOUR_MS))).toEqual(state);
    expect(ratesAt(state, T0 + 4 * HOUR_MS)).toMatchObject({ patrol: 880, patrolWages: 190, patrolOperating: 63, net: 647 });
    state = ok(state, { type: 'tick' }, T0 + 5 * HOUR_MS);
    expect(state.report?.patrolTraining).toHaveLength(1);
    expect(state.report?.patrolTraining?.[0].completedAt).toBe(T0 + 4 * HOUR_MS);

    state.patrol.personnel[0].serviceHours = 300;
    state = ok(state, { type: 'startPatrolTraining', employeeId: employee.id }, T0 + 5 * HOUR_MS);
    expect(state.patrol.personnel[0].training).toMatchObject({ toGrade: 3, endsAt: T0 + 13 * HOUR_MS });
    state = ok(state, { type: 'tick' }, T0 + 13 * HOUR_MS);
    expect(state.patrol.personnel[0]).toMatchObject({ grade: 3, training: null });
    expect(ratesAt(state, T0 + 13 * HOUR_MS)).toMatchObject({ patrol: 930, patrolWages: 205, patrolOperating: 67, net: 678 });
  });

  it('accrues eligible patrol service without granting department service or tactical XP', () => {
    const state = createInitialState(T0);
    const xp = Object.fromEntries(Object.entries(state.officers).map(([id, officer]) => [id, officer.xp]));
    const settled = ok(state, { type: 'tick' }, T0 + HOUR_MS);
    expect(employedPatrol(settled).map((person) => person.serviceHours)).toEqual([1, 1, 1, 1]);
    expect(settled.department.service).toBe(state.department.service);
    expect(Object.fromEntries(Object.entries(settled.officers).map(([id, officer]) => [id, officer.xp]))).toEqual(xp);
  });
});

describe('community grant boost', () => {
  it('refuses a grant whose four-hour gross return is below its $2,000 cost', () => {
    const state = createInitialState(T0);
    expect(PATROL_BOOSTS['community-grant']).toEqual({ factor: 1.5, hours: 4, cost: 2000 });
    expect(patrolBoostQuote(state, 'community-grant')).toMatchObject({ ok: false, incrementalReturn: 1680 });
    expect(refused(state, { type: 'activatePatrolBoost', boostId: 'community-grant' })).toMatch(/return only \$1,680/);
  });

  it('boosts gross only, caps the aggregate factor at 2x, and extends the same grant window', () => {
    let state = createInitialState(T0);
    const candidate = patrolCandidates(state)[0];
    state = ok(state, { type: 'hirePatrol', profileId: candidate.id });
    const quote = patrolBoostQuote(state, 'community-grant');
    expect(quote).toMatchObject({ ok: true, factor: 1.5, incrementalReturn: 2100, upfront: 2000 });
    state = ok(state, { type: 'activatePatrolBoost', boostId: 'community-grant' });
    expect(state.patrol.boosts).toHaveLength(1);
    expect(state.patrol.boosts[0].expiresAt).toBe(T0 + 4 * HOUR_MS);
    expect(ratesAt(state, T0)).toMatchObject({ patrolBase: 1050, patrolBoost: 525, patrol: 1575, patrolWages: 225, patrolOperating: 75, net: 1295 });
    expect(ratesAt(state, T0, false).patrol).toBe(1050);

    const reapplyAt = T0 + HOUR_MS;
    const extendedQuote = patrolBoostQuote(state, 'community-grant');
    expect(extendedQuote).toMatchObject({ ok: true, factor: 1.5, incrementalReturn: 2100, expiresAt: T0 + 8 * HOUR_MS });
    state = ok(state, { type: 'activatePatrolBoost', boostId: 'community-grant' }, reapplyAt);
    expect(state.patrol.boosts).toHaveLength(1);
    expect(state.patrol.boosts[0].expiresAt).toBe(T0 + 8 * HOUR_MS);
    expect(patrolRates(state, T0 + 7 * HOUR_MS).factor).toBe(1.5);
    expect(patrolRates(state, T0 + 8 * HOUR_MS).factor).toBe(1);
    expect(patrolRates({ patrol: { boosts: [
      { id: 'community-grant', factor: 1.5, grantedAt: T0, expiresAt: T0 + HOUR_MS },
      { id: 'community-grant', factor: 1.5, grantedAt: T0, expiresAt: T0 + HOUR_MS },
    ] } } as GameState, T0).factor).toBe(2);
  });

  it('refuses a further extension when the 24-hour accrual cap leaves no eligible return', () => {
    let state = createInitialState(T0);
    state.department.funding = 50_000;
    state = ok(state, { type: 'hirePatrol', profileId: patrolCandidates(state)[0].id });
    state = ok(state, { type: 'activatePatrolBoost', boostId: 'community-grant' });
    // Six four-hour grant windows can fit inside the same capped accrual window.
    for (let i = 0; i < 5; i++) {
      expect(patrolBoostQuote(state, 'community-grant')).toMatchObject({ ok: true, incrementalReturn: 2100 });
      state = ok(state, { type: 'activatePatrolBoost', boostId: 'community-grant' });
    }
    expect(patrolBoostQuote(state, 'community-grant')).toMatchObject({ ok: false, incrementalReturn: 0 });
    const funding = state.department.funding;
    expect(refused(state, { type: 'activatePatrolBoost', boostId: 'community-grant' })).toMatch(/return only \$0/);
    expect(state.department.funding).toBe(funding);
    expect(state.patrol.boosts[0].expiresAt).toBe(T0 + 24 * HOUR_MS);
  });
});

describe('patrol settlement and saves', () => {
  it('settles consistently across training completion and boost expiry boundaries', () => {
    const start = createInitialState(T0);
    const employee = employedPatrol(start)[0];
    employee.serviceHours = 100;
    start.department.level = 3;
    start.department.funding = 20_000;
    start.patrol.personnel[0].training = { toGrade: 2, startedAt: T0, endsAt: T0 + 2 * HOUR_MS };
    start.patrol.boosts.push({ id: 'community-grant', factor: 1.5, grantedAt: T0, expiresAt: T0 + 3 * HOUR_MS });
    const end = T0 + 5 * HOUR_MS;
    const offline = ok(start, { type: 'tick' }, end);
    let online = ok(start, { type: 'tick' }, T0 + HOUR_MS);
    online = ok(online, { type: 'tick' }, T0 + 2 * HOUR_MS);
    online = ok(online, { type: 'tick' }, T0 + 3 * HOUR_MS);
    online = ok(online, { type: 'tick' }, end);
    expect(offline.department.funding).toBeCloseTo(online.department.funding, 6);
    expect(offline.patrol.personnel).toEqual(online.patrol.personnel);
    expect(offline.patrol.boosts).toEqual(online.patrol.boosts);
    expect(offline.department.service).toBe(online.department.service);
    expect(offline.officers).toEqual(online.officers);
    expect(offline.patrol.personnel[0]).toMatchObject({ grade: 2, serviceHours: 103, training: null });
  });

  it('caps patrol service accrual to the department 24-hour offline window', () => {
    const state = createInitialState(T0);
    const settled = ok(state, { type: 'tick' }, T0 + 30 * HOUR_MS);
    expect(employedPatrol(settled).map((person) => person.serviceHours).every((hours) => Math.abs(hours - 24) < 1e-9)).toBe(true);
    expect(settled.department.lastSettledAt).toBe(T0 + 30 * HOUR_MS);
  });

  it('rolls a refused command back with no elapsed settlement committed', () => {
    const state = createInitialState(T0);
    const refusedAt = T0 + HOUR_MS;
    expect(refused(state, { type: 'dismissPatrol', employeeId: 'missing' }, refusedAt)).toMatch(/No such employed/);
    expect(state.department.lastSettledAt).toBe(T0);
    expect(employedPatrol(state).map((person) => person.serviceHours)).toEqual([0, 0, 0, 0]);
  });

  it('round-trips v18 patrol state and rejects an old version or malformed patrol workforce', () => {
    const state = createInitialState(T0);
    const saved = JSON.parse(serialize(state, T0));
    expect(saved.saveVersion).toBe(18);
    expect(deserialize(JSON.stringify(saved))).not.toBeNull();
    saved.saveVersion = 17;
    expect(deserialize(JSON.stringify(saved))).toBeNull();
    const malformed = JSON.parse(serialize(state, T0));
    malformed.state.patrol.personnel[0].grade = 4;
    expect(deserialize(JSON.stringify(malformed))).toBeNull();
    const overlapping = JSON.parse(serialize(state, T0));
    overlapping.state.patrol.personnel[0].profileId = overlapping.state.officers.off_chen.identityId;
    expect(deserialize(JSON.stringify(overlapping))).toBeNull();
    const forgedBoost = JSON.parse(serialize(state, T0));
    forgedBoost.state.patrol.boosts.push({ id: 'community-grant', factor: 1.6, grantedAt: T0, expiresAt: T0 + HOUR_MS });
    expect(deserialize(JSON.stringify(forgedBoost))).toBeNull();
  });
});
