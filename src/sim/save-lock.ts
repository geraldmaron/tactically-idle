import { SLOTS_KEY } from './campaign-slots';

/** All browser writers, including first-run migration, share this origin-wide lock. */
export function withSaveLock<T>(locks: Pick<LockManager, 'request'> | null, action: () => T | Promise<T>): Promise<T> {
  return locks ? locks.request(SLOTS_KEY, action) : Promise.resolve().then(action);
}
