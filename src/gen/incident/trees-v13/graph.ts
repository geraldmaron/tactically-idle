// A call tree as a graph: nodes, endings and turn hubs, each choice, and every band's edge with how
// it is reached (next, a drawn force or cascade result, a turn), what conditions it, and whether
// this call can take it. Shared by the tree tests, the reach tally and the Scenario Lab's Flow.
//
// "In this call" is the compiler's own reading (compile.ts): nodes reachable after the count
// conditions settle and the turns draw (reachableNodes), choices and outcomes the settable-mark
// pruning keeps (prunePlan), and the routes a force or cascade can take with this many people.
// The situation's hidden truth never removes anything: a fact condition says whether it holds.
import type { CallTree, TreeIf, TreeNext, TreeNode, TreeOutcome, TreeState } from '../../../content/call-trees/types';
import { cascadeResult, type CascadeState } from '../drawn-model';
import type { MeterStance } from '../../../sim/scenario-types';
import type { OutcomeBand, StageId } from '../../../sim/types';
import { choiceActionId, countHolds, nodeNexts, prunePlan, resolveNext, timeoutNexts, type PrunePlan } from './compile';
import { sentenceCase } from './dependencies';

export type VertexId = `node:${string}` | `ending:${string}` | `turn:${string}`;
/** A node, an ending, or a turn hub (`members`: the nodes it draws one of). */
export interface GraphVertex { id: VertexId; kind: 'node' | 'ending' | 'turn'; treeId: string; stage?: StageId; members?: string[]; inCall: boolean; pruned?: string }
export interface GraphChoice { node: string; choice: string; actionId: string; inCall: boolean; pruned?: string }
/** What an edge needs besides its band. A fact reads the situation's hidden truth (`holds` for this
 * call's situation, when one is given); a clock is read `is` low or out at the end of the choice's
 * minutes; a meter at the start of the decision; a state is the outcome's `when`. */
export type EdgeCondition = { kind: 'fact'; fact: string; is: boolean; holds?: boolean } | { kind: 'clock'; clock: string; when: 'low' | 'out'; is: boolean }
  | { kind: 'meter'; role: string; stance?: MeterStance[]; agitationAtLeast?: number; is?: boolean } | { kind: 'state'; state: TreeState };
/** One route of one outcome. `outcome` is the index in the authored band list. `via`: `next` (an
 * authored route, or a cascade in a call with nobody to follow), `turn` (into a turn hub), `force`
 * or `cascade` (one drawn result each). */
export interface GraphEdge { id: string; node: string; choice: string; band: OutcomeBand; outcome: number; to: VertexId;
  via: 'next' | 'force' | 'cascade' | 'turn'; drawn?: 'fatal' | 'hurt' | 'none' | 'all' | 'some'; conditions: EdgeCondition[]; inCall: boolean; pruned?: string }
/** `turnDrawn`: the node each turn group drew in this call, or null without a seed. */
/** `clockRoutes`: where a clock running out sends the call, from any node (R-G4). They aren't edges,
 * since no choice takes them: they mark a node or ending in the call and seed truthReach. */
/** `timeoutRoutes`: where a threat running out with no choice made sends the call from its node
 * (TreeTimeout). No choice takes them either, so they aren't edges; truthReach follows them. */
export interface TimeoutRoute { node: string; to: VertexId; inCall: boolean }
export interface CallGraph { root: string; vertices: GraphVertex[]; choices: GraphChoice[]; edges: GraphEdge[]; turnDrawn: Record<string, string | null>; clockRoutes?: VertexId[]; timeoutRoutes?: TimeoutRoute[] }

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const vertexOf = (next: TreeNext): VertexId => 'node' in next ? `node:${next.node}` : 'ending' in next ? `ending:${next.ending}` : `turn:${next.turn}`;

/** Where a `next` lands in this graph: a node or ending, a turn resolved by `seed` (every member without one). */
function landing(tree: CallTree, next: TreeNext, seed: number | undefined): string[] {
  return 'turn' in next ? seed !== undefined ? [(resolveNext(tree, next, seed) as { node: string }).node] : tree.turns?.[next.turn] ?? [] : 'node' in next ? [next.node] : [];
}

