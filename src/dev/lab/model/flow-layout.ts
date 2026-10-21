// The Flow canvas layout (spec 3.3, 9.3 "Stream F"): small local code, no graph library. Lanes run
// left to right (Assess, Adapt, Resolve, Endings). Inside a lane, nodes take longest-path ranks after
// same-stage back edges (found by a depth-first walk) are reversed; those edges draw as arcs over the
// lane. Four barycentre sweeps order each column, and the order with the fewest crossings wins (the
// input order is a candidate, so the result never crosses more than the input). Endings sit in one
// column grouped by run class (clean on top, death at the bottom), then by share.
//
// Turn hubs sit in the gutter before the nodes they draw; drawn junctions (a die: force or cascade
// results) sit in the gutter right after their source. Ribbons go node to node per result band, and
// from a node's choices when the node is expanded. With a reach tally each ribbon's width is
// 1.25 + 9·√p, p the share of runs that took it (edgeWidth). Everything here is pure and
// deterministic: the same input gives the same layout.
import type { CallTree, TreeNext, TreeOutcome } from '../../../content/call-trees/types';
import { WEIGHTS } from '../../../gen/incident/trees-v13/balance';
import type { Weight } from '../../../gen/incident/trees-v13/balance';
import { matchKey } from '../../../gen/incident/trees-v13/graph';
import type { CallGraph, GraphEdge, GraphVertex } from '../../../gen/incident/trees-v13/graph';
import type { OutcomeBand, StageId } from '../../../sim/types';
import type { ReachTally } from '../jobs/tally';

export type FlowLane = StageId | 'endings';

/** `sweeps` (default 4; 0 keeps the input order) and `endingClass` (an ending's run class before any
 * run reached it, from authoredEndingClass) are additions to spec 9.3. */
export interface FlowLayoutInput { graph: CallGraph; expanded: ReadonlySet<string>; tally: ReachTally | null; mode: 'reach' | 'structure' | 'state';
  showPruned: boolean; size: 'full' | 'thumb'; sweeps?: number; endingClass?: Readonly<Record<string, Weight>> }

/** One drawn box. Ids: `node:<id>`, `ending:<id>`, `turn:<group>`, `choice:<node>/<choice>`,
 * `junction:<node>/<choice>/<band>/<force|cascade>`. Extras beyond spec 9.3: the tree ids, a ghost
 * flag with the compiler's reason, the tally count `n` and share `p` (runs that reached it), and an
 * ending's run class from the runs that ended there. */
export interface FlowBox { id: string; kind: 'node' | 'ending' | 'turn' | 'choice' | 'junction'; x: number; y: number; w: number; h: number; lane: FlowLane;
  treeId: string; node?: string; choice?: string; band?: OutcomeBand; ghost: boolean; reason?: string; n: number | null; p: number | null;
  weight: Weight | null; column: number }
/** One drawn path. `kind`: a band ribbon, a drawn result out of a junction, a turn hub to the node it
 * drew, or a node to one of its choices (expanded). `edges`: the graph edge ids behind it; `keys`:
 * their tally keys (matchKey), summed into `n`. */
export interface FlowPath { id: string; d: string; width: number; dashed: boolean; arc: boolean; from: string; to: string; band?: OutcomeBand; via: GraphEdge['via'];
  p: number | null; n: number | null; kind: 'ribbon' | 'drawn' | 'turn' | 'choice'; drawn?: string; ghost: boolean; edges: string[]; keys: string[];
  /** Every route behind it needs a hidden fact this call's situation doesn't have. */
  blocked: boolean }
export interface FlowLayout { width: number; height: number; lanes: { lane: FlowLane; x: number; w: number }[];
  boxes: Record<string, FlowBox>; paths: FlowPath[]; crossings: number; reversed: string[] }

/** p == null → 1; else 1.25 + 9·√p. */
export function edgeWidth(p: number | null): number {
  if (p === null) return 1;
  return 1.25 + 9 * Math.sqrt(Math.max(0, Math.min(1, p)));
}

const LANES: readonly FlowLane[] = ['assess', 'adapt', 'resolve', 'endings'];
const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

interface Geometry {
  node: [number, number]; choice: [number, number]; ending: [w: number, min: number, max: number]; hub: number; junction: number;
  colGap: number; laneGap: number; rowGap: number; endGap: number; choiceGap: number; pad: number; head: number; junctions: boolean;
}
const GEOMETRY: Record<FlowLayoutInput['size'], Geometry> = {
  full: { node: [212, 92], choice: [212, 48], ending: [300, 54, 90], hub: 36, junction: 24, colGap: 104, laneGap: 28, rowGap: 26, endGap: 8, choiceGap: 6,
    pad: 40, head: 60, junctions: true },
  thumb: { node: [16, 8], choice: [10, 4], ending: [10, 2.6, 2.6], hub: 4, junction: 0, colGap: 30, laneGap: 8, rowGap: 4, endGap: 1.4, choiceGap: 1,
    pad: 2, head: 0, junctions: false },
};

