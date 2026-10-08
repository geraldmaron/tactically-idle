import { describe, expect, it } from 'vitest';
import { drawIncidentSpec, generateIncident, INCIDENT_CONTENT_VERSION, INCIDENT_TYPES_V5, incidentId, parseIncidentId } from '../gen/incident';
import { createInitialState } from './department';
import { applyIncidentsDue, INCIDENT_TUNING, nextIncidentAt, playerArcContext, seedIncidentBoard } from './incidents';
import { buildLocation } from './location';
import { next } from './rng';
import { deserialize, serialize } from './save';
import { getScenario } from './scenario-registry';
import { apply, NOW, startCmd, withCallOnBoard } from './test-fixtures';
import type { GameState } from './types';

function start(state: GameState, scenarioId: string): GameState {
  const scenario = getScenario(scenarioId)!;
  const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
  const result = apply(withCallOnBoard(state, scenarioId), startCmd(scenarioId, ['A'], { positions: { A: entry }, loadouts: { A: {} } }));
  expect(result.result).toEqual({ ok: true }); return result.state;
}
const names = INCIDENT_TYPES_V5.map(story => story.type);

function issuedV4(pending: boolean): GameState {
  const state = createInitialState(NOW, 812); state.contentVersion = 4; seedIncidentBoard(state, NOW);
  const spec = { type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 7, tier: 2, contentVersion: 4 } as const;
  const id = incidentId(spec);
  state.incidents[0] = { id, type: spec.type, familyId: spec.familyId, tier: 2, arrivedAt: NOW, expiresAt: NOW + 12 * 3_600_000, seen: false };
  const running = start(state, id);
  if (!pending) return running;
  const stopped = apply(running, { type: 'decide', actionId: 'hr_assess_withdraw', actingSquadIds: ['A'], supportSquadIds: [] });
  expect(stopped.result).toEqual({ ok: true }); expect(stopped.state.activeRun!.status).toBe('debrief'); return stopped.state;
}