/** The nodes a call reaches from the root as the compiler walks it: every route an outcome can take
 * with these group sizes, each turn resolved by `seed` (every member without one), and where a clock
 * running out sends it (`clockNexts`, reached from any node). */
function reachable(tree: CallTree, counts: Record<string, number> | undefined, seed: number | undefined, clockNexts: readonly TreeNext[]): Set<string> {
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const fromClocks = clockNexts.flatMap(next => landing(tree, next, seed));
  const seen = new Set([tree.root, ...fromClocks]);
  for (const queue = [tree.root, ...fromClocks]; queue.length;) {
    const node = byId.get(queue.shift()!);
    for (const next of node ? nodeNexts(node, counts) : []) for (const id of landing(tree, next, seed)) if (!seen.has(id)) { seen.add(id); queue.push(id); }
  }
  return seen;
}

function conditionsOf(tree: CallTree, outcome: TreeOutcome, situation: 0 | 1 | 2 | undefined): EdgeCondition[] {
  const ifs = ([] as TreeIf[]).concat(outcome.if ?? []).map((entry): EdgeCondition => {
    if ('fact' in entry) {
      const truth = situation === undefined ? undefined : tree.facts[entry.fact]?.truth ?? tree.situations[situation]?.truth[entry.fact];
      return { kind: 'fact', fact: entry.fact, is: entry.is, ...truth !== undefined ? { holds: truth === entry.is } : {} };
    }
    if ('low' in entry) return { kind: 'clock', clock: entry.clock, when: 'low', is: entry.low };
    if ('out' in entry) return { kind: 'clock', clock: entry.clock, when: 'out', is: entry.out };
    return { kind: 'meter', role: entry.meter, ...entry.stance !== undefined ? { stance: ([] as MeterStance[]).concat(entry.stance) } : {},
      ...entry.agitationAtLeast !== undefined ? { agitationAtLeast: entry.agitationAtLeast } : {}, is: entry.is ?? true };
  });
  return [...ifs, ...outcome.when ? [{ kind: 'state' as const, state: outcome.when }] : []];
}

/** Every route of one outcome, with the drawn result it needs and why this call can't take it. */
function routesOf(outcome: TreeOutcome, counts: Record<string, number> | undefined): { next: TreeNext; via: GraphEdge['via']; drawn?: GraphEdge['drawn']; pruned?: string }[] {
  if (outcome.next) return [{ next: outcome.next, via: 'turn' in outcome.next ? 'turn' : 'next' }];
  if (outcome.force) {
    const { next, noFatal } = outcome.force;
    // A fatal result routes where `fatal` says, else with the hurt (compile.ts drawnFor).
    return [...noFatal ? [] : [{ next: next.fatal ?? next.hurt, via: 'force' as const, drawn: 'fatal' as const }],
      { next: next.hurt, via: 'force', drawn: 'hurt' }, { next: next.none, via: 'force', drawn: 'none' }];
  }
  if (outcome.cascade) {
    const { next, group } = outcome.cascade;
    const n = counts?.[group];
    const short = (need: number) => n !== undefined && n < need ? `needs ${group} ≥ ${need}; this call has ${n}` : undefined;
    // With nobody to follow, the compiler makes the cascade a plain route to `all`.
    if (n === 0) return [{ next: next.all, via: 'next' }, { next: next.some, via: 'cascade', drawn: 'some', pruned: short(2) }, { next: next.none, via: 'cascade', drawn: 'none', pruned: short(1) }];
    return [{ next: next.all, via: 'cascade', drawn: 'all' }, { next: next.some, via: 'cascade', drawn: 'some', pruned: short(2) }, { next: next.none, via: 'cascade', drawn: 'none', pruned: short(1) }];
  }
  return [];
}

/** The graph of a tree, for one call when `counts` (memberCounts of its placement), `seed` (its
 * spec seed, for the turns), `clockMarks` (clockMarksOf its clocks) and `clockNexts` (clockNextsOf
 * its clocks; templateClockNexts for the authored structure) are given; the authored structure
 * without them. `situation` fills in whether each fact condition holds. */
