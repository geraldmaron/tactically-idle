import { describe, expect, it } from 'vitest';
import { COURSES } from '../../../content/courses';
import { civilianOutcomeViews } from '../../../sim/incident-consequences';
import { buildLocation } from '../../../sim/location';
import { computeDebrief, validateScenario } from '../../../sim/operation';
import { actionViews, spaceViews } from '../../../sim/operation-selectors';
import { initializePersonnel } from '../../../sim/personnel';
import { bandFor, builtFor, evaluateAction, openingFlag } from '../../../sim/resolution';
import { next } from '../../../sim/rng';
import { getScenario } from '../../../sim/scenario-registry';
import { deserialize, serialize } from '../../../sim/save';
import { currentStoryPrompt } from '../../../sim/story-context';
import { scenarioActions, type IncidentSpec, type ScenarioDefinition } from '../../../sim/scenario-types';
import { apply, makeState, NOW, startCmd, unitId } from '../../../sim/test-fixtures';
import type { GameState, OutcomeBand } from '../../../sim/types';
import { generateIncident, incidentId } from '../index';
import { withArmedStory } from './armed';
import { withRescueStory } from './rescue';

type Family = 'noise' | 'chair';
const prefix = (family: Family) => `v5_${family}_`;
const id = (family: Family, short: string) => prefix(family) + short;
function fixture(family: Family, seed: number, familyId = family === 'noise' ? 'market_row' : 'juniper_court_v1'): ScenarioDefinition {
  const spec: IncidentSpec = { type: family === 'noise' ? 'active_armed_incident' : 'protected_rescue', familyId, buildingSeed: 7, seed, tier: 2, contentVersion: 5 };
  return getScenario(incidentId(spec))!;
}
function find(family: Family, truths: Record<string, boolean> = {}, available = true): ScenarioDefinition {
  for (let seed = 0; seed < 500; seed++) {
    const s = fixture(family, seed);
    if (Object.entries(truths).every(([name, truth]) => s.facts.find(f => f.id === id(family, `f_${name}`))?.truth === truth)
      && (!available || s.externalServices!.every(service => service.available))) return s;
  }
  throw new Error('No matching deterministic personal protection story');
}
function running(s: ScenarioDefinition, gear: string[] = [], vehicle = false): GameState {
  const inventory = Object.fromEntries(gear.map(item => [item, item === 'trauma_kit' ? 5 : 1]));
  if (vehicle) inventory.armored_rescue_vehicle = 1;
  const state = makeState({ inventory }); state.saveVersion = 5; state.contentVersion = 5; initializePersonnel(state);
  const certs = Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : []);
  for (const officer of Object.values(state.officers)) officer.certs = [...new Set(certs)];
  const spec = s.incident!;
  state.incidents = [{ id: s.id, type: spec.type, familyId: spec.familyId, tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const started = apply(state, { ...startCmd(s.id, ['A'], { positions: { A: buildLocation(spec.familyId, spec.buildingSeed).location.entries[0] }, loadouts: { A: Object.fromEntries(gear.map(item => [item, item === 'trauma_kit' ? 3 : 1])) } }), ...(vehicle ? { supportUnitIds: [unitId('armored_rescue_vehicle')] } : {}) });
  expect(started.result).toEqual({ ok: true }); return started.state;
}
function evaluate(state: GameState, name: string) {
  const run = state.activeRun!; const scenario = getScenario(run.scenarioId)!;
  const action = scenarioActions(scenario).find(a => a.id === name)!; expect(action, name).toBeDefined();
  return evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function decide(state: GameState, name: string, band: OutcomeBand | null = 'favorable'): GameState {
  const ev = evaluate(state, name); expect(ev.eligible, `${name}: ${ev.reason}`).toBe(true);
  const input = structuredClone(state);
  if (band) for (let seed = 1; seed < 100_000; seed++) if (bandFor(ev.margin, next(seed).value) === band) { input.activeRun!.rngState = seed; break; }
  const result = apply(input, { type: 'decide', actionId: name, actingSquadIds: ['A'], supportSquadIds: [] }); expect(result.result, name).toEqual({ ok: true });
  if (band) expect(result.state.activeRun!.history.at(-1)!.band).toBe(band); return result.state;
}
function play(state: GameState, family: Family, names: string[], band: OutcomeBand | null = 'favorable'): GameState { for (const name of names) state = decide(state, id(family, name), band); return state; }
function refused(state: GameState, name: string) {
  const result = apply(state, { type: 'decide', actionId: name, actingSquadIds: ['A'], supportSquadIds: [] }); expect(result.result.ok, name).toBe(false); expect(result.state).toBe(state);
}
function care(state: GameState, family: Family, who: 'officer' | 'civilian'): GameState {
  const p = id(family, who === 'officer' ? 'resolve_officer' : 'civilian'); state = decide(state, `${p}_request`);
  if (evaluate(state, `${p}_wait`).eligible) state = decide(state, `${p}_wait`);
  if (who === 'civilian') state = decide(state, id(family, 'civilian_agreement'));
  return decide(state, `${p}_${who === 'officer' ? 'evacuate' : 'transfer'}`);
}
const notes = (state: GameState) => state.activeRun!.history.flatMap(h => h.committed?.consequences ?? []).join(' ');

describe('After the Noise v5', () => {
  it('owns new actions, preserves v4, and uses only the Market Row shop', () => {
    for (const seed of [0, 7, 42]) {
      const spec: IncidentSpec = { type: 'active_armed_incident', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 4 };
      const old = generateIncident(spec); const snapshot = structuredClone(old); const built = buildLocation('market_row', 7);
      const s = withArmedStory(old, built); expect(old).toEqual(snapshot); expect(withArmedStory(old, built)).toEqual(s); expect(validateScenario(s, built)).toEqual([]);
      for (const a of scenarioActions(s)) { expect(a.id.startsWith('v5_noise_')).toBe(true); expect(a.requires.notFlags).toContainEqual({ flag: `used:${a.id}`, reason: 'This decision has already been attempted' }); }
      expect(() => withArmedStory(old, buildLocation('harbour_court', 7))).toThrow(/Market Row/);
    }
  });
  it('keeps later conduct and needs out of previews and uses a six-decision no-gear completion', () => {
    const s = find('noise', { pause: true, stand_down: true, care_needed: false }); let state = running(s);
    const before = { actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) }; const original = structuredClone(s.facts);
    try { for (const fact of s.facts) fact.truth = !fact.truth; expect({ actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) }).toEqual(before); } finally { s.facts = original; }
    expect(JSON.stringify([s.summary, s.briefing, before])).not.toContain('dizziness');
    for (const action of ['hear_eli', 'agreed_pause', 'check_stand_down', 'reach_eli', 'bring_eli_out', 'civilian_next_step']) {
      expect(actionViews(state, NOW, 'A').length).toBeLessThanOrEqual(5); state = decide(state, id('noise', action)); refused(state, id('noise', action));
      if (action === 'agreed_pause') { expect(state.activeRun!.flags).not.toContain(id('noise', 'eli_safe')); expect(notes(state)).toContain('Eli does not come out'); }
      if (action === 'reach_eli') expect(currentStoryPrompt(s, state.activeRun!)).toContain('stopped counting');
    }
    expect(state.activeRun!.history).toHaveLength(6); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true); expect(notes(state)).toContain('keeps talking all the way');
    expect(civilianOutcomeViews(s, state.activeRun!)).toMatchObject([{ label: 'Eli Tran', status: 'safe' }]);
  });
  it('separates silence from stand-down and permits one delayed or failed clarification', () => {
    const s = find('noise', { pause: true, stand_down: false }); const before = play(running(s), 'noise', ['check_patrol', 'agreed_pause', 'check_stand_down']);
    refused(before, id('noise', 'reach_eli')); expect(notes(before)).toContain('still holding the weapon');
    let recovered = decide(before, id('noise', 'clarify_stand_down'), 'mixed'); recovered = play(recovered, 'noise', ['reach_eli', 'bring_eli_out']); recovered = care(recovered, 'noise', 'civilian');
    expect(computeDebrief(recovered, recovered.activeRun!)!.completionAchieved).toBe(true);
    let failed = decide(before, id('noise', 'clarify_stand_down'), 'adverse'); refused(failed, id('noise', 'reach_eli')); refused(failed, id('noise', 'clarify_stand_down'));
    failed = decide(failed, id('noise', 'resolve_withdraw')); expect(computeDebrief(failed, failed.activeRun!)!.completionAchieved).toBe(false); expect(notes(failed)).toContain('Eli Tran remains inside');
  });
  it('requires real qualified equipment and handles a wounded officer before the separate Eli move', () => {
    const s = find('noise', { stand_down: true }); const prep = (gear: string[]) => play(running(s, gear), 'noise', ['check_patrol']);
    expect(evaluate(prep([]), id('noise', 'urgent_response')).eligible).toBe(false); let state = prep(['service_sidearm', 'trauma_kit']);
    for (const mutate of [
      (v: GameState) => { v.units[unitId('service_sidearm')].condition = 0; },
      (v: GameState) => { v.reservations = v.reservations.filter(r => r.itemId !== 'service_sidearm'); },
      (v: GameState) => { for (const o of Object.values(v.officers)) o.certs = o.certs.filter(c => c !== 'entry_team'); },
    ]) { const v = structuredClone(state); mutate(v); expect(evaluate(v, id('noise', 'urgent_response')).eligible).toBe(false); }
    state = decide(state, id('noise', 'urgent_response'), 'mixed'); const casualty = Object.values(state.activeRun!.officerCasualties!)[0]; expect(casualty.care).toBe('needed'); refused(state, id('noise', 'check_stand_down'));
    state = decide(state, id('noise', 'resolve_officer_aid')); expect(state.activeRun!.history.at(-1)!.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 }); state = care(state, 'noise', 'officer');
    state = play(state, 'noise', ['check_stand_down', 'reach_eli', 'bring_eli_out']); expect(state.activeRun!.history.at(-1)!.officerIds).not.toContain(casualty.officerId);
    state = s.facts.find(f => f.id === id('noise', 'f_care_needed'))!.truth ? care(state, 'noise', 'civilian') : decide(state, id('noise', 'civilian_next_step'));
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true); expect(notes(state)).toContain('accepted the injured officer');
  });
  it('recovers a failed urgent attempt through a different checked exchange without erasing Eli’s injury', () => {
    const s = find('noise', { pause: true, stand_down: true }); let state = play(running(s, ['service_sidearm']), 'noise', ['check_patrol']);
    state = decide(state, id('noise', 'urgent_response'), 'adverse'); expect(civilianOutcomeViews(s, state.activeRun!)[0].status).toBe('injured_needs_care');
    refused(state, id('noise', 'urgent_response')); state = decide(state, id('noise', 'resolve_officer_continue')); state = play(state, 'noise', ['return_to_pause', 'check_stand_down', 'reach_eli', 'bring_eli_out']);
    expect(currentStoryPrompt(s, state.activeRun!)).toContain('officer is hurt'); refused(state, id('noise', 'civilian_next_step'));
    state = care(state, 'noise', 'officer'); state = care(state, 'noise', 'civilian'); expect(civilianOutcomeViews(s, state.activeRun!)[0].status).toBe('care_accepted'); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });
  it('keeps no-resource and blocked-door partials honest, without invented alternatives', () => {
    const unavailable = find('noise', { pause: false }); let state = play(running(unavailable), 'noise', ['check_patrol']); refused(state, id('noise', 'agreed_pause')); refused(state, id('noise', 'urgent_response')); state = decide(state, id('noise', 'adapt_withdraw')); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(false);
    const s = find('noise', { pause: true, stand_down: true }); let blocked = play(running(s), 'noise', ['check_patrol', 'agreed_pause', 'check_stand_down']);
    const reach = scenarioActions(s).find(a => a.id === id('noise', 'reach_eli'))!; const route = s.story!.bindings.routes[reach.storyRoute!];
    const blockedOpenings = buildLocation(s.locationFamilyId, s.locationSeed).location.openings.filter(opening => opening.a === route.fromSpaceId || opening.b === route.fromSpaceId);
    blocked.activeRun!.flags.push(...blockedOpenings.map(opening => openingFlag(opening.id, 'blocked'))); refused(blocked, id('noise', 'reach_eli'));
    blocked = decide(blocked, id('noise', 'resolve_withdraw')); expect(blocked.activeRun!.flags).not.toContain(id('noise', 'eli_reached'));
  });
  it('reloads the same natural progress and freezes the committed turn', () => {
    const s = find('noise', { pause: true, stand_down: true }); let state = play(running(s), 'noise', ['hear_eli', 'agreed_pause', 'check_stand_down', 'reach_eli'], null);
    const committed = structuredClone(state.activeRun!.history); const saved = deserialize(serialize(state, NOW)); expect(saved).not.toBeNull(); expect(saved!.activeRun).toEqual(state.activeRun);
    const continued = decide(saved!, id('noise', 'bring_eli_out'), null); state = decide(state, id('noise', 'bring_eli_out'), null); expect(continued).toEqual(state); expect(continued.activeRun!.history.slice(0, 4)).toEqual(committed);
  });
});

