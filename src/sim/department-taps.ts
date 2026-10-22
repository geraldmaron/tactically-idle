// Paid details (tap-earn): each tap is a stretch of billable extra-duty work by the free officers of
// the squads on patrol. It credits TAP_TUNING.base funding times the held multipliers, posted to
// the ledger as its own line, and adds TAP_TUNING.base * stressPerDollar strain split across those
// officers (owner 2026-10-21). Nobody is pushed past the strained line: when every free patrol
// officer is there, taps pay nothing until they recover. Standby and resting squads, and officers on
// a call, in training, on a detail or injured, never take the strain. That strain, not a money cap,
// is what keeps tapping in proportion to running the department, and it grows with the roster.
//
// Taps are commands, never a rate: settle() books nothing for them, so they cannot accrue offline,
// and the books credit at most TAP_TUNING.maxPerSecond taps a second (a refill-limited allowance
// that holds at most one burst), so an autoclicker can't drain the room faster than that. The
// 24-hour accrual cap in economy.ts is not involved; stress recovery while away refills the room.
//
// Multipliers come from a registry. Granting copies an entry into the save, so a held multiplier
// keeps the factor it was granted with. Upgrades, power-ups and entitlements share one code path;
// only the base ships today, and nothing a player can send grants one. They stack the way the long
// running idle games stack bonuses (owner 2026-10-21): bonuses of one kind add, and the kinds
// multiply, so each new source is worth having without one kind compounding on itself.
import type { ActiveMultiplier, Department, GameState, HandlerResult, Id, MultiplierSource, Officer, TapState } from './types';
import { postFunding } from './ledger';
import { tunable } from './tuning';
import { STRESS_BANDS } from './officer';

/** Tunable (sim/tuning.ts). */
export const TAP_TUNING = tunable('TAP_TUNING', {
  /** Funding one tap credits before multipliers. */
  base: 1,
  /** Most taps the books credit per second of game time. */
  maxPerSecond: 20,
  /** Seconds of taps the allowance can hold, so a short burst above the rate still counts. */
  burstSeconds: 1,
  /** Strain each dollar of base pay puts on the free patrol officers, split across them.
   * Multipliers raise the pay of a tap, not its strain. */
  stressPerDollar: 0.1,
}, {
  guard: (t) => !(t.base > 0) ? 'One tap must credit more than nothing.'
    : !(t.maxPerSecond > 0) ? 'The tap rate must be above zero.'
    : !(t.burstSeconds > 0) ? 'The burst must hold some taps.'
    : !(t.maxPerSecond * t.burstSeconds >= 1) ? 'The burst must hold at least one whole tap, or no tap ever counts.'
    : !(t.stressPerDollar > 0) ? 'Paid details must cost the officers some strain.' : null,
});

/** The most taps one command may carry; a larger batch is refused, not trimmed. */
export const MAX_TAP_BATCH = 1000;
/** No one multiplier may exceed this, the combined multiplier may not exceed MAX_COMBINED_MULTIPLIER,
 * and a department holds at most MAX_MULTIPLIERS, so a bad entry or save can't overflow the books. */
export const MAX_MULTIPLIER_FACTOR = 1000;
export const MAX_COMBINED_MULTIPLIER = 100_000;
export const MAX_MULTIPLIERS = 64;

export const LEDGER_TAP_LABEL = 'Paid details';
/** Officers stop taking paid details at this stress (owner 2026-10-21: the strained line). */
export const DETAIL_STRAIN_LINE = STRESS_BANDS.strained;

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

/** Strain one tap puts on the free patrol officers, split across them. */
export const strainPerTap = () => TAP_TUNING.base * TAP_TUNING.stressPerDollar;

/** Why taps would pay nothing right now, or null: no squad on patrol, nobody on patrol free, or every
 * free patrol officer at the strain line. */
export type DetailBlock = 'no-patrol' | 'none-free' | 'at-line';

