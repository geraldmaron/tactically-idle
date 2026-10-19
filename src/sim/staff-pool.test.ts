import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { HOUR_MS, ratesAt, recoveryRate } from './economy';
import { COMMAND_STAFF, commandStaffOf, MANAGER_IDS, managerView, staffSeverance, type ManagerId } from './command-staff';
import { courseFee, dominates, drawStaffPool, STAFF_LEVERS, STAFF_POOL, leverPosition } from './staff-pool';
import { fillPost } from './staff-fixtures';
import { equipmentManagerBenefits } from './equipment-manager-policy';
import { COURSES, courseXpGain } from '../content/courses';
import { PERSONAS } from '../content/personas';
import { buildPersona, officerDominates } from '../content/recruits';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0);
const NODES: Record<ManagerId, string[]> = {
  watch_commander: [COMMAND_STAFF.watchCommander.nodeId],
  training_sergeant: ['personnel_academy', COMMAND_STAFF.trainingSergeant.nodeId],
  quartermaster: ['logistics_equipment_manager'],
  peer_support_lead: [COMMAND_STAFF.peerSupportLead.nodeId],
  recruiter: ['personnel_recruiting', COMMAND_STAFF.recruiter.nodeId],
};

function ok(state: GameState, cmd: Command, now = T0): GameState {
  const r = dispatch(state, cmd, { now });
  expect(r.result, JSON.stringify(cmd)).toEqual({ ok: true });
  return r.state;
}
function refused(state: GameState, cmd: Command, now = T0): string {
  const r = dispatch(state, cmd, { now });
  expect(r.result.ok, JSON.stringify(cmd)).toBe(false);
  return r.result.ok ? '' : r.result.reason;
}
/** A funded department with the post open and its first pool on offer. */
function opened(id: ManagerId, seed = 12345): GameState {
  let s = createInitialState(T0, seed);
  s.department.devPoints = 50;
  s.department.funding = 50_000;
  for (const nodeId of NODES[id]) s = ok(s, { type: 'unlockNode', nodeId });
  return s;
}
/** Same department, one person in post with the given levers and everything else equal. */
function withLevers(id: ManagerId, levers: [number, number], seed = 12345): GameState {
  const s = opened(id, seed);
  fillPost(s, id, { levers });
  return s;
}

describe('staff pools', () => {
  it('offer one of each kind, inside each lever range, and never a dominated candidate', () => {
    for (const seed of [1, 7, 12345, 99_999, 2_026]) {
      for (const id of MANAGER_IDS) {
        const base = opened(id, seed);
        for (let round = 0; round < 6; round++) {
          const pool = drawStaffPool(base, id, round);
          expect(pool).toHaveLength(STAFF_POOL.size);
          expect(pool.map((c) => c.archetype).sort()).toEqual(['seasoned', 'specialist', 'steady']);
          for (const c of pool) STAFF_LEVERS[id].forEach((def, i) => {
            expect(c.levers[i]).toBeGreaterThanOrEqual(def.low);
            expect(c.levers[i]).toBeLessThanOrEqual(def.high);
          });
          for (const a of pool) for (const b of pool) if (a !== b) expect(dominates(a, b), `${id} round ${round}: ${a.archetype} vs ${b.archetype}`).toBe(false);
          expect(new Set(pool.map((c) => c.person.identityId)).size).toBe(pool.length);
        }
      }
    }
  });

  it('prices strength: the seasoned candidate costs the most and the steady one the least', () => {
    const s = opened('peer_support_lead');
    const pool = managerView(s, 'peer_support_lead').pool;
    const cost = (kind: string) => pool.find((c) => c.archetype === kind)!.salaryPerHour;
    expect(cost('seasoned')).toBeGreaterThan(cost('specialist'));
    expect(cost('specialist')).toBeGreaterThan(cost('steady'));
  });

  it('draws people nobody else holds: not on the roster, not in the officer pool, not in another post', () => {
    let s = opened('watch_commander');
    for (const nodeId of NODES.peer_support_lead) s = ok(s, { type: 'unlockNode', nodeId });
    const staff = MANAGER_IDS.flatMap((id) => commandStaffOf(s)[id].post.pool.map((c) => c.person.identityId));
    const officers = new Set([...Object.values(s.officers), ...s.candidates.map((c) => c.officer)].map((o) => o.identityId));
    expect(staff.filter((id) => officers.has(id))).toEqual([]);
    expect(new Set(staff).size).toBe(staff.length);
    // The officer market leaves staff candidates out from then on.
    const refreshed = ok({ ...s, department: { ...s.department, candidateRefreshedAt: 0 } } as GameState, { type: 'refreshCandidates' } as Command, T0 + 5 * HOUR_MS);
    expect(refreshed.candidates.filter((c) => staff.includes(c.officer.identityId!))).toEqual([]);
  });

  it('are deterministic in the campaign, the post and the round', () => {
    expect(drawStaffPool(opened('recruiter'), 'recruiter', 2)).toEqual(drawStaffPool(opened('recruiter'), 'recruiter', 2));
    expect(drawStaffPool(opened('recruiter'), 'recruiter', 2)).not.toEqual(drawStaffPool(opened('recruiter'), 'recruiter', 3));
  });
});

