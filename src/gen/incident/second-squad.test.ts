// R-B4: a second squad supports the acting one from a point the choice names (TreeChoice.support),
// compiled into the engine's SupportRule. The controls: the supporting squad goes to that point on
// the map, the card and the breakdown name its task, and every support choice also works with one
// squad. Exercised on the group fixture, so no shipping call is involved.
import { describe, expect, it } from 'vitest';
import type { CallTree, TreeChoice } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import { createInitialState } from '../../sim/department';
import { dispatch } from '../../sim/game';
import { buildLocation } from '../../sim/location';
import { previewAction } from '../../sim/operation-selectors';
import type { ActionDefinition, ScenarioDefinition } from '../../sim/scenario-types';
import { deserialize, serialize } from '../../sim/save';
import { reachableOverGround, stagingFacing } from '../../sim/spatial-factors';
import { NOW, startWithKit } from '../../sim/test-fixtures';
import type { GameState } from '../../sim/types';
import { withDraftScenario } from './gates/engine-driver';
import { generateIncident } from './index';
import { compileIncident, hostedSpec } from './instance';
import { findStoryRoute } from './story-bindings';
import { playToEnd } from './trees-v13/balance';
import { choiceActionId, doorOut, TEAM_MOVES } from './trees-v13/compile';
import { GROUP_TEMPLATE, GROUP_TREE } from './trees-v13/group-fixture';

type Support = NonNullable<TreeChoice['support']>;
const AT_GLASS: Support = { at: { vantage: 'taker' }, label: 'holding the counter window' };
const AT_EXIT: Support = { at: 'exit', label: 'covering the back step', max: 6 };

/** The group fixture with support on `talk.hold` and `talk.ask_out` (or the given edit). */
function template(edit: (tree: CallTree) => void = tree => {
  const talk = tree.nodes.find(node => node.id === 'talk')!;
  const hold = talk.choices.find(choice => choice.id === 'hold')!;
  // Hard enough that the odds aren't at their ceiling, so what support adds shows in them.
  hold.support = AT_GLASS;
  hold.check = { ...hold.check, difficulty: 30 };
  talk.choices.find(choice => choice.id === 'ask_out')!.support = AT_EXIT;
}): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  edit(tree);
  return { ...GROUP_TEMPLATE, tree };
}

/** The first call seed whose building hosts the fixture; `compile` builds any template on it. */
function host() {
  for (let seed = 1; seed < 200; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    const compile = (t: IncidentTemplate) => compileIncident({ ...base, id: `second-squad-${seed}`, incident: spec }, built, t);
    try { compile(GROUP_TEMPLATE); } catch { continue; }
    return { compile, built };
  }
  throw new Error('No seed hosts the group fixture');
}
const { compile, built } = host();
const s = compile(template());
const id = (node: string, choice: string) => choiceActionId('hostage_crisis', node, choice);
const actions = (scenario: ScenarioDefinition) => Object.values(scenario.stages).flatMap(stage => stage.actions);
const action = (node: string, choice: string): ActionDefinition => actions(s).find(entry => entry.id === id(node, choice))!;
const zones = new Set(built.location.zones.map(zone => zone.id));
const opening = (openingId: string) => built.location.openings.find(entry => entry.id === openingId)!;
const send = (state: GameState, cmd: Parameters<typeof dispatch>[1]) => dispatch(state, cmd, { now: NOW });

/** A run of the fixture with `squads` deployed, past the opening call to the `talk` node. */
function atTalk(scenarioId: string, squads: ('A' | 'B')[]): GameState {
  const entry = built.location.entries[0];
  let state = startWithKit(createInitialState(NOW, 4242), scenarioId, squads, { positions: Object.fromEntries(squads.map(sq => [sq, entry])) });
  const opened = send(state, { type: 'decide', actionId: id('open', 'call'), actingSquadIds: ['A'], supportSquadIds: [] });
  expect(opened.result, 'the opening call').toEqual({ ok: true });
  state = opened.state;
  expect(state.activeRun!.stage).toBe('adapt');
  return state;
}

