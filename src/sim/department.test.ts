import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { HOUR_MS, ratesAt } from './economy';
import { deployability } from './officer';
import {
  budget,
  courseOptions,
  nodeOptions,
  projectDismiss,
  projectHire,
  recoveryInfo,
  rosterOfficers,
  sortedCandidates,
  squadReadiness,
  storeOptions,
} from './department-selectors';
import { DEV_NODES } from '../content/dev-tree';
import { ownedCount } from './equipment';
import { ROSTER_TUNING } from './roster';
import type { Command, GameState } from './types';

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
  expect(r.state).toBe(state); // identical object: nothing mutated, nothing cloned in
  return r.result.ok ? '' : r.result.reason;
}

describe('starting state', () => {
  const s = createInitialState(T0);
  it('matches the fixed contract other agents rely on', () => {
    expect(s.department).toMatchObject({ name: 'Westhaven Department', funding: 12400, devPoints: 3, trust: 78, level: 3, rosterCap: 12, trainingSlots: 1 });
    expect(Object.keys(s.officers).sort()).toEqual(
      ['off_brooks', 'off_chen', 'off_lindqvist', 'off_okafor', 'off_ortiz', 'off_park', 'off_reyes', 'off_vale'].sort(),
    );
    expect(s.squads.map((q) => [q.id, q.name, q.duty, q.leaderId])).toEqual([
      ['A', 'Alpha', 'patrol', 'off_brooks'],
      ['B', 'Bravo', 'standby', 'off_okafor'],
    ]);
    expect(s.officers.off_reyes.certs).not.toContain('crisis_negotiation');
    expect(s.officers.off_reyes.stress).toBeGreaterThanOrEqual(30);
    expect(s.officers.off_reyes.stress).toBeLessThan(60);
    for (const o of Object.values(s.officers)) {
      expect(o.assignment).toBeNull();
      if (o.id !== 'off_reyes') expect(o.stress).toBeLessThanOrEqual(25);
    }
    expect(ownedCount(s, 'radio_kit')).toBe(6);
    expect(ownedCount(s, 'thermal_imager')).toBe(0);
    expect(s.candidates).toHaveLength(3);
  });
  it('is deterministic', () => {
    expect(createInitialState(T0)).toEqual(s);
  });
  it('opens with the illustrative budget', () => {
    const b = budget(s);
    expect(b).toMatchObject({ gross: 1200, wages: 380, operating: 120, supplies: 80, net: 620, devPointsPerHour: 0.25 });
  });
  it('gives every officer a distinct, uneven profile', () => {
    const profiles = Object.values(s.officers).map((o) => JSON.stringify(o.ratings));
    expect(new Set(profiles).size).toBe(8);
    for (const o of Object.values(s.officers)) {
      const vals = Object.values(o.ratings);
      expect(Math.min(...vals)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...vals)).toBeLessThanOrEqual(100);
      expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(10);
    }
  });
});

