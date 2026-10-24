import { describe, expect, it } from 'vitest';
import { advance, freshState } from '../../../sim/fixtures/people-fixtures';
import type { GameState } from '../../../sim/types';
import { bandCaption, bondCaptionLine, bondCards, decisionBanners, officerNote, officerRowView, squadHeader, webEdges, webLayout } from './team-view';

const ids = (d: GameState) => Object.keys(d.officers);
const bond = (d: GameState, x: string, y: string, state: 'trusted' | 'close' | 'mentor' | 'tense' | 'strained' | 'acquainted', extra: Partial<GameState['people']['bonds'][number]> = {}) => {
  const [a, b] = x < y ? [x, y] : [y, x];
  d.people.bonds.push({ a, b, state, drift: 0, since: d.department.clockHighWater, cause: { kind: 'shared_call', place: 'Wren Court', at: d.department.clockHighWater }, ...extra });
};
const imprint = (d: GameState, officerId: string, over: Partial<GameState['people']['imprints'][number]> = {}) => {
  const at = d.department.clockHighWater;
  d.people.imprints.push({ id: 'im1', officerId, pack: 'doubts_the_rear', cause: { place: 'the laundromat stairs', at }, startedAt: at, endsAt: at + 3_600_000, seen: true, fork: { offeredAt: at }, forkDue: 'repeat', ...over });
};

describe('bandCaption', () => {
  it('names the band and the stress, the one number on a roll', () => {
    expect(bandCaption(16.9)).toBe('READY 16');
    expect(bandCaption(31)).toBe('STRAINED 31');
    expect(bandCaption(64)).toBe('OVERLOADED 64');
    expect(bandCaption(82)).toBe('RECOVERY 82');
  });
});

describe('officerNote', () => {
  it('says what is recorded and nothing else: a new officer has only their service', () => {
    const d = freshState();
    const o = d.officers[ids(d)[0]];
    o.career.operations = 0;
    expect(officerNote(d, o, d.department.clockHighWater)).toEqual({ text: 'New to the department', tone: 'plain' });
    o.career.operations = 4;
    expect(officerNote(d, o, d.department.clockHighWater).text).toBe('4 calls with this department');
  });

  it('puts a note that waits on the player first, in the people tone, without the place (the banner has it)', () => {
    const d = freshState();
    const [a, b] = ids(d);
    imprint(d, a);
    bond(d, a, b, 'close');
    const note = officerNote(d, d.officers[a], d.department.clockHighWater);
    expect(note.tone).toBe('people');
    expect(note.text.startsWith('Something is starting to stick')).toBe(true);
    expect(note.text).not.toContain('laundromat');
  });

  it('names a tense bond with its date and the other officer, in the harm tone', () => {
    const d = freshState();
    const [a, b] = ids(d);
    bond(d, a, b, 'tense');
    const note = officerNote(d, d.officers[a], d.department.clockHighWater);
    expect(note.tone).toBe('harm');
    expect(note.text).toMatch(new RegExp(`^Tense with ${d.officers[b].surname} since \\d+ \\w{3}$`));
  });

  it('leans on a positive note by its trait name, and keeps a line to two parts at most', () => {
    const d = freshState();
    const [a, b, c] = ids(d);
    imprint(d, a, { pack: 'found_the_voice', fork: undefined, forkDue: undefined });
    bond(d, a, b, 'close');
    bond(d, a, c, 'tense');
    const note = officerNote(d, d.officers[a], d.department.clockHighWater);
    expect(note.tone).toBe('good');
    expect(note.text.split(' · ').length).toBeLessThanOrEqual(2);
    expect(note.text.startsWith('Leaning keeps the line open')).toBe(true);
  });

  it('puts why they are away before anything else', () => {
    const d = freshState();
    const [a] = ids(d);
    const now = d.department.clockHighWater;
    d.officers[a].assignment = { kind: 'standdown', imprintId: 'im1', startedAt: now, endsAt: now + 3 * 3_600_000 };
    expect(officerNote(d, d.officers[a], now).text).toMatch(/^Stood down, back in 3h/);
  });

  it('skips a bond with someone who has left', () => {
    const d = freshState();
    const [a, b] = ids(d);
    bond(d, a, b, 'close');
    d.people.records[b].status = 'dismissed';
    delete d.officers[b];
    expect(officerNote(d, d.officers[a], d.department.clockHighWater).text).not.toMatch(/Close with/);
  });
});

