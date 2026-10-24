// Person records through every employment change (docs/world-redesign.md, "Persistence"). One record per
// person for the campaign, keyed by officer id. While employed the live Officer is the authority for
// condition, ratings, certifications, traits, career and assignment; the record keeps what the Officer
// cannot (status, pages open, shared operations, the openness to a relationship) and, on every departure, a
// snapshot of the officer as they left, which a rehire restores. A rehire never rebuilds from
// PersonnelState.builds (the first-seen build).
import type { Candidate, GameState, Id, Officer } from '../types';
import { gameDay, msForGameDay, simNow } from '../calendar';
import { jacketFor } from '../../content/people/jackets';
import { recruitSigningCost } from './signing';
import type { PeopleState, PersonRecord } from './types';
import { PEOPLE_TUNING } from './tuning';
import { recordOf } from './core';
import { endAllRomancesFor } from './bonds';
import { seedTiesForOfficer } from './ties';

export function newRecord(o: Officer, now: number): PersonRecord {
  const identityId = o.identityId ?? o.id;
  return {
    officerId: o.id, identityId, status: 'employed', hiredAt: o.hiredAt ?? now, pagesOpen: 1, shared: {},
    openToRelationship: jacketFor(o.identityId).openToRelationship,
  };
}

/** A canonical record for every starting officer. */
export function createPeople(d: Pick<GameState, 'officers'>, now: number): PeopleState {
  const records: PeopleState['records'] = {};
  for (const o of Object.values(d.officers)) records[o.id] = newRecord(o, now);
  return { records, facts: [], imprints: [], settled: [], bonds: [], ties: [], beats: [], nextId: 1 };
}

/** The record for an officer, created on first sight (test fixtures and officers added outside the hire path). */
export function ensureRecord(d: GameState, o: Officer): PersonRecord {
  return (d.people.records[o.id] ??= newRecord(o, simNow(d)));
}

/** An officer joined (a hire or a rehire): create their record, or put a dismissed person's record back to
 * employed. The Officer itself was already placed by the hire (a rehire restored the snapshot). */
export function onOfficerHired(d: GameState, officerId: Id): void {
  const o = d.officers[officerId];
  if (!o) return;
  const now = simNow(d);
  const existing = recordOf(d, officerId);
  if (existing) {
    existing.status = 'employed';
    existing.hiredAt = existing.hiredAt || now;
    delete existing.leftAt;
    delete existing.rehireAfter;
    delete existing.snapshot;
  } else {
    d.people.records[officerId] = newRecord(o, now);
  }
  seedTiesForOfficer(d, officerId);
}

/** An officer is about to leave (dismissal or retirement): store them as they are, close what hangs on them,
 * and mark the record. Call before removing them from `officers`. */
export function onOfficerDeparted(d: GameState, officerId: Id, reason: 'dismissed' | 'retired'): void {
  const o = d.officers[officerId];
  if (!o) return;
  const record = ensureRecord(d, o);
  // Retirement happens inside the settlement walk, where the clock holds the walk's end, so a retiree's
  // leaving time is the day they were due to go: the same whatever the tick partition.
  const now = reason === 'retired' && o.retirement ? Math.min(msForGameDay(d, o.retirement.day), simNow(d)) : simNow(d);
  const snapshot = structuredClone(o);
  snapshot.assignment = null;
  snapshot.squadId = null;
  record.snapshot = snapshot;
  record.status = reason;
  record.leftAt = now;
  if (reason === 'dismissed') record.rehireAfter = now + PEOPLE_TUNING.rehireCooldownMs;
  else delete record.rehireAfter;
  closeImprintsFor(d, officerId);
  endAllRomancesFor(d, officerId, now);
}

/** A person leaving ends their notes, and any colleague's peer support or pairing that hung on them. */
function closeImprintsFor(d: GameState, officerId: Id): void {
  for (const im of d.people.imprints) {
    if (im.outcome) continue;
    if (im.officerId === officerId) {
      im.outcome = 'cleared';
      for (const other of Object.values(d.officers)) {
        if ((other.assignment?.kind === 'peer_support' || other.assignment?.kind === 'standdown') && other.assignment.imprintId === im.id) other.assignment = null;
      }
    } else if (im.fork?.choice === 'pair' && im.fork.partnerId === officerId) {
      // The partner is gone: the offer is open again.
      im.fork = { offeredAt: im.fork.offeredAt };
    }
  }
}

// ---------------------------------------------------------------- rehire

/** Whether a candidate is a returning person: a dismissed record for the same officer, past its cooldown. */
export function rehireCheck(d: Pick<GameState, 'people' | 'department'>, officer: Pick<Officer, 'id' | 'identityId'>, now: number): { ok: true; record: PersonRecord } | { ok: false; reason: string } {
  const record = d.people?.records[officer.id];
  if (!record || record.identityId !== (officer.identityId ?? officer.id)) return { ok: false, reason: 'That officer has already served in this campaign' };
  if (record.status !== 'dismissed' || !record.snapshot) return { ok: false, reason: 'That officer has already served in this campaign' };
  if (record.rehireAfter !== undefined && now < record.rehireAfter) return { ok: false, reason: 'That officer left recently and cannot be hired back yet' };
  return { ok: true, record };
}

export const isRehire = (d: Pick<GameState, 'people' | 'department'>, officer: Pick<Officer, 'id' | 'identityId'>, now: number): boolean => rehireCheck(d, officer, now).ok;

/** Dismissed people past their cooldown who are not on the roster: the records a rehire can come from. */
export function eligibleRehires(d: Pick<GameState, 'people' | 'officers'>, now: number): PersonRecord[] {
  return Object.values(d.people.records)
    .filter((r) => r.status === 'dismissed' && !!r.snapshot && !d.officers[r.officerId] && (r.rehireAfter === undefined || now >= r.rehireAfter))
    .sort((a, b) => a.officerId.localeCompare(b.officerId));
}

export const rehireCandidateId = (officerId: Id): string => `cand_rehire_${officerId}`;

/** One returning officer as a candidate, holding the officer as they left (never the first-seen build). An
 * injury that has healed while they were away is gone; an announced retirement that has lapsed is withdrawn;
 * stress, traits, certifications, ratings, career and rank are as they left. */
export function rehireCandidate(d: GameState, record: PersonRecord, now: number): Candidate {
  const officer = structuredClone(record.snapshot!);
  officer.squadId = null;
  officer.assignment = null;
  if (officer.injury && officer.injury.until <= now) officer.injury = null;
  if (officer.retirement && officer.retirement.reason !== 'age' && officer.retirement.day <= gameDay(d, now)) officer.retirement = null;
  officer.highStressSince = null;
  return { id: rehireCandidateId(record.officerId), officer, signingCost: recruitSigningCost(officer.wage), shortlisted: false, expiresAt: Number.MAX_SAFE_INTEGER };
}

export const rehireCandidates = (d: GameState, now: number): Candidate[] => eligibleRehires(d, now).map((r) => rehireCandidate(d, r, now));
