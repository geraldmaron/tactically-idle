// The Flow layout (spec 3.3, 10.3 "Stream F"): deterministic, lanes in order, no overlapping boxes,
// same-stage back edges reversed and drawn as arcs, zero-reach vertices at minimum size, ribbon
// widths from edgeWidth, tally counts that add up through hubs and junctions, and a crossing count
// per tree never above the input order's.
import { describe, expect, it } from 'vitest';
import { sessionClockNexts, treeClockNexts } from './clocks';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { clockMarksOf } from '../../../gen/incident/instance';
import { callGraph } from '../../../gen/incident/trees-v13/graph';
import type { CallGraph } from '../../../gen/incident/trees-v13/graph';
import { runJob } from '../jobs/runners';
import { emptyTally } from '../jobs/tally';
import type { ReachTally } from '../jobs/tally';
import { parseLabUrl } from '../url';
import { authoredEndingClass, edgeWidth, ENDING_MIN_PX, endingGrowth, endingsColumn, FIT_FLOOR, fitView, layoutFlow, neighbourBox, traceCone } from './flow-layout';
import type { FlowBox, FlowLayout, FlowLayoutInput } from './flow-layout';
import { openSession } from './session';
import type { Session } from './session';

const TEMPLATES = Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[];
const REFERENCE: Record<string, string> = {
  hostage_crisis: 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1',
  barricaded: 'type=barricaded', active_armed_incident: 'type=active_armed_incident', protected_rescue: 'type=protected_rescue',
};

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}
const callOf = (s: Session): CallGraph =>
  callGraph(s.tree, { counts: s.counts, seed: s.resolved.spec?.seed, situation: s.situation, clockMarks: clockMarksOf(s.instance.clocks), clockNexts: sessionClockNexts(s) });
const layout = (graph: CallGraph, over: Partial<FlowLayoutInput> = {}): FlowLayout =>
  layoutFlow({ graph, expanded: new Set(), tally: null, mode: 'reach', showPruned: false, size: 'full', ...over });
const overlap = (a: FlowBox, b: FlowBox) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;

describe('edgeWidth', () => {
  it('is 1.25 + 9·√p, and 1 without a tally', () => {
    expect(edgeWidth(1)).toBe(10.25);
    expect(edgeWidth(0.25)).toBe(5.75);
    expect(edgeWidth(0)).toBe(1.25);
    expect(edgeWidth(null)).toBe(1);
  });
});

describe('layoutFlow on the shipped trees', () => {
  for (const template of TEMPLATES) {
    const type = template.type;
    const authored = callGraph(template.tree, { clockNexts: treeClockNexts(template.tree, template) });
    const call = callOf(open(REFERENCE[type]));
    const endingClass = authoredEndingClass(template.tree);

    it(`${type}: deterministic`, () => {
      const a = layout(call, { endingClass }), b = layout(call, { endingClass });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(JSON.stringify(layout(authored, { size: 'thumb' }))).toBe(JSON.stringify(layout(authored, { size: 'thumb' })));
    });

    it(`${type}: lanes run assess, adapt, resolve, endings, and every box sits in its lane`, () => {
      for (const graph of [authored, call]) {
        const l = layout(graph, { endingClass });
        expect(l.lanes.map(lane => lane.lane)).toEqual(['assess', 'adapt', 'resolve', 'endings']);
        for (let i = 1; i < l.lanes.length; i++) expect(l.lanes[i].x).toBeGreaterThanOrEqual(l.lanes[i - 1].x + l.lanes[i - 1].w - 0.01);
        for (const box of Object.values(l.boxes)) {
          if (box.kind !== 'node' && box.kind !== 'ending') continue;
          const lane = l.lanes.find(entry => entry.lane === box.lane)!;
          expect(box.x).toBeGreaterThanOrEqual(lane.x);
          expect(box.x + box.w).toBeLessThanOrEqual(lane.x + lane.w);
        }
      }
    });

    it(`${type}: no two boxes overlap, with every node expanded and pruned items shown`, () => {
      const expanded = new Set(template.tree.nodes.map(node => node.id));
      for (const l of [layout(call, { endingClass }), layout(call, { expanded, showPruned: true, endingClass }), layout(authored, { expanded, endingClass })]) {
        const boxes = Object.values(l.boxes);
        const hits: string[] = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i], boxes[j])) hits.push(`${boxes[i].id} × ${boxes[j].id}`);
        expect(hits).toEqual([]);
        for (const box of boxes) { expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.w).toBeLessThanOrEqual(l.width); expect(box.y + box.h).toBeLessThanOrEqual(l.height); }
      }
    });

    it(`${type}: every path joins two drawn boxes, and every in-call vertex is drawn`, () => {
      const l = layout(call, { endingClass });
      for (const p of l.paths) { expect(l.boxes[p.from]).toBeDefined(); expect(l.boxes[p.to]).toBeDefined(); }
      for (const v of call.vertices) if (v.inCall) expect(l.boxes[v.id], v.id).toBeDefined();
      // Undrawn turn members are ghosts, never hidden; other pruned items only with Show pruned.
      for (const v of call.vertices) if (!v.inCall && v.pruned?.startsWith('not drawn here')) expect(l.boxes[v.id]?.ghost).toBe(true);
      const pruned = layout(call, { showPruned: true, endingClass });
      for (const v of call.vertices) if (v.kind !== 'turn') expect(pruned.boxes[v.id], v.id).toBeDefined();
    });
  }
});

