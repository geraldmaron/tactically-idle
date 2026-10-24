// Imprints, the aftercare fork and settled traits (docs/world-redesign.md, "Memory, imprints and settled
// traits"; swat-officer-stories SKILL.md chapter 6). An imprint is a temporary condition with a named cause
// and a real duration. It carries no number: stress stays the only figure on a roll.
//
// The rules the code holds, each with a test:
// - One note per officer at a time. A repeat of the same note inside its window, or a severe first trigger,
//   makes a fork due. The fork opens only after the player has seen the telegraph (`seen`); until then the
//   note neither expires nor settles.
// - Restraint is never punished: a call where everyone was safe and the squad held, waited or talked starts
//   no strain and moves none toward settling. A call that harmed a civilian never starts or advances any note.
// - The fork has three options and none wins on every axis. Rest is certain and costs availability. Peer
//   support costs a colleague's shift and the note stays open until the officer's next good call. Pairing
//   keeps the officer deployable and spends the partner's slot: the next call the two work together settles
//   the strain if it goes badly and the positive if it goes well.
// - Caps: three settled traits per officer, and one settled strain per officer per game week.
import type { GameState, Id, Officer } from '../types';
import { IMPRINT_PACKS, IMPRINT_PRIORITY, type ImprintPack, type TriggerCond } from '../../content/people/imprints';
import type { Imprint, SettledTrait } from './types';
import { findBond } from './bonds';
import type { CallRead } from './call-read';
import { isHighPressure } from './call-read';
import { employed, nextPeopleId, raiseBeat } from './core';
import { HOUR_MS, PEOPLE_TUNING } from './tuning';

export const activeImprint = (d: Pick<GameState, 'people'>, officerId: Id): Imprint | undefined =>
  d.people.imprints.find((i) => i.officerId === officerId && !i.outcome);

const settledOf = (d: Pick<GameState, 'people'>, officerId: Id): SettledTrait[] => d.people.settled.filter((s) => s.officerId === officerId);

/** True when this officer can no longer settle anything: the cap of settled traits is reached. */
export const atSettledCap = (d: Pick<GameState, 'people'>, officerId: Id): boolean => settledOf(d, officerId).length >= PEOPLE_TUNING.settledCap;

// ---------------------------------------------------------------- triggers

/** What this call says about one officer, in the vocabulary the packs' triggers use. */
export function flagsFor(d: GameState, read: CallRead, officerId: Id): Set<TriggerCond> {
  const f = new Set<TriggerCond>();
  if (read.verdict === 'adverse') f.add('adverse');
  if (read.verdict === 'favorable') f.add('favorable');
  if (read.shots) f.add('shots');
  if (read.rearAdverse.has(officerId)) f.add('rear_adverse');
  if (read.contactAdverse.has(officerId)) f.add('contact_adverse');
  if (read.contactFavorable.has(officerId)) f.add('contact_favorable');
  if (read.entryAdverse.has(officerId)) f.add('entry_adverse');
  if (read.subjectId) f.add('known_subject');
  if (read.participants.some((o) => o !== officerId && ['trusted', 'close', 'mentor'].includes(findBond(d.people, officerId, o)?.state ?? ''))) f.add('bonded_partner');
  if (isHighPressure(read)) f.add('high_pressure');
  const stress = read.stressAfter[officerId] ?? 0;
  if (stress >= PEOPLE_TUNING.overloadedStress) f.add('overloaded');
  if (stress >= PEOPLE_TUNING.criticalStress) f.add('stress_critical');
  if (read.hurt[officerId]) f.add('officer_hurt');
  if (read.disposition === 'resolved' || read.disposition === 'care_accepted') f.add('resolved');
  if (!read.forceUsed) f.add('no_force');
  return f;
}

const matches = (pack: ImprintPack, flags: ReadonlySet<TriggerCond>): boolean => pack.when.every((c) => flags.has(c));

/** The packs that fit one officer's call, in read order. A civilian harmed starts none, and a call where
 * everyone was safe and the squad held, waited or talked starts no strain. */
