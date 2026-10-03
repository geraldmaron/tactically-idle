import { useLayoutEffect, useState } from 'react';
import { useGame } from '../store';
import type { Id } from '../../sim/types';
import { OpsBoard } from './OpsBoard';
import { OpsPrepare } from './OpsPrepare';
import { OpsLive } from './OpsLive';
import { OpsDebrief } from './OpsDebrief';

/** Ops destination. Mode follows state: board, prepare, live, or debrief. */
export function OpsScreen() {
  const g = useGame();
  const [prep, setPrep] = useState<Id | null>(null);
  const run = g.activeRun;
  const surface = run?.status === 'active' ? 'live' : run?.status === 'debrief' ? 'debrief' : prep ? 'prepare' : 'board';
  useLayoutEffect(() => {
    // App keeps this scroll owner mounted between operation surfaces. Reset before
    // paint, without remounting the live map or reacting to ticks and decisions.
    const screen = document.querySelector<HTMLElement>('main.screen-ops');
    if (screen) screen.scrollTop = 0;
  }, [surface]);
  if (run?.status === 'active') return <OpsLive />;
  if (run?.status === 'debrief') return <OpsDebrief />;
  if (prep) return <OpsPrepare scenarioId={prep} onCancel={() => setPrep(null)} />;
  return <OpsBoard onPrepare={setPrep} />;
}