describe('crossings', () => {
  // Spec 3.3, legibility gate: the authored structure, then the reference call of each type
  // (hostage: the reference link; others: the default draw), never crosses more than the input
  // order. The counts themselves move with content, so they aren't pinned.
  for (const template of TEMPLATES) {
    it(`${template.type}: the sweeps never cross more than the input order`, () => {
      const endingClass = authoredEndingClass(template.tree);
      const authored = callGraph(template.tree, { clockNexts: treeClockNexts(template.tree, template) }), call = callOf(open(REFERENCE[template.type]));
      const counts = (graph: CallGraph): [number, number] => [layout(graph, { endingClass }).crossings, layout(graph, { endingClass, sweeps: 0 }).crossings];
      const [a, aInput] = counts(authored), [c, cInput] = counts(call);
      expect(a).toBeLessThanOrEqual(aInput);
      expect(c).toBeLessThanOrEqual(cInput);
    });
  }
});

// A hand-built graph: root r (assess), a and b in adapt with a cycle a → b → a, b ends at e.
function cycleGraph(): CallGraph {
  const edge = (node: string, choice: string, to: `node:${string}` | `ending:${string}`) =>
    ({ id: `${node}/${choice}/favorable/0/next`, node, choice, band: 'favorable' as const, outcome: 0, to, via: 'next' as const, conditions: [], inCall: true });
  return {
    root: 'r',
    vertices: [
      { id: 'node:r', kind: 'node', treeId: 'r', stage: 'assess', inCall: true },
      { id: 'node:a', kind: 'node', treeId: 'a', stage: 'adapt', inCall: true },
      { id: 'node:b', kind: 'node', treeId: 'b', stage: 'adapt', inCall: true },
      { id: 'ending:e', kind: 'ending', treeId: 'e', inCall: true },
    ],
    choices: [
      { node: 'r', choice: 'go', actionId: 't13_x_r_go', inCall: true }, { node: 'a', choice: 'on', actionId: 't13_x_a_on', inCall: true },
      { node: 'b', choice: 'back', actionId: 't13_x_b_back', inCall: true }, { node: 'b', choice: 'end', actionId: 't13_x_b_end', inCall: true },
    ],
    edges: [edge('r', 'go', 'node:a'), edge('a', 'on', 'node:b'), edge('b', 'back', 'node:a'), edge('b', 'end', 'ending:e')],
    turnDrawn: {},
  };
}

describe('back edges', () => {
  it('a same-stage cycle is broken by reversing its back edge, which is drawn as an arc over the lane', () => {
    const l = layout(cycleGraph());
    expect(l.reversed).toEqual(['node:b>node:a']);
    expect(l.boxes['node:b'].x).toBeGreaterThan(l.boxes['node:a'].x);
    const back = l.paths.find(p => p.from === 'node:b' && p.to === 'node:a')!;
    expect(back.arc).toBe(true);
    // The arc rises above both boxes.
    const ys = [...back.d.matchAll(/,(-?[\d.]+)/g)].map(m => Number(m[1]));
    expect(Math.min(...ys)).toBeLessThan(Math.min(l.boxes['node:a'].y, l.boxes['node:b'].y));
    expect(l.paths.filter(p => p.arc)).toHaveLength(1);
  });
});

