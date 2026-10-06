import { describe, expect, it } from 'vitest';
import { COURSES } from '../../content/courses';
import { ITEMS } from '../../content/items';
import { buildLocation } from '../../sim/location';
import { actionViews, spaceViews } from '../../sim/operation-selectors';
import { computeDebrief, matchedEffects, validateScenario } from '../../sim/operation';
import { bandFor, builtFor, conditionHolds, evaluateAction, openingFlag } from '../../sim/resolution';
import { hashSeed, next } from '../../sim/rng';
import { getScenario } from '../../sim/scenario-registry';
import { scenarioActions, type IncidentSpec, type ScenarioDefinition } from '../../sim/scenario-types';
import { apply, makeState, NOW, setRun, startRun } from '../../sim/test-fixtures';
import type { GameState, OutcomeBand } from '../../sim/types';
import { generateIncident, INCIDENT_CONTENT_VERSION, INCIDENT_TYPES_V2, incidentId, parseIncidentId } from './index';

const specFor = (type: IncidentSpec['type'], seed = 7, familyId = type === 'business_robbery' || type === 'burglary' ? 'market_row' : 'cedar_close'): IncidentSpec => ({ type, familyId, seed, buildingSeed: 7, tier: 2, contentVersion: 3 });
const findSpec = (type: IncidentSpec['type'], truth: Record<string, boolean>) => {
  for (let seed = 0; seed < 300; seed++) {
    const spec = specFor(type, seed);
    const s = generateIncident(spec);
    if (Object.entries(truth).every(([id, value]) => s.facts.find(f => f.id === id)?.truth === value)) return spec;
  }
  throw new Error('No matching deterministic fixture');
};
function running(spec: IncidentSpec, equipment: string[] = [], twoSquads = false) {
  const s = getScenario(incidentId(spec))!;
  const initial = makeState({ inventory: Object.fromEntries(equipment.map(id => [id, 2])) });
  const certs = Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : []);
  for (const officer of Object.values(initial.officers)) officer.certs = [...new Set(certs)];
  initial.incidents = [{ id: s.id, familyId: spec.familyId, type: spec.type, tier: spec.tier, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
  return startRun(initial, s.id, twoSquads ? ['A', 'B'] : ['A'], { positions: { A: entry, B: entry }, loadouts: { A: Object.fromEntries(equipment.map(id => [id, 1])), B: {} } });
}
function evaluate(state: GameState, actionId: string) {
  const run = state.activeRun!;
  const scenario = getScenario(run.scenarioId)!;
  const action = scenarioActions(scenario).find(a => a.id === actionId)!;
  return evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: run.squadIds.includes('B') && action.support ? ['B'] : [] });
}
function decide(state: GameState, actionId: string, band: OutcomeBand = 'favorable') {
  const ev = evaluate(state, actionId);
  expect(ev.eligible, `${actionId}: ${ev.reason}`).toBe(true);
  const prior = structuredClone(state);
  for (let seed = 1; seed < 100_000; seed++) if (bandFor(ev.margin, next(seed).value) === band) { prior.activeRun!.rngState = seed; break; }
  const command = { type: 'decide' as const, actionId, actingSquadIds: ['A'] as const, supportSquadIds: ev.support };
  const outcome = apply(prior, { ...command, actingSquadIds: [...command.actingSquadIds] });
  expect(outcome.result, actionId).toEqual({ ok: true });
  expect(outcome.state.activeRun!.history.at(-1)!.band).toBe(band);
  return outcome.state;
}
function play(state: GameState, ids: string[], band: OutcomeBand = 'favorable') {
  for (const id of ids) state = decide(state, id, band);
  return state;
}
const visible = (s: ScenarioDefinition, flags: string[], knowledge: Record<string, 'confirmed' | 'disproved' | 'reported'> = {}) => s.stages.adapt.actions.filter(a => conditionHolds(a.visibleWhen, { flags, knowledge, pressure: 0 })).map(a => a.id);

