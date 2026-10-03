import { describe, expect, it } from 'vitest';
import { COURSES } from '../../content/courses';
import { buildLocation } from '../../sim/location';
import { civilianOutcomeViews } from '../../sim/incident-consequences';
import { initializePersonnel } from '../../sim/personnel';
import { computeDebrief, validateScenario } from '../../sim/operation';
import { actionViews, spaceViews } from '../../sim/operation-selectors';
import { bandFor, builtFor, evaluateAction, openingFlag } from '../../sim/resolution';
import { next } from '../../sim/rng';
import { getScenario } from '../../sim/scenario-registry';
import { scenarioActions, type IncidentSpec } from '../../sim/scenario-types';
import { deserialize, serialize } from '../../sim/save';
import { apply, makeState, NOW, setRun, startCmd, unitId } from '../../sim/test-fixtures';
import type { GameState, OutcomeBand } from '../../sim/types';
import { generateIncident, incidentId } from './index';

const TYPES = ['active_armed_incident', 'hostage_crisis', 'protected_rescue'] as const;
const specFor = (type: typeof TYPES[number], seed = 7, familyId = 'cedar_close'): IncidentSpec => ({ type, familyId, seed, buildingSeed: 7, tier: 2, contentVersion: 4 });
function findSpec(type: typeof TYPES[number], truths: Record<string, boolean> = {}, services = ['civilian_ambulance', 'officer_ambulance']) {
  truths = { f_care_needed: true, ...(type === 'active_armed_incident' ? { f_subject_stand_down: true } : {}), ...truths };
  for (let seed = 0; seed < 500; seed++) {
    const spec = specFor(type, seed);
    const s = generateIncident(spec);
    if (Object.entries(truths).every(([id, value]) => s.facts.find(f => f.id === id)?.truth === value)
      && services.every(id => s.externalServices!.find(service => service.id === id)?.available)) return spec;
  }
  throw new Error('No suitable deterministic high-risk fixture');
}
function running(spec: IncidentSpec, equipment: string[] = [], options: { vehicle?: boolean; certs?: boolean; solo?: boolean } = {}): GameState {
  const s = getScenario(incidentId(spec))!;
  const inventory = Object.fromEntries(equipment.map(id => [id, id === 'trauma_kit' ? 5 : 1]));
  if (options.vehicle) inventory.armored_rescue_vehicle = 1;
  const state = makeState({ inventory });
  state.saveVersion = 5; state.contentVersion = 4; initializePersonnel(state);
  if (options.certs !== false) {
    const certs = Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : []);
    for (const officer of Object.values(state.officers)) officer.certs = [...new Set(certs)];
  }
  if (options.solo) {
    state.squads[0].officerIds = ['off_brooks']; state.squads[0].leaderId = 'off_brooks';
    for (const officer of Object.values(state.officers)) if (officer.squadId === 'A' && officer.id !== 'off_brooks') officer.squadId = null;
  }
  state.incidents = [{ id: s.id, type: spec.type, familyId: spec.familyId, tier: spec.tier, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const entry = buildLocation(spec.familyId, spec.buildingSeed).location.entries[0];
  const cmd = { ...startCmd(s.id, ['A'], { positions: { A: entry }, loadouts: { A: Object.fromEntries(equipment.map(id => [id, id === 'trauma_kit' ? 3 : 1])) } }), ...(options.vehicle ? { supportUnitIds: [unitId('armored_rescue_vehicle')] } : {}) };
  const result = apply(state, cmd); expect(result.result).toEqual({ ok: true }); return result.state;
}
function evaluate(state: GameState, id: string) {
  const run = state.activeRun!;
  const scenario = getScenario(run.scenarioId)!;
  const action = scenarioActions(scenario).find(a => a.id === id)!;
  expect(action, id).toBeDefined();
  return evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function decide(state: GameState, id: string, band?: OutcomeBand): GameState {
  const ev = evaluate(state, id); expect(ev.eligible, `${id}: ${ev.reason}`).toBe(true);
  const input = structuredClone(state);
  // Only non-save content tests force a band. Save tests use a single initial seed.
  if (band) for (let seed = 1; seed < 100_000; seed++) if (bandFor(ev.margin, next(seed).value) === band) { input.activeRun!.rngState = seed; break; }
  const result = apply(input, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result, id).toEqual({ ok: true });
  if (band) expect(result.state.activeRun!.history.at(-1)!.band).toBe(band);
  return result.state;
}
function play(state: GameState, ids: string[]): GameState { for (const id of ids) state = decide(state, id); return state; }
function serviceCare(state: GameState, who: 'officer' | 'civilian'): GameState {
  const prefix = who === 'officer' ? `hr_${state.activeRun!.stage}_officer` : 'hr_civilian';
  if (who === 'civilian' && !state.activeRun!.flags.includes('hr_care_checked')) state = decide(state, 'hr_check_civilian_needs');
  state = decide(state, `${prefix}_request`);
  if (evaluate(state, `${prefix}_wait`).eligible) state = decide(state, `${prefix}_wait`);
  if (who === 'civilian') state = decide(state, 'hr_civilian_agreement');
  return decide(state, `${prefix}_${who === 'officer' ? 'evacuate' : 'transfer'}`);
}
function refused(state: GameState, actionId: string): void {
  const result = apply(state, { type: 'decide', actionId, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result.ok).toBe(false); expect(result.state).toBe(state);
}

describe('new high-risk version-four families', () => {
  it.each(TYPES)('%s has valid deterministic references and honest terminal conditions', type => {
    for (const familyId of ['cedar_close', 'harbour_court', 'market_row']) for (const seed of [0, 7, 42]) {
      const spec = specFor(type, seed, familyId); const s = generateIncident(spec);
      expect(generateIncident(spec)).toEqual(s);
      expect(validateScenario(s, buildLocation(familyId, spec.buildingSeed)), s.id).toEqual([]);
      expect(s.briefing.dispatchReason).toMatch(/SWAT was requested/);
      expect(s.civilianOutcomes!.length).toBe(type === 'hostage_crisis' ? 2 : 1);
      for (const action of scenarioActions(s)) {
        expect(action.outcomePreview).toEqual({ favorable: expect.any(String), mixed: expect.any(String), adverse: expect.any(String) });
        expect(action.visibleWhen?.notFlags).toContain(`used:${action.id}`);
        for (const effects of Object.values(action.outcomes)) for (const effect of effects) if (!effect.ending) expect(effect.objective ?? 0).toBe(0);
      }
      for (const ending of Object.values(s.endings)) {
        expect(ending.disposition).toBeDefined();
        if (ending.disposition === 'care_accepted') expect(ending.completion).toMatchObject({ acceptedServiceId: 'civilian_ambulance', notFlags: ['casualty:untreated', 'casualty:awaiting_transport'] });
      }
    }
  });

  it.each(TYPES)('%s hides truth from previews and markers', type => {
    const state = running(specFor(type)); const s = getScenario(state.activeRun!.scenarioId)!;
    const original = structuredClone(s.facts);
    const before = { actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) };
    try { for (const fact of s.facts) fact.truth = !fact.truth;
      expect({ actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) }).toEqual(before);
    } finally { s.facts = original; }
  });

  it('requires an actual serviceable assigned weapon and a qualified participating operator', () => {
    const spec = findSpec('active_armed_incident');
    for (const equipment of [[], ['light_protection']]) {
      const state = decide(running(spec, equipment), 'hr_check_accounts');
      expect(evaluate(state, 'hr_armed_response').eligible).toBe(false); refused(state, 'hr_armed_response');
      expect(evaluate(state, 'hr_adapt_withdraw').eligible).toBe(true);
    }
    const armed = decide(running(spec, ['service_sidearm']), 'hr_check_accounts');
    expect(evaluate(armed, 'hr_armed_response').eligible).toBe(true);
    const unqualified = structuredClone(armed);
    for (const officer of Object.values(unqualified.officers)) officer.certs = officer.certs.filter(cert => cert !== 'entry_team');
    expect(evaluate(unqualified, 'hr_armed_response').eligible).toBe(false);
    const worn = structuredClone(armed); worn.units[unitId('service_sidearm')].condition = 0;
    expect(evaluate(worn, 'hr_armed_response').eligible).toBe(false);
    const unassigned = structuredClone(armed); unassigned.reservations = unassigned.reservations.filter(r => r.itemId !== 'service_sidearm');
    expect(evaluate(unassigned, 'hr_armed_response').eligible).toBe(false);
  });

  it('interrupts an armed response with a real casualty, consumes one kit, accepts separate care, then continues', () => {
    const spec = findSpec('active_armed_incident', { f_exit_usable: true });
    let state = decide(running(spec, ['service_sidearm', 'trauma_kit']), 'hr_check_accounts');
    state = decide(state, 'hr_armed_response', 'mixed');
    const injury = Object.values(state.activeRun!.officerCasualties!)[0];
    expect(injury).toMatchObject({ severity: 'wounded', care: 'needed' });
    expect(state.officers[injury.officerId].injury).not.toBeNull();
    expect(state.activeRun!.status).toBe('active'); expect(state.activeRun!.objective).toBe(0);
    expect(actionViews(state, NOW, 'A').map(a => a.id)).not.toContain('hr_verify_danger_ended');
    refused(state, 'hr_verify_danger_ended');
    state = decide(state, 'hr_resolve_officer_aid');
    expect(state.activeRun!.history.at(-1)!.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
    expect(state.activeRun!.officerCasualties![injury.officerId].care).toBe('stabilized');
    refused(state, 'hr_resolve_officer_aid');
    state = serviceCare(state, 'officer');
    expect(state.activeRun!.officerCasualties![injury.officerId].care).toBe('evacuated');
    state = play(state, ['hr_verify_danger_ended', 'hr_resident_alternative', 'hr_protect_resident']);
    expect(state.activeRun!.history.at(-1)!.officerIds).not.toContain(injury.officerId);
    expect(state.activeRun!.externalSupport!.civilian_ambulance).toBeUndefined();
    state = serviceCare(state, 'civilian');
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: true, disposition: 'care_accepted' });
    expect(state.officers[injury.officerId].injury).not.toBeNull();
  });

  it('keeps serious resident injury distinct from protection and accepted care', () => {
    const spec = findSpec('active_armed_incident', { f_exit_usable: true });
    let state = decide(decide(running(spec, ['service_sidearm']), 'hr_check_accounts'), 'hr_armed_response', 'adverse');
    expect(civilianOutcomeViews(getScenario(state.activeRun!.scenarioId)!, state.activeRun!)[0].status).toBe('injured_needs_care');
    state = decide(state, 'hr_resolve_officer_continue');
    expect(state.activeRun!.flags).toContain('hr_danger_active');
    expect(state.activeRun!.flags).not.toContain('hr_danger_interrupted');
    state = decide(state, 'hr_armed_regroup');
    state = decide(state, 'hr_armed_revised_response', 'favorable');
    state = play(state, ['hr_verify_danger_ended', 'hr_resident_alternative', 'hr_protect_resident']);
    expect(state.activeRun!.flags).toContain('hr_injury_pause');
    state = serviceCare(state, 'officer');
    expect(civilianOutcomeViews(getScenario(state.activeRun!.scenarioId)!, state.activeRun!)[0].status).toBe('injured_needs_care');
    state = serviceCare(state, 'civilian');
    expect(civilianOutcomeViews(getScenario(state.activeRun!.scenarioId)!, state.activeRun!)[0].status).toBe('care_accepted');
  });

  it('retains command and accepted evacuation when the only deployed officer is wounded', () => {
    const spec = findSpec('active_armed_incident');
    let state = decide(decide(running(spec, ['service_sidearm'], { solo: true }), 'hr_check_accounts'), 'hr_armed_response', 'adverse');
    expect(evaluate(state, 'hr_resolve_officer_aid').eligible).toBe(false);
    state = serviceCare(state, 'officer');
    expect(evaluate(state, 'hr_verify_danger_ended').eligible).toBe(false);
    state = decide(state, 'hr_resolve_withdraw');
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: false, disposition: 'relief_partial' });
  });

  it('uses an agreed pause and revised exit as a slower complete non-weapon route', () => {
    const spec = findSpec('active_armed_incident', { f_pause_possible: true, f_exit_usable: false });
    let state = play(running(spec), ['hr_check_accounts', 'hr_agreed_pause', 'hr_verify_danger_ended']);
    refused(state, 'hr_protect_resident'); refused(state, 'hr_protect_resident_alternative');
    state = play(state, ['hr_resident_alternative', 'hr_protect_resident_alternative']);
    state = serviceCare(state, 'civilian');
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('keeps partial hostage release open and requires a distinct second-person agreement and exit', () => {
    const spec = findSpec('hostage_crisis', { f_partial_release: true, f_second_exit: false });
    let state = play(running(spec), ['hr_check_accounts', 'hr_hostage_conversation', 'hr_hostage_first_release']);
    expect(state.activeRun!.status).toBe('active'); expect(state.activeRun!.objective).toBe(0);
    const s = getScenario(state.activeRun!.scenarioId)!;
    expect(civilianOutcomeViews(s, state.activeRun!)).toMatchObject([{ status: 'safe' }, { status: 'needs_help' }]);
    refused(state, 'hr_civilian_transfer'); refused(state, 'hr_hostage_second_alternative');
    state = play(state, ['hr_hostage_maintain_contact', 'hr_hostage_second_arrangement', 'hr_hostage_second_alternative']);
    expect(civilianOutcomeViews(s, state.activeRun!)).toMatchObject([{ status: 'safe' }, { status: 'safe' }]);
    state = serviceCare(state, 'civilian');
    expect(civilianOutcomeViews(s, state.activeRun!)).toMatchObject([{ status: 'care_accepted' }, { status: 'care_accepted' }]);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('requires addressing an unsuitable initial hostage release before anybody is protected', () => {
    const spec = findSpec('hostage_crisis', { f_partial_release: false });
    let state = play(running(spec), ['hr_check_accounts', 'hr_hostage_conversation']);
    refused(state, 'hr_hostage_first_release'); refused(state, 'hr_hostage_revised_release');
    state = play(state, ['hr_hostage_release_concern', 'hr_hostage_revised_release']);
    expect(state.activeRun!.flags).toContain('hr_first_safe'); expect(state.activeRun!.flags).not.toContain('hr_second_safe');
  });

  it('makes actual reserved vehicle access a different rescue path when slower assistance is unsuitable', () => {
    const spec = findSpec('protected_rescue', { f_exterior_pickup: true, f_assisted_route: false });
    const prepare = (state: GameState) => play(state, ['hr_check_accounts', 'hr_rescue_reach', 'hr_rescue_reach_pickup']);
    const bare = prepare(running(spec)); expect(evaluate(bare, 'hr_rescue_armored_vehicle').eligible).toBe(false);
    expect(evaluate(bare, 'hr_rescue_assisted_move').eligible).toBe(false); expect(evaluate(bare, 'hr_resolve_withdraw').eligible).toBe(true);
    let equipped = prepare(running(spec, [], { vehicle: true }));
    expect(evaluate(equipped, 'hr_rescue_armored_vehicle').eligible).toBe(true);
    for (const mutation of [
      (state: GameState) => { state.units[unitId('armored_rescue_vehicle')].condition = 0; },
      (state: GameState) => { state.reservations = state.reservations.filter(r => r.itemId !== 'armored_rescue_vehicle'); },
      (state: GameState) => { for (const officer of Object.values(state.officers)) officer.certs = officer.certs.filter(cert => cert !== 'vehicle_operations'); },
      (state: GameState) => { state.activeRun!.supportPositionId = state.activeRun!.locationFamilyId; },
    ]) { const altered = structuredClone(equipped); mutation(altered); expect(evaluate(altered, 'hr_rescue_armored_vehicle').eligible).toBe(false); }
    equipped = decide(equipped, 'hr_rescue_armored_vehicle', 'favorable');
    expect(equipped.activeRun!.history.at(-1)!.unitsUsed.includes(unitId('armored_rescue_vehicle'))).toBe(true);
    equipped = serviceCare(equipped, 'civilian');
    expect(computeDebrief(equipped, equipped.activeRun!)!.completionAchieved).toBe(true);
    const before = equipped.units[unitId('armored_rescue_vehicle')].condition;
    const closed = apply(equipped, { type: 'closeDebrief' }); expect(closed.result).toEqual({ ok: true });
    expect(closed.state.units[unitId('armored_rescue_vehicle')].condition).toBeLessThan(before);
  });

  it('refuses blocked physical access and a verified inaccessible vehicle pickup', () => {
    const spec = findSpec('protected_rescue', { f_exterior_pickup: false, f_assisted_route: true });
    const initial = decide(running(spec, [], { vehicle: true }), 'hr_check_accounts');
    const s = getScenario(initial.activeRun!.scenarioId)!;
    const reach = scenarioActions(s).find(a => a.id === 'hr_rescue_reach')!;
    const blocked = setRun(initial, { flags: [openingFlag(reach.requires.openings![0].openingId, 'blocked')] });
    expect(evaluate(blocked, 'hr_rescue_reach').eligible).toBe(false);
    let state = play(initial, ['hr_rescue_reach', 'hr_rescue_prepare_assistance', 'hr_rescue_reach_pickup']);
    expect(evaluate(state, 'hr_rescue_armored_vehicle').eligible).toBe(false);
    state = decide(state, 'hr_rescue_assisted_move', 'favorable');
    state = serviceCare(state, 'civilian');
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('preserves real seeded injury, history, pending care and future decisions across reload', () => {
    const spec = findSpec('active_armed_incident', { f_exit_usable: true });
    let state: GameState | undefined;
    for (let seed = 1; seed < 200; seed++) {
      const candidate = running(spec, ['service_sidearm', 'trauma_kit']); candidate.activeRun!.rngState = seed;
      const checked = decide(candidate, 'hr_check_accounts');
      const outcome = decide(checked, 'hr_armed_response');
      if (Object.values(outcome.activeRun!.officerCasualties ?? {}).length) { state = outcome; break; }
    }
    expect(state).toBeDefined();
    state = decide(state!, 'hr_resolve_officer_request');
    const restored = deserialize(serialize(state, NOW)); expect(restored).not.toBeNull();
    expect(restored!.activeRun).toEqual(state.activeRun);
    const nextId = evaluate(state, 'hr_resolve_officer_wait').eligible ? 'hr_resolve_officer_wait' : 'hr_resolve_officer_evacuate';
    expect(decide(restored!, nextId)).toEqual(decide(state, nextId));
    refused(state, 'hr_armed_response'); refused(state, 'hr_resolve_officer_request');
    expect(state.activeRun!.objective).toBe(0);
  });

  it('keeps visible public menus small across real hostage and rescue state changes', () => {
    const scenarios: [IncidentSpec, string[]][] = [
      [findSpec('hostage_crisis', { f_partial_release: false, f_second_exit: false }), ['hr_check_accounts', 'hr_hostage_conversation', 'hr_hostage_release_concern', 'hr_hostage_revised_release', 'hr_hostage_maintain_contact', 'hr_hostage_second_arrangement', 'hr_hostage_second_alternative', 'hr_check_civilian_needs', 'hr_civilian_request', 'hr_civilian_agreement']],
      [findSpec('protected_rescue', { f_assisted_route: true }), ['hr_check_accounts', 'hr_rescue_reach', 'hr_rescue_prepare_assistance', 'hr_rescue_reach_pickup']],
    ];
    for (const [spec, path] of scenarios) {
      let state = running(spec);
      for (const id of path) {
        const menu = actionViews(state, NOW, 'A'); expect(menu.length, menu.map(a => a.id).join(', ')).toBeLessThanOrEqual(5);
        expect(menu.some(a => a.eligible)).toBe(true); state = decide(state, id);
      }
    }
  });

  it('keeps danger active after failure and permits only one regrouped armed response', () => {
    const spec = findSpec('active_armed_incident', { f_pause_possible: false });
    let state = decide(decide(running(spec, ['service_sidearm']), 'hr_check_accounts'), 'hr_armed_response', 'adverse');
    expect(state.activeRun!.flags).toContain('hr_danger_active');
    expect(state.activeRun!.flags).not.toContain('hr_danger_interrupted');
    state = serviceCare(state, 'officer');
    refused(state, 'hr_verify_danger_ended'); refused(state, 'hr_armed_revised_response');
    state = decide(state, 'hr_armed_regroup');
    state = decide(state, 'hr_armed_revised_response', 'adverse');
    expect(state.activeRun!.flags).toContain('hr_danger_active');
    refused(state, 'hr_armed_revised_response'); refused(state, 'hr_armed_regroup');
    state = decide(state, 'hr_resolve_withdraw');
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: false, disposition: 'relief_partial' });
  });

  it('allows a real one-cartridge less-lethal option only after interruption and a suitable current check', () => {
    const spec = findSpec('active_armed_incident', { f_pause_possible: true, f_subject_stand_down: false, f_device_context: true, f_exit_usable: true });
    const equipment = ['conducted_energy_device', 'energy_cartridge'];
    let state = running(spec, equipment);
    refused(state, 'hr_checked_device_response');
    state = play(state, ['hr_check_accounts', 'hr_agreed_pause']);
    refused(state, 'hr_checked_device_response');
    state = decide(state, 'hr_verify_danger_ended');
    expect(state.activeRun!.flags).not.toContain('hr_danger_resolved');
    expect(evaluate(state, 'hr_checked_device_response').eligible).toBe(true);
    for (const mutation of [
      (value: GameState) => { value.reservations = value.reservations.filter(r => r.itemId !== 'conducted_energy_device'); },
      (value: GameState) => { value.reservations = value.reservations.filter(r => r.itemId !== 'energy_cartridge'); },
      (value: GameState) => { for (const officer of Object.values(value.officers)) officer.certs = officer.certs.filter(cert => cert !== 'less_lethal'); },
      (value: GameState) => { value.activeRun!.knowledge.f_device_context = 'disproved'; },
    ]) { const copy = structuredClone(state); mutation(copy); expect(evaluate(copy, 'hr_checked_device_response').eligible).toBe(false); }
    state = decide(state, 'hr_checked_device_response', 'favorable');
    expect(state.activeRun!.history.at(-1)!.itemsConsumed.filter(use => use.itemId === 'energy_cartridge')).toEqual([{ itemId: 'energy_cartridge', qty: 1 }]);
    expect(state.activeRun!.flags).toContain('hr_danger_resolved');
    refused(state, 'hr_checked_device_response');
    state = play(state, ['hr_resident_alternative', 'hr_protect_resident']);
    const exterior = buildLocation(spec.familyId, spec.buildingSeed).location.entries[0];
    expect(state.activeRun!.squadTasks.find(task => task.squadId === 'A')!.positionId).toBe(exterior);
  });

  it('offers continued dialogue when the checked device context is unsafe', () => {
    const spec = findSpec('active_armed_incident', { f_pause_possible: true, f_subject_stand_down: false, f_device_context: false });
    let state = play(running(spec, ['conducted_energy_device', 'energy_cartridge']), ['hr_check_accounts', 'hr_agreed_pause', 'hr_verify_danger_ended']);
    expect(evaluate(state, 'hr_checked_device_response').eligible).toBe(false);
    state = decide(state, 'hr_followup_dialogue');
    expect(state.activeRun!.flags).toContain('hr_danger_resolved');
    expect(state.activeRun!.history.flatMap(h => h.itemsConsumed)).toEqual([]);
  });

  it('closes a clean protected rescue with a chosen next step without forcing ambulance care', () => {
    const spec = findSpec('protected_rescue', { f_care_needed: false, f_assisted_route: true });
    let state = play(running(spec), ['hr_check_accounts', 'hr_rescue_reach', 'hr_rescue_prepare_assistance', 'hr_rescue_reach_pickup']);
    state = decide(state, 'hr_rescue_assisted_move', 'favorable');
    refused(state, 'hr_civilian_next_step');
    state = decide(state, 'hr_check_civilian_needs');
    expect(state.activeRun!.knowledge.f_care_needed).toBe('disproved');
    expect(actionViews(state, NOW, 'A').some(a => a.id === 'hr_civilian_request')).toBe(false);
    state = decide(state, 'hr_civilian_next_step');
    expect(state.activeRun!.externalSupport).toEqual({});
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: true, disposition: 'followup_agreed' });
  });

  it('lets a later actual civilian injury override a no-medical-need report', () => {
    const spec = findSpec('active_armed_incident', { f_care_needed: false, f_exit_usable: true });
    let state = decide(decide(running(spec, ['service_sidearm']), 'hr_check_accounts'), 'hr_armed_response', 'adverse');
    state = serviceCare(state, 'officer');
    state = decide(state, 'hr_armed_regroup');
    state = decide(state, 'hr_armed_revised_response', 'favorable');
    state = play(state, ['hr_verify_danger_ended', 'hr_resident_alternative', 'hr_protect_resident', 'hr_check_civilian_needs']);
    expect(state.activeRun!.knowledge.f_care_needed).toBe('disproved');
    expect(state.activeRun!.flags).toContain('hr_care_required');
    refused(state, 'hr_civilian_next_step');
    state = serviceCare(state, 'civilian');
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: true, disposition: 'care_accepted' });
  });
});
