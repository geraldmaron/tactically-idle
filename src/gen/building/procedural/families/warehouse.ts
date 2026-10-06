import { R, type Rect, unionPolygon } from '../geom';
import type { Rand } from '../rand';
import { D, seed } from '../programme';
import { RoomMaker, layoutPieces, sampleStrip } from '../partition';
import type { ExteriorSpec, FamilySpec, LotSpec, Plan, RoomSeed } from '../types';
import { no, tagWhy } from './common';
import { planTwoFloors } from './twofloor';

const OWNERS = ['Ridgeway', 'Carmody', 'Northgate', 'Halvorsen', 'Bellamy', 'Ironbridge', 'Oakhurst', 'Tidewater'];
const TRADES = ['Freight', 'Supply', 'Fabrication', 'Distribution', 'Storage', 'Auto Parts', 'Millwork', 'Wholesale'];

const FLOOR = seed('floor', 'storage', { area: 1400, min: 500, max: 4000, minW: 20, aspect: 3, front: 0.3, cls: 'pub', cap: true, required: true, tags: ['open', 'warehouse', 'storage', 'high_capacity'], windows: 'high', label: 'Warehouse floor' });
const CORRIDOR = seed('corridor', 'hall', { area: 60, min: 24, max: 300, minW: 4, aspect: 99, cls: 'circ', tags: ['circulation', 'narrow'], windows: 'none', label: 'Corridor' });
const LANDING = seed('landing', 'hall', { area: 40, min: 12, max: 160, minW: 3.5, aspect: 99, cls: 'circ', tags: ['circulation', 'narrow'], windows: 'small', label: 'Landing' });

function blockPool(rng: Rand): RoomSeed[] {
  return [
    seed('reception', 'office', { area: rng.snapped(110, 160), min: 80, max: 260, minW: 9, aspect: 2.5, front: 1, cls: 'pub', cap: true, required: true, tags: ['public', 'reception', 'customer', 'office'], windows: 'large', label: 'Front office' }),
    seed('manager', 'office', { area: rng.snapped(90, 120), min: 64, max: 170, minW: 8, aspect: 2.4, front: 0.5, cls: 'leaf', hall: true, prob: 0.7, tags: ['staff', 'private', 'office', 'lockable', 'valuables'], windows: 'normal', label: 'Manager office' }),
    D.wc(rng.snapped(34, 46), { required: true, tags: ['water', 'lockable', 'wc', 'staff'], label: 'Restroom' }),
    D.wc(rng.snapped(30, 40), { prob: 0.4, tags: ['water', 'lockable', 'wc', 'staff'], label: 'Restroom' }),
    seed('break_room', 'kitchen', { area: rng.snapped(80, 110), min: 56, max: 170, minW: 8, hall: true, front: 0.4, cls: 'leaf', prob: 0.8, tags: ['staff', 'cooking', 'water'], windows: 'small', label: 'Break room' }),
    seed('storage', 'storage', { area: 60, min: 30, max: 120, minW: 5.5, hall: true, tags: ['service', 'storage'], windows: 'none', prob: 0.4 }),
    seed('storage', 'storage', { area: 70, min: 36, max: 130, minW: 6, hall: true, tags: ['service', 'storage', 'valuables'], windows: 'none', prob: 0.3, label: 'Tool crib' }),
    seed('locker_room', 'utility', { area: 70, min: 44, max: 130, minW: 6, hall: true, cls: 'leaf', tags: ['staff', 'service'], windows: 'small', prob: 0.35, label: 'Locker room' }),
    seed('server', 'storage', { area: 36, min: 26, max: 80, minW: 5.5, hall: true, tags: ['service', 'server', 'valuables', 'hazard'], windows: 'none', prob: 0.25, label: 'Server room' }),
  ];
}

function mezzPool(rng: Rand): RoomSeed[] {
  return [
    seed('mezz_office', 'office', { area: rng.snapped(130, 190), min: 90, max: 280, minW: 9, aspect: 2.5, hall: true, required: true, cls: 'leaf', tags: ['staff', 'work', 'office', 'lockable'], windows: 'large', label: 'Mezzanine office' }),
    seed('mezz_office', 'office', { area: rng.snapped(100, 140), min: 70, max: 200, minW: 9, aspect: 2.5, hall: true, prob: 0.55, cls: 'leaf', tags: ['staff', 'work', 'office', 'lockable'], windows: 'normal', label: 'Mezzanine office' }),
    seed('storage', 'storage', { area: 60, min: 30, max: 130, minW: 5.5, hall: true, tags: ['service', 'storage'], windows: 'none', prob: 0.5 }),
  ];
}

