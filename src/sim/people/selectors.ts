// Read-only views of the people layer for the screens (docs/world-build-plan.md, the people-engine lane).
// Every function takes the state and returns plain data; nothing here mutates. Authored text is bound here
// (telegraphs, jacket pages, settled-trait origin lines) so the UI never builds prose from fields itself.
import type { GameState, Id } from '../types';
import { formatGameDate, gameDay } from '../calendar';
import { authoredPages, jacketFor, type Jacket, type JacketPage1 } from '../../content/people/jackets';
import { IMPRINT_PACKS, packTraitInfo } from '../../content/people/imprints';
import { BOND_CAUSE_LINE, BOND_CHANGE_LINE, BOND_STATE_LABEL, TIE_LINE } from '../../content/people/facts';
import type { AftercareChoice, Bond, BondState, ImprintPackId, MemoryFact, PeopleBeat, PersonStatus, Tie } from './types';
import { peerCandidates } from './aftercare';
import { factsOf } from './memory';

const surnameOf = (d: GameState, id: Id): string => d.officers[id]?.surname ?? d.people.records[id]?.snapshot?.surname ?? 'Someone';

/** Fill `{place}`. If the line would run past 15 words (a long address), the place becomes "the call". */
export function bindTelegraph(template: string, place: string): string {
  const full = template.replace('{place}', place);
  return full.split(/\s+/).length <= 15 ? full : template.replace('{place}', 'the call');
}

// ---------------------------------------------------------------- the jacket

export interface ImprintView {
  id: Id;
  pack: ImprintPackId;
  label: string;
  /** Behavior the player saw, 15 words at most. */
  telegraph: string;
  seen: boolean;
  startedAt: number;
  /** Real time the note ends if nothing is decided; null while a decision, peer support or a pairing holds it. */
  endsAt: number | null;
  /** A decision is waiting on the player. */
  needsDecision: boolean;
  decided?: AftercareChoice;
  partnerId?: Id;
}

export interface SettledView {
  id: Id;
  trait: string;
  polarity: 'positive' | 'strain';
  chip: string;
  condition: string;
  /** "Earned at Wren Court, 12 May 2027." or "Since Calder Street, 3 May 2027." */
  line: string;
  place: string;
  settledAt: number;
}

export interface BondView {
  otherId: Id;
  otherSurname: string;
  state: BondState;
  label: string;
  since: number;
  causeKind: Bond['cause']['kind'];
  causeLine: string;
  /** Only when the officers' personal lives are on; the UI decides whether to show it. */
  romance: boolean;
  /** The other officer is still employed. */
  active: boolean;
}

export interface TieView {
  id: Id;
  subjectId: Id;
  subjectName: string | null;
  kind: Tie['kind'];
  line: string;
}

export interface JacketView {
  officerId: Id;
  status: PersonStatus;
  pagesOpen: 1 | 2 | 3;
  /** Pages the persona has authored: a templated persona has one. */
  pagesAuthored: 1 | 2 | 3;
  page1: JacketPage1;
  page2: { line: string; district: string } | null;
  page3: { line: string; kind: string } | null;
  memories: MemoryFact[];
  imprints: ImprintView[];
  settled: SettledView[];
  bonds: BondView[];
  ties: TieView[];
  rehireAfter?: number;
}

function imprintView(im: GameState['people']['imprints'][number]): ImprintView {
  const pack = IMPRINT_PACKS[im.pack];
  const held = im.fork?.choice === 'peer' || im.fork?.choice === 'pair' || (!im.fork && im.forkDue !== undefined) || (!!im.fork && !im.fork.choice);
  return {
    id: im.id, pack: im.pack, label: pack.label, telegraph: bindTelegraph(pack.telegraph, im.cause.place), seen: im.seen, startedAt: im.startedAt,
    endsAt: held ? null : im.endsAt, needsDecision: !!im.fork && !im.fork.choice,
    ...(im.fork?.choice ? { decided: im.fork.choice } : {}), ...(im.fork?.partnerId ? { partnerId: im.fork.partnerId } : {}),
  };
}