// ---------------------------------------------------------------- authored ending class

const RANK: Record<Weight, number> = Object.fromEntries(WEIGHTS.map((w, i) => [w, i])) as Record<Weight, number>;
const worse = (a: Weight, b: Weight): Weight => (RANK[a] <= RANK[b] ? a : b);

/** An ending's run class as authored, before any run reaches it: death when a route into it kills
 * someone (fatal harm, or a fatal force result), hurt when a route harms someone, unresolved when
 * the authored disposition isn't resolved, else clean. Used only to order the Endings column until
 * runs say how each ending actually scores. */
export function authoredEndingClass(tree: CallTree): Record<string, Weight> {
  const out: Record<string, Weight> = {};
  for (const [id, ending] of Object.entries(tree.endings)) out[id] = ending.disposition === 'resolved' ? 'clean' : 'unresolved';
  const hit = (next: TreeNext | undefined, w: Weight) => { if (next && 'ending' in next && out[next.ending]) out[next.ending] = worse(out[next.ending], w); };
  const harmOf = (o: TreeOutcome): Weight | null => {
    const values = Object.values(o.harm ?? {});
    if (values.includes('fatal')) return 'death';
    return values.length || o.officer ? 'hurt' : null;
  };
  for (const node of tree.nodes) for (const choice of node.choices) for (const band of BANDS) for (const o of choice.outcomes[band]) {
    const own = harmOf(o);
    if (o.next) { if (own) hit(o.next, own); continue; }
    if (o.force) {
      if (!o.force.noFatal) hit(o.force.next.fatal ?? o.force.next.hurt, 'death');
      // The outcome's own harm lands on every branch the force takes.
      hit(o.force.next.hurt, own ? worse(own, 'hurt') : 'hurt');
      if (own) hit(o.force.next.none, own);
    }
    if (o.cascade && own) for (const next of Object.values(o.cascade.next)) hit(next, own);
  }
  return out;
}

// ---------------------------------------------------------------- the layout

interface Column { lane: FlowLane; kind: 'node' | 'choice' | 'ending'; items: string[]; x: number; w: number }

const ghostMember = (v: GraphVertex) => v.kind === 'node' && !v.inCall && !!v.pruned?.startsWith('not drawn here');
const sum = (values: Iterable<number>) => { let total = 0; for (const v of values) total += v; return total; };

