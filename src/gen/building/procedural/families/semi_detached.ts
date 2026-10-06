import type { Shape } from '../footprint';
import { R, type Rect, unionPolygon } from '../geom';
import type { Rand } from '../rand';
import type { ExteriorSpec, FamilySpec, LotSpec, Plan } from '../types';
import { HOME_WINDOWS, STREET_NAMES, drawFootprint, no } from './common';
import { groundPool, upperPool } from './two_storey_house';
import { planTwoFloors } from './twofloor';

/** A narrow two-storey unit sharing one side wall with its neighbour; only this unit is drawn. */
export const SEMI: FamilySpec = {
  id: 'semi_detached',
  label: 'Duplex',
  setting: 'residential',
  floors: [2, 2],
  blurb: 'One half of a side-by-side duplex',
  shapes: ['rect', 'L'],
  fallbackSeed: 0,
  policy: {
    extWall: [['brick', 7], ['wood_frame', 3]],
    intWall: [['drywall', 7], ['plaster', 3]],
    floorCeiling: 'timber_joist',
    frontRooms: [['hall', 5], ['living', 2]],
    frontDoor: { material: [['solid_core', 7], ['glass', 1.5]], width: [3, 3.5] },
    backChance: 0.9,
    backRooms: [['kitchen', 3], ['hall', 1.5], ['utility', 2], ['dining', 1.5], ['living', 0.3]],
    backDoor: { material: [['glass', 4], ['solid_core', 4]], width: [3, 3] },
    sideChance: 0.1,
    intDoor: { material: 'hollow_core', width: [2.5, 3] },
    openPairs: [['living', 'kitchen', 0.5], ['living', 'dining', 0.9], ['kitchen', 'dining', 0.95], ['hall', 'living', 0.5], ['hall', 'dining', 0.4]],
    windowStyle: HOME_WINDOWS,
    loops: 2,
    throughOk: ['utility'],
  },
  name: (rng) => `${rng.int(2, 280)}${rng.pick(['', 'A', 'B'])} ${rng.pick(STREET_NAMES)}`,
  plan(rng: Rand, why) {
    const party = rng.pick(['e', 'w'] as const);
    const open = party === 'e' ? 'w' : 'e';
    const shape = rng.weighted<Shape>([['rect', 58], ['ext', 42]]);
    const fp = drawFootprint(rng, shape, [18, 22], [30, 42], [600, 1000], { minWing: 9, extAlign: open });
    if (!fp) return no(why, 'footprint');
    const { W, D: Dp } = fp;
    // The party side sits on the lot line with the neighbour's strip beside it; the open side keeps a passage.
    const passage = rng.snapped(3.5, 5.5);
    const ox = party === 'w' ? 6 : passage;
    const mr = party === 'e' ? 6 : passage;
    const oy = rng.snapped(5, 8);
    const mb = rng.snapped(12, 16);
    const lot: LotSpec = { ox, oy, w: ox + W + mr, h: oy + Dp + mb };
    const shift = (r: Rect) => R(r.x0 + ox, r.y0 + oy, r.x1 + ox, r.y1 + oy);
    const rects0 = fp.rects.map(shift);
    const rects1 = fp.rects.length > 1 && rng.chance(0.65) ? [rects0[0]] : rects0;
    const footprint = unionPolygon(rects0);
    const upperFootprint = unionPolygon(rects1);
    if (!footprint || !upperFootprint) return no(why, 'footprint_poly');
    const rooms = planTwoFloors(rng, { rects0, rects1, ground: groundPool(rng), upper: upperPool(rng), hw: [3.5, 4], minSide: 7, minCap: 8.5, capChance: 0.85, noWindow: [party] }, why);
    if (!rooms) return no(why, 'two_floor_plan');
    const plan: Plan = { floors: 2, footprint, upperFootprint, rooms, stair: { lower: 'stair_0', upper: 'stair_1' }, partyWalls: [party] };
    const ext: ExteriorSpec = { kind: 'semi', streetDepth: 0, alleyDepth: 0, driveway: null, sideStreet: null, porch: rng.chance(0.75), fences: true, parking: false, notes: [], neighbours: [party], corridor: false, bay: null, voidClass: 'front' };
    return { plan, lot, ext };
  },
};
