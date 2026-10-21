// The hostage call's held endings read the owner's clock at the end of the decision's real minutes
// (heldEnd's OWNER_OUT, docs/calls/hostage-signature-design.md "The owner_down cleanup"). This is
// a natural run of the gap: a held decision (threat.step_back, adverse) whose minutes run the
// owner's clock out. The call must end at owner_left_down with the down line, never at held_inside
// with the owner hurt and nothing said. The policy seed is re-found when the menu changes the choices
// a random walk can take (1091 until sidearms were issued on day one, 687 until the depth pilot
// changed the talking menu, 825 until the conflict rebuild of 2026-10-20 added threats and options).
import { describe, expect, it } from 'vitest';
import { generateIncident } from '../../gen/incident';
import { playToEnd } from '../../gen/incident/trees-v13/balance';

describe('hostage call: the owner collapsing in a held decision', () => {
  it('ends at owner_left_down, with the line, when the clock runs out in a held decision', () => {
    const scenario = generateIncident({ type: 'hostage_crisis', familyId: 'corner_store_flat_g2', buildingSeed: 180916087, seed: 68600050, tier: 2, contentVersion: 13 });
    expect(scenario.id).toBe('gen:hostage_crisis:corner_store_flat_g2:180916087:68600050:2:13');
    const run = playToEnd(scenario.id, 'random', 730).activeRun!;
    const last = run.history.at(-1)!;
    expect([last.actionId, last.band]).toEqual(['t13_hostage_crisis_threat_step_back', 'adverse']);
    expect(run.clocks?.owner_condition?.value).toBe(0);
    expect(run.personCasualties?.owner?.severity).toBe('serious');
    expect(run.flags).toContain('end:owner_left_down');
    expect(run.flags).not.toContain('end:held_inside');
    expect(last.explanation.join(' ')).toMatch(/goes down, and \w+ stands over/);
  }, 60_000);
});
