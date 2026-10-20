// run-roster-snapshot: squad edits during a call. Duty, leader and moves of officers who stayed home
// apply at once; moving an officer who is out on the call waits until the call ends, the latest
// choice winning, and a move that no longer holds keeps its reason.
import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { runRoster } from './squads';
import { makeState, NOW, playPolicy, startRun } from './test-fixtures';
import type { Command, GameState } from './types';

const send = (s: GameState, cmd: Command) => dispatch(s, cmd, { now: NOW });

function deployedA(): GameState {
  return startRun(makeState(), 'ms_occupancy', ['A']);
}

describe('squad edits during a call', () => {
  it('changes duty and leader of a deployed squad at once', () => {
    const s = deployedA();
    const duty = send(s, { type: 'setSquadDuty', squadId: 'A', duty: 'rest' });
    expect(duty.result.ok).toBe(true);
    expect(duty.state.squads.find((q) => q.id === 'A')!.duty).toBe('rest');
    const leader = send(s, { type: 'setLeader', squadId: 'A', officerId: 'off_brooks' });
    expect(leader.result.ok).toBe(true);
    expect(leader.state.squads.find((q) => q.id === 'A')!.leaderId).toBe('off_brooks');
  });

  it('queues the move of an officer on the call and keeps the run roster intact', () => {
    const s = deployedA();
    const before = runRoster(s, s.activeRun!, 'A');
    const r = send(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: 'B' });
    expect(r.result.ok).toBe(true);
    expect(r.state.officers.off_chen.squadId).toBe('A');
    expect(r.state.pendingSquadMoves).toEqual([{ officerId: 'off_chen', squadId: 'B', queuedAt: expect.any(Number) }]);
    expect(runRoster(r.state, r.state.activeRun!, 'A')).toEqual(before);
  });

  it('keeps one queued move per officer, the latest winning, and withdraws it when sent back', () => {
    let s = deployedA();
    s = send(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: 'B' }).state;
    s = send(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: null }).state;
    expect(s.pendingSquadMoves).toMatchObject([{ officerId: 'off_chen', squadId: null }]);
    s = send(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: 'A' }).state;
    expect(s.pendingSquadMoves).toEqual([]);
  });

  it('applies queued moves when the call closes', () => {
    let s = deployedA();
    // Make room in Bravo so the move holds.
    s = send(s, { type: 'assignToSquad', officerId: 'off_park', squadId: null }).state;
    s = send(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: 'B' }).state;
    const done = playPolicy(s, {});
    expect(done.state.officers.off_chen.squadId).toBe('B');
    expect(done.state.squads.find((q) => q.id === 'B')!.officerIds).toContain('off_chen');
    expect(done.state.pendingSquadMoves).toEqual([]);
  });

  it('applies queued moves when the call is cancelled', () => {
    let s = deployedA();
    s = send(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: null }).state;
    const r = send(s, { type: 'cancelOperation' });
    expect(r.result.ok).toBe(true);
    expect(r.state.officers.off_chen.squadId).toBeNull();
    expect(r.state.pendingSquadMoves).toEqual([]);
  });

  it('keeps a move that no longer holds, with its reason, until it is cleared', () => {
    let s = deployedA();
    // Bravo is full, so the move cannot apply at close.
    s = send(s, { type: 'assignToSquad', officerId: 'off_chen', squadId: 'B' }).state;
    const r = send(s, { type: 'cancelOperation' });
    expect(r.state.officers.off_chen.squadId).toBe('A');
    expect(r.state.pendingSquadMoves).toMatchObject([{ officerId: 'off_chen', squadId: 'B', dropped: expect.stringContaining('already has') }]);
    const cleared = send(r.state, { type: 'cancelPendingSquadMove', officerId: 'off_chen' });
    expect(cleared.result.ok).toBe(true);
    expect(cleared.state.pendingSquadMoves).toEqual([]);
  });

  it('moves officers who stayed home into or out of a deployed squad at once', () => {
    const base = makeState();
    base.officers.off_vale.injury = { label: 'Sprained wrist', until: NOW + 24 * 3600_000 };
    let s = startRun(base, 'ms_occupancy', ['A']);
    const out = send(s, { type: 'assignToSquad', officerId: 'off_vale', squadId: null });
    expect(out.result.ok).toBe(true);
    expect(out.state.officers.off_vale.squadId).toBeNull();
    s = send(out.state, { type: 'assignToSquad', officerId: 'off_park', squadId: 'A' }).state;
    expect(s.officers.off_park.squadId).toBe('A');
    expect(runRoster(s, s.activeRun!, 'A')).not.toContain('off_park');
    expect(s.pendingSquadMoves ?? []).toEqual([]);
  });
});
