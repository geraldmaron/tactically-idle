import type { Shape } from '../footprint';
import { R, type Rect, unionPolygon } from '../geom';
import type { Rand } from '../rand';
import { D, seed } from '../programme';
import { RoomMaker, layoutPieces, sampleStrip } from '../partition';
import type { ExteriorSpec, FamilySpec, LotSpec, Plan, RoomSeed } from '../types';
import { drawFootprint, no, tagWhy } from './common';
import { LANDING, planTwoFloors } from './twofloor';

const FIRMS = ['Harlow', 'Brightwater', 'Pinnacle', 'Cobalt', 'Meridian', 'Summit', 'Granger', 'Foxley', 'Lindqvist'];
const TRADES = ['Insurance', 'Accounting', 'Legal', 'Logistics', 'Consulting', 'Realty', 'Engineering', 'Design'];

const CORRIDOR = seed('corridor', 'hall', { area: 80, min: 30, max: 500, minW: 4, aspect: 99, cls: 'circ', tags: ['circulation', 'narrow'], windows: 'none', kit: 'hall', label: 'Corridor' });

const office = (key: string, area: number, o: object = {}) =>
  seed(key, 'office', { area, min: Math.round(area * 0.7), max: Math.round(area * 1.7), minW: 9, aspect: 2.4, hall: true, tags: ['staff', 'work', 'lockable'], kit: key, ...o });

function groundPool(rng: Rand, upper: boolean): RoomSeed[] {
  const rooms: RoomSeed[] = [
    seed('open_office', 'office', { area: rng.snapped(320, 460), min: 200, max: 760, minW: 14, aspect: 2.6, front: 0.5, cls: 'pub', cap: true, required: true, tags: ['staff', 'work', 'open'], windows: 'large', kit: 'open_office', label: 'Open office' }),
    office('meeting', rng.snapped(130, 190), { cls: 'leaf', hall: false, required: true, tags: ['staff', 'meeting', 'lockable'], label: 'Meeting room' }),
    office('meeting', rng.snapped(110, 150), { cls: 'leaf', hall: false, prob: 0.45, tags: ['staff', 'meeting', 'lockable'], label: 'Meeting room' }),
    office('manager', rng.snapped(110, 150), { cls: 'leaf', required: true, tags: ['private', 'office', 'lockable', 'valuables'], label: 'Manager office' }),
    office('manager', rng.snapped(100, 130), { cls: 'leaf', prob: 0.35, tags: ['private', 'office', 'lockable', 'valuables'], label: 'Office' }),
    seed('kitchenette', 'kitchen', { area: rng.snapped(70, 100), min: 50, max: 150, minW: 7, hall: true, tags: ['staff', 'cooking', 'water'], windows: 'small', kit: 'kitchenette', label: 'Kitchenette' }),
    D.wc(rng.snapped(34, 46), { required: true, tags: ['water', 'lockable', 'wc', 'staff'] }),
    D.wc(rng.snapped(30, 40), { prob: 0.35, tags: ['water', 'lockable', 'wc', 'staff'] }),
    seed('server', 'storage', { area: 40, min: 28, max: 90, minW: 5.5, hall: true, tags: ['service', 'server', 'valuables', 'hazard'], windows: 'none', kit: 'server', prob: 0.5, label: 'Server room' }),
    seed('storage', 'storage', { area: 45, min: 28, max: 100, minW: 5.5, hall: true, tags: ['service', 'storage'], windows: 'none', kit: 'storage', prob: 0.4 }),
  ];
  if (!upper)
    rooms.unshift(seed('reception', 'office', { area: rng.snapped(140, 220), min: 100, max: 300, minW: 10, aspect: 2.4, front: 1, cls: 'pub', cap: true, required: true, tags: ['public', 'reception', 'customer'], windows: 'large', kit: 'reception', label: 'Reception' }));
  return rooms;
}