export function callGraph(tree: CallTree, opts: { counts?: Record<string, number>; seed?: number; situation?: 0 | 1 | 2; clockMarks?: readonly string[]; clockNexts?: readonly TreeNext[] } = {}): CallGraph {
  const { counts, seed, situation, clockMarks = [], clockNexts = [] } = opts;
  const reach = reachable(tree, counts, seed, clockNexts);
  // Without group sizes nothing can be pruned: the pruning needs to know who is there.
  const plan: PrunePlan | null = counts ? prunePlan(tree, counts, clockMarks, seed, clockNexts) : null;
  const clockRoutes = [...new Set(clockNexts.flatMap((next): VertexId[] => 'ending' in next ? [`ending:${next.ending}`] : landing(tree, next, seed).map(id => `node:${id}` as VertexId)))];
  const turnDrawn = Object.fromEntries(Object.keys(tree.turns ?? {}).map(group => [group, seed === undefined ? null : (resolveNext(tree, { turn: group }, seed) as { node: string }).node]));
  const dropped = (state: TreeState | undefined) => counts && !countHolds(state, counts) || plan && !plan.possible(state) ? plan?.why(state) ?? 'never true in this call' : undefined;

  const choices: GraphChoice[] = [], edges: GraphEdge[] = [];
  for (const node of tree.nodes) for (const choice of node.choices) {
    const pruned = !reach.has(node.id) ? 'at a node this call doesn’t reach' : dropped(choice.onlyIf);
    choices.push({ node: node.id, choice: choice.id, actionId: choiceActionId(tree.type, node.id, choice.id), inCall: !pruned, ...pruned ? { pruned } : {} });
    for (const band of BANDS) choice.outcomes[band].forEach((outcome, index) => {
      const kept = pruned ?? dropped(outcome.when);
      for (const route of routesOf(outcome, counts)) {
        const why = kept ?? route.pruned;
        edges.push({ id: `${node.id}/${choice.id}/${band}/${index}/${route.via}${route.drawn ? `.${route.drawn}` : ''}`, node: node.id, choice: choice.id, band, outcome: index,
          to: vertexOf(route.next), via: route.via, ...route.drawn ? { drawn: route.drawn } : {}, conditions: conditionsOf(tree, outcome, situation), inCall: !why, ...why ? { pruned: why } : {} });
      }
    });
  }

  const timeoutRoutes: TimeoutRoute[] = tree.nodes.flatMap(node => timeoutNexts(node).map(next => ({ node: node.id, to: vertexOf(next), inCall: reach.has(node.id) })));

  // Why a vertex is out of this call: its turn drew another node, or every edge into it is out.
  const outReason = (id: VertexId, member?: string): string => {
    if (member) for (const [group, nodes] of Object.entries(tree.turns ?? {})) if (nodes.includes(member) && turnDrawn[group] && turnDrawn[group] !== member)
      return `not drawn here (this call drew ${sentenceCase(turnDrawn[group]!).toLowerCase()})`;
    const sources = edges.filter(edge => edge.to === id || (member && edge.to.startsWith('turn:') && tree.turns?.[edge.to.slice(5)]?.includes(member)));
    if (!sources.length && timeoutRoutes.some(route => route.to === id)) return 'only reached when time runs out at a node this call doesn’t reach';
    if (!sources.length) return clockNexts.length ? 'no choice or clock leads here' : 'no choice leads here';
    const near = sources.find(edge => reach.has(edge.node) && edge.pruned);
    return near ? `only reached by routes this call drops (${near.pruned})` : 'only reached from nodes this call doesn’t reach';
  };
  const vertices: GraphVertex[] = [
    ...tree.nodes.map((node): GraphVertex => {
      const inCall = reach.has(node.id);
      return { id: `node:${node.id}`, kind: 'node', treeId: node.id, stage: node.stage, inCall, ...inCall ? {} : { pruned: outReason(`node:${node.id}`, node.id) } };
    }),
    ...Object.entries(tree.turns ?? {}).map(([group, members]): GraphVertex => {
      const inCall = edges.some(edge => edge.inCall && edge.to === `turn:${group}`) || timeoutRoutes.some(route => route.inCall && route.to === `turn:${group}`);
      return { id: `turn:${group}`, kind: 'turn', treeId: group, members: [...members], inCall, ...inCall ? {} : { pruned: outReason(`turn:${group}`) } };
    }),
    ...Object.keys(tree.endings).map((ending): GraphVertex => {
      // The exhausted-choices fallback is in every call (compile.ts).
      const inCall = ending === 'handed_over' || clockRoutes.includes(`ending:${ending}`) || edges.some(edge => edge.inCall && edge.to === `ending:${ending}`)
        || timeoutRoutes.some(route => route.inCall && route.to === `ending:${ending}`);
      return { id: `ending:${ending}`, kind: 'ending', treeId: ending, inCall, ...inCall ? {} : { pruned: outReason(`ending:${ending}`) } };
    }),
  ];
  return { root: tree.root, vertices, choices, edges, turnDrawn, clockRoutes, ...timeoutRoutes.length ? { timeoutRoutes } : {} };
}

