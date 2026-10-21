import { describe, expect, it } from 'vitest';
import { ASH_GROVE, JUNIPER_COURT, RESIDENTIAL_FAMILIES } from '../../content/locations/residential';
import { buildLocation, deriveLocation, pointInPolygon } from '../../sim/location';
import { applyChoices } from '../../sim/location-variation';
import { builtForScenario } from '../../sim/operation-selectors';
import { signalBetween } from '../../sim/spatial';
import { routeBetween } from '../../sim/routes';
import type { BuiltLocation, Vec } from '../../sim/types';
import { drawIncidentSpec, generateIncident, INCIDENT_TYPES } from './index';
import { HOUSE_TEMPLATE } from './trees-v13/house-fixture';
import { SCENARIOS } from '../../content/scenarios';

function freeOfFurniture(built: BuiltLocation, spaceId: string, point: Vec): boolean {
  return !built.location.objects.some(object => {
    if (object.in !== spaceId || !object.tags.includes('blocks_space')) return false;
    const rotated = object.rotation === 90 || object.rotation === 270;
    return Math.abs(point.x - object.x - object.w / 2) <= (rotated ? object.h : object.w) / 2 + 0.4
      && Math.abs(point.y - object.y - object.h / 2) <= (rotated ? object.w : object.h) / 2 + 0.4;
  });
}

describe('versioned residential structures', () => {
  it.each(RESIDENTIAL_FAMILIES)('$id validates 500 seeds with usable anchors and reachable rooms from every entry', (family) => {
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

  it('offers a fresh supported family when another building is available', () => {
    const existing = ['cedar_close', 'harbour_court', 'market_row'];
    for (let seed = 0; seed < 100; seed++) {
      const result = drawIncidentSpec(seed, { level: 1, trust: 80, avoidFamilies: existing });
      const info = INCIDENT_TYPES.find(info => info.type === result.spec.type)!;
      if (info.families.some(id => !existing.includes(id))) expect(existing).not.toContain(result.spec.familyId);
    }
  });
});

describe('current residential placement', () => {
  it.each(RESIDENTIAL_FAMILIES)('$id places people without furniture collisions', family => {
    for (let seed = 0; seed < 100; seed++) {
      // The engine's own house call (an owned fixture), so the placement check never depends on a
      // shipping call's families.
      const call = generateIncident({ type: 'barricaded', familyId: family.id, buildingSeed: seed, seed, tier: 1 + seed % 5, contentVersion: 13 }, HOUSE_TEMPLATE);
      const scenario = (SCENARIOS[`house:${call.id}`] ??= { ...call, id: `house:${call.id}` });
      const built = builtForScenario(scenario.id);
      for (const person of Object.values(scenario.story!.bindings.people)) {
        const at = person.initial;
        expect(pointInPolygon(at.at, [...built.location.rooms, ...built.location.zones].find(space => space.id === at.spaceId)!.polygon)).toBe(true);
        expect(freeOfFurniture(built, at.spaceId, at.at)).toBe(true);
      }
    }
  });
});