describe('My Chair Comes Too v5', () => {
  it('authors only compatible ground-floor homes without changing old scenarios or geometry', () => {
    for (const familyId of ['juniper_court_v1', 'willow_terrace_v1', 'harbour_court']) for (const seed of [0, 7, 42]) {
      const built = buildLocation(familyId, seed); const snapshot = structuredClone(built);
      const spec: IncidentSpec = { type: 'protected_rescue', familyId, buildingSeed: seed, seed, tier: 2, contentVersion: 4 };
      const old = generateIncident(spec); const oldSnapshot = structuredClone(old); const s = withRescueStory(old, built);
      expect(withRescueStory(old, built)).toEqual(s); expect(old).toEqual(oldSnapshot); expect(built).toEqual(snapshot); expect(validateScenario(s, built)).toEqual([]);
      expect(s.facts.find(f => f.id === id('chair', 'f_jun'))!.spaceId).toBe('living');
      expect(s.facts.find(f => f.id === id('chair', 'f_chair_route'))!.truth).toBe(true);
      for (const a of scenarioActions(s)) { expect(a.id.startsWith('v5_chair_')).toBe(true); expect(a.requires.notFlags).toContainEqual({ flag: `used:${a.id}`, reason: 'This decision has already been attempted' }); }
    }
  });
  it('corrects the caller and completes a low-resource chair-preserving route with a chosen destination', () => {
    const s = find('chair', { care_needed: false }); let state = running(s);
    const before = { actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) }; const original = structuredClone(s.facts);
    try { for (const fact of s.facts) fact.truth = !fact.truth; expect({ actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) }).toEqual(before); } finally { s.facts = original; }
    for (const action of ['hear_jun', 'reach_jun', 'check_chair_route', 'prepare_assistance', 'reach_pickup_assistance', 'assisted_move', 'civilian_next_step']) {
      const menu = actionViews(state, NOW, 'A'); expect(menu.length, menu.map(a => a.id).join(', ')).toBeLessThanOrEqual(5);
      state = decide(state, id('chair', action)); refused(state, id('chair', action));
      if (action === 'hear_jun') { expect(notes(state)).toContain('I said I can’t leave it'); expect(state.activeRun!.flags).not.toContain(id('chair', 'jun_reached')); }
      if (action === 'reach_jun') { expect(state.activeRun!.flags).not.toContain(id('chair', 'at_pickup')); expect(notes(state)).toContain('Have you checked this can go with me'); }
      if (action === 'reach_pickup_assistance') expect(state.activeRun!.flags).not.toContain(id('chair', 'jun_safe'));
    }
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true); expect(state.activeRun!.history.flatMap(h => h.unitsUsed)).toEqual([]);
    expect(civilianOutcomeViews(s, state.activeRun!)).toMatchObject([{ label: 'Jun Park', status: 'safe' }]);
    expect(notes(state)).toContain('wheelchair complete the protected move together'); expect(notes(state)).toContain('community room'); expect(notes(state)).toContain('No onward journey is recorded as completed');
  });
  it('offers the physical opening alternative and preserves exact unreached, reached and pickup partials', () => {
    const s = find('chair'); const states = [
      decide(running(s), id('chair', 'assess_withdraw')),
      play(running(s), 'chair', ['reach_and_hear', 'adapt_withdraw']),
      play(running(s), 'chair', ['reach_and_hear', 'check_chair_route', 'prepare_assistance', 'reach_pickup_assistance', 'resolve_withdraw']),
    ];
    expect(s.endings[states[0].activeRun!.endingId!].summary).toContain('has not been physically reached');
    expect(s.endings[states[1].activeRun!.endingId!].summary).toContain('have not reached exterior staging');
    expect(s.endings[states[2].activeRun!.endingId!].summary).toContain('final protected move remains unfinished');
    for (const state of states) { expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(false); expect(state.activeRun!.flags).not.toContain(id('chair', 'jun_safe')); }
  });
  it('requires actual assigned, reserved, serviceable and qualified vehicle support at both checks and movement', () => {
    const s = find('chair', { vehicle_fit: true, care_needed: false }); const prep = (vehicle: boolean) => play(running(s, [], vehicle), 'chair', ['reach_and_hear', 'check_chair_route']);
    expect(evaluate(prep(false), id('chair', 'check_reserved_vehicle')).eligible).toBe(false); const prepared = prep(true);
    const mutations = [
      (v: GameState) => { v.units[unitId('armored_rescue_vehicle')].condition = 0; },
      (v: GameState) => { v.reservations = v.reservations.filter(r => r.itemId !== 'armored_rescue_vehicle'); },
      (v: GameState) => { v.activeRun!.supportUnitIds = []; },
      (v: GameState) => { for (const o of Object.values(v.officers)) o.certs = o.certs.filter(c => c !== 'vehicle_operations'); },
    ];
    for (const mutate of mutations) { const v = structuredClone(prepared); mutate(v); expect(evaluate(v, id('chair', 'check_reserved_vehicle')).eligible).toBe(false); }
    let state = play(prepared, 'chair', ['check_reserved_vehicle', 'reach_pickup_vehicle']);
    for (const mutate of mutations) { const v = structuredClone(state); mutate(v); expect(evaluate(v, id('chair', 'vehicle_move')).eligible).toBe(false); }
    state = decide(state, id('chair', 'vehicle_move'), 'mixed'); expect(state.activeRun!.flags).toContain(id('chair', 'chair_safe'));
    expect(state.activeRun!.history.at(-1)!.unitsUsed).toContain(unitId('armored_rescue_vehicle')); expect(Object.values(state.activeRun!.officerCasualties ?? {})).toEqual([]);
    state = decide(state, id('chair', 'civilian_next_step')); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });
  it('does not turn an armored vehicle into chair access or an interior-route bypass', () => {
    const s = find('chair', { vehicle_fit: false }); let state = play(running(s, [], true), 'chair', ['reach_and_hear', 'check_chair_route', 'check_reserved_vehicle']);
    expect(state.activeRun!.knowledge[id('chair', 'f_vehicle_fit')]).toBe('disproved'); refused(state, id('chair', 'reach_pickup_vehicle')); refused(state, id('chair', 'vehicle_move'));
    state = play(state, 'chair', ['prepare_assistance', 'reach_pickup_assistance', 'assisted_move', 'civilian_next_step']); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    const built = buildLocation('juniper_court_v1', 7); const narrow = structuredClone(built);
    for (const o of narrow.location.openings.filter(o => o.a === 'living' || o.b === 'living')) { if (o.from.x === o.to.x) o.to.y = o.from.y + 2; else o.to.x = o.from.x + 2; }
    const old = generateIncident({ ...s.incident!, contentVersion: 4 }); const inaccessible = withRescueStory(old, narrow);
    expect(inaccessible.facts.find(f => f.id === id('chair', 'f_chair_route'))!.truth).toBe(false);
    for (const short of ['prepare_assistance', 'check_reserved_vehicle', 'reach_pickup_assistance', 'reach_pickup_vehicle', 'assisted_move', 'vehicle_move']) expect(scenarioActions(inaccessible).find(a => a.id === id('chair', short))!.requires.facts).toContainEqual(expect.objectContaining({ factId: id('chair', 'f_chair_route'), in: ['confirmed'] }));
    const blocked = play(running(find('chair'), [], true), 'chair', ['reach_and_hear', 'check_chair_route', 'check_reserved_vehicle']);
    const scenario = getScenario(blocked.activeRun!.scenarioId)!; const action = scenarioActions(scenario).find(a => a.id === id('chair', 'reach_pickup_vehicle'))!;
    const route = scenario.story!.bindings.routes[action.storyRoute!];
    const blockedOpenings = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.openings.filter(opening => opening.a === route.fromSpaceId || opening.b === route.fromSpaceId);
    blocked.activeRun!.flags.push(...blockedOpenings.map(opening => openingFlag(opening.id, 'blocked'))); refused(blocked, id('chair', 'reach_pickup_vehicle'));
  });
  it('recovers a failed vehicle loading attempt with a distinct slower arrangement', () => {
    const s = find('chair', { vehicle_fit: true, care_needed: false }); let state = play(running(s, [], true), 'chair', ['reach_and_hear', 'check_chair_route', 'check_reserved_vehicle', 'reach_pickup_vehicle']);
    state = decide(state, id('chair', 'vehicle_move'), 'adverse'); refused(state, id('chair', 'vehicle_move')); refused(state, id('chair', 'assisted_move')); expect(state.activeRun!.flags).not.toContain(id('chair', 'jun_safe')); expect(currentStoryPrompt(s, state.activeRun!)).toContain('failed its final check');
    state = play(state, 'chair', ['prepare_different_assistance', 'assisted_move', 'civilian_next_step']); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true); expect(notes(state)).toContain('broken vehicle-loading provision is no part');
  });
  it('names the actual injured officer, preserves Jun’s injury and retains staging on failed recovery', () => {
    const s = find('chair', { vehicle_fit: true }); let state = play(running(s, ['trauma_kit'], true), 'chair', ['reach_and_hear', 'check_chair_route', 'check_reserved_vehicle', 'reach_pickup_vehicle']);
    state = decide(state, id('chair', 'vehicle_move'), 'adverse'); state = decide(state, id('chair', 'prepare_different_assistance')); state = decide(state, id('chair', 'assisted_move'), 'adverse');
    const casualty = Object.values(state.activeRun!.officerCasualties!)[0]; const officer = state.officers[casualty.officerId]; expect(notes(state)).toContain(`${officer.firstName} ${officer.surname} was seriously wounded`);
    expect(civilianOutcomeViews(s, state.activeRun!)[0].status).toBe('injured_needs_care'); expect(state.activeRun!.flags).not.toContain(id('chair', 'jun_safe')); refused(state, id('chair', 'assisted_move')); refused(state, id('chair', 'civilian_transfer'));
    state = decide(state, id('chair', 'resolve_officer_aid')); state = care(state, 'chair', 'officer'); state = decide(state, id('chair', 'resolve_withdraw'));
    expect(s.endings[state.activeRun!.endingId!].summary).toContain('exterior staging'); expect(notes(state)).toContain('Jun’s recorded injury still needs accepted care'); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(false);
  });
  it('interrupts a successful mixed move for real officer care and separately accepts Jun’s medical care', () => {
    const s = find('chair', { care_needed: true }); let state = play(running(s, ['trauma_kit']), 'chair', ['hear_jun', 'reach_jun', 'check_chair_route', 'prepare_assistance', 'reach_pickup_assistance']);
    state = decide(state, id('chair', 'assisted_move'), 'mixed'); expect(state.activeRun!.flags).toContain(id('chair', 'jun_safe')); expect(currentStoryPrompt(s, state.activeRun!)).toContain('officer is hurt'); refused(state, id('chair', 'civilian_transfer'));
    state = care(state, 'chair', 'officer'); expect(currentStoryPrompt(s, state.activeRun!)).toContain('reached safety'); state = care(state, 'chair', 'civilian'); expect(civilianOutcomeViews(s, state.activeRun!)[0].status).toBe('care_accepted'); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    expect(s.endings[state.activeRun!.endingId!].summary).toContain('that journey has not happened');
  });
  it('serializes a natural vehicle setback and preserves the same distinct recovery after reload', () => {
    const s = find('chair', { vehicle_fit: true, care_needed: false }); let state: GameState | undefined;
    for (let seed = 1; seed < 500; seed++) {
      let candidate = running(s, [], true); candidate.activeRun!.rngState = seed;
      candidate = play(candidate, 'chair', ['reach_and_hear', 'check_chair_route', 'check_reserved_vehicle', 'reach_pickup_vehicle', 'vehicle_move'], null);
      if (candidate.activeRun!.flags.includes(id('chair', 'vehicle_setback'))) { state = candidate; break; }
    }
    expect(state).toBeDefined(); const restored = deserialize(serialize(state!, NOW)); expect(restored).not.toBeNull(); expect(restored!.activeRun).toEqual(state!.activeRun);
    expect(decide(restored!, id('chair', 'prepare_different_assistance'), null)).toEqual(decide(state!, id('chair', 'prepare_different_assistance'), null)); refused(restored!, id('chair', 'vehicle_move'));
  });
});
