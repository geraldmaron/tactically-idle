import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { buildLocation } from '../../../sim/location';
import { drawIncidentSpec, generateIncident } from '../index';
import { clockMarksOf, instanceOf } from '../instance';
import { callCounts, reachableNodes, treeForCounts } from './compile';
import { countCombos } from './dependencies';
import { GROUP_TEMPLATE } from './group-fixture';
import { hitMarkFixture, HIT_FIXTURE } from './never-offered-fixture';
import { callGraph, choiceIndex, drawnRoute, humanizeNode, matchKey, truthReach } from './graph';

const TEMPLATES = Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[];
const hostage = INCIDENT_TEMPLATES.hostage_crisis!;
const fanOuts = (template: IncidentTemplate, via: 'force' | 'cascade') =>
  new Set(callGraph(template.tree).edges.filter(edge => edge.via === via).map(edge => `${edge.node}/${edge.choice}/${edge.band}/${edge.outcome}`)).size;

describe('call graph: structure', () => {
  it('fans each force and cascade outcome out by drawn result', () => {
    // Going Live's entries and holds (three force outcomes); cascades from the group fixture.
    expect(fanOuts(hostage, 'force')).toBe(3);
    expect(fanOuts(GROUP_TEMPLATE, 'cascade')).toBeGreaterThan(0);
    const cascade = callGraph(GROUP_TEMPLATE.tree).edges.filter(edge => edge.via === 'cascade');
    expect(new Set(cascade.map(edge => edge.drawn))).toEqual(new Set(['all', 'some', 'none']));
    const force = callGraph(hostage.tree).edges.filter(edge => edge.via === 'force');
    expect(new Set(force.map(edge => edge.drawn))).toEqual(new Set(['hurt', 'none']));
  });

  it('routes a turn into a hub that lists its members, and records the draw', () => {
    for (const template of TEMPLATES) {
      const graph = callGraph(template.tree, { seed: 11 });
      for (const [group, members] of Object.entries(template.tree.turns ?? {})) {
        const hub = graph.vertices.find(vertex => vertex.id === `turn:${group}`)!;
        expect(hub.kind).toBe('turn');
        expect(hub.members).toEqual(members);
        expect(members).toContain(graph.turnDrawn[group]);
        expect(graph.edges.some(edge => edge.to === hub.id && edge.via === 'turn')).toBe(true);
      }
      expect(Object.values(callGraph(template.tree).turnDrawn).every(drawn => drawn === null)).toBe(true);
    }
  });

  it('keeps every edge and vertex of the authored tree in call when nothing is drawn', () => {
    for (const template of TEMPLATES) {
      const graph = callGraph(template.tree);
      expect(graph.vertices.filter(vertex => !vertex.inCall), template.type).toEqual([]);
      expect(graph.edges.filter(edge => !edge.inCall), template.type).toEqual([]);
      expect(new Set(graph.edges.map(edge => edge.id)).size).toBe(graph.edges.length);
    }
  });

  it('says whether each fact condition holds in the given situation', () => {
    const tree = hostage.tree;
    const situations = tree.situations.map((_, i) => i as 0 | 1 | 2);
    for (const situation of situations) for (const edge of callGraph(tree, { situation }).edges) for (const c of edge.conditions) if (c.kind === 'fact')
      expect(c.holds).toBe((tree.facts[c.fact].truth ?? tree.situations[situation]!.truth[c.fact]) === c.is);
    const reach = situations.map(situation => truthReach(callGraph(tree, { situation }), tree));
    for (const set of reach) expect(set.has('ending:handed_over') || set.size > 1).toBe(true);
  });
});

