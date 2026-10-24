import { describe, expect, it } from 'vitest';
import { PEOPLE_HANDLERS, applyPeopleDebrief, nextPeopleEventTime, settlePeople } from './index';
import { aftercareView, teamPeopleSummary } from './selectors';
import { HOUR_MS, PEOPLE_TUNING } from './tuning';
import { IMPRINT_PACKS } from '../../content/people/imprints';
import { advance, buildCall, CONTACT_ACTION, ENTRY_ACTION, freshState, REAR_ACTION, type CallSpec } from '../fixtures/people-fixtures';
import { validPeopleState } from './validate';
import type { GameState, Id } from '../types';

const ctx = { now: 0 };

/** Close a call with Park and Chen and an adverse rear step by Park. */
function adverseRear(d: GameState, over: Partial<CallSpec> = {}) {
  advance(d, 1);
  const { run, result } = buildCall(d, {
    officers: ['off_park', 'off_chen'], verdict: 'adverse', civilians: ['needs_help'],
    steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park', 'off_chen'] }], ...over,
  });
  applyPeopleDebrief(d, run, result, over.verdict === undefined ? 'adverse' : over.verdict);
}

const noteOf = (d: GameState, id: Id) => d.people.imprints.find((i) => i.officerId === id && !i.outcome);
const see = (d: GameState) => PEOPLE_HANDLERS.markTelegraphSeen(d, { type: 'markTelegraphSeen', imprintIds: d.people.imprints.map((i) => i.id) }, ctx);

describe('starting a note', () => {
  it('an adverse rear step starts doubts_the_rear with a telegraph beat and a named cause', () => {
    const d = freshState();
    adverseRear(d);
    const im = noteOf(d, 'off_park')!;
    expect(im.pack).toBe('doubts_the_rear');
    expect(im.seen).toBe(false);
    expect(im.cause.place).toBe('Cedar Close');
    expect(im.endsAt - im.startedAt).toBe(IMPRINT_PACKS.doubts_the_rear.hours * HOUR_MS);
    expect(d.people.beats.some((b) => b.kind === 'telegraph' && b.refId === im.id)).toBe(true);
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('carries no number on the record', () => {
    const d = freshState();
    adverseRear(d);
    const keys = Object.keys(noteOf(d, 'off_park')!).sort();
    expect(keys).toEqual(['cause', 'endsAt', 'forkDue', 'id', 'officerId', 'pack', 'seen', 'startedAt'].filter((k) => keys.includes(k)));
    for (const v of Object.values(noteOf(d, 'off_park')!)) expect(typeof v === 'number' && v < 1000 && v > 0).toBe(false);
  });

  it('only one note at a time: a different pack on a carrying officer is ignored', () => {
    const d = freshState();
    adverseRear(d);
    const first = noteOf(d, 'off_park')!;
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_park', 'off_chen'], verdict: 'adverse', civilians: ['needs_help'], steps: [{ actionId: ENTRY_ACTION().id, band: 'adverse', officers: ['off_park'] }] });
    applyPeopleDebrief(d, run, result, 'adverse');
    expect(d.people.imprints.filter((i) => i.officerId === 'off_park' && !i.outcome)).toEqual([first]);
  });

  it('a positive pack starts on a favorable contact under high pressure', () => {
    const d = freshState();
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_chen', 'off_park'], verdict: 'favorable', pressure: 70, steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_chen'] }] });
    applyPeopleDebrief(d, run, result, 'favorable');
    expect(noteOf(d, 'off_chen')?.pack).toBe('found_the_voice');
    expect(noteOf(d, 'off_park')).toBeUndefined();
  });
});

