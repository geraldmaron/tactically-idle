import { describe, it, expect } from 'vitest';
import { SCENARIO_TYPES_V11 } from '../../content/scenario-types-v11';
import { isProceduralFamily, baseFamilyIdV7 } from '../building';
import { buildLocation } from '../../sim/location';
import { validateStoryBindings } from '../../sim/story-bindings';
import { routeBetween } from '../../sim/spatial-factors';
import { generateIncident, incidentId, parseIncidentId } from './index';

const pairs = SCENARIO_TYPES_V11.flatMap(info => info.families.filter(isProceduralFamily).map(familyId => ({ type: info.type, familyId })));

describe('content v11 locations', () => {
  it('draws the second building generation only', () => {
    expect(pairs.length).toBeGreaterThan(0);
    for (const { familyId } of pairs) expect(familyId, familyId).toMatch(/_g2$/);
  });
  it.each(pairs)('$type on $familyId is valid, deterministic and reachable by squads', ({ type, familyId }) => {
    for (const buildingSeed of [4, 1203]) {
      const spec = { type, familyId, buildingSeed, seed: buildingSeed * 7 + 2, tier: 2, contentVersion: 11 };
      const s = generateIncident(spec);
      expect(s.id).toBe(incidentId(spec)); expect(parseIncidentId(s.id)).toEqual(spec); expect(generateIncident(spec)).toEqual(s);
      const built = buildLocation(s.locationFamilyId, s.locationSeed), entry = built.location.entries[0];
      expect(built.issues.filter(issue => issue.severity === 'error')).toEqual([]);
      expect(validateStoryBindings(s, built)).toEqual([]);
      for (const person of Object.values(s.story?.bindings.people ?? {})) {
        const reachable = built.derived.stagingPoints.filter(point => point.spaceId === entry).some(start => routeBetween(built, entry, start.at, person.initial.spaceId, person.initial.at, null).reachable);
        expect(reachable, `${type} ${familyId} ${buildingSeed}: ${person.id}`).toBe(true);
      }
    }
  }, 120000);
  it('hosts the wheelchair rescue only in step-free generated apartments', () => {
    let hosted = 0;
    for (let buildingSeed = 1; buildingSeed <= 24; buildingSeed++) {
      const s = generateIncident({ type: 'protected_rescue', familyId: 'apartment_unit_g2', buildingSeed, seed: buildingSeed * 5 + 1, tier: 2, contentVersion: 11 });
      if (baseFamilyIdV7(s.locationFamilyId) !== 'apartment_unit_g2') continue;
      hosted++;
      expect(buildLocation(s.locationFamilyId, s.locationSeed).location.access?.stepFree, `seed ${buildingSeed}`).toBe(true);
    }
    expect(hosted).toBeGreaterThan(0);
  }, 120000);
});
