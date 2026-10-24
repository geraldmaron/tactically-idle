// The aftercare fork: the three ways to answer a note an officer is carrying (see imprints.ts for the rules).
// Rest puts the officer on a stand-down for the pack's hours; peer support spends a colleague's shift; a
// pairing names a partner for the next call the two work together.
import type { GameState, HandlerResult, Id } from '../types';
import type { AftercareChoice } from './types';
import { simNow } from '../calendar';
import { IMPRINT_PACKS } from '../../content/people/imprints';
import { findBond } from './bonds';
import { employed } from './core';
import { officerBusy, openDueForks } from './imprints';
import { HOUR_MS } from './tuning';

const fail = (reason: string): HandlerResult => ({ ok: false, reason });
const BOND_ORDER = ['close', 'mentor', 'trusted', 'acquainted'];

/** Colleagues who could sit with the officer now: employed, free and not hurt. Same squad first, then the
 * closer bonds, then by id, so the same state always names the same colleague. */
export function peerCandidates(d: GameState, officerId: Id, now: number): Id[] {
  const me = d.officers[officerId];
  return Object.values(d.officers)
    .filter((o) => o.id !== officerId && employed(d, o.id) && !officerBusy(o, now))
    .sort((a, b) => {
      const sa = me?.squadId && a.squadId === me.squadId ? 0 : 1, sb = me?.squadId && b.squadId === me.squadId ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const ba = BOND_ORDER.indexOf(findBond(d.people, officerId, a.id)?.state ?? ''), bb = BOND_ORDER.indexOf(findBond(d.people, officerId, b.id)?.state ?? '');
      const ra = ba < 0 ? 9 : ba, rb = bb < 0 ? 9 : bb;
      return ra - rb || a.id.localeCompare(b.id);
    })
    .map((o) => o.id);
}

/** Why a choice cannot be made now, or null. Used by the handler and the selector alike. */
export function aftercareBlock(d: GameState, imprintId: Id, choice: AftercareChoice, partnerId: Id | undefined, now: number): string | null {
  const im = d.people.imprints.find((i) => i.id === imprintId);
  if (!im || im.outcome) return 'That note has already ended';
  if (!im.fork) return 'No decision is waiting on that note';
  if (im.fork.choice) return 'That decision has already been made';
  if (!im.seen) return 'The player has not seen this note yet';
  const officer = employed(d, im.officerId);
  if (!officer) return 'That officer is not on the roster';
  if (choice === 'rest') {
    if (officer.assignment) return `${officer.surname} is busy and cannot stand down yet`;
    return null;
  }
  if (choice === 'peer') {
    const colleague = partnerId ? d.officers[partnerId] : d.officers[peerCandidates(d, officer.id, now)[0]];
    if (!colleague || colleague.id === officer.id || !employed(d, colleague.id)) return 'Nobody is free to sit with them';
    if (officerBusy(colleague, now)) return `${colleague.surname} is busy`;
    return null;
  }
  if (!partnerId) return 'Name a partner for the next call';
  const partner = d.officers[partnerId];
  if (!partner || partner.id === officer.id || !employed(d, partner.id)) return 'That partner is not on the roster';
  return null;
}

export function decideAftercare(d: GameState, imprintId: Id, choice: AftercareChoice, partnerId: Id | undefined): HandlerResult {
  const now = simNow(d);
  const reason = aftercareBlock(d, imprintId, choice, partnerId, now);
  if (reason) return fail(reason);
  const im = d.people.imprints.find((i) => i.id === imprintId)!;
  const pack = IMPRINT_PACKS[im.pack];
  const fork = im.fork!;
  const officer = d.officers[im.officerId];
  if (choice === 'rest') {
    const endsAt = now + pack.restHours * HOUR_MS;
    officer.assignment = { kind: 'standdown', imprintId: im.id, startedAt: now, endsAt };
    im.endsAt = endsAt;
  } else if (choice === 'peer') {
    const colleagueId = partnerId ?? peerCandidates(d, officer.id, now)[0];
    d.officers[colleagueId].assignment = { kind: 'peer_support', imprintId: im.id, startedAt: now, endsAt: now + pack.peerHours * HOUR_MS };
    fork.partnerId = colleagueId;
  } else {
    fork.partnerId = partnerId;
  }
  fork.choice = choice;
  fork.decidedAt = now;
  // The decision answers the beat that asked for it.
  for (const beat of d.people.beats) if (beat.kind === 'fork_open' && beat.refId === im.id) beat.acknowledged = true;
  return { ok: true };
}

/** The player opened a jacket or report that shows these notes: their telegraphs are seen, and a fork that
 * was waiting on that opens. */
export function markSeen(d: GameState, imprintIds: Id[]): void {
  const now = simNow(d);
  for (const im of d.people.imprints) {
    if (!imprintIds.includes(im.id) || im.outcome) continue;
    im.seen = true;
    for (const beat of d.people.beats) if (beat.kind === 'telegraph' && beat.refId === im.id) beat.acknowledged = true;
  }
  openDueForks(d, now);
}
