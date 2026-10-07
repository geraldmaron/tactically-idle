import type { ActionDefinition, FactDefinition, OutcomeEffect, ScenarioDefinition } from '../scenario-types';
import type { StageId } from '../types';
import { SCENARIOS } from '../../content/scenarios';

// Test-only capability fixtures: three small scenarios that put each equipment capability
// rule (sightlines, heat, cameras, radio links, protective and specialist support, less-lethal
// classes, door access, medical aid, exterior vehicles) in front of the real checks, map and
// exact-stock machinery. They are not in the shipped catalog; tests that start them call
// registerCapabilityFixtures(). Effects describe fictional game outcomes, never equipment use.
const fact = (id: string, label: string, spaceId: string): FactDefinition => ({
  id, label, spaceId, truth: true, initial: 'reported', showWhenUnknown: true,
  markers: { reported: 'UNVERIFIED', confirmed: 'VERIFIED' },
  claim: `${label} has been reported.`, source: 'Exercise controller (unverified)',
  note: 'Check the report before choosing a context-dependent option.',
  uncertainty: `Whether ${label.toLowerCase()} has been verified`,
});

function action(id: string, stage: StageId, title: string, targetId: string, effect: OutcomeEffect = {}): ActionDefinition {
  const once = `used:${id}`;
  const finish = stage === 'resolve' ? { ending: 'completed' } : {};
  return {
    id, stage, title, icon: 'intel', summary: title, targetId, task: title,
    requires: { notFlags: [{ flag: once, reason: 'This exercise step has already been completed' }] },
    check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.5 }, { key: 'composure', weight: 0.5 }], difficulty: 43 },
    approach: 'none', observes: [], workload: { base: 3, perSqFt: 0 }, stressBase: 2,
    outcomes: {
      favorable: [{ ...finish, ...effect, objective: 12, setFlags: [once, ...(effect.setFlags ?? [])], text: 'The exercise step improved the team’s position.' }],
      mixed: [{ ...finish, ...effect, objective: 5, setFlags: [once, ...(effect.setFlags ?? [])], text: 'The exercise step partly worked and took additional attention.' }],
      adverse: [{ ...finish, ...effect, objective: 1, civilian: -4, pressure: 4, setFlags: [once, ...(effect.setFlags ?? [])], text: 'The exercise step did not go as planned; the team reviewed its safety margin.' }],
    },
  };
}

function contact(id: string, stage: StageId, target: string, effect: OutcomeEffect): ActionDefinition {
  const a = action(id, stage, 'Continue calm communication', target, effect);
  a.icon = 'radio';
  a.check = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }], difficulty: 35 };
  a.capabilities = { rules: [], deescalation: true };
  a.equipment = [
    { tag: 'hailer', value: 5, group: 'contact_link', label: 'one-way contact aid' },
    { tag: 'throw_phone', value: 8, group: 'contact_link', label: 'two-way contact aid', range: 'opening' },
  ];
  a.spatial = { channel: 'sound', weight: 12, noun: 'Voice' };
  return a;
}

function exercise(id: string, title: string, timeOfDay: 'day' | 'night', familyId: string, target: string, facts: FactDefinition[]): ScenarioDefinition {
  return {
    id, version: 2, code: `FIXTURE ${id === 'capability_signals_v2' ? '03' : id === 'capability_response_v2' ? '04' : '05'}`,
    title, setting: familyId === 'market_row' ? 'business' : 'residential', locationFamilyId: familyId, locationSeed: 0,
    summary: 'A fictional equipment exercise. Compare the useful context, the limits and the communication alternative.',
    variantLabel: 'Equipment fixture', pressureLabel: 'Exercise pressure', squadRange: { min: 1, max: 3 },
    briefing: {
      known: ['Officer qualifications apply. Equipment comes from the squad’s owned, reserved stock.'],
      unknown: ['Reported facts need checking. Equipment does not establish truth or guarantee safety.'],
    },
    facts, objectives: [{ id: 'capability_safety', label: 'Finish with a safe, informed plan' }, { id: 'capability_limits', label: 'Compare useful equipment with its context limits' }],
    pressure: { start: 12, perMinute: 0.4, threshold: 75, civilianPerMinute: 0.5 },
    environment: { timeOfDay, weather: 'clear', power: timeOfDay === 'night' ? 'off' : 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: true, plansOnFile: true, alarm: 'none', cctv: false },
    stages: {
      assess: { id: 'assess', label: 'Compare information', prompt: 'Try a context, then continue the exercise.', actions: [action(`${id}_continue`, 'assess', 'Continue with the available information', target, { stage: 'adapt' })] },
      adapt: { id: 'adapt', label: 'Compare support', prompt: 'Choose useful preparation or continue communication.', actions: [contact(`${id}_talk`, 'adapt', target, { stage: 'resolve' })] },
      resolve: { id: 'resolve', label: 'Choose a safe finish', prompt: 'Equipment is optional. Communication and handover remain viable.', actions: [contact(`${id}_peaceful`, 'resolve', target, { ending: 'completed', civilian: 2 }), action(`${id}_handover`, 'resolve', 'Hand over the exercise safely', target, { ending: 'handed_over' })] },
    },
    endings: {
      completed: { id: 'completed', title: 'Exercise completed', summary: 'Review the score, time and safety explanations to compare options.', trustAdjust: 0, strain: 0 },
      handed_over: { id: 'handed_over', title: 'Safe handover', summary: 'The team passed on what it knew without forcing an uncertain outcome.', trustAdjust: 0, strain: 0 },
    },
    rewards: { funding: 0, devPoints: 0, trust: 0, xp: 0 },
  };
}

