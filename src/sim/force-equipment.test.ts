import { describe, expect, it } from 'vitest';
import { generateIncident } from '../gen/incident';
import { applyMove, availableMoves, drawnAt, NOW, startGateRun } from '../gen/incident/gates/engine-driver';
import { FORCE_REASONS } from '../content/incidents/lines';
import { qualifiedForceUnit } from './force-risk';
import { actionViews } from './operation-selectors';
import { computeDebrief } from './operation';
import { makeUnit } from './test-fixtures';
import type { GameState } from './types';

const scenario = () => generateIncident({ type: 'active_armed_incident', familyId: 'market_row', buildingSeed: 7, seed: 3, tier: 2, contentVersion: 13 });

/** Reach force through actual choices, without inventing a node, threat or participant. */
function forceDecision(start: GameState) {
  const queue = [start];
  for (let i = 0; i < queue.length && i < 150; i++) {
    const state = queue[i];
    if (state.activeRun?.status !== 'active' || state.activeRun.stage === 'debrief') continue;
    const views = actionViews(state, NOW, 'A');
    for (const move of availableMoves(state, views)) {
      if (move.kind !== 'decide') continue;
      const view = views.find(view => view.id === move.actionId)!;
      const forces = drawnAt(state, view, move.band!).filter(dist => dist.model === 'team_force');
      const after = applyMove(state, move, views);
      if (!after) continue;
      if (forces.length) return { state, view, forces, after };
      queue.push(after);
    }
  }
  throw new Error('No reachable team force decision');
}

describe('current armed call force equipment', () => {
  it.each([{ items: [] }, { items: ['radio_kit'] }])('never fires with only $items carried, in previews or the commit', ({ items }) => {
    const { view, forces, after } = forceDecision(startGateRun(scenario().id, 719, { items }));
    expect(view.forceRisk).toBeUndefined(); // Retired authored preview, never a phantom firearm.
    expect(forces.flatMap(dist => dist.results).every(result => result.key.startsWith('hands:'))).toBe(true);
    const force = after.activeRun!.history.at(-1)!.committed!.drawn!.find(record => record.model === 'team_force')!;
    expect(force.key).toMatch(/^hands:/);
    expect(force.reason).toContain(FORCE_REASONS.no_firearm);
    expect(computeDebrief(after, after.activeRun!)!.forceLines).toContainEqual(expect.objectContaining({ reason: force.reason }));
    expect(after.activeRun!.history.at(-1)!.committed!.forceOutcome).toBeUndefined();
  });

  it('fires when an acting officer is qualified and the squad carries a serviceable sidearm', () => {
    const { view, forces, after } = forceDecision(startGateRun(scenario().id, 719, { items: ['service_sidearm'], certs: ['entry_team'] }));
    expect(view.forceRisk).toBeUndefined();
    expect(forces.flatMap(dist => dist.results).every(result => result.key.startsWith('firearm:'))).toBe(true);
    expect(after.activeRun!.history.at(-1)!.committed!.drawn).toContainEqual(expect.objectContaining({ model: 'team_force', key: expect.stringMatching(/^firearm:/) }));
  });

  it.each(['unqualified', 'broken', 'expired', 'servicing'] as const)('falls back from a carried sidearm when %s', fault => {
    const state = startGateRun(scenario().id, 719, { items: ['service_sidearm'], certs: ['entry_team'] });
    if (fault === 'unqualified') for (const officer of Object.values(state.officers)) officer.certs = [];
    const unit = Object.values(state.units).find(unit => unit.itemId === 'service_sidearm')!;
    if (fault === 'broken') unit.condition = 0;
    if (fault === 'expired') unit.expiresAt = state.department.clockHighWater;
    if (fault === 'servicing') unit.status = 'service';
    const { forces, after } = forceDecision(state);
    expect(forces.flatMap(dist => dist.results).some(result => result.key.startsWith('firearm:'))).toBe(false);
    expect(after.activeRun!.history.at(-1)!.committed!.drawn!.find(record => record.model === 'team_force')!.key).toMatch(/^hands:/);
  });

  it('requires the qualified officer to participate for every tool', () => {
    const state = startGateRun(scenario().id, 719, { items: [], certs: ['entry_team', 'less_lethal', 'advanced_less_lethal'] });
    const qualified = state.squads.find(squad => squad.id === 'A')!.officerIds[0];
    for (const [profile, item] of [['firearm', 'service_sidearm'], ['less_lethal_device', 'conducted_energy_device'], ['less_lethal_impact', 'impact_launcher']] as const) {
      const unit = makeUnit(item, 999);
      expect(qualifiedForceUnit(state, profile, [unit], [])).toBeUndefined();
      expect(qualifiedForceUnit(state, profile, [unit], ['missing'])).toBeUndefined();
      expect(qualifiedForceUnit(state, profile, [unit], [qualified])).toBe(unit);
      unit.condition = 0;
      expect(qualifiedForceUnit(state, profile, [unit], [qualified])).toBeUndefined();
    }
  });
});