describe('hiring and dismissal', () => {
  it('hire deducts the displayed signing cost and changes wages once', () => {
    const s = createInitialState(T0);
    const cand = s.candidates[0];
    const p = projectHire(s, cand.id);
    expect(p.ok).toBe(true);
    expect(p.upfront).toBe(cand.signingCost);
    expect(p.wageDelta).toBe(cand.officer.wage);
    const next = ok(s, { type: 'hire', candidateId: cand.id }, T0);
    expect(next.department.funding).toBe(s.department.funding - cand.signingCost);
    expect(budget(next).wages).toBe(budget(s).wages + cand.officer.wage);
    expect(budget(next).net).toBeCloseTo(p.netAfter, 6);
    expect(next.officers[cand.officer.id].squadId).toBeNull();
    expect(next.officers[cand.officer.id].assignment).toBeNull();
    expect(next.candidates.find((c) => c.id === cand.id)).toBeUndefined();
    // The same candidate cannot be hired twice.
    refused(next, { type: 'hire', candidateId: cand.id }, T0);
  });

  it('refuses an unaffordable hire with a reason and leaves state unchanged', () => {
    const s = createInitialState(T0);
    s.department.funding = 100;
    const reason = refused(s, { type: 'hire', candidateId: s.candidates[0].id }, T0);
    expect(reason).toMatch(/Signing cost/);
    expect(projectHire(s, s.candidates[0].id).ok).toBe(false);
  });

  it('refuses a hire when the roster is full', () => {
    const s = createInitialState(T0);
    s.department.rosterCap = 8;
    expect(refused(s, { type: 'hire', candidateId: s.candidates[0].id }, T0)).toMatch(/Roster is full/);
  });

  it('refuses a hire that would create a recurring deficit', () => {
    const s = createInitialState(T0);
    s.department.funding = 50_000;
    for (const o of Object.values(s.officers)) o.wage = 150; // net becomes negative-leaning
    const net = ratesAt(s, T0).net;
    expect(net).toBeLessThan(s.candidates[0].officer.wage);
    expect(refused(s, { type: 'hire', candidateId: s.candidates[0].id }, T0)).toMatch(/short once wages are paid/);
  });

  it('dismissal applies previewed severance once and removes the officer', () => {
    const s = createInitialState(T0);
    const p = projectDismiss(s, 'off_reyes', T0);
    expect(p.ok).toBe(true);
    expect(p.upfront).toBe(8 * s.officers.off_reyes.wage);
    const next = ok(s, { type: 'dismiss', officerId: 'off_reyes' }, T0);
    expect(next.officers.off_reyes).toBeUndefined();
    expect(next.department.funding).toBe(s.department.funding - p.upfront);
    expect(next.squads.find((q) => q.id === 'B')?.officerIds).not.toContain('off_reyes');
    expect(budget(next).wages).toBe(budget(s).wages - 44);
    refused(next, { type: 'dismiss', officerId: 'off_reyes' }, T0);
  });

  it('dismissing a leader never leaves a dangling leader id', () => {
    const s = ok(createInitialState(T0), { type: 'dismiss', officerId: 'off_brooks' }, T0);
    const alpha = s.squads.find((q) => q.id === 'A')!;
    expect(alpha.leaderId === null || alpha.officerIds.includes(alpha.leaderId)).toBe(true);
    expect(alpha.officerIds).not.toContain('off_brooks');
  });

  it('refuses to dismiss a deployed officer and leaves state unchanged', () => {
    const s = createInitialState(T0);
    s.officers.off_chen.assignment = { kind: 'operation', runId: 'run_1' };
    expect(refused(s, { type: 'dismiss', officerId: 'off_chen' }, T0)).toMatch(/deployed/);
    expect(projectDismiss(s, 'off_chen', T0).ok).toBe(false);
  });

  it('dismissed officers never return to the candidate pool', () => {
    let s = ok(createInitialState(T0), { type: 'dismiss', officerId: 'off_reyes' }, T0);
    let t = T0;
    for (let i = 0; i < 6; i++) {
      t += 5 * HOUR_MS;
      s = ok(s, { type: 'refreshCandidates' }, t);
      expect(s.candidates.map((c) => c.officer.id)).not.toContain('off_reyes');
      expect(s.candidates.map((c) => c.officer.surname)).not.toContain('Reyes');
    }
  });

  it('condition survives hiring and squad moves', () => {
    let s = createInitialState(T0);
    s = ok(s, { type: 'hire', candidateId: s.candidates[0].id }, T0);
    const hired = Object.values(s.officers).find((o) => !['A', 'B'].includes(o.squadId ?? ''))!;
    const before = hired.stress;
    s = ok(s, { type: 'createSquad', name: 'Charlie' }, T0);
    s = ok(s, { type: 'assignToSquad', officerId: hired.id, squadId: 'C' }, T0);
    expect(s.officers[hired.id].stress).toBe(before);
  });
});

