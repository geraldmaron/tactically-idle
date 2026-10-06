import { describe, expect, it } from 'vitest';
import type { LocationDefinition, Opening, Vec } from '../../../sim/types';
import { deriveLocation } from '../../../sim/location';
import { validateLocation } from '../../../sim/location-validate';
import { FAMILIES } from './families';
import { polyArea } from './geom';
import { furnishingShortfallsG1, furnishLocationG1, validateFurnishingsG1 } from '../furnishing-g1';
import { BUILDING_FAMILIES } from './index';
import { PASS_SCORE, planSignature, plausibilityReport } from './plausibility';
import { generate, generateFallback, generatePair, publicFamilyId, type AttemptStats, type GeneratedBuilding } from './generate';
import { OBJECT_TAGS, ROOM_TAGS, ZONE_TAGS } from './tags';

/** Seeds per family for validation, distinctness and shape coverage (the acceptance run). */
export const SEEDS = 200;
/** Seeds sampled for the heavier per-building checks. */
const SAMPLE = 150;
const LONG = 120_000;

const cache = new Map<string, GeneratedBuilding[]>();
function pairs(family: string): GeneratedBuilding[] {
  let list = cache.get(family);
  if (!list) {
    list = [];
    for (let s = 0; s < SEEDS; s++) list.push(generatePair(family, s));
    cache.set(family, list);
  }
  return list;
}
const plans = (family: string): LocationDefinition[] => pairs(family).map((p) => p.plain);
const furnishedPlans = (family: string): LocationDefinition[] => pairs(family).map((p) => p.furnished);

