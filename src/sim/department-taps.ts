// Desk taps (tap-earn): the player taps the HQ desk and each tap credits TAP_TUNING.base funding
// times the product of the multipliers the department holds, posted to the ledger as its own line.
// Taps are commands, never a rate: settle() books nothing for them, so they cannot accrue offline,
// and the books credit at most TAP_TUNING.maxPerSecond taps a second (a refill-limited allowance
// that holds at most one burst), so an autoclicker can't print money and a long absence saves up
// no taps. The 24-hour accrual cap in economy.ts is not involved.
//
// Multipliers come from a registry. Granting copies an entry into the save, so a held multiplier
// keeps the factor it was granted with. Upgrades, power-ups and entitlements share one code path;
// only the base ships today, and nothing a player can send grants one.
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
    : !(t.burstSeconds > 0) ? 'The burst must hold some taps.' : null,
});

/** The most taps one command may carry; a larger batch is refused, not trimmed. */
export const MAX_TAP_BATCH = 1000;
/** No multiplier may exceed this, so a bad entry or save can't overflow the books. */
export const MAX_MULTIPLIER_FACTOR = 1000;

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
  if (!Number.isFinite(def.factor) || def.factor <= 0 || def.factor > MAX_MULTIPLIER_FACTOR) return `Multiplier ${def.id} needs a factor above 0 and at most ${MAX_MULTIPLIER_FACTOR}`;
  if (def.source === 'powerup' && !(Number.isFinite(def.durationMs) && def.durationMs! > 0)) return `Power-up ${def.id} needs a duration`;
  if (def.source !== 'powerup' && def.durationMs !== undefined) return `Only a power-up has a duration (${def.id})`;
  return null;
}

/** Hold `def` from `at`. Granting what is already held replaces it: an upgrade or entitlement takes
 * the new factor, and a power-up runs to the later of its old expiry and `at + durationMs` (the same
 * power-up never stacks with itself). */
export function grantMultiplier(taps: TapState, def: MultiplierDef, at: number): HandlerResult {
  const problem = multiplierProblem(def);
  if (problem) return { ok: false, reason: problem };
  const held = taps.multipliers.find((m) => m.id === def.id);
  const next: ActiveMultiplier = { id: def.id, source: def.source, factor: def.factor, grantedAt: at };
  if (def.source === 'powerup') next.expiresAt = Math.max(held?.expiresAt ?? 0, at + def.durationMs!);
  taps.multipliers = [...taps.multipliers.filter((m) => m.id !== def.id), next];
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

/** What one tap credits at `at`: the base times every multiplier still counting. */
export function tapValue(dep: Department, at: number): number {
  const factor = (dep.taps?.multipliers ?? []).filter((m) => counts(m, at)).reduce((product, m) => product * m.factor, 1);
  return TAP_TUNING.base * factor;
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
  const taps = (dep.taps ??= createTapState(at));
  taps.credit = allowance - credited;
  taps.at = Math.max(taps.at, at);
  postFunding(dep, credited * tapValue(dep, at), 'tap', LEDGER_TAP_LABEL, at, { foldAcrossAccrual: true });
  return { ok: true };
}
