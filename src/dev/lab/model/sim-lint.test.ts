// Lint from played runs, on a fixture tally over the hostage reference call's graph.
import { describe, expect, it } from 'vitest';
import { sessionClockNexts } from './clocks';
import type { Weight } from '../../../gen/incident/trees-v13/balance';
import { clockMarksOf } from '../../../gen/incident/instance';
import { callGraph, truthReach } from '../../../gen/incident/trees-v13/graph';
import type { ReachTally } from '../jobs/tally';
import { parseLabUrl } from '../url';
import { openSession } from './session';
import type { Session } from './session';
import { simLint } from './sim-lint';

const WEIGHTS = (): Record<Weight, number> => ({ death: 0, hurt: 0, unresolved: 0, costly: 0, clean: 0 });
const SCOPE = 'this call · random style · 400 runs';

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}

describe('simLint', () => {
  const s = open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1');
  const graph = callGraph(s.tree, { counts: s.counts, seed: s.resolved.spec!.seed, situation: s.situation, clockMarks: clockMarksOf(s.instance.clocks), clockNexts: sessionClockNexts(s) });
  const reach = truthReach(graph, s.tree);
  const nodes = graph.vertices.filter(v => v.kind === 'node' && v.inCall && reach.has(v.id)).map(v => v.treeId);
  const endings = graph.vertices.filter(v => v.kind === 'ending' && v.inCall && reach.has(v.id) && v.treeId !== 'handed_over').map(v => v.treeId);
  const [unvisited, ...visited] = nodes;
  const [unreached, ...reachedEndings] = endings;

  /** Every reachable node visited but one, every ending reached but one. */
  function tally(over: Partial<ReachTally> = {}): ReachTally {
    return {
      runs: 400, visits: Object.fromEntries(visited.map(node => [node, 50])), choices: {}, edges: {}, nodeEdges: {},
      endings: Object.fromEntries(reachedEndings.map(ending => [ending, { n: 20, weights: WEIGHTS() }])), weights: WEIGHTS(),
      keysSet: {}, locked: {}, odds: {}, flatVisits: {}, nodeFate: {}, stuck: 0, minutes: 0, officerHurt: 0, runWeights: [], ...over,
    };
  }

  it('reports reachable nodes and endings no run reached, and nothing else on a clean tally', () => {
    const found = simLint(tally(), graph, SCOPE, s.tree);
    expect(found.map(f => f.id).sort()).toEqual([`never_reached:ending:${unreached}`, `never_reached:node:${unvisited}`].sort());
    for (const finding of found) {
      expect(finding).toMatchObject({ code: 'never_reached', severity: 'warn' });
      expect(finding.message).toContain(SCOPE);
      expect(finding.message).toContain('400 runs');
    }
    // Vertices this call can't reach (another turn, another truth) and the fallback ending are never reported.
    const pruned = graph.vertices.filter(v => !v.inCall || !reach.has(v.id)).map(v => v.treeId);
    expect(found.some(f => pruned.includes(f.node ?? f.ending ?? ''))).toBe(false);
    expect(found.some(f => f.ending === 'handed_over')).toBe(false);
    expect(simLint(tally({ runs: 0 }), graph, SCOPE, s.tree)).toEqual([]);
  });

  it('reports a choice locked in every visit, with its most common reason', () => {
    const found = simLint(tally({ locked: {
      'talking/take_account': { offered: 37, locked: 37, reasons: { 'Needs a crisis negotiator': 30, 'Command refuses': 7 } },
      'talking/write_now': { offered: 40, locked: 12, reasons: { x: 12 } },
      t13_hostage_crisis_going_live_on_stream: { offered: 5, locked: 5, reasons: {} },
    } }), graph, SCOPE, s.tree).filter(f => f.code === 'locked_for_squad');
    expect(found.map(f => f.id).sort()).toEqual(['locked_for_squad:going_live/on_stream', 'locked_for_squad:talking/take_account']);
    const account = found.find(f => f.id.endsWith('take_account'))!;
    expect(account).toMatchObject({ severity: 'info', node: 'talking', sites: [{ node: 'talking', choice: 'take_account', field: 'engine' }] });
    expect(account.message).toContain('37 visits');
    expect(account.message).toContain('Needs a crisis negotiator');
  });

  it('reports a node flat in most of its visits, and stuck runs', () => {
    const [node] = visited;
    const found = simLint(tally({ flatVisits: { [node]: 30, [visited[1]]: 10 }, stuck: 3 }), graph, SCOPE, s.tree);
    expect(found.filter(f => f.code === 'flat_odds').map(f => f.node)).toEqual([node]);
    const stuck = found.find(f => f.code === 'stuck_runs')!;
    expect(stuck).toMatchObject({ id: 'stuck_runs:call', severity: 'warn' });
    expect(stuck.message).toMatch(/^3 of 400 runs stopped without an ending/);
  });

  it('without the tree, counts every vertex in the call as reachable', () => {
    const outOfTruth = graph.vertices.filter(v => v.kind === 'node' && v.inCall && !reach.has(v.id)).map(v => v.treeId);
    const found = simLint(tally(), graph, SCOPE).filter(f => f.code === 'never_reached').map(f => f.node).filter(Boolean);
    expect(found).toEqual(expect.arrayContaining([unvisited, ...outOfTruth]));
  });
});
