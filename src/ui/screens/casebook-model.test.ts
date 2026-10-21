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
import { CALL_TREES } from '../../content/call-trees';

/** The first building seed from 7 whose generated call stays on the chosen building type. */
function hostedCall(type: IncidentType, familyId: string, situation: ScenarioSituation) {
  for (let seed = 7; seed < 23; seed++) {
    const scenario = getScenario(incidentId(specForSituation(type, familyId, situation, seed)));
    if (scenario && baseFamilyId(scenario.locationFamilyId) === familyId) return scenario;
  }
  return null;
}

describe('casebook situations on v10 recipes', () => {
  it('offers two pacings of each of the call\'s situations and finds each through the public generator', () => {
    for (const info of SCENARIO_TYPES) {
      const situations = scenarioSituations(info.type);
      expect(situations, info.type).toHaveLength(2 * CALL_TREES[info.type]!.situations.length);
      for (const situation of situations) {
        const spec = specForSituation(info.type, info.families.at(-1)!, situation, 11);
        expect(spec.contentVersion).toBe(13);
        expect(scenarioRecipe(spec)).toMatchObject(situation);
      }
    }
  });

  it('reports the floors of the building actually used', () => {
    const situation = scenarioSituations('hostage_crisis')[0];
    // The corner store has the flat upstairs; the others are one floor.
    expect(scenarioFloorCount(hostedCall('hostage_crisis', 'corner_store_flat_g2', situation))).toBe(2);
    expect(scenarioFloorCount(hostedCall('hostage_crisis', 'market_row', situation))).toBe(1);
  });
});

describe('casebook rows', () => {
  const T0 = Date.UTC(2026, 9, 6, 15, 0, 0);
  const TOTAL = CALL_TREES.hostage_crisis!.situations.length;
  const takeHostage = (state: ReturnType<typeof createInitialState>) => {
    const spec = { ...specForSituation('hostage_crisis', 'market_row', { variant: 1, characteristic: 'ordinary' }, 9), contentVersion: 13 };
    const id = incidentId(spec);
    state.incidents.unshift({ id, type: 'hostage_crisis', familyId: spec.familyId, tier: spec.tier, arrivedAt: T0, expiresAt: T0 + 3_600_000, seen: true });
    takeIncident(state, id);
    return id;
  };

  // With one curated call there is no locked framework to show; the lock row is covered again when
  // a call needs a certification (backlog next-curated-calls).
  it('shows undiscovered frameworks as counts, never content', () => {
    const state = createInitialState(T0, 3);
    const rows = casebookRows(state);
    const dispatchable = SCENARIO_TYPES.map((info) => info.type);
    expect(rows.map((row) => row.type)).toEqual(dispatchable);
    expect(rows.filter((row) => row.status === 'unfound').map((row) => row.type)).toEqual(dispatchable.filter((type) => unlockRule(type).level === 1));
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(row.status === 'locked' ? ['families', 'label', 'missing', 'settings', 'situationsTotal', 'status', 'type'] : ['families', 'label', 'settings', 'situationsTotal', 'status', 'type']);
    const html = renderToStaticMarkup(createElement(Casebook, { state }));
    expect(html).not.toContain('Department level');
    expect(html).toContain(`0 of ${dispatchable.length}</strong> kinds of call found`);
    const titles = scenarioSituations('hostage_crisis').map((situation) => hostedCall('hostage_crisis', 'market_row', situation)?.title).filter(Boolean);
    for (const title of titles) expect(html).not.toContain(title!);
  });

  it('lists a dispatched recipe with its situation count, best result and building type, and filters rows', () => {
    const state = createInitialState(T0, 3);
    takeHostage(state);
    const rows = casebookRows(state);
    const hostage = rows.find((row) => row.type === 'hostage_crisis')!;
    expect(hostage).toMatchObject({ status: 'found', situationsTotal: TOTAL, buildings: ['market_row'], situations: [{ variant: 1, pacings: [{ variant: 1, characteristic: 'ordinary' }] }] });
    expect(casebookTotals(rows)).toMatchObject({ frameworksFound: 1, situationsFound: 1, locked: 0 });
    expect(filterRows(rows, { type: 'all', setting: 'businesses', status: 'all' }).every((row) => row.settings.includes('businesses'))).toBe(true);
    expect(filterRows(rows, { type: 'all', setting: 'all', status: 'found' }).map((row) => row.type)).toEqual(['hostage_crisis']);
    expect(filterRows(rows, { type: 'all', setting: 'all', status: 'locked' })).toEqual([]);
    const html = renderToStaticMarkup(createElement(Casebook, { state }));
    expect(html).toContain(`1 of ${TOTAL}`);
    expect(html).toContain(TOTAL - 1 === 1 ? '1 more situation to find' : `${TOTAL - 1} more situations to find`);
  });
});
