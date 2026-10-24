// Team moves (TreeTeam, content/call-trees/types.ts): a choice's physical intent compiles into a
// real approach on the generated building, and where the squad ends is where the narration put it.
// The building also settles a sightline fact, and the call's drawn conditions are the engine's.
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../../../content/call-trees';
import { actionViews } from '../../../sim/operation-selectors';
import { getScenario } from '../../../sim/scenario-registry';
import { buildLocation } from '../../../sim/location';
import { sightFromStreet, vantageZones } from '../../../sim/sightlines';
import type { ActionDefinition, ScenarioDefinition } from '../../../sim/scenario-types';
import type { GameState } from '../../../sim/types';
import { applyMove, NOW, startGateRun } from '../gates/engine-driver';
import { instanceOf } from '../instance';
import { drawCalls } from './balance';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { ARMED_TEMPLATE } from './armed-fixture';
import { RESCUE_TEMPLATE } from './rescue-fixture';
import { fixtureCalls } from './house-call-fixture';
import { choiceActionId, doorOut, TEAM_MOVES } from './compile';

// The retired armed and rescue calls live on as frozen engine fixtures; the hostage call ships.
const FIXTURES: Partial<Record<string, IncidentTemplate>> = { active_armed_incident: ARMED_TEMPLATE, protected_rescue: RESCUE_TEMPLATE };
const calls = (type: keyof typeof CALL_TREES, n = 6) => {
  const fixture = FIXTURES[type];
  return fixture ? fixtureCalls(fixture, n, 7919 * 1 + 2, type, 2) : drawCalls(CALL_TREES[type]!, 2, n).map(({ scenarioId }) => getScenario(scenarioId)!);
};
const treeOf = (type: keyof typeof CALL_TREES) => FIXTURES[type]?.tree ?? CALL_TREES[type]!;
const actionOf = (s: ScenarioDefinition, node: string, choice: string): ActionDefinition =>
  Object.values(s.stages).flatMap(stage => stage.actions).find(action => action.id === choiceActionId(s.incident!.type, node, choice))!;
const positionOf = (state: GameState) => state.activeRun!.squadTasks.find(task => task.squadId === 'A')!.positionId;
const commit = (state: GameState, actionId: string, band: 'favorable' | 'mixed' | 'adverse') => {
  const after = applyMove(state, { kind: 'decide', actionId, band }, actionViews(state, NOW, 'A'));
  expect(after, `${actionId} ${band}`).not.toBeNull();
  return after!;
};

