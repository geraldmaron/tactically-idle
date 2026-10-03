import { describe, expect, it } from 'vitest';
import { ITEMS } from '../content/items';
import { apply, makeState, NOW, playPolicy, startCmd, unitId } from './test-fixtures';
import { dispatch } from './game';
import { planActionResupply } from './equipment-resupply';
import { advanceTime, unitsUsedTotals } from './operation';
import { getScenario } from './scenario-registry';
import { deserialize, serialize } from './save';
import { availableUnits } from './resolution';
import type { GameState } from './types';

function withVan(): GameState {
  const state = makeState({ inventory: { support_van: 1 } });
  state.officers.off_brooks.certs.push('vehicle_operations');
  const command = { ...startCmd('ms_occupancy', ['A'], { loadouts: { A: {} } }), supportUnitIds: [unitId('support_van')] };
  const started = apply(state, command); expect(started.result).toEqual({ ok: true });
  return started.state;
}
const supply = { type: 'resupplyAction', actionId: 'ms_contact_hall', actingSquadIds: ['A'], supportSquadIds: [] } as const;
const deliver = (state: GameState) => dispatch(state, { ...supply, actingSquadIds: [...supply.actingSquadIds], supportSquadIds: [] }, { now: NOW });

describe('exact exterior support reservation and resupply', () => {
  it('takes the vehicle only in its explicit slot, leaves radios intact, and releases it on cancel', () => {
    const state = withVan();
    expect(state.reservations.filter((r) => r.itemId === 'radio_kit')).toHaveLength(4);
    expect(state.reservations.filter((r) => r.itemId === 'support_van')).toHaveLength(1);
    expect(state.activeRun!.supportPositionId).toBe('front_yard');
    expect(availableUnits(state, state.activeRun!, 'A').some((u) => ITEMS[u.itemId].supportOnly)).toBe(false);
    const cancelled = apply(state, { type: 'cancelOperation' });
    expect(cancelled.result).toEqual({ ok: true });
    expect(cancelled.state.units[unitId('support_van')].status).toBe('ready');
    expect(cancelled.state.reservations).toHaveLength(0);
  });
  it('shortens real resupply from three to two minutes, including planner, pressure and debrief vehicle wear', () => {
    const state = withVan();
    const plan = planActionResupply(state, NOW, supply.actionId, ['A'], []);
    expect(plan).toMatchObject({ ok: true, minutes: 2 });
    const expected = { ...state.activeRun! }; advanceTime(expected, getScenario('ms_occupancy')!, 2);
    const normal = structuredClone(state); normal.activeRun!.supportUnitIds = [];
    expect(planActionResupply(normal, NOW, supply.actionId, ['A'], []).minutes).toBe(3);
    const next = deliver(state); expect(next.result).toEqual({ ok: true });
    expect(next.state.activeRun).toMatchObject({ clock: expected.clock, pressure: expected.pressure });
    expect(unitsUsedTotals(next.state.activeRun!)).toContain(unitId('support_van'));
    const again = deliver(next.state); expect(again.result.ok).toBe(false); expect(again.state).toBe(next.state);
    const done = playPolicy(next.state, { assess: ['ms_gather'] });
    expect(done.debrief.unitWear.some((w) => w.itemId === 'support_van' && w.after < w.before)).toBe(true);
    expect(done.state.units[unitId('support_van')].uses).toBe(1);
  });
  it('rejects backpack vehicles, duplicate slot allocation, missing qualification and broken stock atomically', () => {
    const state = makeState({ inventory: { support_van: 2 } });
    const base = { ...startCmd('ms_occupancy', ['A'], { loadouts: { A: {} } }), supportUnitIds: [unitId('support_van')] };
    expect(apply(state, base).result).toMatchObject({ ok: false });
    state.officers.off_brooks.certs.push('vehicle_operations');
    for (const cmd of [
      { ...base, supportUnitIds: [unitId('support_van'), unitId('support_van', 2)] },
      { ...base, units: { A: [unitId('support_van')] } },
      { ...base, supportUnitIds: [], loadouts: { A: { support_van: 1 } } },
    ]) { const result = apply(state, cmd); expect(result.result.ok).toBe(false); expect(result.state).toBe(state); }
    state.units[unitId('support_van')].status = 'service';
    expect(apply(state, base).result.ok).toBe(false);
  });
  it('the same support operator must hold all required vehicle qualifications', () => {
    const state = makeState({ inventory: { support_van: 1 } });
    const original = ITEMS.support_van.requiresCerts;
    try {
      ITEMS.support_van.requiresCerts = ['vehicle_operations', 'controlled_access'];
      state.officers.off_brooks.certs.push('vehicle_operations');
      state.officers.off_chen.certs.push('controlled_access');
      const cmd = { ...startCmd('ms_occupancy', ['A'], { loadouts: { A: {} } }), supportUnitIds: [unitId('support_van')] };
      expect(apply(state, cmd).result.ok).toBe(false);
      state.officers.off_brooks.certs.push('controlled_access');
      expect(apply(state, cmd).result.ok).toBe(true);
    } finally { ITEMS.support_van.requiresCerts = original; }
  });
  it('saves exact support reservation and delivered minutes without granting new vehicles on reload', () => {
    const state = deliver(withVan()).state; state.saveVersion = 3;
    const saved = deserialize(serialize(state, NOW))!;
    expect(saved.activeRun?.supportUnitIds).toEqual([unitId('support_van')]);
    expect(saved.activeRun?.resupplies?.[0]).toMatchObject({ minutes: 2, supportUnitId: unitId('support_van') });
    expect(Object.values(saved.units).filter((u) => u.itemId === 'support_van')).toHaveLength(1);
    expect(saved.reservations.filter((r) => r.itemId === 'support_van')).toHaveLength(1);
    expect(deliver(saved).result.ok).toBe(false);
  });
});
