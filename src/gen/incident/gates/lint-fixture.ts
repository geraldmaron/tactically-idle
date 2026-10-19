// A lint fixture the tooling tests own (COORDINATION.md, "Tests across lanes"): the group fixture
// with a mark read only by command approval (threatMarks) and a mark set only by a drawn result (a
// shot from the group), so the info-level lint codes are tested without borrowing a live call's
// marks, which content changes move.
import type { CallTree } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { GROUP_TEMPLATE, GROUP_TREE } from '../trees-v13/group-fixture';

export const LINT_FIXTURE_MARKS = { threatOnly: 'aimed_at_door', drawnOnly: 'glass_hit' } as const;

export function lintFixtureTemplate(): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  const { threatOnly, drawnOnly } = LINT_FIXTURE_MARKS;
  tree.threatMarks = { ...tree.threatMarks, [threatOnly]: '{taker.first} aimed at the door' };
  const hold = tree.nodes.flatMap(node => node.choices).find(choice => choice.id === 'hold')!;
  hold.outcomes.mixed[0] = { ...hold.outcomes.mixed[0], mark: [...hold.outcomes.mixed[0].mark ?? [], threatOnly] };
  const shot = hold.outcomes.adverse.find(outcome => outcome.fire)!;
  shot.fire = { ...shot.fire!, mark: drawnOnly };
  return { ...GROUP_TEMPLATE, tree };
}
