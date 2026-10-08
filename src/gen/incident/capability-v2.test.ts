import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '../../content/capabilities';
import { COURSES } from '../../content/courses';
import { CAPABILITY_FIXTURES, registerCapabilityFixtures } from '../../sim/fixtures/capability-scenarios';
import { SCENARIO_ORDER } from '../../content/scenarios';
import { buildLocation } from '../../sim/location';
import { createInitialState } from '../../sim/department';
import { validateScenario } from '../../sim/operation';
import { actionViews } from '../../sim/operation-selectors';
import { getScenario } from '../../sim/scenario-registry';
import { builtFor, evaluateAction, openingFlag } from '../../sim/resolution';
import { scenarioActions, type IncidentSpec } from '../../sim/scenario-types';
import { deserialize, serialize } from '../../sim/save';
import { apply, makeState, makeUnit, NOW, playPolicy, startRun, withCallOnBoard } from '../../sim/test-fixtures';
import { drawIncidentSpec, generateIncident, INCIDENT_CONTENT_VERSION, INCIDENT_TYPES, INCIDENT_TYPES_V2, incidentId } from './index';

registerCapabilityFixtures();

/** Evaluate one fixture action for squad A carrying one fresh unit of each listed item. */
function fixtureEvaluation(actionId: string, itemIds: string[], options: { unknown?: boolean; openDoor?: boolean; support?: boolean; distantSupport?: boolean; vehicle?: string } = {}) {
  const scenario = CAPABILITY_FIXTURES.find((scenario) => scenarioActions(scenario).some((action) => action.id === actionId))!;
  const initial = makeState();
  for (const officer of Object.values(initial.officers)) officer.certs = [...new Set([...officer.certs, ...Object.values(COURSES).flatMap((course) => course.grants.cert ? [course.grants.cert] : [])])];
  const exterior = scenario.locationFamilyId === 'cedar_close' ? 'front_yard' : 'forecourt';
  const state = startRun(initial, scenario.id, options.support ? ['A', 'B'] : ['A'], { positions: { A: exterior, B: options.distantSupport ? 'delivery_lane' : exterior }, loadouts: { A: {}, B: {} } });
  const run = state.activeRun!;
  const action = scenarioActions(scenario).find((action) => action.id === actionId)!;
  run.stage = action.stage;
  if (!options.unknown) for (const fact of scenario.facts) run.knowledge[fact.id] = 'confirmed';
  if (options.openDoor) run.flags.push(openingFlag('d_side', 'open'));
  if (options.vehicle) {
    // An owned vehicle reserved for this run, as startOperation would leave it.
    const vehicle = makeUnit(options.vehicle, 1, { status: 'reserved' });
    state.units[vehicle.id] = vehicle;
    state.reservations.push({ id: 'res_vehicle', runId: run.id, squadId: 'A', itemId: vehicle.itemId, unitId: vehicle.id });
    run.supportUnitIds = [vehicle.id]; run.supportPositionId = exterior;
  }
  const units = itemIds.map((itemId) => ({ ...makeUnit(itemId, 1), id: `fixture_${itemId}`, status: 'reserved' as const }));
  const result = evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: options.support ? ['B'] : [], unitOverride: { A: units, B: units.map((unit) => ({ ...unit, id: `b_${unit.id}` })), C: [], D: [] } });
  return result;
}

const contribution = (result: ReturnType<typeof fixtureEvaluation>, itemId: string) => result.contributors.filter((entry) => entry.ref === itemId).reduce((total, entry) => total + entry.value, 0);

const specialistTypes = INCIDENT_TYPES_V2.filter((type) => !INCIDENT_TYPES.some((old) => old.type === type.type));
const specFor = (type: IncidentSpec['type'], familyId: string, seed = 7): IncidentSpec => ({ type, familyId, buildingSeed: seed, seed, tier: 2, contentVersion: 2 });

