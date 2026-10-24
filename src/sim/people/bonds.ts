// Bonds (docs/world-redesign.md, "Bonds"). States, not scores: acquainted, trusted, close, mentor, tense and
// strained, each with a hidden drift toward the next state. Shared calls and shifts that go well drift a bond
// up; only a recorded cause (a rear left open in a step, a promotion over the other, a breakup) drags it
// down, so an adverse call alone never costs a bond. About two bonds per officer reach the player as beats.
//
// Romance has the same mechanics as a close bond and nothing more. It forms only between two employed
// officers who are both open to it, neither supervising the other, after a close bond has held for a while.
// It is never forced, bought or engineered by the player: no command touches it. It ends with a recorded
// cause and turns the pair tense for a while.
import type { GameState, Id, Officer } from '../types';
import { rankOf } from '../ranks';
import { rankIndex } from '../../content/ranks';
import type { Bond, BondState, PeopleState } from './types';
import type { CallRead } from './call-read';
import { rankPosition } from './call-read';
import { hashUnit, pairKey, raiseBeat } from './core';
import { PEOPLE_TUNING } from './tuning';

type Cause = Bond['cause'];

export function findBond(p: Pick<PeopleState, 'bonds'>, a: Id, b: Id): Bond | undefined {
  const [x, y] = pairKey(a, b);
  return p.bonds.find((bond) => bond.a === x && bond.b === y);
}

function ensureBond(d: GameState, a: Id, b: Id, now: number, cause: Cause): Bond {
  const found = findBond(d.people, a, b);
  if (found) return found;
  const [x, y] = pairKey(a, b);
  const bond: Bond = { a: x, b: y, state: 'acquainted', drift: 0, since: now, cause };
  d.people.bonds.push(bond);
  return bond;
}

const isEmployed = (d: Pick<GameState, 'people' | 'officers'>, id: Id): boolean => !!d.officers[id] && (d.people.records[id]?.status ?? 'employed') === 'employed';

