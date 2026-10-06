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
import { withWelfareStory } from './welfare';
import { withAssistanceStory } from './assistance';
import { withProtectiveStory } from './protective';

type Pattern = 'welfare' | 'assistance' | 'protective';
const specs = { welfare: { type: 'welfare_check', familyId: 'cedar_close', builder: withWelfareStory }, assistance: { type: 'medical_complication', familyId: 'market_row', builder: withAssistanceStory }, protective: { type: 'barricaded', familyId: 'cedar_close', builder: withProtectiveStory } } as const;
function pattern(s: ScenarioDefinition): Pattern { return s.incident!.type === 'welfare_check' ? 'welfare' : s.incident!.type === 'medical_complication' ? 'assistance' : 'protective'; }
function id(s: ScenarioDefinition, short: string) { return `v5_${pattern(s)}_${short}`; }
function fixture(kind: Pattern, seed = 0, familyId: string = specs[kind].familyId): ScenarioDefinition {
  return getScenario(incidentId({ type: specs[kind].type, familyId, buildingSeed: 7, seed, tier: 2, contentVersion: 5 }))!;
}
function find(kind: Pattern, truths: Record<string, boolean> = {}, available = true): ScenarioDefinition {
  for (let seed = 0; seed < 200; seed++) {
    const s = fixture(kind, seed); expect(s, `${kind} seed ${seed}`).not.toBeNull();
    if (Object.entries(truths).every(([name, truth]) => s.facts.find(f => f.id === id(s, name))?.truth === truth)
      && s.externalServices!.every(service => service.available === available)) return s;
  }
  throw new Error(`No ${kind} fixture`);
}
function running(s: ScenarioDefinition, gear: string[] = []): GameState {
  const state = makeState({ inventory: Object.fromEntries(gear.map(item => [item, item === 'trauma_kit' ? 4 : 1])) });
  state.saveVersion = 6; state.contentVersion = 5; initializePersonnel(state);
  const certs = Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : []);
  for (const officer of Object.values(state.officers)) officer.certs = [...new Set(certs)];
  state.incidents = [{ id: s.id, type: s.incident!.type, familyId: s.locationFamilyId, tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const result = apply(state, startCmd(s.id, ['A'], { positions: { A: buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0] }, loadouts: { A: Object.fromEntries(gear.map(item => [item, item === 'trauma_kit' ? 2 : 1])) } }));
  expect(result.result).toEqual({ ok: true }); return result.state;
}
const scenario = (state: GameState) => getScenario(state.activeRun!.scenarioId)!;
const notes = (state: GameState) => state.activeRun!.history.flatMap(h => h.committed?.consequences ?? []).join(' ');
function evaluate(state: GameState, short: string) {
  const run = state.activeRun!; const s = scenario(state); const a = scenarioActions(s).find(a => a.id === id(s, short))!;
  expect(a, short).toBeDefined();
  return evaluateAction({ state, run, scenario: s, action: a, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function decide(state: GameState, short: string, band: OutcomeBand = 'favorable'): GameState {
  const ev = evaluate(state, short); expect(ev.eligible, `${short}: ${ev.reason}`).toBe(true);
  const input = structuredClone(state);
  for (let seed = 1; seed < 100_000; seed++) if (bandFor(ev.margin, next(seed).value) === band) { input.activeRun!.rngState = seed; break; }
  const result = apply(input, { type: 'decide', actionId: id(scenario(state), short), actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result, short).toEqual({ ok: true }); expect(result.state.activeRun!.history.at(-1)!.band, short).toBe(band); return result.state;
}
function play(state: GameState, names: string[]): GameState { for (const name of names) state = decide(state, name); return state; }
function refused(state: GameState, short: string) {
  const result = apply(state, { type: 'decide', actionId: id(scenario(state), short), actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result.ok, short).toBe(false); expect(result.state).toBe(state);
}
function crew(state: GameState, wait: string, receive: string): GameState {
  if (evaluate(state, wait).eligible) state = decide(state, wait);
  return decide(state, receive);
}
function natural(state: GameState, short: string): GameState {
  const result = apply(state, { type: 'decide', actionId: id(scenario(state), short), actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result, short).toEqual({ ok: true }); return result.state;
}

describe('Three distinct human response stories', () => {
  it.each(['welfare', 'assistance', 'protective'] as const)('%s deterministically owns its graph without changing the input or v4', kind => {
    for (const seed of [0, 7, 42]) {
      const spec: IncidentSpec = { type: specs[kind].type, familyId: specs[kind].familyId, buildingSeed: 7, seed, tier: 2, contentVersion: 4 };
      const old = generateIncident(spec); const before = structuredClone(old); const built = buildLocation(spec.familyId, 7);
      const story = specs[kind].builder(old, built);
      expect(old).toEqual(before); expect(specs[kind].builder(old, built)).toEqual(story); expect(validateScenario(story, built)).toEqual([]);
      expect(story.summary.split(/\s+/).length).toBeGreaterThanOrEqual(45); expect(story.summary.split(/\s+/).length).toBeLessThanOrEqual(70);
      for (const a of scenarioActions(story)) {
        expect(a.id.startsWith(`v5_${kind}_`)).toBe(true);
        expect(a.requires.notFlags).toContainEqual({ flag: `used:${a.id}`, reason: 'This step has already been attempted' });
        for (const effects of Object.values(a.outcomes)) for (const effect of effects) if (!effect.ending) expect(effect.objective ?? 0).toBe(0);
      }
    }
  });

  it.each(['welfare', 'assistance', 'protective'] as const)('%s opening and previews never depend on hidden truths', kind => {
    const s = find(kind); const state = running(s); const before = { actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) };
    const facts = structuredClone(s.facts);
    try { for (const f of s.facts) f.truth = !f.truth; expect({ actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) }).toEqual(before); }
    finally { s.facts = facts; }
    const opening = JSON.stringify([s.summary, s.briefing, before]);
    for (const secret of kind === 'welfare' ? ['persistent headache', 'both accounts trace'] : kind === 'assistance' ? ['Daniel Price answers', 'immediately leaving the shop unlocked'] : ['wrist pain', 'puts his phone away']) expect(opening).not.toContain(secret);
  });

  it.each(['welfare', 'assistance', 'protective'] as const)('%s keeps issued generated runs and their next natural consequence through serialization', kind => {
    const s = find(kind); let state = running(s);
    const first = kind === 'welfare' ? 'trace_sources_assess' : kind === 'assistance' ? 'request_crew_early' : 'ask_cal_first';
    const second = kind === 'welfare' ? 'check_ada_now' : kind === 'assistance' ? 'hear_rosa_adapt' : 'relay_mina_adapt';
    state = natural(state, first); const restored = deserialize(serialize(state, NOW));
    expect(restored).not.toBeNull(); expect(restored).toEqual({ ...state, contentVersion: INCIDENT_CONTENT_VERSION });
    expect(natural(restored!, second)).toEqual({ ...natural(state, second), contentVersion: INCIDENT_CONTENT_VERSION }); refused(restored!, first);
  });
});

describe('The Second Knock', () => {
  it('corrects a repeated report while Ada remains present and safe, without erasing the original threat', () => {
    const s = find('welfare', { care_needed: false }); let state = running(s);
    state = decide(state, 'trace_sources_assess'); expect(state.activeRun!.knowledge[id(s, 'current_threat')]).toBe('reported'); refused(state, 'correct_and_close');
    state = decide(state, 'check_ada_now');
    expect(state.activeRun!.knowledge[id(s, 'ada')]).toBe('confirmed'); expect(state.activeRun!.knowledge[id(s, 'current_threat')]).toBe('disproved');
    state = decide(state, 'correct_and_close'); expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: true, disposition: 'followup_agreed' });
    expect(civilianOutcomeViews(s, state.activeRun!)[0].status).toBe('safe'); expect(notes(state)).toContain('retains the original threatening visit');
    expect(state.activeRun!.externalSupport).toEqual({}); expect(state.activeRun!.history).toHaveLength(3);
  });

  it('earlier contact can request care during source checks but cannot invent safe access or an accepted receiver', () => {
    const s = find('welfare', { care_needed: true }); let fast = play(running(s), ['ask_about_return', 'request_early_assessment']);
    expect(fast.activeRun!.flags).not.toContain(id(s, 'ada_safe'));
    expect(fast.activeRun!.externalSupport![id(s, 'ada_crew')].acceptedAt).toBeNull(); refused(fast, 'receive_ada'); refused(fast, 'check_ada_now');
    fast = play(fast, ['trace_sources_adapt']); refused(fast, 'check_ada_now');
    expect(currentStoryPrompt(s, fast.activeRun!)).toContain('acknowledge');
    fast = play(fast, ['acknowledge_repeat', 'check_ada_now']);
    expect(notes(fast)).toContain('early requested ambulance has continued responding');
    const slow = play(running(s), ['trace_sources_assess', 'check_ada_now', 'offer_assessment']);
    expect(fast.activeRun!.externalSupport![id(s, 'ada_crew')].requestedAt).toBeLessThan(slow.activeRun!.externalSupport![id(s, 'ada_crew')].requestedAt);
    fast = crew(fast, 'wait_with_ada', 'receive_ada');
    expect(computeDebrief(fast, fast.activeRun!)!.completionAchieved).toBe(true); expect(civilianOutcomeViews(s, fast.activeRun!)[0].status).toBe('care_accepted');
  });

  it('has a specific one-shot recovery after drifting back into the old account', () => {
    const s = find('welfare', { care_needed: false }); const before = decide(running(s), 'trace_sources_assess');
    const quick = decide(before, 'check_ada_now'); const slow = decide(before, 'check_ada_now', 'mixed'); expect(slow.activeRun!.clock).toBeGreaterThan(quick.activeRun!.clock);
    let state = decide(before, 'check_ada_now', 'adverse'); refused(state, 'check_ada_now'); refused(state, 'correct_and_close');
    expect(notes(state)).toContain('old account'); state = decide(state, 'offer_one_question', 'mixed');
    expect(state.activeRun!.flags).toContain(id(s, 'narrowed_exchange')); refused(state, 'offer_one_question');
    state = decide(state, 'correct_and_close'); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    let partial = decide(decide(before, 'check_ada_now', 'adverse'), 'offer_one_question', 'adverse'); partial = decide(partial, 'adapt_partial');
    expect(computeDebrief(partial, partial.activeRun!)!.completionAchieved).toBe(false); expect(partial.activeRun!.flags).not.toContain(id(s, 'ada_safe'));
  });

  it('requires a real unblocked path for the at-home crew and cannot farm a correction or debrief twice', () => {
    const s = find('welfare', { care_needed: true }); let state = play(running(s), ['trace_sources_assess', 'check_ada_now', 'offer_assessment']);
    if (evaluate(state, 'wait_with_ada').eligible) state = decide(state, 'wait_with_ada');
    const route = s.story!.bindings.routes[scenarioActions(s).find(a => a.id === id(s, 'receive_ada'))!.storyRoute!];
    const blockedOpenings = buildLocation(s.locationFamilyId, s.locationSeed).location.openings.filter(opening => opening.a === route.fromSpaceId || opening.b === route.fromSpaceId);
    const blocked = structuredClone(state); blocked.activeRun!.flags.push(...blockedOpenings.map(opening => openingFlag(opening.id, 'blocked'))); refused(blocked, 'receive_ada');
    state = decide(state, 'receive_ada'); refused(state, 'receive_ada'); const closed = apply(state, { type: 'closeDebrief' }); expect(closed.result.ok).toBe(true);
    const twice = apply(closed.state, { type: 'closeDebrief' }); expect(twice.result.ok).toBe(false); expect(twice.state).toBe(closed.state);
  });
});

describe('Still on the Clock', () => {
  it('accepts on-site care with no kit, supervisor answer or key handover', () => {
    const s = find('assistance', { supervisor_answers: false }); let state = play(running(s), ['hear_rosa_assess', 'call_supervisor']);
    expect(state.activeRun!.flags).not.toContain(id(s, 'lock_plan')); state = decide(state, 'offer_here');
    state = crew(state, 'wait_with_rosa', 'receive_here');
    expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: true, disposition: 'care_accepted' });
    expect(state.activeRun!.flags).toContain(id(s, 'keys_with_rosa')); expect(state.activeRun!.flags).not.toContain(id(s, 'shop_locked'));
    expect(notes(state)).toContain('keys stay in her hand'); expect(s.endings[state.activeRun!.endingId!].summary).toContain('accepted her care inside the shop'); expect(state.activeRun!.history.flatMap(h => h.unitsUsed)).toEqual([]);
  });

  it('a checked call opens a distinct outside ending and earlier crew request progresses during the conversation', () => {
    const s = find('assistance', { supervisor_answers: true }); let state = play(running(s), ['request_crew_early', 'hear_rosa_adapt']);
    expect(state.activeRun!.flags).not.toContain(id(s, 'assessment_agreed')); refused(state, 'receive_outside');
    state = play(state, ['call_supervisor', 'lock_and_step_out']);
    expect(state.activeRun!.flags).toEqual(expect.arrayContaining([id(s, 'outside'), id(s, 'shop_locked'), id(s, 'keys_with_rosa')]));
    expect(notes(state)).toContain('earlier requested crew has continued responding');
    state = crew(state, 'wait_with_rosa', 'receive_outside'); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    expect(s.endings[state.activeRun!.endingId!].summary).toContain('keys in her pocket');
  });

  it('an early requested crew does not block on-site agreement or its one clarification', () => {
    const s = find('assistance', { supervisor_answers: false });
    const before = play(running(s), ['request_crew_early', 'hear_rosa_adapt']);
    const requestedAt = before.activeRun!.externalSupport![id(s, 'rosa_crew')].requestedAt;
    let clean = decide(before, 'offer_here');
    expect(clean.activeRun!.externalSupport![id(s, 'rosa_crew')].requestedAt).toBe(requestedAt);
    clean = crew(clean, 'wait_with_rosa', 'receive_here'); expect(computeDebrief(clean, clean.activeRun!)!.completionAchieved).toBe(true);
    let repaired = decide(decide(before, 'offer_here', 'adverse'), 'clarify_assessment');
    expect(repaired.activeRun!.externalSupport![id(s, 'rosa_crew')].requestedAt).toBe(requestedAt);
    repaired = crew(repaired, 'wait_with_rosa', 'receive_here'); expect(computeDebrief(repaired, repaired.activeRun!)!.completionAchieved).toBe(true);
  });

  it('a misunderstood permanent-stay promise needs an actual clarification, and declined clarification remains partial', () => {
    const s = find('assistance', { supervisor_answers: false }); const before = decide(running(s), 'hear_rosa_assess');
    let state = decide(before, 'offer_here', 'adverse'); expect(currentStoryPrompt(s, state.activeRun!)).toContain('never need to leave');
    refused(state, 'receive_here'); refused(state, 'offer_here'); state = decide(state, 'clarify_assessment', 'mixed');
    expect(state.activeRun!.flags).toContain(id(s, 'understanding_repaired')); state = crew(state, 'wait_with_rosa', 'receive_here'); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    let partial = decide(decide(before, 'offer_here', 'adverse'), 'clarify_assessment', 'adverse'); partial = decide(partial, 'adapt_partial');
    expect(computeDebrief(partial, partial.activeRun!)!.completionAchieved).toBe(false); expect(partial.activeRun!.flags).not.toContain(id(s, 'assessment_agreed'));
  });

  it('first aid consumes an actual qualified assigned kit once, and never substitutes for an unavailable receiver', () => {
    const s = find('assistance', {}, false); const bare = decide(running(s), 'hear_rosa_assess'); expect(evaluate(bare, 'aid_rosa_adapt').eligible).toBe(false);
    let state = decide(running(s, ['trauma_kit']), 'hear_rosa_assess');
    for (const change of [
      (v: GameState) => { v.reservations = v.reservations.filter(r => r.itemId !== 'trauma_kit'); },
      (v: GameState) => { for (const o of Object.values(v.officers)) o.certs = o.certs.filter(c => c !== 'advanced_first_aid'); },
    ]) { const changed = structuredClone(state); change(changed); expect(evaluate(changed, 'aid_rosa_adapt').eligible).toBe(false); }
    state = decide(state, 'aid_rosa_adapt'); expect(state.activeRun!.history.at(-1)!.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
    refused(state, 'aid_rosa_adapt'); state = decide(state, 'offer_here'); refused(state, 'aid_rosa_resolve'); refused(state, 'receive_here');
    state = decide(state, 'resolve_partial'); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(false); expect(state.activeRun!.flags).not.toContain(id(s, 'rosa_care'));
  });

  it('will not teleport a receiving crew or Rosa through a blocked shop route', () => {
    const s = find('assistance', { supervisor_answers: true }); let state = play(running(s), ['hear_rosa_assess', 'call_supervisor']);
    const route = s.story!.bindings.routes[scenarioActions(s).find(a => a.id === id(s, 'lock_and_step_out'))!.storyRoute!];
    const blockedOpenings = buildLocation(s.locationFamilyId, s.locationSeed).location.openings.filter(opening => opening.a === route.fromSpaceId || opening.b === route.fromSpaceId);
    const blocked = structuredClone(state); blocked.activeRun!.flags.push(...blockedOpenings.map(opening => openingFlag(opening.id, 'blocked'))); refused(blocked, 'lock_and_step_out');
    state = decide(state, 'offer_here'); if (evaluate(state, 'wait_with_rosa').eligible) state = decide(state, 'wait_with_rosa');
    const blockedCare = structuredClone(state); blockedCare.activeRun!.flags.push(...blockedOpenings.map(opening => openingFlag(opening.id, 'blocked'))); refused(blockedCare, 'receive_here');
  });
});

describe('Leave the Camera Off', () => {
  const ready = (s: ScenarioDefinition, gear: string[] = []) => play(running(s, gear), ['ask_cal_first', 'relay_mina_adapt', 'ask_camera_off', 'withdraw_group_proposal']);
  it('keeps Mina’s agreement separate from Cal’s account, a stopped camera and physical access', () => {
    const s = find('protective', { camera_response: true, care_needed: false }); let state = decide(running(s), 'ask_cal_first');
    expect(state.activeRun!.flags).toContain(id(s, 'route_checked')); expect(state.activeRun!.knowledge[id(s, 'privacy')]).toBe('unknown');
    state = decide(state, 'relay_mina_adapt'); refused(state, 'agree_separate_conversation'); refused(state, 'withdraw_group_proposal');
    state = decide(state, 'ask_camera_off'); expect(state.activeRun!.flags).toContain(id(s, 'privacy_ready')); refused(state, 'meet_mina_outside');
    state = decide(state, 'withdraw_group_proposal'); expect(state.activeRun!.flags).toContain(id(s, 'group_proposal_withdrawn'));
    state = decide(state, 'meet_mina_outside'); refused(state, 'honor_next_step');
    expect(civilianOutcomeViews(s, state.activeRun!)[0].status).toBe('safe'); expect(currentStoryPrompt(s, state.activeRun!)).toContain('has not happened');
    state = decide(state, 'talk_separately');
    expect(currentStoryPrompt(s, state.activeRun!)).toContain('Mina has spoken privately');
    expect(state.activeRun!.history.at(-1)!.committed!.consequences.at(-1)).toContain('Complete that next step');
    state = decide(state, 'honor_next_step'); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('a faster private phone requires a working assigned unit and an actual participating negotiator', () => {
    const s = find('protective', { camera_response: true, care_needed: false }); const bare = running(s); expect(evaluate(bare, 'phone_mina_assess').eligible).toBe(false);
    const equipped = running(s, ['throw_phone']); expect(evaluate(equipped, 'phone_mina_assess').eligible).toBe(true);
    for (const change of [
      (v: GameState) => { v.units[unitId('throw_phone')].condition = 0; },
      (v: GameState) => { v.reservations = v.reservations.filter(r => r.itemId !== 'throw_phone'); },
      (v: GameState) => { for (const o of Object.values(v.officers)) o.certs = o.certs.filter(c => c !== 'crisis_negotiation'); },
    ]) { const changed = structuredClone(equipped); change(changed); expect(evaluate(changed, 'phone_mina_assess').eligible).toBe(false); }
    const phone = decide(equipped, 'phone_mina_assess'); const relay = decide(bare, 'relay_mina_assess'); expect(phone.activeRun!.clock).toBeLessThan(relay.activeRun!.clock);
    let state = play(phone, ['check_route', 'ask_camera_off', 'agree_separate_conversation', 'meet_mina_outside', 'talk_separately', 'honor_next_step']);
    expect(state.activeRun!.flags).not.toContain(id(s, 'cal_first')); expect(notes(state)).toContain('without undoing an earlier proposal'); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('observes camera refusal and only opens the exit after Cal actually moves and Mina agrees', () => {
    const s = find('protective', { camera_response: false }); let state = play(running(s), ['ask_cal_first', 'relay_mina_adapt', 'ask_camera_off']);
    expect(state.activeRun!.flags).not.toContain(id(s, 'privacy_ready')); refused(state, 'withdraw_group_proposal');
    const stopped = decide(state, 'ask_cal_wait_apart', 'adverse'); const partial = decide(stopped, 'adapt_partial'); expect(computeDebrief(partial, partial.activeRun!)!.completionAchieved).toBe(false);
    state = decide(state, 'ask_cal_wait_apart', 'mixed'); expect(state.activeRun!.flags).toContain(id(s, 'cal_waits_apart')); refused(state, 'ask_cal_wait_apart');
    state = play(state, ['withdraw_group_proposal', 'meet_mina_outside', 'talk_separately', 'honor_next_step']); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
  });

  it('repairs the specific account-sharing misunderstanding once, without forcing an exit after refusal', () => {
    const s = find('protective', { camera_response: true, care_needed: false }); const before = play(running(s), ['ask_cal_first', 'relay_mina_adapt', 'ask_camera_off']);
    let state = decide(before, 'withdraw_group_proposal', 'adverse'); refused(state, 'meet_mina_outside'); expect(currentStoryPrompt(s, state.activeRun!)).toContain('explain her account');
    state = decide(state, 'clarify_no_shared_account', 'mixed'); refused(state, 'clarify_no_shared_account');
    state = play(state, ['meet_mina_outside', 'talk_separately', 'honor_next_step']); expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    const failed = decide(decide(before, 'withdraw_group_proposal', 'adverse'), 'clarify_no_shared_account', 'adverse'); refused(failed, 'meet_mina_outside');
    const partial = decide(failed, 'resolve_partial'); expect(computeDebrief(partial, partial.activeRun!)!.completionAchieved).toBe(false); expect(s.endings[partial.activeRun!.endingId!].summary).toContain('Mina is still inside');
  });

  it('pauses a real doorway injury and permits reduced-team recovery without losing the officer’s care duty', () => {
    const s = find('protective', { camera_response: true, care_needed: true }); let state = ready(s, ['trauma_kit']);
    state = decide(state, 'meet_mina_outside', 'adverse'); const casualty = Object.values(state.activeRun!.officerCasualties!)[0];
    expect(casualty.care).toBe('needed'); expect(casualty.label).toBe('Fall at the doorway while meeting Mina'); expect(state.activeRun!.flags).not.toContain(id(s, 'mina_outside')); refused(state, 'meet_at_clear_doorway');
    state = decide(state, 'officer_aid'); refused(state, 'officer_aid'); state = decide(state, 'continue_remaining_team');
    state = play(state, ['meet_at_clear_doorway', 'talk_separately']); expect(state.activeRun!.history.at(-2)!.officerIds).not.toContain(casualty.officerId);
    refused(state, 'receive_mina'); state = decide(state, 'request_officer_crew'); expect(state.activeRun!.history.at(-1)!.committed!.consequences.join(' ')).not.toContain('Mina remains inside'); state = crew(state, 'wait_officer_crew', 'receive_officer');
    state = crew(state, 'wait_with_mina', 'receive_mina'); expect(computeDebrief(state, state.activeRun!)!).toMatchObject({ completionAchieved: true, disposition: 'care_accepted' });
    expect(civilianOutcomeViews(s, state.activeRun!)[0].status).toBe('care_accepted');
  });

  it('each incomplete ending names Mina’s actual place, completed conversation and outstanding duty', () => {
    const plain = find('protective', { camera_response: true, care_needed: false });
    const inside = decide(ready(plain), 'resolve_partial'); expect(plain.endings[inside.activeRun!.endingId!].summary).toContain('Mina is still inside');
    const outside = decide(ready(plain), 'meet_mina_outside');
    const unheard = decide(outside, 'resolve_partial'); expect(plain.endings[unheard.activeRun!.endingId!].summary).toContain('conversation promised before she left has not happened');
    const heard = decide(decide(outside, 'talk_separately'), 'resolve_partial'); expect(plain.endings[heard.activeRun!.endingId!].summary).toContain('chose to remain with the follow-up officer');
    const care = find('protective', { camera_response: true, care_needed: true });
    const pending = decide(play(ready(care), ['meet_mina_outside', 'talk_separately']), 'resolve_partial');
    expect(care.endings[pending.activeRun!.endingId!].summary).toContain('no receiving crew has accepted her care');
    expect(plain.endings[unheard.activeRun!.endingId!].remainingTasks).toEqual(['Complete the separate conversation Mina accepted', 'Complete any needed civilian care', 'Complete any outstanding officer care']);
    expect(computeDebrief(heard, heard.activeRun!)!.remainingTasks).toEqual(['Complete Mina’s chosen next step', 'Complete any outstanding officer care']);
    expect(computeDebrief(pending, pending.activeRun!)!.remainingTasks).toEqual(['Arrange accepted wrist assessment for Mina', 'Complete any outstanding officer care']);
    for (const state of [inside, unheard, heard, pending]) expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(false);
  });

  it('keeps private agreement from bypassing a blocked physical exit and does not replay rewarded decisions', () => {
    const s = find('protective', { camera_response: true, care_needed: false }); let state = ready(s);
    const route = s.story!.bindings.routes[scenarioActions(s).find(a => a.id === id(s, 'meet_mina_outside'))!.storyRoute!];
    const blockedOpenings = buildLocation(s.locationFamilyId, s.locationSeed).location.openings.filter(opening => opening.a === route.fromSpaceId || opening.b === route.fromSpaceId);
    const blocked = structuredClone(state); blocked.activeRun!.flags.push(...blockedOpenings.map(opening => openingFlag(opening.id, 'blocked'))); refused(blocked, 'meet_mina_outside');
    state = play(state, ['meet_mina_outside', 'talk_separately']); expect(state.activeRun!.objective).toBe(0); refused(state, 'talk_separately');
    state = decide(state, 'honor_next_step'); refused(state, 'honor_next_step'); expect(state.activeRun!.objective).toBe(100);
  });
});
