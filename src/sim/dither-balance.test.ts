// dither-minutes balance (docs/call-pressure.md, "Balance risk"): dither adds minutes to every clock,
// so any rate above zero moves the outcomes. The outcome-score calibration runs at zero dither
// (outcome-score.test.ts plays through balance.ts, which never stalls). This test plays the same
// calls with a player who spends a fixed real time on every decision, at each timer setting, and
// records how the outcomes shift against zero dither: the numbers the rates in CLOCK_RULES_V1.dither
// were chosen against. Same calls and dice; the stall's minutes and its pressure (the odds read it,
// sim/clocks.ts stalledRun) are the only difference, and a pick changes only where they reorder the odds.
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import type { CallTree } from '../content/call-trees/types';
import { startGateRun } from '../gen/incident/gates/engine-driver';
import { drawCalls, summarize, weigh, type CallResult } from '../gen/incident/trees-v13/balance';
import { openDither } from './clocks';
import { actionViews } from './operation-selectors';
import { getScenario } from './scenario-registry';
import { apply } from './test-fixtures';
import type { TimerSetting } from './timer-setting';
import type { GameState } from './types';

const CALLS = 12;
/** Real seconds a player spends on each decision: a quick read, a thoughtful one, a long think. */
const PACES = [30, 60, 120] as const;
const SETTINGS: readonly TimerSetting[] = ['off', 'relaxed', 'standard'];

interface Played { result: CallResult; dither: number[]; tooSlowEverywhere: number }

/** Play one call to its end, best odds first, spending `seconds` of real time on every decision. */
function play(scenarioId: string, seed: number, timer: TimerSetting | null, seconds: number): { state: GameState; dither: number[]; tooSlowEverywhere: number } {
  let state = startGateRun(scenarioId, seed);
  const dither: number[] = [];
  let tooSlowEverywhere = 0;
  for (let step = 0; step < 30; step++) {
    // The player reads the result, then the decision shows and its stall starts (openDecision).
    if (state.activeRun?.decisionPending) state = apply(state, { type: 'openDecision', revision: state.activeRun.revision }, state.activeRun.decisionOpenedAt).state;
    const run = state.activeRun!;
    if (run.status !== 'active' || run.stage === 'debrief') break;
    const scenario = getScenario(run.scenarioId)!;
    const at = run.decisionOpenedAt + seconds * 1000;
    const stall = timer ? openDither(scenario, run, state.department.clockHighWater, at, timer) : 0;
    const views = actionViews(state, at, 'A', stall).filter(view => view.eligible);
    if (!views.length) break;
    // A stage where the stall leaves no choice that keeps the threat off when it goes well.
    if (views.some(view => view.threat) && views.every(view => view.threat?.bands.includes('favorable'))) tooSlowEverywhere++;
    const choice = [...views].sort((a, b) => b.likelihood.favorable - a.likelihood.favorable || a.id.localeCompare(b.id))[0];
    const next = apply(state, { type: 'decide', actionId: choice.id, actingSquadIds: choice.actingSquadIds, supportSquadIds: choice.supportSquadIds, ...(stall > 0 ? { ditherMinutes: stall } : {}) }, at);
    if (!next.result.ok) break;
    dither.push(next.state.activeRun!.history.at(-1)!.ditherMinutes ?? 0);
    state = next.state;
  }
  return { state, dither, tooSlowEverywhere };
}

function playAll(tree: CallTree, timer: TimerSetting | null, seconds: number): Played[] {
  return drawCalls(tree, 2, CALLS).map(({ scenarioId, seed }) => {
    const { state, dither, tooSlowEverywhere } = play(scenarioId, seed, timer, seconds);
    return { result: weigh(tree, state), dither, tooSlowEverywhere };
  });
}

const mean = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100 : 0;

describe('the outcome shift at each timer setting', () => {
  const trees = Object.values(CALL_TREES).filter((tree): tree is CallTree => !!tree);
  const baseline = new Map(trees.map(tree => [tree.type, playAll(tree, null, 0)]));
  const rows = trees.flatMap(tree => PACES.flatMap(seconds => SETTINGS.map(timer => {
    const played = playAll(tree, timer, seconds), base = baseline.get(tree.type)!;
    const summary = summarize(played.map(entry => entry.result)), before = summarize(base.map(entry => entry.result));
    return { tree: tree.type, seconds, timer, played, base,
      ditherPerDecision: mean(played.flatMap(entry => entry.dither)),
      minutesShift: Math.round((summary.meanMinutes - before.meanMinutes) * 10) / 10,
      pointsShift: mean(played.map((entry, i) => (entry.result.points ?? 0) - (base[i].result.points ?? 0))),
      cleanShift: Math.round((summary.weights.clean - before.weights.clean) * 1000) / 1000,
      hurtOrWorseShift: Math.round((summary.weights.hurt + summary.weights.death - before.weights.hurt - before.weights.death) * 1000) / 1000,
      changedEndings: played.filter((entry, i) => entry.result.ending !== base[i].result.ending).length,
      tooSlowEverywhere: played.reduce((n, entry) => n + entry.tooSlowEverywhere, 0) };
  })));

  it('records the shift (printed for tuning)', () => {
    console.table(rows.map(({ played: _p, base: _b, ...row }) => ({ ...row, baseTooSlow: _b.reduce((n, entry) => n + entry.tooSlowEverywhere, 0) })));
    expect(rows.length).toBe(trees.length * PACES.length * SETTINGS.length);
  });

  it('changes nothing with the timer off', () => {
    for (const row of rows.filter(entry => entry.timer === 'off')) {
      expect(row.ditherPerDecision).toBe(0);
      expect(row.played.map(entry => entry.result), `${row.tree} ${row.seconds}s`).toEqual(row.base.map(entry => entry.result));
    }
  });

  it('never stalls more at Relaxed than at Standard', () => {
    for (const tree of trees) for (const seconds of PACES) {
      const at = (timer: TimerSetting) => rows.find(row => row.tree === tree.type && row.seconds === seconds && row.timer === timer)!.ditherPerDecision;
      expect(at('relaxed'), `${tree.type} ${seconds}s`).toBeLessThanOrEqual(at('standard'));
    }
  });

  it('leaves a thoughtful Relaxed player a choice that beats the threat at every stage', () => {
    // Some stages are written so every choice is too slow (a threat that lands whatever the team
    // does); the stall must not add any.
    for (const row of rows.filter(entry => entry.timer === 'relaxed' && entry.seconds <= 60))
      expect(row.tooSlowEverywhere, `${row.tree} ${row.seconds}s`).toBe(row.base.reduce((n, entry) => n + entry.tooSlowEverywhere, 0));
  });
});
