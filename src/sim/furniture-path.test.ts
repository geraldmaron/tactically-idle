import { describe, expect, it } from 'vitest';
import { MAPLE_STREET } from '../content/locations/maple-street';
import { DOORS, STAIR_MINUTES } from '../content/materials';
import { BUILDING_FAMILIES, generateBuilding } from '../gen/building';
import { findRoomPath, footprintRect, roomPointClear, roomSegmentClear } from './furniture-path';
import { deriveLocation, LOCATION_TUNING } from './location';
import { routeAlongOpenings, routeBetween } from './spatial-factors';
import type { BuiltLocation, PlacedObject, Room, Vec } from './types';

const rectangle = (x: number, y: number, w: number, h: number): Vec[] => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const room = (id = 'left', polygon = rectangle(0, 0, 20, 20)): Room => ({ id, label: id, type: 'living', floor: 0, polygon, tags: [] });
const object = (changes: Partial<PlacedObject> = {}): PlacedObject => ({ id: 'sofa', type: 'sofa', in: 'left', x: 8, y: 6, w: 4, h: 8, rotation: 0, mechanical: true, tags: ['blocks_space'], ...changes });
const feet = (points: readonly Vec[]) => points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0);

function furnished(changes: Partial<BuiltLocation['location']> = {}): BuiltLocation {
  const location = {
    ...structuredClone(MAPLE_STREET.base), id: 'test__furnished_v7', familyId: 'test', version: 7,
    rooms: [room(), room('right', rectangle(20, 0, 20, 20))], zones: [], objects: [object()],
    openings: [{ id: 'door', type: 'door' as const, a: 'left', b: 'right', from: { x: 20, y: 8 }, to: { x: 20, y: 12 }, state: 'open' as const }],
    ...changes,
  };
  return { location, derived: deriveLocation(location), issues: [] };
}

describe('furnished room navigation', () => {
  it('keeps a one-foot clearance around the footprint actually rotated in the blueprint', () => {
    const rotated = object({ x: 6, y: 9, w: 8, h: 2, rotation: 90 });
    expect(footprintRect(rotated)).toEqual({ x: 9, y: 6, w: 2, h: 8 });
    const start = { x: 2, y: 10 }, end = { x: 18, y: 10 };
    const path = findRoomPath(room(), [rotated], start, end)!;
    expect(path.length).toBeGreaterThan(2);
    expect(path[0]).toEqual(start);
    expect(path.at(-1)).toEqual(end);
    expect(feet(path)).toBeGreaterThan(16);
    for (let i = 1; i < path.length; i++) expect(roomSegmentClear(room(), [rotated], path[i - 1], path[i])).toBe(true);
    expect(roomPointClear(room(), [rotated], { x: 8.5, y: 10 })).toBe(false);
    expect(roomPointClear(room(), [rotated], { x: 8, y: 10 })).toBe(true);
  });

  it('stays inside a concave room when the direct chord crosses the missing corner', () => {
    const concave = room('left', [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 20 }, { x: 0, y: 20 }]);
    const from = { x: 17, y: 3 }, to = { x: 3, y: 17 };
    expect(roomSegmentClear(concave, [], from, to, 0)).toBe(false);
    const path = findRoomPath(concave, [], from, to)!;
    expect(path.length).toBeGreaterThan(2);
    expect(path).toContainEqual({ x: 5, y: 5 });
    for (let i = 1; i < path.length; i++) expect(roomSegmentClear(concave, [], path[i - 1], path[i])).toBe(true);
  });

  it('refuses sealed passages and occupied endpoints, and does not turn rugs into barriers', () => {
    const barrier = object({ x: 8, y: 0, w: 4, h: 20 });
    const from = { x: 2, y: 10 }, to = { x: 18, y: 10 };
    expect(findRoomPath(room(), [barrier], from, to)).toBeNull();
    expect(findRoomPath(room(), [object()], from, { x: 10, y: 10 })).toBeNull();
    expect(findRoomPath(room(), [object({ ...barrier, type: 'rug' })], from, to)).toEqual([from, to]);
    expect(findRoomPath(room(), [], { x: 0.5, y: 10 }, to)).toBeNull();
  });
});

