import { describe, expect, it } from 'vitest';
import { applyPeopleDebrief, bondContributor, nextPeopleEventTime, recordShiftFact, settlePeople } from './index';
import { bondWeb } from './selectors';
import { findBond, supervises } from './bonds';
import { hashUnit } from './core';
import { HOUR_MS, PEOPLE_TUNING } from './tuning';
import { advance, buildCall, CONTACT_ACTION, freshState, REAR_ACTION } from '../fixtures/people-fixtures';
import { validPeopleState } from './validate';
import { ROSTER_HANDLERS } from '../roster';
import type { GameState, Id } from '../types';

function callTogether(d: GameState, officers: Id[], verdict: 'favorable' | 'adverse' | null, extra: Partial<Parameters<typeof buildCall>[1]> = {}) {
  advance(d, 1);
  const { run, result } = buildCall(d, { officers, verdict, civilians: ['needs_help'], steps: [{ actionId: CONTACT_ACTION().id, band: verdict ?? 'mixed', officers }], ...extra });
  applyPeopleDebrief(d, run, result, verdict);
}

describe('bonds', () => {
  it('start acquainted after a shared call and climb to trusted and close on calls that go well', () => {
    const d = freshState();
    callTogether(d, ['off_chen', 'off_ortiz'], 'favorable');
    expect(findBond(d.people, 'off_chen', 'off_ortiz')?.state).toBe('acquainted');
    for (let i = 0; i < 3; i++) callTogether(d, ['off_chen', 'off_ortiz'], 'favorable');
    expect(findBond(d.people, 'off_chen', 'off_ortiz')?.state).toBe('trusted');
    for (let i = 0; i < 7; i++) callTogether(d, ['off_chen', 'off_ortiz'], 'favorable');
    expect(findBond(d.people, 'off_chen', 'off_ortiz')?.state).toBe('close');
    expect(d.people.beats.filter((b) => b.kind === 'bond_changed')).not.toHaveLength(0);
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('an adverse call alone never costs a bond; only a recorded cause does', () => {
    const d = freshState();
    for (let i = 0; i < 4; i++) callTogether(d, ['off_chen', 'off_ortiz'], 'favorable');
    const before = structuredClone(findBond(d.people, 'off_chen', 'off_ortiz')!);
    for (let i = 0; i < 4; i++) callTogether(d, ['off_chen', 'off_ortiz'], 'adverse');
    const after = findBond(d.people, 'off_chen', 'off_ortiz')!;
    expect(after.state).toBe(before.state);
    expect(after.drift).toBeGreaterThanOrEqual(before.drift);
  });

  it('a rear left open drags a bond down to tense and records why', () => {
    const d = freshState();
    for (let i = 0; i < 4; i++) callTogether(d, ['off_chen', 'off_ortiz'], 'favorable');
    // Ortiz was on the adverse rear step; Chen was not.
    advance(d, 1);
    const { run, result } = buildCall(d, {
      officers: ['off_chen', 'off_ortiz'], verdict: 'adverse', civilians: ['needs_help'],
      steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_ortiz'] }, { actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_chen'] }],
    });
    applyPeopleDebrief(d, run, result, 'adverse');
    const bond = findBond(d.people, 'off_chen', 'off_ortiz')!;
    expect(bond.state).toBe('tense');
    expect(bond.cause).toMatchObject({ kind: 'rear_left_open', place: 'Cedar Close' });
  });

  it('a promotion over a peer in the same squad drags the bond down', () => {
    const d = freshState();
    d.officers.off_chen.xp = 0;
    d.officers.off_vale.xp = 0;
    advance(d, 1);
    const { run, result } = buildCall(d, {
      officers: ['off_chen', 'off_vale'], verdict: 'favorable', steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_chen', 'off_vale'] }],
      promoted: { off_chen: 'officer' },
    });
    applyPeopleDebrief(d, run, result, 'favorable');
    const bond = findBond(d.people, 'off_chen', 'off_vale')!;
    expect(bond.cause.kind).toBe('promotion');
    expect(bond.state).toBe('tense');
  });

  it('a tense bond eases to acquainted after a while, at a time the settlement offers', () => {
    const d = freshState();
    d.people.bonds.push({ a: 'off_chen', b: 'off_ortiz', state: 'tense', drift: 0, since: d.department.clockHighWater, cause: { kind: 'breakup', at: 0 } });
    const t = d.department.clockHighWater;
    expect(nextPeopleEventTime(d, t)).toBe(t + PEOPLE_TUNING.bond.tenseEasesAfterMs);
    const beats: Id[] = [];
    settlePeople(d, t, t + PEOPLE_TUNING.bond.tenseEasesAfterMs, beats);
    expect(d.people.bonds[0].state).toBe('acquainted');
    expect(d.people.bonds[0].cause.kind).toBe('repair');
  });

  it('a mentor-trait officer of higher rank becomes mentor after shared calls, and the trainee gets a mentored fact once', () => {
    const d = freshState();
    d.officers.off_okafor.traits = ['mentor'];
    d.officers.off_okafor.xp = 5000;
    d.officers.off_park.xp = 0;
    for (let i = 0; i < 4; i++) callTogether(d, ['off_okafor', 'off_park'], 'favorable');
    const bond = findBond(d.people, 'off_okafor', 'off_park')!;
    expect(bond.state).toBe('mentor');
    const mentored = d.people.facts.filter((f) => f.kind === 'mentored');
    expect(mentored).toHaveLength(1);
    expect(mentored[0]).toMatchObject({ officerId: 'off_park', with: ['off_okafor'] });
    expect(mentored[0].detail.length).toBeLessThanOrEqual(80);
    expect(supervises(d, 'off_okafor', 'off_park')).toBe(true);
  });

  it('shared shifts drift a bond up, and a shift that stopped for strain drags it down', () => {
    const d = freshState();
    const base = d.department.clockHighWater;
    d.world.shifts.push({ id: 'p1', squadId: 'A', districtId: 'pike', startedAt: base, endsAt: base + 4 * HOUR_MS, stoppedAt: base + 4 * HOUR_MS, stopReason: 'ended', contacts: 0, caseIds: [], leadIds: [] });
    recordShiftFact(d, 'p1');
    recordShiftFact(d, 'p1');
    const facts = d.people.facts.filter((f) => f.kind === 'shift' && f.officerId === 'off_chen');
    expect(facts).toHaveLength(1);
    expect(facts[0].place).toBe('Pike Street');
    expect(facts[0].detail).toMatch(/4 hour/);
    expect(findBond(d.people, 'off_chen', 'off_brooks')?.drift).toBe(PEOPLE_TUNING.bond.gain.shift);
    d.world.shifts.push({ id: 'p2', squadId: 'A', districtId: 'pike', startedAt: base, endsAt: base + 8 * HOUR_MS, stoppedAt: base + 3 * HOUR_MS, stopReason: 'strain', contacts: 0, caseIds: [], leadIds: [] });
    recordShiftFact(d, 'p2');
    expect(findBond(d.people, 'off_chen', 'off_brooks')?.drift).toBe(PEOPLE_TUNING.bond.gain.shift + PEOPLE_TUNING.bond.shiftStrain);
  });
});

