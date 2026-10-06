import { describe, expect, it } from 'vitest';
import { ASH_GROVE, JUNIPER_COURT, RESIDENTIAL_FAMILIES_V1 } from '../../content/locations/residential-v1';
import { createInitialState } from '../../sim/department';
import { buildLocation, deriveLocation, pointInPolygon } from '../../sim/location';
import { applyChoices } from '../../sim/location-variation';
import { actionViews, builtForScenario, previewAction } from '../../sim/operation-selectors';
import { deserialize, serialize } from '../../sim/save';
import { signalBetween } from '../../sim/spatial';
import { routeBetween } from '../../sim/spatial-factors';
import { apply, NOW, startCmd } from '../../sim/test-fixtures';
import type { BuiltLocation, Vec } from '../../sim/types';
import { drawIncidentSpec, generateIncident, INCIDENT_TYPES } from './index';

function freeOfFurniture(built: BuiltLocation, spaceId: string, point: Vec): boolean {
  return !built.location.objects.some((object) => object.in === spaceId && object.tags.includes('blocks_space')
    && point.x >= object.x - 0.4 && point.x <= object.x + object.w + 0.4
    && point.y >= object.y - 0.4 && point.y <= object.y + object.h + 0.4);
}

describe('versioned residential structures', () => {
  it.each(RESIDENTIAL_FAMILIES_V1)('$id validates 500 seeds with usable anchors and reachable rooms from every entry', (family) => {
    const plans = new Set<string>();
    const connections = new Set<string>();
    for (let seed = 0; seed < 500; seed++) {
      const built = buildLocation(family.id, seed);
      expect(built.issues, `${family.id} seed ${seed}`).toEqual([]);
      plans.add(JSON.stringify([built.location.rooms, built.location.openings]));
      connections.add(JSON.stringify(built.location.openings.filter((o) => o.type !== 'window').map((o) => [o.a, o.b])));
      for (const anchor of built.derived.stagingPoints) {
        const space = [...built.location.rooms, ...built.location.zones].find((space) => space.id === anchor.spaceId)!;
        expect(pointInPolygon(anchor.at, space.polygon), `${family.id}:${seed}:${anchor.id} inside`).toBe(true);
        expect(freeOfFurniture(built, anchor.spaceId, anchor.at), `${family.id}:${seed}:${anchor.id} clearance`).toBe(true);
      }
      for (const entry of built.location.entries) for (const room of built.location.rooms) {
        expect(Number.isFinite(built.derived.distance[entry][room.id]), `${family.id}:${seed}:${entry}->${room.id}`).toBe(true);
        const anchor = built.derived.stagingPoints.find((point) => point.spaceId === room.id && point.kind !== 'window')!;
        const route = routeBetween(built, entry, built.derived.spaces[entry].centroid, room.id, anchor.at, null);
        expect(route.reachable).toBe(true);
        expect(Number.isFinite(route.minutes)).toBe(true);
      }
    }
    // Three partitions × two access states × a real additional graph edge.
    expect(plans.size).toBe(12);
    expect(connections.size).toBe(2);
  }, 20_000);

  it('changes circulation and travel time when a connecting door is present', () => {
    for (const [family, rule, from, to] of [
      [ASH_GROVE, 'kitchen_living_loop', 'living', 'kitchen'],
      [JUNIPER_COURT, 'living_court_loop', 'court', 'living'],
    ] as const) {
      const without = deriveLocation(applyChoices(family, { [rule]: false }));
      const withDoor = deriveLocation(applyChoices(family, { [rule]: true }));
      expect(withDoor.distance[from][to]).toBeLessThan(without.distance[from][to]);
    }
    const willow = buildLocation('willow_terrace_v1', 0);
    expect(willow.derived.distance.rear_lane.bedroom).toBeLessThan(willow.derived.distance.front_yard.bedroom);
    const ash = buildLocation('ash_grove_v1', 0);
    expect(ash.derived.distance.patio.bath).toBeLessThan(ash.derived.distance.front_yard.bath);
    expect(ash.derived.adjacency.hall.some((edge) => edge.to === 'side_hall')).toBe(true);
  });

  it('makes the bookcase and courtyard tree affect actual sightlines', () => {
    for (const [family, blocker, from, to] of [
      ['willow_terrace_v1', 'bookcase', { x: 9, y: 42 }, { x: 24, y: 42 }],
      ['juniper_court_v1', 'court_tree', { x: 20, y: 36 }, { x: 31, y: 36 }],
    ] as const) {
      const built = buildLocation(family, 0);
      const location = structuredClone(built.location);
      location.objects = location.objects.filter((object) => object.id !== blocker);
      const clear = { location, derived: deriveLocation(location), issues: [] };
      const blockedSignal = signalBetween(built, from, to, 'visual');
      expect(blockedSignal.blockers.some((item) => item.kind === 'object' && item.id === blocker)).toBe(true);
      expect(blockedSignal.transmission).toBeLessThan(signalBetween(clear, from, to, 'visual').transmission);
    }
  });

  it('offers fresh families while existing board families are occupied', () => {
    const existing = ['cedar_close', 'harbour_court', 'market_row'];
    const drawn = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const result = drawIncidentSpec(seed, { level: 1, trust: 80, contentVersion: 1, avoidFamilies: existing });
      expect(existing).not.toContain(result.spec.familyId);
      drawn.add(result.spec.familyId);
    }
    expect([...drawn].sort()).toEqual(RESIDENTIAL_FAMILIES_V1.map((family) => family.id).sort());
  });
});