/** Deterministic. */
export function layoutFlow(input: FlowLayoutInput): FlowLayout {
  const { graph, expanded, tally, mode, showPruned, size } = input;
  const g = GEOMETRY[size];
  const runs = tally?.runs ?? 0;
  const byId = new Map(graph.vertices.map(v => [v.id as string, v]));
  const order = new Map(graph.vertices.map((v, i) => [v.id as string, i]));

  // ------------------------------------------------ what is drawn
  const kept = new Set<string>();
  for (const v of graph.vertices) if (v.kind !== 'turn' && (v.inCall || showPruned)) kept.add(v.id);
  for (const v of graph.vertices) if (v.kind === 'turn') {
    const members = (v.members ?? []).map(m => `node:${m}`);
    if ((v.inCall || showPruned) && members.some(m => kept.has(m) || (v.inCall && ghostMember(byId.get(m)!)))) {
      kept.add(v.id);
      // A turn's undrawn members stay on the canvas as ghosts: they are part of the turn's story.
      if (v.inCall) for (const m of members) if (ghostMember(byId.get(m)!)) kept.add(m);
    }
  }
  const edges = graph.edges.filter(e => (e.inCall || showPruned) && kept.has(`node:${e.node}`) && kept.has(e.to));
  const membersOf = (hub: string): string[] => (byId.get(hub)?.members ?? []).map(m => `node:${m}`).filter(m => kept.has(m));
  const isGhost = (id: string) => { const v = byId.get(id); return !!v && !v.inCall; };

  const laneOf = (id: string): FlowLane => {
    const v = byId.get(id)!;
    if (v.kind === 'ending') return 'endings';
    if (v.kind === 'turn') return byId.get(membersOf(id)[0])?.stage ?? 'adapt';
    return v.stage ?? 'assess';
  };

  // Node-level neighbours (turn hubs are see-through), for ranks, ordering and crossings.
  const succ = new Map<string, Set<string>>(), pred = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    (succ.get(a) ?? succ.set(a, new Set()).get(a)!).add(b);
    (pred.get(b) ?? pred.set(b, new Set()).get(b)!).add(a);
  };
  for (const e of edges) {
    const from = `node:${e.node}`;
    if (e.to.startsWith('turn:')) for (const m of membersOf(e.to)) link(from, m); else link(from, e.to);
  }

  // ------------------------------------------------ ranks inside each lane
  const reversed = new Set<string>();
  const rank = new Map<string, number>();
  for (const lane of LANES) {
    if (lane === 'endings') continue;
    const members = [...kept].filter(id => byId.get(id)!.kind === 'node' && laneOf(id) === lane).sort((a, b) => order.get(a)! - order.get(b)!);
    const inLane = new Set(members);
    const same = (u: string) => [...(succ.get(u) ?? [])].filter(v => inLane.has(v)).sort((a, b) => order.get(a)! - order.get(b)!);
    const state = new Map<string, 1 | 2>();
    const visit = (u: string) => {
      state.set(u, 1);
      for (const v of same(u)) {
        if (state.get(v) === 1) reversed.add(`${u}>${v}`);
        else if (!state.has(v)) visit(v);
      }
      state.set(u, 2);
    };
    for (const u of members) if (!state.has(u)) visit(u);
    // Longest path over the lane's edges without the reversed ones (Kahn order).
    const indeg = new Map(members.map(u => [u, 0]));
    for (const u of members) for (const v of same(u)) if (!reversed.has(`${u}>${v}`)) indeg.set(v, indeg.get(v)! + 1);
    const queue = members.filter(u => indeg.get(u) === 0);
    for (const u of members) rank.set(u, 0);
    while (queue.length) {
      const u = queue.shift()!;
      for (const v of same(u)) {
        if (reversed.has(`${u}>${v}`)) continue;
        rank.set(v, Math.max(rank.get(v)!, rank.get(u)! + 1));
        indeg.set(v, indeg.get(v)! - 1);
        if (indeg.get(v) === 0) queue.push(v);
      }
    }
  }

  // ------------------------------------------------ columns
  const endingClassOf = (id: string): Weight => {
    const treeId = byId.get(id)!.treeId;
    const reached = tally?.endings[treeId];
    if (reached && reached.n > 0) return dominant(reached.weights);
    return input.endingClass?.[treeId] ?? 'unresolved';
  };
  const endingShare = (id: string) => (runs ? (tally?.endings[byId.get(id)!.treeId]?.n ?? 0) / runs : 0);
  const columns: Column[] = [];
  for (const lane of LANES) {
    if (lane === 'endings') {
      const items = [...kept].filter(id => byId.get(id)!.kind === 'ending')
        .sort((a, b) => Number(!byId.get(a)!.inCall) - Number(!byId.get(b)!.inCall) || RANK[endingClassOf(b)] - RANK[endingClassOf(a)] || endingShare(b) - endingShare(a)
          || order.get(a)! - order.get(b)!);
      if (items.length) columns.push({ lane, kind: 'ending', items, x: 0, w: g.ending[0] });
      continue;
    }
    const nodes = [...kept].filter(id => byId.get(id)!.kind === 'node' && laneOf(id) === lane);
    const deepest = Math.max(-1, ...nodes.map(id => rank.get(id)!));
    for (let r = 0; r <= deepest; r++) {
      const items = nodes.filter(id => rank.get(id) === r).sort((a, b) => order.get(a)! - order.get(b)!);
      columns.push({ lane, kind: 'node', items, x: 0, w: g.node[0] });
      const open = items.filter(id => expanded.has(byId.get(id)!.treeId));
      if (open.length) columns.push({ lane, kind: 'choice', items: open, x: 0, w: g.choice[0] });
    }
  }
  let x = g.pad;
  columns.forEach((column, i) => {
    if (i > 0) x += g.colGap + (columns[i - 1].lane !== column.lane ? g.laneGap : 0);
    column.x = x;
    x += column.w;
  });
  const width = x + g.pad;
  const columnOf = new Map<string, number>();
  columns.forEach((column, i) => { if (column.kind !== 'choice') for (const id of column.items) columnOf.set(id, i); });

  // ------------------------------------------------ heights
  const choicesOf = (node: string) => graph.choices.filter(c => c.node === node && (c.inCall || showPruned));
  const heightOf = (id: string): number => {
    const v = byId.get(id)!;
    if (v.kind === 'ending') {
      if (mode !== 'reach' || !tally || !runs) return g.ending[1];
      return g.ending[1] + Math.round((g.ending[2] - g.ending[1]) * Math.sqrt(endingShare(id)));
    }
    return g.node[1];
  };
  const stackHeight = (column: Column) => column.kind === 'choice'
    ? 0 : sum(column.items.map(heightOf)) + Math.max(0, column.items.length - 1) * (column.kind === 'ending' ? g.endGap : g.rowGap);

  // ------------------------------------------------ placement for one ordering
  const top = g.pad + g.head;
  const place = (orders: string[][]): Map<string, { y: number; h: number }> => {
    const pos = new Map<string, { y: number; h: number }>();
    const H = Math.max(0, ...columns.map((column, i) => stackHeight({ ...column, items: orders[i] })));
    const stack = (i: number) => {
      const column = columns[i];
      const gap = column.kind === 'ending' ? g.endGap : g.rowGap;
      let y = top + (H - stackHeight({ ...column, items: orders[i] })) / 2;
      for (const id of orders[i]) { const h = heightOf(id); pos.set(id, { y, h }); y += h + gap; }
    };
    columns.forEach((column, i) => { if (column.kind !== 'choice') stack(i); });
    // Two relaxation passes pull each node toward the middle of its neighbours, keeping the order.
    for (let pass = 0; pass < 2; pass++) columns.forEach((column, i) => {
      if (column.kind !== 'node') return;
      const items = orders[i];
      const want = items.map(id => {
        const near = [...(pred.get(id) ?? []), ...(succ.get(id) ?? [])].map(n => pos.get(n)).filter((p): p is { y: number; h: number } => !!p);
        const own = pos.get(id)!;
        return near.length ? sum(near.map(p => p.y + p.h / 2)) / near.length - own.h / 2 : own.y;
      });
      packColumn(items, want, pos, g.rowGap, top, top + H);
    });
    return pos;
  };

  // ------------------------------------------------ ordering: barycentre sweeps, fewest crossings wins
  const centre = (pos: Map<string, { y: number; h: number }>, id: string) => { const p = pos.get(id)!; return p.y + p.h / 2; };
  const crossingsOf = (pos: Map<string, { y: number; h: number }>): number => {
    const segments: { a: string; b: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const [a, targets] of succ) for (const b of targets) {
      const ca = columnOf.get(a), cb = columnOf.get(b);
      if (ca === undefined || cb === undefined || cb <= ca || reversed.has(`${a}>${b}`)) continue;
      segments.push({ a, b, x1: columns[ca].x + columns[ca].w, y1: centre(pos, a), x2: columns[cb].x, y2: centre(pos, b) });
    }
    segments.sort((s, t) => (s.a + s.b).localeCompare(t.a + t.b));
    let n = 0;
    for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
      const s = segments[i], t = segments[j];
      if (s.a === t.a || s.b === t.b || s.a === t.b || s.b === t.a) continue;
      if (intersects(s, t)) n++;
    }
    return n;
  };
  let orders = columns.map(column => [...column.items]);
  let pos = place(orders);
  let best = { orders, pos, crossings: crossingsOf(pos) };
  const sweeps = input.sweeps ?? 4;
  const nodeColumns = columns.map((column, i) => (column.kind === 'node' ? i : -1)).filter(i => i >= 0);
  for (let s = 0; s < sweeps; s++) {
    const backward = s % 2 === 0;
    for (const i of backward ? [...nodeColumns].reverse() : nodeColumns) {
      const side = (id: string) => [...((backward ? succ : pred).get(id) ?? [])].filter(n => {
        const c = columnOf.get(n);
        return c !== undefined && (backward ? c > i : c < i);
      });
      const bary = new Map(orders[i].map(id => {
        const near = side(id);
        return [id, near.length ? sum(near.map(n => centre(pos, n))) / near.length : centre(pos, id)];
      }));
      const next = [...orders[i]].sort((a, b) => bary.get(a)! - bary.get(b)! || order.get(a)! - order.get(b)!);
      orders = orders.map((items, j) => (j === i ? next : items));
      pos = place(orders);
    }
    const crossings = crossingsOf(pos);
    if (crossings < best.crossings) best = { orders, pos, crossings };
  }
  // Then neighbours in a column trade places while that removes crossings (after the sweeps only).
  for (let pass = 0; sweeps > 0 && pass < 3; pass++) {
    let improved = false;
    for (const i of nodeColumns) for (let j = 0; j + 1 < best.orders[i].length; j++) {
      const swapped = [...best.orders[i]];
      [swapped[j], swapped[j + 1]] = [swapped[j + 1], swapped[j]];
      const trial = best.orders.map((items, k) => (k === i ? swapped : items));
      const trialPos = place(trial);
      const crossings = crossingsOf(trialPos);
      if (crossings < best.crossings) { best = { orders: trial, pos: trialPos, crossings }; improved = true; }
    }
    if (!improved) break;
  }
  orders = best.orders;
  pos = best.pos;

  // ------------------------------------------------ boxes
  const boxes: Record<string, FlowBox> = {};
  const reach = (id: string): { n: number | null; p: number | null } => {
    if (!tally) return { n: null, p: null };
    const v = byId.get(id)!;
    const n = v.kind === 'ending' ? tally.endings[v.treeId]?.n ?? 0 : v.kind === 'node' ? sum(Object.values(tally.nodeFate[v.treeId] ?? {})) : 0;
    return { n, p: runs ? n / runs : 0 };
  };
  columns.forEach((column, i) => {
    if (column.kind === 'choice') return;
    for (const id of orders[i]) {
      const v = byId.get(id)!;
      const at = pos.get(id)!;
      const reached = tally?.endings[v.treeId];
      boxes[id] = { id, kind: v.kind as 'node' | 'ending', x: column.x, y: at.y, w: column.w, h: at.h, lane: column.lane, treeId: v.treeId,
        ...(v.kind === 'node' ? { node: v.treeId } : {}), ghost: !v.inCall, ...(v.pruned ? { reason: v.pruned } : {}), ...reach(id),
        weight: v.kind === 'ending' && reached && reached.n > 0 ? dominant(reached.weights) : null, column: i };
    }
  });
  // Choices of an expanded node, stacked from the node's top; stacks never overlap.
  let bottom = top + Math.max(0, ...Object.values(boxes).map(b => b.y + b.h - top));
  columns.forEach((column, i) => {
    if (column.kind !== 'choice') return;
    let floor = -Infinity;
    for (const nodeId of orders[i - 1].filter(id => column.items.includes(id))) {
      const node = boxes[nodeId];
      let y = Math.max(node.y, floor);
      for (const c of choicesOf(node.treeId)) {
        const id = `choice:${c.node}/${c.choice}`;
        const n = tally ? tally.choices[`${c.node}/${c.choice}`] ?? 0 : null;
        boxes[id] = { id, kind: 'choice', x: column.x, y, w: column.w, h: g.choice[1], lane: column.lane, treeId: c.choice, node: c.node, choice: c.choice,
          ghost: !c.inCall, ...(c.pruned ? { reason: c.pruned } : {}), n, p: n === null ? null : runs ? n / runs : 0, weight: null, column: i };
        y += g.choice[1] + g.choiceGap;
      }
      floor = y + g.rowGap - g.choiceGap;
      bottom = Math.max(bottom, y);
    }
  });
  // Turn hubs in the gutter before the nodes they draw.
  for (const id of kept) {
    const v = byId.get(id)!;
    if (v.kind !== 'turn') continue;
    const members = membersOf(id).map(m => boxes[m]).filter(Boolean);
    if (!members.length) continue;
    const cy = sum(members.map(b => b.y + b.h / 2)) / members.length;
    const left = Math.min(...members.map(b => b.x));
    boxes[id] = { id, kind: 'turn', x: left - g.colGap / 2 - g.hub / 2, y: cy - g.hub / 2, w: g.hub, h: g.hub, lane: laneOf(id), treeId: v.treeId,
      ghost: !v.inCall, ...(v.pruned ? { reason: v.pruned } : {}), n: null, p: null, weight: null, column: -1 };
  }

  // ------------------------------------------------ ribbons
  interface Draft { id: string; from: string; to: string; kind: FlowPath['kind']; band?: OutcomeBand; drawn?: string; via: GraphEdge['via'];
    edges: Set<string>; keys: Set<string>; ghost: boolean; n: number | null; open: boolean }
  const drafts = new Map<string, Draft>();
  const draft = (from: string, to: string, kind: FlowPath['kind'], via: GraphEdge['via'], extra: { band?: OutcomeBand; drawn?: string } = {}): Draft => {
    const id = `${from}>${to}|${extra.band ?? extra.drawn ?? kind}`;
    let d = drafts.get(id);
    if (!d) { d = { id, from, to, kind, via, ...extra, edges: new Set(), keys: new Set(), ghost: true, n: null, open: kind === 'choice' || kind === 'turn' }; drafts.set(id, d); }
    return d;
  };
  const keysOf = (e: GraphEdge): string[] => e.to.startsWith('turn:')
    ? membersOf(e.to).map(m => matchKey({ node: e.node, choice: e.choice, band: e.band, drawn: e.drawn, to: m }))
    : [matchKey({ node: e.node, choice: e.choice, band: e.band, drawn: e.drawn, to: e.to })];
  const junctionsOf = new Map<string, string[]>();
  const hubEdges = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    const src = expanded.has(e.node) && boxes[`choice:${e.node}/${e.choice}`] ? `choice:${e.node}/${e.choice}` : `node:${e.node}`;
    const keys = keysOf(e);
    const factFails = e.conditions.some(c => c.kind === 'fact' && c.holds === false);
    const add = (d: Draft) => { d.edges.add(e.id); for (const k of keys) d.keys.add(k); if (e.inCall) d.ghost = false; if (!factFails) d.open = true; };
    if (e.to.startsWith('turn:')) (hubEdges.get(e.to) ?? hubEdges.set(e.to, []).get(e.to)!).push(e);
    if (g.junctions && (e.via === 'force' || e.via === 'cascade')) {
      const j = `junction:${e.node}/${e.choice}/${e.band}/${e.via}`;
      if (!boxes[j]) {
        const list = junctionsOf.get(src) ?? junctionsOf.set(src, []).get(src)!;
        list.push(j);
        boxes[j] = { id: j, kind: 'junction', x: 0, y: 0, w: g.junction, h: g.junction, lane: boxes[src].lane, treeId: e.choice, node: e.node, choice: e.choice, band: e.band,
          ghost: true, n: null, p: null, weight: null, column: -1 };
      }
      if (e.inCall) boxes[j].ghost = false;
      add(draft(src, j, 'ribbon', e.via, { band: e.band }));
      add(draft(j, e.to, 'drawn', e.via, { drawn: e.drawn }));
    } else {
      add(draft(src, e.to, 'ribbon', e.via, { band: e.band }));
    }
  }
  // Junctions stacked along the right side of their source, in more than one row of the gutter
  // when the source is too short to hold them all.
  for (const [src, list] of junctionsOf) {
    const s = boxes[src];
    const rows = Math.max(1, Math.floor((s.h + 5) / (g.junction + 5)));
    list.forEach((j, i) => {
      boxes[j].x = s.x + s.w + 14 + Math.floor(i / rows) * (g.junction + 6);
      boxes[j].y = s.y + (i % rows) * (g.junction + 5);
    });
  }
  // A hub to each node it can draw: the drawn one carries every run into the hub; the others are ghosts.
  for (const [hub, into] of hubEdges) for (const m of membersOf(hub)) {
    const d = draft(hub, m, 'turn', 'turn', {});
    for (const e of into) {
      d.edges.add(e.id);
      d.keys.add(matchKey({ node: e.node, choice: e.choice, band: e.band, drawn: e.drawn, to: m }));
    }
    d.ghost = isGhost(m) || into.every(e => !e.inCall);
  }
  // Expanded nodes: a thin connector from the node to each choice.
  for (const id of Object.keys(boxes)) {
    const b = boxes[id];
    if (b.kind !== 'choice') continue;
    const d = draft(`node:${b.node}`, id, 'choice', 'next', {});
    d.ghost = b.ghost;
    d.n = b.n;
  }
  for (const d of drafts.values()) if (d.kind !== 'choice') d.n = tally ? sum([...d.keys].map(k => tally.edges[k] ?? 0)) : null;

  // ------------------------------------------------ geometry of each path
  const paths: FlowPath[] = [];
  const widthOf = (d: Draft): number => {
    if (size === 'thumb') return 0.8;
    if (mode === 'structure') return 2;
    if (mode === 'state') return 1.5;
    return tally && runs ? edgeWidth((d.n ?? 0) / runs) : edgeWidth(null);
  };
  const list = [...drafts.values()].filter(d => boxes[d.from] && boxes[d.to]);
  const isArc = (d: Draft) => d.kind === 'ribbon' && reversed.has(`${nodeOf(d.from)}>${d.to}`);
  const cy = (id: string) => boxes[id].y + boxes[id].h / 2;
  const ports = (side: 'out' | 'in') => {
    const at = new Map<string, number>();
    const groups = new Map<string, Draft[]>();
    for (const d of list) {
      if (isArc(d)) continue;
      const key = side === 'out' ? d.from : d.to;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(d);
    }
    for (const [boxId, group] of groups) {
      const box = boxes[boxId];
      const other = (d: Draft) => (side === 'out' ? d.to : d.from);
      group.sort((a, b) => cy(other(a)) - cy(other(b)) || bandIndex(a.band) - bandIndex(b.band) || a.id.localeCompare(b.id));
      if (box.kind === 'turn' || box.kind === 'junction' || size === 'thumb') { for (const d of group) at.set(d.id, cy(boxId)); continue; }
      const widths = group.map(widthOf);
      const room = box.h - 14;
      const total = sum(widths) + 2 * (group.length - 1);
      const scale = total > room ? room / total : 1;
      let y = cy(boxId) - Math.min(total, room) / 2;
      group.forEach((d, i) => { at.set(d.id, y + (widths[i] * scale) / 2); y += (widths[i] + 2) * scale; });
    }
    return at;
  };
  const outY = ports('out'), inY = ports('in');
  for (const d of list) {
    const s = boxes[d.from], t = boxes[d.to];
    const width = widthOf(d);
    let path: string;
    const arc = isArc(d);
    if (arc) {
      const sx = s.x + s.w * 0.7, tx = t.x + t.w * 0.3, sy = s.y, ty = t.y;
      const lift = 36 + Math.abs(sx - tx) * 0.12;
      const peak = Math.min(sy, ty) - lift;
      path = `M${f(sx)},${f(sy)} C${f(sx)},${f(peak)} ${f(tx)},${f(peak)} ${f(tx)},${f(ty)}`;
    } else {
      const sx = s.x + s.w, tx = t.x;
      const sy = outY.get(d.id) ?? cy(d.from), ty = inY.get(d.id) ?? cy(d.to);
      const dx = Math.max(size === 'thumb' ? 4 : 28, (tx - sx) / 2);
      path = `M${f(sx)},${f(sy)} C${f(sx + dx)},${f(sy)} ${f(tx - dx)},${f(ty)} ${f(tx)},${f(ty)}`;
    }
    const counted = mode === 'reach' && !!tally && runs > 0;
    paths.push({ id: d.id, d: path, width, dashed: d.ghost || (counted && (d.n ?? 0) === 0), arc, from: d.from, to: d.to, ...(d.band ? { band: d.band } : {}),
      via: d.via, p: counted ? (d.n ?? 0) / runs : null, n: tally ? d.n : null, kind: d.kind, ...(d.drawn ? { drawn: d.drawn } : {}), ghost: d.ghost,
      edges: [...d.edges].sort(), keys: [...d.keys].sort(), blocked: !d.open });
  }
  paths.sort((a, b) => a.id.localeCompare(b.id));

  // ------------------------------------------------ lanes and size
  const lanes: FlowLayout['lanes'] = [];
  for (const lane of LANES) {
    const own = columns.filter(c => c.lane === lane);
    if (!own.length) continue;
    const left = own[0].x - (lane === columns[0].lane ? g.pad / 2 : (g.colGap + g.laneGap) / 2);
    const last = own[own.length - 1];
    const right = last.x + last.w + (last === columns[columns.length - 1] ? g.pad / 2 : (g.colGap + g.laneGap) / 2);
    lanes.push({ lane, x: left, w: right - left });
  }
  const height = Math.max(bottom, ...Object.values(boxes).map(b => b.y + b.h)) + g.pad;
  return { width, height, lanes, boxes, paths, crossings: best.crossings, reversed: [...reversed].sort() };
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();
const bandIndex = (band?: OutcomeBand) => (band ? BANDS.indexOf(band) : 3);
/** A choice or junction box's node box id; a node's own id otherwise. */
const nodeOf = (id: string) => id.startsWith('choice:') ? `node:${id.slice(7).split('/')[0]}` : id.startsWith('junction:') ? `node:${id.slice(9).split('/')[0]}` : id;

