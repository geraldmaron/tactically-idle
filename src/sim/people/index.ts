// The people layer's entry points (docs/world-build-plan.md, "The contract"). Officers as people: a record
// through every employment change, jacket pages, memory facts, imprints with an aftercare fork, settled
// traits, bonds, ties and romance. Rules live in the modules beside this file; authored text lives in
// src/content/people/. The signatures below are the contract the other lanes call.
import type { GameState, HandlerMap, Id, PeopleCommandType } from '../types';
import { markSeen, decideAftercare } from './aftercare';
import { easeTenseBonds, nextBondEventTime } from './bonds';
import { endAftercareAssignments, endExpiredImprints, easeSettledStrains, nextImprintEventTime } from './imprints';

export { createPeople, onOfficerHired, onOfficerDeparted, rehireCandidates, rehireCheck, isRehire } from './records';
export { applyPeopleDebrief } from './debrief';
export { recordShiftFact } from './shifts';
export { recordCaseFact, seedTiesForSubject } from './ties';
export { bondContributor } from './contributor';
export { validPeopleState } from './validate';
export { jacketView, bondWeb, aftercareView, peopleBeatsFor, teamPeopleSummary } from './selectors';
export { PEOPLE_TUNING } from './tuning';

/** The next time strictly after t when a note ends, a stand-down or peer-support shift ends, a settled strain
 * eases or a tense bond eases. Pending decisions never expire, so they offer no time. */
export function nextPeopleEventTime(d: GameState, t: number): number | null {
  const a = nextImprintEventTime(d, t), b = nextBondEventTime(d, t);
  return a === null ? b : b === null ? a : Math.min(a, b);
}

/** Advance the people over (from, to]; push ids of new beats onto `beats`. Deterministic: every effect has
 * its own time in state, so one long walk, many short ones and a save in between all agree. */
export function settlePeople(d: GameState, from: number, to: number, beats: Id[]): void {
  if (to <= from) return;
  endExpiredImprints(d, from, to);
  endAftercareAssignments(d, from, to);
  easeTenseBonds(d, from, to, beats);
  easeSettledStrains(d, from, to);
}

export const PEOPLE_HANDLERS: HandlerMap<PeopleCommandType> = {
  decideAftercare: (d, c) => decideAftercare(d, c.imprintId, c.choice, c.partnerId),
  acknowledgeBeat: (d, c) => {
    const beat = d.people.beats.find((b) => b.id === c.beatId);
    if (!beat) return { ok: false, reason: 'Nothing to acknowledge' };
    beat.acknowledged = true;
    return { ok: true };
  },
  markTelegraphSeen: (d, c) => {
    markSeen(d, c.imprintIds);
    return { ok: true };
  },
};
