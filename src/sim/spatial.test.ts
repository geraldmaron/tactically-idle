import { describe, expect, it } from 'vitest';
import { AIR_FALLOFF_PER_FT, DOORS, GLAZING, WALLS } from '../content/materials';
import { MAPLE_STREET } from '../content/locations/maple-street';
import { buildLocation, deriveLocation, pointInPolygon } from './location';
import { validateLocation } from './location-validate';
import {
  bestSignal,
  describeConstruction,
  nearestOpening,
  signalBetween,
  spaceAt,
  stagingPointById,
  stagingPointsIn,
  wallMaterialBetween,
} from './spatial';
import type { Channel } from './spatial';
import type { BuiltLocation, LocationDefinition, Vec } from './types';

const CHANNELS: Channel[] = ['sound', 'thermal', 'radio', 'visual'];
/** House-local feet (as authored) to lot feet. */
const L = (x: number, y: number): Vec => ({ x: x + 6, y: y + 4 });

/** A fresh Maple Street (seed 0) with a tweak applied before deriving, so nothing is mutated after caching. */
function variant(tweak: (loc: LocationDefinition) => void = () => {}): BuiltLocation {
  const location = structuredClone(MAPLE_STREET.base);
  tweak(location);
  const derived = deriveLocation(location);
  return { location, derived, issues: validateLocation(location, derived) };
}
const opening = (loc: LocationDefinition, id: string) => {
  const o = loc.openings.find((x) => x.id === id);
  if (!o) throw new Error(`no opening ${id}`);
  return o;
};
const air = (channel: Channel, d: number) => Math.max(0, 1 - AIR_FALLOFF_PER_FT[channel] * d);

// Straight through d_hall_bede (house y 9.2..11.5 on x = 21): hall side to bedroom side.
const HALL_SIDE = L(19.5, 10.35);
const BED_THROUGH_DOOR = L(24, 10.35);

describe('door material and state', () => {
  it('solid-core lowers sound versus hollow-core, and only the door layer changes', () => {
    const hollow = signalBetween(variant(), HALL_SIDE, BED_THROUGH_DOOR, 'sound');
    const solid = signalBetween(
      variant((l) => {
        opening(l, 'd_hall_bede').material = 'solid_core';
      }),
      HALL_SIDE,
      BED_THROUGH_DOOR,
      'sound',
    );
    expect(solid.transmission).toBeLessThan(hollow.transmission);
    expect(hollow.transmission).toBeCloseTo(DOORS.hollow_core.sound * air('sound', hollow.distance), 10);
    expect(solid.transmission).toBeCloseTo(DOORS.solid_core.sound * air('sound', solid.distance), 10);
    expect(hollow.blockers.map((b) => b.label)).toEqual(['Hollow-core door (closed)']);
    expect(solid.blockers.map((b) => b.label)).toEqual(['Solid-core door (closed)']);
    expect(solid.blockers[0]).toMatchObject({ kind: 'opening', id: 'd_hall_bede' });
  });

  it('an open door passes sound with air falloff only', () => {
    const open = signalBetween(
      variant((l) => {
        opening(l, 'd_hall_bede').state = 'open';
      }),
      HALL_SIDE,
      BED_THROUGH_DOOR,
      'sound',
    );
    const closed = signalBetween(variant(), HALL_SIDE, BED_THROUGH_DOOR, 'sound');
    expect(open.transmission).toBeCloseTo(air('sound', open.distance), 10);
    expect(open.transmission).toBeGreaterThan(closed.transmission);
    expect(open.blockers).toEqual([]);
    expect(open.clear).toBe(true);
  });

  it('a locked door transmits like a closed one and says so; a blocked door acts as wall', () => {
    const locked = signalBetween(
      variant((l) => {
        opening(l, 'd_hall_bede').state = 'locked';
      }),
      HALL_SIDE,
      BED_THROUGH_DOOR,
      'sound',
    );
    expect(locked.blockers[0].label).toBe('Hollow-core door (locked)');
    const blocked = signalBetween(
      variant((l) => {
        opening(l, 'd_hall_bede').state = 'blocked';
      }),
      HALL_SIDE,
      BED_THROUGH_DOOR,
      'sound',
    );
    expect(blocked.blockers.map((b) => b.label)).toEqual(['Drywall wall']);
  });
});

