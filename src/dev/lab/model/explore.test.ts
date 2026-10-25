// Shortest paths through the engine: to every ending the hostage reference call can reach (drawn
// results aimed, never a natural roll), to a node, to where a choice is offered or eligible, and to a
// requirement; each path replays move for move. Endings a call's graph lists but the walk can't reach
// are named with the reason, proven: the situation's hidden truth, a squad without a certification,
// a clock that never runs out in this call, or a player never left without a move.
import { decisionsOf } from '../../../sim/types';
import { describe, expect, it } from 'vitest';
import { labRequirementTree, sessionClockNexts } from './clocks';
import { availableMoves, NOW } from '../../../gen/incident/gates/engine-driver';
import { clockMarksOf } from '../../../gen/incident/instance';
import { choiceActionId } from '../../../gen/incident/trees-v13/compile';
import { callGraph } from '../../../gen/incident/trees-v13/graph';
import type { CallGraph } from '../../../gen/incident/trees-v13/graph';
import type { GameState } from '../../../sim/types';
import { liveDecisions } from '../../../ui/screens/live-model';
import { parseLabUrl } from '../url';
import { decodePath } from './call';
import { createExplorer, explore, EXPLORE_CAP, noPathText } from './explore';
import { currentFrame, nodeAt, openSession, replayTokens } from './session';
import { focusSquad } from './squads';
import { certSubjects, clockSubjects, groupFixtureSession, stoppedClockSession } from './test-subjects';
import { CLOCK_FIXTURE_IDS } from '../../../gen/incident/gates/clock-fixture';
import type { Session } from './session';

const REFERENCE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=0';

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}
const replayed = (s: Session, path: string) => {
  const r = replayTokens(s, path);
  expect(r.stopped).toBeNull();
  return currentFrame(r).state;
};

const graphOf = (s: Session): CallGraph => callGraph(s.tree, { counts: s.counts, seed: s.resolved.spec!.seed, situation: s.situation, clockMarks: clockMarksOf(s.instance.clocks), clockNexts: sessionClockNexts(s) });
const inCallEndings = (graph: CallGraph) => graph.vertices.filter(v => v.kind === 'ending' && v.inCall).map(v => v.treeId).sort();
/** A live state where the engine offers no move at all (no band of any choice, no continuation, no
 * report): the only way to the failed-response fallback (handed_over), whose report the walk takes
 * whenever the engine offers it. The walk's moves are these, split by drawn result. */
const noMoveLeft = (state: GameState) => !!state.activeRun && state.activeRun.status === 'active' && state.activeRun.stage !== 'debrief'
  && !availableMoves(state, liveDecisions(state, NOW, focusSquad(state))).length;

