import { R, type Rect, unionPolygon } from '../geom';
import type { Rand } from '../rand';
import { CLOSET, D, bathSeeds, seed } from '../programme';
import { RoomMaker, layoutPieces, sampleStrip } from '../partition';
import type { ExteriorSpec, FamilySpec, LotSpec, Plan, RoomSeed } from '../types';
import { HOME_WINDOWS, no, poolArea, tagWhy } from './common';
import { FOYER, LANDING, planTwoFloors } from './twofloor';

const APT_STREETS = ['Mercer Court', 'Harbor Heights', 'Alder Gardens', 'Kestrel House', 'Linden Place', 'The Birches', 'Orchard Commons', 'Willow Court', 'Garnet Tower', 'Cedar Park Apartments'];

/** An apartment's rooms: living and bedrooms on the facade, kitchen and bath inside. */
function flatPool(rng: Rand, windowless: boolean, beds: number): RoomSeed[] {
  const baths = bathSeeds(rng, beds >= 2 ? 0.45 : 0.1, 0.2);
  const bed = (area: number, o: object = {}) => D.bedroom(area, { hall: false, cap: true, ...o });
  return [
    D.living(rng.snapped(170, 230), { min: 120, aspect: 2.6 }),
    D.kitchen(rng.snapped(90, 130), { min: 70, front: 0.2, windows: windowless ? 'none' : 'small' }),
    baths.ensuite && beds >= 2 ? bed(130, { ensuite: baths.ensuite, required: true }) : bed(130, { required: true }),
    ...(beds >= 2 ? [bed(rng.snapped(100, 125), { required: true })] : []),
    ...(beds >= 3 ? [bed(rng.snapped(90, 110), { required: true })] : []),
    ...baths.main,
    seed('storage', 'storage', { area: 34, min: 20, max: 70, minW: 5, tags: ['service', 'storage'], windows: 'none', prob: 0.4 + 0.1 * beds, hall: true }),
    D.utility(rng.snapped(36, 50), { prob: 0.2 + 0.1 * beds, windows: 'none' }),
    D.dining(rng.snapped(80, 105), { prob: 0.3, cap: true, min: 64 }),
    D.study(rng.snapped(70, 90), { prob: 0.12, hall: false, cap: true, min: 56, windows: 'normal' }),
  ];
}

