import type { ActionDefinition, ScenarioDefinition, StoryAnchor } from './scenario-types';
import type { BuiltLocation, OperationRun, Vec } from './types';
import { conditionHolds } from './resolution';
import { storyPeoplePublic } from './story-people';
import { centroidOf } from './spatial-factors';

export interface PublicMovementLeg {
  personId?: string;
  label: string;
  from: Vec;
  to: Vec;
}

/** Planned physical legs use only the person's current public position and
 * observed destination transitions this action can actually commit. Looking at
 * all public possibilities does not inspect the sampled band or hidden truth.
 * Explicit inspections select a planned observed arrival without committing it. */
export function publicStoryMovementLegs(scenario: ScenarioDefinition, built: BuiltLocation,
  run: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure'>, action: ActionDefinition): PublicMovementLeg[] | null {
  if (scenario.version < 7 || !action.storyRoute) return null;
  const binding = scenario.story?.bindings.routes[action.storyRoute];
  if (!binding) return null;
  const people = storyPeoplePublic(scenario, built, run);
  if (action.storyRouteActor === 'external_support') {
    const target = people.find(person => person.id === action.storyTargetPersonId)?.position;
    return [{ label: 'Receiving crew', from: centroidOf(built, binding.fromSpaceId),
      to: target && !('kind' in target) && target.spaceId === binding.toSpaceId ? target.at : centroidOf(built, binding.toSpaceId) }];
  }
  if (action.storyRouteActor === 'squad') return null;
  const inspection = action.storyRouteActor === 'inspection' ? action.storyRouteInspection : undefined;
  if (action.storyRouteActor === 'inspection' && !inspection) return null;
  const possible = Object.values(action.outcomes).map(effects => {
    const flags = new Set(run.flags), set = new Set<string>(), cleared = new Set<string>();
    const knowledge = { ...run.knowledge };
    for (const effect of effects) {
      if (!conditionHolds(effect.when, run)) continue;
      for (const flag of effect.clearFlags ?? []) { flags.delete(flag); cleared.add(flag); }
      for (const flag of effect.setFlags ?? []) { flags.add(flag); set.add(flag); }
      for (const change of effect.knowledge ?? []) knowledge[change.factId] = change.status;
    }
    return { state: { ...run, flags: [...flags], knowledge }, set, cleared };
  });
  const legs: PublicMovementLeg[] = [];
  for (const person of people) {
    if (inspection && person.id !== inspection.personId) continue;
    if (!person.position || 'kind' in person.position || person.position.spaceId !== binding.fromSpaceId) continue;
    const definition = Object.values(scenario.story!.bindings.people).find(p => p.id === person.id)!;
    for (const transition of definition.transitions) {
      if (!transition.observed || 'kind' in transition.to || transition.to.spaceId !== binding.toSpaceId) continue;
      const destination: StoryAnchor = transition.to;
      const matches = inspection ? (transition.when.flags ?? []).includes(inspection.arrivalFlag)
        && possible.some(next => conditionHolds(transition.when, { ...next.state, flags: [...next.state.flags, inspection.arrivalFlag] }))
        : possible.some(next => conditionHolds(transition.when, next.state)
        && ((transition.when.flags ?? []).some(flag => next.set.has(flag))
          || (transition.when.notFlags ?? []).some(flag => next.cleared.has(flag))));
      if (!matches) continue;
      if (legs.some(leg => leg.personId === person.id && leg.to.x === destination.at.x && leg.to.y === destination.at.y)) continue;
      legs.push({ personId: person.id, label: person.label, from: person.position.at, to: destination.at });
    }
  }
  return legs.length ? legs : null;
}
