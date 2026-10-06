import { R, type Rect, unionPolygon } from '../geom';
import type { Rand } from '../rand';
import { D, seed } from '../programme';
import { RoomMaker } from '../partition';
import { distribute } from '../slice';
import type { ExteriorSpec, FamilySpec, LotSpec, PRoom, Plan, RoomSeed } from '../types';
import { HOME_WINDOWS, no, tagWhy } from './common';
import { FOYER, LANDING, planTwoFloors } from './twofloor';

const NAMES = ['Starlite Motel', 'Roadside Inn', 'Pine Ridge Lodge', 'Desert Rose Motel', 'Bluebird Motor Court', 'Lakeview Motel', 'The Hitching Post', 'Maple Leaf Motor Inn'];

const UNIT = seed('unit', 'bedroom', { area: 190, min: 130, max: 260, minW: 10, aspect: 2.2, cls: 'leaf', tags: ['sleeping', 'private', 'lockable', 'guest'], windows: 'normal', label: 'Room' });
const BATH = seed('bath', 'bathroom', { area: 70, min: 40, max: 100, minW: 6, aspect: 2.3, cls: 'leaf', tags: ['private', 'water', 'lockable', 'ensuite'], windows: 'small', label: 'Bathroom' });
const RECEPTION = seed('reception', 'office', { area: 220, min: 130, max: 330, minW: 10, aspect: 2.5, front: 1, cls: 'pub', cap: true, required: true, tags: ['public', 'reception', 'customer', 'office'], windows: 'large', label: 'Office' });
const BACKOFFICE = seed('backoffice', 'office', { area: 100, min: 60, max: 180, minW: 7, aspect: 2.6, front: 0.2, cls: 'pub', cap: true, tags: ['staff', 'private', 'office', 'lockable', 'valuables'], windows: 'small', label: 'Back office' });
const BREAKFAST = seed('dining', 'living', { area: 120, min: 80, max: 200, minW: 8, aspect: 2.4, front: 0.5, cls: 'pub', cap: true, tags: ['public', 'dining', 'customer'], windows: 'normal', label: 'Breakfast room' });
const ICE = seed('storage', 'storage', { area: 50, min: 30, max: 90, minW: 5.5, cls: 'leaf', tags: ['service', 'storage'], windows: 'none', label: 'Linen closet' });
const UTILITY = seed('utility', 'utility', { area: 70, min: 40, max: 130, minW: 6, aspect: 2.8, front: 0.2, cls: 'leaf', tags: ['service', 'utility', 'laundry'], windows: 'small', label: 'Laundry' });

function flatPool(rng: Rand): RoomSeed[] {
  return [
    D.living(rng.snapped(150, 200), { min: 110, aspect: 2.6, tags: ['public', 'living', 'residential', 'upstairs'] }),
    D.kitchen(rng.snapped(90, 120), { min: 70 }),
    D.bedroom(rng.snapped(110, 140), { required: true }),
    D.bath(rng.snapped(45, 58), { required: true }),
    D.bedroom(rng.snapped(90, 110), { prob: 0.4 }),
  ];
}

/**
 * A single row of guest rooms, each with an ensuite and its own door onto a front walkway,
 * with the office at one end. The office wing may stand two storeys high with the manager's
 * flat above it, reached by a stair inside the office.
 */
