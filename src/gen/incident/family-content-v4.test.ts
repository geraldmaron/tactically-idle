import { describe, expect, it } from 'vitest';
import { DECISION_EXERCISES, LEGACY_DECISION_EXERCISES } from '../../content/scenarios/decision-exercises';
import { createInitialState } from '../../sim/department';
import { buildLocation } from '../../sim/location';
import { actionViews, briefing, pendingDebrief, spaceViews, stageContinuations } from '../../sim/operation-selectors';
import { matchedEffects, validateScenario } from '../../sim/operation';
import { bandFor, builtFor, evaluateAction, openingFlag } from '../../sim/resolution';
import { hashSeed, next } from '../../sim/rng';
import { externalSupportStatus, externalSupportViews } from '../../sim/external-support';
import { getScenario } from '../../sim/scenario-registry';
import { scenarioActions, type IncidentSpec } from '../../sim/scenario-types';
import { apply, makeState, NOW, setRun, startRun } from '../../sim/test-fixtures';
import { deserialize, serialize } from '../../sim/save';
import type { GameState, OutcomeBand } from '../../sim/types';
import { drawIncidentSpec, generateIncident, HIGH_RISK_TYPES_V4, INCIDENT_TYPES_V2, INCIDENT_TYPES_V4, incidentId, parseIncidentId } from './index';
import { premiseForV4, V4_PREMISES } from './premises-v4';

