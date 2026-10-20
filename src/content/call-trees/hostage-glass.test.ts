// The hostage call's armed lines (TreeState.armed, R-G1) claim the team has seen what the
// coworkers hold. This holds the claim to the engine: in every drawn group call, a favorable
// glass_group look settles each coworker's weapon fact (sim/sightings.ts) and sets saw_inside.
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '.';
import type { CallTree } from './types';
import { getScenario } from '../../sim/scenario-registry';
import { applyMove, availableMoves, startGateRun } from '../../gen/incident/gates/engine-driver';
import { drawCalls } from '../../gen/incident/trees-v13/balance';

describe('hostage call: the glass look in a group call', () => {
  it('settles every coworker’s weapon fact whenever it sets saw_inside', () => {
    const tree = CALL_TREES.hostage_crisis as CallTree;
    let checked = 0;
    for (const { scenarioId } of drawCalls(tree, 3, 120)) {
      const members = (getScenario(scenarioId)!.incidentPeople ?? []).filter(person => person.id.startsWith('others_'));
      if (!members.length) continue;
      let state = startGateRun(scenarioId);
      const take = (suffix: string, band: 'favorable' | 'adverse') => {
        const move = availableMoves(state).find(m => m.actionId.endsWith(suffix) && m.band === band);
        const next = move && applyMove(state, move);
        if (next) state = next;
        return !!next;
      };
      // Both still inside: the courier's walk-out going badly now ends in a shot, so reach it by an unheard opening.
      if (!take('_offer_hear_him', 'adverse')) continue;
      expect(members.map(person => state.activeRun!.knowledge[person.armamentFactId!])).toEqual(members.map(() => 'unknown'));
      expect(take('_both_inside_glass_group', 'favorable')).toBe(true);
      const run = state.activeRun!;
      expect(run.flags.some(flag => flag.includes('saw_inside'))).toBe(true);
      for (const person of members) expect(['confirmed', 'disproved']).toContain(run.knowledge[person.armamentFactId!]);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  }, 300_000);
});
