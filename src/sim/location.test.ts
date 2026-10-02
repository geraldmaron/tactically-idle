import { describe, expect, it } from 'vitest';
import { MAPLE_STREET } from '../content/locations/maple-street';
import { INVALID_FIXTURES, VALID_TINY } from '../content/locations/test-fixtures';
import { buildLocation, deriveLocation } from './location';
import { applyChoices, applyVariations, variationChoices } from './location-variation';
import type { VariationChoice } from './location-variation';
import { assertPlayable, validateLocation } from './location-validate';
import type { BuiltLocation, LocationDefinition } from './types';

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
