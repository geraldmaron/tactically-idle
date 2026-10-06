import { describe, expect, it } from 'vitest';
import { PERSONAS, PERSONA_BY_ID, personaNote } from '../content/personas';
import { buildPersona, generateBatch, roleForPersona } from '../content/recruits';
import { createInitialState } from './department';
import { dispatch } from './game';
import { fillCandidates, recruitmentStatus } from './roster';
import { deserialize, serialize, SAVE_KEY } from './save';
import { restoreCampaign } from './session';
import { establishedDepartment } from './department-test-fixtures';
import { type Officer } from './types';

const T0 = Date.UTC(2026, 0, 1);
const HOUR = 3_600_000;

describe('authored people', () => {
  it('has exactly 100 distinct adults and portrait destinations, including eight legacy identities', () => {
    expect(PERSONAS).toHaveLength(100);
    for (const key of ['id', 'portrait'] as const) expect(new Set(PERSONAS.map((p) => p[key])).size).toBe(100);
    expect(new Set(PERSONAS.map((p) => `${p.firstName} ${p.surname}`)).size).toBe(100);
    expect(PERSONAS.filter((p) => p.legacyOfficerId)).toHaveLength(8);
    expect(PERSONAS.every((p) => p.ageAtStart >= 21 && p.ageAtStart < 60 && p.appearance && p.personalNote)).toBe(true);
    expect(PERSONAS.some((p) => p.pronouns === 'they')).toBe(true);
    expect(PERSONAS.some((p) => /Sikh/.test(p.culture))).toBe(true);
    expect(PERSONAS.some((p) => p.ageAtStart >= 55)).toBe(true);
  });
  it('uses pronouns in ordinary notes, with no separate identity badge', () => {
    for (const p of PERSONAS) expect(personaNote(p.id)).toMatch(/^(She|He|They) /);
    expect(personaNote('unknown')).toBeNull();
  });
  it('rolls builds independently of culture, appearance and pronouns', () => {
    const p = PERSONAS[20];
    const before = buildPersona(p, 77);
    const after = buildPersona({ ...p, culture: 'changed', appearance: 'changed', pronouns: 'they' }, 77);
    expect(after).toEqual(before);
    expect(buildPersona(p, 78)).not.toEqual(before);
    expect(new Set(Array.from({ length: 30 }, (_, seed) => roleForPersona(seed, p.id))).size).toBe(5);
  });
  it('allows older newcomers without forcing age, role or presentation into a stereotype', () => {
    const p = PERSONAS.find((p) => !p.legacyOfficerId && p.ageAtStart >= 50)!;
    const builds = Array.from({ length: 100 }, (_, seed) => buildPersona(p, seed));
    expect(builds.some((o) => o.traits.includes('rookie'))).toBe(true);
    expect(builds.some((o) => !o.traits.includes('rookie') && -o.serviceStartDay / 365 > 15)).toBe(true);
  });
});

