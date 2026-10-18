import { describe, expect, it } from 'vitest';
import { generateIncident, incidentId } from '../index';
import fingerprints from './compiled-fingerprints.json';
import { digest, TREE_FINGERPRINT_SPECS } from './fingerprint-specs';

/** A refactor guard, not a frozen release: every call tree on every building it lists, at four
 * call seeds, compiles to the same bytes as when this file was captured. A change to the
 * compiler that should not change any call (the incident model of docs/incident-domain-model.md,
 * M1) must keep this green. A deliberate content or engine change re-captures it with
 * `bun scripts/capture-tree-fingerprints.ts`, and says so in its commit. */
describe('compiled call trees', () => {
  it('compile to the captured bytes on every listed building', async () => {
    const actual: Record<string, string> = {};
    for (const spec of TREE_FINGERPRINT_SPECS) actual[incidentId(spec)] = await digest(generateIncident(spec));
    expect(Object.keys(fingerprints).length).toBe(TREE_FINGERPRINT_SPECS.length);
    expect(actual).toEqual(fingerprints);
  }, 300000);
});
