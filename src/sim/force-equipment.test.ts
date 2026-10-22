import { decisionsOf } from './types';
import { describe, expect, it } from 'vitest';
import { applyMove, availableMoves, drawnAt, NOW, startGateRun } from '../gen/incident/gates/engine-driver';
import { FORCE_REASONS } from '../content/incidents/lines';
import { qualifiedForceUnit } from './force-risk';
import { actionViews } from './operation-selectors';
import { computeDebrief } from './operation';
import { makeUnit } from './test-fixtures';
import type { GameState } from './types';
import { departmentUpkeep } from './equipment-manager-policy';
import { fixtureIncident } from './test-fixtures';
import { basicUnits, isBasicUnit } from './basic-kit';

const scenario = () => fixtureIncident({ type: 'active_armed_incident', familyId: 'market_row', buildingSeed: 7, seed: 3, tier: 2, contentVersion: 13 });

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
  // Every officer carries a sidearm (basic-kit.ts), with no certification: nothing packed, nobody
  // entry-trained, and the squad can still fire. The built-in sidearm is never worn or counted as used.
  it('fires the basic sidearm with nothing packed and no entry training, in previews and the commit', () => {
    const state = startGateRun(scenario().id, 719, { items: [] });
    for (const officer of Object.values(state.officers)) officer.certs = [];
    const { view, forces, after } = forceDecision(state);
    expect(view.forceRisk).toBeUndefined(); // Retired authored preview.
    expect(forces.flatMap(dist => dist.results).every(result => result.key.startsWith('firearm:'))).toBe(true);
    const decision = decisionsOf(after.activeRun!.history).at(-1)!;
    const force = decision.committed!.drawn!.find(record => record.model === 'team_force')!;
    expect(force.key).toMatch(/^firearm:/);
    expect(force.reason).not.toContain(FORCE_REASONS.no_firearm);
    expect(computeDebrief(after, after.activeRun!)!.forceLines).toContainEqual(expect.objectContaining({ reason: force.reason }));
    expect(decision.unitsUsed.filter(isBasicUnit)).toEqual([]);
  });

  it('fires when an acting officer is qualified and the squad carries a serviceable sidearm', () => {
    const { view, forces, after } = forceDecision(startGateRun(scenario().id, 719, { items: ['service_sidearm'], certs: ['entry_team'] }));
    expect(view.forceRisk).toBeUndefined();
    expect(forces.flatMap(dist => dist.results).every(result => result.key.startsWith('firearm:'))).toBe(true);
    expect(decisionsOf(after.activeRun!.history).at(-1)!.committed!.drawn).toContainEqual(expect.objectContaining({ model: 'team_force', key: expect.stringMatching(/^firearm:/) }));
  });

  // A packed firearm that cannot be used gives way to the basic sidearm every squad carries, which
  // never breaks, expires or goes in for service.
  it.each(['unqualified', 'broken', 'expired', 'servicing'] as const)('falls back from a carried shotgun to the basic sidearm when %s', fault => {
    const state = startGateRun(scenario().id, 719, { items: [], certs: ['entry_team'] });
    const officer = state.squads.find(squad => squad.id === 'A')!.officerIds[0];
    if (fault === 'unqualified') state.officers[officer].certs = [];
    const shotgun = makeUnit('response_shotgun', 1);
    if (fault === 'broken') shotgun.condition = 0;
    if (fault === 'expired') shotgun.expiresAt = state.department.clockHighWater;
    if (fault === 'servicing') shotgun.status = 'service';
    expect(qualifiedForceUnit(state, 'firearm', [shotgun], [officer], departmentUpkeep(state))).toBeUndefined();
    expect(qualifiedForceUnit(state, 'firearm', [shotgun, ...basicUnits('A')], [officer], departmentUpkeep(state))?.id).toMatch(/^basic:A:/);
  });

  it('requires the qualified officer to participate for every tool', () => {
    const state = startGateRun(scenario().id, 719, { items: [], certs: ['entry_team', 'less_lethal', 'advanced_less_lethal'] });
    const qualified = state.squads.find(squad => squad.id === 'A')!.officerIds[0];
    for (const [profile, item] of [['firearm', 'service_sidearm'], ['less_lethal_device', 'conducted_energy_device'], ['less_lethal_impact', 'impact_launcher']] as const) {
      const unit = makeUnit(item, 999);
      expect(qualifiedForceUnit(state, profile, [unit], [], departmentUpkeep(state))).toBeUndefined();
      expect(qualifiedForceUnit(state, profile, [unit], ['missing'], departmentUpkeep(state))).toBeUndefined();
      expect(qualifiedForceUnit(state, profile, [unit], [qualified], departmentUpkeep(state))).toBe(unit);
      unit.condition = 0;
      expect(qualifiedForceUnit(state, profile, [unit], [qualified], departmentUpkeep(state))).toBeUndefined();
    }
  });

  describe('less-lethal supplies', () => {
    const device = (key: string) => key.startsWith('less_lethal_device:');
    const armed = (seed: number) => fixtureIncident({ type: 'active_armed_incident', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const kit = (seed: number, supplies: string[]) => startGateRun(armed(seed).id, 719, { items: ['conducted_energy_device', ...supplies], certs: ['less_lethal'] });
    /** The first call seed whose reachable force decision is within the device's reach. */
    function inReach(supplies: string[]) {
      for (let seed = 1; seed <= 25; seed++) {
        try {
          const found = forceDecision(kit(seed, ['energy_cartridge']));
          if (found.forces.flatMap(dist => dist.results).some(result => device(result.key))) return { seed, state: kit(seed, supplies) };
        } catch { continue; }
      }
      throw new Error('No call seed reaches a device-range force decision');
    }

    it('does not count a device with no cartridge as carried', () => {
      const { state } = inReach([]);
      const { forces } = forceDecision(state);
      expect(forces.flatMap(dist => dist.results).some(result => device(result.key))).toBe(false);
    });

    it('spends one cartridge when the device is used, and says so', () => {
      const { state } = inReach(['energy_cartridge']);
      const { after } = forceDecision(state);
      const decision = decisionsOf(after.activeRun!.history).at(-1)!;
      expect(decision.committed!.drawn!.find(record => record.model === 'team_force')!.key).toMatch(/^less_lethal_device:/);
      expect(decision.itemsConsumed).toContainEqual({ itemId: 'energy_cartridge', qty: 1 });
      expect(decision.unitsUsed.filter(id => after.units[id].itemId === 'energy_cartridge')).toHaveLength(1);
    });
  });
});
