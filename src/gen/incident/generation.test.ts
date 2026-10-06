import { describe, expect, it } from 'vitest';
import { MS_OCCUPANCY } from '../../content/scenarios/ms-occupancy';
import { buildLocation, pointInPolygon } from '../../sim/location';
import { applyChoices } from '../../sim/location-variation';
import type { VariationChoice } from '../../sim/location-variation';
import { deriveLocation } from '../../sim/location';
import { validateLocation } from '../../sim/location-validate';
import { validateScenario } from '../../sim/operation';
import { briefing, builtForScenario, actionViews, pendingDebrief, previewAction, scenarioCards, spaceViews } from '../../sim/operation-selectors';
import { getScenario } from '../../sim/scenario-registry';
import { createInitialState } from '../../sim/department';
import { dispatch } from '../../sim/game';
import { deserialize, serialize } from '../../sim/save';
import { startCmd, apply, NOW } from '../../sim/test-fixtures';
import { INCIDENT_TYPES, drawIncidentSpec, generateIncident, incidentId, parseIncidentId } from './index';
import { BUILDING_FAMILIES, GENERATED_LOCATION_FAMILIES } from '../building';
import type { IncidentSpec } from '../../sim/scenario-types';

function specs(seed: number): IncidentSpec[] {
  return INCIDENT_TYPES.flatMap((type) => type.families.map((familyId) => ({ type: type.type, familyId, buildingSeed: seed, seed, tier: 1 + seed % 5, contentVersion: 1 })));
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

describe('generated incidents', () => {
  // Exhaustive content validation spans every template across six families.
  it('binds every template to valid rooms, positions, actions and entry points', () => {
    for (let seed = 0; seed < 18; seed++) for (const spec of specs(seed)) {
      const scenario = generateIncident(spec);
      const built = buildLocation(spec.familyId, spec.buildingSeed);
      expect(generateIncident(spec)).toEqual(scenario);
      expect(parseIncidentId(scenario.id)).toEqual(spec);
      expect(validateScenario(scenario, built), scenario.id).toEqual([]);
      expect(scenario.title).toBe(built.location.name);
      expect(builtForScenario(scenario.id).location).toEqual(built.location);
      expect(briefing(scenario.id).entries.length).toBeGreaterThan(0);
      for (const fact of scenario.facts) {
        const room = built.location.rooms.find((r) => r.id === fact.spaceId)!;
        expect(pointInPolygon(fact.person!.at!, room.polygon)).toBe(true);
        expect(built.location.objects.some((o) => o.in === room.id && o.tags.includes('blocks_space') && fact.person!.at!.x >= o.x && fact.person!.at!.x <= o.x + o.w && fact.person!.at!.y >= o.y && fact.person!.at!.y <= o.y + o.h)).toBe(false);
      }
    }
  }, 20_000);

  it('starts a different location on each initial board card', () => {
    for (const seed of [1, 12345, 9876, 4294967295]) {
      const state = createInitialState(NOW, seed);
      expect(new Set(state.incidents.map((c) => c.familyId)).size).toBe(3);
      for (const card of state.incidents) expect(getScenario(card.id)?.locationFamilyId).toBe(`${card.familyId}__furnished_v7`);
      expect(scenarioCards(state, NOW).filter((c) => c.id.startsWith('gen:'))).toHaveLength(3);
    }
  });

  it('advances the PRNG, respects tier gates and changes actual room placement', () => {
    const a = drawIncidentSpec(12345, { level: 1, trust: 80, contentVersion: 1 });
    expect(a.state).not.toBe(12345);
    expect(a.spec.tier).toBe(1);
    expect(drawIncidentSpec(12345, { level: 1, trust: 80, contentVersion: 1 })).toEqual(a);
    const targets = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const scenario = generateIncident({ type: 'welfare_check', familyId: 'cedar_close', buildingSeed: 7, seed, tier: 1, contentVersion: 1 });
      targets.add(scenario.facts[0].spaceId);
    }
    expect(targets.size).toBe(3);
  });

  it('completes all templates through the real engine and resumes the same run after saving', () => {
    for (const spec of specs(7)) {
      const scenario = generateIncident(spec);
      const entry = buildLocation(spec.familyId, spec.buildingSeed).location.entries[0];
      let state = createInitialState(NOW);
      state.incidents = [{ id: scenario.id, type: spec.type, familyId: spec.familyId, tier: spec.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
      const start = apply(state, startCmd(scenario.id, ['A'], { positions: { A: entry }, loadouts: { A: {} } }));
      expect(start.result, scenario.id).toEqual({ ok: true });
      state = start.state;
      expect(state.incidents).toHaveLength(0);
      expect(spaceViews(state).find((s) => s.facts.length > 0)?.id).toBe(scenario.facts[0].spaceId);
      for (const id of ['gen_observe', 'gen_verify', 'gen_resolve']) {
        const choice = actionViews(state, NOW, 'A').find((a) => a.id === id)!;
        expect(choice?.eligible, `${scenario.id} ${id}: ${choice?.reason}`).toBe(true);
        const decision = apply(state, { type: 'decide', actionId: id, actingSquadIds: choice.actingSquadIds, supportSquadIds: choice.supportSquadIds });
        expect(decision.result).toEqual({ ok: true });
        state = decision.state;
        const restored = deserialize(serialize(state, NOW));
        expect(restored).not.toBeNull();
        if (restored) {
          expect(restored.activeRun).toEqual(state.activeRun);
          state = restored;
        }
      }
      expect(state.activeRun?.status).toBe('debrief');
      expect(pendingDebrief(state)?.scenarioId).toBe(scenario.id);
      const closed = apply(state, { type: 'closeDebrief' });
      expect(closed.result).toEqual({ ok: true });
      const replay = startCmd(scenario.id, ['A'], { positions: { A: entry }, loadouts: { A: {} } });
      expect(apply(closed.state, replay).result).toEqual({ ok: false, reason: 'This incident is no longer on the board. Replay it in practice.' });
      expect(apply(closed.state, { ...replay, practice: true }).result).toEqual({ ok: true });
    }
  });

  it('restores an unstarted card on cancellation, including after reload, until its expiry', () => {
    const initial = createInitialState(NOW);
    const card = initial.incidents[0];
    const entry = builtForScenario(card.id).location.entries[0];
    const start = startCmd(card.id, ['A'], { positions: { A: entry }, loadouts: { A: {} } });
    const running = apply(initial, start).state;
    const reloaded = deserialize(serialize(running, NOW))!;
    expect(reloaded.activeRun?.sourceIncident).toEqual(card);
    const cancelled = apply(reloaded, { type: 'cancelOperation' });
    expect(cancelled.result).toEqual({ ok: true });
    expect(cancelled.state.incidents.find((c) => c.id === card.id)).toEqual(card);
    expect(apply(cancelled.state, start).result).toEqual({ ok: true });
    const expired = apply(reloaded, { type: 'cancelOperation' }, card.expiresAt + 1);
    expect(expired.state.incidents.some((c) => c.id === card.id)).toBe(false);
  });

  it('does not consume a live board card when it is played in practice', () => {
    const initial = createInitialState(NOW);
    const card = initial.incidents[0];
    const entry = builtForScenario(card.id).location.entries[0];
    const running = apply(initial, startCmd(card.id, ['A'], { positions: { A: entry }, loadouts: { A: {} }, practice: true })).state;
    const ticked = dispatch(running, { type: 'tick' }, { now: NOW + 1000 });
    expect(ticked.result).toEqual({ ok: true });
    expect(ticked.state.incidents.find((c) => c.id === card.id)).toEqual(card);
  });

  it('preserves the issued equipment-free handover path without offering its retired card', () => {
    for (const spec of specs(3)) {
      const id = incidentId(spec);
      const entry = builtForScenario(id).location.entries[0];
      let state = apply(createInitialState(NOW), startCmd(id, ['A'], { positions: { A: entry }, loadouts: { A: {} }, practice: true })).state;
      for (const actionId of ['gen_contact', 'gen_coordinate', 'gen_handover']) {
        const visible = actionViews(state, NOW, 'A').find((a) => a.id === actionId);
        if (actionId === 'gen_handover') expect(visible).toBeUndefined();
        const choice = actionId === 'gen_handover' ? previewAction(state, NOW, actionId, ['A'], [])! : visible!;
        expect(choice?.eligible, `${id} ${actionId}`).toBe(true);
        const result = apply(state, { type: 'decide', actionId, actingSquadIds: choice.actingSquadIds, supportSquadIds: choice.supportSquadIds });
        expect(result.result).toEqual({ ok: true });
        const restored = deserialize(serialize(result.state, NOW));
        expect(restored?.activeRun).toEqual(result.state.activeRun);
        state = restored!;
      }
      expect(state.activeRun?.endingId).toBe('handed_over');
      expect(state.activeRun?.responseFailure).toBeUndefined();
    }
  });

  it('keeps authored Maple Street unchanged and resolves legacy generated Maple ids', () => {
    expect(getScenario('ms_occupancy')).toBe(MS_OCCUPANCY);
    const spec: IncidentSpec = { type: 'welfare_check', familyId: 'maple_street', buildingSeed: 0, seed: 42, tier: 1, contentVersion: 1 };
    const legacy = getScenario(incidentId(spec))!;
    const currentShape = structuredClone(legacy.stages);
    const thermal = currentShape.adapt.actions.find((action) => action.id === 'ms_thermal')!;
    thermal.summary = MS_OCCUPANCY.stages.adapt.actions.find((action) => action.id === 'ms_thermal')!.summary;
    delete thermal.consumes;
    expect(currentShape).toEqual(MS_OCCUPANCY.stages);
    expect(legacy.facts).toEqual(MS_OCCUPANCY.facts);
    expect(validateScenario(legacy, buildLocation('maple_street', 0))).toEqual([]);
    expect(parseIncidentId('gen:unknown:cedar_close:0:1:1:1')).toBeNull();
    expect(parseIncidentId('gen:welfare_check:cedar_close:0:1:6:1')).toBeNull();
  });
});
