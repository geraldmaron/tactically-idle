import { describe, it } from 'vitest';
import { generatePair, type AttemptStats } from './generate';
import { BUILDING_FAMILIES } from './index';
import { planSignature, plausibilityReport } from './plausibility';
import { shapeOf } from './suite';

// Developer aid, skipped unless BUILDING_SUMMARY is set (a family id or 'all'):
//   BUILDING_SUMMARY=all BUILDING_N=500 npx vitest run src/gen/building/summary.dev.test.ts --reporter=verbose
const env = import.meta.env as Record<string, string | undefined>;
const which = env.BUILDING_SUMMARY;
describe.skipIf(!which)('generation summary', () => {
  it('prints distinctness, floors, shapes, scores and attempts', () => {
    for (const f of BUILDING_FAMILIES) {
      if (which !== 'all' && which !== f.id) continue;
      const n = Number(env.BUILDING_N ?? 500);
      const floors: Record<string, number> = {};
      const shapes: Record<string, number> = {};
      const sigs = new Set<string>();
      const topo = new Set<string>();
      const stats: AttemptStats = { attempts: 0, reasons: {} };
      let score = 0;
      let low = 100;
      const t0 = performance.now();
      for (let s = 0; s < n; s++) {
        const { plain: loc, furnished } = generatePair(f.id, s, stats);
        floors[loc.floors ?? 1] = (floors[loc.floors ?? 1] ?? 0) + 1;
        const sh = shapeOf(loc);
        shapes[sh] = (shapes[sh] ?? 0) + 1;
        sigs.add(planSignature(loc));
        // Topology only: room stems and which stems touch, no dimensions.
        topo.add(planSignature(loc).split('|').slice(0, 2).join('|') + `|${sh}|${loc.floors ?? 1}`);
        const rep = plausibilityReport(furnished);
        score += rep.score;
        low = Math.min(low, rep.score);
      }
      const ms = performance.now() - t0;
      console.log(
        `SUMMARY ${f.id}: distinct ${((sigs.size / n) * 100).toFixed(1)}% (topology ${((topo.size / n) * 100).toFixed(1)}%), floors ${JSON.stringify(floors)}, shapes ${JSON.stringify(shapes)}, mean score ${(score / n).toFixed(1)} (min ${low.toFixed(0)}), attempts/seed ${(stats.attempts / n).toFixed(1)}, fallbacks ${stats.reasons.FALLBACK ?? 0}, exceptions ${stats.reasons.exception ?? 0}, ${(ms / n).toFixed(1)} ms/seed`,
      );
    }
  });
});
