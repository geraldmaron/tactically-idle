import { R, type Rect, unionPolygon, vec } from '../geom';
import type { Rand } from '../rand';
import { seed } from '../programme';
import { RoomMaker } from '../partition';
import { distribute } from '../slice';
import type { ExteriorSpec, FamilySpec, LotSpec, Plan, RoomSeed } from '../types';
import { D } from '../programme';
import { no, tagWhy } from './common';

const NAMES = ['The Rusty Anchor', "Mulligan's Tavern", 'Blue Heron Grill', 'The Golden Fleece', 'Casa Lupita', "Dino's Pizzeria", 'The Wheatsheaf', 'Harbour Lights Bar', "Mama Chen's Kitchen", 'The Fox and Pheasant'];

const CORRIDOR = seed('corridor', 'hall', { area: 60, min: 24, max: 300, minW: 4, aspect: 99, cls: 'circ', tags: ['circulation', 'narrow'], windows: 'none', kit: 'hall', label: 'Back corridor' });
const BAR = seed('bar', 'retail', { area: 650, min: 300, max: 1400, minW: 14, aspect: 3, front: 1, cls: 'pub', cap: true, required: true, tags: ['public', 'customer', 'bar', 'dining'], windows: 'storefront', kit: 'bar_floor', label: 'Bar and dining' });
const KITCHEN = seed('kitchen', 'kitchen', { area: 230, min: 110, max: 560, minW: 9, aspect: 3, cls: 'pub', cap: true, required: true, tags: ['staff', 'cooking', 'water', 'hazard', 'service'], windows: 'small', kit: 'commercial_kitchen', label: 'Kitchen' });
const COLD = seed('cold_store', 'storage', { area: 70, min: 36, max: 140, minW: 6, cls: 'leaf', tags: ['staff', 'storage', 'cold', 'service'], windows: 'none', kit: 'cold_store', label: 'Cold store' });
const OFFICE = seed('backoffice', 'office', { area: 85, min: 55, max: 150, minW: 7, cls: 'leaf', tags: ['staff', 'private', 'office', 'lockable', 'valuables'], windows: 'small', kit: 'backoffice', label: 'Office' });
const DRY = seed('storage', 'storage', { area: 70, min: 36, max: 170, minW: 5.5, tags: ['service', 'storage'], windows: 'none', kit: 'storage', label: 'Dry store' });
const STAFF = seed('break_room', 'utility', { area: 75, min: 50, max: 140, minW: 7, cls: 'leaf', tags: ['staff', 'service'], windows: 'small', kit: 'storage', label: 'Staff room' });
const wcSeed = (): RoomSeed => D.wc(34, { required: true, min: 24, max: 70, tags: ['water', 'lockable', 'wc', 'public'] });

/**
 * Bar floor across the front; behind it a back corridor with the toilets on one side and the
 * kitchen zone on the other (kitchen against the bar, a row of office and stores behind it).
 * An optional void at one rear corner makes the L.
 */
