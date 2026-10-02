import { describe, expect, it } from 'vitest';
import { MAPLE_STREET } from '../content/locations/maple-street';
import { INVALID_FIXTURES, VALID_TINY } from '../content/locations/test-fixtures';
import { CHAMFER_FIXTURE } from '../content/locations/chamfer-fixture';
import { TWO_FLOOR_FIXTURE } from '../content/locations/two-floor-fixture';
import { STAIR_MINUTES } from '../content/materials';
import { buildLocation, deriveLocation, floorCount, polygonArea, polygonCentroid, pointInPolygon } from './location';
import { applyChoices, applyVariations, variationChoices } from './location-variation';
import type { VariationChoice } from './location-variation';
import { assertPlayable, validateLocation } from './location-validate';
import type { BuiltLocation, LocationDefinition, LocationFamily, Opening, Vec } from './types';

const errorsOf = (b: Pick<BuiltLocation, 'issues'>) => b.issues.filter((i) => i.severity === 'error');

/** Build a Maple Street variant from forced choices instead of hunting for a seed. */
function forced(choices: Record<string, VariationChoice>): BuiltLocation {
  const location = applyChoices(MAPLE_STREET, choices);
  const derived = deriveLocation(location);
  return { location, derived, issues: validateLocation(location, derived) };
}

describe('seed 0 and determinism', () => {
  it('seed 0 is the authored base layout and is playable', () => {
    const built = buildLocation('maple_street', 0);
    expect(built.location).toEqual({ ...MAPLE_STREET.base, seed: 0 });
    expect(errorsOf(built)).toEqual([]);
    expect(() => assertPlayable(built)).not.toThrow();
  });

  it('the same seed gives the same location, and seeds 0..199 are all playable', () => {
    for (let seed = 0; seed < 200; seed++) {
      const a = buildLocation('maple_street', seed);
      expect(buildLocation('maple_street', seed)).toEqual(a);
      expect(a.location.seed).toBe(seed);
      expect(errorsOf(a), `seed ${seed}`).toEqual([]);
    }
  });

  it('seeds actually vary the layout across the authored options', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 200; seed++) seen.add(JSON.stringify(variationChoices(MAPLE_STREET, seed).map((c) => c.choice)));
    expect(seen.size).toBeGreaterThan(8);
  });

  it('applyVariations does not mutate the family', () => {
    const before = structuredClone(MAPLE_STREET);
    applyVariations(MAPLE_STREET, 7);
    expect(MAPLE_STREET).toEqual(before);
  });

  it('rejects choices the author did not allow', () => {
    expect(() => applyChoices(MAPLE_STREET, { east_bedroom_depth: 5 })).toThrow();
    expect(() => applyChoices(MAPLE_STREET, { nope: 1 })).toThrow();
  });
});

describe('geometry fixture: east bedroom depth', () => {
  it('moves the bedroom/kitchen wall so the two areas change in opposite directions', () => {
    const shallow = forced({ east_bedroom_depth: -1 });
    const base = forced({ east_bedroom_depth: 0 });
    const deep = forced({ east_bedroom_depth: 1 });
    const area = (b: BuiltLocation, id: string) => b.derived.spaces[id].area;

    expect(area(shallow, 'bedroom_e')).toBeLessThan(area(base, 'bedroom_e'));
    expect(area(deep, 'bedroom_e')).toBeGreaterThan(area(base, 'bedroom_e'));
    expect(area(shallow, 'kitchen')).toBeGreaterThan(area(base, 'kitchen'));
    expect(area(deep, 'kitchen')).toBeLessThan(area(base, 'kitchen'));
    // The wall moves one foot along the 17 ft shared span, so the swap is exact.
    expect(area(deep, 'bedroom_e') - area(shallow, 'bedroom_e')).toBe(34);
    expect(area(shallow, 'kitchen') - area(deep, 'kitchen')).toBe(34);
    expect(deep.derived.spaces.bedroom_e.area).not.toBe(shallow.derived.spaces.bedroom_e.area);
    // Neighbouring rooms and the footprint are untouched.
    expect(area(deep, 'living')).toBe(area(shallow, 'living'));
    expect(deep.location.footprint).toEqual(shallow.location.footprint);
  });

  it('every forced depth is a playable layout', () => {
    for (const offset of [-1, 0, 1]) expect(errorsOf(forced({ east_bedroom_depth: offset })), `offset ${offset}`).toEqual([]);
  });
});

