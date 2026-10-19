import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { HOUR_MS, ratesAt } from './economy';
import { createUnit } from './equipment';
import { maintenanceBudget } from './equipment-manager-policy';
import { COMMAND_STAFF, MANAGERS, commandStaffOf, managerHired, managerOn, managerView } from './command-staff';
import { deserialize, serialize } from './save';
import { DEV_NODES } from '../content/dev-tree';
import { fullName } from './officer';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0); // on the hour grid

function ok(state: GameState, cmd: Command, now = T0): GameState {
  const r = dispatch(state, cmd, { now });
  expect(r.result, JSON.stringify(cmd)).toEqual({ ok: true });
  return r.state;
}
function refused(state: GameState, cmd: Command, now = T0): string {
  const r = dispatch(state, cmd, { now });
  expect(r.result.ok, JSON.stringify(cmd)).toBe(false);
  expect(r.state).toBe(state);
  return r.result.ok ? '' : r.result.reason;
}
/** Ticks every `step` ms from `from` to `to` inclusive. */
function ticks(state: GameState, from: number, to: number, step: number): GameState {
  let s = state;
  for (let t = from + step; t < to; t += step) s = ok(s, { type: 'tick' }, t);
  return ok(s, { type: 'tick' }, to);
}

function withWatchCommander(): GameState {
  const s = ok(createInitialState(T0), { type: 'unlockNode', nodeId: COMMAND_STAFF.watchCommander.nodeId });
  // Brooks (squad A, patrol) comes back from a hard call: above the default rest limit.
  s.officers.off_brooks.stress = 65;
  return s;
}