/** The bonds an officer has, strongest states first, for the "about two" rule. */
const SIGNIFICANT: readonly BondState[] = ['trusted', 'close', 'mentor', 'tense', 'strained'];
function significantBonds(d: GameState, officerId: Id): Bond[] {
  return d.people.bonds
    .filter((b) => (b.a === officerId || b.b === officerId) && SIGNIFICANT.includes(b.state))
    .sort((x, y) => y.since - x.since || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
}

/** A state change becomes a beat only when it is among each officer's two newest significant bonds. */
function worthABeat(d: GameState, bond: Bond): boolean {
  return [bond.a, bond.b].every((id) => significantBonds(d, id).slice(0, 2).includes(bond));
}

function moveTo(d: GameState, bond: Bond, state: BondState, cause: Cause, now: number, collect?: Id[]): void {
  bond.state = state;
  bond.drift = 0;
  bond.since = now;
  bond.cause = cause;
  if (bond.romance && !bond.romance.ended && state !== 'close') {
    bond.romance = { ...bond.romance, ended: now };
    bond.cause = { kind: 'breakup', ...(cause.place !== undefined ? { place: cause.place } : {}), at: now };
    raiseBeat(d, 'romance', [bond.a, bond.b], now, `${bond.a}:${bond.b}:ended`, collect);
  }
  if (worthABeat(d, bond)) raiseBeat(d, 'bond_changed', [bond.a, bond.b], now, `${bond.a}:${bond.b}:${state}`, collect);
}

/** Move a bond's hidden drift and follow it through any state change it causes. */
export function driftBond(d: GameState, bond: Bond, delta: number, cause: Cause, now: number, collect?: Id[], recorded = false): void {
  const T = PEOPLE_TUNING.bond;
  // A recorded cause cancels any progress the bond had made toward the next state, then drags it down.
  bond.drift = Math.max(-100, Math.min(100, (recorded ? Math.min(0, bond.drift) : bond.drift) + delta));
  for (let guard = 0; guard < 3; guard++) {
    let next: BondState | null = null;
    let why: Cause = cause;
    switch (bond.state) {
      case 'acquainted': next = bond.drift >= T.upAt.acquainted ? 'trusted' : bond.drift <= T.tenseAt ? 'tense' : null; break;
      case 'trusted': next = bond.drift >= T.upAt.trusted ? 'close' : bond.drift <= T.tenseAt ? 'tense' : null; break;
      case 'close': case 'mentor': next = bond.drift <= T.tenseAt ? 'tense' : null; break;
      case 'tense':
        if (bond.drift <= T.strainedAt) next = 'strained';
        else if (bond.drift >= T.repairTenseAt) { next = 'acquainted'; why = { kind: 'repair', ...(cause.place !== undefined ? { place: cause.place } : {}), at: now }; }
        break;
      case 'strained':
        if (bond.drift >= T.repairStrainedAt) { next = 'tense'; why = { kind: 'repair', ...(cause.place !== undefined ? { place: cause.place } : {}), at: now }; }
        break;
    }
    if (!next) return;
    moveTo(d, bond, next, why, now, collect);
  }
}

// ---------------------------------------------------------------- supervision and romance

/** Whether `boss` supervises `other`: a squad leader over a member, or a mentor over a trainee. */
export function supervises(d: Pick<GameState, 'squads' | 'people' | 'officers'>, boss: Id, other: Id): boolean {
  if (boss === other) return false;
  const squad = d.squads.find((s) => s.officerIds.includes(other));
  if (squad && squad.leaderId === boss) return true;
  const bond = findBond(d.people, boss, other);
  return bond?.state === 'mentor';
}

export function romanceEligible(d: GameState, bond: Bond): boolean {
  const ra = d.people.records[bond.a], rb = d.people.records[bond.b];
  if (!isEmployed(d, bond.a) || !isEmployed(d, bond.b) || !ra?.openToRelationship || !rb?.openToRelationship) return false;
  return !supervises(d, bond.a, bond.b) && !supervises(d, bond.b, bond.a);
}

/** Start a romance on a close bond that has held long enough, when the pair is eligible and inclined. */
function tryRomance(d: GameState, bond: Bond, now: number, collect?: Id[]): void {
  if (bond.state !== 'close' || bond.romance) return;
  if (now - bond.since < PEOPLE_TUNING.romance.closeForMs) return;
  if (!romanceEligible(d, bond)) return;
  if (hashUnit(d.world?.seed ?? 0, `romance:${bond.a}:${bond.b}`) >= PEOPLE_TUNING.romance.inclined) return;
  bond.romance = { since: now };
  raiseBeat(d, 'romance', [bond.a, bond.b], now, `${bond.a}:${bond.b}`, collect);
}

/** A romance that is no longer eligible (one now supervises the other, one has left) ends with a recorded
 * cause and turns the pair tense. */
function reviewRomance(d: GameState, bond: Bond, now: number, collect?: Id[]): void {
  if (!bond.romance || bond.romance.ended !== undefined) return;
  if (romanceEligible(d, bond)) return;
  moveTo(d, bond, 'tense', { kind: 'breakup', at: now }, now, collect);
}

/** Departure of either partner ends their romances. */
export function endAllRomancesFor(d: GameState, officerId: Id, now: number): void {
  for (const bond of d.people.bonds) {
    if (bond.a !== officerId && bond.b !== officerId) continue;
    if (bond.romance && bond.romance.ended === undefined) {
      bond.romance = { ...bond.romance, ended: now };
      bond.state = 'tense';
      bond.drift = 0;
      bond.since = now;
      bond.cause = { kind: 'breakup', at: now };
    }
  }
}

// ---------------------------------------------------------------- mentors

function mentorOver(d: GameState, bond: Bond): { mentor: Officer; trainee: Officer } | null {
  const a = d.officers[bond.a], b = d.officers[bond.b];
  if (!a || !b) return null;
  const gap = (hi: Officer, lo: Officer) => rankIndex(rankOf(hi)) - rankIndex(rankOf(lo));
  if (a.traits.includes('mentor') && gap(a, b) >= PEOPLE_TUNING.bond.mentorRankGap) return { mentor: a, trainee: b };
  if (b.traits.includes('mentor') && gap(b, a) >= PEOPLE_TUNING.bond.mentorRankGap) return { mentor: b, trainee: a };
  return null;
}

// ---------------------------------------------------------------- a closed call

/** Shared operations drift bonds up when they go well; the causes in the call drag them down. */
export function applyCallBonds(d: GameState, read: CallRead, collect?: Id[]): void {
  const now = read.at;
  const ids = [...new Set(read.participants)].filter((id) => isEmployed(d, id)).sort();
  const T = PEOPLE_TUNING.bond;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const shared: Cause = { kind: 'shared_call', place: read.place, at: now };
      const bond = ensureBond(d, a, b, now, shared);
      const gain = read.verdict === 'favorable' ? T.gain.favorable : read.verdict === 'adverse' ? T.gain.adverse : T.gain.mixed;
      if (gain) driftBond(d, bond, gain, shared, now, collect);

      // A rear left open: one of the pair was on an adverse rear step and the other was not.
      if (read.rearAdverse.has(a) !== read.rearAdverse.has(b)) driftBond(d, bond, T.cause.rear_left_open, { kind: 'rear_left_open', place: read.place, at: now }, now, collect, true);

      // A promotion over the other: peers in one squad, one reached a rank the other holds now.
      const pa = read.promoted[a], pb = read.promoted[b];
      if ((pa !== undefined) !== (pb !== undefined)) {
        const [winner, other] = pa !== undefined ? [a, b] : [b, a];
        const reached = rankPosition(read.promoted[winner]);
        const oa = d.officers[other], ow = d.officers[winner];
        if (oa && ow && rankIndex(rankOf(oa)) === reached - 1 && oa.squadId && oa.squadId === ow.squadId) driftBond(d, bond, T.cause.promotion, { kind: 'promotion', place: read.place, at: now }, now, collect, true);
      }

      // Mentoring: a mentor-trait officer over a lower rank, after enough calls side by side.
      const ra = d.people.records[a], pairShared = ra?.shared[b] ?? 0;
      if ((bond.state === 'acquainted' || bond.state === 'trusted') && pairShared >= T.mentorShared && mentorOver(d, bond)) {
        moveTo(d, bond, 'mentor', { kind: 'mentoring', place: read.place, at: now }, now, collect);
      }

      reviewRomance(d, bond, now, collect);
      tryRomance(d, bond, now, collect);
    }
  }
  // Squad leadership may have changed since the last call.
  for (const bond of d.people.bonds) reviewRomance(d, bond, now, collect);
}

