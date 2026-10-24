// "While you were off" (B3) and "Where you left it" (B4) as data: people first (at most three), then the cases,
// then the funding net. Pure over the game state and its shift report; the screens only lay it out.
import { ARCHETYPES } from '../../../content/city/archetypes';
import { DISTRICTS } from '../../../content/city/districts';
import { jacketView, peopleBeatsFor, teamPeopleSummary } from '../../../sim/people/selectors';
import type { BondState } from '../../../sim/people/types';
import { subjectName } from '../../../sim/world/population';
import type { DistrictId } from '../../../sim/world/types';
import type { GameState, Id, ShiftReport } from '../../../sim/types';
import { awayText, clockStamp } from './clock';
import { crewInitials } from './district';

/** A report this long away gets the full page (B4) and not the sheet (B3). */
export const LONG_AWAY_MS = 7 * 24 * 3_600_000;

export type PeopleTone = 'decide' | 'close' | 'ready' | 'plain';

export interface PeopleLine {
  key: string;
  /** The first officer is the face; a pair shows two. */
  officerIds: Id[];
  title: string;
  text: string;
  /** The mono tag at the right: DECIDE, CLOSE, READY. */
  tag: string;
  tone: PeopleTone;
  /** Tapping the line opens this officer's jacket. */
  open: Id;
  /** Telegraphs this line shows, marked seen when the report opens. */
  imprintIds: Id[];
  beatIds: Id[];
}

export interface LeadLine { leadId: Id; subjectId: Id; title: string; text: string }

export interface FundingRow { key: string; label: string; value: number }

export interface ReportView {
  awayMs: number;
  /** '8 H 12 M' */
  away: string;
  /** '9:40 PM TO 5:52 AM' */
  span: string;
  people: PeopleLine[];
  cases: {
    opened: number;
    closed: number;
    crime: { districtId: DistrictId; name: string; before: number; after: number } | null;
    leads: LeadLine[];
    moreLeads: number;
  };
  funding: { net: number; rows: FundingRow[] };
  /** Nothing to say about people or cases: the report is money and a quiet city. */
  quiet: boolean;
}

const BOND_TAG: Partial<Record<BondState, { tag: string; tone: PeopleTone }>> = {
  close: { tag: 'CLOSE', tone: 'close' },
  trusted: { tag: 'TRUSTED', tone: 'close' },
  mentor: { tag: 'MENTOR', tone: 'plain' },
  tense: { tag: 'TENSE', tone: 'plain' },
  strained: { tag: 'STRAINED', tone: 'plain' },
  acquainted: { tag: 'MET', tone: 'plain' },
};

const surname = (g: GameState, id: Id): string => g.officers[id]?.surname ?? g.people.records[id]?.snapshot?.surname ?? 'Someone';
const knownName = (g: GameState, subjectId: string): string | null => {
  const s = g.world.subjects[subjectId];
  return s && s.known ? subjectName(s) : null;
};