export const BAR_RESTAURANT: FamilySpec = {
  id: 'bar_restaurant',
  label: 'Bar or restaurant',
  setting: 'business',
  floors: [1, 1],
  blurb: 'Bar or restaurant',
  shapes: ['rect', 'L', 'chamfer'],
  fallbackSeed: 0,
  policy: {
    extWall: [['brick', 6], ['concrete', 3], ['wood_frame', 1]],
    intWall: [['drywall', 9], ['plaster', 1]],
    frontRooms: [['bar', 1]],
    frontDoor: { material: [['glass', 6], ['solid_core', 4]], width: [3, 4] },
    backChance: 0.95,
    backRooms: [['corridor', 3], ['kitchen', 3], ['backoffice', 1]],
    backDoor: { material: [['steel', 6], ['solid_core', 3]], width: [3, 3.5] },
    sideChance: 0.35,
    intDoor: { material: 'hollow_core', width: [3, 3.5] },
    steelDoors: ['cold_store'],
    openPairs: [['bar', 'corridor', 0.4]],
    pairWeights: { 'bar|kitchen': 0.7, 'cold_store|kitchen': 0.5, 'backoffice|kitchen': 1.3, 'corridor|wc': 0.7, 'bar|corridor': 1.1, 'bar|wc': 2.8, 'backoffice|corridor': 0.8, 'corridor|kitchen': 1.0, 'corridor|storage': 1.0, 'kitchen|storage': 0.9, 'break_room|kitchen': 1.0, 'break_room|corridor': 1.0, 'cold_store|corridor': 1.6, 'cold_store|storage': 1.4 },
    windowStyle: {
      default: { glazing: [['double', 7], ['single', 3]], covering: [['blinds', 6], ['none', 4]] },
      bar: { glazing: [['security', 3], ['double', 7]], covering: [['none', 5], ['blinds', 3], ['curtains', 2]] },
      wc: { glazing: [['single', 6], ['double', 4]], covering: [['blinds', 8], ['none', 2]] },
    },
    loops: 1,
  },
  name: (rng) => rng.pick(NAMES),
  plan(rng: Rand, why0) {
    const L = rng.chance(0.38);
    const why = tagWhy(why0, L ? 'L' : 'rect');
    const W = rng.snapped(34, 56);
    const Dp = rng.snapped(30, 42);
    const fdMin = Math.max(15, 0.46 * Dp, W / 2.8);
    if (fdMin > 0.62 * Dp) return no(why, 'depth');
    const fd = rng.snapped(fdMin, 0.62 * Dp);
    const bd = Dp - fd;
    if (bd < 14.5) return no(why, 'depth');
    const vw = L ? rng.snapped(8, Math.min(0.3 * W, W - 28)) : 0;
    const voidWest = rng.chance(0.5);
    const bandW = W - vw;
    const bx0 = voidWest ? vw : 0;
    const wcLeft = rng.chance(0.5);
    const wcw = rng.snapped(7, 8.5);
    const hw = rng.snapped(4, 5);
    const ke = bandW - wcw - hw;
    if (ke < 16) return no(why, 'kitchen_zone');

    const sideStreet = rng.chance(0.5) ? rng.pick(['e', 'w'] as const) : null;
    const streetDepth = 8;
    const alley = 9;
    const patio = rng.chance(0.4);
    const left = sideStreet === 'w' ? streetDepth : 6;
    const right = sideStreet === 'e' ? streetDepth : 6;
    const lot: LotSpec = { ox: left, oy: alley, w: left + W + right, h: alley + Dp + streetDepth + (patio ? 7 : 0) };
    const at = (x0: number, y0: number, x1: number, y1: number): Rect => R(left + x0, alley + y0, left + x1, alley + y1);

    const maker = new RoomMaker();
    const rooms = [];
    rooms.push(maker.make(BAR, at(0, bd, W, Dp), 0));
    // Back band: toilets, corridor, kitchen zone, in either order.
    const wcX0 = wcLeft ? bx0 : bx0 + bandW - wcw;
    const corX0 = wcLeft ? bx0 + wcw : bx0 + bandW - wcw - hw;
    const keX0 = wcLeft ? bx0 + wcw + hw : bx0;
    rooms.push(maker.make(CORRIDOR, at(corX0, 0, corX0 + hw, bd), 0));
    // Toilet column: two WCs, or one WC and a dry store.
    const two = rng.chance(0.65);
    const wcA = two ? wcSeed() : wcSeed();
    const h2 = distribute(bd, [{ weight: 1, min: 7 }, { weight: 1, min: 6 }]);
    if (!h2) return no(why, 'wc_column');
    rooms.push(maker.make(wcA, at(wcX0, 0, wcX0 + wcw, h2[0]), 0));
    rooms.push(maker.make(two ? wcSeed() : DRY, at(wcX0, h2[0], wcX0 + wcw, bd), 0));
    // Kitchen zone: a row of back rooms along the rear wall, the kitchen against the bar.
    const rb = rng.snapped(7, Math.min(10, bd - 8));
    // A kitchen wider than it is deep gives up a full-depth side room (cold store or staff room).
    let kw = ke;
    let sideRoom: RoomSeed | null = null;
    if (ke > 2.8 * (bd - rb)) {
      const sw = Math.min(14, Math.max(7, ke - 2.8 * (bd - rb)));
      kw = ke - sw;
      if (kw < 11 || kw > 2.9 * (bd - rb)) return no(why, 'kitchen_aspect');
      sideRoom = rng.chance(0.6) ? COLD : STAFF;
    }
    const kitchenAtStart = !wcLeft;
    const kx0 = sideRoom && !kitchenAtStart ? keX0 + (ke - kw) : keX0;
    const sx0 = kitchenAtStart ? keX0 + kw : keX0;
    const back: RoomSeed[] = rng.shuffle([OFFICE, ...(sideRoom === COLD ? [] : [COLD]), rng.chance(0.5) ? STAFF : DRY].filter((q) => q !== sideRoom)).slice(0, Math.max(1, Math.min(3, Math.floor(kw / 7.5))));
    const widths = distribute(kw, back.map((q) => ({ weight: q.area, min: Math.max(q.minW, 6) })));
    if (!widths) return no(why, 'back_row');
    let x = kx0;
    back.forEach((q, i) => {
      rooms.push(maker.make(q, at(x, 0, x + widths[i], rb), 0));
      x += widths[i];
    });
    rooms.push(maker.make(KITCHEN, at(kx0, rb, kx0 + kw, bd), 0));
    if (sideRoom) rooms.push(maker.make(sideRoom, at(kitchenAtStart ? sx0 : keX0, 0, kitchenAtStart ? sx0 + (ke - kw) : keX0 + (ke - kw), bd), 0));

    const fpRects: Rect[] = [at(0, bd, W, Dp), at(bx0, 0, bx0 + bandW, bd)];
    const footprint = unionPolygon(fpRects);
    if (!footprint) return no(why, 'footprint_poly');
    const neighbours: ('e' | 'w')[] = sideStreet === 'e' ? ['w'] : sideStreet === 'w' ? ['e'] : ['w', 'e'];
    const chamfer = sideStreet !== null && rng.chance(0.55);
    const cornerPt = sideStreet === 'e' ? vec(left + W, alley + Dp) : vec(left, alley + Dp);
    const plan: Plan = { floors: 1, footprint, rooms, partyWalls: neighbours, ...(chamfer ? { chamfer: { corner: cornerPt, leg: rng.snapped(4, 6) } } : {}) };
    const ext: ExteriorSpec = { kind: 'bar', streetDepth, alleyDepth: alley, driveway: null, sideStreet, porch: false, fences: false, parking: false, notes: [], neighbours, corridor: false, bay: null, voidClass: 'back' };
    return { plan, lot, ext };
  },
};
