// Gauges that fill (a crowd filming, a subject streaming) as the live screen shows them. Pure and
// store-free, so the game's call screen and the Scenario Lab read the same views and the same words.
// The engine's view is fillViews (sim/clocks.ts); this file adds the plain-words effect line and which
// choices stop or slow a gauge. No effect is hidden: the line names every effect the engine applies.
import { effectiveRate, fillViews, type FillView } from '../../sim/clocks';
import { stableFlag } from '../../sim/conditions';
import { getScenario } from '../../sim/scenario-registry';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import type { GameState, Id, OutcomeBand } from '../../sim/types';

export type FillEffect = NonNullable<FillView['effect']>;

/** What a gauge does once its first cue is heard, in plain words: the strain every officer takes at
 * a commit, how much more the call's trust result counts, and the pressure it adds each minute. */
export function fillEffectLine(effect: FillEffect): string {
  const parts = [`Officers strained +${effect.strainPercent}%`, `trust swings ${effect.trustPercent}% bigger`];
  if (effect.pressurePerMinute > 0) parts.push(`pressure +${effect.pressurePerMinute} a minute`);
  return parts.join(' · ');
}

/** The call's gauges that fill, as they stand now. Empty with no live call or none. */
export function liveFillViews(g: GameState): FillView[] {
  const run = g.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  return run && scenario && run.status === 'active' ? fillViews(scenario, run) : [];
}

export interface GaugeReach { label: string; effect: 'stops' | 'slows'; bands: OutcomeBand[] }

const BANDS: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

/** Which gauges a choice stops or slows, and in which results: a result that sets the gauge's
 * stable flag stops it, one that sets a flag from its rateFlags slows it below its current rate. */
export function gaugeReach(scenario: ScenarioDefinition, flags: readonly string[], actionId: Id): GaugeReach[] {
  const action = Object.values(scenario.stages).flatMap((stage) => stage.actions).find((candidate) => candidate.id === actionId);
  if (!action) return [];
  return (scenario.clocks ?? []).flatMap((def): GaugeReach[] => {
    if (def.direction !== 'fill') return [];
    const now = effectiveRate(def, flags);
    const reach = (kind: GaugeReach['effect']) => BANDS.filter((band) => (action.outcomes?.[band] ?? []).some((effect) => (effect.setFlags ?? []).some((flag) =>
      kind === 'stops' ? flag === stableFlag(def.id) : (def.rateFlags ?? []).some((entry) => entry.flag === flag && entry.ratePerMin < now))));
    const stops = reach('stops'), slows = reach('slows').filter((band) => !stops.includes(band));
    return [...(stops.length ? [{ label: def.label, effect: 'stops' as const, bands: stops }] : []), ...(slows.length ? [{ label: def.label, effect: 'slows' as const, bands: slows }] : [])];
  });
}

/** The line a choice's card carries for one gauge: "Stops X" when every result does, else "Can stop X". */
export function gaugeReachTag(reach: GaugeReach): string {
  const all = reach.bands.length === BANDS.length;
  return `${all ? (reach.effect === 'stops' ? 'Stops' : 'Slows') : (reach.effect === 'stops' ? 'Can stop' : 'Can slow')}: ${reach.label}`;
}

/** Every choice's reach for the live call, by action id; only choices that touch a gauge appear. */
export function reachByAction(g: GameState, actionIds: readonly Id[]): Record<Id, GaugeReach[]> {
  const run = g.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  if (!run || !scenario || !scenario.clocks?.some((def) => def.direction === 'fill')) return {};
  const out: Record<Id, GaugeReach[]> = {};
  for (const id of actionIds) { const reach = gaugeReach(scenario, run.flags, id); if (reach.length) out[id] = reach; }
  return out;
}
