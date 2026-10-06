import { describe, expect, it } from 'vitest';
import { deriveLocation } from '../../sim/location';
import { routeBetween } from '../../sim/spatial-factors';
import type { BuiltLocation } from '../../sim/types';
import { PROCEDURAL_FAMILIES, PROCEDURAL_FAMILIES_G2, generateBuilding } from './index';

/**
 * The furnished form is what the game plays, and its squad router walks with 1 ft clearance through
 * rooms and exterior zones alike (spatial-factors.ts furnishedRouteBetween): zone edges are walls
 * except at zone-to-zone links, and fences, shrubs and trees are obstacles. For every generated type,
 * 50 seeds: every entry zone has a staging point, and from some staging point of every entry zone
 * some staging point of every room is reachable. This is the integration gate for generated
 * locations; a thin side yard, a shrub in a 5 ft apron or a tree beside a gate fails it.
 */
const SEEDS = 50;

describe('generated buildings are walkable for the furnished squad router (50 seeds per type)', () => {
  for (const family of [...PROCEDURAL_FAMILIES, ...PROCEDURAL_FAMILIES_G2]) {
    it(`${family.id}__furnished_v7: every entry zone reaches every room`, () => {
      const problems: string[] = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const location = generateBuilding(`${family.id}__furnished_v7`, seed);
        const derived = deriveLocation(location);
        const built: BuiltLocation = { location, derived, issues: [] };
        const staging = (space: string) => derived.stagingPoints.filter((p) => p.spaceId === space);
        for (const entry of location.entries) {
          const starts = staging(entry);
          if (starts.length === 0) {
            problems.push(`${seed}: entry ${entry} has no staging point`);
            continue;
          }
          for (const room of location.rooms) {
            const stands = staging(room.id);
            if (!starts.some((start) => stands.some((stand) => routeBetween(built, entry, start.at, room.id, stand.at, null).reachable))) problems.push(`${seed}: ${entry} cannot reach ${room.id}`);
          }
        }
      }
      expect(problems.slice(0, 10)).toEqual([]);
    }, 180000);
  }
});
