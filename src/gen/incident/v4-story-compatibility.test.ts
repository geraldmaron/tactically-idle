import { describe, expect, it } from 'vitest';
import published from './v4-published-fingerprints.json';
import { hashSeed } from '../../sim/rng';
import { getScenario } from '../../sim/scenario-registry';
import { drawIncidentSpec, generateIncident, INCIDENT_TYPES_V4 } from './index';

function frozenDefinitions() {
  return Object.fromEntries(INCIDENT_TYPES_V4.flatMap(type => type.families.flatMap(familyId => [0, 7, 41].map(seed => {
    const spec = { type: type.type, familyId, buildingSeed: 7, seed, tier: 2, contentVersion: 4 };
    return [`${type.type}/${familyId}/${seed}`, hashSeed(JSON.stringify(generateIncident(spec)))];
  }))));
}

describe('published v4 stories stay frozen', () => {
  // Captured from published main f54461b9 before any v5 routing or content edits.
  it('preserves every complete definition across all supported v4 settings', () => {
    expect(frozenDefinitions()).toEqual(published.definitions);
  });
  it('preserves the six previously issued decision exercise IDs and full content', () => {
    for (const [id, fingerprint] of Object.entries(published.exercises)) expect(hashSeed(JSON.stringify(getScenario(id)))).toBe(fingerprint);
  });
  it('preserves the exact v4 content selection and department random stream', () => {
    for (const [seed, result] of Object.entries(published.draws)) expect(drawIncidentSpec(Number(seed), { level: 4, trust: 80, contentVersion: 4, avoidFamilies: ['cedar_close'] })).toEqual(result);
  });
});
