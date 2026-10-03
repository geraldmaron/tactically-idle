import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { buildLocation } from './location';
import { applyIncidentsDue, nextIncidentAt, seedIncidentBoard } from './incidents';
import { getScenario } from './scenario-registry';
import { parseIncidentId, INCIDENT_CONTENT_VERSION } from '../gen/incident';
import { deserialize, serialize } from './save';
import { apply, NOW, startCmd } from './test-fixtures';

function legacyActive() {
  const state = createInitialState(NOW, 812);
  state.contentVersion = 1;
  seedIncidentBoard(state, NOW);
  const card = state.incidents[0];
  const scenario = getScenario(card.id)!;
  const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
  const started = apply(state, startCmd(card.id, ['A'], { positions: { A: entry }, loadouts: { A: {} } }));
  expect(started.result).toEqual({ ok: true });
  return started.state;
}

describe('future-content migration', () => {
  it('preserves an issued v1 queue and active run byte-for-byte while enabling current-version draws', () => {
    const old = legacyActive();
    const oldScenario = structuredClone(getScenario(old.activeRun!.scenarioId));
    const current = deserialize(serialize(old, NOW))!;
    expect(current.contentVersion).toBe(INCIDENT_CONTENT_VERSION);
    expect(current.activeRun).toEqual(old.activeRun);
    expect(current.incidents).toEqual(old.incidents);
    expect(current.rngState).toBe(old.rngState);
    expect(current.units).toEqual(old.units);
    expect(current.reservations).toEqual(old.reservations);
    expect(getScenario(current.activeRun!.scenarioId)).toEqual(oldScenario);
    expect(current.incidents.every((card) => parseIncidentId(card.id)?.contentVersion === 1)).toBe(true);
    const issued = new Set(current.incidents.map((card) => card.id));
    applyIncidentsDue(current, NOW, nextIncidentAt(current)!);
    const added = current.incidents.filter((card) => !issued.has(card.id));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((card) => parseIncidentId(card.id)?.contentVersion === INCIDENT_CONTENT_VERSION)).toBe(true);
    expect(current.activeRun).toEqual(old.activeRun);
  });
  it('reload is stable with mixed-version queue entries and never repeats migration rewards or RNG draws', () => {
    const first = deserialize(serialize(legacyActive(), NOW))!;
    applyIncidentsDue(first, NOW, nextIncidentAt(first)!);
    const second = deserialize(serialize(first, NOW))!;
    const third = deserialize(serialize(second, NOW))!;
    expect(second).toEqual(first);
    expect(third).toEqual(second);
  });
});
