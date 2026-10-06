import { describe, expect, it } from 'vitest';
import type { LocationDefinition } from '../../sim/types';
import { deriveLocation } from '../../sim/location';
import { validateLocation } from '../../sim/location-validate';
import { routeBetween } from '../../sim/spatial-factors';
import { validateFurnishingsG1 } from './furnishing-g1';
import { PROCEDURAL_FAMILIES, PROCEDURAL_FAMILIES_G2 } from './index';
import { generatePair } from './procedural/generate';

// Developer aid, skipped unless BUILDING_QUALITY is set (number of seeds per type, e.g. 200):
//   BUILDING_QUALITY=200 npx vitest run src/gen/building/procedural-quality.dev.test.ts --silent=false
// Per `_g1` and `_g2` type: validity of plan and furnished plan, distinct room topologies, share of
// 6+ room plans with an interior loop, cold generation time per building (search, furnishLocationG1
// and validation included), and squad reachability on the furnished form: from some staging point
// of every entry zone to some staging point of every room, routed as squads move (as in
// v10-locations.test.ts). Add BUILDING_QUALITY_REACH=0 to skip the routing (it dominates run time).
const env = import.meta.env as Record<string, string | undefined>;
const n = Number(env.BUILDING_QUALITY ?? 0);
const checkReach = env.BUILDING_QUALITY_REACH !== '0';

/** Independent cycles of the room graph (edges counted once per room pair), as procedural-connectivity.test.ts. */
function cycleRank(loc: LocationDefinition): number {
  const ids = loc.rooms.map((r) => r.id);
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x) as string));
  const pairs = new Set(loc.openings.filter((o) => o.type !== 'window' && parent.has(o.a) && parent.has(o.b)).map((o) => [o.a, o.b].sort().join('|')));
  for (const p of pairs) {
    const [a, b] = p.split('|');
    parent.set(find(a), find(b));
  }
  return pairs.size - ids.length + new Set(ids.map(find)).size;
}

/** Entry-to-room pairs a squad cannot route on the furnished form, staging point to staging point. */
function squadMisses(location: LocationDefinition): number {
  const derived = deriveLocation(location), built = { location, derived, issues: [] };
  const staging = (space: string) => derived.stagingPoints.filter((p) => p.spaceId === space);
  let misses = 0;
  for (const entry of location.entries) for (const room of location.rooms) {
    const stands = staging(room.id);
    if (!staging(entry).some((start) => stands.some((stand) => routeBetween(built, entry, start.at, room.id, stand.at, null).reachable))) misses++;
  }
  return misses;
}

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
    for (const family of [...PROCEDURAL_FAMILIES, ...PROCEDURAL_FAMILIES_G2]) {
      const times: number[] = [];
      const topologies = new Set<string>();
      let bad = 0, big = 0, looped = 0, misses = 0, missed = 0;
      for (let seed = 0; seed < n; seed++) {
        const t0 = performance.now();
        const { plain, furnished } = generatePair(family.id, seed);
        times.push(performance.now() - t0);
        const errors = [plain, furnished].flatMap((loc) => validateLocation(loc, deriveLocation(loc)).filter((i) => i.severity === 'error'));
        if (errors.length || validateFurnishingsG1(furnished).length) bad++;
        topologies.add(topology(plain));
        if (plain.rooms.length >= 6) {
          big++;
          if (cycleRank(plain) > 0) looped++;
        }
        if (checkReach) {
          const m = squadMisses(furnished);
          misses += m;
          if (m) missed++;
        }
      }
      invalid += bad;
      times.sort((a, b) => a - b);
      const avg = times.reduce((a, b) => a + b, 0) / n;
      const p95 = times[Math.min(n - 1, Math.ceil(n * 0.95) - 1)];
      const reach = checkReach ? `  squad-unreachable ${missed} buildings (${misses} entry-room pairs)` : '';
      lines.push(`${family.id.padEnd(22)} valid ${n - bad}/${n}  topologies ${String(topologies.size).padStart(3)}/${n}  loops ${looped}/${big} (${Math.round((100 * looped) / Math.max(1, big))}%)  avg ${avg.toFixed(1)} ms  p95 ${p95.toFixed(1)} ms${reach}`);
    }
    console.log(`QUALITY\n${lines.join('\n')}`);
    expect(invalid).toBe(0);
  }, 3_600_000);
});