describe('the fork waits for the player to see the telegraph', () => {
  it('a repeat makes a fork due but opens none while unseen, and the note does not expire', () => {
    const d = freshState();
    adverseRear(d);
    adverseRear(d);
    const im = noteOf(d, 'off_park')!;
    expect(im.forkDue).toBe('repeat');
    expect(im.fork).toBeUndefined();
    // Long past its time: still there, still waiting.
    const end = im.endsAt + 100 * HOUR_MS;
    expect(nextPeopleEventTime(d, im.startedAt)).not.toBe(im.endsAt);
    settlePeople(d, im.startedAt, end, []);
    expect(noteOf(d, 'off_park')).toBeDefined();
    expect(noteOf(d, 'off_park')!.fork).toBeUndefined();
    expect(teamPeopleSummary(d).needsDecision).toEqual([]);
    expect(teamPeopleSummary(d).unseen.map((u) => u.officerId)).toContain('off_park');
    // Seen: the fork opens.
    expect(see(d)).toEqual({ ok: true });
    expect(noteOf(d, 'off_park')!.fork?.offeredAt).toBeGreaterThan(0);
    expect(d.people.beats.some((b) => b.kind === 'fork_open' && b.refId === im.id)).toBe(true);
    expect(teamPeopleSummary(d).needsDecision.filter((n) => n.officerId === 'off_park')).toEqual([{ officerId: 'off_park', imprintId: im.id }]);
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('a severe first trigger makes the fork due at once, and opens it when seen', () => {
    const d = freshState();
    adverseRear(d, { stressAfter: { off_park: 66, off_chen: 20 } });
    const im = noteOf(d, 'off_park')!;
    expect(im.forkDue).toBe('severe');
    expect(im.fork).toBeUndefined();
    see(d);
    expect(noteOf(d, 'off_park')!.fork).toBeDefined();
  });

  it('a decision is refused until the telegraph is seen and the fork is open', () => {
    const d = freshState();
    adverseRear(d, { stressAfter: { off_park: 66, off_chen: 20 } });
    const im = noteOf(d, 'off_park')!;
    const r = PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: im.id, choice: 'rest' }, ctx);
    expect(r.ok).toBe(false);
  });

  it('a note with no fork due ends at its time', () => {
    const d = freshState();
    adverseRear(d);
    const im = noteOf(d, 'off_park')!;
    expect(nextPeopleEventTime(d, im.startedAt)).toBe(im.endsAt);
    settlePeople(d, im.startedAt, im.endsAt, []);
    expect(im.outcome).toBe('cleared');
  });
});

function openFork(d: GameState): string {
  adverseRear(d, { stressAfter: { off_park: 66, off_chen: 20 } });
  see(d);
  return noteOf(d, 'off_park')!.id;
}

