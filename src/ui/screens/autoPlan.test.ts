import { describe, expect, it } from 'vitest';
import { planAuto, planPreparationEquipment, preparationEquipmentFix } from './autoPlan';
import { makeState, NOW, unitId } from '../../sim/test-fixtures';
import { SCENARIOS } from '../../content/scenarios';
import { CALENDAR } from '../../sim/calendar';
import type { ActionDefinition } from '../../sim/scenario-types';
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
    expect(plan.added).toBe(1);
    expect(plan.loadout).toMatchObject({ thermal_imager: 1, throw_phone: 0, radio_kit: 4 });
    expect(plan.explicit.thermal_imager).toEqual([unitId('thermal_imager')]);
    expect(plan.label).toBe('Thermal imager');
    expect(plan.explicit.battery_pack).toBeUndefined();
    expect(state).toEqual(before);
  });

  it('refuses the whole required bundle when true supplies are missing or equipment is assigned elsewhere', () => {
    const state = makeState({ inventory: { conducted_energy_device: 1, energy_cartridge: 0 } });
    state.officers.off_chen.certs.push('less_lethal');
    const action = { ...thermal, requires: { allTags: ['energy_device'] } };
    const args = { state, now: NOW, action, squadId: 'A' as const, chosen: ['A' as const, 'B' as const], loadouts: { A: { conducted_energy_device: 0, radio_kit: 4 } }, picks: {} };
    const before = structuredClone(state);
    const incomplete = planPreparationEquipment(args);
    expect(incomplete.issue).toMatch(/No unassigned usable 1 Device cartridge/);
    expect(incomplete).toMatchObject({ added: 0, explicit: {}, loadout: args.loadouts.A });
    const held = state.units[unitId('conducted_energy_device')];
    expect(planPreparationEquipment({ ...args, picks: { B: { conducted_energy_device: [held] } } }).issue).toMatch(/Conducted-energy device class/);
    expect(state).toEqual(before);
  });

  it('never adds duplicate units when the required gear is already chosen', () => {
    const state = makeState({ inventory: { thermal_imager: 1 } });
    const picks = { A: { thermal_imager: [state.units[unitId('thermal_imager')]] } };
    const plan = planPreparationEquipment({ state, now: NOW, action: thermal, squadId: 'A', chosen: ['A'], loadouts: { A: { thermal_imager: 1 } }, picks });
    expect(plan.added).toBe(0);
    expect(plan.issue).toBeNull();
    expect(new Set(Object.values(plan.explicit).flat()).size).toBe(1);
  });

  it('never suggests packing a support vehicle through contextual equipment repair', () => {
    const state = makeState({ inventory: { support_van: 1 } });
    const action = { ...thermal, requires: { allTags: ['support_van'] }, consumes: [] };
    const plan = planPreparationEquipment({ state, now: NOW, action, squadId: 'A', chosen: ['A'], loadouts: { A: { radio_kit: 4, trauma_kit: 0 } }, picks: {} });
    expect(plan.added).toBe(0);
    expect(plan.loadout).toEqual({ radio_kit: 4, trauma_kit: 0 });
    expect(plan.explicit).toEqual({});
    expect(plan.issue).toContain('Support van');
    expect(state.units[unitId('support_van')].status).toBe('ready');
  });
  it('handles required capabilities and their real supplies as one complete bundle', () => {
    const state = makeState({ inventory: { conducted_energy_device: 1, energy_cartridge: 1 } });
    state.officers.off_chen.certs.push('less_lethal');
    const action: ActionDefinition = { ...thermal, requires: {}, capabilities: { rules: ['less_lethal_device'], required: ['less_lethal_device'], subjectFactIds: ['f_subject'], safetyFactIds: ['f_safety'] } };
    const plan = planPreparationEquipment({ state, now: NOW, action, squadId: 'A', chosen: ['A'], loadouts: { A: { conducted_energy_device: 0, trauma_kit: 3, throw_phone: 0 } }, picks: {} });
    expect(plan.issue).toBeNull();
    expect(plan.added).toBe(2);
    expect(plan.loadout).toEqual({ conducted_energy_device: 1, energy_cartridge: 1, trauma_kit: 3, throw_phone: 0 });
    expect(plan.prerequisites).toEqual(['Confirm the subject context before using this action', 'Confirm the safety of the adjacent area before using this action']);
  });

  it('requires distinct consumable units and never leaves a partial tool addition', () => {
    const state = makeState({ inventory: { conducted_energy_device: 1, energy_cartridge: 1 } });
    state.officers.off_chen.certs.push('less_lethal');
    const action = { ...thermal, requires: { allTags: ['energy_device'] }, consumes: [{ tag: 'energy_cartridge', qty: 1 }, { tag: 'energy_cartridge', qty: 1 }] };
    const plan = planPreparationEquipment({ state, now: NOW, action, squadId: 'A', chosen: ['A'], loadouts: { A: { conducted_energy_device: 0 } }, picks: {} });
    expect(plan.issue).toMatch(/2 Device cartridge/);
    expect(plan).toMatchObject({ added: 0, explicit: {}, loadout: { conducted_energy_device: 0 } });
  });

  it('reports missing action certifications, item operators and minimum squads', () => {
    const state = makeState({ inventory: { camera_drone: 1 } });
    const args = { state, now: NOW, squadId: 'A' as const, chosen: ['A' as const], loadouts: {}, picks: {} };
    const cert = planPreparationEquipment({ ...args, action: { ...thermal, requires: { certs: ['drone_operator'] } } });
    expect(cert).toMatchObject({ added: 0, explicit: {} });
    expect(cert.issue).toMatch(/Needs a drone operator/);
    const operator = planPreparationEquipment({ ...args, action: { ...thermal, requires: { allTags: ['drone'] } } });
    expect(operator).toMatchObject({ added: 0, explicit: {} });
    expect(operator.issue).toMatch(/qualified operator.*drone operator/);
    const squads = planPreparationEquipment({ ...args, action: { ...thermal, requires: { minSquads: { count: 2, reason: 'Needs two participating squads' } } } });
    expect(squads.issue).toBe('Needs two participating squads');
    expect(squads.added).toBe(0);
  });

  it('uses the best projected condition and ignores expired or serviced alternatives', () => {
    const state = makeState({ inventory: { thermal_imager: 3 } });
    state.units[unitId('thermal_imager')].condition = 100;
    state.units[unitId('thermal_imager')].wearRate = 1.25;
    state.units[unitId('thermal_imager', 2)].condition = 99;
    state.units[unitId('thermal_imager', 2)].wearRate = 0.8;
    state.units[unitId('thermal_imager', 3)].status = 'service';
    const plan = planPreparationEquipment({ state, now: NOW + 20 * CALENDAR.gameDayMs, action: thermal, squadId: 'A', chosen: ['A'], loadouts: {}, picks: {} });
    expect(plan.explicit.thermal_imager).toEqual([unitId('thermal_imager', 2)]);
  });

  it('treats anyTags as alternatives while retaining an unrelated explicit zero', () => {
    const state = makeState();
    state.units[unitId('throw_phone')].condition = 85;
    const action = { ...thermal, requires: { anyTags: ['throw_phone', 'hailer'] } };
    const plan = planPreparationEquipment({ state, now: NOW, action, squadId: 'A', chosen: ['A'], loadouts: { A: { trauma_kit: 0 } }, picks: {} });
    expect(plan.issue).toBeNull();
    expect(plan.added).toBe(1);
    expect(plan.loadout).toEqual({ trauma_kit: 0, loud_hailer: 1 });
  });

  it('keeps stale explicit choices reviewable instead of adding a replacement to an unusable loadout', () => {
    const state = makeState({ inventory: { thermal_imager: 2 } });
    const selected = state.units[unitId('thermal_imager')];
    selected.status = 'service';
    const plan = planPreparationEquipment({ state, now: NOW, action: thermal, squadId: 'A', chosen: ['A'], loadouts: { A: { thermal_imager: 1 } }, picks: { A: { thermal_imager: [selected] } } });
    expect(plan.issue).toMatch(/Selected equipment is no longer usable/);
    expect(plan).toMatchObject({ added: 0, loadout: { thermal_imager: 1 }, explicit: { thermal_imager: [selected.id] } });
  });

});


