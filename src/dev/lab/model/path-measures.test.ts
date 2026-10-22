// The path measures (path-measures.ts) against subjects the tooling owns (COORDINATION.md, "Tests
// across lanes"): hand-made paths for the counting rules, and the paths fixture (trees-v13/
// paths-fixture.ts) played through the real engine, built once with every defect and once clean.
// Each measure must flag the defective call and stay quiet on the clean one. No test reads a shipped
// call's content.
import { describe, expect, it } from 'vitest';
import { compileFixtureCall } from '../../../gen/incident/gates/fixture-call';
import { withDraftScenario } from '../../../gen/incident/gates/engine-driver';
import { POLICIES } from '../../../gen/incident/trees-v13/balance';
import { PATHS_FIXTURE, pathsFixture } from '../../../gen/incident/trees-v13/paths-fixture';
import { choiceActionId } from '../../../gen/incident/trees-v13/compile';
import { dominanceNodes, playedPaths, uniformPaths } from './path-collect';
import {
  adverseNamed, adverseRoutes, authoredAdverseInto, beatenRows, echoSummary, factReach, oddsDominated, pathEchoes, sharedRuns, twoTails, words,
} from './path-measures';
import type { DominanceNode, PathRecord, PathStep } from './path-measures';
import type { DilemmaRow } from './dilemma';
import { fixtureSession } from './session';

const step = (over: Partial<PathStep> = {}): PathStep => ({ node: 'a', stage: 'assess', choice: 'c', band: 'favorable', to: 'b', prompt: '', lines: [], revealed: [], ...over });
const path = (steps: PathStep[], over: Partial<PathRecord> = {}): PathRecord => ({ source: 'uniform', scenarioId: 'x', steps, ending: null, knowledge: {}, names: [], ...over });

describe('adverse routes into a named node', () => {
  const adverseInto = (node: string) => step({ band: 'adverse', to: node });
  it('flags a node that bad results send one path to three times', () => {
    const rows = adverseRoutes([path([adverseInto('trap'), step(), adverseInto('trap'), adverseInto('trap')]), path([adverseInto('trap')])], pathsFixture(true).tree);
    expect(rows).toMatchObject([{ node: 'trap', max: 3, paths: 2, mean: 2, atLeast2: 0.5, atLeast3: 0.5, flagged: true }]);
  });
  it('does not flag bad results that land in different nodes, or a node twice', () => {
    const rows = adverseRoutes([path([adverseInto('x'), adverseInto('y'), adverseInto('x')])], pathsFixture(false).tree);
    expect(rows.map(row => [row.node, row.max, row.flagged])).toEqual([['x', 2, false], ['y', 1, false]]);
  });
  it('counts only bad results, and only into nodes', () => {
    expect(adverseRoutes([path([step({ band: 'mixed', to: 'trap' }), step({ band: 'adverse', to: 'end:left' })])], pathsFixture(true).tree)).toEqual([]);
  });
  it('reads the authored routes from the tree', () => {
    const into = authoredAdverseInto(pathsFixture(true).tree).get('trap');
    expect(into?.outcomes).toBe(3);
    expect([...into!.choices].sort()).toEqual(['middle/ask', 'middle/easy', 'middle/press']);
    expect(authoredAdverseInto(pathsFixture(false).tree).has('trap')).toBe(false);
  });
  it('counts the sentence a player reads separately from where it routes', () => {
    const said = step({ band: 'adverse', lines: ['The handgun comes up on the manager.'] });
    expect(adverseNamed([path([said, said, said])], /handgun/)).toMatchObject([{ max: 3, flagged: true }]);
    expect(adverseNamed([path([said, step({ band: 'mixed', lines: ['The handgun rises.'] })])], /handgun/)).toMatchObject([{ max: 1, flagged: false }]);
  });
});

