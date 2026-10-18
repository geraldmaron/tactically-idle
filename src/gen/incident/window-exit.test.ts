// R-B2: a person can leave by their own ground-floor window where the building has one
// (TreeChoice.walksVia 'window', gated by TreeState.exitVia, settled when the call compiles). The
// route keeps that exit when the engine recomputes it, so a blocked window refuses the walk-out
// instead of sending them out the door. The barricade's child, placed in a bedroom.
import { describe, expect, it } from 'vitest';
import type { CallTree } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import { buildLocation } from '../../sim/location';
import { validateScenario } from '../../sim/operation';
import { routeAlongOpenings, windowClimbMinutes } from '../../sim/routes';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { currentStoryRoute, findStoryRoute, windowExit } from './story-bindings';
import { generateIncident } from './index';
import { compileIncident, hostedSpec } from './instance';
import { choiceActionId, countHolds, exitKey, treeForCounts, viaRouteName } from './trees-v13/compile';
import { startGateRun, withDraftScenario } from './gates/engine-driver';
import { actionViews } from '../../sim/operation-selectors';
import { NOW } from '../../sim/test-fixtures';

const BARRICADE = INCIDENT_TEMPLATES.barricaded!;
type Via = 'window' | 'front' | 'back';

/** The barricade with its child in a bedroom by `floor`, and under_barking walking them out by `via`. */
function variant(opts: { floor?: 'ground' | 'upper'; via?: Via; gate?: boolean } = {}): IncidentTemplate {
  const { floor = 'ground', via = 'window', gate = true } = opts;
  const tree: CallTree = structuredClone(BARRICADE.tree);
  tree.roles.find(role => role.id === 'child')!.place = { rooms: ['bedroom'], floor };
  const choice = tree.nodes.flatMap(node => node.choices).find(entry => entry.id === 'under_barking')!;
  choice.walksVia = via;
  if (gate) choice.onlyIf = { ...choice.onlyIf, exitVia: { role: 'child', via } };
  return { ...BARRICADE, tree };
}

/** The first seed that hosts `template` on `family`, compiled (`rethrow`: the compile error). */
function call(template: IncidentTemplate, family: string, rethrow = false): { s: ScenarioDefinition; built: ReturnType<typeof buildLocation> } | null {
  for (let seed = 1; seed < 40; seed++) {
    let base;
    try { base = generateIncident({ type: 'barricaded', familyId: family, buildingSeed: 1, seed, tier: 2, contentVersion: 13 }); } catch { continue; }
    const { clocks: _c, incidentPeople: _p, threats: _t, ...frame } = base;
    const spec = hostedSpec(frame), built = buildLocation(frame.locationFamilyId, frame.locationSeed);
    try { return { s: compileIncident({ ...frame, id: `window-${family}-${seed}`, incident: spec }, built, template), built }; } catch (error) { if (rethrow) throw error; continue; }
  }
  return null;
}
const walkOut = (s: ScenarioDefinition) => Object.values(s.stages).flatMap(stage => stage.actions).find(action => action.id.endsWith('_under_barking'));

