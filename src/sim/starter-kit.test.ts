// starter-kit: a new department starts with its officers' issue kit plus department kit, and every
// hire brings theirs. The issue kit is the tool of the officer's role; basic kit (radio, sidearm,
// carbine, light body armor) is part of every officer (basic-kit.ts), never issued or stocked.
import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { startingGrant } from './equipment';
import { issueKit, issueKitCost } from '../content/issue-kit';
import { ITEMS } from '../content/items';
import { BASIC_KIT } from './basic-kit';
import type { GameState, Id } from './types';

const T0 = Date.UTC(2026, 0, 1, 8);
const owned = (s: GameState, itemId: Id) => Object.values(s.units).filter((u) => u.itemId === itemId && u.status !== 'scrapped').length;

describe('issue kit', () => {
  it('gives every officer the tool of their role and never basic kit, whatever their training', () => {
    expect(issueKit({ role: 'breach', certs: ['entry_team'] })).toEqual(['door_ram']);
    expect(issueKit({ role: 'breach', certs: [] })).toEqual(['door_ram']);
    expect(issueKit({ role: 'comms', certs: [] })).toEqual(['loud_hailer']);
    expect(issueKit({ role: 'recon', certs: [] })).toEqual(['observation_binoculars']);
    expect(issueKit({ role: 'lead', certs: ['entry_team'] })).toEqual([]);
  });

  it('issues nothing the officer could not use', () => {
    expect(issueKit({ role: 'medic', certs: [] })).toEqual([]);
    expect(issueKit({ role: 'medic', certs: ['advanced_first_aid'] })).toEqual(['trauma_kit']);
    for (const role of ['comms', 'breach', 'medic', 'recon', 'lead'] as const) {
      for (const id of issueKit({ role, certs: ['entry_team', 'advanced_first_aid'] })) {
        expect(ITEMS[id].requiresNode).toBeUndefined();
        expect(BASIC_KIT).not.toContain(id);
      }
    }
  });

  it('charges the role tool and nothing for basic kit', () => {
    expect(issueKitCost({ role: 'breach', certs: ['entry_team'] })).toBe(ITEMS.door_ram.cost);
    expect(issueKitCost({ role: 'lead', certs: ['entry_team'] })).toBe(0);
  });
});

describe('start-up grant and hires', () => {
  it('starts with every officer kit plus department kit, and no basic kit', () => {
    const s = createInitialState(T0);
    const grant = startingGrant(Object.values(s.officers));
    for (const [itemId, count] of Object.entries(grant)) expect(owned(s, itemId), itemId).toBe(count);
    for (const itemId of BASIC_KIT) {
      expect(grant[itemId], itemId).toBeUndefined();
      expect(owned(s, itemId), itemId).toBe(0);
    }
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
