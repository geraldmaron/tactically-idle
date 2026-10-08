// What the people in a v13 incident do to the odds (docs/incident-domain-model.md, M2). The
// incident instance compiles its people into `scenario.incidentPeople`; this module turns them into
// contributors on the check, using the threat rules in threat.ts (armament and readiness, temper,
// awareness, what waiting does) and the building (cover between an armed person and the door).
//
// The odds use what the team knows: a weapon counts as reported once patrol reports it and as an
// unknown risk before; a temper counts only once a fact reveals it. Hidden truth still decides
// which authored result happens. Identity (names, pronouns) never enters.
//
// The incident class (§1, M2 slice 5) weights time and temper: see INCIDENT_CLASS_V1.
import type { ActionDefinition, IncidentPersonDef, ScenarioDefinition } from './scenario-types';
import type { BuiltLocation, Contributor, Id, Officer, OperationRun } from './types';
import { relevantSubjects, threatFx, type Subject } from './threat';
import { SPATIAL_TUNING } from './spatial-factors';
import { meterContributors } from './meters';

export interface IncidentFx { difficulty: Contributor[]; add: number; score: Contributor[]; details: string[] }

const known = (status: string | undefined) => status === 'confirmed' || status === 'disproved';
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Incident class weights (docs/incident-domain-model.md §1, M2 slice 5). Versioned fictional
 * balance. The class is derived from who is still held, never labelled: anyone held over the
 * subject's grievance (an expressive hold) makes it a victim incident; anyone held only as leverage
 * or because they were there (instrumental, incidental) a hostage incident. In the first, time is no
 * reliable ally and the subject's temper is the danger:
 * - `waiting`: score points every holding or waiting choice gets, as one labelled contributor
 *   ("Waiting while Dana Price is the one Lee Park blames"). Hostage incidents keep what the threat
 *   rules give waiting (threat.ts) unchanged.
 * - `agitation`: scale on the "is more worked up now" contributor a conversation with the holder
 *   carries (sim/meters.ts), when the team's provocations have raised it. Its label says why. */
export type IncidentClassKey = 'hostage' | 'victim';
export const INCIDENT_CLASS_V1 = {
  hostage: { waiting: 0, agitation: 1 },
  victim: { waiting: -3, agitation: 1.5 },
} satisfies Record<IncidentClassKey, { waiting: number; agitation: number }>;

/** The class the people still held make, and who makes it so: the person held over a grievance
 * (else the first held) and the person holding them. Null when nobody is held inside. */
export function incidentClass(scenario: ScenarioDefinition, run: Pick<OperationRun, 'flags'>): { key: IncidentClassKey; held: IncidentPersonDef; holder?: IncidentPersonDef } | null {
  const people = scenario.incidentPeople ?? [];
  const inside = (person: IncidentPersonDef) => !run.flags.includes(`out:${person.id}`) && !run.flags.includes(`safe:${person.id}`);
  const held = people.filter(person => person.hold && inside(person));
  const victim = held.find(person => person.hold?.kind === 'expressive');
  const first = victim ?? held[0];
  if (!first) return null;
  const holder = people.find(person => person.id === first.hold?.by && inside(person));
  return { key: victim ? 'victim' : 'hostage', held: first, ...(holder ? { holder } : {}) };
}

/** The subjects the team is facing now: anyone with a threat profile who is not out with the team. */
export function incidentSubjects(scenario: ScenarioDefinition, run: Pick<OperationRun, 'flags' | 'knowledge'>): Subject[] {
  return (scenario.incidentPeople ?? []).filter(person => person.threat && !run.flags.includes(`out:${person.id}`)).map(person => {
    const threat = person.threat!;
    const arm = person.armamentFactId ? run.knowledge[person.armamentFactId] : 'confirmed';
    const armSource = arm === 'confirmed' ? 'confirmed' as const : arm === 'reported' ? 'reported' as const : 'assumed' as const;
    const temper = person.dispositionFactId ? known(run.knowledge[person.dispositionFactId]) : false;
    return {
      personId: person.id, label: person.label, role: person.kind === 'animal' ? 'dangerous_dog' : 'subject', spaceId: person.spaceId, at: person.at,
      armament: armSource === 'assumed' ? 'unknown' : threat.armament, readiness: threat.readiness, armSource,
      ...(temper ? { disposition: threat.disposition } : {}), intent: threat.intent, awareness: threat.awareness,
      demSource: temper ? 'confirmed' : 'reported',
    } satisfies Subject;
  });
}