// ---------------------------------------------------------------- fitting the canvas

/** Zoomed out, Flow draws text at a fixed screen size (1 / zoom), so legibility doesn't limit how far
 * Fit zooms out: the shortest ending row (54 world units) does, and Fit never goes below the zoom at
 * which it still holds one line of its title (14px). */
export const FIT_FLOOR = 15 / 54;
/** Zoomed out, an ending row keeps at least this screen width so its title and share still read:
 * the endings lane grows to the right (in world units, 1 / zoom), and Fit leaves room for it. */
export const ENDING_MIN_PX = 200;

/** The endings column of a layout: where it starts, its rows' width and the margin after it. */
export function endingsColumn(layout: FlowLayout): { x: number; w: number; tail: number } | null {
  const ends = Object.values(layout.boxes).filter(box => box.kind === 'ending');
  if (!ends.length) return null;
  const x = Math.min(...ends.map(box => box.x)), w = Math.max(...ends.map(box => box.w));
  return { x, w, tail: Math.max(0, layout.width - x - w) };
}

/** How much wider (world units) the ending rows draw at zoom k to keep ENDING_MIN_PX on screen. */
export function endingGrowth(layout: FlowLayout, k: number): number {
  const column = endingsColumn(layout);
  return column ? Math.max(0, ENDING_MIN_PX / k - column.w) : 0;
}

