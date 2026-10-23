import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildLocation } from '../../sim/location';
import { getScenario } from '../../sim/scenario-registry';
import { briefing } from '../../sim/operation-selectors';
import { testCallId } from '../../sim/test-fixtures';
import { buildLexicon, lexiconFor } from '../people/lexicon';
import { PeopleProvider } from '../people/PeopleText';
import { buildIntel } from './intel';
import { orderPerson, PrepBriefing } from './PrepBriefing';

// A face on an order is the data's own link: the objective's id is the id of the person it is about
// (ObjectiveDefinition has no person field; the content names the objective after the cast member).
const lexicon = buildLexicon({
  cast: { clerk: { firstName: 'Reuben', surname: 'Hale' }, rider: { firstName: 'Malik', surname: 'Webb' }, manager: { firstName: 'Beatriz', surname: 'Ortiz' } },
  publicKind: { clerk: 'civilian', rider: 'subject', manager: 'civilian' },
  withheld: new Set(), located: new Set(['rider', 'manager']), officers: [], places: [],
});

describe('a face on an order', () => {
  it('names the person the objective is about when the team has them located', () => {
    expect(orderPerson({ id: 'rider', label: 'Bring Malik out alive' }, lexicon)?.id).toBe('rider');
    expect(orderPerson({ id: 'manager', label: 'Get Beatriz out' }, lexicon)?.kind).toBe('civilian');
  });
  it('never takes the name found in the text when the objective is about someone else', () => {
    // Reuben is not located, so his name is not a person segment; Malik is, but the order is not his.
    expect(orderPerson({ id: 'clerk', label: 'Get Reuben out before Malik moves' }, lexicon)).toBeNull();
    expect(orderPerson({ id: 'manager', label: 'Get Reuben out before Malik moves' }, lexicon)).toBeNull();
  });
  it('gives no face to an order that is not about a person, or to someone not located', () => {
    expect(orderPerson({ id: 'shooting', label: 'Stop the shooting' }, lexicon)).toBeNull();
    expect(orderPerson({ id: 'clerk', label: 'Get Reuben out' }, lexicon)).toBeNull();
    expect(orderPerson({ id: 'rider', label: 'Bring Malik out alive' }, null)).toBeNull();
  });
  it('holds for every order of the registered calls: a person objective names its person', () => {
    for (const kind of ['armed', 'hostage', 'rescue'] as const) {
      const scenario = getScenario(testCallId(kind))!;
      const real = lexiconFor(scenario, null, []);
      const cast = new Set(Object.keys(scenario.story?.cast ?? {}));
      for (const objective of scenario.objectives) {
        const entry = orderPerson(objective, real);
        // An objective whose id is a cast member and who is located must resolve; a located person never
        // resolves from an objective that does not name them.
        if (real.entries.some((e) => e.id === objective.id)) expect(entry?.id, `${kind} ${objective.id}`).toBe(objective.id);
        else expect(entry, `${kind} ${objective.id}`).toBeNull();
        if (entry) expect(cast.has(entry.id)).toBe(true);
      }
    }
  });
  it('renders a face and the order number on each person order, and a number well on the others', () => {
    const scenario = getScenario(testCallId('hostage'))!;
    const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
    const page = createElement(PrepBriefing, { scenario, built, brief: briefing(scenario.id), intel: buildIntel(scenario, built) });
    const html = renderToStaticMarkup(createElement(PeopleProvider, { lexicon: lexiconFor(scenario, null, []), children: page }));
    const orders = html.slice(html.indexOf('pb-orders'), html.indexOf('What the team faces'));
    expect((orders.match(/class="pb-lead"/g) ?? []).length).toBe(scenario.objectives.filter((o) => orderPerson(o, lexiconFor(scenario, null, []))).length);
    expect((orders.match(/class="pb-n"/g) ?? []).length + (orders.match(/pb-well-n/g) ?? []).length).toBe(scenario.objectives.length);
  });
});
