import { afterEach, describe, expect, it, vi } from 'vitest';
import { COURSES } from '../../content/courses';
import { DEV_NODES } from '../../content/dev-tree';
import { ITEMS } from '../../content/items';
import { createInitialState } from '../../sim/department';
import { buildLocation } from '../../sim/location';
import { computeDebrief } from '../../sim/operation';
import { actionViews, briefing, spaceViews } from '../../sim/operation-selectors';
import { bandFor, builtFor, evaluateAction, openingFlag } from '../../sim/resolution';
import { forceSeverity } from '../../sim/force-risk';
import { responseFailurePlan } from '../../sim/response-failure';
import { storyPeoplePublic, storyPropsPublic } from '../../sim/story-people';
import { hashSeed, next } from '../../sim/rng';
import { deserialize, serialize } from '../../sim/save';
import { scenarioActions, type IncidentType, type ScenarioDefinition } from '../../sim/scenario-types';
import { apply, makeUnit, NOW, startCmd } from '../../sim/test-fixtures';
import type { ForceOutcome, GameState, OutcomeBand } from '../../sim/types';
import { generateIncident, INCIDENT_TYPES_V5 } from './index';

const overrides = vi.hoisted(() => new Map<string, ScenarioDefinition>());
vi.mock('../../sim/scenario-registry', async original => {
  const real = await original<typeof import('../../sim/scenario-registry')>();
  return { ...real, getScenario: (id: string) => overrides.get(id) ?? real.getScenario(id) };
});
afterEach(() => overrides.clear());

// Bounded integration coverage, not an exhaustive exploration of every generated
// layout and decision ordering. All journey state comes from real handlers.
const scenario = (type: IncidentType, seed = 0, familyId = type === 'protected_rescue' ? 'juniper_court_v1' : 'market_row', buildingSeed = 7) => generateIncident({ type, seed, familyId, buildingSeed, tier: 2, contentVersion: 7 });
const initial = createInitialState(NOW, 719);
const loadout = Object.fromEntries(Object.values(ITEMS).filter(item => !item.supportOnly && item.id !== 'radio_kit').map(item => [item.id, item.kind === 'consumable' ? 4 : 1]));

/** Full qualification/equipment is an explicit coverage fixture, not normal play. */
function start(s: ScenarioDefinition, rngState: number, equipped = true): GameState {
  const state = structuredClone(initial);
  state.rngState = rngState;
  if (equipped) {
    state.department.unlockedNodes = Object.keys(DEV_NODES);
    state.department.developmentTiers = Object.fromEntries(Object.keys(DEV_NODES).map(id => [id, 1]));
    for (const officer of Object.values(state.officers)) officer.certs = [...new Set([...officer.certs, ...Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : [])])];
    for (const item of Object.values(ITEMS)) for (let n = 1; n <= (item.kind === 'consumable' ? 8 : item.id === 'radio_kit' ? 8 : 2); n++) {
      const unit = makeUnit(item.id, 1000 + n); state.units[unit.id] = unit;
    }
  }
  state.incidents = [{ id: s.id, type: s.incident!.type, familyId: s.incident!.familyId, tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const result = apply(state, startCmd(s.id, ['A'], { positions: { A: buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0] }, loadouts: { A: equipped ? loadout : {} } }));
  expect(result.result, s.id).toEqual({ ok: true });
  return result.state;
}

