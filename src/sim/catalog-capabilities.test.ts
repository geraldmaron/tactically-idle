import { describe, expect, it } from 'vitest';
import { INCIDENT_CONTENT_VERSION } from '../gen/incident';
import { ITEMS } from '../content/items';
import { DEV_NODES } from '../content/dev-tree';
import { COURSES } from '../content/courses';
import { CAPABILITIES, ITEM_CATEGORIES, THERMAL_DESCRIPTION } from '../content/capabilities';
import { evaluateCapabilities, itemCapabilityPreview, type CapabilityInput } from './capabilities';
import { courseCheck, DEVELOP_HANDLERS, itemCheck } from './develop';
import { buildLocation } from './location';
import { getScenario } from './scenario-registry';
import { makeState, makeUnit, NOW, startRun } from './test-fixtures';
import { registerCapabilityFixtures } from './fixtures/capability-scenarios';
import { autoLoadout } from './auto-equip';
import { serialize, deserialize } from './save';
import type { CapabilityId, CertId } from './types';

registerCapabilityFixtures();
const newCerts: CertId[] = ['less_lethal', 'advanced_less_lethal', 'deescalation', 'vehicle_operations', 'precision_support', 'controlled_access'];
function context(itemId: string, cap: CapabilityId): CapabilityInput {
  const state = startRun(makeState(), 'ms_occupancy', ['A', 'B'], { loadouts: { A: {}, B: {} } });
  Object.values(state.officers).forEach((o) => { o.certs = [...o.certs, ...newCerts, 'drone_operator', 'advanced_first_aid', 'entry_team']; });
  const scenario = structuredClone(getScenario('capability_rescue_v2')!);
  const built = structuredClone(buildLocation('market_row', 0));
  const run = state.activeRun!;
  run.supportPositionId = 'forecourt';
  run.knowledge = { safety: 'confirmed', subject: 'confirmed' };
  run.squadTasks.forEach((t) => { t.positionId = 'forecourt'; t.at = { x: 20, y: 49 }; });
  const unit = makeUnit(itemId, 1, { status: 'reserved' });
  state.units[unit.id] = unit;
  if (ITEMS[itemId].supportOnly) {
    run.supportUnitIds = [unit.id];
    state.reservations.push({ id: 'support', runId: run.id, squadId: 'A', itemId, unitId: unit.id });
  }
  const supplies = (ITEMS[itemId].supplies ?? []).map((s) => makeUnit(s.itemId, 1, { status: 'reserved' }));
  const action = structuredClone(scenario.stages.assess.actions[0]);
  action.id = 'cap_test'; action.targetId = 'forecourt'; action.check.kind = 'execution';
  action.capabilities = { rules: [cap], required: [cap], safetyFactIds: ['safety'], subjectFactIds: ['subject'], vehicleAccessible: true, responseContext: 'constrained', openingId: 'd_stock', accessMethod: 'mechanical' };
  if (cap === 'permitted_door_access') { action.targetId = 'shop'; action.capabilities.accessMethod = itemId === 'door_charge' ? 'charge' : 'mechanical'; }
  if (cap === 'medical_exposure') action.check.kind = 'medical';
  if (cap === 'opening_inspection') { action.targetId = 'shop'; action.capabilities.openingId = 'd_side'; built.location.openings.find((o) => o.id === 'd_side')!.state = 'open'; }
  if (cap === 'dark_visible_scene') { action.check.kind = 'observation'; scenario.environment!.timeOfDay = 'night'; scenario.environment!.power = 'off'; }
  if (cap === 'visible_exterior') action.check.kind = 'observation';
  return { state, scenario, run, built, action, acting: ['A'], support: ['B'], units: { A: [unit, ...supplies], B: [] }, visibility: 1, radioDeficit: 4 };
}
const additions: [string, CapabilityId][] = [
  ['observation_binoculars', 'visible_exterior'], ['inspection_camera', 'opening_inspection'], ['portable_light', 'dark_visible_scene'], ['radio_relay', 'weak_radio_link'],
  ['light_protection', 'authorized_response'], ['rescue_shield', 'medical_exposure'], ['service_sidearm', 'authorized_response'], ['compact_carbine', 'authorized_response'], ['response_shotgun', 'authorized_response'],
  ['precision_support', 'specialist_support'], ['conducted_energy_device', 'less_lethal_device'], ['impact_launcher', 'less_lethal_impact'],
  ['armored_rescue_vehicle', 'vehicle_exterior'], ['command_van', 'scene_coordination'], ['rescue_spreader', 'permitted_door_access'], ['door_charge', 'permitted_door_access'],
];

