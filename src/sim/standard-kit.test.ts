import { describe, expect, it } from 'vitest';
import { CALENDAR } from './calendar';
import { createInitialState } from './department';
import { ITEMS } from '../content/items';
import { standardRadioPlan, withStandardRadios } from './standard-kit';
import { autoLoadout } from './auto-equip';
import { prepCheck } from './operation-selectors';
import { deserialize, serialize } from './save';
import { apply, makeState, makeUnit, NOW, startCmd, startRun, unitId } from './test-fixtures';

describe('automatic standard radios', () => {
  it('requires one actual officer radio without altering manual optional gear or buying stock', () => {
    const state = makeState();
    const before = structuredClone(state);
    const manual = { A: { radio_kit: 0, throw_phone: 0, trauma_kit: 2 }, B: { radio_kit: 99 } };
    const plan = withStandardRadios(state, ['B', 'A'], manual, { A: [unitId('radio_kit', 8), unitId('trauma_kit', 2)] }, NOW);
    expect(plan.loadouts).toEqual({ A: { radio_kit: 4, throw_phone: 0, trauma_kit: 2 }, B: { radio_kit: 4 } });
    expect(plan.units.A).toContain(unitId('trauma_kit', 2));
    const radios = Object.values(plan.units).flat().filter((id) => state.units[id].itemId === 'radio_kit');
    expect(radios).toHaveLength(8);
    expect(new Set(radios).size).toBe(8);
    expect(state).toEqual(before);
    expect(manual.A.radio_kit).toBe(0);
  });

  it('automatically adjusts for adding, removing and changing squad rosters', () => {
    const state = makeState();
    expect(standardRadioPlan(state, ['A'], NOW).required).toBe(4);
    state.squads[0].officerIds.pop();
    expect(standardRadioPlan(state, ['B', 'A', 'A'], NOW).required).toBe(7);
    expect(standardRadioPlan(state, ['A'], NOW).units.A).toHaveLength(3);
    expect(standardRadioPlan(state, [], NOW).units).toEqual({});
  });

  it('chooses distinct best-condition usable units, excluding busy, expired and failed stock at current time', () => {
    const state = makeState({ inventory: { radio_kit: 0 } });
    const radio = (n: number, over = {}) => makeUnit('radio_kit', n, over);
    const units = [radio(1, { condition: 65 }), radio(2, { condition: 95 }), radio(3, { status: 'reserved' }),
      radio(4, { status: 'service' }), radio(5, { expiresAt: NOW }), radio(6, { condition: ITEMS.radio_kit.wear.failAt }),
      radio(7, { condition: 16 }), radio(8, { condition: 85 }), radio(9, { status: 'scrapped' }), radio(10, { status: 'expired' })];
    for (const unit of units) state.units[unit.id] = unit;
    state.reservations.push({ id: 'existing', runId: 'other', squadId: 'B', itemId: 'radio_kit', unitId: unitId('radio_kit', 8) });
    const plan = standardRadioPlan(state, ['A'], NOW + 10 * CALENDAR.gameDayMs);
    expect(plan.units.A).toEqual([unitId('radio_kit', 2), unitId('radio_kit', 1)]);
    expect(plan.shortage).toBe(2);
    expect(standardRadioPlan(state, ['A'], NOW - 1).units.A).not.toContain(unitId('radio_kit', 5));
  });

  it('blocks eight-officer live starts with six radios, while one squad can deploy automatically', () => {
    const state = makeState({ inventory: { radio_kit: 6 } });
    const command = startCmd('ms_occupancy', ['A', 'B'], { loadouts: { A: {}, B: {} } });
    const before = structuredClone(state);
    const check = prepCheck(state, NOW, command);
    expect(check.ok).toBe(false);
    expect(check.issues[0]).toMatch(/8 officers need 8 Radio headsets; only 6 usable \(2 short\)/);
    expect(apply(state, command).result).toMatchObject({ ok: false });
    expect(state).toEqual(before);
    const live = apply(state, startCmd('ms_occupancy', ['A'], { loadouts: { A: {} } }));
    expect(live.result.ok).toBe(true);
    expect(live.state.reservations.filter((r) => r.itemId === 'radio_kit')).toHaveLength(4);
    expect(live.state.department.funding).toBe(before.department.funding);
  });

  it('normalizes radio zero/excess quantities and explicit selections at the engine boundary', () => {
    for (const quantity of [0, 1, 99]) {
      const state = makeState();
      state.units[unitId('radio_kit', 8)].condition = 25;
      const live = startRun(state, 'ms_occupancy', ['A'], { loadouts: { A: { radio_kit: quantity } }, units: { A: [unitId('radio_kit', 8)] } });
      expect(live.reservations).toHaveLength(4);
      expect(live.reservations.map((r) => r.unitId)).not.toContain(unitId('radio_kit', 8));
    }
  });

  it('keeps repeat previews stable and reserves exactly the displayed radios', () => {
    const state = createInitialState(NOW);
    const plan = autoLoadout(state, 'ms_occupancy', ['A'], NOW);
    const repeated = autoLoadout(state, 'ms_occupancy', ['A'], NOW, plan);
    expect(repeated.units).toEqual(plan.units);
    expect(repeated.added).toBe(0);
    const started = startRun(state, 'ms_occupancy', ['A'], plan);
    expect(started.reservations.map((r) => r.unitId).sort()).toEqual(Object.values(plan.units).flat().sort());
    const restored = deserialize(serialize(started, NOW));
    expect(restored?.reservations).toEqual(started.reservations);
    const cancelled = apply(restored!, { type: 'cancelOperation' });
    expect(cancelled.result.ok).toBe(true);
    expect(cancelled.state.reservations).toEqual([]);
    expect(cancelled.state.units).toEqual(state.units);
  });

  it('never invents physical radios and does not migrate legacy active reservations', () => {
    const empty = makeState({ inventory: { radio_kit: 0 } });
    expect(apply(empty, startCmd('ms_occupancy', ['A'])).result).toMatchObject({ ok: false, reason: expect.stringContaining('Standard radios') });
    const legacy = startRun(createInitialState(NOW), 'ms_occupancy', ['A'], { loadouts: { A: {} } });
    const kept = legacy.reservations.find((r) => r.itemId === 'radio_kit')!;
    for (const r of legacy.reservations) if (r.itemId === 'radio_kit' && r !== kept) legacy.units[r.unitId].status = 'ready';
    legacy.reservations = legacy.reservations.filter((r) => r.itemId !== 'radio_kit' || r === kept);
    legacy.activeRun!.reservationIds = legacy.reservations.map((r) => r.id);
    const restored = deserialize(serialize(legacy, NOW));
    expect(restored).not.toBeNull();
    expect(restored?.reservations).toEqual(legacy.reservations);
    expect(restored?.units).toEqual(legacy.units);
  });
});