export interface DetailRoom {
  /** Free patrol officers still under the line, who share the strain. */
  officerIds: Id[];
  /** Strain they can still take in total. */
  room: number;
  /** Whole taps that room holds. */
  taps: number;
  /** The room fresh officers would have: the line times every free patrol officer. */
  capacity: number;
  /** The squads on patrol with anyone in them, by name. */
  squads: string[];
  block: DetailBlock | null;
}

/** Who can work paid details at `at` and how much more they can take. */
export function detailRoom(state: Pick<GameState, 'squads' | 'officers'>, at: number): DetailRoom {
  const line = DETAIL_STRAIN_LINE;
  const patrol = state.squads.filter((sq) => sq.duty === 'patrol');
  // Each officer once, even if a malformed roster lists them in two patrol squads.
  const free = [...new Set(patrol.flatMap((sq) => sq.officerIds))].map((id) => state.officers[id])
    .filter((o): o is Officer => !!o && !o.assignment && !(o.injury && o.injury.until > at));
  const under = free.filter((o) => o.stress < line);
  const room = under.reduce((sum, o) => sum + (line - o.stress), 0);
  // The small allowance keeps a room that is a whole number of taps from rounding one short.
  const taps = Math.floor(room / strainPerTap() + 1e-9);
  const block: DetailBlock | null = !patrol.some((sq) => sq.officerIds.length) ? 'no-patrol' : !free.length ? 'none-free' : taps < 1 ? 'at-line' : null;
  const squads = patrol.filter((sq) => sq.officerIds.length).map((sq) => sq.name);
  return { officerIds: under.map((o) => o.id), room, taps, capacity: line * free.length, squads, block };
}

/** Spread `total` strain evenly across `officers`, filling anyone who reaches `line` and sharing
 * the rest among the others. The caller keeps `total` within their room. */
function spreadStrain(officers: Officer[], total: number, line: number): void {
  const open = officers.filter((o) => o.stress < line).sort((a, b) => b.stress - a.stress);
  let left = total;
  while (left > 1e-9 && open.length) {
    const share = left / open.length;
    const nearest = open[0];
    if (line - nearest.stress <= share) {
      left -= line - nearest.stress;
      nearest.stress = line;
      open.shift();
    } else {
      for (const o of open) o.stress = Math.min(line, o.stress + share);
      left = 0;
    }
  }
}

/** Credit up to `count` taps at game time `at`. Taps beyond the rate allowance or the officers'
 * room are dropped, not banked. */
export function tapEarn(state: GameState, count: number, at: number): HandlerResult {
  const dep = state.department;
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_TAP_BATCH) return { ok: false, reason: `Taps come in batches of 1 to ${MAX_TAP_BATCH}` };
  const room = detailRoom(state, at);
  if (room.block === 'no-patrol') return { ok: false, reason: 'No squad is on patrol to work paid details' };
  if (room.block === 'none-free') return { ok: false, reason: 'Every patrol officer is busy or hurt' };
  if (room.block === 'at-line') return { ok: false, reason: 'Every free patrol officer is at the strain line' };
  const allowance = tapAllowance(dep, at);
  const credited = Math.min(count, Math.floor(allowance), room.taps);
  if (credited < 1) return { ok: false, reason: 'The desk is keeping up as fast as it can' };
  const amount = credited * tapValue(dep, at);
  const last = dep.ledger?.at(-1);
  if (!Number.isFinite(amount) || !Number.isFinite(dep.funding + amount) || (last?.kind === 'tap' && !Number.isFinite(last.amount + amount))) {
    return { ok: false, reason: 'The books cannot take that much' };
  }
  const taps = (dep.taps ??= createTapState(at));
  taps.credit = allowance - credited;
  taps.at = Math.max(taps.at, at);
  spreadStrain(room.officerIds.map((id) => state.officers[id]), credited * strainPerTap(), DETAIL_STRAIN_LINE);
  postFunding(dep, amount, 'tap', LEDGER_TAP_LABEL, at, { foldAcrossAccrual: true });
  return { ok: true };
}