describe('the bond contributor', () => {
  it('is small, capped and visible, and counts a pair once', () => {
    const d = freshState();
    d.people.bonds.push({ a: 'off_chen', b: 'off_ortiz', state: 'close', drift: 0, since: 0, cause: { kind: 'shared_call', at: 0 } });
    const one = bondContributor(d, ['off_chen', 'off_ortiz', 'off_ortiz'])!;
    expect(one).toMatchObject({ value: 2, source: 'familiarity' });
    expect(one.label).toMatch(/^.+ and .+: /);
    for (const [a, b] of [['off_brooks', 'off_vale'], ['off_chen', 'off_brooks'], ['off_chen', 'off_vale'], ['off_ortiz', 'off_vale']]) {
      d.people.bonds.push({ a: a < b ? a : b, b: a < b ? b : a, state: 'close', drift: 0, since: 0, cause: { kind: 'shared_call', at: 0 } });
    }
    expect(bondContributor(d, ['off_chen', 'off_ortiz', 'off_brooks', 'off_vale'])!.value).toBe(PEOPLE_TUNING.contributor.cap);
    expect(bondContributor(d, ['off_chen'])).toBeNull();
    d.people.bonds = [{ a: 'off_chen', b: 'off_ortiz', state: 'strained', drift: 0, since: 0, cause: { kind: 'rear_left_open', at: 0 } }];
    expect(bondContributor(d, ['off_chen', 'off_ortiz'])!.value).toBe(-2);
  });

  it('ignores a pair when one has left', () => {
    const d = freshState();
    d.people.bonds.push({ a: 'off_chen', b: 'off_ortiz', state: 'close', drift: 0, since: 0, cause: { kind: 'shared_call', at: 0 } });
    d.people.records.off_ortiz.status = 'dismissed';
    expect(bondContributor(d, ['off_chen', 'off_ortiz'])).toBeNull();
  });

  it('bondWeb lists the bonds among a group, close ones first', () => {
    const d = freshState();
    d.people.bonds.push({ a: 'off_chen', b: 'off_ortiz', state: 'tense', drift: 0, since: 0, cause: { kind: 'promotion', at: 0 } });
    d.people.bonds.push({ a: 'off_brooks', b: 'off_chen', state: 'close', drift: 0, since: 0, cause: { kind: 'shared_call', at: 0 } });
    const web = bondWeb(d, ['off_chen', 'off_ortiz', 'off_brooks']);
    expect(web.map((e) => e.state)).toEqual(['close', 'tense']);
  });
});

/** Two officers in different squads whose pair draw is inclined to romance (a fixed draw per pair). */
function inclinedPair(d: GameState): [Id, Id] {
  for (const a of ['off_chen', 'off_brooks', 'off_ortiz', 'off_vale']) {
    for (const b of ['off_okafor', 'off_lindqvist', 'off_reyes', 'off_park']) {
      const [x, y] = a < b ? [a, b] : [b, a];
      if (hashUnit(d.world.seed, `romance:${x}:${y}`) < PEOPLE_TUNING.romance.inclined) return [x, y];
    }
  }
  throw new Error('No inclined pair for this seed');
}

