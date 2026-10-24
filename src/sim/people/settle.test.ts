import { describe, expect, it } from 'vitest';
import { settle } from '../economy';
import { PEOPLE_HANDLERS, applyPeopleDebrief } from './index';
import { HOUR_MS, PEOPLE_TUNING } from './tuning';
import { advance, buildCall, freshState, NOW, REAR_ACTION } from '../fixtures/people-fixtures';
import { validPeopleState } from './validate';
import type { GameState } from '../types';

const ctx = { now: 0 };

/** A department with each kind of timed people state in flight. */
function busyState(): GameState {
  const d = freshState();
  // Park carries a note that will be answered with rest; Reyes carries one that ends on its own.
  for (const [who, severe] of [['off_park', true], ['off_reyes', false]] as const) {
    advance(d, 1);
    const { run, result } = buildCall(d, {
      officers: [who, 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], stressAfter: severe ? { [who]: 66, off_okafor: 20 } : {},
      steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: [who] }],
    });
    applyPeopleDebrief(d, run, result, 'adverse');
  }
  const park = d.people.imprints.find((i) => i.officerId === 'off_park')!;
  PEOPLE_HANDLERS.markTelegraphSeen(d, { type: 'markTelegraphSeen', imprintIds: [park.id] }, ctx);
  PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: park.id, choice: 'peer', partnerId: 'off_lindqvist' }, ctx);
  advance(d, 1);
  d.people.bonds.push({ a: 'off_brooks', b: 'off_chen', state: 'tense', drift: 0, since: d.department.clockHighWater, cause: { kind: 'breakup', at: 0 } });
  d.people.settled.push({ id: 'set_90', officerId: 'off_vale', trait: 'carries_the_night', polarity: 'strain', cause: { place: 'Cedar Close', at: NOW }, settledAt: d.department.clockHighWater });
  d.people.nextId = 100;
  d.department.lastSettledAt = d.department.clockHighWater;
  d.department.lastInteractionAt = d.department.clockHighWater;
  return d;
}

const view = (d: GameState) => JSON.stringify({ people: d.people, officers: d.officers, funding: Math.round(d.department.funding * 1e6) / 1e6, world: d.world });

describe('settlement is the same however it is cut', () => {
  it('one long settle, many small ticks and a save in between all agree', () => {
    const base = busyState();
    const start = base.department.clockHighWater;
    const total = 60 * HOUR_MS;

    const whole = structuredClone(base);
    settle(whole, start + total);

    const ticks = structuredClone(base);
    for (let t = 7 * 60_000; t <= total; t += 7 * 60_000) settle(ticks, start + t);
    settle(ticks, start + total);

    const reloaded = structuredClone(base);
    let live = reloaded;
    for (let h = 5; h <= 60; h += 5) {
      settle(live, start + h * HOUR_MS);
      live = JSON.parse(JSON.stringify(live)) as GameState;
    }
    settle(live, start + total);

    expect(view(ticks)).toEqual(view(whole));
    expect(view(live)).toEqual(view(whole));
    // And something happened: the stand-downs ended, the tense bond eased, the strain eased, the note ended.
    const afterAll = whole.people;
    expect(Object.values(whole.officers).filter((o) => o.assignment?.kind === 'peer_support' || o.assignment?.kind === 'standdown')).toHaveLength(0);
    expect(afterAll.bonds[0].state).toBe('acquainted');
    expect(afterAll.settled).toHaveLength(0);
    expect(afterAll.imprints.find((i) => i.officerId === 'off_reyes')!.outcome).toBe('cleared');
    // Park's note was answered by peer support and stays open.
    expect(afterAll.imprints.find((i) => i.officerId === 'off_park')!.outcome).toBeUndefined();
    expect(validPeopleState(whole.people, { officers: whole.officers })).toBeNull();
  });

  it('the peer-support colleague is busy for the window and back after it', () => {
    const d = busyState();
    const start = d.department.clockHighWater;
    expect(d.officers.off_lindqvist.assignment?.kind).toBe('peer_support');
    settle(d, start + 2 * HOUR_MS);
    expect(d.officers.off_lindqvist.assignment?.kind).toBe('peer_support');
    settle(d, start + 7 * HOUR_MS);
    expect(d.officers.off_lindqvist.assignment).toBeNull();
  });

  it('the notes end where the pack says, in real hours', () => {
    expect(PEOPLE_TUNING.strainEasesAfterMs).toBe(21 * HOUR_MS);
    const d = busyState();
    const reyes = d.people.imprints.find((i) => i.officerId === 'off_reyes')!;
    expect(reyes.endsAt - reyes.startedAt).toBe(36 * HOUR_MS);
    settle(d, reyes.endsAt - 1);
    expect(reyes.outcome).toBeUndefined();
    settle(d, reyes.endsAt);
    expect(reyes.outcome).toBe('cleared');
  });

  it('a stand-down keeps the officer off the roster of availability until it ends, then frees them', () => {
    const d = freshState();
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_park', 'off_okafor'], verdict: 'adverse', civilians: ['needs_help'], stressAfter: { off_park: 66, off_okafor: 20 }, steps: [{ actionId: REAR_ACTION().id, band: 'adverse', officers: ['off_park'] }] });
    applyPeopleDebrief(d, run, result, 'adverse');
    const im = d.people.imprints[0];
    PEOPLE_HANDLERS.markTelegraphSeen(d, { type: 'markTelegraphSeen', imprintIds: [im.id] }, ctx);
    PEOPLE_HANDLERS.decideAftercare(d, { type: 'decideAftercare', imprintId: im.id, choice: 'rest' }, ctx);
    const at = d.department.clockHighWater;
    d.department.lastSettledAt = at;
    d.department.lastInteractionAt = at;
    expect(d.officers.off_park.assignment?.kind).toBe('standdown');
    settle(d, at + 11 * HOUR_MS);
    expect(d.officers.off_park.assignment?.kind).toBe('standdown');
    settle(d, at + 12 * HOUR_MS);
    expect(d.officers.off_park.assignment).toBeNull();
  });
});
