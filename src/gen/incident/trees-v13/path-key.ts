// One key for "the same place in a call": two states with the same key offer the same choices and
// route their outcomes the same way. Replaces the Scenario Lab's explorer key and the path key in
// call-trees.test.ts, which merged states a clock cue or a subject's stance had already forked.
import { stanceOf } from '../../../sim/meters';
import type { GameState } from '../../../sim/types';

/** Stage, status, ending, flags, knowledge, each clock (cues heard, run out, 10-minute bucket) and
 * each subject's stance (sim/meters.ts): everything a prompt, a choice, an outcome's `when` or an
 * engine-only `if` reads. A meter branch reads stance (and agitation, which no tree reads today),
 * so stance is the part of the meters that forks a call. */
export function pathStateKey(state: GameState): string {
  const run = state.activeRun!;
  return JSON.stringify([run.stage, run.status, run.endingId, [...run.flags].sort(), Object.entries(run.knowledge).sort(),
    Object.entries(run.clocks ?? {}).map(([id, clock]) => [id, clock.cued, clock.value <= 0, Math.floor(clock.value / 10)]).sort(),
    Object.entries(run.meters ?? {}).map(([id, meters]) => [id, stanceOf(meters)]).sort()]);
}
