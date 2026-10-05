import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateIncident } from '../gen/incident';
import { actionEventResult, actionResultLabel } from './action-result';
import { actionViews, decisionViews, pendingDebrief, previewAction } from './operation-selectors';
import { initializePersonnel } from './personnel';
import { bandFor, builtFor, evaluateAction } from './resolution';
import { hashSeed, next } from './rng';
import { CURRENT_SAVE_VERSION, deserialize, serialize } from './save';
import { scenarioActions, type ActionDefinition, type OutcomeEffect, type ScenarioDefinition } from './scenario-types';
import { apply, makeState, NOW, startRun } from './test-fixtures';
import type { GameState, OutcomeBand } from './types';

const overrides = vi.hoisted(() => new Map<string, ScenarioDefinition>());
vi.mock('./scenario-registry', async original => {
  const real = await original<typeof import('./scenario-registry')>();
  return { ...real, getScenario: (id: string) => overrides.get(id) ?? real.getScenario(id) };
});
afterEach(() => overrides.clear());
const bands: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const welfare = () => generateIncident({ type: 'welfare_check', familyId: 'cedar_close', buildingSeed: 7, seed: 2, tier: 1, contentVersion: 6 });
function fixed(effects: OutcomeEffect[]): ActionDefinition {
  const action = structuredClone(welfare().stages.assess.actions.find(a => a.id.endsWith('assess_partial'))!);
  action.outcomes = { favorable: structuredClone(effects), mixed: structuredClone(effects), adverse: structuredClone(effects) };
  return action;
}
function started(scenario: ScenarioDefinition): GameState {
  overrides.set(scenario.id, scenario);
  const state = makeState();
  state.saveVersion = CURRENT_SAVE_VERSION;
  state.contentVersion = 6;
  initializePersonnel(state);
  state.incidents = [{ id: scenario.id, type: scenario.incident!.type, familyId: scenario.locationFamilyId, tier: 1, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const entry = builtFor(scenario.locationFamilyId, scenario.locationSeed, []).location.entries[0];
  return startRun(state, scenario.id, ['A'], { positions: { A: entry }, loadouts: { A: { trauma_kit: 2 } } });
}
function adverseSeed(state: GameState, scenario: ScenarioDefinition, action: ActionDefinition): void {
  const run = state.activeRun!;
  const ev = evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
  expect(ev.eligible).toBe(true);
  for (let i = 0; i < 1000; i++) {
    const seed = hashSeed(`fixed-event-${i}`);
    if (bandFor(ev.margin, next(seed).value) === 'adverse') { run.rngState = seed; return; }
  }
  throw new Error('No natural adverse sample found');
}
function commit(state: GameState, action: ActionDefinition): GameState {
  const result = apply(state, { type: 'decide', actionId: action.id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  return result.state;
}

describe('fixed outcome presentation', () => {
  it('infers neutral labels only for v6, without changing the authored action', () => {
    const action = fixed([{ ending: 'unfinished', text: 'Work remains open.' }]);
    const before = structuredClone(action);
    expect(actionEventResult(action, 6)).toBe('Response ended');
    for (const band of bands) expect(actionResultLabel(action, 6, band)).toBe('Response ended');
    for (const version of [1, 2, 3, 4, 5]) {
      expect(actionEventResult(action, version)).toBeUndefined();
      for (const band of bands) expect(actionResultLabel(action, version, band)).toBeUndefined();
    }
    expect(action).toEqual(before);
  });

  it('keeps common and band-specific authored v5/v6 labels authoritative', () => {
    const action = fixed([{ ending: 'finished' }]);
    for (const version of [5, 6]) {
      action.resultLabels = { favorable: 'Care accepted', mixed: 'Care accepted', adverse: 'Care accepted' };
      expect(actionEventResult(action, version)).toBe('Care accepted');
      expect(actionResultLabel(action, version, 'adverse')).toBe('Care accepted');
      action.resultLabels.adverse = 'Care still needed';
      expect(actionEventResult(action, version)).toBeUndefined();
      expect(actionResultLabel(action, version, 'adverse')).toBe('Care still needed');
    }
  });

  it.each<OutcomeEffect>([
    { extraMinutes: 3 }, { civilian: -10 }, { pressure: 8 }, { objective: 5 },
    { officerHarm: { severity: 'serious', label: 'Injury' } },
    { when: { flags: ['ready'] } }, { truth: [{ factId: 'hidden', is: true }] },
    { knowledge: [{ factId: 'hidden', status: 'confirmed' }] }, { ending: 'different' },
    { text: 'A different result was recorded.' },
  ])('does not infer a fixed event when any adverse effect differs: %j', difference => {
    const action = fixed([{ text: 'The same public words.' }]);
    action.outcomes.adverse[0] = { ...action.outcomes.adverse[0], ...difference };
    expect(actionEventResult(action, 6)).toBeUndefined();
    expect(actionResultLabel(action, 6, 'adverse')).toBeUndefined();
  });

  it('compares hidden branches structurally without choosing or revealing a branch', () => {
    const effects: OutcomeEffect[] = [
      { when: { flags: ['ready'] }, truth: [{ factId: 'hidden', is: true }], ending: 'private_ending', text: 'PRIVATE TRUE RESULT' },
      { truth: [{ factId: 'hidden', is: false }], extraMinutes: 4, text: 'PRIVATE FALSE RESULT' },
    ];
    const action = fixed(effects);
    action.outcomes.mixed[0] = { text: effects[0].text, ending: effects[0].ending, truth: effects[0].truth, when: effects[0].when };
    expect(actionEventResult(action, 6)).toBe('Result recorded');
    // Conditions and effect ordering remain significant, even if current state would skip them.
    action.outcomes.adverse.reverse();
    expect(actionEventResult(action, 6)).toBeUndefined();
    expect(actionEventResult(fixed([]), 6)).toBeUndefined();
  });
});

describe('v6 operation result integration', () => {
  it('ends the real welfare partial response neutrally without claiming completion or rerolling', () => {
    const scenario = welfare();
    const action = scenario.stages.assess.actions.find(a => a.id.endsWith('assess_partial'))!;
    const state = started(scenario);
    adverseSeed(state, scenario, action);
    expect(actionViews(state, NOW, 'A').find(a => a.id === action.id)?.eventResult).toBe('Response ended');
    expect(previewAction(state, NOW, action.id, ['A'], [])?.eventResult).toBe('Response ended');
    const expected = next(state.activeRun!.rngState);
    const finished = commit(state, action);
    const record = finished.activeRun!.history[0];
    expect(record).toMatchObject({ sample: expected.value, band: 'adverse', committed: { resultLabel: 'Response ended' } });
    expect(finished.activeRun!.rngState).toBe(expected.state);
    expect(decisionViews(finished)[0].resultLabel).toBe('Response ended');
    expect(pendingDebrief(finished)).toMatchObject({ completionAchieved: false, disposition: 'relief_partial' });
    expect(deserialize(serialize(finished, NOW))?.activeRun).toEqual(finished.activeRun);
    const historical = structuredClone(finished);
    delete historical.activeRun!.history[0].committed!.resultLabel;
    const original = structuredClone(historical);
    expect(decisionViews(historical)[0].resultLabel).toBeUndefined();
    expect(historical).toEqual(original);
  });

  it('preserves the complete effort result, supplies, stress and RNG for identical hidden-branch tables', () => {
    const scenario = welfare();
    const action = scenarioActions(scenario).find(a => a.id.endsWith('ask_about_return'))!;
    delete action.resultLabels;
    action.consumes = [{ tag: 'medkit', qty: 1 }];
    const state = started(scenario);
    adverseSeed(state, scenario, action);
    const view = previewAction(state, NOW, action.id, ['A'], [])!;
    expect(view.eventResult).toBe('Result recorded');
    expect(view.suppliesRequired).toContainEqual({ label: 'Trauma kit', qty: 1 });
    const before = structuredClone(state);
    const finished = commit(state, action);
    const record = finished.activeRun!.history[0];
    expect(record.band).toBe('adverse');
    expect(record.committed?.resultLabel).toBe('Result recorded');
    expect(record.timeCost).toBeGreaterThan(0);
    expect(record.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
    expect(Object.values(record.stressDeltas).some(delta => delta > 0)).toBe(true);
    expect(deserialize(serialize(finished, NOW))?.activeRun).toEqual(finished.activeRun);
    // A never-matched divergent branch disables only the presentation inference.
    action.outcomes.mixed.push({ when: { flags: ['never_set'] }, text: 'Unreachable test branch' });
    const baselineView = previewAction(state, NOW, action.id, ['A'], [])!;
    const { eventResult: _eventResult, ...effortView } = view;
    expect(baselineView).toEqual(effortView);
    const baseline = commit(state, action);
    delete finished.activeRun!.history[0].committed!.resultLabel;
    expect(finished).toEqual(baseline);
    expect(state).toEqual(before);
  });

  it('keeps a mechanically divergent harm outcome and its casualty visible despite identical prose', () => {
    const scenario = welfare();
    const action = scenario.stages.assess.actions.find(a => a.id.endsWith('ask_about_return'))!;
    delete action.resultLabels;
    action.consequenceLevel = 'severe';
    action.outcomes.adverse.push({ officerHarm: { severity: 'serious', label: 'Fictional test injury' } });
    const state = started(scenario);
    adverseSeed(state, scenario, action);
    const view = previewAction(state, NOW, action.id, ['A'], [])!;
    expect(view.eventResult).toBeUndefined();
    expect(view.consequenceLevel).toBe('severe');
    expect(view.likelihood.adverse).toBeGreaterThan(0);
    const finished = commit(state, action);
    const result = decisionViews(finished)[0];
    expect(result.resultLabel).toBeUndefined();
    expect(result.band).toBe('adverse');
    expect(result.officerCasualties).toHaveLength(1);
    expect(result.consequences.join(' ')).toContain('seriously wounded');
  });
});