describe('current rollout without resetting issued campaigns', () => {
  it('starts new campaigns with current stories and deterministic distinct boards', () => {
    expect(INCIDENT_CONTENT_VERSION).toBe(13);
    for (const seed of [1, 7, 41, 812]) {
      const state = createInitialState(NOW, seed); expect(state).toEqual(createInitialState(NOW, seed));
      // One live call per kind of call: the opening board holds as many kinds as are unlocked, up to the initial count.
      expect(state.contentVersion).toBe(INCIDENT_CONTENT_VERSION);
      expect(state.incidents).toHaveLength(Math.min(INCIDENT_TUNING.initialCount, playerArcContext(state).unlockedTypes.length));
      expect(new Set(state.incidents.map(card => card.type)).size).toBe(state.incidents.length);
      for (const card of state.incidents) {
        expect(parseIncidentId(card.id)?.contentVersion).toBe(INCIDENT_CONTENT_VERSION);
        expect(getScenario(card.id)?.story?.recipeId).toBeDefined();
        expect(getScenario(card.id)?.title.length).toBeGreaterThan(0);
      }
    }
  });

  it('prefers unused compatible stories before location novelty and has a finite all-used fallback', () => {
    for (let seed = 0; seed < 100; seed++) {
      const shopOnly = drawIncidentSpec(seed, { level: 5, trust: 80, contentVersion: 5, avoidTypes: ['welfare_check', 'barricaded', 'protected_rescue'], avoidFamilies: ['market_row'] });
      expect(shopOnly.spec.familyId).toBe('market_row'); expect(['medical_complication', 'active_armed_incident', 'hostage_crisis']).toContain(shopOnly.spec.type);
      const lastStory = drawIncidentSpec(seed, { level: 5, trust: 80, contentVersion: 5, avoidTypes: names.filter(type => type !== 'protected_rescue') });
      expect(lastStory.spec.type).toBe('protected_rescue'); expect(parseIncidentId(incidentId(lastStory.spec))).toEqual(lastStory.spec);
      const allUsed = drawIncidentSpec(seed, { level: 5, trust: 80, contentVersion: 5, avoidTypes: names });
      expect(parseIncidentId(incidentId(allUsed.spec))).toEqual(allUsed.spec);
      let expected = seed; for (let i = 0; i < 5; i++) expected = next(expected).state;
      expect(shopOnly.state).toBe(expected); expect(lastStory.state).toBe(expected); expect(allUsed.state).toBe(expected);
    }
  });

  it.each([1, 2, 3, 4])('ignores avoidTypes entirely for issued v%s draws, including the RNG stream', contentVersion => {
    let rng = 12345;
    for (let i = 0; i < 100; i++) {
      const ctx = { level: 5, trust: 80, contentVersion, avoidFamilies: ['cedar_close'] };
      const old = drawIncidentSpec(rng, ctx);
      expect(drawIncidentSpec(rng, { ...ctx, avoidTypes: names })).toEqual(old); rng = old.state;
    }
  });

  it('keeps every live card a different kind of call from the others and from the active run', () => {
    for (const seed of [1, 7, 41, 812]) {
      let state = createInitialState(NOW, seed); state = start(state, state.incidents[0].id);
      const activeType = parseIncidentId(state.activeRun!.scenarioId)!.type;
      for (let arrival = 0; arrival < 12; arrival++) {
        const at = nextIncidentAt(state)!; applyIncidentsDue(state, state.department.lastSettledAt, at);
        expect(state.incidents.some(card => card.type === activeType)).toBe(false);
        expect(new Set(state.incidents.map(card => card.type)).size).toBe(state.incidents.length);
      }
      expect(state.incidents.length).toBeLessThanOrEqual(playerArcContext(state).unlockedTypes.length - 1);
    }
  });

  it('also avoids the kind of call of an active issued v5 run when the board is filled', () => {
    const id = incidentId({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 5, tier: 2, contentVersion: 5 });
    const original = createInitialState(NOW, 31); const state = start(original, id);
    seedIncidentBoard(state, NOW, 5);
    expect(state.incidents.length).toBeGreaterThan(0);
    expect(state.incidents.every(card => card.type !== 'hostage_crisis')).toBe(true);
    expect(new Set(state.incidents.map(card => card.type)).size).toBe(state.incidents.length);
  });

  it.each([false, true])('promotes future draws while preserving an issued v4 run pending=%s and every campaign resource', pending => {
    const issued = issuedV4(pending); const definition = structuredClone(getScenario(issued.activeRun!.scenarioId));
    const restored = deserialize(serialize(issued, NOW))!; expect(restored).not.toBeNull();
    expect(restored).toEqual({ ...issued, contentVersion: INCIDENT_CONTENT_VERSION });
    expect(getScenario(restored.activeRun!.scenarioId)).toEqual(definition);
    expect(restored.incidents.every(card => parseIncidentId(card.id)?.contentVersion === 4)).toBe(true);
    const oldIds = new Set(restored.incidents.map(card => card.id)); const active = structuredClone(restored.activeRun);
    const resources = { officers: structuredClone(restored.officers), units: structuredClone(restored.units), reservations: structuredClone(restored.reservations), funding: restored.department.funding, points: restored.department.devPoints };
    applyIncidentsDue(restored, NOW, nextIncidentAt(restored)!);
    const added = restored.incidents.filter(card => !oldIds.has(card.id)); expect(added.length).toBeGreaterThan(0);
    expect(added.every(card => parseIncidentId(card.id)?.contentVersion === INCIDENT_CONTENT_VERSION)).toBe(true);
    expect(restored.activeRun).toEqual(active); expect(restored.officers).toEqual(resources.officers); expect(restored.units).toEqual(resources.units); expect(restored.reservations).toEqual(resources.reservations);
    expect(restored.department.funding).toBe(resources.funding); expect(restored.department.devPoints).toBe(resources.points);
    expect(deserialize(serialize(restored, NOW))).toEqual(restored);
    for (const card of added) expect(generateIncident(parseIncidentId(card.id)!).version).toBe(INCIDENT_CONTENT_VERSION);
  });
});
