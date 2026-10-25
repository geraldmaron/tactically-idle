// A call with a choice only a drawn hit can open, for tests of the never_offered lint and how the lab
// words and pins it. Never dispatched. Built from the hostage call at test time: a choice at `threat`
// needs the fixture's own mark. With `withHit`, the shot at the glass marks an officer down (fire.mark), so
// the choice is offered and lint notes a drawn-only mark; without it nothing sets the mark, so the
// compiler drops that choice in every call and lint reports it.
import type { CallTree, TreeChoice } from '../../../content/call-trees/types';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';

const BANDS = ['favorable', 'mixed', 'adverse'] as const;
// The mark is the fixture's own: a live call writes `officer_down` itself, so a live name would never be unset.
export const HIT_FIXTURE = { node: 'threat', choice: 'treat_ours', mark: 'fixture_hit' } as const;

export function hitMarkFixture(withHit: boolean): IncidentTemplate {
  const base = INCIDENT_TEMPLATES.hostage_crisis!;
  const tree: CallTree = structuredClone(base.tree);
  const node = tree.nodes.find(entry => entry.id === HIT_FIXTURE.node)!;
  const model = node.choices.find(choice => choice.id === 'talk_down')!;
  if (withHit) for (const band of BANDS) for (const outcome of model.outcomes[band]) if (outcome.fire) outcome.fire = { ...outcome.fire, mark: HIT_FIXTURE.mark };
  // Without it, no outcome in the borrowed call may set the mark either, whatever the live call does.
  if (!withHit) for (const entry of tree.nodes) for (const choice of entry.choices) for (const band of BANDS) for (const outcome of choice.outcomes[band])
    if (outcome.fire?.mark === HIT_FIXTURE.mark) outcome.fire = { from: outcome.fire.from };
  const treat: TreeChoice = { ...structuredClone(model), id: HIT_FIXTURE.choice, title: 'Get the hit officer to the medic first', team: undefined, onlyIf: { marks: [HIT_FIXTURE.mark] } };
  node.choices.push(treat);
  return { ...base, tree };
}

/** The fixture with no writer of the mark: its choice is never offered. */
export const armedWithoutHitMark = (): IncidentTemplate => hitMarkFixture(false);
