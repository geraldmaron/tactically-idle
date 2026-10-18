// A clock's onOut mark is set whenever the clock runs out, even in the decision that brings its
// owner out or safe (sim/clocks.ts; R-G4 rule 2 gates only the route). That is safe only while no
// line reads the mark where the owner may already be out: every reader must sit in a node the call
// can't reach once an outcome has brought the owner out or made them safe. A stopped clock never
// runs down again, so that decision is the only one where the mark can outlive the owner inside.
import { describe, expect, it } from 'vitest';
import type { CallTree, TreeState } from '../../content/call-trees/types';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import { outcomeNexts } from './trees-v13/compile';

const BANDS = ['favorable', 'mixed', 'adverse'] as const;

/** Readers of `mark` in nodes reachable after any outcome brings `owner` out or makes them safe. */
function readersOnceOut(tree: CallTree, mark: string, owner: string): string[] {
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const after = new Set<string>(), queue: string[] = [];
  const reach = (outcome: CallTree['nodes'][number]['choices'][number]['outcomes']['favorable'][number]) => {
    for (const next of outcomeNexts(outcome)) for (const id of 'node' in next ? [next.node] : 'turn' in next ? tree.turns?.[next.turn] ?? [] : [])
      if (!after.has(id)) { after.add(id); queue.push(id); }
  };
  for (const node of tree.nodes) for (const choice of node.choices) for (const band of BANDS) for (const outcome of choice.outcomes[band])
    if ((outcome.safe ?? []).includes(owner) || (outcome.out ?? []).includes(owner)) reach(outcome);
  while (queue.length) for (const choice of byId.get(queue.shift()!)?.choices ?? []) for (const band of BANDS) for (const outcome of choice.outcomes[band]) reach(outcome);
  const reads = (state?: TreeState) => !!state && [...state.marks ?? [], ...state.notMarks ?? []].includes(mark);
  return tree.nodes.filter(node => after.has(node.id)).flatMap(node => [
    ...(node.promptIf ?? []).flatMap((entry, i) => reads(entry.when) ? [`${node.id} prompt variant ${i + 1}`] : []),
    ...node.choices.flatMap(choice => [...reads(choice.onlyIf) ? [`${node.id}.${choice.id}`] : [],
      ...BANDS.flatMap(band => choice.outcomes[band].flatMap((outcome, i) => reads(outcome.when) ? [`${node.id}.${choice.id} ${band} outcome ${i + 1}`] : []))]),
  ]);
}

describe('a clock’s onOut mark is never read once its owner may be out', () => {
  const clocks = Object.values(INCIDENT_TEMPLATES).flatMap(template => template ? template.situations.flatMap(situation =>
    (situation.clocks ?? []).filter(clock => clock.onOut?.mark && clock.owner).map(clock => ({ template, situation: situation.index, clock }))) : []);

  it('finds the marked clocks the calls have today', () => {
    expect(clocks.map(({ template, clock }) => `${template.type}:${clock.onOut!.mark}`)).toEqual(expect.arrayContaining(['hostage_crisis:owner_down', 'protected_rescue:tank_empty']));
  });

  it('catches a reader placed where the owner is already out', () => {
    const hostage = structuredClone(INCIDENT_TEMPLATES.hostage_crisis!.tree);
    hostage.nodes.find(node => node.id === 'last_one')!.promptIf = [{ when: { marks: ['owner_down'] }, prompt: 'The owner is down.' }];
    expect(readersOnceOut(hostage, 'owner_down', 'owner')).toEqual(['last_one prompt variant 1']);
  });

  for (const { template, situation, clock } of clocks)
    it(`${template.type} situation ${situation}: ${clock.onOut!.mark}`, () => {
      expect(readersOnceOut(template.tree, clock.onOut!.mark!, clock.owner!)).toEqual([]);
    });
});
