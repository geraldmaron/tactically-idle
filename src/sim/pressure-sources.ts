// Pressure sources (docs/call-pressure.md, "Pressure sources"): what turns a gauge that fills into
// something the player feels. The gauge stays 0..100 in the sim (sim/clocks.ts); this reads it as the
// count someone on scene would see and as the pull it has on a check, so the cards, the strip and
// the odds all say the same number.
import type { CheckKind, ClockDef, ScenarioDefinition } from './scenario-types';
import type { Id, OperationRun } from './types';

/** A pressure source's gauge as the count someone on scene would see (PressureSource.count): on a
 * curve from `from` to `to`, so an audience climbs slowly and then all at once. Null without one. */
export function sourceCount(def: Pick<ClockDef, 'source'>, value: number): number | null {
  const count = def.source?.count;
  if (!count) return null;
  const t = Math.max(0, Math.min(1, value / 100));
  return count.from > 0 && count.to > 0 ? count.from * Math.pow(count.to / count.from, t) : count.from + (count.to - count.from) * t;
}

/** A count as the screen and the cards write it: whole, with thousands separated. */
export const formatCount = (n: number) => Math.round(n).toLocaleString('en-US');

/** What the pressure sources take off a check of this kind now (PressureSource.odds): each source
 * whose first cue is heard, in proportion to its gauge, named with its count so the card says why. */
export function sourceOdds(scenario: Pick<ScenarioDefinition, 'clocks'>, run: Pick<OperationRun, 'clocks'>, kind: CheckKind): { clockId: Id; label: string; value: number }[] {
  return (scenario.clocks ?? []).flatMap(def => {
    const odds = def.source?.odds;
    const state = run.clocks?.[def.id];
    if (!odds || !odds.kinds.includes(kind) || !state || state.cued === 0) return [];
    const value = -Math.round(odds.atFull * state.value / 100 * 10) / 10;
    if (value > -0.05) return [];
    const count = sourceCount(def, state.value);
    const label = count === null ? `${def.label} at ${Math.round(state.value)}` : `${def.label}: ${formatCount(count)} ${def.source!.count!.unit}`;
    return [{ clockId: def.id, label, value }];
  });
}
