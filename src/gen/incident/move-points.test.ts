// barricade-engine-fixes: a person's moves are one person over time. Before, every move took a
// fresh point and kept it as someone standing there, so a call that moves one person into the same
// room from many outcomes filled a small bedroom with that person's own earlier places and threw
// ("no room to stand in bedroom_e for subject's move", ash_grove_v1 seed 66, the new barricade). On
// the group fixture with the courier moved to the taker's room by every outcome of every choice.
import { describe, expect, it } from 'vitest';
import type { CallTree } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { buildLocation } from '../../sim/location';
import { validateScenario } from '../../sim/operation';
import { generateIncident } from './index';
import { compileIncident, hostedSpec } from './instance';
import type { StoryAnchor } from '../../sim/scenario-types';
import { GROUP_TEMPLATE, GROUP_TREE } from './trees-v13/group-fixture';

function template(): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  for (const node of tree.nodes) for (const choice of node.choices) for (const band of ['favorable', 'mixed', 'adverse'] as const)
    for (const outcome of choice.outcomes[band]) outcome.moveTo = { courier: { room: 'taker' } };
  return { ...GROUP_TEMPLATE, tree };
}

describe('a person moved to one place by many outcomes (barricade-engine-fixes)', () => {
  const base = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 11, tier: 2, contentVersion: 13 });
  const built = buildLocation(base.locationFamilyId, base.locationSeed);
  const s = compileIncident({ ...base, id: 'move-points', incident: hostedSpec(base) }, built, template());

  it('compiles and validates', () => {
    expect(validateScenario(s, built)).toEqual([]);
  });

  it('stands at one point there, whichever outcome moved them', () => {
    const moves = s.story!.bindings.people.courier.transitions.filter(entry => entry.when.flags?.some(flag => flag.startsWith('moved:')));
    expect(moves.length).toBeGreaterThan(3);
    expect(new Set(moves.map(entry => entry.to as StoryAnchor).map(to => `${to.spaceId}@${to.at.x},${to.at.y}`)).size).toBe(1);
  });

  it('still keeps clear of where everyone else stands', () => {
    const at = s.story!.bindings.people.courier.transitions.find(entry => entry.when.flags?.some(flag => flag.startsWith('moved:')))!.to as StoryAnchor;
    for (const [id, person] of Object.entries(s.story!.bindings.people)) if (id !== 'courier' && person.initial.spaceId === at.spaceId)
      expect(Math.hypot(person.initial.at.x - at.at.x, person.initial.at.y - at.at.y), id).toBeGreaterThanOrEqual(1.5);
  });
});