describe('wall material', () => {
  // Bedroom (west) to living through the plain drywall wall at house y = 13.
  const a = L(6, 8);
  const b = L(6, 18);

  it('brick versus drywall on the same segment: thermal and sound differ in the right direction', () => {
    const drywall = (ch: Channel) => signalBetween(variant(), a, b, ch);
    const brick = (ch: Channel) =>
      signalBetween(
        variant((l) => {
          l.materials.interior = 'brick';
        }),
        a,
        b,
        ch,
      );
    for (const ch of ['sound', 'thermal', 'radio'] as Channel[]) expect(brick(ch).transmission, ch).toBeLessThan(drywall(ch).transmission);
    expect(drywall('sound').blockers.map((x) => x.label)).toEqual(['Drywall wall']);
    expect(brick('sound').blockers.map((x) => x.label)).toEqual(['Brick wall']);
    expect(drywall('thermal').transmission / air('thermal', 10)).toBeCloseTo(WALLS.drywall.thermal, 10);
    expect(brick('thermal').transmission / air('thermal', 10)).toBeCloseTo(WALLS.brick.thermal, 10);
  });

  it('radio barely changes through drywall', () => {
    const r = signalBetween(variant(), a, b, 'radio');
    expect(r.transmission / air('radio', 10)).toBeCloseTo(WALLS.drywall.radio, 10);
    expect(r.transmission / air('radio', 10)).toBeGreaterThanOrEqual(0.9);
    expect(signalBetween(variant(), a, b, 'thermal').transmission).toBeLessThan(0.15 * air('thermal', 10));
  });

  it('an unbroken wall shared by two room polygons is counted once', () => {
    const r = signalBetween(variant(), L(19.5, 13.5), L(24, 11), 'sound');
    expect(r.blockers.map((x) => x.label)).toEqual(['Drywall wall']);
  });

  it('uses the override for its pair and the exterior material for walls to zones', () => {
    const built = variant();
    expect(wallMaterialBetween(built, 'bath', 'bedroom_e')).toBe('plaster');
    expect(wallMaterialBetween(built, 'bedroom_e', 'bath')).toBe('plaster');
    expect(wallMaterialBetween(built, 'hall', 'bedroom_e')).toBe('drywall');
    expect(wallMaterialBetween(built, 'living', 'porch')).toBe('brick');
    expect(wallMaterialBetween(built, 'living', 'hall')).toBe('drywall');
    // bath -> bedroom_e across the override
    const r = signalBetween(built, L(19, 5), L(24, 5), 'sound');
    expect(r.blockers.map((x) => x.label)).toEqual(['Lath and plaster wall']);
  });

  it('open ground between zones adds nothing', () => {
    const r = signalBetween(variant(), L(-4, 20), L(-4, -2), 'sound');
    expect(r.blockers).toEqual([]);
  });
});

describe('windows and coverings', () => {
  // Front yard through w_living_s (house x 4..9 on y = 28) into the living room.
  const outside = L(6.5, 31);
  const inside = L(6.5, 25);
  const covered = (c: 'none' | 'curtains' | 'blinds') =>
    variant((l) => {
      opening(l, 'w_living_s').covering = c;
    });

  it('curtains lower visual but not sound', () => {
    const none = covered('none');
    const curtains = covered('curtains');
    const v0 = signalBetween(none, outside, inside, 'visual');
    const v1 = signalBetween(curtains, outside, inside, 'visual');
    expect(v1.transmission).toBeLessThan(v0.transmission);
    expect(v0.transmission / air('visual', v0.distance)).toBeCloseTo(GLAZING.double.visual, 10);
    expect(v1.transmission / v0.transmission).toBeCloseTo(0.05, 10);
    expect(signalBetween(curtains, outside, inside, 'sound').transmission).toBe(signalBetween(none, outside, inside, 'sound').transmission);
    expect(signalBetween(curtains, outside, inside, 'thermal').transmission).toBe(signalBetween(none, outside, inside, 'thermal').transmission);
    expect(v1.blockers.map((x) => x.label)).toEqual(['Double-glazed window, curtains drawn']);
    expect(signalBetween(covered('blinds'), outside, inside, 'visual').blockers[0].label).toBe('Double-glazed window, blinds drawn');
  });

  it('thermal does not cross glazing', () => {
    expect(signalBetween(variant(), outside, inside, 'thermal').transmission).toBeLessThan(0.02);
  });
});