describe('versioned furnished routes', () => {
  const from = { x: 2, y: 10 }, to = { x: 38, y: 10 };

  it('prices the exact rendered detour and approaches the door on its normal', () => {
    const built = furnished();
    const route = routeBetween(built, 'left', from, 'right', to, null);
    expect(route.reachable).toBe(true);
    expect(route.points.length).toBeGreaterThan(5);
    const doorway = route.points.findIndex(point => point.x === 20 && point.y === 10);
    expect(route.points.slice(doorway - 1, doorway + 2)).toEqual([{ x: 18.5, y: 10 }, { x: 20, y: 10 }, { x: 21.5, y: 10 }]);
    expect(route.minutes).toBe(Math.round((feet(route.points) / LOCATION_TUNING.feetPerMinute + LOCATION_TUNING.openingMinutes) * 10) / 10);
    expect(routeAlongOpenings(built, from, to, ['door'], null)).toEqual(route);
  });

  it('uses furniture detours for same-room routes and refuses a sealed room', () => {
    const end = { x: 18, y: 10 };
    expect(routeBetween(furnished(), 'left', from, 'left', end, null).points.length).toBeGreaterThan(2);
    const blocked = furnished({ openings: [], objects: [object({ x: 8, y: 0, w: 4, h: 20 })] });
    expect(routeBetween(blocked, 'left', from, 'left', end, null).reachable).toBe(false);
    expect(routeAlongOpenings(blocked, from, end, [], null).reachable).toBe(false);
  });

  it('chooses a reachable alternate doorway and retains lock material costs', () => {
    const built = furnished();
    built.location.openings[0].state = 'locked';
    built.location.openings[0].material = 'steel';
    built.location.openings.push({ id: 'second', type: 'door', a: 'left', b: 'right', from: { x: 20, y: 15 }, to: { x: 20, y: 19 }, state: 'open' });
    built.derived = deriveLocation(built.location);
    const locked = routeAlongOpenings(built, from, to, ['door'], null);
    expect(locked.forceMinutes).toBe(DOORS.steel.forceMinutes);
    const alternate = routeAlongOpenings(built, from, to, ['second'], null);
    expect(routeBetween(built, 'left', from, 'right', to, null)).toEqual(alternate);
    built.location.openings[1].state = 'blocked';
    const keyed = routeBetween(built, 'left', from, 'right', to, null, true);
    expect(keyed.forced).toMatchObject([{ openingId: 'door', keyed: true, minutes: 0 }]);
    expect(keyed.minutes).toBe(Math.round((feet(keyed.points) / LOCATION_TUNING.feetPerMinute + LOCATION_TUNING.openingMinutes) * 10) / 10);
  });

  it('uses both stair endpoints and includes the climb in its rendered route cost', () => {
    const upper = { ...room('upper'), floor: 1 };
    const built = furnished({ rooms: [room(), upper], objects: [], openings: [{ id: 'stairs', type: 'stair', a: 'left', b: 'upper', from: { x: 5, y: 5 }, to: { x: 15, y: 15 }, state: 'open' }] });
    const route = routeBetween(built, 'left', { x: 2, y: 2 }, 'upper', { x: 18, y: 18 }, null);
    expect(route.reachable).toBe(true);
    expect(route.points).toEqual([{ x: 2, y: 2 }, { x: 5, y: 5 }, { x: 15, y: 15 }, { x: 18, y: 18 }]);
    expect(route.minutes).toBe(Math.round((feet(route.points) / LOCATION_TUNING.feetPerMinute + STAIR_MINUTES) * 10) / 10);
  });

  it('keeps exterior paths inside concave yards and clear of trees while steps remain walkable', () => {
    const polygon = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 20 }, { x: 0, y: 20 }];
    const yard = { id: 'yard', label: 'Yard', polygon, kind: 'yard' as const, tags: [] };
    const tree = object({ id: 'tree', type: 'tree', in: 'yard', x: 2, y: 10, w: 2, h: 2 });
    const steps = object({ id: 'steps', type: 'steps', in: 'yard', x: 0, y: 14, w: 6, h: 2 });
    const built = furnished({ rooms: [], zones: [yard], openings: [], objects: [tree, steps] });
    const start = { x: 17, y: 3 }, end = { x: 3, y: 17 };
    const route = routeBetween(built, 'yard', start, 'yard', end, null);
    expect(route.reachable).toBe(true);
    expect(route.points.length).toBeGreaterThan(3);
    for (let i = 1; i < route.points.length; i++) expect(roomSegmentClear(room('yard', polygon), built.location.objects, route.points[i - 1], route.points[i])).toBe(true);
    expect(route.minutes).toBe(Math.round(feet(route.points) / LOCATION_TUNING.feetPerMinute * 10) / 10);
    expect(routeAlongOpenings(built, start, end, [], null)).toEqual(route);
  });

  it('requires the wider chair clearance through both furniture gaps and openings', () => {
    const gap = furnished({ objects: [object({ x: 8, y: 0, w: 4, h: 17.5 })] });
    const end = { x: 18, y: 10 };
    expect(routeAlongOpenings(gap, from, end, [], null).reachable).toBe(true);
    expect(routeAlongOpenings(gap, from, end, [], null, false, 1.5).reachable).toBe(false);
    const narrowDoor = furnished({ objects: [] });
    narrowDoor.location.openings[0].from.y = 8.75;
    narrowDoor.location.openings[0].to.y = 11.25;
    narrowDoor.derived = deriveLocation(narrowDoor.location);
    expect(routeAlongOpenings(narrowDoor, from, to, ['door'], null).reachable).toBe(true);
    expect(routeAlongOpenings(narrowDoor, from, to, ['door'], null, false, 1.5).reachable).toBe(false);
    const wide = furnished();
    const chair = routeAlongOpenings(wide, from, to, ['door'], null, false, 1.5);
    expect(chair.reachable).toBe(true);
    expect(chair.minutes).toBe(Math.round((feet(chair.points) / LOCATION_TUNING.feetPerMinute + LOCATION_TUNING.openingMinutes) * 10) / 10);
    expect(chair.minutes).toBeGreaterThanOrEqual(routeAlongOpenings(wide, from, to, ['door'], null).minutes);
  });

  it.each([1, 2, 3, 4, 5, 6])('preserves the exact old straight geometry and minutes for v%i', version => {
    const built = furnished({ id: `test_v${version}`, familyId: `test_v${version}`, version });
    expect(routeBetween(built, 'left', from, 'right', to, null)).toEqual({ minutes: 2.3, forceMinutes: 0, forced: [], points: [from, { x: 20, y: 10 }, to], lastOpeningId: 'door', reachable: true });
    expect(routeAlongOpenings(built, from, to, ['door'], null).points).toEqual([from, { x: 20, y: 10 }, to]);
    expect(routeAlongOpenings(built, from, to, ['door'], null, false, 1.5)).toEqual(routeAlongOpenings(built, from, to, ['door'], null));
    expect(routeBetween(built, 'left', from, 'left', { x: 18, y: 10 }, null)).toEqual({ minutes: 0.8, forceMinutes: 0, forced: [], points: [from, { x: 18, y: 10 }], lastOpeningId: null, reachable: true });
  });

  it('keeps generated room door approaches connected under the same routing geometry', () => {
    for (const family of BUILDING_FAMILIES) for (const seed of [0, 7, 42]) {
      const location = generateBuilding(`${family.id}__furnished_v7`, seed);
      const built = { location, derived: deriveLocation(location), issues: [] };
      for (const space of location.rooms) {
        const approaches = built.derived.stagingPoints.filter(point => point.spaceId === space.id && point.kind !== 'window');
        for (const target of approaches.slice(1)) {
          const route = routeBetween(built, space.id, approaches[0].at, space.id, target.at, null);
          expect(route.reachable, `${family.id}:${seed}:${space.id}:${target.openingId}`).toBe(true);
          expect(route.lastOpeningId).toBeNull();
          expect(route.minutes).toBe(Math.round(feet(route.points) / LOCATION_TUNING.feetPerMinute * 10) / 10);
        }
      }
    }
  });

  it('keeps every generated entry connected to room centres without cutting through exterior obstacles or walls', () => {
    const errors: string[] = [];
    for (const familyId of [...BUILDING_FAMILIES.map(family => family.id), 'maple_street']) for (const seed of [0, 7, 42]) {
      const location = generateBuilding(`${familyId}__furnished_v7`, seed);
      const built = { location, derived: deriveLocation(location), issues: [] };
      const spaces = [...location.rooms, ...location.zones.map(zone => ({ ...zone, type: 'hall' as const, floor: 0 }))];
      for (const entry of location.entries) for (const target of location.rooms) {
        if (!Number.isFinite(built.derived.distance[entry]?.[target.id])) continue;
        const label = `${familyId}:${seed}:${entry}->${target.id}`;
        const route = routeBetween(built, entry, built.derived.spaces[entry].centroid, target.id, built.derived.spaces[target.id].centroid, null);
        if (!route.reachable) { errors.push(`${label} unreachable`); continue; }
        const crossings = location.openings.filter(opening => route.points.some(point => Math.hypot(point.x - (opening.from.x + opening.to.x) / 2, point.y - (opening.from.y + opening.to.y) / 2) < 1e-7));
        const expected = Math.round((feet(route.points) / LOCATION_TUNING.feetPerMinute + crossings.length * LOCATION_TUNING.openingMinutes + route.forceMinutes) * 10) / 10;
        if (route.minutes !== expected) errors.push(`${label} cost does not match geometry`);
        for (let i = 1; i < route.points.length; i++) {
          if (!spaces.some(space => roomSegmentClear(space, location.objects, route.points[i - 1], route.points[i], 1, 0))) errors.push(`${label} cuts through geometry`);
        }
      }
    }
    expect(errors).toEqual([]);
  });
});
