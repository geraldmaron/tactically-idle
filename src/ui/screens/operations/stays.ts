// What a call leaves on the people and the case, read before the player closes the debrief (docs/world-redesign.md,
// D2). Closing the debrief is what writes memory, imprints, bonds and the case. To show that first, this closes
// it on a copy with the same dispatch the store uses and reads what changed. Nothing here touches the live state.
import { IMPRINT_PACKS } from '../../../content/people/imprints';
import { dispatch } from '../../../sim/game';
import { peopleBeatsFor } from '../../../sim/people/selectors';
import type { BondState } from '../../../sim/people/types';
import type { GameState, Id } from '../../../sim/types';
import type { WorldCase } from '../../../sim/world/types';

export type ChipTone = 'people' | 'intel' | 'good' | 'warn';
export interface StayChip { text: string; tone: ChipTone }
/** One or more officers with the same line on file (a first call together reads the same for all four). */
export interface StayEntry { officerIds: Id[]; names: string; memory: string | null; chips: StayChip[] }
export interface StayPair { ids: Id[]; line: string }
export interface Stays { entries: StayEntry[]; pairs: StayPair[] }

/** The debrief closed on a copy: the state it would leave, or null when the engine refuses. */
export function previewClose(g: GameState, now: number): GameState | null {
  if (g.activeRun?.status !== 'debrief') return null;
  const out = dispatch(g, { type: 'closeDebrief' }, { now });
  return out.result.ok ? out.state : null;
}

const WITH: Partial<Record<BondState, string>> = { close: 'CLOSE WITH', trusted: 'TRUSTED BY', mentor: 'MENTOR TIE WITH', tense: 'TENSE WITH', strained: 'STRAINED WITH' };
const MAX_CHIPS = 3;

export function staysWithThem(g: GameState, after: GameState, officerIds: readonly Id[], personalLives: boolean): Stays {
  const had = { facts: new Set(g.people.facts.map((f) => f.id)), imprints: new Set(g.people.imprints.map((i) => i.id)), beats: new Set(g.people.beats.map((b) => b.id)), ties: new Set(g.people.ties.filter((t) => t.onRecord).map((t) => t.id)) };
  const bondBefore = new Map(g.people.bonds.map((b) => [`${b.a}|${b.b}`, b.state]));
  const surname = (id: Id) => after.officers[id]?.surname ?? g.officers[id]?.surname ?? 'Someone';
  const ids = officerIds.filter((id) => after.officers[id]);
  const entries: StayEntry[] = [];
  for (const id of ids) {
    const chips: StayChip[] = [];
    const memory = after.people.facts.filter((f) => f.officerId === id && !had.facts.has(f.id)).at(-1)?.detail ?? null;
    for (const im of after.people.imprints.filter((i) => i.officerId === id && !had.imprints.has(i.id))) {
      const pack = IMPRINT_PACKS[im.pack];
      chips.push({ text: `NOTE · ${pack.label.toUpperCase()}`, tone: pack.origin === 'strain' ? 'warn' : 'good' });
    }
    if ((after.people.records[id]?.pagesOpen ?? 1) > (g.people.records[id]?.pagesOpen ?? 1)) chips.push({ text: 'NEW JACKET PAGE', tone: 'people' });
    for (const t of after.people.ties.filter((k) => k.officerId === id && k.onRecord && !had.ties.has(k.id))) {
      const s = after.world.subjects[t.subjectId];
      chips.push({ text: `KNOWS ${s ? `${s.firstName} ${s.surname}`.toUpperCase() : 'SOMEONE ON THE FILE'}`, tone: 'people' });
    }
    for (const b of after.people.bonds.filter((k) => k.a === id || k.b === id)) {
      const word = WITH[b.state];
      if (!word || bondBefore.get(`${b.a}|${b.b}`) === b.state) continue;
      if (b.romance && !personalLives) continue;
      chips.push({ text: `${word} ${surname(b.a === id ? b.b : b.a).toUpperCase()}`, tone: b.state === 'tense' || b.state === 'strained' ? 'warn' : 'intel' });
    }
    if (memory || chips.length) entries.push({ officerIds: [id], names: surname(id), memory, chips: chips.slice(0, MAX_CHIPS) });
  }
  // Officers with the same line and the same notes (a first call together) read as one entry, so four faces are one fact. A chip that names a colleague is a different fact for each, so it never merges.
  const grouped: StayEntry[] = [];
  for (const e of entries) {
    const key = (x: StayEntry) => `${x.memory}|${x.chips.map((c) => c.text).join('|')}`;
    const twin = e.memory && !e.chips.some((c) => c.text.includes(' WITH ') || c.text.includes(' BY ')) ? grouped.find((g2) => key(g2) === key(e)) : undefined;
    if (twin) { twin.officerIds.push(...e.officerIds); twin.names = `${twin.names}, ${e.names}`; } else grouped.push(e);
  }
  for (const e of grouped) if (e.officerIds.length > 1) { const parts = e.names.split(', '); e.names = `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`; }
  // A bond that changed between two on the call reads as one line with both faces.
  const pairs: StayPair[] = peopleBeatsFor(after, ids)
    .filter((v) => !had.beats.has(v.beat.id) && (v.beat.kind === 'bond_changed' || (v.beat.kind === 'romance' && personalLives)) && v.beat.officerIds.length === 2)
    .map((v) => ({ ids: v.beat.officerIds, line: v.line }));
  return { entries: grouped, pairs };
}

/** The case this call serves, as the copy leaves it. */
export const caseAfter = (after: GameState, caseId: Id): WorldCase | undefined => after.world.cases.find((c) => c.id === caseId);
