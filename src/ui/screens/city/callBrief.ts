import type { Id } from '../../../sim/types';
import type { NavApi } from '../../components/nav';
import { callFlow } from '../call-flow';

/** Open one call's brief: the Operations tab, then the brief through `callFlow.openCall`, the path a board card
 * takes. The City's Now strip, the cold open and the Operations board all use it. */
export function openCallBrief(nav: Pick<NavApi, 'go'>, scenarioId: Id): void {
  nav.go('ops');
  callFlow.openCall(scenarioId);
}
