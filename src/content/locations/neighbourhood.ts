import type { LocationDefinition, LocationFamily, Opening, PlacedObject, Polygon, Room, Vec } from '../../sim/types';

// A small authored neighbourhood, with different circulation, access and furniture.
// Seeded changes move real partitions or add a connecting door; addresses never
// disguise copies of Maple Street. Keep these version-1 layouts stable for saves.
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
const foundation = (id: string, name: string, setting: LocationDefinition['setting'], w: number, h: number) => ({
  id, familyId: id, version: 1, seed: 0, name, setting, units: 'ft' as const,
  bounds: { w, h }, floors: 1,
  wallThickness: { exterior: 0.6, interior: 0.35 },
  materials: { exterior: 'brick' as const, interior: 'drywall' as const, overrides: [] },
  notes: [],
});

export const CEDAR_CLOSE: LocationFamily = {
  id: 'cedar_close', version: 1,
  variations: [
    { kind: 'shiftEdge', id: 'rear_bedroom_depth', axis: 'y', at: 21, span: [22, 34], offsets: [-1, 0, 1, 2] },
    { kind: 'openingState', id: 'rear_access', openingId: 'd_rear', states: ['closed', 'locked'] },
    { kind: 'optionalOpening', id: 'living_hall_loop', chance: 0.5, opening: door('d_living_hall', 'living', 'hall', 18, 29.5, 18, 32) },
  ],
  base: {
    ...foundation('cedar_close', 'Cedar Close', 'residential', 40, 55),
    footprint: rect(6, 5, 34, 45),
    rooms: [
      room('bedroom_w', 'Rear bedroom', 'bedroom', rect(6, 5, 18, 19), ['sleeping']),
      room('bedroom_e', 'Side bedroom', 'bedroom', rect(22, 5, 34, 21), ['sleeping']),
      room('bath', 'Bathroom', 'bathroom', rect(6, 19, 18, 29), ['water']),
      room('hall', 'Long hall', 'hall', rect(18, 5, 22, 33), ['narrow', 'junction']),
      room('kitchen', 'Kitchen', 'kitchen', rect(22, 21, 34, 33), ['water']),
      room('living', 'Living room', 'living', [point(6, 29), point(18, 29), point(18, 33), point(34, 33), point(34, 45), point(6, 45)], ['open']),
    ],
    zones: [
      { id: 'rear_lane', label: 'Rear lane', kind: 'alley', polygon: rect(0, 0, 40, 5), tags: [] },
      { id: 'west_path', label: 'West path', kind: 'yard', polygon: rect(0, 5, 6, 45), tags: ['narrow'] },
      { id: 'east_path', label: 'East path', kind: 'yard', polygon: rect(34, 5, 40, 45), tags: ['narrow'] },
      { id: 'front_yard', label: 'Front garden', kind: 'yard', polygon: rect(0, 45, 40, 55), tags: ['street', 'cover'] },
    ],
    openings: [
      door('d_front', 'living', 'front_yard', 18, 45, 21, 45, 'solid_core'),
      door('d_rear', 'hall', 'rear_lane', 18.5, 5, 21.5, 5, 'solid_core'),
      door('d_hall_living', 'hall', 'living', 18.5, 33, 21.5, 33),
      door('d_hall_bedw', 'bedroom_w', 'hall', 18, 12, 18, 15),
      door('d_hall_bede', 'bedroom_e', 'hall', 22, 12, 22, 15),
      door('d_hall_bath', 'bath', 'hall', 18, 23, 18, 26),
      door('d_hall_kitchen', 'kitchen', 'hall', 22, 26, 22, 29),
      window('w_bedw', 'bedroom_w', 'rear_lane', 9, 5, 14, 5, 'curtains'),
      window('w_bede', 'bedroom_e', 'east_path', 34, 10, 34, 15, 'blinds'),
      window('w_living', 'living', 'front_yard', 25, 45, 30, 45),
      window('w_kitchen', 'kitchen', 'east_path', 34, 26, 34, 30),
      path('p_front_w', 'front_yard', 'west_path', 0, 45, 6, 45),
      path('p_front_e', 'front_yard', 'east_path', 34, 45, 40, 45),
      path('p_rear_w', 'rear_lane', 'west_path', 0, 5, 6, 5),
      path('p_rear_e', 'rear_lane', 'east_path', 34, 5, 40, 5),
    ],
    objects: [
      object('bed_w', 'bed', 'bedroom_w', 7, 6, 6, 7),
      object('wardrobe_w', 'wardrobe', 'bedroom_w', 7, 16, 7, 2, ['blocks_space', 'blocks_sight']),
      object('bed_e', 'bed', 'bedroom_e', 27, 6, 6, 7),
      object('desk_e', 'desk', 'bedroom_e', 27, 17, 5, 2),
      object('bath_tub', 'tub', 'bath', 7, 20, 3, 6),
      object('bath_toilet', 'toilet', 'bath', 14, 20, 2, 3),
      object('kitchen_counter', 'counter', 'kitchen', 27, 24, 6, 2),
      object('kitchen_table', 'dining_table', 'kitchen', 26, 29, 4, 3),
      object('sofa', 'sofa', 'living', 7, 40, 8, 3),
      object('living_table', 'coffee_table', 'living', 9, 35, 5, 2),
      object('front_shrub', 'shrub', 'front_yard', 7, 47, 5, 3, ['cover']),
    ],
    entries: ['front_yard', 'rear_lane'],
  },
};

