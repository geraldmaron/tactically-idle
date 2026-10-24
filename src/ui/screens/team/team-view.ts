// Team's pure view models for the squad room, the jacket, the bond web and the aftercare board (canvas E1 to
// E4, docs/world-redesign.md). Nothing here touches the store or React: each function reads the state it is
// given and returns plain data, so the rules run in node tests. Every line a player reads comes from a record
// the game keeps (a bond, an imprint, a tie, a fact); where the game records nothing, the function says so by
// returning null, and the screen leaves the line out.
import { IMPRINT_PACKS } from '../../../content/people/imprints';
import { BOND_CAUSE_LINE } from '../../../content/people/facts';
import { DISTRICTS } from '../../../content/city/districts';
import { formatGameDate, gameDay } from '../../../sim/calendar';
import { stressBand, type StressBand } from '../../../sim/officer';
import { bondWeb, teamPeopleSummary, type BondEdge } from '../../../sim/people/selectors';
import type { Bond, BondState } from '../../../sim/people/types';
import type { GameState, Id, Officer, Squad } from '../../../sim/types';
import { ROLE_META } from '../../components/labels';
import { relativeTime } from '../../format';
import { officerStatus } from '../squad-model';

export type NoteTone = 'plain' | 'people' | 'good' | 'harm';

/** The band as the mono caption on a row: "STRAINED 31". The number is the stress itself, the one number on a roll. */
export const BAND_WORD: Record<StressBand, string> = { ready: 'READY', strained: 'STRAINED', overloaded: 'OVERLOADED', recovery: 'RECOVERY' };
export const BAND_TONE: Record<StressBand, 'good' | 'warn' | 'harm' | 'live'> = { ready: 'good', strained: 'warn', overloaded: 'harm', recovery: 'live' };

export const bandCaption = (stress: number): string => `${BAND_WORD[stressBand(stress)]} ${Math.floor(stress + 1e-9)}`;

