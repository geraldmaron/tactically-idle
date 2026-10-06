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
import { generateIncident, INCIDENT_CONTENT_VERSION, incidentId } from '../index';
import { withSignatureStory } from './signature';

const built = buildLocation('market_row', 7);
const id = (short: string) => `v5_sig_${short}`;
function fixture(seed: number): ScenarioDefinition {
  const spec: IncidentSpec = { type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 5 };
  return getScenario(incidentId(spec))!;
}
function find(truths: Record<string, boolean> = {}, available = true): ScenarioDefinition {
  for (let seed = 0; seed < 500; seed++) {
    const s = fixture(seed);
    if (Object.entries(truths).every(([name, truth]) => s.facts.find(f => f.id === id(name))?.truth === truth)
      && (!available || s.externalServices!.every(service => service.available))) return s;
  }
  throw new Error('No matching deterministic signature episode');
}
function running(s: ScenarioDefinition, gear: string[] = []): GameState {
  const state = makeState({ inventory: Object.fromEntries(gear.map(item => [item, item === 'trauma_kit' ? 5 : 1])) });
  state.saveVersion = 6; state.contentVersion = 5; initializePersonnel(state);
  const certs = Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : []);
  for (const officer of Object.values(state.officers)) officer.certs = [...new Set(certs)];
  state.incidents = [{ id: s.id, type: 'hostage_crisis', familyId: 'market_row', tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const started = apply(state, startCmd(s.id, ['A'], { positions: { A: built.location.entries[0] }, loadouts: { A: Object.fromEntries(gear.map(item => [item, item === 'trauma_kit' ? 3 : 1])) } }));
  expect(started.result).toEqual({ ok: true }); return started.state;
}
function evaluate(state: GameState, name: string) {
  const run = state.activeRun!; const scenario = getScenario(run.scenarioId)!;
  const action = scenarioActions(scenario).find(a => a.id === id(name))!;
  expect(action, name).toBeDefined();
  return evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function decide(state: GameState, name: string, band: OutcomeBand = 'favorable'): GameState {
  const ev = evaluate(state, name); expect(ev.eligible, `${name}: ${ev.reason}`).toBe(true);
  const input = structuredClone(state);
  for (let seed = 1; seed < 100_000; seed++) if (bandFor(ev.margin, next(seed).value) === band) { input.activeRun!.rngState = seed; break; }
  const result = apply(input, { type: 'decide', actionId: id(name), actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result, name).toEqual({ ok: true });
  expect(result.state.activeRun!.history.at(-1)!.band).toBe(band);
  return result.state;
}
function play(state: GameState, names: string[]): GameState { for (const name of names) state = decide(state, name); return state; }
function refused(state: GameState, name: string) {
  const result = apply(state, { type: 'decide', actionId: id(name), actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result.ok, name).toBe(false); expect(result.state).toBe(state);
}
function care(state: GameState, who: 'officer' | 'civilian'): GameState {
  const prefix = who === 'officer' ? 'resolve_officer' : 'civilian';
  state = decide(state, `${prefix}_request`);
  if (evaluate(state, `${prefix}_wait`).eligible) state = decide(state, `${prefix}_wait`);
  if (who === 'civilian') state = decide(state, 'civilian_agreement');
  return decide(state, `${prefix}_${who === 'officer' ? 'evacuate' : 'transfer'}`);
}
const notes = (state: GameState) => state.activeRun!.history.flatMap(h => h.committed?.consequences ?? []).join(' ');

describe('One Last Signature v5', () => {
  it('uses complete reported claims for public uncertainty without exposing future conversations', () => {
    const s = find();
    const visible = s.facts.filter(f => f.showWhenUnknown);
    for (const fact of visible) {
      expect(fact.uncertainty).toBe(fact.claim);
      expect(fact.uncertainty).toMatch(/[.!?]$/);
      expect(fact.uncertainty).not.toMatch(/^Whether /);
    }
    const unknown = actionViews(running(s), NOW, 'A').flatMap(a => a.uncertainty);
    expect(unknown).toContain('Ben is being held in the print shop.');
    expect(unknown).toContain('Mara is being held in her shop.');
    expect(unknown).toContain('Patrol saw Lewis with a handgun and heard a threat.');
    for (const fact of s.facts.filter(f => !f.showWhenUnknown)) {
      expect(fact.source).toBeNull();
      expect(fact.note).toBeNull();
      expect(fact.uncertainty).toBe('Further details depend on the next conversation.');
      expect(unknown).not.toContain(fact.claim);
    }
  });

  it('is deterministic, validates, leaves v4 unchanged and owns every action ID', () => {
    for (const seed of [0, 7, 42]) {
      const spec: IncidentSpec = { type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 4 };
      const old = generateIncident(spec); const snapshot = structuredClone(old);
      const story = withSignatureStory(old, built);
      expect(old).toEqual(snapshot); expect(withSignatureStory(old, built)).toEqual(story);
      expect(validateScenario(story, built)).toEqual([]);
      for (const action of scenarioActions(story)) {
        expect(action.id.startsWith('v5_sig_')).toBe(true);
        expect(action.requires.notFlags!.some(flag => flag.flag === `used:${action.id}`)).toBe(true);
        for (const effects of Object.values(action.outcomes)) for (const effect of effects) if (!effect.ending) expect(effect.objective ?? 0).toBe(0);
      }
    }
  });

  it('keeps hidden refusal, care and danger out of public opening and previews', () => {
    const s = find(); let state = running(s);
    const before = { actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) };
    const original = structuredClone(s.facts);
    try { for (const fact of s.facts) fact.truth = !fact.truth;
      expect({ actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) }).toEqual(before);
    } finally { s.facts = original; }
    const opening = JSON.stringify([s.summary, s.briefing, before]);
    expect(opening).not.toContain('won’t sign'); expect(opening).not.toContain('dizziness');
    state = play(state, ['check_patrol', 'release_ben']);
    refused(state, 'hear_mara'); refused(state, 'record_account'); refused(state, 'urgent_protection');
    expect(notes(state)).not.toContain('won’t sign');
  });

  it('completes a six-decision no-gear route with a real call and no invented signature', () => {
    const s = find({ phone_consent: true, care_needed: false });
    let state = play(running(s), ['hear_ben', 'ask_phone']);
    expect(civilianOutcomeViews(s, state.activeRun!)).toMatchObject([{ status: 'safe' }, { status: 'needs_help' }]);
    expect(state.activeRun!.flags).toContain('sig_ben_call_made');
    expect(state.activeRun!.objective).toBe(0);
    state = play(state, ['hear_mara', 'record_account']);
    refused(state, 'civilian_next_step');
    state = play(state, ['bring_mara_out', 'civilian_next_step']);
    expect(state.activeRun!.history).toHaveLength(6);
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: true, disposition: 'followup_agreed' });
    expect(notes(state)).toContain('Ben reached his delivery dispatcher, as promised');
    expect(state.activeRun!.externalSupport).toEqual({});
    expect(s.endings[state.activeRun!.endingId!].summary).toContain('unsigned');
  });

  it('preserves an immediate safe release after phone refusal, then permits an honest low-resource ending', () => {
    const s = find({ phone_consent: false });
    let state = play(running(s), ['check_patrol', 'ask_phone']);
    expect(state.activeRun!.flags).not.toContain('sig_ben_safe');
    refused(state, 'ask_phone');
    state = decide(state, 'release_ben');
    expect(state.activeRun!.flags).toContain('sig_ben_call_made');
    expect(evaluate(state, 'independent_phone').eligible).toBe(false);
    state = decide(state, 'adapt_withdraw');
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: false, disposition: 'relief_partial' });
    expect(notes(state)).toContain('Mara is still inside');
    expect(civilianOutcomeViews(s, state.activeRun!)).toMatchObject([{ status: 'safe' }, { status: 'needs_help' }]);
  });

  it('does not invent Ben’s promised call when the player never promised it', () => {
    const s = find();
    const state = play(running(s), ['check_patrol', 'release_ben', 'adapt_withdraw']);
    expect(state.activeRun!.flags).not.toContain('sig_ben_call_made');
    expect(notes(state)).not.toContain('Ben reached his delivery dispatcher, as promised');
  });

  it('requires a working assigned negotiation phone and trained participating negotiator to restore contact', () => {
    const s = find(); const start = (gear: string[]) => play(running(s, gear), ['check_patrol', 'release_ben']);
    const bare = start([]); expect(evaluate(bare, 'independent_phone').eligible).toBe(false);
    let equipped = start(['throw_phone']); expect(evaluate(equipped, 'independent_phone').eligible).toBe(true);
    for (const mutate of [
      (v: GameState) => { v.units[unitId('throw_phone')].condition = 0; },
      (v: GameState) => { v.reservations = v.reservations.filter(r => r.itemId !== 'throw_phone'); },
      (v: GameState) => { for (const officer of Object.values(v.officers)) officer.certs = officer.certs.filter(c => c !== 'crisis_negotiation'); },
    ]) { const changed = structuredClone(equipped); mutate(changed); expect(evaluate(changed, 'independent_phone').eligible).toBe(false); }
    equipped = play(equipped, ['independent_phone', 'hear_mara']);
    expect(equipped.activeRun!.history.find(h => h.actionId === id('independent_phone'))!.unitsUsed).toContain(unitId('throw_phone'));
    expect(equipped.activeRun!.knowledge[id('mara_refusal')]).toBe('confirmed');
  });

  it('keeps the phone outside choice useful when an independent line is connected before Ben leaves', () => {
    const s = find({ phone_consent: true });
    const state = play(running(s, ['throw_phone']), ['hear_ben', 'independent_phone', 'release_ben', 'hear_mara']);
    expect(state.activeRun!.flags).toContain('sig_independent_line');
    expect(state.activeRun!.flags).not.toContain('sig_contact_lost');
  });

  it('charges mixed discussion time and allows exactly one clarification of a failed offer', () => {
    const s = find({ phone_consent: true, care_needed: false });
    const before = play(running(s), ['hear_ben', 'ask_phone', 'hear_mara']);
    const clean = decide(before, 'record_account'); const slow = decide(before, 'record_account', 'mixed');
    expect(slow.activeRun!.clock).toBeGreaterThan(clean.activeRun!.clock);
    let broken = decide(before, 'record_account', 'adverse');
    expect(broken.activeRun!.flags).toContain('sig_exchange_closed');
    refused(broken, 'record_account'); refused(broken, 'bring_mara_out');
    broken = decide(broken, 'clarify_recording', 'mixed');
    expect(broken.activeRun!.flags).toContain('sig_exchange_recovered');
    expect(broken.activeRun!.flags).not.toContain('sig_current_danger');
    refused(broken, 'clarify_recording');
    broken = play(broken, ['bring_mara_out', 'civilian_next_step']);
    expect(computeDebrief(broken, broken.activeRun!)!.completionAchieved).toBe(true);
    let failed = decide(decide(before, 'record_account', 'adverse'), 'clarify_recording', 'adverse');
    refused(failed, 'clarify_recording'); refused(failed, 'record_account'); refused(failed, 'bring_mara_out');
    failed = decide(failed, 'resolve_withdraw');
    expect(computeDebrief(failed, failed.activeRun!)!.completionAchieved).toBe(false);
  });

  it('does not authorize emergency protection from refusal, silence or gear alone', () => {
    const s = find({ lost_line_threat: false });
    let state = play(running(s, ['service_sidearm']), ['check_patrol', 'release_ben']);
    refused(state, 'urgent_protection');
    state = decide(state, 'lost_line_update');
    expect(state.activeRun!.knowledge[id('lost_line_threat')]).toBe('disproved');
    refused(state, 'urgent_protection');
  });

  it('requires credible current danger plus actual firearm/certification; a wounded officer pauses the distinct Mara release', () => {
    const s = find({ lost_line_threat: true });
    const prepare = (gear: string[]) => play(running(s, gear), ['check_patrol', 'release_ben', 'lost_line_update']);
    const bare = prepare([]); expect(evaluate(bare, 'urgent_protection').eligible).toBe(false);
    let state = prepare(['service_sidearm', 'trauma_kit']);
    for (const mutate of [
      (v: GameState) => { v.units[unitId('service_sidearm')].condition = 0; },
      (v: GameState) => { v.reservations = v.reservations.filter(r => r.itemId !== 'service_sidearm'); },
      (v: GameState) => { for (const officer of Object.values(v.officers)) officer.certs = officer.certs.filter(c => c !== 'entry_team'); },
      (v: GameState) => { v.activeRun!.flags = v.activeRun!.flags.filter(f => f !== 'sig_current_danger'); },
    ]) { const changed = structuredClone(state); mutate(changed); expect(evaluate(changed, 'urgent_protection').eligible).toBe(false); }
    state = decide(state, 'urgent_protection', 'mixed');
    const casualty = Object.values(state.activeRun!.officerCasualties!)[0];
    expect(casualty.care).toBe('needed');
    expect(state.activeRun!.flags).not.toContain('sig_mara_safe');
    refused(state, 'bring_mara_out');
    state = decide(state, 'resolve_officer_aid');
    expect(state.activeRun!.history.at(-1)!.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
    refused(state, 'resolve_officer_aid');
    state = care(state, 'officer');
    state = decide(state, 'bring_mara_out');
    expect(state.activeRun!.history.at(-1)!.officerIds).not.toContain(casualty.officerId);
    state = care(state, 'civilian');
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: true, disposition: 'care_accepted' });
  });

  it('preserves failed urgent danger and actual Mara/officer injuries through the partial ending', () => {
    const s = find({ lost_line_threat: true });
    let state = play(running(s, ['service_sidearm']), ['check_patrol', 'release_ben', 'lost_line_update']);
    state = decide(state, 'urgent_protection', 'adverse');
    expect(civilianOutcomeViews(s, state.activeRun!)[1].status).toBe('injured_needs_care');
    expect(state.activeRun!.flags).toContain('sig_current_danger');
    expect(state.activeRun!.flags).not.toContain('sig_mara_safe');
    refused(state, 'urgent_protection'); refused(state, 'bring_mara_out');
    state = care(state, 'officer');
    state = decide(state, 'resolve_withdraw');
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(false);
    expect(state.activeRun!.flags).toContain('sig_mara_injured');
  });

  it('lets an immediate no-gear release reach a full ending through a slower relayed exchange', () => {
    const s = find({ care_needed: false });
    let state = play(running(s), ['check_patrol', 'release_ben', 'relay_contact', 'hear_mara']);
    expect(state.activeRun!.flags).toContain('sig_relay_contact');
    expect(state.activeRun!.history.flatMap(h => h.unitsUsed)).toEqual([]);
    state = play(state, ['record_account', 'bring_mara_out', 'civilian_next_step']);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    expect(state.activeRun!.history).toHaveLength(7);
    expect(notes(state)).not.toContain('promised call');
  });

  it('retains dialogue after the fresh threat, and never invents a phone on the relay branch', () => {
    const s = find({ lost_line_threat: true });
    let state = play(running(s), ['check_patrol', 'release_ben', 'lost_line_update', 'relay_contact_later', 'hear_mara_later']);
    state = decide(state, 'record_account', 'adverse');
    const last = state.activeRun!.history.at(-1)!.committed!.consequences.join(' ');
    expect(last).toContain('Patrol hears Lewis threaten');
    expect(last).not.toContain('connected phone');
    state = play(state, ['clarify_recording', 'bring_mara_out']);
    state = care(state, 'civilian');
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('does not let a failed relay become contact or reset when the stage changes', () => {
    const s = find({ lost_line_threat: true });
    let state = play(running(s), ['check_patrol', 'release_ben']);
    state = decide(state, 'relay_contact', 'adverse');
    refused(state, 'hear_mara'); refused(state, 'relay_contact');
    state = decide(state, 'lost_line_update');
    refused(state, 'relay_contact_later'); refused(state, 'hear_mara_later');
    state = decide(state, 'resolve_withdraw');
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(false);
  });

  it('preserves a real generated v5 save and exactly the same next consequence after reload', () => {
    const s = find({ phone_consent: true, care_needed: false });
    const natural = (state: GameState, action: string) => {
      const result = apply(state, { type: 'decide', actionId: id(action), actingSquadIds: ['A'], supportSquadIds: [] });
      expect(result.result).toEqual({ ok: true }); return result.state;
    };
    let state: GameState | undefined;
    for (let seed = 1; seed < 500; seed++) {
      let candidate = running(s); candidate.activeRun!.rngState = seed;
      candidate = natural(natural(candidate, 'hear_ben'), 'ask_phone');
      if (!candidate.activeRun!.flags.includes('sig_ben_safe')) continue;
      candidate = natural(natural(candidate, 'hear_mara'), 'record_account');
      if (candidate.activeRun!.flags.includes('sig_exchange_closed')) { state = candidate; break; }
    }
    expect(state).toBeDefined();
    const restored = deserialize(serialize(state!, NOW));
    expect(restored).not.toBeNull();
    expect(restored).toEqual({ ...state!, contentVersion: INCIDENT_CONTENT_VERSION });
    expect(natural(restored!, 'clarify_recording')).toEqual({ ...natural(state!, 'clarify_recording'), contentVersion: INCIDENT_CONTENT_VERSION });
    refused(restored!, 'record_account');
  });

  it('keeps each reachable public menu small and every completed beat non-repeatable', () => {
    const s = find({ phone_consent: true, care_needed: false });
    let state = running(s);
    for (const nextAction of ['hear_ben', 'ask_phone', 'hear_mara', 'record_account', 'bring_mara_out', 'civilian_next_step']) {
      const menu = actionViews(state, NOW, 'A');
      expect(menu.length, menu.map(a => a.id).join(', ')).toBeLessThanOrEqual(5);
      expect(menu.some(a => a.eligible)).toBe(true);
      state = decide(state, nextAction);
      refused(state, nextAction);
    }
  });

  it('keeps Ben safe rather than making him a patient when Mara requests care', () => {
    const s = find({ phone_consent: true, care_needed: true });
    let state = play(running(s), ['hear_ben', 'ask_phone', 'hear_mara', 'record_account', 'bring_mara_out']);
    expect(currentStoryPrompt(s, state.activeRun!)).toContain('Mara needs assessment');
    state = care(state, 'civilian');
    expect(civilianOutcomeViews(s, state.activeRun!)).toMatchObject([{ status: 'safe' }, { status: 'care_accepted' }]);
    expect(notes(state)).toContain('Ben remains safe with patrol');
    expect(s.endings[state.activeRun!.endingId!].summary).toContain('accepted Mara’s care');
  });

  it('lets an actual Mara injury override an otherwise clean medical bundle', () => {
    const s = find({ phone_consent: true, care_needed: false });
    let state = play(running(s, ['service_sidearm']), ['hear_ben', 'ask_phone', 'hear_mara']);
    state = decide(state, 'record_account', 'adverse');
    state = decide(state, 'urgent_protection', 'adverse');
    state = care(state, 'officer');
    state = play(state, ['clarify_recording', 'bring_mara_out']);
    expect(state.activeRun!.knowledge[id('care_needed')]).toBe('disproved');
    expect(state.activeRun!.flags).toContain('v5_sig_care_required');
    refused(state, 'civilian_next_step');
    state = care(state, 'civilian');
    expect(civilianOutcomeViews(s, state.activeRun!)).toMatchObject([{ status: 'safe' }, { status: 'care_accepted' }]);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('requires a complete physical entry route before urgent protection can reach Mara', () => {
    const s = find({ lost_line_threat: true });
    let state = play(running(s, ['service_sidearm']), ['check_patrol', 'release_ben', 'lost_line_update']);
    expect(evaluate(state, 'urgent_protection').eligible).toBe(true);
    const blocked = structuredClone(state);
    const rooms = new Set(built.location.rooms.map(room => room.id));
    for (const opening of built.location.openings) if (rooms.has(opening.a) !== rooms.has(opening.b)) blocked.activeRun!.flags.push(openingFlag(opening.id, 'blocked'));
    refused(blocked, 'urgent_protection');
    expect(blocked.activeRun!.flags).not.toContain('sig_threat_stopped');
    state = decide(state, 'urgent_protection');
    expect(state.activeRun!.squadTasks.find(task => task.squadId === 'A')!.positionId).toBe(s.story!.bindings.rooms.scene.spaceId);
    expect(state.activeRun!.flags).toContain('sig_threat_stopped');
  });

  it('updates public dilemmas and committed Next text only after real state changes', () => {
    const s = find({ care_needed: false });
    let state = play(running(s), ['check_patrol', 'release_ben']);
    expect(currentStoryPrompt(s, state.activeRun!)).toContain('Ben is outside with his phone');
    expect(state.activeRun!.history.at(-1)!.committed!.consequences.at(-1)).toContain('Ben is outside with his phone');
    state = play(state, ['relay_contact', 'hear_mara', 'record_account']);
    expect(currentStoryPrompt(s, state.activeRun!)).toContain('She is still inside');
    state = decide(state, 'bring_mara_out');
    expect(currentStoryPrompt(s, state.activeRun!)).toContain('Both people are outside');
    expect(state.activeRun!.history.at(-1)!.committed!.consequences.at(-1)).toContain('Both people are outside');
  });

  it('leads partial results and ending summaries with the actual named people’s status', () => {
    const s = find({ phone_consent: true, care_needed: true });
    const stillInside = decide(running(s), 'assess_withdraw');
    const benOnly = play(running(s), ['check_patrol', 'release_ben', 'adapt_withdraw']);
    const carePending = play(running(s), ['hear_ben', 'ask_phone', 'hear_mara', 'record_account', 'bring_mara_out', 'civilian_partial']);
    for (const [state, expected] of [[stillInside, 'Ben and Mara are still inside'], [benOnly, 'Ben is outside with his unsigned slip'], [carePending, 'Ben and Mara are outside']] as const) {
      expect(state.activeRun!.history.at(-1)!.committed!.consequences[0]).toContain(expected);
      expect(s.endings[state.activeRun!.endingId!].summary).toContain(expected);
      expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(false);
    }
    expect(s.endings[carePending.activeRun!.endingId!].summary).toContain('no medical crew has accepted Mara’s care');
    expect(s.endings[stillInside.activeRun!.endingId!].remainingTasks).toContain('Complete Ben’s and Mara’s release to safety');
    expect(s.endings[benOnly.activeRun!.endingId!].remainingTasks).toEqual(['Complete Mara’s release to safety', 'Complete any needed civilian care', 'Complete any outstanding officer care']);
    expect(computeDebrief(carePending, carePending.activeRun!)!.remainingTasks).toEqual(['Arrange accepted medical care for Mara', 'Complete any outstanding officer care']);
  });

  it('does not reopen accepted officer care when both civilians are safe but the player ends before their next steps', () => {
    const s = find({ phone_consent: true, care_needed: false });
    let state = play(running(s, ['service_sidearm']), ['hear_ben', 'ask_phone', 'hear_mara']);
    state = decide(state, 'record_account', 'adverse');
    state = decide(state, 'urgent_protection', 'mixed');
    const officerId = Object.keys(state.activeRun!.officerCasualties!)[0];
    state = care(state, 'officer');
    state = play(state, ['bring_mara_out', 'civilian_partial']);
    expect(state.activeRun!.officerCasualties![officerId].care).toBe('evacuated');
    expect(state.activeRun!.flags).not.toContain('casualty:awaiting_transport');
    const summary = s.endings[state.activeRun!.endingId!].summary;
    expect(summary).toContain('Their next steps have not been agreed');
    expect(summary).toContain('their actual care status');
    expect(summary).not.toContain('officer care, are not yet complete');
    expect(state.activeRun!.history.at(-1)!.committed!.consequences[0]).toBe(summary);
    expect(computeDebrief(state, state.activeRun!)!.remainingTasks).toEqual(['Agree Ben’s and Mara’s next steps', 'Complete any outstanding officer care']);
  });

  it('labels fixed events without presenting conditional releases, offers or urgent responses as guaranteed', () => {
    const s = find();
    const actions = scenarioActions(s);
    for (const [name, label] of [
      ['hear_ben', 'Ben and patrol heard'], ['check_patrol', 'Accounts checked'],
      ['release_ben', 'Ben reached safety'], ['independent_phone', 'Two-way contact established'],
      ['hear_mara', 'Mara’s account heard'], ['bring_mara_out', 'Mara reached safety'],
      ['civilian_transfer', 'Mara’s care accepted'], ['civilian_next_step', 'Next steps agreed'],
      ['adapt_withdraw', 'Partial outcome recorded'],
    ]) expect(actions.find(action => action.id === id(name))!.resultLabels).toEqual({ favorable: label, mixed: label, adverse: label });
    for (const name of ['ask_phone', 'relay_contact', 'lost_line_update', 'record_account', 'clarify_recording', 'urgent_protection'])
      expect(actions.find(action => action.id === id(name))!.resultLabels).toBeUndefined();
  });

  it('saves a guaranteed safe release event label alongside its actual adverse effort band', () => {
    const s = find();
    const natural = (state: GameState, action: string) => {
      const result = apply(state, { type: 'decide', actionId: id(action), actingSquadIds: ['A'], supportSquadIds: [] });
      expect(result.result).toEqual({ ok: true }); return result.state;
    };
    let state: GameState | undefined;
    for (let seed = 1; seed < 500; seed++) {
      const initial = running(s); initial.activeRun!.rngState = seed;
      const candidate = natural(natural(initial, 'check_patrol'), 'release_ben');
      if (candidate.activeRun!.history.at(-1)!.band === 'adverse') { state = candidate; break; }
    }
    expect(state).toBeDefined();
    expect(state!.activeRun!.flags).toContain('sig_ben_safe');
    expect(state!.activeRun!.history.at(-1)).toMatchObject({ band: 'adverse', committed: { resultLabel: 'Ben reached safety' } });
    const restored = deserialize(serialize(state!, NOW));
    expect(restored).not.toBeNull();
    expect(restored!.activeRun).toEqual(state!.activeRun);
    expect(restored!.activeRun!.history.at(-1)).toMatchObject({ band: 'adverse', committed: { resultLabel: 'Ben reached safety' } });
    expect(natural(restored!, 'adapt_withdraw').activeRun!.history.at(-1)!.committed!.resultLabel).toBe('Partial outcome recorded');
  });

  it('rejects blocked release routes and never awards progress for replaying a completed beat', () => {
    const s = find({ phone_consent: true });
    let state = decide(running(s), 'hear_ben');
    const route = s.story!.bindings.routes[scenarioActions(s).find(a => a.id === id('release_ben'))!.storyRoute!];
    const blockedOpenings = buildLocation(s.locationFamilyId, s.locationSeed).location.openings.filter(opening => opening.a === route.fromSpaceId || opening.b === route.fromSpaceId);
    const blocked = structuredClone(state); blocked.activeRun!.flags.push(...blockedOpenings.map(opening => openingFlag(opening.id, 'blocked')));
    refused(blocked, 'release_ben'); refused(blocked, 'ask_phone');
    state = play(state, ['ask_phone', 'hear_mara', 'record_account', 'bring_mara_out']);
    for (const prior of ['hear_ben', 'ask_phone', 'hear_mara', 'record_account', 'bring_mara_out']) refused(state, prior);
    expect(state.activeRun!.objective).toBe(0);
  });
});
