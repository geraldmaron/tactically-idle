import { describe, expect, it } from 'vitest';
import { PEOPLE_HANDLERS, applyPeopleDebrief } from './index';
import { aftercareView, jacketView, peopleBeatsFor, teamPeopleSummary } from './selectors';
import { advance, buildCall, CONTACT_ACTION, freshState, REAR_ACTION } from '../fixtures/people-fixtures';
import { validPeopleState } from './validate';
import type { GameState } from '../types';

const ctx = { now: 0 };

function withBrooks(d: GameState) {
  const seat = d.officers.off_brooks;
  seat.identityId = 'person_002';
  d.people.records[seat.id].identityId = 'person_002';
  return seat.id;
}

describe('jacketView', () => {
  it('is null for someone never employed and shows only the open pages', () => {
    const d = freshState();
    expect(jacketView(d, 'off_nobody')).toBeNull();
    const id = withBrooks(d);
    const v = jacketView(d, id)!;
    expect(v.pagesOpen).toBe(1);
    expect(v.pagesAuthored).toBe(3);
    expect(v.page1.pressureLine).toMatch(/radios/);
    expect(v.page2).toBeNull();
    expect(v.page3).toBeNull();
    expect(v.memories).toEqual([]);
  });

  it('fills the keyed page from the fact\'s place, and lists memories newest first', () => {
    const d = freshState();
    const id = withBrooks(d);
    for (let i = 0; i < 4; i++) {
      advance(d, 1);
      const { run, result } = buildCall(d, { officers: [id, 'off_ortiz'], verdict: 'favorable', disposition: 'resolved', steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: [id] }] });
      applyPeopleDebrief(d, run, result, 'favorable');
    }
    const v = jacketView(d, id)!;
    expect(v.pagesOpen).toBe(3);
    expect(v.page2).toEqual({ line: 'He keeps a spare handset in his bag, wrapped in a dish towel.', district: 'pike' });
    expect(v.page3?.line).toBe('Since Cedar Close, he hands the spare to whoever is doing the talking.');
    const at = v.memories.map((m) => m.at);
    expect([...at].sort((a, b) => b - a)).toEqual(at);
    expect(v.bonds[0]).toMatchObject({ otherId: 'off_ortiz', active: true });
  });

  it('shows a settled trait with its cause and date: earned for a positive, since for a strain', () => {
    const d = freshState();
    d.people.settled.push(
      { id: 'set_1', officerId: 'off_park', trait: 'sure_on_the_rear', polarity: 'positive', cause: { place: 'Wren Court', at: 0 }, settledAt: 132 * 3_600_000 + d.department.calendarEpoch },
      { id: 'set_2', officerId: 'off_park', trait: 'carries_the_night', polarity: 'strain', cause: { place: 'Calder Street', at: 0 }, settledAt: 123 * 3_600_000 + d.department.calendarEpoch },
    );
    d.people.nextId = 3;
    const v = jacketView(d, 'off_park')!;
    expect(v.settled.map((s) => s.line)).toEqual(['Earned at Wren Court, 13 May 2026.', 'Since Calder Street, 4 May 2026.']);
    expect(v.settled[0].chip).toBe('Sure on the rear');
    expect(v.settled[1].line).not.toMatch(/earned|won|gained/i);
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('shows an active note with its telegraph, and holds its end time null while a decision is open', () => {
    const d = freshState();
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], stressAfter: { off_park: 66, off_okafor: 20 }, steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park'] }] });
    applyPeopleDebrief(d, run, result, 'adverse');
    let v = jacketView(d, 'off_park')!;
    expect(v.imprints).toHaveLength(1);
    expect(v.imprints[0]).toMatchObject({ label: 'Doubts the rear', telegraph: 'Asked for the rear to be checked again at Cedar Close.', seen: false, needsDecision: false, endsAt: null });
    PEOPLE_HANDLERS.markTelegraphSeen(d, { type: 'markTelegraphSeen', imprintIds: [v.imprints[0].id] }, ctx);
    v = jacketView(d, 'off_park')!;
    expect(v.imprints[0]).toMatchObject({ seen: true, needsDecision: true });
    expect(teamPeopleSummary(d).needsDecision).toEqual([{ officerId: 'off_park', imprintId: v.imprints[0].id }]);
  });
});

