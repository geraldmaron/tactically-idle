import { unlockRule } from '../../content/unlocks';
import { SCENARIO_TYPES } from '../../content/scenario-types';
import { describe, expect, it } from 'vitest';
import { scenarioRecipe, scenarioSituations, specForSituation } from '../../content/scenario-recipes';
import { baseFamilyId } from '../../gen/building';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { casebookRows, casebookTotals, filterRows } from './casebook-model';
import { Casebook } from './Casebook';
import { createInitialState } from '../../sim/department';
import { takeIncident } from '../../sim/incidents';
import { incidentId } from '../../gen/incident';
import { getScenario } from '../../sim/scenario-registry';
import type { ScenarioSituation } from '../../content/scenario-recipes';
import type { IncidentType } from '../../sim/scenario-types';
import { scenarioFloorCount } from '../components/incident';

/** The first building seed from 7 whose generated call stays on the chosen building type. */
function hostedCall(type: IncidentType, familyId: string, situation: ScenarioSituation) {
  for (let seed = 7; seed < 23; seed++) {
    const scenario = getScenario(incidentId(specForSituation(type, familyId, situation, seed)));
    if (scenario && baseFamilyId(scenario.locationFamilyId) === familyId) return scenario;
  }
  return null;
}

describe('casebook situations on v10 recipes', () => {
  it('offers six neutral situations per framework and finds each through the public generator', () => {
    for (const info of SCENARIO_TYPES) {
      const situations = scenarioSituations(info.type);
      expect(situations, info.type).toHaveLength(6);
      for (const situation of situations) {
        const spec = specForSituation(info.type, info.families.at(-1)!, situation, 11);
        expect(spec.contentVersion).toBe(13);
        expect(scenarioRecipe(spec)).toMatchObject(situation);
      }
    }
  });

  it('reports the floors of the building actually used', () => {
    const situation = scenarioSituations('barricaded')[0];
    expect(scenarioFloorCount(hostedCall('barricaded', 'two_storey_house_g2', situation))).toBe(2);
    expect(scenarioFloorCount(hostedCall('barricaded', 'cedar_close', situation))).toBe(1);
  });
});

describe('casebook rows', () => {
  const T0 = Date.UTC(2026, 9, 6, 15, 0, 0);
  const takeBarricade = (state: ReturnType<typeof createInitialState>) => {
    const spec = { ...specForSituation('barricaded', 'two_storey_house_g2', { variant: 1, characteristic: 'ordinary' }, 9), contentVersion: 13 };
    const id = incidentId(spec);
    state.incidents.unshift({ id, type: 'barricaded', familyId: spec.familyId, tier: spec.tier, arrivedAt: T0, expiresAt: T0 + 3_600_000, seen: true });
    takeIncident(state, id);
    return id;
  };

  it('shows locked frameworks as requirements and undiscovered ones as counts, never content', () => {
    const state = createInitialState(T0, 3);
    const rows = casebookRows(state);
    const rescue = rows.find((row) => row.type === 'protected_rescue')!;
    expect(rescue).toEqual({ type: 'protected_rescue', label: 'Protected rescue', settings: ['homes'], families: rescue.families, situationsTotal: 3, status: 'locked', missing: ['An officer certified in Vehicle operations'] });
    // Frameworks retired from dispatch and never met have no row. A new department is level 1:
    // the level-1 frameworks its roster qualifies for are dispatched; rescue still needs a driver
    // (sidearms are issued from the first day, so the armed incident is dispatched).
    const dispatchable = SCENARIO_TYPES.map((info) => info.type);
    expect(rows.map((row) => row.type)).toEqual(dispatchable);
    const levelOne = dispatchable.filter((type) => unlockRule(type).level === 1 && type !== 'protected_rescue');
    expect(rows.filter((row) => row.status === 'unfound').map((row) => row.type)).toEqual(levelOne);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(row.status === 'locked' ? ['families', 'label', 'missing', 'settings', 'situationsTotal', 'status', 'type'] : ['families', 'label', 'settings', 'situationsTotal', 'status', 'type']);
    const html = renderToStaticMarkup(createElement(Casebook, { state }));
    expect(html).toContain('Not yet dispatched to your department');
    expect(html).toContain('An officer certified in Vehicle operations');
    // Every dispatched kind of call opens at level 1; locks name capabilities, never a level.
    expect(html).not.toContain('Service sidearm, Compact carbine or Response shotgun in stock');
    expect(html).not.toContain('Department level');
    expect(html).toContain(`0 of ${dispatchable.length}</strong> kinds of call found`);
    const rescueTitles = scenarioSituations('protected_rescue').map((situation) => hostedCall('protected_rescue', 'juniper_court_v1', situation)!.title);
    for (const title of rescueTitles) expect(html).not.toContain(title);
  });

  it('lists a dispatched recipe with its situation count, best result and building type, and filters rows', () => {
    const state = createInitialState(T0, 3);
    takeBarricade(state);
    const rows = casebookRows(state);
    const barricade = rows.find((row) => row.type === 'barricaded')!;
    expect(barricade).toMatchObject({ status: 'found', situationsTotal: 3, buildings: ['two_storey_house_g2'], situations: [{ variant: 1, pacings: [{ variant: 1, characteristic: 'ordinary' }] }] });
    const locked = SCENARIO_TYPES.map((info) => info.type).filter((type) => (unlockRule(type).level > 1 || type === 'protected_rescue'));
    expect(casebookTotals(rows)).toMatchObject({ frameworksFound: 1, situationsFound: 1, locked: locked.length });
    expect(filterRows(rows, { type: 'all', setting: 'businesses', status: 'all' }).every((row) => row.settings.includes('businesses'))).toBe(true);
    expect(filterRows(rows, { type: 'all', setting: 'all', status: 'found' }).map((row) => row.type)).toEqual(['barricaded']);
    expect(filterRows(rows, { type: 'all', setting: 'all', status: 'locked' }).map((row) => row.type)).toEqual(locked);
    const html = renderToStaticMarkup(createElement(Casebook, { state }));
    expect(html).toContain('1 of 3');
    expect(html).toContain('2 more situations to find');
  });

});
