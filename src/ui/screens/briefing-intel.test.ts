import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildLocation } from '../../sim/location';
import { getScenario } from '../../sim/scenario-registry';
import { makeState, NOW, testCallId } from '../../sim/test-fixtures';
import { buildIntel } from './intel';
import { OpsPrepare } from './OpsPrepare';

const state = makeState();
vi.mock('../store', () => ({ useGame: () => state, send: vi.fn() }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('../blueprint/Blueprint', () => ({ Blueprint: () => createElement('div', null, 'Map preview') }));
const cases = [
  ['active_armed_incident', testCallId('armed')],
  ['hostage_crisis', testCallId('hostage')],
  ['protected_rescue', testCallId('rescue')],
] as const;

describe('public high-risk preparation intel', () => {
  it.each(cases)('%s lists the individually reported civilians at dispatch', (_type, id) => {
    const scenario = getScenario(id)!;
    const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
    const intel = buildIntel(scenario, built);
    expect(intel.people.length).toBeGreaterThan(0);
    expect(intel.people.map(person => person.id)).toEqual(scenario.facts.filter(fact => !!fact.person && ['reported', 'confirmed'].includes(fact.initial)).map(fact => fact.id));
    expect(intel.people.every(person => ['reported', 'confirmed'].includes(person.status))).toBe(true);
    for (const person of intel.people) {
      expect(person.claim).toBe(scenario.facts.find(f => f.id === person.id)!.claim);
      expect(person.where).toBeTruthy();
    }
  });

  it('keeps armed danger reported until checked and names its actual report sources', () => {
    const scenario = getScenario(testCallId('armed'))!;
    const intel = buildIntel(scenario, buildLocation(scenario.locationFamilyId, scenario.locationSeed));
    expect(intel.threats.length).toBeGreaterThan(0);
    for (const threat of intel.threats) {
      const fact = scenario.facts.find(fact => fact.id === threat.id)!;
      expect(threat).toMatchObject({ status: fact.initial, source: fact.source, claim: fact.claim });
    }
    expect(intel.threats.some(threat => threat.label.includes('is confirmed'))).toBe(false);
  });

  it.each(cases)('%s intel does not change when hidden truth changes', (_type, id) => {
    const scenario = getScenario(id)!; const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
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
      // The rebuilt briefing: the threat leads, then who is inside, then the orders.
      const peopleSection = html.slice(html.indexOf('Who’s inside</h3>'), html.indexOf('Your orders</h3>'));
      // A call with a reported weapon leads with it; a rescue with none has no threat section.
      if (html.includes('The threat</h3>')) expect(html.indexOf('The threat</h3>')).toBeLessThan(html.indexOf('Who’s inside</h3>'));
      for (const person of scenario.civilianOutcomes!) expect(peopleSection).toContain(person.label);
      expect(html).not.toContain('Nobody reported');
      expect(html).not.toContain('No weapon reported');
      expect(html).not.toContain('Current armed danger is confirmed');
      expect(scenario.stages.resolve.prompt.length).toBeGreaterThan(0);
    } finally { vi.restoreAllMocks(); }
  });

});