describe('aftercareView', () => {
  it('names the options with cost and risk, what could settle each way, and who can be named', () => {
    const d = freshState();
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], stressAfter: { off_park: 66, off_okafor: 20 }, steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park'] }] });
    applyPeopleDebrief(d, run, result, 'adverse');
    const id = d.people.imprints.find((i) => i.officerId === 'off_park')!.id;
    expect(aftercareView(d, 'nope')).toBeNull();
    let v = aftercareView(d, id)!;
    // Unseen: no option can be taken yet.
    expect(v.open).toBe(false);
    expect(v.options.every((o) => !o.available)).toBe(true);
    PEOPLE_HANDLERS.markTelegraphSeen(d, { type: 'markTelegraphSeen', imprintIds: [id] }, ctx);
    v = aftercareView(d, id)!;
    expect(v.open).toBe(true);
    expect(v.options.every((o) => o.available)).toBe(true);
    expect(v.settles.pair.adverse.chip).toBe('Doubts the rear');
    expect(v.settles.pair.favorable.chip).toBe('Sure on the rear');
    expect(v.options[1].candidates).not.toContain('off_park');
    expect(v.options[2].line).toContain('the partner you name');
    PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'pair', partnerId: 'off_okafor' }, ctx);
    v = aftercareView(d, id)!;
    expect(v.decided).toBe('pair');
    expect(v.open).toBe(false);
    expect(v.options[2].line).toContain(d.officers.off_okafor.surname);
  });
});

describe('beats', () => {
  it('words each beat from its fields, and acknowledging one clears it from the badge', () => {
    const d = freshState();
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], stressAfter: { off_park: 66, off_okafor: 20 }, steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park'] }] });
    applyPeopleDebrief(d, run, result, 'adverse');
    const beats = peopleBeatsFor(d, ['off_park']);
    const telegraph = beats.find((b) => b.beat.kind === 'telegraph')!;
    expect(telegraph.line).toBe('Asked for the rear to be checked again at Cedar Close.');
    expect(teamPeopleSummary(d).unacknowledged).toBeGreaterThan(0);
    for (const b of d.people.beats) expect(PEOPLE_HANDLERS.acknowledgeBeat(d, { type: 'acknowledgeBeat', beatId: b.id }, ctx)).toEqual({ ok: true });
    expect(teamPeopleSummary(d).unacknowledged).toBe(0);
    expect(PEOPLE_HANDLERS.acknowledgeBeat(d, { type: 'acknowledgeBeat', beatId: 'beat_nope' }, ctx).ok).toBe(false);
    // Acknowledged beats sort after the rest.
    expect(peopleBeatsFor(d, ['off_park']).every((b) => b.beat.acknowledged)).toBe(true);
  });

  it('every beat line is plain text without a dash or colon', () => {
    const d = freshState();
    for (let i = 0; i < 6; i++) {
      advance(d, 1);
      const { run, result } = buildCall(d, { officers: ['off_park', 'off_okafor', 'off_chen'], verdict: i % 2 ? 'adverse' : 'favorable', civilians: ['needs_help'], hurt: i === 3 ? ['off_park'] : [], steps: [{ actionId: i % 2 ? REAR_ACTION().id : CONTACT_ACTION().id, band: i % 2 ? 'adverse' : 'favorable', officers: ['off_park'] }] });
      applyPeopleDebrief(d, run, result, i % 2 ? 'adverse' : 'favorable');
    }
    const lines = peopleBeatsFor(d, ['off_park', 'off_okafor', 'off_chen']).map((b) => b.line);
    expect(lines.length).toBeGreaterThan(3);
    for (const l of lines) {
      expect(l).not.toMatch(/[–—:]| - /);
      expect(l.length).toBeGreaterThan(5);
    }
  });
});

describe('validPeopleState', () => {
  it('accepts a played state and names what it rejects', () => {
    const d = freshState();
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], stressAfter: { off_park: 66, off_okafor: 20 }, steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park'] }] });
    applyPeopleDebrief(d, run, result, 'adverse');
    const ok = { officers: d.officers };
    expect(validPeopleState(d.people, ok)).toBeNull();
    const bad = (mut: (p: GameState['people']) => void) => { const p = structuredClone(d.people); mut(p); return validPeopleState(p, ok); };
    expect(bad((p) => { p.imprints[0].fork = { offeredAt: 1 }; })).toMatch(/before its telegraph was seen/);
    expect(bad((p) => { p.imprints.push({ ...p.imprints[0], id: 'imp_99' }); p.nextId = 100; })).toMatch(/two notes/);
    expect(bad((p) => { p.imprints[0].officerId = 'off_ghost'; })).toMatch(/unknown officer/);
    expect(bad((p) => { p.records.off_park.status = 'dismissed'; })).toMatch(/snapshot|live officer/);
    expect(bad((p) => { p.bonds.push({ a: 'off_park', b: 'off_chen', state: 'close', drift: 0, since: 0, cause: { kind: 'shared_call', at: 0 } }); })).toMatch(/not in order/);
    expect(bad((p) => { p.nextId = 1; })).toMatch(/behind/);
    expect(bad((p) => { p.facts.push({ id: 'fact_900', officerId: 'off_park', at: 0, kind: 'rescue', place: 'x', with: [], detail: 'x'.repeat(81) }); p.nextId = 1000; })).toMatch(/invalid detail/);
    expect(bad((p) => { delete p.records.off_chen; })).toMatch(/no employed record/);
    expect(validPeopleState(d.people, { officers: { ...d.officers, off_new: { ...d.officers.off_chen, id: 'off_new' } } })).toMatch(/off_new/);
  });
});