// Captured by exact deep comparison with frozen management checkout 5325b003.
// Keep these independent of the new content, including all supported families.
describe('issued version-two identity', () => {
  it('retains every home, business and specialist definition across five seeds', () => {
    const fingerprints = Object.fromEntries(INCIDENT_TYPES_V2.map(kind => [kind.type, hashSeed(JSON.stringify(kind.families.flatMap(familyId => [0, 1, 7, 42, 4294967295].map(seed => generateIncident({ type: kind.type, familyId, seed, buildingSeed: seed, tier: 1 + seed % 5, contentVersion: 2 })))))]));
    expect(fingerprints).toEqual({ welfare_check: 3550018130, disturbance: 1996080774, medical_complication: 874859916, burglary: 3574155507, false_intruder: 3462115874, barricaded: 2027357775, business_robbery: 3401928693 });
  });
});

describe('bounded version-three families', () => {
  it('validates deterministic authored references, all outcome metadata, and integrated power', () => {
    expect(INCIDENT_CONTENT_VERSION).toBe(12);
    expect(parseIncidentId(incidentId({ ...specFor('welfare_check'), contentVersion: INCIDENT_CONTENT_VERSION + 1 }))).toBeNull();
    for (const kind of INCIDENT_TYPES_V2) for (const family of kind.families) for (const seed of [0, 1, 7, 42]) {
      const spec = { ...specFor(kind.type, seed, family), buildingSeed: seed };
      const s = generateIncident(spec);
      expect(s.version).toBe(3);
      expect(generateIncident(spec)).toEqual(s);
      expect(validateScenario(s, buildLocation(family, seed)), s.id).toEqual([]);
      expect(s.stages.assess.actions.length).toBeGreaterThanOrEqual(3);
      expect(s.stages.assess.actions.length).toBeLessThanOrEqual(5);
      for (const action of scenarioActions(s)) {
        expect(action.outcomePreview).toEqual({ favorable: expect.any(String), mixed: expect.any(String), adverse: expect.any(String) });
        expect(['low', 'moderate', 'high']).toContain(action.consequenceLevel);
        expect(action.requires.notFlags).toContainEqual({ flag: `used:${action.id}`, reason: 'This step has already been attempted' });
        expect(action.visibleWhen?.notFlags).toContain(`used:${action.id}`);
        expect(action.consumes?.some(c => c.tag === 'battery')).not.toBe(true);
        for (const band of Object.values(action.outcomes)) {
          expect(band[0].setFlags).toContain(`used:${action.id}`);
          for (const effect of band) if (!effect.ending) expect(effect.objective ?? 0).toBe(0);
        }
      }
    }
  });

  it('shows at most five protective preparation choices as physical access and inspection replace checks', () => {
    const s = generateIncident(specFor('barricaded'));
    for (const flags of [[], ['protect_context_checked'], ['protect_context_checked', 'protect_opening_ready'], ['protect_route_ready', 'protect_route_reached', 'protect_opening_ready'], ['protect_context_checked', 'protect_route_ready', 'protect_route_reached', 'protect_opening_ready']]) {
      const choices = visible(s, flags);
      expect(choices.length, choices.join(', ')).toBeLessThanOrEqual(5);
      expect(choices.length).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(['welfare_check', 'medical_complication', 'barricaded'] as const)('%s previews and visible markers never reveal hidden truth', type => {
    const state = running(specFor(type));
    const s = getScenario(state.activeRun!.scenarioId)!;
    const priorFacts = structuredClone(s.facts);
    const before = { actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) };
    try {
      for (const f of s.facts) { f.truth = !f.truth; if (f.person) f.person.at = { x: -999, y: 999 }; }
      expect({ actions: actionViews(state, NOW, 'A'), spaces: spaceViews(state) }).toEqual(before);
    } finally { s.facts = priorFacts; }
  });

  it('gives uncertainty checks a visible verification link and refuses one-shot farming', () => {
    let state = running(specFor('welfare_check'));
    const fact = spaceViews(state).flatMap(v => v.facts).find(f => f.id === 'f_person')!;
    expect(fact.verifyActions.some(a => a.actionId === 'v3_welfare_contact')).toBe(true);
    state = play(state, ['v3_welfare_timeline', 'v3_welfare_reconcile']);
    expect(state.activeRun!.objective).toBe(0);
    const prior = structuredClone(state);
    const repeated = apply(state, { type: 'decide', actionId: 'v3_welfare_reconcile', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(repeated.result.ok).toBe(false);
    expect(repeated.state).toBe(state);
    expect(state).toEqual(prior);
  });
});

describe('uncertain report and welfare outcomes', () => {
  it.each([
    [false, false, 'v3_welfare_close', 'report_disproved'],
    [true, false, 'v3_welfare_voluntary', 'voluntary_resolution'],
    [true, true, 'v3_welfare_assist', 'aid_completed'],
  ] as const)('presence=%s need=%s leads to an honest %s ending', (present, need, completion, ending) => {
    const spec = findSpec('welfare_check', { f_person: present, f_context: need });
    let state = play(running(spec), ['v3_welfare_contact', 'v3_welfare_reconcile']);
    if (present && !need) state = decide(state, 'v3_welfare_agreement');
    if (need) state = decide(state, 'v3_welfare_prepare');
    state = play(state, ['v3_welfare_proceed', completion]);
    expect(state.activeRun!.endingId).toBe(ending);
    expect(state.activeRun!.objective).toBe(100);
    expect(state.activeRun!.knowledge.f_person).toBe(present ? 'confirmed' : 'disproved');
    expect(state.activeRun!.knowledge.f_context).toBe(need ? 'confirmed' : 'disproved');
    expect(computeDebrief(state, state.activeRun!)!.endingTitle).toBe(getScenario(state.activeRun!.scenarioId)!.endings[ending].title);
  });

  it('gives prepared visits a real check benefit and avoids their four-minute/three-safety penalty', () => {
    const state = setRun(running(specFor('welfare_check')), { stage: 'resolve', pressure: 0 });
    const ready = setRun(state, { flags: ['welfare_visit_ready'] });
    expect(evaluate(ready, 'v3_welfare_visit').score - evaluate(state, 'v3_welfare_visit').score).toBeCloseTo(8);
    const a = decide(state, 'v3_welfare_visit');
    const b = decide(ready, 'v3_welfare_visit');
    expect(a.activeRun!.history[0].timeCost - b.activeRun!.history[0].timeCost).toBe(4);
    expect(b.activeRun!.civilianSafety - a.activeRun!.civilianSafety).toBe(3);
  });

  it('lets an adverse visit recover without inventing an assistance need for a safe person', () => {
    const spec = findSpec('welfare_check', { f_person: true, f_context: false });
    let state = setRun(running(spec), { stage: 'resolve', pressure: 0 });
    state = decide(state, 'v3_welfare_visit', 'adverse');
    expect(state.activeRun!.status).toBe('active');
    expect(actionViews(state, NOW, 'A').some(a => a.id === 'v3_welfare_recover')).toBe(true);
    state = decide(state, 'v3_welfare_recover');
    expect(state.activeRun!.endingId).toBe('voluntary_resolution');
    expect(state.activeRun!.knowledge.f_context).toBe('disproved');
  });
});

describe('time-sensitive assistance plans', () => {
  const prepare = (spec: IncidentSpec, equipment: string[] = []) => play(running(spec, equipment), ['assist_alert_care', 'assist_locate_person', 'assist_check_needs', 'assist_prepare_access', 'assist_commit_plan']);
  it.each(['assist_qualified_aid', 'assist_protected_transfer', 'assist_informed_handover'])('completes %s with equal objective credit for a complete suitable plan', actionId => {
    const spec = findSpec('medical_complication', { f_assist_transfer_possible: true });
    const state = decide(prepare(spec, ['trauma_kit']), actionId);
    expect(state.activeRun!.objective).toBe(100);
    expect(state.activeRun!.status).toBe('debrief');
    expect(state.activeRun!.endingId).toBe(({ assist_qualified_aid: 'aid_completed', assist_protected_transfer: 'protected_transfer', assist_informed_handover: 'informed_handover' } as Record<string, string>)[actionId]);
    if (actionId === 'assist_qualified_aid') expect(state.activeRun!.history.at(-1)!.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
  });

  it('rules out unsuitable transfers and uses qualified aid or a checked handover instead', () => {
    const spec = findSpec('medical_complication', { f_assist_transfer_possible: false });
    let state = prepare(spec);
    expect(evaluate(state, 'assist_protected_transfer').eligible).toBe(false);
    state = decide(state, 'assist_informed_handover');
    expect(state.activeRun!.endingId).toBe('informed_handover');
  });

  it('retains mixed assistance as an open need, consumes the kit once and recovers to a suitable transfer', () => {
    const spec = findSpec('medical_complication', { f_assist_transfer_possible: true });
    let state = decide(prepare(spec, ['trauma_kit']), 'assist_qualified_aid', 'mixed');
    expect(state.activeRun!.status).toBe('active');
    expect(state.activeRun!.objective).toBe(0);
    expect(state.activeRun!.history.at(-1)!.itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
    state = decide(state, 'assist_rebuild_plan');
    state = decide(state, 'assist_protected_transfer');
    expect(state.activeRun!.endingId).toBe('protected_transfer');
    expect(state.activeRun!.history.flatMap(h => h.itemsConsumed).filter(c => c.itemId === 'trauma_kit')).toHaveLength(1);
  });
});

describe('protective preparation, setbacks and equipment context', () => {
  it.each(['medical_complication', 'barricaded'] as const)('%s cannot turn exterior staging into a physical transfer bypass', type => {
    const state = setRun(running(specFor(type)), { stage: 'adapt' });
    const s = getScenario(state.activeRun!.scenarioId)!;
    const built = buildLocation(s.locationFamilyId, s.locationSeed);
    const target = s.facts[0].spaceId;
    const blocked = built.location.openings.filter(o => o.a === target || o.b === target).map(o => openingFlag(o.id, 'blocked'));
    const isolated = setRun(state, { flags: blocked });
    const prepId = type === 'medical_complication' ? 'assist_prepare_access' : 'v3_protect_route';
    const transferId = type === 'medical_complication' ? 'assist_protected_transfer' : 'v3_protect_transfer';
    expect(evaluate(isolated, prepId).eligible).toBe(false);
    const terminal = setRun(isolated, { stage: 'resolve', knowledge: { f_person: 'confirmed' }, flags: type === 'medical_complication' ? ['assist_access_ready', 'assist_care_ready'] : ['protect_route_ready'] });
    expect(evaluate(terminal, transferId).eligible).toBe(false);
    expect(evaluate(terminal, transferId).reason).toContain('physical route');
  });

  it('lets a checked alternative route handle an unsuitable reported exit and gives cover a real safety benefit', () => {
    const spec = findSpec('barricaded', { f_adjacent_safety: false });
    let state = play(running(spec), ['v3_protect_initial_check', 'v3_protect_route', 'v3_protect_proceed']);
    expect(state.activeRun!.knowledge.f_adjacent_safety).toBe('disproved');
    const covered = setRun(state, { flags: ['protect_cover_ready', 'protect_receiver_ready'], pressure: 0 });
    state = setRun(state, { pressure: 0 });
    const bare = decide(state, 'v3_protect_transfer', 'mixed');
    const safe = decide(covered, 'v3_protect_transfer', 'mixed');
    expect(safe.activeRun!.endingId).toBe('protected_transfer');
    expect(safe.activeRun!.civilianSafety - bare.activeRun!.civilianSafety).toBe(4);
    expect(bare.activeRun!.history.at(-1)!.timeCost - safe.activeRun!.history.at(-1)!.timeCost).toBe(4);
  });

  it('keeps an adverse protected transfer open, then permits an informed recovery handover', () => {
    let state = play(running(specFor('barricaded')), ['v3_protect_coordinate', 'v3_protect_route', 'v3_protect_proceed']);
    state = decide(state, 'v3_protect_transfer', 'adverse');
    expect(state.activeRun!.status).toBe('active');
    expect(state.activeRun!.objective).toBe(0);
    state = decide(state, 'v3_protect_regroup');
    expect(state.activeRun!.endingId).toBe('informed_handover');
  });

  it('keeps qualified success credit equal to ordinary completion and names its actual outcome', () => {
    const completed = new Set<string>();
    for (let seed = 0; seed < 90 && completed.size < 3; seed++) {
      const spec = specFor('barricaded', seed);
      const s = generateIncident(spec);
      if (!s.facts.find(f => f.id === 'f_adjacent_safety')!.truth) continue;
      const option = s.stages.resolve.actions.find(a => a.id === 'v3_protect_qualified')!;
      const rule = option.capabilities!.required![0];
      if (completed.has(rule)) continue;
      const tags = [...option.requires.allTags!, ...(option.consumes ?? []).map(c => c.tag)];
      const ids = tags.map(tag => Object.values(ITEMS).find(item => item.tags.includes(tag))!.id);
      let state = setRun(running(spec, ids, true), { stage: 'resolve', pressure: 0, knowledge: { f_person: 'confirmed', f_adjacent_safety: 'confirmed' }, positions: { A: s.facts[0].spaceId }, flags: buildLocation(s.locationFamilyId, s.locationSeed).location.openings.filter(o => o.type === 'door').map(o => openingFlag(o.id, 'open')) });
      // Some generated rooms have an obstructed view even after access. Preserve
      // that real counter and find a different valid scenario for each class.
      if (!evaluate(state, 'v3_protect_qualified').eligible) continue;
      state = decide(state, 'v3_protect_qualified');
      completed.add(rule);
      expect(state.activeRun!.endingId).toBe('protective_resolution');
      expect(state.activeRun!.objective).toBe(100);
      for (const c of option.consumes ?? []) expect(state.activeRun!.history[0].itemsConsumed).toContainEqual({ itemId: Object.values(ITEMS).find(i => i.tags.includes(c.tag))!.id, qty: c.qty });
    }
    expect(completed).toEqual(new Set(['specialist_support', 'less_lethal_device', 'less_lethal_impact']));
  });

  it('cannot arrange welfare access through a physically blocked door', () => {
    const state = setRun(running(specFor('welfare_check')), { stage: 'adapt' });
    const s = getScenario(state.activeRun!.scenarioId)!;
    const prepare = s.stages.adapt.actions.find(a => a.id === 'v3_welfare_prepare')!;
    const openingId = prepare.requires.openings![0].openingId;
    const blocked = setRun(state, { flags: [openingFlag(openingId, 'blocked')] });
    expect(evaluate(blocked, prepare.id).eligible).toBe(false);
    const result = apply(blocked, { type: 'decide', actionId: prepare.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(result.result.ok).toBe(false);
    expect(result.state).toBe(blocked);
  });

  it('makes qualified access unlock an opening, never fabricate full-route readiness', () => {
    const s = generateIncident(specFor('barricaded'));
    const access = s.stages.adapt.actions.find(a => a.id === 'v3_protect_access')!;
    const run = { flags: ['protect_context_checked'], knowledge: { f_person: 'confirmed' as const, f_adjacent_safety: 'confirmed' as const }, pressure: 0 };
    const flags = matchedEffects(access, 'favorable', run, s).flatMap(e => e.setFlags ?? []);
    expect(flags).toContain('protect_opening_ready');
    expect(flags).not.toContain('protect_route_ready');
    expect(flags).not.toContain('protect_route_reached');
    expect(access.approach).toBe('path');
    expect(s.stages.adapt.actions.find(a => a.id === 'v3_protect_inspect')!.consumes).toBeUndefined();
  });
});