describe('bounded catalog and common gates', () => {
  it('publishes exactly 27 active physical definitions and preserves eight existing prices', () => {
    expect(Object.keys(ITEMS)).toHaveLength(27);
    const old = { radio_kit: 400, loud_hailer: 250, throw_phone: 900, thermal_imager: 1500, camera_drone: 2200, ballistic_shield: 1200, door_ram: 300, trauma_kit: 120 };
    for (const [id, cost] of Object.entries(old)) expect(ITEMS[id].cost).toBe(cost);
    for (const [id, item] of Object.entries(ITEMS)) {
      expect(item.id).toBe(id); expect(item.cost).toBeGreaterThan(0); expect(ITEM_CATEGORIES).toContain(item.category);
      if (item.requiresNode) expect(DEV_NODES[item.requiresNode]).toBeDefined();
      item.capabilities?.forEach((cap) => expect(CAPABILITIES[cap]).toBeDefined());
      item.requiresCerts?.forEach((cert) => expect(Object.values(COURSES).some((c) => c.grants.cert === cert)).toBe(true));
      if (item.kind === 'consumable') { expect(item.wear.shelfLifeDays).toBeGreaterThan(0); expect(item.wear.serviceHours).toBe(0); }
    }
    expect(DEV_NODES.intel_thermal.description).toBe(THERMAL_DESCRIPTION);
    expect(ITEMS.thermal_imager.description).toBe(THERMAL_DESCRIPTION);
  });
  it.each(additions)('%s contributes in its declared context, and contributes nothing on a routine contact action', (id, cap) => {
    const input = context(id, cap);
    const result = evaluateCapabilities(input);
    expect(result.reasons, id).toEqual([]);
    expect(result.applied.find((p) => p.itemId === id)?.value, id).toBeGreaterThan(0);
    expect(result.uses.some((u) => u.itemId === id)).toBe(true);
    input.action.capabilities = { rules: [] }; input.action.check.kind = 'contact';
    expect(evaluateCapabilities(input).applied).toHaveLength(0);
  });
  it('buying each new program never grants a cert; prerequisite certification is checked separately', () => {
    const state = makeState(); state.department.devPoints = 100; state.department.funding = 100000;
    state.department.unlockedNodes = ['field_entry_course', 'field_response_program'];
    const before = structuredClone(state.officers);
    for (const id of ['field_less_lethal', 'field_specialist_response', 'field_controlled_access', 'logistics_field_support', 'logistics_armored_support']) expect(DEVELOP_HANDLERS.unlockNode(state, id).ok).toBe(true);
    expect(state.officers).toEqual(before);
    const officer = state.officers.off_chen;
    expect(courseCheck(state, COURSES.advanced_less_lethal_course, officer).reason).toMatch(/prior qualification/);
    officer.certs.push('less_lethal');
    expect(courseCheck(state, COURSES.advanced_less_lethal_course, officer).ok).toBe(true);
    expect(courseCheck(state, COURSES.precision_support_course, officer).reason).toMatch(/entry team/);
  });
  it('rejects invalid purchase quantities in both preview and command and permits one vehicle per purchase', () => {
    const state = makeState(); state.department.funding = 100000; state.department.unlockedNodes = Object.keys(DEV_NODES);
    for (const qty of [0, -1, .5, NaN, Infinity, 100]) {
      expect(itemCheck(state, ITEMS.trauma_kit, qty).ok).toBe(false);
      expect(DEVELOP_HANDLERS.buyItem(state, 'trauma_kit', qty).ok).toBe(false);
    }
    expect(itemCheck(state, ITEMS.support_van, 2).ok).toBe(false);
    expect(itemCheck(state, ITEMS.support_van, 1).ok).toBe(true);
  });
  it('new certifications and stock survive serialization with future content enabled', () => {
    const state = makeState(); state.saveVersion = 3;
    state.officers.off_chen.certs.push(...newCerts);
    state.units.new_device = { ...makeUnit('conducted_energy_device', 1), id: 'new_device' };
    const restored = deserialize(serialize(state, NOW));
    expect(restored?.officers.off_chen.certs).toEqual(state.officers.off_chen.certs);
    expect(restored?.contentVersion).toBe(INCIDENT_CONTENT_VERSION);
    expect(restored?.units.new_device.itemId).toBe('conducted_energy_device');
  });
});

