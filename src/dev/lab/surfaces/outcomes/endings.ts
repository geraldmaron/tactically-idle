// What the Outcomes ending cards say (spec 3.4), as pure data: every written ending, grouped by how
// the runs that ended there scored (clean on top, death at the bottom), each with its reach in the
// surface's population and in this type, the run-class mix, the shortest path, and whether the debrief
// scored it other than the author wrote it. Endings this call can't reach are ghosts with the reason
// from the graph, never hidden; reachable endings no run reached keep a normal card with "0 of n".
import type { CallTree } from '../../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { clockMarksOf, clockNextsOf } from '../../../../gen/incident/instance';
import { countCombos } from '../../../../gen/incident/trees-v13/dependencies';
import type { DrawWant } from '../../model/seek';
import { WEIGHTS } from '../../../../gen/incident/trees-v13/balance';
import type { Distribution, Weight } from '../../../../gen/incident/trees-v13/balance';
import { callGraph, truthReach } from '../../../../gen/incident/trees-v13/graph';
import type { CallGraph } from '../../../../gen/incident/trees-v13/graph';
import type { ReachTally } from '../../jobs/tally';
import { dominant } from '../../model/flow-layout';
import { pairedDelta, wilson } from '../../model/stats';
import type { PairedDelta } from '../../model/stats';
import { pairedRuns } from '../../jobs/tally';

export interface EndingCard {
  id: string; disposition: string;
  /** card: reachable in this call (or every ending, for this type); ghost: this call can't reach it. */
  kind: 'card' | 'ghost';
  /** The group it sits in: the run class most runs that ended here had; before any run, the authored class. */
  group: Weight;
  n: number; runs: number; p: number; ci: [number, number];
  /** Share of this type's runs (same style), when that population has run. */
  typeShare: { n: number; runs: number } | null;
  mix: Record<Weight, number> | null;
  /** Fewest picks to get here (the explorer's shortest path), null until it has walked the call. */
  shortest: number | null;
  /** "needs situation 2", "needs others ≥ 1; this call has 0". */
  reason: string | null;
  /** Situations (0-based) in which this call's draw could reach it, for a situation ghost's fix. */
  situations: number[];
  /** "Authored resolved; 12 of 40 runs here scored unresolved." */
  scored: string | null;
}

const zero = (): Record<Weight, number> => ({ death: 0, hurt: 0, unresolved: 0, costly: 0, clean: 0 });
const RANK = Object.fromEntries(WEIGHTS.map((w, i) => [w, i])) as Record<Weight, number>;

/** One card per written ending, in display order: groups clean first, then by share, then tree order;
 * ghosts last. `bySituation[s]`: what this call's draw reaches if the situation were s (truthReach of
 * the call graph with that situation), to tell a situation ghost from a draw ghost. */
export function endingCards(input: { tree: CallTree; graph: CallGraph; tally: ReachTally | null; typeTally: ReachTally | null; scope: 'call' | 'step' | 'type';
  endingClass: Readonly<Record<string, Weight>>; shortest: Readonly<Record<string, string>> | null; bySituation: readonly ReadonlySet<string>[] | null }): EndingCard[] {
  const { tree, graph, tally, typeTally, scope, endingClass, shortest, bySituation } = input;
  const runs = tally?.runs ?? 0;
  const reach = scope === 'type' ? null : truthReach(graph, tree);
  const cards = Object.entries(tree.endings).map(([id, ending], order): EndingCard & { order: number } => {
    const vertex = graph.vertices.find(v => v.id === `ending:${id}`);
    const reached = tally?.endings[id];
    const n = reached?.n ?? 0;
    // The exhausted-choices fallback has no authored route in, and is in every call.
    const inCall = scope === 'type' || (!!vertex?.inCall && (id === 'handed_over' || !!reach?.has(`ending:${id}`)));
    const situations = bySituation ? [0, 1, 2].filter(s => bySituation[s]?.has(`ending:${id}`)) : [];
    let reason: string | null = null;
    if (!inCall) {
      if (vertex && !vertex.inCall) reason = vertex.pruned ?? 'Not in this call.';
      else if (situations.length) reason = `needs situation ${situations.map(s => s + 1).join(' or ')}; this call drew another`;
      else reason = 'This call’s situation never reaches it.';
    }
    const mix = reached && reached.n > 0 ? { ...zero(), ...reached.weights } : null;
    const group = mix ? dominant(mix) : endingClass[id] ?? 'unresolved';
    const typeN = typeTally?.endings[id]?.n ?? 0;
    const unresolvedHere = mix ? mix.unresolved : 0;
    const scored = mix && ending.disposition === 'resolved' && unresolvedHere > 0
      ? `Authored resolved; ${unresolvedHere} of ${n} runs here scored unresolved.` : null;
    const path = shortest?.[id];
    return {
      id, order, disposition: ending.disposition, kind: inCall ? 'card' : 'ghost', group, n, runs, p: runs ? n / runs : 0, ci: wilson(n, runs),
      typeShare: typeTally && typeTally.runs ? { n: typeN, runs: typeTally.runs } : null, mix,
      shortest: path === undefined ? null : path ? path.split(',').filter(Boolean).length : 0, reason, situations, scored,
    };
  });
  return cards
    .sort((a, b) => Number(a.kind === 'ghost') - Number(b.kind === 'ghost') || RANK[b.group] - RANK[a.group] || b.n - a.n || a.order - b.order)
    .map(({ order: _order, ...card }) => card);
}

