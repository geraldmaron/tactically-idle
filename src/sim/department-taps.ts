// Desk taps (tap-earn): the player taps the HQ desk and each tap credits TAP_TUNING.base funding
// times the product of the multipliers the department holds, posted to the ledger as its own line.
// Taps are commands, never a rate: settle() books nothing for them, so they cannot accrue offline,
// and the books credit at most TAP_TUNING.maxPerSecond taps a second (a refill-limited allowance
// that holds at most one burst), so an autoclicker can't print money and a long absence saves up
// no taps. The 24-hour accrual cap in economy.ts is not involved.
//
// Multipliers come from a registry. Granting copies an entry into the save, so a held multiplier
// keeps the factor it was granted with. Upgrades, power-ups and entitlements share one code path;
// only the base ships today, and nothing a player can send grants one. They stack the way the long
// running idle games stack bonuses (owner 2026-10-21): bonuses of one kind add, and the kinds
// multiply, so each new source is worth having without one kind compounding on itself.
import type { ActiveMultiplier, Department, HandlerResult, Id, MultiplierSource, TapState } from './types';
import { postFunding } from './ledger';
import { tunable } from './tuning';

/** Tunable (sim/tuning.ts). */
export const TAP_TUNING = tunable('TAP_TUNING', {
  /** Funding one tap credits before multipliers. */
  base: 1,
  /** Most taps the books credit per second of game time. */
  maxPerSecond: 20,
  /** Seconds of taps the allowance can hold, so a short burst above the rate still counts. */
  burstSeconds: 1,
}, {
  guard: (t) => !(t.base > 0) ? 'One tap must credit more than nothing.'
    : !(t.maxPerSecond > 0) ? 'The tap rate must be above zero.'
    : !(t.burstSeconds > 0) ? 'The burst must hold some taps.'
    : !(t.maxPerSecond * t.burstSeconds >= 1) ? 'The burst must hold at least one whole tap, or no tap ever counts.' : null,
});

/** The most taps one command may carry; a larger batch is refused, not trimmed. */
export const MAX_TAP_BATCH = 1000;
/** No one multiplier may exceed this, the combined multiplier may not exceed MAX_COMBINED_MULTIPLIER,
 * and a department holds at most MAX_MULTIPLIERS, so a bad entry or save can't overflow the books. */
export const MAX_MULTIPLIER_FACTOR = 1000;
export const MAX_COMBINED_MULTIPLIER = 100_000;
export const MAX_MULTIPLIERS = 64;

export const LEDGER_TAP_LABEL = 'Desk paperwork';

export interface MultiplierDef {
  id: Id;
  source: MultiplierSource;
  factor: number;
  /** Power-ups only: game time it counts for once granted. */
  durationMs?: number;
}

/** Every multiplier that can be granted. Upgrades, power-ups and purchases add entries here. */
export const TAP_MULTIPLIERS: Readonly<Record<Id, MultiplierDef>> = {
  /** The standard rate every department starts with. */
  base: { id: 'base', source: 'upgrade', factor: 1 },
};

const burst = () => TAP_TUNING.maxPerSecond * TAP_TUNING.burstSeconds;

/** A new department's taps: a full allowance and the base multiplier. */
export function createTapState(at: number): TapState {
  const taps: TapState = { credit: burst(), at, multipliers: [] };
  grantMultiplier(taps, TAP_MULTIPLIERS.base, at);
  return taps;
}

/** Why `def` can't be held, or null. */
export function multiplierProblem(def: MultiplierDef): string | null {
  // A factor below 1 would let the combined multiplier rise when it expires, past what the grant checked.
  if (!Number.isFinite(def.factor) || def.factor < 1 || def.factor > MAX_MULTIPLIER_FACTOR) return `Multiplier ${def.id} needs a factor from 1 to ${MAX_MULTIPLIER_FACTOR}`;
  if (def.source === 'powerup' && !(Number.isFinite(def.durationMs) && def.durationMs! > 0)) return `Power-up ${def.id} needs a duration`;
  if (def.source !== 'powerup' && def.durationMs !== undefined) return `Only a power-up has a duration (${def.id})`;
  return null;
}

/** Hold `def` from `at`. Granting what is already held replaces it: an upgrade or entitlement takes
 * the new factor, and a power-up still running is extended by `durationMs` (owner 2026-10-21) while
 * one that has run out starts again from `at`. The same power-up never stacks with itself. */
