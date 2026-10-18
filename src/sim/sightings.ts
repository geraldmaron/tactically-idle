// What a squad learns from being there. A choice that takes the team into a room, or to a vantage
// it reads by sight, lists the rooms it sees into (ActionDefinition.observes); when it goes well
// and the team isn't driven back, everyone still inside those rooms is seen. Seeing someone settles
// where they are and, unless they keep it out of sight, what they're holding. It never settles
// their temper: that comes from talking to them or from what they do, as the call writes it.
//
// Written against the incident's people (scenario.incidentPeople) and the run's knowledge, so the
// call's authored facts stay the only source of truth: a sighting only settles a fact the person
// points at, to that fact's own truth.
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { OperationRun, OutcomeBand } from './types';
import { lastSeenRoom, sightingFlags, storyPeopleActual } from './story-people';
import { lostFlag } from './conditions';

/** The knowledge a committed decision's sightings add, as one effect, or null when the team saw
 * nobody new. `effects` are the decision's matched outcome effects: a band that sends the team
 * back means it never got the look. Read before the decision's own effects apply, so a person the
 * outcome walks out was still in the room when the team saw them. */
export function sightings(scenario: ScenarioDefinition, run: Pick<OperationRun, 'flags' | 'knowledge' | 'pressure'>, action: ActionDefinition, band: OutcomeBand, effects: readonly OutcomeEffect[]): OutcomeEffect | null {
  const rooms = action.observes ?? [];
  if (band !== 'favorable' || !rooms.length || effects.some(effect => effect.fallBack)) return null;
  const facts = new Map(scenario.facts.map(fact => [fact.id, fact]));
  const knowledge: NonNullable<OutcomeEffect['knowledge']> = [];
  const settle = (factId: string | undefined) => {
    const fact = factId ? facts.get(factId) : undefined;
    if (!fact) return;
    const current = run.knowledge[fact.id] ?? fact.initial;
    if (current === 'confirmed' || current === 'disproved') return;
    knowledge.push({ factId: fact.id, status: fact.truth ? 'confirmed' : 'disproved' });
  };
  // Where each person really is now: a move (R-B3) may have taken them from where they started.
  const actual = new Map(storyPeopleActual(scenario, run).map(person => [person.id, person.position]));
  const setFlags: string[] = [];
  for (const person of scenario.incidentPeople ?? []) {
    const now = actual.get(person.id);
    const spaceId = now && !('kind' in now) ? now.spaceId : person.spaceId;
    if (run.flags.includes(`out:${person.id}`) || run.flags.includes(`safe:${person.id}`)) continue;
    // Looking where the team last saw them, and they aren't there now: the trail is lost (R-B3).
    const last = lastSeenRoom(scenario, run, person.id);
    if (last && last !== spaceId && rooms.includes(last) && !run.flags.includes(lostFlag(person.id))) setFlags.push(lostFlag(person.id));
    if (!rooms.includes(spaceId)) continue;
    settle(person.locationFactId);
    // Seen where a hidden move took them: the team knows the new spot (story-people sightingFlags).
    setFlags.push(...sightingFlags(scenario, run, person.id));
    if (person.threat?.readiness !== 'concealed') settle(person.armamentFactId);
  }
  return knowledge.length || setFlags.length ? { ...(knowledge.length ? { knowledge } : {}), ...(setFlags.length ? { setFlags } : {}) } : null;
}