export function packsFor(read: CallRead, flags: ReadonlySet<TriggerCond>): ImprintPack[] {
  if (read.civilianHarm || read.personLost) return [];
  return IMPRINT_PRIORITY.map((id) => IMPRINT_PACKS[id]).filter((pack) => matches(pack, flags) && !(pack.origin === 'strain' && read.restraintSafe));
}

/** The strain locks only through an adverse step inside the pack's scope. */
export function strainScopeHolds(read: CallRead, officerId: Id, scope: ImprintPack['scope']): boolean {
  switch (scope) {
    case 'shots': return read.shots;
    case 'rear': return read.rearAdverse.has(officerId);
    case 'contact': return read.contactAdverse.has(officerId);
    case 'entry': return read.entryAdverse.has(officerId);
    case 'known_subject': return !!read.subjectId;
    case 'any': return read.onStep.has(officerId);
  }
}

// ---------------------------------------------------------------- settling

/** Close a note. When the officer is at a cap, or already has the trait, it clears instead of settling. */
export function settleImprint(d: GameState, im: Imprint, polarity: 'positive' | 'strain', now: number, collect?: Id[]): void {
  const pack = IMPRINT_PACKS[im.pack];
  const trait = polarity === 'positive' ? pack.positive : pack.strain;
  const officer = d.officers[im.officerId];
  const mine = settledOf(d, im.officerId);
  let blocked = mine.length >= PEOPLE_TUNING.settledCap || mine.some((s) => s.trait === trait.id);
  if (!blocked && polarity === 'strain') blocked = mine.some((s) => s.polarity === 'strain' && now - s.settledAt < PEOPLE_TUNING.strainWindowMs);
  if (!blocked && polarity === 'positive' && trait.existing && officer?.traits.includes(trait.existing)) blocked = true;
  if (blocked || !officer) { im.outcome = 'cleared'; return; }
  d.people.settled.push({
    id: nextPeopleId(d.people, 'set'), officerId: im.officerId, trait: trait.id, polarity,
    cause: { place: im.cause.place, at: im.cause.at }, settledAt: now,
  });
  if (polarity === 'positive' && trait.existing && !officer.traits.includes(trait.existing)) officer.traits.push(trait.existing);
  im.outcome = polarity === 'positive' ? 'settled_positive' : 'settled_strain';
  raiseBeat(d, 'settled', [im.officerId], now, im.id, collect);
}

export function clearImprint(d: GameState, im: Imprint, now: number, collect?: Id[]): void {
  im.outcome = 'cleared';
  raiseBeat(d, 'settled', [im.officerId], now, im.id, collect);
}

// ---------------------------------------------------------------- a closed call

/** Peer support clears on the officer's next good call; a pairing settles on the next call the pair works
 * together. Runs before new notes start, so a note never advances on the call that made it. */
export function advanceImprints(d: GameState, read: CallRead, collect?: Id[]): void {
  const now = read.at;
  for (const id of read.participants) {
    const im = activeImprint(d, id);
    if (!im || !read.onStep.has(id)) continue;
    const choice = im.fork?.choice;
    if (choice === 'peer' && read.verdict === 'favorable') {
      clearImprint(d, im, now, collect);
    } else if (choice === 'pair' && im.fork?.partnerId && read.participants.includes(im.fork.partnerId) && !read.civilianHarm && !read.personLost) {
      if (read.verdict === 'adverse' && !read.restraintSafe && strainScopeHolds(read, id, IMPRINT_PACKS[im.pack].scope)) settleImprint(d, im, 'strain', now, collect);
      else if (read.verdict === 'favorable') settleImprint(d, im, 'positive', now, collect);
    }
  }
}

