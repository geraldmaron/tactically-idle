import { afterEach, describe, expect, it, vi } from 'vitest';
import publishedV5 from './fixtures/published-v5-scenario-hashes.json';
import { generateIncident, INCIDENT_TYPES_V5, parseIncidentId, drawIncidentSpec } from '../gen/incident';
import { buildLocation } from './location';
import { validateScenario, computeDebrief } from './operation';
import { actionViews, briefing, spaceViews } from './operation-selectors';
import { scenarioActions, type IncidentSpec, type ScenarioDefinition } from './scenario-types';
import { deserialize, serialize } from './save';
import { hashSeed } from './rng';
import { builtFor, evaluateAction } from './resolution';
import { createInitialState } from './department';
import { apply, NOW, startCmd } from './test-fixtures';
import type { GameState } from './types';
const overrides = vi.hoisted(() => new Map<string, ScenarioDefinition>());
vi.mock('./scenario-registry', async original => {
  const real = await original<typeof import('./scenario-registry')>();
  return { ...real, getScenario: (id: string) => overrides.get(id) ?? real.getScenario(id) };
});
afterEach(() => overrides.clear());
const scenario = (type: IncidentSpec['type'], seed: number, familyId = 'cedar_close', buildingSeed = 7) => generateIncident({ type, seed, familyId, buildingSeed, tier: 1, contentVersion: 6 });
function start(s: ScenarioDefinition): GameState {
  const state = createInitialState(NOW, 719);
  state.incidents = [{ id: s.id, type: s.incident!.type, familyId: s.locationFamilyId, tier: 1, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  overrides.set(s.id, s);
  const started = apply(state, startCmd(s.id, ['A'], { positions: { A: buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0] }, loadouts: { A: {} } }));
  expect(started.result).toEqual({ ok: true }); return started.state;
}
function commit(state: GameState, suffix: string): GameState | null {
  const s = overrides.get(state.activeRun!.scenarioId)!;
  const a = scenarioActions(s).find(a => a.id.endsWith(suffix))!;
  const run = state.activeRun!;
  if (run.status !== 'active') return null;
  const ev = evaluateAction({ state, run, scenario: s, action: a, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
  if (!ev.eligible) return null;
  const result = apply(state, { type: 'decide', actionId: a.id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  const loaded = deserialize(serialize(result.state, NOW));
  expect(loaded, `${suffix}: valid natural sample history`).not.toBeNull();
  expect(loaded!.activeRun).toEqual(result.state.activeRun);
  return loaded!;
}
/** Find a reproducible positive fixture, then retain its natural RNG stream at every step. */
function positiveJourney(s: ScenarioDefinition, path: string[]): GameState {
  for (let seed = 1; seed < 100; seed++) {
    let state: GameState | null = start(s); state.activeRun!.rngState = seed;
    for (const suffix of path) {
      state = commit(state, suffix);
      if (!state || state.activeRun!.history.at(-1)!.band === 'adverse') { state = null; break; }
    }
    if (state) return state;
  }
  throw new Error('No positive fixture found in the bounded natural-stream sample');
}
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical((value as Record<string, unknown>)[k])])) : value;
function welfare(care: boolean, independent: boolean) {
  for (let seed = 0; seed < 100; seed++) {
    const s = scenario('welfare_check', seed);
    if (s.facts.find(f => f.id.endsWith('care_needed'))!.truth === care && (s.story!.episode!.variantId === 'independent_later_sighting') === independent) return s;
  }
  throw new Error('No matching episode');
}

describe('integrated coherent episode generation', () => {
  it('preserves all48 independently captured published v5 definitions', () => {
    for (const [id, hash] of Object.entries(publishedV5)) expect(hashSeed(JSON.stringify(canonical(generateIncident(parseIncidentId(id)!)))), id).toBe(hash);
  });
  it.each(INCIDENT_TYPES_V5)('$type binds real places and offers more than a renamed graph', info => {
    const shapes = new Set<string>(); const people = new Set<string>();
    for (const familyId of info.families) for (let seed = 0; seed < 16; seed++) for (const buildingSeed of [0, 1, 7, 19]) {
      const spec = { type: info.type, familyId, seed, buildingSeed, tier: 1, contentVersion: 6 };
      const s = generateIncident(spec);
      expect(generateIncident(spec)).toEqual(s);
      expect(validateScenario(s, buildLocation(familyId, buildingSeed)), s.id).toEqual([]);
      expect(s.story?.episode?.modules.length).toBeGreaterThan(0);
      expect(new Set(s.briefing.known).size).toBe(s.briefing.known.length);
      expect(new Set(s.briefing.unknown).size).toBe(s.briefing.unknown.length);
      const graph = scenarioActions(s).map(a => ({ id: a.id, stage: a.stage, requires: a.requires, visible: a.visibleWhen, route: a.storyRoute, workload: a.workload, effects: Object.fromEntries(Object.entries(a.outcomes).map(([band, effects]) => [band, effects.map(({ text: _text, ...effect }) => effect)])) }));
      shapes.add(JSON.stringify(graph));
      people.add(s.civilianOutcomes!.map(p => p.label).join(','));
      for (const actor of Object.values(s.story!.bindings.people)) {
        const f = s.facts.find(f => f.id === actor.locationFactId)!;
        if (f.initial === 'reported') expect(f.claim).toContain('not yet checked');
      }
    }
    // Fix the blueprint and discard display copy: the graph itself must vary.
    const mechanics = (x: unknown): unknown => Array.isArray(x) ? x.map(mechanics) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([key]) => !['text', 'reason', 'label', 'title', 'summary', 'task', 'outcomePreview', 'resultLabels'].includes(key)).map(([key, value]) => [key, mechanics(value)])) : x;
    const fixedLayoutGraphs = new Set(Array.from({ length: 24 }, (_, seed) => JSON.stringify(mechanics(scenarioActions(scenario(info.type, seed, info.families[0], 7))))));
    expect(fixedLayoutGraphs.size).toBeGreaterThan(1);
    expect(shapes.size).toBeGreaterThan(1);
    expect(people.size).toBeGreaterThan(1);
  }, 20_000);
  it.each(INCIDENT_TYPES_V5)('$type does not leak unknown truth through current choices or the map', info => {
    const s = scenario(info.type, 2, info.families[0]);
    let state = start(s);
    const before = { actions: actionViews(state, NOW, 'A'), map: spaceViews(state), briefing: briefing(s.id, state, ['A']) };
    const changed = structuredClone(s);
    for (const f of changed.facts) if (f.initial === 'unknown' && !f.showWhenUnknown) f.truth = !f.truth;
    overrides.set(s.id, changed);
    expect({ actions: actionViews(state, NOW, 'A'), map: spaceViews(state), briefing: briefing(s.id, state, ['A']) }).toEqual(before);
  });
  it.each([false, true])('settles a no-care welfare visit without another scored closure click, independent=%s', independent => {
    const s = welfare(false, independent);
    const state = positiveJourney(s, ['trace_sources_assess', 'check_ada_now']);
    expect(state.activeRun!.status).toBe('debrief');
    expect(state.activeRun!.history).toHaveLength(2);
    expect(computeDebrief(state, state.activeRun!)!.completionAchieved).toBe(true);
    const loaded = deserialize(serialize(state, NOW));
    expect(loaded!.activeRun).toEqual(state.activeRun);
    const duplicate = apply(state, { type: 'decide', actionId: 'v5_welfare_check_ada_now', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(duplicate.result.ok).toBe(false); expect(duplicate.state).toBe(state);
  });
  it('an independent report never becomes a duplicate in care or partial prose', () => {
    const s = welfare(true, true);
    for (const a of scenarioActions(s)) {
      const copy = [a.title, a.summary, a.task, ...Object.values(a.outcomePreview ?? {}), ...Object.values(a.outcomes).flatMap(e => e.map(e => e.text ?? '')), ...a.requires.flags?.map(f => f.reason) ?? []];
      expect(copy.join(' '), a.id).not.toMatch(/duplicat|corrected renewed-threat|corrects the renewed-threat/i);
    }
    expect(Object.values(s.endings).map(e => e.summary).join(' ')).not.toMatch(/duplicat/i);
    let state = positiveJourney(s, ['ask_about_return', 'request_early_assessment', 'trace_sources_adapt', 'check_ada_now']);
    expect(state.activeRun!.status).toBe('active');
    const receiver = s.externalServices![0];
    expect(state.activeRun!.externalSupport?.[receiver.id]?.acceptedAt).toBeNull();
    const options = actionViews(state, NOW, 'A');
    const wait = options.find(a => a.id.endsWith('wait_with_ada'));
    if (wait?.eligible) state = commit(state, 'wait_with_ada')!;
    state = commit(state, 'receive_ada')!;
    expect(computeDebrief(state, state.activeRun!)!.disposition).toBe('care_accepted');
    expect(deserialize(serialize(state, NOW))!.activeRun).toEqual(state.activeRun);
  });
  it('avoids recent completed types without surrendering active-board exclusions or extra random draws', () => {
    for (let seed = 0; seed < 100; seed++) {
      const drawn = drawIncidentSpec(seed, { level: 3, trust: 78, contentVersion: 6, avoidTypes: ['hostage_crisis', 'medical_complication'], recentTypes: ['welfare_check', 'protected_rescue'] });
      expect(['barricaded', 'active_armed_incident']).toContain(drawn.spec.type);
      const original = drawIncidentSpec(seed, { level: 3, trust: 78, contentVersion: 5 });
      expect(drawn.state).toBe(original.state);
    }
  });
});
