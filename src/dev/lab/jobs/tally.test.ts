// The reach tally: merging is exact and associative (runs split across workers add up to the same
// tally as one worker playing them all), recorded edges use the graph's own keys, and a run is
// counted the way the spec's fields say.
import { describe, expect, it } from 'vitest';
import { sessionClockNexts } from '../model/clocks';
import { WEIGHTS } from '../../../gen/incident/trees-v13/balance';
import type { CallResult } from '../../../gen/incident/trees-v13/balance';
import { clockMarksOf } from '../../../gen/incident/instance';
import { callGraph, matchKey } from '../../../gen/incident/trees-v13/graph';
import { hashSeed } from '../../../sim/rng';
import { openSession } from '../model/session';
import type { Session } from '../model/session';
import { parseLabUrl } from '../url';
import type { StartRef } from './protocol';
import { runJob } from './runners';
import type { RunnerContext } from './runners';
import { addRun, emptyTally, mergeTally, pairedRuns, runRngState } from './tally';
import type { ReachTally, StepRecord } from './tally';

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}
const ctx: RunnerContext = { shouldStop: () => false, progress: () => {}, yieldEvery: 25 };
const startOf = (s: Session): StartRef => ({ kind: 'fresh', scenarioId: s.scenario.id, kit: 'day1', squad: { seed: 719, certs: [] } });
async function reach(s: Session, runs: [number, number]): Promise<ReachTally> {
  const result = await runJob({ kind: 'reach-call', start: startOf(s), style: 'random', runs }, ctx);
  if (result.kind !== 'reach') throw new Error(`expected a tally, got ${result.kind}`);
  return result.tally;
}

describe('mergeTally', () => {
  const barricade = open('type=barricaded');

  it('runs [0, 50) merged with [50, 100) equal [0, 100) played in one go', async () => {
    const [first, second, whole] = await Promise.all([reach(barricade, [0, 50]), reach(barricade, [50, 100]), reach(barricade, [0, 100])]);
    expect(whole.runs).toBe(100);
    expect(mergeTally(first, second)).toEqual(whole);
    // Order doesn't matter either, so the pool can merge parts as they finish.
    expect(mergeTally(second, first)).toEqual(whole);
  }, 120000);

  it('is associative, and the empty tally is its identity', async () => {
    const [a, b, c] = await Promise.all([reach(barricade, [0, 20]), reach(barricade, [20, 40]), reach(barricade, [40, 60])]);
    expect(mergeTally(mergeTally(a, b), c)).toEqual(mergeTally(a, mergeTally(b, c)));
    expect(mergeTally(emptyTally(), a)).toEqual(a);
    expect(mergeTally(a, emptyTally())).toEqual(a);
  }, 120000);
});

describe('recordStep', () => {
  it('keys every recorded edge the way the call graph keys its edges', async () => {
    const s = open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1');
    const graph = callGraph(s.tree, { counts: s.counts, seed: s.resolved.spec!.seed, situation: s.situation, clockMarks: clockMarksOf(s.instance.clocks), clockNexts: sessionClockNexts(s) });
    const keys = new Set(graph.edges.map(edge => {
      // A turn edge goes to its hub; this call drew one member of the group.
      const to = edge.to.startsWith('turn:') ? `node:${graph.turnDrawn[edge.to.slice(5)] ?? ''}` : edge.to;
      return matchKey({ node: edge.node, choice: edge.choice, band: edge.band, drawn: edge.drawn, to });
    }));
    const tally = await reach(s, [0, 80]);
    const missing = Object.keys(tally.edges).filter(key => !keys.has(key));
    expect(missing).toEqual([]);
    expect(Object.keys(tally.edges).length).toBeGreaterThan(5);
    // Every edge leaves a node that was visited, and nodeEdges add up to the visits.
    expect(Object.values(tally.nodeEdges).reduce((sum, n) => sum + n, 0)).toBe(Object.values(tally.visits).reduce((sum, n) => sum + n, 0));
    expect(Object.values(tally.endings).reduce((sum, e) => sum + e.n, 0)).toBe(80);
    expect(tally.runWeights).toHaveLength(80);
    expect(tally.runWeights.every(w => w >= 0 && w < WEIGHTS.length)).toBe(true);
  }, 120000);
});

