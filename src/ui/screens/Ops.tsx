import { useState } from 'react';
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
  if (run?.status === 'active') return <OpsLive />;
  if (run?.status === 'debrief') return <OpsDebrief />;
  if (prep) return <OpsPrepare scenarioId={prep} onCancel={() => setPrep(null)} />;
  return <OpsBoard onPrepare={setPrep} />;
}
