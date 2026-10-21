import { describe, expect, it } from 'vitest';
import { getScenario } from './scenario-registry';
import { comebackTier, playerProfile, PROFILE_TUNING, recordStall, sourceStarts } from './player-profile';
import { createInitialState } from './department';
import { testCallId } from './test-fixtures';
import type { DebriefResult, GameState } from './types';

const NOW = Date.UTC(2026, 0, 5, 12);
const state = (): GameState => createInitialState(NOW, 4242);
const result = (score: number) => ({ objective: { score }, civilianSafety: { score } }) as unknown as DebriefResult;
const adverse = result(0), favorable = result(100);

describe('the player profile', () => {
  it('learns a stall habit as a moving average, silent until warmup', () => {
    const s = state();
    for (let i = 0; i < PROFILE_TUNING.warmup - 1; i++) recordStall(s.department, 1);
    expect(playerProfile(s).stall).toBe(0);
    recordStall(s.department, 1);
    const learned = playerProfile(s).stall;
    expect(learned).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) recordStall(s.department, 0);
    expect(playerProfile(s).stall).toBeLessThan(learned);
  });

  it('reads the spend mix from the ledger’s spending, never its income', () => {
    const s = state();
    s.department.ledger = [
      { seq: 1, at: NOW, amount: -300, before: 0, after: 0, kind: 'purchase', label: 'kit' },
      { seq: 2, at: NOW, amount: -100, before: 0, after: 0, kind: 'training', label: 'course' },
      { seq: 3, at: NOW, amount: 5000, before: 0, after: 0, kind: 'payout', label: 'call' },
    ];
    expect(playerProfile(s).spend).toEqual({ kit: 0.75, people: 0, training: 0.25, facilities: 0 });
  });

  it('counts bad results in a row, newest first, and stops at the first good one', () => {
    const s = state();
    s.debriefs = [adverse, adverse, favorable, adverse];
    expect(playerProfile(s).adverseStreak).toBe(2);
  });
});

describe('what reads it', () => {
  it('draws the next call a tier lower after a bad run, and says so', () => {
    expect(comebackTier({ adverseStreak: PROFILE_TUNING.comebackStreak }, 3)).toEqual({ tier: 2, eased: true });
    expect(comebackTier({ adverseStreak: PROFILE_TUNING.comebackStreak - 1 }, 3)).toEqual({ tier: 3, eased: false });
    expect(comebackTier({ adverseStreak: 9 }, 1)).toEqual({ tier: 1, eased: false });
  });

  it('starts a pressure source higher for a hard name and a stalling habit, short of its first cue', () => {
    const scenario = getScenario(testCallId('hostage'))!;
    expect(sourceStarts(scenario, { posture: 0, stall: 0 })).toBeUndefined();
    expect(sourceStarts(scenario, { posture: -1, stall: 0 }), 'a name for talking draws no crowd').toBeUndefined();
    const lifted = sourceStarts(scenario, { posture: 1, stall: 1 })!;
    for (const def of scenario.clocks!.filter((clock) => clock.source)) {
      expect(lifted[def.id]).toBeGreaterThan(def.start);
      expect(lifted[def.id]).toBeLessThan(def.cues[0].at);
    }
  });
});
