import { describe, expect, it } from 'vitest';
import { SCENARIO_ORDER } from '../content/scenarios';
import { DECISION_EXERCISES, LEGACY_DECISION_EXERCISES } from '../content/scenarios/decision-exercises';
import { generateIncident, INCIDENT_CONTENT_VERSION } from '../gen/incident';
import { createInitialState } from './department';
import { actionViews, decisionViews, pendingDebrief } from './operation-selectors';
import { getScenario } from './scenario-registry';
import { buildLocation } from './location';
import { apply, NOW, startCmd } from './test-fixtures';
import { deserialize, serialize } from './save';
import { practiceEntries } from '../ui/screens/helpers';

describe('immediately discoverable decision exercises', () => {
  it('keeps tutorials first and exposes six distinct decision exercises in existing campaigns', () => {
    const state = createInitialState(NOW, 41); const entries = practiceEntries(state, NOW);
    expect(SCENARIO_ORDER.slice(0, 2)).toEqual(['ms_occupancy', 'ms_urgent']);
    expect(DECISION_EXERCISES).toHaveLength(6);
    expect(new Set(DECISION_EXERCISES.map((exercise) => exercise.spec.familyId)).size).toBe(3);
    for (const exercise of DECISION_EXERCISES) {
      expect(entries.find((entry) => entry.card.id === exercise.id)?.kind).toBe('exercise');
      expect(getScenario(exercise.id)).toMatchObject({ practiceOnly:true,version:INCIDENT_CONTENT_VERSION,id:exercise.id });
      const generated = generateIncident(exercise.spec);
      expect(getScenario(exercise.id)?.title).toBe(generated.title);
      expect(getScenario(exercise.id)?.summary).toBe(generated.summary);
      expect(getScenario(exercise.id)?.variantLabel).toBe(generated.variantLabel);
    }
  });
  it('keeps all issued v3 through v6 exercises in the legacy lookup without advertising them as new entries', () => {
    expect(LEGACY_DECISION_EXERCISES).toHaveLength(21);
    for (const entry of LEGACY_DECISION_EXERCISES) {
      const text = entry.spec.contentVersion >= 5 ? generateIncident(entry.spec) : { title: entry.title, summary: entry.summary, variantLabel: 'Decision exercise' };
      expect(getScenario(entry.id)).toMatchObject({ id: entry.id, version: entry.spec.contentVersion, title: text.title, summary: text.summary, variantLabel: text.variantLabel, practiceOnly: true });
      expect(SCENARIO_ORDER).not.toContain(entry.id);
    }
  });
  it.each(DECISION_EXERCISES)('$title is playable, reloadable and reward-free with the starting squad', (exercise) => {
    const original = createInitialState(NOW, 41); const scenario = getScenario(exercise.id)!;
    const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
    const started = apply(original, startCmd(exercise.id, ['A'], { practice:true, positions:{ A:entry }, loadouts:{ A:{} } }));
    expect(started.result).toEqual({ ok:true }); let state = started.state;
    const initial = actionViews(state, NOW, 'A'); expect(initial.length).toBeGreaterThanOrEqual(3); expect(initial.length).toBeLessThanOrEqual(5);
    for (let i = 0; i < 32 && state.activeRun?.status === 'active'; i++) {
      const actions = actionViews(state, NOW, 'A');
      expect(actions.length).toBeLessThanOrEqual(5);
      const action = actions.find((candidate) => candidate.eligible); expect(action).toBeDefined();
      const next = apply(state, { type:'decide', actionId:action!.id, actingSquadIds:action!.actingSquadIds, supportSquadIds:action!.supportSquadIds });
      expect(next.result).toEqual({ ok:true }); state = next.state;
      const roundtrip = deserialize(serialize(state, NOW)); expect(roundtrip).not.toBeNull(); state = roundtrip!;
    }
    const result = pendingDebrief(state); expect(result).not.toBeNull(); expect(result!.practice).toBe(true);
    expect(result!.decisions).toEqual(decisionViews(state)); expect(result!.fundingReward).toBe(0); expect(result!.devPointReward).toBe(0);
    const closed = apply(state, { type:'closeDebrief' }); expect(closed.result).toEqual({ ok:true });
    expect(closed.state.department.funding).toBe(original.department.funding);
    expect(closed.state.department.devPoints).toBe(original.department.devPoints);
    expect(closed.state.department.trust).toBe(original.department.trust);
    expect(closed.state.units).toEqual(original.units);
    expect(closed.state.debriefs[0].decisions).toEqual(result!.decisions);
    expect(apply(closed.state, { type:'closeDebrief' }).result.ok).toBe(false);
  });
  it.each(DECISION_EXERCISES)('$title cannot be started as a reward-bearing deployment', (exercise) => {
    const state = createInitialState(NOW, 41); const scenario = getScenario(exercise.id)!;
    const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
    const result = apply(state, startCmd(exercise.id, ['A'], { practice:false,positions:{ A:entry },loadouts:{ A:{} } }));
    expect(result.result.ok).toBe(false); expect(result.state).toBe(state);
  });
});