function signals(): ScenarioDefinition {
  const s = exercise('capability_signals_v2', 'Signals after dark', 'night', 'market_row', 'shop', [fact('f_report', 'The reported person’s location', 'shop')]);
  const visible = action('capability_view_clear', 'assess', 'Observe the open forecourt after dark', 'forecourt');
  visible.check.kind = 'observation';
  visible.spatial = { channel: 'visual', weight: 12, noun: 'Sightline' };
  visible.capabilities = { rules: ['visible_exterior', 'dark_visible_scene'] };
  const opaque = action('capability_view_opaque', 'assess', 'Compare the blocked stockroom view', 'stockroom');
  opaque.check.kind = 'observation';
  opaque.spatial = { channel: 'visual', weight: 12, noun: 'Sightline' };
  opaque.capabilities = { rules: ['visible_exterior', 'dark_visible_scene'] };
  const thermal = action('capability_heat', 'assess', 'Compare heat observation through glazing', 'shop');
  thermal.icon = 'thermal';
  thermal.requires = { ...thermal.requires, allTags: ['thermal'] };
  thermal.check.kind = 'observation';
  thermal.spatial = { channel: 'thermal', weight: 14, noun: 'Heat', openingId: 'w_shop_front' };
  thermal.approach = 'window';
  thermal.equipment = [{ tag: 'thermal', value: 8, label: 'heat observation aid' }];
  const inspect = action('capability_inspect', 'assess', 'Inspect a usable exterior opening', 'shop');
  inspect.requires = { ...inspect.requires, allTags: ['inspection_camera'], certs: ['drone_operator'] };
  inspect.approach = 'window';
  inspect.check.kind = 'observation';
  inspect.spatial = { channel: 'visual', weight: 12, noun: 'Camera view', openingId: 'd_side' };
  inspect.capabilities = { rules: ['opening_inspection'], required: ['opening_inspection'], openingId: 'd_side' };
  const drone = action('capability_drone', 'assess', 'Observe with a remote camera', 'shop');
  drone.icon = 'drone';
  drone.requires = { ...drone.requires, allTags: ['drone'], certs: ['drone_operator'] };
  drone.approach = 'window';
  drone.check.kind = 'observation';
  drone.spatial = { channel: 'visual', weight: 12, noun: 'Camera view', openingId: 'd_side' };
  drone.equipment = [{ tag: 'drone', value: 8, group: 'observation_aid', range: 'opening', label: 'remote camera view' }];
  const openView = action('capability_open_view', 'assess', 'Ask the keyholder to open the scene view', 'forecourt', { openings: [{ openingId: 'd_side', state: 'open' }] });
  openView.keyholder = true;
  const openHeat = structuredClone(thermal);
  openHeat.id = 'capability_heat_open';
  openHeat.title = 'Compare heat observation through the open door';
  openHeat.summary = openHeat.title;
  openHeat.spatial!.openingId = 'd_side';
  openHeat.requires.notFlags = [{ flag: 'used:capability_heat_open', reason: 'This exercise step has already been completed' }];
  for (const effects of Object.values(openHeat.outcomes)) effects[0].setFlags = ['used:capability_heat_open'];
  s.stages.assess.actions.unshift(visible, opaque, openView, thermal, openHeat, inspect, drone);
  for (const [id, title, target] of [['capability_radio_weak', 'Coordinate around the rear walls', 'stockroom'], ['capability_radio_clear', 'Coordinate on open ground', 'pavement']] as const) {
    const a = action(id, 'adapt', title, target);
    a.icon = 'radio';
    a.capabilities = { rules: ['weak_radio_link', 'scene_coordination'], vehicleAccessible: target === 'pavement' };
    a.support = { max: 8, coverSpaceId: target, reachMinutes: 15, maxSquads: 2, label: 'sharing observations', task: 'Coordinate' };
    s.stages.adapt.actions.unshift(a);
  }
  return s;
}