export const MOTEL_ROW: FamilySpec = {
  id: 'motel_row',
  label: 'Motel',
  setting: 'business',
  floors: [1, 2],
  blurb: 'Motel row',
  shapes: ['rect', 'L'],
  fallbackSeed: 0,
  policy: {
    extWall: [['brick', 5], ['concrete', 3], ['wood_frame', 2]],
    intWall: [['drywall', 8], ['plaster', 2]],
    floorCeiling: 'timber_joist',
    frontRooms: [['reception', 1]],
    frontDoor: { material: [['glass', 7], ['solid_core', 3]], width: [3, 3.5] },
    perRoom: [{ key: 'unit', sides: ['s'], door: { material: [['solid_core', 7], ['steel', 3]], width: [3, 3] } }],
    backChance: 0.8,
    backRooms: [['backoffice', 3], ['utility', 2]],
    backDoor: { material: [['steel', 6], ['solid_core', 3]], width: [3, 3.5] },
    sideChance: 0,
    intDoor: { material: 'hollow_core', width: [2.5, 3] },
    steelDoors: ['backoffice'],
    openPairs: [['reception', 'backoffice', 0.2], ['hall', 'reception', 0.4]],
    pairWeights: { 'backoffice|reception': 0.8, 'backoffice|utility': 0.9, 'reception|utility': 2.8 },
    windowStyle: { ...HOME_WINDOWS, unit: { glazing: [['double', 7], ['single', 3]], covering: [['curtains', 7], ['blinds', 3]] }, reception: { glazing: [['double', 6], ['security', 4]], covering: [['none', 6], ['blinds', 4]] } },
    loops: 1,
    loopsMin: 1,
    throughOk: ['utility'],
  },
  name: (rng) => rng.pick(NAMES),
  plan(rng: Rand, why0) {
    const two = rng.chance(0.3);
    const protrude = !two && rng.chance(0.45);
    const why = tagWhy(why0, `${two ? 'flat' : protrude ? 'L' : 'row'}`);
    const n = rng.int(two ? 2 : 2, two ? 3 : 5);
    const uw = rng.snapped(12, 13);
    const ud = two ? rng.snapped(27, 30) : rng.snapped(23, 26);
    const ow = two ? rng.snapped(20, 24) : rng.snapped(18, 22);
    const officeWest = rng.chance(0.5);
    const W = ow + n * uw;
    const pf = protrude ? rng.snapped(6, 12) : 0;
    const left = 8;
    const right = 8;
    const top = 8;
    const street = 6;
    const park = 22;
    const lot: LotSpec = { ox: left, oy: top, w: left + W + right, h: top + ud + pf + street + park };
    const at = (x0: number, y0: number, x1: number, y1: number): Rect => R(left + x0, top + y0, left + x1, top + y1);
    const ox0 = officeWest ? 0 : n * uw;
    const ux0 = officeWest ? ow : 0;
    const maker = new RoomMaker();
    let rooms: PRoom[] = [];
    // Guest rooms: a bedroom at the front and the ensuite across the back.
    const bathDepth = rng.snapped(6.5, 8);
    for (let i = 0; i < n; i++) {
      const x0 = ux0 + i * uw;
      const unit = maker.make(UNIT, at(x0, bathDepth, x0 + uw, ud), 0);
      const bath = maker.make(BATH, at(x0, 0, x0 + uw, bathDepth), 0);
      bath.ensuiteOf = unit.id;
      rooms.push(unit, bath);
    }
    const officeRect = at(ox0, 0, ox0 + ow, ud);
    let upperFootprint;
    let plan: Plan;
    const rects: Rect[] = [at(ux0, 0, ux0 + n * uw, ud)];
    if (protrude) rects.push(at(ox0, 0, ox0 + ow, ud + pf));
    else rects.push(officeRect);
    if (two) {
      const blockRooms = planTwoFloors(rng, { rects0: [officeRect], rects1: [officeRect], ground: [RECEPTION, BACKOFFICE, UTILITY], upper: flatPool(rng), hw: [3.5, 4.5], minSide: 7, minCap: 8.5, capChance: 0.4, keys: { hall: FOYER, landing: LANDING }, noWindow: [], maker }, why);
      if (!blockRooms) return no(why, 'two_floor_plan');
      rooms = [...rooms, ...blockRooms];
      upperFootprint = unionPolygon([officeRect]);
      if (!upperFootprint) return no(why, 'footprint_poly');
    } else {
      // Single-storey office: reception across the front, back office and laundry behind.
      const front = rng.snapped(Math.max(12, ow * 0.6), Math.min(ud - 8, 16 + pf));
      const rect = at(ox0, 0, ox0 + ow, ud + pf);
      const recY = rect.y1 - front;
      rooms.push(maker.make(RECEPTION, R(rect.x0, recY, rect.x1, rect.y1), 0));
      const backRect = R(rect.x0, rect.y0, rect.x1, recY);
      const backH = backRect.y1 - backRect.y0;
      if (backH < 7) return no(why, 'back_rooms');
      // The back row is two or three rooms, drawn from the office, laundry, linen store and breakfast room.
      const back = rng.shuffle(ow >= 21 && backH >= 8 ? [BACKOFFICE, UTILITY, ICE, BREAKFAST] : [BACKOFFICE, UTILITY, ICE]).slice(0, ow >= 20 ? rng.int(2, 3) : 2);
      if (!back.includes(BACKOFFICE) && rng.chance(0.7)) back[0] = BACKOFFICE;
      const widths = distribute(ow, back.map((q) => ({ weight: q.area, min: Math.max(q.minW, 6) })));
      if (!widths) return no(why, 'back_rooms');
      let bx = rect.x0;
      back.forEach((q, i) => {
        rooms.push(maker.make(q, R(bx, backRect.y0, bx + widths[i], backRect.y1), 0));
        bx += widths[i];
      });
    }
    const footprint = unionPolygon(rects);
    if (!footprint) return no(why, 'footprint_poly');
    plan = {
      floors: two ? 2 : 1,
      footprint,
      ...(upperFootprint ? { upperFootprint } : {}),
      rooms,
      ...(two ? { stair: { lower: 'stair_0', upper: 'stair_1' } } : {}),
      partyWalls: [],
    };
    const walkX0 = left + ux0;
    const ext: ExteriorSpec = {
      kind: 'motel',
      streetDepth: street,
      alleyDepth: 0,
      driveway: null,
      sideStreet: null,
      porch: false,
      fences: false,
      parking: true,
      notes: [],
      neighbours: [],
      corridor: false,
      bay: null,
      voidClass: 'front',
      walkway: { x0: walkX0, y0: top + ud, x1: walkX0 + n * uw, y1: top + ud + 5 },
    };
    return { plan, lot, ext };
  },
};
