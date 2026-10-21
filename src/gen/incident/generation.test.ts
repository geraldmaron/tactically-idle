import { CALL_TREES } from '../../content/call-trees';
import { drawCalls, playToEnd } from './trees-v13/balance';
import { describe, expect, it } from 'vitest';
import { buildLocation, pointInPolygon } from '../../sim/location';
import { applyChoices } from '../../sim/location-variation';
import type { VariationChoice } from '../../sim/location-variation';
import { deriveLocation } from '../../sim/location';
import { validateLocation } from '../../sim/location-validate';
import { validateScenario } from '../../sim/operation';
import { briefing, builtForScenario, actionViews, scenarioCards } from '../../sim/operation-selectors';
import { createInitialState } from '../../sim/department';
import { deserialize, serialize } from '../../sim/save';
import { startCmd, apply, NOW } from '../../sim/test-fixtures';
import { INCIDENT_TYPES, drawIncidentSpec, generateIncident, parseIncidentId } from './index';
import { BUILDING_FAMILIES, GENERATED_LOCATION_FAMILIES } from '../building';
import type { IncidentSpec } from '../../sim/scenario-types';

function specs(seed: number): IncidentSpec[] {
  return INCIDENT_TYPES.flatMap((type) => type.families.map((familyId) => ({ type: type.type, familyId, buildingSeed: seed, seed, tier: 1 + seed % 5, contentVersion: 13 })));
}

describe('neighbourhood geometry', () => {
  it('every possible authored partition/door combination validates', () => {
    for (const family of GENERATED_LOCATION_FAMILIES) {
      let choices: Record<string, VariationChoice>[] = [{}];
      for (const rule of family.variations) {
        const values = rule.kind === 'shiftEdge' ? rule.offsets : rule.kind === 'openingState' ? rule.states : [false, true];
        choices = choices.flatMap((c) => values.map((value) => ({ ...c, [rule.id]: value })));
      }
      for (const choice of choices) {
        const location = applyChoices(family, choice);
        expect(validateLocation(location, deriveLocation(location)).filter((i) => i.severity === 'error'), `${family.id} ${JSON.stringify(choice)}`).toEqual([]);
      }
    }
  });

  it('has distinct plans, contents and routes with deterministic seed variation', () => {
    const buildings = BUILDING_FAMILIES.map((f) => buildLocation(f.id, 0));
    expect(new Set(buildings.map((b) => JSON.stringify(b.location.footprint))).size).toBe(BUILDING_FAMILIES.length);
    expect(new Set(buildings.map((b) => JSON.stringify(b.location.rooms.map((r) => r.type)))).size).toBeGreaterThanOrEqual(4);
    expect(buildings.find((b) => b.location.familyId === 'market_row')!.location.objects.some((o) => o.type === 'register')).toBe(true);
    for (const family of BUILDING_FAMILIES) {
      const variants = new Set<string>();
      for (let seed = 0; seed < 30; seed++) {
        const a = buildLocation(family.id, seed);
        expect(buildLocation(family.id, seed)).toEqual(a);
        expect(a.issues.filter((i) => i.severity === 'error')).toEqual([]);
        variants.add(JSON.stringify([a.location.rooms, a.location.openings]));
      }
      expect(variants.size).toBeGreaterThan(3);
    }
  });
});