/** "6 Jan": the day without the year, for lines where the year is clear from the clock. */
export function shortDate(g: Pick<GameState, 'department'>, at: number): string {
  return formatGameDate(gameDay(g, at)).replace(/ \d{4}$/, '');
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const surname = (g: GameState, id: Id): string => g.officers[id]?.surname ?? g.people.records[id]?.snapshot?.surname ?? 'Someone';
const employed = (g: GameState, id: Id): boolean => !!g.officers[id] && (g.people.records[id]?.status ?? 'employed') === 'employed';

export interface Note { text: string; tone: NoteTone }

/** Characters the two parts of a row note may share, beyond which only the first shows. */
const NOTE_BUDGET = 40;

/** Why an officer is away from calls, in the words the row uses; null when they are simply on the board. */
export function awayNote(o: Officer, now: number): string | null {
  const a = o.assignment;
  if (o.injury && o.injury.until > now) return `Injured, ${lower(o.injury.label)}, back ${relativeTime(o.injury.until, now)}`;
  if (!a) return null;
  switch (a.kind) {
    case 'training': return `In training, back ${relativeTime(a.endsAt, now)}`;
    case 'detail': return `Teaching a detail, back ${relativeTime(a.endsAt, now)}`;
    case 'operation': return 'On a call';
    case 'proactive': return `On a patrol shift, back ${relativeTime(a.endsAt, now)}`;
    case 'standdown': return `Stood down, back ${relativeTime(a.endsAt, now)}`;
    case 'peer_support': return `Sitting with a colleague, back ${relativeTime(a.endsAt, now)}`;
  }
}

/** The one or two things worth knowing about an officer on this line: a note that is forming, then the
 * bonds that carry a state, then who they know. At most two parts, joined with a middle dot. */
export function officerNote(g: GameState, o: Officer, now: number): Note {
  const away = awayNote(o, now);
  const parts: Note[] = [];
  const imprint = g.people.imprints.find((i) => i.officerId === o.id && !i.outcome);
  if (imprint) {
    const pack = IMPRINT_PACKS[imprint.pack];
    const decide = !!imprint.fork && !imprint.fork.choice && imprint.seen;
    if (decide) parts.push({ text: 'Something is starting to stick', tone: 'people' });
    else if (pack.origin === 'positive') parts.push({ text: `Leaning ${pack.positive.chip.toLowerCase()}`, tone: 'good' });
    else parts.push({ text: `${pack.label}, for now`, tone: 'people' });
  }
  const bonds = g.people.bonds.filter((b) => (b.a === o.id || b.b === o.id) && employed(g, b.a === o.id ? b.b : b.a));
  const order: BondState[] = ['tense', 'strained', 'mentor', 'close', 'trusted'];
  for (const state of order) {
    const bond = bonds.find((b) => b.state === state);
    if (!bond) continue;
    const other = surname(g, bond.a === o.id ? bond.b : bond.a);
    if (state === 'tense' || state === 'strained') parts.push({ text: `${state === 'tense' ? 'Tense' : 'Strained'} with ${other} since ${shortDate(g, bond.since)}`, tone: 'harm' });
    else if (state === 'mentor') parts.push({ text: `Mentor bond with ${other}`, tone: 'plain' });
    else if (state === 'close') parts.push({ text: `Close with ${other}`, tone: 'plain' });
    else parts.push({ text: `Works well with ${other}`, tone: 'plain' });
    break;
  }
  const ties = g.people.ties.filter((t) => t.officerId === o.id && t.onRecord);
  if (ties.length === 1) {
    const s = g.world.subjects[ties[0].subjectId];
    if (s) parts.push({ text: `Knows ${s.firstName} ${s.surname}`, tone: 'plain' });
  } else if (ties.length > 1) parts.push({ text: `Knows ${ties.length} people on file`, tone: 'plain' });
  // Two parts at most, and the second only while the whole line stays short enough to sit on two lines of a row.
  const picked = parts.slice(0, 2).filter((p, i) => i === 0 || parts[0].text.length + p.text.length <= NOTE_BUDGET);
  if (away) return { text: [away, ...picked.slice(0, 1).map((p) => p.text)].join(' · '), tone: picked[0]?.tone ?? 'plain' };
  if (picked.length > 0) return { text: picked.map((p) => p.text).join(' · '), tone: picked[0].tone };
  return { text: o.career.operations > 0 ? `${o.career.operations} ${o.career.operations === 1 ? 'call' : 'calls'} with this department` : 'New to the department', tone: 'plain' };
}

export interface OfficerRowView {
  id: Id;
  surname: string;
  fullName: string;
  role: string;
  note: Note;
  stress: number;
  band: StressBand;
  bandCaption: string;
  leader: boolean;
  needsDecision: boolean;
  away: boolean;
}

export function officerRowView(g: GameState, o: Officer, now: number, leaderId?: Id | null): OfficerRowView {
  const status = officerStatus(o, now);
  const summary = teamPeopleSummary(g);
  return {
    id: o.id, surname: o.surname, fullName: `${o.firstName} ${o.surname}`, role: ROLE_META[o.role].short.toUpperCase(),
    note: officerNote(g, o, now), stress: o.stress, band: stressBand(o.stress), bandCaption: bandCaption(o.stress),
    leader: leaderId === o.id, needsDecision: summary.needsDecision.some((n) => n.officerId === o.id),
    away: status === 'injured' || status === 'training' || status === 'detail' || status === 'deployed' || !!o.assignment,
  };
}

export interface SquadHeader { left: string; right: string; tone: 'live' | 'intel' }

/** "SQUAD A · PIKE STREET SHIFT" with the time left, or the squad's duty with who needs rest. */
export function squadHeader(g: GameState, squad: Squad, now: number): SquadHeader {
  const members = squad.officerIds.map((id) => g.officers[id]).filter((o): o is Officer => !!o);
  const shiftOfficer = members.find((o) => o.assignment?.kind === 'proactive');
  if (shiftOfficer && shiftOfficer.assignment?.kind === 'proactive') {
    const shift = g.world.shifts.find((s) => s.id === (shiftOfficer.assignment as { shiftId: Id }).shiftId);
    const district = shift ? DISTRICTS[shift.districtId]?.name : undefined;
    return { left: `SQUAD ${squad.id} · ${(district ?? 'PATROL').toUpperCase()} SHIFT`, right: `${relativeTime(shiftOfficer.assignment.endsAt, now).replace(/^in /, '').toUpperCase()} LEFT`, tone: 'live' };
  }
  if (members.some((o) => o.assignment?.kind === 'operation')) return { left: `SQUAD ${squad.id} · ON A CALL`, right: 'IN PLAY', tone: 'live' };
  const rest = members.filter((o) => stressBand(o.stress) === 'overloaded' || stressBand(o.stress) === 'recovery').length;
  const strained = members.filter((o) => stressBand(o.stress) === 'strained').length;
  const right = rest === 1 ? 'ONE NEEDS REST' : rest > 1 ? `${rest} NEED REST` : strained > 0 ? `${strained} STRAINED` : members.length === 0 ? 'NO ONE YET' : 'ALL READY';
  return { left: `SQUAD ${squad.id} · ${squad.duty === 'rest' ? 'RESTING' : 'STANDBY'}`, right, tone: 'intel' };
}

// ---------------------------------------------------------------- aftercare banner

export interface DecisionBanner { imprintId: Id; officerId: Id; surname: string; line: string }

/** Officers whose aftercare waits on the player, in the order the summary gives them. */
export function decisionBanners(g: GameState): DecisionBanner[] {
  return teamPeopleSummary(g).needsDecision.flatMap(({ officerId, imprintId }) => {
    const im = g.people.imprints.find((i) => i.id === imprintId);
    const o = g.officers[officerId];
    return im && o ? [{ imprintId, officerId, surname: o.surname, line: `Something from ${im.cause.place} is starting to stick` }] : [];
  });
}

// ---------------------------------------------------------------- the bond web

export type EdgeStyle = 'close' | 'trusted' | 'mentor' | 'tense' | 'off_clock' | 'acquainted';

export interface WebEdge extends BondEdge { style: EdgeStyle }

/** Edges for the web, drawn from the bond states. A romance draws as the dotted rose "off the clock" line only
 * when personal lives are on; with the setting off the same bond draws as the close tie it also is. */
export function webEdges(g: GameState, officerIds: readonly Id[], personalLives: boolean): WebEdge[] {
  return bondWeb(g, officerIds).map((edge) => ({
    ...edge,
    romance: edge.romance && personalLives,
    style: edge.romance && personalLives ? 'off_clock' : edge.state === 'strained' ? 'tense' : edge.state,
  }));
}

/** Places for each officer on the web: the officers with the most bonds sit near the middle, the rest on a ring.
 * Deterministic and pure, so the same state always draws the same web. Coordinates are in a 358 x 340 board. */
export function webLayout(ids: readonly Id[], edges: readonly { a: Id; b: Id }[], width = 358, height = 340): Record<Id, { x: number; y: number }> {
  const degree = (id: Id) => edges.filter((e) => e.a === id || e.b === id).length;
  const sorted = [...ids].sort((p, q) => degree(q) - degree(p) || p.localeCompare(q));
  const cx = width / 2, cy = height / 2;
  const rx = width / 2 - 44, ry = height / 2 - 50;
  const out: Record<Id, { x: number; y: number }> = {};
  const n = sorted.length;
  sorted.forEach((id, i) => {
    // Alternate between the outer ring and an inner ring so eight faces do not touch.
    const inner = n > 5 && i % 2 === 1;
    const k = inner ? Math.floor(i / 2) : Math.ceil(i / 2);
    const ringCount = inner ? Math.floor(n / 2) : Math.ceil(n / 2);
    const angle = (-Math.PI / 2) + (2 * Math.PI * k) / Math.max(1, ringCount) + (inner ? Math.PI / ringCount : 0);
    const scale = inner ? 0.52 : 1;
    out[id] = { x: Math.round(cx + Math.cos(angle) * rx * scale), y: Math.round(cy + Math.sin(angle) * ry * scale) };
  });
  return out;
}

export interface BondCard {
  key: string;
  a: Id;
  b: Id;
  title: string;
  body: string;
  kind: 'tense' | 'romance';
}

const CAUSE_SENTENCE: Record<Bond['cause']['kind'], (place: string | undefined, date: string) => string> = {
  shared_call: (place, date) => `Since the call at ${place ?? 'a shared scene'} on ${date}, when it went well for both.`,
  shared_shift: (place, date) => `Since the shift in ${place ?? 'the district'} on ${date}.`,
  mentoring: (_p, date) => `Since ${date}, when one began showing the other the work.`,
  rear_left_open: (place, date) => `Since the call at ${place ?? 'a shared scene'} on ${date}, when a rear was left open.`,
  promotion: (_p, date) => `Since ${date}, when one was promoted over the other.`,
  breakup: (_p, date) => `Since ${date}, when a close tie ended.`,
  repair: (place, date) => `Mended after ${place ?? 'a shared call'} on ${date}.`,
};

/** The pairs that carry a story: a tense or strained bond with its recorded cause, and a romance, which is their
 * story to tell and never a stat (no state words, no effect). Romances appear only when personal lives are on. */
export function bondCards(g: GameState, personalLives: boolean): BondCard[] {
  const cards: BondCard[] = [];
  for (const b of g.people.bonds) {
    if (!employed(g, b.a) || !employed(g, b.b)) continue;
    const pair = `${surname(g, b.a)} and ${surname(g, b.b)}`;
    if (b.state === 'tense' || b.state === 'strained') {
      cards.push({
        key: `${b.a}:${b.b}`, a: b.a, b: b.b, kind: 'tense', title: `${pair}, ${b.state}`,
        body: `${CAUSE_SENTENCE[b.cause.kind](b.cause.place, shortDate(g, b.cause.at))} Shared actions run slower between them until something repairs it.`,
      });
    } else if (b.romance && b.romance.ended === undefined && personalLives) {
      cards.push({ key: `${b.a}:${b.b}:r`, a: b.a, b: b.b, kind: 'romance', title: pair, body: `${BOND_CAUSE_LINE[b.cause.kind] ?? ''} Their story to tell. It shows in their lines and their jackets, never as a number.`.trim() });
    }
  }
  return cards.sort((x, y) => Number(x.kind === 'romance') - Number(y.kind === 'romance') || x.key.localeCompare(y.key));
}

/** The caption on the bond screen: "8 OFFICERS · 9 BONDS". Acquainted pairs are not counted as bonds. */
export function bondCaptionLine(g: GameState, ids: readonly Id[]): string {
  const bonds = g.people.bonds.filter((b) => ids.includes(b.a) && ids.includes(b.b) && b.state !== 'acquainted').length;
  return `${ids.length} ${ids.length === 1 ? 'OFFICER' : 'OFFICERS'} · ${bonds} ${bonds === 1 ? 'BOND' : 'BONDS'}`;
}