describe('preparation warning equipment repair', () => {
  const specialist = structuredClone(SCENARIOS.practice_response_v2.stages.adapt.actions.find((action) => action.id === 'practice_specialist_clear')!);
  const warning = `${specialist.title}: Needs usable equipment for specialist support`;
  it('offers a capability-only full bundle on a later qualified squad and preserves manual choices', () => {
    const state = makeState({ inventory: { precision_support: 1 } });
    state.officers.off_reyes.certs.push('precision_support');
    const loadouts = { A: { throw_phone: 0 }, B: { trauma_kit: 3, precision_support: 0 } };
    const input = { warning, actions: [specialist], state, now: NOW, chosen: ['A', 'B'] as const, loadouts, picks: {} };
    const before = structuredClone({ state, loadouts });
    const fix = preparationEquipmentFix({ ...input, chosen: [...input.chosen] });
    expect(fix?.sid).toBe('B');
    expect(fix?.plan).toMatchObject({ added: 1, issue: null, loadout: { trauma_kit: 3, precision_support: 1 }, explicit: { precision_support: [unitId('precision_support')] } });
    expect(fix?.plan.prerequisites.join(' ')).toMatch(/separate supporting squad/);
    expect({ state, loadouts }).toEqual(before);
  });
  it('returns a meaningful shortage from a qualified squad instead of the first unqualified squad', () => {
    const state = makeState({ inventory: { precision_support: 0 } });
    state.officers.off_reyes.certs.push('precision_support');
    const fix = preparationEquipmentFix({ warning, actions: [specialist], state, now: NOW, chosen: ['A', 'B'], loadouts: {}, picks: {} });
    expect(fix?.sid).toBe('B');
    expect(fix?.plan.issue).toMatch(/No unassigned usable specialist support/);
    expect(fix?.plan.added).toBe(0);
  });
  it('keeps a qualification issue visible when no chosen squad can use the missing item', () => {
    const state = makeState({ inventory: { precision_support: 1 } });
    const fix = preparationEquipmentFix({ warning, actions: [specialist], state, now: NOW, chosen: ['A', 'B'], loadouts: {}, picks: {} });
    expect(fix?.plan.issue).toMatch(/qualified specialist support officer/);
    expect(fix?.plan.added).toBe(0);
  });
  it('does not offer packing to fix a fact or sightline warning when the bundle is already present', () => {
    const state = makeState({ inventory: { precision_support: 1 } });
    state.officers.off_reyes.certs.push('precision_support');
    const args = { actions: [specialist], state, now: NOW, chosen: ['A', 'B'] as ('A' | 'B')[], loadouts: { B: { precision_support: 1 } }, picks: { B: { precision_support: [state.units[unitId('precision_support')]] } } };
    expect(preparationEquipmentFix({ ...args, warning: `${specialist.title}: The subject context must be confirmed` })).toBeNull();
    expect(preparationEquipmentFix({ ...args, warning: `${specialist.title}: Specialist support needs a clear visual path` })).toBeNull();
  });
  it('ignores unmatched warnings and actions with no physical equipment requirement', () => {
    const state = makeState();
    const action = { ...specialist, requires: { facts: [{ factId: 'f', in: ['confirmed' as const], reason: 'Confirm the report' }] }, capabilities: undefined, consumes: undefined };
    const args = { actions: [action], state, now: NOW, chosen: ['A'] as 'A'[], loadouts: {}, picks: {} };
    expect(preparationEquipmentFix({ ...args, warning: `${action.title}: Confirm the report` })).toBeNull();
    expect(preparationEquipmentFix({ ...args, warning: 'A general preparation warning' })).toBeNull();
  });
});