describe('out through their own window (R-B2)', () => {
  const flat = call(variant(), 'bungalow_g2')!;

  it('on a single-floor building the walk-out leaves by the bedroom’s own window, and the call validates', () => {
    expect(flat, 'a bungalow hosts it').not.toBeNull();
    const action = walkOut(flat.s)!;
    expect(action, 'the walk-out is offered').toBeDefined();
    expect(action.storyRoute).toBe(viaRouteName('child', 'window'));
    const route = flat.s.story!.bindings.routes[action.storyRoute!];
    const room = flat.s.story!.bindings.people.child.initial.spaceId;
    const exit = windowExit(flat.built, room)!;
    expect(route).toMatchObject({ fromSpaceId: room, exitOpeningId: exit.id });
    expect(route.openingIds[0]).toBe(exit.id);
    expect(currentStoryRoute(flat.s, flat.built, action.storyRoute!)).toEqual(route.openingIds);
    expect(validateScenario(flat.s, flat.built)).toEqual([]);
  });

  it('climbing out takes longer than a doorway, and longer through a narrower window', () => {
    const exit = windowExit(flat.built, flat.s.story!.bindings.people.child.initial.spaceId)!;
    expect(windowClimbMinutes(exit)).toBeGreaterThan(0);
    expect(windowClimbMinutes({ ...exit, to: { x: exit.from.x + 2, y: exit.from.y } })).toBeGreaterThan(windowClimbMinutes({ ...exit, to: { x: exit.from.x + 4, y: exit.from.y } }));
    const door = flat.built.location.openings.find(opening => opening.type === 'door')!;
    expect(windowClimbMinutes(door)).toBe(0);
  });

  it('a blocked window refuses the walk-out; it never sends them out the door instead', () => {
    const action = walkOut(flat.s)!;
    const route = flat.s.story!.bindings.routes[action.storyRoute!];
    const blocked = structuredClone(flat.built);
    blocked.location.openings.find(opening => opening.id === route.exitOpeningId)!.state = 'blocked';
    expect(currentStoryRoute(flat.s, blocked, action.storyRoute!)).toBeNull();
    expect(findStoryRoute(blocked, route.fromSpaceId, route.toSpaceId, 'walking')).not.toBeNull();
    expect(routeAlongOpenings(blocked, { x: 0, y: 0 }, { x: 0, y: 0 }, route.openingIds, null).reachable).toBe(false);
  });

  it('in play the engine offers it on the window route, and once the window is blocked shows it locked, saying why', () => {
    withDraftScenario(flat.s, id => {
      const state = startGateRun(id);
      state.activeRun!.flags = [...state.activeRun!.flags, 'tree:started', 'at:quiet_dog'];
      state.activeRun!.stage = flat.s.stages.adapt.actions.some(action => action.id === walkOut(flat.s)!.id) ? 'adapt' : 'resolve';
      const view = () => actionViews(state, NOW, 'A').find(entry => entry.id === walkOut(flat.s)!.id)!;
      expect(view(), 'offered at quiet_dog').toBeDefined();
      expect(view().eligible, view().reason ?? '').toBe(true);
      const exit = flat.s.story!.bindings.routes[walkOut(flat.s)!.storyRoute!].exitOpeningId!;
      state.activeRun!.flags = [...state.activeRun!.flags, `opening:${exit}=blocked`];
      expect(view().eligible).toBe(false);
      // Refused through the engine's locked-choice path, with a plain reason the player sees.
      expect(view().reason).toBe('The window on this way out is blocked');
    });
  });

  it('once out of the window they stay out: the rest of the way never re-enters the building', () => {
    // Reproduced by the adversarial review: semi_detached_g2 seed 1, the wc window, with the side-yard
    // link blocked, went back in through the back door and out the front.
    const built = buildLocation('semi_detached_g2', 1);
    const zones = new Set(built.location.zones.map(zone => zone.id));
    const room = built.location.rooms.find(entry => windowExit(built, entry.id))!;
    const exit = windowExit(built, room.id)!;
    const outdoors = (route: string[] | null) => route === null || route.slice(route.indexOf(exit.id) + 1).every(id => {
      const opening = built.location.openings.find(entry => entry.id === id)!;
      return zones.has(opening.a) && zones.has(opening.b);
    });
    expect(outdoors(findStoryRoute(built, room.id, built.location.entries[0], 'walking', exit.id))).toBe(true);
    for (const link of built.location.openings.filter(opening => zones.has(opening.a) && zones.has(opening.b))) {
      const cut = structuredClone(built);
      cut.location.openings.find(opening => opening.id === link.id)!.state = 'blocked';
      expect(outdoors(findStoryRoute(cut, room.id, cut.location.entries[0], 'walking', exit.id)), `with ${link.id} blocked`).toBe(true);
    }
  });

  it('a latched window opens from inside: no force, and a squad’s tool changes nothing', () => {
    const route = flat.s.story!.bindings.routes[walkOut(flat.s)!.storyRoute!];
    const time = (state: 'closed' | 'locked', tool: { effectiveness: number } | null) => {
      const built = structuredClone(flat.built);
      built.location.openings.find(opening => opening.id === route.exitOpeningId)!.state = state;
      const from = flat.s.story!.bindings.people.child.initial.at, to = flat.s.story!.bindings.people.child.transitions[0]?.to;
      return routeAlongOpenings(built, from, to && !('kind' in to) ? to.at : from, route.openingIds, tool);
    };
    const closed = time('closed', null), locked = time('locked', null), tooled = time('locked', { effectiveness: 1 });
    expect(locked.reachable).toBe(true);
    expect(locked.forced).toEqual([]);
    expect(locked.minutes).toBe(closed.minutes);
    expect(tooled.minutes).toBe(closed.minutes);
  });

  it('a window is never a way through for any other route', () => {
    const exit = windowExit(flat.built, flat.s.story!.bindings.people.child.initial.spaceId)!;
    for (const [name, route] of Object.entries(flat.s.story!.bindings.routes)) if (!route.exitOpeningId)
      expect(route.openingIds, name).not.toContain(exit.id);
  });

  it('upstairs, where there is no ground-floor window, the walk-out isn’t offered', () => {
    const upper = call(variant({ floor: 'upper' }), 'two_storey_house_g2')!;
    expect(upper, 'a two-floor building hosts it').not.toBeNull();
    expect(walkOut(upper.s)).toBeUndefined();
  });

  it('the gate settles like count, and its fact is known in every compiled call', () => {
    const tree = variant().tree;
    const kept = (counts: Record<string, number>) => treeForCounts(tree, counts).nodes.flatMap(node => node.choices).some(choice => choice.id === 'under_barking');
    expect(kept({ [exitKey('child', 'window')]: 1 })).toBe(true);
    expect(kept({ [exitKey('child', 'window')]: 0 })).toBe(false);
    expect(countHolds({ exitVia: { role: 'child', via: 'window' } }, {})).toBe(true);
    expect(choiceActionId(tree.type, 'quiet_dog', 'under_barking')).toBe(walkOut(flat.s)!.id);
  });

  it('rejects a walk-out by window with no gate, a front or back way (until rescue builds it), and a gate on someone outside', () => {
    expect(() => call(variant({ gate: false }), 'bungalow_g2', true)).toThrow(/must carry onlyIf: \{ exitVia/);
    expect(() => call(variant({ via: 'back' }), 'bungalow_g2', true)).toThrow(/waits for rescue's R-R5/);
    const outside = variant();
    outside.tree.nodes.find(node => node.id === outside.tree.root)!.promptIf = [{ when: { exitVia: { role: 'ex', via: 'window' } }, prompt: 'x' }, ...outside.tree.nodes.find(node => node.id === outside.tree.root)!.promptIf ?? []];
    expect(() => call(outside, 'bungalow_g2', true)).toThrow(/starts outside the building/);
    // A front or back condition anywhere (a prompt here), not only on a walk-out, waits for R-R5.
    const back = variant();
    back.tree.nodes.find(node => node.id === back.tree.root)!.promptIf = [{ when: { exitVia: { role: 'child', via: 'back' } }, prompt: 'x' }, ...back.tree.nodes.find(node => node.id === back.tree.root)!.promptIf ?? []];
    expect(() => call(back, 'bungalow_g2', true)).toThrow(/by the back, which waits for rescue's R-R5/);
  });
});
