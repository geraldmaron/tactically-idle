import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { HOUR_MS } from './economy';
import { deserialize, serialize } from './save';
import type { GameState, Id, Officer, SquadId } from './types';
import {
  applySquadArrangement, normalizeSquadArrangementState, officerArrangementReadiness, planSquadArrangement,
  setSquadArrangementLock, squadArrangementState, squadArrangementToken, squadTopology, summarizeSquadArrangement,
  undoSquadArrangement, undoSquadArrangementCheck, validateSquadTopology,
  type SquadArrangementProposal, type SquadOptimizerOptions, type SquadTopology,
} from './squad-optimizer';

const T0 = Date.UTC(2026, 0, 5, 12);
const OPTIONS: SquadOptimizerOptions = { squadIds: ['A', 'B'], includeUnassigned: false, preserveLeaders: true };
function state(): GameState { return createInitialState(T0); }
function improvableState(): GameState {
  const s = state();
  // Deliberately cluster the two medics in A and both communicators in B.
  for (const sq of s.squads) sq.officerIds = sq.officerIds.map((id) => id === 'off_chen' ? 'off_park' : id === 'off_park' ? 'off_chen' : id);
  s.officers.off_chen.squadId = 'B'; s.officers.off_park.squadId = 'A';
  return s;
}
function proposal(s: GameState, options = OPTIONS): SquadArrangementProposal {
  const p = planSquadArrangement(s, options);
  expect(p.reason).toBeNull();
  expect(p.proposal).not.toBeNull();
  return p.proposal!;
}
function mapped(t: SquadTopology, id: Id): SquadId | null { return t.squads.find((s) => s.officerIds.includes(id))?.squadId ?? null; }
function assertPartition(s: GameState) {
  const ids = s.squads.flatMap((sq) => sq.officerIds).concat(Object.values(s.officers).filter((o) => o.squadId === null).map((o) => o.id));
  expect([...ids].sort()).toEqual(Object.keys(s.officers).sort());
  expect(new Set(ids).size).toBe(ids.length);
  for (const sq of s.squads) {
    expect(sq.officerIds.length).toBeLessThanOrEqual(4);
    expect(sq.leaderId === null ? sq.officerIds.length === 0 : sq.officerIds.includes(sq.leaderId)).toBe(true);
    for (const id of sq.officerIds) expect(s.officers[id].squadId).toBe(sq.id);
  }
}
function reserve(s: GameState, id = 'reserve_one'): Officer {
  const o = { ...structuredClone(s.officers.off_chen), id, squadId: null, injury: null, assignment: null, stress: 0 };
  s.officers[id] = o;
  return o;
}
function detach(s: GameState, id: Id) {
  const o = s.officers[id];
  const sq = s.squads.find((q) => q.id === o.squadId)!;
  sq.officerIds = sq.officerIds.filter((x) => x !== id);
  if (sq.leaderId === id) sq.leaderId = sq.officerIds[0] ?? null;
  o.squadId = null;
}
function deployedSquad(s: GameState, id: SquadId) {
  s.activeRun = { id: 'deployment', squadIds: [id], status: 'active' } as GameState['activeRun'];
}

