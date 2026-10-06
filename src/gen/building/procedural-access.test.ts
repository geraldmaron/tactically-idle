import { describe, expect, it } from 'vitest';
import { PROCEDURAL_FAMILIES, PROCEDURAL_FAMILIES_G2, furnishedFamilyIdV7, generateBuilding } from './index';

// `apartment_unit_g2` says how the unit is reached: its floor (from the name, 'Unit 3B' is on the
// third floor), whether the building has an elevator, and whether the route to the street is
// step-free. Players see it as a map note on the common corridor and on the stairwell's label.
const SEEDS = 200;
const FLOOR = ['Ground', 'Second', 'Third', 'Fourth'];

describe('apartment access (_g2)', () => {
  it(`draws floor, elevator and step-free route consistently over ${SEEDS} seeds`, () => {
    const levels = [0, 0, 0, 0], lifts = [0, 0, 0, 0];
    const bad: string[] = [];
    for (let seed = 0; seed < SEEDS; seed++) {
      const loc = generateBuilding('apartment_unit_g2', seed);
      const access = loc.access;
      if (!access) {
        bad.push(`${seed}: no access`);
        continue;
      }
      levels[access.unitLevel]++;
      if (access.lift) lifts[access.unitLevel]++;
      const where = `${seed} (${loc.name})`;
      if (Number(/\bUnit (\d)/.exec(loc.name)?.[1]) - 1 !== access.unitLevel) bad.push(`${where}: floor ${access.unitLevel} disagrees with the name`);
      if (access.stepFree !== (access.unitLevel === 0 || access.lift)) bad.push(`${where}: step-free ${access.stepFree}`);
      if (!access.note.startsWith(`${FLOOR[access.unitLevel]}-floor unit; `)) bad.push(`${where}: note ${access.note}`);
      if (access.unitLevel > 0 && access.note.includes('elevator') !== true) bad.push(`${where}: upper-floor note does not mention the elevator`);
      if (loc.notes.find((n) => n.id === 'n_access')?.text !== access.note) bad.push(`${where}: no access note on the map`);
      const stair = loc.zones.find((z) => z.tags.includes('stairwell'));
      if (stair && stair.tags.includes('lift') !== access.lift) bad.push(`${where}: stairwell lift tag ${stair.tags.includes('lift')}`);
      if (stair && (stair.label === 'Stairs and elevator') !== access.lift) bad.push(`${where}: stairwell label ${stair.label}`);
      const furnished = generateBuilding(furnishedFamilyIdV7('apartment_unit_g2'), seed);
      if (JSON.stringify(furnished.access) !== JSON.stringify(access)) bad.push(`${where}: furnished access differs`);
    }
    const share = (n: number, of: number) => `${n}/${of}`;
    console.log(`ACCESS apartment_unit_g2, ${SEEDS} seeds\n${levels.map((n, i) => `${FLOOR[i].padEnd(7)} floor ${String(n).padStart(3)}  elevator ${share(lifts[i], n)}  step-free ${share(i === 0 ? n : lifts[i], n)}`).join('\n')}`);
    expect(bad.slice(0, 10)).toEqual([]);
    for (const n of levels) expect(n).toBeGreaterThan(SEEDS / 8);
    const upper = levels.slice(1).reduce((a, b) => a + b, 0), upperLifts = lifts.slice(1).reduce((a, b) => a + b, 0);
    expect(upperLifts / upper).toBeGreaterThan(0.3);
    expect(upperLifts / upper).toBeLessThan(0.8);
  }, 120_000);

  it('is only on the g2 apartment; g1 buildings carry neither access nor a geometry version', () => {
    for (const family of PROCEDURAL_FAMILIES_G2) expect(Boolean(generateBuilding(family.id, 5).access), family.id).toBe(family.id === 'apartment_unit_g2');
    for (const family of PROCEDURAL_FAMILIES) {
      const loc = generateBuilding(furnishedFamilyIdV7(family.id), 5);
      expect('access' in loc || 'geometry' in loc, family.id).toBe(false);
    }
  });
});