describe('fact reach per source', () => {
  const settled = (status: string) => step({ revealed: [{ fact: 'f_x', status }] });
  it('flags a style that never settles the fact', () => {
    const best = path([step()], { source: 'played:best_odds' }), random = path([settled('confirmed')], { source: 'played:random', knowledge: { f_x: 'confirmed' } });
    const rows = factReach([best, random], ['f_x']);
    expect(rows.find(row => row.source === 'played:best_odds')).toMatchObject({ share: 0, flagged: true });
    expect(rows.find(row => row.source === 'played:random')).toMatchObject({ share: 1, flagged: false, firstBy: { 'a/c/favorable': 1 } });
  });
  it('counts confirmed and disproved, not reported', () => {
    const rows = factReach([path([], { knowledge: { f_x: 'disproved' } }), path([], { knowledge: { f_x: 'reported' } })], ['f_x']);
    expect(rows[0]).toMatchObject({ reached: 1, share: 0.5 });
  });
});

describe('four-word echoes', () => {
  const line = 'The line goes dead and the shop stays quiet.';
  it('finds a sentence told at two stages once, at its longest', () => {
    const echoes = pathEchoes(path([step({ lines: [line] }), step({ stage: 'resolve', lines: [line] })]));
    expect(echoes).toMatchObject([{ run: 'the line goes dead and the shop stays quiet', crossStage: true }]);
  });
  it('is quiet inside one step, and for names, function words and fixed proper nouns', () => {
    expect(pathEchoes(path([step({ lines: [line, line] })]))).toEqual([]);
    const names = ['Ruth', 'Tatum'];
    // A name is masked, so it neither makes an echo nor hides one: the same sentence about two people repeats.
    expect(pathEchoes(path([step({ lines: ['Ruth waits at the door.'] }), step({ stage: 'resolve', lines: ['Tatum waits at the door.'] })], { names })))
      .toMatchObject([{ run: '§ waits at the door' }]);
    expect(pathEchoes(path([step({ lines: ['It was then that it was.'] }), step({ stage: 'resolve', lines: ['It was then that it was.'] })]))).toEqual([]);
    expect(pathEchoes(path([step({ lines: ['Ruth waits.'] }), step({ stage: 'resolve', lines: ['Tatum waits.'] })], { names }))).toEqual([]);
    expect(words('Ruth looks at the Metro 6 camera, then Ruth’s phone.', new Set(['ruth']))).toEqual(['§', 'looks', 'at', 'the', '§', '§', 'camera', 'then', '§', 'phone', '|']);
  });
  it('separates echoes inside a stage from echoes across stages', () => {
    const inside = echoSummary([path([step({ lines: [line] }), step({ lines: [line] })])])[0];
    expect(inside).toMatchObject({ withEcho: 1, withCrossStage: 0, flagged: false });
    const across = echoSummary([path([step({ lines: [line] }), step({ stage: 'adapt', lines: [line] })]), path([step()])])[0];
    expect(across).toMatchObject({ withEcho: 1, withCrossStage: 1, shareCrossStage: 0.5, flagged: true });
  });
  it('finds maximal shared runs, not every window', () => {
    expect(sharedRuns(words('one two three four five six', new Set()), words('x one two three four five y', new Set()))).toEqual(['one two three four five']);
    expect(sharedRuns(words('one two three', new Set()), words('one two three', new Set()))).toEqual([]);
    // two sentences that each share three words with one sentence of the other string are not one run
    expect(sharedRuns(words('one two three. four five six', new Set()), words('one two three four five six', new Set()))).toEqual([]);
    expect(sharedRuns(words('walks across the dark yard fast', new Set()), words('then walks across the dark yard again', new Set()))).toEqual(['walks across the dark yard']);
  });
});