describe('graph fixture: connections and door state', () => {
  it('the bath/east-bedroom door shortens that route', () => {
    const without = forced({ bath_bedroom_door: false });
    const withDoor = forced({ bath_bedroom_door: true });
    expect(without.location.openings.some((o) => o.id === 'd_bath_bede')).toBe(false);
    expect(withDoor.location.openings.some((o) => o.id === 'd_bath_bede')).toBe(true);
    expect(withDoor.derived.distance.bath.bedroom_e).toBeLessThan(without.derived.distance.bath.bedroom_e);
    expect(errorsOf(withDoor)).toEqual([]);
  });

  it('a blocked back door forces the front route and keeps every room reachable', () => {
    const closed = forced({ back_door_state: 'closed' });
    const locked = forced({ back_door_state: 'locked' });
    const blocked = forced({ back_door_state: 'blocked' });
    const side = (b: BuiltLocation) => b.derived.distance.side_yard_e.kitchen;

    expect(Number.isFinite(side(closed))).toBe(true);
    expect(side(locked)).toBeGreaterThan(side(closed));
    expect(Number.isFinite(side(blocked))).toBe(true);
    expect(side(blocked)).toBeGreaterThan(side(closed));
    for (const b of [closed, locked, blocked]) {
      expect(errorsOf(b).filter((i) => i.code === 'unreachable_room')).toEqual([]);
      for (const room of b.location.rooms) expect(Number.isFinite(b.derived.distance.side_yard_e[room.id])).toBe(true);
    }
  });
});

describe('validator fixtures', () => {
  const check = (loc: LocationDefinition) => validateLocation(loc, deriveLocation(loc));

  it('the valid tiny layout has no errors', () => {
    expect(errorsOf({ issues: check(VALID_TINY) })).toEqual([]);
  });

  for (const fx of INVALID_FIXTURES) {
    it(`reports ${fx.code} for ${fx.name}`, () => {
      const issues = check(fx.location);
      expect(issues.some((i) => i.severity === 'error' && i.code === fx.code)).toBe(true);
    });
  }

  it('warns, without failing, when a door swing sweeps a blocking object', () => {
    const loc = structuredClone(VALID_TINY);
    // Bed placed where the d_front leaf opens into the room.
    loc.objects[0] = { ...loc.objects[0], x: 3, y: 6.5, w: 2.5, h: 2.5 };
    const issues = check(loc);
    expect(issues.some((i) => i.code === 'swing_blocked' && i.severity === 'warning')).toBe(true);
    expect(errorsOf({ issues })).toEqual([]);
  });

  it('warns when a window is not on the exterior wall', () => {
    const loc = structuredClone(VALID_TINY);
    loc.openings.push({ id: 'w_in', type: 'window', a: 'b', b: 'c', from: { x: 14, y: 5 }, to: { x: 17, y: 5 }, state: 'closed', glazing: 'double' });
    expect(check(loc).some((i) => i.code === 'window_not_on_footprint' && i.severity === 'warning')).toBe(true);
  });

  it('assertPlayable throws with every error message', () => {
    const loc = structuredClone(INVALID_FIXTURES[1].location);
    loc.objects[0].x = 8;
    const built: BuiltLocation = { location: loc, derived: deriveLocation(loc), issues: check(loc) };
    expect(() => assertPlayable(built)).toThrow(/room_overlap[\s\S]*object_outside_space/);
  });
});

describe('materials and staging points in derived data', () => {
  it('every seed 0..49 keeps door materials and window glazing, including variation-added openings', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { location } = buildLocation('maple_street', seed);
      for (const o of location.openings) {
        if (o.type === 'door') expect(o.material, `seed ${seed} ${o.id}`).toBeDefined();
        if (o.type === 'window') expect(o.glazing, `seed ${seed} ${o.id}`).toBeDefined();
      }
    }
    const withDoor = forced({ bath_bedroom_door: true });
    expect(withDoor.location.openings.find((o) => o.id === 'd_bath_bede')?.material).toBe('hollow_core');
    expect(withDoor.derived.stagingPoints.map((s) => s.id)).toContain('sp_d_bath_bede_bath');
    expect(forced({ bath_bedroom_door: false }).derived.stagingPoints.map((s) => s.id)).not.toContain('sp_d_bath_bede_bath');
  });

  it('seed 0 derives the same staging points as the base layout', () => {
    expect(buildLocation('maple_street', 0).derived.stagingPoints).toEqual(deriveLocation(MAPLE_STREET.base).stagingPoints);
  });

  it('warns when a staging point falls outside its space', () => {
    const loc = structuredClone(VALID_TINY);
    const derived = deriveLocation(loc);
    expect(validateLocation(loc, derived).some((i) => i.code === 'staging_point_outside_space')).toBe(false);
    const moved = { ...derived, stagingPoints: derived.stagingPoints.map((s, i) => (i === 0 ? { ...s, at: { x: -40, y: -40 } } : s)) };
    const issues = validateLocation(loc, moved);
    expect(issues.some((i) => i.code === 'staging_point_outside_space' && i.severity === 'warning')).toBe(true);
    expect(errorsOf({ issues })).toEqual([]);
  });
});

