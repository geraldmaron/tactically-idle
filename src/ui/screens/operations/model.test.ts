import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../sim/department';
import { dispatch } from '../../../sim/game';
import type { GameState } from '../../../sim/types';
import { openCase, addLead } from '../../../sim/world/cases';
import { crewLadder, subjectDossier } from '../../../sim/world/selectors';
import { clockIn, crewLine, fileLines, leadReady, memberState, readyLeads, shortName, tierCells, tierCounts, waitsForPlayer, warrantTiles } from './model';
import { officersWhoKnow } from './knows';
import { staysWithThem } from './stays';

const T0 = 1_800_000_000_000 + 20 * 60_000;

function founded(): GameState {
  let s = createInitialState(T0, 7);
  s.world.onboarding.stage = 'founding';
  const out = dispatch(s, { type: 'foundDepartment', name: 'Night Unit', districtId: 'pike' }, { now: T0 });
  if (!out.result.ok) throw new Error(out.result.reason);
  s = out.state;
  s.world.onboarding.stage = 'done';
  return s;
}

/** A crew with a known lieutenant carrying a lead, a held runner and a known one. */
function seeded() {
  const s = founded();
  const w = s.world;
  const crew = w.crews.find((c) => c.districtId === 'pike')!;
  const at = (t: number) => Object.values(w.subjects).filter((x) => x.crewId === crew.id && x.tier === t);
  const lt = at(3)[0];
  lt.known = true;
  crew.intel[lt.id] = 6;
  const held = at(2)[0];
  openCase(s, w, { subject: held, tier: 2, source: 'patrol', at: T0, status: 'review' });
  const c = openCase(s, w, { subject: lt, tier: 3, source: 'proactive', at: T0, status: 'open' });
  const lead = addLead(w, c, 'intel', T0);
  return { s, crew, lt, held, c, lead };
}

describe('names and clocks', () => {
  it('shortens a name to the last word and says nothing for none', () => {
    expect(shortName('Kevin Doyle')).toBe('Doyle');
    expect(shortName(null)).toBeNull();
  });
  it('reads a clock in hours or minutes', () => {
    expect(clockIn(T0 + 6 * 3_600_000, T0)).toBe('6 h');
    expect(clockIn(T0 + 45 * 60_000, T0)).toBe('45 min');
  });
  it('knows a world card has no countdown', () => {
    expect(waitsForPlayer(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(waitsForPlayer(T0 + 3_600_000)).toBe(false);
  });
});

describe('the ladder as the screen reads it', () => {
  it('marks a lead with its intel as ready, and a member under review as held', () => {
    const { s, crew, lt, held, lead } = seeded();
    expect(leadReady(s, lead)).toBe(true);
    expect(readyLeads(s).map((l) => l.id)).toEqual([lead.id]);
    const ladder = crewLadder(s, crew.id)!;
    const ltMember = ladder.tiers[2].members.find((m) => m.id === lt.id)!;
    const heldMember = ladder.tiers[1].members.find((m) => m.id === held.id)!;
    expect(memberState(s, ltMember)).toBe('ready');
    expect(memberState(s, heldMember)).toBe('held');
  });

  it('keeps a lead below its intel from being ready, and one on the board from being planned twice', () => {
    const { s, crew, lt, lead } = seeded();
    crew.intel[lt.id] = 2;
    expect(leadReady(s, lead)).toBe(false);
    crew.intel[lt.id] = 6;
    lead.status = 'warrant';
    expect(leadReady(s, lead)).toBe(false);
    const m = crewLadder(s, crew.id)!.tiers[2].members.find((x) => x.id === lt.id)!;
    expect(memberState(s, m)).toBe('board');
  });

  it('draws tier 1 as held, then known, then unknown, and adds up to the crew size', () => {
    const { s, crew } = seeded();
    const t1 = crewLadder(s, crew.id)!.tiers[0];
    const cells = tierCells(t1);
    const counts = tierCounts(t1);
    expect(cells.length).toBe(t1.members.length);
    expect(counts.held + counts.known + counts.unknown + counts.taken).toBe(cells.length);
    const order = ['held', 'known', 'unknown', 'taken'];
    expect(cells.map((c) => order.indexOf(c))).toEqual([...cells.map((c) => order.indexOf(c))].sort((a, b) => a - b));
  });

  it('names no one the player has not met', () => {
    const { s, crew } = seeded();
    const unknown = crewLadder(s, crew.id)!.tiers[3].members[0];
    expect(unknown.name).toBeNull();
    expect(memberState(s, unknown)).toBe('unknown');
  });

  it('says what the crew is doing in plain words with the crew name', () => {
    const { s, crew } = seeded();
    const line = crewLine(s, crew.id);
    expect(line).toContain(crew.name);
    expect(line).not.toMatch(/[–—]/);
  });
});

describe('the dossier', () => {
  it('dates the file by game day, newest first, and words each line from its kind', () => {
    const { s, lt } = seeded();
    const d = subjectDossier(s, lt.id)!;
    const lines = fileLines(s, d);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].when).toMatch(/^DAY \d+$/);
    expect(lines.every((l) => l.text.endsWith('.'))).toBe(true);
  });

  it('shows a tie on the record and keeps a hidden one off the dossier', () => {
    const { s, lt } = seeded();
    const officer = Object.keys(s.officers)[0];
    s.people.ties.push({ id: 't1', officerId: officer, subjectId: lt.id, kind: 'gym', origin: 'jacket', onRecord: true, since: T0 });
    s.people.ties.push({ id: 't2', officerId: Object.keys(s.officers)[1], subjectId: lt.id, kind: 'church', origin: 'jacket', onRecord: false, since: T0 });
    expect(subjectDossier(s, lt.id)!.ties.map((t) => t.id)).toEqual(['t1']);
  });

  it('gives the case value, the crime step and the intel a close adds', () => {
    const { s, c, lt, crew } = seeded();
    const t = warrantTiles(s, c, 3, lt.districtId, crew.id);
    expect(t.caseFunding).toBe(c.award);
    expect(t.crimeLine).toMatch(/^\d+ to about \d+$/);
    expect(t.intelLine).toMatch(/^Intel \+\d/);
  });
});

