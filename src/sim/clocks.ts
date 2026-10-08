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

export const CLOCK_RULES_V1 = {
  /** Where a clock stops in a decision that would run it out before any cue was heard. */
  floor: 1,
  /** How long a choice takes for its band, as the commit applies it (RESOLUTION_TUNING.bandTime). */
  bandTime: { favorable: 1, mixed: 1.2, adverse: 1.5 } as Record<OutcomeBand, number>,
};

export type ClockState = NonNullable<OperationRun['clocks']>[Id];
const round1 = (n: number) => Math.round(n * 10) / 10;

export function initialClocks(scenario: ScenarioDefinition): OperationRun['clocks'] {
  if (scenario.version < 13 || !scenario.clocks?.length) return undefined;
  return Object.fromEntries(scenario.clocks.map(def => [def.id, { value: def.start, cued: def.cues.filter(cue => def.start <= cue.at).length }]));
}

/** A clock stops once the person it belongs to is out of the building. */
const stopped = (def: ClockDef, flags: readonly string[]) => !!def.owner && (flags.includes(`safe:${def.owner}`) || flags.includes(`out:${def.owner}`));

/** Where a clock will be after `minutes` more, and how many of its cues will have fired. */
export function stepClock(def: ClockDef, state: ClockState, minutes: number, flags: readonly string[]): ClockState {
  if (stopped(def, flags) || minutes <= 0) return { ...state };
  let value = round1(Math.max(0, state.value - def.ratePerMin * minutes));
  if (value <= 0 && state.cued === 0) value = CLOCK_RULES_V1.floor;
  return { value, cued: Math.max(state.cued, def.cues.filter(cue => value <= cue.at).length) };
}

export interface ClockRead { value: number; low: boolean; out: boolean }
export function readClock(def: ClockDef | undefined, state: ClockState | undefined): ClockRead {
  if (!def || !state) return { value: 100, low: false, out: false };
  return { value: state.value, low: state.cued > 0, out: state.value <= 0 };
}

/** The minutes a clock fork looks ahead: the choice's own minutes for its band, plus the outcome's. */
export function forkMinutes(action: ActionDefinition, band: OutcomeBand, effect: OutcomeEffect): number {
  return action.workload.base * CLOCK_RULES_V1.bandTime[band] + (effect.extraMinutes ?? 0);
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
      ...(cue.mark ? { setFlags: [`mark:${cue.mark}`] } : {}),
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
export function clocksRunOut(scenario: ScenarioDefinition, before: OperationRun['clocks'], after: OperationRun['clocks']): ClockDef[] {
  return (scenario.clocks ?? []).filter(def => (before?.[def.id]?.value ?? 0) > 0 && (after?.[def.id]?.value ?? 1) <= 0);
}

/** What the clocks that ran out during a decision do where no fork reads them (ClockDef.onOut),
 * applied after the decision's own outcome and its cues. `run.flags` are the flags after the
 * outcome. The mark is set whenever the clock runs out. The harm lands on the owner only when they
 * are still inside and the decision's own effects (`matched`, drawn variants included) don't
 * already hurt them: an outcome that narrates the collapse owns it. */
export function clockOutEffects(scenario: ScenarioDefinition, before: OperationRun['clocks'], after: OperationRun['clocks'],
  run: Pick<OperationRun, 'flags'>, matched: readonly OutcomeEffect[]): OutcomeEffect[] {
  return clocksRunOut(scenario, before, after).flatMap((def): OutcomeEffect[] => {
    if (!def.onOut) return [];
    const owner = def.owner;
    const hurt = !!owner && matched.some(effect => effect.personHarm?.some(harm => harm.personId === owner));
    const harm = def.onOut.harm && owner && !stopped(def, run.flags) && !hurt ? { personHarm: [{ personId: owner, severity: def.onOut.harm }] } : {};
    const effect: OutcomeEffect = { ...harm, ...(def.onOut.mark ? { setFlags: [`mark:${def.onOut.mark}`] } : {}) };
    return Object.keys(effect).length ? [effect] : [];
  });
}

export interface ClockView { id: Id; label: string; kind: ClockDef['kind']; owner?: Id; value: number; low: boolean; out: boolean; stopped: boolean;
  /** The last cue the team heard, or nothing yet. */
  latest: string | null;
  /** Minutes left at the current rate, when the team can know the rate. */
  minutesLeft: number | null }

export function clockViews(scenario: ScenarioDefinition, run: Pick<OperationRun, 'clocks' | 'flags'>): ClockView[] {
  return (scenario.clocks ?? []).flatMap(def => {
    const state = run.clocks?.[def.id];
    if (!state) return [];
    const read = readClock(def, state);
    return [{ id: def.id, label: def.label, kind: def.kind, ...(def.owner ? { owner: def.owner } : {}), value: read.value, low: read.low, out: read.out,
      stopped: stopped(def, run.flags), latest: state.cued > 0 ? def.cues[state.cued - 1].text : null,
      minutesLeft: def.rateKnown && def.ratePerMin > 0 ? Math.round(read.value / def.ratePerMin) : null }];
  });
}

/** Authoring errors in a scenario's clocks: what validateScenario reports. */
export function clockErrors(scenario: ScenarioDefinition): string[] {
  const errs: string[] = [];
  for (const def of scenario.clocks ?? []) {
    if (!(def.start > 0 && def.start <= 100) || !(def.ratePerMin >= 0)) errs.push(`${scenario.id}: clock ${def.id} needs a start in 0 to 100 and a rate of 0 or more`);
    if (!def.cues.some(cue => cue.at > 0)) errs.push(`${scenario.id}: clock ${def.id} needs a cue before it runs out`);
    if (def.cues.some((cue, i) => i > 0 && cue.at > def.cues[i - 1].at)) errs.push(`${scenario.id}: clock ${def.id} lists its cues highest first`);
    if (def.factId && !scenario.facts.some(fact => fact.id === def.factId)) errs.push(`${scenario.id}: clock ${def.id} answers unknown fact ${def.factId}`);
    if (def.cues.some(cue => cue.reveal) && !def.factId) errs.push(`${scenario.id}: clock ${def.id} reveals with no fact`);
    if (def.onOut?.harm && !(def.owner && scenario.story?.bindings.people[def.owner])) errs.push(`${scenario.id}: clock ${def.id} harms on running out, but has no story-bound owner`);
  }
  return errs;
}
