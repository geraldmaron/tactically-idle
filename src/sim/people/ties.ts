import { ARCHETYPES } from '../../content/city/archetypes';
// Ties (docs/world-redesign.md, "Officers know people"). An officer may know a person from where they grew
// up (a jacket tie) or from earlier work (a prior arrest). Ties are always on the record when they are used:
// the knowing officer can talk, someone else makes the arrest and handles evidence. A small share of jacket
// ties start off the record and surface later as a story beat. A tie never adds odds; the one visible,
// capped contributor for a known person belongs to the call engine.
import type { GameState, Id } from '../types';
import { jacketFor } from '../../content/people/jackets';
import { CASE_END, DISTRICT_PLACE } from '../../content/people/facts';
import { hashUnit, nextPeopleId, raiseBeat } from './core';
import { recordFact } from './memory';
import { HOUR_MS, PEOPLE_TUNING } from './tuning';
import type { Tie, TieKind } from './types';

const HASH_KIND = (kinds: readonly TieKind[], u: number): TieKind => kinds[Math.min(kinds.length - 1, Math.floor(u * kinds.length))];

export function tiesOf(d: Pick<GameState, 'people'>, officerId: Id): Tie[] {
  return d.people.ties.filter((t) => t.officerId === officerId);
}

/** An officer's home district, from their authored jacket. Templated jackets have none. */
export function homeDistrict(d: Pick<GameState, 'people' | 'officers'>, officerId: Id) {
  const record = d.people.records[officerId];
  const identity = record?.identityId ?? d.officers[officerId]?.identityId;
  return jacketFor(identity).page2?.district ?? null;
}

function maybeTie(d: GameState, officerId: Id, subjectId: Id, now: number): void {
  const subject = d.world.subjects[subjectId];
  const record = d.people.records[officerId];
  if (!subject || !record || record.status !== 'employed') return;
  const jacket = jacketFor(record.identityId);
  if (!jacket.page2 || jacket.page2.district !== subject.districtId || !jacket.tieKinds.length) return;
  if (d.people.ties.some((t) => t.officerId === officerId && t.subjectId === subjectId)) return;
  if (tiesOf(d, officerId).filter((t) => t.origin === 'jacket').length >= PEOPLE_TUNING.ties.cap) return;
  const seed = d.world.seed;
  if (hashUnit(seed, `tie:${officerId}:${subjectId}`) >= PEOPLE_TUNING.ties.share) return;
  const tie: Tie = {
    id: nextPeopleId(d.people, 'tie'), officerId, subjectId,
    kind: HASH_KIND(jacket.tieKinds, hashUnit(seed, `tie-kind:${officerId}:${subjectId}`)),
    origin: 'jacket',
    onRecord: hashUnit(seed, `tie-hidden:${officerId}:${subjectId}`) >= PEOPLE_TUNING.ties.hiddenShare,
    since: now,
  };
  d.people.ties.push(tie);
}

/** A world subject was generated: create jacket ties for employed officers from that subject's district. */
export function seedTiesForSubject(d: GameState, subjectId: Id): void {
  // Called from inside the settlement walk, where the department clock holds the walk's end. The hourly
  // roll index is the same however the walk was cut, so the tie's time comes from it.
  const now = (d.world.rolledThroughHour + 1) * HOUR_MS;
  for (const id of Object.keys(d.people.records).sort()) maybeTie(d, id, subjectId, now);
}

/** An officer joined: the subjects already in their home district may be people they know. */
export function seedTiesForOfficer(d: GameState, officerId: Id): void {
  const now = d.department.clockHighWater;
  for (const subjectId of Object.keys(d.world?.subjects ?? {}).sort()) maybeTie(d, officerId, subjectId, now);
}

/** Make a tie known: it goes on the record and a beat tells the player, once. Never an odds boost. */
export function surfaceTie(d: GameState, tie: Tie, at: number, collect?: Id[]): void {
  if (tie.onRecord) return;
  tie.onRecord = true;
  raiseBeat(d, 'tie_surfaced', [tie.officerId], at, tie.id, collect);
}

/** Officers on a call or case that involved this subject: any hidden tie to them comes to light. */
export function surfaceTiesFor(d: GameState, officerIds: readonly Id[], subjectId: Id, at: number, collect?: Id[]): void {
  for (const tie of d.people.ties) if (tie.subjectId === subjectId && !tie.onRecord && officerIds.includes(tie.officerId)) surfaceTie(d, tie, at, collect);
}

/** A world investigation an officer worked has closed: an `arrest` fact for each officer who worked it, and a
 * `prior_arrest` tie to the subject (or the surfacing of a hidden tie that was already there). */
export function recordCaseFact(d: GameState, caseId: Id): void {
  const c = d.world.cases.find((x) => x.id === caseId);
  if (!c) return;
  const at = c.paidAt ?? d.department.clockHighWater;
  const workers = [...new Set(c.officerIds)].filter((id) => d.people.records[id]).sort();
  for (const officerId of workers) {
    recordFact(d, {
      officerId, kind: 'arrest', at, place: DISTRICT_PLACE[c.districtId], caseId, with: workers.filter((id) => id !== officerId),
      slots: { role: (c.archetype ? ARCHETYPES[c.archetype].tierNames[c.tier - 1] : 'person').toLowerCase(), caseEnd: CASE_END[c.resolution] ?? 'in a close' },
    });
    const existing = d.people.ties.find((t) => t.officerId === officerId && t.subjectId === c.subjectId);
    if (!existing) {
      d.people.ties.push({ id: nextPeopleId(d.people, 'tie'), officerId, subjectId: c.subjectId, kind: 'prior_arrest', origin: 'play', onRecord: true, since: at });
    } else if (!existing.onRecord) {
      surfaceTie(d, existing, at);
    }
  }
}