export const HARBOUR_COURT: LocationFamily = {
  id: 'harbour_court', version: 1,
  variations: [
    { kind: 'shiftEdge', id: 'bedroom_width', axis: 'x', at: 19, span: [5, 19], offsets: [-1, 0, 1] },
    { kind: 'openingState', id: 'courtyard_access', openingId: 'd_courtyard', states: ['closed', 'locked'] },
  ],
  base: {
    ...foundation('harbour_court', 'Harbour Court', 'apartment', 46, 40),
    footprint: rect(5, 5, 41, 29),
    materials: { exterior: 'concrete', interior: 'plaster', overrides: [] },
    rooms: [
      room('bedroom', 'Bedroom', 'bedroom', rect(5, 5, 19, 19), ['sleeping']),
      room('bath', 'Bathroom', 'bathroom', rect(19, 5, 29, 14), ['water']),
      room('hall', 'Inner hall', 'hall', rect(19, 14, 29, 19), ['narrow', 'junction']),
      room('kitchen', 'Kitchen', 'kitchen', rect(29, 5, 41, 19), ['water']),
      room('living', 'Living / dining', 'living', rect(5, 19, 41, 29), ['open']),
    ],
    zones: [
      { id: 'garden', label: 'Rear garden', kind: 'yard', polygon: rect(0, 0, 46, 5), tags: [] },
      { id: 'west_path', label: 'Garden path', kind: 'yard', polygon: rect(0, 5, 5, 29), tags: ['narrow'] },
      { id: 'courtyard', label: 'Courtyard', kind: 'yard', polygon: rect(41, 5, 46, 29), tags: ['exposed'] },
      { id: 'walkway', label: 'Shared walkway', kind: 'porch', polygon: rect(0, 29, 46, 40), tags: ['street', 'exposed'] },
    ],
    openings: [
      door('d_front', 'living', 'walkway', 21, 29, 24, 29, 'solid_core'),
      door('d_courtyard', 'living', 'courtyard', 41, 22, 41, 25, 'glass'),
      door('d_living_hall', 'hall', 'living', 23, 19, 26, 19),
      door('d_bedroom', 'bedroom', 'hall', 19, 15, 19, 18),
      door('d_kitchen', 'kitchen', 'hall', 29, 15, 29, 18),
      door('d_bath', 'bath', 'hall', 23, 14, 26, 14),
      window('w_bedroom', 'bedroom', 'garden', 8, 5, 14, 5, 'curtains'),
      window('w_kitchen', 'kitchen', 'garden', 32, 5, 38, 5),
      window('w_living', 'living', 'walkway', 9, 29, 16, 29, 'blinds'),
      path('p_walk_w', 'walkway', 'west_path', 0, 29, 5, 29),
      path('p_walk_e', 'walkway', 'courtyard', 41, 29, 46, 29),
      path('p_garden_w', 'garden', 'west_path', 0, 5, 5, 5),
      path('p_garden_e', 'garden', 'courtyard', 41, 5, 46, 5),
    ],
    objects: [
      object('bed', 'bed', 'bedroom', 6, 7, 6, 7),
      object('wardrobe', 'wardrobe', 'bedroom', 14, 6, 3, 6, ['blocks_space', 'blocks_sight']),
      object('tub', 'tub', 'bath', 21, 6, 3, 6),
      object('toilet', 'toilet', 'bath', 26, 6, 2, 3),
      object('counter', 'counter', 'kitchen', 30, 6, 2, 6),
      object('fridge', 'fridge', 'kitchen', 37, 6, 3, 3, ['blocks_space', 'blocks_sight']),
      object('sofa', 'sofa', 'living', 6, 20, 8, 3),
      object('coffee_table', 'coffee_table', 'living', 9, 25, 4, 2),
      object('dining_table', 'dining_table', 'living', 31, 21, 6, 4),
      object('courtyard_plant', 'plant', 'courtyard', 42, 9, 3, 3, []),
    ],
    entries: ['walkway', 'courtyard'],
  },
};