describe('pure, explainable squad arrangement suggestions', () => {
  it('makes full-squad swaps atomically, preserves headcounts/leaders and changes only mappings', () => {
    const s = improvableState(), original = structuredClone(s), p = proposal(s);
    expect(p.after.squads.map((q) => q.officerIds.length)).toEqual([4, 4]);
    expect(p.after.squads.map((q) => q.leaderId)).toEqual(p.before.squads.map((q) => q.leaderId));
    expect(planSquadArrangement(s, OPTIONS).moves.length).toBeGreaterThanOrEqual(2);
    expect(applySquadArrangement(s, p)).toEqual({ ok: true });
    assertPartition(s);
    for (const [id, o] of Object.entries(s.officers)) expect({ ...o, squadId: original.officers[id].squadId }).toEqual(original.officers[id]);
    for (const sq of s.squads) expect({ ...sq, officerIds: original.squads.find((q) => q.id === sq.id)!.officerIds }).toEqual(original.squads.find((q) => q.id === sq.id));
    expect(s.department).toEqual(original.department);
    expect(s.units).toEqual(original.units);
    expect(s.rngState).toBe(original.rngState);
    expect(s.candidates).toEqual(original.candidates);
    expect(s.personnel).toEqual(original.personnel);
    expect(squadArrangementState(s).undo).toEqual({ before: p.before, after: p.after });
  });

  it('preview/cancel never mutate state or consume either source of randomness', () => {
    const s = state(), before = structuredClone(s);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected RNG'); });
    try {
      const first = planSquadArrangement(s, OPTIONS);
      expect(planSquadArrangement(s, OPTIONS)).toEqual(first);
      expect(s).toEqual(before);
    } finally { random.mockRestore(); }
  });

  it('is invariant to names, portraits, birth dates and demographic presentation fields', () => {
    const s = state(), changed = structuredClone(s);
    for (const o of Object.values(changed.officers)) Object.assign(o, { firstName: 'Different', surname: 'Person', portrait: '/elsewhere.png', bornDay: -100, pronouns: 'they/them', gender: 'unspecified', culture: 'different' });
    expect(squadArrangementToken(changed)).toBe(squadArrangementToken(s));
    expect(planSquadArrangement(changed, OPTIONS)).toEqual(planSquadArrangement(s, OPTIONS));
  });

  it('does not inspect hidden scenario truth or operation RNG while planning the roster', () => {
    const s = improvableState(), baseline = planSquadArrangement(s, OPTIONS);
    s.activeRun = { squadIds: [], status: 'active' } as unknown as NonNullable<GameState['activeRun']>;
    for (const key of ['people', 'knowledge', 'flags', 'rngState', 'scenarioId']) Object.defineProperty(s.activeRun, key, {
      get() { throw new Error(`Planner inspected operation data: ${key}`); },
    });
    expect(planSquadArrangement(s, OPTIONS)).toEqual(baseline);
  });

  it('uses actual certification, stress-adjusted execution eligibility and documented mentoring', () => {
    const s = state();
    const before = summarizeSquadArrangement(s, squadTopology(s));
    expect(before[0].coverage).toContain('crisis negotiator');
    expect(before[1].coverage).not.toContain('crisis negotiator');
    expect(before[1].mentoring.join(' ')).toMatch(/rookie.*mentor/);
    expect(before[1].mentoring.join(' ')).toMatch(/veteran/);
    s.officers.off_okafor.stress = 60;
    const after = summarizeSquadArrangement(s, squadTopology(s));
    expect(after[1].coverage).not.toContain('entry-trained officer');
    expect(after[1].gaps).toContain('No available entry-trained officer');
    expect(after[1].deployable).toBe(4);
  });

  it('balances fresh coverage even though strained and overloaded members remain deployable', () => {
    const s = state();
    for (const o of Object.values(s.officers)) {
      o.stress = o.squadId === 'A' ? 0 : 35;
      o.ratings = { shooting: 50, communication: 50, awareness: 50, medical: 50, coordination: 50, composure: 50 };
      o.certs = []; o.traits = []; o.serviceStartDay = -365 * 5;
    }
    const p = planSquadArrangement(s, OPTIONS);
    expect(p.after.map((q) => q.fresh)).toEqual([2, 2]);
    expect(p.after.map((q) => q.deployable)).toEqual([4, 4]);
  });

  it('returns useful no-improvement feedback instead of manufacturing movement', () => {
    const s = state();
    for (const o of Object.values(s.officers)) {
      o.ratings = { shooting: 50, communication: 50, awareness: 50, medical: 50, coordination: 50, composure: 50 };
      o.certs = []; o.traits = []; o.stress = 0; o.serviceStartDay = -365 * 5;
    }
    const before = structuredClone(s), p = planSquadArrangement(s, OPTIONS);
    expect(p.proposal).toBeNull(); expect(p.reason).toMatch(/No improving arrangement/); expect(p.moves).toEqual([]);
    expect(s).toEqual(before);
  });

  it('fills vacancies only after the explicit reserve option and never benches assigned officers', () => {
    const s = state(); detach(s, 'off_chen'); reserve(s);
    const without = planSquadArrangement(s, OPTIONS);
    expect(without.after.find((sq) => sq.squadId === 'A')!.officerIds.length).toBe(3);
    const withReserve = proposal(s, { ...OPTIONS, includeUnassigned: true });
    expect(withReserve.after.squads.map((q) => q.officerIds.length)).toEqual([4, 4]);
    for (const o of Object.values(s.officers).filter((o) => o.squadId !== null)) expect(mapped(withReserve.after, o.id)).not.toBeNull();
    expect(applySquadArrangement(s, withReserve)).toEqual({ ok: true }); assertPartition(s);
  });

  it('includes recovery and patrol income effects for moves between duties', () => {
    const p = planSquadArrangement(improvableState(), OPTIONS);
    expect(p.moves.some((m) => /patrol.*standby|standby.*patrol/.test(m.dutyImpact ?? ''))).toBe(true);
    expect(p.moves.some((m) => m.dutyImpact?.includes('$150/h'))).toBe(true);
    expect(p.moves.every((m) => m.reasons.length > 0)).toBe(true);
  });

  it('handles all four full squads while preserving excluded and locked rosters', () => {
    const s = improvableState();
    for (const squadId of ['C', 'D'] as const) {
      const ids = [0, 1, 2, 3].map((i) => {
        const o = reserve(s, `${squadId}_${i}`); o.squadId = squadId; o.stress = i * 15;
        return o.id;
      });
      s.squads.push({ id: squadId, name: squadId, officerIds: ids, leaderId: ids[0], duty: 'rest', loadoutPreset: {} });
    }
    setSquadArrangementLock(s, { kind: 'squad', squadId: 'C' }, true);
    const preserved = structuredClone(s.squads.slice(2));
    const p = proposal(s, { ...OPTIONS, squadIds: ['A', 'B', 'C'], preserveLeaders: false });
    expect(applySquadArrangement(s, p)).toEqual({ ok: true }); assertPartition(s);
    expect(s.squads.map((sq) => sq.officerIds.length)).toEqual([4, 4, 4, 4]);
    expect(s.squads.slice(2)).toEqual(preserved);
  });
});

