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
export const movedFlag = (role: string, key: number | string) => `moved:${role}:${key}`;
export const seenFlag = (role: string, key: number | string) => `seen:${role}:${key}`;
/** The key of a clock cue's move (Clock.cues[].moveTo), named the same by compile and the instance. */
export const cueMoveKey = (clockId: string, cueIndex: number) => `cue.${clockId}.${cueIndex}`;

/** `flags` with `flag` set. A person has one current move and one place last seen (R-B3): setting
 * either replaces that person's earlier one, so the latest move wins whatever order the call compiled
 * them in. Every engine path that sets flags goes through this. */
export function withFlag(flags: string[], flag: string): string[] {
  const kind = /^(moved|seen):([^:]+):/.exec(flag);
  // Seeing someone anywhere settles a lost trail (lostFlag).
  const kept = kind ? flags.filter(entry => (!entry.startsWith(`${kind[1]}:${kind[2]}:`) || entry === flag) && !(kind[1] === 'seen' && entry === lostFlag(kind[2]))) : flags;
  return kept.includes(flag) ? kept : [...kept, flag];
}
/** The team looked where it last saw `role` and found the spot empty (sightings.ts): the place shows
 * as where they were last seen until the team sees them again. Only what the team observed sets it. */
export const lostFlag = (role: string) => `lost:${role}`;
