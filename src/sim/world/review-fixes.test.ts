// Regression tests for the integrated review of the world redesign (findings 3 to 8): what a shift grants for
// the time it served, who is on it, when it stops, what is released and who retires at that boundary, who the
// final-hour cases belong to, and where patrol staff work. Each one failed on the reviewed commit.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../department';
import { dispatch } from '../game';
import { gameDay } from '../calendar';
import { HOUR_MS, settle } from '../economy';
import { patrolCandidates, employedPatrol } from '../patrol';
import { checkStart } from '../operation';
import { planSquadArrangement } from '../squad-optimizer';
import { dutyRates } from '../economy';
import { serialize, deserialize } from '../save';
import { SCENARIO_TYPES } from '../../content/scenario-types';
import { incidentId, INCIDENT_CONTENT_VERSION } from '../../gen/incident';
import { getScenario } from '../scenario-registry';
import { withCallOnBoard } from '../test-fixtures';
import type { Command, GameState } from '../types';
import { patrolDistrict } from './core';
import { validWorldState } from './index';
import { shiftMembers } from './shifts';
import { SHIFT } from '../../content/city/tuning';

const T0 = 1_800_000_000_000 + 20 * 60_000;
const H = HOUR_MS;

const run = (state: GameState, cmd: Command, now: number): GameState => {
  const out = dispatch(state, cmd, { now });
  if (!out.result.ok) throw new Error(`${cmd.type} refused: ${out.result.reason}`);
  return out.state;
};
const refusal = (state: GameState, cmd: Command, now: number): string => {
  const out = dispatch(state, cmd, { now });
  if (out.result.ok) throw new Error(`${cmd.type} was accepted`);
  return out.result.reason;
};

/** A campaign past its first return, founded at T0 in Pike Street, with shifts open. */
function open(seed = 7): GameState {
  let s = createInitialState(T0, seed);
  s.world.onboarding.stage = 'founding';
  s = run(s, { type: 'foundDepartment', name: 'Westhaven SWAT', districtId: 'pike' }, T0);
  s.world.onboarding.stage = 'done';
  return s;
}

const startShift = (s: GameState, hours: 2 | 4 | 8 = 2, squadId: 'A' | 'B' = 'A'): GameState => run(s, { type: 'startProactiveShift', squadId, districtId: 'pike', hours }, T0);

/** The state at `to`, settled in one call, or in steps of `step` ms. Floats are rounded away in comparisons. */
function settledTo(state: GameState, to: number, step?: number): GameState {
  const d = structuredClone(state);
  if (step) for (let t = T0 + step; t < to; t += step) settle(d, t);
  settle(d, to);
  return d;
}
const rounded = (_: string, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v);
const snapshot = (s: GameState) => JSON.stringify({ world: s.world, officers: s.officers, squads: s.squads, people: s.people, funding: Math.round(s.department.funding * 1000) / 1000 }, rounded);

const shiftFacts = (s: GameState) => s.people.facts.filter((f) => f.kind === 'shift');
const squadIds = (s: GameState, id: string) => [...s.squads.find((q) => q.id === id)!.officerIds];

describe('finding 3: a shift grants what it served', () => {
  it('start and recall in the same instant leave no memory and move no bond, however often it is repeated', () => {
    let s = open();
    const drift = (x: GameState) => JSON.stringify(x.people.bonds);
    const before = drift(s);
    const factsBefore = shiftFacts(s).length;
    for (let i = 0; i < 25; i++) {
      s = startShift(s);
      s = run(s, { type: 'recallProactiveShift', squadId: 'A' }, T0);
    }
    expect(shiftFacts(s)).toHaveLength(factsBefore);
    expect(drift(s)).toBe(before);
  });

  it('a short real service counts in part, and the memory states the hours worked, rounded down', () => {
    // 40 minutes: past the floor, a third of a full shift's drift, and one hour is the least a memory reads.
    let s = startShift(open());
    s = run(s, { type: 'recallProactiveShift', squadId: 'A' }, T0 + 40 * 60_000);
    const pairs = s.people.bonds.filter((b) => b.cause.kind === 'shared_shift');
    expect(pairs.length).toBeGreaterThan(0);
    for (const bond of pairs) expect(bond.drift).toBeCloseTo(6 * (40 / 120), 6);
    expect(shiftFacts(s)[0].detail).toMatch(/\b1 hour\b/);

    // 3 hours 30: three hours, not four, and the full drift.
    let long = startShift(open(), 4);
    long = run(long, { type: 'recallProactiveShift', squadId: 'A' }, T0 + 3.5 * H);
    expect(shiftFacts(long)[0].detail).toMatch(/\b3 hours?\b/);
    for (const bond of long.people.bonds.filter((b) => b.cause.kind === 'shared_shift')) expect(bond.drift).toBeCloseTo(6, 6);
  });
});

