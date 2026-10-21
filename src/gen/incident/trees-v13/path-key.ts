// One key for "the same place in a call": two states with the same key offer the same choices and
// route their outcomes the same way. Replaces the Scenario Lab's explorer key and the path key in
// call-trees.test.ts, which merged states a clock cue or a subject's stance had already forked.
import { stanceOf } from '../../../sim/meters';
import { getScenario } from '../../../sim/scenario-registry';
import type { GameState } from '../../../sim/types';

/** Stage, status, ending, flags, knowledge, each clock (cues heard, run out, 10-minute bucket) and
 * each subject's stance (sim/meters.ts): everything a prompt, a choice, an outcome's `when` or an
 * engine-only `if` reads. A meter branch reads stance (and agitation, which no tree reads today),
 * so stance is the part of the meters that forks a call. A gauge that fills is keyed by its cues
 * heard and whether it is full: the rest of its value feeds strain and call pressure, which no
 * choice or route reads (call pressure is not in the key either). */
export function pathStateKey(state: GameState): string {
  const run = state.activeRun!;
  const fills = new Set((getScenario(run.scenarioId)?.clocks ?? []).filter((clock) => clock.direction === 'fill').map((clock) => clock.id));
  return JSON.stringify([run.stage, run.status, run.endingId, [...run.flags].sort(), Object.entries(run.knowledge).sort(),
    Object.entries(run.clocks ?? {}).map(([id, clock]) => fills.has(id) ? [id, clock.cued, clock.value >= 100] : [id, clock.cued, clock.value <= 0, Math.floor(clock.value / 10)]).sort(),
    Object.entries(run.meters ?? {}).map(([id, meters]) => [id, stanceOf(meters)]).sort()]);
}
