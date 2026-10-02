import type { LocationDefinition, Opening, PlacedObject, Polygon, Vec } from '../../sim/types';

// Hand-made two-storey test building. The house is 24 x 14 ft (house-local feet) drawn on a
// 42 x 32 ft lot, offset by (OX, OY) into lot coordinates. Not a playable family.
//
//   Ground (24 x 14)                          Upper (24 x 8, over the north strip)
//   +-------+------------------+              +-------+-----------+------+
//   | hall  |   living         |              |landing| bedroom_u |bath_u|
//   | stair |------------------|              |       |           |      |
//   |       |   kitchen        |              +-------+-----------+------+
//   +-------+------------------+  (y = 14 is the front, facing front_yard)
//
// Stair conventions (the building generator follows the same ones):
//   a = ground stair room, b = upper stair room, from = foot (inside a), to = head (inside b),
//   floor = 0 (the lower floor), state 'open' unless a door sits on the stair.
//   The two rooms overlap in plan (the landing sits over the north part of the hall).

const OX = 6;
const OY = 6;
const v = (x: number, y: number): Vec => ({ x: x + OX, y: y + OY });
const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [v(x0, y0), v(x1, y0), v(x1, y1), v(x0, y1)];
const arect = (x0: number, y0: number, x1: number, y1: number): Polygon => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function door(id: string, a: string, b: string, from: [number, number], to: [number, number], into: string, material: Opening['material'] = 'hollow_core', floor?: number): Opening {
  return { id, type: 'door', a, b, from: v(...from), to: v(...to), swing: { hinge: 'from', into }, state: 'closed', material, ...(floor === undefined ? {} : { floor }) };
}
function windowOn(id: string, room: string, zone: string, from: [number, number], to: [number, number], floor: number): Opening {
  return { id, type: 'window', a: room, b: zone, from: v(...from), to: v(...to), state: 'closed', glazing: 'double', covering: 'none', floor };
}
function obj(id: string, type: PlacedObject['type'], inSpace: string, x: number, y: number, w: number, h: number, blocks = false): PlacedObject {
  return { id, type, in: inSpace, x: x + OX, y: y + OY, w, h, rotation: 0, mechanical: blocks, tags: blocks ? ['blocks_space'] : [] };
}

export const TWO_FLOOR_FIXTURE: LocationDefinition = {
  id: 'fixture_two_floor',
  familyId: 'fixture_two_floor',
  version: 1,
  seed: 0,
  name: 'Two-floor fixture',
  setting: 'residential',
  units: 'ft',
  bounds: { w: 42, h: 32 },
  footprint: rect(0, 0, 24, 14),
  floors: 2,
  upperFootprint: rect(0, 0, 24, 8),
  wallThickness: { exterior: 0.6, interior: 0.35 },
  materials: { exterior: 'brick', interior: 'drywall', overrides: [], floorCeiling: 'timber_joist' },
  rooms: [
    { id: 'hall', label: 'Hall', type: 'hall', floor: 0, polygon: rect(0, 0, 8, 14), tags: [] },
    { id: 'living', label: 'Living room', type: 'living', floor: 0, polygon: rect(8, 0, 24, 8), tags: [] },
    { id: 'kitchen', label: 'Kitchen', type: 'kitchen', floor: 0, polygon: rect(8, 8, 24, 14), tags: [] },
    { id: 'landing', label: 'Landing', type: 'hall', floor: 1, polygon: rect(0, 0, 8, 8), tags: [] },
    { id: 'bedroom_u', label: 'Upstairs bedroom', type: 'bedroom', floor: 1, polygon: rect(8, 0, 18, 8), tags: ['sleeping'] },
    { id: 'bath_u', label: 'Upstairs bathroom', type: 'bathroom', floor: 1, polygon: rect(18, 0, 24, 8), tags: ['water'] },
  ],
  zones: [
    { id: 'back_yard', label: 'Back yard', kind: 'yard', polygon: arect(0, 0, 42, 6), tags: [] },
    { id: 'front_yard', label: 'Front yard', kind: 'yard', polygon: arect(0, 20, 42, 32), tags: [] },
    { id: 'west_yard', label: 'West yard', kind: 'yard', polygon: arect(0, 6, 6, 20), tags: [] },
    { id: 'side_yard_e', label: 'East side yard', kind: 'yard', polygon: arect(30, 6, 42, 20), tags: [] },
  ],
  openings: [
    door('d_front', 'hall', 'front_yard', [2, 14], [4.5, 14], 'hall', 'solid_core'),
    door('d_hall_living', 'hall', 'living', [8, 2], [8, 4.5], 'hall'),
    door('d_hall_kitchen', 'hall', 'kitchen', [8, 10], [8, 12.5], 'hall'),
    door('d_kitchen_yard', 'kitchen', 'front_yard', [16, 14], [18.5, 14], 'kitchen', 'solid_core'),
    windowOn('w_living_n', 'living', 'back_yard', [12, 0], [16, 0], 0),
    // Foot in the hall, head on the landing; both rooms contain their end.
    { id: 'st_hall_landing', type: 'stair', a: 'hall', b: 'landing', from: v(4, 11), to: v(4, 3), state: 'open', floor: 0 },
    door('d_landing_bed', 'landing', 'bedroom_u', [8, 1], [8, 3.5], 'landing', 'hollow_core', 1),
    door('d_bed_bath', 'bedroom_u', 'bath_u', [18, 1], [18, 3.5], 'bedroom_u', 'hollow_core', 1),
    windowOn('w_bed_u', 'bedroom_u', 'back_yard', [11, 0], [14, 0], 1),
    windowOn('w_bath_u', 'bath_u', 'side_yard_e', [24, 2], [24, 4], 1),
  ],
  objects: [obj('o_bed_u', 'bed', 'bedroom_u', 9, 1, 5, 4, true), obj('o_sofa', 'sofa', 'living', 10, 5, 6, 2.5)],
  notes: [],
  entries: ['front_yard'],
};