function response(): ScenarioDefinition {
  const s = exercise('capability_response_v2', 'Response choices in daylight', 'day', 'cedar_close', 'living', [fact('f_subject', 'The reported subject’s identity and location', 'living'), fact('f_safety', 'The adjacent area’s safety', 'living')]);
  const verify = action('capability_verify_context', 'assess', 'Request verified exercise context', 'living', { knowledge: [{ factId: 'f_subject', status: 'confirmed' }, { factId: 'f_safety', status: 'confirmed' }], stage: 'adapt' });
  verify.check.kind = 'observation';
  const bright = action('capability_view_day', 'assess', 'Observe the front garden in daylight', 'front_yard');
  bright.check.kind = 'observation';
  bright.spatial = { channel: 'visual', weight: 12, noun: 'Sightline' };
  bright.capabilities = { rules: ['visible_exterior', 'dark_visible_scene'] };
  s.stages.assess.actions.unshift(verify, bright);
  for (const [id, title, target, responseContext] of [['capability_contain_open', 'Declared protective containment', 'front_yard', 'open'], ['capability_contain_constrained', 'Compare constrained protective work', 'hall', 'constrained']] as const) {
    const a = action(id, 'adapt', title, target);
    a.icon = 'shield';
    a.requires = { ...a.requires, certs: ['entry_team'] };
    a.check.kind = 'execution';
    a.capabilities = { rules: ['authorized_response'], responseContext };
    a.equipment = [{ tag: 'shield', value: 5, narrowValue: 2, group: 'personal_protection', label: 'protected approach aid' }];
    a.capacityBound = [target];
    s.stages.adapt.actions.unshift(a);
  }
  for (const [id, target] of [['capability_specialist_clear', 'front_yard'], ['capability_specialist_blocked', 'bedroom_w']] as const) {
    const a = action(id, 'adapt', target === 'front_yard' ? 'Compare clear specialist support' : 'Compare blocked specialist support', target);
    a.requires = { ...a.requires, certs: ['precision_support'], minSquads: { count: 2, reason: 'Specialist support needs a separate supporting squad' } };
    a.check.kind = 'execution';
    a.spatial = { channel: 'visual', weight: 12, noun: 'Support view' };
    a.capabilities = { rules: ['specialist_support'], required: ['specialist_support'], subjectFactIds: ['f_subject'] };
    a.support = { max: 6, coverSpaceId: 'front_yard', reachMinutes: 12, maxSquads: 1, label: 'separate support role', task: 'Support' };
    s.stages.adapt.actions.unshift(a);
  }
  for (const [id, title, rule, tag, supply, cert] of [
    ['capability_device', 'Compare a device-class intervention', 'less_lethal_device', 'energy_device', 'energy_cartridge', 'less_lethal'],
    ['capability_impact', 'Compare an impact-class intervention', 'less_lethal_impact', 'impact_launcher', 'impact_supply', 'advanced_less_lethal'],
  ] as const) {
    const a = action(id, 'resolve', title, 'front_yard');
    a.summary = 'Fictional intervention: an adverse result can reduce civilian safety. Communication remains available.';
    a.requires = { ...a.requires, allTags: [tag], certs: [cert] };
    a.consumes = [{ tag: supply, qty: 1 }];
    a.check.kind = 'execution';
    a.spatial = { channel: 'visual', weight: 8, noun: 'Scene view' };
    a.capabilities = { rules: [rule], required: [rule], subjectFactIds: ['f_subject'], safetyFactIds: ['f_safety'] };
    a.outcomes.adverse[0].civilian = -18;
    a.outcomes.adverse[0].text = 'The intervention did not resolve the exercise safely; specialist care was needed.';
    s.stages.resolve.actions.unshift(a);
  }
  return s;
}

