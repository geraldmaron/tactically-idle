import { describe, it, expect } from 'vitest';
import { PROCEDURAL_FAMILIES_G2, generateBuilding } from './index';
import fingerprints from './procedural-g2-fingerprints.json';

/** `_g2` building types regenerate from (familyId, seed) alone, so their output is frozen
 * once released, like `_g1`. A change that alters any of these must ship as new `_g3` types;
 * never re-baseline (see procedural/README.md). Same seeds as the `_g1` suite. */
const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('');
export const G2_FINGERPRINT_SEEDS = [0, 1, 7, 42, 1000, 4294967295];
export const G2_FINGERPRINT_IDS = PROCEDURAL_FAMILIES_G2.flatMap(family => [family.id, `${family.id}__furnished_v7`]);

describe('procedural _g2 buildings', () => {
  it('regenerate every captured building byte for byte, plain and furnished', async () => {
    const actual: Record<string, string> = {};
    for (const id of G2_FINGERPRINT_IDS) for (const seed of G2_FINGERPRINT_SEEDS) actual[`${id}:${seed}`] = await digest(generateBuilding(id, seed));
    expect(Object.keys(fingerprints)).toHaveLength(9 * 2 * G2_FINGERPRINT_SEEDS.length);
    expect(actual).toEqual(fingerprints);
  }, 120000);

  it('carry exact geometry on both forms, and access only on apartments', () => {
    for (const id of G2_FINGERPRINT_IDS) {
      const loc = generateBuilding(id, 7);
      expect(loc.geometry, id).toBe('exact');
      expect(loc.familyId, id).toBe(id.replace(/__furnished_v7$/, ''));
      expect(Boolean(loc.access), id).toBe(id.startsWith('apartment_unit_g2'));
    }
  });
});
