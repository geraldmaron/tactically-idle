import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveLocation } from '../../sim/location';
import { validateLocation } from '../../sim/location-validate';
import { distanceFor, exactHypot, hypotFor } from '../../sim/geometry';
import { PROCEDURAL_FAMILIES, PROCEDURAL_FAMILIES_G2 } from './index';
import { validateFurnishingsG1 } from './furnishing-g1';
import { generatePair, unreachableFromEntries } from './procedural/generate';

// `_g2` locations carry `geometry: 'exact'`, and the shared helpers (location.ts, furniture-path.ts,
// location-validate.ts, spatial-factors.ts routing, the furnishing solvers) then measure with
// multiply, add and Math.sqrt only. ECMA-262 §21.3.2 lets engines approximate the functions below
// and `**`, so no exact-geometry path may reach them. Locations without the field keep Math.hypot.
const APPROXIMATED = ['acos', 'acosh', 'asin', 'asinh', 'atan', 'atanh', 'atan2', 'cbrt', 'cos', 'cosh', 'exp', 'expm1', 'hypot', 'log', 'log1p', 'log2', 'log10', 'pow', 'sin', 'sinh', 'tan', 'tanh'] as const;

/** Count calls to every approximated Math function while `run` executes (calls pass through). */
function approximatedCalls(run: () => void): Record<string, number> {
  const counts: Record<string, number> = {};
  const spies = APPROXIMATED.map((name) => {
    const original = Math[name] as (...args: number[]) => number;
    return vi.spyOn(Math, name).mockImplementation((...args: number[]) => {
      counts[name] = (counts[name] ?? 0) + 1;
      return original(...args);
    });
  });
  try {
    run();
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  return counts;
}

/** Generate (uncached), derive, validate, check furnishing and route squads from every entry. */
function exercise(familyId: string, seed: number): void {
  const { plain, furnished } = generatePair(familyId, seed);
  for (const loc of [plain, furnished]) validateLocation(loc, deriveLocation(loc));
  validateFurnishingsG1(furnished);
  unreachableFromEntries(furnished);
}

const SOURCES = import.meta.glob(['../../sim/geometry.ts', '../../sim/location.ts', '../../sim/furniture-path.ts', '../../sim/location-validate.ts', '../../sim/spatial-factors.ts', './furnishing-v7.ts', './furnishing-g1.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

describe('exact geometry for _g2 locations', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(PROCEDURAL_FAMILIES_G2.map((f) => f.id))('%s generates, validates, furnishes and routes without an approximated Math call', (id) => {
    expect(approximatedCalls(() => exercise(id, 3))).toEqual({});
  }, 60_000);

  it('still measures locations without the field with Math.hypot (the spy sees g1 calls)', () => {
    expect(approximatedCalls(() => exercise(PROCEDURAL_FAMILIES[0].id, 3)).hypot).toBeGreaterThan(0);
  }, 60_000);

  it('dispatches by geometry version', () => {
    const a = { x: 0.25, y: 3.5 }, b = { x: 7.75, y: 0.5 };
    expect(hypotFor(undefined)(3.25, 9.5)).toBe(Math.hypot(3.25, 9.5));
    expect(distanceFor(undefined)(a, b)).toBe(Math.hypot(a.x - b.x, a.y - b.y));
    expect(hypotFor('exact')(3.25, 9.5)).toBe(Math.sqrt(3.25 * 3.25 + 9.5 * 9.5));
    expect(distanceFor('exact')(a, b)).toBe(Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2));
  });

  it('builds the exact functions from multiply, add and Math.sqrt only', () => {
    for (const fn of [exactHypot, hypotFor('exact'), distanceFor('exact')]) {
      const src = fn.toString();
      expect(src).not.toMatch(/Math\.(?!sqrt\b)[a-z0-9]+|\*\*/);
    }
  });

  it('keeps `**` out of the shared geometry sources (comments aside)', () => {
    expect(Object.keys(SOURCES)).toHaveLength(7);
    for (const [file, src] of Object.entries(SOURCES)) expect(stripComments(src).split('\n').filter((line) => line.includes('**')), file).toEqual([]);
  });
});
