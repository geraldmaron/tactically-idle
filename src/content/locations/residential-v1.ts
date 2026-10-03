import type { LocationDefinition, LocationFamily, Opening, PlacedObject, Polygon, Room, Vec } from '../../sim/types';

// Additive catalog: these IDs are part of saved incident IDs. Altered plans must
// receive new family IDs; never retrofit a new skeleton into an existing seed.
const point = (x: number, y: number): Vec => ({ x, y });
const rect = (x: number, y: number, right: number, bottom: number): Polygon =>
  [point(x, y), point(right, y), point(right, bottom), point(x, bottom)];
const room = (id: string, label: string, type: Room['type'], polygon: Polygon, tags: string[] = []): Room =>
  ({ id, label, type, floor: 0, polygon, tags });
const door = (id: string, a: string, b: string, x: number, y: number, x2: number, y2: number, material: Opening['material'] = 'hollow_core'): Opening =>
  ({ id, a, b, type: 'door', from: point(x, y), to: point(x2, y2), state: 'closed', material, swing: { hinge: 'from', into: a } });
const window = (id: string, a: string, b: string, x: number, y: number, x2: number, y2: number, covering: Opening['covering'] = 'none'): Opening =>
  ({ id, a, b, type: 'window', from: point(x, y), to: point(x2, y2), state: 'closed', glazing: 'double', covering });
const path = (id: string, a: string, b: string, x: number, y: number, x2: number, y2: number): Opening =>
  ({ id, a, b, type: 'doorway', from: point(x, y), to: point(x2, y2), state: 'open' });
const object = (id: string, type: PlacedObject['type'], space: string, x: number, y: number, w: number, h: number, tags = ['blocks_space']): PlacedObject =>
  ({ id, type, in: space, x, y, w, h, rotation: 0, mechanical: tags.length > 0, tags });
const foundation = (id: string, name: string, w: number, h: number): Pick<LocationDefinition,
  'id' | 'familyId' | 'version' | 'seed' | 'name' | 'setting' | 'units' | 'bounds' | 'floors' | 'wallThickness' | 'materials' | 'notes'> => ({
  id, familyId: id, version: 1, seed: 0, name, setting: 'residential', units: 'ft',
  bounds: { w, h }, floors: 1,
  wallThickness: { exterior: 0.6, interior: 0.35 },
  materials: { exterior: 'brick', interior: 'drywall', overrides: [] }, notes: [],
});