/** Group headings in order, with the cards under each (ghosts under their own heading). */
export function groupCards(cards: readonly EndingCard[]): { key: Weight | 'ghost'; cards: EndingCard[] }[] {
  const out: { key: Weight | 'ghost'; cards: EndingCard[] }[] = [];
  for (const card of cards) {
    const key = card.kind === 'ghost' ? 'ghost' : card.group;
    const last = out[out.length - 1];
    if (last && last.key === key) last.cards.push(card); else out.push({ key, cards: [card] });
  }
  return out;
}

/** Shares of every card plus runs that ended nowhere: what "sums to 100%" checks. */
export function shareTotal(cards: readonly EndingCard[], tally: ReachTally | null): number {
  if (!tally || !tally.runs) return 0;
  return (cards.reduce((sum, c) => sum + c.n, 0) + (tally.endings.none?.n ?? 0)) / tally.runs;
}

/** A this-type tally's distribution, as `measure` reports it. */
export function weightsOf(d: Distribution | null): Record<Weight, number> | null {
  return d ? { ...zero(), ...d.weights } : null;
}

/** Paired change of each run class between a baseline tally and now (same runs, so same k): the
 * shares move by mean ± 1.96·sd/√n. Null when the two can't be paired (different run counts). */
export function baselineDeltas(before: ReachTally, after: ReachTally): Record<Weight, PairedDelta> | null {
  if (before.runs !== after.runs || before.runWeights.length !== after.runWeights.length) return null;
  return Object.fromEntries(WEIGHTS.map(w => {
    const pairs = pairedRuns(before, after, weight => weight === w);
    return [w, pairedDelta(pairs.before, pairs.after)];
  })) as Record<Weight, PairedDelta>;
}

/** The smallest change to this call's draw (group sizes, turns, situation) under which the compiler
 * keeps `ending` in the call and its hidden truth can reach it, or null when no draw does. Read from
 * the graph alone (a turn is pinned by narrowing its group to one member), so no call is generated;
 * seekCallSeed then finds a call seed with that draw. */
export function drawFor(template: IncidentTemplate, ending: string, current: { counts: Record<string, number>; turns: Record<string, string>; situation: 0 | 1 | 2 }): DrawWant | null {
  const tree = template.tree;
  const groups = Object.entries(tree.turns ?? {});
  let turnCombos: Record<string, string>[] = [{}];
  for (const [group, members] of groups) turnCombos = turnCombos.flatMap(combo => members.map(member => ({ ...combo, [group]: member })));
  const candidates: { counts: Record<string, number>; turns: Record<string, string>; situation: 0 | 1 | 2; changes: number }[] = [];
  for (const counts of countCombos(template)) for (const turns of turnCombos) for (const situation of [0, 1, 2] as const) {
    const changes = Object.keys(counts).filter(g => counts[g] !== current.counts[g]).length + Object.keys(turns).filter(g => turns[g] !== current.turns[g]).length
      + (situation !== current.situation ? 1 : 0);
    candidates.push({ counts, turns, situation, changes });
  }
  candidates.sort((a, b) => a.changes - b.changes);
  for (const c of candidates) {
    const narrowed: CallTree = { ...tree, turns: Object.fromEntries(groups.map(([group]) => [group, [c.turns[group]]])) };
    const clocks = template.situations.find(entry => entry.index === c.situation)?.clocks ?? [];
    const graph = callGraph(narrowed, { counts: c.counts, seed: 0, situation: c.situation, clockMarks: clockMarksOf(clocks), clockNexts: clockNextsOf(clocks) });
    const id = `ending:${ending}` as const;
    if (!graph.vertices.find(v => v.id === id)?.inCall || !truthReach(graph, narrowed).has(id)) continue;
    const want: DrawWant = {};
    if (c.situation !== current.situation) want.variant = c.situation;
    if (Object.keys(c.counts).some(g => c.counts[g] !== current.counts[g])) want.counts = c.counts;
    if (Object.keys(c.turns).some(g => c.turns[g] !== current.turns[g])) want.turns = c.turns;
    return want;
  }
  return null;
}
