import type { ActionDefinition, ScenarioDefinition, StoryAnchor } from './scenario-types';
import type { BuiltLocation, GameState, Id, OfficerCasualtyRecord, OperationRun, Vec } from './types';
import { storyPeoplePublic } from './story-people';
import { centroidOf, routeBetween, type Route } from './spatial-factors';
import { pointInPolygon } from './location';

export interface CarePosition { spaceId: string; at?: StoryAnchor['at'] }
export interface PhysicalCare {
  action: ActionDefinition;
  fieldTarget?: CarePosition;
  escort?: { start: StoryAnchor; target: CarePosition };
  crewRoutes: Route[];
  issue?: string;
}

/** One physical journey may visit the same lock twice, but opens it once. */
export function joinCareRoutes(routes: Route[]): Route {
  const forced = [...new Map(routes.flatMap(route => route.forced).map(door => [door.openingId, door])).values()];
  const forceMinutes = Math.round(forced.reduce((sum, door) => sum + door.minutes, 0) * 10) / 10;
  return { reachable: routes.every(route => route.reachable),
    minutes: Math.round((routes.reduce((sum, route) => sum + route.minutes - route.forceMinutes, 0) + forceMinutes) * 10) / 10,
    forceMinutes, forced, points: routes.flatMap((route, index) => index ? route.points.slice(1) : route.points),
    lastOpeningId: routes.at(-1)?.lastOpeningId ?? null };
}

/** The same public triage order is used to plan and commit officer field care. */
export function officerNeedingFieldCare(run: Pick<OperationRun, 'officerCasualties'>): OfficerCasualtyRecord | undefined {
  return Object.values(run.officerCasualties ?? {}).filter(person => person.care === 'needed')
    .sort((a, b) => Number(b.severity === 'serious') - Number(a.severity === 'serious') || a.at - b.at || a.officerId.localeCompare(b.officerId))[0];
}

/** New injuries freeze their actual position. Old records may establish a room,
 * but never gain an invented exact position or follow their now-moving squad. */
export function officerCarePosition(run: OperationRun, scenario: ScenarioDefinition, person: OfficerCasualtyRecord, state?: GameState): CarePosition | null {
  if (person.position) return person.position;
  const injuryIndex = run.history.findIndex(decision => decision.committed?.officerCasualties?.some(event => event.officerId === person.officerId && event.care === 'needed'));
  const decision = run.history[injuryIndex];
  const action = decision && scenario.stages[decision.stage]?.actions.find(action => action.id === decision.actionId);
  if (!decision || !action) return null;
  if (decision.targetId && action.approach === 'path') return { spaceId: decision.targetId };
  const squadId = state?.squads.find(squad => squad.officerIds.includes(person.officerId))?.id
    ?? (decision.actingSquadIds.length === 1 ? decision.actingSquadIds[0] : undefined);
  if (!squadId || !decision.actingSquadIds.includes(squadId)) return null;
  if (action.approach === 'none') for (let index = injuryIndex - 1; index >= 0; index--) {
    const prior = run.history[index], definition = scenario.stages[prior.stage]?.actions.find(action => action.id === prior.actionId);
    if (!definition) return null;
    if (prior.supportSquadIds.includes(squadId) && definition.support) return { spaceId: definition.support.coverSpaceId };
    if (!prior.actingSquadIds.includes(squadId) || definition.approach === 'none') continue;
    if (definition.approach === 'path' && prior.targetId) return { spaceId: prior.targetId };
    // A window action does not record which exterior vantage was actually used.
    break;
  }
  const unchanged = run.history.slice(injuryIndex + 1).every(later => {
    if (later.supportSquadIds.includes(squadId)) return false;
    if (!later.actingSquadIds.includes(squadId)) return true;
    const definition = scenario.stages[later.stage]?.actions.find(action => action.id === later.actionId);
    return definition?.commandOnly && definition.approach === 'none';
  });
  const task = unchanged ? run.squadTasks.find(task => task.squadId === squadId) : undefined;
  return task ? { spaceId: task.positionId } : null;
}

/** Only public locations and committed injury records participate. This is a
 * transient evaluation rule, leaving issued scenarios and prior decisions intact. */
