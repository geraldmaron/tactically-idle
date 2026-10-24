// What the Investigations, dossier and warrant surfaces say, as plain data from the world selectors. Pure: no
// React and no store, so a unit test reads the same words the screen shows. No funding sign is made here; the
// screen draws the funding glyph beside a number.
import { ARCHETYPES } from '../../../content/city/archetypes';
import { DISTRICTS } from '../../../content/city/districts';
import { CRIME, HOUR } from '../../../content/city/tuning';
import { gameDay } from '../../../sim/calendar';
import type { GameState, Id } from '../../../sim/types';
import type { Dossier, LadderMember, LadderTier } from '../../../sim/world/selectors';
import type { Lead, Tier, WorldCase } from '../../../sim/world/types';

/** The last word of a full name: the board shows "Doyle", the dossier the whole name. */
export const shortName = (full: string | null): string | null => full ? full.trim().split(/\s+/).slice(-1)[0] : null;

const OBJECT_PRONOUN: Record<string, string> = { he: 'him', she: 'her', they: 'them' };
export const objectPronoun = (pronouns: string): string => OBJECT_PRONOUN[pronouns] ?? 'them';

/** A lead can open a warrant: it waits (not on the board, not served) and, when it came from intel, the crew
 * has the intel the archetype asks for. Mirrors world/warrants.ts openWarrant, which refuses the same way. */
export function leadReady(g: GameState, lead: Lead): boolean {
  if (lead.status !== 'open') return false;
  if (lead.source !== 'intel') return true;
  const crew = lead.crewId ? g.world.crews.find((k) => k.id === lead.crewId) : undefined;
  if (!crew) return true;
  return (crew.intel[lead.subjectId] ?? 0) >= ARCHETYPES[crew.archetype].intelNeeded[lead.tier === 4 ? 4 : 3];
}

/** Leads whose warrant can be planned now, newest first. */
export const readyLeads = (g: GameState): Lead[] => g.world.leads.filter((l) => leadReady(g, l)).sort((a, b) => b.foundAt - a.foundAt);

export type CardState = 'ready' | 'board' | 'held' | 'known' | 'intel' | 'unknown';

/** How one person on the ladder reads: a warrant ready, already on the board, held, known, or still a name
 * the crew keeps back. */
export function memberState(g: GameState, m: LadderMember): CardState {
  if (m.held) return 'held';
  if (m.lead) {
    if (m.lead.status === 'warrant') return 'board';
    if (leadReady(g, m.lead)) return 'ready';
  }
  if (!m.known) return 'unknown';
  return m.intelNeed !== null ? 'intel' : 'known';
}

export type CellKind = 'held' | 'known' | 'unknown' | 'taken';

/** The tier 1 strip: held first, then known, then unknown, then the places of people charged and gone. */
export function tierCells(t: LadderTier): CellKind[] {
  const rank = (m: LadderMember): CellKind => m.held ? 'held' : m.known ? 'known' : 'unknown';
  const order: CellKind[] = ['held', 'known', 'unknown'];
  const cells = t.members.map(rank).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const gone = Math.max(0, Math.min(t.full - cells.length, t.taken));
  return [...cells, ...Array<CellKind>(gone).fill('taken')];
}

