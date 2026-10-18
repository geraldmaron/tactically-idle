import type { ActionDefinition, ScenarioDefinition, StoryAnchor, StoryPersonBinding } from './scenario-types';
import type { BuiltLocation, Id, KnowledgeStatus, OperationRun } from './types';
import { conditionHolds, lostFlag, movedFlag, seenFlag } from './conditions';
import { approxPoint, spaceLabel } from './spatial-factors';


type StoryState = Pick<OperationRun, 'knowledge' | 'flags' | 'pressure'>;
export type StoryPosition = StoryAnchor | { kind: 'offscene'; label: string };
export interface StoryActualPerson {
  id: Id;
  label: string;
  locationFactId: Id;
  position: StoryPosition;
}
export interface StoryPublicPerson extends Omit<StoryActualPerson, 'position'> {
  status: KnowledgeStatus;
  position: StoryPosition | null;
  /** Only an observed transition can supply this public location description. */
  locationLabel?: string;
  /** The team looked where it last saw them and found the spot empty (R-B3, lostFlag): `position`
   * is where it last saw them. */
  stale?: true;
}

/** Public words for a person the team saw and who has since moved out of sight (R-B3). */
export const LAST_SEEN_LINES = {
  source: 'Last seen by the team',
  claim: (person: string, place: string) => `${person} was last seen in ${place}.`,
  marker: (person: string) => `${person.toUpperCase()}?`,
};

const SEEN_PREFIX = seenFlag('', 0).split(':')[0] + ':';
const MOVED_PREFIX = movedFlag('', 0).split(':')[0] + ':';
const isSeenTwin = (transition: StoryPersonBinding['transitions'][number]) => (transition.when.flags ?? []).some(flag => flag.startsWith(SEEN_PREFIX));

/** A compiled move is a hidden transition followed by its observed twin (the same place, where the
 * team last saw them: `seen:` flag). The index of the current move when the team hasn't seen them
 * there, and they haven't since left the building, or -1. */
function unseenMove(person: StoryPersonBinding, run: StoryState): number {
  // The engine keeps one current move per person (withFlag), so at most one move transition holds.
  return person.transitions.findIndex((transition, i) => !transition.observed && isSeenTwin(person.transitions[i + 1] ?? transition)
    && conditionHolds(transition.when, run) && !conditionHolds(person.transitions[i + 1].when, run)
    && !person.transitions.slice(i + 2).some(later => !isSeenTwin(later) && later.observed && conditionHolds(later.when, run)));
}

/** The flags a sighting sets to see a person where their latest unseen move took them, or none. */
export function sightingFlags(scenario: ScenarioDefinition, run: StoryState, personId: Id): string[] {
  const person = scenario.story?.bindings.people[personId];
  if (!person) return [];
  const i = unseenMove(person, run);
  return i < 0 ? [] : (person.transitions[i + 1].when.flags ?? []).filter(flag => flag.startsWith(SEEN_PREFIX));
}

function bindings(scenario: ScenarioDefinition): StoryPersonBinding[] {
  return Object.values(scenario.story?.bindings.people ?? {});
}

/** Ordered authored transitions read existing committed state; they add no mutable simulation. */
export function storyPeopleActual(scenario: ScenarioDefinition, run: StoryState): StoryActualPerson[] {
  return bindings(scenario).map(person => {
    let position: StoryPosition = person.initial;
    // Where the team last saw someone (a seen twin, R-B3) is belief, never where they are.
    for (const transition of person.transitions) if (!isSeenTwin(transition) && conditionHolds(transition.when, run)) position = transition.to;
    return { id: person.id, label: person.label, locationFactId: person.locationFactId, position };
  });
}