describe('residential incident fairness and persistence', () => {
  it.each(RESIDENTIAL_FAMILIES_V1)('$id places people in every eligible room without furniture collisions', (family) => {
    const occupied = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const scenario = generateIncident({ type: 'medical_complication', familyId: family.id, buildingSeed: seed, seed, tier: 1 + seed % 5, contentVersion: 1 });
      const built = builtForScenario(scenario.id);
      const fact = scenario.facts[0];
      const room = built.location.rooms.find((room) => room.id === fact.spaceId)!;
      occupied.add(room.id);
      expect(pointInPolygon(fact.person!.at!, room.polygon)).toBe(true);
      expect(freeOfFurniture(built, room.id, fact.person!.at!)).toBe(true);
    }
    expect([...occupied].sort()).toEqual(family.base.rooms.filter((room) => ['bedroom', 'bathroom', 'living'].includes(room.type)).map((room) => room.id).sort());
  });

  it.each(RESIDENTIAL_FAMILIES_V1)('$id preserves both issued equipment-free paths at every entrance and tier while hiding the retired handover', (family) => {
    for (const seed of [0, 7, 63]) for (const type of INCIDENT_TYPES.filter((type) => type.families.includes(family.id))) {
      const scenario = generateIncident({ type: type.type, familyId: family.id, buildingSeed: seed, seed, tier: seed === 0 ? 1 : seed === 7 ? 3 : 5, contentVersion: 1 });
      for (const entry of family.base.entries) for (const path of [
        ['gen_observe', 'gen_verify', 'gen_resolve'],
        ['gen_contact', 'gen_coordinate', 'gen_handover'],
      ]) {
        let state = createInitialState(NOW);
        const start = apply(state, startCmd(scenario.id, ['A'], { positions: { A: entry }, loadouts: { A: {} }, practice: true }));
        expect(start.result, `${scenario.id} at ${entry}`).toEqual({ ok: true });
        state = start.state;
        for (const actionId of path) {
          const visible = actionViews(state, NOW, 'A').find((choice) => choice.id === actionId);
          if (actionId === 'gen_handover') expect(visible).toBeUndefined();
          // Direct replay preserves the issued v1 contract; current players do not see this exit.
          const choice = actionId === 'gen_handover' ? previewAction(state, NOW, actionId, ['A'], [])! : visible!;
          expect(choice?.eligible, `${scenario.id} at ${entry}: ${actionId}: ${choice?.reason}`).toBe(true);
          const decision = apply(state, { type: 'decide', actionId, actingSquadIds: choice.actingSquadIds, supportSquadIds: choice.supportSquadIds });
          expect(decision.result).toEqual({ ok: true });
          const restored = deserialize(serialize(decision.state, NOW))!;
          expect(restored).not.toBeNull();
          expect(restored.activeRun).toEqual(decision.state.activeRun);
          state = restored;
        }
        expect(state.activeRun?.status).toBe('debrief');
        expect(state.activeRun?.responseFailure).toBeUndefined();
        if (path[2] === 'gen_handover') expect(state.activeRun?.endingId).toBe('handed_over');
      }
    }
  }, 20_000);
});
