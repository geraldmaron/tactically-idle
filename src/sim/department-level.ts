// Department level: earned through service on live calls (save v7). Each closed live call
// adds service; the level rises when total service reaches the next threshold. The level
// gates which kinds of call are dispatched (content/unlocks.ts) and caps the tier of new
// calls (drawIncidentSpec).
//
// Saves before v7 hold a level with no service record. Their service is read as the
// threshold of the level they hold, so progress starts from there and no level is lost.
import type { Department } from './types';

/** New campaigns start here; the scale plan's arc begins with ordinary calls on homes. */
export const START_LEVEL = 1;
export const MAX_LEVEL = 10;

/** Total service needed to hold `level`: 0, 10, 30, 60, 100, 150, ... (5 × L × (L − 1)). */
export function serviceForLevel(level: number): number {
  const l = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return 5 * l * (l - 1);
}

/** The highest level a service total reaches. */
export function levelForService(service: number): number {
  let level = 1;
  while (level < MAX_LEVEL && service >= serviceForLevel(level + 1)) level++;
  return level;
}

/** Service on record. A pre-v7 department counts from the threshold of the level it holds. */
export function departmentService(dep: Pick<Department, 'level' | 'service'>): number {
  return dep.service ?? serviceForLevel(dep.level);
}

/** Service one closed live call earns. Completing the agreed step at a higher tier earns the
 * most; a call that ends without it still earns a little, because the team still served. */
export function serviceEarned(outcome: { completed: boolean; failed: boolean }, tier: number): number {
  const t = Math.min(5, Math.max(1, Math.round(Number.isFinite(tier) ? tier : 1)));
  if (outcome.failed) return 1;
  return outcome.completed ? 2 + t : 1 + Math.floor(t / 2);
}

/** Add service and raise the level when a threshold is crossed. Never lowers a level. */
export function addService(dep: Department, earned: number): { before: number; after: number } {
  const before = dep.level;
  dep.service = departmentService(dep) + Math.max(0, Math.floor(earned));
  dep.level = Math.max(before, levelForService(dep.service));
  return { before, after: dep.level };
}

export interface LevelProgress {
  level: number;
  service: number;
  /** Service at which the current level was reached. */
  floor: number;
  /** Service needed for the next level; null at the top level. */
  next: number | null;
}

export function levelProgress(dep: Pick<Department, 'level' | 'service'>): LevelProgress {
  const service = departmentService(dep);
  return { level: dep.level, service, floor: serviceForLevel(dep.level), next: dep.level >= MAX_LEVEL ? null : serviceForLevel(dep.level + 1) };
}