// ---------------------------------------------------------------- floors and chamfers

const check = (loc: LocationDefinition) => validateLocation(loc, deriveLocation(loc));
const codes = (loc: LocationDefinition) => errorsOf({ issues: check(loc) }).map((i) => i.code);
const clone = () => structuredClone(TWO_FLOOR_FIXTURE);
/** House-local feet of the two-floor fixture to lot feet. */
const F = (x: number, y: number): Vec => ({ x: x + 6, y: y + 6 });
const opening = (loc: LocationDefinition, id: string): Opening => {
  const o = loc.openings.find((x) => x.id === id);
  if (!o) throw new Error(`no opening ${id}`);
  return o;
};

describe('chamfered footprint fixture', () => {
  it('validates with no issues, including the window and door on the diagonal wall', () => {
    expect(check(CHAMFER_FIXTURE)).toEqual([]);
  });

  it('computes exact areas for the cut-corner polygons', () => {
    const { spaces } = deriveLocation(CHAMFER_FIXTURE);
    expect(polygonArea(CHAMFER_FIXTURE.footprint)).toBe(20 * 14 - 18);
    expect(spaces.shop.area).toBe(12 * 14 - 18);
    expect(spaces.stockroom.area).toBe(8 * 14);
    expect(spaces.shop.area + spaces.stockroom.area).toBe(polygonArea(CHAMFER_FIXTURE.footprint));
  });

  it('puts the centroid inside the cut-corner room, off the rectangle centre', () => {
    const shop = CHAMFER_FIXTURE.rooms.find((r) => r.id === 'shop')!;
    const c = polygonCentroid(shop.polygon);
    expect(pointInPolygon(c, shop.polygon)).toBe(true);
    // The missing north-east corner pulls the centroid toward the south-west of the 12 x 14 bbox centre (14, 7).
    expect(c.x).toBeLessThan(14 + 6);
    expect(c.y).toBeGreaterThan(7 + 10);
    expect(deriveLocation(CHAMFER_FIXTURE).spaces.shop.centroid).toEqual(c);
  });

  it('staging points on the diagonal door sit inside their spaces and carry floor 0', () => {
    const d = deriveLocation(CHAMFER_FIXTURE);
    const pts = d.stagingPoints.filter((s) => s.openingId === 'd_corner');
    expect(pts.map((p) => p.spaceId).sort()).toEqual(['corner_street', 'shop']);
    const shopPt = pts.find((p) => p.spaceId === 'shop')!;
    expect(pointInPolygon(shopPt.at, CHAMFER_FIXTURE.rooms[0].polygon)).toBe(true);
    for (const p of pts) expect(p.floor).toBe(0);
    expect(d.distance.corner_street.stockroom).toBeGreaterThan(0);
    expect(Number.isFinite(d.distance.corner_street.alley)).toBe(true);
  });

  it('flags a diagonal-wall opening that is off the wall', () => {
    const loc = structuredClone(CHAMFER_FIXTURE);
    opening(loc, 'd_corner').from = { x: 6 + 18, y: 10 + 5 }; // x - y = 9, not 14
    expect(codes(loc)).toContain('opening_not_on_wall');
  });
});