describe('romance', () => {
  function closePair(d: GameState, a: Id, b: Id, closeForHours = 20) {
    d.people.records[a].openToRelationship = true;
    d.people.records[b].openToRelationship = true;
    d.people.bonds = [{ a, b, state: 'close', drift: 0, since: d.department.clockHighWater - closeForHours * HOUR_MS, cause: { kind: 'shared_call', at: 0 } }];
  }

  it('forms between two employed officers who are both open, neither supervising, after close has held', () => {
    const d = freshState();
    const [a, b] = inclinedPair(d);
    closePair(d, a, b);
    callTogether(d, [a, b], 'favorable');
    expect(findBond(d.people, a, b)!.romance).toMatchObject({ since: expect.any(Number) });
    expect(d.people.beats.some((x) => x.kind === 'romance')).toBe(true);
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('never forms with a person who is not open to it', () => {
    const d = freshState();
    const [a, b] = inclinedPair(d);
    closePair(d, a, b);
    d.people.records[b].openToRelationship = false;
    callTogether(d, [a, b], 'favorable');
    callTogether(d, [a, b], 'favorable');
    expect(findBond(d.people, a, b)!.romance).toBeUndefined();
  });

  it('never forms before the close bond has held, or from a bond that is not close', () => {
    const d = freshState();
    const [a, b] = inclinedPair(d);
    closePair(d, a, b, 1);
    callTogether(d, [a, b], 'favorable');
    expect(findBond(d.people, a, b)!.romance).toBeUndefined();
    closePair(d, a, b);
    findBond(d.people, a, b)!.state = 'trusted';
    callTogether(d, [a, b], 'favorable');
    expect(findBond(d.people, a, b)!.romance).toBeUndefined();
  });

  it('never forms across supervision: a squad leader over a member', () => {
    const d = freshState();
    const [a, b] = inclinedPair(d);
    closePair(d, a, b);
    // Put a in b's squad and make a its leader.
    const squadOfB = d.squads.find((s) => s.officerIds.includes(b))!;
    d.squads.find((s) => s.officerIds.includes(a))!.officerIds = d.squads.find((s) => s.officerIds.includes(a))!.officerIds.filter((id) => id !== a);
    squadOfB.officerIds.push(a);
    squadOfB.leaderId = a;
    expect(supervises(d, a, b)).toBe(true);
    callTogether(d, [a, b], 'favorable');
    callTogether(d, [a, b], 'favorable');
    expect(findBond(d.people, a, b)!.romance).toBeUndefined();
  });

  it('never forms between a mentor and a trainee', () => {
    const d = freshState();
    const [a, b] = inclinedPair(d);
    closePair(d, a, b);
    findBond(d.people, a, b)!.state = 'mentor';
    callTogether(d, [a, b], 'favorable');
    expect(findBond(d.people, a, b)!.romance).toBeUndefined();
  });

  it('ends with a recorded cause and turns the pair tense when supervision arises', () => {
    const d = freshState();
    const [a, b] = inclinedPair(d);
    closePair(d, a, b);
    callTogether(d, [a, b], 'favorable');
    expect(findBond(d.people, a, b)!.romance?.ended).toBeUndefined();
    const squadOfB = d.squads.find((s) => s.officerIds.includes(b))!;
    const squadOfA = d.squads.find((s) => s.officerIds.includes(a))!;
    squadOfA.officerIds = squadOfA.officerIds.filter((id) => id !== a);
    squadOfB.officerIds.push(a);
    squadOfB.leaderId = a;
    callTogether(d, [a, b], 'favorable');
    const bond = findBond(d.people, a, b)!;
    expect(bond.romance?.ended).toBeGreaterThan(0);
    expect(bond.state).toBe('tense');
    expect(bond.cause.kind).toBe('breakup');
    expect(d.people.beats.filter((x) => x.kind === 'romance')).toHaveLength(2);
  });

  it('ends when either leaves, and a retired or dismissed partner is not a romance', () => {
    const d = freshState();
    const [a, b] = inclinedPair(d);
    closePair(d, a, b);
    callTogether(d, [a, b], 'favorable');
    expect(findBond(d.people, a, b)!.romance).toBeDefined();
    d.department.funding = 1_000_000;
    expect(ROSTER_HANDLERS.dismiss(d, a, () => 1000)).toEqual({ ok: true });
    const bond = findBond(d.people, a, b)!;
    expect(bond.romance?.ended).toBeGreaterThan(0);
    expect(bond.state).toBe('tense');
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('is not something the player can start: no command touches a romance', async () => {
    const { PEOPLE_HANDLERS } = await import('./index');
    expect(Object.keys(PEOPLE_HANDLERS).sort()).toEqual(['acknowledgeBeat', 'decideAftercare', 'markTelegraphSeen']);
  });
});
