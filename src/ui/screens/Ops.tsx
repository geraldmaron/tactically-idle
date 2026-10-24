import { useEffect, useLayoutEffect } from 'react';
import { useGame } from '../store';
import { OpsHome } from './operations/OpsHome';
import { OpsPrepare } from './OpsPrepare';
import { OpsLive } from './OpsLive';
import { OpsDebrief } from './OpsDebrief';
import { callFlow, useCallFlow } from './call-flow';
import { incidentsOf } from './helpers';
import { useNav } from '../components/nav';

/** The Calls destination. Mode follows state: a live call or its debrief first, then the call the
 * player opened (call-flow.ts, which keeps its step and draft across Back and detours), then the
 * board. A call that has left the board opens nothing. */
export function OpsScreen() {
  const g = useGame();
  const { open } = useCallFlow();
  const nav = useNav();
  const run = g.activeRun;
  const now = Date.now();
  // On the board means a live incident that hasn't expired (cardFor also builds cards for calls
  // gone from the board, so it can't decide this).
  const onBoard = (id: string) => incidentsOf(g).some((incident) => incident.id === id && incident.expiresAt > now);
  const prep = open && !run && onBoard(open.scenarioId) ? open : null;
  const surface = run?.status === 'active' ? 'live' : run?.status === 'debrief' ? 'debrief' : prep ? `prepare-${prep.step}` : 'board';
  // A call that left the board (taken, expired) takes its draft and any open step with it.
  useEffect(() => {
    callFlow.prune(onBoard);
    if (open && !run && !onBoard(open.scenarioId)) callFlow.close(open.scenarioId);
  });
  useLayoutEffect(() => {
    // App keeps this scroll owner mounted between call surfaces. Reset before paint, without
    // remounting the live map or reacting to ticks and decisions.
    const screen = document.querySelector<HTMLElement>('main.screen-ops');
    if (screen) screen.scrollTop = 0;
  }, [surface, run?.id]);
  if (run?.status === 'active') return <OpsLive onStepOut={() => nav.go('hq')} />;
  if (run?.status === 'debrief') return <OpsDebrief />;
  if (prep) return <OpsPrepare scenarioId={prep.scenarioId} step={prep.step} />;
  return <OpsHome onOpen={(id) => callFlow.openCall(id)} />;
}
