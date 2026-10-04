import type { ActionDefinition, ScenarioDefinition, StoryAnchor, StoryPersonBinding } from './scenario-types';
import type { BuiltLocation, Id, KnowledgeStatus, OperationRun } from './types';
import { conditionHolds, spaceName } from './resolution';
import { approxPoint } from './spatial-factors';

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
}

function bindings(scenario: ScenarioDefinition): StoryPersonBinding[] {
  return scenario.version >= 5 ? Object.values(scenario.story?.bindings.people ?? {}) : [];
}

/** Ordered authored transitions read existing committed state; they add no mutable simulation. */
export function storyPeopleActual(scenario: ScenarioDefinition, run: StoryState): StoryActualPerson[] {
  return bindings(scenario).map(person => {
    let position: StoryPosition = person.initial;
    for (const transition of person.transitions) if (conditionHolds(transition.when, run)) position = transition.to;
    return { id: person.id, label: person.label, locationFactId: person.locationFactId, position };
  });
}

/** Whether this decision actually moved a bound person along its authored route. */
export function storyMovedAlongRoute(scenario: ScenarioDefinition, action: ActionDefinition, before: StoryState, after: StoryState): boolean {
  const route = action.storyRoute && scenario.version >= 5 ? scenario.story?.bindings.routes[action.storyRoute] : null;
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
    return { id: person.id, label: person.label, locationFactId: person.locationFactId, status, position, ...(locationLabel ? { locationLabel } : {}) };
  });
}

export interface StoryPropPosition {
  id: Id;
  label: string;
  holderPersonId?: Id;
  position: StoryPosition | null;
}

function storyProps(scenario: ScenarioDefinition, built: BuiltLocation, run: StoryState, people: (StoryActualPerson | StoryPublicPerson)[]): StoryPropPosition[] {
  if (scenario.version < 5 || !scenario.story) return [];
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
  return storyProps(scenario, built, run, storyPeoplePublic(scenario, built, run));
}

/** A transient view of location facts shared by room inspection, map markers and spatial checks. */
export function storyPublicScenario(scenario: ScenarioDefinition, built: BuiltLocation, run: StoryState): { scenario: ScenarioDefinition; knowledge: Record<Id, KnowledgeStatus> } {
  const people = storyPeoplePublic(scenario, built, run);
  if (!people.length) return { scenario, knowledge: run.knowledge };
  const byFact = new Map(people.map(person => [person.locationFactId, person]));
  const knowledge = { ...run.knowledge };
  const facts = scenario.facts.flatMap(fact => {
    const person = byFact.get(fact.id);
    if (!person) return [fact];
    knowledge[fact.id] = person.status;
    if (!person.position) return [{ ...fact, person: undefined }];
    if ('kind' in person.position) return [];
    const moved = person.position.spaceId !== fact.spaceId || person.locationLabel !== undefined;
    const place = spaceName(built, person.position.spaceId);
    return [{
      ...fact,
      spaceId: person.position.spaceId,
      person: { label: person.label, ...(person.status === 'confirmed' ? { at: person.position.at } : { reportedAt: person.position.at }) },
      ...(moved && person.status === 'confirmed' ? {
        label: `${person.label}'s location`,
        claim: `${person.label} is in ${place}.`,
        note: person.locationLabel ?? `${person.label}'s current location has been observed.`,
        resolved: { ...fact.resolved, confirmed: person.locationLabel ?? `${person.label} is in ${place}.` },
        markers: { ...fact.markers, confirmed: person.label.toUpperCase() },
      } : {}),
    }];
  });
  return { scenario: { ...scenario, facts }, knowledge };
}

export function storyActionTarget(scenario: ScenarioDefinition, action: ActionDefinition, built: BuiltLocation, run: StoryState): StoryPublicPerson | null {
  if (scenario.version < 5 || !action.storyTargetPersonId) return null;
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
    ...(action.workload.areaSpaces ? { workload: { ...action.workload, areaSpaces: relocate(action.workload.areaSpaces) } } : {}),
  };
}
