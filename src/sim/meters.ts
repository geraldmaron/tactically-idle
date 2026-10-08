// Subject meters for v13 incidents (docs/incident-domain-model.md §2, M2 slice 3). Each subject has
// an agitation and a rapport with the team, 0 to 100. Standard events move them: being heard out,
// being provoked, seeing the team close, shots. Volatility, drawn per call, sets how far one event
// moves them. What the team has done to a subject since the call began shows on every conversation
// it then has with them, as two contributors: how much more they talk to the team, and how much more
// worked up they are. Names and pronouns never enter.
import type { Contributor, Id, OperationRun } from './types';
import type { IncidentPersonDef, MeterCondition, MeterEvent, MeterStance, OutcomeEffect, ScenarioDefinition, SubjectMeters } from './scenario-types';

/** Versioned fictional balance. Deltas are for a shifting subject; volatility scales them. */
export const METERS_V1 = {
  events: {
    /** The team let them say their piece. */
    heard: { agitation: -6, rapport: 10 },
    /** They picked up, answered, or stayed on the line with the team. */
    contact: { agitation: -4, rapport: 6 },
    /** The team told them a hard truth plainly. */
    honest: { agitation: 2, rapport: 8 },
    /** The team pushed, surprised or ignored them, or they hung up. */
    provoked: { agitation: 10, rapport: -8 },
    /** They saw or heard the team move up close. */
    team_seen: { agitation: 8, rapport: -2 },
    /** Shots were fired, by them or at them. */
    shots: { agitation: 12, rapport: -6 },
    /** They let someone go. */
    released: { agitation: -6, rapport: 6 },
    /** Command kept what it promised them (sim/commitments.ts). */
    promise_kept: { agitation: -4, rapport: 8 },
    /** The team went back on what command promised them. */
    promise_broken: { agitation: 12, rapport: -15 },
  } satisfies Record<MeterEvent, SubjectMeters>,
  volatility: { steady: 0.6, shifting: 1, volatile: 1.5 },
  /** Odds per point moved since the start, on a conversation with this subject. */
  odds: { rapport: 0.3, agitation: 0.25 },
  /** A change smaller than this is not worth a line on the card. */
  minContribution: 1,
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function initialMeters(scenario: ScenarioDefinition): OperationRun['meters'] {
  if (scenario.version < 13) return undefined;
  const subjects = (scenario.incidentPeople ?? []).filter(person => person.meters);
  if (!subjects.length) return undefined;
  return Object.fromEntries(subjects.map(person => [person.id, { ...person.meters!, moved: {} }]));
}

/** Apply the matched effects' meter events, each scaled by the subject's volatility and clamped. */
export function applyMoves(run: Pick<OperationRun, 'meters'>, scenario: ScenarioDefinition, effects: readonly OutcomeEffect[]): void {
  const moves = effects.flatMap(effect => effect.moves ?? []);
  if (!run.meters || !moves.length) return;
  const next = structuredClone(run.meters);
  for (const { personId, event } of moves) {
    const meters = next[personId];
    const person = scenario.incidentPeople?.find(entry => entry.id === personId);
    if (!meters || !person) continue;
    const scale = METERS_V1.volatility[person.volatility ?? 'shifting'];
    const base = METERS_V1.events[event];
    const agitation = clamp(round1(meters.agitation + base.agitation * scale)), rapport = clamp(round1(meters.rapport + base.rapport * scale));
    const moved = meters.moved[event] ?? { agitation: 0, rapport: 0 };
    meters.moved[event] = { agitation: round1(moved.agitation + agitation - meters.agitation), rapport: round1(moved.rapport + rapport - meters.rapport) };
    meters.agitation = agitation; meters.rapport = rapport;
  }
  run.meters = next;
}

/** How a subject sounds to the team now. 'unheard' until the first event the team caused. */
export type Stance = MeterStance;
export type RunMeters = NonNullable<OperationRun['meters']>[Id];
export function stanceOf(meters: RunMeters): Stance {
  if (!Object.keys(meters.moved).length) return 'unheard';
  if (meters.agitation >= 80) return 'breaking';
  if (meters.rapport >= 50 && meters.agitation < 50) return 'yielding';
  if (meters.agitation >= 60) return 'volatile';
  if (meters.agitation >= 30) return 'tense';
  return 'calm';
}

/** Contributors on a conversation with a subject: rapport and agitation since the call began. */
export function meterContributors(person: IncidentPersonDef, meters: NonNullable<OperationRun['meters']>[Id] | undefined): Contributor[] {
  if (!person.meters || !meters) return [];
  const out: Contributor[] = [];
  const rapport = round1((meters.rapport - person.meters.rapport) * METERS_V1.odds.rapport);
  const agitation = round1(-(meters.agitation - person.meters.agitation) * METERS_V1.odds.agitation);
  if (Math.abs(rapport) >= METERS_V1.minContribution)
    out.push({ label: rapport > 0 ? `${person.label} is talking to you more` : `${person.label} is talking to you less`, value: rapport, source: rapport > 0 ? 'preparation' : 'difficulty', ref: `meters:${person.id}:rapport` });
  if (Math.abs(agitation) >= METERS_V1.minContribution)
    out.push({ label: agitation < 0 ? `${person.label} is more worked up now` : `${person.label} is steadier now`, value: agitation, source: agitation > 0 ? 'preparation' : 'difficulty', ref: `meters:${person.id}:agitation` });
  return out;
}

/** Escalation from meters (docs/incident-domain-model.md §8, M2 slice 5). Whether an outcome's
 * meter branches hold, read against the subjects' meters as they stand at the start of the
 * decision: before this decision's own events move them. Each condition holds when the subject's
 * stance is one of `stance` and their agitation is at least `agitationAtLeast` (each when given),
 * negated by `is: false`. A person with no meters (no subject, or a call with no meters) never
 * matches, like a clock a call doesn't have. Hidden from previews like every engine-only branch. */
export function meterConditionsHold(conditions: readonly MeterCondition[] | undefined, run: Partial<Pick<OperationRun, 'meters'>>): boolean {
  for (const condition of conditions ?? []) {
    const meters = run.meters?.[condition.personId];
    const matched = !!meters && (condition.stance === undefined || condition.stance.includes(stanceOf(meters)))
      && (condition.agitationAtLeast === undefined || meters.agitation >= condition.agitationAtLeast);
    if (matched !== condition.is) return false;
  }
  return true;
}
