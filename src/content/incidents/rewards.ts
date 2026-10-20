// What a call pays by its tier. Authored data the call compiler bakes into each issued call
// (gen/incident/trees-v13/compile.ts): funding, experience and trust all scale by it.
// Changing it changes generated calls, so the lab lists it read-only.

/** Reward multiplier by tier 1..5, read when a call is compiled. */
export const TIER_REWARD_MULTIPLIERS: readonly number[] = [1.0, 1.35, 1.8, 2.4, 3.2];

/** Tier 1..5 (clamped, rounded) -> reward multiplier applied to funding, experience and trust. */
export function tierRewardMultiplier(tier: number): number {
  const t = Number.isFinite(tier) ? Math.min(5, Math.max(1, Math.round(tier))) : 1;
  return TIER_REWARD_MULTIPLIERS[t - 1];
}
