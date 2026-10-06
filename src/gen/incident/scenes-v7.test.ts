import { describe, expect, it } from 'vitest';
import frozen from '../../sim/fixtures/v6-scene-baseline.json';
import type { IncidentSpec } from '../../sim/scenario-types';
import { generateIncident, INCIDENT_TYPES_V5 } from './index';
import { buildLocation } from '../../sim/location';
import { validateScenario } from '../../sim/operation';
import { scenarioActions } from '../../sim/scenario-types';

const digest = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map(byte => byte.toString(16).padStart(2, '0')).join('');
describe('versioned coherent scenes', () => {
  it('does not present an outside witness as an armed subject', () => {
    const scenario = generateIncident({ type: 'barricaded', familyId: 'cedar_close', buildingSeed: 7, seed: 1, tier: 1, contentVersion: 7 });
    expect(scenario.story!.bindings.people.cal.publicKind).toBe('civilian');
    expect(Object.values(scenario.story!.bindings.people).every(person => person.publicKind === 'civilian')).toBe(true);
  });
  it('preserves 96 published v6 incident and building fingerprints', async () => {
    for (const baseline of frozen) {
      const spec = baseline.spec as IncidentSpec;
      expect(await digest(generateIncident(spec)), JSON.stringify(spec)).toBe(baseline.scenario);
      expect(await digest(buildLocation(spec.familyId, spec.buildingSeed)), JSON.stringify(spec)).toBe(baseline.location);
    }
  }, 30000);
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
