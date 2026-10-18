// A React reader of the pool's cache count (JobPool.stored): it changes when the cache takes a result,
// so a memo that reads `jobs.cached(…)` on mount can list it as a dependency and read again when a job
// another surface started finishes (the call strip's "Usually", the Calls cards).
import { useCallback, useSyncExternalStore } from 'react';
import type { JobPool } from './pool';

export function usePoolStored(pool: JobPool): number {
  const subscribe = useCallback((listener: () => void) => pool.watch?.(listener) ?? (() => {}), [pool]);
  return useSyncExternalStore(subscribe, () => pool.stored?.() ?? 0, () => pool.stored?.() ?? 0);
}