describe('call graph: one call', () => {
  it('puts in call exactly the nodes the compiler reaches, for 50 seeds and every group size', () => {
    for (const template of TEMPLATES) for (const counts of countCombos(template)) for (let seed = 1; seed <= 50; seed++) {
      const graph = callGraph(template.tree, { counts, seed });
      const inCall = graph.vertices.filter(vertex => vertex.kind === 'node' && vertex.inCall).map(vertex => vertex.treeId).sort();
      expect(inCall, `${template.type} ${JSON.stringify(counts)} seed ${seed}`).toEqual(reachableNodes(treeForCounts(template.tree, counts), seed, counts).map(node => node.id).sort());
    }
  });

  it('matches the compiled call: its nodes, its actions and its endings', () => {
    for (const template of TEMPLATES) {
      let rng = 4242;
      for (let i = 0; i < 12; i++) {
        const drawn = drawIncidentSpec(rng, { level: 10, trust: 90, unlockedTypes: [template.type], includeWorldOnly: true });
        rng = drawn.state;
        const s = generateIncident(drawn.spec);
        const instance = instanceOf(s, buildLocation(s.locationFamilyId, s.locationSeed))!;
        // The call's own counts (callCounts): group sizes and every compile-time fact its conditions read.
        const graph = callGraph(template.tree, { counts: callCounts(instance.placed), seed: s.incident!.seed, situation: instance.situation as 0 | 1 | 2, clockMarks: clockMarksOf(instance.clocks) });
        const where = `${template.type} ${s.id}`;
        expect(graph.vertices.filter(v => v.kind === 'node' && v.inCall).map(v => v.treeId).sort(), where).toEqual(s.story!.episode!.modules.filter(id => id !== 'call-tree').sort());
        expect(graph.choices.filter(c => c.inCall).map(c => c.actionId).sort(), where).toEqual(Object.values(s.stages).flatMap(stage => stage.actions.map(action => action.id)).sort());
        expect(graph.vertices.filter(v => v.kind === 'ending' && v.inCall).map(v => v.treeId).sort(), where).toEqual(Object.keys(s.endings).sort());
        for (const [group, node] of Object.entries(instance.turns)) expect(graph.turnDrawn[group]).toBe(node);
      }
    }
  }, 60000);

  it('gives every pruned item the reason the compiler drops it', () => {
    // The group fixture with nobody else inside: lines that name the others are gone, by their count condition.
    const lone = callGraph(GROUP_TEMPLATE.tree, { counts: { others: 0 }, seed: 3 });
    const countPruned = lone.choices.filter(choice => !choice.inCall && /needs others/.test(choice.pruned ?? ''));
    expect(countPruned.length).toBeGreaterThan(0);
    for (const choice of countPruned) expect(choice.pruned).toMatch(/^needs others .+; this call has 0$/);
    expect(lone.edges.filter(edge => edge.via === 'cascade' && !edge.inCall).every(edge => /needs others ≥ [12]; this call has 0/.test(edge.pruned!))).toBe(true);
    expect(lone.edges.some(edge => edge.via === 'next' && edge.id.endsWith('/next') && GROUP_TEMPLATE.tree.nodes.find(n => n.id === edge.node)!.choices.find(c => c.id === edge.choice)!.outcomes[edge.band][edge.outcome].cascade)).toBe(true);
    // Undrawn turn members say which one the call drew (a turn with more than one member, when the call has one).
    for (const [group, members] of Object.entries(hostage.tree.turns ?? {}).filter(([, entries]) => entries.length > 1)) {
      const graph = callGraph(hostage.tree, { seed: 3 });
      const drawn = graph.turnDrawn[group]!;
      for (const id of members.filter(id => id !== drawn)) expect(graph.vertices.find(v => v.id === `node:${id}`)!.pruned).toMatch(/^not drawn here \(this call drew /);
    }
    // A mark only a drawn hit sets is settable: the compiler keeps the choice that needs it.
    const armed = callGraph(hitMarkFixture(true).tree, { counts: {}, seed: 5 });
    const treat = armed.choices.find(c => c.choice === HIT_FIXTURE.choice)!;
    expect(treat.inCall).toBe(true);
    expect(treat.pruned).toBeUndefined();
    for (const item of [...lone.vertices, ...lone.choices, ...lone.edges, ...armed.vertices, ...armed.choices, ...armed.edges]) expect(!item.inCall).toBe(!!item.pruned);
  });
});

describe('call graph: helpers', () => {
  it('maps every action id back to its node and choice', () => {
    for (const template of TEMPLATES) {
      const index = choiceIndex(template.tree);
      expect(index.size).toBe(template.tree.nodes.reduce((n, node) => n + node.choices.length, 0));
      expect(index.get(`t13_${template.type}_${template.tree.root}_${template.tree.nodes[0].choices[0].id}`)).toEqual({ node: template.tree.root, choice: template.tree.nodes[0].choices[0].id });
    }
  });

  it('titles a node from its id and leads with the first sentence of its bound prompt', () => {
    const node = { id: 'out_back_door', stage: 'adapt' as const, prompt: 'The door opens. Nobody moves.', choices: [] };
    expect(humanizeNode(node)).toEqual({ title: 'Out back door', lead: 'The door opens.' });
    expect(humanizeNode({ ...node, prompt: '{courier.first} says, “Wait.” Then nothing.' }, text => text.replace('{courier.first}', 'Ana')).lead).toBe('Ana says, “Wait.”');
    expect(humanizeNode({ ...node, prompt: 'No full stop' }).lead).toBe('No full stop');
  });

  it('keys a graph edge and a recorded step the same way', () => {
    expect(matchKey({ node: 'a', choice: 'b', band: 'mixed', drawn: 'hurt', to: 'node:c' })).toBe(matchKey({ node: 'a', choice: 'b', band: 'mixed', drawn: 'force:hurt', to: 'c' }));
    expect(matchKey({ node: 'a', choice: 'b', band: 'mixed', to: 'ending:done' })).toBe('a/b/mixed>end:done');
    expect(matchKey({ node: 'a', choice: 'b', band: 'adverse', drawn: 'fire:wounded', to: 'c' })).toBe('a/b/adverse>c');
    expect(drawnRoute('team_force', 'firearm:serious')).toBe('hurt');
    expect(drawnRoute('team_force', 'hands:none')).toBe('none');
    expect(drawnRoute('cascade', 'follows+stays')).toBe('some');
    expect(drawnRoute('cascade', 'out+follows')).toBe('all');
    expect(drawnRoute('incoming_fire', 'wounded')).toBeUndefined();
  });
});
