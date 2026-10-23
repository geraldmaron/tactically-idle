// The hiring pool and squad swaps: ten candidates on offer that stay ten between searches, nobody
// offered to SWAT while on patrol, ten patrol offers, and a swap that trades two officers' places
// (and lead) in one step, refused while either is on a call.
import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { candidatePoolSize, HOUR_MS, ratesAt } from './economy';
import { RECRUIT_TUNING } from '../content/recruits';
import { patrolCandidates, PATROL_CANDIDATE_POOL } from './patrol';
import { makeState, NOW, startRun } from './test-fixtures';
import type { Command, GameState } from './types';

const T0 = 1_750_000_000_000;
const send = (s: GameState, cmd: Command, now = NOW) => dispatch(s, cmd, { now });
const squad = (s: GameState, id: string) => s.squads.find((q) => q.id === id)!;

describe('hiring pool', () => {
  it('offers ten candidates from the start', () => {
    const s = createInitialState(T0, 41041);
    expect(candidatePoolSize(s)).toBe(10);
    expect(s.candidates).toHaveLength(10);
    expect(new Set(s.candidates.map((c) => c.officer.identityId)).size).toBe(10);
  });

  it('refills the pool after a hire and after candidates leave', () => {
    let s = createInitialState(T0, 41041);
    const hired = s.candidates[0];
    const r = dispatch(s, { type: 'hire', candidateId: hired.id }, { now: T0 });
    expect(r.result.ok).toBe(true);
    expect(r.state.candidates).toHaveLength(9);
    s = dispatch(r.state, { type: 'tick' }, { now: T0 + 1000 }).state;
    expect(s.candidates).toHaveLength(10);
    expect(s.candidates.some((c) => c.officer.identityId === hired.officer.identityId)).toBe(false);
    // Everyone not shortlisted leaves after their lifetime; the pool is full again on return.
    const later = dispatch(s, { type: 'tick' }, { now: T0 + RECRUIT_TUNING.lifetimeMs + HOUR_MS }).state;
    expect(later.candidates).toHaveLength(10);
    expect(later.candidates.every((c) => c.expiresAt > T0 + RECRUIT_TUNING.lifetimeMs)).toBe(true);
  });

  it('leaves the shared rng and id counter alone when it refills', () => {
    const s = createInitialState(T0, 41041);
    const r = dispatch(s, { type: 'hire', candidateId: s.candidates[0].id }, { now: T0 });
    const next = dispatch(r.state, { type: 'tick' }, { now: T0 + 1000 }).state;
    expect(next.rngState).toBe(r.state.rngState);
    expect(next.nextId).toBe(r.state.nextId);
    expect(new Set(next.candidates.map((c) => c.id)).size).toBe(10);
  });

  it('never offers a patrol employee to SWAT, and offers ten patrol candidates', () => {
    const s = createInitialState(T0, 41041);
    const onPatrol = new Set(s.patrol.personnel.map((p) => p.profileId));
    expect(s.candidates.some((c) => onPatrol.has(c.officer.identityId!))).toBe(false);
    const refreshed = dispatch(s, { type: 'refreshCandidates' }, { now: T0 + RECRUIT_TUNING.refreshCooldownMs }).state;
    expect(refreshed.candidates.some((c) => onPatrol.has(c.officer.identityId!))).toBe(false);
    const offers = patrolCandidates(s);
    expect(offers).toHaveLength(PATROL_CANDIDATE_POOL);
    expect(PATROL_CANDIDATE_POOL).toBe(10);
    const swat = new Set(s.candidates.map((c) => c.officer.identityId));
    expect(offers.some((p) => swat.has(p.id))).toBe(false);
  });
});

describe('squad swaps', () => {
  it('swaps an unassigned officer into a full squad, sending the other to Unassigned', () => {
    let s = makeState();
    s = send(s, { type: 'assignToSquad', officerId: 'off_park', squadId: null }).state;
    expect(send(s, { type: 'assignToSquad', officerId: 'off_park', squadId: 'A' }).result.ok).toBe(false);
    const r = send(s, { type: 'swapSquadMembers', officerId: 'off_park', withId: 'off_vale' });
    expect(r.result.ok).toBe(true);
    expect(squad(r.state, 'A').officerIds).toEqual(['off_chen', 'off_brooks', 'off_ortiz', 'off_park']);
    expect(r.state.officers.off_park.squadId).toBe('A');
    expect(r.state.officers.off_vale.squadId).toBeNull();
  });

  it('trades places and lead between two squads', () => {
    const r = send(makeState(), { type: 'swapSquadMembers', officerId: 'off_okafor', withId: 'off_chen' });
    expect(r.result.ok).toBe(true);
    expect(squad(r.state, 'A').officerIds[0]).toBe('off_okafor');
    expect(squad(r.state, 'A').leaderId).toBe('off_okafor');
    expect(squad(r.state, 'B').officerIds[0]).toBe('off_chen');
    expect(squad(r.state, 'B').leaderId).toBe('off_chen');
    expect(r.state.officers.off_chen.squadId).toBe('B');
    expect(r.state.officers.off_okafor.squadId).toBe('A');
  });

  it('refuses a swap within one squad or with someone on a call', () => {
    expect(send(makeState(), { type: 'swapSquadMembers', officerId: 'off_chen', withId: 'off_vale' }).result.ok).toBe(false);
    const running = startRun(makeState(), 'ms_occupancy', ['A']);
    const r = send(running, { type: 'swapSquadMembers', officerId: 'off_okafor', withId: 'off_chen' });
    expect(r.result).toEqual({ ok: false, reason: expect.stringContaining('on a call') });
  });

  it('does not change the hourly rate: SWAT placement earns nothing and the wage is paid either way', () => {
    const s = makeState();
    const benched = send(s, { type: 'assignToSquad', officerId: 'off_park', squadId: null }).state;
    const swapped = send(benched, { type: 'swapSquadMembers', officerId: 'off_park', withId: 'off_vale' }).state;
    for (const next of [benched, swapped]) expect(ratesAt(next, NOW)).toEqual(ratesAt(s, NOW));
  });
});
