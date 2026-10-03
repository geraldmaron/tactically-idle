import { describe, expect, it } from 'vitest';
import { planAuto, planPreparationEquipment } from './autoPlan';
import { makeState, NOW, unitId } from '../../sim/test-fixtures';
import { SCENARIOS } from '../../content/scenarios';
import type { AutoLoadout } from '../../sim/auto-equip';

const item: Record<string, string> = { u1: 'thermal', u2: 'thermal', u3: 'radio', u4: 'radio' };
const res: AutoLoadout = {
  loadouts: { A: { thermal: 1, radio: 1, medkit: 0 }, B: { thermal: 1, radio: 1 } },
  units: { A: ['u1', 'u3'], B: ['u2', 'u4'] },
  rationale: { A: ['Thermal imager to Alpha'], B: [] },
  warnings: [],
  added: 4,
};
const itemOf = (id: string) => item[id];

describe('planAuto', () => {
  it('adapts the complete engine plan without dropping manual zero choices or exact units', () => {
    const p = planAuto({ res, targets: ['A', 'B'], itemOf });
    expect(p.loadouts).toEqual(res.loadouts);
    expect(p.explicit).toEqual({ A: { thermal: ['u1'], radio: ['u3'] }, B: { thermal: ['u2'], radio: ['u4'] } });
    expect(p.notes.A).toEqual({ lines: ['Thermal imager to Alpha'], edited: false });
    expect(p.total).toBe(4);
  });

  it('updates only the requested squad, once', () => {
    const p = planAuto({ res, targets: ['B', 'B'], itemOf });
    expect(p.loadouts).toEqual({ B: res.loadouts.B });
    expect(p.explicit).toEqual({ B: { thermal: ['u2'], radio: ['u4'] } });
    expect(p.total).toBe(2);
  });

  it('does not reduce a retained manual quantity whose shortage is reported by the engine', () => {
    const p = planAuto({ res: { ...res, loadouts: { A: { thermal: 3 } }, units: { A: ['u1'] }, warnings: ['Only 1 of 3 usable thermal imagers'], added: 0 }, targets: ['A'], itemOf });
    expect(p.loadouts.A).toEqual({ thermal: 3 });
    expect(p.explicit.A).toEqual({ thermal: ['u1'] });
  });

  it('skips absent target results and never aliases input objects', () => {
    const p = planAuto({ res, targets: ['A', 'C'], itemOf });
    expect(p.loadouts.C).toBeUndefined();
    p.loadouts.A!.radio = 9;
    p.notes.A!.lines.push('edited');
    expect(res.loadouts.A!.radio).toBe(1);
    expect(res.rationale.A).toHaveLength(1);
  });
});


describe('contextual preparation equipment', () => {
  const thermal = Object.values(SCENARIOS.ms_occupancy.stages).flatMap((stage) => stage.actions).find((action) => action.requires.allTags?.includes('thermal'))!;

  it('equips a complete required bundle from stock while retaining manual optional choices', () => {
    const state = makeState({ inventory: { thermal_imager: 1 } });
    const before = structuredClone(state);
    const plan = planPreparationEquipment({ state, now: NOW, action: thermal, squadId: 'A', chosen: ['A'], loadouts: { A: { throw_phone: 0, radio_kit: 4 } }, picks: {} });
    expect(plan.issue).toBeNull();
    expect(plan.added).toBe(2);
    expect(plan.loadout).toMatchObject({ thermal_imager: 1, battery_pack: 1, throw_phone: 0, radio_kit: 4 });
    expect(plan.explicit.thermal_imager).toEqual([unitId('thermal_imager')]);
    expect(plan.label).toContain('Battery pack');
    expect(state).toEqual(before);
  });

  it('does not offer a repair when a companion item is unavailable or assigned elsewhere', () => {
    const state = makeState({ inventory: { thermal_imager: 1, battery_pack: 0 } });
    const args = { state, now: NOW, action: thermal, squadId: 'A' as const, chosen: ['A' as const, 'B' as const], loadouts: { A: { thermal_imager: 0 } }, picks: {} };
    const incomplete = planPreparationEquipment(args);
    expect(incomplete.issue).toMatch(/No unassigned usable Battery pack/);
    const held = state.units[unitId('thermal_imager')];
    expect(planPreparationEquipment({ ...args, picks: { B: { thermal_imager: [held] } } }).issue).toMatch(/Thermal imager/);
    expect(state.reservations).toEqual([]);
  });

  it('never adds duplicate units when the required gear is already chosen', () => {
    const state = makeState({ inventory: { thermal_imager: 1 } });
    const picks = { A: { thermal_imager: [state.units[unitId('thermal_imager')]], battery_pack: [state.units[unitId('battery_pack')]] } };
    const plan = planPreparationEquipment({ state, now: NOW, action: thermal, squadId: 'A', chosen: ['A'], loadouts: { A: { thermal_imager: 1, battery_pack: 1 } }, picks });
    expect(plan.added).toBe(0);
    expect(plan.issue).toBeNull();
    expect(new Set(Object.values(plan.explicit).flat()).size).toBe(2);
  });
});