describe('blocking objects', () => {
  const a = L(23, 22.7);
  const b = L(32, 22.7); // across the kitchen table
  const tagged = variant((l) => {
    l.objects.find((o) => o.id === 'o_kit_table')?.tags.push('blocks_sight');
  });
  const plain = variant();

  it('blocks_sight lowers visual and thermal but not sound or radio', () => {
    expect(signalBetween(tagged, a, b, 'visual').transmission).toBeCloseTo(signalBetween(plain, a, b, 'visual').transmission * 0.1, 10);
    expect(signalBetween(tagged, a, b, 'thermal').transmission).toBeCloseTo(signalBetween(plain, a, b, 'thermal').transmission * 0.1, 10);
    expect(signalBetween(tagged, a, b, 'sound')).toEqual(signalBetween(plain, a, b, 'sound'));
    expect(signalBetween(tagged, a, b, 'radio')).toEqual(signalBetween(plain, a, b, 'radio'));
    expect(signalBetween(tagged, a, b, 'visual').blockers).toEqual([{ kind: 'object', id: 'o_kit_table', label: 'Dining table', transmission: 0.1 }]);
    expect(signalBetween(plain, a, b, 'visual').blockers).toEqual([]);
  });

  it('concealment blocks the same way, and a segment that misses the object is unaffected', () => {
    // The east bedroom wardrobe (concealment + blocks_sight) between two points in the room.
    const through = signalBetween(plain, L(21.2, 3), L(26, 3), 'visual');
    expect(through.blockers.map((x) => x.label)).toEqual(['Wardrobe']);
    const miss = signalBetween(plain, L(21.2, 8.5), L(26, 8.5), 'visual');
    expect(miss.blockers).toEqual([]);
  });

  it('wardrobes in Maple Street carry blocks_sight', () => {
    for (const id of ['o_bedw_wardrobe', 'o_bede_wardrobe']) expect(MAPLE_STREET.base.objects.find((o) => o.id === id)?.tags).toContain('blocks_sight');
  });
});

describe('air falloff', () => {
  it('moving the target further away lowers every channel, monotonically', () => {
    const built = variant();
    const from = L(2, 20.5);
    for (const ch of CHANNELS) {
      let last = Infinity;
      for (const x of [5, 8, 11, 14, 17]) {
        const r = signalBetween(built, from, L(x, 20.5), ch);
        expect(r.blockers, `${ch} x=${x}`).toEqual([]);
        expect(r.transmission, `${ch} x=${x}`).toBeLessThan(last);
        last = r.transmission;
      }
    }
  });

  it('clamps at zero and is exactly 1 at zero distance', () => {
    const built = variant();
    expect(signalBetween(built, L(2, 20.5), L(2, 20.5), 'sound').transmission).toBe(1);
    expect(signalBetween(built, L(-30, 40), L(80, 40), 'sound').transmission).toBe(0);
  });
});

describe('bestSignal', () => {
  // Hall-side point of d_hall_bede to a spot in the east bedroom that the door does not line up with.
  const target = L(24, 3);

  it('sound from the door\'s hall-side staging point routes via that door and beats the straight line through the wall', () => {
    const built = variant();
    const sp = stagingPointById(built, 'sp_d_hall_bede_hall');
    expect(sp).toBeDefined();
    const from = (sp as NonNullable<typeof sp>).at;
    expect(spaceAt(built, from)).toBe('hall');
    const straight = signalBetween(built, from, target, 'sound');
    const best = bestSignal(built, from, target, 'sound');
    expect(best.via).toBe('d_hall_bede');
    expect(best.transmission).toBeGreaterThan(straight.transmission);
    expect(best.blockers.map((x) => x.label)).toEqual(['Hollow-core door (closed)']);
    expect(best.distance).toBeCloseTo(straight.distance, 10);
  });

  it('keeps the straight line when it is already the best route', () => {
    const built = variant();
    const r = bestSignal(built, HALL_SIDE, BED_THROUGH_DOOR, 'sound');
    expect(r.via).toBeNull();
    expect(r.transmission).toBe(signalBetween(built, HALL_SIDE, BED_THROUGH_DOOR, 'sound').transmission);
  });

  it('visual bends through openings too; thermal and radio use the straight line only', () => {
    const built = variant((l) => {
      opening(l, 'd_hall_bede').state = 'open';
    });
    expect(bestSignal(built, HALL_SIDE, L(27, 4), 'visual').via).toBe('d_hall_bede');
    for (const ch of ['thermal', 'radio'] as Channel[]) {
      const r = bestSignal(built, HALL_SIDE, target, ch);
      expect(r.via).toBeNull();
      expect(r.transmission).toBe(signalBetween(built, HALL_SIDE, target, ch).transmission);
    }
  });

  it('never beats the straight line when the source is already in the target space', () => {
    const built = variant();
    expect(bestSignal(built, L(23, 8), L(26, 2), 'sound').via).toBeNull();
  });
});

