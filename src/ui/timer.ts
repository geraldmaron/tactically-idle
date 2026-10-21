// The call timer as the game reads it (docs/call-pressure.md): the player's timer setting and the
// open decision's stall at that setting. Pure, so the live screen and the store's commit path read
// the same minutes.
import { openDither } from '../sim/clocks';
import { getScenario } from '../sim/scenario-registry';
import type { TimerSetting } from '../sim/timer-setting';
import { readSettings } from './settings/prefs';
import type { GameState } from '../sim/types';

/** The player's call timer setting, from the saved preference (ui/settings/prefs.ts). The one
 * place the game reads it. Off adds no dither. */
export function timerSetting(): TimerSetting {
  return readSettings().timer;
}

/** The open decision's stall in game minutes at `now` (sim/clocks.ts openDither), at the player's
 * timer setting: what the live screen previews and what a commit charges. */
export function liveDither(state: GameState, now: number): number {
  const run = state.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  return run && scenario ? openDither(scenario, run, state.department.clockHighWater, now, timerSetting()) : 0;
}