/** Officers waiting on the player's answer, then what changed between people while away. */
function peopleLines(g: GameState, report: ShiftReport, personalLives: boolean): PeopleLine[] {
  const lines: PeopleLine[] = [];
  // 1. A decision waiting: the note's telegraph and the three ways to answer it.
  for (const { officerId, imprintId } of teamPeopleSummary(g).needsDecision) {
    const imprint = jacketView(g, officerId)?.imprints.find((i) => i.id === imprintId);
    lines.push({
      key: `decide:${imprintId}`, officerIds: [officerId], title: surname(g, officerId), tag: 'DECIDE', tone: 'decide', open: officerId,
      text: `${imprint ? imprint.telegraph : 'Something has changed on the job.'} Rest, peer support, or pair up.`, imprintIds: [], beatIds: [],
    });
  }
  // 2. Beats the report raised: bonds, romance (when shown), notes that settled, ties that surfaced.
  const ids = new Set(report.people ?? []);
  const beatOfficers = [...new Set(g.people.beats.filter((b) => ids.has(b.id)).flatMap((b) => b.officerIds))];
  for (const { beat, line } of peopleBeatsFor(g, beatOfficers)) {
    if (!ids.has(beat.id) || beat.kind === 'fork_open' || beat.kind === 'memory' || beat.kind === 'page_opened') continue;
    if (beat.kind === 'romance' && !personalLives) continue;
    const first = beat.officerIds[0];
    if (!first) continue;
    const state = (beat.refId?.split(':')[2] ?? 'acquainted') as BondState;
    const bond = beat.kind === 'bond_changed' ? BOND_TAG[state] : undefined;
    const pair = beat.officerIds.slice(0, 2);
    const imprintId = beat.kind === 'telegraph' ? beat.refId : undefined;
    lines.push({
      key: `beat:${beat.id}`, officerIds: pair, title: pair.map((id) => surname(g, id)).join(' and '), text: line,
      tag: bond?.tag ?? (beat.kind === 'settled' ? 'SETTLED' : beat.kind === 'telegraph' ? 'NOTED' : beat.kind === 'romance' ? 'TOGETHER' : beat.kind === 'tie_surfaced' ? 'ON FILE' : 'NEW'),
      tone: bond?.tone ?? 'plain', open: first, imprintIds: imprintId ? [imprintId] : [], beatIds: [beat.id],
    });
  }
  // 3. Someone back on the board.
  const back = report.recovered.filter((id) => g.officers[id]);
  if (back.length === 1) lines.push({ key: `back:${back[0]}`, officerIds: [back[0]], title: surname(g, back[0]), text: 'Back from recovery and on the board.', tag: 'READY', tone: 'ready', open: back[0], imprintIds: [], beatIds: [] });
  else if (back.length > 1) lines.push({ key: 'back', officerIds: back.slice(0, 2), title: `${back.length} officers`, text: 'Back from recovery and on the board.', tag: 'READY', tone: 'ready', open: back[0], imprintIds: [], beatIds: [] });
  return lines.slice(0, 3);
}

/** Funding as four rows at most: the city's grants, the case awards, wages, and upkeep with restocking. The
 * report's net also carries call fees and anything else posted, shown as its own row when it is not zero. */
export function fundingRows(report: ShiftReport): FundingRow[] {
  const awards = report.world?.awardFunding ?? 0;
  const costs = report.wages;
  const upkeep = report.operating + report.restockSpend + (report.maintenanceSpend ?? 0);
  const other = report.net - (report.gross + awards - costs - upkeep);
  const rows: FundingRow[] = [{ key: 'grants', label: 'City allocation and patrol grants', value: report.gross }];
  if (awards > 0) rows.push({ key: 'cases', label: 'Cases closed', value: awards });
  if (Math.abs(other) >= 1) rows.push({ key: 'other', label: other > 0 ? 'Calls and other income' : 'Other costs', value: Math.round(other) });
  rows.push({ key: 'wages', label: 'Wages', value: -Math.round(costs) });
  if (upkeep >= 1) rows.push({ key: 'upkeep', label: 'Upkeep and restocking', value: -Math.round(upkeep) });
  return rows.slice(0, 5);
}

