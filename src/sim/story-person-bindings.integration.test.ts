import { describe, expect, it } from 'vitest';
import { INCIDENT_TYPES_V5, incidentId } from '../gen/incident';
import { buildLocation } from './location';
import { spaceViews } from './operation-selectors';
import { initializePersonnel } from './personnel';
import { conditionHolds } from './resolution';
import { getScenario } from './scenario-registry';
import { deserialize, serialize } from './save';
import { storyPeoplePublic, storyPropsPublic } from './story-people';
import { makeState, NOW, startRun } from './test-fixtures';

describe('generated story bindings keep every named person on one current map location', () => {
  it.each(INCIDENT_TYPES_V5)('$type projects its authored observed moves and survives reload', info => {
    for (const seed of [0, 7, 42]) {
      const familyId = info.families[seed % info.families.length];
      const scenario = getScenario(incidentId({ type: info.type, familyId, buildingSeed: 7, seed, tier: 2, contentVersion: 5 }))!;
      expect(scenario?.story, `${info.type}:${seed} has no archetype bindings`).toBeDefined();
      const built = buildLocation(familyId, 7);
      const base = makeState(); base.saveVersion = 5; base.contentVersion = 5; initializePersonnel(base);
      const started = startRun(base, scenario.id, ['A'], { practice: true, positions: { A: built.location.entries[0] } });
      const people = Object.values(scenario.story!.bindings.people);
      expect(people.length).toBeGreaterThan(0);
      for (const person of people) for (const transition of person.transitions.filter(transition => transition.observed)) {
        const state = structuredClone(started);
        const run = state.activeRun!;
        run.flags = [...transition.when.flags ?? []];
        for (const fact of transition.when.facts ?? []) run.knowledge[fact.factId] = fact.in[0];
        if (transition.when.pressureAtLeast !== undefined) run.pressure = transition.when.pressureAtLeast;
        if (transition.when.pressureBelow !== undefined) run.pressure = Math.min(run.pressure, transition.when.pressureBelow - 0.1);
        expect(conditionHolds(transition.when, run)).toBe(true);
        const expected = person.transitions.filter(candidate => candidate.observed && conditionHolds(candidate.when, run)).at(-1)!.to;
        const spaces = spaceViews(state);
        const marks = spaces.flatMap(space => space.people.map(mark => ({ spaceId: space.id, mark })));
        expect(new Set(marks.map(entry => entry.mark.id)).size, `${scenario.id}: duplicate person marker`).toBe(marks.length);
        const current = marks.filter(entry => entry.mark.id === `person_${person.locationFactId}`);
        if ('kind' in expected) {
          expect(current).toEqual([]);
          expect(spaces.flatMap(space => space.facts).some(fact => fact.id === person.locationFactId)).toBe(false);
        } else {
          expect(current, `${scenario.id}:${person.id}`).toHaveLength(1);
          expect(current[0]).toMatchObject({ spaceId: expected.spaceId, mark: { at: expected.at, status: 'confirmed' } });
          expect(spaces.filter(space => space.facts.some(fact => fact.id === person.locationFactId)).map(space => space.id)).toEqual([expected.spaceId]);
          if (person.initial.spaceId !== expected.spaceId) expect(spaces.find(space => space.id === person.initial.spaceId)!.facts.some(fact => fact.id === person.locationFactId)).toBe(false);
        }
        const publicPeople = storyPeoplePublic(scenario, built, run);
        for (const prop of storyPropsPublic(scenario, built, run).filter(prop => prop.holderPersonId)) {
          expect(prop.position).toEqual(publicPeople.find(person => person.id === prop.holderPersonId)!.position);
        }
        const loaded = deserialize(serialize(state, NOW));
        expect(loaded, `${scenario.id}:${person.id}: reload`).not.toBeNull();
        expect(spaceViews(loaded!)).toEqual(spaces);
        expect(loaded!.activeRun!.rngState).toBe(run.rngState);
        expect(loaded!.activeRun!.history).toEqual(run.history);
      }
    }
  });
});
