// The lab follows clock routes (backlog clock-edges-in-tooling): a node only a clock reaches when it
// runs out (Clock.onOut.next, R-G4) shows in the lab's graph, string rows, requirement trees and
// Script reach. The group fixture gets a clock whose target is a node nothing else reaches, as
// src/gen/incident/clock-route.test.ts builds it, and each view family is read the way the lab's
// call sites read it, through model/clocks.ts; the same call without the clock targets is the
// negative control.
import { describe, expect, it } from 'vitest';
import type { CallTree } from '../../../content/call-trees/types';
import type { Clock, IncidentTemplate } from '../../../content/incidents/types';
import { generateIncident } from '../../../gen/incident';
import { drawInstance, hostedSpec } from '../../../gen/incident/instance';
import { callCounts, memberCounts } from '../../../gen/incident/trees-v13/compile';
import { GROUP_TEMPLATE, GROUP_TREE } from '../../../gen/incident/trees-v13/group-fixture';
import { callGraph, truthReach } from '../../../gen/incident/trees-v13/graph';
import { callStringRows } from '../../../gen/incident/trees-v13/strings';
import { buildLocation } from '../../../sim/location';
import { labRequirementTree, sessionClockNexts, situationClockNexts, treeClockNexts, treeClockRoutes } from './clocks';
import { turnReach, variantRows } from './script';
import { baselineRows } from './snapshots';
import type { Session } from './session';

const PROMPT = 'While the team waited on that, the courier ran for the door.';
const same = (text: string) => ({ favorable: text, mixed: text, adverse: text });
const CLOCK: Clock = { id: 'nerve', label: 'The courier’s nerve', kind: 'deadline', owner: 'courier', start: 30, ratePerMin: 5, rateKnown: false,
  cues: [{ at: 25, text: 'The courier keeps looking at the door.', mark: 'courier_restless' }],
  onOut: { mark: 'courier_bolts', next: { node: 'bolted' } } };

/** The group fixture with a node, `bolted`, that only the courier's clock running out reaches. */
function clockTemplate(): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  const out = { text: 'The courier is out.', safe: ['courier'], next: { ending: 'handed_over' } };
  tree.nodes.push({ id: 'bolted', stage: 'resolve', prompt: PROMPT,
    choices: [{ id: 'cover', title: 'Cover the door', summary: 'You cover the door while the courier runs.', preview: same('The courier gets out.'), icon: 'door',
      check: GROUP_TREE.nodes[0].choices[0].check, minutes: 2, outcomes: { favorable: [out], mixed: [out], adverse: [out] } }] });
  return { ...GROUP_TEMPLATE, tree, situations: GROUP_TEMPLATE.situations.map(situation => ({ ...situation, clocks: [CLOCK] })) };
}

/** A drawn call of the template with a lone taker, as a lab session holds it (its instance and counts). */
function drawn(t: IncidentTemplate): Pick<Session, 'instance' | 'counts' | 'situation'> {
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    let instance;
    try { instance = drawInstance(t, built, spec); } catch { continue; }
    if ((memberCounts(instance.placed).others ?? 0) !== 0) continue;
    const situation = (instance.situation === 1 || instance.situation === 2 ? instance.situation : 0) as 0 | 1 | 2;
    return { instance, counts: callCounts(instance.placed), situation };
  }
  throw new Error('No seed draws a lone taker');
}

const t = clockTemplate();
const tree = t.tree;
const call = drawn(t);
const session = call as Session;

describe('the lab reads where a clock sends the call', () => {
  it('takes the targets from the drawn call, one situation and the whole template alike', () => {
    expect(sessionClockNexts(session)).toEqual([{ node: 'bolted' }]);
    expect(situationClockNexts(t, call.situation)).toEqual([{ node: 'bolted' }]);
    expect(treeClockNexts(tree, t)).toEqual([{ node: 'bolted' }]);
    expect(treeClockRoutes(tree, t)).toEqual([{ clock: 'nerve', next: { node: 'bolted' } }]);
    // A draft tree that isn't the registered template's has no clocks to read.
    expect(treeClockNexts(tree)).toEqual([]);
  });
});

