import type { Shape } from '../footprint';
import { R, type Rect, unionPolygon, vec } from '../geom';
import type { Rand } from '../rand';
import { D, seed } from '../programme';
import type { ExteriorSpec, FamilySpec, LotSpec, Plan, RoomSeed } from '../types';
import { HOME_WINDOWS, drawFootprint, no, tagWhy } from './common';
import { FOYER, LANDING, planTwoFloors } from './twofloor';

const OWNERS = ['Kowalski', 'Tran', 'Okafor', 'Delmar', 'Haddad', 'Moreno', 'Patel', 'Nowak', 'Rossi', 'Abebe'];
const KINDS = ['Corner Store', 'Market', 'Convenience', 'Grocery', 'Mini Mart'];

function groundPool(rng: Rand): RoomSeed[] {
  return [
    seed('shop', 'retail', { area: rng.snapped(320, 480), min: 220, max: 720, minW: 12, aspect: 2.6, front: 1, cls: 'pub', cap: true, required: true, tags: ['public', 'shop', 'customer'], windows: 'storefront', label: 'Sales floor' }),
    seed('stockroom', 'storage', { area: rng.snapped(130, 190), min: 80, max: 300, minW: 7, aspect: 2.8, front: 0.1, cls: 'pub', cap: true, required: true, tags: ['service', 'staff', 'storage', 'stock'], windows: 'none', label: 'Stockroom' }),
    seed('backoffice', 'office', { area: rng.snapped(70, 95), min: 55, max: 150, minW: 7, front: 0.15, cls: 'leaf', tags: ['staff', 'private', 'office', 'lockable', 'valuables'], windows: 'small', prob: 0.8, label: 'Back office' }),
    D.wc(rng.snapped(26, 34), { required: true, hall: false, tags: ['water', 'lockable', 'wc', 'staff'], label: 'Restroom' }),
    seed('storage', 'storage', { area: 40, min: 26, max: 90, minW: 5, tags: ['service', 'storage'], windows: 'none', prob: 0.2 }),
  ];
}

function flatPool(rng: Rand): RoomSeed[] {
  return [
    D.living(rng.snapped(170, 230), { min: 120, aspect: 2.6, tags: ['public', 'living', 'residential'] }),
    D.kitchen(rng.snapped(100, 140), { min: 75 }),
    D.bedroom(rng.snapped(120, 150), { required: true }),
    D.bedroom(rng.snapped(100, 125), { prob: 0.6 }),
    D.bath(rng.snapped(48, 62), { required: true }),
    D.utility(rng.snapped(38, 50), { prob: 0.2, windows: 'none' }),
    seed('storage', 'storage', { area: 28, min: 20, max: 60, minW: 5, tags: ['service', 'storage'], windows: 'none', prob: 0.25, hall: true }),
  ];
}

