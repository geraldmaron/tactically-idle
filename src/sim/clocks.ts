// Clocks for v13 incidents (docs/incident-domain-model.md §3, M2 slice 3). Some things in a call run
// down on their own: a door being kicked, an oxygen tank with the power out, a person's condition.
// The situation sets how fast; the operation's minutes run them; cues tell the team as each
// threshold passes. A clock running out is read where the story reads it: the door gives the next
// time the subject goes at it, the owner collapses the next time the night is long.
//
// Fairness: a clock never runs out before the team has heard one of its cues in an earlier decision.
// If a single long choice would carry it from silent to empty, it stops just short, the cue fires,
// and the next decision is the one where it can run out. No outcome comes without a warning (§13).
//
// Running out where no fork reads it (M2 slice 5): a clock with `onOut` that runs out during a
// decision, with its owner still inside once that decision's own outcome has applied, records harm
// to the owner (unless the outcome already hurt them) and sets a mark the tree's prompts read. The
// record and the text then agree: the debrief and the score see the harm like any authored harm.
import type { ActionDefinition, ClockCondition, ClockDef, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { Id, OperationRun, OutcomeBand } from './types';
import { RESOLUTION_TUNING } from './resolution';
import { tunable } from './tuning';
import { conditionHolds, stableFlag } from './conditions';
import { currentStoryExchange, currentStoryPrompt, currentStoryThreat } from './story-context';
import type { TimerSetting } from './timer-setting';

/** Tunable (sim/tuning.ts). A choice's minutes per band are RESOLUTION_TUNING.bandTime, the one table
 * the commit, the preview and the clock lookahead (forkMinutes) all read. */
export const CLOCK_RULES_V1 = tunable('CLOCK_RULES_V1', {
  /** Where a clock stops in a decision that would run it out before any cue was heard. */
  floor: 1,
  /** Gauges that fill (a crowd filming, a subject streaming; ClockDef.direction 'fill'). A fill bites
   * only once its first cue has been heard. `strain`: extra strain per officer at a commit, as a
   * share of the strain, per full gauge (0.4: a gauge at 50 adds 20%). `audienceGain`: how much more
   * the call's trust result counts, either way, per full peak gauge (0.5: a peak of 80 counts 40%
   * more). `pressurePerMinute`: points of call pressure a full gauge adds each minute. */
  fill: { strain: 0.4, audienceGain: 0.5, pressurePerMinute: 0.5 },
  /** Dither minutes (docs/call-pressure.md), per timer setting; Off never adds any. Real time on an
   * open decision starts counting after a reading floor: `floorSeconds`, plus a second for every
   * `readingCharsPerSecond` characters of the stage's text (0: the floor doesn't scale). After it,
   * each real minute is `gameMinutesPerRealMinute` game minutes. Relaxed reads at about 180 words a
   * minute before counting, then two game minutes a minute; Standard starts soon and runs at three.
   * Measured 2026-10-20 (dither-balance.test.ts): a Relaxed player who takes a minute a decision
   * loses nothing, one who takes two loses under two game minutes a decision and no ending changed;
   * at Standard a minute a decision costs two to three game minutes. */
  dither: {
    relaxed: { floorSeconds: 10, readingCharsPerSecond: 15, gameMinutesPerRealMinute: 2 },
    standard: { floorSeconds: 8, readingCharsPerSecond: 0, gameMinutesPerRealMinute: 3 },
  } as Record<Exclude<TimerSetting, 'off'>, { floorSeconds: number; readingCharsPerSecond: number; gameMinutesPerRealMinute: number }>,
}, { guard: (next) => next.fill.strain < 0 || next.fill.audienceGain < 0 || next.fill.pressurePerMinute < 0 ? 'fill strain, audience gain and pressure must be 0 or more'
  : Object.entries(next.dither).some(([, rule]) => !(rule.floorSeconds >= 0 && rule.readingCharsPerSecond >= 0 && rule.gameMinutesPerRealMinute >= 0))
  ? 'dither floors, reading speeds and rates must be 0 or more' : null });

export type ClockState = NonNullable<OperationRun['clocks']>[Id];
const round1 = (n: number) => Math.round(n * 10) / 10;

export function initialClocks(scenario: ScenarioDefinition): OperationRun['clocks'] {
  if (!scenario.clocks?.length) return undefined;
  return Object.fromEntries(scenario.clocks.map(def => [def.id, { value: def.start, cued: def.cues.filter(cue => filling(def) ? def.start >= cue.at : def.start <= cue.at).length }]));
}

/** A gauge that fills rather than runs down. */
export const filling = (def: Pick<ClockDef, 'direction'>) => def.direction === 'fill';

/** How fast a clock moves now: its rate, or the slowest rate a set flag gives it (a choice that
 * slows it). Without `rateFlags` it is `ratePerMin`, so a clock that has none runs as it always did. */
export function effectiveRate(def: ClockDef, flags: readonly string[]): number {
  const slowed = (def.rateFlags ?? []).filter(entry => flags.includes(entry.flag)).map(entry => entry.ratePerMin);
  return slowed.length ? Math.min(def.ratePerMin, ...slowed) : def.ratePerMin;
}

/** A clock stops once the person it belongs to is out of the building, or once someone holds it steady. */
const stopped = (def: ClockDef, flags: readonly string[]) => flags.includes(stableFlag(def.id))
  || (!!def.owner && (flags.includes(`safe:${def.owner}`) || flags.includes(`out:${def.owner}`)));

/** Where a clock will be after `minutes` more, and how many of its cues will have fired. */
export function stepClock(def: ClockDef, state: ClockState, minutes: number, flags: readonly string[]): ClockState {
  if (stopped(def, flags) || minutes <= 0) return { ...state };
  if (filling(def)) {
    // The mirror of a clock running out: a fill never fills before a cue is heard.
    let up = round1(Math.min(100, state.value + effectiveRate(def, flags) * minutes));
    if (up >= 100 && state.cued === 0) up = 100 - CLOCK_RULES_V1.floor;
    return { value: up, cued: Math.max(state.cued, def.cues.filter(cue => up >= cue.at).length) };
  }
  let value = round1(Math.max(0, state.value - effectiveRate(def, flags) * minutes));
  if (value <= 0 && state.cued === 0) value = CLOCK_RULES_V1.floor;
  return { value, cued: Math.max(state.cued, def.cues.filter(cue => value <= cue.at).length) };
}

export interface ClockRead { value: number; low: boolean; out: boolean }
function readClock(def: ClockDef | undefined, state: ClockState | undefined): ClockRead {
  if (!def || !state) return { value: 100, low: false, out: false };
  return { value: state.value, low: state.cued > 0, out: filling(def) ? state.value >= 100 : state.value <= 0 };
}

/** The team's minutes for a decision at its band before any outcome adds to them: travel through
 * the building, forcing doors and the work itself (the evaluation's timeBase). A walk by a person
 * the outcome moves along their route counts only when `walked`: it depends on the outcome, so a
 * clock fork reads the time without it. A choice that waits on outside support takes its wait. */
export function teamMinutes(ev: { timeBase: number; storyMovementMinutes?: number }, action: Pick<ActionDefinition, 'awaitSupport'>, band: OutcomeBand, walked = false): number {
  if (action.awaitSupport) return ev.timeBase;
  return (ev.timeBase - (walked ? 0 : ev.storyMovementMinutes ?? 0)) * RESOLUTION_TUNING.bandTime[band];
}

/** The minutes a decision runs the clocks by: the team's minutes plus what the outcomes add. The
 * commit charges this, and a clock fork reads it for its own outcome, so the two never disagree. */
export function decisionMinutes(team: number, extra: number, action: Pick<ActionDefinition, 'awaitSupport'>): number {
  return round1(action.awaitSupport ? team : Math.max(0.5, team + extra));
}

/** The minutes a clock fork looks ahead: the decision's minutes with this outcome's own extra.
 * `clockBase` is the decision's saved team minutes (DecisionResolution.clockBaseMinutes). Without
 * it (a preview with no evaluation) only the choice's own work counts, not its travel. */
export function forkMinutes(action: ActionDefinition, band: OutcomeBand, effect: OutcomeEffect, clockBase?: number): number {
  return decisionMinutes(clockBase ?? action.workload.base * RESOLUTION_TUNING.bandTime[band], effect.extraMinutes ?? 0, action);
}

export interface DitherInput {
  /** When the decision opened (OperationRun.decisionOpenedAt), in ms. */
  openedAt: number;
  /** The latest time the department has seen, in ms: never a device clock moved backward. */
  now: number;
  timer: TimerSetting;
  /** Characters the player reads at this decision: the prompt, what is said, the choices. */
  textLength: number;
  /** Where dither stops (ditherCap). */
  cap: number;
}

/** Game minutes a stall on an open decision has cost so far. Pure: the same inputs always give the
 * same minutes, and they never fall as `now` rises. Off is always zero; nothing counts before the
 * reading floor; it stops at `cap`. Time away from the app counts like time on screen, because
 * `openedAt` is saved with the operation; a moved-back clock gives a smaller `now`, so callers pass
 * the department's high-water time. Floored to tenths, so the preview never shows more than the
 * commit would charge a moment later. */
export function ditherMinutes({ openedAt, now, timer, textLength, cap }: DitherInput): number {
  if (timer === 'off' || !(cap > 0) || !Number.isFinite(openedAt) || !Number.isFinite(now)) return 0;
  const rule = CLOCK_RULES_V1.dither[timer];
  const floor = rule.floorSeconds + (rule.readingCharsPerSecond > 0 ? Math.max(0, textLength) / rule.readingCharsPerSecond : 0);
  const counted = Math.max(0, (now - openedAt) / 1000 - floor);
  return Math.min(cap, Math.floor(counted / 60 * rule.gameMinutesPerRealMinute * 10) / 10);
}

/** Minutes until a running clock's next unheard cue: 0 once every cue is heard, Infinity when the
 * clock isn't running. */
function minutesToNextCue(def: ClockDef, state: ClockState, flags: readonly string[]): number {
  const rate = effectiveRate(def, flags);
  if (stopped(def, flags) || !(rate > 0)) return Infinity;
  const cue = def.cues[state.cued];
  if (!cue) return 0;
  return Math.max(0, (filling(def) ? cue.at - state.value : state.value - cue.at) / rate);
}

/** Where dither stops on the open decision (docs/call-pressure.md, "The cap"): the decision point's
 * threat's minutes, so a long absence can land that threat but never more than one. Without a
 * threat, a running clock's next cue: a stall can bring a warning, never a run-out. Zero when
 * neither is open, so nothing accrues. */
export function ditherCap(scenario: ScenarioDefinition, run: Pick<OperationRun, 'stage' | 'flags' | 'knowledge' | 'pressure' | 'clocks'>): number {
  if (run.stage === 'debrief') return 0;
  const threat = currentStoryThreat(scenario, run);
  if (threat) return threat.minutes;
  const next = Math.min(...(scenario.clocks ?? []).map(def => run.clocks?.[def.id] ? minutesToNextCue(def, run.clocks[def.id], run.flags) : Infinity));
  return Number.isFinite(next) ? Math.floor(next * 10) / 10 : 0;
}

/** The characters the player reads at the open decision: the last decision's result (the screen
 * shows it first), the prompt, the lines spoken with it, and each visible choice's title and
 * summary. The Relaxed reading floor scales with it. */
export function decisionTextLength(scenario: ScenarioDefinition, run: Pick<OperationRun, 'stage' | 'endingId' | 'flags' | 'knowledge' | 'pressure' | 'history'>): number {
  if (run.stage === 'debrief') return 0;
  const result = (run.history.at(-1)?.explanation ?? []).reduce((n, line) => n + line.length, 0);
  const said = currentStoryExchange(scenario, run).reduce((n, line) => n + line.line.length, 0);
  const choices = scenario.stages[run.stage].actions.filter(action => conditionHolds(action.visibleWhen, run))
    .reduce((n, action) => n + action.title.length + action.summary.length, 0);
  return result + currentStoryPrompt(scenario, run).length + said + choices;
}

/** The open decision's dither now: what the commit charges and the preview shows. `now` is read
 * against the department's high-water time, so a device clock moved backward never reduces it, and
 * time it already counted is never counted again. */
export function openDither(scenario: ScenarioDefinition, run: OperationRun, highWater: number, now: number, timer: TimerSetting): number {
  if (run.status !== 'active' || run.decisionOpenedAt === undefined) return 0;
  return ditherMinutes({ openedAt: run.decisionOpenedAt, now: Math.max(now, highWater), timer, textLength: decisionTextLength(scenario, run), cap: ditherCap(scenario, run) });
}

/** Whether an outcome's clock conditions hold at the end of its own minutes. */
export function clockConditionsHold(conditions: readonly ClockCondition[] | undefined, scenario: ScenarioDefinition,
  run: Pick<OperationRun, 'clocks' | 'flags'>, minutes: number): boolean {
  for (const condition of conditions ?? []) {
    const def = scenario.clocks?.find(entry => entry.id === condition.clockId);
    const state = run.clocks?.[condition.clockId];
    const read = readClock(def, def && state ? stepClock(def, state, minutes, run.flags) : undefined);
    if (read[condition.state] !== condition.is) return false;
  }
  return true;
}

/** Run every clock forward by `minutes`. Returns the cues that fired, as effects the commit applies
 * after the decision's own outcome: the line, a mark, and the fact the clock answers. */
export function advanceClocks(run: Pick<OperationRun, 'clocks' | 'flags'>, scenario: ScenarioDefinition, minutes: number): OutcomeEffect[] {
  if (!run.clocks || !scenario.clocks?.length) return [];
  const next: NonNullable<OperationRun['clocks']> = { ...run.clocks };
  const fired: OutcomeEffect[] = [];
  for (const def of scenario.clocks) {
    const before = run.clocks[def.id];
    if (!before) continue;
    const after = stepClock(def, before, minutes, run.flags);
    next[def.id] = after;
    for (const cue of def.cues.slice(before.cued, after.cued)) fired.push({
      text: cue.text,
      ...(cue.mark || cue.setFlags?.length ? { setFlags: [...cue.mark ? [`mark:${cue.mark}`] : [], ...cue.setFlags ?? []] } : {}),
      ...(cue.moves?.length ? { moves: cue.moves.map(move => ({ ...move })) } : {}),
      ...(cue.reveal && def.factId ? { reveal: [def.factId] } : {}),
    });
  }
  // A new record: callers project time on shallow copies of the run.
  run.clocks = next;
  return fired;
}

/** Cue effects ready to apply after the decision's own outcome. A reveal becomes the fact's settled
 * status. A cue the team already has another way (its mark is set, or its fact settled, by this
 * outcome or an earlier one) stays silent: the outcome already said it. */
export function cueEffects(fired: OutcomeEffect[], scenario: ScenarioDefinition, run: Pick<OperationRun, 'knowledge' | 'flags'>): OutcomeEffect[] {
  return fired.map(effect => {
    const factId = effect.reveal?.[0];
    const { reveal: _reveal, ...rest } = effect;
    const fact = factId ? scenario.facts.find(entry => entry.id === factId) : undefined;
    const settled = !!factId && (run.knowledge[factId] === 'confirmed' || run.knowledge[factId] === 'disproved');
    const marked = !!effect.setFlags?.length && effect.setFlags.every(flag => run.flags.includes(flag));
    return { ...rest, ...(settled || marked ? { text: undefined } : {}), ...(fact && !settled ? { knowledge: [{ factId: fact.id, status: fact.truth ? 'confirmed' as const : 'disproved' as const }] } : {}) };
  });
}

/** Clocks that ran out between two states of the run: above zero before, out after. A clock whose
 * owner was already out at the start did not run (stepClock), so it never runs out here. */
function clocksRunOut(scenario: ScenarioDefinition, before: OperationRun['clocks'], after: OperationRun['clocks']): ClockDef[] {
  return (scenario.clocks ?? []).filter(def => filling(def)
    ? (before?.[def.id]?.value ?? 100) < 100 && (after?.[def.id]?.value ?? 0) >= 100
    : (before?.[def.id]?.value ?? 0) > 0 && (after?.[def.id]?.value ?? 1) <= 0);
}

/** What a clock reaching its end does: running out, or (a fill) filling. */
export const endOf = (def: Pick<ClockDef, 'direction' | 'onOut' | 'onFull'>) => filling(def) ? def.onFull : def.onOut;

/** What the clocks that ran out during a decision do where no fork reads them (ClockDef.onOut),
 * applied after the decision's own outcome and its cues. `run.flags` are the flags after the
 * outcome. The mark is set whenever the clock runs out. The harm lands on the owner only when they
 * are still inside and the decision's own effects (`matched`, drawn variants included) don't
 * already hurt them: an outcome that narrates the collapse owns it.
 *
 * The route (R-G4, precedence from docs/calls/barricade-design.md row H) moves the call, after
 * the outcome, only when:
 * 1. the decision's own outcome didn't end the call (an ending stands; the mark is still set);
 * 2. the owner isn't out or safe once the outcome applied (the clock has stopped).
 * Otherwise it moves the call to its target, a last-stage node or an ending (compile.ts
 * clockRoute), so it never goes back a stage and reads nothing but these flags and effects: the
 * commit and both replays take the same route. When two clocks run out in one decision, the
 * first that routes wins. */
export function clockOutEffects(scenario: ScenarioDefinition, before: OperationRun['clocks'], after: OperationRun['clocks'],
  run: Pick<OperationRun, 'flags'>, matched: readonly OutcomeEffect[]): OutcomeEffect[] {
  const ended = matched.some(effect => effect.ending);
  let routed = false;
  return clocksRunOut(scenario, before, after).flatMap((def): OutcomeEffect[] => {
    const end = endOf(def);
    if (!end) return [];
    const owner = def.owner;
    const hurt = !!owner && matched.some(effect => effect.personHarm?.some(harm => harm.personId === owner));
    const harm = end.harm && owner && !stopped(def, run.flags) && !hurt ? { personHarm: [{ personId: owner, severity: end.harm }] } : {};
    const route = end.route;
    const moves = !!route && !routed && !ended && !stopped(def, run.flags);
    if (moves) routed = true;
    const setFlags = [...(end.mark ? [`mark:${end.mark}`] : []), ...(moves ? route!.setFlags ?? [] : [])];
    const effect: OutcomeEffect = { ...harm, ...(setFlags.length ? { setFlags } : {}),
      ...(moves && route!.clearFlags ? { clearFlags: [...route!.clearFlags] } : {}), ...(moves && route!.stage ? { stage: route!.stage } : {}), ...(moves && route!.ending ? { ending: route!.ending } : {}) };
    return Object.keys(effect).length ? [effect] : [];
  });
}

export interface ClockView { id: Id; label: string; kind: ClockDef['kind']; owner?: Id; direction?: 'fill'; value: number; low: boolean; out: boolean; stopped: boolean;
  /** The last cue the team heard, or nothing yet. */
  latest: string | null;
  /** Minutes left at the current rate, when the team can know the rate. */
  minutesLeft: number | null }

export function clockViews(scenario: ScenarioDefinition, run: Pick<OperationRun, 'clocks' | 'flags'>): ClockView[] {
  return (scenario.clocks ?? []).flatMap(def => {
    const state = run.clocks?.[def.id];
    if (!state) return [];
    const read = readClock(def, state);
    return [{ id: def.id, label: def.label, kind: def.kind, ...(def.owner ? { owner: def.owner } : {}), ...(filling(def) ? { direction: 'fill' as const } : {}), value: read.value, low: read.low, out: read.out,
      stopped: stopped(def, run.flags), latest: state.cued > 0 ? def.cues[state.cued - 1].text : null,
      minutesLeft: !filling(def) && def.rateKnown && def.ratePerMin > 0 ? Math.round(read.value / def.ratePerMin) : null }];
  });
}

/** What a gauge that fills does now, shown beside it so no effect is hidden: percents (of an
 * officer's strain at a commit, and of the call's trust result either way) and call pressure per
 * minute. Null until its first cue has been heard. */
export interface FillEffect { strainPercent: number; trustPercent: number; pressurePerMinute: number }

/** A gauge that fills, as the screen draws it. */
export interface FillView {
  id: Id; label: string; kind: ClockDef['kind']; owner?: Id; direction: 'fill';
  value: number; full: boolean; stopped: boolean;
  /** A set flag has slowed it below its authored rate. */
  slowed: boolean;
  /** Points a minute now (0 when stopped), and minutes to full at that rate, when the team can know it. */
  ratePerMin: number; minutesToFull: number | null;
  /** Every cue, lowest first, with whether the team has heard it. */
  cues: { at: number; text: string; heard: boolean }[];
  latest: string | null;
  effect: FillEffect | null }

/** The share of a full gauge that bites now: the sum over gauges whose first cue was heard, each
 * as value over 100. Zero with no fills, so a call without them is unchanged. */
export function fillGauge(scenario: Pick<ScenarioDefinition, 'clocks'>, clocks: OperationRun['clocks']): number {
  let sum = 0;
  for (const def of scenario.clocks ?? []) {
    const state = clocks?.[def.id];
    if (filling(def) && state && state.cued > 0) sum += state.value / 100;
  }
  return sum;
}

/** How much more the call's trust result counts, either way, for the highest a gauge reached. 1 with none. */
export const audienceFactor = (peak: number | undefined) => 1 + Math.max(0, Math.min(100, peak ?? 0)) / 100 * CLOCK_RULES_V1.fill.audienceGain;

/** The effect a gauge at `value` has, given the call's peak so far. */
const fillEffect = (value: number, peak: number): FillEffect => ({
  strainPercent: Math.round(CLOCK_RULES_V1.fill.strain * value),
  trustPercent: Math.round((audienceFactor(Math.max(peak, value)) - 1) * 100),
  pressurePerMinute: Math.round(CLOCK_RULES_V1.fill.pressurePerMinute * value) / 100,
});

export function fillViews(scenario: ScenarioDefinition, run: Pick<OperationRun, 'clocks' | 'flags'> & Partial<Pick<OperationRun, 'fillPeak'>>): FillView[] {
  return (scenario.clocks ?? []).flatMap(def => {
    const state = run.clocks?.[def.id];
    if (!filling(def) || !state) return [];
    const on = !stopped(def, run.flags);
    const rate = on ? effectiveRate(def, run.flags) : 0;
    return [{ id: def.id, label: def.label, kind: def.kind, ...(def.owner ? { owner: def.owner } : {}), direction: 'fill' as const,
      value: state.value, full: state.value >= 100, stopped: !on, slowed: on && rate < def.ratePerMin, ratePerMin: rate,
      minutesToFull: def.rateKnown && rate > 0 ? Math.round((100 - state.value) / rate) : null,
      cues: def.cues.map((cue, index) => ({ at: cue.at, text: cue.text, heard: index < state.cued })),
      latest: state.cued > 0 ? def.cues[state.cued - 1].text : null,
      effect: state.cued > 0 ? fillEffect(state.value, run.fillPeak ?? 0) : null }];
  });
}

/** Authoring errors in a scenario's clocks: what validateScenario reports. */
export function clockErrors(scenario: ScenarioDefinition): string[] {
  const errs: string[] = [];
  for (const def of scenario.clocks ?? []) {
    const fill = filling(def);
    if (!(fill ? def.start >= 0 && def.start < 100 : def.start > 0 && def.start <= 100) || !(def.ratePerMin >= 0)) errs.push(`${scenario.id}: clock ${def.id} needs a start in ${fill ? '0 to under 100' : '0 to 100'} and a rate of 0 or more`);
    if (!def.cues.some(cue => fill ? cue.at < 100 : cue.at > 0)) errs.push(`${scenario.id}: clock ${def.id} needs a cue before it ${fill ? 'fills' : 'runs out'}`);
    if (def.cues.some((cue, i) => i > 0 && (fill ? cue.at < def.cues[i - 1].at : cue.at > def.cues[i - 1].at))) errs.push(`${scenario.id}: clock ${def.id} lists its cues ${fill ? 'lowest' : 'highest'} first`);
    if ((def.rateFlags ?? []).some(entry => !(entry.ratePerMin >= 0))) errs.push(`${scenario.id}: clock ${def.id} has a slowed rate below 0`);
    if (!fill && def.onFull) errs.push(`${scenario.id}: clock ${def.id} runs down, so it has no onFull`);
    if (fill && def.onOut) errs.push(`${scenario.id}: clock ${def.id} fills, so it has onFull, not onOut`);
    if (def.factId && !scenario.facts.some(fact => fact.id === def.factId)) errs.push(`${scenario.id}: clock ${def.id} answers unknown fact ${def.factId}`);
    if (def.cues.some(cue => cue.reveal) && !def.factId) errs.push(`${scenario.id}: clock ${def.id} reveals with no fact`);
    const end = endOf(def);
    if (end?.harm && !(def.owner && scenario.story?.bindings.people[def.owner])) errs.push(`${scenario.id}: clock ${def.id} harms on ${fill ? 'filling' : 'running out'}, but has no story-bound owner`);
  }
  return errs;
}
