// Team's pure mappings and selectors (station rebuild). Nothing here reads the store or writes the sim:
// each function takes the state or the records it needs, so the rules run in node tests. Every line a
// player reads comes from something the game records. What the game does not record is left out; the
// requests for that data are listed in the lane's READY note, not invented here.
import { CERT_NAME } from '../../content/certs';
import { RANKS } from '../../content/ranks';
import type { RankId } from '../../content/ranks';
import { COMMAND_STAFF, type ManagerId } from '../../sim/command-staff';
import { stressBand } from '../../sim/officer';
import type { Candidate, CertId, DebriefResult, GameState, Id, Officer, RatingKey, SquadId } from '../../sim/types';
import { CERT_ICON, RATING_META, ROLE_META, STATUS_META, type StatusKey } from '../components/labels';
import type { IconName } from '../icons';
import { funding, fundingPerHour } from '../format';
import { scenarioTitle } from './helpers';
import { officerStatus } from './squad-model';

// ---------------------------------------------------------------- squads

/** The four crests, one per squad letter (public/art/crests, docs/art/station-rebuild.md). */
export const SQUAD_CREST: Record<SquadId, string> = {
  A: 'art/crests/alpha.webp',
  B: 'art/crests/bravo.webp',
  C: 'art/crests/charlie.webp',
  D: 'art/crests/delta.webp',
};

export const squadCrest = (id: SquadId): string => SQUAD_CREST[id];

export interface RosterCounts {
  officers: number;
  ready: number;
  strained: number;
  /** Injured, in training, teaching or on a call. */
  away: number;
  /** Not in any squad. */
  bench: number;
}

/** Counts for the scene's one line. Each officer lands in at most one of ready, strained and away. */
export function rosterCounts(officers: readonly Officer[], now: number): RosterCounts {
  const counts: RosterCounts = { officers: officers.length, ready: 0, strained: 0, away: 0, bench: 0 };
  for (const officer of officers) {
    if (officer.squadId === null) counts.bench += 1;
    const status = officerStatus(officer, now);
    if (status === 'ready') counts.ready += 1;
    else if (status === 'strained' || status === 'overloaded' || status === 'recovery') counts.strained += 1;
    else counts.away += 1;
  }
  return counts;
}

/** "9 officers · 8 ready · 1 strained · 1 on the bench". Zero counts are left out. */
export function rosterLine(counts: RosterCounts): string {
  const parts = [`${counts.officers} ${counts.officers === 1 ? 'officer' : 'officers'}`];
  if (counts.ready > 0) parts.push(`${counts.ready} ready`);
  if (counts.strained > 0) parts.push(`${counts.strained} strained`);
  if (counts.away > 0) parts.push(`${counts.away} away`);
  if (counts.bench > 0) parts.push(`${counts.bench} on the bench`);
  return parts.join(' · ');
}

/** A tile or row names a status only when the officer is not simply ready. */
export function tileStatus(officer: Officer, now: number): StatusKey | null {
  const status = officerStatus(officer, now);
  return status === 'ready' ? null : status;
}

export const tileStatusLabel = (status: StatusKey): string => STATUS_META[status].label;

