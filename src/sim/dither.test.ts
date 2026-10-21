// dither-minutes (docs/call-pressure.md): a stall on an open decision costs game minutes. The pure
// function, the cap, the saved open time, the commit that records the stall and folds it into the
// decision's minutes, the replay that reads it back, and the previews that show it before a commit.
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { CLOCK_RULES_V1, ditherCap, ditherMinutes, openDither } from './clocks';
import { traceRun } from './operation';
import { actionViews, previewAction } from './operation-selectors';
import { deserialize, serialize } from './save';
import { getScenario } from './scenario-registry';
import { currentStoryThreat } from './story-context';
import { apply, NOW } from './test-fixtures';
import type { GameState } from './types';
import { startGateRun } from '../gen/incident/gates/engine-driver';
import { drawCalls } from '../gen/incident/trees-v13/balance';

const SEC = 1000, MIN = 60 * SEC;
const base = { openedAt: NOW, now: NOW, textLength: 0, cap: 10 };

describe('ditherMinutes', () => {
  it('is always zero when the timer is off', () => {
    expect(ditherMinutes({ ...base, timer: 'off', now: NOW + 600 * MIN })).toBe(0);
  });

  it('counts nothing before the reading floor, then the setting’s rate', () => {
    const { relaxed, standard } = CLOCK_RULES_V1.dither;
    const floor = relaxed.floorSeconds + 240 / relaxed.readingCharsPerSecond;
    const at = (seconds: number, timer: 'relaxed' | 'standard', textLength = 240) => ditherMinutes({ ...base, timer, textLength, now: NOW + seconds * SEC });
    expect(at(floor, 'relaxed')).toBe(0);
    expect(at(floor + 120, 'relaxed')).toBe(2 * relaxed.gameMinutesPerRealMinute);
    // Standard's floor is short and doesn't scale with the text.
    expect(at(standard.floorSeconds + 30, 'standard', 5000)).toBe(0.5 * standard.gameMinutesPerRealMinute);
  });

  it('scales the Relaxed floor with the text', () => {
    const at = (textLength: number) => ditherMinutes({ ...base, timer: 'relaxed', textLength, now: NOW + 90 * SEC });
    expect(at(0)).toBeGreaterThan(at(600));
  });

  it('stops at the cap, never falls as time runs on, and is zero for a time before the open', () => {
    let last = 0;
    for (let seconds = 0; seconds <= 3600; seconds += 7) {
      const value = ditherMinutes({ ...base, timer: 'standard', now: NOW + seconds * SEC });
      expect(value).toBeGreaterThanOrEqual(last);
      expect(value).toBeLessThanOrEqual(base.cap);
      last = value;
    }
    expect(last).toBe(base.cap);
    expect(ditherMinutes({ ...base, timer: 'standard', now: NOW - 600 * MIN })).toBe(0);
  });
});

/** A fresh hostage call at its first decision. */
function hostageStart(seed = 1): GameState {
  const [call] = drawCalls(CALL_TREES.hostage_crisis!, 1, 1, seed);
  return startGateRun(call.scenarioId, call.seed);
}

describe('the open decision', () => {
  const state = hostageStart();
  const run = state.activeRun!;
  const scenario = getScenario(run.scenarioId)!;
  const threat = currentStoryThreat(scenario, run)!;

  it('saves when it opened, and caps the stall at the decision point’s threat', () => {
    expect(run.decisionOpenedAt).toBe(NOW);
    expect(threat.minutes).toBeGreaterThan(0);
    expect(ditherCap(scenario, run)).toBe(threat.minutes);
  });

  it('counts time away once and never less when the device clock moves back', () => {
    const away = NOW + 3 * 3_600_000;
    const after = openDither(scenario, run, away, away, 'standard');
    expect(after).toBe(threat.minutes);
    // The clock moved back to just after the open: the high-water time still holds.
    expect(openDither(scenario, run, away, NOW + 20 * SEC, 'standard')).toBe(after);
    const mid = NOW + 60 * SEC;
    const once = openDither(scenario, run, mid, mid, 'standard');
    expect(openDither(scenario, run, mid, NOW, 'standard')).toBe(once);
  });
});