export const APARTMENT: FamilySpec = {
  id: 'apartment_unit',
  label: 'Apartment',
  setting: 'apartment',
  floors: [1, 2],
  blurb: 'Apartment in a building',
  shapes: ['rect'],
  fallbackSeed: 0,
  frontSides: ['n'],
  backSides: [],
  policy: {
    extWall: [['concrete', 5], ['brick', 5]],
    intWall: [['drywall', 9], ['concrete', 1]],
    floorCeiling: 'concrete_slab',
    frontRooms: [['hall', 6], ['kitchen', 1], ['living', 1]],
    frontDoor: { material: [['solid_core', 8], ['steel', 2]], width: [3, 3] },
    backChance: 0,
    backRooms: [],
    backDoor: { material: [['solid_core', 1]], width: [3, 3] },
    sideChance: 0,
    balcony: { chance: 0.6, rooms: [['living', 4], ['bedroom', 1]], width: [5, 6] },
    intDoor: { material: 'hollow_core', width: [2.5, 3] },
    openPairs: [['living', 'kitchen', 0.75], ['hall', 'living', 0.5], ['hall', 'kitchen', 0.5]],
    pairWeights: { 'bedroom|living': 2.4 },
    windowStyle: HOME_WINDOWS,
    loops: 2,
    loopsMin: 1,
    throughOk: ['utility'],
  },
  name: (rng) => `${rng.pick(APT_STREETS)}, Unit ${rng.int(1, 4)}${rng.pick(['A', 'B', 'C', 'D', 'E', 'F'])}`,
  plan(rng: Rand, why0) {
    const maisonette = rng.chance(0.14);
    const beds = rng.weighted([[1, 45], [2, 40], [3, 15]] as const);
    // A linear flat has its hall along the corridor wall and every room on the facade.
    const linear = !maisonette && (beds >= 2 || rng.chance(0.35));
    const why = tagWhy(why0, maisonette ? 'maisonette' : `${linear ? 'linear' : 'flat'}${beds}`);
    const windowless = rng.chance(0.3);
    const seeds = maisonette ? [] : flatPool(rng, windowless, beds);
    const Dp = maisonette ? rng.snapped(28, 34) : linear ? rng.snapped(17.5, 19.5) : rng.snapped(22, 30);
    // A linear flat is as wide as its rooms need; the others draw a width for their bedroom count.
    const W = maisonette
      ? rng.snapped(18, 24)
      : linear
        ? rng.snapped(Math.max(26, (poolArea(seeds) * rng.range(1, 1.12)) / (Dp - 3.75)), 54)
        : rng.snapped([20, 26, 32][beds - 1], [28, 34, 40][beds - 1]);
    const ox = 10;
    const oy = 9;
    const lot: LotSpec = { ox, oy, w: ox + W + 10, h: oy + Dp + 14 };
    const rects: Rect[] = [R(ox, oy, ox + W, oy + Dp)];
    const footprint = unionPolygon(rects);
    if (!footprint) return no(why, 'footprint_poly');
    const noWindow = ['n', 'e', 'w'] as ('n' | 's' | 'e' | 'w')[];
    let plan: Plan;
    if (maisonette) {
      const ground: RoomSeed[] = [D.living(rng.snapped(170, 210), { aspect: 2.6 }), D.kitchen(rng.snapped(90, 120), { windows: 'small', front: 0.2 }), D.wc(rng.snapped(26, 34), { required: true })];
      const upper: RoomSeed[] = [D.bedroom(rng.snapped(130, 150), { required: true }), D.bedroom(rng.snapped(100, 125), { prob: 0.8 }), D.bath(rng.snapped(48, 60), { required: true })];
      const rooms = planTwoFloors(rng, { rects0: rects, rects1: rects, ground, upper, hw: [3.5, 4], minSide: 7, minCap: 8.5, capChance: 0.8, noWindow, keys: { hall: FOYER, landing: LANDING } }, why);
      if (!rooms) return no(why, 'two_floor_plan');
      plan = { floors: 2, footprint, upperFootprint: footprint, rooms, stair: { lower: 'stair_0', upper: 'stair_1' }, partyWalls: ['e', 'w'] };
    } else {
      const strip = linear
        ? sampleStrip(rng, rects, { hw: [3.5, 4], minSide: 9, minCap: 9, maxPieces: 2, minPieces: 1, longAxis: 1, axis: 'h', edge: true, lowEdge: true, full: 1, anchored: 0, noWindow })
        : sampleStrip(rng, rects, { hw: [3.5, 4.5], minSide: 7.5, minCap: 9, maxPieces: 4, longAxis: 0, axis: 'v', full: 0, anchored: 1, anchor: 'lo', noWindow, capDepth: [11.5, 15] });
      if (!strip) return no(why, 'strip');
      const maker = new RoomMaker();
      const rooms = layoutPieces(rng, maker, strip, seeds, 0, [], CLOSET);
      if (!rooms) return no(why, 'assign_slice');
      rooms.push(maker.make(D.hall({ windows: 'none' }), strip.strip, 0));
      plan = { floors: 1, footprint, rooms, partyWalls: ['e', 'w'] };
    }
    const ext: ExteriorSpec = { kind: 'apartment', streetDepth: 8, alleyDepth: 0, driveway: null, sideStreet: null, porch: false, fences: false, parking: false, notes: [], neighbours: ['w', 'e'], corridor: true, bay: null, voidClass: 'front' };
    return { plan, lot, ext };
  },
};
