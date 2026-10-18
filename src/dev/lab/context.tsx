// What every surface reads through useLab(): the URL focus and a way to change it, the open call,
// moves through it, the tuning patch, the worker pool, the dev server, notes, and the call's
// dependency index and graph. LabApp provides it (spec section 9.4).
import { createContext, useContext } from 'react';
import type { CallGraph } from '../../gen/incident/trees-v13/graph';
import type { DependencyIndex } from '../../gen/incident/trees-v13/dependencies';
import type { PatchProblem, TuningPatch } from '../../sim/tuning';
import type { Goal } from './jobs/protocol';
import type { JobPool } from './jobs/pool';
import type { LabMove } from './model/call';
import type { DevServer } from './model/endpoints';
import type { OpenError, Session } from './model/session';
import type { LabUrl, NotesFile } from './types';

export interface NoticeAction { label: string; run(): void }

export interface LabContextValue {
  url: LabUrl;
  /** Tab switches and selection changes push a history entry; path steps, rewinds and toggles replace it. */
  navigate(next: Partial<LabUrl>, mode?: 'push' | 'replace'): void;
  call: { status: 'none' } | { status: 'loading' } | { status: 'error'; error: OpenError } | { status: 'ready'; session: Session };
  step(move: LabMove): void; rewind(to: number): void; playHere(goal: Goal): void;
  tuning: { patch: TuningPatch; setPatch(p: TuningPatch): void; hash: string; savedHash: string; problems: PatchProblem[] };
  jobs: JobPool; dev: DevServer;
  /** The call type's review notes. `reload` reads the file again (after a 409) and returns it, or null
   * when it can't be read. */
  notes: { file: NotesFile; shared: boolean; save(file: NotesFile): Promise<'ok' | 'conflict' | 'error'>; reload(): Promise<NotesFile | null> };
  deps: DependencyIndex | null; graph: CallGraph | null;
  /** A notice above the surface. One with a `key` replaces any other with that key. */
  notify(text: string, actions?: NoticeAction[], key?: string): void;
}

/** The key of the notice a draw change leaves ("Also changed: names Lee → Omar"): one at a time, each
 * draw change replacing the last, and cleared by Back or Undo draw change, which undo what it says. */
export const DRAW_NOTICE = 'draw-change';

export const LabContext = createContext<LabContextValue | null>(null);

export function useLab(): LabContextValue {
  const value = useContext(LabContext);
  if (!value) throw new Error('useLab() needs the LabApp provider');
  return value;
}