describe('locks, unavailable seats and exact boundaries', () => {
  it.each([29.999, 30, 59.999, 60, 79.999, 80])('matches actual readiness at stress %s', (stress) => {
    const s = state(), o = s.officers.off_chen; o.stress = stress;
    const r = officerArrangementReadiness(s, o);
    expect(r.fresh).toBe(stress < 30); expect(r.deployable).toBe(stress < 80);
  });

  it('uses active injury deadline and settled training assignment rather than elapsed wall time', () => {
    const s = state(), o = s.officers.off_chen;
    o.injury = { label: 'Sprain', until: T0 + 1 };
    expect(officerArrangementReadiness(s, o).deployable).toBe(false);
    o.injury.until = T0;
    expect(officerArrangementReadiness(s, o).deployable).toBe(true);
    o.assignment = { kind: 'training', courseId: 'communication_refresher', startedAt: T0 - HOUR_MS, endsAt: T0 };
    expect(officerArrangementReadiness(s, o).deployable).toBe(false);
  });

  it('protects individual assignment locks including an unassigned officer', () => {
    const s = state(); detach(s, 'off_chen'); reserve(s);
    expect(setSquadArrangementLock(s, { kind: 'officer', officerId: 'off_chen' }, true)).toEqual({ ok: true });
    expect(setSquadArrangementLock(s, { kind: 'officer', officerId: 'off_reyes' }, true)).toEqual({ ok: true });
    const p = planSquadArrangement(s, { ...OPTIONS, includeUnassigned: true, preserveLeaders: false });
    expect(p.after.find((q) => q.squadId === 'B')!.officerIds).toContain('off_reyes');
    expect(p.after.flatMap((q) => q.officerIds)).not.toContain('off_chen');
    expect(p.protected).toContainEqual({ officerId: 'off_chen', reason: 'Locked as unassigned' });
  });

  it('whole squad lock protects roster, leadership and empty seats', () => {
    const s = state(); detach(s, 'off_chen'); reserve(s);
    setSquadArrangementLock(s, { kind: 'squad', squadId: 'A' }, true);
    const p = planSquadArrangement(s, { ...OPTIONS, includeUnassigned: true, preserveLeaders: false });
    expect(p.after.find((q) => q.squadId === 'A')).toMatchObject({ officerIds: s.squads[0].officerIds, leaderId: s.squads[0].leaderId });
  });

  it('keeps a locked nonleader out of leader selection so Apply remains immediately undoable', () => {
    const s = improvableState(), locked = s.officers.off_chen;
    locked.ratings.coordination = 100; locked.ratings.composure = 100;
    setSquadArrangementLock(s, { kind: 'officer', officerId: locked.id }, true);
    const p = proposal(s, { ...OPTIONS, preserveLeaders: false });
    expect(p.after.squads.every((sq) => sq.leaderId !== locked.id)).toBe(true);
    expect(mapped(p.after, locked.id)).toBe(locked.squadId);
    expect(applySquadArrangement(s, p)).toEqual({ ok: true });
    expect(undoSquadArrangementCheck(s)).toEqual({ ok: true });
    expect(undoSquadArrangement(s)).toEqual({ ok: true });
    expect(squadTopology(s)).toEqual(p.before);
  });

  it('rejects a forged promotion of a locked nonleader without mutating the arrangement', () => {
    const s = improvableState();
    setSquadArrangementLock(s, { kind: 'officer', officerId: 'off_chen' }, true);
    const p = proposal(s, { ...OPTIONS, preserveLeaders: false });
    p.after.squads.find((sq) => sq.squadId === 'B')!.leaderId = 'off_chen';
    const before = structuredClone(s), result = applySquadArrangement(s, p);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toMatch(/protected.*promoted/);
    expect(s).toEqual(before);
  });

  it.each(['training', 'operation', 'injury', 'recovery'] as const)('never moves an officer in %s', (kind) => {
    const s = state(), o = s.officers.off_chen;
    if (kind === 'training') o.assignment = { kind, courseId: 'communication_refresher', startedAt: T0, endsAt: T0 + HOUR_MS };
    if (kind === 'operation') o.assignment = { kind, runId: 'busy' };
    if (kind === 'injury') o.injury = { label: 'Sprain', until: T0 + HOUR_MS };
    if (kind === 'recovery') o.stress = 80;
    const p = planSquadArrangement(s, { ...OPTIONS, preserveLeaders: false });
    expect(p.after.find((sq) => sq.squadId === 'A')!.officerIds).toContain(o.id);
    expect(p.protected.some((x) => x.officerId === o.id)).toBe(true);
  });

  it('protects all members of a deployed squad even without individual operation assignments', () => {
    const s = state(); deployedSquad(s, 'A');
    const p = planSquadArrangement(s, { ...OPTIONS, preserveLeaders: false });
    expect(p.after[0]).toMatchObject({ officerIds: s.squads[0].officerIds, leaderId: s.squads[0].leaderId, deployable: 0, fresh: 0 });
    expect(p.protected.filter((x) => x.reason === 'Squad is deployed')).toHaveLength(4);
  });

  it('never changes unselected squads and reports one available member as 1/4', () => {
    const s = state();
    for (const id of s.squads[0].officerIds.slice(1)) s.officers[id].stress = 80;
    const p = planSquadArrangement(s, { ...OPTIONS, squadIds: ['B'], preserveLeaders: false });
    expect(p.after[0]).toMatchObject({ officerIds: s.squads[0].officerIds, leaderId: s.squads[0].leaderId, deployable: 1, unavailable: 3 });
  });
});

