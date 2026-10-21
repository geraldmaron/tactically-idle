// Gauges that fill (a crowd filming, a subject streaming) as the live screen shows them. Pure and
// store-free, so the game's call screen and the Scenario Lab read the same views and the same words.
// The engine's view is fillViews (sim/clocks.ts); this file adds the plain-words effect line and which
// choices stop or slow a gauge. No effect is hidden: the line names every effect the engine applies.
import { effectiveRate, fillViews, openThreat, stalledRun, stallFeed, type FillView, type StallLine } from '../../sim/clocks';
import { stableFlag } from '../../sim/conditions';
import { getScenario } from '../../sim/scenario-registry';
import { stanceOf, type Stance } from '../../sim/meters';
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

/** The call's gauges that fill, as they stand now: moved on by the open decision's stall (`dither`,
 * ui/timer.ts liveDither), their cues heard as they pass. Empty with no live call or none. */
export function liveFillViews(g: GameState, dither = 0): FillView[] {
  const run = g.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  return run && scenario && run.status === 'active' ? fillViews(scenario, stalledRun(scenario, run, dither)) : [];
}

/** What was said and heard on scene during the open decision's stall (sim/clocks.ts stallFeed), for
 * the comms log. Empty with no live call. */
export function liveStallFeed(g: GameState, dither = 0): StallLine[] {
  const run = g.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  return run && scenario && run.status === 'active' && run.stage !== 'debrief' ? stallFeed(scenario, run, dither) : [];
}

/** The one pressure the strip shows: the threat or a gauge that fills, whichever bites soonest in
 * game minutes. A threat bites when its minutes run out; a gauge at its next unheard cue, or when
 * full once every cue is heard. A stopped or full gauge has nothing coming, so it shows only when
 * nothing else does. Ties go to the threat, the stage's own clock. */
export type LeadingPressure =
  | { kind: 'threat'; label: string; minutes: number; left: number }
  | { kind: 'fill'; view: FillView; left: number };

export function fillMinutesToBite(view: FillView): number {
  if (view.stopped || view.full || view.ratePerMin <= 0) return Infinity;
  const next = view.cues.find((cue) => !cue.heard)?.at ?? 100;
  return Math.max(0, next - view.value) / view.ratePerMin;
}

export function leadingPressure(threat: { label: string; minutes: number } | null, dither: number, fills: readonly FillView[]): LeadingPressure | null {
  const candidates: LeadingPressure[] = [
    ...(threat ? [{ kind: 'threat' as const, label: threat.label, minutes: threat.minutes, left: Math.max(0, threat.minutes - Math.max(0, dither)) }] : []),
    ...fills.map((view) => ({ kind: 'fill' as const, view, left: fillMinutesToBite(view) })),
  ];
  if (!candidates.length) return null;
  const soonest = candidates.reduce((best, next) => next.left < best.left ? next : best);
  if (Number.isFinite(soonest.left) || soonest.kind === 'threat') return soonest;
  // Nothing is coming: show the fullest gauge, so what the call carries stays in view.
  return candidates.reduce((best, next) => next.kind === 'fill' && best.kind === 'fill' && next.view.value > best.view.value ? next : best);
}

/** How loud the pressure reads: calm, then warn under half its window, then critical in the last
 * quarter or the last minute. A gauge reads by how full it is. */
export function pressureUrgency(pressure: LeadingPressure): 'calm' | 'warn' | 'critical' {
  if (pressure.kind === 'threat') {
    const share = pressure.minutes > 0 ? pressure.left / pressure.minutes : 0;
    return share <= 0.25 || pressure.left <= 1 ? 'critical' : share <= 0.5 ? 'warn' : 'calm';
  }
  if (pressure.view.stopped) return 'calm';
  return pressure.view.value >= 75 || pressure.left <= 1 ? 'critical' : pressure.view.value >= 40 ? 'warn' : 'calm';
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

/** The line the player reads when the open decision's threat lands (its first effect with text), so
 * the strip can show what happened the moment the stall reaches zero. Null with no threat. */
export function threatLandingText(g: GameState): string | null {
  const run = g.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  if (!run || !scenario || run.status !== 'active') return null;
  return openThreat(scenario, run)?.effects.find((effect) => effect.when === undefined && effect.text)?.text ?? null;
}

/** A subject the landed threat moved: who, how they sound now, and their agitation before and after
 * (0 to 100). The strip shows it the moment the stall reaches zero, so the cost lands on a named
 * person and not only in the odds. */
export interface LandingSubject { id: Id; label: string; stance: Exclude<Stance, 'unheard'>; before: number; after: number }

/** Subjects whose agitation the landed threat raised, as the projection has them (sim/clocks.ts
 * stalledRun). Empty until the stall reaches the threat, and for a call with no subjects. */
export function landingSubjects(g: GameState, dither: number): LandingSubject[] {
  const run = g.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  if (!run || !scenario || run.status !== 'active' || !run.meters) return [];
  const threat = openThreat(scenario, run);
  if (!threat || !(dither >= threat.minutes)) return [];
  const projected = stalledRun(scenario, run, dither).meters ?? {};
  return Object.entries(projected).flatMap(([id, meters]) => {
    const person = scenario.incidentPeople?.find((entry) => entry.id === id);
    const before = run.meters?.[id]?.agitation ?? meters.agitation;
    const stance = stanceOf(meters);
    return person && stance !== 'unheard' && !run.flags.includes(`out:${id}`) && meters.agitation > before
      ? [{ id, label: person.label, stance, before, after: meters.agitation }] : [];
  });
}
