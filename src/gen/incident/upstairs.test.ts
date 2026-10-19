// R-B1: a person can start upstairs where the building has an upper floor, and text says so only
// where it's true (TreeState.upstairs / notUpstairs, settled when the call compiles). Exercised on
// the engine's house call (a frozen barricade, trees-v13/house-fixture.ts) with its child placed by
// floor, on two-floor and single-floor families.
import { describe, expect, it } from 'vitest';
import type { CallTree } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import { buildLocation } from '../../sim/location';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { generateIncident } from './index';
import { specForSituation } from './gates/catalog';
import { compileIncident, drawInstance, hostedSpec } from './instance';
import { callCounts, countHolds, exitKey, treeForCounts, upstairsKey } from './trees-v13/compile';
import { HOUSE_TEMPLATE } from './trees-v13/house-fixture';

// The engine's frozen house call (trees-v13/house-fixture.ts), not the shipping barricade.
const BARRICADE = HOUSE_TEMPLATE;
const UP = 'The child is upstairs, above the living room.', DOWN = 'The child is on the ground floor.';

/** The barricade with its child placed by `floor`, and a prompt variant for each answer. */
function variant(floor: 'ground' | 'upper' | 'any'): IncidentTemplate {
  const tree: CallTree = structuredClone(BARRICADE.tree);
  tree.roles.find(role => role.id === 'child')!.place = { rooms: ['bathroom', 'bedroom'], floor };
  const root = tree.nodes.find(node => node.id === tree.root)!;
  root.promptIf = [{ when: { upstairs: ['child'] }, prompt: UP }, { when: { notUpstairs: ['child'] }, prompt: DOWN }, ...root.promptIf ?? []];
  return { ...BARRICADE, tree };
}

/** The first seed that hosts `template` on `family`, compiled, with the building. */
function call(template: IncidentTemplate, family: string, rethrow = false): { s: ScenarioDefinition; built: ReturnType<typeof buildLocation> } | null {
  for (let seed = 1; seed < 40; seed++) {
    let base;
    try { base = generateIncident({ type: 'barricaded', familyId: family, buildingSeed: 1, seed, tier: 2, contentVersion: 13 }, HOUSE_TEMPLATE); } catch { continue; }
    const { clocks: _c, incidentPeople: _p, threats: _t, ...frame } = base;
    const spec = hostedSpec(frame), built = buildLocation(frame.locationFamilyId, frame.locationSeed);
    if (built.location.rooms.every(room => room.floor === 0) !== (family !== 'two_storey_house_g2')) continue;
    try { return { s: compileIncident({ ...frame, id: `upstairs-${family}-${seed}`, incident: spec }, built, template), built }; } catch (error) { if (rethrow) throw error; continue; }
  }
  return null;
}
const roomOfChild = (s: ScenarioDefinition) => s.story!.bindings.people.child.initial.spaceId;
const prompts = (s: ScenarioDefinition) => JSON.stringify(s.stages);

