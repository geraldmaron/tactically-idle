import { describe, expect, it } from 'vitest';
import type { LocationDefinition } from '../../sim/types';
import { PROCEDURAL_FAMILIES } from './index';
import { generatePair, reachLosses } from './procedural/generate';
import { furnishingKeyG1, furnishingShortfallsG1, roomKindG1, validateFurnishingsG1 } from './furnishing-g1';
import { FURNITURE_G1 } from './furnishing-definitions-g1';
import { OBJECT_TAGS } from './procedural/tags';

const LONG = 600_000;
const cache = new Map<string, LocationDefinition>();
const furnished = (family: string, seed: number) => {
  const key = `${family}:${seed}`;
  if (!cache.has(key)) cache.set(key, generatePair(family, seed).furnished);
  return cache.get(key)!;
};
const inRoom = (loc: LocationDefinition, id: string) => loc.objects.filter((o) => o.in === id);

describe('furnishLocationG1', () => {
  it('uses only the documented object tags, and low pieces never block sight', () => {
    const vocabulary = new Set<string>(OBJECT_TAGS);
    for (const [key, def] of Object.entries(FURNITURE_G1)) {
      for (const tag of def.tags) expect(vocabulary.has(tag), `${key} ${tag}`).toBe(true);
      if (['bed', 'chair', 'dining_table', 'coffee_table', 'counter', 'sofa', 'desk', 'tub', 'toilet', 'vanity', 'register', 'stove', 'sink'].includes(def.type)) expect(def.tags, key).not.toContain('blocks_sight');
    }
  });

  it('furnishes every room kind to its kit over 60 seeds per type', () => {
    const bad: string[] = [];
    for (const family of PROCEDURAL_FAMILIES) for (let seed = 0; seed < 60; seed++) {
      const loc = furnished(family.id, seed);
      bad.push(...furnishingShortfallsG1(loc).map((s) => `${loc.id}:${seed} ${s}`), ...validateFurnishingsG1(loc).map((s) => `${loc.id}:${seed} ${s}`));
      for (const room of loc.rooms) {
        const kind = roomKindG1(loc, room), objects = inRoom(loc, room.id), keys = objects.map((o) => furnishingKeyG1(o));
        // Every piece in a room is the g1 furnisher's and names its catalog entry.
        if (keys.some((k) => !k)) bad.push(`${loc.id}:${seed} ${room.id} foreign object`);
        if (kind === 'wc' && objects.some((o) => o.type === 'tub')) bad.push(`${loc.id}:${seed} ${room.id} bathtub in a half bath`);
        if ((kind === 'bedroom' || kind === 'guest_unit') && !objects.some((o) => o.type === 'bed')) bad.push(`${loc.id}:${seed} ${room.id} no bed`);
        if (kind === 'bar' && !objects.some((o) => o.tags.includes('bar') && o.tags.includes('cover'))) bad.push(`${loc.id}:${seed} ${room.id} no bar counter for cover`);
        if (kind === 'bar' && objects.filter((o) => o.type === 'chair').length < 8) bad.push(`${loc.id}:${seed} ${room.id} under eight seats`);
        if (kind === 'warehouse_floor' && objects.filter((o) => o.tags.includes('cover') && o.tags.includes('blocks_sight')).length < 4) bad.push(`${loc.id}:${seed} ${room.id} too little racking`);
        if (kind === 'shop' && !objects.some((o) => o.type === 'register' && o.tags.includes('valuables'))) bad.push(`${loc.id}:${seed} ${room.id} no register holding valuables`);
        if (kind === 'circulation' && objects.length) bad.push(`${loc.id}:${seed} ${room.id} furniture in circulation`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  }, LONG);

  it('never cuts a squad route: over 100 seeds per type, nothing furniture blocks is unreachable from an entry', () => {
    // routeBetween from every entry zone's centroid to every room centroid and staging point, as
    // squad moves are routed on the furnished form. Window staging points may yield to a room's
    // essentials (a toilet under the only window); door, doorway and stair approaches never do.
    const lines: string[] = [];
    const bad: string[] = [];
    for (const family of PROCEDURAL_FAMILIES) {
      let rooms = 0, planRooms = 0, windows = 0;
      for (let seed = 0; seed < 100; seed++) {
        const loc = furnished(family.id, seed);
        const { furniture, plan } = reachLosses(loc);
        for (const id of furniture) {
          if (/^point:sp_w_/.test(id)) windows++;
          else bad.push(`${loc.id}:${seed} ${id}`);
        }
        rooms += loc.rooms.length;
        planRooms += plan.filter((id) => id.startsWith('room:')).length;
      }
      lines.push(`${family.id.padEnd(22)} rooms ${rooms}  unreachable from some entry (plan/yard) ${planRooms}  cut by furniture 0  window points yielded ${windows}`);
    }
    console.log(`REACH\n${lines.join('\n')}`);
    expect(bad.slice(0, 10)).toEqual([]);
  }, LONG);
});

describe('engine-independent arithmetic in the g1 furnisher', () => {
  const SOURCES = import.meta.glob(['./furnishing-g1.ts', './furnishing-definitions-g1.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  // Same rule as procedural-math.test.ts: _g1 output is rebuilt on whatever engine the player runs.
  const BANNED = /\bMath\.(acos|acosh|asin|asinh|atan|atanh|atan2|cbrt|cos|cosh|exp|expm1|hypot|log|log1p|log2|log10|pow|random|sin|sinh|tan|tanh)\b|\*\*/;
  it.each(Object.keys(SOURCES))('%s uses only exactly specified arithmetic', (file) => {
    const code = SOURCES[file].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    expect(code.split('\n').filter((line) => BANNED.test(line))).toEqual([]);
  });
});