export const CORNER_STORE: FamilySpec = {
  id: 'corner_store_flat',
  label: 'Corner store with apartment',
  setting: 'business',
  floors: [2, 2],
  blurb: 'Corner store with an apartment above',
  shapes: ['rect', 'L', 'chamfer'],
  fallbackSeed: 0,
  policy: {
    extWall: [['brick', 7], ['concrete', 3]],
    intWall: [['drywall', 8], ['plaster', 2]],
    floorCeiling: 'concrete_slab',
    frontRooms: [['shop', 1]],
    frontDoor: { material: [['glass', 7], ['solid_core', 1]], width: [3, 4] },
    extraDoors: [{ kind: 'flat', chance: 1, rooms: [['hall', 1]], sides: ['s'], door: { material: [['solid_core', 6], ['steel', 3]], width: [3, 3] } }],
    backChance: 0.95,
    backRooms: [['stockroom', 4], ['backoffice', 1], ['storage', 1]],
    backDoor: { material: [['steel', 7], ['solid_core', 2]], width: [3, 3.5] },
    sideChance: 0.15,
    intDoor: { material: 'hollow_core', width: [3, 3.5] },
    steelDoors: ['backoffice', 'stockroom'],
    openPairs: [['living', 'kitchen', 0.6], ['hall', 'living', 0.2]],
    pairWeights: {
      'shop|stockroom': 0.7,
      'backoffice|shop': 1.6,
      'backoffice|stockroom': 0.8,
      'stockroom|wc': 0.8,
      'backoffice|wc': 1.0,
      'shop|wc': 2.6,
      'hall|shop': 2.4,
      'hall|stockroom': 1.8,
      'hall|wc': 1.2,
      'hall|storage': 1.2,
      'stockroom|storage': 0.9,
    },
    windowStyle: {
      ...HOME_WINDOWS,
      shop: { glazing: [['security', 4], ['double', 6]], covering: [['none', 6], ['blinds', 4]] },
      backoffice: { glazing: [['security', 3], ['double', 7]], covering: [['blinds', 8], ['none', 2]] },
    },
    loops: 1,
  },
  name: (rng) => `${rng.pick(OWNERS)}'s ${rng.pick(KINDS)}`,
  plan(rng: Rand, why0) {
    const shape = rng.weighted<Shape>([['rect', 62], ['L', 38]]);
    const why = tagWhy(why0, shape);
    const stairLo = rng.chance(0.5);
    const cornerLot = rng.chance(0.65);
    const fp = drawFootprint(rng, shape, [24, 32], [34, 46], [800, 1500], { minWing: 12, cuts: ['nw', 'ne'] });
    if (!fp) return no(why, 'footprint');
    // The stair column and its party wall are on one side; a side street (if any) on the other.
    const partySide = stairLo ? 'w' : 'e';
    const openSide = stairLo ? 'e' : 'w';
    const streetDepth = 8;
    const alley = 9;
    const left = partySide === 'w' ? 6 : cornerLot ? streetDepth : 6;
    const right = partySide === 'e' ? 6 : cornerLot ? streetDepth : 6;
    const lot: LotSpec = { ox: left, oy: alley, w: left + fp.W + right, h: alley + fp.D + streetDepth };
    const shift = (r: Rect) => R(r.x0 + left, r.y0 + alley, r.x1 + left, r.y1 + alley);
    const rects = fp.rects.map(shift);
    const footprint = unionPolygon(rects);
    if (!footprint) return no(why, 'footprint_poly');
    const parties: ('e' | 'w')[] = cornerLot ? [partySide] : ['e', 'w'];
    const rooms = planTwoFloors(rng, { rects0: rects, rects1: rects, ground: groundPool(rng), upper: flatPool(rng), hw: [3.5, 4.5], minSide: 7, minCap: 8.5, capChance: 0.35, noWindow: parties, keys: { hall: FOYER, landing: LANDING }, stairFront: true, stairLo }, why);
    if (!rooms) return no(why, 'two_floor_plan');
    const chamfer = cornerLot && rng.chance(0.6);
    const corner = openSide === 'e' ? vec(left + fp.W, alley + fp.D) : vec(left, alley + fp.D);
    const plan: Plan = {
      floors: 2,
      footprint,
      upperFootprint: footprint,
      rooms,
      stair: { lower: 'stair_0', upper: 'stair_1' },
      partyWalls: parties,
      // At least 4.5 ft: a door on the cut corner needs its 1.5 ft staging point 1 ft clear of both legs.
      ...(chamfer ? { chamfer: { corner, leg: rng.snapped(4.5, 6) } } : {}),
    };
    const ext: ExteriorSpec = { kind: 'shop', streetDepth, alleyDepth: alley, driveway: null, sideStreet: cornerLot ? openSide : null, porch: false, fences: false, parking: false, notes: [], neighbours: parties, corridor: false, bay: null, voidClass: 'back' };
    return { plan, lot, ext };
  },
};