describe('a commit with dither', () => {
  const state = hostageStart();
  const run = state.activeRun!;
  const scenario = getScenario(run.scenarioId)!;
  const cap = ditherCap(scenario, run);
  const view = actionViews(state, NOW, 'A').find(entry => entry.eligible)!;
  const decide = (ditherMinutes?: number, at = NOW + 5 * MIN) => apply(state, { type: 'decide', actionId: view.id, actingSquadIds: view.actingSquadIds,
    supportSquadIds: view.supportSquadIds, ...(ditherMinutes === undefined ? {} : { ditherMinutes }) }, at);

  it('adds the stall to the decision’s minutes and records it beside the band', () => {
    const plain = decide().state.activeRun!.history[0];
    const stalled = decide(2).state.activeRun!.history[0];
    expect(plain.ditherMinutes).toBeUndefined();
    expect(stalled.band).toBe(plain.band);
    expect(stalled.ditherMinutes).toBe(2);
    expect(stalled.clockBaseMinutes).toBeCloseTo(plain.clockBaseMinutes + 2, 5);
    expect(stalled.timeCost).toBeCloseTo(plain.timeCost + 2, 5);
  });

  it('stops at the open threat however long the stall', () => {
    expect(decide(10_000).state.activeRun!.history[0].ditherMinutes).toBe(cap);
  });

  it('refuses a stall that is not a number of minutes', () => {
    expect(decide(-1).result.ok).toBe(false);
    expect(decide(Number.NaN).result.ok).toBe(false);
  });

  it('opens the next decision at the commit', () => {
    expect(decide(2, NOW + 7 * MIN).state.activeRun!.decisionOpenedAt).toBe(NOW + 7 * MIN);
  });

  it('lands the threat on every band once the stall reaches the cap, and the previews say so first', () => {
    const threatened = actionViews(state, NOW, 'A').filter(entry => entry.threat);
    expect(threatened.length).toBeGreaterThan(0);
    // With no stall, some choice is quick enough that a good result keeps the threat off.
    expect(threatened.some(entry => !entry.threat!.bands.includes('favorable'))).toBe(true);
    for (const entry of actionViews(state, NOW, 'A', cap).filter(item => item.threat)) expect(entry.threat!.bands).toEqual(['favorable', 'mixed', 'adverse']);
    const reviewed = previewAction(state, NOW, view.id, view.actingSquadIds, view.supportSquadIds, undefined, cap)!;
    if (reviewed.threat) expect(reviewed.threat.bands).toContain('favorable');
    expect(reviewed.timeRange!.min).toBeGreaterThanOrEqual(cap);
    const committed = decide(cap).state.activeRun!;
    const landed = scenario.stages.assess.actions.find(action => action.id === view.id)!.threat;
    if (landed) expect(committed.history[0].clockBaseMinutes).toBeGreaterThanOrEqual(landed.minutes);
  });

  it('replays from the record: the trace ends where the commit did', () => {
    const committed = decide(cap).state.activeRun!;
    const { end } = traceRun(scenario, committed);
    expect(end.clock).toBe(committed.clock);
    expect(end.pressure).toBe(committed.pressure);
    expect(end.civilianSafety).toBe(committed.civilianSafety);
    expect([...end.flags].sort()).toEqual([...committed.flags].sort());
    expect(end.knowledge).toEqual(committed.knowledge);
  });

  it('saves and loads the open time and the stall, and rejects a stall larger than its decision', () => {
    const after = decide(2).state;
    const loaded = deserialize(serialize(after, NOW))!;
    expect(loaded.activeRun!.decisionOpenedAt).toBe(after.activeRun!.decisionOpenedAt);
    expect(loaded.activeRun!.history[0].ditherMinutes).toBe(2);
    const bad = structuredClone(after);
    bad.activeRun!.history[0].ditherMinutes = bad.activeRun!.history[0].clockBaseMinutes + 1;
    expect(deserialize(serialize(bad, NOW))).toBeNull();
    const missing = structuredClone(after) as unknown as { activeRun: Record<string, unknown> };
    delete missing.activeRun.decisionOpenedAt;
    expect(deserialize(serialize(missing as unknown as GameState, NOW))).toBeNull();
  });
});
