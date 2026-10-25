import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildLocation } from '../../sim/location';
import { getScenario } from '../../sim/scenario-registry';
import { briefing } from '../../sim/operation-selectors';
import { testCallId } from '../../sim/test-fixtures';
import { lexiconFor } from '../people/lexicon';
import { PeopleProvider } from '../people/PeopleText';
import { buildIntel } from './intel';
import { PrepBriefing } from './PrepBriefing';

// The orders ride on the people they are about (owner 2026-10-24): an objective's id is the id of the
// person it is about (ObjectiveDefinition has no person field; the content names the objective after
// the cast member), so the brief is one list of who is inside and what the team owes each of them.
function render(kind: 'armed' | 'hostage' | 'rescue', lexicon: ReturnType<typeof lexiconFor> | null) {
  const scenario = getScenario(testCallId(kind))!;
  const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
  const page = createElement(PrepBriefing, { scenario, built, brief: briefing(scenario.id), intel: buildIntel(scenario, built), fee: 1600 });
  const html = renderToStaticMarkup(createElement(PeopleProvider, { lexicon, children: page }));
  const start = html.indexOf('id="pb-people-h"');
  return { scenario, html, people: start < 0 ? '' : html.slice(start) };
}

describe('the orders and the people are one list', () => {
  it('has no separate orders panel', () => {
    for (const kind of ['armed', 'hostage', 'rescue'] as const) {
      const { html } = render(kind, lexiconFor(getScenario(testCallId(kind))!, null, []));
      expect(html, kind).not.toContain('Your orders');
      expect(html, kind).not.toContain('pb-orders');
    }
  });
  it('numbers every order once, on the person it is about or in a well when it names nobody listed', () => {
    for (const kind of ['armed', 'hostage', 'rescue'] as const) {
      const scenario = getScenario(testCallId(kind))!;
      const { people } = render(kind, lexiconFor(scenario, null, []));
      const numbered = (people.match(/class="pb-n"/g) ?? []).length + (people.match(/pb-well-n/g) ?? []).length;
      expect(numbered, kind).toBe(scenario.objectives.length);
    }
  });
  it('puts an order that names a listed person on that person’s row, with the order leading the name', () => {
    const { scenario, people } = render('hostage', lexiconFor(getScenario(testCallId('hostage'))!, null, []));
    const first = scenario.objectives[0];
    const row = people.slice(people.indexOf('pb-person-order'));
    expect(people).toContain('pb-person-order');
    expect(row.indexOf('<strong>')).toBeGreaterThan(0);
    expect(people).toContain(first.label.split(' ')[0]);
  });
  it('shows the plain person on a numbered face when the provider has names off', () => {
    const { people } = render('hostage', null);
    expect(people).toContain('pb-lead');
    expect(people).not.toContain('face-civilian');
    expect(people).not.toContain('face-subject');
  });
});