/** The view that fits the whole call, endings column included, into `w` × `h` screen pixels (what
 * the inspector leaves visible): the drawn width is the layout's, or, once the ending rows hold
 * their screen width, everything left of them scaled plus ENDING_MIN_PX; both must fit. Centred
 * when it fits; when even FIT_FLOOR is too wide, from the root on the left. */
export function fitView(layout: FlowLayout, w: number, h: number): { k: number; x: number; y: number } {
  const room = w - 24, column = endingsColumn(layout);
  const k = Math.max(FIT_FLOOR, Math.min(1, room / layout.width, column ? (room - ENDING_MIN_PX) / (column.x + column.tail) : Infinity, (h - 56) / layout.height));
  const drawn = (layout.width + endingGrowth(layout, k)) * k;
  return { k, x: drawn <= room ? (w - drawn) / 2 : 12, y: layout.height * k <= h - 44 ? Math.max(8, (h - 44 - layout.height * k) / 2) : 8 };
}

/** The run class most runs had (ties go to the worse class). */
export function dominant(weights: Readonly<Record<Weight, number>>): Weight {
  let best: Weight = 'unresolved', n = -1;
  for (const w of WEIGHTS) if ((weights[w] ?? 0) > n) { best = w; n = weights[w] ?? 0; }
  return best;
}