describe('team moves', () => {
  it('compiles an entry into a route to the room it names, with the entry exposure and the room to clear', () => {
    for (const s of calls('active_armed_incident')) {
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      const placed = instanceOf(s, built, FIXTURES[s.incident!.type])!.placed;
      const go = actionOf(s, 'shots', 'go_now');
      expect(go.approach).toBe('path');
      expect(go.targetId).toBe(placed.roomOf.shooter);
      expect(go.entry).toEqual({ subjectFactId: 'p_shooter' });
      expect(go.workload.perSqFt).toBe(TEAM_MOVES.clearPerSqFt);
      // The team that is driven back from the doorway ends where it started.
      expect(go.outcomes.adverse.some(effect => effect.fallBack)).toBe(true);
      expect(go.outcomes.favorable.some(effect => effect.fallBack)).toBe(false);
      // A phone call stays where the squad stands.
      expect(actionOf(s, 'shots', 'ask_door').approach).toBe('none');
    }
  });

  it('leaves the squad where the narration puts it: inside after an entry, outside after falling back', () => {
    for (const s of calls('active_armed_incident', 3)) {
      const start = startGateRun(s.id);
      const outside = positionOf(start);
      const id = choiceActionId(s.incident!.type, 'shots', 'go_now');
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      expect(positionOf(commit(start, id, 'favorable'))).toBe(instanceOf(s, built, FIXTURES[s.incident!.type])!.placed.roomOf.shooter);
      expect(positionOf(commit(start, id, 'adverse'))).toBe(outside);
    }
  });

  it('sees into the room it enters, and a room it watches by sight, never through a wall by voice', () => {
    const all = ([...Object.keys(CALL_TREES), ...Object.keys(FIXTURES)] as (keyof typeof CALL_TREES)[]).flatMap(type => calls(type, 3));
    let entries = 0, watched = 0;
    for (const s of all) {
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      const placed = instanceOf(s, built, FIXTURES[s.incident!.type])!.placed;
      const tree = treeOf(s.incident!.type as keyof typeof CALL_TREES);
      for (const node of tree.nodes) for (const choice of node.choices) {
        const action = Object.values(s.stages).flatMap(stage => stage.actions).find(entry => entry.id === choiceActionId(tree.type, node.id, choice.id));
        if (!action) continue;
        const to = choice.team?.to;
        const where = `${action.id}`;
        // Going up to a subject's door is entering the room it stands in (the landing), by voice or not.
        if (to === 'scene' || (typeof to === 'object' && ('room' in to || 'doorOf' in to))) {
          entries++;
          expect(action.observes, where).toEqual([action.targetId]);
        } else if (typeof to === 'object' && 'vantage' in to && choice.team?.signal?.channel === 'visual') {
          watched++;
          expect(action.observes, where).toEqual([to.vantage === 'scene' ? placed.room.id : placed.roomOf[to.vantage]]);
        } else expect(action.observes, where).toEqual([]);
      }
    }
    expect(entries).toBeGreaterThan(0);
    expect(watched).toBeGreaterThan(0);
  });

  it('confirms where the subject is, and the weapon patrol reported, when an entry goes well', () => {
    for (const s of calls('active_armed_incident', 3)) {
      const start = startGateRun(s.id);
      const go = choiceActionId(s.incident!.type, 'shots', 'go_now');
      expect(start.activeRun!.knowledge.p_shooter ?? 'reported').toBe('reported');
      const seen = commit(start, go, 'favorable').activeRun!;
      expect(seen.knowledge.p_shooter).toBe('confirmed');
      expect(seen.knowledge.f_shots).toBe('confirmed');
      expect(seen.history.at(-1)!.knowledgeChanges).toContainEqual({ factId: 'p_shooter', status: 'confirmed' });
      // Driven back from the doorway, the team saw no one; a call through the door sees no one either.
      expect(commit(start, go, 'adverse').activeRun!.knowledge.p_shooter ?? 'reported').toBe('reported');
      const announce = choiceActionId(s.incident!.type, 'shots', 'announce');
      expect(commit(start, announce, 'favorable').activeRun!.knowledge.p_shooter ?? 'reported').toBe('reported');
    }
  });

  it('walks someone out alone with the squad staying put, and an escort ends outside with them', () => {
    for (const s of calls('hostage_crisis', 3)) {
      // The manager walks out alone: no team move, a route of their own.
      // Going Live cut manager_first; walk_dark sends the manager out alone the same way.
      const alone = actionOf(s, 'way_out', 'walk_dark');
      expect(alone.approach).toBe('none');
      expect(alone.storyRoute).toBeTruthy();
      // The clerk's escort: the squad goes in for them and ends outside with them.
      const placed = instanceOf(s, buildLocation(s.locationFamilyId, s.locationSeed))!.placed;
      const escort = actionOf(s, 'going_live', 'clerk_out');
      expect(escort.approach).toBe('path');
      expect(escort.endsAt).toEqual({ spaceId: placed.outside, at: placed.anchors.clerk.outside });
    }
    for (const s of calls('protected_rescue', 3)) {
      const placed = instanceOf(s, buildLocation(s.locationFamilyId, s.locationSeed), FIXTURES[s.incident!.type])!.placed;
      const carry = actionOf(s, 'at_the_door', 'carry');
      expect(carry.approach).toBe('path');
      expect(carry.endsAt).toEqual({ spaceId: placed.outside, at: placed.anchors.resident.outside });
      // Two officers go to the door and in: the squad is inside with the resident.
      const start = startGateRun(s.id);
      expect(positionOf(commit(start, actionOf(s, 'wont_leave', 'go_get').id, 'favorable'))).toBe(placed.room.id);
    }
  });

  it('watches an inside room from the door its way out uses, and a room with a window through it', () => {
    let checked = 0;
    for (const s of calls('active_armed_incident')) {
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      const shout = actionOf(s, 'through_door', 'talk_through');
      if (!shout) continue;
      checked++;
      expect(shout.approach).toBe('window');
      expect(vantageZones(built.location, shout.targetId).length).toBeGreaterThan(0);
      expect(shout.spatial).toMatchObject({ channel: 'sound', subjectFactId: 'p_shooter', weight: TEAM_MOVES.signalWeight.voice });
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('the building and the conditions', () => {
  it('settles the rescue sightline from the shooter’s window, on each building', () => {
    const seen: boolean[][] = [[], [], []];
    for (const s of calls('protected_rescue', 24)) {
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      const instance = instanceOf(s, built, FIXTURES[s.incident!.type])!;
      const fact = s.facts.find(entry => entry.id === 'f_sees_door')!;
      const door = doorOut(built, instance.placed.routes[instance.placed.routeName('resident')].openingIds)!;
      expect(fact.truth).toBe(sightFromStreet(built, instance.placed.outside, instance.placed.vantages!.shooter, door.id).clear);
      seen[instance.situation].push(fact.truth);
    }
    // The window down the street mostly misses the door; the one straight across mostly sees it.
    const share = (list: boolean[]) => list.filter(Boolean).length / Math.max(1, list.length);
    expect(share(seen[0])).toBeLessThan(0.5);
    expect(share([...seen[1], ...seen[2]])).toBeGreaterThan(0.5);
  });

  it('runs the engine in the call’s drawn conditions', () => {
    for (const s of calls('protected_rescue', 2)) expect(s.environment).toMatchObject({ timeOfDay: 'dusk', power: 'off', weather: 'clear', crowd: 0 });
    for (const s of calls('active_armed_incident', 2)) expect(s.environment).toMatchObject({ timeOfDay: 'night', power: 'on' });
  });
});
