import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import frozen from '../../sim/fixtures/v6-scene-baseline.json';
import type { IncidentSpec } from '../../sim/scenario-types';
import { generateIncident, INCIDENT_TYPES_V5 } from './index';
import { buildLocation } from '../../sim/location';
import { validateScenario } from '../../sim/operation';
import { scenarioActions } from '../../sim/scenario-types';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
describe('versioned coherent scenes', () => {
  it('preserves 96 published v6 incident and building fingerprints', () => {
    for (const baseline of frozen) {
      const spec = baseline.spec as IncidentSpec;
      expect(digest(generateIncident(spec)), JSON.stringify(spec)).toBe(baseline.scenario);
      expect(digest(buildLocation(spec.familyId, spec.buildingSeed)), JSON.stringify(spec)).toBe(baseline.location);
    }
  });
  it('validates v7 episodes against their actual furnished layouts', () => {
    for (const type of INCIDENT_TYPES_V5) for (const familyId of type.families) for (const seed of [0, 1, 7]) {
      const spec: IncidentSpec = { type: type.type, familyId, buildingSeed: seed, seed: seed * 13 + 7, tier: 2, contentVersion: 7 };
      const scenario = generateIncident(spec);
      expect(scenario.locationFamilyId).toBe(`${familyId}__furnished_v7`);
      const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
      expect(validateScenario(scenario, built), JSON.stringify(spec)).toEqual([]);
      expect(generateIncident(spec)).toEqual(scenario);
      const force = scenarioActions(scenario).filter(a => a.forceProfile);
      if (['active_armed_incident', 'hostage_crisis'].includes(type.type)) expect(force.length).toBeGreaterThan(0);
      else expect(force).toEqual([]);
      for (const action of force) {
        expect(action.storyTargetPersonId).toBe(action.forceProfile?.personId);
        expect(scenario.story?.bindings.people[action.forceProfile!.personId]).toBeDefined();
        expect(action.requires.certs?.length).toBeGreaterThan(0);
      }
    }
  }, 30000);
});
