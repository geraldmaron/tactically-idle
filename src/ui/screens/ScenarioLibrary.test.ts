import { describe, expect, it } from 'vitest';
import { scenarioRecipe, scenarioSituationsV10, specForSituationV10 } from '../../content/scenario-recipes';
import { SCENARIO_TYPES_V10 } from '../../content/scenario-types-v10';
import { baseFamilyIdV7 } from '../../gen/building';
import { buildingOptionLabel, isGeneratedBuilding, libraryScenarioV10 } from './ScenarioLibrary';
import { scenarioFloorCount } from '../components/incident';

describe('v10 scenario library', () => {
  it('offers six neutral situations per framework and finds each through the public generator', () => {
    for (const info of SCENARIO_TYPES_V10) {
      const situations = scenarioSituationsV10(info.type);
      expect(situations, info.type).toHaveLength(6);
      for (const situation of situations) {
        const spec = specForSituationV10(info.type, info.families.at(-1)!, situation, 11);
        expect(spec.contentVersion).toBe(10);
        expect(scenarioRecipe(spec)).toMatchObject(situation);
      }
    }
  });

  it.each(SCENARIO_TYPES_V10.flatMap((info) => info.families.map((familyId) => ({ type: info.type, familyId }))))(
    '$type practice on $familyId uses the chosen building and situation', ({ type, familyId }) => {
      const situation = scenarioSituationsV10(type)[1];
      for (const fromSeed of [7, 8]) {
        const { scenario, buildingSeed } = libraryScenarioV10(type, familyId, situation, fromSeed);
        expect(scenario).not.toBeNull();
        expect(buildingSeed).toBeGreaterThanOrEqual(fromSeed);
        expect(baseFamilyIdV7(scenario!.locationFamilyId)).toBe(familyId);
        expect(scenario!.locationSeed).toBe(buildingSeed);
        expect(scenario!.incident).toMatchObject({ type, familyId, buildingSeed, contentVersion: 10 });
        if (scenario!.story?.recipeId) expect(scenario!.story.recipeId).toBe(`${type}/${familyId}/${situation.variant}/${situation.characteristic}`);
      }
    }, 30000);

  it('names generated building types with their floors and authored ones by place', () => {
    expect(buildingOptionLabel('two_storey_house_g1')).toBe('Two-story house · 2 floors');
    expect(buildingOptionLabel('apartment_unit_g1')).toBe('Apartment · 1 or 2 floors');
    expect(buildingOptionLabel('bungalow_g1')).toBe('Bungalow');
    expect(buildingOptionLabel('corner_store_flat_g1')).toBe('Corner store with apartment · 2 floors');
    expect(buildingOptionLabel('ash_grove_v1')).toBe('Ash Grove · L-shaped bungalow');
    expect(isGeneratedBuilding('cedar_close')).toBe(false);
  });

  it('reports the floors of the building actually used', () => {
    const situation = scenarioSituationsV10('domestic')[0];
    expect(scenarioFloorCount(libraryScenarioV10('domestic', 'two_storey_house_g1', situation, 7).scenario)).toBe(2);
    expect(scenarioFloorCount(libraryScenarioV10('domestic', 'cedar_close', situation, 7).scenario)).toBe(1);
  });
});
