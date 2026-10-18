import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { drawCalls, playToEnd, POLICIES } from '../gen/incident/trees-v13/balance';
import { computeDebrief } from './operation';
import { deserialize, serialize } from './save';
import { apply, NOW } from './test-fixtures';
import type { GameState } from './types';

const harmed: GameState[] = [];
for (const tree of Object.values(CALL_TREES)) for (const { scenarioId, seed } of drawCalls(tree!, 2, 8)) for (const policy of POLICIES) {
  const state = playToEnd(scenarioId, policy, seed);
  if (state.activeRun!.status === 'debrief' && Object.keys(state.activeRun!.personCasualties ?? {}).length) harmed.push(state);
}

describe('current completion preserves actual harm and care duties', () => {
  it('retains every casualty and its care state when a call ends and reloads', () => {
    expect(harmed.length).toBeGreaterThan(0);
    for (const state of harmed) {
      const report = computeDebrief(state, state.activeRun!)!;
      expect(report.personCasualties).toEqual(Object.values(state.activeRun!.personCasualties!));
      expect(deserialize(serialize(state, NOW))?.activeRun).toEqual(state.activeRun);
      if (Object.values(state.activeRun!.personCasualties!).some(person => person.care === 'deceased')) expect(report.completionAchieved).toBe(false);
    }
  });
  it('settles the recorded result once without granting care or rewards on a repeated close', () => {
    for (const state of harmed) {
      const report = computeDebrief(state, state.activeRun!)!;
      const closed = apply(state, { type: 'closeDebrief' });
      expect(closed.result).toEqual({ ok: true });
      expect(closed.state.debriefs[0].personCasualties).toEqual(report.personCasualties);
      const repeated = apply(closed.state, { type: 'closeDebrief' });
      expect(repeated.result.ok).toBe(false);
      expect(repeated.state).toEqual(closed.state);
    }
  });
});