describe('campaign identities and succession', () => {
  it('reproduces a supplied seed and varies builds between campaigns', () => {
    expect(createInitialState(T0, 120)).toEqual(createInitialState(T0, 120));
    const a = createInitialState(T0, 120), b = createInitialState(T0, 121);
    expect(a.officers.off_chen.identityId).not.toBe(b.officers.off_chen.identityId);
    expect(a.officers.off_chen.portrait).not.toBe(b.officers.off_chen.portrait);
    expect(a.officers.off_chen.ratings).not.toEqual(b.officers.off_chen.ratings);
  });
  it('keeps only three candidates, with stable first-seen builds and no active duplicates', () => {
    const s = createInitialState(T0, 88);
    const seen = new Map<string, Officer>();
    for (let i = 0; i < 60; i++) {
      fillCandidates(s, T0 + i * 4 * HOUR);
      expect(s.candidates).toHaveLength(3);
      const ids = [...Object.values(s.officers), ...s.candidates.map((c) => c.officer)].map((o) => o.identityId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of s.candidates) {
        const id = c.officer.identityId!;
        if (seen.has(id)) expect(c.officer).toEqual(seen.get(id));
        else seen.set(id, structuredClone(c.officer));
      }
    }
    expect(seen.size).toBeLessThanOrEqual(12);
    expect(seen.size).toBeGreaterThan(3);
  });
  it('keeps mixed-role recruitment and stable saved builds across 100 campaign seeds', () => {
    const roles = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const s = createInitialState(T0, seed);
      const currentPeople = structuredClone(s.personnel!.builds);
      const loaded = deserialize(serialize(s, T0))!;
      fillCandidates(s, T0 + 4 * HOUR);
      fillCandidates(loaded, T0 + 4 * HOUR);
      expect(loaded).toEqual(s);
      expect(new Set(s.candidates.map((candidate) => candidate.officer.role)).size).toBeGreaterThanOrEqual(2);
      for (const [id, officer] of Object.entries(currentPeople)) expect(s.personnel!.builds[id]).toEqual(officer);
      for (const candidate of s.candidates) roles.add(candidate.officer.role);
    }
    expect([...roles].sort()).toEqual(['breach', 'comms', 'lead', 'medic', 'recon']);
  });
  it('treats a stale targeted refresh as an ordinary empty pool when the reserve is exhausted', () => {
    const exhausted = createInitialState(T0, 1);
    exhausted.personnel!.employedIdentityIds = PERSONAS.map((p) => p.id);
    exhausted.candidates = [];
    const legacyCommand = { type: 'refreshCandidates', targetRole: 'recon' } as const;
    const result = dispatch(exhausted, legacyCommand, { now: T0 });
    expect(result.result).toEqual({ ok: true });
    expect(result.state.candidates).toEqual([]);
    expect(recruitmentStatus(result.state, T0).exhausted).toBe(true);
  });
  it('can hire all 92 reserve people across successive careers without resurrecting anyone', () => {
    for (const seed of [0, 1, 52]) {
      let s = createInitialState(T0, seed);
      s.department.funding = 100_000_000;
      const seen = new Set<string>();
      for (let n = 0; n < 92; n++) {
        fillCandidates(s, T0);
        const c = s.candidates[0];
        expect(c).toBeDefined();
        expect(seen.has(c.officer.identityId!)).toBe(false);
        seen.add(c.officer.identityId!);
        const hired = dispatch(s, { type: 'hire', candidateId: c.id }, { now: T0 });
        expect(hired.result.ok).toBe(true);
        const dismissed = dispatch(hired.state, { type: 'dismiss', officerId: c.officer.id }, { now: T0 });
        expect(dismissed.result.ok).toBe(true);
        s = deserialize(serialize(dismissed.state, T0))!;
        expect(s).not.toBeNull();
      }
      fillCandidates(s, T0);
      expect(s.candidates).toHaveLength(0);
      expect(s.personnel!.employedIdentityIds).toHaveLength(100);
      expect(seen.size).toBe(92);
    }
  });
  it('does not return a dismissed identity even after save and reload', () => {
    let s = createInitialState(T0, 10);
    const c = s.candidates[0];
    let r = dispatch(s, { type: 'hire', candidateId: c.id }, { now: T0 });
    expect(r.result.ok).toBe(true); s = r.state;
    r = dispatch(s, { type: 'dismiss', officerId: c.officer.id }, { now: T0 });
    expect(r.result.ok).toBe(true); s = deserialize(serialize(r.state, T0))!;
    for (let i = 0; i < 30; i++) {
      fillCandidates(s, T0 + i * 4 * HOUR);
      expect(s.candidates.some((x) => x.officer.identityId === c.officer.identityId)).toBe(false);
    }
  });
  it('replenishes an aged recruitment cohort with new people at their authored introduction ages', () => {
    const s = createInitialState(T0, 20);
    for (let i = 0; i < 30; i++) fillCandidates(s, T0);
    const old = new Set(Object.keys(s.personnel!.builds));
    fillCandidates(s, T0 + 50 * 365 * HOUR);
    expect(s.candidates).toHaveLength(3);
    for (const c of s.candidates) {
      expect(old.has(c.officer.identityId!)).toBe(false);
      const age = (50 * 365 - c.officer.bornDay) / 365;
      expect(age).toBeCloseTo(PERSONA_BY_ID[c.officer.identityId!].ageAtStart, 2);
    }
  });
  it('reports genuine finite exhaustion instead of recycling an officer', () => {
    const s = createInitialState(T0);
    s.personnel!.employedIdentityIds = PERSONAS.map((p) => p.id);
    s.candidates = [];
    fillCandidates(s, T0);
    expect(s.candidates).toHaveLength(0);
    expect(recruitmentStatus(s, T0).exhausted).toBe(true);
    expect(generateBatch({ rng: 1, nextId: 1, unavailable: PERSONAS.map((p) => p.id) }, T0, 3, [], new Set())).toEqual([]);
  });
  it('round-trips candidate history, birth dates and campaign seed', () => {
    const s = createInitialState(T0, 765);
    fillCandidates(s, T0 + 8 * HOUR);
    expect(deserialize(serialize(s, T0))).toEqual(s);
  });
  it('migrates v3 without rerolling legacy people, while reserving departed starter identities', () => {
    const old = establishedDepartment(T0, 13);
    delete old.personnel;
    for (const o of Object.values(old.officers)) delete o.identityId;
    old.officers.off_chen.portrait = 'chen';
    old.candidates = [];
    delete old.officers.off_reyes;
    old.squads[1].officerIds = old.squads[1].officerIds.filter((id) => id !== 'off_reyes');
    old.saveVersion = 3;
    const chen = structuredClone(old.officers.off_chen);
    const migrated = deserialize(serialize(old, T0))!;
    expect(migrated).not.toBeNull();
    expect(migrated.officers.off_chen).toEqual({ ...chen, identityId: 'person_001' });
    expect(migrated.personnel!.employedIdentityIds).toContain('person_007');
    expect(migrated.saveVersion).toBe(5);
  });
  it('persists a brand-new campaign before the first tick and preserves unreadable save data', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const first = restoreCampaign(T0, storage, () => 456);
    const immediateReload = restoreCampaign(T0, storage, () => 999);
    expect(immediateReload).toEqual(first);
    expect(immediateReload.personnel!.campaignSeed).toBe(456);
    data.set(SAVE_KEY, 'unreadable-old-save');
    restoreCampaign(T0, storage, () => 123);
    expect(data.get(`${SAVE_KEY}/recovery`)).toBe('unreadable-old-save');
  });
  it('permanently records an actual retirement before replacement hiring', () => {
    let s = createInitialState(T0, 10);
    const identity = s.officers.off_chen.identityId;
    s.officers.off_chen.retirement = { day: 1, announcedDay: 0, reason: 'service', extended: false };
    s = dispatch(s, { type: 'tick' }, { now: T0 + 2 * HOUR }).state;
    expect(s.officers.off_chen).toBeUndefined();
    s = deserialize(serialize(s, T0 + 2 * HOUR))!;
    expect(s.personnel!.employedIdentityIds).toContain(identity);
    fillCandidates(s, T0 + 2 * HOUR);
    expect(s.candidates.some((c) => c.officer.identityId === identity)).toBe(false);
  });
  it('rejects duplicate active identities and malformed identity history', () => {
    const s = createInitialState(T0);
    s.candidates[0].officer.identityId = s.officers.off_chen.identityId;
    expect(deserialize(serialize(s, T0))).toBeNull();
    const fresh = createInitialState(T0);
    fresh.personnel!.employedIdentityIds.push(fresh.personnel!.employedIdentityIds[0]);
    expect(deserialize(serialize(fresh, T0))).toBeNull();
  });
});