describe('current generated incidents', () => {
  it('binds every current template to its hosted furnished map', () => {
    for (const seed of [0, 7, 17]) for (const spec of specs(seed)) {
      const scenario = generateIncident(spec);
      const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
      expect(generateIncident(spec)).toEqual(scenario);
      expect(parseIncidentId(scenario.id)).toEqual(spec);
      expect(validateScenario(scenario, built), scenario.id).toEqual([]);
      expect(builtForScenario(scenario.id).location).toEqual(built.location);
      expect(briefing(scenario.id).entries.length).toBeGreaterThan(0);
      for (const fact of scenario.facts.filter(fact => fact.person?.at)) {
        expect(pointInPolygon(fact.person!.at!, [...built.location.rooms, ...built.location.zones].find(space => space.id === fact.spaceId)!.polygon)).toBe(true);
      }
    }
  }, 60000);

  it('starts distinct types and locations on the live board', () => {
    for (const seed of [1, 12345, 9876, 4294967295]) {
      const state = createInitialState(NOW, seed);
      const cards = state.incidents.length;
      // One live call per kind: a board with one curated kind holds one card.
      expect(cards).toBeGreaterThanOrEqual(1);
      expect(new Set(state.incidents.map(c => c.type)).size).toBe(cards);
      expect(new Set(state.incidents.map(c => c.familyId)).size).toBe(cards);
      expect(scenarioCards(state, NOW).filter(c => c.id.startsWith('gen:'))).toHaveLength(cards);
    }
  });

  it('advances the PRNG deterministically and respects tier and family preferences', () => {
    const ctx = { level: 1, trust: 80, contentVersion: 13 };
    const a = drawIncidentSpec(12345, ctx);
    expect(a.state).not.toBe(12345);
    expect(a.spec.tier).toBe(1);
    expect(drawIncidentSpec(12345, ctx)).toEqual(a);
    for (let seed = 0; seed < 30; seed++) {
      const drawn = drawIncidentSpec(seed, { ...ctx, avoidFamilies: [a.spec.familyId] });
      const info = INCIDENT_TYPES.find(info => info.type === drawn.spec.type)!;
      expect(info.families).toContain(drawn.spec.familyId);
      if (info.families.some(id => id !== a.spec.familyId)) expect(drawn.spec.familyId).not.toBe(a.spec.familyId);
    }
  });

  it('resumes a committed current call with identical choices and no reroll', () => {
    for (const tree of Object.values(CALL_TREES)) for (const { scenarioId, seed } of drawCalls(tree!, 2, 2)) {
      let checked = 0;
      playToEnd(scenarioId, 'patient', seed, { onStep: ({ after }) => {
        const restored = deserialize(serialize(after, NOW));
        expect(restored?.activeRun).toEqual(after.activeRun);
        expect(actionViews(restored!, NOW, 'A')).toEqual(actionViews(after, NOW, 'A'));
        checked++;
      } });
      expect(checked).toBeGreaterThan(0);
    }
  });

  it('restores an unstarted card on cancellation, including after reload, until expiry', () => {
    const initial = createInitialState(NOW);
    const card = initial.incidents[0];
    const entry = briefing(card.id).entries[0].id;
    const start = startCmd(card.id, ['A'], { positions: { A: entry }, loadouts: { A: {} } });
    const running = apply(initial, start).state;
    const reloaded = deserialize(serialize(running, NOW))!;
    expect(reloaded.activeRun?.sourceIncident).toEqual(card);
    const cancelled = apply(reloaded, { type: 'cancelOperation' });
    expect(cancelled.result).toEqual({ ok: true });
    expect(cancelled.state.incidents.find(c => c.id === card.id)).toEqual(card);
    expect(apply(cancelled.state, start).result).toEqual({ ok: true });
    const expired = apply(reloaded, { type: 'cancelOperation' }, card.expiresAt + 1);
    expect(expired.state.incidents.some(c => c.id === card.id)).toBe(false);
  });

  it('rejects every old version, unknown kind and generated Maple Street ID', () => {
    for (let version = 1; version < 13; version++) expect(parseIncidentId(`gen:barricaded:cedar_close:0:1:1:${version}`)).toBeNull();
    expect(parseIncidentId('gen:welfare_check:cedar_close:0:1:1:13')).toBeNull();
    expect(parseIncidentId('gen:barricaded:maple_street:0:1:1:13')).toBeNull();
    expect(parseIncidentId('gen:unknown:cedar_close:0:1:1:13')).toBeNull();
    expect(parseIncidentId('gen:barricaded:cedar_close:0:1:6:13')).toBeNull();
  });
});