describe('a node only a clock reaches shows in each view family', () => {
  it('graph (Flow, Outcomes, the call strip): in the call and reached, only with the clock targets', () => {
    const graph = callGraph(tree, { counts: call.counts, seed: 1, situation: call.situation, clockNexts: sessionClockNexts(session) });
    expect(graph.vertices.find(vertex => vertex.id === 'node:bolted')?.inCall).toBe(true);
    expect(truthReach(graph, tree).has('node:bolted')).toBe(true);
    const authored = callGraph(tree, { clockNexts: treeClockNexts(tree, t) });
    expect(authored.vertices.find(vertex => vertex.id === 'node:bolted')?.inCall).toBe(true);
    // Negative control: the same call without them.
    const bare = callGraph(tree, { counts: call.counts, seed: 1, situation: call.situation });
    expect(bare.vertices.find(vertex => vertex.id === 'node:bolted')?.inCall).toBe(false);
  });

  it('strings (Script’s call rows, the palette, Outcomes): its prompt is a row, only with the clock targets', () => {
    const has = (rows: ReturnType<typeof callStringRows>) => rows.some(row => row.text === PROMPT);
    expect(has(callStringRows(tree, text => text, call.counts, sessionClockNexts(session)))).toBe(true);
    expect(has(callStringRows(tree, text => text, call.counts))).toBe(false);
  });

  it('requirement tree (Why, X-ray, Dependencies): reaching it needs the clock to run out', () => {
    expect(labRequirementTree(tree, { node: 'bolted' }, treeClockRoutes(tree, t))).toEqual({ any: [{ all: [{ leaf: { kind: 'clock', clock: 'nerve', when: 'out', is: true } }] }] });
    // Negative control: without the routes nothing reaches it.
    expect(JSON.stringify(labRequirementTree(tree, { node: 'bolted' }, []))).not.toContain('"clock":"nerve"');
  });

  it('Script: turnReach and the variant rows reach it, only with the clock targets', () => {
    const counts = { others: 0 };
    expect(turnReach(tree, counts, {}, situationClockNexts(t, call.situation)).nodes.has('bolted')).toBe(true);
    expect(turnReach(tree, counts, {}).nodes.has('bolted')).toBe(false);
    const v = { counts, situation: call.situation, turns: {} };
    expect(variantRows(tree, v, situationClockNexts(t, call.situation)).some(row => row.text === PROMPT)).toBe(true);
    // A tree that isn't the registered template's reads no clocks by default: the negative control.
    expect(variantRows(tree, v).some(row => row.text === PROMPT)).toBe(false);
  });
});

describe('a baseline pinned in one situation keeps a clock-only line another situation shows', () => {
  it('reads every situation’s clock targets, not only the drawn call’s', () => {
    // The clock only in a situation the drawn call doesn't have.
    const other = ([0, 1, 2] as const).find(i => i !== call.situation && t.situations.some(entry => entry.index === i))!;
    const oneSituation: IncidentTemplate = { ...t, situations: t.situations.map(entry => ({ ...entry, clocks: entry.index === other ? [CLOCK] : [] })) };
    const s = { tree, template: oneSituation, counts: call.counts, instance: { ...call.instance, clocks: [] } } as unknown as Session;
    expect(sessionClockNexts(s)).toEqual([]);
    const has = (rows: ReturnType<typeof callStringRows>) => rows.some(row => row.text === PROMPT);
    expect(has(baselineRows(s, text => text))).toBe(true);
    // Negative control: the drawn call's own targets miss it.
    expect(has(callStringRows(tree, text => text, call.counts, sessionClockNexts(s)))).toBe(false);
  });
});