describe('dominance rows', () => {
  const row = (id: string, favorable: number, adverse: number, minutes: number, over: Partial<DilemmaRow> = {}): DilemmaRow => ({
    actionId: id, favorable, adverse, minutes, writes: [], closes: [], adverseHarm: [], adverseTo: null, costSeen: { summary: id, adversePreview: id }, flags: [], ...over });
  const node = (rows: DilemmaRow[]): DominanceNode => ({ situation: 0, node: 'n', at: 'first', arrivals: 1, rows, titles: {} });
  it('lists an option the odds put behind another, with what the loser still has', () => {
    const found = oddsDominated(node([row('a', 0.85, 0.04, 5), row('b', 0.6, 0.08, 4, { writes: ['mark:glance'] })]));
    expect(found).toEqual([{ winner: 'a', loser: 'b', wellGap: 25, badGap: 4, loserEdges: ['1 min faster', 'unlocks glance'] }]);
  });
  it('lists nothing when the odds are within the flat margin or trade off', () => {
    expect(oddsDominated(node([row('a', 0.62, 0.08, 5), row('b', 0.6, 0.08, 4)]))).toEqual([]);
    expect(oddsDominated(node([row('a', 0.8, 0.2, 5), row('b', 0.5, 0.05, 5)]))).toEqual([]);
  });
  it('flags a coin with two tails', () => {
    expect(twoTails(node([row('a', 0.03, 0.8, 5), row('b', 0.03, 0.9, 6)]))).toBe(true);
    expect(twoTails(node([row('a', 0.03, 0.8, 5), row('b', 0.5, 0.2, 6)]))).toBe(false);
    expect(twoTails(node([row('a', 0.03, 0.8, 5)]))).toBe(false);
  });
});

// ---------------------------------------------------------------- the fixture, played

interface Measured { adverse: ReturnType<typeof adverseRoutes>; reach: ReturnType<typeof factReach>; echoes: ReturnType<typeof echoSummary>; nodes: DominanceNode[] }

function measure(defects: boolean): Measured {
  const template = pathsFixture(defects), scenario = compileFixtureCall(template, 0);
  return withDraftScenario(scenario, id => {
    const session = fixtureSession(template, id);
    const calls = Array.from({ length: 30 }, (_, i) => ({ scenarioId: id, seed: i + 1 }));
    const played = playedPaths(template.tree, calls, POLICIES);
    const uniform = uniformPaths(session, 400);
    return { adverse: adverseRoutes([...played, ...uniform], template.tree), reach: factReach([...played, ...uniform], [PATHS_FIXTURE.fact]),
      echoes: echoSummary([...played, ...uniform]), nodes: dominanceNodes(session, 2000).nodes };
  });
}

describe('the paths fixture, played through the engine', () => {
  const bad = measure(true), clean = measure(false);
  const slow = choiceActionId('hostage_crisis', PATHS_FIXTURE.root, PATHS_FIXTURE.slow);

  it('adverse routes: the loop through the trap sends one path there three times; the clean call does not', () => {
    expect(bad.adverse.find(row => row.node === PATHS_FIXTURE.trap && row.source === 'uniform')).toMatchObject({ max: 3, flagged: true });
    expect(clean.adverse.filter(row => row.flagged)).toEqual([]);
  });
  it('fact reach: best odds never settles the fact behind the hardest choices; the clean call settles it in every style', () => {
    expect(bad.reach.find(row => row.source === 'played:best_odds')).toMatchObject({ reached: 0, flagged: true });
    expect(bad.reach.find(row => row.source === 'uniform')!.share).toBeGreaterThan(0);
    for (const row of clean.reach) expect(row, row.source).toMatchObject({ flagged: false });
    expect(clean.reach.find(row => row.source === 'played:best_odds')!.share).toBeGreaterThan(0);
  });
  it('dominance: the slower copy of the same call is beaten at the first arrival; the clean call has nothing beaten, behind or flat', () => {
    const first = bad.nodes.find(node => node.node === PATHS_FIXTURE.root && node.at === 'first')!;
    expect(beatenRows(first).map(row => row.actionId)).toEqual([slow]);
    expect(bad.nodes.filter(node => beatenRows(node).length).map(node => node.node)).toContain(PATHS_FIXTURE.root);
    for (const node of clean.nodes) {
      expect(beatenRows(node), `${node.node} ${node.at}`).toEqual([]);
      expect(oddsDominated(node), `${node.node} ${node.at}`).toEqual([]);
    }
  });
  it('echoes: the line told at the start and at the door is a cross-stage echo; the clean call tells nothing twice', () => {
    expect(bad.echoes.find(row => row.source === 'uniform')).toMatchObject({ flagged: true });
    expect(bad.echoes.some(row => row.top.some(top => top.run.includes(PATHS_FIXTURE.echo)))).toBe(true);
    expect(clean.echoes.filter(row => row.flagged)).toEqual([]);
  });
});