describe('explore', () => {
  const s = open(REFERENCE);
  const start = s.frames[0].state;

  it('reaches every ending the reference call\'s graph keeps, or proves why this call can\'t', () => {
    const graph = graphOf(s);
    const all = explore(start, null);
    expect(all.truncated).toBe(false);
    expect(all.states).toBeLessThan(EXPLORE_CAP);
    for (const [ending, path] of Object.entries(all.endings!)) {
      expect(replayed(s, path).activeRun!.endingId).toBe(ending);
      // Drawn results are aimed, so no ending needs the run's own dice.
      expect(path).not.toMatch(/~roll/);
    }
    const missing = inCallEndings(graph).filter(ending => !(ending in all.endings!));
    // Situation 1 of 3 (the rider is clear, the clerk took the bag): every ending the call keeps but the
    // failed-response fallback.
    expect(s.tree.situations[s.situation]!.truth.rider_clear).toBe(true);
    // manager_hurt_inside is unreachable in every situation (backlog going-live-dead-ending).
    expect(missing).toEqual(['handed_over', 'manager_hurt_inside']);
    expect(Object.keys(all.endings!)).toHaveLength(inCallEndings(graph).length - 2);
    // Where the rider took the bag (rider_clear false), the ending that walks him out clear is missing, and
    // every route into it needs rider_clear: on the route, or on the choice that sends the porch clip (which
    // needs proof nobody here has).
    const calm = open(REFERENCE.replace('variant=0', 'variant=1'));
    expect(calm.tree.situations[calm.situation]!.truth.rider_clear).toBe(false);
    const calmGraph = graphOf(calm);
    const calmAll = explore(calm.frames[0].state, null);
    expect(calmAll.truncated).toBe(false);
    const calmMissing = inCallEndings(calmGraph).filter(ending => !(ending in calmAll.endings!));
    // manager_hurt_inside is missing everywhere, not by truth (backlog going-live-dead-ending).
    const needRaised = calmMissing.filter(ending => ending !== 'handed_over' && ending !== 'manager_hurt_inside');
    expect(calmMissing).toContain('manager_hurt_inside');
    expect(needRaised).toEqual(['out_cleared']);
    // Since the sol rework (2026-10-24) a walk-out ends cleared on what the viewers heard, not on the hidden
    // truth: every route into out_cleared needs the proof seen or an on-camera admission, which a courier
    // who took the bag never gets.
    const intoCleared = calmGraph.edges.filter(edge => edge.inCall && edge.to === 'ending:out_cleared');
    expect(intoCleared.length).toBeGreaterThan(0);
    // send_clip carries the gate on the choice itself (onlyIf proof_seen), so its edge has no condition of its own.
    for (const edge of intoCleared) if (`${edge.node}/${edge.choice}` !== 'way_out/send_clip') expect(JSON.stringify(edge.conditions), `${edge.node}/${edge.choice}`).toMatch(/proof_seen|admitted_live/);
    expect(JSON.stringify(calm.tree.nodes.find(node => node.id === 'way_out')!.choices.find(choice => choice.id === 'send_clip')!.onlyIf)).toContain('proof_seen');
    // handed_over is the failed-response fallback: no state in this call leaves the player without a move.
    expect(explore(start, null, { holds: noMoveLeft })).toMatchObject({ path: null, truncated: false });
    // A goal stops at the shortest path to it.
    const [first] = Object.keys(all.endings!).sort();
    const one = explore(start, { ending: first });
    expect(one.path).toBe(all.endings![first]);
    expect(one.states).toBeLessThanOrEqual(all.states);
  }, 120000);

  it('reaches the manager killed, by aiming the team\'s force', () => {
    // Firing needs a carried sidearm and an officer qualified for it (sim/force-risk.ts qualifiedForceUnit).
    const keeps = open(`${REFERENCE}&kit=full&certs=entry_team`);
    const graph = graphOf(keeps);
    const all = explore(keeps.frames[0].state, null);
    expect(all.truncated).toBe(false);
    expect(all.states).toBeLessThan(EXPLORE_CAP);
    const missing = inCallEndings(graph).filter(ending => !(ending in all.endings!));
    // The retired hostage call proved here that endings only a clock this situation lacks brings
    // about were missing. Every Going Live situation runs the same clocks, so none is absent and
    // nothing waits on one: only the fallback is missing, and no state leaves no move.
    const ids = new Set(keeps.instance.clocks.map(clock => clock.id));
    expect(keeps.template.situations.flatMap(entry => entry.clocks ?? []).filter(clock => !clock.story && !ids.has(clock.id))).toEqual([]);
    // manager_hurt_inside is unreachable in every situation (backlog going-live-dead-ending).
    expect(missing).toEqual(['handed_over', 'manager_hurt_inside']);
    expect(explore(keeps.frames[0].state, null, { holds: noMoveLeft })).toMatchObject({ path: null, truncated: false });
    for (const [ending, force] of [['manager_killed', 'firearm:none'], ['manager_killed_rider_hurt', null]] as const) {
      const path = all.endings![ending];
      expect(path).toBeDefined();
      expect(path).not.toMatch(/~roll/);
      const last = decodePath(path.split(',').at(-1)!)[0];
      expect(last).toMatchObject({ kind: 'decide', band: 'adverse' });
      if (force) expect(last.drawn![0]).toBe(force);
      else expect(last.drawn![0]).toMatch(/^firearm:(wounded|serious)$/);
      const end = replayed(keeps, path).activeRun!;
      expect(end.endingId).toBe(ending);
      expect(decisionsOf(end.history).at(-1)!.committed!.drawn!.map(d => d.key)).toEqual(last.drawn);
      // A goal finds the same path, as Play here does.
      expect(explore(keeps.frames[0].state, { ending }).path).toBe(path);
    }
  }, 120000);

  // A cert-gated choice and a clock that routes the call: on a shipped call that has one, and always
  // on an owned fixture (model/test-subjects.ts), so the properties are tested whatever content does.
  // A fixture's tree isn't the registered one, so the walk is given the session's own goal test.
  const eligibleHere = (actionId: string) => (state: GameState) => !!liveDecisions(state, NOW, focusSquad(state)).find(view => view.id === actionId)?.eligible;
  for (const subject of certSubjects()) it(`${subject.source}: a cert-gated choice is eligible only with the cert`, () => {
    subject.withSessions((bare, granted) => {
      expect(explore(bare.frames[0].state, null, { holds: eligibleHere(subject.actionId) })).toMatchObject({ path: null, truncated: false });
      expect(explore(granted.frames[0].state, null, { holds: eligibleHere(subject.actionId) }).path).not.toBeNull();
    });
  }, 120000);

  for (const subject of clockSubjects()) it(`${subject.source}: a clock that runs out takes the call where it routes, and the path replays there`, () => {
    subject.withSession(s => {
      const at = (state: GameState) => 'node' in subject.target ? nodeAt(state, s.tree) === subject.target.node : state.activeRun?.endingId === subject.target.ending;
      const found = explore(s.frames[0].state, null, { holds: at });
      expect(found.path, JSON.stringify(subject.target)).not.toBeNull();
      expect(at(currentFrame(replayTokens(s, found.path!)).state)).toBe(true);
    });
  }, 120000);

  it('a clock that never runs down never takes the call there (owned fixture)', () => {
    stoppedClockSession(s => {
      expect(explore(s.frames[0].state, null, { holds: state => nodeAt(state, s.tree) === CLOCK_FIXTURE_IDS.node })).toMatchObject({ path: null, truncated: false });
    });
  }, 120000);

  it('reaches a node, a choice on offer and an eligible choice', () => {
    const toNode = explore(start, { node: 'on_air' });
    expect(toNode.path).not.toBeNull();
    expect(nodeAt(replayed(s, toNode.path!), s.tree)).toBe('on_air');
    expect(explore(start, { node: s.tree.root }).path).toBe('');
    const id = choiceActionId('hostage_crisis', 'on_air', 'manager_speaks');
    for (const goal of [{ offered: id }, { eligible: id }]) {
      const found = explore(start, goal);
      expect(found.path).not.toBeNull();
      const view = liveDecisions(replayed(s, found.path!), NOW, 'A').find(entry => entry.id === id);
      expect(view).toBeDefined();
      if ('eligible' in goal) expect(view!.eligible).toBe(true);
    }
    const flags = explore(start, { flags: ['at:on_air'] });
    expect(flags.path).toBe(toNode.path);
  }, 60000);

  it('reaches where a requirement holds (an outcome\'s state), and says when nothing does', () => {
    const target = { prompt: ['on_air', 1] as [string, number] };
    const req = labRequirementTree(s.tree, target);
    const found = explore(start, { req, target });
    expect(found.path).not.toBeNull();
    expect(nodeAt(replayed(s, found.path!), s.tree)).toBe('on_air');
    // No such state: the walk ends without a path, untruncated.
    const none = explore(start, { flags: ['mark:not_a_mark'] });
    expect(none).toMatchObject({ path: null, truncated: false });
  }, 60000);

  it('stops at the cap or when asked, and walks the same way in slices', () => {
    const capped = explore(start, { flags: ['mark:not_a_mark'] }, { cap: 20 });
    expect(capped).toMatchObject({ path: null, truncated: true, states: 20 });
    let calls = 0;
    const stopped = explore(start, null, { shouldStop: () => ++calls > 5 });
    expect(stopped.truncated).toBe(true);
    expect(stopped.states).toBe(5);
    const sliced = createExplorer(start, { node: 'on_air' });
    let progress = sliced.step(0);
    let slices = 1;
    while (!progress.done) { progress = sliced.step(1); slices++; }
    expect(slices).toBeGreaterThan(1);
    expect(progress.path).toBe(explore(start, { node: 'on_air' }).path);
  }, 60000);
});

