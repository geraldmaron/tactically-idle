import type { LocationDefinition, Polygon } from '../../sim/types';

// Tiny layouts for validator tests. VALID_TINY is a 20 x 10 ft house with a west
// room, two east rooms and a yard; each invalid fixture breaks exactly one rule.

const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

export const VALID_TINY: LocationDefinition = {
  id: 'fixture_tiny',
  familyId: 'fixture_tiny',
  version: 1,
  seed: 0,
  name: 'Tiny fixture',
  setting: 'residential',
  units: 'ft',
  bounds: { w: 30, h: 20 },
  footprint: rect(0, 0, 20, 10),
  wallThickness: { exterior: 0.6, interior: 0.35 },
  materials: { exterior: 'brick', interior: 'drywall', overrides: [] },
  rooms: [
    { id: 'a', label: 'A', type: 'living', floor: 0, polygon: rect(0, 0, 10, 10), tags: [] },
    { id: 'b', label: 'B', type: 'bedroom', floor: 0, polygon: rect(10, 0, 20, 5), tags: [] },
    { id: 'c', label: 'C', type: 'bedroom', floor: 0, polygon: rect(10, 5, 20, 10), tags: [] },
  ],
  zones: [{ id: 'yard', label: 'Yard', kind: 'yard', polygon: rect(0, 10, 20, 16), tags: [] }],
  openings: [
    { id: 'd_ab', type: 'door', a: 'a', b: 'b', from: { x: 10, y: 1 }, to: { x: 10, y: 3.5 }, swing: { hinge: 'from', into: 'a' }, state: 'closed', material: 'hollow_core' },
    { id: 'd_ac', type: 'door', a: 'a', b: 'c', from: { x: 10, y: 6 }, to: { x: 10, y: 8.5 }, swing: { hinge: 'from', into: 'a' }, state: 'closed', material: 'hollow_core' },
    { id: 'd_front', type: 'door', a: 'a', b: 'yard', from: { x: 3, y: 10 }, to: { x: 5.5, y: 10 }, swing: { hinge: 'from', into: 'a' }, state: 'closed', material: 'hollow_core' },
    { id: 'w_c', type: 'window', a: 'c', b: 'yard', from: { x: 14, y: 10 }, to: { x: 17, y: 10 }, state: 'closed', glazing: 'double', covering: 'none' },
  ],
  objects: [{ id: 'o_bed', type: 'bed', in: 'a', x: 1, y: 1, w: 4, h: 4, rotation: 0, mechanical: true, tags: ['blocks_space'] }],
  notes: [],
  entries: ['yard'],
};

function variant(change: (loc: LocationDefinition) => void): LocationDefinition {
  const loc = structuredClone(VALID_TINY);
  change(loc);
  return loc;
}

export interface InvalidFixture {
  name: string;
  location: LocationDefinition;
  /** Error code the validator must report. */
  code: string;
}

export const INVALID_FIXTURES: InvalidFixture[] = [
  {
    name: 'disconnected room',
    // Room C loses its only door, so no entry can reach it.
    location: variant((l) => {
      l.openings = l.openings.filter((o) => o.id !== 'd_ac');
    }),
    code: 'unreachable_room',
  },
  {
    name: 'overlapping rooms',
    // C grows upward into B.
    location: variant((l) => {
      l.rooms[2].polygon = rect(10, 4, 20, 10);
    }),
    code: 'room_overlap',
  },
  {
    name: 'door not on a shared wall',
    location: variant((l) => {
      l.openings[0].from = { x: 12, y: 1 };
      l.openings[0].to = { x: 12, y: 3.5 };
    }),
    code: 'opening_not_on_wall',
  },
  {
    name: 'object outside its room',
    location: variant((l) => {
      l.objects[0].x = 8;
    }),
    code: 'object_outside_space',
  },
  {
    name: 'opening to a missing space',
    location: variant((l) => {
      l.openings[0].b = 'ghost';
    }),
    code: 'opening_missing_space',
  },
  {
    name: 'door too narrow',
    location: variant((l) => {
      l.openings[2].to = { x: 4.5, y: 10 };
    }),
    code: 'opening_too_narrow',
  },
  {
    name: 'swing into an unrelated space',
    location: variant((l) => {
      l.openings[0].swing = { hinge: 'from', into: 'c' };
    }),
    code: 'swing_invalid',
  },
  {
    name: 'mechanical object without tags',
    location: variant((l) => {
      l.objects[0].tags = [];
    }),
    code: 'mechanical_missing_tags',
  },
  {
    name: 'entry that is not a zone',
    location: variant((l) => {
      l.entries = ['a'];
    }),
    code: 'entry_not_zone',
  },
  {
    name: 'door without a material',
    location: variant((l) => {
      delete l.openings[0].material;
    }),
    code: 'door_missing_material',
  },
  {
    name: 'window without glazing',
    location: variant((l) => {
      delete l.openings[3].glazing;
    }),
    code: 'window_missing_glazing',
  },
  {
    name: 'material override naming an unknown space',
    location: variant((l) => {
      l.materials.overrides = [{ a: 'a', b: 'ghost', material: 'plaster' }];
    }),
    code: 'override_unknown_space',
  },
  {
    name: 'material override between spaces that share no wall',
    location: variant((l) => {
      l.materials.overrides = [{ a: 'b', b: 'yard', material: 'plaster' }];
    }),
    code: 'override_not_adjacent',
  },
  {
    name: 'duplicate id',
    location: variant((l) => {
      l.objects[0].id = 'd_ab';
    }),
    code: 'duplicate_id',
  },
  {
    name: 'room outside the footprint',
    location: variant((l) => {
      l.rooms[1].polygon = rect(10, -3, 20, 5);
    }),
    code: 'room_outside_footprint',
  },
  {
    name: 'self-intersecting room',
    location: variant((l) => {
      l.rooms[2].polygon = [
        { x: 10, y: 5 },
        { x: 20, y: 10 },
        { x: 20, y: 5 },
        { x: 10, y: 9 },
      ];
    }),
    code: 'polygon_self_intersect',
  },
  {
    name: 'room with too few vertices',
    location: variant((l) => {
      l.rooms[2].polygon = rect(10, 5, 20, 10).slice(0, 2);
    }),
    code: 'polygon_too_few_vertices',
  },
  {
    name: 'zero-area room',
    location: variant((l) => {
      l.rooms[2].polygon = [
        { x: 10, y: 5 },
        { x: 15, y: 5 },
        { x: 20, y: 5 },
      ];
    }),
    code: 'polygon_zero_area',
  },
];