describe('two-floor derived data', () => {
  const d = deriveLocation(TWO_FLOOR_FIXTURE);

  it('validates with no issues, and has two floors', () => {
    expect(check(TWO_FLOOR_FIXTURE)).toEqual([]);
    expect(floorCount(TWO_FLOOR_FIXTURE)).toBe(2);
  });

  it('sets the floor on every room and zone', () => {
    for (const r of TWO_FLOOR_FIXTURE.rooms) expect(d.spaces[r.id].floor, r.id).toBe(r.floor);
    for (const z of TWO_FLOOR_FIXTURE.zones) expect(d.spaces[z.id].floor, z.id).toBe(0);
    expect(d.spaces.landing.area).toBe(64);
    expect(d.spaces.hall.area).toBe(112);
  });

  it('staging points carry their floor, with stair points at the foot and the head', () => {
    for (const sp of d.stagingPoints) {
      const room = TWO_FLOOR_FIXTURE.rooms.find((r) => r.id === sp.spaceId);
      expect(sp.floor, sp.id).toBe(room ? room.floor : 0);
    }
    const stair = d.stagingPoints.filter((s) => s.kind === 'stair');
    expect(stair.map((s) => [s.spaceId, s.facesId, s.floor])).toEqual([
      ['hall', 'landing', 0],
      ['landing', 'hall', 1],
    ]);
    const st = opening(TWO_FLOOR_FIXTURE, 'st_hall_landing');
    expect(stair[0].at).toEqual(st.from);
    expect(stair[1].at).toEqual(st.to);
  });

  it('a stair is a graph edge between the two stair rooms costing the climb plus the walks', () => {
    const up = d.adjacency.hall.find((e) => e.openingId === 'st_hall_landing');
    const down = d.adjacency.landing.find((e) => e.openingId === 'st_hall_landing');
    expect(up?.to).toBe('landing');
    expect(down?.to).toBe('hall');
    expect(up!.cost).toBe(down!.cost);
    expect(up!.cost).toBeGreaterThan(STAIR_MINUTES);
    // Centre of hall (4, 7) to foot (4, 11), and head (4, 3) to centre of landing (4, 4): 5 ft at 20 ft/min.
    expect(up!.cost).toBeCloseTo(STAIR_MINUTES + 5 / 20, 2);
  });

  it('distance from the ground entry to the upstairs bedroom includes the stair minutes', () => {
    const toHall = d.distance.front_yard.hall;
    const toBed = d.distance.front_yard.bedroom_u;
    expect(Number.isFinite(toBed)).toBe(true);
    expect(toBed).toBeGreaterThan(toHall + STAIR_MINUTES);
    expect(d.distance.bedroom_u.front_yard).toBe(toBed);
    // Without the stair the upper floor is unreachable.
    const loc = clone();
    opening(loc, 'st_hall_landing').state = 'blocked';
    const blocked = deriveLocation(loc);
    expect(blocked.distance.front_yard.bedroom_u).toBe(Infinity);
    expect(errorsOf({ issues: validateLocation(loc, blocked) }).filter((i) => i.code === 'unreachable_room').map((i) => i.ref).sort()).toEqual(['bath_u', 'bedroom_u', 'landing']);
  });

  it('a locked stair costs the extra locked minutes', () => {
    const loc = clone();
    opening(loc, 'st_hall_landing').state = 'locked';
    expect(deriveLocation(loc).distance.front_yard.landing).toBeGreaterThan(d.distance.front_yard.landing + 2);
  });

  it('every upstairs room is reachable and none is a zone', () => {
    for (const id of ['landing', 'bedroom_u', 'bath_u']) expect(Number.isFinite(d.distance.front_yard[id]), id).toBe(true);
  });
});