const specFor = (type: IncidentSpec['type'], seed = 7, familyId = ['business_robbery', 'burglary'].includes(type) ? 'market_row' : 'cedar_close'): IncidentSpec => ({ type, familyId, seed, buildingSeed: 7, tier: 2, contentVersion: 4 });
function findSpec(type: IncidentSpec['type'], predicate: (s: ReturnType<typeof generateIncident>) => boolean, premise?: string) {
  for (let seed = 0; seed < 1000; seed++) { const spec = specFor(type, seed); if ((!premise || premiseForV4(spec).id === premise) && predicate(generateIncident(spec))) return spec; }
  throw new Error('No matching fixture');
}
const truth = (s: ReturnType<typeof generateIncident>, id: string) => s.facts.find(f => f.id === id)!.truth;
function running(spec: IncidentSpec, realCampaign = false, equipment: Record<string, number> = {}) {
  const s = getScenario(incidentId(spec))!;
  const initial = realCampaign ? createInitialState(NOW, 41) : makeState();
  initial.incidents = [{ id: s.id, familyId: spec.familyId, type: spec.type, tier: spec.tier, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
  return startRun(initial, s.id, ['A'], { positions: { A: entry }, loadouts: { A: equipment } });
}
function evaluate(state: GameState, id: string) {
  const run = state.activeRun!; const scenario = getScenario(run.scenarioId)!; const action = scenarioActions(scenario).find(a => a.id === id)!;
  return evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
}
function decide(state: GameState, id: string, band: OutcomeBand = 'favorable', reload = false) {
  const ev = evaluate(state, id); expect(ev.eligible, `${id}: ${ev.reason}`).toBe(true);
  const prior = structuredClone(state);
  let found = false;
  for (let seed = 1; seed < 100_000; seed++) if (bandFor(ev.margin, next(seed).value) === band) { prior.activeRun!.rngState = seed; found = true; break; }
  expect(found, `${id}: no ${band} fixture`).toBe(true);
  const nextState = apply(prior, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(nextState.result, id).toEqual({ ok: true });
  expect(nextState.state.activeRun!.history.at(-1)!.band).toBe(band);
  // Synthetic RNG steering is not a save-valid history after the first decision.
  // Real non-steered save/reload coverage is exercised by the policy sweep below.
  if (reload) expect(deserialize(serialize(nextState.state, NOW))).not.toBeNull();
  return nextState.state;
}
function play(state: GameState, ids: string[]) { for (const id of ids) state = decide(state, id); return state; }
function careReady(spec: IncidentSpec) {
  let state = play(running(spec), ['v4_source', 'v4_verify', 'v4_agreement', 'v4_proceed']);
  state = decide(state, 'v4_care_plan');
  const s = getScenario(state.activeRun!.scenarioId)!; const service = s.externalServices!.find(x => x.id === s.endings.care_accepted.completion!.acceptedServiceId)!;
  if (externalSupportStatus(state.activeRun!, service) === 'requested') state = decide(state, 'v4_await_care');
  return decide(state, 'v4_care_access');
}

describe('version-four varied responsibilities', () => {
  it('preserves all issued v3 definitions against the independently captured ae6fd42d tree', () => {
    const fingerprints = Object.fromEntries(INCIDENT_TYPES_V2.map(kind => [kind.type, hashSeed(JSON.stringify(kind.families.flatMap(familyId => [0, 1, 7, 42, 4294967295].map(seed => generateIncident({ type: kind.type, familyId, seed, buildingSeed: seed, tier: 1 + seed % 5, contentVersion: 3 })))))]));
    expect(fingerprints).toEqual({ welfare_check: 1493051428, disturbance: 815940444, medical_complication: 2092413907, burglary: 3733123870, false_intruder: 2862221726, barricaded: 868588356, business_robbery: 2996275413 });
  });

  it('validates every base type, building and premise with explicit deployment and completion contracts', () => {
    const observed = new Set<string>();
    for (const kind of INCIDENT_TYPES_V2) for (const family of kind.families) for (const seed of [0, 1, 2, 3, 5, 9, 12, 13]) {
      const spec = specFor(kind.type, seed, family); const s = generateIncident(spec);
      observed.add(premiseForV4(spec).id);
      expect(generateIncident(spec)).toEqual(s);
      expect(validateScenario(s, buildLocation(family, 7)), s.id).toEqual([]);
      expect(s.briefing.dispatchReason).toMatch(/SWAT|team/i);
      expect(s.briefing.teamResponsibilities!.length).toBeGreaterThanOrEqual(2);
      expect(s.briefing.dispatchReason).toMatch(/threat|violent|violence/i);
      for (const ending of Object.values(s.endings)) expect(ending.disposition).toBeDefined();
      for (const a of scenarioActions(s)) {
        expect(a.visibleWhen?.notFlags).toContain(`used:${a.id}`);
        for (const effects of Object.values(a.outcomes)) {
          expect(effects[0].setFlags).toContain(`used:${a.id}`);
          if (effects.some(e => e.requestSupport?.length)) expect(effects.some(e => e.ending || e.objective)).toBe(false);
          for (const e of effects) if (!e.ending) expect(e.objective ?? 0).toBe(0);
        }
      }
    }
    expect(observed).toEqual(new Set(V4_PREMISES.map(p => p.id)));
  }, 20_000);
  it('preserves the old draw stream and adds the three higher-risk patterns only to v4', () => {
    let oldState = 12345; const oldDraws = [];
    for (let i = 0; i < 200; i++) { const draw = drawIncidentSpec(oldState, { level: 5, trust: 80, contentVersion: 3 }); oldDraws.push(draw); oldState = draw.state; }
    expect(hashSeed(JSON.stringify(oldDraws))).toBe(2013611994);
    let state = 12345; const types = new Set<string>();
    for (let i = 0; i < 300; i++) { const draw = drawIncidentSpec(state, { level: 5, trust: 80, contentVersion: 4 }); types.add(draw.spec.type); expect(parseIncidentId(incidentId(draw.spec))).toEqual(draw.spec); state = draw.state; }
    expect(types).toEqual(new Set(INCIDENT_TYPES_V4.map(type => type.type)));
    for (const type of HIGH_RISK_TYPES_V4) for (const version of [1, 2, 3]) expect(parseIncidentId(incidentId({ ...specFor(type), contentVersion: version }))).toBeNull();
    for (const type of HIGH_RISK_TYPES_V4) {
      const spec = { ...specFor(type), familyId: 'maple_street' };
      expect(parseIncidentId(incidentId(spec))).toBeNull();
      expect(() => generateIncident(spec)).toThrow('Invalid incident specification');
    }
  });
  it('retains issued v3 and v4 practice IDs while exposing the current stories', () => {
    for (const exercise of LEGACY_DECISION_EXERCISES) expect(getScenario(exercise.id)?.version).toBe(exercise.spec.contentVersion);
    for (const exercise of DECISION_EXERCISES) expect(getScenario(exercise.id)?.version).toBe(exercise.spec.contentVersion);
  });
  it.each(['welfare_check', 'medical_complication', 'barricaded'] as const)('%s hides truth from briefing, branch visibility, support ETA and evaluation', type => {
    const state = running(specFor(type)); const s = getScenario(state.activeRun!.scenarioId)!; const facts = structuredClone(s.facts);
    const before = { briefing: briefing(s.id), actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state), services: externalSupportViews(s, state.activeRun!) };
    try { for (const f of s.facts) { f.truth = !f.truth; if (f.person && f.initial !== 'confirmed') f.person.at = { x: -999, y: 999 }; }
      expect({ briefing: briefing(s.id), actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state), services: externalSupportViews(s, state.activeRun!) }).toEqual(before);
    } finally { s.facts = facts; }
  });
  it('allows an early verified false report to close without a handover or forced setback', () => {
    const spec = findSpec('welfare_check', s => !truth(s, 'f_person'), 'conflicting_intruder');
    let state = play(running(spec), ['v4_source', 'v4_prepare']);
    expect(state.activeRun!.knowledge.f_person).toBe('disproved');
    state = decide(state, 'v4_close_report_early');
    expect(state.activeRun!.endingId).toBe('report_disproved');
    expect(state.activeRun!.history).toHaveLength(3);
    expect(pendingDebrief(state)).toMatchObject({ completionAchieved: true, disposition: 'resolved', objective: { score: 100 } });
  });
  it('completes a voluntary next step without inventing clinical care', () => {
    const spec = findSpec('welfare_check', s => truth(s, 'f_person') && !truth(s, 'f_care_needed') && !truth(s, 'f_immediate_danger'), 'welfare_after_threat');
    const state = play(running(spec), ['v4_contact', 'v4_verify', 'v4_prepare', 'v4_agreement', 'v4_proceed', 'v4_followup']);
    expect(pendingDebrief(state)).toMatchObject({ completionAchieved: true, disposition: 'followup_agreed', objective: { score: 100 } });
    expect(state.activeRun!.externalSupport).toEqual({});
  });
  it.each(['welfare_check', 'medical_complication', 'barricaded'] as const)('%s awards full completion for actual accepted care', type => {
    const spec = findSpec(type, s => truth(s, 'f_person') && truth(s, 'f_care_needed') && !truth(s, 'f_immediate_danger') && s.externalServices!.some(x => x.available));
    const state = decide(careReady(spec), 'v4_transfer_care');
    expect(state.activeRun!.endingId).toBe('care_accepted');
    expect(pendingDebrief(state)).toMatchObject({ completionAchieved: true, disposition: 'care_accepted', objective: { score: 100 } });
    expect(pendingDebrief(state)!.receivingService!.kind).toBe('paramedics');
    expect(pendingDebrief(state)!.devPointReward).toBeGreaterThan(0);
  });
  it('makes optional first aid use the real qualified team and one kit to reduce pressure', () => {
    const spec = findSpec('medical_complication', s => truth(s, 'f_care_needed') && !truth(s, 'f_immediate_danger'), 'care_during_response');
    const bare = play(running(spec), ['v4_source', 'v4_verify']);
    expect(evaluate(bare, 'v4_prepare').eligible).toBe(false);
    let equipped = play(running(spec, false, { trauma_kit: 1 }), ['v4_source', 'v4_verify']);
    const before = equipped.activeRun!.pressure;
    equipped = decide(equipped, 'v4_prepare');
    expect(equipped.activeRun!.history.at(-1)!.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
    expect(equipped.activeRun!.pressure).toBeLessThan(before);
    expect(equipped.activeRun!.objective).toBe(0);
    expect(equipped.activeRun!.status).toBe('active');
  });
  it('supports early requests without requesting the crew a second time', () => {
    const spec = findSpec('medical_complication', s => truth(s, 'f_care_needed') && !truth(s, 'f_immediate_danger') && s.externalServices!.some(x => x.available));
    let state = play(running(spec), ['v4_assess_request_care', 'v4_verify', 'v4_agreement', 'v4_proceed']);
    expect(state.activeRun!.objective).toBe(0);
    const requestedAt = Object.values(state.activeRun!.externalSupport!)[0].requestedAt;
    state = decide(state, 'v4_care_plan_requested');
    expect(Object.values(state.activeRun!.externalSupport!)[0].requestedAt).toBe(requestedAt);
    expect(state.activeRun!.status).toBe('active');
    expect(state.activeRun!.objective).toBe(0);
  });
  it('uses one exact remaining wait, refuses replay and does not reward the request or wait', () => {
    const spec = findSpec('medical_complication', s => truth(s, 'f_care_needed') && s.externalServices!.some(x => x.available), 'aftercare_delay');
    let state = play(running(spec), ['v4_source', 'v4_verify', 'v4_proceed', 'v4_care_plan']);
    const support = state.activeRun!.externalSupport!.district_paramedics;
    const remaining = Math.round((support.availableAt! - state.activeRun!.clock) * 10) / 10;
    state = decide(state, 'v4_await_care');
    expect(state.activeRun!.history.at(-1)!.timeCost).toBe(remaining);
    expect(state.activeRun!.objective).toBe(0);
    const again = apply(state, { type: 'decide', actionId: 'v4_await_care', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(again.result.ok).toBe(false); expect(again.state).toBe(state);
  });
  it('keeps unavailable care honest even with intact safety', () => {
    const spec = findSpec('medical_complication', s => truth(s, 'f_care_needed') && !truth(s, 'f_immediate_danger') && s.externalServices!.every(x => !x.available));
    let state = play(running(spec), ['v4_source', 'v4_verify', 'v4_proceed', 'v4_care_plan']);
    expect(evaluate(state, 'v4_await_care').eligible).toBe(false);
    expect(evaluate(state, 'v4_transfer_care').eligible).toBe(false);
    state = setRun(state, { pressure: 0 });
    state.activeRun!.civilianSafety = 100;
    state = decide(state, 'v4_record_care_pending');
    expect(pendingDebrief(state)).toMatchObject({ completionAchieved: false, disposition: 'relief_partial', objective: { score: 30 }, civilianSafety: { score: 100 } });
    expect(pendingDebrief(state)!.devPointReward).toBeLessThan(generateIncident(spec).rewards.devPoints);
  });
  it('refuses acceptance through a blocked physical access route and preserves an honest ending', () => {
    const spec = findSpec('medical_complication', s => truth(s, 'f_care_needed') && !truth(s, 'f_immediate_danger') && s.externalServices!.some(x => x.available));
    let state = play(running(spec), ['v4_source', 'v4_verify', 'v4_agreement', 'v4_proceed', 'v4_care_plan']);
    const s = getScenario(state.activeRun!.scenarioId)!; const access = scenarioActions(s).find(a => a.id === 'v4_care_access')!;
    const opening = access.requires.openings![0].openingId;
    state = setRun(state, { flags: [openingFlag(opening, 'blocked')] });
    expect(evaluate(state, access.id).eligible).toBe(false);
    expect(evaluate(state, 'v4_transfer_care').eligible).toBe(false);
    state = decide(state, 'v4_record_care_pending');
    expect(pendingDebrief(state)!.completionAchieved).toBe(false);
  });
  it('reassesses a protective setback without ending it or discarding preparation, then offers a new choice', () => {
    const spec = findSpec('barricaded', s => truth(s, 'f_person') && !truth(s, 'f_care_needed'), 'barricade_dialogue');
    let state = play(running(spec), ['v4_contact', 'v4_verify', 'v4_prepare', 'v4_agreement', 'v4_proceed']);
    state = decide(state, 'v4_complete_plan', 'adverse');
    expect(state.activeRun!.status).toBe('active');
    const preparation = state.activeRun!.flags.filter(x => !x.startsWith('used:'));
    state = decide(state, 'v4_reassess');
    expect(state.activeRun!.status).toBe('active'); expect(state.activeRun!.objective).toBe(0);
    for (const flag of preparation) expect(state.activeRun!.flags).toContain(flag);
    expect(actionViews(state, NOW, 'A').find(x => x.id === 'v4_revised_plan')?.eligible).toBe(true);
    expect(actionViews(state, NOW, 'A').some(x => x.id === 'v4_complete_plan')).toBe(false);
    state = decide(state, 'v4_revised_plan');
    expect(pendingDebrief(state)).toMatchObject({ completionAchieved: true, disposition: 'resolved' });
  });
  it('never treats a usable exit as proof of immediate danger', () => {
    const s = generateIncident(specFor('barricaded'));
    expect(s.facts.find(x => x.id === 'f_adjacent_safety')!.label).toBe('The proposed exit is usable');
    expect(s.facts.find(x => x.id === 'f_immediate_danger')!.label).toBe('People face an immediate threat at the scene');
    const action = scenarioActions(s).find(x => x.id === 'v4_verify')!;
    const effects = matchedEffects(action, 'favorable', { flags: [], knowledge: {}, pressure: 0 }, s);
    const expectedSafe = !truth(s, 'f_immediate_danger');
    expect(effects.some(e => e.setFlags?.includes('v4_care_safe'))).toBe(expectedSafe);
  });
  it('keeps visible choices bounded and terminates many real low-resource, save-restored policies', () => {
    const encountered = new Set<string>();
    for (const type of ['welfare_check', 'medical_complication', 'barricaded'] as const) for (let seed = 0; seed < 18; seed++) for (const policy of [0, 1, 2]) {
      const spec = specFor(type, seed); encountered.add(premiseForV4(spec).id);
      let state = running(spec, true);
      for (let step = 0; step < 30 && state.activeRun?.status === 'active'; step++) {
        const choices = actionViews(state, NOW, 'A');
        expect(choices.length, `${type}:${seed}:${policy}:${state.activeRun!.stage} ${choices.map(a => a.id)}`).toBeLessThanOrEqual(5);
        const eligible = choices.filter(a => a.eligible);
        const continuation = stageContinuations(state)[0];
        if (!eligible.length && continuation) {
          const result = apply(state, { type: 'continueStage', actionId: continuation.actionId, revision: continuation.revision });
          expect(result.result).toEqual({ ok: true });
          state = deserialize(serialize(result.state, NOW))!;
          expect(state).not.toBeNull();
          continue;
        }
        expect(eligible.length, `${type}:${seed}:${state.activeRun!.stage}`).toBeGreaterThan(0);
        const a = eligible[policy === 0 ? 0 : policy === 1 ? eligible.length - 1 : (seed + step) % eligible.length];
        const result = apply(state, { type: 'decide', actionId: a.id, actingSquadIds: ['A'], supportSquadIds: [] });
        expect(result.result).toEqual({ ok: true }); state = result.state;
        const restored = deserialize(serialize(state, NOW)); expect(restored, `${type}:${seed}:${a.id}`).not.toBeNull(); state = restored!;
      }
      expect(state.activeRun!.status, `${type}:${seed}:${policy}`).toBe('debrief');
      expect(new Set(state.activeRun!.history.map(d => d.actionId)).size).toBe(state.activeRun!.history.length);
    }
    expect(encountered.size).toBe(9);
  }, 30_000);
});