export function tierCounts(t: LadderTier): Record<CellKind, number> {
  const out: Record<CellKind, number> = { held: 0, known: 0, unknown: 0, taken: 0 };
  for (const c of tierCells(t)) out[c]++;
  return out;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One line on what the crew is doing: who is back on the street after a release and how fast it recruits. */
export function crewLine(g: GameState, crewId: Id): string {
  const crew = g.world.crews.find((c) => c.id === crewId);
  if (!crew) return '';
  const arch = ARCHETYPES[crew.archetype];
  const members = Object.values(g.world.subjects).filter((s) => s.crewId === crew.id && s.tier === 1);
  const back = members.filter((s) => s.status === 'free' && s.history.some((h) => h.kind === 'released')).length;
  const weekly = Math.max(1, Math.round(arch.recruitPerDay[1] * 7));
  const name = crew.name;
  if (crew.status === 'collapsed') return `${name} has fallen apart. Its people are scattered.`;
  const first = back > 0 ? `${plural(back, `${arch.tierNames[0].toLowerCase()} is`, `${arch.tierNames[0].toLowerCase()}s are`)} back on ${DISTRICTS[crew.districtId].name} after release. ` : '';
  return `${first}${name} recruits about ${weekly} a week while it is short of people.`;
}

export interface FileLine { when: string; text: string; at: number }

const FILE_TEXT: Record<string, (district: string) => string> = {
  stopped: () => 'Stopped on patrol.',
  case_opened: () => 'An investigation opened.',
  case_closed: () => 'The case closed.',
  released: () => 'Released after review.',
  sighted: (d) => `Seen again on ${d}.`,
  lead: () => 'A lead came in on this name.',
  warrant_served: () => 'A warrant was served.',
};

/** "On file": the person's history, newest first, at most five, dated by game day. */
export function fileLines(g: GameState, d: Dossier, limit = 5): FileLine[] {
  return [...d.facts].sort((a, b) => b.at - a.at).slice(0, limit).map((f) => ({
    at: f.at,
    when: `DAY ${Math.max(0, Math.floor(gameDay(g, f.at)))}`,
    text: (FILE_TEXT[f.kind] ?? (() => 'On file.'))(d.districtName),
  }));
}

const STATUS_WORD: Record<Dossier['status'], string> = { free: 'Free', held: 'Held, case under review', resolved: 'Case resolved', gone: 'Gone from the city' };

export const dossierSubline = (d: Dossier): string => [d.tierName, d.crewName].filter(Boolean).join(', ') + `. ${STATUS_WORD[d.status]}.`;

/** The case that will pay when it closes: the open investigation, or the one under review. */
export function livingCase(d: Dossier): Dossier['cases'][number] | undefined {
  return d.cases.find((c) => c.status === 'open') ?? d.cases.find((c) => c.status === 'review');
}

/** "6 h" or "45 min", from now to a clock end. */
export function clockIn(closesAt: number, now: number): string {
  const ms = Math.max(0, closesAt - now);
  if (ms >= HOUR) { const h = ms / HOUR; return `${h >= 10 ? Math.round(h) : Math.round(h * 10) / 10} h`; }
  return `${Math.max(1, Math.round(ms / 60_000))} min`;
}

export interface WarrantTiles {
  caseFunding: number | null;
  crimeLine: string;
  intelLine: string;
}

/** The three tiles on warrant prep and the debrief, from what closing the case does (world/cases.ts closeCase):
 * the award, the district's step down and the intel it adds toward the next rung. */
export function warrantTiles(g: GameState, c: WorldCase | undefined, tier: Tier, districtId: Lead['districtId'], crewId: Id | null): WarrantTiles {
  const district = g.world.districts[districtId];
  const crew = crewId ? g.world.crews.find((k) => k.id === crewId) : undefined;
  const step = CRIME.stepDown[tier];
  const crime = Math.round(district.crime);
  const after = Math.max(0, Math.round(district.crime - step));
  let intelLine = 'No new intel';
  if (crew && crew.status === 'active') {
    const arch = ARCHETYPES[crew.archetype];
    if (tier === 4) intelLine = `${crew.name} falls apart`;
    else if (tier === 3) intelLine = `Intel +${arch.intelPerCase[3]} on the ${arch.tierNames[3].toLowerCase()}`;
    else intelLine = `Intel +${arch.intelPerCase[tier === 2 ? 2 : 1]} toward the ${arch.tierNames[2].toLowerCase()}s`;
  }
  return { caseFunding: c ? c.award : null, crimeLine: tier === 4 ? `${crime} to about ${Math.max(0, after - CRIME.collapseDrop)}` : `${crime} to about ${after}`, intelLine };
}

/** A world card (a warrant, an armed contact) never lapses: its `expiresAt` is the largest safe integer (world/warrants.ts).
 * It has no countdown to show. */
export const waitsForPlayer = (expiresAt: number): boolean => expiresAt >= Number.MAX_SAFE_INTEGER / 2;
