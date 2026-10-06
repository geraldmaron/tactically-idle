import { afterEach, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import { buildLocation } from './location';
import { builtFor, evaluateAction, openingFlag } from './resolution';
import { centroidOf, routeAlongOpenings } from './spatial-factors';
import { publicStoryMovementLegs } from './story-movement-v7';
import { currentStoryRoute } from './story-bindings';
import { apply, makeState, startRun } from './test-fixtures';
import { storyPeoplePublic } from './story-people';
import type { ActionDefinition, ScenarioDefinition } from './scenario-types';
import { scenarioActions } from './scenario-types';
import { generateIncident, INCIDENT_TYPES_V5 } from '../gen/incident';

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

  it('inspects the planned chair route without moving the person, forcing doors or charging movement time', () => {
    const { scenario, state, run, action } = fixture();
    action.storyRouteActor = 'inspection';
    action.storyRouteInspection = { personId: 'jun', arrivalFlag: 'jun_outside' };
    action.workload.base = 5;
    action.outcomes = { favorable: [{ setFlags: ['route_checked'] }], mixed: [{ setFlags: ['route_checked'] }], adverse: [{ setFlags: ['route_checked'] }] };
    // Another observed arrival in the same zone must not replace the named plan.
    scenario.story!.bindings.people.jun.transitions.push({ when: { flags: ['jun_safe'] }, to: { spaceId: 'court', at: { x: 30, y: 38 } }, observed: true });
    run.flags.push(...built.location.openings.filter(o => o.type === 'door').map(o => openingFlag(o.id, 'locked')));
    const locked = builtFor(scenario.locationFamilyId, scenario.locationSeed, run.flags);
    const before = storyPeoplePublic(scenario, locked, run);
    const evaluation = evaluateAction({ scenario, state, run, action, built: locked, acting: ['A'], support: [] });
    const withoutInspection = { ...action }; delete withoutInspection.storyRoute; delete withoutInspection.storyRouteInspection;
    const ordinary = evaluateAction({ scenario, state, run, action: withoutInspection, built: locked, acting: ['A'], support: [] });
    expect(evaluation.eligible, evaluation.reason ?? '').toBe(true);
    expect(evaluation.timeBase).toBe(ordinary.timeBase);
    expect(evaluation.travelMinutes).toBe(ordinary.travelMinutes);
    expect(evaluation.uses).toEqual(ordinary.uses);
    expect(evaluation.storyMovementMinutes).toBeUndefined();
    expect(evaluation.storyOpenedIds).toBeUndefined();
    expect(evaluation.overlays).toContainEqual(expect.objectContaining({ kind: 'path', label: 'Jun: planned chair route', points: expect.arrayContaining([outside.at]) }));
    const result = apply(state, { type: 'decide', actionId: action.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(result.result).toEqual({ ok: true });
    expect(result.state.activeRun!.flags).toContain('route_checked');
    expect(result.state.activeRun!.flags).not.toContain('jun_outside');
    expect(result.state.activeRun!.history.at(-1)!.committed?.openingChanges ?? []).toEqual([]);
    expect(storyPeoplePublic(scenario, locked, result.state.activeRun!)).toEqual(before);
    for (const opening of locked.location.openings.filter(o => o.type === 'door')) expect(result.state.activeRun!.flags).toContain(openingFlag(opening.id, 'locked'));
  });

  it('inspection refuses hidden destinations and the same physical clearance failures as a real chair move', () => {
    const { scenario, state, run, action } = fixture();
    action.storyRouteActor = 'inspection'; action.storyRouteInspection = { personId: 'jun', arrivalFlag: 'jun_outside' };
    action.outcomes = { favorable: [{ setFlags: ['route_checked'] }], mixed: [], adverse: [] };
    scenario.story!.bindings.people.jun.transitions[0].to = { spaceId: 'court', at: centroidOf(built, 'court') };
    const evaluation = evaluateAction({ scenario, state, run, action, built, acting: ['A'], support: [] });
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.reason).toContain('clear space for the chair');
    scenario.story!.bindings.people.jun.transitions[0].observed = false;
    expect(publicStoryMovementLegs(scenario, built, run, action)).toBeNull();
  });

  it('resolves authored person-movement actions to public story destinations in new episodes', () => {
    for (const info of INCIDENT_TYPES_V5) for (const familyId of info.families) for (const seed of [0, 1, 7, 42, 127]) {
      const scenario = generateIncident({ type: info.type, familyId, buildingSeed: seed, seed, tier: 2, contentVersion: 7 });
      const location = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
      for (const action of scenarioActions(scenario).filter(a => a.storyRoute && a.storyRouteActor === 'person')) {
        const run = { knowledge: Object.fromEntries(scenario.facts.map(f => [f.id, 'confirmed' as const])),
          flags: [...new Set([...(action.visibleWhen?.flags ?? []), ...(action.requires.flags ?? []).map(f => f.flag)])], pressure: 20 };
        const legs = publicStoryMovementLegs(scenario, location, run, action);
        expect(legs, `${familyId}:${seed}:${action.id}`).not.toBeNull();
        const route = currentStoryRoute(scenario, location, action.storyRoute!);
        if (route) for (const leg of legs ?? []) {
          const clearance = scenario.story!.bindings.routes[action.storyRoute!].profile === 'chair' ? 1.5 : 1;
          expect(routeAlongOpenings(location, leg.from, leg.to, route, null, false, clearance).reachable,
            `${familyId}:${seed}:${action.id}:${leg.personId} physical route`).toBe(true);
        }
      }
    }
  }, 30_000);
});
