// exit-via-reachable: a window way out counts (TreeState.exitVia 'window') only when the walk to it is
// clear of furniture from where the person starts, the same check the walk-out itself makes. Before,
// the fact held on the window alone, and a building whose furniture blocked the walk refused the
// whole call ("Walk out blocked") instead of dropping the choice. The earlier R-B2 sweep checked
// routes after a call compiled, so it never saw the buildings this refused. On the group fixture,
// moved into a house: the courier starts in a bedroom, and one choice walks them out of its window.
import { describe, expect, it } from 'vitest';
import type { CallTree } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { buildLocation } from '../../sim/location';
import { routeAlongOpenings } from '../../sim/routes';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { generateIncident } from './index';
import { compileIncident, drawInstance, hostedSpec } from './instance';
import { findStoryRoute, windowExit } from './story-bindings';
import { choiceActionId, exitKey, viaRouteName } from './trees-v13/compile';
import { GROUP_TEMPLATE, GROUP_TREE } from './trees-v13/group-fixture';

/** The families the barricade lists: houses and flats, where a bedroom may have a window out. */
const HOUSES = ['cedar_close', 'harbour_court', 'willow_terrace_v1', 'ash_grove_v1', 'juniper_court_v1', 'bungalow_g2', 'two_storey_house_g2', 'semi_detached_g2', 'apartment_unit_g2'];

function house(windowChoice = true): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  // Run as a barricade call, the type houses host; the cast and the choices are the fixture's own.
  tree.type = 'barricaded';
  tree.families = HOUSES;
  tree.scene = { setting: ['residential', 'apartment'], rooms: ['living', 'kitchen'], crowd: 1 };
  tree.roles.find(role => role.id === 'courier')!.place = { rooms: ['bedroom'] };
  if (windowChoice) {
    const talk = tree.nodes.find(node => node.id === 'talk')!;
    const hold = talk.choices.find(choice => choice.id === 'hold')!;
    talk.choices.push({ ...structuredClone(hold), id: 'out_window', title: 'Bring the courier out the window', summary: 'You talk the courier out through the bedroom window.',
      walks: 'courier', walksVia: 'window', onlyIf: { exitVia: { role: 'courier', via: 'window' } } });
  }
  return { ...GROUP_TEMPLATE, type: 'barricaded', tree };
}

interface Hosted { s: ScenarioDefinition; built: ReturnType<typeof buildLocation>; window: number }
/** `t` on `family`, building `building`, at the first call seed that hosts it (or the compile error). */
function host(t: IncidentTemplate, family: string, building: number): Hosted | string {
  let error = 'no call seed';
  for (let seed = 1; seed < 12; seed++) {
    let base;
    try { base = generateIncident({ type: 'barricaded', familyId: family, buildingSeed: building, seed, tier: 2, contentVersion: 13 }); } catch { continue; }
    const { clocks: _c, incidentPeople: _p, threats: _t, ...frame } = base;
    const spec = hostedSpec(frame), built = buildLocation(frame.locationFamilyId, frame.locationSeed);
    try {
      const s = compileIncident({ ...frame, id: `exit-via-${family}-${building}-${seed}`, incident: spec }, built, t);
      const window = drawInstance(t, built, spec).placed.exits?.courier?.window ? 1 : 0;
      return { s, built, window };
    } catch (e) { error = String(e); }
  }
  return error;
}
const walkOut = (s: ScenarioDefinition) => Object.values(s.stages).flatMap(stage => stage.actions).find(action => action.id === choiceActionId('barricaded', 'talk', 'out_window'));

describe('a window way out counts only when the walk to it is clear (exit-via-reachable)', () => {
  const rows = HOUSES.flatMap(family => Array.from({ length: 12 }, (_, i) => ({ family, building: i + 1, plain: host(house(false), family, i + 1), window: host(house(), family, i + 1) })));

  it('the window choice never refuses a building the call hosts without it', () => {
    const refused = rows.filter(row => typeof row.plain !== 'string' && typeof row.window === 'string').map(row => `${row.family} ${row.building}: ${row.window}`);
    expect(refused).toEqual([]);
  });

  it('every family that hosts the call without the window choice hosts it with the choice in its tree', () => {
    // two_storey_house_g2 and semi_detached_g2 have their bedrooms upstairs, and a role's room is on
    // the ground floor unless its place says otherwise, so this fixture never hosts there, with or
    // without the choice.
    const hosts = (key: 'plain' | 'window') => new Set(rows.filter(row => typeof row[key] !== 'string').map(row => row.family));
    expect([...hosts('window')].sort()).toEqual([...hosts('plain')].sort());
    expect(HOUSES.filter(family => !hosts('window').has(family)), 'families that never host the fixture').toEqual(['two_storey_house_g2', 'semi_detached_g2']);
    expect(rows.some(row => typeof row.window !== 'string' && walkOut(row.window.s)), 'somewhere the window is clear').toBe(true);
  });

  it('where furniture blocks the walk to an open window, the fact is false and the choice is pruned (the regression)', () => {
    const blocked = rows.flatMap(row => {
      if (typeof row.window === 'string') return [];
      const { s, built } = row.window;
      const room = s.story!.bindings.people.courier.initial.spaceId;
      const exit = windowExit(built, room);
      const route = exit ? findStoryRoute(built, room, built.location.entries[0], 'walking', exit.id) : null;
      // A ground-floor window with a route through it, yet the courier can't make the walk.
      return route && !row.window.window ? [row] : [];
    });
    expect(blocked.length, 'buildings where a window exists but the walk to it is blocked').toBeGreaterThan(0);
    for (const row of blocked) {
      const { s } = row.window as Hosted;
      expect(walkOut(s), `${row.family} ${row.building}`).toBeUndefined();
      expect(s.story!.bindings.routes[viaRouteName('courier', 'window')], `${row.family} ${row.building}`).toBeUndefined();
    }
  });

  it('wherever the choice is offered, its walk is clear from where the courier starts', () => {
    for (const row of rows) {
      if (typeof row.window === 'string' || !walkOut(row.window.s)) continue;
      const { s, built } = row.window;
      const route = s.story!.bindings.routes[walkOut(s)!.storyRoute!];
      const courier = s.story!.bindings.people.courier;
      const out = courier.transitions.at(-1)!.to as { at: { x: number; y: number } };
      expect(row.window.window).toBe(1);
      expect(routeAlongOpenings(built, courier.initial.at, out.at, route.openingIds, null, false, 1).reachable, `${row.family} ${row.building}`).toBe(true);
    }
    expect(exitKey('courier', 'window')).toBe('courier:via:window');
  });
});
