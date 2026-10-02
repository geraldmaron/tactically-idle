import type { LocationFamily, Opening, PlacedObject, Polygon, Vec } from '../../sim/types';

// Fictional single-storey bungalow modelled on the approved operations mockup.
// House is 38 ft x 28 ft, drawn on a 50 x 44 ft lot. House-local coordinates are
// offset by (OX, OY) into lot coordinates.

const OX = 6;
const OY = 4;

const v = (x: number, y: number): Vec => ({ x: x + OX, y: y + OY });
const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [v(x0, y0), v(x1, y0), v(x1, y1), v(x0, y1)];
const poly = (...pts: [number, number][]): Polygon => pts.map(([x, y]) => v(x, y));
/** Absolute lot coordinates (exterior). */
const arect = (x0: number, y0: number, x1: number, y1: number): Polygon => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function door(
  id: string,
  a: string,
  b: string,
  from: [number, number],
  to: [number, number],
  into: string,
  state: Opening['state'] = 'closed',
  material: Opening['material'] = 'hollow_core',
): Opening {
  return { id, type: 'door', a, b, from: v(...from), to: v(...to), swing: { hinge: 'from', into }, state, material };
}
function windowOn(
  id: string,
  room: string,
  zone: string,
  from: [number, number],
  to: [number, number],
  covering: Opening['covering'] = 'none',
): Opening {
  return { id, type: 'window', a: room, b: zone, from: v(...from), to: v(...to), state: 'closed', glazing: 'double', covering };
}
/** Open path between two exterior zones; not drawn as a wall opening. */
function path(id: string, a: string, b: string, from: Vec, to: Vec): Opening {
  return { id, type: 'doorway', a, b, from, to, state: 'open' };
}

function obj(
  id: string,
  type: PlacedObject['type'],
  inSpace: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { rot?: PlacedObject['rotation']; blocks?: boolean; tags?: string[]; abs?: boolean } = {},
): PlacedObject {
  const ox = opts.abs ? 0 : OX;
  const oy = opts.abs ? 0 : OY;
  const tags = [...(opts.tags ?? []), ...(opts.blocks ? ['blocks_space'] : [])];
  return {
    id,
    type,
    in: inSpace,
    x: x + ox,
    y: y + oy,
    w,
    h,
    rotation: opts.rot ?? 0,
    mechanical: Boolean(opts.blocks) || tags.length > 0,
    tags,
  };
}

