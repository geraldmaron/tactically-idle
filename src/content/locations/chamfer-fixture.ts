import type { LocationDefinition, Opening, PlacedObject, Polygon, Vec } from '../../sim/types';

// Hand-made single-storey corner shop with one 45-degree chamfered corner (north-east).
// House-local feet, offset by (OX, OY) onto a 40 x 34 ft lot. Not a playable family.
//
//        8        14
//   y=0  +---------+
//        | stock | shop  \     chamfer: (14,0) to (20,6), x - y = 14
//        |  room |        \
//        |       |         +   y=6
//        |       |         |
//   y=14 +-------+---------+
//        x=0     8        20
//
// Footprint area 20 x 14 - 18 = 262 sq ft; shop 150 sq ft (12 x 14 less the 18 sq ft corner), stockroom 112.

const OX = 6;
const OY = 10;
const v = (x: number, y: number): Vec => ({ x: x + OX, y: y + OY });
const poly = (...pts: [number, number][]): Polygon => pts.map(([x, y]) => v(x, y));

const opening = (o: Omit<Opening, 'from' | 'to'> & { from: [number, number]; to: [number, number] }): Opening => ({ ...o, from: v(...o.from), to: v(...o.to) });
const obj = (id: string, type: PlacedObject['type'], inSpace: string, x: number, y: number, w: number, h: number): PlacedObject => ({
  id,
  type,
  in: inSpace,
  x: x + OX,
  y: y + OY,
  w,
  h,
  rotation: 0,
  mechanical: true,
  tags: ['blocks_space'],
});

export const CHAMFER_FIXTURE: LocationDefinition = {
  id: 'fixture_chamfer',
  familyId: 'fixture_chamfer',
  version: 1,
  seed: 0,
  name: 'Chamfered corner shop fixture',
  setting: 'business',
  units: 'ft',
  bounds: { w: 40, h: 34 },
  footprint: poly([0, 0], [14, 0], [20, 6], [20, 14], [0, 14]),
  wallThickness: { exterior: 0.6, interior: 0.35 },
  materials: { exterior: 'brick', interior: 'drywall', overrides: [] },
  rooms: [
    { id: 'shop', label: 'Shop floor', type: 'retail', floor: 0, polygon: poly([8, 0], [14, 0], [20, 6], [20, 14], [8, 14]), tags: [] },
    { id: 'stockroom', label: 'Stockroom', type: 'storage', floor: 0, polygon: poly([0, 0], [8, 0], [8, 14], [0, 14]), tags: [] },
  ],
  zones: [
    { id: 'corner_street', label: 'Corner street', kind: 'street', polygon: poly([8, -6], [26, -6], [26, 6], [20, 6], [14, 0], [8, 0]), tags: [] },
    { id: 'east_walk', label: 'East walk', kind: 'street', polygon: poly([20, 6], [26, 6], [26, 14], [20, 14]), tags: [] },
    { id: 'alley', label: 'Back alley', kind: 'alley', polygon: poly([-6, 0], [0, 0], [0, 14], [-6, 14]), tags: [] },
  ],
  openings: [
    // On the diagonal wall: a window and the corner entrance (both on the line x - y = 14).
    opening({ id: 'w_corner', type: 'window', a: 'shop', b: 'corner_street', from: [16, 2], to: [17, 3], state: 'closed', glazing: 'double', covering: 'none' }),
    opening({ id: 'd_corner', type: 'door', a: 'shop', b: 'corner_street', from: [18, 4], to: [19.5, 5.5], swing: { hinge: 'from', into: 'shop' }, state: 'closed', material: 'glass' }),
    opening({ id: 'd_shop_stock', type: 'door', a: 'shop', b: 'stockroom', from: [8, 6], to: [8, 8.5], swing: { hinge: 'from', into: 'shop' }, state: 'closed', material: 'hollow_core' }),
    opening({ id: 'd_rear', type: 'door', a: 'stockroom', b: 'alley', from: [0, 6], to: [0, 8.5], swing: { hinge: 'from', into: 'stockroom' }, state: 'locked', material: 'steel' }),
    opening({ id: 'w_east', type: 'window', a: 'shop', b: 'east_walk', from: [20, 9], to: [20, 12], state: 'closed', glazing: 'single', covering: 'none' }),
  ],
  objects: [obj('o_counter', 'counter', 'shop', 10, 2, 4, 2)],
  notes: [],
  entries: ['corner_street'],
};
