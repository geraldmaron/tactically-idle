// barricade-engine-fixes: the rule for a team move to a place on someone's way out (R-B3), with or
// without `entry`. `{ doorOf: role }` and `{ route, step }` are places the squad goes to and stands
// in, so it sees that place: the hall outside the room, not the room past the door. `entry` names
// who the squad moves in on there (the person at the door), never a room to go into. Going into the
// room is `{ room: role }`. On the group fixture: the squad goes to the taker's door, moving in on
// the taker.
import { describe, expect, it } from 'vitest';
import type { CallTree } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { buildLocation } from '../../sim/location';
import { validateScenario } from '../../sim/operation';
import { generateIncident } from './index';
import { compileIncident, drawInstance, hostedSpec } from './instance';
import { choiceActionId } from './trees-v13/compile';
import { GROUP_TEMPLATE, GROUP_TREE } from './trees-v13/group-fixture';

function template(entry: boolean): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  const end = tree.nodes.find(node => node.id === 'final')!.choices.find(choice => choice.id === 'end_talk')!;
  end.team = { to: { doorOf: 'taker' }, ...entry ? { entry: 'taker' } : {} };
  return { ...GROUP_TEMPLATE, tree };
}

describe('a team move to the door of a room (barricade-engine-fixes)', () => {
  const base = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 11, tier: 2, contentVersion: 13 });
  const built = buildLocation(base.locationFamilyId, base.locationSeed);
  const spec = hostedSpec(base);
  const room = drawInstance(GROUP_TEMPLATE, built, spec).placed.roomOf.taker;

  it.each([true, false])('goes to the space past the door and sees it, never the room (entry: %s)', entry => {
    const s = compileIncident({ ...base, id: `team-door-${entry}`, incident: spec }, built, template(entry));
    expect(validateScenario(s, built)).toEqual([]);
    const action = Object.values(s.stages).flatMap(stage => stage.actions).find(entry => entry.id === choiceActionId('hostage_crisis', 'final', 'end_talk'))!;
    expect(action.approach).toBe('path');
    expect(action.targetId).not.toBe(room);
    expect(built.location.openings.some(opening => (opening.a === room && opening.b === action.targetId) || (opening.b === room && opening.a === action.targetId))).toBe(true);
    expect(action.observes).toEqual([action.targetId]);
  });
});
