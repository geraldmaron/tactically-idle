import { describe, it, expect } from 'vitest';
import { SCENARIO_TYPES_V11 } from '../../content/scenario-types-v11';
import { generateIncident, incidentId } from './index';
import type { IncidentSpec } from '../../sim/scenario-types';
import fingerprints from './issued-v11-fingerprints.json';

/** v11 shipped on 2026-10-06. Every framework on every building it can use, at two
 * call seeds, must regenerate byte for byte, including lazily hosted generated
 * buildings. Never re-baseline an issued version; add a new content version instead. */
const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('');
export const ISSUED_V11_SPECS: IncidentSpec[] = SCENARIO_TYPES_V11.flatMap(info => info.families.flatMap(familyId =>
  [[7, 3], [19, 11]].map(([buildingSeed, seed]) => ({ type: info.type, familyId, buildingSeed, seed, tier: 2, contentVersion: 11 }))));

describe('issued v11 scenarios', () => {
  it('regenerate every captured definition byte for byte', async () => {
    const actual: Record<string, string> = {};
    for (const spec of ISSUED_V11_SPECS) actual[incidentId(spec)] = await digest(generateIncident(spec));
    expect(Object.keys(fingerprints).length).toBe(ISSUED_V11_SPECS.length);
    expect(actual).toEqual(fingerprints);
  }, 300000);
});