describe('a person can start upstairs (R-B1)', () => {
  it('upper: placed above the ground floor, and the route out walks the stairs', () => {
    const found = call(variant('upper'), 'two_storey_house_g2')!;
    expect(found, 'a two-floor building hosts it').not.toBeNull();
    const room = found.built.location.rooms.find(entry => entry.id === roomOfChild(found.s))!;
    expect(room.floor).toBeGreaterThan(0);
    const route = Object.values(found.s.story!.bindings.routes).find(entry => entry.fromSpaceId === room.id)!;
    expect(route.openingIds.some(id => found.built.location.openings.find(opening => opening.id === id)?.type === 'stair')).toBe(true);
    expect(prompts(found.s)).toContain(UP);
    expect(prompts(found.s)).not.toContain(DOWN);
  });

  it('upper: a building with no upper floor can’t host the call', () => {
    expect(call(variant('upper'), 'bungalow_g2')).toBeNull();
  });

  it('ground (the default) never goes upstairs, and the text follows', () => {
    const found = call(variant('ground'), 'two_storey_house_g2')!;
    expect(found, 'a two-floor building with a ground-floor bathroom or bedroom hosts it').not.toBeNull();
    expect(found.built.location.rooms.find(entry => entry.id === roomOfChild(found.s))!.floor).toBe(0);
    expect(prompts(found.s)).toContain(DOWN);
    expect(prompts(found.s)).not.toContain(UP);
    const flat = call(variant('ground'), 'bungalow_g2')!;
    expect(prompts(flat.s)).toContain(DOWN);
  });

  it('any: upstairs only where the building puts the room there, and the text follows the building', () => {
    const flat = call(variant('any'), 'bungalow_g2')!;
    expect(prompts(flat.s)).toContain(DOWN);
    expect(prompts(flat.s)).not.toContain(UP);
  });

  it('the conditions settle like count: strip once known, drop what fails, keep what nothing knows', () => {
    const tree = variant('any').tree;
    const root = (t: CallTree) => t.nodes.find(node => node.id === t.root)!.promptIf!.map(entry => entry.prompt);
    expect(root(treeForCounts(tree, { [upstairsKey('child')]: 1 }))).toContain(UP);
    expect(root(treeForCounts(tree, { [upstairsKey('child')]: 1 }))).not.toContain(DOWN);
    expect(countHolds({ upstairs: ['child'] }, {})).toBe(true);
    expect(() => treeForCounts({ ...tree, nodes: tree.nodes.map((node, i) => i ? node : { ...node, promptIf: [{ when: { upstairs: ['nobody'] }, prompt: 'x' }] }) }, {})).toThrow(/not a role or group/);
  });

  it('rejects a floor condition on a group led from outside the building, even with no members', () => {
    for (const key of ['upstairs', 'notUpstairs'] as const) {
      const t = structuredClone(variant('ground'));
      const ex = t.tree.roles.find(role => role.kind === 'bystander')!;
      const slot = t.cast.find(entry => entry.keyRoles.includes(ex.id))!;
      t.tree.groups = { ...t.tree.groups, crowd: { slot: slot.id, leader: ex.id, label: 'neighbor' } };
      t.tree.nodes.find(node => node.id === t.tree.root)!.promptIf!.unshift({ when: { [key]: ['crowd'] }, prompt: 'x' });
      expect(() => call(t, 'bungalow_g2', true)).toThrow(/starts outside the building/);
    }
  });

  it('rejects a floor condition on a role who starts outside the building', () => {
    const outside = variant('ground');
    const ex = outside.tree.roles.find(role => role.place === 'outside' || role.kind === 'bystander')!;
    expect(ex, 'the barricade has someone outside with patrol').toBeDefined();
    for (const key of ['upstairs', 'notUpstairs'] as const) {
      const t = structuredClone(outside);
      t.tree.nodes.find(node => node.id === t.tree.root)!.promptIf!.unshift({ when: { [key]: [ex.id] }, prompt: 'x' });
      expect(() => call(t, 'bungalow_g2', true)).toThrow(/starts outside the building/);
    }
  });
});

describe('a compiled call in play always knows its compile-time facts', () => {
  // The missing-key-holds default is for the lab and the string sweeps only: every call the game
  // compiles must carry each group's armed count, each placed role's and group's floor, and each
  // placed role's window way out.
  for (const template of Object.values(INCIDENT_TEMPLATES)) if (template)
    it(`${template.type}: every family it lists, every situation`, () => {
      let checked = 0;
      const situations = new Set<number>();
      for (const family of template.tree.families) for (const variant of [0, 1, 2] as const) {
        let s: ScenarioDefinition;
        try { s = generateIncident(specForSituation(template.type, family, variant)); } catch { continue; }
        situations.add(variant);
        const placed = drawInstance(template, buildLocation(s.locationFamilyId, s.locationSeed), hostedSpec(s)).placed;
        const facts = callCounts(placed);
        for (const [group, def] of Object.entries(template.tree.groups ?? {})) {
          expect(facts[`${group}:armed`], `${s.id} ${group}:armed`).toBeTypeOf('number');
          // A group led from inside has a floor; one led from outside has none, and compile rejects a floor condition on it.
          if (placed.roomOf[def.leader] !== undefined && placed.roomOf[def.leader] !== placed.outside)
            expect(facts[upstairsKey(group)], `${s.id} ${group}:upstairs`).toBeTypeOf('number');
        }
        for (const role of template.tree.roles) if (placed.roomOf[role.id] !== undefined && placed.roomOf[role.id] !== placed.outside) {
          expect(facts[upstairsKey(role.id)], `${s.id} ${role.id}:upstairs`).toBeTypeOf('number');
          expect(facts[exitKey(role.id, 'window')], `${s.id} ${role.id}:via:window`).toBeTypeOf('number');
        }
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
      expect([...situations].sort(), 'every situation').toEqual(template.situations.map(entry => entry.index).sort());
    }, 60000);
});