describe('candidates', () => {
  it('shortlisted candidates sort first and survive a refresh', () => {
    let s = createInitialState(T0);
    const keep = s.candidates[2];
    s = ok(s, { type: 'shortlist', candidateId: keep.id, on: true }, T0);
    expect(sortedCandidates(s)[0].id).toBe(keep.id);
    s = ok(s, { type: 'refreshCandidates' }, T0);
    expect(s.candidates.map((c) => c.id)).toContain(keep.id);
    expect(s.candidates).toHaveLength(3);
    expect(s.candidates.filter((c) => c.id !== keep.id).every((c) => !c.shortlisted)).toBe(true);
  });

  it('is rate limited with the time remaining, and has no paid path', () => {
    let s = ok(createInitialState(T0), { type: 'refreshCandidates' }, T0);
    const reason = refused(s, { type: 'refreshCandidates' }, T0 + HOUR_MS);
    expect(reason).toMatch(/3h/);
    const before = s.department.funding;
    s = ok(s, { type: 'refreshCandidates' }, T0 + 4 * HOUR_MS);
    // A search costs nothing: funding only moved through four hours of income.
    expect(s.department.funding).toBeCloseTo(before + 4 * 620, 3);
  });

  it('targetRole guarantees that role and is deterministic from rngState', () => {
    const a = ok(createInitialState(T0), { type: 'refreshCandidates', targetRole: 'medic' }, T0);
    const b = ok(createInitialState(T0), { type: 'refreshCandidates', targetRole: 'medic' }, T0);
    expect(a.candidates).toEqual(b.candidates);
    expect(a.candidates.some((c) => c.officer.role === 'medic')).toBe(true);
  });

  it('candidates show wage, signing cost, ratings, traits, certs and expiry', () => {
    for (const c of createInitialState(T0).candidates) {
      expect(c.officer.wage).toBeGreaterThanOrEqual(38);
      expect(c.officer.wage).toBeLessThanOrEqual(62);
      expect(c.signingCost).toBeGreaterThan(c.officer.wage);
      expect(c.expiresAt).toBeGreaterThan(T0);
      expect(c.officer.squadId).toBeNull();
      expect(c.officer.assignment).toBeNull();
    }
  });

  it('unshortlisted candidates expire; shortlisted ones stay', () => {
    let s = createInitialState(T0);
    s = ok(s, { type: 'shortlist', candidateId: s.candidates[0].id, on: true }, T0);
    const keep = s.candidates[0].id;
    s = ok(s, { type: 'tick' }, T0 + 49 * HOUR_MS);
    expect(s.candidates.map((c) => c.id)).toEqual([keep]);
  });
});