export function reportView(g: GameState, report: ShiftReport, personalLives = true): ReportView {
  const world = report.world;
  const people = peopleLines(g, report, personalLives);
  const leadIds = world?.leads ?? [];
  const leads = leadIds.map((id) => g.world.leads.find((l) => l.id === id)).filter((l) => !!l && l.status !== 'served').map((lead): LeadLine => {
    const name = knownName(g, lead!.subjectId) ?? 'someone';
    const crew = lead!.crewId ? g.world.crews.find((c) => c.id === lead!.crewId) : undefined;
    const tier = crew ? ARCHETYPES[crew.archetype].tierNames[lead!.tier - 1].toLowerCase() : null;
    return { leadId: lead!.id, subjectId: lead!.subjectId, title: `A lead on ${name}`, text: `${tier ? `${tier[0].toUpperCase()}${tier.slice(1)}${crew ? `, ${crew.name}` : ''}. ` : ''}The lead stays open until you act.` };
  });
  // The district whose crime moved most, so the tile reports the change the player would notice.
  let crime: ReportView['cases']['crime'] = null;
  for (const [id, pair] of Object.entries(world?.crime ?? {}) as [DistrictId, [number, number]][]) {
    if (!pair) continue;
    if (!crime || Math.abs(pair[1] - pair[0]) > Math.abs(crime.after - crime.before)) crime = { districtId: id, name: DISTRICTS[id].name, before: Math.round(pair[0]), after: Math.round(pair[1]) };
  }
  const opened = world?.casesOpened ?? 0;
  const closed = world?.casesClosed ?? 0;
  const from = clockStamp(g, report.from).time;
  const to = clockStamp(g, report.to).time;
  return {
    awayMs: report.to - report.from,
    away: awayText(report.to - report.from).toUpperCase(),
    span: `${from} TO ${to}`.toUpperCase(),
    people,
    cases: { opened, closed, crime, leads: leads.slice(0, 1), moreLeads: Math.max(0, leads.length - 1) },
    funding: { net: report.net, rows: fundingRows(report) },
    quiet: people.length === 0 && opened === 0 && closed === 0 && leads.length === 0,
  };
}

export interface WelcomeLine {
  key: string;
  kind: 'decision' | 'lead' | 'funding';
  /** The face for a decision; the crest letters for a lead. */
  officerId?: Id;
  crest?: string;
  /** The sentence is `before`, then `bold` in bold, then `after`. */
  before: string;
  bold: string;
  after: string;
  /** Funding credited: the coin glyph and number lead the sentence in place of `bold`. */
  amount?: number;
}

export interface WelcomeView {
  days: string;
  intro: string;
  lines: WelcomeLine[];
  /** Pick up with this officer when a decision is waiting. */
  pickUp: { officerId: Id; surname: string } | null;
}

/** The long-away page: where the player left it, in three lines at most. */
export function welcomeView(g: GameState, report: ShiftReport): WelcomeView {
  const days = Math.floor((report.to - report.from) / (24 * 3_600_000));
  const hours = Math.max(1, Math.round(report.accruedHours));
  const lines: WelcomeLine[] = [];
  const decision = teamPeopleSummary(g).needsDecision[0];
  if (decision) {
    const imprint = g.people.imprints.find((i) => i.id === decision.imprintId);
    lines.push({ key: 'decision', kind: 'decision', officerId: decision.officerId, before: '', bold: surname(g, decision.officerId), after: ` is still waiting on your answer${imprint ? ` about ${imprint.cause.place}` : ''}.` });
  }
  const lead = g.world.leads.filter((l) => l.status === 'open').sort((a, b) => b.tier - a.tier || a.foundAt - b.foundAt)[0];
  if (lead) {
    const crew = lead.crewId ? g.world.crews.find((c) => c.id === lead.crewId) : undefined;
    const name = knownName(g, lead.subjectId);
    lines.push({ key: 'lead', kind: 'lead', crest: crew ? crewInitials(crew.name) : 'LD', before: name ? 'The lead on ' : 'A lead on file', bold: name ?? '', after: name ? ' is still open.' : ' is still open.' });
  }
  lines.push({ key: 'funding', kind: 'funding', before: '', bold: '', amount: report.net, after: ` credited for the first ${hours === 1 ? 'hour' : `${hours} hours`}. Wages stopped with it.` });
  return {
    days: `${days} DAYS AWAY`,
    intro: `The city ran for the first ${hours === 1 ? 'hour' : `${hours} hours`}, then held still. Nobody quit and nothing was lost for being away.`,
    lines,
    pickUp: decision ? { officerId: decision.officerId, surname: surname(g, decision.officerId) } : null,
  };
}