describe('content v2 specialist reports', () => {
  it('adds only the two bounded archetypes and keeps version one unadvertised cases unavailable', () => {
    expect(INCIDENT_CONTENT_VERSION).toBe(13);
    expect(specialistTypes.map((type) => type.type)).toEqual(['barricaded', 'business_robbery']);
    expect(() => generateIncident({ ...specFor('barricaded', 'cedar_close'), contentVersion: 1 })).toThrow('Unsupported incident');
    expect(() => generateIncident({ ...specFor('business_robbery', 'market_row'), contentVersion: 1 })).toThrow('Unsupported incident');
    // Old Maple IDs of the same schema types still resolve with their old actions.
    expect(generateIncident({ ...specFor('barricaded', 'maple_street'), contentVersion: 1 }).version).toBe(1);
  });

  it('deterministically validates all v2 cases and their new context references', () => {
    for (const type of INCIDENT_TYPES_V2) for (const familyId of type.families) for (const seed of [0, 7, 42]) {
      const spec = specFor(type.type, familyId, seed);
      const scenario = generateIncident(spec);
      expect(generateIncident(spec)).toEqual(scenario);
      expect(getScenario(scenario.id)).toEqual(scenario);
      expect(scenario.version).toBe(2);
      expect(validateScenario(scenario, buildLocation(familyId, seed)), scenario.id).toEqual([]);
      for (const action of scenarioActions(scenario)) {
        const factIds = [...(action.capabilities?.safetyFactIds ?? []), ...(action.capabilities?.subjectFactIds ?? [])];
        for (const id of factIds) expect(scenario.facts.some((fact) => fact.id === id)).toBe(true);
        if (action.capabilities?.openingId) expect(buildLocation(familyId, seed).location.openings.some((opening) => opening.id === action.capabilities!.openingId)).toBe(true);
      }
    }
  });

  it('keeps everyday calls dominant and yields both new report types', () => {
    let rng = 12345;
    const counts = new Map<string, number>();
    for (let i = 0; i < 1200; i++) {
      const draw = drawIncidentSpec(rng, { level: 4, trust: 70, contentVersion: 2 });
      rng = draw.state;
      counts.set(draw.spec.type, (counts.get(draw.spec.type) ?? 0) + 1);
    }
    expect(counts.get('barricaded')).toBeGreaterThan(0);
    expect(counts.get('business_robbery')).toBeGreaterThan(0);
    const specialistCount = (counts.get('barricaded') ?? 0) + (counts.get('business_robbery') ?? 0);
    expect(specialistCount).toBeLessThan(120);
  });

  it('allows a complete non-force policy without any purchased specialist gear', () => {
    for (const type of specialistTypes) for (const familyId of type.families) {
      const scenario = generateIncident(specFor(type.type, familyId));
      const entry = buildLocation(familyId, scenario.locationSeed).location.entries[0];
      const initial = makeState({ inventory: { throw_phone: 0, door_ram: 0, ballistic_shield: 0 } });
      const running = startRun(withCallOnBoard(initial, scenario.id), scenario.id, ['A'], { positions: { A: entry }, loadouts: { A: {} } });
      // The squad carries only its standard radios.
      expect(running.reservations.every((reservation) => reservation.itemId === 'radio_kit')).toBe(true);
      const done = playPolicy(running, { assess: ['gen_contact'], adapt: ['gen_coordinate'], resolve: ['gen_resolve'] });
      expect(done.steps).toEqual(['gen_contact', 'gen_coordinate', 'gen_resolve']);
      expect(done.debrief.scenarioId).toBe(scenario.id);
      expect(Object.keys(done.state.units).sort()).toEqual(Object.keys(initial.units).sort());
    }
  });

  it('preserves a saved v1 active run while resolving v2 alongside it', () => {
    const spec = { ...specFor('welfare_check', 'cedar_close'), contentVersion: 1 };
    const before = generateIncident(spec);
    const initial = createInitialState(NOW);
    initial.contentVersion = 1;
    const running = startRun(withCallOnBoard(initial, incidentId(spec)), incidentId(spec), ['A'], { positions: { A: 'front_yard' }, loadouts: { A: {} } });
    for (const type of specialistTypes) generateIncident(specFor(type.type, type.families[0]));
    const restored = deserialize(serialize(running, NOW));
    expect(restored?.activeRun).toEqual(running.activeRun);
    expect(getScenario(incidentId(spec))).toEqual(before);
    expect(scenarioActions(before).every((action) => !action.capabilities)).toBe(true);
  });

  it('makes each v2 preparation one-shot and keeps charge risk explicit', () => {
    for (const type of specialistTypes) for (const familyId of type.families) {
      const scenario = generateIncident(specFor(type.type, familyId));
      for (const a of scenarioActions(scenario)) {
        expect(a.requires.notFlags?.some((entry) => entry.flag === `used:${a.id}`)).toBe(true);
        for (const band of ['favorable', 'mixed', 'adverse'] as const) expect(a.outcomes[band][0].setFlags).toContain(`used:${a.id}`);
        if (a.capabilities?.accessMethod !== 'charge') continue;
        for (const [band, civilian] of [['favorable', -2], ['mixed', -6], ['adverse', -14]] as const) expect(a.outcomes[band][0]).toMatchObject({ pressure: 8, civilian });
      }
    }
  });
});