describe('officerRowView and squadHeader', () => {
  it('builds a row from the officer and flags the leader and a waiting decision', () => {
    const d = freshState();
    const squad = d.squads[0];
    const o = d.officers[squad.officerIds[0]];
    imprint(d, o.id);
    const row = officerRowView(d, o, d.department.clockHighWater, o.id);
    expect(row).toMatchObject({ id: o.id, leader: true, needsDecision: true, surname: o.surname });
    expect(row.bandCaption).toBe(bandCaption(o.stress));
  });

  it('reads a squad as standby with who needs rest', () => {
    const d = freshState();
    const squad = d.squads[0];
    const now = d.department.clockHighWater;
    expect(squadHeader(d, squad, now)).toMatchObject({ left: `SQUAD ${squad.id} · STANDBY`, right: 'ALL READY' });
    d.officers[squad.officerIds[0]].stress = 64;
    expect(squadHeader(d, squad, now).right).toBe('ONE NEEDS REST');
    d.officers[squad.officerIds[1]].stress = 85;
    expect(squadHeader(d, squad, now).right).toBe('2 NEED REST');
  });

  it('shows the district and the time left for a squad on a proactive shift', () => {
    const d = freshState();
    const squad = d.squads[0];
    const now = d.department.clockHighWater;
    const shift = { id: 'p1', squadId: squad.id, districtId: 'pike' as const, startedAt: now, endsAt: now + 2 * 3_600_000, contacts: 0, caseIds: [], leadIds: [] };
    d.world.shifts.push(shift);
    for (const id of squad.officerIds) d.officers[id].assignment = { kind: 'proactive', shiftId: 'p1', startedAt: now, endsAt: shift.endsAt };
    expect(squadHeader(d, squad, now)).toEqual({ left: `SQUAD ${squad.id} · PIKE STREET SHIFT`, right: '2H LEFT', tone: 'live' });
  });
});

describe('decisionBanners', () => {
  it('lists officers whose fork is open and seen, with the place and no one else', () => {
    const d = freshState();
    const [a, b] = ids(d);
    imprint(d, a);
    imprint(d, b, { id: 'im2', fork: undefined, forkDue: undefined });
    expect(decisionBanners(d)).toEqual([{ imprintId: 'im1', officerId: a, surname: d.officers[a].surname, line: 'Something from the laundromat stairs is starting to stick' }]);
  });
});

describe('the bond web', () => {
  it('draws a romance as off the clock only when personal lives are on, and as the close tie it is when off', () => {
    const d = freshState();
    const [a, b] = ids(d);
    bond(d, a, b, 'close', { romance: { since: d.department.clockHighWater } });
    expect(webEdges(d, ids(d), true)[0]).toMatchObject({ style: 'off_clock', romance: true });
    expect(webEdges(d, ids(d), false)[0]).toMatchObject({ style: 'close', romance: false });
  });

  it('draws strained as the tense line and keeps a mentor its own', () => {
    const d = freshState();
    const [a, b, c] = ids(d);
    bond(d, a, b, 'strained');
    bond(d, a, c, 'mentor');
    const styles = Object.fromEntries(webEdges(d, ids(d), true).map((e) => [e.b === b || e.a === b ? 'x' : 'y', e.style]));
    expect(Object.values(styles).sort()).toEqual(['mentor', 'tense']);
  });

  it('places everyone, deterministically, inside the board', () => {
    const d = freshState();
    const all = ids(d);
    bond(d, all[0], all[1], 'close');
    const one = webLayout(all, [{ a: all[0], b: all[1] }]);
    const two = webLayout(all, [{ a: all[0], b: all[1] }]);
    expect(one).toEqual(two);
    expect(Object.keys(one).sort()).toEqual([...all].sort());
    for (const p of Object.values(one)) { expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(358); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(340); }
    // The best connected officer is never on the same spot as anyone else.
    const spots = new Set(Object.values(one).map((p) => `${p.x},${p.y}`));
    expect(spots.size).toBe(all.length);
  });

  it('gives a tense pair its recorded cause, and a romance no state or effect words', () => {
    const d = freshState();
    advance(d, 24);
    const [a, b, c, e] = ids(d);
    bond(d, a, b, 'tense', { cause: { kind: 'rear_left_open', place: 'the garage on Calder', at: d.department.clockHighWater } });
    bond(d, c, e, 'close', { romance: { since: d.department.clockHighWater } });
    const on = bondCards(d, true);
    expect(on.map((x) => x.kind)).toEqual(['tense', 'romance']);
    expect(on[0].body).toContain('a rear was left open');
    expect(on[0].body).toContain('the garage on Calder');
    expect(on[1].body).not.toMatch(/close|trusted|tense|stress|\d/i);
    expect(bondCards(d, false).map((x) => x.kind)).toEqual(['tense']);
  });

  it('counts bonds on the caption and leaves acquaintances out', () => {
    const d = freshState();
    const [a, b, c] = ids(d);
    bond(d, a, b, 'close');
    bond(d, a, c, 'acquainted');
    expect(bondCaptionLine(d, ids(d))).toBe('8 OFFICERS · 1 BOND');
  });
});