// A sequence of occupied rooms, with an offset opening between living and
// kitchen. The short rear lobby can be reached directly down the side passage.
export const WILLOW_TERRACE: LocationFamily = {
  id: 'willow_terrace_v1', version: 1,
  variations: [
    { kind: 'shiftEdge', id: 'living_kitchen_depth', axis: 'y', at: 34, span: [5, 29], offsets: [-2, 0, 2] },
    { kind: 'openingState', id: 'rear_lobby_access', openingId: 'd_rear', states: ['closed', 'locked'] },
    { kind: 'optionalOpening', id: 'kitchen_side_exit', chance: 0.5, opening: door('d_kitchen_side', 'kitchen', 'side_passage', 29, 24, 29, 27, 'solid_core') },
  ],
  base: {
    ...foundation('willow_terrace_v1', 'Willow Terrace', 37, 60),
    footprint: rect(5, 5, 29, 50),
    rooms: [
      room('bedroom', 'Rear bedroom', 'bedroom', rect(5, 5, 18, 20), ['sleeping']),
      room('bath', 'Bathroom', 'bathroom', rect(18, 5, 29, 14), ['water']),
      room('hall', 'Rear lobby', 'hall', rect(18, 14, 29, 20), ['junction']),
      room('kitchen', 'Kitchen / dining', 'kitchen', rect(5, 20, 29, 34), ['water', 'open']),
      room('living', 'Front room', 'living', rect(5, 34, 29, 50), ['open']),
    ],
    zones: [
      { id: 'rear_lane', label: 'Rear lane', kind: 'alley', polygon: rect(0, 0, 37, 5), tags: [] },
      { id: 'west_path', label: 'Garden path', kind: 'yard', polygon: rect(0, 5, 5, 50), tags: ['narrow'] },
      { id: 'side_passage', label: 'Side passage', kind: 'yard', polygon: rect(29, 5, 37, 50), tags: ['narrow'] },
      { id: 'front_yard', label: 'Front garden', kind: 'yard', polygon: rect(0, 50, 37, 60), tags: ['street', 'cover'] },
    ],
    openings: [
      door('d_front', 'living', 'front_yard', 10, 50, 13, 50, 'solid_core'),
      door('d_rear', 'hall', 'side_passage', 29, 15.5, 29, 18.5, 'solid_core'),
      path('d_living_kitchen', 'living', 'kitchen', 21, 34, 25, 34),
      door('d_kitchen_hall', 'hall', 'kitchen', 21, 20, 24, 20),
      door('d_bedroom', 'bedroom', 'hall', 18, 15.5, 18, 18.5),
      door('d_bath', 'bath', 'hall', 22, 14, 25, 14),
      window('w_bedroom', 'bedroom', 'rear_lane', 9, 5, 14, 5, 'curtains'),
      window('w_living_front', 'living', 'front_yard', 20, 50, 25, 50, 'blinds'),
      window('w_living_side', 'living', 'side_passage', 29, 40, 29, 44),
      window('w_kitchen', 'kitchen', 'west_path', 5, 26, 5, 30),
      path('p_front_w', 'front_yard', 'west_path', 0, 50, 5, 50),
      path('p_front_e', 'front_yard', 'side_passage', 29, 50, 37, 50),
      path('p_rear_w', 'rear_lane', 'west_path', 0, 5, 5, 5),
      path('p_rear_e', 'rear_lane', 'side_passage', 29, 5, 37, 5),
    ],
    objects: [
      object('bed', 'bed', 'bedroom', 6, 7, 6, 7),
      object('wardrobe', 'wardrobe', 'bedroom', 6, 17, 7, 2, ['blocks_space', 'blocks_sight']),
      object('tub', 'tub', 'bath', 19, 6, 3, 6),
      object('toilet', 'toilet', 'bath', 26, 6, 2, 3),
      object('counter', 'counter', 'kitchen', 6, 21, 8, 2),
      object('fridge', 'fridge', 'kitchen', 25, 21, 3, 2, ['blocks_space', 'blocks_sight']),
      object('dining_table', 'dining_table', 'kitchen', 13, 27, 6, 3),
      object('sofa', 'sofa', 'living', 6, 40, 8, 3, ['blocks_space', 'cover']),
      object('bookcase', 'shelf', 'living', 17, 38, 2, 7, ['blocks_space', 'blocks_sight']),
      object('coffee_table', 'coffee_table', 'living', 9, 45, 5, 2),
      object('front_shrub', 'shrub', 'front_yard', 4, 53, 4, 3, ['blocks_space', 'blocks_sight', 'cover']),
    ],
    entries: ['front_yard', 'rear_lane'],
  },
};