describe('a second squad supports from a named point (R-B4)', () => {
  it('compiles into a support rule for one squad, at the outside of an opening onto the named room', () => {
    const hold = action('talk', 'hold').support!;
    expect(hold).toMatchObject({ maxSquads: 1, max: TEAM_MOVES.supportMax, reachMinutes: TEAM_MOVES.supportReachMinutes,
      label: 'holding the counter window', task: 'Holding the counter window' });
    const taker = s.story!.bindings.people.taker.initial.spaceId;
    expect(zones.has(hold.coverSpaceId), 'the squad holds outside').toBe(true);
    expect([opening(hold.openingId!).a, opening(hold.openingId!).b].sort()).toEqual([hold.coverSpaceId, taker].sort());
  });

  it('at the exit, it holds outside the door the scene room’s way out leaves by, with the authored max', () => {
    const exit = action('talk', 'ask_out').support!;
    // The taker starts in the scene room (no place of their own in the fixture).
    const scene = s.story!.bindings.people.taker.initial.spaceId;
    const door = doorOut(built, findStoryRoute(built, scene, built.location.entries[0], 'walking')!)!;
    expect(exit.openingId).toBe(door.id);
    expect(zones.has(exit.coverSpaceId)).toBe(true);
    expect(exit.max).toBe(6);
  });

  it('a call with a support choice deploys up to two squads; choices without it compile no support', () => {
    expect(s.squadRange).toEqual({ min: 1, max: 2 });
    expect(compile(GROUP_TEMPLATE).squadRange).toEqual({ min: 1, max: 1 });
    expect(actions(s).filter(entry => entry.support).map(entry => entry.id).sort()).toEqual([id('talk', 'ask_out'), id('talk', 'hold')].sort());
  });

  it('every support choice works with one squad: eligible, and the same choice with no supporter', () => {
    withDraftScenario(s, scenarioId => {
      const one = atTalk(scenarioId, ['A']);
      for (const entry of actions(s).filter(a => a.support && a.stage === 'adapt')) {
        const view = previewAction(one, NOW, entry.id, ['A'], [])!;
        expect(view, entry.id).not.toBeNull();
        expect(view.eligible, `${entry.id}: ${view.reason}`).toBe(true);
        const done = send(one, { type: 'decide', actionId: entry.id, actingSquadIds: ['A'], supportSquadIds: [] });
        expect(done.result, `${entry.id} with one squad`).toEqual({ ok: true });
      }
    });
  });

  it('with two squads deployed, the second squad goes to the named point, takes its task, and helps the odds', () => {
    withDraftScenario(s, scenarioId => {
      const two = atTalk(scenarioId, ['A', 'B']);
      const rule = action('talk', 'hold').support!;
      const alone = previewAction(two, NOW, id('talk', 'hold'), ['A'], [])!;
      const backed = previewAction(two, NOW, id('talk', 'hold'), ['A'], ['B'])!;
      expect(backed.eligible, backed.reason ?? '').toBe(true);
      // The breakdown names the squad's task.
      expect(backed.contributors.some(c => c.source === 'support' && c.label.includes('holding the counter window')), JSON.stringify(backed.contributors.map(c => c.label))).toBe(true);
      expect(backed.likelihood.favorable).toBeGreaterThan(alone.likelihood.favorable);
      const done = send(two, { type: 'decide', actionId: id('talk', 'hold'), actingSquadIds: ['A'], supportSquadIds: ['B'] });
      expect(done.result).toEqual({ ok: true });
      const b = done.state.activeRun!.squadTasks.find(task => task.squadId === 'B')!;
      expect(b.positionId, 'on the map at the named point').toBe(rule.coverSpaceId);
      expect(b.task).toBe('Holding the counter window');
    });
  });

  it('on every building the barricade lists, the point is outside, on an opening of the named room, and reachable from the street', () => {
    // The barricade (calls lane content, cloned) with support on the walk-out under the barking (a
    // vantage on the subject's room) and on every entry (the exit).
    const barricade = INCIDENT_TEMPLATES.barricaded!;
    const tree: CallTree = structuredClone(barricade.tree);
    for (const choice of tree.nodes.flatMap(node => node.choices)) {
      if (choice.id === 'under_barking') choice.support = { at: { vantage: 'subject' }, label: 'holding the front window' };
      if (choice.id === 'go_in') choice.support = { at: 'exit', label: 'holding the back step' };
    }
    const t = { ...barricade, tree };
    let hosted = 0;
    for (const family of tree.families ?? []) for (let building = 1; building <= 10; building++) {
      let call: ScenarioDefinition | null = null, b: ReturnType<typeof buildLocation> | null = null;
      for (let seed = 1; seed < 20 && !call; seed++) {
        let base;
        try { base = generateIncident({ type: 'barricaded', familyId: family, buildingSeed: building, seed, tier: 2, contentVersion: 13 }); } catch { continue; }
        const { clocks: _c, incidentPeople: _p, threats: _t, ...frame } = base;
        b = buildLocation(frame.locationFamilyId, frame.locationSeed);
        try { call = compileIncident({ ...frame, id: `support-${family}-${building}`, incident: hostedSpec(frame) }, b, t); } catch { continue; }
      }
      if (!call || !b) continue;
      hosted++;
      const outdoor = new Set(b.location.zones.map(zone => zone.id));
      const subjectRoom = call.story!.bindings.people.subject.initial.spaceId;
      for (const entry of actions(call).filter(a => a.support)) {
        const rule = entry.support!, where = `${family} ${building} ${entry.id}`;
        const gap = b.location.openings.find(o => o.id === rule.openingId)!;
        expect(outdoor.has(rule.coverSpaceId), where).toBe(true);
        expect([gap.a, gap.b], where).toContain(rule.coverSpaceId);
        if (entry.id.endsWith('_under_barking')) expect([gap.a, gap.b], where).toContain(subjectRoom);
        expect(reachableOverGround(b, b.location.entries[0], rule.coverSpaceId), where).toBe(true);
      }
      expect(call.squadRange.max, `${family} ${building}`).toBe(2);
    }
    expect(hosted, 'buildings that host the barricade').toBeGreaterThan(40);
  });

  it('rejects a vantage on someone not on the call, an empty label, and a support choice that needs two squads', () => {
    const on = (support: Support, extra: Partial<TreeChoice> = {}) => template(tree => {
      Object.assign(tree.nodes.find(node => node.id === 'talk')!.choices.find(choice => choice.id === 'hold')!, { support, ...extra });
    });
    expect(() => compile(on({ at: { vantage: 'nobody' }, label: 'holding' }))).toThrow(/nobody/);
    expect(() => compile(on({ at: 'exit', label: ' ' }))).toThrow(/needs a label/);
    expect(() => compile(on(AT_EXIT, { requires: { minSquads: { count: 2, reason: 'Two squads' } } }))).toThrow(/works with one squad/);
  });
});

