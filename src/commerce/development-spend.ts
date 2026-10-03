/** Currency lots use integer milli-DP; earned fractional progress is retained. */
export function developmentSpendPlan(costDP: number, earnedDP: number) {
  if (!Number.isFinite(costDP) || costDP < 0 || !Number.isFinite(earnedDP) || earnedDP < 0) throw new Error('Invalid development balance');
  const costMilli = Math.round(costDP * 1000);
  if (!Number.isSafeInteger(costMilli) || Math.abs(costDP * 1000 - costMilli) > 1e-7) throw new Error('Invalid development price');
  const scaled = earnedDP * 1000;
  const nearest = Math.round(scaled);
  const normalized = Math.abs(scaled - nearest) <= Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4 ? nearest : scaled;
  const earnedMilli = Math.min(costMilli, Math.floor(normalized));
  const paidMilli = costMilli - earnedMilli;
  return { paidMilli, earnedUsed: earnedMilli / 1000, earnedRemaining: Math.max(0, earnedDP - earnedMilli / 1000) };
}