// The recessed patio reaches the private wing without crossing the living room.
// The dogleg hall prevents the front entrance looking straight into that wing.
export const ASH_GROVE: LocationFamily = {
  id: 'ash_grove_v1', version: 1,
  variations: [
    { kind: 'shiftEdge', id: 'private_wing_partition', axis: 'x', at: 33, span: [5, 15], offsets: [-1, 0, 2] },
    { kind: 'openingState', id: 'patio_access', openingId: 'd_side', states: ['closed', 'locked'] },
    { kind: 'optionalOpening', id: 'kitchen_living_loop', chance: 0.5, opening: door('d_kitchen_living', 'kitchen', 'living', 10, 29, 13, 29) },
  ],
  base: {
    ...foundation('ash_grove_v1', 'Ash Grove', 53, 53),
    footprint: [point(5, 5), point(45, 5), point(45, 23), point(29, 23), point(29, 43), point(5, 43)],
    materials: { exterior: 'wood_frame', interior: 'drywall', overrides: [] },
    rooms: [
      room('bedroom', 'Rear bedroom', 'bedroom', rect(5, 5, 19, 19), ['sleeping']),
      room('bedroom_e', 'Side bedroom', 'bedroom', rect(19, 5, 33, 15), ['sleeping']),
      room('bath', 'Bathroom', 'bathroom', rect(33, 5, 45, 15), ['water']),
      // Separate straight sections keep the existing opening-to-opening route
      // model inside the dogleg, instead of cutting across the recessed patio.
      room('hall', 'Inner hall', 'hall', rect(19, 15, 29, 29), ['junction']),
      room('side_hall', 'Side hall', 'hall', rect(29, 15, 45, 23), ['junction']),
      room('kitchen', 'Kitchen', 'kitchen', rect(5, 19, 19, 29), ['water']),
      room('living', 'Living room', 'living', rect(5, 29, 29, 43), ['open']),
    ],
    zones: [
      { id: 'rear_garden', label: 'Rear garden', kind: 'yard', polygon: rect(0, 0, 53, 5), tags: [] },
      { id: 'west_path', label: 'West path', kind: 'yard', polygon: rect(0, 5, 5, 43), tags: ['narrow'] },
      { id: 'east_path', label: 'Side path', kind: 'yard', polygon: rect(45, 5, 53, 23), tags: [] },
      { id: 'patio', label: 'Recessed patio', kind: 'porch', polygon: rect(29, 23, 53, 43), tags: ['cover'] },
      { id: 'front_yard', label: 'Front garden', kind: 'yard', polygon: rect(0, 43, 53, 53), tags: ['street'] },
    ],
    openings: [
      door('d_front', 'living', 'front_yard', 16, 43, 19, 43, 'solid_core'),
      door('d_side', 'side_hall', 'patio', 33, 23, 36, 23, 'solid_core'),
      path('d_hall_turn', 'hall', 'side_hall', 29, 18, 29, 21),
      door('d_hall_living', 'hall', 'living', 22, 29, 25, 29),
      door('d_bedroom', 'bedroom', 'hall', 19, 15.5, 19, 18.5),
      door('d_bedroom_e', 'bedroom_e', 'side_hall', 29, 15, 31, 15),
      door('d_bath', 'bath', 'side_hall', 37, 15, 40, 15),
      door('d_kitchen', 'kitchen', 'hall', 19, 23, 19, 26),
      window('w_bedroom', 'bedroom', 'rear_garden', 9, 5, 14, 5, 'curtains'),
      window('w_bedroom_e', 'bedroom_e', 'rear_garden', 23, 5, 28, 5, 'blinds'),
      window('w_bath', 'bath', 'east_path', 45, 8, 45, 11),
      window('w_kitchen', 'kitchen', 'west_path', 5, 21, 5, 25),
      window('w_living_w', 'living', 'west_path', 5, 33, 5, 37),
      window('w_living_front', 'living', 'front_yard', 8, 43, 13, 43),
      path('p_front_w', 'front_yard', 'west_path', 0, 43, 5, 43),
      path('p_front_patio', 'front_yard', 'patio', 29, 43, 53, 43),
      path('p_side', 'patio', 'east_path', 45, 23, 53, 23),
      path('p_rear_w', 'rear_garden', 'west_path', 0, 5, 5, 5),
      path('p_rear_e', 'rear_garden', 'east_path', 45, 5, 53, 5),
    ],
    objects: [
      object('bed', 'bed', 'bedroom', 6, 7, 6, 7),
      object('wardrobe', 'wardrobe', 'bedroom', 6, 16, 7, 2, ['blocks_space', 'blocks_sight']),
      object('bed_e', 'bed', 'bedroom_e', 20, 7, 6, 6),
      object('tub', 'tub', 'bath', 38, 6, 3, 6),
      object('toilet', 'toilet', 'bath', 42, 6, 2, 3),
      object('counter', 'counter', 'kitchen', 7, 20, 8, 2),
      object('kitchen_table', 'dining_table', 'kitchen', 7, 23, 4, 2),
      object('sofa', 'sofa', 'living', 6, 38, 7, 3, ['blocks_space', 'cover']),
      object('shelf', 'shelf', 'living', 25, 32, 2, 7, ['blocks_space', 'blocks_sight']),
      object('coffee_table', 'coffee_table', 'living', 9, 34, 5, 2),
      object('patio_shrub', 'shrub', 'patio', 34, 32, 5, 3, ['blocks_space', 'blocks_sight', 'cover']),
    ],
    entries: ['front_yard', 'patio', 'rear_garden'],
  },
};