describe('finding 4: who is on a shift', () => {
  it('refuses to move, swap or drop a member, and a call for a squad on shift', () => {
    const s = startShift(run(open(), { type: 'createSquad', name: 'Charlie' }, T0));
    const [a1] = squadIds(s, 'A');
    const [b1] = squadIds(s, 'B');
    expect(refusal(s, { type: 'assignToSquad', officerId: a1, squadId: 'C' }, T0)).toMatch(/proactive shift/);
    expect(refusal(s, { type: 'assignToSquad', officerId: a1, squadId: null }, T0)).toMatch(/proactive shift/);
    expect(refusal(s, { type: 'swapSquadMembers', officerId: a1, withId: b1 }, T0)).toMatch(/proactive shift/);
    expect(refusal(s, { type: 'swapSquadMembers', officerId: b1, withId: a1 }, T0)).toMatch(/proactive shift/);
    expect(squadIds(s, 'A')).toEqual(squadIds(open(), 'A'));
    // The squad cannot start a call while the shift is on, even if a ready officer were seated in it.
    const family = SCENARIO_TYPES.find((info) => info.type === 'barricaded')!.families[0];
    const call = getScenario(incidentId({ type: 'barricaded', familyId: family, buildingSeed: 3, seed: 5, tier: 3, contentVersion: INCIDENT_CONTENT_VERSION }))!.id;
    const issues = checkStart(withCallOnBoard(s, call, T0), T0, { type: 'startOperation', scenarioId: call, squadIds: ['A'], positions: {}, loadouts: {} }).issues;
    expect(issues.some((i) => /proactive shift/.test(i))).toBe(true);
  });

  it('treats a shift member as fixed in the squad optimizer, with the reason named', () => {
    const s = startShift(open());
    const plan = planSquadArrangement(s, { squadIds: ['A', 'B'], includeUnassigned: true, preserveLeaders: false }, dutyRates());
    const held = plan.protected.filter((p) => squadIds(s, 'A').includes(p.officerId));
    expect(held).toHaveLength(4);
    expect(held.every((p) => p.reason === 'On a proactive shift')).toBe(true);
    expect(plan.moves.every((m) => !squadIds(s, 'A').includes(m.officerId))).toBe(true);
  });

  it('keeps the shift on the people who started it: memories and bonds follow the recorded roster', () => {
    let s = open();
    // Alpha works short: one officer steps out, then a shift starts with the other three.
    const [out] = squadIds(s, 'A').slice(-1);
    s = run(s, { type: 'assignToSquad', officerId: out, squadId: null }, T0);
    s = startShift(s);
    const roster = squadIds(s, 'A').sort();
    expect(roster).toHaveLength(3);
    // The reserve officer is seated in Alpha while the shift runs. They did not ride it.
    s = run(s, { type: 'assignToSquad', officerId: out, squadId: 'A' }, T0 + H);
    s = settledTo(s, T0 + 2 * H + 1);
    expect(s.world.shifts[0].stopReason).toBe('ended');
    expect(shiftFacts(s).map((f) => f.officerId).sort()).toEqual(roster);
    expect(shiftFacts(s).every((f) => /\b2 hours?\b/.test(f.detail))).toBe(true);
    expect(s.people.bonds.filter((b) => b.cause.kind === 'shared_shift' && (b.a === out || b.b === out))).toHaveLength(0);
    expect([...s.world.shifts[0].officerIds!].sort()).toEqual(roster);
  });
});

describe('finding 5: strain stops one fixed time', () => {
  it('stops at the same minute in one settlement and in five-second ticks, with the same books', () => {
    const base = open();
    for (const id of squadIds(base, 'A')) base.officers[id].stress = 51.99;
    const started = startShift(base, 8);
    const end = T0 + 6 * H;
    const one = settledTo(started, end);
    const fine = settledTo(started, end, 5_000);
    const a = one.world.shifts[0], b = fine.world.shifts[0];
    expect(a.stopReason).toBe('strain');
    expect(b.stoppedAt).toBe(a.stoppedAt);
    expect(a.stoppedAt! % SHIFT.strainGridMs).toBe(0);
    expect(fine.department.funding).toBeCloseTo(one.department.funding, 3);
    expect(snapshot(fine)).toBe(snapshot(one));
  });

  it('records the deadline when the shift starts and never reads it from stress again', () => {
    const base = open();
    for (const id of squadIds(base, 'A')) base.officers[id].stress = 40;
    const started = startShift(base, 8);
    const shift = started.world.shifts[0];
    // 40 to 58 at 2 an hour: nine hours, past the eight hour end, so the shift ends first and has no deadline.
    expect(shift.strainAt).toBeUndefined();
    const tired = open();
    for (const id of squadIds(tired, 'A')) tired.officers[id].stress = 50;
    const t = startShift(tired, 8).world.shifts[0];
    expect(t.strainAt).toBeGreaterThan(t.startedAt);
    expect(t.strainAt).toBeLessThan(t.endsAt);
    expect(validWorldState(JSON.parse(JSON.stringify(startShift(tired, 8).world)), T0)).toBe(true);
  });
});