/** The squad's state in one detail line: who is ready, who leads, how many places are open. */
export function squadDetail(opts: { deployed: boolean; ready: number; total: number; members: number; leader: string | null; size?: number }): string {
  const size = opts.size ?? 4;
  const open = Math.max(0, size - opts.members);
  const state = opts.deployed ? 'On a call' : opts.ready === opts.members && opts.members > 0 ? `All ${opts.members} ready` : `${opts.ready} of ${opts.total} ready`;
  return [state, opts.leader ? `${opts.leader} leads` : null, open > 0 ? (open === 1 ? '1 open place' : `${open} open places`) : null].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- certifications

export interface CertEntry { id: CertId; name: string; icon: IconName }

export const certEntry = (id: CertId): CertEntry => ({ id, name: CERT_NAME[id], icon: CERT_ICON[id] });

/** Every certification held by anyone in `officers`, once each, for the legend that explains the glyphs. */
export function certLegend(officers: readonly Pick<Officer, 'certs'>[]): CertEntry[] {
  const seen = new Set<CertId>();
  for (const officer of officers) for (const cert of officer.certs) seen.add(cert);
  return [...seen].sort((a, b) => CERT_NAME[a].localeCompare(CERT_NAME[b])).map(certEntry);
}

// ---------------------------------------------------------------- hire

export interface Standout { key: RatingKey; label: string; value: number }

/** The one rating a candidate is best at (ties keep the usual skill order). */
export function standoutRating(officer: Pick<Officer, 'ratings'>): Standout {
  let best = RATING_META[0];
  for (const meta of RATING_META) if (officer.ratings[meta.key] > officer.ratings[best.key]) best = meta;
  return { key: best.key, label: best.short, value: Math.round(officer.ratings[best.key]) };
}

/** "Medical 66 · Advanced first aid": the strongest rating and, when they hold one, a certification. */
export function standoutLine(officer: Pick<Officer, 'ratings' | 'certs'>): string {
  const top = standoutRating(officer);
  const cert = officer.certs[0];
  return `${top.label} ${top.value}${cert ? ` · ${CERT_NAME[cert]}` : ''}`;
}

/** Terms in small print: the wage, then what it costs to sign. */
export function hireTerms(candidate: Pick<Candidate, 'signingCost'> & { officer: Pick<Officer, 'wage'> }): string {
  return `${fundingPerHour(candidate.officer.wage)} · ${funding(candidate.signingCost)} to sign`;
}

// ---------------------------------------------------------------- last call

export interface LastCall {
  runId: Id;
  title: string;
  ending: string;
  stressBefore: number;
  stressAfter: number;
  xpGained: number;
}

/** The newest recorded call this officer worked, or null when none is in the kept debriefs (the game keeps
 * the newest ten). `debriefs` are newest first. */
export function lastCallOf(g: GameState, officerId: Id, now: number): LastCall | null {
  const debrief: DebriefResult | undefined = g.debriefs.find((d) => d.officerCondition.some((row) => row.officerId === officerId));
  if (!debrief) return null;
  const row = debrief.officerCondition.find((r) => r.officerId === officerId)!;
  return {
    runId: debrief.runId,
    title: scenarioTitle(g, debrief.scenarioId, now),
    ending: debrief.endingTitle,
    stressBefore: Math.round(row.stressBefore),
    stressAfter: Math.round(row.stressAfter),
    xpGained: Math.round(row.xpGained),
  };
}

/** "Last call: Barricade on Wren Court, Everyone Safe. Stress 12 to 21. 40 XP." */
export function lastCallLine(call: LastCall): string {
  const stress = call.stressAfter === call.stressBefore ? '' : ` Stress ${call.stressBefore} to ${call.stressAfter}.`;
  const xp = call.xpGained > 0 ? ` ${call.xpGained} XP.` : '';
  return `Last call: ${call.title}, ${call.ending}.${stress}${xp}`;
}

// ---------------------------------------------------------------- promotions

type RankLedger = Record<Id, { surname: string; rank: RankId; cause: string }[]>;

/** Officer ids to the ranks they have reached, for comparing before and after. */
export function promotionLedger(officers: Record<Id, Pick<Officer, 'surname' | 'promotions'>>): RankLedger {
  const out: RankLedger = {};
  for (const [id, officer] of Object.entries(officers)) out[id] = (officer.promotions ?? []).map((p) => ({ surname: officer.surname, rank: p.rank, cause: p.cause }));
  return out;
}

export interface NewPromotion { officerId: Id; surname: string; rank: RankId; cause: string }

/** Promotions present now that were not in `before`. An officer who was not known before (a new hire)
 * is never reported as promoted. */
export function newPromotions(before: RankLedger, after: RankLedger): NewPromotion[] {
  const out: NewPromotion[] = [];
  for (const [id, list] of Object.entries(after)) {
    const known = before[id];
    if (!known) continue;
    for (const p of list.slice(known.length)) out.push({ officerId: id, surname: p.surname, rank: p.rank, cause: p.cause });
  }
  return out;
}

/** "Sergeant, after Barricade on Wren Court": the rank and the cause the game recorded. */
export function promotionLine(rank: RankId, cause: string): string {
  const title = RANKS[rank].title;
  const c = cause.trim();
  return c ? `${title}, ${c}` : title;
}

// ---------------------------------------------------------------- command seats

/** What an empty seat would do now, in plain words from the post's own duty text, with the current
 * state where the game can say it without guessing. Returns a sentence that stands alone. */
export function seatPreview(g: Pick<GameState, 'officers' | 'squads' | 'department'>, id: ManagerId, duty: string): string {
  const sentence = duty.split('. ')[0].replace(/\.$/, '');
  const idle = (o: Officer) => !o.assignment;
  switch (id) {
    case 'watch_commander': {
      const limit = COMMAND_STAFF.watchCommander.defaultRestAt;
      const tired = g.squads.filter((squad) => squad.duty !== 'rest' && squad.officerIds.some((oid) => (g.officers[oid]?.stress ?? 0) >= limit));
      if (tired.length > 0) return `Would rest ${tired.map((s) => s.name).join(' and ')} now.`;
      break;
    }
    case 'peer_support_lead': {
      const at = COMMAND_STAFF.peerSupportLead.defaultSupportAt;
      const n = Object.values(g.officers).filter((o) => idle(o) && o.stress >= at && stressBand(o.stress) !== 'ready').length;
      if (n > 0) return `Would offer a session to ${n === 1 ? '1 officer' : `${n} officers`} now.`;
      break;
    }
    case 'training_sergeant': {
      const free = g.department.trainingSlots - Object.values(g.officers).filter((o) => o.assignment?.kind === 'training').length;
      if (free > 0) return `Would fill ${free === 1 ? '1 free training place' : `${free} free training places`}.`;
      break;
    }
    case 'recruiter': {
      const room = g.department.rosterCap - Object.keys(g.officers).length;
      if (room > 0) return `Would sign for ${room === 1 ? '1 open place' : `${room} open places`} on the roster.`;
      break;
    }
    default: break;
  }
  return `${sentence}.`;
}

/** What a seated manager last did, or the one line the game keeps on what they do now. */
export function lastActionLine(log: readonly { at: number; text: string }[], activity: string): string {
  return log[0]?.text ?? activity;
}

// ---------------------------------------------------------------- role words

export const roleLabel = (officer: Pick<Officer, 'role'>): string => ROLE_META[officer.role].label;