/** A proactive shift stopped: the officers who rode it drift together when it went well, apart when it
 * stopped for strain. */
export function applyShiftBonds(d: GameState, officerIds: Id[], stopReason: 'ended' | 'recalled' | 'strain' | undefined, place: string, now: number, collect?: Id[]): void {
  const ids = [...new Set(officerIds)].filter((id) => isEmployed(d, id)).sort();
  const T = PEOPLE_TUNING.bond;
  const delta = stopReason === 'strain' ? T.shiftStrain : T.gain.shift;
  const cause: Cause = { kind: 'shared_shift', place, at: now };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const bond = ensureBond(d, ids[i], ids[j], now, cause);
      driftBond(d, bond, delta, cause, now, collect);
      reviewRomance(d, bond, now, collect);
      tryRomance(d, bond, now, collect);
    }
  }
}

/** Time eases a tense bond back to acquainted. Events are offered by nextBondEventTime. */
export function easeTenseBonds(d: GameState, from: number, to: number, collect?: Id[]): void {
  const sorted = d.people.bonds.filter((b) => b.state === 'tense').sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  for (const bond of sorted) {
    const at = bond.since + PEOPLE_TUNING.bond.tenseEasesAfterMs;
    if (at > from && at <= to) moveTo(d, bond, 'acquainted', { kind: 'repair', at }, at, collect);
  }
}

export function nextBondEventTime(d: Pick<GameState, 'people'>, t: number): number | null {
  let best: number | null = null;
  for (const bond of d.people.bonds) {
    if (bond.state !== 'tense') continue;
    const at = bond.since + PEOPLE_TUNING.bond.tenseEasesAfterMs;
    if (at > t && (best === null || at < best)) best = at;
  }
  return best;
}
