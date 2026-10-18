// The armed call with its one `officer_down` writer taken out, for tests of the never_offered lint
// and how the lab words and pins it. Never dispatched. In the shipped call a hit officer sets
// `officer_down` (fire.mark), so "Get the officer to the medic first" at Pinned is offered; here
// nothing sets it, so the compiler drops that choice in every call and lint reports it.
import type { CallTree } from '../../../content/call-trees/types';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';

const BANDS = ['favorable', 'mixed', 'adverse'] as const;

/** The armed template whose fire outcomes no longer mark an officer down. */
export function armedWithoutHitMark(): IncidentTemplate {
  const base = INCIDENT_TEMPLATES.active_armed_incident!;
  const tree: CallTree = structuredClone(base.tree);
  for (const node of tree.nodes) for (const choice of node.choices) for (const band of BANDS) {
    for (const outcome of choice.outcomes[band]) if (outcome.fire?.mark === 'officer_down') outcome.fire = { from: outcome.fire.from };
  }
  return { ...base, tree };
}
