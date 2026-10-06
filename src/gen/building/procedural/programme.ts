import type { RoomType } from '../../../sim/types';
import type { RoomClass, RoomSeed, WindowKind } from './types';

interface SeedOpts {
  area: number;
  min?: number;
  max?: number;
  minW?: number;
  aspect?: number;
  front?: number;
  hall?: boolean;
  cap?: boolean;
  required?: boolean;
  prob?: number;
  tags?: string[];
  kit?: string;
  windows?: WindowKind;
  label?: string;
  cls?: RoomClass;
  ensuite?: RoomSeed;
}

/** Build a seed with sensible defaults: area range 0.65x to 1.7x of the target, 6 ft minimum width. */
export function seed(key: string, type: RoomType, o: SeedOpts): RoomSeed {
  const cls: RoomClass = o.cls ?? (type === 'hall' || type === 'stair' ? 'circ' : type === 'living' || type === 'kitchen' || type === 'retail' ? 'pub' : 'leaf');
  return {
    key,
    type,
    label: o.label ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    cls,
    area: o.area,
    minArea: o.min ?? Math.round(o.area * 0.65),
    maxArea: o.max ?? Math.round(o.area * 1.7),
    minW: o.minW ?? 6,
    maxAspect: o.aspect ?? 3,
    front: o.front ?? 0.5,
    needsHall: o.hall ?? false,
    capOk: o.cap ?? cls === 'pub',
    required: o.required ?? false,
    prob: o.prob ?? 1,
    tags: o.tags ?? [],
    kit: o.kit ?? key,
    windows: o.windows ?? 'normal',
    ...(o.ensuite ? { ensuite: o.ensuite } : {}),
  };
}

/** Standard dwelling rooms. Areas are targets in sq ft; plausible ranges follow the defaults. */
export const D = {
  living: (area = 200, o: Partial<SeedOpts> = {}) =>
    seed('living', 'living', { area, min: 130, max: Math.max(340, area * 1.5), minW: 11, aspect: 2.6, front: 0.9, required: true, tags: ['public', 'living'], windows: 'large', ...o }),
  dining: (area = 110, o: Partial<SeedOpts> = {}) =>
    seed('dining', 'living', { area, min: 80, max: 200, minW: 8, aspect: 2.4, front: 0.6, tags: ['public', 'dining'], label: 'Dining', ...o }),
  kitchen: (area = 140, o: Partial<SeedOpts> = {}) =>
    seed('kitchen', 'kitchen', { area, min: 90, max: 260, minW: 8, aspect: 2.6, front: 0.45, required: true, tags: ['public', 'cooking', 'water'], ...o }),
  bedroom: (area = 130, o: Partial<SeedOpts> = {}) =>
    seed('bedroom', 'bedroom', { area, min: 80, max: 260, minW: 8.5, aspect: 2.3, front: 0.25, hall: true, tags: ['private', 'sleeping', 'lockable'], ...o }),
  bath: (area = 55, o: Partial<SeedOpts> = {}) =>
    seed('bath', 'bathroom', { area, min: 40, max: 95, minW: 6, aspect: 2.3, front: 0.3, hall: true, tags: ['private', 'water', 'lockable'], windows: 'small', ...o }),
  ensuite: (area = 42) =>
    seed('bath', 'bathroom', { area, min: 36, max: 70, minW: 6, tags: ['private', 'water', 'lockable', 'ensuite'], windows: 'small', label: 'Ensuite' }),
  wc: (area = 30, o: Partial<SeedOpts> = {}) =>
    seed('wc', 'bathroom', { area, min: 18, max: 60, minW: 4.5, aspect: 2.9, front: 0.5, hall: true, tags: ['water', 'lockable', 'wc'], windows: 'small', label: 'WC', ...o }),
  utility: (area = 48, o: Partial<SeedOpts> = {}) =>
    seed('utility', 'utility', { area, min: 32, max: 90, minW: 5.5, front: 0.3, tags: ['service', 'utility'], windows: 'small', ...o }),
  storage: (area = 36, o: Partial<SeedOpts> = {}) =>
    seed('storage', 'storage', { area, min: 24, max: 80, minW: 5, front: 0.3, tags: ['service', 'storage'], windows: 'none', ...o }),
  study: (area = 100, o: Partial<SeedOpts> = {}) =>
    seed('office', 'office', { area, min: 72, max: 170, minW: 8, front: 0.5, hall: true, tags: ['private', 'work', 'lockable'], label: 'Study', kit: 'study', ...o }),
  hall: (o: Partial<SeedOpts> = {}) =>
    seed('hall', 'hall', { area: 40, min: 12, max: 400, minW: 3.5, aspect: 99, front: 0.5, cls: 'circ', tags: ['circulation', 'narrow'], windows: 'none', kit: 'hall', ...o }),
};

/** Baths for a dwelling: a required bath, then either an ensuite on the first bedroom or a second bath. */
export function bathSeeds(rng: { chance(p: number): boolean; snapped(a: number, b: number): number }, second = 0.25, ensuite = 0.3): { main: RoomSeed[]; ensuite?: RoomSeed } {
  const ens = rng.chance(ensuite);
  const main = [D.bath(rng.snapped(48, 70), { required: true })];
  if (!ens) main.push(D.bath(rng.snapped(40, 55), { prob: second }));
  return ens ? { main, ensuite: D.ensuite() } : { main };
}

/** A closet or store for a small leftover piece of floor. */
export const CLOSET = seed('storage', 'storage', { area: 50, min: 16, max: 130, minW: 5, front: 0.3, hall: true, tags: ['service', 'storage'], windows: 'none', label: 'Storage' });