describe('floor-aware validation', () => {
  it('reports stair_misaligned when the stair rooms do not overlap in plan', () => {
    const loc = clone();
    opening(loc, 'st_hall_landing').b = 'bath_u'; // bath_u sits at x 18..24, nowhere over the hall
    expect(codes(loc)).toContain('stair_misaligned');
  });

  it('reports stair_misaligned when the foot or head is outside its room', () => {
    const head = clone();
    opening(head, 'st_hall_landing').to = F(12, 3); // in bedroom_u, not the landing
    expect(codes(head)).toContain('stair_misaligned');
    const foot = clone();
    opening(foot, 'st_hall_landing').from = F(12, 11); // in the kitchen, not the hall
    expect(codes(foot)).toContain('stair_misaligned');
  });

  it('accepts a stair written with a and b swapped, from still lying in a', () => {
    const loc = clone();
    const st = opening(loc, 'st_hall_landing');
    [st.a, st.b, st.from, st.to] = [st.b, st.a, st.to, st.from];
    expect(check(loc)).toEqual([]);
    const d = deriveLocation(loc);
    expect(d.adjacency.hall.some((e) => e.openingId === 'st_hall_landing')).toBe(true);
    expect(d.distance.front_yard.bedroom_u).toBe(deriveLocation(TWO_FLOOR_FIXTURE).distance.front_yard.bedroom_u);
  });

  it('reports stair_floors_invalid for a stair on one floor or to a zone', () => {
    const same = clone();
    Object.assign(opening(same, 'st_hall_landing'), { b: 'living', to: F(12, 4) });
    expect(codes(same)).toContain('stair_floors_invalid');
    const zone = clone();
    Object.assign(opening(zone, 'st_hall_landing'), { b: 'back_yard' });
    expect(codes(zone)).toContain('stair_floors_invalid');
  });

  it('reports opening_cross_floor for a door between floors, and for a door from an upper room to a zone', () => {
    const door = clone();
    door.openings.push({ id: 'd_bad', type: 'door', a: 'hall', b: 'landing', from: F(1, 6), to: F(3.5, 6), state: 'closed', material: 'hollow_core' });
    expect(codes(door)).toContain('opening_cross_floor');
    const exterior = clone();
    exterior.openings.push({ id: 'd_up_out', type: 'door', a: 'bath_u', b: 'side_yard_e', from: F(24, 5), to: F(24, 7.5), state: 'closed', material: 'solid_core' });
    expect(codes(exterior)).toContain('opening_cross_floor');
    const wrongFloor = clone();
    opening(wrongFloor, 'd_landing_bed').floor = 0;
    expect(codes(wrongFloor)).toContain('opening_cross_floor');
  });

  it('reports room_outside_upper_footprint, and still room_outside_footprint on floor 0', () => {
    const upper = clone();
    upper.upperFootprint = [F(0, 0), F(24, 0), F(24, 6), F(0, 6)];
    const c = codes(upper);
    expect(c).toContain('room_outside_upper_footprint');
    expect(c).not.toContain('room_outside_footprint');
    const ground = clone();
    ground.footprint = [F(0, 0), F(24, 0), F(24, 10), F(0, 10)];
    expect(codes(ground)).toContain('room_outside_footprint');
  });

  it('checks overlap per floor: ground and upper rooms may stack, same-floor rooms may not', () => {
    expect(codes(clone())).toEqual([]);
    const loc = clone();
    loc.rooms.find((r) => r.id === 'bath_u')!.polygon = [F(16, 0), F(24, 0), F(24, 8), F(16, 8)];
    expect(codes(loc)).toContain('room_overlap');
  });

  it('reports too_many_floors and floors_mismatch / missing_upper_footprint', () => {
    const three = clone();
    three.floors = 3;
    three.rooms[0].floor = 2;
    expect(codes(three)).toContain('too_many_floors');
    const noFlag = clone();
    delete noFlag.floors;
    expect(codes(noFlag)).toContain('floors_mismatch');
    const emptyUpper = clone();
    emptyUpper.rooms = emptyUpper.rooms.filter((r) => r.floor === 0);
    emptyUpper.openings = emptyUpper.openings.filter((o) => o.floor !== 1 && o.id !== 'st_hall_landing');
    expect(codes(emptyUpper)).toContain('floors_mismatch');
    const noUpper = clone();
    delete noUpper.upperFootprint;
    expect(codes(noUpper)).toContain('missing_upper_footprint');
  });

  it('warns for a floor-1 window that is not on the upper outline, without failing', () => {
    const loc = clone();
    loc.openings.push({ id: 'w_in', type: 'window', a: 'bedroom_u', b: 'bath_u', from: F(18, 5), to: F(18, 7), state: 'closed', glazing: 'double', floor: 1 });
    const issues = check(loc);
    expect(issues.some((i) => i.code === 'window_not_on_footprint' && i.severity === 'warning' && i.ref === 'w_in')).toBe(true);
    expect(errorsOf({ issues })).toEqual([]);
  });

  it('warns when the upper footprint overhangs the ground floor', () => {
    const loc = clone();
    loc.upperFootprint = [F(0, -2), F(24, -2), F(24, 8), F(0, 8)];
    expect(check(loc).some((i) => i.code === 'upper_footprint_overhang' && i.severity === 'warning')).toBe(true);
  });

  it('a window on a recessed upper outline needs no zone beside it', () => {
    // The fixture's upper floor stops at y = 8, so the kitchen roof lies south of it and no zone touches that wall.
    const loc = clone();
    loc.openings.push({ id: 'w_bed_s', type: 'window', a: 'bedroom_u', b: 'front_yard', from: F(11, 8), to: F(14, 8), state: 'closed', glazing: 'double', floor: 1 });
    expect(errorsOf({ issues: check(loc) })).toEqual([]);
  });

  it('shiftEdge variations move the upper footprint with the rest of the building', () => {
    const family: LocationFamily = {
      id: 'fixture_two_floor',
      version: 1,
      base: TWO_FLOOR_FIXTURE,
      variations: [{ kind: 'shiftEdge', id: 'east_wall', axis: 'x', at: 30, span: [6, 20], offsets: [0, 1] }],
    };
    const wide = applyChoices(family, { east_wall: 1 });
    expect(Math.max(...wide.upperFootprint!.map((p) => p.x))).toBe(31);
    expect(Math.max(...TWO_FLOOR_FIXTURE.upperFootprint!.map((p) => p.x))).toBe(30);
    expect(errorsOf({ issues: check(wide) })).toEqual([]);
  });
});
