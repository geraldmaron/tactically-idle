import { describe, expect, it } from 'vitest';
import { INCIDENT_TYPES_V5, incidentId } from '../gen/incident';
import { buildLocation } from './location';
import { actionViews, spaceViews } from './operation-selectors';
import { initializePersonnel } from './personnel';
import { conditionHolds } from './resolution';
import { getScenario } from './scenario-registry';
import { deserialize, serialize } from './save';
import { storyPeoplePublic, storyPropsPublic } from './story-people';
import { apply, makeState, NOW, startRun } from './test-fixtures';

describe('generated story bindings keep every named person on one current map location', () => {
  it('moves Ben and Mara separately after their actual committed release actions', () => {
    const scenario = getScenario(incidentId({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 0, tier: 2, contentVersion: 5 }))!;
    const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
    const base = makeState(); base.saveVersion = 5; base.contentVersion = 5; initializePersonnel(base);
    let state = startRun(base, scenario.id, ['A'], { practice: true, positions: { A: built.location.entries[0] } });
    const decide = (name: string) => {
      const action = actionViews(state, NOW, 'A').find(action => action.id === `v5_sig_${name}`)!;
      expect(action?.eligible, `${name}: ${action?.reason}`).toBe(true);
      const result = apply(state, { type: 'decide', actionId: action.id, actingSquadIds: action.actingSquadIds, supportSquadIds: action.supportSquadIds });
      expect(result.result).toEqual({ ok: true });
      const loaded = deserialize(serialize(result.state, NOW));
      expect(loaded).not.toBeNull();
      expect(spaceViews(loaded!)).toEqual(spaceViews(result.state));
      state = loaded!;
    };
    const location = (personId: string) => {
      const person = scenario.story!.bindings.people[personId];
      const present = spaceViews(state).filter(space => space.people.some(mark => mark.id === `person_${person.locationFactId}`));
      expect(present).toHaveLength(1);
      return present[0].id;
    };
    const inside = scenario.story!.bindings.rooms.scene.spaceId;
    const outside = scenario.story!.bindings.exterior.arrival.spaceId;
    decide('check_patrol');
    expect(location('ben')).toBe(inside); expect(location('mara')).toBe(inside);
    decide('release_ben');
    expect(location('ben')).toBe(outside); expect(location('mara')).toBe(inside); expect(location('lewis')).toBe(inside);
    const releaseHistory = structuredClone(state.activeRun!.history);
    decide('independent_phone'); decide('hear_mara'); decide('record_account');
    if (!actionViews(state, NOW, 'A').find(action => action.id === 'v5_sig_bring_mara_out')?.eligible) decide('clarify_recording');
    decide('bring_mara_out');
    expect(location('ben')).toBe(outside); expect(location('mara')).toBe(outside); expect(location('lewis')).toBe(inside);
    expect(state.activeRun!.history.slice(0, releaseHistory.length)).toEqual(releaseHistory);
  });

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