export const WAREHOUSE: FamilySpec = {
  id: 'warehouse',
  label: 'Warehouse or workshop',
  setting: 'business',
  floors: [1, 2],
  blurb: 'Warehouse or workshop',
  shapes: ['rect', 'L', 'T'],
  fallbackSeed: 0,
  policy: {
    extWall: [['concrete', 6], ['brick', 3]],
    intWall: [['drywall', 7], ['concrete', 3]],
    floorCeiling: 'concrete_slab',
    frontRooms: [['corridor', 5], ['reception', 4]],
    frontDoor: { material: [['glass', 4], ['steel', 4], ['solid_core', 2]], width: [3, 3.5] },
    extraDoors: [
      { kind: 'dock', chance: 1, rooms: [['floor', 1]], sides: ['n'], door: { material: [['steel', 1]], width: [8, 12], sliding: true }, spare: 2 },
      { kind: 'dock2', chance: 0.55, rooms: [['floor', 1]], sides: ['n'], door: { material: [['steel', 1]], width: [8, 12], sliding: true }, spare: 2 },
    ],
    backChance: 0.85,
    backRooms: [['floor', 3], ['corridor', 1]],
    backDoor: { material: [['steel', 7], ['solid_core', 2]], width: [3, 3.5] },
    sideChance: 0.3,
    intDoor: { material: 'hollow_core', width: [3, 3.5] },
    steelDoors: ['floor'],
    openPairs: [],
    pairWeights: { 'corridor|floor': 1.0, 'floor|reception': 2.5, 'floor|manager': 3.5, 'floor|storage': 3.0 },
    windowStyle: {
      default: { glazing: [['double', 7], ['single', 3]], covering: [['blinds', 6], ['none', 4]] },
      floor: { glazing: [['single', 6], ['double', 3], ['security', 1]], covering: [['none', 10]] },
      wc: { glazing: [['single', 6], ['double', 4]], covering: [['blinds', 8], ['none', 2]] },
    },
    loops: 0,
  },
  name: (rng) => `${rng.pick(OWNERS)} ${rng.pick(TRADES)}`,
  plan(rng: Rand, why0) {
    const variant = rng.weighted<'rect' | 'L' | 'T'>([['rect', 40], ['L', 40], ['T', 20]]);
    const two = rng.chance(0.3);
    const why = tagWhy(why0, `${variant}${two ? '2' : ''}`);
    const W = rng.snapped(40, 68);
    const Dh = rng.snapped(34, 52);
    const bd = two ? rng.snapped(27, 32) : rng.snapped(16, 24);
    const bw = variant === 'rect' ? W : rng.snapped(two ? 22 : 22, 32);
    const bx0 = variant === 'rect' ? 0 : variant === 'L' ? (rng.chance(0.5) ? 0 : W - bw) : rng.snapped(8, W - bw - 8);
    if (bw > W) return no(why, 'block');
    const oxl = 8;
    const oyt = 16;
    const street = 6;
    const park = rng.snapped(14, 22);
    const lot: LotSpec = { ox: oxl, oy: oyt, w: oxl + W + 8, h: oyt + Dh + bd + street + park };
    const hall = R(oxl, oyt, oxl + W, oyt + Dh);
    const block = R(oxl + bx0, oyt + Dh, oxl + bx0 + bw, oyt + Dh + bd);
    const rects: Rect[] = [hall, block];
    const footprint = unionPolygon(rects);
    if (!footprint) return no(why, 'footprint_poly');
    const maker = new RoomMaker();
    const floor = maker.make(FLOOR, hall, 0);
    let rooms;
    let plan: Plan;
    if (two) {
      // The mezzanine sits over the office block; the stair and its landing are inside the block.
      const blockRooms = planTwoFloors(rng, { rects0: [block], rects1: [block], ground: blockPool(rng), upper: mezzPool(rng), hw: [4, 5], minSide: 7.5, minCap: 8.5, capChance: 0.3, keys: { hall: CORRIDOR, landing: LANDING }, noWindow: [], maker }, why);
      if (!blockRooms) return no(why, 'two_floor_plan');
      rooms = [floor, ...blockRooms];
      const upperFootprint = unionPolygon([block]);
      if (!upperFootprint) return no(why, 'footprint_poly');
      plan = { floors: 2, footprint, upperFootprint, rooms, stair: { lower: 'stair_0', upper: 'stair_1' }, partyWalls: [] };
    } else {
      const strip = sampleStrip(rng, [block], { hw: [4, 5], minSide: 8, minCap: 8.5, maxPieces: 5, longAxis: 0, axis: 'v', full: 1, anchored: 0.6, anchor: 'lo' });
      if (!strip) return no(why, 'strip');
      const placed = layoutPieces(rng, maker, strip, blockPool(rng), 0);
      if (!placed) return no(why, 'assign_slice');
      placed.push(maker.make(CORRIDOR, strip.strip, 0));
      rooms = [floor, ...placed];
      plan = { floors: 1, footprint, rooms, partyWalls: [] };
    }
    const ext: ExteriorSpec = { kind: 'warehouse', streetDepth: street, alleyDepth: 0, driveway: null, sideStreet: null, porch: false, fences: true, parking: true, notes: [], neighbours: [], corridor: false, bay: 'n', voidClass: 'front' };
    return { plan, lot, ext };
  },
};
