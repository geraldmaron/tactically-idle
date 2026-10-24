// Relational validation of a saved PeopleState (the lead wires this into sim/save.ts). It checks what the
// types cannot: references between records, the one-note rule, the fork-after-seen rule, caps, and ids.
// Returns the first problem as a sentence, or null when the records agree with each other and the roster.
import type { Officer } from '../types';
import { IMPRINT_PACKS } from '../../content/people/imprints';
import { FACT_DETAIL_MAX } from '../../content/people/facts';
import type { BondState, FactKind, PeopleBeatKind, PeopleState } from './types';
import { PEOPLE_TUNING } from './tuning';

const STATUSES = ['employed', 'dismissed', 'retired'];
const FACT_KINDS: readonly FactKind[] = ['first_call', 'rescue', 'injured', 'person_lost', 'negotiated', 'mentored', 'favorable_under_pressure', 'arrest', 'shift'];
const BOND_STATES: readonly BondState[] = ['acquainted', 'trusted', 'close', 'mentor', 'tense', 'strained'];
const BEAT_KINDS: readonly PeopleBeatKind[] = ['telegraph', 'fork_open', 'settled', 'bond_changed', 'romance', 'page_opened', 'tie_surfaced', 'memory'];
const TIE_KINDS = ['gym', 'neighbor', 'school', 'family_friend', 'church', 'prior_arrest', 'old_job'];
const OUTCOMES = ['cleared', 'settled_positive', 'settled_strain'];

export interface PeopleValidationContext {
  /** The live roster: employed records must match it. */
  officers: Readonly<Record<string, Officer>>;
  /** World subject ids, when the world is validated alongside, for tie references. */
  subjectIds?: ReadonlySet<string>;
}

const suffix = (id: string): number => Number(id.slice(id.lastIndexOf('_') + 1));