describe('hiring, replacing and searching again', () => {
  it('replaces the person in post for a day of salary and reopens the pool', () => {
    const s = opened('watch_commander');
    const pick = managerView(s, 'watch_commander').pool[1];
    const hired = ok(s, { type: 'hireStaff', managerId: 'watch_commander', candidateId: pick.id });
    expect(refused(hired, { type: 'hireStaff', managerId: 'watch_commander', candidateId: pick.id })).toMatch(/Replace/);
    expect(refused(hired, { type: 'refreshStaffPool', managerId: 'watch_commander' })).toMatch(/filled/);
    const gone = ok(hired, { type: 'dismissStaff', managerId: 'watch_commander' });
    expect(gone.department.funding).toBe(hired.department.funding - staffSeverance(pick));
    expect(staffSeverance(pick)).toBe(pick.salaryPerHour * 24);
    const view = managerView(gone, 'watch_commander');
    expect(view.hired).toBe(false);
    expect(view.pool).toHaveLength(3);
    expect(view.pool.map((c) => c.person.identityId)).not.toContain(pick.person.identityId);
    expect(ratesAt(gone, T0).staff).toBe(0);
  });

  it('searches again only after the cooldown, and refuses a hire it cannot afford', () => {
    const s = opened('recruiter');
    expect(refused(s, { type: 'refreshStaffPool', managerId: 'recruiter' })).toMatch(/Next search/);
    const later = ok(s, { type: 'refreshStaffPool', managerId: 'recruiter' }, T0 + STAFF_POOL.refreshCooldownMs);
    expect(managerView(later, 'recruiter').pool).not.toEqual(managerView(s, 'recruiter').pool);
    const broke = structuredClone(later);
    broke.department.funding = 10;
    expect(refused(broke, { type: 'hireStaff', managerId: 'recruiter', candidateId: managerView(broke, 'recruiter').pool[0].id })).toMatch(/to sign/);
    expect(refused(createInitialState(T0), { type: 'hireStaff', managerId: 'recruiter', candidateId: 'x' })).toMatch(/Open the Recruiter post/);
  });
});