describe('who knows the person on a call', () => {
  it('lists officers with a tie on the record, with the subject pronoun, and nobody otherwise', () => {
    const { s, lt, c, lead } = seeded();
    const officer = Object.keys(s.officers)[0];
    s.people.ties.push({ id: 't1', officerId: officer, subjectId: lt.id, kind: 'gym', origin: 'jacket', onRecord: true, since: T0 });
    expect(officersWhoKnow(s).size).toBe(0);
    s.activeRun = { world: { kind: 'warrant', caseId: c.id, leadId: lead.id, subjectId: lt.id, caseTier: 3, districtId: 'pike' } } as unknown as GameState['activeRun'];
    const map = officersWhoKnow(s);
    expect([...map.keys()]).toEqual([officer]);
    expect(['him', 'her', 'them']).toContain(map.get(officer));
  });
});

describe('what stays with them', () => {
  it('reads a new memory, a bond and a jacket page off the state a close would leave, and merges equal lines', () => {
    const { s } = seeded();
    const [a, b, c2] = Object.keys(s.officers);
    const after = structuredClone(s);
    for (const id of [a, b]) after.people.facts.push({ id: `f-${id}`, officerId: id, at: T0, kind: 'first_call', place: 'Pike', with: [], detail: 'Talked at Pike for 15 minutes.' });
    after.people.facts.push({ id: 'f-c', officerId: c2, at: T0, kind: 'rescue', place: 'Pike', with: [], detail: 'Carried a child out.' });
    after.people.bonds.push({ a: [a, c2].sort()[0], b: [a, c2].sort()[1], state: 'close', drift: 0, since: T0, cause: { kind: 'shared_call', at: T0 } });
    const out = staysWithThem(s, after, [a, b, c2], true);
    const merged = out.entries.find((e) => e.officerIds.includes(b));
    expect(merged?.memory).toBe('Talked at Pike for 15 minutes.');
    const withBond = out.entries.find((e) => e.officerIds.includes(a));
    // The one with a bond chip is not merged into the plain memory entry.
    expect(withBond?.chips.some((chip) => chip.text.startsWith('CLOSE WITH'))).toBe(true);
    expect(out.entries.flatMap((e) => e.officerIds).sort()).toEqual([a, b, c2].sort());
  });

  it('hides a romance change when the officers personal lives are off', () => {
    const { s } = seeded();
    const [a, b] = Object.keys(s.officers).sort();
    const after = structuredClone(s);
    after.people.bonds.push({ a, b, state: 'close', drift: 0, since: T0, cause: { kind: 'shared_call', at: T0 }, romance: { since: T0 } });
    const off = staysWithThem(s, after, [a, b], false);
    expect(off.entries.some((e) => e.chips.some((chip) => chip.text.startsWith('CLOSE WITH')))).toBe(false);
    const on = staysWithThem(s, after, [a, b], true);
    expect(on.entries.some((e) => e.chips.some((chip) => chip.text.startsWith('CLOSE WITH')))).toBe(true);
  });
});