/** Whether this decision actually moved a bound person along its authored route. */
export function storyMovedAlongRoute(scenario: ScenarioDefinition, action: ActionDefinition, before: StoryState, after: StoryState): boolean {
  const route = action.storyRoute ? scenario.story?.bindings.routes[action.storyRoute] : null;
  if (!route) return false;
  const prior = storyPeopleActual(scenario, before);
  return storyPeopleActual(scenario, after).some(person => {
    const was = prior.find(entry => entry.id === person.id)?.position;
    return was && !('kind' in was) && was.spaceId === route.fromSpaceId
      && (('kind' in person.position) || (person.position.spaceId === route.toSpaceId && (was.spaceId !== person.position.spaceId || was.at.x !== person.position.at.x || was.at.y !== person.position.at.y)));
  });
}

/** Hidden transitions never participate, including when knowledge still confirms an earlier sighting. */
export function storyPeoplePublic(scenario: ScenarioDefinition, built: BuiltLocation, run: StoryState): StoryPublicPerson[] {
  return bindings(scenario).map(person => {
    const fact = scenario.facts.find(entry => entry.id === person.locationFactId);
    let status = run.knowledge[person.locationFactId] ?? fact?.initial ?? 'unknown';
    let position: StoryPosition | null = status === 'confirmed' ? person.initial
      : status === 'reported' ? person.reported ?? (fact ? { spaceId: fact.spaceId, at: approxPoint(built, fact) } : null)
      : null;
    let locationLabel: string | undefined;
    for (const transition of person.transitions) {
      if (!transition.observed || !conditionHolds(transition.when, run)) continue;
      position = transition.to;
      status = 'confirmed';
      locationLabel = transition.label;
    }
    // The team looked where it last saw them and found the spot empty: it holds only where it last saw
    // them. An unseen move alone changes nothing the team knows, so nothing here.
    const stale = status === 'confirmed' && run.flags.includes(lostFlag(person.id))
      && !person.transitions.some(transition => transition.when.flags?.some(flag => flag.startsWith('out:')) && conditionHolds(transition.when, run));
    if (stale) { status = 'reported'; locationLabel = undefined; }
    return { id: person.id, label: person.label, locationFactId: person.locationFactId, status, position, ...(locationLabel ? { locationLabel } : {}), ...(stale ? { stale: true as const } : {}) };
  });
}

export interface StoryPropPosition {
  id: Id;
  label: string;
  holderPersonId?: Id;
  position: StoryPosition | null;
  glyph?: import('./types').PublicCarriedItem['glyph'];
  status?: 'reported' | 'confirmed';
}

function storyProps(scenario: ScenarioDefinition, built: BuiltLocation, run: StoryState, people: (StoryActualPerson | StoryPublicPerson)[]): StoryPropPosition[] {
  if (!scenario.story) return [];
  return Object.values(scenario.story.bindings.props).map(prop => {
    if (prop.kind === 'mapped') {
      const object = built.location.objects.find(entry => entry.id === prop.objectId);
      return { id: prop.id, label: prop.label, position: object ? { spaceId: object.in, at: { x: object.x + object.w / 2, y: object.y + object.h / 2 } } : null };
    }
    let holderPersonId = prop.holderPersonId;
    for (const transition of prop.transitions ?? []) if (conditionHolds(transition.when, run)) holderPersonId = transition.holderPersonId;
    const holder = people.find(person => person.id === holderPersonId);
    return { id: prop.id, label: prop.label, ...(holderPersonId ? { holderPersonId } : {}), position: holder?.position ?? null };
  });
}

export function storyPropsActual(scenario: ScenarioDefinition, built: BuiltLocation, run: StoryState): StoryPropPosition[] {
  return storyProps(scenario, built, run, storyPeopleActual(scenario, run));
}

/** Carried props follow the holder's public position, never their hidden physical position. */
export function storyPropsPublic(scenario: ScenarioDefinition, built: BuiltLocation, run: StoryState): StoryPropPosition[] {
  // Issued v5/v6 action eligibility used this historical possession projection.
  // Keep that contract; new views use storyPropsKnown and v7 uses explicit evidence.

  return storyPropsKnown(scenario, built, run);
}

