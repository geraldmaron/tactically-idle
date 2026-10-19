// Test support: fill a Command Staff post with a known person, so behaviour tests can pin the
// manager's loop to fixed lever values. Never loaded by the game.
import type { GameState } from './types';
import type { ManagerId } from './command-staff';
import { hireStaff, MANAGER_IDS, postOpen } from './command-staff';
import { drawStaffPool, emptyPost, type StaffPost } from './staff-pool';

/** Lever values that reproduce each manager's behaviour from before the hiring pool. */
export const BASELINE_LEVERS: Record<ManagerId, [number, number]> = {
  watch_commander: [0, 30],
  training_sergeant: [0, 0],
  quartermaster: [0, 0],
  peer_support_lead: [2, 8],
  recruiter: [0, 0],
};

/**
 * Hire the first candidate of an open post on a draft, after giving them the given levers, salary
 * and signing cost. Throws if the post is not open, so a test cannot silently skip the hire.
 */
export function fillPost(d: GameState, id: ManagerId, opts: { levers?: [number, number]; salaryPerHour?: number; signingCost?: number } = {}): void {
  const record = d.commandStaff?.[id] as { post?: StaffPost } | undefined;
  if (!record) throw new Error(`No staff record for ${id}`);
  record.post ??= emptyPost();
  if (!record.post.pool.length) record.post.pool = drawStaffPool(d, id, record.post.round);
  const candidate = record.post.pool[0];
  if (!candidate) throw new Error(`The ${id} post has no candidates: open it in Develop first`);
  candidate.levers = opts.levers ?? BASELINE_LEVERS[id];
  candidate.salaryPerHour = opts.salaryPerHour ?? (id === 'quartermaster' ? 0 : 45);
  candidate.signingCost = opts.signingCost ?? 0;
  const result = hireStaff(d, id, candidate.id);
  if (!result.ok) throw new Error(result.reason);
  // Drop the signing line so behaviour tests read only what the loop itself logs.
  (d.commandStaff![id].log as unknown[]).shift();
}

/** Fill every open, vacant post with baseline levers. Returns the same state for chaining. */
export function fillOpenPostsForTest<T extends GameState>(d: T): T {
  for (const id of MANAGER_IDS) if (postOpen(d, id) && !d.commandStaff?.[id].post?.holder) fillPost(d, id);
  return d;
}
