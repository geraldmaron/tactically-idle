import { describe, it } from 'vitest';
import { generate, type AttemptStats } from './generate';

// Developer aid, skipped unless BUILDING_STATS is set: BUILDING_STATS=<family> BUILDING_N=200 npx vitest run src/gen/building/stats.dev.test.ts
const env = import.meta.env as Record<string, string | undefined>;
const family = env.BUILDING_STATS;
describe.skipIf(!family)('generation stats', () => {
  it('prints acceptance rates', () => {
    const n = Number(env.BUILDING_N ?? 200);
    const stats: AttemptStats = { attempts: 0, reasons: {} };
    const t0 = Date.now();
    let fails = 0;
    for (let s = 0; s < n; s++) {
      try {
        generate(family as string, s, stats);
      } catch {
        fails++;
      }
    }
    console.log(`STATS ${family}: ${n} seeds, ${stats.attempts} attempts (${(stats.attempts / n).toFixed(1)}/seed), ${fails} failures, ${Date.now() - t0} ms ${JSON.stringify(stats.reasons)}`);
  });
});
