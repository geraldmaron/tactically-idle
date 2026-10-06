import { unlockRule } from '../../content/unlocks';
import { SCENARIO_TYPES_V11 } from '../../content/scenario-types-v11';
import { describe, expect, it } from 'vitest';
import { scenarioRecipe, scenarioSituationsV10, specForSituationV10 } from '../../content/scenario-recipes';
import { SCENARIO_TYPES_V10 } from '../../content/scenario-types-v10';
import { baseFamilyIdV7 } from '../../gen/building';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FEATURED_TYPES, buildingOptionLabel, casebookRows, casebookTotals, featuredOperation, filterRows, isGeneratedBuilding, localDateKey, practiceScenarioV10 } from './casebook-model';
import { Casebook } from './Casebook';
import { createInitialState } from '../../sim/department';
import { takeIncident } from '../../sim/incidents';
import { incidentId } from '../../gen/incident';
import { scenarioFloorCount } from '../components/incident';

describe('casebook practice on v10 recipes', () => {
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
        const { scenario, buildingSeed } = practiceScenarioV10(type, familyId, situation, fromSeed);
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
    expect(scenarioFloorCount(practiceScenarioV10('domestic', 'two_storey_house_g1', situation, 7).scenario)).toBe(2);
    expect(scenarioFloorCount(practiceScenarioV10('domestic', 'cedar_close', situation, 7).scenario)).toBe(1);
  });
});

describe('casebook rows and the featured operation', () => {
  const T0 = Date.UTC(2026, 9, 6, 15, 0, 0);
  const takeDomestic = (state: ReturnType<typeof createInitialState>) => {
    const spec = { ...specForSituationV10('domestic', 'two_storey_house_g2', { variant: 1, characteristic: 'ordinary' }, 9), contentVersion: 11 };
    const id = incidentId(spec);
    state.incidents.unshift({ id, type: 'domestic', familyId: spec.familyId, tier: spec.tier, arrivedAt: T0, expiresAt: T0 + 3_600_000, seen: true });
    takeIncident(state, id);
    return id;
  };

  it('shows locked frameworks as requirements and undiscovered ones as counts, never content', () => {
    const state = createInitialState(T0, 3);
    const rows = casebookRows(state);
    const rescue = rows.find((row) => row.type === 'protected_rescue')!;
    expect(rescue).toEqual({ type: 'protected_rescue', label: 'Protected rescue', settings: ['homes'], families: rescue.families, situationsTotal: 3, status: 'locked', missing: ['Department level 4', 'An officer certified in Vehicle operations'] });
    // A new department is level 1: only the level-1 frameworks are dispatched yet.
    const levelOne = SCENARIO_TYPES_V11.filter((info) => unlockRule(info.type).level === 1).map((info) => info.type);
    expect(rows.filter((row) => row.status === 'unfound').map((row) => row.type)).toEqual(levelOne);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(row.status === 'locked' ? ['families', 'label', 'missing', 'settings', 'situationsTotal', 'status', 'type'] : ['families', 'label', 'settings', 'situationsTotal', 'status', 'type']);
    const html = renderToStaticMarkup(createElement(Casebook, { state, onPrepare: () => {} }));
    expect(html).toContain('Not yet dispatched to your department');
    expect(html).toContain('An officer certified in Vehicle operations');
    expect(html).toContain('Department level 4');
    expect(html).toContain(`0 of ${SCENARIO_TYPES_V11.length}</strong> kinds of call found`);
    const rescueTitles = scenarioSituationsV10('protected_rescue').map((situation) => practiceScenarioV10('protected_rescue', 'harbour_court', situation, 7).scenario!.title);
    for (const title of rescueTitles) expect(html).not.toContain(title);
  });

  it('lists a dispatched recipe with its situation count, best result and building type, and filters rows', () => {
    const state = createInitialState(T0, 3);
    takeDomestic(state);
    const rows = casebookRows(state);
    const domestic = rows.find((row) => row.type === 'domestic')!;
    expect(domestic).toMatchObject({ status: 'found', situationsTotal: 3, buildings: ['two_storey_house_g2'], situations: [{ variant: 1, pacings: [{ variant: 1, characteristic: 'ordinary' }] }] });
    const locked = SCENARIO_TYPES_V11.filter((info) => unlockRule(info.type).level > 1).map((info) => info.type);
    expect(casebookTotals(rows)).toMatchObject({ frameworksFound: 1, situationsFound: 1, locked: locked.length });
    expect(filterRows(rows, { type: 'all', setting: 'businesses', status: 'all' }).every((row) => row.settings.includes('businesses'))).toBe(true);
    expect(filterRows(rows, { type: 'all', setting: 'all', status: 'found' }).map((row) => row.type)).toEqual(['domestic']);
    expect(filterRows(rows, { type: 'all', setting: 'all', status: 'locked' }).map((row) => row.type)).toEqual(locked);
    const html = renderToStaticMarkup(createElement(Casebook, { state, onPrepare: () => {} }));
    expect(html).toContain('1 of 3');
    expect(html).toContain('2 more situations to find');
  });

  it('features the same call for everyone on a date, from frameworks every department is sent', () => {
    for (const type of ['protected_rescue', 'active_armed_incident', 'hostage_crisis', 'barricaded']) expect(FEATURED_TYPES).not.toContain(type);
    const seen = new Set<string>();
    for (let day = 1; day <= 12; day++) {
      const key = `2026-10-${String(day).padStart(2, '0')}`;
      const a = featuredOperation(key);
      const b = featuredOperation(key);
      expect(a.scenario, key).not.toBeNull();
      expect(a.scenario!.id).toBe(b.scenario!.id);
      expect(a.scenario!.incident).toMatchObject({ type: a.type, contentVersion: 10 });
      seen.add(a.scenario!.id);
    }
    expect(seen.size).toBe(12);
    expect(localDateKey(new Date(2026, 0, 2, 23, 59).getTime())).toBe('2026-01-02');
  });
});