/** Places a column's items as close to their wanted tops as the order and the gap allow, inside [lo, hi]. */
function packColumn(items: readonly string[], want: readonly number[], pos: Map<string, { y: number; h: number }>, gap: number, lo: number, hi: number) {
  const ys = items.map((_, i) => want[i]);
  const hs = items.map(id => pos.get(id)!.h);
  for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + hs[i - 1] + gap : lo);
  for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i < ys.length - 1 ? ys[i + 1] - gap - hs[i] : hi - hs[i]);
  for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + hs[i - 1] + gap : lo);
  items.forEach((id, i) => pos.set(id, { y: ys[i], h: hs[i] }));
}

function intersects(s: { x1: number; y1: number; x2: number; y2: number }, t: { x1: number; y1: number; x2: number; y2: number }): boolean {
  const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d1 = cross(t.x1, t.y1, t.x2, t.y2, s.x1, s.y1), d2 = cross(t.x1, t.y1, t.x2, t.y2, s.x2, s.y2);
  const d3 = cross(s.x1, s.y1, s.x2, s.y2, t.x1, t.y1), d4 = cross(s.x1, s.y1, s.x2, s.y2, t.x2, t.y2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// ---------------------------------------------------------------- tracing

/** Everything upstream (`up`), downstream (`down`) or both of a box, through the drawn paths: the box
 * ids and path ids to keep lit while the rest fades (hover cones). */
export function traceCone(layout: FlowLayout, id: string, dir: 'up' | 'down' | 'both'): { boxes: Set<string>; paths: Set<string> } {
  const boxes = new Set([id]), paths = new Set<string>();
  const walk = (start: string, forward: boolean) => {
    const queue = [start];
    const seen = new Set([start]);
    while (queue.length) {
      const at = queue.shift()!;
      for (const p of layout.paths) {
        if ((forward ? p.from : p.to) !== at) continue;
        paths.add(p.id);
        const next = forward ? p.to : p.from;
        boxes.add(next);
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
  };
  if (dir !== 'down') walk(id, false);
  if (dir !== 'up') walk(id, true);
  return { boxes, paths };
}

/** The box a keyboard arrow moves to from `id`: ← and → follow paths (the nearest box upstream or
 * downstream by height), ↑ and ↓ move within the column. Null when there is nowhere to go. */
export function neighbourBox(layout: FlowLayout, id: string, key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'): string | null {
  const from = layout.boxes[id];
  if (!from) return null;
  const cy = (b: FlowBox) => b.y + b.h / 2;
  const pickable = (b: FlowBox) => b.kind === 'node' || b.kind === 'ending' || b.kind === 'choice';
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const same = Object.values(layout.boxes).filter(b => pickable(b) && b.column === from.column && b.id !== id && Math.abs(b.x - from.x) < 1)
      .filter(b => (key === 'ArrowUp' ? cy(b) < cy(from) : cy(b) > cy(from)))
      .sort((a, b) => Math.abs(cy(a) - cy(from)) - Math.abs(cy(b) - cy(from)));
    return same[0]?.id ?? null;
  }
  const forward = key === 'ArrowRight';
  const near = new Set<string>();
  const step = (at: string, depth: number) => {
    for (const p of layout.paths) {
      if ((forward ? p.from : p.to) !== at) continue;
      const next = forward ? p.to : p.from;
      const box = layout.boxes[next];
      if (!box) continue;
      if (pickable(box)) near.add(next); else if (depth < 3) step(next, depth + 1);
    }
  };
  step(id, 0);
  const list = [...near].map(n => layout.boxes[n]).sort((a, b) => Math.abs(cy(a) - cy(from)) - Math.abs(cy(b) - cy(from)) || a.id.localeCompare(b.id));
  return list[0]?.id ?? null;
}
