// A clock fixture the tooling tests own (COORDINATION.md, "Tests across lanes"): the group fixture
// with a clock on the courier, in every situation, that does all a clock can. Its cue sets a mark;
// running out harms the courier, sets a mark and sends the call to a node nothing else reaches, where
// an outcome reads that mark. Tests that need "a mark only a clock writes" or "a node only a clock
// reaches" read it here instead of borrowing a live call's clock, which content changes move.
import type { CallTree } from '../../../content/call-trees/types';
import type { Clock, IncidentTemplate } from '../../../content/incidents/types';
import { GROUP_TEMPLATE, GROUP_TREE } from '../trees-v13/group-fixture';

export const CLOCK_FIXTURE_IDS = { clock: 'courier_nerve', owner: 'courier', cueMark: 'courier_restless', outMark: 'courier_bolts', node: 'bolted', choice: 'cover' } as const;
export const CLOCK_FIXTURE_PROMPT = 'While the team waited on that, the courier ran for the door.';

const { clock: CLOCK_ID, owner, cueMark, outMark, node, choice } = CLOCK_FIXTURE_IDS;
export const CLOCK_FIXTURE_CLOCK: Clock = { id: CLOCK_ID, label: 'The courier’s nerve', kind: 'deadline', owner, start: 30, ratePerMin: 5, rateKnown: false,
  cues: [{ at: 25, text: 'The courier keeps looking at the door.', mark: cueMark }],
  onOut: { harm: 'serious', mark: outMark, next: { node } } };

/** The group fixture with the courier's clock in every situation and the node only it reaches.
 * `playable` leaves out the line that reads the run-out mark: validateScenario doesn't count a mark
 * only a clock's run-out sets as declared, so a call that reads one can't start (reported to the
 * engine lane). The lint tests keep the reader; the explore tests play the playable one. */
export function clockFixtureTemplate(clock: Clock = CLOCK_FIXTURE_CLOCK, opts: { playable?: boolean } = {}): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  const same = (text: string) => ({ favorable: text, mixed: text, adverse: text });
  const out = { text: 'The courier is out.', safe: [owner], next: { ending: 'handed_over' } };
  // The run-out mark is read by an outcome condition (an extra line once it is set), as shipped calls
  // read theirs: a choice's visibility can't read a mark only a clock sets (validateScenario).
  const seen = { when: { marks: [outMark] }, text: 'The team saw the courier run for it.' };
  tree.nodes.push({ id: node, stage: 'resolve', prompt: CLOCK_FIXTURE_PROMPT,
    choices: [{ id: choice, title: 'Cover the door', summary: 'You cover the door while the courier runs.', preview: same('The courier gets out.'), icon: 'door',
      check: GROUP_TREE.nodes[0].choices[0].check, minutes: 2, outcomes: opts.playable ? { favorable: [out], mixed: [out], adverse: [out] } : { favorable: [out, seen], mixed: [out, seen], adverse: [out, seen] } }] });
  return { ...GROUP_TEMPLATE, tree, situations: GROUP_TEMPLATE.situations.map(situation => ({ ...situation, clocks: [clock] })) };
}
