// Where a call's clocks send it when they run out (Clock.onOut.next, R-G4), for the lab's graph,
// string and requirement views: the engine's own lists (clockNextsOf, templateClockNexts,
// templateClockRoutes), chosen by what a view shows. A drawn call reads its own clocks; one
// situation of it reads that situation's; the authored structure reads every situation's, as the
// static checks do. Without them a node only a clock reaches would read as unreachable.
import type { CallTree, TreeNext } from '../../../content/call-trees/types';
import { templateAt } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { clockNextsOf } from '../../../gen/incident/instance';
import { templateClockNexts } from '../../../gen/incident/trees-v13/compile';
import { requirementTree, templateClockRoutes } from '../../../gen/incident/trees-v13/dependencies';
import type { ReqNode, ReqTarget } from '../../../gen/incident/trees-v13/dependencies';
import type { Session } from './session';

export type ClockRoute = { clock: string; next: TreeNext };

/** Where this drawn call's clocks send it. */
export const sessionClockNexts = (s: Session): TreeNext[] => clockNextsOf(s.instance.clocks);

/** Where one situation's clocks send the call. */
export const situationClockNexts = (template: Pick<IncidentTemplate, 'situations'>, situation: 0 | 1 | 2): TreeNext[] =>
  clockNextsOf(template.situations.find(entry => entry.index === situation)?.clocks ?? []);

/** The template a tree is drawn from, when the tree is the registered one (a draft or fixture isn't). */
const templateOf = (tree: CallTree): IncidentTemplate | undefined => templateAt(tree.type);

/** Where one situation's clocks send a call of this tree (none for a draft or fixture tree). */
export const treeSituationClockNexts = (tree: CallTree, situation: 0 | 1 | 2, template = templateOf(tree)): TreeNext[] =>
  template ? situationClockNexts(template, situation) : [];

/** Where any situation's clocks can send a call of this tree: the authored structure's view. */
export const treeClockNexts = (tree: CallTree, template = templateOf(tree)): TreeNext[] => template ? templateClockNexts(template) : [];

/** Each clock of any situation that sends the call somewhere, for requirement trees. */
export const treeClockRoutes = (tree: CallTree, template = templateOf(tree)): ClockRoute[] => template ? templateClockRoutes(template) : [];

/** The requirement tree for a target, with the routes the template's clocks add: what the lab's Why,
 * X-ray and Dependencies read. */
export const labRequirementTree = (tree: CallTree, target: ReqTarget, routes: readonly ClockRoute[] = treeClockRoutes(tree)): ReqNode =>
  requirementTree(tree, target, routes);
