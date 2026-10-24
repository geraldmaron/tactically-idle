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
import { relevantSubjects, THREAT_TUNING, threatFx, type Subject } from './threat';
import { resolveSubject, SPATIAL_TUNING } from './spatial-factors';
import { meterContributors } from './meters';
import { tunable } from './tuning';

/** What the incident's people do to one choice: difficulty and score contributors, and two
 * multipliers from the threat rules (threat.ts): the strain the officers taking part carry
 * (armed subjects near the work), and the time the work takes (waiting out a barricade is slow). */
export interface IncidentFx { difficulty: Contributor[]; add: number; score: Contributor[]; details: string[]; strainMult: number; timeMult: number }

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
export const INCIDENT_CLASS_V1 = tunable('INCIDENT_CLASS_V1', {
  hostage: { waiting: 0, agitation: 1 },
  victim: { waiting: -3, agitation: 1.5 },
} satisfies Record<IncidentClassKey, { waiting: number; agitation: number }>);

/** What the team knows, and how close the work comes to it (intel-odds). Versioned fictional
 * balance:
 * - `apartShare`: with one subject, the share of their weapon's seat a choice that moves the team
 *   or walks someone out meets when none of its rooms is, or adjoins, the room the team believes the
 *   subject is in (barricade request R-B5). A choice that moves nobody (a phone, a voice from the
 *   cars) is never weighed by this.
 * - `knownPosition`: score points for an entry or a look into a room once the team has confirmed
 *   where someone believed armed in it is.
 * - `watched` and `watchedStrain`: what a look from outside costs when it is into a room with
 *   someone believed armed: difficulty points, and the strain multiplier on the officers doing it. */
export const INTEL_V1 = tunable('INTEL_V1', {
  apartShare: 0.5,
  knownPosition: 3,
  watched: 2,
  watchedStrain: 0.1,
});

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

/** The subjects the team is facing now: anyone with a threat profile who is not out with the team.
 * With the building, each stands where the team believes: their spot once their location is
 * confirmed, the reported room's point while it is only reported (spatial-factors resolveSubject). */
export function incidentSubjects(scenario: ScenarioDefinition, run: Pick<OperationRun, 'flags' | 'knowledge'>, built?: BuiltLocation): Subject[] {
  return (scenario.incidentPeople ?? []).filter(person => person.threat && !run.flags.includes(`out:${person.id}`)).map(person => {
    const threat = person.threat!;
    const arm = person.armamentFactId ? run.knowledge[person.armamentFactId] : 'confirmed';
    // A disproved claim that they hold anything means they hold nothing; a disproved report of one
    // weapon leaves what they hold unknown, unless they hold nothing at all: the team that has seen
    // them empty-handed knows it, and learning the truth never makes the work harder than the report did.
    const none = arm === 'disproved' && (person.armamentClaim === 'any' || threat.armament === 'none');
    const armSource = arm === 'confirmed' || none ? 'confirmed' as const : arm === 'reported' ? 'reported' as const : 'assumed' as const;
    const temper = person.dispositionFactId ? known(run.knowledge[person.dispositionFactId]) : false;
    // Moved (scenarioWithPeopleNow, R-B3): already where the team believes they are now.
    const start = scenario.story?.bindings.people[person.id]?.initial;
    const moved = !!start && (start.spaceId !== person.spaceId || start.at.x !== person.at.x || start.at.y !== person.at.y);
    const at = built && person.locationFactId && !moved ? resolveSubject(scenario, built, run.knowledge, person.spaceId, person.locationFactId).at : person.at;
    return {
      personId: person.id, label: person.label, role: person.kind === 'animal' ? 'dangerous_dog' : 'subject', spaceId: person.spaceId, at: { ...at },
      armament: none ? 'none' : armSource === 'assumed' ? 'unknown' : threat.armament, readiness: threat.readiness, armSource,
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

/** `scenario` has its people where the team believes they are now (story-people
 * scenarioWithPeopleNow, applied by the caller, R-B3): the odds read belief. */
export function incidentFactors(scenario: ScenarioDefinition, built: BuiltLocation, run: OperationRun, action: ActionDefinition, participants: Officer[]): IncidentFx | null {
  if (!scenario.incidentPeople?.length) return null;
  const all = incidentSubjects(scenario, run, built);
  if (!all.length) return null;
  // One building, one incident: every subject inside bears on everything the team does, weighted
  // by the kind of work (threat.ts). The rooms a choice puts the team in decide who is closest:
  // those come first, so the nearest subject takes the full seat.
  const touched = rooms(scenario, built, action);
  const near = new Set(touched.flatMap(id => relevantSubjects(all, built, id)).map(subject => subject.personId));
  const relevant = [...all].sort((a, b) => Number(near.has(b.personId)) - Number(near.has(a.personId)));
  // A lone subject is always first, so how close a move comes to them is weighed apart (R-B5).
  const moves = action.approach !== 'none' || Boolean(action.storyRoute);
  const lone = all.length === 1 && moves ? all[0] : null;
  const reach = lone ? new Map([[lone.personId, touched.includes(lone.spaceId) ? { share: 1, note: 'in a room this work reaches' }
    : near.has(lone.personId) ? { share: 1, note: 'in the room next to this work' }
      : { share: INTEL_V1.apartShare, note: 'away from the rooms this work reaches' }]]) : undefined;
  // Holding and waiting choices are what the threat rules call waiting: intent decides whether time helps.
  const waiting = action.tempo === 'waiting' || action.icon === 'wait';
  const fx = threatFx('belief', relevant, all, waiting ? { ...action, tempo: 'waiting' } : action, participants, reach);
  const difficulty = [...fx.difficulty];
  let add = fx.difficultyAdd;
  const details = [...fx.details];
  let strainMult = fx.strainMult;
  // What the team has seen: an entry or a look into a room goes better once it knows where the
  // armed person in it is, and a look from outside into that room can be seen back.
  const armedIn = (spaceId: Id) => all.filter(subject => subject.spaceId === spaceId && subject.armament !== 'none' && subject.role === 'subject');
  const reaches = action.check.kind === 'execution' || Boolean(action.entry) || Boolean(action.observes?.length);
  const locationOf = (subject: Subject) => scenario.incidentPeople!.find(person => person.id === subject.personId)?.locationFactId;
  const faced = [...touched.flatMap(armedIn), ...all.filter(subject => subject.armament !== 'none' && subject.role === 'subject' && action.entry?.subjectFactId === locationOf(subject))];
  const located = reaches ? faced.find(subject => { const factId = locationOf(subject); return factId !== undefined && run.knowledge[factId] === 'confirmed'; }) : undefined;
  const score = [...fx.score];
  if (located) score.push({ label: `The team has seen where ${located.label} is`, value: INTEL_V1.knownPosition, source: 'preparation', ref: `intel:${located.personId}` });
  const watched = action.approach === 'window' ? (action.observes ?? []).flatMap(armedIn)[0] : undefined;
  if (watched) {
    add += INTEL_V1.watched;
    difficulty.push({ label: `${watched.label} may see the team watching`, value: -INTEL_V1.watched, source: 'difficulty', ref: `watched:${watched.personId}` });
    strainMult = Math.min(THREAT_TUNING.strainCap, strainMult * (1 + INTEL_V1.watchedStrain));
  }
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
  if (fx.timeMult !== 1) details.push(`Waiting out a barricade is slow: this takes about ${Math.round((fx.timeMult - 1) * 100)}% longer.`);
  return { difficulty, add: Math.round(add * 10) / 10, score, details, strainMult, timeMult: fx.timeMult };
}
