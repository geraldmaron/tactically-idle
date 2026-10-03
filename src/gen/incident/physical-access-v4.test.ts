import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../content/scenarios';
import { buildLocation, deriveLocation } from '../../sim/location';
import { bandFor, evaluateAction, openingFlag } from '../../sim/resolution';
import { next } from '../../sim/rng';
import { apply, makeState, NOW, setRun, startRun } from '../../sim/test-fixtures';
import { scenarioActions, type IncidentSpec, type ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, GameState, Opening } from '../../sim/types';
import { generateIncident } from './index';
import { withVersionFourChoices } from './choices-v4';
import { premiseForV4 } from './premises-v4';

/** Change only the sole bedroom entrance's form; retain actual generated geometry. */
function fixture(type: 'medical_complication' | 'barricaded', openingType: Opening['type']) {
  for (let seed = 0; seed < 500; seed++) {
    const spec: IncidentSpec = { type, familyId: 'cedar_close', buildingSeed: 7, seed, tier: 2, contentVersion: 4 };
    const base = generateIncident(spec); const targetId = base.facts[0].spaceId;
    const truth = (id: string) => base.facts.find(f => f.id === id)!.truth;
    if (!truth('f_person') || truth('f_immediate_danger')) continue;
    if (type === 'medical_complication' && (!truth('f_care_needed') || !base.externalServices!.some(s => s.available))) continue;
    if (type === 'barricaded' && (premiseForV4(spec).id !== 'protective_movement' || !truth('f_adjacent_safety') || truth('f_care_needed'))) continue;
    const built = structuredClone(buildLocation(spec.familyId, spec.buildingSeed));
    const entrances = built.location.openings.filter(o => o.type !== 'window' && (o.a === targetId || o.b === targetId));
    if (entrances.length !== 1) continue;
    const entrance = entrances[0]; entrance.type = openingType; entrance.state = 'open';
    delete entrance.swing;
    built.derived = deriveLocation(built.location);
    const scenario = withVersionFourChoices(structuredClone(base), built);
    scenario.id = `test_v4_access_${type}_${openingType}`;
    return { scenario, built, targetId, openingId: entrance.id };
  }
  throw new Error('No suitable sole-entrance fixture');
}
function currentBuilt(base: BuiltLocation, state: GameState): BuiltLocation {
  const built = structuredClone(base);
  for (const opening of built.location.openings) {
    const override = state.activeRun!.flags.find(flag => flag.startsWith(`opening:${opening.id}=`));
    if (override) opening.state = override.split('=')[1] as Opening['state'];
  }
  built.derived = deriveLocation(built.location);
  return built;
}
function ev(state: GameState, scenario: ScenarioDefinition, built: BuiltLocation, id: string, omitOpeningGate = false) {
  const action = structuredClone(scenarioActions(scenario).find(a => a.id === id)!);
  if (omitOpeningGate) action.requires.openings = [];
  return evaluateAction({ state, run: state.activeRun!, scenario, action, built: currentBuilt(built, state), acting: ['A'], support: [] });
}
function choose(state: GameState, scenario: ScenarioDefinition, built: BuiltLocation, id: string) {
  const evaluated = ev(state, scenario, built, id); expect(evaluated.eligible, `${id}: ${evaluated.reason}`).toBe(true);
  const input = structuredClone(state);
  for (let seed = 1; seed < 100_000; seed++) if (bandFor(evaluated.margin, next(seed).value) === 'favorable') { input.activeRun!.rngState = seed; break; }
  const result = apply(input, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true }); return result.state;
}
function start(scenario: ScenarioDefinition, built: BuiltLocation) {
  const state = makeState();
  state.incidents = [{ id: scenario.id, type: scenario.incident!.type, familyId: scenario.locationFamilyId, tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  return startRun(state, scenario.id, ['A'], { positions: { A: built.location.entries[0] }, loadouts: { A: {} } });
}
function refused(state: GameState, id: string) {
  const result = apply(state, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result.ok).toBe(false); expect(result.state).toBe(state);
}

describe.each(['doorway', 'sliding'] as const)('v4 physical access through a %s', openingType => {
  it('rejects blocked paramedic access even if the acting squad is already inside, and completes open access', () => {
    const { scenario, built, openingId, targetId } = fixture('medical_complication', openingType);
    SCENARIOS[scenario.id] = scenario;
    try {
      let state = start(scenario, built);
      for (const id of ['v4_source', 'v4_verify', 'v4_agreement', 'v4_proceed', 'v4_care_plan']) state = choose(state, scenario, built, id);
      if (ev(state, scenario, built, 'v4_await_care').eligible) state = choose(state, scenario, built, 'v4_await_care');
      const outsideBlocked = setRun(state, { flags: [openingFlag(openingId, 'blocked')] });
      // Ordinary route finding already blocks an unreachable room from outside.
      expect(ev(outsideBlocked, scenario, built, 'v4_care_access', true).eligible).toBe(false);
      const insideBlocked = setRun(outsideBlocked, { positions: { A: targetId } });
      // A zero-length acting-squad route cannot stand in for paramedic access.
      expect(ev(insideBlocked, scenario, built, 'v4_care_access', true).eligible).toBe(true);
      expect(ev(insideBlocked, scenario, built, 'v4_care_access').eligible).toBe(false);
      refused(insideBlocked, 'v4_care_access'); refused(insideBlocked, 'v4_transfer_care');
      expect(insideBlocked.activeRun!.flags).not.toContain('v4_care_access');
      expect(insideBlocked.activeRun!.status).toBe('active');
      state = choose(state, scenario, built, 'v4_care_access');
      state = choose(state, scenario, built, 'v4_transfer_care');
      expect(state.activeRun!.endingId).toBe('care_accepted');
      expect(state.activeRun!.objective).toBe(100);
    } finally { delete SCENARIOS[scenario.id]; }
  });
  it('refuses blocked route preparation and the agreed move, while the open route remains playable', () => {
    const { scenario, built, openingId } = fixture('barricaded', openingType);
    SCENARIOS[scenario.id] = scenario;
    try {
      let state = start(scenario, built);
      for (const id of ['v4_contact', 'v4_verify']) state = choose(state, scenario, built, id);
      const blocked = setRun(state, { flags: [openingFlag(openingId, 'blocked')] });
      // This preparation is remote, so the explicit opening gate is essential.
      expect(ev(blocked, scenario, built, 'v4_prepare', true).eligible).toBe(true);
      expect(ev(blocked, scenario, built, 'v4_prepare').eligible).toBe(false);
      refused(blocked, 'v4_prepare');
      expect(blocked.activeRun!.flags).not.toContain('v4_route_ready');
      const unresolved = choose(blocked, scenario, built, 'v4_proceed');
      refused(unresolved, 'v4_complete_plan');
      expect(unresolved.activeRun!.status).toBe('active');
      state = choose(state, scenario, built, 'v4_prepare');
      state = choose(state, scenario, built, 'v4_proceed');
      state = choose(state, scenario, built, 'v4_complete_plan');
      expect(state.activeRun!.endingId).toBe('protective_completed');
      expect(state.activeRun!.objective).toBe(100);
    } finally { delete SCENARIOS[scenario.id]; }
  });
});