// The joint-operation journey (architecture/journeys.ts), played headless through the real
// dispatcher on the fixture until the barricade authors support; that call's PR moves it there.
describe('journey joint-operation', () => {
  it('two squads deploy, the second supports from the named point, the call saves mid-way and ends in a closed debrief', () => {
    withDraftScenario(s, scenarioId => {
      const two = atTalk(scenarioId, ['A', 'B']);
      expect(two.activeRun!.squadIds).toEqual(['A', 'B']);
      const rule = action('talk', 'hold').support!;
      const held = send(two, { type: 'decide', actionId: id('talk', 'hold'), actingSquadIds: ['A'], supportSquadIds: ['B'] });
      expect(held.result).toEqual({ ok: true });
      const decision = held.state.activeRun!.history.at(-1)!;
      expect(decision).toMatchObject({ actionId: id('talk', 'hold'), actingSquadIds: ['A'], supportSquadIds: ['B'] });
      expect(decision.inputs.some(input => input.source === 'support' && input.value > 0), 'the supporting squad counted').toBe(true);
      const b = held.state.activeRun!.squadTasks.find(task => task.squadId === 'B')!;
      const stand = stagingFacing(built, rule.coverSpaceId, action('talk', 'hold').targetId, rule.openingId)!;
      expect(stand.openingId, 'staged at the named opening').toBe(rule.openingId);
      expect(b).toMatchObject({ positionId: rule.coverSpaceId, stagingId: stand.id, at: stand.at });
      // Mid-call, with the second squad at its point, the campaign saves and loads to the same state.
      // A draft call is on no real board, so the save carries it as a call already answered (as moves.test does).
      const copy = structuredClone(held.state);
      copy.incidents = [];
      delete copy.activeRun!.sourceIncident;
      const reloaded = deserialize(serialize(copy, NOW))!;
      expect(reloaded, 'the save loads').not.toBeNull();
      expect(reloaded.activeRun!.squadTasks).toEqual(held.state.activeRun!.squadTasks);
      const ended = playToEnd(scenarioId, 'random', 4242, { start: reloaded });
      expect(ended.activeRun?.stage, 'the call reached its debrief').toBe('debrief');
      const closed = send(ended, { type: 'closeDebrief' });
      expect(closed.result).toEqual({ ok: true });
      expect(closed.state.activeRun).toBeNull();
    });
  });
});