describe('squads', () => {
  it('creates C and D, refuses a 5th with a visible reason, and keeps ids unique', () => {
    let s = createInitialState(T0);
    s = ok(s, { type: 'createSquad', name: 'Charlie' }, T0);
    expect(s.squads.map((q) => q.id)).toEqual(['A', 'B', 'C']);
    expect(refused(s, { type: 'createSquad', name: '   ' }, T0)).toMatch(/at least 1/);
    s = ok(s, { type: 'createSquad', name: 'Delta' }, T0);
    expect(s.squads.map((q) => q.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(new Set(s.squads.map((q) => q.id)).size).toBe(4);
    expect(refused(s, { type: 'createSquad', name: 'Echo' }, T0)).toMatch(/All 4 squad slots are in use/);
    // Deleting nothing is possible; the refusal leaves the state untouched.
    expect(dispatch(s, { type: 'createSquad', name: 'Echo' }, { now: T0 }).state).toBe(s);
  });

  it('squad D takes members, leader, duty and readiness like any other squad', () => {
    let s = createInitialState(T0);
    s = ok(s, { type: 'createSquad', name: 'Charlie' }, T0);
    s = ok(s, { type: 'createSquad', name: 'Delta' }, T0);
    expect(squadReadiness(s, 'D', T0)).toMatchObject({ squadId: 'D', ready: 0, total: 0, deployable: false });
    s = ok(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: 'D' }, T0);
    s = ok(s, { type: 'setSquadDuty', squadId: 'D', duty: 'rest' }, T0);
    s = ok(s, { type: 'renameSquad', squadId: 'D', name: 'Night Shift' }, T0);
    expect(s.officers.off_chen.squadId).toBe('D');
    const d = s.squads.find((q) => q.id === 'D')!;
    expect(d).toMatchObject({ name: 'Night Shift', leaderId: 'off_chen', duty: 'rest' });
    const r = squadReadiness(s, 'D', T0);
    expect(r).toMatchObject({ ready: 1, total: 1, deployable: true });
    expect(r.issues).toContain('Short 3 officers of 4');
    expect(rosterOfficers(s).map((o) => o.squadId).slice(-1)).toEqual(['D']);
  });

  it('staffing four full squads (16 officers) is reachable through the tree', () => {
    let s = createInitialState(T0);
    s.department.devPoints = 20;
    s.department.funding = 100_000;
    expect(refused(s, { type: 'unlockNode', nodeId: 'personnel_fourth_squad' }, T0)).toMatch(/Requires Recruiting office/);
    s = ok(s, { type: 'unlockNode', nodeId: 'personnel_recruiting' }, T0);
    expect(s.department.rosterCap).toBe(14);
    s = ok(s, { type: 'unlockNode', nodeId: 'personnel_fourth_squad' }, T0);
    expect(s.department.rosterCap).toBe(18);
    expect(s.department.rosterCap).toBeGreaterThanOrEqual(ROSTER_TUNING.squadSize * ROSTER_TUNING.maxSquads);
    const opt = nodeOptions(s).find((o) => o.node.id === 'personnel_fourth_squad')!;
    expect(opt.status).toBe('unlocked');
    expect(opt.effects).toEqual(['+4 roster slots']);
    // The cap alone is enough: 8 starters plus 8 hires fit under 18.
    expect(Object.keys(s.officers).length + 8).toBeLessThanOrEqual(s.department.rosterCap);
  });

  it('never allows duplicate membership or a fifth officer', () => {
    let s = createInitialState(T0);
    s = ok(s, { type: 'createSquad', name: 'Charlie' }, T0);
    expect(refused(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: 'A' }, T0)).toMatch(/already in/);
    expect(refused(s, { type: 'assignToSquad', officerId: 'off_okafor', squadId: 'A' }, T0)).toMatch(/already has 4/);
    s = ok(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: 'C' }, T0);
    const memberships = s.squads.flatMap((q) => q.officerIds).filter((id) => id === 'off_chen');
    expect(memberships).toEqual(['off_chen']);
    expect(s.officers.off_chen.squadId).toBe('C');
    expect(s.squads.find((q) => q.id === 'A')!.officerIds).not.toContain('off_chen');
    // null removes
    s = ok(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: null }, T0);
    expect(s.officers.off_chen.squadId).toBeNull();
    expect(s.squads.flatMap((q) => q.officerIds)).not.toContain('off_chen');
  });

  it('rename keeps identity and stress; moves never reset stress', () => {
    let s = createInitialState(T0);
    const stressBefore = Object.fromEntries(Object.values(s.officers).map((o) => [o.id, o.stress]));
    s = ok(s, { type: 'renameSquad', squadId: 'B', name: 'Night Shift' }, T0);
    expect(s.squads.find((q) => q.id === 'B')).toMatchObject({ id: 'B', name: 'Night Shift', officerIds: expect.arrayContaining(['off_reyes']) });
    s = ok(s, { type: 'assignToSquad', officerId: 'off_reyes', squadId: null }, T0);
    s = ok(s, { type: 'assignToSquad', officerId: 'off_reyes', squadId: 'B' }, T0);
    expect(s.officers.off_reyes.stress).toBe(stressBefore.off_reyes);
    expect(refused(s, { type: 'renameSquad', squadId: 'B', name: 'x'.repeat(21) }, T0)).toMatch(/at most 20/);
  });

  it('leader must be a member; duty and roster are locked while deployed', () => {
    let s = createInitialState(T0);
    expect(refused(s, { type: 'setLeader', squadId: 'A', officerId: 'off_reyes' }, T0)).toMatch(/member/);
    s = ok(s, { type: 'setLeader', squadId: 'A', officerId: 'off_chen' }, T0);
    expect(s.squads[0].leaderId).toBe('off_chen');
    s.officers.off_vale.assignment = { kind: 'operation', runId: 'run_1' };
    expect(refused(s, { type: 'setSquadDuty', squadId: 'A', duty: 'rest' }, T0)).toMatch(/deployed/);
    expect(refused(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: null }, T0)).toMatch(/deployed/);
    expect(refused(s, { type: 'assignToSquad', officerId: 'off_reyes', squadId: 'A' }, T0)).toMatch(/deployed|already has 4/);
    s = ok(s, { type: 'setSquadDuty', squadId: 'B', duty: 'rest' }, T0);
    expect(s.squads[1].duty).toBe('rest');
  });

  it('presets and restock rules need their nodes', () => {
    const s = createInitialState(T0);
    expect(refused(s, { type: 'setLoadoutPreset', squadId: 'A', items: { radio_kit: 2 } }, T0)).toMatch(/not unlocked/);
    expect(refused(s, { type: 'setRestockRule', rule: { itemId: 'trauma_kit', target: 10, budgetCeiling: 300 } }, T0)).toMatch(/not unlocked/);
    const t = ok(s, { type: 'unlockNode', nodeId: 'logistics_presets' }, T0);
    const u = ok(t, { type: 'setLoadoutPreset', squadId: 'A', items: { radio_kit: 2, trauma_kit: 0 } }, T0);
    expect(u.squads[0].loadoutPreset).toEqual({ radio_kit: 2 });
    expect(refused(u, { type: 'setLoadoutPreset', squadId: 'A', items: { thermal_imager: 1 } }, T0)).toMatch(/not unlocked/);
  });

  it('squadReadiness lists blockers and counts deployable members', () => {
    let s = createInitialState(T0);
    s.officers.off_vale.stress = 85;
    const r = squadReadiness(s, 'A', T0);
    expect(r).toMatchObject({ ready: 3, total: 4, deployable: true });
    expect(r.issues.some((i) => /^Vale: mandatory recovery ~\d+h/.test(i))).toBe(true);
    s = ok(s, { type: 'createSquad', name: 'Charlie' }, T0);
    expect(squadReadiness(s, 'C', T0)).toMatchObject({ ready: 0, total: 0, deployable: false });
  });

  it('rosterOfficers sorts by squad then surname', () => {
    const names = rosterOfficers(createInitialState(T0)).map((o) => o.surname);
    expect(names).toEqual(['Brooks', 'Chen', 'Ortiz', 'Vale', 'Lindqvist', 'Okafor', 'Park', 'Reyes']);
  });
});