export const MAPLE_STREET: LocationFamily = {
  id: 'maple_street',
  version: 1,
  variations: [
    // East bedroom depth: moves the bedroom/kitchen wall. Changes both rooms' areas.
    { kind: 'shiftEdge', id: 'east_bedroom_depth', axis: 'y', at: 13 + OY, span: [21 + OX, 38 + OX], offsets: [-1, 0, 1] },
    // Back door condition changes the second entry route.
    { kind: 'openingState', id: 'back_door_state', openingId: 'd_back', states: ['closed', 'locked', 'blocked'] },
    // Optional connecting door between bath and east bedroom changes the graph.
    {
      kind: 'optionalOpening',
      id: 'bath_bedroom_door',
      chance: 0.5,
      opening: door('d_bath_bede', 'bath', 'bedroom_e', [21, 5], [21, 7.5], 'bath'),
    },
  ],
  base: {
    id: 'maple_street',
    familyId: 'maple_street',
    version: 1,
    seed: 0,
    name: 'Maple Street',
    setting: 'residential',
    units: 'ft',
    bounds: { w: 50, h: 44 },
    footprint: rect(0, 0, 38, 28),
    wallThickness: { exterior: 0.6, interior: 0.35 },
    materials: { exterior: 'brick', interior: 'drywall', overrides: [{ a: 'bath', b: 'bedroom_e', material: 'plaster' }] },
    rooms: [
      { id: 'bedroom_w', label: 'Bedroom', type: 'bedroom', floor: 0, polygon: rect(0, 0, 13, 13), tags: ['sleeping'] },
      { id: 'bath', label: 'Bath', type: 'bathroom', floor: 0, polygon: rect(13, 0, 21, 9), tags: ['water', 'narrow'] },
      { id: 'bedroom_e', label: 'Bedroom', type: 'bedroom', floor: 0, polygon: rect(21, 0, 38, 13), tags: ['sleeping'] },
      { id: 'hall', label: 'Hall', type: 'hall', floor: 0, polygon: rect(13, 9, 21, 15), tags: ['narrow', 'junction'] },
      {
        id: 'living',
        label: 'Living',
        type: 'living',
        floor: 0,
        polygon: poly([0, 13], [13, 13], [13, 15], [19, 15], [19, 28], [0, 28]),
        tags: ['open'],
      },
      {
        id: 'kitchen',
        label: 'Kitchen',
        type: 'kitchen',
        floor: 0,
        polygon: poly([21, 13], [38, 13], [38, 28], [19, 28], [19, 15], [21, 15]),
        tags: ['open'],
      },
    ],
    zones: [
      { id: 'back_yard', label: 'Back yard', kind: 'yard', polygon: arect(0, 0, 50, 4), tags: [] },
      { id: 'side_yard_w', label: 'West side', kind: 'yard', polygon: arect(0, 4, 6, 32), tags: [] },
      { id: 'side_yard_e', label: 'East side', kind: 'yard', polygon: arect(44, 4, 50, 32), tags: ['fence'] },
      { id: 'porch', label: 'Porch', kind: 'porch', polygon: arect(19, 32, 29, 36), tags: ['exposed'] },
      {
        id: 'front_yard',
        label: 'Front',
        kind: 'yard',
        polygon: [
          { x: 0, y: 32 },
          { x: 19, y: 32 },
          { x: 19, y: 36 },
          { x: 29, y: 36 },
          { x: 29, y: 32 },
          { x: 50, y: 32 },
          { x: 50, y: 44 },
          { x: 0, y: 44 },
        ],
        tags: ['cover', 'street'],
      },
    ],
    openings: [
      door('d_front', 'living', 'porch', [15, 28], [18, 28], 'living', 'closed', 'solid_core'),
      door('d_hall_living', 'hall', 'living', [14, 15], [17, 15], 'hall', 'open'),
      door('d_hall_bath', 'hall', 'bath', [15.5, 9], [18, 9], 'bath'),
      door('d_hall_bedw', 'hall', 'bedroom_w', [13, 12.5], [13, 10], 'bedroom_w'),
      door('d_hall_bede', 'hall', 'bedroom_e', [21, 11.5], [21, 9.2], 'bedroom_e'),
      { id: 'dw_living_kitchen', type: 'doorway', a: 'living', b: 'kitchen', from: v(19, 18), to: v(19, 21.5), state: 'open' },
      door('d_back', 'kitchen', 'side_yard_e', [38, 22], [38, 25], 'kitchen', 'closed', 'glass'),
      windowOn('w_bedw_n', 'bedroom_w', 'back_yard', [3, 0], [8, 0]),
      windowOn('w_bedw_w', 'bedroom_w', 'side_yard_w', [0, 4], [0, 9]),
      windowOn('w_bath_n', 'bath', 'back_yard', [15.5, 0], [18.5, 0]),
      windowOn('w_bede_n', 'bedroom_e', 'back_yard', [27, 0], [32, 0], 'curtains'),
      windowOn('w_bede_e', 'bedroom_e', 'side_yard_e', [38, 4], [38, 9], 'blinds'),
      windowOn('w_living_w', 'living', 'side_yard_w', [0, 18], [0, 23]),
      windowOn('w_living_s', 'living', 'front_yard', [4, 28], [9, 28], 'curtains'),
      windowOn('w_kitchen_s', 'kitchen', 'front_yard', [27, 28], [33, 28]),
      windowOn('w_kitchen_e', 'kitchen', 'side_yard_e', [38, 15.5], [38, 19]),
      path('p_steps', 'front_yard', 'porch', { x: 21, y: 36 }, { x: 27, y: 36 }),
      path('p_front_e', 'front_yard', 'side_yard_e', { x: 44, y: 32 }, { x: 50, y: 32 }),
      path('p_front_w', 'front_yard', 'side_yard_w', { x: 0, y: 32 }, { x: 6, y: 32 }),
      path('p_back_e', 'back_yard', 'side_yard_e', { x: 44, y: 4 }, { x: 50, y: 4 }),
      path('p_back_w', 'back_yard', 'side_yard_w', { x: 0, y: 4 }, { x: 6, y: 4 }),
    ],
    objects: [
      // west bedroom
      obj('o_bedw_bed', 'bed', 'bedroom_w', 2.5, 2, 6, 7, { blocks: true }),
      obj('o_bedw_ns', 'nightstand', 'bedroom_w', 0.6, 2, 1.6, 1.6),
      obj('o_bedw_wardrobe', 'wardrobe', 'bedroom_w', 10.2, 0.6, 2.4, 4, { blocks: true, tags: ['blocks_sight'] }),
      obj('o_bedw_dresser', 'dresser', 'bedroom_w', 0.6, 10.6, 4, 1.8),
      obj('o_bedw_plant', 'plant', 'bedroom_w', 11, 11, 1.4, 1.4),
      // bath
      obj('o_bath_tub', 'tub', 'bath', 13.6, 0.6, 2.6, 5.4, { blocks: true }),
      obj('o_bath_toilet', 'toilet', 'bath', 18.6, 0.6, 1.8, 2.6),
      obj('o_bath_vanity', 'vanity', 'bath', 18.8, 5, 1.8, 2.6),
      // east bedroom (the unknown room in Maple Street scenarios)
      obj('o_bede_bed', 'bed', 'bedroom_e', 28, 1.6, 6.4, 7, { blocks: true }),
      obj('o_bede_ns1', 'nightstand', 'bedroom_e', 34.8, 1.6, 1.6, 1.6),
      obj('o_bede_ns2', 'nightstand', 'bedroom_e', 34.8, 7, 1.6, 1.6),
      obj('o_bede_wardrobe', 'wardrobe', 'bedroom_e', 21.6, 0.6, 2.4, 6, { blocks: true, tags: ['concealment', 'blocks_sight'] }),
      obj('o_bede_rug', 'rug', 'bedroom_e', 26.5, 3, 9, 6),
      // living
      obj('o_liv_rug', 'rug', 'living', 2.5, 17, 12, 8.5),
      obj('o_liv_sofa', 'sofa', 'living', 3.5, 24.4, 9, 2.8, { blocks: true }),
      obj('o_liv_chair1', 'armchair', 'living', 1.2, 18, 3, 3),
      obj('o_liv_chair2', 'armchair', 'living', 13, 18, 3, 3),
      obj('o_liv_table', 'coffee_table', 'living', 6, 19.2, 4.5, 2.4),
      obj('o_liv_plant', 'plant', 'living', 0.8, 14, 1.6, 1.6),
      // kitchen
      obj('o_kit_counter', 'counter', 'kitchen', 22, 14.6, 6, 2, { blocks: true }),
      obj('o_kit_stove', 'stove', 'kitchen', 28.2, 14.6, 2.6, 2),
      obj('o_kit_fridge', 'fridge', 'kitchen', 35.6, 14.6, 2.2, 2.6, { blocks: true, tags: ['blocks_sight'] }),
      obj('o_kit_sink', 'sink', 'kitchen', 36, 17.6, 1.8, 3.6),
      obj('o_kit_table', 'dining_table', 'kitchen', 24.5, 21, 6, 3.4, { blocks: true }),
      obj('o_kit_ch1', 'chair', 'kitchen', 25.5, 19.6, 1.4, 1.4),
      obj('o_kit_ch2', 'chair', 'kitchen', 28.3, 19.6, 1.4, 1.4),
      obj('o_kit_ch3', 'chair', 'kitchen', 25.5, 24.4, 1.4, 1.4),
      obj('o_kit_ch4', 'chair', 'kitchen', 28.3, 24.4, 1.4, 1.4),
      // exterior
      obj('o_steps', 'steps', 'front_yard', 21, 36, 6, 3, { abs: true }),
      obj('o_shrub1', 'shrub', 'front_yard', 3, 34, 3, 3, { abs: true, tags: ['cover'] }),
      obj('o_shrub2', 'shrub', 'front_yard', 8, 33.5, 2.6, 2.6, { abs: true, tags: ['cover'] }),
      obj('o_shrub3', 'shrub', 'front_yard', 33, 33.5, 3, 3, { abs: true, tags: ['cover'] }),
      obj('o_shrub4', 'shrub', 'front_yard', 38, 34.5, 2.6, 2.6, { abs: true, tags: ['cover'] }),
      obj('o_tree1', 'tree', 'front_yard', 12, 37, 4, 4, { abs: true }),
      obj('o_fence', 'fence', 'side_yard_e', 48.5, 6, 0.4, 26, { abs: true }),
      obj('o_fence_front', 'fence', 'front_yard', 48.5, 32, 0.4, 10, { abs: true }),
    ],
    notes: [
      { id: 'n_cover', text: 'Good cover.', at: { x: 3, y: 40 }, decorative: true },
      { id: 'n_fence', text: "Fence line ~40'", at: { x: 41, y: 40 }, decorative: true },
    ],
    entries: ['front_yard', 'side_yard_e'],
  },
};
