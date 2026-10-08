// Authorization for v13 incidents (docs/incident-domain-model.md §7, M2 slice 4). One rule table for
// what command allows: going in, what a subject can be given, and deadly force. Every rule reads what
// the team believes (knowledge statuses, marks, the clock cues it has heard), never hidden truth, and
// every answer carries the line command says (content/incidents/lines.ts), bound for the call.
//
// Entry and concessions are asked for by a choice (ActionDefinition.authority) and decided when the
// choice is evaluated: a refusal locks it with the line. Deadly force is never a choice. It is ruled
// at the moment a drawn force outcome commits (sim/drawn-effects.ts teamForceProfile), from this table.
import { COMMAND_LINES } from '../content/incidents/lines';
import { clockViews } from './clocks';
import { CONCESSIONS_ALLOWED } from './scenario-types';
import type { Armament, AuthorityRequest, AuthorityResult, ClockDef, ConcessionKind, IncidentPersonDef, ScenarioDefinition, ThreatEvidence } from './scenario-types';
import type { KnowledgeStatus, OperationRun } from './types';

/** Versioned rules of engagement and policy. */
export const AUTHORIZATION_V1 = {
  /** The team believes a claim once it is reported or confirmed. Unknown and disproved claims don't count. */
  believed: ['reported', 'confirmed'] as readonly KnowledgeStatus[],
  entry: {
    /** In order. 'entry:threat': a threat to life the team has seen, a believed threat fact or a set
     * threat mark. 'entry:clock': a clock with an urgent phrase has given its first cue and its owner
     * is still inside, so time runs out before talking can work. Otherwise 'entry:none'. When several
     * threats are seen, a mark speaks first (something the team saw or heard happen), then a
     * confirmed claim, then a reported one, each in authoring order. */
    rules: ['entry:threat', 'entry:clock'] as const,
  },
  concessions: {
    /** Allowed: food, water, a phone, a written statement, a message, a third party outside the
     * family, surrender terms. Never: weapons, transport out, officer swaps, family on the line. */
    allowed: CONCESSIONS_ALLOWED,
  },
  deadlyForce: {
    /** A gun the team believes the person has, in hand. */
    guns: ['handgun', 'long_gun'] as readonly Armament[],
    /** An edged or blunt weapon in hand counts only within reach of someone. */
    inReach: ['edged', 'blunt'] as readonly Armament[],
    /** Feet. About three strides: inside this, a person with a blade or a bat reaches someone before
     * anything short of a firearm stops them. Measured to the door the team comes through (doorFt),
     * and to any held person, victim or bystander in the same room who is still inside. */
    reachFt: 10,
  },
};

type Beliefs = Pick<OperationRun, 'knowledge' | 'flags'>;

const believes = (run: Beliefs, factId: string) => AUTHORIZATION_V1.believed.includes(run.knowledge?.[factId] ?? 'unknown');

/** The threat to life the team has seen, strongest evidence first, or nothing. */
export function seenThreat(scenario: ScenarioDefinition, run: Beliefs): ThreatEvidence | undefined {
  const strength = (threat: ThreatEvidence) => Math.max(
    threat.flag && run.flags?.includes(threat.flag) ? 3 : 0,
    threat.factId ? ({ confirmed: 2, reported: 1 } as Partial<Record<KnowledgeStatus, number>>)[run.knowledge?.[threat.factId] ?? 'unknown'] ?? 0 : 0,
  );
  let best: ThreatEvidence | undefined, score = 0;
  for (const threat of scenario.threats ?? []) {
    const value = strength(threat);
    if (value > score) { best = threat; score = value; }
  }
  return best;
}

/** A clock that won't wait for talking: urgent, its first cue heard, its owner still inside. */
export function urgentClock(scenario: ScenarioDefinition, run: Pick<OperationRun, 'clocks' | 'flags'>): ClockDef | undefined {
  const views = clockViews(scenario, run);
  return scenario.clocks?.find(def => def.urgent && views.some(view => view.id === def.id && view.low && !view.stopped));
}