// A U around an outdoor court. The transverse gallery links distinct wings;
// opening the optional court door creates a second route around the living room.
export const JUNIPER_COURT: LocationFamily = {
  id: 'juniper_court_v1', version: 1,
  variations: [
    { kind: 'shiftEdge', id: 'gallery_depth', axis: 'y', at: 17, span: [5, 47], offsets: [-1, 0, 1] },
    { kind: 'openingState', id: 'court_access', openingId: 'd_court', states: ['closed', 'locked'] },
    { kind: 'optionalOpening', id: 'living_court_loop', chance: 0.5, opening: door('d_living_court', 'living', 'court', 19, 29, 19, 32, 'glass') },
  ],
  base: {
    ...foundation('juniper_court_v1', 'Juniper Court', 54, 53),
    footprint: [point(5, 5), point(47, 5), point(47, 43), point(33, 43), point(33, 23), point(19, 23), point(19, 43), point(5, 43)],
    rooms: [
      room('bedroom', 'Rear bedroom', 'bedroom', rect(5, 5, 19, 17), ['sleeping']),
      room('bath', 'Bathroom', 'bathroom', rect(19, 5, 29, 17), ['water']),
      room('kitchen', 'Kitchen / dining', 'kitchen', rect(29, 5, 47, 17), ['water']),
      room('hall', 'Cross hall', 'hall', rect(5, 17, 47, 23), ['junction']),
      room('living', 'West living room', 'living', rect(5, 23, 19, 43), ['open']),
      room('bedroom_e', 'Garden bedroom', 'bedroom', rect(33, 23, 47, 43), ['sleeping']),
    ],
    zones: [
      { id: 'rear_garden', label: 'Rear garden', kind: 'yard', polygon: rect(0, 0, 54, 5), tags: [] },
      { id: 'west_path', label: 'West path', kind: 'yard', polygon: rect(0, 5, 5, 43), tags: ['narrow'] },
      { id: 'east_path', label: 'East path', kind: 'yard', polygon: rect(47, 5, 54, 43), tags: [] },
      { id: 'court', label: 'Garden court', kind: 'yard', polygon: rect(19, 23, 33, 43), tags: ['cover'] },
      { id: 'front_yard', label: 'Front garden', kind: 'yard', polygon: rect(0, 43, 54, 53), tags: ['street'] },
    ],
    openings: [
      door('d_front', 'living', 'front_yard', 11, 43, 14, 43, 'solid_core'),
      door('d_court', 'hall', 'court', 23, 23, 26, 23, 'glass'),
      door('d_hall_living', 'living', 'hall', 10, 23, 13, 23),
      door('d_hall_garden_bed', 'bedroom_e', 'hall', 38, 23, 41, 23),
      door('d_bedroom', 'bedroom', 'hall', 10, 17, 13, 17),
      door('d_bath', 'bath', 'hall', 23, 17, 26, 17),
      door('d_kitchen', 'kitchen', 'hall', 36, 17, 39, 17),
      window('w_bedroom', 'bedroom', 'rear_garden', 9, 5, 14, 5, 'curtains'),
      window('w_bath', 'bath', 'rear_garden', 23, 5, 26, 5, 'blinds'),
      window('w_kitchen', 'kitchen', 'rear_garden', 35, 5, 40, 5),
      window('w_living', 'living', 'west_path', 5, 28, 5, 33, 'curtains'),
      window('w_bedroom_e', 'bedroom_e', 'east_path', 47, 28, 47, 33, 'blinds'),
      window('w_bedroom_court', 'bedroom_e', 'court', 33, 33, 33, 37),
      path('p_front_w', 'front_yard', 'west_path', 0, 43, 5, 43),
      path('p_front_e', 'front_yard', 'east_path', 47, 43, 54, 43),
      path('p_front_court', 'front_yard', 'court', 19, 43, 33, 43),
      path('p_rear_w', 'rear_garden', 'west_path', 0, 5, 5, 5),
      path('p_rear_e', 'rear_garden', 'east_path', 47, 5, 54, 5),
    ],
    objects: [
      object('bed', 'bed', 'bedroom', 6, 7, 6, 6),
      object('wardrobe', 'wardrobe', 'bedroom', 16, 7, 2, 6, ['blocks_space', 'blocks_sight']),
      object('tub', 'tub', 'bath', 20, 6, 3, 6),
      object('toilet', 'toilet', 'bath', 26, 8, 2, 3),
      object('counter', 'counter', 'kitchen', 30, 6, 2, 7),
      object('dining_table', 'dining_table', 'kitchen', 39, 10, 5, 3),
      object('sofa', 'sofa', 'living', 10, 35, 7, 3, ['blocks_space', 'cover']),
      object('shelf', 'shelf', 'living', 6, 38, 2, 4, ['blocks_space', 'blocks_sight']),
      object('coffee_table', 'coffee_table', 'living', 10, 31, 5, 2),
      object('garden_bed', 'bed', 'bedroom_e', 38, 34, 6, 7),
      object('garden_wardrobe', 'wardrobe', 'bedroom_e', 34, 24, 2, 6, ['blocks_space', 'blocks_sight']),
      object('court_tree', 'tree', 'court', 22, 34, 4, 4, ['blocks_space', 'blocks_sight', 'cover']),
    ],
    entries: ['front_yard', 'court', 'rear_garden'],
  },
};

export const RESIDENTIAL_FAMILIES_V1 = [WILLOW_TERRACE, ASH_GROVE, JUNIPER_COURT];

export const RESIDENTIAL_LAYOUT_NOTES: Record<string, string> = {
  willow_terrace_v1: 'The front room leads through the kitchen to a short rear lobby. A side passage reaches that lobby directly; offset openings and a bookcase interrupt views.',
  ash_grove_v1: 'An L-shaped bungalow wraps a recessed patio. The side entrance reaches the dogleg hall beside the bedrooms, while the front door enters the living room.',
  juniper_court_v1: 'Two wings face a garden court, joined by a cross hall. The court entrance reaches both wings; the garden bedroom has windows on two sides.',
};
