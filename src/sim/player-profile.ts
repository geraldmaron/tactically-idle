// How the player runs the department, read back into play (docs/player-profile.md). Everything here
// is derived from saved state the player made: their committed choices, how long they stall, what
// they spend on, how the last calls went, what they own. Every reader is visible (a named line on a
// card, a count on the strip), capped, and has a wiring probe. Funding and spend never reach the
// odds: what money buys does, through the kit and the people it buys (src/architecture/wiring.ts
// holds that at zero).
import { debriefBand } from './career';
import { effectiveLean } from './reputation';
import type { ScenarioDefinition } from './scenario-types';
import type { Department, GameState, Id, LedgerKind } from './types';
import { tunable } from './tuning';
import type { TimerSetting } from './timer-setting';

/** Tunable (sim/tuning.ts). */
export const PROFILE_TUNING = tunable('PROFILE_TUNING', {
  /** How far one decision moves the stall habit: a moving average over roughly the last 1/weight
   * decisions, so a habit builds over a few calls and fades as slowly. */
  stallWeight: 1 / 12,
  /** Decisions before the stall habit counts. */
  warmup: 6,
  /** Bad results in a row before the next call is drawn a tier lower, said on the card. */
  comebackStreak: 3,
  /** Gauge points a pressure source starts higher by: per full hard name (people have heard the
   * team goes in, and tune in), and per full stall habit (people have learned these stand-offs run
   * long, so they come and stay). Kept below the source's first cue, so its warning is still heard. */
  sourceStart: { hardName: 12, stallHabit: 10 },
  /** Ledger entries the spend mix reads, newest first. */
  spendWindow: 30,
});

export type SpendBucket = 'kit' | 'people' | 'training' | 'facilities';
const SPEND_BUCKET: Partial<Record<LedgerKind, SpendBucket>> = {
  purchase: 'kit', restock: 'kit', salvage: 'kit',
  signing: 'people', staff: 'people', severance: 'people',
  training: 'training',
  development: 'facilities',
};

export interface PlayerProfile {
  /** -1 talks first .. +1 goes in hard (sim/reputation.ts), 0 before the department has a name. */
  posture: number;
  /** 0..1: the share of a decision's threat window the player usually lets run, 0 before warmup. */
  stall: number;
  decisions: number;
  /** Share of recent spending in each bucket, 0..1 each (all 0 with no spending yet). */
  spend: Record<SpendBucket, number>;
  /** Bad results in a row, newest first. */
  adverseStreak: number;
  /** What the department has to work with. */
  depth: { officers: number; units: number; meanStrain: number };
}

/** Fold one committed decision's stall into the habit: `share` is the dither over the window it
 * could have run (0 when the player committed at once, 1 when they let the threat land). */
export function recordStall(dep: Department, share: number): void {
  if (!Number.isFinite(share)) return;
  const h = (dep.habits ??= { stall: 0, decisions: 0 });
  const w = PROFILE_TUNING.stallWeight;
  h.stall = Math.max(0, Math.min(1, h.stall * (1 - w) + Math.max(0, Math.min(1, share)) * w));
  h.decisions += 1;
}

export function playerProfile(state: Pick<GameState, 'department' | 'debriefs' | 'officers' | 'units'>): PlayerProfile {
  const dep = state.department;
  const habits = dep.habits;
  const spent = { kit: 0, people: 0, training: 0, facilities: 0 } as Record<SpendBucket, number>;
  let total = 0;
  for (const entry of (dep.ledger ?? []).filter(entry => entry.amount < 0).slice(-PROFILE_TUNING.spendWindow)) {
    const bucket = SPEND_BUCKET[entry.kind];
    if (!bucket) continue;
    spent[bucket] += -entry.amount;
    total += -entry.amount;
  }
  let adverseStreak = 0;
  for (const report of state.debriefs) {
    if (debriefBand(report) !== 'adverse') break;
    adverseStreak += 1;
  }
  const officers = Object.values(state.officers);
  return {
    posture: effectiveLean(dep),
    stall: habits && habits.decisions >= PROFILE_TUNING.warmup ? habits.stall : 0,
    decisions: habits?.decisions ?? 0,
    spend: Object.fromEntries(Object.entries(spent).map(([bucket, amount]) => [bucket, total > 0 ? amount / total : 0])) as Record<SpendBucket, number>,
    adverseStreak,
    depth: { officers: officers.length, units: Object.keys(state.units ?? {}).length, meanStrain: officers.length ? officers.reduce((sum, o) => sum + o.stress, 0) / officers.length : 0 },
  };
}

/** The tier a drawn call comes in at after a bad run, and whether it was eased (the card says so). */
export function comebackTier(profile: Pick<PlayerProfile, 'adverseStreak'>, tier: number): { tier: number; eased: boolean } {
  if (profile.adverseStreak < PROFILE_TUNING.comebackStreak || tier <= 1) return { tier, eased: false };
  return { tier: tier - 1, eased: true };
}

/** Where each pressure source starts on this department's call (OperationRun.sourceStart): higher
 * for a department known to go in hard and for one known to let stand-offs run, never at or past
 * its first cue. Undefined when nothing moves, so a call reads exactly as authored. The stall habit
 * lifts only on the Standard timer (owner, 2026-10-21): a player who chose Off or Relaxed asked for
 * time to read, and that choice never follows them into later calls. */
export function sourceStarts(scenario: Pick<ScenarioDefinition, 'clocks'>, profile: Pick<PlayerProfile, 'posture' | 'stall'>, timer: TimerSetting): Record<Id, number> | undefined {
  const stall = timer === 'standard' ? profile.stall : 0;
  const lift = Math.max(0, profile.posture) * PROFILE_TUNING.sourceStart.hardName + stall * PROFILE_TUNING.sourceStart.stallHabit;
  if (!(lift >= 0.5)) return undefined;
  const out: Record<Id, number> = {};
  for (const def of scenario.clocks ?? []) {
    if (!def.source || def.direction !== 'fill') continue;
    const ceiling = (def.cues[0]?.at ?? 100) - 1;
    const start = Math.round(Math.min(ceiling, def.start + lift) * 10) / 10;
    if (start > def.start) out[def.id] = start;
  }
  return Object.keys(out).length ? out : undefined;
}