export function validPeopleState(p: PeopleState, ctx: PeopleValidationContext): string | null {
  if (!p || typeof p !== 'object') return 'People state is missing';
  if (!Number.isInteger(p.nextId) || p.nextId < 1) return 'People id counter is invalid';
  const known = (id: string) => Object.prototype.hasOwnProperty.call(p.records, id);
  let maxId = 0;
  const seenIds = new Set<string>();
  const track = (id: string, what: string): string | null => {
    if (typeof id !== 'string' || !id) return `A ${what} has no id`;
    if (seenIds.has(id)) return `Duplicate people id ${id}`;
    seenIds.add(id);
    const n = suffix(id);
    if (Number.isFinite(n)) maxId = Math.max(maxId, n);
    return null;
  };

  for (const [key, r] of Object.entries(p.records)) {
    if (r.officerId !== key) return `Record ${key} names a different officer`;
    if (!STATUSES.includes(r.status)) return `Record ${key} has an unknown status`;
    if (![1, 2, 3].includes(r.pagesOpen)) return `Record ${key} has an invalid page count`;
    if (typeof r.openToRelationship !== 'boolean') return `Record ${key} has no openness flag`;
    for (const [other, n] of Object.entries(r.shared)) {
      if (!known(other)) return `Record ${key} shares operations with unknown ${other}`;
      if (!Number.isInteger(n) || n < 1) return `Record ${key} has an invalid shared count`;
    }
    const live = ctx.officers[key];
    if (r.status === 'employed') {
      if (!live) return `Employed record ${key} has no officer`;
      if (r.snapshot) return `Employed record ${key} still holds a snapshot`;
      if (r.rehireAfter !== undefined || r.leftAt !== undefined) return `Employed record ${key} has departure times`;
    } else {
      if (live) return `${r.status} record ${key} still has a live officer`;
      if (!r.snapshot || r.snapshot.id !== key) return `${r.status} record ${key} has no snapshot`;
      if (r.leftAt === undefined) return `${r.status} record ${key} has no leaving time`;
      if (r.status === 'retired' && r.rehireAfter !== undefined) return `Retired record ${key} can be rehired`;
      if (r.status === 'dismissed' && r.rehireAfter === undefined) return `Dismissed record ${key} has no rehire time`;
    }
  }
  for (const id of Object.keys(ctx.officers)) if (!known(id) || p.records[id].status !== 'employed') return `Officer ${id} has no employed record`;

  for (const f of p.facts) {
    const bad = track(f.id, 'fact');
    if (bad) return bad;
    if (!known(f.officerId)) return `Fact ${f.id} names an unknown officer`;
    if (!FACT_KINDS.includes(f.kind)) return `Fact ${f.id} has an unknown kind`;
    if (typeof f.detail !== 'string' || !f.detail || f.detail.length > FACT_DETAIL_MAX) return `Fact ${f.id} has an invalid detail`;
    if (f.with.some((w) => !known(w))) return `Fact ${f.id} names an unknown colleague`;
  }

  const activeBy = new Set<string>();
  for (const im of p.imprints) {
    const bad = track(im.id, 'imprint');
    if (bad) return bad;
    if (!known(im.officerId)) return `Imprint ${im.id} names an unknown officer`;
    if (!IMPRINT_PACKS[im.pack]) return `Imprint ${im.id} has an unknown pack`;
    if (im.endsAt < im.startedAt) return `Imprint ${im.id} ends before it starts`;
    if (im.outcome !== undefined && !OUTCOMES.includes(im.outcome)) return `Imprint ${im.id} has an unknown outcome`;
    if (im.fork && !im.seen) return `Imprint ${im.id} has a fork before its telegraph was seen`;
    if (im.fork?.choice === 'pair' && (!im.fork.partnerId || !known(im.fork.partnerId))) return `Imprint ${im.id} pairs with an unknown partner`;
    if (im.fork?.partnerId && !known(im.fork.partnerId)) return `Imprint ${im.id} names an unknown partner`;
    if (!im.outcome) {
      if (activeBy.has(im.officerId)) return `Officer ${im.officerId} carries two notes`;
      activeBy.add(im.officerId);
      if (p.records[im.officerId].status !== 'employed') return `Imprint ${im.id} is open on someone who left`;
    }
  }

  const settledCount: Record<string, number> = {};
  for (const s of p.settled) {
    const bad = track(s.id, 'settled trait');
    if (bad) return bad;
    if (!known(s.officerId)) return `Settled trait ${s.id} names an unknown officer`;
    if (s.polarity !== 'positive' && s.polarity !== 'strain') return `Settled trait ${s.id} has an unknown polarity`;
    settledCount[s.officerId] = (settledCount[s.officerId] ?? 0) + 1;
    if (settledCount[s.officerId] > PEOPLE_TUNING.settledCap) return `Officer ${s.officerId} has more than ${PEOPLE_TUNING.settledCap} settled traits`;
  }

  const pairs = new Set<string>();
  for (const b of p.bonds) {
    if (!(b.a < b.b)) return `Bond ${b.a} ${b.b} is not in order`;
    if (!known(b.a) || !known(b.b)) return `Bond ${b.a} ${b.b} names an unknown officer`;
    if (!BOND_STATES.includes(b.state)) return `Bond ${b.a} ${b.b} has an unknown state`;
    const key = `${b.a}:${b.b}`;
    if (pairs.has(key)) return `Bond ${key} is listed twice`;
    pairs.add(key);
    if (b.romance && b.romance.ended === undefined) {
      if (!p.records[b.a].openToRelationship || !p.records[b.b].openToRelationship) return `Romance ${key} involves someone who is not open to it`;
      if (!ctx.officers[b.a] || !ctx.officers[b.b]) return `Romance ${key} involves someone who left`;
    }
  }

  for (const t of p.ties) {
    const bad = track(t.id, 'tie');
    if (bad) return bad;
    if (!known(t.officerId)) return `Tie ${t.id} names an unknown officer`;
    if (!TIE_KINDS.includes(t.kind)) return `Tie ${t.id} has an unknown kind`;
    if (ctx.subjectIds && !ctx.subjectIds.has(t.subjectId)) return `Tie ${t.id} names an unknown subject`;
  }

  for (const beat of p.beats) {
    const bad = track(beat.id, 'beat');
    if (bad) return bad;
    if (!BEAT_KINDS.includes(beat.kind)) return `Beat ${beat.id} has an unknown kind`;
    if (beat.officerIds.some((id) => !known(id))) return `Beat ${beat.id} names an unknown officer`;
  }

  if (p.nextId <= maxId) return 'People id counter is behind its records';
  return null;
}