const CONCESSION_LINES: Record<ConcessionKind, string> = COMMAND_LINES.concession;
const because = (phrase: string) => COMMAND_LINES.entry.approved.replace('{because}', phrase.trim().replace(/\.+$/, ''));

/** What command says to a choice's request, from what the team believes now. */
export function authorize(scenario: ScenarioDefinition, run: Pick<OperationRun, 'knowledge' | 'flags' | 'clocks'>, request: AuthorityRequest): AuthorityResult {
  if (request.kind === 'entry') {
    const threat = seenThreat(scenario, run);
    if (threat) return { allowed: true, rule: 'entry:threat', reason: because(threat.because) };
    const clock = urgentClock(scenario, run);
    if (clock?.urgent) return { allowed: true, rule: 'entry:clock', reason: because(clock.urgent) };
    return { allowed: false, rule: 'entry:none', reason: COMMAND_LINES.entry.refused };
  }
  const allowed = AUTHORIZATION_V1.concessions.allowed.includes(request.item);
  return { allowed, rule: allowed ? 'concession:allowed' : 'concession:never', reason: CONCESSION_LINES[request.item] };
}

/** People a subject could reach or hurt: anyone still inside, in the same room, within `ft`, who is
 * not a subject or an animal. Nearest first. */
export function peopleNear(scenario: ScenarioDefinition, run: Pick<OperationRun, 'flags'>, person: IncidentPersonDef, ft: number): IncidentPersonDef[] {
  const gone = (id: string) => !!run.flags?.some(flag => flag === `safe:${id}` || flag === `out:${id}`);
  const distance = (other: IncidentPersonDef) => Math.hypot(other.at.x - person.at.x, other.at.y - person.at.y);
  return (scenario.incidentPeople ?? [])
    .filter(other => other.id !== person.id && other.kind !== 'subject' && other.kind !== 'animal' && other.spaceId === person.spaceId && !gone(other.id) && distance(other) <= ft)
    .sort((a, b) => distance(a) - distance(b));
}

export type ForceThreat =
  | { deadly: true; rule: 'force:gun' }
  /** `near` is the person within reach, or null for the team at the door. */
  | { deadly: true; rule: 'force:reach'; near: IncidentPersonDef | null }
  | { deadly: false; rule: 'force:unseen' | 'force:out_of_reach' | 'force:unclear' | 'force:empty' };

/** Deadly force (§6, §7): only on an imminent threat to life an officer can see. A gun the team
 * believes the person has (the weapon fact reported or confirmed, or no such fact), in hand; or an
 * edged or blunt weapon in hand, believed the same way, within reach of the team or of someone else.
 * Otherwise, why not. */
export function readForceThreat(scenario: ScenarioDefinition, run: Beliefs, person: IncidentPersonDef): ForceThreat {
  const R = AUTHORIZATION_V1.deadlyForce;
  const threat = person.threat;
  const inHand = threat?.readiness === 'brandished';
  const armed = !!threat && (R.guns.includes(threat.armament) || R.inReach.includes(threat.armament));
  const believed = !person.armamentFactId || believes(run, person.armamentFactId);
  if (inHand && armed && !believed) return { deadly: false, rule: 'force:unseen' };
  if (inHand && R.guns.includes(threat!.armament)) return { deadly: true, rule: 'force:gun' };
  if (inHand && armed) {
    if (person.doorFt !== undefined && person.doorFt <= R.reachFt) return { deadly: true, rule: 'force:reach', near: null };
    const near = peopleNear(scenario, run, person, R.reachFt)[0];
    if (near) return { deadly: true, rule: 'force:reach', near };
    return { deadly: false, rule: 'force:out_of_reach' };
  }
  if (inHand && threat!.armament === 'unknown') return { deadly: false, rule: 'force:unclear' };
  return { deadly: false, rule: 'force:empty' };
}