describe('the three answers', () => {
  it('each option carries a cost and a risk, and none is free on both', () => {
    const d = freshState();
    const id = openFork(d);
    const view = aftercareView(d, id)!;
    expect(view.open).toBe(true);
    expect(view.options.map((o) => o.choice)).toEqual(['rest', 'peer', 'pair']);
    for (const o of view.options) {
      expect(o.cost.length).toBeGreaterThan(5);
      expect(o.risk.length).toBeGreaterThan(5);
      expect(o.available).toBe(true);
      expect(o.line).toMatch(/costs|spends/);
    }
    expect(new Set(view.options.map((o) => o.cost)).size).toBe(3);
  });

  it('rest stands the officer down for the pack hours and the note clears when it ends', () => {
    const d = freshState();
    const id = openFork(d);
    const at = d.department.clockHighWater;
    expect(PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'rest' }, ctx)).toEqual({ ok: true });
    const a = d.officers.off_park.assignment;
    expect(a).toMatchObject({ kind: 'standdown', imprintId: id, startedAt: at, endsAt: at + 12 * HOUR_MS });
    expect(nextPeopleEventTime(d, at)).toBe(at + 12 * HOUR_MS);
    settlePeople(d, at, at + 12 * HOUR_MS, []);
    expect(d.officers.off_park.assignment).toBeNull();
    expect(d.people.imprints.find((i) => i.id === id)!.outcome).toBe('cleared');
    expect(d.people.settled).toHaveLength(0);
    // It is answered once.
    expect(PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'rest' }, ctx).ok).toBe(false);
  });

  it('rest is refused while the officer is busy', () => {
    const d = freshState();
    const id = openFork(d);
    d.officers.off_park.assignment = { kind: 'training', courseId: 'c', startedAt: 0, endsAt: 1 };
    expect(PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'rest' }, ctx).ok).toBe(false);
  });

  it('peer support spends a colleague for the window, keeps the note open, and clears on the next favorable call', () => {
    const d = freshState();
    const id = openFork(d);
    const at = d.department.clockHighWater;
    expect(PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'peer', partnerId: 'off_okafor' }, ctx)).toEqual({ ok: true });
    expect(d.officers.off_okafor.assignment).toMatchObject({ kind: 'peer_support', imprintId: id, endsAt: at + 6 * HOUR_MS });
    expect(d.officers.off_park.assignment).toBeNull();
    // The colleague is back after the window; the note stays.
    settlePeople(d, at, at + 6 * HOUR_MS, []);
    expect(d.officers.off_okafor.assignment).toBeNull();
    settlePeople(d, at + 6 * HOUR_MS, at + 500 * HOUR_MS, []);
    expect(noteOf(d, 'off_park')).toBeDefined();
    // A mixed call changes nothing; a favorable call clears it.
    advance(d, 1);
    let call = buildCall(d, { officers: ['off_park'], verdict: null, steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_park'] }] });
    applyPeopleDebrief(d, call.run, call.result, null);
    expect(noteOf(d, 'off_park')).toBeDefined();
    advance(d, 1);
    call = buildCall(d, { officers: ['off_park'], verdict: 'favorable', steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_park'] }] });
    applyPeopleDebrief(d, call.run, call.result, 'favorable');
    expect(d.people.imprints.find((i) => i.id === id)!.outcome).toBe('cleared');
    expect(d.people.settled).toHaveLength(0);
  });

  it('peer support is refused with nobody free', () => {
    const d = freshState();
    const id = openFork(d);
    for (const o of Object.values(d.officers)) if (o.id !== 'off_park') o.assignment = { kind: 'training', courseId: 'c', startedAt: 0, endsAt: 1 };
    expect(PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'peer' }, ctx).ok).toBe(false);
  });

  it('pairing needs a named partner, and an adverse result together settles the strain', () => {
    const d = freshState();
    const id = openFork(d);
    expect(PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'pair' }, ctx).ok).toBe(false);
    expect(PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'pair', partnerId: 'off_okafor' }, ctx)).toEqual({ ok: true });
    expect(d.officers.off_park.assignment).toBeNull();
    // A bad call without the partner changes nothing.
    advance(d, 1);
    let call = buildCall(d, { officers: ['off_park'], verdict: 'adverse', civilians: ['needs_help'], steps: [{ actionId: CONTACT_ACTION().id, band: 'adverse', officers: ['off_park'] }] });
    applyPeopleDebrief(d, call.run, call.result, 'adverse');
    expect(noteOf(d, 'off_park')).toBeDefined();
    // A bad call together that is outside the note's scope (a contact step, not the rear) does not lock it.
    advance(d, 1);
    call = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], steps: [{ actionId: CONTACT_ACTION().id, band: 'adverse', officers: ['off_park', 'off_okafor'] }] });
    applyPeopleDebrief(d, call.run, call.result, 'adverse');
    expect(noteOf(d, 'off_park')).toBeDefined();
    // A bad call together on the rear settles the strain.
    advance(d, 1);
    call = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park', 'off_okafor'] }] });
    applyPeopleDebrief(d, call.run, call.result, 'adverse');
    const im = d.people.imprints.find((i) => i.id === id)!;
    expect(im.outcome).toBe('settled_strain');
    expect(d.people.settled).toMatchObject([{ officerId: 'off_park', trait: 'second_guesses_rear', polarity: 'strain', cause: { place: 'Cedar Close' } }]);
  });

  it('a favorable result together settles the positive, and an existing trait id is added to the officer', () => {
    const d = freshState();
    // short_with_callers settles into calm_voice.
    advance(d, 1);
    let call = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], stressAfter: { off_park: 66, off_okafor: 20 }, steps: [{ actionId: CONTACT_ACTION().id, band: 'adverse', officers: ['off_park'] }] });
    applyPeopleDebrief(d, call.run, call.result, 'adverse');
    const im = noteOf(d, 'off_park')!;
    expect(im.pack).toBe('short_with_callers');
    see(d);
    PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: im.id, choice: 'pair', partnerId: 'off_okafor' }, ctx);
    advance(d, 1);
    call = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'favorable', steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_park', 'off_okafor'] }] });
    applyPeopleDebrief(d, call.run, call.result, 'favorable');
    expect(im.outcome).toBe('settled_positive');
    expect(d.officers.off_park.traits).toContain('calm_voice');
    expect(d.people.settled[0]).toMatchObject({ trait: 'calm_voice', polarity: 'positive' });
  });
});

