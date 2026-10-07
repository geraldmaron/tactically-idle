import { unlockRule } from '../../content/unlocks';
import { SCENARIO_TYPES_V11 } from '../../content/scenario-types-v11';
import { describe, expect, it } from 'vitest';
import { scenarioRecipe, scenarioSituationsV10, specForSituationV10 } from '../../content/scenario-recipes';
import { SCENARIO_TYPES_V10 } from '../../content/scenario-types-v10';
import { baseFamilyIdV7 } from '../../gen/building';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { casebookRows, casebookTotals, filterRows } from './casebook-model';
import { Casebook } from './Casebook';
import { createInitialState } from '../../sim/department';
import { takeIncident } from '../../sim/incidents';
import { incidentId } from '../../gen/incident';
import { getScenario } from '../../sim/scenario-registry';
import { RETIRED_FROM_DISPATCH } from '../../content/unlocks';
import type { ScenarioSituation } from '../../content/scenario-recipes';
import type { IncidentType } from '../../sim/scenario-types';
import { scenarioFloorCount } from '../components/incident';

/** The first building seed from 7 whose generated call stays on the chosen building type. */
function hostedCall(type: IncidentType, familyId: string, situation: ScenarioSituation) {
  for (let seed = 7; seed < 23; seed++) {
    const scenario = getScenario(incidentId(specForSituationV10(type, familyId, situation, seed)));
    if (scenario && baseFamilyIdV7(scenario.locationFamilyId) === familyId) return scenario;
  }
  return null;
}

describe('casebook situations on v10 recipes', () => {
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

  it('reports the floors of the building actually used', () => {
    const situation = scenarioSituationsV10('domestic')[0];
    expect(scenarioFloorCount(hostedCall('domestic', 'two_storey_house_g1', situation))).toBe(2);
    expect(scenarioFloorCount(hostedCall('domestic', 'cedar_close', situation))).toBe(1);
  });
});

describe('casebook rows', () => {
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
    expect(rescue).toEqual({ type: 'protected_rescue', label: 'Protected rescue', settings: ['homes'], families: rescue.families, situationsTotal: 3, status: 'locked', missing: ['An officer certified in Vehicle operations'] });
    // Frameworks retired from dispatch and never met have no row. A new department is level 1:
    // the level-1 frameworks its roster qualifies for are dispatched; rescue still needs a driver
    // and the armed incident a response firearm.
    const dispatchable = SCENARIO_TYPES_V11.map((info) => info.type).filter((type) => !RETIRED_FROM_DISPATCH.has(type));
    expect(rows.map((row) => row.type)).toEqual(dispatchable);
    const levelOne = dispatchable.filter((type) => unlockRule(type).level === 1 && type !== 'protected_rescue' && type !== 'active_armed_incident');
    expect(rows.filter((row) => row.status === 'unfound').map((row) => row.type)).toEqual(levelOne);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(row.status === 'locked' ? ['families', 'label', 'missing', 'settings', 'situationsTotal', 'status', 'type'] : ['families', 'label', 'settings', 'situationsTotal', 'status', 'type']);
    const html = renderToStaticMarkup(createElement(Casebook, { state }));
    expect(html).toContain('Not yet dispatched to your department');
    expect(html).toContain('An officer certified in Vehicle operations');
    expect(html).toContain('Department level 2');
    expect(html).not.toContain('Department level 4');
    expect(html).toContain(`0 of ${dispatchable.length}</strong> kinds of call found`);
    const rescueTitles = scenarioSituationsV10('protected_rescue').map((situation) => hostedCall('protected_rescue', 'harbour_court', situation)!.title);
    for (const title of rescueTitles) expect(html).not.toContain(title);
  });

  it('lists a dispatched recipe with its situation count, best result and building type, and filters rows', () => {
    const state = createInitialState(T0, 3);
    takeDomestic(state);
    const rows = casebookRows(state);
    const domestic = rows.find((row) => row.type === 'domestic')!;
    expect(domestic).toMatchObject({ status: 'found', situationsTotal: 3, buildings: ['two_storey_house_g2'], situations: [{ variant: 1, pacings: [{ variant: 1, characteristic: 'ordinary' }] }] });
    const locked = SCENARIO_TYPES_V11.map((info) => info.type).filter((type) => !RETIRED_FROM_DISPATCH.has(type) && (unlockRule(type).level > 1 || type === 'protected_rescue' || type === 'active_armed_incident'));
    expect(casebookTotals(rows)).toMatchObject({ frameworksFound: 1, situationsFound: 1, locked: locked.length });
    expect(filterRows(rows, { type: 'all', setting: 'businesses', status: 'all' }).every((row) => row.settings.includes('businesses'))).toBe(true);
    expect(filterRows(rows, { type: 'all', setting: 'all', status: 'found' }).map((row) => row.type)).toEqual(['domestic']);
    expect(filterRows(rows, { type: 'all', setting: 'all', status: 'locked' }).map((row) => row.type)).toEqual(locked);
    const html = renderToStaticMarkup(createElement(Casebook, { state }));
    expect(html).toContain('1 of 3');
    expect(html).toContain('2 more situations to find');
  });

  it('keeps a retired framework met earlier as history, outside the totals', () => {
    const state = createInitialState(T0, 3);
    const spec = { ...specForSituationV10('disturbance', 'cedar_close', { variant: 0, characteristic: 'ordinary' }, 9), contentVersion: 11 };
    const id = incidentId(spec);
    state.incidents.unshift({ id, type: 'disturbance', familyId: spec.familyId, tier: spec.tier, arrivedAt: T0, expiresAt: T0 + 3_600_000, seen: true });
    takeIncident(state, id);
    const rows = casebookRows(state);
    expect(rows.find((row) => row.type === 'disturbance')).toMatchObject({ status: 'found' });
    expect(rows.some((row) => row.type === 'water_leak')).toBe(false);
    expect(casebookTotals(rows)).toMatchObject({ frameworks: SCENARIO_TYPES_V11.length - RETIRED_FROM_DISPATCH.size, frameworksFound: 0, situationsFound: 0 });
  });
});