describe('addRun', () => {
  const result = (over: Partial<CallResult>): CallResult => ({ weight: 'clean', ending: 'everyone_out', minutes: 30, officersHurt: 0, peopleHurt: 0, deaths: 0, decisions: 2, ...over });
  const step = (over: Partial<StepRecord>): StepRecord => ({
    node: 'offer', choice: 'take', band: 'favorable', drawn: [], to: 'talking', marks: [], flat: false,
    offered: [{ choice: 'take', eligible: true, favorable: 0.5 }, { choice: 'rush', eligible: false, reason: 'Needs a shield.', favorable: 0.2 }], ...over,
  });

  it('counts steps per visit, keys per run, locks, odds and run classes by run index', () => {
    const t = emptyTally();
    addRun(t, [step({ marks: ['mark:door_open'] }), step({ node: 'talking', choice: 'wait', to: 'end:everyone_out', marks: ['mark:door_open'], flat: true,
      offered: [{ choice: 'wait', eligible: true, favorable: 0.75 }] })], result({}), 2);
    addRun(t, [step({ band: 'adverse', drawn: ['force:hurt', 'fire:wounded'], to: 'end:out_hurt' })], result({ weight: 'hurt', ending: 'out_hurt', officersHurt: 1, minutes: 12.5 }), 0);
    addRun(t, [], result({ weight: 'unresolved', ending: 'none', minutes: 0 }), 5);
    expect(t.runs).toBe(3);
    expect(t.visits).toEqual({ offer: 2, talking: 1 });
    expect(t.choices).toEqual({ 'offer/take': 2, 'talking/wait': 1 });
    expect(t.edges).toEqual({ 'offer/take/favorable>talking': 1, 'talking/wait/favorable>end:everyone_out': 1, 'offer/take/adverse/hurt>end:out_hurt': 1 });
    expect(t.nodeEdges).toEqual({ 'offer>talking': 1, 'talking>end:everyone_out': 1, 'offer>end:out_hurt': 1 });
    expect(t.keysSet).toEqual({ 'mark:door_open': 1 });
    expect(t.locked['offer/rush']).toEqual({ offered: 2, locked: 2, reasons: { 'Needs a shield.': 2 } });
    expect(t.locked['offer/take']).toEqual({ offered: 2, locked: 0, reasons: {} });
    expect(t.odds['offer/take']).toEqual({ min: 0.5, max: 0.5, sum: 1, n: 2 });
    expect(t.odds['offer/rush']).toBeUndefined();
    expect(t.flatVisits).toEqual({ talking: 1 });
    expect(t.nodeFate).toEqual({ offer: { death: 0, hurt: 1, unresolved: 0, costly: 0, clean: 1 }, talking: { death: 0, hurt: 0, unresolved: 0, costly: 0, clean: 1 } });
    expect(t.endings.none).toEqual({ n: 1, weights: { death: 0, hurt: 0, unresolved: 1, costly: 0, clean: 0 } });
    expect(t.stuck).toBe(1);
    expect(t.officerHurt).toBe(1);
    expect(t.minutes).toBe(42.5);
    // Run classes by run index (death 0 … clean 4), -1 where a run is missing.
    expect(t.runWeights).toEqual([1, -1, 4, -1, -1, 2]);
    expect(t.runMinutes).toEqual([12.5, -1, 30, -1, -1, 0]);
  });

  it('pairs runs with the same index across two tallies', () => {
    const before = emptyTally(), after = emptyTally();
    addRun(before, [], result({}), 0);
    addRun(before, [], result({ weight: 'hurt' }), 1);
    addRun(after, [], result({ weight: 'hurt' }), 1);
    addRun(after, [], result({ weight: 'hurt' }), 2);
    expect(pairedRuns(before, after, w => w === 'hurt')).toEqual({ before: [1], after: [1] });
  });
});

describe('runRngState', () => {
  it('is hashSeed of `<scenarioId>:<k>:lab-reach`, a different state for every run', () => {
    expect(runRngState('gen:x', 3)).toBe(hashSeed('gen:x:3:lab-reach') >>> 0);
    const states = new Set(Array.from({ length: 200 }, (_, k) => runRngState('gen:x', k)));
    expect(states.size).toBe(200);
  });
});
