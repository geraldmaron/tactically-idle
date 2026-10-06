import { afterEach, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import { buildLocation } from './location';
import { evaluateAction } from './resolution';
import { centroidOf, routeAlongOpenings } from './spatial-factors';
import { publicStoryMovementLegs } from './story-movement-v7';
import { currentStoryRoute } from './story-bindings';
import { makeState, startRun } from './test-fixtures';
import type { ActionDefinition, ScenarioDefinition } from './scenario-types';

const fixtureId = 'test_furnished_person_movement';
const built = buildLocation('juniper_court_v1__furnished_v7', 0);
const inside = { spaceId: 'living', at: centroidOf(built, 'living') };
const outside = { spaceId: 'court', at: { x: 30, y: 29 } };
const chain = ['d_hall_living', 'd_court'];
function fixture() {
  const scenario: ScenarioDefinition = structuredClone(SCENARIOS.ms_occupancy);
  scenario.id = fixtureId; scenario.version = 7;
  scenario.locationFamilyId = 'juniper_court_v1__furnished_v7'; scenario.locationSeed = 0;
  scenario.facts = [{ id: 'where_jun', label: 'Jun', spaceId: 'living', truth: true, initial: 'confirmed', showWhenUnknown: true,
    person: { label: 'Jun', at: inside.at }, markers: { confirmed: 'Jun', reported: 'Jun?' }, source: null, note: null, claim: 'Jun is inside.', uncertainty: 'Check Jun’s position.' }];
  scenario.story = { archetypeId: 'movement_test', version: 3, episodeId: 'test', seed: 0, bindings: {
    rooms: { target: { spaceId: 'living' } }, exterior: { safe: { spaceId: 'court' } }, props: {},
    routes: { exit: { fromSpaceId: 'living', toSpaceId: 'court', openingIds: chain, profile: 'chair' } },
    people: { jun: { id: 'jun', label: 'Jun', locationFactId: 'where_jun', initial: inside,
      transitions: [{ when: { flags: ['jun_outside'] }, to: outside, observed: true },
        { when: { flags: ['secret_move'] }, to: { spaceId: 'bedroom', at: { x: 9, y: 8 } }, observed: false }] } },
  } };
  const action: ActionDefinition = { id: 'move_jun', stage: 'assess', title: 'Move Jun with the chair', summary: 'Move to the checked point',
    task: 'Move Jun', icon: 'door', targetId: 'living', storyRoute: 'exit', storyRouteActor: 'person', requires: {}, approach: 'none',
    check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 1 }], difficulty: 10 }, workload: { base: 1, perSqFt: 0 }, stressBase: 0,
    outcomes: { favorable: [{ setFlags: ['jun_outside'] }], mixed: [{ setFlags: ['jun_outside'] }], adverse: [] } };
  scenario.stages.assess.actions = [action];
  const state = structuredClone(startRun(makeState(), 'ms_occupancy', ['A']));
  const run = state.activeRun!;
  run.scenarioId = fixtureId; run.scenarioVersion = 7; run.contentVersion = 7;
  run.locationFamilyId = scenario.locationFamilyId; run.locationSeed = 0;
  run.knowledge = { where_jun: 'confirmed' }; run.flags = [];
  run.squadTasks = run.squadTasks.map(task => ({ ...task, positionId: 'front_yard', at: centroidOf(built, 'front_yard'), stagingId: null }));
  SCENARIOS[fixtureId] = scenario;
  return { scenario, state, run, action };
}
afterEach(() => { delete SCENARIOS[fixtureId]; });

describe('public version-seven movement endpoints', () => {
  it('routes Jun to the same safe chair anchor shown after the move, not the tree-obstructed courtyard centroid', () => {
    const { scenario, state, run, action } = fixture();
    expect(routeAlongOpenings(built, inside.at, centroidOf(built, 'court'), chain, null, false, 1.5).reachable).toBe(false);
    const legs = publicStoryMovementLegs(scenario, built, run, action)!;
    expect(legs).toEqual([{ personId: 'jun', label: 'Jun', from: inside.at, to: outside.at }]);
    const route = routeAlongOpenings(built, legs[0].from, legs[0].to, currentStoryRoute(scenario, built, 'exit')!, null, false, 1.5);
    expect(route.reachable).toBe(true);
    const evaluated = evaluateAction({ scenario, state, run, action, built, acting: ['A'], support: [] });
    expect(evaluated.eligible, evaluated.reason ?? '').toBe(true);
    const overlay = evaluated.overlays.find(o => o.kind === 'path' && o.label?.startsWith('Jun movement'));
    expect(overlay?.kind === 'path' ? overlay.points : null).toEqual(route.points);
    expect(evaluated.travelMinutes).toBe(route.minutes);
  });

  it('matches the action’s committed movement flags and can move two people independently', () => {
    const { scenario, run, action } = fixture();
    scenario.story!.bindings.people.ben = { id: 'ben', label: 'Ben', locationFactId: 'where_ben', initial: { ...inside, at: { x: inside.at.x, y: inside.at.y + 2 } },
      transitions: [{ when: { flags: ['ben_outside'] }, to: { ...outside, at: { x: 30, y: 31 } }, observed: true }] };
    run.knowledge.where_ben = 'confirmed';
    expect(publicStoryMovementLegs(scenario, built, run, action)!.map(leg => leg.personId)).toEqual(['jun']);
    action.outcomes.favorable.push({ setFlags: ['ben_outside'] });
    expect(publicStoryMovementLegs(scenario, built, run, action)!.map(leg => leg.personId)).toEqual(['jun', 'ben']);
    action.outcomes = { favorable: [{ setFlags: ['ben_outside'] }], mixed: [], adverse: [] };
    expect(publicStoryMovementLegs(scenario, built, run, action)!.map(leg => leg.personId)).toEqual(['ben']);
  });

  it('does not disclose hidden movement or invent endpoints for an unknown person', () => {
    const { scenario, run, action } = fixture();
    const known = publicStoryMovementLegs(scenario, built, run, action);
    run.flags.push('secret_move');
    expect(publicStoryMovementLegs(scenario, built, run, action)).toEqual(known);
    action.outcomes = { favorable: [{ setFlags: ['secret_move'] }], mixed: [], adverse: [] };
    expect(publicStoryMovementLegs(scenario, built, run, action)).toBeNull();
    action.outcomes.favorable = [{ setFlags: ['jun_outside'] }];
    run.knowledge.where_jun = 'unknown';
    expect(publicStoryMovementLegs(scenario, built, run, action)).toBeNull();
  });

  it('uses the explicit public care target for an arriving crew and leaves legacy endpoint semantics alone', () => {
    const { scenario, run, action } = fixture();
    action.storyRouteActor = 'external_support'; action.storyTargetPersonId = 'jun'; action.storyRoute = 'entry';
    scenario.story!.bindings.routes.entry = { fromSpaceId: 'front_yard', toSpaceId: 'living', openingIds: ['d_front'], profile: 'walking' };
    expect(publicStoryMovementLegs(scenario, built, run, action)?.[0].to).toEqual(inside.at);
    scenario.version = 6;
    expect(publicStoryMovementLegs(scenario, built, run, action)).toBeNull();
  });
});