describe('capability fixtures', () => {
  it('gives visible daylight binoculars and visible darkness lighting their intended positive and counter', () => {
    expect(contribution(fixtureEvaluation('capability_view_day', ['observation_binoculars']), 'observation_binoculars')).toBe(4);
    expect(contribution(fixtureEvaluation('capability_view_clear', ['observation_binoculars']), 'observation_binoculars')).toBe(0);
    expect(contribution(fixtureEvaluation('capability_view_clear', ['portable_light']), 'portable_light')).toBe(5);
    expect(contribution(fixtureEvaluation('capability_view_opaque', ['portable_light']), 'portable_light')).toBe(0);
    expect(contribution(fixtureEvaluation('capability_view_day', ['portable_light']), 'portable_light')).toBe(0);
  });

  it('makes opening inspection usable after the authored opening change and refuses the sealed view', () => {
    const equipment = ['inspection_camera'];
    const positive = fixtureEvaluation('capability_inspect', equipment, { openDoor: true });
    expect(positive.eligible, positive.reason ?? undefined).toBe(true);
    expect(contribution(positive, 'inspection_camera')).toBe(6);
    expect(positive.uses.filter((unit) => unit.itemId === 'battery_pack')).toHaveLength(0);
    const sealed = fixtureEvaluation('capability_inspect', equipment);
    expect(sealed.eligible).toBe(false);
    expect(contribution(sealed, 'inspection_camera')).toBe(0);
  });

  it('lets old powered observation tools read an opening while glazing limits heat', () => {
    const open = fixtureEvaluation('capability_heat_open', ['thermal_imager'], { openDoor: true });
    const glazed = fixtureEvaluation('capability_heat', ['thermal_imager']);
    expect(open.eligible, open.reason ?? undefined).toBe(true);
    expect(open.uses.filter((unit) => unit.itemId === 'battery_pack')).toHaveLength(0);
    const heatScore = (result: typeof open) => result.contributors.filter((entry) => entry.label.startsWith('Heat')).reduce((total, entry) => total + entry.value, 0);
    expect(heatScore(open)).toBeGreaterThan(heatScore(glazed));
    const drone = fixtureEvaluation('capability_drone', ['camera_drone'], { openDoor: true });
    expect(drone.eligible, drone.reason ?? undefined).toBe(true);
    expect(contribution(drone, 'camera_drone')).toBe(8);
    expect(drone.uses.filter((unit) => unit.itemId === 'battery_pack')).toHaveLength(0);
  });

  it('recovers a genuine weak radio link with integrated power without improving a clear link', () => {
    const equipment = ['radio_kit', 'radio_relay'];
    const weak = fixtureEvaluation('capability_radio_weak', equipment, { support: true, distantSupport: true });
    expect(weak.eligible, weak.reason ?? undefined).toBe(true);
    expect(contribution(weak, 'radio_relay')).toBeGreaterThan(0);
    expect(contribution(weak, 'radio_relay')).toBeLessThanOrEqual(5);
    expect(weak.uses.filter((unit) => unit.itemId === 'battery_pack')).toHaveLength(0);
    expect(contribution(fixtureEvaluation('capability_radio_clear', equipment, { support: true }), 'radio_relay')).toBe(0);
    expect(contribution(fixtureEvaluation('capability_radio_weak', ['radio_relay'], { support: true, distantSupport: true }), 'radio_relay')).toBe(0);
  });

  it('uses medical protection only on the patient action and selects one response class', () => {
    const medical = fixtureEvaluation('capability_patient_aid', ['rescue_shield', 'trauma_kit']);
    expect(medical.eligible, medical.reason ?? undefined).toBe(true);
    expect(contribution(medical, 'rescue_shield')).toBe(5);
    expect(medical.uses.filter((unit) => unit.itemId === 'trauma_kit')).toHaveLength(1);
    expect(contribution(fixtureEvaluation('capability_response_v2_talk', ['rescue_shield']), 'rescue_shield')).toBe(0);
    const allClasses = fixtureEvaluation('capability_contain_open', ['service_sidearm', 'compact_carbine', 'response_shotgun', 'light_protection']);
    expect(allClasses.eligible, allClasses.reason ?? undefined).toBe(true);
    expect(contribution(allClasses, 'compact_carbine')).toBe(6);
    expect(contribution(allClasses, 'service_sidearm')).toBe(0);
    expect(contribution(allClasses, 'response_shotgun')).toBe(0);
    expect(contribution(allClasses, 'light_protection')).toBe(4);
    expect(contribution(fixtureEvaluation('capability_contain_open', ['service_sidearm']), 'service_sidearm')).toBe(3);
    expect(contribution(fixtureEvaluation('capability_contain_constrained', ['response_shotgun']), 'response_shotgun')).toBe(5);
    expect(contribution(fixtureEvaluation('capability_response_v2_talk', ['compact_carbine']), 'compact_carbine')).toBe(0);
  });

  it('requires both a clear support view and a separate squad for the specialist fixture', () => {
    const positive = fixtureEvaluation('capability_specialist_clear', ['precision_support'], { support: true });
    expect(positive.eligible, positive.reason ?? undefined).toBe(true);
    expect(contribution(positive, 'precision_support')).toBe(7);
    expect(fixtureEvaluation('capability_specialist_blocked', ['precision_support'], { support: true }).eligible).toBe(false);
    expect(fixtureEvaluation('capability_specialist_clear', ['precision_support']).eligible).toBe(false);
  });

  it('uses each compatible less-lethal supply once and blocks an unverified context', () => {
    for (const [actionId, device, supply, value] of [['capability_device', 'conducted_energy_device', 'energy_cartridge', 4], ['capability_impact', 'impact_launcher', 'impact_supply', 5]] as const) {
      const positive = fixtureEvaluation(actionId, [device, supply]);
      expect(positive.eligible, positive.reason ?? undefined).toBe(true);
      expect(contribution(positive, device)).toBe(value);
      expect(positive.uses.filter((unit) => unit.itemId === supply)).toHaveLength(1);
      expect(fixtureEvaluation(actionId, [device, supply], { unknown: true }).eligible).toBe(false);
      expect(fixtureEvaluation(actionId, [device]).eligible).toBe(false);
    }
  });

  it('makes ordinary and steel mechanical access useful and keeps the consumable alternative bounded', () => {
    for (const actionId of ['capability_access_solid', 'capability_access_steel']) {
      const mechanical = fixtureEvaluation(actionId, ['rescue_spreader']);
      expect(mechanical.eligible, mechanical.reason ?? undefined).toBe(true);
      expect(contribution(mechanical, 'rescue_spreader')).toBe(5);
    }
    const charge = fixtureEvaluation('capability_access_charge', ['door_charge']);
    expect(charge.eligible, charge.reason ?? undefined).toBe(true);
    expect(charge.uses.filter((unit) => unit.itemId === 'door_charge')).toHaveLength(1);
    expect(fixtureEvaluation('capability_access_charge', ['door_charge'], { unknown: true }).eligible).toBe(false);
    expect(fixtureEvaluation('capability_access_unsupported', ['door_charge']).eligible).toBe(false);
  });

  it('applies vehicles to their distinct exterior roles and shows their scene counters', () => {
    const evacuation = fixtureEvaluation('capability_evacuate_exterior', [], { vehicle: 'armored_rescue_vehicle' });
    expect(contribution(evacuation, 'armored_rescue_vehicle')).toBe(8);
    expect(contribution(fixtureEvaluation('capability_evacuate_indoor', [], { vehicle: 'armored_rescue_vehicle' }), 'armored_rescue_vehicle')).toBe(0);
    expect(contribution(fixtureEvaluation('capability_evacuate_narrow', [], { vehicle: 'armored_rescue_vehicle' }), 'armored_rescue_vehicle')).toBe(0);
    expect(contribution(fixtureEvaluation('capability_radio_clear', [], { vehicle: 'command_van', support: true }), 'command_van')).toBe(5);
    expect(contribution(fixtureEvaluation('capability_radio_clear', [], { vehicle: 'command_van' }), 'command_van')).toBe(0);
  });

  it('covers every capability with valid, zero-reward fixtures outside the shipped catalog and realistic gates', () => {
    expect(SCENARIO_ORDER).toEqual(['ms_occupancy', 'ms_urgent']);
    const all = CAPABILITY_FIXTURES.flatMap(scenarioActions);
    expect(new Set(all.flatMap((action) => action.capabilities?.rules ?? []))).toEqual(new Set(Object.keys(CAPABILITIES)));
    for (const scenario of CAPABILITY_FIXTURES) {
      expect(validateScenario(scenario, buildLocation(scenario.locationFamilyId, scenario.locationSeed))).toEqual([]);
      expect(scenario.rewards).toEqual({ funding: 0, devPoints: 0, trust: 0, xp: 0 });
    }
    for (const [id, tag, cert, supply] of [
      ['capability_inspect', 'inspection_camera', 'drone_operator', null],
      ['capability_device', 'energy_device', 'less_lethal', 'energy_cartridge'],
      ['capability_impact', 'impact_launcher', 'advanced_less_lethal', 'impact_supply'],
      ['capability_access_charge', 'door_charge', 'controlled_access', 'door_charge'],
    ]) {
      const a = all.find((action) => action.id === id)!;
      expect(a.requires.allTags).toContain(tag);
      expect(a.requires.certs).toContain(cert);
      if (supply) expect(a.consumes).toContainEqual({ tag: supply, qty: 1 });
      else expect(a.consumes ?? []).toEqual([]);
    }
  });

  it('finishes every fixture through communication without buying gear or consuming stock', () => {
    for (const scenario of CAPABILITY_FIXTURES) {
      const initial = makeState();
      const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
      const running = startRun(initial, scenario.id, ['A'], { positions: { A: entry }, loadouts: { A: {} } });
      const done = playPolicy(running, { assess: [`${scenario.id}_continue`], adapt: [`${scenario.id}_talk`], resolve: [`${scenario.id}_peaceful`] });
      expect(done.steps).toHaveLength(3);
      expect(Object.keys(done.state.units).sort()).toEqual(Object.keys(initial.units).sort());
      expect(done.debrief.resources.every((row) => row.itemId === 'radio_kit')).toBe(true);
      expect(done.state.department).toEqual(initial.department);
    }
  });

  it('refuses replay of an already committed optional exercise step without changing state', () => {
    const scenario = CAPABILITY_FIXTURES[0];
    let state = startRun(makeState(), scenario.id, ['A'], { positions: { A: 'forecourt' }, loadouts: { A: {} } });
    const a = actionViews(state, NOW, 'A').find((action) => action.id === 'capability_view_clear')!;
    const command = { type: 'decide' as const, actionId: a.id, actingSquadIds: a.actingSquadIds, supportSquadIds: a.supportSquadIds };
    state = apply(state, command).state;
    const repeat = apply(state, command);
    expect(repeat.result.ok).toBe(false);
    expect(repeat.state).toBe(state);
  });

  it('keeps unsupported access, indoor vehicle and daylight-lighting counter contexts visible', () => {
    const all = CAPABILITY_FIXTURES.flatMap(scenarioActions);
    expect(all.find((a) => a.id === 'capability_access_unsupported')?.capabilities?.openingId).toBe('w_shop_front');
    expect(all.find((a) => a.id === 'capability_evacuate_indoor')?.targetId).toBe('stockroom');
    expect(all.find((a) => a.id === 'capability_evacuate_narrow')?.capabilities?.vehicleAccessible).toBe(false);
    expect(all.find((a) => a.id === 'capability_view_day')?.capabilities?.rules).toContain('dark_visible_scene');
    const s = CAPABILITY_FIXTURES.find((scenario) => scenario.id === 'capability_response_v2')!;
    expect(s.environment?.timeOfDay).toBe('day');
  });

});
