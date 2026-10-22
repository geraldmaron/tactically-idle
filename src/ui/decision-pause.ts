// Who owns the open decision's pause (docs/ui-ux-audit.md, Step out). A stall counts only while the
// player can see the call (owner 2026-10-21): the live call is on screen and the page is visible.
// Stepping out (any way off the call: Step out, a tab, browser Back) pauses it like hiding the app
// does, and only coming back to the call resumes it. Page visibility alone never resumes a call the
// player stepped out of, so backgrounding, a reload or a long wait on HQ keep the elapsed time as it
// was. Pure: the store sends what this returns.
import type { Command, GameState } from '../sim/types';

export interface DecisionWatch {
  /** The live call is mounted (OpsLive). */
  callShown: boolean;
  /** The page is visible. */
  pageVisible: boolean;
}

/** The pause or resume the open decision needs now, or null. A decision waiting to open (the result
 * beat) has no stall running, so it is never paused. */
export function decisionPauseCommand(state: GameState, watch: DecisionWatch): Extract<Command, { type: 'pauseDecision' | 'resumeDecision' }> | null {
  const run = state.activeRun;
  if (!run || run.status !== 'active') return null;
  const watching = watch.callShown && watch.pageVisible;
  if (!watching && !run.decisionPending && run.decisionPausedAt === undefined) return { type: 'pauseDecision', revision: run.revision };
  if (watching && run.decisionPausedAt !== undefined) return { type: 'resumeDecision', revision: run.revision };
  return null;
}
