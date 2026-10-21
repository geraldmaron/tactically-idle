import { decisionsOf } from './types';
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { drawCalls, playCalls, type PlayStep } from '../gen/incident/trees-v13/balance';
import { applyMove } from '../gen/incident/gates/engine-driver';
import { builtFor, evaluateAction, openingFlag } from './resolution';
import { getScenario } from './scenario-registry';
import { scenarioActions } from './scenario-types';
import { currentStoryRoute } from '../gen/incident/story-bindings';
import { deserialize, serialize } from './save';
import { NOW } from './test-fixtures';

const steps: PlayStep[] = [];
for (const tree of Object.values(CALL_TREES)) playCalls(tree!, 'random', drawCalls(tree!, 2, 6), (_result, path) => steps.push(...path));
const movements = steps.filter(step => scenarioActions(getScenario(step.before.activeRun!.scenarioId)!).find(a => a.id === step.choice.id)?.storyRoute);

describe('current call-tree movement routes', () => {
  it('opens traversed locks on a committed move and preserves the exact run on reload', () => {
    let checked = 0;
    for (const step of movements) {
      const state = structuredClone(step.before), run = state.activeRun!;
      const scenario = getScenario(run.scenarioId)!;
      const action = scenarioActions(scenario).find(a => a.id === step.choice.id)!;
      const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
      const route = currentStoryRoute(scenario, built, action.storyRoute!);
      const door = route?.find(id => built.location.openings.find(o => o.id === id)?.type === 'door');
      if (!door) continue;
      run.flags.push(openingFlag(door, 'locked'));
      const ev = evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: step.choice.actingSquadIds, support: step.choice.supportSquadIds });
      if (!ev.eligible) continue;
      const after = applyMove(state, { kind: 'decide', actionId: action.id, band: 'favorable' });
      if (!after || !decisionsOf(after.activeRun!.history).at(-1)!.committed?.openingChanges?.some(change => change.openingId === door && change.state === 'open')) continue;
      expect(builtFor(run.locationFamilyId, run.locationSeed, after.activeRun!.flags).location.openings.find(o => o.id === door)!.state).toBe('open');
      // The hypothetical lock is not part of the issued path. Check the actual played run's persistence.
      expect(deserialize(serialize(step.after, NOW))?.activeRun).toEqual(step.after.activeRun);
      expect(state.activeRun!.flags).toContain(openingFlag(door, 'locked'));
      checked++;
      break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('replans around a blocked opening or refuses the move without changing the run', () => {
    let checked = 0;
    for (const step of movements) {
      const state = structuredClone(step.before), run = state.activeRun!;
      const scenario = getScenario(run.scenarioId)!, action = scenarioActions(scenario).find(a => a.id === step.choice.id)!;
      const route = currentStoryRoute(scenario, builtFor(run.locationFamilyId, run.locationSeed, run.flags), action.storyRoute!);
      if (!route?.length) continue;
      run.flags.push(openingFlag(route[0], 'blocked'));
      const before = structuredClone(state);
      const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
      const alternate = currentStoryRoute(scenario, built, action.storyRoute!);
      if (alternate) expect(alternate).not.toContain(route[0]);
      else {
        const ev = evaluateAction({ state, run, scenario, action, built, acting: step.choice.actingSquadIds, support: step.choice.supportSquadIds });
        expect(ev.eligible).toBe(false);
      }
      expect(state).toEqual(before);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
