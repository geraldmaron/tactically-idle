import { describe, expect, it } from 'vitest';
import type { LocationDefinition } from '../../sim/types';
import { deriveLocation } from '../../sim/location';
import { validateLocation } from '../../sim/location-validate';
import { validateFurnishingsG1 } from './furnishing-g1';
import { PROCEDURAL_FAMILIES } from './index';
import { generatePair } from './procedural/generate';

// Developer aid, skipped unless BUILDING_QUALITY is set (number of seeds per type, e.g. 200):
//   BUILDING_QUALITY=200 npx vitest run src/gen/building/procedural-quality.dev.test.ts --silent=false
// Per `_g1` type: validity of plan and furnished plan, distinct room topologies, and cold
// generation time per building (search, furnishLocationG1 and validation included).
const env = import.meta.env as Record<string, string | undefined>;
const n = Number(env.BUILDING_QUALITY ?? 0);

/** Room kinds (id stems, by floor) and the door graph between them, outside included; no dimensions. */
function topology(loc: LocationDefinition): string {
  const stem = new Map(loc.rooms.map((r) => [r.id, `${r.id.replace(/_\d+$/, '')}@${r.floor}`]));
  const end = (id: string) => stem.get(id) ?? 'outside';
  const edges = loc.openings.filter((o) => o.type !== 'window' && (stem.has(o.a) || stem.has(o.b))).map((o) => [end(o.a), end(o.b)].sort().join('-'));
  return `${[...stem.values()].sort().join(',')}|${edges.sort().join(',')}`;
}

describe.skipIf(!n)('procedural building quality', () => {
  it(`reports validity, topology and time over ${n} seeds per type`, () => {
    const lines: string[] = [];
    let invalid = 0;
    for (const family of PROCEDURAL_FAMILIES) {
      const times: number[] = [];
      const topologies = new Set<string>();
      for (let seed = 0; seed < n; seed++) {
        const t0 = performance.now();
        const { plain, furnished } = generatePair(family.id, seed);
        times.push(performance.now() - t0);
        const errors = [plain, furnished].flatMap((loc) => validateLocation(loc, deriveLocation(loc)).filter((i) => i.severity === 'error'));
        if (errors.length || validateFurnishingsG1(furnished).length) invalid++;
        topologies.add(topology(plain));
      }
      times.sort((a, b) => a - b);
      const avg = times.reduce((a, b) => a + b, 0) / n;
      const p95 = times[Math.min(n - 1, Math.ceil(n * 0.95) - 1)];
      lines.push(`${family.id.padEnd(22)} topologies ${String(topologies.size).padStart(3)}/${n}  avg ${avg.toFixed(1)} ms  p95 ${p95.toFixed(1)} ms`);
    }
    console.log(`QUALITY\n${lines.join('\n')}`);
    expect(invalid).toBe(0);
  }, 900_000);
});
