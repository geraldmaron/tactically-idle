import { describe, expect, it } from 'vitest';
import { drawIncidentSpec, generateIncident } from '../gen/incident';
import { applyMove, NOW, sampleFor, startGateRun } from '../gen/incident/gates/engine-driver';
import { CLOCK_RULES_V1, forkMinutes } from './clocks';
import { withVariants } from '../gen/incident/drawn-model';
import { actionViews } from './operation-selectors';
import { builtFor, evaluateAction, RESOLUTION_TUNING } from './resolution';
import { getScenario } from './scenario-registry';
import type { ActionDefinition } from './scenario-types';
import { withTuning, type TuningPatch } from './tuning';
import type { OutcomeBand } from './types';

// A choice's minutes per band live in one table, RESOLUTION_TUNING.bandTime: the commit charges
// them, the preview shows them (expected time and range), and the clock lookahead reads them.
const BANDS = ['favorable', 'mixed', 'adverse'] as const;
const SLOW: TuningPatch = { RESOLUTION_TUNING: { bandTime: { favorable: 1.5, mixed: 2, adverse: 2.75 } } };
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Calls whose first choices take minutes from the band alone: no outcome or variant adds minutes,
 * nobody moves along a story route, nobody waits on support. */
function plainStarts() {
  const out: { id: string; actionId: string; band: OutcomeBand }[] = [];
  for (const type of ['barricaded', 'hostage_crisis', 'protected_rescue'] as const) {
    const id = generateIncident(drawIncidentSpec(41, { level: 10, trust: 90, unlockedTypes: [type] }).spec).id;
    const state = startGateRun(id, 719);
    const scenario = getScenario(id)!;
    for (const view of actionViews(state, NOW, 'A').filter(entry => entry.eligible)) {
      const action = scenario.stages[state.activeRun!.stage as 'assess'].actions.find(entry => entry.id === view.id)!;
      const ev = evaluate(state, action, view.actingSquadIds, view.supportSquadIds);
      if (action.awaitSupport || ev.storyMovementMinutes !== undefined) continue;
      for (const band of BANDS) if (sampleFor(view, band) !== null && !withVariants(action.outcomes[band]).some(effect => effect.extraMinutes)) out.push({ id, actionId: view.id, band });
    }
  }
  return out;
}

function evaluate(state: ReturnType<typeof startGateRun>, action: ActionDefinition, acting: string[], support: string[]) {
  const run = state.activeRun!;
  return evaluateAction({ state, run, scenario: getScenario(run.scenarioId)!, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags),
    acting: acting as never, support: support as never });
}

describe('band time', () => {
  const starts = plainStarts();

  it('finds choices to check', () => {
    expect(starts.length).toBeGreaterThan(5);
  });

  it.each([['the saved table', {}], ['a patched table', SLOW]] as const)('commit time equals the preview\'s time for the band, with %s', (_name, patch) => {
    withTuning(patch, () => {
      for (const { id, actionId, band } of starts) {
        const state = startGateRun(id, 719);
        const views = actionViews(state, NOW, 'A');
        const view = views.find(entry => entry.id === actionId)!;
        const action = getScenario(id)!.stages.assess.actions.find(entry => entry.id === actionId)!;
        const ev = evaluate(state, action, view.actingSquadIds, view.supportSquadIds);
        const T = RESOLUTION_TUNING.bandTime;
        // The preview: expected minutes weigh each band's time by its chance; the range spans them.
        expect(ev.timeExpected).toBe(round1(ev.timeBase * (ev.pFavorable * T.favorable + (1 - ev.pFavorable - ev.pAdverse) * T.mixed + ev.pAdverse * T.adverse)));
        const after = applyMove(state, { kind: 'decide', actionId, band }, views);
        expect(after, `${actionId} ${band}`).not.toBeNull();
        const charged = after!.activeRun!.history.at(-1)!.timeCost;
        expect(charged, `${actionId} ${band}`).toBe(round1(Math.max(0.5, ev.timeBase * T[band])));
        expect(charged).toBeGreaterThanOrEqual(view.timeRange.min);
        expect(charged).toBeLessThanOrEqual(view.timeRange.max);
      }
    });
  });

  it('a patch changes what the commit charges', () => {
    const { id, actionId, band } = starts.find(start => start.band === 'mixed') ?? starts[0];
    const charge = (patch: TuningPatch) => withTuning(patch, () => {
      const state = startGateRun(id, 719);
      return applyMove(state, { kind: 'decide', actionId, band })!.activeRun!.history.at(-1)!.timeCost;
    });
    expect(charge(SLOW)).toBeGreaterThan(charge({}));
  });

  it('the clock fork reads the same table', () => {
    expect(CLOCK_RULES_V1).not.toHaveProperty('bandTime');
    const action = { workload: { base: 4, perSqFt: 0 } } as ActionDefinition;
    for (const band of BANDS) expect(forkMinutes(action, band, { extraMinutes: 1 })).toBe(4 * RESOLUTION_TUNING.bandTime[band] + 1);
    withTuning(SLOW, () => {
      expect(forkMinutes(action, 'mixed', {})).toBe(8);
      expect(forkMinutes(action, 'adverse', { extraMinutes: 2 })).toBe(13);
    });
    expect(forkMinutes(action, 'mixed', {})).toBe(4 * RESOLUTION_TUNING.bandTime.mixed);
  });
});