function settledView(d: GameState, s: GameState['people']['settled'][number]): SettledView {
  const info = packTraitInfo(s.trait);
  const date = formatGameDate(gameDay(d, s.settledAt));
  return {
    id: s.id, trait: s.trait, polarity: s.polarity, chip: info?.chip ?? s.trait, condition: info?.condition ?? '', place: s.cause.place, settledAt: s.settledAt,
    line: s.polarity === 'positive' ? `Earned at ${s.cause.place}, ${date}.` : `Since ${s.cause.place}, ${date}.`,
  };
}

const BOND_RANK: Record<BondState, number> = { close: 0, mentor: 1, trusted: 2, strained: 3, tense: 4, acquainted: 5 };

function bondViews(d: GameState, officerId: Id): BondView[] {
  return d.people.bonds
    .filter((b) => b.a === officerId || b.b === officerId)
    .map((b) => {
      const otherId = b.a === officerId ? b.b : b.a;
      return {
        otherId, otherSurname: surnameOf(d, otherId), state: b.state, label: BOND_STATE_LABEL[b.state], since: b.since, causeKind: b.cause.kind,
        causeLine: BOND_CAUSE_LINE[b.cause.kind] ?? '', romance: !!b.romance && b.romance.ended === undefined,
        active: !!d.officers[otherId] && (d.people.records[otherId]?.status ?? 'employed') === 'employed',
      };
    })
    .sort((x, y) => Number(y.active) - Number(x.active) || BOND_RANK[x.state] - BOND_RANK[y.state] || y.since - x.since || x.otherId.localeCompare(y.otherId));
}

function tieViews(d: GameState, officerId: Id): TieView[] {
  return d.people.ties
    .filter((t) => t.officerId === officerId && t.onRecord)
    .map((t) => {
      const s = d.world.subjects[t.subjectId];
      return { id: t.id, subjectId: t.subjectId, subjectName: s ? `${s.firstName} ${s.surname}` : null, kind: t.kind, line: TIE_LINE[t.kind] };
    });
}

/** What the service jacket shows for an officer now: the pages the player has earned, and the rest of the
 * file (memories newest first, notes with their telegraphs, settled traits with cause and date, bonds as
 * states, ties on the record). Null for someone the department has never employed. */
export function jacketView(d: GameState, officerId: Id): JacketView | null {
  const record = d.people.records[officerId];
  if (!record) return null;
  const jacket: Jacket = jacketFor(record.identityId);
  const authored = authoredPages(jacket);
  const open = Math.min(record.pagesOpen, authored) as 1 | 2 | 3;
  const memories = factsOf(d, officerId);
  const page3Fact = jacket.page3 ? memories.find((f) => f.kind === jacket.page3!.kind) : undefined;
  return {
    officerId, status: record.status, pagesOpen: open, pagesAuthored: authored,
    page1: jacket.page1,
    page2: open >= 2 && jacket.page2 ? { line: jacket.page2.line, district: jacket.page2.district } : null,
    page3: open >= 3 && jacket.page3 && page3Fact ? { line: jacket.page3.line.replace('{place}', page3Fact.place), kind: jacket.page3.kind } : null,
    memories,
    imprints: d.people.imprints.filter((i) => i.officerId === officerId && !i.outcome).map((i) => imprintView(i)),
    settled: d.people.settled.filter((s) => s.officerId === officerId).sort((a, b) => b.settledAt - a.settledAt).map((s) => settledView(d, s)),
    bonds: bondViews(d, officerId),
    ties: tieViews(d, officerId),
    ...(record.rehireAfter !== undefined ? { rehireAfter: record.rehireAfter } : {}),
  };
}

// ---------------------------------------------------------------- bonds among a group