/** Strict public evidence for rendering, including already-issued stories. */
export function storyPropsKnown(scenario: ScenarioDefinition, built: BuiltLocation, run: StoryState): StoryPropPosition[] {
  const people = storyPeoplePublic(scenario, built, run);
  return Object.values(scenario.story?.bindings.props ?? {}).flatMap(raw => {
    const prop = raw.knownWhen !== undefined ? raw : null;
    if (!prop || !conditionHolds(prop.knownWhen, run)) return [];
    let status: 'reported' | 'confirmed' = prop.confirmedWhen && conditionHolds(prop.confirmedWhen, run) ? 'confirmed' : 'reported';
    if (prop.kind === 'mapped') {
      const object = built.location.objects.find(o => o.id === prop.objectId);
      return object ? [{ id: prop.id, label: prop.label, glyph: prop.glyph ?? 'item', status,
        position: { spaceId: object.in, at: { x: object.x + object.w / 2, y: object.y + object.h / 2 } } }] : [];
    }
    let holderPersonId = status === 'confirmed' ? prop.holderPersonId : prop.reportedHolderPersonId;
    for (const transition of prop.transitions ?? []) if (transition.observed && conditionHolds(transition.when, run)) { holderPersonId = transition.holderPersonId; status = 'confirmed'; }
    const position = people.find(person => person.id === holderPersonId)?.position ?? null;
    return position ? [{ id: prop.id, label: prop.label, glyph: prop.glyph ?? 'item', status, ...(holderPersonId ? { holderPersonId } : {}), position }] : [];
  });
}

/** A transient view of location facts shared by room inspection, map markers and spatial checks. */
export function storyPublicScenario(scenario: ScenarioDefinition, built: BuiltLocation, run: StoryState): { scenario: ScenarioDefinition; knowledge: Record<Id, KnowledgeStatus> } {
  const people = storyPeoplePublic(scenario, built, run);
  if (!people.length) return { scenario, knowledge: run.knowledge };
  const byFact = new Map(people.map(person => [person.locationFactId, person]));
  const byPerson = new Map(people.map(person => [person.id, person]));
  const knowledge = { ...run.knowledge };
  const facts = scenario.facts.flatMap(fact => {
    const person = byFact.get(fact.id);
    if (!person) {
      if (!fact.storyPersonId) return [fact];
      const subject = byPerson.get(fact.storyPersonId);
      if (!subject?.position || 'kind' in subject.position) return [];
      return [{ ...fact, spaceId: subject.position.spaceId, person: undefined }];
    }
    knowledge[fact.id] = person.status;
    if (!person.position) return [{ ...fact, person: undefined }];
    if ('kind' in person.position) return [];
    if (person.stale) {
      // Where the team last saw them, in its own words: no reporter is credited with the team's sighting.
      const place = spaceLabel(built, person.position.spaceId);
      const { markerSource: _source, ...rest } = fact;
      return [{ ...rest, spaceId: person.position.spaceId, person: { label: person.label, reportedAt: person.position.at },
        label: `${person.label}'s location`, claim: LAST_SEEN_LINES.claim(person.label, place), source: LAST_SEEN_LINES.source, note: null,
        markers: { ...fact.markers, reported: LAST_SEEN_LINES.marker(person.label) } }];
    }
    const moved = person.position.spaceId !== fact.spaceId || person.locationLabel !== undefined;
    const place = spaceLabel(built, person.position.spaceId);
    return [{
      ...fact,
      spaceId: person.position.spaceId,
      person: { label: person.label, ...(person.status === 'confirmed' ? { at: person.position.at } : { reportedAt: person.position.at }) },
      ...(moved && person.status === 'confirmed' ? {
        label: `${person.label}'s location`,
        claim: `${person.label} is in ${place}.`,
        source: 'Observed during this operation',
        note: person.locationLabel ?? `${person.label}'s current location has been observed.`,
        resolved: { ...fact.resolved, confirmed: person.locationLabel ?? `${person.label} is in ${place}.` },
        markers: { ...fact.markers, confirmed: person.label.toUpperCase() },
      } : {}),
    }];
  });
  return { scenario: { ...scenario, facts }, knowledge };
}

