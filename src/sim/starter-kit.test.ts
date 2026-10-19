// starter-kit: a new department starts with its officers' issue kit plus department kit, and every
// hire brings theirs. Weapons follow certification; only the radio is free.
import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { startingGrant } from './equipment';
import { issueKit, issueKitCost } from '../content/issue-kit';
import { ITEMS } from '../content/items';
import type { GameState, Id } from './types';

const T0 = Date.UTC(2026, 0, 1, 8);
const owned = (s: GameState, itemId: Id) => Object.values(s.units).filter((u) => u.itemId === itemId && u.status !== 'scrapped').length;

describe('issue kit', () => {
  it('gives every officer a radio and the tool of their role, and a sidearm only with entry_team', () => {
    expect(issueKit({ role: 'breach', certs: ['entry_team'] })).toEqual(['radio_kit', 'service_sidearm', 'door_ram']);
    expect(issueKit({ role: 'breach', certs: [] })).toEqual(['radio_kit', 'door_ram']);
    expect(issueKit({ role: 'comms', certs: [] })).toEqual(['radio_kit', 'loud_hailer']);
    expect(issueKit({ role: 'recon', certs: [] })).toEqual(['radio_kit', 'observation_binoculars']);
    expect(issueKit({ role: 'lead', certs: ['entry_team'] })).toEqual(['radio_kit', 'service_sidearm']);
  });

  it('issues nothing the officer could not use', () => {
    expect(issueKit({ role: 'medic', certs: [] })).toEqual(['radio_kit']);
    expect(issueKit({ role: 'medic', certs: ['advanced_first_aid'] })).toEqual(['radio_kit', 'trauma_kit']);
    for (const role of ['comms', 'breach', 'medic', 'recon', 'lead'] as const) {
      for (const id of issueKit({ role, certs: ['entry_team', 'advanced_first_aid'] })) expect(ITEMS[id].requiresNode).toBeUndefined();
    }
  });

  it('charges everything but the radio', () => {
    expect(issueKitCost({ role: 'breach', certs: ['entry_team'] })).toBe(ITEMS.service_sidearm.cost + ITEMS.door_ram.cost);
    expect(issueKitCost({ role: 'lead', certs: [] })).toBe(0);
  });
});

describe('start-up grant and hires', () => {
  it('starts with a radio for every officer and every officer kit, plus department kit', () => {
    const s = createInitialState(T0);
    const grant = startingGrant(Object.values(s.officers));
    for (const [itemId, count] of Object.entries(grant)) expect(owned(s, itemId), itemId).toBe(count);
    expect(owned(s, 'radio_kit')).toBe(Object.keys(s.officers).length);
    expect(owned(s, 'service_sidearm')).toBe(Object.values(s.officers).filter((o) => o.certs.includes('entry_team')).length);
  });

  it('prices the issue kit into the signing cost', () => {
    const s = createInitialState(T0);
    for (const c of s.candidates) {
      expect(c.issueKit).toBe(issueKitCost(c.officer));
      expect(c.signingCost).toBeGreaterThanOrEqual(c.issueKit!);
    }
  });

  it('adds the hire\'s kit to the pool', () => {
    const s = createInitialState(T0);
    const cand = s.candidates[0];
    const r = dispatch(s, { type: 'hire', candidateId: cand.id }, { now: T0 });
    expect(r.result.ok).toBe(true);
    for (const itemId of new Set(issueKit(cand.officer))) {
      const n = issueKit(cand.officer).filter((id) => id === itemId).length;
      expect(owned(r.state, itemId) - owned(s, itemId), itemId).toBe(n);
    }
  });
});