function rescue(): ScenarioDefinition {
  const s = exercise('capability_rescue_v2', 'Access and patient assistance', 'day', 'market_row', 'shop', [fact('f_patient', 'The patient’s location', 'stockroom'), fact('f_adjacent', 'The adjacent area’s safety', 'shop')]);
  s.pressure = { start: 25, perMinute: 1.4, threshold: 65, civilianPerMinute: 1 };
  const verify = action('capability_rescue_verify', 'assess', 'Verify the patient and adjacent area', 'stockroom', { knowledge: [{ factId: 'f_patient', status: 'confirmed' }, { factId: 'f_adjacent', status: 'confirmed' }], stage: 'adapt' });
  verify.approach = 'path';
  verify.keyholder = true;
  verify.check.kind = 'observation';
  s.stages.assess.actions.unshift(verify);
  for (const [id, title, openingId, accessMethod] of [
    ['capability_access_solid', 'Use mechanical access on a supported door', 'd_stock', 'mechanical'],
    ['capability_access_steel', 'Compare mechanical access on a steel door', 'd_delivery', 'mechanical'],
    ['capability_access_charge', 'Compare the single-use abstract access option', 'd_stock', 'charge'],
    ['capability_access_unsupported', 'Review an unsupported glazing target', 'w_shop_front', 'charge'],
  ] as const) {
    const a = action(id, 'adapt', title, openingId === 'd_delivery' ? 'delivery_lane' : 'shop', { openings: [{ openingId, state: 'open' }], pressure: accessMethod === 'charge' ? 8 : 1 });
    a.icon = 'door';
    a.approach = 'path';
    a.summary = accessMethod === 'charge' ? 'A fictional single-use token: faster, with higher pressure and collateral risk' : 'Slower preparation for a supported door; no wall or blocked-route bypass';
    a.requires = { ...a.requires, certs: ['controlled_access'], allTags: [accessMethod === 'charge' ? 'door_charge' : 'rescue_tool'] };
    if (accessMethod === 'charge') a.consumes = [{ tag: 'door_charge', qty: 1 }];
    a.check.kind = 'execution';
    a.workload.base = accessMethod === 'charge' ? 2 : 6;
    a.capabilities = { rules: ['permitted_door_access'], required: ['permitted_door_access'], accessMethod, openingId, safetyFactIds: ['f_adjacent'] };
    for (const [band, civilian] of [['favorable', -2], ['mixed', -6], ['adverse', -14]] as const) {
      a.outcomes[band][0].pressure = accessMethod === 'charge' ? 8 : 1;
      a.outcomes[band][0].civilian = accessMethod === 'charge' ? civilian : band === 'adverse' ? -4 : 0;
      if (band === 'adverse') delete a.outcomes[band][0].openings;
    }
    s.stages.adapt.actions.unshift(a);
  }
  const ordinary = action('capability_access_keyholder', 'adapt', 'Ask the keyholder to arrange access', 'stockroom', { openings: [{ openingId: 'd_stock', state: 'open' }], stage: 'resolve' });
  ordinary.keyholder = true;
  ordinary.workload.base = 5;
  s.stages.adapt.actions.push(ordinary);
  const medical = action('capability_patient_aid', 'resolve', 'Provide qualified patient assistance', 'forecourt');
  medical.icon = 'medic';
  medical.requires = { ...medical.requires, certs: ['advanced_first_aid'], allTags: ['medkit'], facts: [{ factId: 'f_patient', in: ['confirmed'], reason: 'Locate the patient before giving assistance' }] };
  medical.consumes = [{ tag: 'medkit', qty: 1 }];
  medical.check = { kind: 'medical', ratings: [{ key: 'medical', weight: 0.8 }, { key: 'coordination', weight: 0.2 }], difficulty: 44 };
  medical.capabilities = { rules: ['medical_exposure'] };
  medical.equipment = [{ tag: 'medkit', value: 8, label: 'medical supplies ready' }];
  s.stages.resolve.actions.unshift(medical);
  for (const [id, title, target, vehicleAccessible] of [
    ['capability_evacuate_exterior', 'Coordinate an exterior protected evacuation', 'forecourt', true],
    ['capability_evacuate_narrow', 'Compare the inaccessible delivery route', 'west_alley', false],
    ['capability_evacuate_indoor', 'Compare interior patient support', 'stockroom', true],
  ] as const) {
    const a = action(id, 'resolve', title, target);
    a.capabilities = { rules: ['vehicle_exterior'], vehicleAccessible };
    a.icon = 'medic';
    a.check.kind = 'medical';
    s.stages.resolve.actions.unshift(a);
  }
  return s;
}

export const CAPABILITY_FIXTURES: ScenarioDefinition[] = [signals(), response(), rescue()];

/** Make the fixtures resolvable by id for this test file (each test file has its own registry). */
export function registerCapabilityFixtures(): void {
  for (const scenario of CAPABILITY_FIXTURES) SCENARIOS[scenario.id] = scenario;
}