describe('reach', () => {
  const s = open(REFERENCE.hostage_crisis);
  const graph = callOf(s);

  it('keeps zero-reach vertices at minimum size and grows reached endings', () => {
    const tally: ReachTally = { ...emptyTally(), runs: 10, endings: { everyone_out: { n: 10, weights: { death: 0, hurt: 0, unresolved: 0, costly: 0, clean: 10 } } } };
    const l = layout(graph, { tally });
    const endings = Object.values(l.boxes).filter(b => b.kind === 'ending');
    const min = Math.min(...endings.map(b => b.h));
    expect(l.boxes['ending:everyone_out'].h).toBeGreaterThan(min);
    for (const b of endings) if (b.id !== 'ending:everyone_out') { expect(b.h).toBe(min); expect(b.n).toBe(0); }
    expect(l.boxes['ending:everyone_out'].weight).toBe('clean');
    // Never-reached endings stay on the canvas, at minimum height.
    expect(endings.length).toBe(graph.vertices.filter(v => v.kind === 'ending' && v.inCall).length);
    // Structure mode ignores the tally's sizes.
    for (const b of Object.values(layout(graph, { tally, mode: 'structure' }).boxes)) if (b.kind === 'ending') expect(b.h).toBe(min);
  });

  it('counts real runs through ribbons: every tally edge is drawn, hubs and junctions add up', async () => {
    const result = await runJob({ kind: 'reach-call', start: { kind: 'fresh', scenarioId: s.scenario.id, kit: 'day1', squad: { seed: 719, certs: [] } }, style: 'random', runs: [0, 60] },
      { shouldStop: () => false, progress: () => {}, yieldEvery: 50 });
    if (result.kind !== 'reach') throw new Error(result.kind);
    const tally = result.tally;
    const l = layout(graph, { tally });
    const drawn = new Set(l.paths.flatMap(p => p.keys));
    for (const key of Object.keys(tally.edges)) expect(drawn.has(key), key).toBe(true);
    // A hub passes on exactly what flows into it.
    for (const hub of Object.values(l.boxes).filter(b => b.kind === 'turn')) {
      const into = l.paths.filter(p => p.to === hub.id).reduce((n, p) => n + (p.n ?? 0), 0);
      const out = l.paths.filter(p => p.from === hub.id).reduce((n, p) => n + (p.n ?? 0), 0);
      expect(out).toBe(into);
    }
    // So does a junction.
    for (const j of Object.values(l.boxes).filter(b => b.kind === 'junction')) {
      const into = l.paths.filter(p => p.to === j.id).reduce((n, p) => n + (p.n ?? 0), 0);
      const out = l.paths.filter(p => p.from === j.id).reduce((n, p) => n + (p.n ?? 0), 0);
      expect(out).toBe(into);
    }
    // Every run reached the root; reach shares are runs over runs.
    expect(l.boxes[`node:${s.tree.root}`].p).toBe(1);
    for (const p of l.paths) if (p.p !== null) expect(p.width).toBeCloseTo(edgeWidth(p.p), 6);
    expect(l.paths.some(p => p.dashed && p.n === 0)).toBe(true);
  }, 120000);
});

describe('expanding a node', () => {
  it('inserts a column of its choices, and its ribbons leave from the choices', () => {
    const s = open(REFERENCE.hostage_crisis);
    const graph = callOf(s);
    const plain = layout(graph), open_ = layout(graph, { expanded: new Set(['talking']) });
    const choices = Object.values(open_.boxes).filter(b => b.kind === 'choice');
    expect(choices.length).toBe(graph.choices.filter(c => c.node === 'talking' && c.inCall).length);
    expect(open_.width).toBeGreaterThan(plain.width);
    expect(open_.paths.some(p => p.from === 'node:talking' && p.kind === 'ribbon')).toBe(false);
    expect(open_.paths.filter(p => p.from === 'node:talking' && p.kind === 'choice')).toHaveLength(choices.length);
    for (const c of choices) expect(c.x).toBeGreaterThan(open_.boxes['node:talking'].x);
  });
});