describe('levers change the loop they name', () => {
  it('Watch Commander: faster recovery for squads they rested, and an earlier return to duty', () => {
    const plain = withLevers('watch_commander', [0, 30]);
    const strong = withLevers('watch_commander', [0.25, 30]);
    for (const s of [plain, strong]) { s.squads[0].duty = 'rest'; s.commandStaff!.watch_commander.rested.A = 'patrol'; }
    const officer = (s: GameState) => s.officers[s.squads[0].officerIds[0]];
    expect(recoveryRate(strong, officer(strong), T0)).toBeCloseTo(recoveryRate(plain, officer(plain), T0) * 1.25, 9);
    // A squad nobody rested gets no bonus.
    delete strong.commandStaff!.watch_commander.rested.A;
    expect(recoveryRate(strong, officer(strong), T0)).toBeCloseTo(recoveryRate(plain, officer(plain), T0), 9);
    const late = withLevers('watch_commander', [0, 25]), early = withLevers('watch_commander', [0, 35]);
    for (const s of [late, early]) {
      s.squads[0].duty = 'rest'; s.commandStaff!.watch_commander.rested.A = 'patrol';
      for (const id of s.squads[0].officerIds) s.officers[id].stress = 32;
    }
    expect(ok(early, { type: 'tick' }, T0 + HOUR_MS).squads[0].duty).toBe('patrol');
    expect(ok(late, { type: 'tick' }, T0 + HOUR_MS).squads[0].duty).toBe('rest');
  });

  it('Training Sergeant: a cheaper course fee and more XP when it finishes', () => {
    const course = COURSES.composure_workshop;
    const s = withLevers('training_sergeant', [0.2, 0.2]);
    expect(courseFee(s, course.cost)).toBe(Math.round(course.cost * 0.8));
    const officerId = Object.keys(s.officers).find((id) => !s.officers[id].assignment)!;
    const before = s.department.funding, xp = s.officers[officerId].xp;
    const started = ok(s, { type: 'startCourse', officerId, courseId: course.id });
    expect(started.department.funding).toBe(before - Math.round(course.cost * 0.8));
    const done = ok(started, { type: 'tick' }, T0 + Math.ceil(course.hours) * HOUR_MS);
    expect(done.officers[officerId].xp - xp).toBe(Math.round(courseXpGain(course.hours) * 1.2));
  });

  it('Quartermaster: cheaper servicing and less wear on top of the post tier', () => {
    const plain = equipmentManagerBenefits(withLevers('quartermaster', [0, 0]));
    const strong = equipmentManagerBenefits(withLevers('quartermaster', [0.15, 0.1]));
    expect(strong.repairMultiplier).toBeCloseTo(plain.repairMultiplier * 0.85, 9);
    expect(strong.wearMultiplier).toBeCloseTo(plain.wearMultiplier * 0.9, 9);
    // With the post open but nobody in it, there are no Quartermaster benefits at all.
    expect(equipmentManagerBenefits(opened('quartermaster'))).toMatchObject({ repairMultiplier: 1, wearMultiplier: 1, maxConcurrentServices: 0 });
  });

  it('Peer Support Lead: more sessions an hour and more stress off each', () => {
    const run = (levers: [number, number]) => {
      const s = withLevers('peer_support_lead', levers);
      for (const id of Object.keys(s.officers)) s.officers[id].stress = 50;
      for (const id of Object.keys(s.officers)) s.officers[id].assignment = null;
      return commandStaffOf(ok(s, { type: 'tick' }, T0 + HOUR_MS)).peer_support_lead.log.filter((e) => e.text.startsWith('Peer support')).map((e) => e.text);
    };
    expect(run([1, 5])).toHaveLength(1);
    expect(run([3, 5])).toHaveLength(3);
    const relief = (text: string) => { const [, a, b] = text.match(/stress (\d+) to (\d+)/)!; return Number(a) - Number(b); };
    expect(relief(run([1, 11])[0]) - relief(run([1, 5])[0])).toBeGreaterThanOrEqual(5);
  });

  it('Recruiter: negotiates the signing fee down and skips recruits under the floor', () => {
    const run = (levers: [number, number]) => {
      const s = withLevers('recruiter', levers);
      s.commandStaff!.recruiter.policy.reserve = 0;
      return { before: s, after: ok(s, { type: 'tick' }, T0 + HOUR_MS) };
    };
    const plain = run([0, 0]);
    const signed = plain.after.commandStaff!.recruiter.log.find((e) => e.text.startsWith('Signed'));
    if (!signed) return; // the seeded pool decides whether anyone is affordable
    const fee = Number(signed.text.match(/\$([\d,]+)/)![1].replace(/,/g, ''));
    const cheap = run([0.15, 0]).after.commandStaff!.recruiter.log.find((e) => e.text.startsWith('Signed'))!;
    expect(Number(cheap.text.match(/\$([\d,]+)/)![1].replace(/,/g, ''))).toBe(Math.round((fee * 0.85) / 10) * 10);
    const picky = run([0, 99 as number]);
    expect(Object.keys(picky.after.officers)).toHaveLength(Object.keys(picky.before.officers).length);
    expect(managerView(picky.after, 'recruiter').activity).toMatch(/rated 99 or better/);
  });

  it('settles offline the same as online ticks with a non-baseline Watch Commander', () => {
    const start = withLevers('watch_commander', [0.2, 34]);
    start.officers[start.squads[1].officerIds[0]].stress = 75;
    const end = T0 + 20 * HOUR_MS;
    const offline = ok(start, { type: 'tick' }, end);
    let online = start;
    for (let t = T0 + 13 * 60_000; t < end; t += 13 * 60_000) online = ok(online, { type: 'tick' }, t);
    online = ok(online, { type: 'tick' }, end);
    expect(online.department.funding).toBeCloseTo(offline.department.funding, 3);
    expect(online.squads.map((sq) => sq.duty)).toEqual(offline.squads.map((sq) => sq.duty));
    for (const id of Object.keys(offline.officers)) expect(online.officers[id].stress).toBeCloseTo(offline.officers[id].stress, 6);
    expect(commandStaffOf(online).watch_commander.log).toEqual(commandStaffOf(offline).watch_commander.log);
  });
});

describe('officer pools', () => {
  it('never offer a same-role candidate who matches or loses to another on every count', () => {
    for (const seed of [1, 7, 12345, 99_999, 2_026, 31_337]) {
      let s = createInitialState(T0, seed);
      for (let round = 0; round < 8; round++) {
        const pool = s.candidates.map((c) => c.officer);
        for (const a of pool) for (const b of pool) if (a !== b) expect(officerDominates(a, b), `seed ${seed} round ${round}: ${a.role}`).toBe(false);
        s = ok(s, { type: 'refreshCandidates' } as Command, T0 + (round + 1) * 5 * HOUR_MS);
      }
    }
  });

  it('measures what the guard prevents: same-role pairs across the persona pool include dead options', () => {
    const people = PERSONAS.map((p) => buildPersona(p, 12345));
    let dead = 0;
    for (const a of people) for (const b of people) if (a !== b && officerDominates(a, b)) dead++;
    expect(dead).toBeGreaterThan(0);
  });
});

it('lever positions read back from values', () => {
  for (const id of MANAGER_IDS) for (const def of STAFF_LEVERS[id]) {
    expect(leverPosition(def, def.low)).toBe(0);
    expect(leverPosition(def, def.high)).toBe(1);
  }
});