describe('what never moves a note', () => {
  it('restraint where everyone was safe starts no strain and settles none', () => {
    const d = freshState();
    // An adverse rear step, but nobody hurt, no force: the squad held. No strain note starts.
    adverseRear(d, { force: false, civilians: ['safe'] });
    expect(noteOf(d, 'off_park')).toBeUndefined();
    // And a pending pairing is not settled by such a call.
    const id = openFork(d);
    PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'pair', partnerId: 'off_okafor' }, ctx);
    advance(d, 1);
    const call = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', force: false, steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park', 'off_okafor'] }] });
    applyPeopleDebrief(d, call.run, call.result, 'adverse');
    expect(d.people.imprints.find((i) => i.id === id)!.outcome).toBeUndefined();
    expect(d.people.settled).toHaveLength(0);
  });

  it('a civilian harmed starts no note and advances none', () => {
    const d = freshState();
    adverseRear(d, { civilians: ['injured_needs_care'] });
    expect(d.people.imprints).toHaveLength(0);
    adverseRear(d, { civilians: ['deceased'] });
    expect(d.people.imprints).toHaveLength(0);
    // A repeat on a call that harmed a civilian does not make a fork due, and a pair is not settled by it.
    const id = openFork(d);
    expect(noteOf(d, 'off_park')!.forkDue).toBe('severe');
    PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'pair', partnerId: 'off_okafor' }, ctx);
    advance(d, 1);
    const call = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['injured_needs_care'], steps: [{ actionId: CONTACT_ACTION().id, band: 'adverse', officers: ['off_park', 'off_okafor'] }] });
    applyPeopleDebrief(d, call.run, call.result, 'adverse');
    expect(d.people.imprints.find((i) => i.id === id)!.outcome).toBeUndefined();
    expect(d.people.settled).toHaveLength(0);
  });

  it('a person lost starts no note and advances none, even a subject', () => {
    const d = freshState();
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_park', 'off_chen'], verdict: 'adverse', civilians: ['needs_help'], steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park', 'off_chen'] }] });
    (result as { personCasualties: unknown }).personCasualties = [{ personId: 'rider', personRole: 'subject', label: 'Subject', severity: 'fatal', at: 3, care: 'deceased', causeRevision: 1 }];
    applyPeopleDebrief(d, run, result, 'adverse');
    expect(d.people.imprints).toHaveLength(0);
    // The call is remembered, with a weight line and no cause of death.
    const lost = d.people.facts.filter((f) => f.kind === 'person_lost');
    expect(lost).toHaveLength(2);
    expect(lost[0].detail).toMatch(/^Was on the call at Cedar Close/);
    expect(lost[0].detail).not.toMatch(/died|killed|shot|fatal|dead/i);
    expect(d.people.beats.some((b) => b.kind === 'memory')).toBe(true);
  });

  it('caps hold: three settled traits per officer', () => {
    const d = freshState();
    for (let i = 0; i < PEOPLE_TUNING.settledCap; i++) d.people.settled.push({ id: `set_${900 + i}`, officerId: 'off_park', trait: `old_${i}`, polarity: 'positive', cause: { place: 'x', at: 0 }, settledAt: 0 });
    d.people.nextId = 1000;
    adverseRear(d);
    expect(noteOf(d, 'off_park')).toBeUndefined();
    expect(validPeopleState(d.people, { officers: d.officers })).toBeNull();
  });

  it('caps hold: one settled strain per officer per game week', () => {
    const d = freshState();
    const id = openFork(d);
    PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: id, choice: 'pair', partnerId: 'off_okafor' }, ctx);
    // A strain settled two game days ago blocks another from settling now.
    d.people.settled.push({ id: 'set_900', officerId: 'off_park', trait: 'carries_the_night', polarity: 'strain', cause: { place: 'x', at: 0 }, settledAt: d.department.clockHighWater - 2 * HOUR_MS });
    d.people.nextId = 1000;
    advance(d, 1);
    const call = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park', 'off_okafor'] }] });
    applyPeopleDebrief(d, call.run, call.result, 'adverse');
    expect(d.people.imprints.find((i) => i.id === id)!.outcome).toBe('cleared');
    expect(d.people.settled).toHaveLength(1);
  });

  it('a week later a second strain can settle, and the first eases after three game weeks', () => {
    const d = freshState();
    d.people.settled.push({ id: 'set_900', officerId: 'off_park', trait: 'carries_the_night', polarity: 'strain', cause: { place: 'x', at: NOW0(d) }, settledAt: NOW0(d) });
    d.people.nextId = 1000;
    const t = NOW0(d);
    expect(nextPeopleEventTime(d, t)).toBe(t + PEOPLE_TUNING.strainEasesAfterMs);
    settlePeople(d, t, t + PEOPLE_TUNING.strainEasesAfterMs, []);
    expect(d.people.settled).toHaveLength(0);
  });
});

const NOW0 = (d: GameState) => d.department.clockHighWater;