describe('no path, in words', () => {
  it('blames the limit only when the walk stopped early', () => {
    expect(noPathText({ path: null, states: 6000, truncated: true }, 6000, null)).toBe('No path within 6,000 states reaches that in this call.');
    expect(noPathText({ path: null, states: 1862, truncated: false }, 6000, null)).toBe('No path reaches that in this call (the walk covered all 1,862 states).');
    expect(noPathText({ path: null, states: 1862, truncated: false }, 6000, 'Every route there needs the turn out back door, and this call drew out keys.'))
      .toBe('No path reaches that in this call. Every route there needs the turn out back door, and this call drew out keys. (The walk covered all 1,862 states.)');
  });

  it('never claims full coverage when it skipped results the dice allow but no forced step can take (review finding unforceable-band-called-impossible)', () => {
    expect(noPathText({ path: null, states: 1862, truncated: false, unforced: 3 }, 6000, null))
      .toBe('No path the lab can force reaches that in this call (the walk covered all 1,862 states it can force, and skipped 3 results the dice allow but no forced step can take).');
    expect(noPathText({ path: null, states: 1862, truncated: false, unforced: 1 }, 6000, 'Every route there needs the turn out back door, and this call drew out keys.'))
      .toBe('No path the lab can force reaches that in this call. Every route there needs the turn out back door, and this call drew out keys. (The walk covered all 1,862 states it can force, and skipped 1 result the dice allow but no forced step can take.)');
    expect(noPathText({ path: null, states: 1862, truncated: false, unforced: 0 }, 6000, null)).toBe('No path reaches that in this call (the walk covered all 1,862 states).');
  });

  it('counts the natural results too narrow to force in a walk that has them', () => {
    // Which hostage draws reach a state with a mixed window under 1% moves whenever odds inputs
    // change (intel-odds took the default draw's three away), so the test looks for one rather than
    // pinning a draw. Measured 2026-10-18: 14 of the 15 hostage draws (situation x tier) have such
    // states, among them situation 1 at tier 3, the second draw tried here.
    const draws = [0, 1, 2].flatMap(variant => [2, 3, 1, 4, 5].map(tier => `type=hostage_crisis&variant=${variant}&tier=${tier}`));
    let walked: ReturnType<typeof explore> | null = null;
    for (const draw of draws) {
      walked = explore(open(draw).frames[0].state, null);
      if (walked.unforced) break;
    }
    expect(walked!.truncated).toBe(false);
    expect(walked!.unforced).toBeGreaterThan(0);
    // Control: a complete walk of the group fixture (a call the tooling owns) counts none.
    groupFixtureSession(fixture => {
      const all = explore(fixture.frames[0].state, null);
      expect(all.truncated).toBe(false);
      expect(all.unforced).toBe(0);
    });
  }, 120000);
});
