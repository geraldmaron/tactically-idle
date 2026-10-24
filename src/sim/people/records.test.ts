import { describe, expect, it } from 'vitest';
import { ROSTER_HANDLERS, dismissCheck, hireCheck, topUpCandidates } from '../roster';
import { applyPeopleDebrief, onOfficerDeparted, rehireCandidates, createPeople } from './index';
import { HOUR_MS, PEOPLE_TUNING } from './tuning';
import { advance, buildCall, CONTACT_ACTION, freshState, NOW } from '../fixtures/people-fixtures';
import { validPeopleState } from './validate';
import type { GameState } from '../types';

const netRate = () => 1000;

function dismissOne(d: GameState, id: string): void {
  d.department.funding = 1_000_000;
  const r = ROSTER_HANDLERS.dismiss(d, id, netRate);
  expect(r).toEqual({ ok: true });
}

describe('person records', () => {
  it('makes one employed record per starting officer, with openness from the authored jacket', () => {
    const d = freshState();
    expect(Object.keys(d.people.records).sort()).toEqual(Object.keys(d.officers).sort());
    for (const r of Object.values(d.people.records)) {
      expect(r.status).toBe('employed');
      expect(r.pagesOpen).toBe(1);
    }
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('createPeople works from the officers alone', () => {
    const d = freshState();
    const p = createPeople({ officers: d.officers }, NOW);
    expect(Object.keys(p.records).length).toBe(8);
  });

  it('dismissal stores the snapshot and sets the rehire time seven game days out', () => {
    const d = freshState();
    d.officers.off_reyes.stress = 63;
    dismissOne(d, 'off_reyes');
    const r = d.people.records.off_reyes;
    expect(r.status).toBe('dismissed');
    expect(r.leftAt).toBe(NOW);
    expect(r.rehireAfter).toBe(NOW + PEOPLE_TUNING.rehireCooldownMs);
    expect(r.rehireAfter! - r.leftAt!).toBe(7 * HOUR_MS);
    expect(r.snapshot?.stress).toBe(63);
    expect(d.officers.off_reyes).toBeUndefined();
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('refuses to dismiss an officer on a stand-down or peer support', () => {
    const d = freshState();
    d.officers.off_park.assignment = { kind: 'standdown', imprintId: 'imp_1', startedAt: NOW, endsAt: NOW + HOUR_MS };
    expect(dismissCheck(d, 'off_park', netRate).ok).toBe(false);
    d.officers.off_park.assignment = { kind: 'peer_support', imprintId: 'imp_1', startedAt: NOW, endsAt: NOW + HOUR_MS };
    expect(dismissCheck(d, 'off_park', netRate).reason).toMatch(/aftercare/);
  });

  it('a dismissed officer is not on offer before the cooldown and is after it', () => {
    const d = freshState();
    dismissOne(d, 'off_reyes');
    expect(rehireCandidates(d, NOW + 6 * HOUR_MS)).toHaveLength(0);
    expect(rehireCandidates(d, NOW + 7 * HOUR_MS).map((c) => c.officer.id)).toEqual(['off_reyes']);
  });

  it('rehire keeps condition, traits, settled traits and memories, never the first-seen build', () => {
    const d = freshState();
    // Give Reyes a condition and a memory worth keeping.
    d.officers.off_reyes.stress = 58;
    d.officers.off_reyes.career.operations = 99;
    d.officers.off_reyes.traits.push('steady');
    const { run, result } = buildCall(d, { officers: ['off_reyes', 'off_park'], verdict: 'favorable', steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_reyes'] }] });
    applyPeopleDebrief(d, run, result, 'favorable');
    const memories = d.people.facts.filter((f) => f.officerId === 'off_reyes').map((f) => f.id);
    expect(memories.length).toBeGreaterThan(0);
    d.people.settled.push({ id: 'set_900', officerId: 'off_reyes', trait: 'sure_on_the_rear', polarity: 'positive', cause: { place: 'Cedar Close', at: NOW }, settledAt: NOW });
    d.people.nextId = 1000;

    dismissOne(d, 'off_reyes');
    // The first-seen build must differ from what we kept, to prove it is not the source.
    const identity = d.people.records.off_reyes.identityId;
    d.personnel!.builds[identity] = { ...d.personnel!.builds[identity], stress: 5, traits: [], career: { operations: 1, favorable: 0, adverse: 0 } };

    advance(d, 8);
    topUpCandidates(d, d.department.clockHighWater, 3);
    const cand = d.candidates.find((c) => c.id === 'cand_rehire_off_reyes');
    expect(cand).toBeDefined();
    d.department.funding = 1_000_000;
    expect(hireCheck(d, cand!.id, netRate).ok).toBe(true);
    expect(ROSTER_HANDLERS.hire(d, cand!.id, netRate)).toEqual({ ok: true });

    const back = d.officers.off_reyes;
    expect(back.stress).toBe(58);
    expect(back.traits).toContain('steady');
    expect(back.career.operations).toBe(99);
    expect(d.people.records.off_reyes.status).toBe('employed');
    expect(d.people.records.off_reyes.snapshot).toBeUndefined();
    expect(d.people.facts.filter((f) => f.officerId === 'off_reyes').map((f) => f.id)).toEqual(memories);
    expect(d.people.settled.some((s) => s.officerId === 'off_reyes')).toBe(true);
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('a candidate for a person who has served is refused unless they are a returning dismissed officer', () => {
    const d = freshState();
    // Park is employed: any candidate with her identity is refused.
    const fake = structuredClone(d.officers.off_park);
    d.candidates.push({ id: 'cand_x', officer: { ...fake, id: 'off_other' }, signingCost: 0, shortlisted: false, expiresAt: NOW + HOUR_MS });
    expect(hireCheck(d, 'cand_x', netRate).reason).toMatch(/already served/);
  });

  it('retirement stores a snapshot and the person is never offered again', () => {
    const d = freshState();
    d.officers.off_okafor.retirement = { day: 1, reason: 'age', announcedDay: 0, extended: false };
    onOfficerDeparted(d, 'off_okafor', 'retired');
    delete d.officers.off_okafor;
    const r = d.people.records.off_okafor;
    expect(r.status).toBe('retired');
    expect(r.rehireAfter).toBeUndefined();
    expect(rehireCandidates(d, NOW + 1000 * HOUR_MS)).toHaveLength(0);
  });

  it('a departure closes a live note and a colleague who was sitting with them', () => {
    const d = freshState();
    d.people.imprints.push({ id: 'imp_1', officerId: 'off_park', pack: 'hard_night', cause: { place: 'Cedar Close', at: NOW }, startedAt: NOW, endsAt: NOW + HOUR_MS, seen: true, fork: { offeredAt: NOW, choice: 'peer', partnerId: 'off_chen', decidedAt: NOW } });
    d.people.nextId = 2;
    d.officers.off_chen.assignment = { kind: 'peer_support', imprintId: 'imp_1', startedAt: NOW, endsAt: NOW + HOUR_MS };
    dismissOne(d, 'off_park');
    expect(d.people.imprints[0].outcome).toBe('cleared');
    expect(d.officers.off_chen.assignment).toBeNull();
  });
});

describe('jacket pages open as the player serves', () => {
  it('page 2 opens after four shared operations and page 3 after its keyed fact', () => {
    const d = freshState();
    // Brooks (page 3 keys on a negotiated fact) and Chen, whose persona seat is shuffled: use the authored personas directly.
    const brooksIdentity = 'person_002';
    const holder = Object.values(d.officers).find((o) => o.identityId === brooksIdentity);
    // The seat shuffle may not seat Brooks; give the first officer his identity for this test.
    const seat = holder ?? d.officers.off_chen;
    seat.identityId = brooksIdentity;
    d.people.records[seat.id].identityId = brooksIdentity;
    const other = Object.values(d.officers).find((o) => o.id !== seat.id)!;
    const act = CONTACT_ACTION();
    for (let i = 0; i < 4; i++) {
      advance(d, 1);
      const { run, result } = buildCall(d, {
        officers: [seat.id, other.id], verdict: 'favorable', steps: [{ actionId: act.id, band: 'favorable', officers: [seat.id] }], disposition: 'resolved',
      });
      applyPeopleDebrief(d, run, result, 'favorable');
      if (i < 3) expect(d.people.records[seat.id].pagesOpen).toBe(1);
    }
    // Four shared operations: page 2 is open, and the negotiated fact from the first call opens page 3 with it.
    expect(d.people.records[seat.id].pagesOpen).toBe(3);
    const beats = d.people.beats.filter((b) => b.kind === 'page_opened' && b.officerIds.includes(seat.id));
    expect(beats.map((b) => b.refId)).toEqual([`${seat.id}:2`, `${seat.id}:3`]);
  });

  it('a templated persona has one page and never opens another', () => {
    const d = freshState();
    const o = Object.values(d.officers).find((x) => x.identityId !== undefined && !['person_001', 'person_002', 'person_003', 'person_004', 'person_005', 'person_006', 'person_007', 'person_008'].includes(x.identityId));
    // The starters are the cast's first eight only under the legacy order; shuffle may put anyone in a seat.
    const target = o ?? d.officers.off_chen;
    target.identityId = 'person_999';
    d.people.records[target.id].identityId = 'person_999';
    const other = Object.values(d.officers).find((x) => x.id !== target.id)!;
    for (let i = 0; i < 6; i++) {
      advance(d, 1);
      const { run, result } = buildCall(d, { officers: [target.id, other.id], verdict: 'favorable', steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: [target.id] }] });
      applyPeopleDebrief(d, run, result, 'favorable');
    }
    expect(d.people.records[target.id].pagesOpen).toBe(1);
  });
});
