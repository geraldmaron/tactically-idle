import type { ObjectType, RoomType } from '../../sim/types';

/** Frozen v7 object vocabulary. Width runs along the back, depth runs forward.
 * These are floor footprints in feet, including the stand/cabinet where present.
 * Tags are the same rules consumed by usable area, cover and sightline models. */
export interface ObjectDefinition {
  type: ObjectType;
  label: string;
  width: number;
  depth: number;
  access: number;
  rooms: readonly RoomType[];
  tags: readonly string[];
}

const solid = ['blocks_space'];
const tall = ['blocks_space', 'blocks_sight'];
export const FURNITURE_V7 = {
  sofa: { type: 'sofa', label: 'Three-seat sofa', width: 7, depth: 3, access: 1.25, rooms: ['living'], tags: ['blocks_space', 'cover'] },
  coffee_table: { type: 'coffee_table', label: 'Low coffee table', width: 4, depth: 2, access: 0, rooms: ['living'], tags: solid },
  tv: { type: 'tv', label: 'Television and shallow stand', width: 4, depth: 1, access: 1, rooms: ['living'], tags: solid },
  bed: { type: 'bed', label: 'Double bed', width: 5.5, depth: 6.75, access: 2, rooms: ['bedroom'], tags: solid },
  nightstand: { type: 'nightstand', label: 'Bedside table', width: 1.5, depth: 1.5, access: 0.5, rooms: ['bedroom'], tags: solid },
  wardrobe: { type: 'wardrobe', label: 'Wardrobe', width: 4, depth: 2, access: 2.5, rooms: ['bedroom'], tags: tall },
  dresser: { type: 'dresser', label: 'Chest of drawers', width: 3.5, depth: 1.75, access: 2, rooms: ['bedroom'], tags: solid },
  counter: { type: 'counter', label: 'Work counter', width: 4, depth: 2, access: 2.5, rooms: ['kitchen', 'retail'], tags: ['blocks_space', 'cover'] },
  sink: { type: 'sink', label: 'Sink cabinet', width: 3, depth: 2, access: 2.5, rooms: ['kitchen', 'utility'], tags: solid },
  stove: { type: 'stove', label: 'Cooker', width: 2.5, depth: 2, access: 2.5, rooms: ['kitchen'], tags: solid },
  fridge: { type: 'fridge', label: 'Refrigerator', width: 2.75, depth: 2.5, access: 2.5, rooms: ['kitchen'], tags: tall },
  tub: { type: 'tub', label: 'Bath', width: 5, depth: 2.5, access: 1.5, rooms: ['bathroom'], tags: solid },
  toilet: { type: 'toilet', label: 'Toilet', width: 1.75, depth: 2.5, access: 2, rooms: ['bathroom'], tags: solid },
  vanity: { type: 'vanity', label: 'Washbasin cabinet', width: 2.5, depth: 1.75, access: 2, rooms: ['bathroom'], tags: solid },
  desk: { type: 'desk', label: 'Desk', width: 5, depth: 2.5, access: 3, rooms: ['office', 'bedroom'], tags: solid },
  shelf: { type: 'shelf', label: 'Tall shelving', width: 5, depth: 1.5, access: 2.5, rooms: ['living', 'storage', 'office', 'retail', 'utility'], tags: tall },
  register: { type: 'register', label: 'Checkout cabinet and register', width: 3.5, depth: 2, access: 2.5, rooms: ['retail'], tags: ['blocks_space', 'valuables'] },
  dining_table: { type: 'dining_table', label: 'Dining table', width: 4, depth: 2.5, access: 0, rooms: ['living', 'kitchen'], tags: solid },
  chair: { type: 'chair', label: 'Dining chair', width: 1.5, depth: 1.5, access: 0, rooms: ['living', 'kitchen', 'office'], tags: solid },
} as const satisfies Partial<Record<ObjectType, ObjectDefinition>>;

export type FurnishingTypeV7 = keyof typeof FURNITURE_V7;
