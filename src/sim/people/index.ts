// The people layer's entry points (docs/world-build-plan.md, "The contract"). Wave 0 lands these as stubs;
// the people-engine lane fills them in behind the same signatures.
import type { DebriefResult, GameState, HandlerMap, HandlerResult, Id, OperationRun, PeopleCommandType } from '../types';
import type { PeopleState } from './types';

const fail = (reason: string): HandlerResult => ({ ok: false, reason });

/** A canonical record for every starting officer. */
export function createPeople(d: Pick<GameState, 'officers'>, now: number): PeopleState {
  const records: PeopleState['records'] = {};
  for (const o of Object.values(d.officers)) {
    records[o.id] = { officerId: o.id, identityId: o.identityId ?? o.id, status: 'employed', hiredAt: o.hiredAt ?? now, pagesOpen: 1, shared: {}, openToRelationship: false };
  }
  return { records, facts: [], imprints: [], settled: [], bonds: [], ties: [], beats: [], nextId: 1 };
}

/** The next time strictly after t when an imprint ends or a fork opens. */
export function nextPeopleEventTime(_d: GameState, _t: number): number | null {
  return null;
}

/** Advance imprints and bond drift over [from, to); push ids of new beats onto `beats`. */
export function settlePeople(_d: GameState, _from: number, _to: number, _beats: Id[]): void {}

/** Called by operation.closeDebrief after the career loop: memory facts, imprints, bonds, ties. */
export function applyPeopleDebrief(_d: GameState, _run: OperationRun, _result: DebriefResult, _verdict: 'favorable' | 'adverse' | null): void {}

/** Bridges the world and roster call (contract, so neither lane edits the other's files). Each is a no-op
 * until the people-engine lane fills it in. */
/** A world investigation an officer worked has closed: record an `arrest` fact and any prior_arrest tie. */
export function recordCaseFact(_d: GameState, _caseId: Id): void {}
/** A proactive shift stopped: record `shift` facts and drift the bonds of the officers who rode it. */
export function recordShiftFact(_d: GameState, _shiftId: Id): void {}
/** A world subject was generated: create jacket ties for officers from that subject's district. */
export function seedTiesForSubject(_d: GameState, _subjectId: Id): void {}
/** An officer joined (hire or rehire): create or restore their record. */
export function onOfficerHired(_d: GameState, _officerId: Id): void {}
/** An officer is about to leave (dismissal or retirement): snapshot them before removal. */
export function onOfficerDeparted(_d: GameState, _officerId: Id, _reason: 'dismissed' | 'retired'): void {}

export const PEOPLE_HANDLERS: HandlerMap<PeopleCommandType> = {
  decideAftercare: () => fail('Not built yet'),
  acknowledgeBeat: (d, c) => {
    const beat = d.people.beats.find((b) => b.id === c.beatId);
    if (!beat) return fail('Nothing to acknowledge');
    beat.acknowledged = true;
    return { ok: true };
  },
  markTelegraphSeen: (d, c) => {
    for (const imprint of d.people.imprints) if (c.imprintIds.includes(imprint.id)) imprint.seen = true;
    return { ok: true };
  },
};
