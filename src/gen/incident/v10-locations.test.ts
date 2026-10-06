import { describe, it, expect } from 'vitest';
import { SCENARIO_TYPES_V10, GENERATED_FAMILIES_V10 } from '../../content/scenario-types-v10';
import { PROCEDURAL_FAMILIES, baseFamilyIdV7 } from '../building';
import { buildLocation } from '../../sim/location';
import { validateStoryBindings } from '../../sim/story-bindings';
import { routeBetween } from '../../sim/spatial-factors';
import { drawIncidentSpec, generateIncident, incidentId, parseIncidentId, INCIDENT_CONTENT_VERSION } from './index';

describe('content v10 generated locations', () => {
  it('remains readable after later versions and lists every generated building type somewhere', () => {
    expect(INCIDENT_CONTENT_VERSION).toBeGreaterThanOrEqual(10);
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

describe('v10 hosting keeps the drawn situation', () => {
  it('plays the situation the drawn ID implies even when the building seed moves', async () => {
    const { scenarioRecipe } = await import('../../content/scenario-recipes');
    let moved = 0;
    for (const type of ['burglary', 'business_robbery', 'welfare_check', 'missing_vulnerable'] as const) for (const familyId of PROCEDURAL_FAMILIES.map(f => f.id)) for (let buildingSeed = 0; buildingSeed < 16; buildingSeed++) {
      const spec = { type, familyId, buildingSeed, seed: buildingSeed * 31 + 5, tier: 2, contentVersion: 10 };
      if (!parseIncidentId(incidentId(spec))) continue;
      const s = generateIncident(spec), drawn = scenarioRecipe(spec), played = s.story!.recipeId!.split('/');
      if (s.locationSeed !== buildingSeed || !s.locationFamilyId.startsWith(familyId)) moved++;
      expect([Number(played[2]), played[3]], `${type} ${familyId} ${buildingSeed}`).toEqual([drawn.variant, drawn.characteristic]);
    }
    expect(moved).toBeGreaterThan(0);
  }, 300000);
});

describe('v10 generated buildings are playable by squads', () => {
  /** The game's own squad router is the judge: every room of a furnished generated
   * building, on every floor, and every story person's start room must be reachable
   * from every entry. Authored buildings meet this; generated ones must too. */
  it.each(PROCEDURAL_FAMILIES.map(f => f.id))('%s: every room is reachable by squads from every entry, furnished', familyId => {
    for (let seed = 1; seed <= 12; seed++) {
      const built = buildLocation(`${familyId}__furnished_v7`, seed);
      for (const entry of built.location.entries) for (const room of built.location.rooms) {
        // Squads move to staging points (resolution.ts), so a room counts as reachable
        // when any of its staging points is.
        const stands = built.derived.stagingPoints.filter(point => point.spaceId === room.id);
        const starts = built.derived.stagingPoints.filter(point => point.spaceId === entry);
        const reachable = starts.some(start => stands.some(point => routeBetween(built, entry, start.at, room.id, point.at, null).reachable));
        expect(reachable, `${familyId} seed ${seed}: ${entry} -> ${room.id} (floor ${room.floor}, ${stands.length} stands)`).toBe(true);
      }
    }
  }, 120000);
  it('story people start where squads can reach them', () => {
    for (const info of SCENARIO_TYPES_V10) for (const familyId of info.families.filter(f => PROCEDURAL_FAMILIES.some(p => p.id === f))) for (const buildingSeed of [2, 9]) {
      const s = generateIncident({ type: info.type, familyId, buildingSeed, seed: buildingSeed * 17 + 1, tier: 2, contentVersion: 10 });
      const built = buildLocation(s.locationFamilyId, s.locationSeed), entry = built.location.entries[0];
      for (const person of Object.values(s.story?.bindings.people ?? {})) {
        const reachable = built.derived.stagingPoints.filter(point => point.spaceId === entry).some(start => routeBetween(built, entry, start.at, person.initial.spaceId, person.initial.at, null).reachable);
        expect(reachable, `${info.type} ${familyId} ${buildingSeed}: ${person.id} in ${person.initial.spaceId}`).toBe(true);
      }
    }
  }, 300000);
});