describe('context, material and safety consequences', () => {
  it('darkness aid only cancels an actual visible darkness penalty, while opaque barriers block both visual aids', () => {
    const input = context('portable_light', 'dark_visible_scene');
    const lit = evaluateCapabilities(input);
    expect(lit.contributors.reduce((sum, c) => sum + c.value, 0)).toBe(0);
    input.scenario.environment!.timeOfDay = 'day'; input.scenario.environment!.power = 'on';
    expect(evaluateCapabilities(input).applied).toHaveLength(0);
    for (const [item, cap] of [['portable_light', 'dark_visible_scene'], ['observation_binoculars', 'visible_exterior']] as const) {
      const opaque = context(item, cap); opaque.visibility = 0;
      expect(evaluateCapabilities(opaque).applied).toHaveLength(0);
    }
  });
  it('relay recovers the measured deficit without exceeding clear radio baseline', () => {
    const input = context('radio_relay', 'weak_radio_link');
    for (const gap of [0, .7, 3, 8]) { input.radioDeficit = gap; expect(evaluateCapabilities(input).applied[0]?.value ?? 0).toBe(Math.min(gap, 5)); }
  });
  it('one response class wins, duplicates do not stack, worn stock contributes less and bad stock is unusable', () => {
    const input = context('compact_carbine', 'authorized_response');
    input.units.A!.push(makeUnit('compact_carbine', 2), makeUnit('service_sidearm', 1), makeUnit('response_shotgun', 1));
    const full = evaluateCapabilities(input);
    expect(full.applied.filter((p) => p.group === 'response_class')).toHaveLength(1);
    expect(full.applied[0].value).toBe(6);
    input.units.A = [makeUnit('compact_carbine', 1, { condition: 20 })];
    expect(evaluateCapabilities(input).applied[0].value).toBeLessThan(6);
    for (const status of ['service', 'scrapped', 'expired'] as const) {
      input.units.A![0].status = status; expect(evaluateCapabilities(input).applied).toHaveLength(0);
    }
  });
  it('inspection respects closed and blocked openings with integrated power', () => {
    const input = context('inspection_camera', 'opening_inspection');
    input.action.requires.allTags = ['inspection_camera'];
    expect(evaluateCapabilities(input).uses.filter((u) => u.consumable)).toHaveLength(0);
    for (const state of ['closed', 'blocked'] as const) {
      input.built.location.openings.find((o) => o.id === 'd_side')!.state = state;
      expect(evaluateCapabilities(input).eligible).toBe(false);
    }
  });
  it('every force-context gate uses only knowledge; unresolved and ruled-out safety block without revealing truth', () => {
    for (const [itemId, cap] of [['conducted_energy_device', 'less_lethal_device'], ['impact_launcher', 'less_lethal_impact'], ['door_charge', 'permitted_door_access']] as const) {
      const input = context(itemId, cap); input.run.knowledge.safety = 'reported';
      const before = structuredClone(input);
      const result = evaluateCapabilities(input);
      expect(result.eligible).toBe(false); expect(result.reasons[0]).toMatch(/safety of adjacent area must be confirmed/i);
      input.scenario.facts.forEach((f) => { f.truth = !f.truth; });
      expect(evaluateCapabilities(input).reasons).toEqual(result.reasons);
      expect(input.state).toEqual(before.state);
      input.run.knowledge.safety = 'disproved'; expect(evaluateCapabilities(input).eligible).toBe(false);
      input.run.knowledge.safety = 'confirmed'; expect(evaluateCapabilities(input).eligible).toBe(true);
    }
  });
  it('mechanical access supports steel doors, while charge cannot bypass steel, glazing or blocked openings', () => {
    for (const id of ['rescue_spreader', 'door_charge']) {
      const input = context(id, 'permitted_door_access');
      const opening = input.built.location.openings.find((o) => o.id === 'd_stock')!;
      opening.material = 'steel'; expect(evaluateCapabilities(input).eligible).toBe(id === 'rescue_spreader');
      opening.material = 'glass'; expect(evaluateCapabilities(input).eligible).toBe(false);
      opening.material = 'solid_core'; opening.state = 'blocked'; expect(evaluateCapabilities(input).eligible).toBe(false);
      opening.state = 'closed'; input.action.capabilities!.openingId = 'not_a_door'; expect(evaluateCapabilities(input).eligible).toBe(false);
    }
  });
  it('vehicles are exterior-only and command support requires two squads', () => {
    for (const [id, cap] of [['armored_rescue_vehicle', 'vehicle_exterior'], ['command_van', 'scene_coordination']] as const) {
      const input = context(id, cap);
      input.action.targetId = 'stockroom'; expect(evaluateCapabilities(input).applied).toHaveLength(0);
      input.action.targetId = 'forecourt'; input.action.capabilities!.vehicleAccessible = false; expect(evaluateCapabilities(input).applied).toHaveLength(0);
    }
    const single = context('command_van', 'scene_coordination'); single.support = []; expect(evaluateCapabilities(single).eligible).toBe(false);
  });
  it('qualified intervention consumes its compatible stock exactly once and refuses a substitute or missing qualification', () => {
    for (const [id, cap, supply] of [['conducted_energy_device', 'less_lethal_device', 'energy_cartridge'], ['impact_launcher', 'less_lethal_impact', 'impact_supply']] as const) {
      const input = context(id, cap);
      expect(evaluateCapabilities(input).uses.filter((u) => u.itemId === supply)).toHaveLength(1);
      input.units.A = input.units.A!.filter((u) => u.itemId !== supply);
      input.units.A.push(makeUnit(supply === 'energy_cartridge' ? 'impact_supply' : 'energy_cartridge', 2));
      expect(evaluateCapabilities(input).eligible).toBe(false);
      input.units.A.push(makeUnit(supply, 1));
      input.state.squads.find((s) => s.id === 'A')!.officerIds.forEach((oid) => { input.state.officers[oid].certs = []; });
      expect(evaluateCapabilities(input).reasons[0]).toMatch(/qualified operator/);
    }
  });
  it('auto-equip never packs vehicles, reserves no serial twice and adds matching action supplies', () => {
    const state = makeState({ inventory: Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 3])) });
    Object.values(state.officers).forEach((o) => { o.certs.push(...newCerts); });
    const plan = autoLoadout(state, 'capability_response_v2', ['A', 'B'], NOW);
    const ids = Object.values(plan.units).flat();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => ITEMS[state.units[id].itemId].supportOnly)).toBe(false);
    expect(ids.some((id) => state.units[id].itemId === 'energy_cartridge')).toBe(true);
  });
  it('one operator must hold every item qualification; combining two officers is insufficient', () => {
    const input = context('precision_support', 'specialist_support');
    const original = ITEMS.precision_support.requiresCerts;
    try {
      ITEMS.precision_support.requiresCerts = ['precision_support', 'controlled_access'];
      input.state.squads.find((s) => s.id === 'A')!.officerIds.forEach((id, index) => { input.state.officers[id].certs = index === 0 ? ['precision_support'] : ['controlled_access']; });
      expect(evaluateCapabilities(input).eligible).toBe(false);
      input.state.officers.off_chen.certs.push('controlled_access');
      expect(evaluateCapabilities(input).eligible).toBe(true);
    } finally { ITEMS.precision_support.requiresCerts = original; }
  });
  it('store context is explicit and never fabricates a compatibility claim without a selected action', () => {
    expect(itemCapabilityPreview(makeState(), 'door_charge')).toMatchObject({ compatible: null, contribution: 0 });
  });
});
