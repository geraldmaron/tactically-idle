import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COURSES } from '../../../content/courses';
import { buildLocation } from '../../../sim/location';
import { computeDebrief, validateScenario } from '../../../sim/operation';
import { actionViews, spaceViews } from '../../../sim/operation-selectors';
import { initializePersonnel } from '../../../sim/personnel';
import { bandFor, builtFor, evaluateAction, openingFlag } from '../../../sim/resolution';
import { next } from '../../../sim/rng';
import * as registry from '../../../sim/scenario-registry';
import { scenarioActions, type ScenarioDefinition } from '../../../sim/scenario-types';
import { storyPeoplePublic, storyPropsPublic } from '../../../sim/story-people';
import { apply, makeState, NOW, startCmd } from '../../../sim/test-fixtures';
import type { GameState, OutcomeBand } from '../../../sim/types';
import { generateIncident, INCIDENT_TYPES_V5 } from '../index';
import { applyCarePrivacyVariation } from './care-privacy-variants';

type Family = 'medical_complication' | 'barricaded';
const scenarios = new Map<string, ScenarioDefinition>();
beforeEach(() => {
  const original = registry.getScenario;
  vi.spyOn(registry, 'getScenario').mockImplementation(id => scenarios.get(id) ?? original(id));
});
afterEach(() => { vi.restoreAllMocks(); scenarios.clear(); });
const prefix = (s: ScenarioDefinition) => s.incident!.type === 'medical_complication' ? 'v5_assistance_' : 'v5_protective_';
const full = (s: ScenarioDefinition, name: string) => prefix(s) + name;
function fixture(type: Family, variant: number, seed = 0): ScenarioDefinition {
  const familyId = type === 'medical_complication' ? 'market_row' : 'cedar_close';
  const original = generateIncident({ type, familyId, buildingSeed: 7, seed, tier: 2, contentVersion: 5 });
  const snapshot = structuredClone(original);
  const s = structuredClone(original);
  applyCarePrivacyVariation(s, buildLocation(familyId, 7), variant);
  s.version = 6;
  expect(original).toEqual(snapshot);
  expect(validateScenario(s, buildLocation(familyId, 7))).toEqual([]);
  scenarios.set(s.id, s);
  return s;
}
function running(s: ScenarioDefinition, gear: string[] = []): GameState {
  const state = makeState({ inventory: Object.fromEntries(gear.map(item => [item, 4])) });
  state.saveVersion = 5; state.contentVersion = 5; initializePersonnel(state);
  const certs = Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : []);
  for (const officer of Object.values(state.officers)) officer.certs = [...new Set(certs)];
  state.incidents = [{ id: s.id, type: s.incident!.type, familyId: s.locationFamilyId, tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const started = apply(state, startCmd(s.id, ['A'], { positions: { A: buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0] }, loadouts: { A: Object.fromEntries(gear.map(item => [item, 2])) } }));
  expect(started.result).toEqual({ ok: true });
  return started.state;
}
const scenario = (state: GameState) => scenarios.get(state.activeRun!.scenarioId)!;
const notes = (state: GameState) => state.activeRun!.history.flatMap(h => h.committed?.consequences ?? []).join(' ');
function evaluate(state: GameState, name: string) {
  const run = state.activeRun!, s = scenario(state);
  const a = scenarioActions(s).find(candidate => candidate.id === full(s, name));
  expect(a, name).toBeDefined();
  return evaluateAction({ state, run, scenario: s, action: a!, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function decide(state: GameState, name: string, band: OutcomeBand = 'favorable'): GameState {
  const ev = evaluate(state, name);
  expect(ev.eligible, `${name}: ${ev.reason}`).toBe(true);
  const input = structuredClone(state);
  for (let seed = 1; seed < 100_000; seed++) if (bandFor(ev.margin, next(seed).value) === band) { input.activeRun!.rngState = seed; break; }
  const result = apply(input, { type: 'decide', actionId: full(scenario(state), name), actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  expect(result.state.activeRun!.history.at(-1)!.band).toBe(band);
  return result.state;
}
function play(state: GameState, names: string[]): GameState { for (const name of names) state = decide(state, name); return state; }
function received(state: GameState, outside: boolean): GameState {
  const wait = outside ? 'wait_outside_crew' : 'wait_inside_crew';
  if (evaluate(state, wait).eligible) state = decide(state, wait);
  return decide(state, outside ? 'receive_outside' : 'receive_here');
}
function blockScene(state: GameState): void {
  const s = scenario(state), scene = s.story!.bindings.rooms.scene.spaceId;
  const openings = buildLocation(s.locationFamilyId, s.locationSeed).location.openings.filter(o => o.a === scene || o.b === scene);
  state.activeRun!.flags.push(...openings.map(o => openingFlag(o.id, 'blocked')));
}
function noCare(s: ScenarioDefinition): void { s.facts.find(f => f.id === full(s, 'care_needed'))!.truth = false; }
function needsCare(s: ScenarioDefinition): void { s.facts.find(f => f.id === full(s, 'care_needed'))!.truth = true; }

describe('V6 actual care commitments', () => {
  it('validates every supported medical/protective building with all three module choices', () => {
    for (const info of INCIDENT_TYPES_V5.filter(info => ['medical_complication', 'barricaded'].includes(info.type))) {
      for (const familyId of info.families) for (const variant of [0, 1, 2]) for (const buildingSeed of [3, 7]) {
        const spec = { type: info.type, familyId, buildingSeed, seed: 11, tier: 2, contentVersion: 5 };
        const built = buildLocation(familyId, buildingSeed), s = generateIncident(spec);
        applyCarePrivacyVariation(s, built, variant); s.version = 6;
        expect(validateScenario(s, built), `${familyId} variant ${variant}`).toEqual([]);
      }
    }
  });
  it.each([0, 1, 2])('variant %i offers ordinary early commitments and two accepted care places', variant => {
    const s = fixture('medical_complication', variant);
    expect(JSON.stringify(s)).not.toMatch(/supervisor|Daniel/);
    const start = running(s);
    for (const name of ['hear_rosa_assess', 'request_inside_early', 'request_outside_early']) expect(evaluate(start, name).eligible).toBe(true);
    const heard = decide(start, 'hear_rosa_assess');
    expect(evaluate(heard, 'offer_here').eligible).toBe(true);
    expect(evaluate(heard, 'lock_and_step_out').eligible).toBe(true);
    for (const outside of [false, true]) {
      let state = decide(heard, outside ? 'lock_and_step_out' : 'offer_here');
      expect(evaluate(state, outside ? 'receive_outside' : 'receive_here').eligible).toBe(false);
      expect(state.activeRun!.flags).not.toContain(full(s, 'rosa_care'));
      state = received(state, outside);
      const report = computeDebrief(state, state.activeRun!)!;
      expect(report.completionAchieved).toBe(true);
      expect(report.receivingService!.id).toBe(full(s, outside ? 'outside_crew' : 'rosa_crew'));
      const props = storyPropsPublic(s, buildLocation(s.locationFamilyId, s.locationSeed), state.activeRun!);
      expect(props.find(prop => prop.id === 'shop_keys')?.holderPersonId).toBe('rosa');
      if (outside) expect(storyPeoplePublic(s, buildLocation(s.locationFamilyId, s.locationSeed), state.activeRun!).find(person => person.id === 'rosa')!.position).toMatchObject({ spaceId: s.story!.bindings.exterior.arrival.spaceId });
    }
  });

  it('starts only the chosen early clock and cannot borrow arrival from the other crew', () => {
    const s = fixture('medical_complication', 0);
    let early = decide(running(s), 'request_outside_early');
    const requestedAt = early.activeRun!.externalSupport![full(s, 'outside_crew')].requestedAt;
    expect(early.activeRun!.externalSupport![full(s, 'rosa_crew')]).toBeUndefined();
    early = play(early, ['hear_rosa_adapt', 'offer_here']);
    expect(early.activeRun!.externalSupport![full(s, 'outside_crew')].requestedAt).toBe(requestedAt);
    expect(early.activeRun!.externalSupport![full(s, 'rosa_crew')].requestedAt).toBeGreaterThan(requestedAt);
    expect(evaluate(early, 'receive_here').eligible).toBe(false);
    const done = received(early, false);
    expect(done.activeRun!.externalSupport![full(s, 'outside_crew')].acceptedAt).toBeNull();
    expect(computeDebrief(done, done.activeRun!)!.completionAchieved).toBe(true);
  });

  it('follows an existing inside agreement without replaying consent, but still needs actual care', () => {
    const s = fixture('medical_complication', 2);
    let state = decide(running(s), 'request_inside_early');
    expect(state.activeRun!.stage).toBe('resolve');
    expect(state.activeRun!.flags).toContain(full(s, 'assessment_agreed'));
    expect(evaluate(state, 'receive_here').eligible).toBe(false);
    state = received(state, false);
    expect(state.activeRun!.history.map(h => h.actionId)).toEqual(['request_inside_early', 'wait_inside_crew', 'receive_here'].map(name => full(s, name)));
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('retains a real earlier request through Rosa’s adverse answer and clarification', () => {
    const s = fixture('medical_complication', 0);
    const before = play(running(s), ['request_inside_early', 'hear_rosa_adapt']);
    const requestedAt = before.activeRun!.externalSupport![full(s, 'rosa_crew')].requestedAt;
    const repaired = play(decide(before, 'offer_here', 'adverse'), ['clarify_assessment']);
    expect(repaired.activeRun!.externalSupport![full(s, 'rosa_crew')].requestedAt).toBe(requestedAt);
    const done = received(repaired, false);
    expect(computeDebrief(done, done.activeRun!)!.completionAchieved).toBe(true);
  });

  it('blocks actual exit and inside receiver access without making first aid depend on an employer', () => {
    const s = fixture('medical_complication', 0);
    let heard = decide(running(s, ['trauma_kit']), 'hear_rosa_assess');
    expect(evaluate(heard, 'aid_rosa_adapt').eligible).toBe(true);
    heard = decide(heard, 'aid_rosa_adapt');
    expect(notes(heard)).toContain('one trauma kit');
    blockScene(heard);
    expect(evaluate(heard, 'lock_and_step_out').eligible).toBe(false);
    let inside = decide(heard, 'offer_here');
    inside = decide(inside, 'wait_inside_crew');
    expect(evaluate(inside, 'receive_here').eligible).toBe(false);
    inside = decide(inside, 'resolve_partial');
    expect(computeDebrief(inside, inside.activeRun!)!.completionAchieved).toBe(false);
    expect(scenarioActions(s).some(a => /supervisor/.test(a.id))).toBe(false);
  });
});

describe('V6 privacy commitments', () => {
  it('offers camera observation or physical separation as ordinary alternatives', () => {
    const s = fixture('barricaded', 0); noCare(s);
    const heard = decide(running(s), 'relay_mina_assess');
    expect(evaluate(heard, 'ask_camera_off').eligible).toBe(true);
    expect(evaluate(heard, 'ask_cal_wait_apart').eligible).toBe(true);
    expect(evaluate(heard, 'ask_cal_wait_apart').timeBase).toBeGreaterThan(evaluate(heard, 'ask_camera_off').timeBase);
    const done = play(heard, ['ask_cal_wait_apart', 'check_route', 'agree_separate_conversation', 'meet_mina_outside', 'talk_separately']);
    expect(computeDebrief(done, done.activeRun!)!.completionAchieved).toBe(true);
    expect(scenarioActions(s).some(a => a.id === full(s, 'honor_next_step'))).toBe(false);
  });

  it.each([1, 2])('variant %i starts with real separation and reaches Mina’s chosen next step', variant => {
    const s = fixture('barricaded', variant); noCare(s);
    const initial = running(s);
    expect(evaluate(initial, 'ask_mina_directly').eligible).toBe(true);
    expect(evaluate(initial, 'relay_mina_assess').eligible).toBe(true);
    expect(storyPeoplePublic(s, buildLocation(s.locationFamilyId, s.locationSeed), initial.activeRun!).find(person => person.id === 'cal')!.position).toMatchObject({ kind: 'offscene' });
    expect(scenarioActions(s).some(a => /ask_camera_off|ask_cal_wait_apart/.test(a.id))).toBe(false);
    for (const name of ['phone_mina_adapt', 'relay_mina_adapt']) expect(scenarioActions(s).map(a => a.id)).not.toContain(full(s, name));
    for (const name of ['agree_separate_conversation', 'clarify_no_shared_account']) expect(scenarioActions(s).map(a => a.id)).toContain(full(s, name));
    const done = play(initial, ['ask_mina_directly', 'meet_mina_outside', 'talk_separately']);
    expect(done.activeRun!.history).toHaveLength(3);
    expect(computeDebrief(done, done.activeRun!)!.completionAchieved).toBe(true);
    const considered = play(initial, ['relay_mina_assess', ...(variant === 2 ? ['check_route'] : []), 'agree_separate_conversation', 'meet_mina_outside', 'talk_separately']);
    expect(computeDebrief(considered, considered.activeRun!)!.completionAchieved).toBe(true);
  });

  it('keeps Mina’s own answer separate from a ready privacy arrangement and an actual blocked exit', () => {
    const s = fixture('barricaded', 1); noCare(s);
    let failed = decide(running(s), 'ask_mina_directly', 'adverse');
    expect(failed.activeRun!.flags).not.toContain(full(s, 'agreement'));
    expect(evaluate(failed, 'meet_mina_outside').eligible).toBe(false);
    expect(notes(failed)).toContain('keeps its promise');
    expect(notes(failed)).not.toContain('we can explain to Cal later');
    failed = decide(failed, 'clarify_no_shared_account');
    blockScene(failed);
    expect(evaluate(failed, 'meet_mina_outside').eligible).toBe(false);
    expect(failed.activeRun!.flags).not.toContain(full(s, 'mina_outside'));
  });

  it('retains separate medical agreement, request, arrival and acceptance after the private conversation', () => {
    const s = fixture('barricaded', 1); needsCare(s);
    let state = play(running(s), ['ask_mina_directly', 'meet_mina_outside', 'talk_before_assessment']);
    expect(state.activeRun!.status).toBe('active');
    expect(state.activeRun!.externalSupport![full(s, 'mina_crew')].acceptedAt).toBeNull();
    expect(evaluate(state, 'receive_mina').eligible).toBe(false);
    state = play(state, ['wait_with_mina', 'receive_mina']);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('can honor Mina’s next step before officer care, but closes only at the real officer transfer', () => {
    const s = fixture('barricaded', 1); noCare(s);
    let state = decide(play(running(s), ['ask_mina_directly']), 'meet_mina_outside', 'adverse');
    state = play(state, ['continue_remaining_team', 'meet_at_clear_doorway', 'talk_separately']);
    expect(state.activeRun!.status).toBe('active');
    state = play(state, ['request_officer_crew', 'wait_officer_crew', 'receive_officer']);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it.each([0, 1, 2])('variant %i does not reveal future care truth through public previews', variant => {
    const s = fixture('barricaded', variant), state = running(s);
    const before = { actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) };
    const hidden = s.facts.filter(f => f.initial === 'unknown');
    for (const fact of hidden) fact.truth = !fact.truth;
    expect({ actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) }).toEqual(before);
    expect(JSON.stringify([s.summary, s.briefing, before])).not.toContain('wrist pain');
  });
});
