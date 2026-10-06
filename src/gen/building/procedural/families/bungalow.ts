import type { Shape } from '../footprint';
import { R, unionPolygon, type Rect } from '../geom';
import type { Rand } from '../rand';
import { D, bathSeeds, seed } from '../programme';
import { RoomMaker, layoutPieces, sampleStrip } from '../partition';
import type { ExteriorSpec, FamilySpec, LotSpec, Plan, RoomSeed } from '../types';
import { HOME_WINDOWS, STREET_NAMES, drawFootprint, no, tagWhy } from './common';

function pool(rng: Rand): RoomSeed[] {
  const baths = bathSeeds(rng, 0.3, 0.3);
  const master = baths.ensuite ? D.bedroom(150, { ensuite: baths.ensuite, required: true }) : D.bedroom(150, { required: true });
  return [
    D.living(rng.snapped(190, 250)),
    D.kitchen(rng.snapped(120, 170)),
    master,
    D.bedroom(rng.snapped(110, 140), { required: true }),
    D.bedroom(rng.snapped(100, 130), { prob: 0.55, required: false }),
    D.bedroom(rng.snapped(95, 120), { prob: 0.1 }),
    ...baths.main,
    D.dining(rng.snapped(100, 140), { prob: 0.35 }),
    D.utility(rng.snapped(40, 60), { prob: 0.4 }),
    D.study(rng.snapped(90, 110), { prob: 0.12 }),
    seed('storage', 'storage', { area: 30, min: 24, max: 50, minW: 5, tags: ['service', 'storage'], windows: 'none', prob: 0.18, hall: true }),
  ];
}

export const BUNGALOW: FamilySpec = {
  id: 'bungalow',
  label: 'Bungalow',
  setting: 'residential',
  floors: [1, 1],
  blurb: 'Single-storey house',
  shapes: ['rect', 'L', 'T'],
  fallbackSeed: 0,
  policy: {
    extWall: [['brick', 5], ['wood_frame', 5]],
    intWall: [['drywall', 7], ['plaster', 3]],
    frontRooms: [['living', 3], ['hall', 2], ['dining', 0.4]],
    frontDoor: { material: [['solid_core', 7], ['glass', 1.5]], width: [3, 3.5] },
    backChance: 0.85,
    backRooms: [['kitchen', 3], ['hall', 2], ['utility', 2], ['dining', 1], ['living', 0.4]],
    backDoor: { material: [['glass', 4], ['solid_core', 4]], width: [3, 3] },
    sideChance: 0.2,
    intDoor: { material: 'hollow_core', width: [2.5, 3] },
    openPairs: [['living', 'kitchen', 0.7], ['living', 'dining', 0.9], ['kitchen', 'dining', 0.9], ['hall', 'living', 0.45], ['hall', 'dining', 0.4]],
    windowStyle: HOME_WINDOWS,
    loops: 1,
  },
  name: (rng) => `${rng.int(12, 480)} ${rng.pick(STREET_NAMES)}`,
  plan(rng: Rand, why0) {
    const shape = rng.weighted<Shape>([['rect', 34], ['L', 28], ['T', 9], ['notch', 17]]);
    const why = tagWhy(why0, shape);
    const fp = drawFootprint(rng, shape, [28, 46], [24, 34], [880, 1500], { minWing: 10 });
    if (!fp) return no(why, 'footprint');
    const { W, D: Dp } = fp;
    const driveway = rng.chance(0.4) ? rng.pick(['e', 'w'] as const) : null;
    const ox = driveway === 'w' ? rng.snapped(10, 12) : rng.snapped(5, 9);
    const mr = driveway === 'e' ? rng.snapped(10, 12) : rng.snapped(5, 9);
    const oy = rng.snapped(5, 9);
    const mb = rng.snapped(12, 17);
    const lot: LotSpec = { ox, oy, w: ox + W + mr, h: oy + Dp + mb };
    const rects: Rect[] = fp.rects.map((r) => R(r.x0 + ox, r.y0 + oy, r.x1 + ox, r.y1 + oy));
    const footprint = unionPolygon(rects);
    if (!footprint) return no(why, 'footprint_poly');
    const strip = sampleStrip(rng, rects, { hw: [3.5, 5], minSide: 8, minCap: 8.5, maxPieces: 5, longAxis: 0.5, full: 1.2, anchored: 1 });
    if (!strip) return no(why, 'strip');
    const maker = new RoomMaker();
    const rooms = layoutPieces(rng, maker, strip, pool(rng), 0);
    if (!rooms) return no(why, 'assign_slice');
    rooms.push(maker.make(D.hall(), strip.strip, 0));
    const plan: Plan = { floors: 1, footprint, rooms, partyWalls: [] };
    const ext: ExteriorSpec = {
      kind: 'house',
      streetDepth: 0,
      alleyDepth: 0,
      driveway,
      sideStreet: null,
      porch: rng.chance(0.7),
      fences: true,
      parking: false,
      notes: [],
      neighbours: [],
      corridor: false,
      bay: null,
      voidClass: 'front',
    };
    return { plan, lot, ext };
  },
};
