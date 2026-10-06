import { describe, it, expect } from 'vitest';
import { SCENARIO_TYPES_V10, GENERATED_FAMILIES_V10 } from '../../content/scenario-types-v10';
import { PROCEDURAL_FAMILIES, baseFamilyIdV7 } from '../building';
import { buildLocation } from '../../sim/location';
import { validateStoryBindings } from '../../sim/story-bindings';
import { drawIncidentSpec, generateIncident, incidentId, parseIncidentId, INCIDENT_CONTENT_VERSION } from './index';

describe('content v10 generated locations', () => {
  it('is the current content version and lists every generated building type somewhere', () => {
    expect(INCIDENT_CONTENT_VERSION).toBe(10);
    const used = new Set(Object.values(GENERATED_FAMILIES_V10).flat());
    for (const family of PROCEDURAL_FAMILIES) expect(used.has(family.id), family.id).toBe(true);
  });
  it.each(SCENARIO_TYPES_V10.flatMap(info => info.families.filter(f => PROCEDURAL_FAMILIES.some(p => p.id === f)).map(familyId => ({ type: info.type, familyId }))))(
    '$type on $familyId resolves to a valid, deterministic, playable building', ({ type, familyId }) => {
      for (const buildingSeed of [3, 1001]) {
        const spec = { type, familyId, buildingSeed, seed: buildingSeed * 13, tier: 2, contentVersion: 10 };
        const s = generateIncident(spec);
        expect(s.id).toBe(incidentId(spec)); expect(s.incident).toEqual(spec); expect(parseIncidentId(s.id)).toEqual(spec);
        expect(generateIncident(spec)).toEqual(s);
        const built = buildLocation(s.locationFamilyId, s.locationSeed);
        expect(built.issues.filter(issue => issue.severity === 'error')).toEqual([]);
        expect(validateStoryBindings(s, built)).toEqual([]);
        expect(s.locationFamilyId).toContain(baseFamilyIdV7(s.locationFamilyId));
      }
    }, 60000);
  it('draws generated buildings onto the board without changing the draw stream', () => {
    let state = 99; let generated = 0;
    for (let i = 0; i < 200; i++) {
      const drawn = drawIncidentSpec(state, { level: 6, trust: 80, contentVersion: 10 }); state = drawn.state;
      if (PROCEDURAL_FAMILIES.some(f => f.id === drawn.spec.familyId)) generated++;
      if (i < 40) expect(() => generateIncident(drawn.spec)).not.toThrow();
    }
    expect(generated).toBeGreaterThan(40);
  }, 120000);
});