/** Vertices reachable from the root, or from where a clock sends the call, over in-call edges whose
 * fact conditions hold in the graph's situation: what a call with this hidden truth can still reach
 * (clock timing, meters and marks aside). */
export function truthReach(graph: CallGraph, tree: CallTree): ReadonlySet<VertexId> {
  const start: VertexId[] = [`node:${graph.root}`, ...graph.clockRoutes ?? []];
  const seen = new Set<VertexId>(start);
  for (const queue: VertexId[] = [...start]; queue.length;) {
    const at = queue.shift()!;
    const out = at.startsWith('turn:')
      ? (tree.turns?.[at.slice(5)] ?? []).filter(id => graph.turnDrawn[at.slice(5)] === null || graph.turnDrawn[at.slice(5)] === id).map(id => `node:${id}` as VertexId)
      : [...graph.edges.filter(edge => `node:${edge.node}` === at && edge.inCall && edge.conditions.every(c => c.kind !== 'fact' || c.holds !== false)).map(edge => edge.to),
        ...(graph.timeoutRoutes ?? []).filter(route => `node:${route.node}` === at && route.inCall).map(route => route.to)];
    for (const id of out) if (!seen.has(id)) { seen.add(id); queue.push(id); }
  }
  return seen;
}

/** actionId → parts (ids can't be split: types, nodes and choices all contain underscores). */
export function choiceIndex(tree: CallTree): ReadonlyMap<string, { node: string; choice: string }> {
  return new Map(tree.nodes.flatMap(node => node.choices.map(choice => [choiceActionId(tree.type, node.id, choice.id), { node: node.id, choice: choice.id }] as const)));
}

/** A node's card title (its id in words: "Out back door") and lead (the first sentence of its
 * prompt, bound when `bind` is given). */
export function humanizeNode(node: TreeNode, bind: (text: string) => string = text => text): { title: string; lead: string } {
  const prompt = bind(node.prompt).trim();
  const first = /^.*?[.?!][’”'")\]]*(?=\s|$)/s.exec(prompt);
  return { title: sentenceCase(node.id), lead: first ? first[0] : prompt };
}

/** The graph's word for a compiled drawn result: a force variant (`firearm:serious`) is fatal, hurt
 * or none; a cascade variant (`follows+stays`) is all, some or none; incoming fire never routes. */
export function drawnRoute(model: 'incoming_fire' | 'team_force' | 'cascade', key: string): GraphEdge['drawn'] | undefined {
  if (model === 'team_force') { const severity = key.split(':')[1]; return severity === 'fatal' ? 'fatal' : severity === 'none' ? 'none' : 'hurt'; }
  if (model === 'cascade') return cascadeResult(key.split('+') as CascadeState[]);
  return undefined;
}

/** One transition as the reach tally counts it: `node/choice/band[/drawn]>to`. `to` may be a vertex
 * id (`node:x`, `ending:x`) or the tally's form (`x`, `end:x`); `drawn` the graph's word or a
 * prefixed result (`force:hurt`, `cascade:some`; `fire:*` never routes and is dropped), so a graph
 * edge and a recorded step give the same key. A turn edge's `to` is its hub: resolve it with
 * `turnDrawn` first. */
export function matchKey(e: { node: string; choice: string; band: OutcomeBand; drawn?: string; to: string }): string {
  const to = e.to.startsWith('node:') ? e.to.slice(5) : e.to.startsWith('ending:') ? `end:${e.to.slice(7)}` : e.to;
  const drawn = !e.drawn || e.drawn.startsWith('fire:') ? undefined : e.drawn.replace(/^(force|cascade):/, '');
  return `${e.node}/${e.choice}/${e.band}${drawn ? `/${drawn}` : ''}>${to}`;
}
