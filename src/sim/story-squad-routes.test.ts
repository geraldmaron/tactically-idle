import { describe, expect, it } from 'vitest';
import { COURSES } from '../content/courses';
import { incidentId } from '../gen/incident';
import { buildLocation, LOCATION_TUNING } from './location';
import { initializePersonnel } from './personnel';
import { bandFor, builtFor, evaluateAction, openingFlag } from './resolution';
import { next } from './rng';
import { getScenario } from './scenario-registry';
import { scenarioActions, type ActionDefinition, type ScenarioDefinition } from './scenario-types';
import { deserialize, serialize } from './save';
import { standingOf } from './spatial-factors';
import { apply, makeState, NOW, startRun, withCallOnBoard } from './test-fixtures';
import type { GameState } from './types';

const named = (s: ScenarioDefinition, name: string) => scenarioActions(s).find(action => action.id === `v5_noise_${name}`)!;
function evaluate(scenario: ScenarioDefinition, state: GameState, action: ActionDefinition) {
  const run = state.activeRun!;
  return evaluateAction({ scenario, state, run, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function commit(state: GameState, name: string) {
  const result = apply(state, { type: 'decide', actionId: `v5_noise_${name}`, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result, name).toEqual({ ok: true });
  return result.state;
}
function fixture() {
  const scenario = Array.from({ length: 20 }, (_, seed) => getScenario(incidentId({ type: 'active_armed_incident', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 5 }))!)
    .find(scenario => scenario.facts.find(fact => fact.id === 'v5_noise_f_stand_down')!.truth)!;
  const base = makeState({ inventory: { service_sidearm: 1 } }); base.saveVersion = 5; base.contentVersion = 5; initializePersonnel(base);
  const certs = Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : []);
  for (const officer of Object.values(base.officers)) officer.certs = [...new Set(certs)];
  const initial = startRun(withCallOnBoard(base, scenario.id), scenario.id, ['A'], { positions: { A: buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0] }, loadouts: { A: { service_sidearm: 1 } } });
  // One initial RNG stream keeps this actual journey valid across save/reload.
  for (let seed = 1; seed < 500; seed++) {
    let state = structuredClone(initial); state.activeRun!.rngState = seed;
    let outside: GameState | null = null;
    let failed = false;
    for (const name of ['hear_eli', 'urgent_response', 'check_stand_down', 'reach_eli']) {
      const ev = evaluate(scenario, state, named(scenario, name));
      if (!ev.eligible || bandFor(ev.margin, next(state.activeRun!.rngState).value) !== 'favorable') { failed = true; break; }
      if (name === 'urgent_response') outside = structuredClone(state);
      if (name === 'reach_eli') return { scenario, outside: outside!, inside: state };
      state = commit(state, name);
    }
    if (!failed) break;
  }
  throw new Error('No favorable urgent-response stream');
}

describe('bound squad entry routes start from actual current squad positions', () => {
  it('urgent response followed by reaching Eli charges only the real remaining within-room distance', () => {
    const { scenario, inside } = fixture();
    const action = named(scenario, 'reach_eli');
    expect(action.storyRouteActor).toBe('squad');
    const run = inside.activeRun!;
    const person = scenario.story!.bindings.people.eli;
    expect(run.squadTasks[0].positionId).toBe(person.initial.spaceId);
    const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
    const start = standingOf(built, run.squadTasks[0]).at;
    const expectedTravel = Math.round(Math.hypot(start.x - person.initial.at.x, start.y - person.initial.at.y) / LOCATION_TUNING.feetPerMinute * 10) / 10;
    expect(expectedTravel).toBeGreaterThan(0);
    const ev = evaluate(scenario, inside, action);
    const ordinary = evaluate(scenario, inside, { ...action, storyRoute: undefined, storyRouteActor: undefined });
    expect(ev.travelMinutes).toBe(expectedTravel);
    expect(ev.timeBase).toBe(ordinary.timeBase);
    expect(ev.score).toBe(ordinary.score);
    expect(ev.contributors).toEqual(ordinary.contributors);
    expect(ev.storyMovementMinutes).toBeUndefined();
    expect(ev.action.requires.openings).toEqual([]);
    expect(ev.details.some(text => text.startsWith('The movement route runs from'))).toBe(false);
    const after = commit(inside, 'reach_eli');
    expect(after.activeRun!.history.at(-1)!.timeCost).toBe(ev.timeBase);
    expect(after.activeRun!.squadTasks[0].at).toEqual(person.initial.at);
    expect(deserialize(serialize(after, NOW))!.activeRun).toEqual(after.activeRun);
  });

  it('closed access behind an already-inside squad does not gate the within-room contact, while outside urgent entry still fails', () => {
    const { scenario, outside, inside } = fixture();
    const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
    const scene = scenario.story!.bindings.rooms.scene.spaceId;
    const blocks = built.location.openings.filter(opening => opening.a === scene || opening.b === scene).map(opening => openingFlag(opening.id, 'blocked'));
    outside.activeRun!.flags.push(...blocks);
    const blocked = evaluate(scenario, outside, named(scenario, 'urgent_response'));
    expect(blocked).toMatchObject({ eligible: false, reason: 'There is no usable route for this move', arrivals: [] });
    const refused = apply(outside, { type: 'decide', actionId: 'v5_noise_urgent_response', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(refused.result.ok).toBe(false); expect(refused.state).toBe(outside);
    inside.activeRun!.flags.push(...blocks);
    const reachable = evaluate(scenario, inside, named(scenario, 'reach_eli'));
    expect(reachable.eligible, reachable.reason ?? '').toBe(true);
    expect(reachable.action.requires.openings).toEqual([]);
    expect(reachable.storySquadOpenedIds).toEqual([]);
    const after = commit(inside, 'reach_eli');
    expect(after.activeRun!.history.at(-1)!.timeCost).toBe(reachable.timeBase);
    expect(after.activeRun!.history.at(-1)!.committed!.openingChanges).toBeUndefined();
    expect(deserialize(serialize(after, NOW))!.activeRun).toEqual(after.activeRun);
  });

  it('outside squad entry uses a complete alternative doorway route without windows or an extra person route', () => {
    const { scenario, outside } = fixture();
    outside.activeRun!.flags.push(openingFlag('d_front', 'blocked'), openingFlag('d_side', 'open'), openingFlag('d_delivery', 'blocked'));
    const ev = evaluate(scenario, outside, named(scenario, 'urgent_response'));
    expect(ev.eligible, ev.reason ?? '').toBe(true);
    expect(ev.action.requires.openings!.map(opening => opening.openingId)).toEqual(['p_front_e', 'd_side']);
    expect(ev.storyMovementMinutes).toBeUndefined();
    const map = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
    expect(ev.action.requires.openings!.every(required => map.location.openings.find(opening => opening.id === required.openingId)!.type !== 'window')).toBe(true);
    expect(ev.arrivals[0].spaceId).toBe(scenario.story!.bindings.rooms.scene.spaceId);
  });
});