/** Start a note for each officer whose call fits a pack, or mark a repeat of the one they carry. */
export function startImprints(d: GameState, read: CallRead, collect?: Id[]): void {
  const now = read.at;
  for (const id of [...read.participants].sort()) {
    if (!employed(d, id) || !read.onStep.has(id)) continue;
    const flags = flagsFor(d, read, id);
    const packs = packsFor(read, flags);
    if (!packs.length) continue;
    const active = activeImprint(d, id);
    if (active) {
      // A repeat of the same note inside its window makes the fork due.
      const open = active.fork === undefined && active.forkDue === undefined && now <= active.endsAt;
      if (open && packs.some((p) => p.id === active.pack)) active.forkDue = 'repeat';
      continue;
    }
    if (atSettledCap(d, id)) continue;
    const pack = packs[0];
    const im: Imprint = {
      id: nextPeopleId(d.people, 'imp'), officerId: id, pack: pack.id,
      cause: { place: read.place, at: now, runId: read.runId },
      startedAt: now, endsAt: now + pack.hours * HOUR_MS, seen: false,
      ...(pack.severe.some((c) => flags.has(c)) ? { forkDue: 'severe' as const } : {}),
    };
    d.people.imprints.push(im);
    raiseBeat(d, 'telegraph', [id], now, im.id, collect);
  }
}

/** Open every fork that is due and whose telegraph has been seen. */
export function openDueForks(d: GameState, now: number, collect?: Id[]): void {
  for (const im of d.people.imprints) {
    if (im.outcome || im.fork || !im.forkDue || !im.seen) continue;
    if (!employed(d, im.officerId)) continue;
    im.fork = { offeredAt: now };
    raiseBeat(d, 'fork_open', [im.officerId], now, im.id, collect);
  }
}

// ---------------------------------------------------------------- settlement over time

/** A note that is not waiting on a decision ends at its time. A fork that is due or open keeps the note
 * until the player decides; peer support and pairing keep it until a call settles it. */
function endsOnTime(im: Imprint): boolean {
  if (im.outcome) return false;
  if (im.fork) return im.fork.choice === 'rest';
  return im.forkDue === undefined;
}

export function endExpiredImprints(d: GameState, from: number, to: number): void {
  const due = d.people.imprints.filter((im) => endsOnTime(im) && im.endsAt > from && im.endsAt <= to).sort((a, b) => a.endsAt - b.endsAt || a.id.localeCompare(b.id));
  for (const im of due) im.outcome = 'cleared';
}

/** Stand-downs and peer support end at their time. */
export function endAftercareAssignments(d: GameState, from: number, to: number): void {
  const due = Object.values(d.officers)
    .filter((o) => (o.assignment?.kind === 'standdown' || o.assignment?.kind === 'peer_support') && o.assignment.endsAt > from && o.assignment.endsAt <= to)
    .sort((a, b) => (a.assignment as { endsAt: number }).endsAt - (b.assignment as { endsAt: number }).endsAt || a.id.localeCompare(b.id));
  for (const o of due) o.assignment = null;
}

/** A settled strain eases after a while and drops off the jacket; the positive stays. */
export function easeSettledStrains(d: GameState, from: number, to: number): void {
  d.people.settled = d.people.settled.filter((s) => !(s.polarity === 'strain' && s.settledAt + PEOPLE_TUNING.strainEasesAfterMs > from && s.settledAt + PEOPLE_TUNING.strainEasesAfterMs <= to));
}

export function nextImprintEventTime(d: GameState, t: number): number | null {
  let best: number | null = null;
  const consider = (x: number) => { if (x > t && (best === null || x < best)) best = x; };
  for (const im of d.people.imprints) if (endsOnTime(im)) consider(im.endsAt);
  for (const o of Object.values(d.officers)) if (o.assignment?.kind === 'standdown' || o.assignment?.kind === 'peer_support') consider(o.assignment.endsAt);
  for (const s of d.people.settled) if (s.polarity === 'strain') consider(s.settledAt + PEOPLE_TUNING.strainEasesAfterMs);
  return best;
}

export const officerBusy = (o: Officer, now: number): boolean => !!o.assignment || !!(o.injury && o.injury.until > now);