describe('finding 6: release and retirement happen in the same boundary', () => {
  it('an overdue retirement lands when the shift releases the officer, in one settlement or many', () => {
    const base = open();
    const leaver = squadIds(base, 'A')[0];
    const day = gameDay(base, T0);
    base.officers[leaver].retirement = { day, reason: 'service', announcedDay: day - 30, extended: false };
    const started = startShift(base, 2);
    const end = T0 + 2 * H + 10 * 60_000;
    const one = settledTo(started, end);
    const fine = settledTo(started, end, 5_000);
    expect(one.officers[leaver]).toBeUndefined();
    expect(fine.officers[leaver]).toBeUndefined();
    expect(fine.department.funding).toBeCloseTo(one.department.funding, 3);
    expect(snapshot(fine)).toBe(snapshot(one));
  });
});

describe('finding 7: the final hour belongs to the people on the shift', () => {
  it('every case a shift opens, final boundary included, carries the shift roster', () => {
    let opened = 0;
    for (const seed of [7, 3, 11, 19, 23]) {
      const started = startShift(open(seed), 8);
      const roster = squadIds(started, 'A').sort();
      const s = settledTo(started, T0 + 9 * H);
      const shift = s.world.shifts[0];
      for (const id of shift.caseIds) {
        const c = s.world.cases.find((k) => k.id === id)!;
        expect([...c.officerIds].sort(), `seed ${seed} case ${id}`).toEqual(roster);
        opened++;
      }
      expect(shiftMembers(s, shift).map((o) => o.id).sort()).toEqual(roster);
    }
    expect(opened).toBeGreaterThan(0);
  });
});

describe('finding 8: the home district', () => {
  function foundedIn(districtId: 'harbor' | 'larkin'): GameState {
    let s = createInitialState(T0, 7);
    s.world.onboarding.stage = 'founding';
    s = run(s, { type: 'foundDepartment', name: 'Night Unit', districtId }, T0);
    s.department.level = 3;
    s.department.funding = 100_000;
    return s;
  }

  it('saves where the department was founded, and the save loads', () => {
    for (const home of ['harbor', 'larkin'] as const) {
      const s = foundedIn(home);
      expect(s.world.home).toBe(home);
      expect(deserialize(serialize(s, T0))).not.toBeNull();
    }
  });

  it('starts new hires at home and brings coverage back there, never to a closed district', () => {
    let s = foundedIn('harbor');
    s = run(s, { type: 'openDistrict', districtId: 'larkin' }, T0);
    s = run(s, { type: 'hirePatrol', profileId: patrolCandidates(s)[0].id }, T0);
    const staff = () => employedPatrol(s);
    const open = (id: string) => s.world.districts[id as 'harbor'].open;
    expect(staff()).toHaveLength(5);
    expect(staff().every((p) => patrolDistrict(s.world, p) === 'harbor')).toBe(true);
    s = run(s, { type: 'setDistrictCoverage', districtId: 'larkin', units: 3 }, T0);
    expect(s.world.districts.larkin.patrolUnits).toBe(3);
    s = run(s, { type: 'setDistrictCoverage', districtId: 'larkin', units: 0 }, T0);
    for (const p of staff()) expect(open(patrolDistrict(s.world, p)), p.id).toBe(true);
    expect(s.world.districts.harbor.patrolUnits).toBe(5);
    expect(s.world.districts.pike.patrolUnits).toBe(0);
  });

  it('refuses coverage in a closed district, and refuses to thin the home district', () => {
    const s = foundedIn('harbor');
    expect(refusal(s, { type: 'setDistrictCoverage', districtId: 'pike', units: 1 }, T0)).toMatch(/not open/);
    expect(refusal(s, { type: 'setDistrictCoverage', districtId: 'harbor', units: 1 }, T0)).toMatch(/district that needs them/);
  });
});
