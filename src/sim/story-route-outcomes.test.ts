import { describe, expect, it } from 'vitest';
import { incidentId } from '../gen/incident';
import { buildLocation } from './location';
import { initializePersonnel } from './personnel';
import { bandFor, builtFor, evaluateAction, openingFlag } from './resolution';
import { next } from './rng';
import { getScenario } from './scenario-registry';
import { scenarioActions, type ScenarioDefinition } from './scenario-types';
import { deserialize, serialize } from './save';
import { currentStoryRoute } from './story-bindings';
import { apply, makeState, NOW, startRun, withCallOnBoard } from './test-fixtures';
import type { GameState } from './types';

const scenario = (seed: number) => getScenario(incidentId({ type: 'medical_complication', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 5 }))!;
const action = (scenario: ScenarioDefinition, name: string) => scenarioActions(scenario).find(action => action.id === `v5_assistance_${name}`)!;
function evaluate(scenario: ScenarioDefinition, state: GameState, name: string) {
  const run = state.activeRun!;
  return evaluateAction({ scenario, state, run, action: action(scenario, name), built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function commit(state: GameState, name: string): GameState {
  const result = apply(state, { type: 'decide', actionId: `v5_assistance_${name}`, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result, name).toEqual({ ok: true });
  return result.state;
}
/** Choose one initial stream, then leave every saved draw untouched. */
function favorableJourney(scenario: ScenarioDefinition, names: string[], beforeLast: (state: GameState) => void): { before: GameState; after: GameState } {
  const base = makeState(); base.saveVersion = 5; base.contentVersion = 5; initializePersonnel(base);
  const initial = startRun(withCallOnBoard(base, scenario.id), scenario.id, ['A'], { positions: { A: buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0] }, loadouts: { A: { trauma_kit: 3 } } });
  for (let seed = 1; seed < 1000; seed++) {
    let state = structuredClone(initial); state.activeRun!.rngState = seed;
    let failed = false;
    for (const name of names) {
      const last = name === names.at(-1);
      if (last) beforeLast(state);
      const ev = evaluate(scenario, state, name);
      if (name === 'wait_with_rosa' && !ev.eligible) continue;
      if (!ev.eligible || bandFor(ev.margin, next(state.activeRun!.rngState).value) !== 'favorable') { failed = true; break; }
      if (last) return { before: state, after: commit(state, name) };
      state = commit(state, name);
    }
    if (!failed) break;
  }
  throw new Error('No favorable initial stream for the tested route');
}

describe('bound route outcomes use the route actually traversed', () => {
  it('Rosa locks the alternate side doorway and preserves the blocked unused front door through reload', () => {
    const built = buildLocation('market_row', 7);
    const s = Array.from({ length: 30 }, (_, seed) => scenario(seed)).find(s =>
      s.facts.find(fact => fact.id === 'v5_assistance_supervisor_answers')?.truth
      && s.story!.bindings.routes.exit.openingIds.includes('d_front'))!;
    expect(s).toBeDefined();
    const { before, after } = favorableJourney(s, ['hear_rosa_assess', 'call_supervisor', 'lock_and_step_out'], state => {
      state.activeRun!.flags.push(openingFlag('d_front', 'blocked'), openingFlag('d_side', 'open'), openingFlag('d_delivery', 'blocked'));
    });
    const current = builtFor(s.locationFamilyId, s.locationSeed, before.activeRun!.flags);
    expect(currentStoryRoute(s, current, 'exit')).toEqual(['d_side', 'p_front_e']);
    const result = builtFor(s.locationFamilyId, s.locationSeed, after.activeRun!.flags);
    expect(result.location.openings.find(opening => opening.id === 'd_front')!.state).toBe('blocked');
    expect(result.location.openings.find(opening => opening.id === 'd_side')!.state).toBe('locked');
    expect(result.location.openings.find(opening => opening.id === 'p_front_e')!.state).toBe(built.location.openings.find(opening => opening.id === 'p_front_e')!.state);
    const record = after.activeRun!.history.at(-1)!;
    expect(record.committed!.openingChanges).toContainEqual({ openingId: 'd_side', state: 'locked' });
    expect(record.committed!.openingChanges!.some(change => change.openingId === 'd_front' || change.openingId === 'p_front_e')).toBe(false);
    expect(record.committed!.consequences.some(text => text.includes('locked'))).toBe(true);
    const loaded = deserialize(serialize(after, NOW));
    expect(loaded).not.toBeNull();
    expect(loaded!.activeRun).toEqual(after.activeRun);
    expect(builtFor(s.locationFamilyId, s.locationSeed, loaded!.activeRun!.flags)).toEqual(result);
    // A later service condition must replay the resolved doorway, not the original static exit.
    const crew = s.externalServices![0];
    const originalAcceptance = crew.acceptWhen;
    try {
      crew.acceptWhen = { ...originalAcceptance, flags: [...originalAcceptance?.flags ?? [], openingFlag('d_side', 'locked')] };
      let continued = after;
      if (evaluate(s, continued, 'wait_with_rosa').eligible) continued = commit(continued, 'wait_with_rosa');
      expect(evaluate(s, continued, 'receive_outside').eligible).toBe(true);
      continued = commit(continued, 'receive_outside');
      const replayed = deserialize(serialize(continued, NOW));
      expect(replayed).not.toBeNull(); expect(replayed!.activeRun).toEqual(continued.activeRun);
      const damaged = JSON.parse(serialize(continued, NOW));
      const closing = damaged.state.activeRun.history.find((decision: { actionId: string }) => decision.actionId === 'v5_assistance_lock_and_step_out');
      delete closing.committed.openingChanges;
      expect(deserialize(JSON.stringify(damaged))).toBeNull();
    } finally { crew.acceptWhen = originalAcceptance; }
  });

  it('an accepting crew still traverses and opens its locked route when Rosa and the squad are already inside', () => {
    const s = scenario(3);
    const { before, after } = favorableJourney(s, ['hear_rosa_assess', 'offer_here', 'aid_rosa_resolve', 'wait_with_rosa', 'receive_here'], state => {
      state.activeRun!.flags.push(openingFlag('d_side', 'blocked'), openingFlag('d_delivery', 'blocked'), openingFlag('d_front', 'locked'));
    });
    const ev = evaluate(s, before, 'receive_here');
    expect(before.activeRun!.squadTasks[0].positionId).toBe(s.story!.bindings.people.rosa.initial.spaceId);
    expect(ev.storyMovementMinutes).toBeGreaterThan(0);
    expect(ev.storyOpenedIds).toContain('d_front');
    expect(ev.storySquadOpenedIds).toEqual([]);
    expect(after.activeRun!.history.at(-1)!.timeCost).toBe(ev.timeBase);
    expect(after.activeRun!.history.at(-1)!.committed!.openingChanges).toContainEqual({ openingId: 'd_front', state: 'open' });
    expect(builtFor(s.locationFamilyId, s.locationSeed, after.activeRun!.flags).location.openings.find(opening => opening.id === 'd_front')!.state).toBe('open');
    const loaded = deserialize(serialize(after, NOW));
    expect(loaded).not.toBeNull(); expect(loaded!.activeRun).toEqual(after.activeRun);
  });
});
