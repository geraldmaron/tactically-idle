// Scoring a v13 call (docs/incident-domain-model.md §9, M2 slice 4). Every person at the call ends in
// a state: out safe, let go, hurt, killed, still inside, in the team's hands, or gone. One function
// scores the call from those end states, in priority-of-life order (held, victim and trapped
// civilians, then bystanders, then officers, then subjects; every life costs), plus the force the
// team used, what command promised and whether the team kept it, how long it took, and how far the
// call got. It sets the disposition, the trust the call earns or costs, the strain the team carries
// home and the rewards factor, and says each contribution in a line the debrief shows. Authors write
// ending titles and text, never numbers.
//
// Game balance, not a real-world assessment. Names and pronouns never enter: the weights read who a
// person is to the call (their kind), never who they are.
import { civilianOutcomeViews } from './incident-consequences';
import { scenarioActions } from './scenario-types';
import type { IncidentPersonDef, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { CompletionDisposition, Id, OperationRun } from './types';

/** Where a person is when the call ends. `fled` is not reachable yet (containment, §5). */
export type EndState = 'safe' | 'released' | 'hurt' | 'killed' | 'inside' | 'in_hand' | 'fled';
/** Who a person is to the call, in priority-of-life order. */
export type LifeGroup = 'held' | 'trapped' | 'bystander' | 'officer' | 'subject';
export const LIFE_ORDER: readonly LifeGroup[] = ['held', 'trapped', 'bystander', 'officer', 'subject'];
export type HurtSeverity = 'wounded' | 'serious';

export interface PersonEnd {
  id: Id;
  /** Bound plain label (a full name), for the debrief. */
  label: string;
  group: LifeGroup;
  state: EndState;
  /** With 'hurt': how badly. A hurt subject is in the team's hands. */
  severity?: HurtSeverity;
  /** With 'hurt': a civilian hurt where they were, who never came out (a collapse behind the counter). */
  inside?: true;
}

/** A trust and strain pair: [trust, strain]. Strain is what the deployed officers carry home. */
type Pair = readonly [trust: number, strain: number];

/** Versioned fictional balance, calibrated against the hand-set numbers the four v13 call trees
 * carried before this table (outcome-score.test.ts keeps them as a fixture and reports the fit).
 *
 * People are scored in priority-of-life order. Getting everyone the team came for out safe is the
 * `everyoneOut` credit, shared by the civilians who come out safe or are let go. A civilian who is
 * hurt, killed or still inside gets no share and costs their own weight on top, so losing a civilian
 * always costs more than the same harm to an officer, and an officer more than a subject, however
 * many civilians the call has. */
export const OUTCOME_SCORE_V1 = {
  everyoneOut: [3, -2] as Pair,
  civilian: {
    held: { inside: [-1, 1.5], wounded: [-1.5, 1], serious: [-2.5, 1.5], killed: [-5, 6] },
    trapped: { inside: [-0.5, 1], wounded: [-1.5, 1], serious: [-2.5, 1.5], killed: [-5, 6] },
    bystander: { inside: [-0.5, 0.5], wounded: [-1.25, 1], serious: [-2.25, 1.5], killed: [-4.5, 5] },
  } satisfies Record<'held' | 'trapped' | 'bystander', Record<'inside' | HurtSeverity | 'killed', Pair>>,
  /** Officers are hurt, never killed (sim/drawn-effects.ts). */
  officer: { wounded: [-1, 1.5], serious: [-2, 3] } satisfies Record<HurtSeverity, Pair>,
  subject: { in_hand: [0, 0], inside: [-1.5, 1], fled: [-2, 1], wounded: [-0.5, 1.5], serious: [-1.5, 3], killed: [-3, 4.5] } satisfies Record<'in_hand' | 'inside' | 'fled' | HurtSeverity | 'killed', Pair>,
  force: {
    /** The team went in on command's authority, once per call: the entry goes to review. */
    entry: [-2, 3] as Pair,
    /** Each firearm use goes to review, hit or miss. */
    firearm: [-2, 1.5] as Pair,
    lessLethal: [-0.5, 0.5] as Pair,
    /** Officers took hold of the person: no review, a struggle the team carries home. */
    hands: [0, 0.5] as Pair,
  },
  commitments: { kept: [1, -0.5] as Pair, broken: [-2, 1] as Pair },
  /** A call that runs this many operation minutes or more is a long one. */
  time: { longAt: 45, long: [-1, 3] as Pair },
  /** The rewards factor (funding, experience, development points, and the trust the call's size
   * brings): `base`, plus `perPoint` for each trust point the lines add up to, plus `objective` for
   * how far the call got (run.objective, 0 to 100) against the middle. Clamped 0 to 1, and to
   * `unfinishedMax` when the call is not resolved: unfinished work never earns full settlement
   * (operation.ts INCOMPLETE_SERVICE_FACTOR_MAX). */
  factor: { base: 0.7, perPoint: 0.04, objective: 0.2, unfinishedMax: 0.65 },
};

export type ForceProfileKey = 'firearm' | 'less_lethal_device' | 'less_lethal_impact' | 'hands';
export type ForceSeverityKey = 'none' | 'wounded' | 'serious' | 'fatal';
/** One use of force by the team, from the drawn records the commits saved (sim/drawn-effects.ts). */
export interface ForceUse { personId: Id; label: string; profile: ForceProfileKey; severity: ForceSeverityKey; reason?: string; revision: number }

/** The effects one committed decision applied (operation.ts traceRun), to tell a release apart. */
export interface ScoreStep { effects: readonly OutcomeEffect[] }

export type ScoreRun = Pick<OperationRun, 'flags' | 'knowledge' | 'personCasualties' | 'officerCasualties' | 'history' | 'clock' | 'objective' | 'endingId'>
  & Partial<Pick<OperationRun, 'commitments' | 'responseFailure'>>;
export type OfficerNames = Record<Id, { firstName: string; surname: string } | undefined>;
export interface ScoreOptions { officers?: OfficerNames; steps?: readonly ScoreStep[] }

const GROUP_OF: Partial<Record<IncidentPersonDef['kind'], LifeGroup>> = { hostage: 'held', victim: 'held', trapped: 'trapped', bystander: 'bystander' };
/** The ending a call reaches when no step is left (operation.ts FALLBACK_ENDING). */
const RAN_OUT_ENDING = 'handed_over';
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const severityOf = (severity: 'wounded' | 'serious' | 'fatal' | undefined): HurtSeverity => severity === 'serious' ? 'serious' : 'wounded';

function personLabel(scenario: ScenarioDefinition, id: Id, fallback?: string): string {
  return scenario.story?.bindings.people[id]?.label ?? fallback ?? id;
}

/** Civilians a subject let go: they came out on a decision whose outcome records a release. */
function releasedIds(steps: readonly ScoreStep[] | undefined, ids: readonly Id[]): Set<Id> {
  const out = new Set<Id>();
  for (const step of steps ?? []) {
    if (!step.effects.some(effect => effect.moves?.some(move => move.event === 'released'))) continue;
    for (const id of ids) if (step.effects.some(effect => effect.setFlags?.includes(`safe:${id}`))) out.add(id);
  }
  return out;
}

/** Each person's end state for a v13 call: civilians (held, trapped, bystanders inside), subjects
 * inside the building, and officers hurt on the call. People outside from the start (a reporting
 * party with patrol) and a subject offsite (another unit's problem) are not scored. */
export function endStates(scenario: ScenarioDefinition, run: ScoreRun, opts: ScoreOptions = {}): PersonEnd[] {
  const people = scenario.incidentPeople ?? [];
  const civilians = scenario.civilianOutcomes ?? [];
  const released = releasedIds(opts.steps, civilians.map(person => person.id));
  const out: PersonEnd[] = [];
  for (const view of civilianOutcomeViews(scenario, run)) {
    const group = GROUP_OF[people.find(person => person.id === view.id)?.kind ?? 'trapped'] ?? 'trapped';
    const label = personLabel(scenario, view.id, view.label);
    if (view.status === 'deceased') out.push({ id: view.id, label, group, state: 'killed' });
    else if (view.status === 'injured_needs_care' || view.status === 'care_accepted') {
      // Harm swaps the safe flag for the injured one, so whether they came out is the story's
      // `out:` flag, which every walk out sets and harm never clears.
      out.push({ id: view.id, label, group, state: 'hurt', severity: severityOf(run.personCasualties?.[view.id]?.severity), ...(!run.flags.includes(`out:${view.id}`) ? { inside: true as const } : {}) });
    }
    else if (view.status === 'safe' || view.status === 'accounted_elsewhere') out.push({ id: view.id, label, group, state: released.has(view.id) ? 'released' : 'safe' });
    else out.push({ id: view.id, label, group, state: 'inside' });
  }
  for (const person of people) {
    if (civilians.some(civilian => civilian.id === person.id)) continue;
    const group = person.kind === 'subject' ? 'subject' : GROUP_OF[person.kind];
    if (!group) continue;
    const casualty = run.personCasualties?.[person.id];
    const left = run.flags.includes(`out:${person.id}`) || run.flags.includes(`safe:${person.id}`);
    const label = personLabel(scenario, person.id, person.label);
    if (casualty?.severity === 'fatal') out.push({ id: person.id, label, group, state: 'killed' });
    else if (casualty && (left || group !== 'subject')) out.push({ id: person.id, label, group, state: 'hurt', severity: severityOf(casualty.severity) });
    else if (left) out.push({ id: person.id, label, group, state: group === 'subject' ? 'in_hand' : 'safe' });
    else out.push({ id: person.id, label, group, state: 'inside' });
  }
  for (const record of Object.values(run.officerCasualties ?? {})) {
    const officer = opts.officers?.[record.officerId];
    out.push({ id: record.officerId, label: officer ? `${officer.firstName} ${officer.surname}` : record.label, group: 'officer', state: 'hurt', severity: record.severity });
  }
  return out.sort((a, b) => LIFE_ORDER.indexOf(a.group) - LIFE_ORDER.indexOf(b.group));
}

/** Every use of force by the team on the call, in order. */
export function forceUses(scenario: ScenarioDefinition, run: Pick<OperationRun, 'history'>): ForceUse[] {
  return run.history.flatMap(decision => (decision.committed?.drawn ?? []).filter(record => record.model === 'team_force').map(record => {
    const [profile, severity] = record.key.split(':') as [ForceProfileKey, ForceSeverityKey];
    return { personId: record.personId, label: personLabel(scenario, record.personId), profile, severity, ...(record.reason ? { reason: record.reason } : {}), revision: decision.revision };
  }));
}

/** How many times the team went in on command's authority. */
export function entriesTaken(scenario: ScenarioDefinition, run: Pick<OperationRun, 'history'>): number {
  const actions = new Map(scenarioActions(scenario).map(action => [action.id, action]));
  return run.history.filter(decision => actions.get(decision.actionId)?.authority?.kind === 'entry').length;
}

export interface ScoreInputs {
  people: PersonEnd[];
  force: ForceUse[];
  entries: number;
  commitments: { personId: Id; label: string; status: 'open' | 'kept' | 'broken' }[];
  minutes: number;
  objective: number;
  /** The call ran out of steps (the fallback ending), or the response failed. */
  ranOut: boolean;
}

export function scoreInputs(scenario: ScenarioDefinition, run: ScoreRun, opts: ScoreOptions = {}): ScoreInputs {
  return {
    people: endStates(scenario, run, opts),
    force: forceUses(scenario, run),
    entries: entriesTaken(scenario, run),
    commitments: Object.values(run.commitments ?? {}).map(entry => ({ personId: entry.personId, label: personLabel(scenario, entry.personId), status: entry.status })),
    minutes: run.clock,
    objective: run.objective,
    ranOut: !!run.responseFailure || run.endingId === RAN_OUT_ENDING,
  };
}

/** One contribution to the score, as the debrief shows it. `key` is stable for tests and lists. */
export interface ScoreLine { key: string; text: string; trust: number; strain: number }
export interface CallScore {
  disposition: CompletionDisposition;
  /** What the lines below the call's result add up to: the trust points the people, the force,
   * the commitments and the time earned or cost. Comparable to the hand-set ending trust it replaced. */
  points: number;
  /** The call's whole trust change before the department's 0 to 100 clamp: the call's result for
   * its size (rewards.trust and the factor) plus the points. Every line adds up to it. */
  trust: number;
  /** Strain every deployed officer carries home at close (negative is relief). */
  strain: number;
  factor: number;
  lines: ScoreLine[];
}

const CIVILIAN_TEXT: Record<Exclude<EndState, 'in_hand' | 'fled'>, (label: string, severity?: HurtSeverity) => string> = {
  safe: label => `${label} is out safe.`,
  released: label => `${label} was let go and is out safe.`,
  hurt: (label, severity) => severity === 'serious' ? `${label} is out, badly hurt.` : `${label} is out, hurt.`,
  // A civilian hurt where they were and never brought out reads as still inside (hurtInside).
  killed: label => `${label} died.`,
  inside: label => `${label} is still inside.`,
};
const hurtInside = (label: string, severity?: HurtSeverity) => severity === 'serious' ? `${label} is still inside, badly hurt.` : `${label} is still inside, hurt.`;
const SUBJECT_TEXT: Record<Exclude<EndState, 'safe' | 'released'>, (label: string, severity?: HurtSeverity) => string> = {
  in_hand: label => `${label} is with the team, unhurt.`,
  hurt: (label, severity) => severity === 'serious' ? `${label} is with the team, badly hurt.` : `${label} is with the team, hurt.`,
  killed: label => `${label} died.`,
  inside: label => `${label} is still inside.`,
  fled: label => `${label} got away.`,
};
const LESS_LETHAL_NAME: Record<Exclude<ForceProfileKey, 'firearm' | 'hands'>, string> = { less_lethal_impact: 'the impact launcher', less_lethal_device: 'the conducted-energy device' };
/** What the team did, on whom: the start of a score line and of a force line. */
const forceAct = (use: Pick<ForceUse, 'profile' | 'label'>) => use.profile === 'firearm' ? `The team fired at ${use.label}`
  : use.profile === 'hands' ? `Two officers took hold of ${use.label}` : `The team used ${LESS_LETHAL_NAME[use.profile]} on ${use.label}`;
const RESULT_TEXT: Record<CompletionDisposition, string> = {
  resolved: 'The call is resolved.', care_accepted: 'The call is resolved.', followup_agreed: 'The call is resolved.',
  relief_partial: 'The call is only partly resolved.', unresolved: 'The call is still open.',
};

/** The disposition from end states: still open when the call ran out of steps; partly resolved
 * while anyone the team came for is still inside or was killed, or the subject is still inside or
 * got away; otherwise resolved. Harm to someone who came out is scored, not left open. */
export function dispositionOf(inputs: Pick<ScoreInputs, 'people' | 'ranOut'>): CompletionDisposition {
  if (inputs.ranOut) return 'unresolved';
  const open = inputs.people.some(person => person.group === 'subject' ? person.state === 'inside' || person.state === 'fled'
    : person.group !== 'officer' && (person.state === 'inside' || person.state === 'killed' || person.inside));
  return open ? 'relief_partial' : 'resolved';
}

/** Score a call from what happened in it (inputs) and the size of the call (rewards.trust). */
export function scoreFrom(inputs: ScoreInputs, rewardsTrust: number): CallScore {
  const W = OUTCOME_SCORE_V1;
  const lines: ScoreLine[] = [];
  const add = (key: string, text: string, [trust, strain]: Pair) => lines.push({ key, text, trust: round1(trust), strain: round1(strain) });
  const civilians = inputs.people.filter(person => person.group === 'held' || person.group === 'trapped' || person.group === 'bystander');
  const share = (pair: Pair): Pair => [pair[0] / civilians.length, pair[1] / civilians.length];
  if (!civilians.length) add('everyone_out', 'Nobody else was inside.', W.everyoneOut);
  for (const person of inputs.people) {
    const key = `person:${person.id}:${person.state}`;
    if (person.group === 'officer') add(key, person.severity === 'serious' ? `${person.label} was badly hurt on the call.` : `${person.label} was hurt on the call.`, W.officer[person.severity ?? 'wounded']);
    else if (person.group === 'subject') {
      const state = person.state === 'safe' || person.state === 'released' ? 'in_hand' : person.state;
      add(key, SUBJECT_TEXT[state](person.label, person.severity), state === 'hurt' ? W.subject[person.severity ?? 'wounded'] : W.subject[state]);
    } else {
      const state = person.state === 'in_hand' || person.state === 'fled' ? 'inside' : person.state;
      const weights = W.civilian[person.group];
      const hurt = weights[person.severity ?? 'wounded'];
      add(key, person.inside ? hurtInside(person.label, person.severity) : CIVILIAN_TEXT[state](person.label, person.severity),
        state === 'safe' || state === 'released' ? share(W.everyoneOut)
          : state === 'hurt' ? person.inside ? [hurt[0] + weights.inside[0], hurt[1] + weights.inside[1]] as const : hurt : weights[state]);
    }
  }
  if (inputs.entries > 0) add('force:entry', 'The team went in. The entry goes to review.', W.force.entry);
  inputs.force.forEach((use, index) => {
    // The force section names the tool and the result (forceLines); a score line says what it cost.
    if (use.profile === 'firearm') add(`force:${index}:firearm`, `The use of force on ${use.label} goes to review.`, W.force.firearm);
    else if (use.profile === 'hands') add(`force:${index}:hands`, `The team took ${use.label} by hand.`, W.force.hands);
    else add(`force:${index}:${use.profile}`, `The team used less-lethal force on ${use.label}.`, W.force.lessLethal);
  });
  inputs.commitments.forEach((commitment, index) => {
    if (commitment.status === 'kept') add(`commitment:${index}:kept`, `Command kept its word to ${commitment.label}.`, W.commitments.kept);
    else if (commitment.status === 'broken') add(`commitment:${index}:broken`, `The team went back on what command promised ${commitment.label}.`, W.commitments.broken);
  });
  if (inputs.minutes >= W.time.longAt) add('time:long', `The team was on scene for ${Math.round(inputs.minutes)} minutes.`, W.time.long);

  const points = round1(lines.reduce((sum, line) => sum + line.trust, 0));
  const strain = round1(lines.reduce((sum, line) => sum + line.strain, 0));
  const disposition = dispositionOf(inputs);
  const raw = clamp01(W.factor.base + W.factor.perPoint * points + W.factor.objective * (inputs.objective - 50) / 50);
  const factor = Math.round(1000 * (disposition === 'resolved' ? raw : Math.min(W.factor.unfinishedMax, raw))) / 1000;
  const trust = Math.round(rewardsTrust * (2 * factor - 1) + points);
  lines.unshift({ key: 'result', text: RESULT_TEXT[disposition], trust: round1(trust - points), strain: 0 });
  return { disposition, points, trust, strain, factor, lines };
}

/** Score a finished v13 call. Deterministic: it reads only the run and the scenario. */
export function scoreCall(scenario: ScenarioDefinition, run: ScoreRun, opts: ScoreOptions = {}): CallScore {
  return scoreFrom(scoreInputs(scenario, run, opts), scenario.rewards.trust);
}

/** What the team's force did, to whom, and the rule's reason, for the debrief. */
export interface ForceLine { text: string; reason?: string }
const FORCE_RESULT: Record<ForceSeverityKey, (firearm: boolean) => string> = {
  none: firearm => firearm ? 'who wasn’t hit' : 'who wasn’t hurt',
  wounded: () => 'who is hurt',
  serious: () => 'who is badly hurt',
  fatal: () => 'who died',
};
export function forceLines(scenario: ScenarioDefinition, run: Pick<OperationRun, 'history'>): ForceLine[] {
  return forceUses(scenario, run).map(use => {
    return { text: `${forceAct(use)}, ${(FORCE_RESULT[use.severity] ?? FORCE_RESULT.none)(use.profile === 'firearm')}.`, ...(use.reason ? { reason: use.reason } : {}) };
  });
}
