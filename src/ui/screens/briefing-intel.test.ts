import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { generateIncident } from '../../gen/incident';
import { buildLocation } from '../../sim/location';
import { getScenario } from '../../sim/scenario-registry';
import type { IncidentSpec } from '../../sim/scenario-types';
import { makeState, NOW, testCallId } from '../../sim/test-fixtures';
import { buildIntel } from './intel';
import { OpsPrepare } from './OpsPrepare';

const state = makeState();
vi.mock('../store', () => ({ useGame: () => state, send: vi.fn() }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('../blueprint/Blueprint', () => ({ Blueprint: () => createElement('div', null, 'Map preview') }));
const spec = (type: IncidentSpec['type'], seed = 7, contentVersion = 4): IncidentSpec => ({ type, familyId: 'cedar_close', buildingSeed: 7, seed, tier: 2, contentVersion });

const cases = [
  ['active_armed_incident', testCallId('activeArmedV4'), ['f_resident']],
  ['hostage_crisis', testCallId('hostageV4'), ['f_first_person', 'f_second_person']],
  ['protected_rescue', testCallId('protectedRescueV4'), ['f_resident']],
] as const;

describe('public high-risk preparation intel', () => {
  it.each(cases)('%s lists the individually reported civilians at dispatch', (type, _id, ids) => {
    const scenario = generateIncident(spec(type));
    const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
    const intel = buildIntel(scenario, built);
    expect(intel.people.map(person => person.id)).toEqual(ids);
    expect(intel.people.every(person => person.status === 'reported')).toBe(true);
    for (const person of intel.people) {
      expect(person.claim).toBe(scenario.facts.find(f => f.id === person.id)!.claim);
      expect(person.where).toBeTruthy();
    }
    expect(scenario.people).toEqual([]);
  });

  it('keeps armed danger reported until checked and names its actual report sources', () => {
    const scenario = generateIncident(spec('active_armed_incident'));
    const intel = buildIntel(scenario, buildLocation(scenario.locationFamilyId, scenario.locationSeed));
    expect(intel.threats.find(threat => threat.id === 'f_active_danger')).toMatchObject({
      label: 'Current armed danger', status: 'reported', source: 'Responding patrol and caller', claim: 'Patrol and a caller report current gunfire.',
    });
    expect(intel.threats.some(threat => threat.label.includes('is confirmed'))).toBe(false);
  });

  it.each(cases)('%s intel does not change when hidden truth changes', (type) => {
    const scenario = generateIncident(spec(type)); const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
    const expected = buildIntel(scenario, built);
    const altered = structuredClone(scenario);
    for (const fact of altered.facts) { fact.truth = !fact.truth; if (fact.person) fact.person.at = { x: -999, y: 999 }; }
    expect(buildIntel(altered, built)).toEqual(expected);
    const hiddenPerson = altered.facts.find(fact => fact.id === altered.civilianOutcomes![0].factId)!;
    hiddenPerson.initial = 'unknown';
    expect(buildIntel(altered, built).people.some(person => person.id === hiddenPerson.id)).toBe(false);
  });

  it.each(cases)('%s renders consistent People and Threat sections without requiring care for everyone', (_type, id) => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      const scenario = getScenario(id)!;
      const html = renderToStaticMarkup(createElement(OpsPrepare, { scenarioId: id, onCancel: () => {} }));
      const peopleSection = html.slice(html.indexOf('People</h3>'), html.indexOf('Threat information</h3>'));
      for (const person of scenario.civilianOutcomes!) expect(peopleSection).toContain(person.label);
      expect(html).not.toContain('Nobody reported');
      expect(html).not.toContain('No weapon reported');
      expect(html).not.toContain('Current armed danger is confirmed');
      expect(scenario.stages.resolve.prompt).toBe('Check that everyone is safe and arrange any care they need.');
    } finally { vi.restoreAllMocks(); }
  });

  it('preserves legacy People classification and empty-section wording', () => {
    const scenario = generateIncident(spec('barricaded', 7, 3));
    const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
    const expected = buildIntel(scenario, built);
    const extraMetadata = structuredClone(scenario);
    extraMetadata.civilianOutcomes = [{ id: 'fake', label: 'Should not appear', factId: 'f_adjacent_safety', safeFlag: 'safe', injuredFlag: 'hurt', careFlag: 'care' }];
    expect(buildIntel(extraMetadata, built)).toEqual(expected);
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      const html = renderToStaticMarkup(createElement(OpsPrepare, { scenarioId: 'ms_occupancy', onCancel: () => {} }));
      expect(html).toContain('No weapon reported. That does not mean none is present.');
    } finally { vi.restoreAllMocks(); }
  });
});