function evaluate(state: GameState, s: ScenarioDefinition, id: string) {
  const run = state.activeRun!, action = scenarioActions(s).find(action => action.id === id)!;
  expect(action, id).toBeDefined();
  return evaluateAction({ state, run, scenario: s, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}

function choose(state: GameState, s: ScenarioDefinition, id: string, reload = true): GameState {
  const evaluation = evaluate(state, s, id);
  expect(evaluation.eligible, `${s.id} ${id}: ${evaluation.reason}`).toBe(true);
  const result = apply(state, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result, id).toEqual({ ok: true });
  if (!reload) return result.state;
  const restored = deserialize(serialize(result.state, NOW));
  expect(restored, `${s.id}: reload after ${id}`).not.toBeNull();
  expect(restored!.activeRun).toEqual(result.state.activeRun);
  return restored!;
}

type ForcePath = { label: string; s: ScenarioDefinition; before: string[]; actionId: string; personId: string; profile: ForceOutcome['profile'] };
const paths: ForcePath[] = [
  { label: 'armed firearm', s: scenario('active_armed_incident'), before: ['v5_noise_hear_eli'], actionId: 'v5_noise_urgent_response', personId: 'grant', profile: 'firearm' },
  { label: 'hostage firearm', s: scenario('hostage_crisis', 13), before: ['v5_sig_hear_ben', 'v5_sig_release_ben', 'v5_sig_lost_line_update'], actionId: 'v5_sig_urgent_protection', personId: 'lewis', profile: 'firearm' },
  ...(['less_lethal_device', 'less_lethal_impact'] as const).map(profile => ({ label: profile, s: scenario('active_armed_incident'), before: ['v5_noise_hear_eli', 'v5_noise_agreed_pause', 'v5_noise_check_stand_down'], actionId: `v7_${profile}`, personId: 'grant', profile })),
];
const bands: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const harms: ForceOutcome['severity'][] = ['none', 'wounded', 'serious', 'fatal'];

function prepare(path: ForcePath, seed: number, reload = false) {
  let state = start(path.s, seed);
  for (const id of path.before) state = choose(state, path.s, id, reload);
  return state;
}

/** Sample only the initial campaign RNG, then replay all actual actions unchanged.
 * Cheap PRNG screening is not a fabricated saved sample or a patched active run. */
function forceFixture(path: ForcePath, band: OutcomeBand, harm: ForceOutcome['severity']) {
  const reference = prepare(path, 1);
  const margin = evaluate(reference, path.s, path.actionId).margin;
  for (let seed = 0; seed < 250_000; seed++) {
    const campaign = next(seed);
    let rng = (hashSeed(`${path.s.id}:${path.s.locationSeed}`) ^ Math.floor(campaign.value * 4294967296)) >>> 0;
    for (let i = 0; i < path.before.length; i++) rng = next(rng).state;
    const effort = next(rng), risk = next(effort.state);
    if (forceSeverity(path.profile, risk.value) !== harm || bandFor(margin, effort.value) !== band) continue;
    let state = prepare(path, seed, true);
    if (bandFor(evaluate(state, path.s, path.actionId).margin, effort.value) !== band) continue;
    state = choose(state, path.s, path.actionId);
    expect(state.activeRun!.history.at(-1)!.band).toBe(band);
    expect(state.activeRun!.history.at(-1)!.committed?.forceOutcome?.severity).toBe(harm);
    return { state, seed };
  }
  throw new Error(`No natural RNG fixture found for ${path.label}/${band}/${harm}`);
}

function failResponse(state: GameState): GameState {
  const plan = responseFailurePlan(state);
  expect(plan, 'an exhausted issued response has an honest failure path').not.toBeNull();
  const ended = apply(state, { type: 'endFailedResponse', runId: plan!.runId, revision: plan!.revision });
  expect(ended.result).toEqual({ ok: true });
  const restored = deserialize(serialize(ended.state, NOW));
  expect(restored?.activeRun).toEqual(ended.state.activeRun);
  return restored!;
}

function finishPartial(state: GameState, s: ScenarioDefinition) {
  // Explicit compatibility coverage for already-issued v7 records; the current UI hides these cards.
  const partial = scenarioActions(s).find(a => a.stage === state.activeRun!.stage && /withdraw|partial/.test(a.id) && evaluate(state, s, a.id).eligible);
  expect(partial, `${s.id}: frozen v7 exit remains replayable`).toBeDefined();
  state = choose(state, s, partial!.id);
  expect(state.activeRun!.status).toBe('debrief');
  const report = computeDebrief(state, state.activeRun!)!;
  expect(report.completionAchieved).toBe(false);
  const closed = apply(state, { type: 'closeDebrief' });
  expect(closed.result).toEqual({ ok: true });
  expect(deserialize(serialize(closed.state, NOW))?.debriefs).toEqual(closed.state.debriefs);
  return report;
}

describe('generated v7 scene journeys', () => {
  for (const path of paths) for (const band of bands) for (const harm of harms) {
    it(`${path.label}: natural ${band} task with ${harm} harm survives reload and an honest partial`, () => {
      const { state } = forceFixture(path, band, harm);
      const run = state.activeRun!, force = run.history.at(-1)!.committed!.forceOutcome!;
      expect(force.profile).toBe(path.profile);
      expect(force.personId).toBe(path.personId);
      expect(run.history.at(-1)!.unitsUsed).toContain(force.unitId);
      expect(run.status).toBe('active');
      expect(evaluate(state, path.s, path.actionId).eligible).toBe(false);
      if (harm === 'none') {
        expect(run.personCasualties?.[path.personId]).toBeUndefined();
        expect(evaluate(state, path.s, `v7_check_${path.personId}`).eligible).toBe(false);
      } else {
        expect(run.personCasualties?.[path.personId]).toMatchObject({ severity: harm, care: harm === 'fatal' ? 'deceased' : 'needed' });
        for (const action of scenarioActions(path.s).filter(action => action.storyTargetPersonId === path.personId && (action.check.kind === 'contact' || action.personCare && harm === 'fatal'))) {
          expect(evaluate(state, path.s, action.id).eligible, `${action.id}: the recorded casualty cannot use the healthy-person script`).toBe(false);
        }
      }
      const report = finishPartial(state, path.s);
      if (harm !== 'none') {
        expect(report.personCasualties).toContainEqual(expect.objectContaining({ personId: path.personId, severity: harm }));
        expect(report.civilianSafety.label).toBe(harm === 'fatal' ? 'Fatality recorded' : 'Injuries recorded');
        expect(JSON.stringify(report)).toContain(force.personLabel);
      }
      if (path.profile === 'firearm' && band !== 'favorable') expect(report.officerCasualties!.length).toBeGreaterThan(0);
    }, 15000);
  }

  for (const path of paths) for (const band of bands) for (const harm of ['wounded', 'serious', 'fatal'] as const) {
    it(`${path.label}: ${band}/${harm} continues through actual access, care and surviving civilians`, () => {
      let { state } = forceFixture(path, band, harm);
      const built = buildLocation(path.s.locationFamilyId, path.s.locationSeed);
      const originalPerson = storyPeoplePublic(path.s, built, state.activeRun!).find(p => p.id === path.personId)!;
      const prefix = path.personId === 'grant' ? 'v5_noise' : 'v5_sig';
      const accessExpected = harm !== 'wounded' || band !== 'adverse' && (path.profile !== 'firearm' || path.personId === 'lewis');
      let checked = false;
      for (let step = 0; step < 40 && state.activeRun!.status === 'active'; step++) {
        const options = actionViews(state, NOW, 'A').filter(a => a.eligible);
        if (!options.length) { state = failResponse(state); break; }
        const chosen = options.find(a => /officer_(aid|request|wait|evacuate)/.test(a.id))
          ?? options.find(a => a.id === `v7_check_${path.personId}`)
          ?? options.find(a => a.id === `v7_request_${path.personId}`)
          ?? options.find(a => a.id === `v7_aid_${path.personId}`)
          ?? options.find(a => a.id === `v7_wait_${path.personId}`)
          ?? options.find(a => a.id === `v7_receive_${path.personId}`)
          ?? options.find(a => !/withdraw|partial/.test(a.id)) ?? options[0];
        expect(chosen, `${path.label} ${band}/${harm}: a current choice`).toBeDefined();
        const before = structuredClone(state.activeRun!);
        state = choose(state, path.s, chosen!.id);
        const run = state.activeRun!, last = run.history.at(-1)!;
        const casualty = run.personCasualties![path.personId];
        expect(casualty.severity).toBe(harm);
        if (chosen!.id === `v7_check_${path.personId}`) {
          checked = true;
          expect(run.flags.includes(`v7_access_${path.personId}`), `${path.label} ${band}/${harm}: access must reflect current danger`).toBe(accessExpected);
          if (band === 'adverse' && harm === 'wounded') expect(run.flags).not.toContain(path.personId === 'grant' ? 'v5_noise_danger_ended' : 'sig_threat_stopped');
        }
        if (chosen!.id === `v7_aid_${path.personId}`) {
          expect(last.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
          expect(casualty.care).toBe(last.band === 'adverse' ? 'needed' : 'stabilized');
        }
        if (chosen!.id === `v7_receive_${path.personId}`) {
          expect(casualty.care).toBe('accepted');
          expect(run.externalSupport![`v7_medical_${path.personId}`].acceptedAt).not.toBeNull();
        }
        if (harm === 'fatal') {
          expect(casualty.care).toBe('deceased');
          expect(storyPeoplePublic(path.s, built, run).find(p => p.id === path.personId)!.position).toEqual(originalPerson.position);
          const name = originalPerson.label.split(' ')[0];
          expect((last.committed?.consequences ?? []).join(' ')).not.toMatch(new RegExp(`${name} (?:says|answers|agrees|puts|moves|asks|keeps holding|still holds)`, 'i'));
        }
        for (const [id, officer] of Object.entries(before.officerCasualties ?? {})) {
          expect(run.officerCasualties![id].severity).toBe(officer.severity);
          expect(state.officers[id].injury).not.toBeNull();
          expect(last.officerIds, `${id} must stay out of action after injury`).not.toContain(id);
        }
        if (chosen!.id === `${prefix}_civilian_transfer`) {
          expect((last.committed?.consequences ?? []).join(' ')).not.toMatch(/recorded injury still needs accepted care/i);
        }
      }
      expect(checked).toBe(true);
      expect(state.activeRun!.status).toBe('debrief');
      const report = computeDebrief(state, state.activeRun!)!;
      expect(report.completionAchieved, `${path.label} ${band}/${harm}: full completion needs accepted care and no fatality`).toBe(accessExpected && harm !== 'fatal');
      expect(report.civilianOutcomes).toHaveLength(path.s.civilianOutcomes!.length);
      if (path.personId === 'lewis') expect(report.civilianOutcomes).toContainEqual(expect.objectContaining({ id: 'ben', status: 'safe' }));
      if (accessExpected) for (const person of report.civilianOutcomes!) expect(['safe', 'care_accepted']).toContain(person.status);
      if (accessExpected && harm !== 'fatal') expect(report.personCasualties).toContainEqual(expect.objectContaining({ personId: path.personId, severity: harm, care: 'accepted' }));
      if (path.profile === 'firearm' && band !== 'favorable') expect(report.officerCasualties).toEqual(expect.arrayContaining([expect.objectContaining({ care: 'evacuated' })]));
      const closed = apply(state, { type: 'closeDebrief' });
      expect(closed.result).toEqual({ ok: true });
      expect(deserialize(serialize(closed.state, NOW))?.debriefs).toEqual(closed.state.debriefs);
    }, 15000);
  }

  it('a deceased hostage subject cannot answer a reopened patrol relay', () => {
    const path = paths[1];
    const fixture = forceFixture(path, 'favorable', 'fatal');
    const state = choose(fixture.state, path.s, 'v7_check_lewis');
    const relay = evaluate(state, path.s, 'v5_sig_relay_contact_later');
    expect(relay.eligible, 'The deceased subject cannot answer through patrol').toBe(false);
    const phone = choose(state, path.s, 'v5_sig_independent_phone_later');
    expect(evaluate(phone, path.s, 'v5_sig_hear_mara_later').eligible, 'This earlier account script also contains the deceased subject answering').toBe(false);
  });

  it.each(bands)('armed firearm %s without injury retains the living-subject stand-down process', band => {
    const path = paths[0];
    let { state } = forceFixture(path, band, 'none');
    for (let step = 0; state.activeRun!.flags.includes('v5_noise_injury_pause') && step < 5; step++) {
      const care = actionViews(state, NOW, 'A').find(a => a.eligible && /officer_(aid|request|wait|evacuate)/.test(a.id));
      expect(care).toBeDefined();
      state = choose(state, path.s, care!.id);
    }
    expect(evaluate(state, path.s, 'v7_check_grant').eligible).toBe(false);
    if (band === 'adverse') {
      expect(state.activeRun!.flags).not.toContain('v5_noise_danger_ended');
      state = choose(state, path.s, 'v5_noise_return_to_pause');
    }
    state = choose(state, path.s, 'v5_noise_check_stand_down');
    expect(state.activeRun!.knowledge.v5_noise_f_stand_down).toBe('disproved');
    expect(state.activeRun!.flags).not.toContain('v5_noise_danger_ended');
    expect(evaluate(state, path.s, 'v5_noise_reach_eli').eligible).toBe(false);
    expect(evaluate(state, path.s, 'v5_noise_clarify_stand_down').eligible).toBe(true);
    finishPartial(state, path.s);
  });

  it.each(INCIDENT_TYPES_V5)('$type public previews do not change when hidden truths change', info => {
    const s = scenario(info.type, 0, info.families[0]);
    const state = start(s, 1, false);
    const visible = () => ({ choices: actionViews(state, NOW, 'A'), spaces: spaceViews(state), briefing: briefing(s.id, state, ['A']) });
    const before = visible();
    const changed = structuredClone(s);
    for (const fact of changed.facts) if (state.activeRun!.knowledge[fact.id] === 'unknown' && !fact.showWhenUnknown) fact.truth = !fact.truth;
    overrides.set(s.id, changed);
    expect(visible()).toEqual(before);
  });

  it.each(paths)('$label selected-force previews use the checked public context', path => {
    const state = prepare(path, 1, true);
    const before = actionViews(state, NOW, 'A');
    expect(before.find(a => a.id === path.actionId)?.eligible).toBe(true);
    const changed = structuredClone(path.s);
    for (const fact of changed.facts) if (state.activeRun!.knowledge[fact.id] === 'unknown' && !fact.showWhenUnknown) fact.truth = !fact.truth;
    overrides.set(path.s.id, changed);
    expect(actionViews(state, NOW, 'A')).toEqual(before);
  });

  it('the independent hostage phone permits the first actual account check', () => {
    const s = scenario('hostage_crisis', 0);
    const state = choose(start(s, 1, false), s, 'v5_sig_hear_ben');
    expect(state.activeRun!.flags).toContain('sig_accounted');
    expect(storyPropsPublic(s, buildLocation(s.locationFamilyId, s.locationSeed), state.activeRun!).some(p => p.id === 'maras_phone')).toBe(true);
  });

  it.each(INCIDENT_TYPES_V5)('$type offers finite starter-resource journeys with every save and debrief preserved', info => {
    for (let seed = 0; seed < 4; seed++) {
      const s = scenario(info.type, seed, info.families[seed % info.families.length]);
      let state = start(s, seed + 91, false);
      for (let step = 0; step < 45 && state.activeRun!.status === 'active'; step++) {
        const options = actionViews(state, NOW, 'A').filter(a => a.eligible);
        if (!options.length) { state = failResponse(state); break; }
        expect(options.length, `${s.id}: no current choice`).toBeGreaterThan(0);
        const onward = options.filter(a => !/withdraw|partial/.test(a.id));
        const choices = onward.length ? onward : options;
        state = choose(state, s, choices[(seed + step) % choices.length].id);
      }
      expect(state.activeRun!.status, s.id).toBe('debrief');
      const report = computeDebrief(state, state.activeRun!)!;
      if (report.completionAchieved) expect(['resolved', 'care_accepted', 'followup_agreed']).toContain(report.disposition);
      const closed = apply(state, { type: 'closeDebrief' });
      expect(closed.result).toEqual({ ok: true });
      expect(deserialize(serialize(closed.state, NOW))?.debriefs).toEqual(closed.state.debriefs);
    }
  }, 15000);

  it('a furnished chair rescue keeps the person and wheelchair together through each saved move', () => {
    const s = scenario('protected_rescue', 0);
    let state = start(s, 1, false);
    for (const id of ['v5_chair_reach_and_hear', 'v5_chair_check_chair_route', 'v5_chair_prepare_assistance', 'v5_chair_reach_pickup_assistance', 'v5_chair_assisted_move']) {
      state = choose(state, s, id);
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      const jun = storyPeoplePublic(s, built, state.activeRun!).find(p => p.id === 'jun')!;
      const chair = storyPropsPublic(s, built, state.activeRun!).find(p => p.id === 'wheelchair');
      expect(chair?.position, id).toEqual(jun.position);
    }
    expect(state.activeRun!.flags).toContain('v5_chair_jun_safe');
    state = choose(state, s, 'v5_chair_civilian_next_step');
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it.each(['juniper_court_v1', 'willow_terrace_v1', 'harbour_court'])('%s preserves both actual chair destination choices through reload', familyId => {
    let s: ScenarioDefinition | undefined;
    for (let seed = 0; seed < 30; seed++) {
      const candidate = scenario('protected_rescue', seed, familyId);
      if (scenarioActions(candidate).some(a => a.id === 'v5_chair_check_quiet_chair_route')) { s = candidate; break; }
    }
    expect(s, `${familyId}: bounded destination-variant sample`).toBeDefined();
    for (const destination of ['quiet', 'public'] as const) {
      let state = start(s!, 1, false);
      for (const id of ['v5_chair_reach_and_hear', `v5_chair_check_${destination}_chair_route`, 'v5_chair_prepare_assistance', `v5_chair_reach_${destination}_assistance`]) {
        const built = buildLocation(s!.locationFamilyId, s!.locationSeed);
        const before = storyPeoplePublic(s!, built, state.activeRun!).find(p => p.id === 'jun')!;
        if (id.includes('check_')) {
          const action = scenarioActions(s!).find(a => a.id === id)!;
          const target = s!.story!.bindings.routes[action.storyRoute!].toSpaceId;
          const blocked = structuredClone(state);
          blocked.activeRun!.flags.push(...built.location.openings.filter(o => o.a === target || o.b === target).map(o => openingFlag(o.id, 'blocked')));
          expect(evaluate(blocked, s!, id).eligible, 'Route assessment must still reject blocked physical access').toBe(false);
        }
        state = choose(state, s!, id);
        const person = storyPeoplePublic(s!, built, state.activeRun!).find(p => p.id === 'jun')!;
        expect(storyPropsPublic(s!, built, state.activeRun!).find(p => p.id === 'wheelchair')?.position).toEqual(person.position);
        if (id.includes('check_')) expect(person.position, 'Assessing a route must not commit the move').toEqual(before.position);
      }
      const move = scenarioActions(s!).find(a => a.id === `v5_chair_reach_${destination}_assistance`)!;
      const person = storyPeoplePublic(s!, buildLocation(s!.locationFamilyId, s!.locationSeed), state.activeRun!).find(p => p.id === 'jun')!;
      expect(person.position && !('kind' in person.position) && person.position.spaceId).toBe(move.targetId);
      expect(evaluate(state, s!, `v5_chair_reach_${destination === 'quiet' ? 'public' : 'quiet'}_assistance`).eligible).toBe(false);
      finishPartial(state, s!);
    }
  });
});
