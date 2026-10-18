// Shortest paths through the engine: to every ending the hostage reference call can reach (drawn
// results aimed, never a natural roll), to a node, to where a choice is offered or eligible, and to a
// requirement; each path replays move for move. Endings a call's graph lists but the walk can't reach
// are named with the reason, proven: the situation's hidden truth, a squad without a certification,
// a clock that never runs out in this call, or a player never left without a move.
import { describe, expect, it } from 'vitest';
import { availableMoves, NOW } from '../../../gen/incident/gates/engine-driver';
import { clockMarksOf } from '../../../gen/incident/instance';
import { choiceActionId } from '../../../gen/incident/trees-v13/compile';
import { requirementTree } from '../../../gen/incident/trees-v13/dependencies';
import { callGraph } from '../../../gen/incident/trees-v13/graph';
import type { CallGraph } from '../../../gen/incident/trees-v13/graph';
import type { GameState } from '../../../sim/types';
import { liveDecisions } from '../../../ui/screens/live-model';
import { parseLabUrl } from '../url';
import { decodePath } from './call';
import { createExplorer, explore, EXPLORE_CAP, noPathText } from './explore';
import { currentFrame, nodeAt, openSession, replayTokens } from './session';
import { focusSquad } from './squads';
import type { Session } from './session';

const REFERENCE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';

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

