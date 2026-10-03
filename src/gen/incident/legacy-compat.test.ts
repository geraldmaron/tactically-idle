import { describe, expect, it } from 'vitest';
import { buildLocation } from '../../sim/location';
import { hashSeed } from '../../sim/rng';
import { INCIDENT_TYPES, generateIncident } from './index';

// Captured from 149ac15 before adding the versioned residential catalog. Saved
// IDs may never silently acquire a different plan, fact position or action.
const seeds = [0, 1, 7, 42, 4294967295];
const legacyFamilies = ['maple_street', 'cedar_close', 'harbour_court', 'market_row'];

describe('frozen saved building and incident identities', () => {
  it('keeps every original seeded building unchanged', () => {
    const fingerprints = Object.fromEntries(legacyFamilies.map((family) => [family, hashSeed(JSON.stringify(seeds.map((seed) => buildLocation(family, seed))))]));
    expect(fingerprints).toEqual({ maple_street: 3966972919, cedar_close: 2711343663, harbour_court: 3183376961, market_row: 3958971782 });
  });

  it('keeps original incident targets, facts, actions and rewards unchanged', () => {
    const fingerprints = Object.fromEntries(legacyFamilies.map((familyId) => [familyId, hashSeed(JSON.stringify(
      INCIDENT_TYPES.filter((type) => familyId === 'maple_street' || type.families.includes(familyId)).flatMap((type) => seeds.map((seed) => generateIncident({ type: type.type, familyId, buildingSeed: seed, seed, tier: 1 + seed % 5, contentVersion: 1 }))),
    ))]));
    expect(fingerprints).toEqual({ maple_street: 621556390, cedar_close: 2899514451, harbour_court: 828673244, market_row: 4225901334 });
  });
});
