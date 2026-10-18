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
import { choiceActionId, doorOut, TEAM_MOVES } from './compile';

const calls = (type: keyof typeof CALL_TREES, n = 6) => drawCalls(CALL_TREES[type]!, 2, n).map(({ scenarioId }) => getScenario(scenarioId)!);
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
      const placed = instanceOf(s, built)!.placed;
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
      expect(positionOf(commit(start, id, 'favorable'))).toBe(instanceOf(s, built)!.placed.roomOf.shooter);
      expect(positionOf(commit(start, id, 'adverse'))).toBe(outside);
    }
  });

  it('walks someone out alone with the squad staying put, and an escort ends outside with them', () => {
    for (const s of calls('hostage_crisis', 3)) {
      const take = actionOf(s, 'offer', 'take_courier');
      expect(take.approach).toBe('none');
      expect(take.storyRoute).toBeTruthy();
      const start = startGateRun(s.id);
      expect(positionOf(commit(start, take.id, 'favorable'))).toBe(positionOf(start));
    }
    for (const s of calls('protected_rescue', 3)) {
      const placed = instanceOf(s, buildLocation(s.locationFamilyId, s.locationSeed))!.placed;
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
      const instance = instanceOf(s, built)!;
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
