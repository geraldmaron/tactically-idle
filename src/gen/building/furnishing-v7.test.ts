import { describe, expect, it } from 'vitest';
import { MAPLE_STREET } from '../../content/locations/maple-street';
import { buildLocation, deriveLocation } from '../../sim/location';
import { applyChoices, applyVariations, type VariationChoice } from '../../sim/location-variation';
import { validateLocation } from '../../sim/location-validate';
import { footprintRect } from '../../sim/furniture-path';
import { orientObject, objectRect } from '../../ui/blueprint/furniture';
import { BUILDING_FAMILIES, GENERATED_LOCATION_FAMILIES, generateBuilding } from './index';
import { furnishLocationV7, furnishedFamilyIdV7, validateFurnishingsV7 } from './furnishing-v7';

const families = [...GENERATED_LOCATION_FAMILIES, MAPLE_STREET];
const centre = (o: Parameters<typeof footprintRect>[0]) => { const r = footprintRect(o); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };

describe('version-seven room furnishing', () => {
  it('is additive: unchanged legacy keys reproduce their exact original seeded definitions', () => {
    const ids = BUILDING_FAMILIES.map(f => f.id);
    for (const family of families) for (const seed of [0, 1, 17, 4294967295]) {
      const before = JSON.stringify(family);
      const old = applyVariations(family, seed);
      expect(buildLocation(family.id, seed).location).toEqual(old);
      const modern = generateBuilding(furnishedFamilyIdV7(family.id), seed);
      expect(modern.familyId).toBe(family.id);
      expect(modern.id).toBe(furnishedFamilyIdV7(family.id));
      expect(modern.rooms).toEqual(old.rooms);
      expect(modern.openings).toEqual(old.openings);
      const independent = generateBuilding(furnishedFamilyIdV7(family.id), seed);
      modern.objects[0].x += 5;
      modern.openings[0].state = 'blocked';
      expect(generateBuilding(furnishedFamilyIdV7(family.id), seed)).toEqual(independent);
      expect(JSON.stringify(family)).toBe(before);
      expect(buildLocation(family.id, seed).location).toEqual(old);
    }
    expect(BUILDING_FAMILIES.map(f => f.id)).toEqual(ids);
    expect(ids.some(id => id.endsWith('__furnished_v7'))).toBe(false);
  });

  it('keeps rotated footprints, service access and connected interior routes clear across families and seeds', () => {
    for (const family of families) for (let seed = 0; seed < 128; seed++) {
      const id = furnishedFamilyIdV7(family.id), loc = generateBuilding(id, seed);
      expect(generateBuilding(id, seed)).toEqual(loc);
      expect(validateFurnishingsV7(loc), `${id}:${seed}`).toEqual([]);
      expect(validateLocation(loc, deriveLocation(loc)).filter(i => i.severity === 'error' || i.code === 'swing_blocked'), `${id}:${seed}`).toEqual([]);
      for (const room of loc.rooms) {
        const items = loc.objects.filter(o => o.in === room.id);
        if (room.type === 'bedroom') expect(items.some(o => o.type === 'bed'), `${id}:${seed}:${room.id} bed`).toBe(true);
        if (room.type === 'living') expect(items.some(o => o.type === 'sofa'), `${id}:${seed}:${room.id} sofa`).toBe(true);
        if (room.type === 'bathroom') expect(items.some(o => o.type === 'toilet'), `${id}:${seed}:${room.id} toilet`).toBe(true);
        if (room.type === 'kitchen') for (const type of ['sink', 'stove', 'fridge']) expect(items.some(o => o.type === type), `${id}:${seed}:${room.id} ${type}`).toBe(true);
        if (room.type === 'retail') expect(items.some(o => o.type === 'register'), `${id}:${seed}:${room.id} register`).toBe(true);
        if (room.type === 'hall' || room.type === 'stair') expect(items).toEqual([]);
      }
    }
  }, 60_000);

  it('validates every authored partition and optional-door combination before furnishing it', () => {
    for (const family of families) {
      let choices: Record<string, VariationChoice>[] = [{}];
      for (const rule of family.variations) {
        const values = rule.kind === 'shiftEdge' ? rule.offsets : rule.kind === 'openingState' ? rule.states : [false, true];
        choices = choices.flatMap(c => values.map(value => ({ ...c, [rule.id]: value })));
      }
      for (const choice of choices) {
        const loc = furnishLocationV7(applyChoices(family, choice));
        expect(validateFurnishingsV7(loc), `${family.id}:${JSON.stringify(choice)}`).toEqual([]);
      }
    }
  }, 60_000);

  it('has repeatable seed variation with genuine living-room TV/seating groups', () => {
    let tvCount = 0;
    for (const family of families) {
      const signatures = new Set<string>();
      for (let seed = 0; seed < 12; seed++) {
        const loc = generateBuilding(furnishedFamilyIdV7(family.id), seed);
        signatures.add(JSON.stringify(loc.objects));
        for (const tv of loc.objects.filter(o => o.type === 'tv')) {
          tvCount++;
          expect(loc.rooms.find(r => r.id === tv.in)?.type).toBe('living');
          const sofa = loc.objects.find(o => o.type === 'sofa' && o.placement?.group === tv.placement?.group)!;
          const table = loc.objects.find(o => o.type === 'coffee_table' && o.placement?.group === tv.placement?.group)!;
          expect(sofa).toBeDefined(); expect(table).toBeDefined();
          const s = centre(sofa), t = centre(tv), c = centre(table);
          const n = { N: { x: 0, y: 1 }, E: { x: -1, y: 0 }, S: { x: 0, y: -1 }, W: { x: 1, y: 0 } }[sofa.placement!.back];
          expect((t.x - s.x) * n.x + (t.y - s.y) * n.y).toBeGreaterThanOrEqual(7);
          expect((c.x - s.x) * n.x + (c.y - s.y) * n.y).toBeCloseTo(4);
          expect(Math.abs(n.x ? t.y - s.y : t.x - s.x)).toBeLessThan(0.26);
          expect(sofa.placement!.back).not.toBe(tv.placement!.back);
        }
        for (const o of loc.objects.filter(o => o.placement)) {
          expect(orientObject(o, loc).back).toBe(o.placement!.back);
          for (const key of ['x', 'y', 'w', 'h'] as const) expect(objectRect(o)[key]).toBeCloseTo(footprintRect(o)[key], 10);
        }
      }
      expect(signatures.size).toBeGreaterThan(5);
    }
    expect(tvCount).toBeGreaterThan(30);
  }, 30_000);

  it('rejects a furniture collision and an obstructed opening rather than treating graph reachability as clearance', () => {
    const loc = generateBuilding(furnishedFamilyIdV7('willow_terrace_v1'), 0);
    const sofa = loc.objects.find(o => o.type === 'sofa')!;
    const table = loc.objects.find(o => o.type === 'coffee_table')!;
    Object.assign(table, { x: sofa.x, y: sofa.y, rotation: sofa.rotation });
    expect(validateFurnishingsV7(loc).some(e => e.includes('overlaps'))).toBe(true);
    const door = loc.openings.find(o => o.id === 'd_front')!;
    Object.assign(sofa, { x: door.from.x, y: door.from.y - 2, rotation: 0 });
    expect(validateFurnishingsV7(loc).some(e => e.includes('opening approach obstructed'))).toBe(true);
  });
});