export function grantMultiplier(taps: TapState, def: MultiplierDef, at: number): HandlerResult {
  const problem = multiplierProblem(def);
  if (problem) return { ok: false, reason: problem };
  const held = taps.multipliers.find((m) => m.id === def.id);
  const next: ActiveMultiplier = { id: def.id, source: def.source, factor: def.factor, grantedAt: at };
  if (def.source === 'powerup') {
    next.expiresAt = Math.max(held?.expiresAt ?? 0, at) + def.durationMs!;
    if (!Number.isFinite(next.expiresAt)) return { ok: false, reason: `Power-up ${def.id} can't run that long` };
  }
  const multipliers = [...taps.multipliers.filter((m) => m.id !== def.id), next];
  if (multipliers.length > MAX_MULTIPLIERS) return { ok: false, reason: `A department holds at most ${MAX_MULTIPLIERS} multipliers` };
  if (!(combinedFactor(multipliers) <= MAX_COMBINED_MULTIPLIER)) return { ok: false, reason: `Multipliers may not combine past ${MAX_COMBINED_MULTIPLIER}` };
  taps.multipliers = multipliers;
  return { ok: true };
}

/** A purchase's multiplier, by registry id. The store that will call this does not exist yet. */
export function grantEntitlement(taps: TapState, id: Id, at: number, registry: Readonly<Record<Id, MultiplierDef>> = TAP_MULTIPLIERS): HandlerResult {
  const def = registry[id];
  if (!def || def.source !== 'entitlement') return { ok: false, reason: `No entitlement ${id}` };
  return grantMultiplier(taps, def, at);
}

const counts = (m: ActiveMultiplier, at: number) => m.expiresAt === undefined || m.expiresAt > at;

/** Drop power-ups that have run out by `at` (settlement calls this). */
export function dropExpiredMultipliers(dep: Department, at: number): void {
  if (dep.taps) dep.taps.multipliers = dep.taps.multipliers.filter((m) => counts(m, at));
}

/** The combined multiplier at `at`: within a kind the bonuses add (×2 and ×1.5 make ×2.5), and the
 * kinds multiply (an upgrade ×2 and a power-up ×2 make ×4). */
export function tapMultiplier(dep: Department, at: number): number {
  return combinedFactor((dep.taps?.multipliers ?? []).filter((m) => counts(m, at)));
}

/** `multipliers` combined by tapMultiplier's rule, whatever their expiry. */
export function combinedFactor(multipliers: readonly Pick<ActiveMultiplier, 'source' | 'factor'>[]): number {
  const bonus: Partial<Record<MultiplierSource, number>> = {};
  for (const m of multipliers) bonus[m.source] = (bonus[m.source] ?? 0) + m.factor - 1;
  return Object.values(bonus).reduce((product, b) => product * (1 + b), 1);
}

/** What one tap credits at `at`: the base times the combined multiplier. */
export function tapValue(dep: Department, at: number): number {
  return TAP_TUNING.base * tapMultiplier(dep, at);
}

/** Taps the books would credit at `at`, fractional: the saved allowance refilled since it was saved,
 * up to one burst. A department with no tap state yet starts full. */
export function tapAllowance(dep: Department, at: number): number {
  const taps = dep.taps;
  if (!taps) return burst();
  return Math.min(burst(), taps.credit + (Math.max(0, at - taps.at) * TAP_TUNING.maxPerSecond) / 1000);
}

/** Credit up to `count` taps at game time `at`; taps beyond the allowance are dropped, not banked. */
export function tapEarn(dep: Department, count: number, at: number): HandlerResult {
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_TAP_BATCH) return { ok: false, reason: `Taps come in batches of 1 to ${MAX_TAP_BATCH}` };
  const allowance = tapAllowance(dep, at);
  const credited = Math.min(count, Math.floor(allowance));
  if (credited < 1) return { ok: false, reason: 'The desk is keeping up as fast as it can' };
  const amount = credited * tapValue(dep, at);
  const last = dep.ledger?.at(-1);
  if (!Number.isFinite(amount) || !Number.isFinite(dep.funding + amount) || (last?.kind === 'tap' && !Number.isFinite(last.amount + amount))) {
    return { ok: false, reason: 'The books cannot take that much' };
  }
  const taps = (dep.taps ??= createTapState(at));
  taps.credit = allowance - credited;
  taps.at = Math.max(taps.at, at);
  postFunding(dep, amount, 'tap', LEDGER_TAP_LABEL, at, { foldAcrossAccrual: true });
  return { ok: true };
}
