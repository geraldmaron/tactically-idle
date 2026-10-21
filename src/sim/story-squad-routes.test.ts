import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { drawCalls, playCalls, type PlayStep } from '../gen/incident/trees-v13/balance';
import { builtFor, evaluateAction, openingFlag } from './resolution';
import { getScenario } from './scenario-registry';
import { scenarioActions } from './scenario-types';
import { deserialize, serialize } from './save';
import { callsOfKind, NOW } from './test-fixtures';
import { ARMED_TEMPLATE } from '../gen/incident/trees-v13/armed-fixture';
import { standingOf } from './spatial-factors';

const steps: PlayStep[] = [];
for (const tree of Object.values(CALL_TREES)) playCalls(tree!, 'random', drawCalls(tree!, 2, 8), (_result, path) => steps.push(...path));
// The frozen armed call moves the team into the building on most paths.
playCalls(ARMED_TEMPLATE.tree, 'random', callsOfKind('active_armed_incident', 4, 4242).map((call, i) => ({ scenarioId: call.id, seed: i + 1 })), (_result, path) => steps.push(...path));
const movements = steps.filter(step => scenarioActions(getScenario(step.before.activeRun!.scenarioId)!).find(a => a.id === step.choice.id)?.approach === 'path');

describe('squad movement on current call trees', () => {
  it('records actual arrivals and retains positions, costs and RNG after reload', () => {
    expect(movements.length).toBeGreaterThan(0);
    for (const { before, after, choice } of movements) {
      expect(after.activeRun!.clock).toBeGreaterThan(before.activeRun!.clock);
      expect(after.activeRun!.history.at(-1)!.targetId).toBe(choice.targetId);
      for (const squadId of choice.actingSquadIds) expect(standingOf(builtFor(after.activeRun!.locationFamilyId, after.activeRun!.locationSeed, after.activeRun!.flags), after.activeRun!.squadTasks.find(task => task.squadId === squadId)!)).not.toBeNull();
      expect(deserialize(serialize(after, NOW))?.activeRun).toEqual(after.activeRun);
    }
  });

  it('does not charge exterior ingress again when a squad is already at the target', () => {
    const step = movements[0];
    const state = structuredClone(step.before), run = state.activeRun!;
    const scenario = getScenario(run.scenarioId)!;
    const authored = scenarioActions(scenario).find(a => a.id === step.choice.id)!;
    // Isolate squad travel from the person's separate outbound leg.
    const action = { ...authored, storyRoute: undefined, spatial: undefined };
    const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
    const evaluate = () => evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: step.choice.actingSquadIds, support: [] });
    const outside = evaluate();
    expect(outside.eligible).toBe(true);
    for (const arrival of outside.arrivals.filter(a => a.role === 'acting')) {
      const task = run.squadTasks.find(t => t.squadId === arrival.squadId)!;
      Object.assign(task, { positionId: arrival.spaceId, at: arrival.at, stagingId: arrival.stagingId });
    }
    const inside = evaluate();
    expect(inside.eligible).toBe(true);
    expect(inside.travelMinutes).toBeLessThanOrEqual(outside.travelMinutes);
    for (const opening of built.location.openings.filter(o => o.a !== action.targetId && o.b !== action.targetId)) run.flags.push(openingFlag(opening.id, 'blocked'));
    expect(evaluate().travelMinutes).toBe(inside.travelMinutes);
  });
});
