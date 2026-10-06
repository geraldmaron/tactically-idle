import type { ObjectDefinition } from './furnishing-definitions-v7';

/** Furniture for generated (`_g1`) buildings. Keys are catalog entries, not object types: a
 * pallet rack, a gondola and a filing cabinet are all `shelf` symbols with their own footprint,
 * service front and tags. Width runs along the back, depth runs forward, feet. Tags are the
 * rules the game reads: blocks_space (usable area, routes), blocks_sight/concealment (sightlines
 * and signal), cover, valuables (where a robbery looks), hazard, and the descriptive vocabulary
 * in procedural/tags.ts. Low pieces never carry blocks_sight. Frozen with the `_g1` output. */
const solid = ['blocks_space'];
const low = ['blocks_space', 'cover'];
const tall = ['blocks_space', 'blocks_sight'];
const def = (type: ObjectDefinition['type'], label: string, width: number, depth: number, access: number, tags: readonly string[]): ObjectDefinition =>
  ({ type, label, width, depth, access, rooms: [], tags });

export const FURNITURE_G1 = {
  // Homes. v7's solver routines (living, dining, bathroom) read these keys.
  sofa: def('sofa', 'Three-seat sofa', 7, 3, 1.25, low),
  loveseat: def('sofa', 'Two-seat sofa', 5, 3, 1.25, low),
  armchair: def('armchair', 'Armchair', 2.75, 2.75, 1, solid),
  coffee_table: def('coffee_table', 'Low coffee table', 4, 2, 0, solid),
  tv: def('tv', 'Television and shallow stand', 4, 1, 1, ['blocks_space', 'valuables']),
  bookcase: def('shelf', 'Bookcase', 4, 1.25, 2, tall),
  bed: def('bed', 'Double bed', 5.5, 6.75, 2, solid),
  twin_bed: def('bed', 'Twin bed', 3.5, 6.5, 2, solid),
  nightstand: def('nightstand', 'Bedside table', 1.5, 1.5, 0.5, solid),
  wardrobe: def('wardrobe', 'Wardrobe', 4, 2, 2.5, ['blocks_space', 'blocks_sight', 'concealment', 'storage']),
  dresser: def('dresser', 'Chest of drawers', 3.5, 1.75, 2, solid),
  jewelry_dresser: def('dresser', 'Chest of drawers (jewelry, cash)', 3.5, 1.75, 2, ['blocks_space', 'valuables']),
  desk: def('desk', 'Desk', 4.5, 2.25, 0, low),
  chair: def('chair', 'Chair', 1.5, 1.5, 0, solid),
  dining_table: def('dining_table', 'Dining table', 4, 2.5, 0, solid),
  sink: def('sink', 'Sink cabinet', 3, 2, 2.5, ['blocks_space', 'appliance']),
  stove: def('stove', 'Cooker', 2.5, 2, 2.5, ['blocks_space', 'appliance', 'hazard']),
  fridge: def('fridge', 'Refrigerator', 2.75, 2.5, 2.5, ['blocks_space', 'blocks_sight', 'appliance']),
  counter: def('counter', 'Work counter', 4, 2, 2.5, low),
  tub: def('tub', 'Bath', 5, 2.5, 1.5, solid),
  shower: def('tub', 'Shower stall', 3, 3, 1.5, ['blocks_space', 'shower']),
  toilet: def('toilet', 'Toilet', 1.75, 2.5, 2, solid),
  vanity: def('vanity', 'Washbasin cabinet', 2.5, 1.75, 2, solid),
  basin: def('vanity', 'Wall basin', 1.75, 1.25, 1.75, solid),
  washer: def('counter', 'Washing machine', 2.25, 2.25, 2.5, ['blocks_space', 'appliance']),
  dryer: def('counter', 'Dryer', 2.25, 2.25, 2.5, ['blocks_space', 'appliance']),
  water_heater: def('counter', 'Water heater', 2, 2, 1.5, ['blocks_space', 'hazard', 'boiler']),
  utility_sink: def('sink', 'Utility sink', 2, 1.75, 2, ['blocks_space']),
  storage_shelf: def('shelf', 'Storage shelving', 4, 1.5, 2.5, ['blocks_space', 'blocks_sight', 'storage']),
  // Shops and bars.
  checkout: def('counter', 'Checkout counter', 6, 2.5, 0, low),
  register: def('register', 'Register and cash drawer', 2, 1.75, 2, ['blocks_space', 'valuables']),
  gondola: def('shelf', 'Aisle shelving', 8, 2.5, 0, ['blocks_space', 'blocks_sight', 'cover', 'storage']),
  wall_shelf: def('shelf', 'Wall shelving', 6, 1.5, 2.5, ['blocks_space', 'blocks_sight', 'storage']),
  cooler: def('fridge', 'Drinks cooler', 3, 2.5, 2.5, ['blocks_space', 'blocks_sight', 'appliance']),
  back_bar: def('shelf', 'Back bar (bottles, till drawer)', 10, 1.5, 0, ['blocks_space', 'blocks_sight', 'valuables', 'bar']),
  bar_counter: def('counter', 'Bar counter', 10, 2.5, 0, ['blocks_space', 'cover', 'bar']),
  stool: def('chair', 'Bar stool', 1.25, 1.25, 0, solid),
  booth: def('sofa', 'Booth bench', 5, 2, 0, low),
  cafe_table: def('dining_table', 'Table for two', 2.5, 2.5, 0, solid),
  // Commercial kitchen and stores.
  range: def('stove', 'Commercial range', 5, 2.75, 3, ['blocks_space', 'appliance', 'hazard']),
  prep_sink: def('sink', 'Three-bay sink', 5, 2.25, 3, ['blocks_space', 'appliance']),
  reach_in: def('fridge', 'Reach-in refrigerator', 3, 2.75, 3, ['blocks_space', 'blocks_sight', 'appliance']),
  prep_counter: def('counter', 'Prep counter', 6, 2.5, 3, low),
  prep_table: def('counter', 'Steel prep table', 6, 2.5, 0, low),
  cold_shelf: def('shelf', 'Cooler shelving', 5, 2, 2.5, ['blocks_space', 'blocks_sight', 'storage']),
  // Offices.
  workstation: def('desk', 'Workstation', 5, 2.5, 0, low),
  exec_desk: def('desk', 'Executive desk', 6, 2.75, 0, low),
  filing: def('shelf', 'Filing cabinets', 3, 1.75, 2.5, ['blocks_space', 'blocks_sight', 'storage']),
  safe: def('shelf', 'Safe', 2, 2, 2, ['blocks_space', 'cover', 'valuables', 'safe']),
  key_cabinet: def('shelf', 'Key and cash cabinet', 3, 1.25, 2, ['blocks_space', 'valuables']),
  reception_desk: def('counter', 'Reception desk', 7, 2.5, 0, low),
  meeting_table: def('dining_table', 'Meeting table', 8, 3.5, 0, low),
  lockers: def('shelf', 'Lockers', 6, 1.5, 2.5, ['blocks_space', 'blocks_sight', 'concealment', 'storage']),
  server_rack: def('shelf', 'Server rack', 2, 3.5, 3, ['blocks_space', 'blocks_sight', 'server', 'valuables', 'hazard']),
  // Warehouse.
  pallet_rack: def('shelf', 'Pallet racking', 10, 3.5, 0, ['blocks_space', 'blocks_sight', 'cover', 'storage']),
  wall_rack: def('shelf', 'Wall racking', 8, 3, 3, ['blocks_space', 'blocks_sight', 'cover', 'storage']),
  pallet: def('counter', 'Stacked pallets', 4, 4, 0, ['blocks_space', 'cover', 'storage']),
  workbench: def('counter', 'Workbench', 6, 2.5, 3, ['blocks_space', 'cover', 'equipment']),
} as const satisfies Record<string, ObjectDefinition>;

export type FurnishingKeyG1 = keyof typeof FURNITURE_G1;
