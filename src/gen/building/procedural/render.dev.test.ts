import { describe, expect, it } from 'vitest';
import { generateBuilding } from './index';
import { contactSheet } from './render-svg';

// Developer aid, skipped unless BUILDING_SVG is set:
//   BUILDING_SVG=<dir> BUILDING_FAMILY=<id> BUILDING_SEEDS=0-5 (or BUILDING_SEEDLIST=3,9,12) BUILDING_COLS=3 npx vitest run -u src/gen/building/render.dev.test.ts
// then: rsvg-convert -o sheet.png <dir>/<family>.svg
const env = import.meta.env as Record<string, string | undefined>;
const dir = env.BUILDING_SVG;
describe.skipIf(!dir)('render plans', () => {
  it('writes an svg contact sheet', async () => {
    const family = env.BUILDING_FAMILY ?? 'bungalow';
    const [a, b] = (env.BUILDING_SEEDS ?? '0-5').split('-').map(Number);
    const list = env.BUILDING_SEEDLIST ? env.BUILDING_SEEDLIST.split(',').map(Number) : null;
    const cols = Number(env.BUILDING_COLS ?? 3);
    const locs = [];
    for (const s of list ?? Array.from({ length: b - a + 1 }, (_, i) => a + i)) locs.push(generateBuilding(family, s));
    await expect(contactSheet(locs, cols, Number(env.BUILDING_SCALE ?? 6))).toMatchFileSnapshot(`${dir}/${family}.svg`);
  });
});