export function physicalCare(scenario: ScenarioDefinition, built: BuiltLocation, run: OperationRun, authored: ActionDefinition, state?: GameState): PhysicalCare {
  const result: PhysicalCare = { action: authored, crewRoutes: [] };
  if (scenario.version < 7) return result;
  const effects = Object.values(authored.outcomes).flat();
  const officerAid = effects.some(effect => effect.officerCare === 'stabilize');
  const officerEvacuation = effects.some(effect => effect.officerCare === 'evacuate');
  const fieldCare = officerAid || authored.personCare?.kind === 'stabilize'
    || authored.check.kind === 'medical' && !!authored.requires.certs?.includes('advanced_first_aid') && !!authored.consumes?.some(use => use.tag === 'medkit' && use.qty > 0);
  const medicalAcceptance = effects.some(effect => effect.acceptSupport?.some(id => scenario.externalServices?.some(service => service.id === id && service.kind === 'medical')));
  if (!fieldCare && !medicalAcceptance) return result;
  const people = storyPeoplePublic(scenario, built, run);
  const targetId = authored.personCare?.personId ?? authored.storyTargetPersonId;
  const publicPosition = (id: string): CarePosition | null => {
    const person = people.find(person => person.id === id);
    return person?.position && !('kind' in person.position) ? person.position : null;
  };
  const unknown = () => { result.issue = 'Account for the patient’s current location before providing physical care'; return result; };
  if (fieldCare) {
    const officer = officerAid ? officerNeedingFieldCare(run) : undefined;
    // No matching injury is handled by the existing casualty gate.
    if (officerAid && !officer) return result;
    const position = officer ? officerCarePosition(run, scenario, officer, state) : targetId ? publicPosition(targetId) : null;
    if (!position) return unknown();
    result.fieldTarget = position;
    result.action = { ...authored, targetId: officerAid ? position.spaceId : authored.targetId, approach: 'path',
      storyTargetPersonId: officerAid ? undefined : targetId,
      // Treatment follows the current patient; an old authored route cannot move them.
      storyRoute: undefined, storyRouteActor: undefined };
    return result;
  }

  const patients: CarePosition[] = [];
  if (officerEvacuation) for (const person of Object.values(run.officerCasualties ?? {}).filter(person => person.care !== 'evacuated')) {
    const position = officerCarePosition(run, scenario, person, state);
    if (!position) return unknown();
    patients.push(position);
  }
  const civilianIds = targetId ? [targetId] : (scenario.civilianOutcomes ?? []).filter(person => effects.some(effect => effect.setFlags?.includes(person.careFlag))).map(person => person.id);
  for (const id of civilianIds) {
    const position = publicPosition(id);
    if (!position) return unknown();
    patients.push(position);
  }
  if (!patients.length) return result;
  const routeStart = authored.storyRoute && scenario.story?.bindings.routes[authored.storyRoute]?.fromSpaceId;
  const exterior = (id: string | undefined) => !!id && built.location.zones.some(zone => zone.id === id);
  const startId = exterior(routeStart || undefined) ? routeStart! : exterior(authored.targetId) ? authored.targetId
    : exterior(run.supportPositionId) ? run.supportPositionId! : built.location.entries[0];
  if (!startId) return unknown();
  const start: StoryAnchor = { spaceId: startId, at: meetingPoint(built, startId) };
  if (!authored.commandOnly && authored.approach === 'path' && patients.length === 1) {
    // An authored escort is actual squad work: meet the crew, then accompany it.
    // Its healthy officers may open doors with their own carried access equipment.
    result.escort = { start, target: patients[0] };
    result.action = { ...authored, targetId: targetId ? authored.targetId : patients[0].spaceId, approach: 'path',
      ...(targetId ? { storyTargetPersonId: targetId } : {}), storyRoute: undefined, storyRouteActor: undefined };
    return result;
  }
  let previous: CarePosition = start;
  const destinations = patients.filter((position, index) => patients.findIndex(other => other.spaceId === position.spaceId && other.at?.x === position.at?.x && other.at?.y === position.at?.y) === index);
  // Evacuation includes the trip back to the crew's exterior receiving point.
  if (officerEvacuation) destinations.push(start);
  for (const destination of destinations) {
    const route = routeBetween(built, previous.spaceId, previous.at ?? centroidOf(built, previous.spaceId), destination.spaceId, destination.at ?? centroidOf(built, destination.spaceId), null);
    if (!route.reachable || route.forced.length) {
      result.issue = 'The medical crew needs an open, usable route to the patient and receiving point';
      return result;
    }
    result.crewRoutes.push(route);
    previous = destination;
  }
  // The actual crew makes this journey. The selected command squad stays where it is.
  result.action = { ...authored, approach: 'none', storyRoute: undefined, storyRouteActor: undefined };
  return result;
}

/** Where the squad meets a crew in an exterior zone: its centroid. On furnished layouts a
 * wrapped zone (a front lot around a parking bay) can have its centroid outside the zone,
 * which no squad can walk to; use the zone's first staging point there instead. Other
 * layouts keep the centroid, so their timings are unchanged. */
function meetingPoint(built: BuiltLocation, zoneId: Id): Vec {
  const centre = centroidOf(built, zoneId);
  const zone = built.location.zones.find(candidate => candidate.id === zoneId);
  if (!built.location.id.endsWith('__furnished_v7') || !zone || pointInPolygon(centre, zone.polygon)) return centre;
  const staging = built.derived.stagingPoints.filter(point => point.spaceId === zoneId).sort((a, b) => a.id.localeCompare(b.id))[0];
  return staging?.at ?? centre;
}