export function storyActionTarget(scenario: ScenarioDefinition, action: ActionDefinition, built: BuiltLocation, run: StoryState): StoryPublicPerson | null {
  if (!action.storyTargetPersonId) return null;
  return storyPeoplePublic(scenario, built, run).find(person => person.id === action.storyTargetPersonId && person.position && !('kind' in person.position)) ?? null;
}

/** Explicit space actions stay authored. Only opted-in person targets move with public knowledge. */
export function hydrateStoryAction(action: ActionDefinition, target: StoryPublicPerson, built: BuiltLocation): ActionDefinition {
  if (!target.position || 'kind' in target.position) return action;
  const targetId = target.position.spaceId;
  const moved = targetId !== action.targetId;
  const relocate = (ids: Id[]) => ids.map(id => id === action.targetId ? targetId : id);
  return {
    ...action,
    targetId,
    ...(action.approach === 'window' && built.location.zones.some(zone => zone.id === targetId) ? { approach: 'path' } : {}),
    ...(action.spatial ? { spatial: { ...action.spatial, subjectFactId: target.locationFactId, ...(moved ? { openingId: undefined } : {}) } } : {}),
    ...(action.entry ? { entry: { ...action.entry, subjectFactId: target.locationFactId } } : {}),
    ...(action.capacityBound ? { capacityBound: relocate(action.capacityBound) } : {}),
    // What the team looks into goes where it goes (R-B3): a look follows the person it follows.
    ...(action.observes ? { observes: relocate(action.observes) } : {}),
    ...(action.workload.areaSpaces ? { workload: { ...action.workload, areaSpaces: relocate(action.workload.areaSpaces) } } : {}),
  };
}

/** Whether a compiled move of this person holds (R-B3): a transition keyed on a move flag (an
 * outcome's or a clock cue's). Leaving the building is not a move. */
export function moveHolds(person: StoryPersonBinding, run: StoryState): boolean {
  return person.transitions.some(transition => (transition.when.flags ?? []).some(flag => flag.startsWith(MOVED_PREFIX)) && conditionHolds(transition.when, run));
}

/** The room the team last saw `personId` in, from what it has observed alone (no building needed):
 * where a seen move took them, else where it confirmed them at the start; null when it never saw them. */
export function lastSeenRoom(scenario: ScenarioDefinition, run: StoryState, personId: Id): Id | null {
  const person = scenario.story?.bindings.people[personId];
  if (!person) return null;
  const seen = [...person.transitions].reverse().find(transition => isSeenTwin(transition) && conditionHolds(transition.when, run));
  if (seen && !('kind' in seen.to)) return seen.to.spaceId;
  return run.knowledge[person.locationFactId] === 'confirmed' ? person.initial.spaceId : null;
}

/** The action as the team carries it out, for what it sees (R-B3): a choice that follows a person
 * goes where the team believes they are (hydrateStoryAction, as evaluateAction does), and its look
 * with it. The commit and both replays read sightings through this. While no move of that person
 * holds, the authored action already points there, and the building is never built. */
export function observingAction(scenario: ScenarioDefinition, built: BuiltLocation | (() => BuiltLocation), run: StoryState, action: ActionDefinition): ActionDefinition {
  const person = action.storyTargetPersonId ? scenario.story?.bindings.people[action.storyTargetPersonId] : undefined;
  if (!person || !moveHolds(person, run)) return action;
  const building = typeof built === 'function' ? built() : built;
  const target = storyActionTarget(scenario, action, building, run);
  return target ? hydrateStoryAction(action, target, building) : action;
}
