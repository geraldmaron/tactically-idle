import { describe, it, expect } from 'vitest';
import { PROCEDURAL_FAMILIES, generateBuilding } from './index';
import fingerprints from './procedural-g1-fingerprints.json';

/** `_g1` building types regenerate from (familyId, seed) alone, so their output is frozen
 * once released. A change that alters any of these must ship as new `_g2` types; never
 * re-baseline `_g1` (see procedural/README.md). */
const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('');
export const G1_FINGERPRINT_SEEDS = [0, 1, 7, 42, 1000, 4294967295];
export const G1_FINGERPRINT_IDS = PROCEDURAL_FAMILIES.flatMap(family => [family.id, `${family.id}__furnished_v7`]);

describe('procedural _g1 buildings', () => {
  it('regenerate every captured building byte for byte, plain and furnished', async () => {
    const actual: Record<string, string> = {};
    for (const id of G1_FINGERPRINT_IDS) for (const seed of G1_FINGERPRINT_SEEDS) actual[`${id}:${seed}`] = await digest(generateBuilding(id, seed));
    expect(Object.keys(fingerprints)).toHaveLength(9 * 2 * G1_FINGERPRINT_SEEDS.length);
    expect(actual).toEqual(fingerprints);
  }, 120000);
});