describe('tracing and keys', () => {
  const graph = callOf(open(REFERENCE.hostage_crisis));
  const l = layout(graph);
  it('a backward cone from an ending reaches the root; a forward cone from the root reaches every drawn ending', () => {
    const cone = traceCone(l, 'ending:everyone_out', 'up');
    expect(cone.boxes.has(`node:${graph.root}`)).toBe(true);
    const down = traceCone(l, `node:${graph.root}`, 'down');
    for (const b of Object.values(l.boxes)) if (b.kind === 'ending' && !b.ghost && l.paths.some(p => p.to === b.id)) expect(down.boxes.has(b.id), b.id).toBe(true);
  });
  it('arrow keys move along paths and within a column', () => {
    const right = neighbourBox(l, `node:${graph.root}`, 'ArrowRight');
    expect(right && l.boxes[right].x).toBeGreaterThan(l.boxes[`node:${graph.root}`].x);
    expect(neighbourBox(l, right!, 'ArrowLeft')).toBe(`node:${graph.root}`);
    const column = Object.values(l.boxes).filter(b => b.kind === 'ending').sort((a, b) => a.y - b.y);
    expect(neighbourBox(l, column[0].id, 'ArrowDown')).toBe(column[1].id);
    expect(neighbourBox(l, column[0].id, 'ArrowUp')).toBeNull();
  });
});

describe('authoredEndingClass', () => {
  it('puts killing endings in death and unresolved dispositions below clean', () => {
    const hostage = authoredEndingClass(INCIDENT_TEMPLATES.hostage_crisis!.tree);
    expect(hostage.everyone_out).toBe('clean');
    expect(hostage.owner_killed).toBe('death');
    expect(hostage.handed_over).toBe('unresolved');
    const armed = authoredEndingClass(INCIDENT_TEMPLATES.active_armed_incident!.tree);
    expect(armed.subject_killed).toBe('death');
  });
});

describe('fitView (review finding flow-endings-offscreen-or-clipped)', () => {
  // The canvas Flow gets at 900 × 800 (no inspector), and at 1440 × 900 beside the inspector and without it.
  const SIZES: [w: number, h: number][] = [[900, 596], [1056, 724], [1440, 724]];
  for (const template of TEMPLATES) {
    it(`keeps the endings column of ${template.type} on screen (whole above Fit's floor, every row's start at it), each row holding a line of its title`, () => {
      const s = open(REFERENCE[template.type]);
      const drawn = layout(callOf(s));
      const column = endingsColumn(drawn)!;
      expect(column).not.toBeNull();
      const shortest = Math.min(...Object.values(drawn.boxes).filter(box => box.kind === 'ending').map(box => box.h));
      for (const [w, h] of SIZES) {
        const view = fitView(drawn, w, h);
        expect(view.k).toBeGreaterThanOrEqual(FIT_FLOOR);
        const grow = endingGrowth(drawn, view.k);
        // Rows keep their screen width.
        expect((column.w + grow) * view.k).toBeGreaterThanOrEqual(Math.min(ENDING_MIN_PX, column.w * view.k) - 1e-9);
        expect(view.x).toBeGreaterThanOrEqual(0);
        if (view.k > FIT_FLOOR) {
          // Fit has room: the whole column, its right edge included, is inside the canvas.
          expect(view.x + (column.x + column.w + grow) * view.k).toBeLessThanOrEqual(w - 8);
        } else {
          // Fit is at its legibility floor (a wide call on the narrowest canvas): it starts at the
          // left, and every ending row starts on screen, so each title shows and its share is a pan away.
          expect(view.x).toBe(12);
          expect(view.x + column.x * view.k).toBeLessThanOrEqual(w - 8);
        }
        // The shortest ending row holds one 14px line at this zoom.
        expect(shortest * view.k).toBeGreaterThanOrEqual(14);
      }
    });
  }
  it('fits a narrow window by zooming out past the old floor of 42%, which cut the column off', () => {
    const drawn = layout(callOf(open(REFERENCE.hostage_crisis)));
    expect(fitView(drawn, 900, 596).k).toBeLessThan(0.42);
    // Wide enough: no growth, the plain fit.
    expect(endingGrowth(drawn, 1)).toBe(0);
  });
});