const graphOf = (s: Session): CallGraph => callGraph(s.tree, { counts: s.counts, seed: s.resolved.spec!.seed, situation: s.situation, clockMarks: clockMarksOf(s.instance.clocks) });
const inCallEndings = (graph: CallGraph) => graph.vertices.filter(v => v.kind === 'ending' && v.inCall).map(v => v.treeId).sort();
/** Every route into the ending this call keeps needs a fact this situation's truth says is false. */
const blockedByTruth = (graph: CallGraph, ending: string, fact: string) => {
  const into = graph.edges.filter(edge => edge.inCall && edge.to === `ending:${ending}`);
  return into.length > 0 && into.every(edge => edge.conditions.some(c => c.kind === 'fact' && c.fact === fact && c.holds === false));
};
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
    // Measured 2026-10-09 (situation 2 of 3, lets_go true): 12 of the 16 endings in the call.
    expect(Object.keys(all.endings!)).toHaveLength(12);
    expect(missing).toEqual(['handed_over', 'owner_beaten', 'owner_killed', 'owner_killed_taker_hurt']);
    // The owner dies or is beaten only where the taker won't trade (lets_go false); here he will.
    expect(s.tree.situations[s.situation].truth.lets_go).toBe(true);
    for (const ending of ['owner_beaten', 'owner_killed', 'owner_killed_taker_hurt']) expect(blockedByTruth(graph, ending, 'lets_go')).toBe(true);
    // handed_over is the failed-response fallback: no state in this call leaves the player without a move.
    expect(explore(start, null, { holds: noMoveLeft })).toMatchObject({ path: null, truncated: false });
    // A goal stops at the shortest path to it.
    const [first] = Object.keys(all.endings!).sort();
    const one = explore(start, { ending: first });
    expect(one.path).toBe(all.endings![first]);
    expect(one.states).toBeLessThanOrEqual(all.states);
  }, 120000);

  it('reaches the owner killed in the situation where the taker won\'t trade, by aiming the team\'s force', () => {
    // Firing needs a carried sidearm and an officer qualified for it (sim/force-risk.ts qualifiedForceUnit).
    const keeps = open(`${REFERENCE.replace('variant=1', 'variant=2')}&kit=full&certs=entry_team`);
    expect(keeps.tree.situations[keeps.situation].truth.lets_go).toBe(false);
    const graph = graphOf(keeps);
    const all = explore(keeps.frames[0].state, null);
    expect(all.truncated).toBe(false);
    expect(all.states).toBeLessThan(EXPLORE_CAP);
    const missing = inCallEndings(graph).filter(ending => !(ending in all.endings!));
    // The rest need the taker to trade (lets_go true) or the owner down, which only the owner's
    // heart clock writes, and this situation has no such clock; or no move to be left.
    expect(missing).toEqual(['handed_over', 'held_both_down', 'owner_collapsed', 'owner_left_down', 'went_in_for_owner', 'went_in_taker_hurt']);
    const needsOwnerDown = (edge: CallGraph['edges'][number]) => edge.node === 'owner_down'
      || edge.conditions.some(c => (c.kind === 'state' && !!c.state.marks?.includes('owner_down')) || (c.kind === 'clock' && c.clock === 'owner_condition' && c.is));
    for (const ending of missing.filter(e => e !== 'handed_over'))
      expect(graph.edges.filter(edge => edge.inCall && edge.to === `ending:${ending}`)
        .every(edge => needsOwnerDown(edge) || edge.conditions.some(c => c.kind === 'fact' && c.holds === false))).toBe(true);
    expect(keeps.instance.clocks.map(clock => clock.id)).not.toContain('owner_condition');
    // One complete walk: no state has the owner down (mark or node), and none leaves no move.
    const ownerDownOrStuck = (state: GameState) => !!state.activeRun?.flags.includes('mark:owner_down') || nodeAt(state, keeps.tree) === 'owner_down' || noMoveLeft(state);
    expect(explore(keeps.frames[0].state, null, { holds: ownerDownOrStuck })).toMatchObject({ path: null, truncated: false });
    for (const [ending, force] of [['owner_killed', 'firearm:none'], ['owner_killed_taker_hurt', null]] as const) {
      const path = all.endings![ending];
      expect(path).toBeDefined();
      expect(path).not.toMatch(/~roll/);
      const last = decodePath(path.split(',').at(-1)!)[0];
      expect(last).toMatchObject({ kind: 'decide', band: 'adverse' });
      if (force) expect(last.drawn![0]).toBe(force);
      else expect(last.drawn![0]).toMatch(/^firearm:(wounded|serious)$/);
      const end = replayed(keeps, path).activeRun!;
      expect(end.endingId).toBe(ending);
      expect(end.history.at(-1)!.committed!.drawn!.map(d => d.key)).toEqual(last.drawn);
      // A goal finds the same path, as Play here does.
      expect(explore(keeps.frames[0].state, { ending }).path).toBe(path);
    }
  }, 120000);

  it('rescue: out carried needs a vehicle operator, and the tank only runs out where it is short', () => {
    const rescue = open('type=protected_rescue');
    const all = explore(rescue.frames[0].state, null);
    expect(all.truncated).toBe(false);
    expect(Object.keys(all.endings!).sort()).toEqual(['out_together', 'out_without_chair', 'resident_hurt', 'slow_out', 'still_inside']);
    // The crossing (where the carry is offered) is reached only through choices that need a vehicle
    // operator, and squad A (719) has none.
    expect(explore(rescue.frames[0].state, { node: 'crossing' })).toMatchObject({ path: null, truncated: false });
    const locked = (q: Session, node: string, choice: string, path: string) => {
      const id = choiceActionId('protected_rescue', node, choice);
      return currentFrame(replayTokens(q, path)).views.find(view => view.id === id);
    };
    expect(locked(rescue, 'wont_leave', 'vehicle', '')).toMatchObject({ eligible: false, reason: expect.stringContaining('vehicle operator') });
    const toTerms = explore(rescue.frames[0].state, { node: 'their_terms' }).path!;
    expect(locked(rescue, 'their_terms', 'screen_first', toTerms)).toMatchObject({ eligible: false, reason: expect.stringContaining('vehicle operator') });
    const granted = open('type=protected_rescue&certs=vehicle_operations');
    const withCert = explore(granted.frames[0].state, null);
    expect(withCert.truncated).toBe(false);
    expect(replayed(granted, withCert.endings!.out_carried).activeRun!.endingId).toBe('out_carried');
    // The tank: in this situation it holds 100 and drains 0.2 a minute, 500 minutes, so the longest
    // wait ends with it still going (still_inside, the all_night branch where it lasts).
    const tank = rescue.instance.clocks.find(clock => clock.id === 'oxygen')!;
    expect(tank.start / tank.ratePerMin).toBe(500);
    expect(withCert.endings).toHaveProperty('still_inside');
    expect(withCert.endings).not.toHaveProperty('tank_ran_out');
    // Where the tank is short (situation 3: 40 at about 1 a minute), the same wait runs it out.
    const short = open('type=protected_rescue&variant=2');
    const shortTank = short.instance.clocks.find(clock => clock.id === 'oxygen')!;
    expect(shortTank.start / shortTank.ratePerMin).toBeLessThan(60);
    const ranOut = explore(short.frames[0].state, { ending: 'tank_ran_out' }).path;
    expect(ranOut).not.toBeNull();
    expect(replayed(short, ranOut!).activeRun!.endingId).toBe('tank_ran_out');
  }, 120000);

  it('reaches a node, a choice on offer and an eligible choice', () => {
    const toNode = explore(start, { node: 'talking' });
    expect(toNode.path).not.toBeNull();
    expect(nodeAt(replayed(s, toNode.path!), s.tree)).toBe('talking');
    expect(explore(start, { node: s.tree.root }).path).toBe('');
    const id = choiceActionId('hostage_crisis', 'talking', 'take_account');
    for (const goal of [{ offered: id }, { eligible: id }]) {
      const found = explore(start, goal);
      expect(found.path).not.toBeNull();
      const view = liveDecisions(replayed(s, found.path!), NOW, 'A').find(entry => entry.id === id);
      expect(view).toBeDefined();
      if ('eligible' in goal) expect(view!.eligible).toBe(true);
    }
    const flags = explore(start, { flags: ['at:talking'] });
    expect(flags.path).toBe(toNode.path);
  }, 60000);

  it('reaches where a requirement holds (an outcome\'s state), and says when nothing does', () => {
    const target = { prompt: ['talking', 0] as [string, number] };
    const req = requirementTree(s.tree, target);
    const found = explore(start, { req, target });
    expect(found.path).not.toBeNull();
    expect(nodeAt(replayed(s, found.path!), s.tree)).toBe('talking');
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
    const sliced = createExplorer(start, { node: 'talking' });
    let progress = sliced.step(0);
    let slices = 1;
    while (!progress.done) { progress = sliced.step(1); slices++; }
    expect(slices).toBeGreaterThan(1);
    expect(progress.path).toBe(explore(start, { node: 'talking' }).path);
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
    // Measured 2026-10-09: the hostage default call has three states with a mixed window under 1%.
    const walked = explore(open('type=hostage_crisis').frames[0].state, null);
    expect(walked.truncated).toBe(false);
    expect(walked.unforced).toBeGreaterThan(0);
    expect(explore(open('type=protected_rescue').frames[0].state, null).unforced).toBe(0);
  }, 60000);
});