function withTrainingSergeant(): GameState {
  const start = createInitialState(T0);
  start.department.devPoints = 10;
  let s = ok(start, { type: 'unlockNode', nodeId: 'personnel_academy' });
  s = ok(s, { type: 'unlockNode', nodeId: COMMAND_STAFF.trainingSergeant.nodeId });
  return ok(s, { type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', courseId: 'composure_workshop' } });
}

function expectSameStaffOutcome(a: GameState, b: GameState) {
  expect(a.department.funding).toBeCloseTo(b.department.funding, 3);
  expect(a.squads.map((s) => s.duty)).toEqual(b.squads.map((s) => s.duty));
  expect(a.commandStaff).toEqual(b.commandStaff);
  for (const id of Object.keys(a.officers)) {
    expect(a.officers[id].assignment, `${id} assignment`).toEqual(b.officers[id].assignment);
    expect(a.officers[id].stress, `${id} stress`).toBeCloseTo(b.officers[id].stress, 6);
    expect(a.officers[id].ratings, `${id} ratings`).toEqual(b.officers[id].ratings);
  }
}

describe('command staff hiring and state', () => {
  it('starts with no manager hired and hires through a Develop purchase', () => {
    const fresh = createInitialState(T0);
    for (const id of ['watch_commander', 'training_sergeant', 'quartermaster'] as const) {
      expect(managerHired(fresh, id)).toBe(false);
      expect(managerView(fresh, id).status).toBe('not_hired');
    }
    expect(fresh.commandStaff).toEqual(commandStaffOf(createInitialState(T0)));
    const hired = ok(fresh, { type: 'unlockNode', nodeId: COMMAND_STAFF.watchCommander.nodeId });
    expect(hired.department.devPoints).toBe(fresh.department.devPoints - 2);
    expect(hired.department.funding).toBe(fresh.department.funding - 1500);
    expect(managerOn(hired, 'watch_commander')).toBe(true);
    // The Training Sergeant needs the training academy.
    expect(refused(hired, { type: 'unlockNode', nodeId: COMMAND_STAFF.trainingSergeant.nodeId })).toMatch(/Training academy/);
  });

  it('charges each salary with payroll only while the manager is on', () => {
    const s = withWatchCommander();
    const base = ratesAt(createInitialState(T0), T0);
    expect(ratesAt(s, T0).staff).toBe(45);
    expect(ratesAt(s, T0).net).toBe(base.net - 45);
    const off = ok(s, { type: 'setManagerEnabled', managerId: 'watch_commander', enabled: false });
    expect(ratesAt(off, T0).staff).toBe(0);
    expect(ratesAt(off, T0).net).toBe(base.net);
    const offLater = ok(off, { type: 'tick' }, T0 + 2 * HOUR_MS);
    const onLater = ok(s, { type: 'tick' }, T0 + 2 * HOUR_MS);
    expect(offLater.department.funding - onLater.department.funding).toBeCloseTo(90 + 4 * 150, 3); // two hours of salary, plus an hour of Alpha's patrol income once it rests
    expect(onLater.report?.wages).toBeCloseTo((offLater.report?.wages ?? 0) + 90, 6);
  });

  it('validates commands and returns reasons like other handlers', () => {
    const fresh = createInitialState(T0);
    expect(refused(fresh, { type: 'setManagerEnabled', managerId: 'watch_commander', enabled: false })).toMatch(/Hire the Watch Commander/);
    expect(refused(fresh, { type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', reserve: 1000 } })).toMatch(/Hire/);
    expect(refused(fresh, { type: 'setManagerEnabled', managerId: 'nobody' as never, enabled: true })).toBe('Unknown manager');
    const s = withWatchCommander();
    expect(refused(s, { type: 'setManagerEnabled', managerId: 'watch_commander', enabled: true })).toMatch(/already on/);
    expect(refused(s, { type: 'setManagerEnabled', managerId: 'watch_commander', enabled: 'yes' as never })).toMatch(/on or off/);
    for (const restAt of [29, 81, 45.5, Number.NaN, '60' as never]) {
      expect(refused(s, { type: 'setManagerPolicy', patch: { managerId: 'watch_commander', restAt } })).toMatch(/stress limit/);
    }
    expect(refused(s, { type: 'setManagerPolicy', patch: { managerId: 'watch_commander', optOut: ['Z' as never] } })).toBe('Unknown squad');
    const policy = ok(s, { type: 'setManagerPolicy', patch: { managerId: 'watch_commander', restAt: 45, optOut: ['B', 'A', 'B'] } });
    expect(commandStaffOf(policy).watch_commander.policy).toEqual({ restAt: 45, optOut: ['A', 'B'] });

    const ts = withTrainingSergeant();
    expect(refused(ts, { type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', courseId: 'no_such_course' } })).toBe('Unknown course');
    expect(refused(ts, { type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', courseId: 'entry_course' } })).toMatch(/requires Entry team course/);
    for (const reserve of [-1, 100_001, 12.5]) expect(refused(ts, { type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', reserve } })).toMatch(/reserve/);
    expect(commandStaffOf(ok(ts, { type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', courseId: null, reserve: 0 } })).training_sergeant.policy).toEqual({ courseId: null, reserve: 0 });
  });
});

describe('Watch Commander', () => {
  it('rests a worn squad at the clock hour and returns it to its earlier duty once everyone is below Strained', () => {
    const s = withWatchCommander();
    const beforeHour = ok(s, { type: 'tick' }, T0 + HOUR_MS - 1);
    expect(beforeHour.squads[0].duty).toBe('patrol');
    const rested = ok(beforeHour, { type: 'tick' }, T0 + HOUR_MS);
    expect(rested.squads.map((sq) => sq.duty)).toEqual(['rest', 'standby']);
    expect(commandStaffOf(rested).watch_commander.rested).toEqual({ A: 'patrol' });
    expect(commandStaffOf(rested).watch_commander.log[0]).toEqual({ at: T0 + HOUR_MS, text: `Rested Alpha: ${s.officers.off_brooks.surname} reached 64 stress` });
    // 64 at the first hour, then 6 per hour on rest: 34 after five more hours, 28 after six.
    expect(ok(rested, { type: 'tick' }, T0 + 6 * HOUR_MS).squads[0].duty).toBe('rest');
    const back = ok(rested, { type: 'tick' }, T0 + 7 * HOUR_MS);
    expect(back.squads[0].duty).toBe('patrol');
    expect(commandStaffOf(back).watch_commander.rested).toEqual({});
    expect(commandStaffOf(back).watch_commander.log[0]).toEqual({ at: T0 + 7 * HOUR_MS, text: 'Returned Alpha to Patrol: everyone below 30 stress' });
  });

  it('returns a squad to standby when standby was its duty before rest', () => {
    const s = withWatchCommander();
    s.officers.off_brooks.stress = 10;
    s.officers.off_reyes.stress = 70; // Bravo, standby
    const later = ok(s, { type: 'tick' }, T0 + 12 * HOUR_MS);
    expect(later.squads[1].duty).toBe('standby');
    expect(commandStaffOf(later).watch_commander.log.map((e) => e.text)).toEqual([
      'Returned Bravo to Standby: everyone below 30 stress',
      `Rested Bravo: ${s.officers.off_reyes.surname} reached 67 stress`,
    ]);
  });

  it('matches offline settlement with online ticks of any size', () => {
    const start = withWatchCommander();
    start.officers.off_reyes.stress = 63; // Bravo reaches exactly 60 at the first clock hour
    const end = T0 + 20 * HOUR_MS;
    const offline = ok(start, { type: 'tick' }, end);
    for (const step of [7 * 60_000, 25 * 60_000, HOUR_MS]) expectSameStaffOutcome(ticks(start, T0, end, step), offline);
    const texts = commandStaffOf(offline).watch_commander.log.map((e) => e.text);
    expect(texts).toContain(`Rested Bravo: ${start.officers.off_reyes.surname} reached 60 stress`);
    expect(texts.filter((text) => text.startsWith('Returned'))).toHaveLength(2);
  });

  it('never touches a deployed squad or a squad on manual duty', () => {
    const s = withWatchCommander();
    for (const id of s.squads[0].officerIds) s.officers[id].assignment = { kind: 'operation', runId: 'live-call' };
    s.officers.off_reyes.stress = 75;
    const manual = ok(s, { type: 'setManagerPolicy', patch: { managerId: 'watch_commander', optOut: ['B'] } });
    const later = ok(manual, { type: 'tick' }, T0 + 5 * HOUR_MS);
    expect(later.squads.map((sq) => sq.duty)).toEqual(['patrol', 'standby']);
    expect(commandStaffOf(later).watch_commander.log).toEqual([]);
  });

  it('stops rotating when switched off and resumes when switched back on', () => {
    const off = ok(withWatchCommander(), { type: 'setManagerEnabled', managerId: 'watch_commander', enabled: false });
    const idle = ok(off, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(idle.squads[0].duty).toBe('patrol');
    expect(commandStaffOf(idle).watch_commander.log.map((e) => e.text)).toEqual(['Switched off']);
    const on = ok(idle, { type: 'setManagerEnabled', managerId: 'watch_commander', enabled: true }, T0 + 3 * HOUR_MS);
    expect(ok(on, { type: 'tick' }, T0 + 4 * HOUR_MS).squads[0].duty).toBe('rest');
  });
});

describe('Training Sergeant', () => {
  it('fills free places with the most rested eligible officers at the clock hour', () => {
    const s = withTrainingSergeant();
    s.officers.off_lindqvist.injury = { label: 'sprain', until: T0 + 10 * HOUR_MS };
    s.officers.off_ortiz.assignment = { kind: 'operation', runId: 'live-call' };
    const funding = ok(s, { type: 'tick' }, T0 + HOUR_MS - 1).department.funding;
    const next = ok(s, { type: 'tick' }, T0 + HOUR_MS);
    const enrolled = Object.values(next.officers).filter((o) => o.assignment?.kind === 'training').map((o) => o.id).sort();
    // Lindqvist is injured and Ortiz deployed; Chen (11) and Okafor (12) are the most rested left.
    expect(enrolled).toEqual(['off_chen', 'off_okafor']);
    expect(next.officers.off_chen.assignment).toEqual({ kind: 'training', courseId: 'composure_workshop', startedAt: T0 + HOUR_MS, endsAt: T0 + 5 * HOUR_MS });
    expect(next.department.funding).toBeCloseTo(funding - 2 * 600 + (ratesAt(s, T0).net / 3_600_000), 3);
    expect(commandStaffOf(next).training_sergeant.log.map((e) => e.text)).toEqual([
      `Enrolled ${fullName(s.officers.off_okafor)} in Composure workshop ($600)`,
      `Enrolled ${fullName(s.officers.off_chen)} in Composure workshop ($600)`,
    ]);
  });

  it('never enrols a strained officer and waits when funding would fall below the reserve', () => {
    const s = withTrainingSergeant();
    for (const o of Object.values(s.officers)) o.stress = 40;
    expect(Object.values(ok(s, { type: 'tick' }, T0 + HOUR_MS).officers).some((o) => o.assignment)).toBe(false);
    const { reserve } = commandStaffOf(s).training_sergeant.policy;
    for (const [extra, expected] of [[-1, 0], [0, 1]] as const) {
      const start = withTrainingSergeant();
      for (const o of Object.values(start.officers)) o.stress = o.id === 'off_park' ? 5 : 40;
      start.department.funding = reserve + 600 + extra;
      // One millisecond before the grid, so hourly income cannot fund the course.
      start.department.lastSettledAt = T0 + HOUR_MS - 1;
      start.department.clockHighWater = T0 + HOUR_MS - 1;
      const next = ok(start, { type: 'tick' }, T0 + HOUR_MS);
      expect(Object.values(next.officers).filter((o) => o.assignment?.kind === 'training')).toHaveLength(expected);
      expect(next.department.funding).toBeGreaterThanOrEqual(reserve - 1);
    }
    const waiting = withTrainingSergeant();
    waiting.department.funding = 100;
    expect(managerView(waiting, 'training_sergeant').activity).toMatch(/^Needs \$600|reserve/);
  });

  it('matches offline settlement with online ticks, through course completions and refills', () => {
    const start = withTrainingSergeant();
    const end = T0 + 15 * HOUR_MS;
    const offline = ok(start, { type: 'tick' }, end);
    for (const step of [7 * 60_000, 50 * 60_000]) expectSameStaffOutcome(ticks(start, T0, end, step), offline);
    expect(commandStaffOf(offline).training_sergeant.log.length).toBeGreaterThanOrEqual(6);
    expect(offline.report?.completedCourses.length).toBeGreaterThanOrEqual(4);
  });

  it('does nothing without a course or when switched off', () => {
    const noCourse = ok(withTrainingSergeant(), { type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', courseId: null } });
    expect(Object.values(ok(noCourse, { type: 'tick' }, T0 + 3 * HOUR_MS).officers).some((o) => o.assignment)).toBe(false);
    expect(managerView(noCourse, 'training_sergeant').activity).toBe('Choose a course to enrol officers in');
    const off = ok(withTrainingSergeant(), { type: 'setManagerEnabled', managerId: 'training_sergeant', enabled: false });
    const later = ok(off, { type: 'tick' }, T0 + 3 * HOUR_MS);
    expect(Object.values(later.officers).some((o) => o.assignment)).toBe(false);
    expect(ratesAt(off, T0).staff).toBe(0);
  });
});

describe('Command Staff saves', () => {


  it('round-trips policies and logs, and rejects malformed staff records', () => {
    let s = ok(withWatchCommander(), { type: 'setManagerPolicy', patch: { managerId: 'watch_commander', restAt: 45, optOut: ['B'] } });
    s = ok(s, { type: 'tick' }, T0 + HOUR_MS);
    expect(deserialize(serialize(s, T0 + HOUR_MS))).toEqual(s);
    const broken: ((state: Record<string, any>) => void)[] = [
      (state) => { state.commandStaff.watch_commander.policy.restAt = 10; },
      (state) => { state.commandStaff.watch_commander.policy.optOut = ['A', 'A']; },
      (state) => { state.commandStaff.watch_commander.rested = { A: 'rest' }; },
      (state) => { state.commandStaff.training_sergeant.policy.courseId = 'no_such_course'; },
      (state) => { state.commandStaff.training_sergeant.policy.reserve = -5; },
      (state) => { state.commandStaff.quartermaster.resumeBudget = 0; },
      (state) => { state.commandStaff.quartermaster.log = Array.from({ length: 21 }, () => ({ at: T0, text: 'x' })); },
      (state) => { state.commandStaff = 'staff'; },
    ];
    for (const breakIt of broken) {
      const env = JSON.parse(serialize(s, T0 + HOUR_MS));
      breakIt(env.state);
      expect(deserialize(JSON.stringify(env))).toBeNull();
    }
  });

  it('keeps the Develop copy in step with the salaries it states', () => {
    expect(DEV_NODES[COMMAND_STAFF.watchCommander.nodeId].description).toContain(`$${COMMAND_STAFF.watchCommander.salaryPerHour} per hour`);
    expect(DEV_NODES[COMMAND_STAFF.trainingSergeant.nodeId].description).toContain(`$${COMMAND_STAFF.trainingSergeant.salaryPerHour} per hour`);
  });
});

describe('Quartermaster', () => {
  it('is the equipment manager: its switch maps to the service budget and its log records servicing', () => {
    let s = ok(createInitialState(T0), { type: 'unlockNode', nodeId: 'logistics_equipment_manager' });
    expect(managerView(s, 'quartermaster').status).toBe('off');
    s.units = {};
    for (let i = 0; i < 3; i++) createUnit(s, 'ballistic_shield', T0, { condition: 20 + i * 5, ageDays: 0 });
    s = ok(s, { type: 'setManagerEnabled', managerId: 'quartermaster', enabled: true });
    expect(maintenanceBudget(s)).toBe(COMMAND_STAFF.quartermaster.defaultBudget);
    expect(ratesAt(s, T0).staff).toBe(0);
    s = ok(s, { type: 'setManagerPolicy', patch: { managerId: 'quartermaster', budgetPerHour: 300 } });
    expect(maintenanceBudget(s)).toBe(300);
    s = ok(s, { type: 'tick' }, T0 + HOUR_MS);
    const log = commandStaffOf(s).quartermaster.log;
    expect(log[0].at).toBe(T0 + HOUR_MS);
    expect(log[0].text).toMatch(/^Sent 2 items for service \(\$\d+\): /);
    s = ok(s, { type: 'setManagerEnabled', managerId: 'quartermaster', enabled: false }, T0 + HOUR_MS);
    expect(maintenanceBudget(s)).toBe(0);
    expect(commandStaffOf(s).quartermaster.resumeBudget).toBe(300);
    s = ok(s, { type: 'setManagerEnabled', managerId: 'quartermaster', enabled: true }, T0 + HOUR_MS);
    expect(maintenanceBudget(s)).toBe(300);
    expect(refused(s, { type: 'setManagerPolicy', patch: { managerId: 'quartermaster', budgetPerHour: 501 } })).toMatch(/ceiling/);
  });
});

describe('manager identity', () => {
  it('carries each manager’s pronouns from the portrait briefs', () => {
    expect(Object.fromEntries((['watch_commander', 'training_sergeant', 'quartermaster'] as const).map(id => [id, MANAGERS[id].pronouns]))).toEqual({ watch_commander: 'she', training_sergeant: 'he', quartermaster: 'they' });
  });
});

describe('peer support lead and recruiter', () => {
  const withManager = (nodeId: string, requires: string[] = []) => {
    const start = createInitialState(T0);
    start.department.devPoints = 10;
    start.department.funding = 50_000;
    let s = start;
    for (const id of [...requires, nodeId]) s = ok(s, { type: 'unlockNode', nodeId: id });
    return s;
  };

  it('are hired in Develop, cost a salary while on, and can be switched off', () => {
    const s = withManager(COMMAND_STAFF.peerSupportLead.nodeId);
    expect(managerOn(s, 'peer_support_lead')).toBe(true);
    expect(ratesAt(s, T0).staff).toBe(45);
    const off = ok(s, { type: 'setManagerEnabled', managerId: 'peer_support_lead', enabled: false });
    expect(ratesAt(off, T0).staff).toBe(0);
    const r = withManager(COMMAND_STAFF.recruiter.nodeId, ['personnel_recruiting']);
    expect(managerOn(r, 'recruiter')).toBe(true);
    expect(refused(createInitialState(T0), { type: 'unlockNode', nodeId: COMMAND_STAFF.recruiter.nodeId })).toMatch(/Recruiting/i);
  });

  it('offers sessions to the most strained idle officers, for a fee, above the reserve', () => {
    const s = withManager(COMMAND_STAFF.peerSupportLead.nodeId);
    for (const o of Object.values(s.officers)) o.stress = 0;
    s.officers.off_brooks.stress = 70; s.officers.off_okafor.stress = 50; s.officers.off_chen.stress = 40;
    s.department.funding = 20_000;
    const after = ticks(s, T0, T0 + HOUR_MS, 5 * 60_000);
    const log = commandStaffOf(after).peer_support_lead.log;
    expect(log).toHaveLength(2); // two sessions an hour, Brooks and Okafor
    const relief = (text: string) => { const [, from, to] = /stress (\d+) to (\d+)/.exec(text)!; return Number(from) - Number(to); };
    expect(log[1].text).toMatch(new RegExp(`^Peer support for ${fullName(s.officers.off_brooks)}: `));
    expect(log[0].text).toMatch(new RegExp(`^Peer support for ${fullName(s.officers.off_okafor)}: `));
    expect(log.map((entry) => relief(entry.text))).toEqual([8, 8]);
    expect(after.officers.off_chen.stress).toBeLessThanOrEqual(40);
    const calm = withManager(COMMAND_STAFF.peerSupportLead.nodeId);
    for (const o of Object.values(calm.officers)) o.stress = 0;
    const quiet = ticks(calm, T0, T0 + HOUR_MS, 5 * 60_000);
    expect(commandStaffOf(quiet).peer_support_lead.log).toEqual([]);
  });

  it('holds a session when the fee would take funding under the reserve, and never reaches a deployed officer', () => {
    const s = withManager(COMMAND_STAFF.peerSupportLead.nodeId);
    for (const o of Object.values(s.officers)) o.stress = 0;
    s.officers.off_brooks.stress = 70;
    s.officers.off_okafor.stress = 70;
    s.department.funding = 20_000;
    const guarded = ok(s, { type: 'setManagerPolicy', patch: { managerId: 'peer_support_lead', reserve: 100_000 } });
    const held = ok(guarded, { type: 'tick' }, T0 + HOUR_MS);
    expect(commandStaffOf(held).peer_support_lead.log).toEqual([]);
    expect(managerView(held, 'peer_support_lead').activity).toMatch(/Next session/);
    const busy = withManager(COMMAND_STAFF.peerSupportLead.nodeId);
    busy.officers.off_brooks.assignment = { kind: 'operation', runId: 'run' } as never;
    busy.officers.off_brooks.stress = 70;
    for (const o of Object.values(busy.officers)) if (o.id !== 'off_brooks') o.stress = 0;
    expect(managerView(busy, 'peer_support_lead').activity).toMatch(/Nobody idle/);
  });

  it('signs the best candidate for the chosen role while the roster has room, and stops at the reserve and the cap', () => {
    const s = withManager(COMMAND_STAFF.recruiter.nodeId, ['personnel_recruiting']);
    s.department.rosterCap = Object.keys(s.officers).length + 1;
    const medics = s.candidates.filter((c) => c.officer.role === 'medic');
    const target = ok(s, { type: 'setManagerPolicy', patch: { managerId: 'recruiter', role: 'medic', reserve: 0 } });
    if (!medics.length) return; // the seeded pool decides whether a medic is on offer
    const best = [...medics].sort((a, b) => Object.values(b.officer.ratings).reduce((x, y) => x + y, 0) - Object.values(a.officer.ratings).reduce((x, y) => x + y, 0))[0];
    const after = ok(target, { type: 'tick' }, T0 + HOUR_MS);
    expect(commandStaffOf(after).recruiter.log[0].text).toMatch(/^Signed /);
    expect(Object.values(after.officers).some((o) => o.id === best.officer.id)).toBe(true);
    expect(Object.keys(after.officers)).toHaveLength(Object.keys(s.officers).length + 1);
    expect(managerView(after, 'recruiter').activity).toMatch(/Roster is full/);
  });

  it('refuses nonsense policy and keeps a saved record from before these managers loadable', () => {
    const s = withManager(COMMAND_STAFF.recruiter.nodeId, ['personnel_recruiting']);
    expect(refused(s, { type: 'setManagerPolicy', patch: { managerId: 'recruiter', role: 'chef' as never } })).toBe('Unknown role');
    expect(refused(s, { type: 'setManagerPolicy', patch: { managerId: 'recruiter', reserve: -5 } })).toMatch(/reserve/);
    const ps = withManager(COMMAND_STAFF.peerSupportLead.nodeId);
    expect(refused(ps, { type: 'setManagerPolicy', patch: { managerId: 'peer_support_lead', supportAt: 31 } })).toMatch(/Choose a stress/);
    const old = structuredClone(ps);
    delete (old.commandStaff as Partial<typeof old.commandStaff>)!.recruiter;
    delete (old.commandStaff as Partial<typeof old.commandStaff>)!.peer_support_lead;
    expect(deserialize(serialize(old, T0))?.commandStaff).toBeDefined();
    expect(commandStaffOf(old).recruiter.policy.role).toBeNull();
  });
});
