import { decisionsOf } from './types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import { actionEventResult, actionResultLabel } from './action-result';
import { decisionViews, previewAction } from './operation-selectors';
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
const welfare = () => {
  const scenario = structuredClone(SCENARIOS.ms_occupancy);
  scenario.id = 'current_result_fixture';
  const source = structuredClone(scenario.stages.assess.actions[0]);
  source.id = 'test_ask_about_return'; source.approach = 'none'; source.requires = {}; source.observes = [];
  const effects: OutcomeEffect[] = [{ text: 'The same checked result.', objective: 1 }];
  source.outcomes = Object.fromEntries(bands.map(band => [band, structuredClone(effects)])) as ActionDefinition['outcomes'];
  scenario.stages.assess.actions = [source];
  return scenario;
};
function fixed(effects: OutcomeEffect[]): ActionDefinition {
  const action = structuredClone(welfare().stages.assess.actions.find(a => a.id.endsWith('ask_about_return'))!);
  action.outcomes = { favorable: structuredClone(effects), mixed: structuredClone(effects), adverse: structuredClone(effects) };
  return action;
}
function started(scenario: ScenarioDefinition): GameState {
  overrides.set(scenario.id, scenario);
  const state = makeState();
  state.saveVersion = CURRENT_SAVE_VERSION;
  state.contentVersion = 13;
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
  it('infers neutral labels for a fixed current event, without changing the authored action', () => {
    const action = fixed([{ ending: 'unfinished', text: 'Work remains open.' }]);
    const before = structuredClone(action);
    expect(actionEventResult(action)).toBe('Response ended');
    for (const band of bands) expect(actionResultLabel(action, band)).toBe('Response ended');
    expect(action).toEqual(before);
  });

  it('keeps common and band-specific authored current labels authoritative', () => {
    const action = fixed([{ ending: 'finished' }]);
    {
      action.resultLabels = { favorable: 'Care accepted', mixed: 'Care accepted', adverse: 'Care accepted' };
      expect(actionEventResult(action)).toBe('Care accepted');
      expect(actionResultLabel(action, 'adverse')).toBe('Care accepted');
      action.resultLabels.adverse = 'Care still needed';
      expect(actionEventResult(action)).toBeUndefined();
      expect(actionResultLabel(action, 'adverse')).toBe('Care still needed');
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
    expect(actionEventResult(action)).toBeUndefined();
    expect(actionResultLabel(action, 'adverse')).toBeUndefined();
  });

  it('compares hidden branches structurally without choosing or revealing a branch', () => {
    const effects: OutcomeEffect[] = [
      { when: { flags: ['ready'] }, truth: [{ factId: 'hidden', is: true }], ending: 'private_ending', text: 'PRIVATE TRUE RESULT' },
      { truth: [{ factId: 'hidden', is: false }], extraMinutes: 4, text: 'PRIVATE FALSE RESULT' },
    ];
    const action = fixed(effects);
    action.outcomes.mixed[0] = { text: effects[0].text, ending: effects[0].ending, truth: effects[0].truth, when: effects[0].when };
    expect(actionEventResult(action)).toBe('Result recorded');
    // Conditions and effect ordering remain significant, even if current state would skip them.
    action.outcomes.adverse.reverse();
    expect(actionEventResult(action)).toBeUndefined();
    expect(actionEventResult(fixed([]))).toBeUndefined();
  });
});

describe('current operation result integration', () => {
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
    const record = decisionsOf(finished.activeRun!.history)[0];
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
    delete decisionsOf(finished.activeRun!.history)[0].committed!.resultLabel;
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
    expect(result.resultLabel).toBe('An officer was badly hurt');
    expect(result.band).toBe('adverse');
    expect(result.officerCasualties).toHaveLength(1);
    expect(result.consequences.join(' ')).toContain('seriously wounded');
  });
});
