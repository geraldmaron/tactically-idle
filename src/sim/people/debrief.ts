// The write-back from a closed call (docs/world-redesign.md, "How calls plug in", hook 5): shared
// operations, memory facts, imprints, bonds, ties surfaced and jacket pages opened. operation.closeDebrief
// calls applyPeopleDebrief after the career loop, with the officers' stress already at its end value.
import type { DebriefResult, GameState, Id, OperationRun } from '../types';
import { authoredPages, jacketFor } from '../../content/people/jackets';
import { advanceImprints, openDueForks, startImprints } from './imprints';
import { applyCallBonds } from './bonds';
import { readCall, type CallRead } from './call-read';
import { raiseBeat } from './core';
import { hasFact, recordFact } from './memory';
import { ensureRecord } from './records';
import { surfaceTiesFor } from './ties';
import { PEOPLE_TUNING } from './tuning';
import type { FactKind } from './types';
import { rankOf } from '../ranks';
import { rankIndex } from '../../content/ranks';

/** Facts weighty enough to tell the player about once. */
const NOTABLE: ReadonlySet<FactKind> = new Set(['rescue', 'negotiated', 'injured', 'person_lost']);

function recordCallFacts(d: GameState, read: CallRead): void {
  const surname = (id: Id | undefined) => (id ? d.officers[id]?.surname : undefined);
  for (const id of read.participants) {
    const others = read.participants.filter((o) => o !== id);
    const base = { officerId: id, at: read.at, place: read.place, with: others, runId: read.runId, banned: read.nameTokens };
    const slots = { minutes: read.minutes, steps: read.steps, ending: read.ending, colleague: surname(others[0]) };
    const add = (kind: FactKind, extra: Partial<typeof slots & { label: string; days: number }> = {}) => {
      const fact = recordFact(d, { ...base, kind, slots: { ...slots, ...extra } });
      if (fact && NOTABLE.has(kind)) raiseBeat(d, 'memory', [id], read.at, fact.id);
    };

    if (!hasFact(d, id, 'first_call')) add('first_call');
    const hurt = read.hurt[id];
    if (hurt) add('injured', { label: hurt.label, days: hurt.days });
    if (read.personLost) add('person_lost');
    const on = read.onStep.has(id);
    if (on && read.rescued && read.verdict !== 'adverse') add('rescue');
    if (on && read.contact.has(id) && !read.forceUsed && (read.disposition === 'resolved' || read.disposition === 'care_accepted') && read.verdict !== 'adverse') add('negotiated');
    if (on && read.verdict === 'favorable' && read.pressurePeak >= PEOPLE_TUNING.highPressure) add('favorable_under_pressure');
  }
}

/** A trainee beside a mentor on this call: recorded once per mentor, after the bonds are updated. */
function recordMentorFacts(d: GameState, read: CallRead): void {
  for (const bond of d.people.bonds) {
    if (bond.state !== 'mentor' || !read.participants.includes(bond.a) || !read.participants.includes(bond.b)) continue;
    const a = d.officers[bond.a], b = d.officers[bond.b];
    if (!a || !b) continue;
    const [mentor, trainee] = rankIndex(rankOf(a)) >= rankIndex(rankOf(b)) ? [a, b] : [b, a];
    if (d.people.facts.some((f) => f.officerId === trainee.id && f.kind === 'mentored' && f.with[0] === mentor.id)) continue;
    recordFact(d, {
      officerId: trainee.id, kind: 'mentored', at: read.at, place: read.place, with: [mentor.id], runId: read.runId,
      banned: read.nameTokens, slots: { steps: read.steps, colleague: mentor.surname },
    });
  }
}

/** Pages open as the player serves: page 2 after shared operations, page 3 after its keyed fact. */
export function openPages(d: GameState, officerIds: readonly Id[], at: number, collect?: Id[]): void {
  for (const id of officerIds) {
    const record = d.people.records[id];
    if (!record || record.status !== 'employed') continue;
    const jacket = jacketFor(record.identityId);
    const pages = authoredPages(jacket);
    const mostShared = Math.max(0, ...Object.values(record.shared));
    if (record.pagesOpen < 2 && pages >= 2 && mostShared >= PEOPLE_TUNING.page2After) {
      record.pagesOpen = 2;
      raiseBeat(d, 'page_opened', [id], at, `${id}:2`, collect);
    }
    if (record.pagesOpen === 2 && pages >= 3 && jacket.page3 && hasFact(d, id, jacket.page3.kind)) {
      record.pagesOpen = 3;
      raiseBeat(d, 'page_opened', [id], at, `${id}:3`, collect);
    }
  }
}

/** Called by operation.closeDebrief after the career loop: memory facts, imprints, bonds, ties. */
export function applyPeopleDebrief(d: GameState, run: OperationRun, result: DebriefResult, verdict: 'favorable' | 'adverse' | null): void {
  const read = readCall(d, run, result, verdict);
  for (const id of read.participants) ensureRecord(d, d.officers[id]);

  // Shared operations. A call worked alone counts under the officer's own id.
  for (const id of read.participants) {
    const record = d.people.records[id];
    const others = read.participants.filter((o) => o !== id);
    for (const other of others.length ? others : [id]) record.shared[other] = (record.shared[other] ?? 0) + 1;
  }

  if (read.subjectId) surfaceTiesFor(d, read.participants, read.subjectId, read.at);
  recordCallFacts(d, read);
  advanceImprints(d, read);
  startImprints(d, read);
  applyCallBonds(d, read);
  recordMentorFacts(d, read);
  openDueForks(d, read.at);
  openPages(d, read.participants, read.at);
}