describe('spaceAt, nearestOpening, describeConstruction', () => {
  const built = variant();

  it('finds the space at a point, rooms and zones', () => {
    expect(spaceAt(built, L(24, 3))).toBe('bedroom_e');
    expect(spaceAt(built, L(16, 12))).toBe('hall');
    expect(spaceAt(built, { x: 2, y: 2 })).toBe('back_yard');
    expect(spaceAt(built, { x: 24, y: 34 })).toBe('porch');
    expect(spaceAt(built, { x: 200, y: 200 })).toBeNull();
  });

  it('nearestOpening filters by type and measures to the opening midpoint', () => {
    const p = L(24, 3);
    const door = nearestOpening(built, 'bedroom_e', p, ['door']);
    expect(door?.opening.id).toBe('d_hall_bede');
    expect(door?.distance).toBeCloseTo(Math.hypot(L(21, 10.35).x - p.x, L(21, 10.35).y - p.y), 10);
    expect(nearestOpening(built, 'bedroom_e', p, ['window'])?.opening.id).toBe('w_bede_n');
    expect(nearestOpening(built, 'bedroom_e', p)?.opening.id).toBe('w_bede_n');
    expect(nearestOpening(built, 'bedroom_e', p, ['sliding'])).toBeNull();
    expect(nearestOpening(built, 'nowhere', p)).toBeNull();
  });

  it('describes construction in player language', () => {
    expect(describeConstruction(built, 'bedroom_e')).toEqual([
      'Brick exterior walls',
      'Drywall interior walls',
      'Lath and plaster wall to the bath',
      'Hollow-core door to the hall',
      '2 double-glazed windows (1 with blinds, 1 curtained)',
    ]);
    expect(describeConstruction(built, 'hall')).toEqual([
      'Drywall interior walls',
      'Hollow-core door to the living (open)',
      'Hollow-core door to the bath',
      'Hollow-core door to the bedroom',
      'Hollow-core door to the bedroom',
    ]);
    expect(describeConstruction(built, 'nowhere')).toEqual([]);
  });

  it('describes openings with their state and unknown windows without coverings', () => {
    const lines = describeConstruction(
      variant((l) => {
        opening(l, 'd_front').state = 'locked';
      }),
      'living',
    );
    expect(lines).toContain('Solid-core door to the porch (locked)');
    expect(lines).toContain('Open doorway to the kitchen');
    expect(lines).toContain('2 double-glazed windows (1 curtained)');
  });
});

describe('staging points', () => {
  it('exist for every door, doorway and window on both sides, inside their spaces, seeds 0..49', () => {
    for (let seed = 0; seed < 50; seed++) {
      const built = buildLocation('maple_street', seed);
      const zoneIds = new Set(built.location.zones.map((z) => z.id));
      const polys = new Map<string, Vec[]>([...built.location.rooms, ...built.location.zones].map((s) => [s.id, s.polygon]));
      const expected = built.location.openings.filter((o) => !(o.type === 'doorway' && zoneIds.has(o.a) && zoneIds.has(o.b)));
      expect(built.derived.stagingPoints.length, `seed ${seed}`).toBe(expected.length * 2);
      for (const o of expected) {
        const m = { x: (o.from.x + o.to.x) / 2, y: (o.from.y + o.to.y) / 2 };
        for (const [space, faces] of [[o.a, o.b], [o.b, o.a]] as const) {
          const sp = built.derived.stagingPoints.find((s) => s.id === `sp_${o.id}_${space}`);
          expect(sp, `seed ${seed} ${o.id} ${space}`).toBeDefined();
          if (!sp) continue;
          expect(sp).toMatchObject({ spaceId: space, facesId: faces, openingId: o.id });
          expect(pointInPolygon(sp.at, polys.get(space) as Vec[]), `seed ${seed} ${sp.id} inside`).toBe(true);
          expect(Math.hypot(sp.at.x - m.x, sp.at.y - m.y), `seed ${seed} ${sp.id} offset`).toBeGreaterThan(0.4);
          expect(Math.hypot(sp.at.x - m.x, sp.at.y - m.y)).toBeLessThanOrEqual(1.5 + 1e-9);
        }
      }
      expect(built.issues.filter((i) => i.code === 'staging_point_outside_space')).toEqual([]);
    }
  });

  it('sits 1.5 ft out along the wall normal in the base layout', () => {
    const built = variant();
    const sp = stagingPointById(built, 'sp_d_hall_bede_bedroom_e');
    expect(sp?.at.x).toBeCloseTo(L(22.5, 0).x, 10);
    expect(sp?.at.y).toBeCloseTo(L(0, 10.35).y, 10);
    expect(sp?.kind).toBe('door');
    expect(stagingPointById(built, 'sp_w_bede_n_back_yard')?.kind).toBe('window');
    expect(stagingPointById(built, 'sp_dw_living_kitchen_kitchen')?.kind).toBe('doorway');
    expect(stagingPointsIn(built, 'hall').map((s) => s.openingId).sort()).toEqual(['d_hall_bath', 'd_hall_bede', 'd_hall_bedw', 'd_hall_living']);
  });

  it('gives zone-to-zone paths no staging points', () => {
    const built = variant();
    expect(built.derived.stagingPoints.some((s) => s.openingId.startsWith('p_'))).toBe(false);
  });
});