const roomIds = (loc: LocationDefinition) => new Set(loc.rooms.map((r) => r.id));
const bbox = (loc: LocationDefinition, id: string) => {
  const r = loc.rooms.find((q) => q.id === id) as LocationDefinition['rooms'][number];
  const xs = r.polygon.map((p) => p.x);
  const ys = r.polygon.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

/** rect, L, T, U, chamfer or other, from the outline alone. */
export function shapeOf(loc: LocationDefinition): string {
  const p: Vec[] = loc.footprint;
  if (p.some((q, i) => {
    const n = p[(i + 1) % p.length];
    return Math.abs(q.x - n.x) > 1e-9 && Math.abs(q.y - n.y) > 1e-9;
  }))
    return 'chamfer';
  const cross = (a: Vec, b: Vec, c: Vec) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  const reflex: number[] = [];
  p.forEach((q, i) => {
    if (cross(p[(i + p.length - 1) % p.length], q, p[(i + 1) % p.length]) < 0) reflex.push(i);
  });
  if (p.length === 4) return 'rect';
  if (reflex.length === 1) return 'L';
  if (reflex.length === 2 && p.length === 8) {
    const adjacent = (reflex[1] - reflex[0]) % p.length === 1 || (reflex[0] - reflex[1] + p.length) % p.length === 1;
    return adjacent ? 'U' : 'T';
  }
  return 'other';
}

export function familySuite(familyId: string): void {
  const fam = BUILDING_FAMILIES.find((f) => f.id === familyId) as (typeof BUILDING_FAMILIES)[number];
  const spec = FAMILIES.find((f) => f.id === familyId);

  describe(familyId, () => {
    it(`validates plan and furnished plan with zero errors or warnings for seeds 0..${SEEDS - 1}`, () => {
      const bad: string[] = [];
      for (const [s, pair] of pairs(fam.id).entries()) {
        // Warnings (a swing blocked by furniture, a window off the wall) count too: the plan should be clean.
        for (const loc of [pair.plain, pair.furnished]) {
          const issues = validateLocation(loc, deriveLocation(loc));
          if (issues.length) bad.push(`seed ${s} ${loc.id}: ${issues.map((i) => `[${i.code}] ${i.message}`).join('; ')}`);
        }
        const diag = validateFurnishingsG1(pair.furnished);
        if (diag.length) bad.push(`seed ${s} furnishing: ${diag.join('; ')}`);
        const short = furnishingShortfallsG1(pair.furnished);
        if (short.length) bad.push(`seed ${s} kit: ${short.join('; ')}`);
      }
      expect(bad.slice(0, 5)).toEqual([]);
    }, LONG);

    it('is deterministic: the same seed gives a deep-equal building, furnished exactly as the game furnishes it', () => {
      for (const s of [0, 1, 7, 42, 99, 250, 499]) {
        const a = generatePair(fam.id, s);
        expect(generatePair(fam.id, s)).toEqual(a);
        expect(furnishLocationG1(a.plain)).toEqual(a.furnished);
        expect(a.plain.seed).toBe(s);
        expect(a.plain.familyId).toBe(publicFamilyId(fam.id));
        expect(a.plain.setting).toBe(fam.setting);
        // Interior furniture belongs to furnishLocationG1 alone; the plan keeps only yard objects.
        const rooms = new Set(a.plain.rooms.map((r) => r.id));
        expect(a.plain.objects.filter((o) => rooms.has(o.in))).toEqual([]);
      }
      expect(generate(fam.id, 3)).not.toEqual(generate(fam.id, 4));
    }, LONG);

    it('never needs the fallback or throws on seeds far from the tested range', () => {
      const stats: AttemptStats = { attempts: 0, reasons: {} };
      for (let s = 0; s < 60; s++) generate(fam.id, 900000 + s * 7919, stats);
      expect(stats.reasons.exception ?? 0).toBe(0);
      expect(stats.reasons.FALLBACK ?? 0).toBe(0);
    }, LONG);

    it('falls back to a known-good layout that validates, whatever seed it is reported as', () => {
      // The furnishing solve hashes the reported seed, so the fallback is checked across many.
      for (const seed of [0, 12345, 4294967295, ...Array.from({ length: 20 }, (_, i) => 7 + i * 104729)]) {
        const { plain, furnished } = generateFallback(fam.id, seed);
        expect(plain.seed).toBe(seed);
        for (const loc of [plain, furnished]) expect(validateLocation(loc, deriveLocation(loc))).toEqual([]);
        expect(validateFurnishingsG1(furnished)).toEqual([]);
        expect(furnishingShortfallsG1(furnished)).toEqual([]);
        expect(plausibilityReport(furnished).pass).toBe(true);
      }
    }, LONG);

    it('keeps floors within the family range and follows the 2-floor rules', () => {
      for (const loc of plans(fam.id)) {
        const floors = loc.floors ?? 1;
        expect(floors).toBeGreaterThanOrEqual(fam.floors[0]);
        expect(floors).toBeLessThanOrEqual(fam.floors[1]);
        expect(loc.rooms.every((r) => r.floor >= 0 && r.floor < floors)).toBe(true);
        if (floors === 2) {
          expect(loc.upperFootprint).toBeDefined();
          expect(loc.materials.floorCeiling).toBeDefined();
          const upper = new Set(loc.rooms.filter((r) => r.floor === 1).map((r) => r.id));
          expect(upper.size).toBeGreaterThan(0);
          for (const o of loc.openings) {
            if (upper.has(o.a) && o.type !== 'stair') expect(o.floor).toBe(1);
            if (upper.has(o.a) && !roomIds(loc).has(o.b)) expect(o.type).toBe('window');
          }
          for (const r of loc.rooms.filter((q) => q.floor === 1)) expect(r.tags).toContain('upstairs');
        } else expect(loc.upperFootprint).toBeUndefined();
      }
    }, LONG);

    it('aligns the stairs between floors', () => {
      for (const loc of plans(fam.id).filter((l) => l.floors === 2)) {
        expect(bbox(loc, 'stair_1')).toEqual(bbox(loc, 'stair_0'));
        const st = loc.openings.filter((o) => o.type === 'stair');
        expect(st).toHaveLength(1);
        expect([st[0].a, st[0].b, st[0].floor, st[0].state]).toEqual(['stair_0', 'stair_1', 0, 'open']);
      }
    }, LONG);

    it('reaches every room from an entry without passing through a bedroom or bathroom', () => {
      for (const loc of plans(fam.id).slice(0, SAMPLE)) {
        const rep = plausibilityReport(loc, false);
        expect(rep.notes.filter((n) => n.includes('leaf room') || n.includes('way in'))).toEqual([]);
        const adj = new Map<string, string[]>();
        for (const o of loc.openings as Opening[]) {
          if (o.type === 'window') continue;
          (adj.get(o.a) ?? adj.set(o.a, []).get(o.a)!).push(o.b);
          (adj.get(o.b) ?? adj.set(o.b, []).get(o.b)!).push(o.a);
        }
        const seen = new Set(loc.entries);
        const q = [...loc.entries];
        while (q.length) for (const n of adj.get(q.pop() as string) ?? []) if (!seen.has(n)) (seen.add(n), q.push(n));
        for (const r of roomIds(loc)) expect(seen.has(r), `${loc.id}: ${r}`).toBe(true);
      }
    }, LONG);

    it('gives every bedroom and living room a window', () => {
      for (const loc of plans(fam.id)) {
        for (const r of loc.rooms.filter((q) => q.type === 'bedroom' || q.type === 'living')) {
          expect(
            loc.openings.some((o) => o.type === 'window' && o.a === r.id),
            `${loc.id} ${r.id}`,
          ).toBe(true);
        }
      }
    }, LONG);

    it('passes the plausibility threshold and honors the conventions', () => {
      for (const loc of furnishedPlans(fam.id).slice(0, SAMPLE)) {
        const rep = plausibilityReport(loc);
        expect(rep.notes.filter((n) => n.startsWith('FAIL')), loc.id).toEqual([]);
        expect(rep.score).toBeGreaterThanOrEqual(PASS_SCORE);
        expect(loc.units).toBe('ft');
        expect(loc.entries.length).toBeGreaterThanOrEqual(1);
        expect(loc.entries.length).toBeLessThanOrEqual(3);
        expect(loc.notes.every((n) => n.decorative === true)).toBe(true);
        for (const r of loc.rooms) {
          expect(r.id).toMatch(/^[a-z][a-z0-9_]*$/);
          expect(r.tags.length, `${loc.id} ${r.id}`).toBeGreaterThan(0);
        }
        for (const o of loc.openings) {
          if (o.type === 'door') expect(o.material && o.swing).toBeTruthy();
          if (o.type === 'window') expect(o.glazing && o.covering).toBeTruthy();
        }
        for (const o of loc.objects) if (o.mechanical) expect(o.tags.length).toBeGreaterThan(0);
      }
    }, LONG);

    it('uses only the documented tag vocabulary', () => {
      const room = new Set<string>(ROOM_TAGS);
      const zone = new Set<string>(ZONE_TAGS);
      const obj = new Set<string>(OBJECT_TAGS);
      for (const loc of [...plans(fam.id), ...furnishedPlans(fam.id)]) {
        for (const r of loc.rooms) for (const t of r.tags) expect(room.has(t), `${loc.id} ${r.id} tag ${t}`).toBe(true);
        for (const z of loc.zones) for (const t of z.tags) expect(zone.has(t), `${loc.id} ${z.id} tag ${t}`).toBe(true);
        for (const o of loc.objects) for (const t of o.tags) expect(obj.has(t), `${loc.id} ${o.id} tag ${t}`).toBe(true);
      }
    }, LONG);

    it('tiles the lot: zones plus the ground footprint fill the drawing area', () => {
      for (const loc of plans(fam.id).slice(0, SAMPLE)) {
        const zones = loc.zones.reduce((a, z) => a + polyArea(z.polygon), 0);
        expect(zones + polyArea(loc.footprint), loc.id).toBeCloseTo(loc.bounds.w * loc.bounds.h, 4);
      }
    }, LONG);

    it('produces at least 90% distinct plans', () => {
      const sigs = new Set(plans(fam.id).map(planSignature));
      expect(sigs.size / SEEDS).toBeGreaterThanOrEqual(0.9);
    }, LONG);

    it('covers every footprint shape the family allows', () => {
      const seen = new Set(plans(fam.id).map(shapeOf));
      for (const shape of spec?.shapes ?? []) expect(seen.has(shape), `${fam.id} never produced ${shape}; saw ${[...seen].join(',')}`).toBe(true);
    }, LONG);
  });
}
