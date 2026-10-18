// What a Condition record (scenario-types.ts) means against a run: the facts the team holds, the
// flags set and the pressure. The schema's own semantics, shared by the scenario rules, the
// people on scene (story-people.ts, story-movement.ts) and the lab, so none of them has to reach
// into resolution for it. Kernel: no state, no chance, no tuning.
import type { Condition } from './scenario-types';
import type { OperationRun } from './types';

export function conditionHolds(c: Condition | undefined, run: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure'>): boolean {
  if (!c) return true;
  for (const f of c.facts ?? []) if (!f.in.includes(run.knowledge[f.factId] ?? 'unknown')) return false;
  for (const f of c.flags ?? []) if (!run.flags.includes(f)) return false;
  for (const f of c.notFlags ?? []) if (run.flags.includes(f)) return false;
  if (c.pressureAtLeast !== undefined && run.pressure < c.pressureAtLeast) return false;
  if (c.pressureBelow !== undefined && run.pressure >= c.pressureBelow) return false;
  return true;
}

/** A compiled move (R-B3, compile.ts): the flag that moves `role` (its `n`-th move), and the flag a
 * sighting sets once the team sees them where that move took them (story-people, sightings). One
 * definition, so a renamed flag can't silently stop re-sighting. */
export const movedFlag = (role: string, n: number) => `moved:${role}:${n}`;
export const seenFlag = (role: string, n: number) => `seen:${role}:${n}`;