export const MARKET_ROW: LocationFamily = {
  id: 'market_row', version: 1,
  variations: [
    { kind: 'openingState', id: 'delivery_door', openingId: 'd_delivery', states: ['closed', 'locked'] },
    { kind: 'optionalOpening', id: 'office_stock_link', chance: 0.5, opening: door('d_office_stock', 'office', 'stockroom', 33, 10, 33, 13, 'solid_core') },
    { kind: 'shiftEdge', id: 'stockroom_width', axis: 'x', at: 33, span: [5, 17], offsets: [-1, 0, 1, 2] },
  ],
  base: {
    ...foundation('market_row', 'Market Row Stores', 'business', 54, 51),
    footprint: [point(5, 5), point(47, 5), point(47, 29), point(33, 29), point(33, 41), point(5, 41)],
    materials: { exterior: 'brick', interior: 'plaster', overrides: [{ a: 'office', b: 'shop', material: 'glass_partition' }] },
    rooms: [
      room('stockroom', 'Stockroom', 'storage', rect(5, 5, 33, 17), ['clutter', 'valuables']),
      room('office', 'Back office', 'office', rect(33, 5, 47, 17), ['valuables']),
      room('shop', 'Shop floor', 'retail', [point(5, 17), point(47, 17), point(47, 29), point(33, 29), point(33, 41), point(5, 41)], ['open', 'valuables']),
    ],
    zones: [
      { id: 'delivery_lane', label: 'Delivery lane', kind: 'alley', polygon: rect(0, 0, 54, 5), tags: [] },
      { id: 'west_alley', label: 'West alley', kind: 'alley', polygon: rect(0, 5, 5, 41), tags: ['narrow'] },
      { id: 'east_alley', label: 'East alley', kind: 'alley', polygon: rect(47, 5, 54, 29), tags: [] },
      { id: 'forecourt', label: 'Side forecourt', kind: 'parking', polygon: rect(33, 29, 54, 41), tags: ['exposed'] },
      { id: 'pavement', label: 'High street', kind: 'street', polygon: rect(0, 41, 54, 51), tags: ['street', 'exposed'] },
    ],
    openings: [
      door('d_front', 'shop', 'pavement', 18, 41, 22, 41, 'glass'),
      door('d_side', 'shop', 'forecourt', 33, 33, 33, 37, 'glass'),
      door('d_delivery', 'stockroom', 'delivery_lane', 17, 5, 22, 5, 'steel'),
      door('d_stock', 'stockroom', 'shop', 17, 17, 21, 17, 'solid_core'),
      door('d_office', 'office', 'shop', 38, 17, 41, 17, 'glass'),
      window('w_office', 'office', 'east_alley', 47, 9, 47, 14, 'blinds'),
      window('w_shop_front', 'shop', 'pavement', 8, 41, 15, 41),
      window('w_shop_side', 'shop', 'east_alley', 47, 20, 47, 26),
      path('p_front_w', 'pavement', 'west_alley', 0, 41, 5, 41),
      path('p_front_e', 'pavement', 'forecourt', 33, 41, 54, 41),
      path('p_east', 'forecourt', 'east_alley', 47, 29, 54, 29),
      path('p_back_w', 'delivery_lane', 'west_alley', 0, 5, 5, 5),
      path('p_back_e', 'delivery_lane', 'east_alley', 47, 5, 54, 5),
    ],
    objects: [
      object('stock_shelf_1', 'shelf', 'stockroom', 6, 6, 8, 2, ['blocks_space', 'blocks_sight', 'concealment']),
      object('stock_shelf_2', 'shelf', 'stockroom', 6, 11, 8, 2, ['blocks_space', 'blocks_sight']),
      object('stock_shelf_3', 'shelf', 'stockroom', 25, 6, 5, 2, ['blocks_space', 'blocks_sight']),
      object('desk', 'desk', 'office', 37, 6, 7, 3),
      object('office_shelf', 'shelf', 'office', 44, 6, 2, 5, ['blocks_space', 'blocks_sight']),
      object('shop_shelf_1', 'shelf', 'shop', 8, 21, 3, 10, ['blocks_space', 'blocks_sight']),
      object('shop_shelf_2', 'shelf', 'shop', 17, 21, 3, 10, ['blocks_space', 'blocks_sight']),
      object('counter', 'counter', 'shop', 25, 20, 9, 3, ['blocks_space', 'cover']),
      object('register', 'register', 'shop', 30, 20.5, 2, 1.5, ['valuables']),
    ],
    entries: ['pavement', 'delivery_lane', 'forecourt'],
  },
};

export const NEIGHBOURHOOD_FAMILIES = [CEDAR_CLOSE, HARBOUR_COURT, MARKET_ROW];