describe('transaction validation and persistent undo', () => {
  it('dispatch applies and undoes in one transaction without spending funding or DP', () => {
    const s = improvableState(), p = proposal(s);
    const applied = dispatch(s, { type: 'applySquadArrangement', proposal: p }, { now: T0 });
    expect(applied.result).toEqual({ ok: true }); assertPartition(applied.state);
    expect(applied.state.department.devPoints).toBe(s.department.devPoints);
    const undone = dispatch(applied.state, { type: 'undoSquadArrangement' }, { now: T0 });
    expect(undone.result).toEqual({ ok: true }); expect(squadTopology(undone.state)).toEqual(p.before);
    expect(undone.state.department.funding).toBe(s.department.funding);
  });

  it('tiny clock settlement without relevant score changes does not make every Apply stale', () => {
    const s = improvableState(), p = proposal(s);
    const result = dispatch(s, { type: 'applySquadArrangement', proposal: p }, { now: T0 + 100 });
    expect(result.result).toEqual({ ok: true });
  });

  it.each(['hire', 'dismiss', 'rating', 'certificate', 'movement', 'leader', 'duty', 'lock', 'injury', 'training', 'deployment', 'capacity', 'stress30', 'stress60', 'stress80'] as const)('refuses a preview stale after %s without partial mutation', (kind) => {
    const s = improvableState(), p = proposal(s);
    if (kind === 'hire') reserve(s);
    if (kind === 'dismiss') { detach(s, 'off_chen'); delete s.officers.off_chen; }
    if (kind === 'rating') s.officers.off_chen.ratings.communication += 1;
    if (kind === 'certificate') s.officers.off_reyes.certs.push('crisis_negotiation');
    if (kind === 'movement') detach(s, 'off_chen');
    if (kind === 'leader') s.squads[0].leaderId = 'off_park';
    if (kind === 'duty') s.squads[0].duty = 'rest';
    if (kind === 'lock') setSquadArrangementLock(s, { kind: 'officer', officerId: 'off_chen' }, true);
    if (kind === 'injury') s.officers.off_chen.injury = { label: 'Sprain', until: T0 + HOUR_MS };
    if (kind === 'training') s.officers.off_chen.assignment = { kind: 'training', courseId: 'communication_refresher', startedAt: T0, endsAt: T0 + HOUR_MS };
    if (kind === 'deployment') deployedSquad(s, 'A');
    if (kind === 'capacity') s.department.rosterCap += 1;
    if (kind.startsWith('stress')) s.officers.off_chen.stress = Number(kind.slice(6));
    const before = structuredClone(s), result = applySquadArrangement(s, p);
    expect(result).toMatchObject({ ok: false }); expect(result.ok ? '' : result.reason).toMatch(/stale/); expect(s).toEqual(before);
  });

  it('revalidates after dispatch settles course completion and fresh/recovery boundaries', () => {
    const s = state();
    s.officers.off_chen.assignment = { kind: 'training', courseId: 'communication_refresher', startedAt: T0 - HOUR_MS, endsAt: T0 + 1000 };
    const p = proposal(s, { ...OPTIONS, preserveLeaders: false });
    const result = dispatch(s, { type: 'applySquadArrangement', proposal: p }, { now: T0 + 1001 });
    expect(result.result.ok).toBe(false); expect(result.state).toBe(s);
  });

  it.each(['duplicate', 'lost', 'unknown', 'capacity', 'invalidLeader', 'locked', 'headcount'] as const)('rejects manipulated %s topology atomically', (kind) => {
    const s = improvableState(), p = proposal(s);
    if (kind === 'duplicate') p.after.squads[0].officerIds[0] = p.after.squads[1].officerIds[0];
    if (kind === 'lost') p.after.squads[0].officerIds.splice(0, 1);
    if (kind === 'unknown') p.after.squads[0].officerIds[0] = 'unknown';
    if (kind === 'capacity') p.after.squads[0].officerIds.push(p.after.squads[1].officerIds.pop()!);
    if (kind === 'invalidLeader') p.after.squads[0].leaderId = 'unknown';
    if (kind === 'locked') {
      const id = Object.keys(s.officers).find((id) => mapped(p.after, id) !== mapped(p.before, id))!;
      setSquadArrangementLock(s, { kind: 'officer', officerId: id }, true); p.token = squadArrangementToken(s);
    }
    if (kind === 'headcount') { const id = p.after.squads[0].officerIds.find((id) => id !== p.after.squads[0].leaderId)!; p.after.squads[0].officerIds = p.after.squads[0].officerIds.filter((x) => x !== id); p.after.unassignedIds.push(id); }
    const before = structuredClone(s);
    expect(applySquadArrangement(s, p).ok).toBe(false); expect(s).toEqual(before);
  });

  it.each(['lock', 'training', 'injury', 'recovery', 'deployed', 'newerMovement', 'newerLeader', 'hire'] as const)('unsafe undo refuses after %s and leaves state untouched', (kind) => {
    const s = improvableState(), p = proposal(s); expect(applySquadArrangement(s, p).ok).toBe(true);
    const id = Object.keys(s.officers).find((id) => mapped(p.after, id) !== mapped(p.before, id))!;
    if (kind === 'lock') setSquadArrangementLock(s, { kind: 'officer', officerId: id }, true);
    if (kind === 'training') s.officers[id].assignment = { kind: 'training', courseId: 'communication_refresher', startedAt: T0, endsAt: T0 + HOUR_MS };
    if (kind === 'injury') s.officers[id].injury = { label: 'Sprain', until: T0 + HOUR_MS };
    if (kind === 'recovery') s.officers[id].stress = 80;
    if (kind === 'deployed') deployedSquad(s, s.officers[id].squadId!);
    if (kind === 'newerMovement') detach(s, id);
    if (kind === 'newerLeader') s.squads[0].leaderId = s.squads[0].officerIds.find((x) => x !== s.squads[0].leaderId)!;
    if (kind === 'hire') reserve(s);
    const before = structuredClone(s);
    expect(undoSquadArrangementCheck(s).ok).toBe(false); expect(undoSquadArrangement(s).ok).toBe(false); expect(s).toEqual(before);
  });

  it('undo restores only mappings/leaders and preserves later condition, spending, training and earned DP', () => {
    const s = improvableState(), p = proposal(s); applySquadArrangement(s, p);
    s.department.funding += 700; s.department.devPoints += 40;
    s.officers.off_brooks.ratings.shooting += 3;
    s.officers.off_brooks.stress += 2;
    s.officers.off_brooks.assignment = { kind: 'training', courseId: 'composure_workshop', startedAt: T0, endsAt: T0 + HOUR_MS };
    const current = structuredClone(s);
    expect(undoSquadArrangement(s)).toEqual({ ok: true });
    expect(squadTopology(s)).toEqual(p.before); expect(s.department).toEqual(current.department);
    expect(s.officers.off_brooks).toEqual(current.officers.off_brooks);
    expect(squadArrangementState(s).undo).toBeUndefined();
  });

  it('undo safely returns newly placed reserve officers to unassigned', () => {
    const s = state(); detach(s, 'off_chen');
    const p = proposal(s, { ...OPTIONS, includeUnassigned: true });
    expect(applySquadArrangement(s, p)).toEqual({ ok: true });
    expect(s.officers.off_chen.squadId).not.toBeNull();
    expect(undoSquadArrangement(s)).toEqual({ ok: true });
    expect(s.officers.off_chen.squadId).toBeNull();
    expect(squadTopology(s)).toEqual(p.before);
  });

  it.each([30, 80])('settling across stress %s invalidates a preview before any arrangement mutation', (boundary) => {
    const s = improvableState();
    s.officers.off_chen.stress = boundary + .00001;
    const p = proposal(s);
    const result = dispatch(s, { type: 'applySquadArrangement', proposal: p }, { now: T0 + 1000 });
    expect(result.result.ok).toBe(false);
    expect(result.result.ok ? '' : result.result.reason).toMatch(/stale/);
    expect(result.state).toBe(s);
  });

  it('persists locks and undo through save/reload, then applies a safe mapping-only restoration', () => {
    const s = improvableState();
    setSquadArrangementLock(s, { kind: 'officer', officerId: 'off_brooks' }, true);
    const p = proposal(s); applySquadArrangement(s, p);
    const loaded = deserialize(serialize(s, T0));
    expect(loaded).not.toBeNull();
    expect(squadArrangementState(loaded!)).toEqual(squadArrangementState(s));
    expect(undoSquadArrangement(loaded!)).toEqual({ ok: true }); expect(squadTopology(loaded!)).toEqual(p.before);
  });

  it('sanitizes optional malformed lock/undo state without changing the roster or balance', () => {
    const s = state(), before = structuredClone(s);
    Object.assign(s, { squadArrangement: { officerLocks: ['gone', 'off_chen', 'off_chen', 44], squadLocks: ['A', 'A', 'Z'], undo: { before: null, after: {} } } });
    normalizeSquadArrangementState(s);
    expect(squadArrangementState(s)).toEqual({ officerLocks: ['off_chen'], squadLocks: ['A'] });
    expect(s.officers).toEqual(before.officers); expect(s.department).toEqual(before.department);
    expect(validateSquadTopology(s, squadTopology(s))).toEqual({ ok: true });
  });
});
