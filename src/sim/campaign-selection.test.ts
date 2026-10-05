import { describe, expect, it } from 'vitest';
import { PERSONAS, PERSONA_BY_ID, shuffledPersonas } from '../content/personas';
import { startingOfficers } from '../content/officers';
import { ROLES } from '../content/recruits';
import { CampaignSlots, SLOT_COUNT } from './campaign-slots';
import { createInitialState } from './department';
import { deserialize, serialize } from './save';
import { fillCandidates } from './roster';
import { type GameState } from './types';

const NOW = Date.UTC(2026, 9, 5);
const ids = (state: GameState) => Object.values(state.officers).map((o) => o.identityId!);
const poolIds = (state: GameState) => state.candidates.map((c) => c.officer.identityId!);
const setKey = (people: string[]) => [...people].sort().join(',');
const overlap = (a: string[], b: string[]) => a.filter((id) => b.includes(id)).length;

describe('campaign-wide identity selection', () => {
  it('uses the entire cast and has low pairwise roster/pool overlap across 512 seeds', () => {
    const rosters: string[][] = [], pools: string[][] = [];
    const counts = new Map(PERSONAS.map((p) => [p.id, { roster: 0, pool: 0 }]));
    for (let seed = 0; seed < 512; seed++) {
      const state = createInitialState(NOW, seed);
      const roster = ids(state), pool = poolIds(state);
      expect(roster).toHaveLength(8);
      expect(pool).toHaveLength(3);
      expect(new Set([...roster, ...pool]).size).toBe(11);
      expect(new Set(state.personnel!.employedIdentityIds)).toEqual(new Set(roster));
      expect(new Set(Object.values(state.officers).map((o) => o.role))).toEqual(new Set(ROLES));
      expect(Object.values(state.officers).reduce((sum, o) => sum + o.wage, 0)).toBe(380);
      for (const cert of ['crisis_negotiation', 'entry_team', 'advanced_first_aid', 'surveillance', 'drone_operator']) {
        expect(Object.values(state.officers).some((o) => o.certs.some((c) => c === cert))).toBe(true);
      }
      for (const squad of state.squads) {
        expect(squad.officerIds).toHaveLength(4);
        expect(squad.officerIds).toContain(squad.leaderId);
        expect(squad.officerIds.every((id) => state.officers[id].squadId === squad.id)).toBe(true);
      }
      for (const o of Object.values(state.officers)) {
        const person = PERSONA_BY_ID[o.identityId!];
        expect([o.firstName, o.surname, o.portrait]).toEqual([person.firstName, person.surname, person.portrait]);
        expect(-o.bornDay / 365).toBeCloseTo(person.ageAtStart, 2);
        expect(o.serviceStartDay).toBeGreaterThanOrEqual(o.bornDay + 21 * 365);
        expect(o.serviceStartDay).toBeLessThanOrEqual(0);
        expect(o.retirement).toBeNull();
        expect(state.personnel!.builds[o.identityId!]).toEqual(o);
        counts.get(o.identityId!)!.roster++;
      }
      for (const id of pool) counts.get(id)!.pool++;
      rosters.push(roster); pools.push(pool);
    }
    expect(new Set(rosters.map(setKey)).size).toBe(512);
    expect(new Set(pools.map(setKey)).size).toBeGreaterThan(506);
    // No privileged original starters, painted-photo cohort, or unreachable reserve.
    for (const count of counts.values()) {
      expect(count.roster).toBeGreaterThan(15);
      expect(count.roster).toBeLessThan(70);
      expect(count.pool).toBeGreaterThan(0);
      expect(count.pool).toBeLessThan(40);
    }
    let rosterOverlap = 0, poolOverlap = 0, pairs = 0;
    for (let a = 0; a < rosters.length; a++) for (let b = a + 1; b < rosters.length; b++) {
      rosterOverlap += overlap(rosters[a], rosters[b]);
      poolOverlap += overlap(pools[a], pools[b]);
      pairs++;
    }
    // Independent samples of 8/100 and 3/100 share about 0.64 and 0.09 people.
    expect(rosterOverlap / pairs).toBeGreaterThan(0.55);
    expect(rosterOverlap / pairs).toBeLessThan(0.75);
    expect(poolOverlap / pairs).toBeGreaterThan(0.05);
    expect(poolOverlap / pairs).toBeLessThan(0.14);
  });

  it('lets every identity fill every opening role across 2048 campaign seeds', () => {
    const roles = new Map(PERSONAS.map((p) => [p.id, new Set<string>()]));
    for (let seed = 0; seed < 2048; seed++) {
      for (const officer of Object.values(startingOfficers(NOW, seed))) roles.get(officer.identityId!)!.add(officer.role);
    }
    for (const seen of roles.values()) expect(seen).toEqual(new Set(ROLES));
  });

  it('does not consult names, culture, presentation or portrait availability for selection or skills', () => {
    const fields = ['firstName', 'surname', 'pronouns', 'culture', 'appearance', 'portrait', 'personalNote'] as const;
    const originals = PERSONAS.map((p) => ({ ...p }));
    const skills = () => Object.values(startingOfficers(NOW, 18)).map(({ identityId, role, ratings, certs, traits, wage, career }) => ({ identityId, role, ratings, certs, traits, wage, career }));
    const before = skills();
    const reserve = shuffledPersonas(18, 'recruitment').map((p) => p.id);
    try {
      for (const person of PERSONAS) {
        for (const field of fields) Object.assign(person, { [field]: field === 'pronouns' ? 'they' : 'Changed presentation' });
      }
      expect(skills()).toEqual(before);
      expect(shuffledPersonas(18, 'recruitment').map((p) => p.id)).toEqual(reserve);
    } finally {
      for (let i = 0; i < PERSONAS.length; i++) Object.assign(PERSONAS[i], originals[i]);
    }
  });

  it('reproduces new games, frozen builds and future recruitment after save/load', () => {
    for (const seed of [0, 1, 31, 100, 765, 0xffffffff]) {
      const state = createInitialState(NOW, seed);
      expect(createInitialState(NOW, seed)).toEqual(state);
      const loaded = deserialize(serialize(state, NOW))!;
      expect(loaded).toEqual(state);
      for (let search = 0; search < 8; search++) {
        const at = NOW + search * 4 * 3_600_000;
        fillCandidates(state, at);
        fillCandidates(loaded, at);
        expect(loaded).toEqual(state);
      }
    }
    expect(startingOfficers(NOW, -1)).toEqual(startingOfficers(NOW, 0xffffffff));
  });

  it('preserves ten independent sampled campaigns across slot switches, exports and reload', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    let seed = 100;
    const slots = new CampaignSlots(storage, NOW, () => seed++);
    const states = [structuredClone(slots.getSnapshot().state)];
    for (let slot = 2; slot <= SLOT_COUNT; slot++) {
      expect(slots.newGame(slot, `Campaign ${slot}`, NOW).ok).toBe(true);
      states.push(structuredClone(slots.getSnapshot().state));
    }
    expect(new Set(states.map((s) => setKey(ids(s)))).size).toBe(SLOT_COUNT);
    expect(new Set(states.map((s) => setKey(poolIds(s)))).size).toBe(SLOT_COUNT);
    const reloaded = new CampaignSlots(storage, NOW, () => 999);
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      expect(reloaded.load(slot, NOW).ok).toBe(true);
      expect(reloaded.getSnapshot().state).toEqual(states[slot - 1]);
      expect(deserialize(reloaded.exportCurrent(NOW))).toEqual(states[slot - 1]);
    }
  });
});