describe('development tree, training and store', () => {
  it('has 13 non-exclusive nodes with the required ids and effects', () => {
    expect(Object.keys(DEV_NODES)).toHaveLength(13);
    const n = DEV_NODES;
    expect(n.personnel_negotiation.effects).toContainEqual({ kind: 'unlockCourse', courseId: 'crisis_negotiation_course' });
    expect(n.field_contact_kit.effects).toContainEqual({ kind: 'unlockItem', itemId: 'throw_phone' });
    expect(n.intel_thermal.effects).toContainEqual({ kind: 'unlockItem', itemId: 'thermal_imager' });
    expect(n.intel_drone.requires).toEqual(['intel_thermal']);
    expect(n.intel_drone.effects).toContainEqual({ kind: 'unlockCourse', courseId: 'drone_course' });
    expect(n.field_entry_course.effects).toContainEqual({ kind: 'unlockCourse', courseId: 'entry_course' });
    expect(n.personnel_academy.effects).toContainEqual({ kind: 'trainingSlots', delta: 1 });
    expect(n.personnel_recruiting.effects).toEqual(expect.arrayContaining([{ kind: 'rosterCap', delta: 2 }, { kind: 'candidatePool', delta: 1 }]));
    expect(n.personnel_fourth_squad.requires).toEqual(['personnel_recruiting']);
    expect(n.personnel_fourth_squad.effects).toContainEqual({ kind: 'rosterCap', delta: 4 });
    expect(n.logistics_restock.requires).toEqual(['logistics_presets']);
    expect(n.wellbeing_peer_support.effects).toContainEqual({ kind: 'recoveryRate', mult: 1.5 });
    const branches = new Set(Object.values(n).map((x) => x.branch));
    expect(branches).toEqual(new Set(['personnel', 'field', 'intel', 'logistics', 'wellbeing']));
    // Every early branch is reachable with the 3 starting development points.
    for (const b of branches) {
      expect(Object.values(n).some((x) => x.branch === b && x.requires.length === 0 && x.cost.dp <= 3)).toBe(true);
    }
  });

  it('unlockNode checks prerequisites, points and funding', () => {
    let s = createInitialState(T0);
    expect(refused(s, { type: 'unlockNode', nodeId: 'intel_drone' }, T0)).toMatch(/Requires Thermal imaging/);
    expect(refused(s, { type: 'unlockNode', nodeId: 'nope' }, T0)).toMatch(/Unknown/);
    s.department.funding = 500;
    expect(refused(s, { type: 'unlockNode', nodeId: 'personnel_negotiation' }, T0)).toMatch(/Needs \$800/);
    s.department.funding = 12400;
    s.department.devPoints = 1;
    expect(refused(s, { type: 'unlockNode', nodeId: 'personnel_negotiation' }, T0)).toMatch(/development points/);
  });

  it('unlock charges points and funding once and applies capacity effects', () => {
    let s = createInitialState(T0);
    s = ok(s, { type: 'unlockNode', nodeId: 'personnel_recruiting' }, T0);
    expect(s.department.devPoints).toBe(1);
    expect(s.department.funding).toBe(12400 - 1500);
    expect(s.department.rosterCap).toBe(14);
    expect(refused(s, { type: 'unlockNode', nodeId: 'personnel_recruiting' }, T0)).toMatch(/already unlocked/);
    expect(refused(s, { type: 'unlockNode', nodeId: 'personnel_academy' }, T0)).toMatch(/development points/);
    const opt = nodeOptions(s);
    expect(opt.find((o) => o.node.id === 'personnel_recruiting')!.status).toBe('unlocked');
    expect(opt.find((o) => o.node.id === 'intel_drone')!.status).toBe('locked');
    expect(opt.find((o) => o.node.id === 'personnel_negotiation')!.effects[0]).toMatch(/Crisis negotiation/);
  });

  it('course is unavailable until its node is unlocked; cert is granted only at completion', () => {
    let s = createInitialState(T0);
    const opt = () => courseOptions(s, 'off_reyes', T0).find((c) => c.course.id === 'crisis_negotiation_course')!;
    expect(opt().available).toBe(false);
    expect(opt().reason).toMatch(/Requires Negotiation training/);
    expect(refused(s, { type: 'startCourse', officerId: 'off_reyes', courseId: 'crisis_negotiation_course' }, T0)).toMatch(/Requires/);

    s = ok(s, { type: 'unlockNode', nodeId: 'personnel_negotiation' }, T0);
    // Unlocking qualifies nobody.
    expect(s.officers.off_reyes.certs).not.toContain('crisis_negotiation');
    expect(opt().available).toBe(true);

    const funding = s.department.funding;
    s = ok(s, { type: 'startCourse', officerId: 'off_reyes', courseId: 'crisis_negotiation_course' }, T0);
    expect(s.department.funding).toBe(funding - 1500);
    expect(s.officers.off_reyes.assignment).toMatchObject({ kind: 'training', courseId: 'crisis_negotiation_course' });
    expect(deployability(s.officers.off_reyes, T0).ok).toBe(false);

    // Only slot is taken; another start is refused.
    expect(refused(s, { type: 'startCourse', officerId: 'off_park', courseId: 'composure_workshop' }, T0)).toMatch(/training slot/);
    expect(refused(s, { type: 'startCourse', officerId: 'off_reyes', courseId: 'composure_workshop' }, T0)).toMatch(/already in training|training slot/);

    s = ok(s, { type: 'tick' }, T0 + 5.9 * HOUR_MS);
    expect(s.officers.off_reyes.certs).not.toContain('crisis_negotiation');
    expect(deployability(s.officers.off_reyes, T0 + 5.9 * HOUR_MS).ok).toBe(false);

    s = ok(s, { type: 'tick' }, T0 + 6.1 * HOUR_MS);
    expect(s.officers.off_reyes.certs).toContain('crisis_negotiation');
    expect(s.officers.off_reyes.assignment).toBeNull();
    expect(refused(s, { type: 'startCourse', officerId: 'off_reyes', courseId: 'crisis_negotiation_course' }, T0 + 6.1 * HOUR_MS)).toMatch(/already holds/);
  });

  it('refuses training for deployed officers and when funds are short', () => {
    const s = createInitialState(T0);
    s.officers.off_chen.assignment = { kind: 'operation', runId: 'run_1' };
    expect(refused(s, { type: 'startCourse', officerId: 'off_chen', courseId: 'composure_workshop' }, T0)).toMatch(/deployed/);
    s.officers.off_chen.assignment = null;
    s.department.funding = 100;
    expect(refused(s, { type: 'startCourse', officerId: 'off_chen', courseId: 'composure_workshop' }, T0)).toMatch(/Needs \$600/);
  });

  it('a rating course raises the rating only on completion', () => {
    let s = createInitialState(T0);
    const before = s.officers.off_vale.ratings.composure;
    s = ok(s, { type: 'startCourse', officerId: 'off_vale', courseId: 'composure_workshop' }, T0);
    expect(s.officers.off_vale.ratings.composure).toBe(before);
    s = ok(s, { type: 'tick' }, T0 + 4 * HOUR_MS + 1);
    expect(s.officers.off_vale.ratings.composure).toBe(before + 3);
  });

  it('buyItem needs the node, funding, and never goes below zero', () => {
    let s = createInitialState(T0);
    expect(refused(s, { type: 'buyItem', itemId: 'thermal_imager', qty: 1 }, T0)).toMatch(/Requires Thermal imaging/);
    expect(storeOptions(s).find((o) => o.item.id === 'thermal_imager')).toMatchObject({ canBuy: false });
    s = ok(s, { type: 'buyItem', itemId: 'trauma_kit', qty: 3 }, T0);
    expect(ownedCount(s, 'trauma_kit')).toBe(9);
    expect(s.department.funding).toBe(12400 - 360);
    expect(refused(s, { type: 'buyItem', itemId: 'trauma_kit', qty: 0 }, T0)).toMatch(/whole number/);
    expect(refused(s, { type: 'buyItem', itemId: 'ballistic_shield', qty: 20 }, T0)).toMatch(/Needs/);
    s = ok(s, { type: 'unlockNode', nodeId: 'intel_thermal' }, T0);
    s = ok(s, { type: 'buyItem', itemId: 'thermal_imager', qty: 1 }, T0);
    expect(ownedCount(s, 'thermal_imager')).toBe(1);
    expect(s.department.funding).toBeGreaterThanOrEqual(0);
  });
});

describe('recovery view', () => {
  it('explains blockers, factors and the deployable time', () => {
    const s = createInitialState(T0);
    s.officers.off_vale.stress = 85;
    const info = recoveryInfo(s, 'off_vale', T0);
    expect(info.band).toBe('recovery');
    expect(info.blocker).toMatch(/mandatory recovery/);
    expect(info.deployableAt).toBeGreaterThan(T0 + 5 * HOUR_MS);
    expect(info.factors.join(' ')).toMatch(/patrol: 1\/h/);
    expect(recoveryInfo(s, 'off_chen', T0)).toMatchObject({ band: 'ready', deployableAt: null, blocker: null });
  });
});
