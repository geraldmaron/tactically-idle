import { describe, expect, it } from 'vitest';
import { deriveLocation } from '../../sim/location';
import { routeBetween } from '../../sim/spatial-factors';
import type { BuiltLocation, LocationDefinition, Room } from '../../sim/types';
import { PROCEDURAL_FAMILIES, PROCEDURAL_FAMILIES_G2, generateBuilding } from './index';
import { indoorOrphans, plausibilityReport } from './procedural/plausibility';

/**
 * Interior connectivity and loops of the generated building types (`_g1` and `_g2`), unfurnished, 200 seeds each.
 *
 * 1. From the front-door room (behind `d_front`) every room is reachable through interior openings
 *    alone (doors, cased openings, the stair), never through a yard. The only rooms excused are the
 *    separate units listed below, which must instead be reachable from their own street door.
 * 2. The game's squad router (`routeBetween`, unfurnished graph form) reaches every room on both floors
 *    from every entry zone.
 * 3. Plans with 6 or more rooms have an interior loop (a cycle in the room graph) in at least 40% of
 *    draws, at most 75%. The four authored families with loops have them in 9-15 of 24 seeds (37-62%,
 *    docs/procedural-locations-review.md); 40% is the floor that keeps generated plans tactically as
 *    rich as those, and 75% keeps them from being a warren of doors. Output is deterministic, so the
 *    bounds catch regressions, not noise; measured shares sit between 46% and 59%.
 */
const SEEDS = 200;
const LOOP_MIN = 0.4;
const LOOP_MAX = 0.75;

/** Separate units by family (any generation), stated here independently of procedural/units.ts so a policy change has to touch both. */
const EXEMPT: Record<string, (room: Room) => boolean> = {
  // Guest rooms open onto the walkway; each ensuite opens off its room.
  motel_row: (r) => /^unit_\d+$/.test(r.id) || (/^bath_\d+$/.test(r.id) && r.tags.includes('ensuite')),
  // The apartment upstairs and its street-door hall, stair and an optional closet.
  corner_store_flat: (r) => (r.floor ?? 0) === 1 || r.id === 'hall' || r.id === 'stair_0' || /^storage_\d+$/.test(r.id),
};

const roomGraph = (loc: LocationDefinition) => {
  const ids = new Set(loc.rooms.map((r) => r.id));
  const g = new Map<string, string[]>([...ids].map((id) => [id, []]));
  for (const o of loc.openings) {
    if (o.type === 'window' || !ids.has(o.a) || !ids.has(o.b)) continue;
    g.get(o.a)?.push(o.b);
    g.get(o.b)?.push(o.a);
  }
  return g;
};

function reach(g: Map<string, string[]>, roots: string[]): Set<string> {
  const seen = new Set(roots);
  const stack = [...roots];
  while (stack.length) for (const n of g.get(stack.pop() as string) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n));
  return seen;
}

/** Independent cycles of the room graph (edges counted once per room pair). */
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

describe('generated building connectivity (unfurnished, 200 seeds per type)', () => {
  for (const family of [...PROCEDURAL_FAMILIES, ...PROCEDURAL_FAMILIES_G2]) {
    it(`${family.id}: every room indoors from the front door, routable from every entry, loops in 40-75% of plans`, () => {
      const exempt = EXEMPT[family.id.replace(/_g\d+$/, '')] ?? (() => false);
      const problems: string[] = [];
      let big = 0;
      let looped = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const loc = generateBuilding(family.id, seed);
        const ids = new Set(loc.rooms.map((r) => r.id));
        const front = loc.openings.find((o) => o.id === 'd_front');
        const frontRoom = front && (ids.has(front.a) ? front.a : front.b);
        if (!frontRoom || !ids.has(frontRoom)) {
          problems.push(`${seed}: no front door`);
          continue;
        }
        const g = roomGraph(loc);
        const main = reach(g, [frontRoom]);
        const outsideDoor = new Set(loc.openings.filter((o) => o.type !== 'window' && o.type !== 'stair' && ids.has(o.a) !== ids.has(o.b)).map((o) => (ids.has(o.a) ? o.a : o.b)));
        const units = reach(g, loc.rooms.filter((r) => exempt(r) && outsideDoor.has(r.id)).map((r) => r.id));
        for (const r of loc.rooms) {
          if (main.has(r.id)) continue;
          if (!exempt(r)) problems.push(`${seed}: ${r.id} only reachable via outside`);
          else if (!units.has(r.id)) problems.push(`${seed}: unit room ${r.id} unreachable`);
        }
        // The plausibility rule that rejects such draws agrees with this independent check.
        const orphans = indoorOrphans(loc);
        if (orphans.length) problems.push(`${seed}: indoorOrphans ${orphans.join(',')}`);
        if (plausibilityReport(loc, false).notes.some((n) => n.includes('not reachable indoors'))) problems.push(`${seed}: plausibility indoor FAIL`);
        // The game's own squad router, unfurnished: every entry zone reaches every room.
        const derived = deriveLocation(loc);
        const built: BuiltLocation = { location: loc, derived, issues: [] };
        for (const entry of loc.entries)
          for (const r of loc.rooms)
            if (!routeBetween(built, entry, derived.spaces[entry].centroid, r.id, derived.spaces[r.id].centroid, null).reachable) problems.push(`${seed}: ${entry} cannot route to ${r.id}`);
        if (loc.rooms.length >= 6) {
          big++;
          if (cycleRank(loc) > 0) looped++;
        }
      }
      expect(problems.slice(0, 10)).toEqual([]);
      expect(big).toBeGreaterThan(SEEDS / 3);
      expect(looped / big).toBeGreaterThanOrEqual(LOOP_MIN);
      expect(looped / big).toBeLessThanOrEqual(LOOP_MAX);
    }, 120000);
  }

  it('plausibility rejects a room reachable only through a yard door', () => {
    // Find a draw whose back or side door opens into a room other than the front-door room, then cut
    // that room's interior doors: it is still reachable from its yard, which used to pass both checks.
    for (let seed = 1; seed < 60; seed++) {
      const loc = structuredClone(generateBuilding('bungalow_g1', seed));
      const ids = new Set(loc.rooms.map((r) => r.id));
      const front = loc.openings.find((o) => o.id === 'd_front');
      const side = loc.openings.find((o) => (o.id === 'd_back' || o.id === 'd_side') && o.a !== front?.a && ids.has(o.a));
      if (!side) continue;
      const room = side.a;
      loc.openings = loc.openings.filter((o) => o.type === 'window' || !(ids.has(o.a) && ids.has(o.b) && (o.a === room || o.b === room)));
      const report = plausibilityReport(loc, false);
      expect(report.pass).toBe(false);
      expect(report.notes).toContain(`FAIL ${room} is not reachable indoors from the front door`);
      return;
    }
    throw new Error('no bungalow with a back door into another room in seeds 1-59');
  });
});