/** Rooms a choice puts the team in or next to: its target, and for a walk-out every room on the route. */
function rooms(scenario: ScenarioDefinition, built: BuiltLocation, action: ActionDefinition): Id[] {
  const route = action.storyRoute ? scenario.story?.bindings.routes[action.storyRoute] : undefined;
  if (!route) return [action.targetId];
  const byId = new Map(built.location.openings.map(opening => [opening.id, opening]));
  return [...new Set([route.fromSpaceId, ...route.openingIds.flatMap(id => { const o = byId.get(id); return o ? [o.a, o.b] : []; })])];
}

export function incidentFactors(scenario: ScenarioDefinition, built: BuiltLocation, run: OperationRun, action: ActionDefinition, participants: Officer[]): IncidentFx | null {
  if (scenario.version < 13 || !scenario.incidentPeople?.length) return null;
  const all = incidentSubjects(scenario, run);
  if (!all.length) return null;
  // One building, one incident: every subject inside bears on everything the team does, weighted
  // by the kind of work (threat.ts). The rooms a choice puts the team in decide who is closest:
  // those come first, so the nearest subject takes the full seat.
  const near = new Set(rooms(scenario, built, action).flatMap(id => relevantSubjects(all, built, id)).map(subject => subject.personId));
  const relevant = [...all].sort((a, b) => Number(near.has(b.personId)) - Number(near.has(a.personId)));
  // Holding and waiting choices are what the threat rules call waiting: intent decides whether time helps.
  const waiting = action.tempo === 'waiting' || action.icon === 'wait';
  const fx = threatFx('belief', relevant, all, waiting ? { ...action, tempo: 'waiting' } : action, participants);
  const difficulty = [...fx.difficulty];
  let add = fx.difficultyAdd;
  const details = [...fx.details];
  // The incident class: waiting with someone held over a grievance gives less (INCIDENT_CLASS_V1).
  const held = incidentClass(scenario, run);
  const weights = held ? INCIDENT_CLASS_V1[held.key] : INCIDENT_CLASS_V1.hostage;
  if (held && waiting && weights.waiting !== 0) {
    add -= weights.waiting;
    difficulty.push({ label: held.holder ? `Waiting while ${held.held.label} is the one ${held.holder.label} blames` : `Waiting while ${held.held.label} is held`,
      value: weights.waiting, source: 'pressure', ref: `class:${held.key}:${held.held.id}` });
  }
  // An entry meets anyone armed behind solid furniture: the team can't close cleanly.
  if (action.check.kind === 'execution' || action.entry) {
    for (const subject of relevant) {
      const person = scenario.incidentPeople.find(entry => entry.id === subject.personId);
      if (!person?.cover || subject.armament === 'none') continue;
      const value = person.cover.grade === 'hard' ? SPATIAL_TUNING.coverHard : SPATIAL_TUNING.coverConcealment;
      add += value;
      difficulty.push({ label: `${person.label} has the ${person.cover.label} ${person.cover.grade === 'hard' ? 'for cover' : 'to hide behind'}`, value: -value, source: 'difficulty', ref: person.cover.objectId });
      details.push(`${person.label} is behind the ${person.cover.label}, between them and the door the team comes through.`);
    }
  }
  // A conversation (talking, holding on the line) meets what the team has done to the subject so
  // far: the one it talks to, or every subject still inside (sim/meters.ts).
  const score = [...fx.score];
  if (action.check.kind === 'contact') {
    const inside = scenario.incidentPeople.filter(person => person.meters && all.some(subject => subject.personId === person.id));
    const faced = action.talksTo ? inside.filter(person => person.id === action.talksTo) : inside;
    for (const person of faced) for (const found of meterContributors(person, run.meters?.[person.id])) {
      // Provoking the person who holds someone over a grievance costs more (INCIDENT_CLASS_V1).
      const scaled = held?.holder?.id === person.id && weights.agitation !== 1 && found.ref === `meters:${person.id}:agitation` && found.value < 0;
      const contributor = scaled ? { ...found, value: round1(found.value * weights.agitation), label: `${found.label}, and blames ${held!.held.label}` } : found;
      if (contributor.value < 0) { add -= contributor.value; difficulty.push(contributor); } else score.push(contributor);
    }
  }
  return { difficulty, add: Math.round(add * 10) / 10, score, details };
}
