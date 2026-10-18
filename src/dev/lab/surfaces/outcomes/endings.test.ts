// The Outcomes ending cards: every written ending once, ghosts with the graph's reason and last,
// the fallback ending always a card, groups by the run class most runs had, shares that add up, and
// paired deltas against a baseline only when the runs pair.
import { describe, expect, it } from 'vitest';
import { clockMarksOf } from '../../../../gen/incident/instance';
import { callGraph, truthReach } from '../../../../gen/incident/trees-v13/graph';
import { emptyTally } from '../../jobs/tally';
import type { ReachTally } from '../../jobs/tally';
import { authoredEndingClass } from '../../model/flow-layout';
import { openSession } from '../../model/session';
import type { Session } from '../../model/session';
import { parseLabUrl } from '../../url';
import { baselineDeltas, drawFor, endingCards, groupCards, shareTotal } from './endings';

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}
const s = open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1');
const clockMarks = clockMarksOf(s.instance.clocks);
const graph = callGraph(s.tree, { counts: s.counts, seed: s.resolved.spec?.seed, situation: s.situation, clockMarks });
const bySituation = [0, 1, 2].map(i => new Set<string>(truthReach(callGraph(s.tree, { counts: s.counts, seed: s.resolved.spec?.seed, situation: i as 0 | 1 | 2, clockMarks }), s.tree)));
const base = { tree: s.tree, graph, typeTally: null, endingClass: authoredEndingClass(s.tree), shortest: null, bySituation };

describe('endingCards', () => {
  it('has every written ending once; this call’s unreachable ones are ghosts with a reason, after the rest', () => {
    const cards = endingCards({ ...base, tally: null, scope: 'call' });
    expect(cards.map(c => c.id).sort()).toEqual(Object.keys(s.tree.endings).sort());
    const firstGhost = cards.findIndex(c => c.kind === 'ghost');
    expect(firstGhost).toBeGreaterThan(0);
    expect(cards.slice(firstGhost).every(c => c.kind === 'ghost' && !!c.reason)).toBe(true);
    expect(cards.find(c => c.id === 'handed_over')!.kind).toBe('card');
    // Ghosts named by the draw say what it needs; situation ghosts name the situation.
    for (const c of cards.filter(card => card.kind === 'ghost')) expect(c.reason).toMatch(/needs|reach|drops|situation/);
    const situational = cards.find(c => c.kind === 'ghost' && c.situations.length > 0);
    if (situational) expect(situational.reason).toMatch(/^needs situation/);
  });
  it('this type has no ghosts: every draw counts', () => {
    expect(endingCards({ ...base, graph: callGraph(s.tree), tally: null, scope: 'type', bySituation: null }).every(c => c.kind === 'card')).toBe(true);
  });
  it('groups by how the runs that ended there scored, and the shares add up with stuck runs', () => {
    const tally: ReachTally = { ...emptyTally(), runs: 10, endings: {
      everyone_out: { n: 6, weights: { death: 0, hurt: 0, unresolved: 0, costly: 1, clean: 5 } },
      held_inside: { n: 3, weights: { death: 0, hurt: 1, unresolved: 2, costly: 0, clean: 0 } },
      none: { n: 1, weights: { death: 0, hurt: 0, unresolved: 1, costly: 0, clean: 0 } } } };
    const cards = endingCards({ ...base, tally, scope: 'call' });
    expect(cards[0]).toMatchObject({ id: 'everyone_out', group: 'clean', n: 6, p: 0.6 });
    expect(cards.find(c => c.id === 'held_inside')).toMatchObject({ group: 'unresolved', n: 3 });
    expect(shareTotal(cards, tally)).toBeCloseTo(1, 10);
    const groups = groupCards(cards);
    expect(groups[0].key).toBe('clean');
    expect(groups[groups.length - 1].key).toBe('ghost');
    expect(new Set(groups.map(g => g.key)).size).toBe(groups.length);
  });
  it('the shortest path counts picks', () => {
    const cards = endingCards({ ...base, tally: null, scope: 'call', shortest: { everyone_out: 'a~favorable,b~mixed,c~roll' } });
    expect(cards.find(c => c.id === 'everyone_out')!.shortest).toBe(3);
    expect(cards.find(c => c.id === 'held_inside')!.shortest).toBeNull();
  });
});

describe('baselineDeltas', () => {
  const tally = (weights: number[]): ReachTally => {
    const t = emptyTally();
    t.runs = weights.length;
    t.runWeights = weights;
    return t;
  };
  it('pairs run by run; the same runs give zero within noise; unpaired tallies give nothing', () => {
    const before = tally([4, 4, 2, 4, 0, 4, 2, 4]);
    const same = baselineDeltas(before, tally([4, 4, 2, 4, 0, 4, 2, 4]))!;
    expect(same.clean.mean).toBe(0);
    expect(same.clean.withinNoise).toBe(true);
    const moved = baselineDeltas(before, tally([4, 4, 4, 4, 4, 4, 4, 4]))!;
    expect(moved.clean.mean).toBeCloseTo(3 / 8, 10);
    expect(moved.unresolved.mean).toBeCloseTo(-2 / 8, 10);
    expect(baselineDeltas(before, tally([4, 4]))).toBeNull();
  });
});

describe('drawFor', () => {
  it('finds the draw that brings a dropped ending back, changing as little as it can', () => {
    const current = { counts: s.counts, turns: s.turnDrawn, situation: s.situation };
    // The reference call has nobody to follow the taker, so the group endings are dropped.
    expect(s.counts.others).toBe(0);
    const want = drawFor(s.template, 'group_out', current)!;
    expect(want).not.toBeNull();
    expect(want.counts?.others).toBeGreaterThanOrEqual(1);
    // An ending this call already reaches needs no change.
    expect(drawFor(s.template, 'everyone_out', current)).toEqual({});
  });
});
