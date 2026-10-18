// A clock's onOut mark is set whenever the clock runs out, even in the decision that brings its
// owner out or safe (sim/clocks.ts; R-G4 rule 2 gates only the route). That is safe only while no
// line reads the mark where the owner may already be out: every reader must sit in a node the call
// can't reach once an outcome has brought the owner out or made them safe. A stopped clock never
// runs down again, so that decision is the only one where the mark can outlive the owner inside.
import { describe, expect, it } from 'vitest';
import type { CallTree, TreeNext, TreeOutcome, TreeState } from '../../content/call-trees/types';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import type { Clock, IncidentTemplate } from '../../content/incidents/types';
import { GROUP_TEMPLATE, GROUP_TREE } from './trees-v13/group-fixture';
import { outcomeNexts } from './trees-v13/compile';

const BANDS = ['favorable', 'mixed', 'adverse'] as const;

/** Readers of `mark` in nodes reachable once any outcome has brought `owner` out or made them safe.
 * In a band, one routed outcome applies, with any addenda (outcomes with no route) beside it: a
 * releasing routed outcome counts its own route, and a releasing addendum counts every route in its
 * band, since it may apply beside any of them. Any other clock (`clockNexts`) may still run out and
 * move the call afterwards, so its targets count as reachable too. */
function readersOnceOut(tree: CallTree, mark: string, owner: string, clockNexts: readonly TreeNext[] = []): string[] {
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const after = new Set<string>(), queue: string[] = [];
  const add = (next: TreeNext) => { for (const id of 'node' in next ? [next.node] : 'turn' in next ? tree.turns?.[next.turn] ?? [] : []) if (!after.has(id)) { after.add(id); queue.push(id); } };
  const releases = (outcome: TreeOutcome) => (outcome.safe ?? []).includes(owner) || (outcome.out ?? []).includes(owner);
  let released = false;
  for (const node of tree.nodes) for (const choice of node.choices) for (const band of BANDS)
    for (const outcome of choice.outcomes[band].filter(releases)) {
      released = true;
      const own = outcomeNexts(outcome);
      for (const next of own.length ? own : choice.outcomes[band].flatMap(entry => outcomeNexts(entry))) add(next);
    }
  if (released) clockNexts.forEach(add);
  while (queue.length) for (const choice of byId.get(queue.shift()!)?.choices ?? []) for (const band of BANDS) for (const outcome of choice.outcomes[band]) outcomeNexts(outcome).forEach(add);
  const reads = (state?: TreeState) => !!state && [...state.marks ?? [], ...state.notMarks ?? []].includes(mark);
  return tree.nodes.filter(node => after.has(node.id)).flatMap(node => [
    ...(node.promptIf ?? []).flatMap((entry, i) => reads(entry.when) ? [`${node.id} prompt variant ${i + 1}`] : []),
    ...node.choices.flatMap(choice => [...reads(choice.onlyIf) ? [`${node.id}.${choice.id}`] : [],
      ...(choice.modifiers ?? []).flatMap(modifier => modifier.mark === mark ? [`${node.id}.${choice.id} modifier`] : []),
      ...BANDS.flatMap(band => choice.outcomes[band].flatMap((outcome, i) => reads(outcome.when) ? [`${node.id}.${choice.id} ${band} outcome ${i + 1}`] : []))]),
  ]);
}

/** Every clock with an onOut mark and an owner, per situation, in these templates. */
const markedClocks = (templates: readonly (IncidentTemplate | undefined)[]) => templates.flatMap(template => template ? template.situations.flatMap(situation =>
  (situation.clocks ?? []).filter(clock => clock.onOut?.mark && clock.owner).map(clock => ({ template, situation: situation.index, clock }))) : []);

// The audit's own checks run on the group fixture (an owned tree), never on a call's content, so a
// call can drop or rename its marks without touching them. The fixture's courier is released by
// talk.ask_out (safe, then the cascade to `last` or an ending) and by final.end_talk.
const FIXTURE_CLOCK: Clock = { id: 'nerve', label: 'The courier', kind: 'medical', owner: 'courier', start: 60, ratePerMin: 1, rateKnown: false,
  cues: [{ at: 40, text: 'The courier sits down by the door.' }], onOut: { harm: 'serious', mark: 'courier_down' } };
const reading = (prompt: string) => ({ when: { marks: ['courier_down'] }, prompt });

describe('the audit, on an owned fixture', () => {
  it('finds a marked clock on a template', () => {
    const fixture: IncidentTemplate = { ...GROUP_TEMPLATE, situations: GROUP_TEMPLATE.situations.map(situation => ({ ...situation, clocks: [FIXTURE_CLOCK] })) };
    expect(markedClocks([fixture]).map(({ clock }) => clock.onOut!.mark)).toEqual(['courier_down', 'courier_down', 'courier_down']);
    expect(markedClocks([GROUP_TEMPLATE])).toEqual([]);
  });

  it('passes when every reader sits where the owner is still inside', () => {
    const tree = structuredClone(GROUP_TREE);
    tree.nodes.find(node => node.id === 'open')!.promptIf = [reading('The courier is down.')];
    expect(readersOnceOut(tree, 'courier_down', 'courier')).toEqual([]);
  });

  it('catches a reader placed where the owner is already out', () => {
    const tree = structuredClone(GROUP_TREE);
    tree.nodes.find(node => node.id === 'last')!.promptIf = [reading('The courier is down.')];
    expect(readersOnceOut(tree, 'courier_down', 'courier')).toEqual(['last prompt variant 1']);
  });

  it('catches a release in one outcome and the route in another of the same band', () => {
    const tree = structuredClone(GROUP_TREE);
    tree.nodes.find(node => node.id === 'talk')!.promptIf = [reading('The courier is down.')];
    expect(readersOnceOut(tree, 'courier_down', 'courier'), 'talk comes before any release').toEqual([]);
    // open.watch.mixed routes to talk; an addendum beside it now brings the courier out.
    tree.nodes.find(node => node.id === 'open')!.choices.find(choice => choice.id === 'watch')!.outcomes.mixed.push({ text: 'The courier slips out.', safe: ['courier'] });
    expect(readersOnceOut(tree, 'courier_down', 'courier')).toContain('talk prompt variant 1');
  });

  it('catches another clock that can still move the call once the owner is out', () => {
    const tree = structuredClone(GROUP_TREE);
    tree.nodes.find(node => node.id === 'final')!.promptIf = [reading('The courier is down.')];
    expect(readersOnceOut(tree, 'courier_down', 'courier')).toEqual([]);
    expect(readersOnceOut(tree, 'courier_down', 'courier', [{ node: 'final' }])).toContain('final prompt variant 1');
  });
});

describe('a clock’s onOut mark is never read once its owner may be out, in every call', () => {
  for (const { template, situation, clock } of markedClocks(Object.values(INCIDENT_TEMPLATES)))
    it(`${template.type} situation ${situation}: ${clock.onOut!.mark}`, () => {
      const others = template.situations.find(entry => entry.index === situation)!.clocks!.filter(entry => entry !== clock).flatMap(entry => entry.onOut?.next ? [entry.onOut.next] : []);
      expect(readersOnceOut(template.tree, clock.onOut!.mark!, clock.owner!, others)).toEqual([]);
    });
});
