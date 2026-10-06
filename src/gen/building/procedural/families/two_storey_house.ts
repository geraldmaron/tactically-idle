import type { Shape } from '../footprint';
import { R, type Rect, unionPolygon } from '../geom';
import type { Rand } from '../rand';
import { D, bathSeeds, seed } from '../programme';
import type { ExteriorSpec, FamilySpec, LotSpec, Plan, RoomSeed } from '../types';
import { HOME_WINDOWS, STREET_NAMES, drawFootprint, no } from './common';
import { planTwoFloors } from './twofloor';

export function groundPool(rng: Rand): RoomSeed[] {
  return [
    D.living(rng.snapped(190, 250)),
    D.kitchen(rng.snapped(130, 190)),
    D.dining(rng.snapped(100, 140), { prob: 0.45 }),
    D.wc(rng.snapped(26, 36), { required: true }),
    D.utility(rng.snapped(40, 55), { prob: 0.3 }),
    D.study(rng.snapped(90, 110), { prob: 0.2 }),
  ];
}

export function upperPool(rng: Rand): RoomSeed[] {
  const baths = bathSeeds(rng, 0.2, 0.35);
  const master = baths.ensuite ? D.bedroom(150, { ensuite: baths.ensuite, required: true }) : D.bedroom(150, { required: true });
  return [
    master,
    D.bedroom(rng.snapped(110, 140), { required: true }),
    D.bedroom(rng.snapped(100, 130), { prob: 0.7 }),
    D.bedroom(rng.snapped(95, 120), { prob: 0.3 }),
    ...baths.main,
    seed('storage', 'storage', { area: 30, min: 24, max: 50, minW: 5, tags: ['service', 'storage'], windows: 'none', prob: 0.2, hall: true }),
    D.study(rng.snapped(90, 105), { prob: 0.1 }),
  ];
}

export const TWO_STOREY: FamilySpec = {
  id: 'two_storey_house',
  label: 'Two-storey house',
  setting: 'residential',
  floors: [2, 2],
  blurb: 'Two-storey house',
  shapes: ['rect', 'L'],
  fallbackSeed: 0,
  policy: {
    extWall: [['brick', 5], ['wood_frame', 5]],
    intWall: [['drywall', 8], ['plaster', 2]],
    floorCeiling: 'timber_joist',
    frontRooms: [['hall', 5], ['living', 2]],
    frontDoor: { material: [['solid_core', 7], ['glass', 1.5]], width: [3, 3.5] },
    backChance: 0.85,
    backRooms: [['kitchen', 3], ['hall', 1], ['utility', 2], ['dining', 1.5], ['living', 0.3]],
    backDoor: { material: [['glass', 4], ['solid_core', 4]], width: [3, 3] },
    sideChance: 0.15,
    intDoor: { material: 'hollow_core', width: [2.5, 3] },
    openPairs: [['living', 'kitchen', 0.5], ['living', 'dining', 0.9], ['kitchen', 'dining', 0.95], ['hall', 'living', 0.5], ['hall', 'dining', 0.4]],
    windowStyle: HOME_WINDOWS,
    loops: 1,
  },
  name: (rng) => `${rng.int(12, 480)} ${rng.pick(STREET_NAMES)}`,
  plan(rng: Rand, why) {
    const shape = rng.weighted<Shape>([['rect', 36], ['L', 26], ['ext', 30], ['notch', 8]]);
    const fp = drawFootprint(rng, shape, [24, 34], [28, 38], [700, 1250], { minWing: 11 });
    if (!fp) return no(why, 'footprint');
    const { W, D: Dp } = fp;
    const driveway = rng.chance(0.3) ? rng.pick(['e', 'w'] as const) : null;
    const ox = driveway === 'w' ? rng.snapped(10, 12) : rng.snapped(5, 8);
    const mr = driveway === 'e' ? rng.snapped(10, 12) : rng.snapped(5, 8);
    const oy = rng.snapped(5, 8);
    const mb = rng.snapped(12, 17);
    const lot: LotSpec = { ox, oy, w: ox + W + mr, h: oy + Dp + mb };
    const shift = (r: Rect) => R(r.x0 + ox, r.y0 + oy, r.x1 + ox, r.y1 + oy);
    const rects0 = fp.rects.map(shift);
    // The smaller wing may stay single-storey.
    const rects1 = fp.rects.length > 1 && (shape === 'ext' ? rng.chance(0.65) : shape === 'L' || shape === 'notch' ? rng.chance(0.2) : false) ? [rects0[0]] : rects0;
    const footprint = unionPolygon(rects0);
    const upperFootprint = unionPolygon(rects1);
    if (!footprint || !upperFootprint) return no(why, 'footprint_poly');
    const rooms = planTwoFloors(rng, { rects0, rects1, ground: groundPool(rng), upper: upperPool(rng), hw: [3.5, 4.5], minSide: 8, minCap: 8.5, capChance: 0.3 }, why);
    if (!rooms) return no(why, 'two_floor_plan');
    const plan: Plan = { floors: 2, footprint, upperFootprint, rooms, stair: { lower: 'stair_0', upper: 'stair_1' }, partyWalls: [] };
    const ext: ExteriorSpec = { kind: 'house', streetDepth: 0, alleyDepth: 0, driveway, sideStreet: null, porch: rng.chance(0.7), fences: true, parking: false, notes: [], neighbours: [], corridor: false, bay: null, voidClass: 'front' };
    return { plan, lot, ext };
  },
};