export const SMALL_OFFICE: FamilySpec = {
  id: 'small_office',
  label: 'Small office',
  setting: 'business',
  floors: [1, 2],
  blurb: 'Small office building',
  shapes: ['rect', 'T', 'U'],
  fallbackSeed: 0,
  policy: {
    extWall: [['brick', 4], ['concrete', 3], ['wood_frame', 1]],
    intWall: [['drywall', 10]],
    floorCeiling: 'concrete_slab',
    frontRooms: [['reception', 8], ['open_office', 1]],
    frontDoor: { material: [['glass', 8], ['solid_core', 1]], width: [3, 3.5] },
    backChance: 0.75,
    backRooms: [['corridor', 3], ['kitchenette', 2], ['storage', 1], ['open_office', 1]],
    backDoor: { material: [['solid_core', 5], ['steel', 4], ['glass', 1]], width: [3, 3.5] },
    sideChance: 0.2,
    intDoor: { material: 'hollow_core', width: [3, 3.5] },
    steelDoors: ['server'],
    glass: ['meeting', 'manager'],
    openPairs: [['reception', 'open_office', 0.9], ['corridor', 'reception', 0.5], ['corridor', 'open_office', 0.4]],
    pairWeights: { 'meeting|open_office': 0.5, 'manager|open_office': 1.2, 'kitchenette|open_office': 1.5, 'meeting|reception': 1.6 },
    windowStyle: {
      default: { glazing: [['double', 8], ['security', 2]], covering: [['blinds', 7], ['none', 3]] },
      reception: { glazing: [['double', 6], ['security', 4]], covering: [['none', 6], ['blinds', 4]] },
      wc: { glazing: [['single', 6], ['double', 4]], covering: [['blinds', 8], ['none', 2]] },
    },
    loops: 1,
  },
  name: (rng) => `${rng.pick(FIRMS)} ${rng.pick(TRADES)}`,
  plan(rng: Rand, why0) {
    const shape = rng.weighted<Shape>([['rect', 40], ['T', 25], ['U', 25], ['notch', 10]]);
    const two = rng.chance(0.22);
    const why = tagWhy(why0, `${shape}${two ? '2' : ''}`);
    const fp = drawFootprint(rng, shape, two ? [30, 40] : [38, 56], two ? [28, 36] : [26, 36], two ? [850, 1300] : [1100, 1900], { minWing: 12 });
    if (!fp) return no(why, 'footprint');
    const left = rng.snapped(7, 10);
    const right = rng.snapped(7, 10);
    const top = rng.snapped(7, 10);
    const street = 6;
    const park = rng.snapped(18, 26);
    const lot: LotSpec = { ox: left, oy: top, w: left + fp.W + right, h: top + fp.D + street + park };
    const rects: Rect[] = fp.rects.map((r) => R(r.x0 + left, r.y0 + top, r.x1 + left, r.y1 + top));
    const footprint = unionPolygon(rects);
    if (!footprint) return no(why, 'footprint_poly');
    let plan: Plan;
    if (two) {
      const rooms = planTwoFloors(rng, { rects0: rects, rects1: rects, ground: groundPool(rng, false), upper: groundPool(rng, true).filter((s) => s.key !== 'wc' || s.required), hw: [4, 5], minSide: 8, minCap: 9, capChance: 0.4, keys: { hall: CORRIDOR, landing: LANDING } }, why);
      if (!rooms) return no(why, 'two_floor_plan');
      plan = { floors: 2, footprint, upperFootprint: footprint, rooms, stair: { lower: 'stair_0', upper: 'stair_1' }, partyWalls: [] };
    } else {
      const strip = sampleStrip(rng, rects, { hw: [4, 6], minSide: 8, minCap: 9, maxPieces: 6, longAxis: 0.6, full: 1.4, anchored: 1 });
      if (!strip) return no(why, 'strip');
      const maker = new RoomMaker();
      const rooms = layoutPieces(rng, maker, strip, groundPool(rng, false), 0);
      if (!rooms) return no(why, 'assign_slice');
      rooms.push(maker.make(CORRIDOR, strip.strip, 0));
      plan = { floors: 1, footprint, rooms, partyWalls: [] };
    }
    const ext: ExteriorSpec = { kind: 'office', streetDepth: street, alleyDepth: 0, driveway: null, sideStreet: null, porch: false, fences: rng.chance(0.4), parking: true, notes: [], neighbours: [], corridor: false, bay: null, voidClass: 'front' };
    return { plan, lot, ext };
  },
};
