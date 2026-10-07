import { describe, expect, it } from 'vitest';
import { COURSES } from '../content/courses';
import { ITEMS } from '../content/items';
import { computeDebrief } from './operation';
import { actionViews } from './operation-selectors';
import { getScenario } from './scenario-registry';
import { buildLocation } from './location';
import { apply, makeState, makeUnit, NOW, startCmd, stockKit, testCallId, withCallOnBoard } from './test-fixtures';
import type { GameState } from './types';

const RESCUE = testCallId('protectedRescueV4');
function startComparison(vehicle: boolean): GameState {
  const state = withCallOnBoard(makeState(), RESCUE);
  const certs = Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : []);
  for (const officer of Object.values(state.officers)) officer.certs = [...new Set(certs)];
  const truck = makeUnit('armored_rescue_vehicle', 1);
  if (vehicle) state.units[truck.id] = truck;
  const kit = stockKit(state, ['A'], Object.keys(ITEMS).filter(id => !ITEMS[id].supportOnly));
  const scenario = getScenario(RESCUE)!;
  const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
  const cmd = { ...startCmd(RESCUE, ['A'], { positions: { A: entry }, loadouts: kit.loadouts, units: kit.units }),
    ...(vehicle ? { supportUnitIds: [truck.id] } : {}) };
  const result = apply(kit.state, cmd);
  expect(result.result).toEqual({ ok: true });
  // One fixed initial sample sequence for the entire teaching path, never per-step rerolls.
  result.state.activeRun!.rngState = 1;
  return result.state;
}
function decide(state: GameState, id: string): GameState {
  const option = actionViews(state, NOW, 'A').find(action => action.id === id);
  expect(option?.eligible, `${id}: ${option?.reason}`).toBe(true);
  const result = apply(state, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  return result.state;
}

describe('protected-rescue v4 comparison paths', () => {
  it('generates a fixed scene with both suitable routes and available care crews', () => {
    const scenario = getScenario(RESCUE)!;
    for (const id of ['f_resident', 'f_exterior_pickup', 'f_assisted_route']) {
      expect(scenario.facts.find(fact => fact.id === id)?.truth, id).toBe(true);
    }
    expect(scenario.externalServices).toHaveLength(2);
    expect(scenario.externalServices!.every(service => service.available)).toBe(true);
  });

  it.each([false, true])('can complete the intended comparison with vehicle=%s', vehicle => {
    let state = startComparison(vehicle);
    for (const action of ['hr_check_accounts', 'hr_rescue_reach', 'hr_rescue_prepare_assistance', 'hr_rescue_reach_pickup']) state = decide(state, action);
    const options = actionViews(state, NOW, 'A');
    expect(options.find(action => action.id === 'hr_rescue_assisted_move')?.eligible).toBe(true);
    expect(options.find(action => action.id === 'hr_rescue_armored_vehicle')?.eligible).toBe(vehicle);
    state = decide(state, vehicle ? 'hr_rescue_armored_vehicle' : 'hr_rescue_assisted_move');
    expect(state.activeRun!.flags).toContain('hr_resident_safe');
    expect(state.activeRun!.flags).not.toContain('hr_injury_pause');
    state = decide(state, 'hr_check_civilian_needs');
    state = decide(state, 'hr_civilian_next_step');
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: true, disposition: 'followup_agreed' });
  });
});