export interface BondEdge { a: Id; b: Id; state: BondState; label: string; romance: boolean }

/** The bonds among the given officers (for the squad room), significant states first. */
export function bondWeb(d: GameState, officerIds: readonly Id[]): BondEdge[] {
  return d.people.bonds
    .filter((b) => officerIds.includes(b.a) && officerIds.includes(b.b))
    .map((b) => ({ a: b.a, b: b.b, state: b.state, label: BOND_STATE_LABEL[b.state], romance: !!b.romance && b.romance.ended === undefined }))
    .sort((x, y) => BOND_RANK[x.state] - BOND_RANK[y.state] || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
}

// ---------------------------------------------------------------- aftercare

export interface AftercareOptionView {
  choice: AftercareChoice;
  label: string;
  line: string;
  cost: string;
  risk: string;
  /** Can be chosen now. */
  available: boolean;
  reason?: string;
  /** Colleagues the player can name (peer: free colleagues; pair: any employed colleague). */
  candidates: Id[];
}

export interface AftercareView {
  imprintId: Id;
  officerId: Id;
  officerSurname: string;
  label: string;
  telegraph: string;
  seen: boolean;
  /** The fork is open and undecided. */
  open: boolean;
  decided?: AftercareChoice;
  options: AftercareOptionView[];
  /** What each answer can lead to, in the pack's words. */
  settles: {
    rest: string;
    peer: string;
    pair: { adverse: { chip: string; condition: string }; favorable: { chip: string; condition: string } };
  };
}

export function aftercareView(d: GameState, imprintId: Id): AftercareView | null {
  const im = d.people.imprints.find((i) => i.id === imprintId);
  if (!im) return null;
  const pack = IMPRINT_PACKS[im.pack];
  const now = d.department.clockHighWater;
  const officer = d.officers[im.officerId];
  const open = !im.outcome && !!im.fork && !im.fork.choice && im.seen;
  const colleagues = Object.values(d.officers).filter((o) => o.id !== im.officerId && (d.people.records[o.id]?.status ?? 'employed') === 'employed').map((o) => o.id).sort();
  const free = peerCandidates(d, im.officerId, now);
  const partnerName = im.fork?.partnerId ? surnameOf(d, im.fork.partnerId) : 'the partner you name';
  const bind = (line: string) => line.replace(/\{partner\}/g, partnerName);
  const busyReason = officer && officer.assignment ? `${officer.surname} is busy` : undefined;
  const options: AftercareOptionView[] = [
    { choice: 'rest', ...pick(pack.fork.rest), line: pack.fork.rest.line, available: open && !officer?.assignment, ...(open && busyReason ? { reason: busyReason } : {}), candidates: [] },
    { choice: 'peer', ...pick(pack.fork.peer), line: pack.fork.peer.line, available: open && free.length > 0, ...(open && !free.length ? { reason: 'Nobody is free to sit with them' } : {}), candidates: free },
    { choice: 'pair', ...pick(pack.fork.pair), line: bind(pack.fork.pair.line), available: open && colleagues.length > 0, candidates: colleagues },
  ];
  return {
    imprintId: im.id, officerId: im.officerId, officerSurname: surnameOf(d, im.officerId), label: pack.label,
    telegraph: bindTelegraph(pack.telegraph, im.cause.place), seen: im.seen, open,
    ...(im.fork?.choice ? { decided: im.fork.choice } : {}), options,
    settles: {
      rest: `The note clears after ${pack.restHours} hours with no mark.`,
      peer: 'The note clears on their next favorable call.',
      pair: { adverse: { chip: pack.strain.chip, condition: pack.strain.condition }, favorable: { chip: pack.positive.chip, condition: pack.positive.condition } },
    },
  };
}

function pick(o: { label: string; cost: string; risk: string }) {
  return { label: o.label, cost: o.cost, risk: o.risk };
}

// ---------------------------------------------------------------- beats and the team badge

export interface BeatView { beat: PeopleBeat; line: string }

function beatLine(d: GameState, beat: PeopleBeat): string {
  const [first, second] = beat.officerIds;
  const a = surnameOf(d, first ?? ''), b = second ? surnameOf(d, second) : '';
  switch (beat.kind) {
    case 'telegraph': {
      const im = d.people.imprints.find((i) => i.id === beat.refId);
      return im ? bindTelegraph(IMPRINT_PACKS[im.pack].telegraph, im.cause.place) : `${a} has changed on the job.`;
    }
    case 'fork_open': return `${a} needs a decision. Rest, peer support, or pair up.`;
    case 'settled': {
      const im = d.people.imprints.find((i) => i.id === beat.refId);
      if (!im) return `${a} has settled.`;
      const date = formatGameDate(gameDay(d, im.cause.at));
      if (im.outcome === 'settled_positive') return `${IMPRINT_PACKS[im.pack].positive.chip} is on ${a}'s file. Earned at ${im.cause.place}, ${date}.`;
      if (im.outcome === 'settled_strain') return `${IMPRINT_PACKS[im.pack].strain.chip} is on ${a}'s file. Since ${im.cause.place}, ${date}.`;
      return `The note on ${a} has cleared.`;
    }
    case 'bond_changed': {
      const state = (beat.refId?.split(':')[2] ?? 'acquainted') as BondState;
      return (BOND_CHANGE_LINE[state] ?? '{a} and {b} have changed.').replace('{a}', a).replace('{b}', b);
    }
    case 'romance': {
      return beat.refId?.endsWith(':ended') ? `${a} and ${b} have ended it. They are tense with each other.` : `${a} and ${b} have started seeing each other.`;
    }
    case 'page_opened': return `${a}'s jacket has a new page.`;
    case 'tie_surfaced': {
      const tie = d.people.ties.find((t) => t.id === beat.refId);
      const s = tie ? d.world.subjects[tie.subjectId] : undefined;
      return tie && s ? `${a} knows ${s.firstName} ${s.surname}. ${TIE_LINE[tie.kind]}.` : `${a} knows someone on the file.`;
    }
    case 'memory': return d.people.facts.find((f) => f.id === beat.refId)?.detail ?? `${a} has something on file.`;
  }
}

/** Beats that involve any of the given officers, unacknowledged first, then newest first. */
export function peopleBeatsFor(d: GameState, officerIds: readonly Id[]): BeatView[] {
  return d.people.beats
    .filter((b) => b.officerIds.some((id) => officerIds.includes(id)))
    .sort((x, y) => Number(x.acknowledged) - Number(y.acknowledged) || y.at - x.at || y.id.localeCompare(x.id, undefined, { numeric: true }))
    .map((beat) => ({ beat, line: beatLine(d, beat) }));
}

export interface TeamPeopleSummary {
  /** Forks open and waiting for the player. */
  needsDecision: { officerId: Id; imprintId: Id }[];
  /** Notes whose telegraph the player has not seen yet. */
  unseen: { officerId: Id; imprintId: Id }[];
  /** Beats not yet acknowledged. */
  unacknowledged: number;
}

/** Who needs a decision, for the team badge. */
export function teamPeopleSummary(d: GameState): TeamPeopleSummary {
  const live = d.people.imprints.filter((i) => !i.outcome);
  const byOfficer = (a: { officerId: Id }, b: { officerId: Id }) => a.officerId.localeCompare(b.officerId);
  return {
    needsDecision: live.filter((i) => i.fork && !i.fork.choice && i.seen).map((i) => ({ officerId: i.officerId, imprintId: i.id })).sort(byOfficer),
    unseen: live.filter((i) => !i.seen).map((i) => ({ officerId: i.officerId, imprintId: i.id })).sort(byOfficer),
    unacknowledged: d.people.beats.filter((b) => !b.acknowledged).length,
  };
}
