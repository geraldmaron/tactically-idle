import { describe, expect, it } from 'vitest';
import { CampaignSlots, SLOTS_KEY } from '../sim/campaign-slots';
import { createInitialState } from '../sim/department';
import { SAVE_KEY, serialize } from '../sim/save';
import { availableTestMilli, validTestWallet } from './ledger';
import { developmentSpendPlan } from './development-spend';
const NOW = Date.UTC(2026, 9, 3);
function setup(earned = 0) {
  const data = new Map<string, string>(); let full = false;
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { if (full) throw new DOMException('Full', 'QuotaExceededError'); data.set(key, value); } };
  const state = createInitialState(NOW, 41); state.department.devPoints = earned;
  storage.setItem(SAVE_KEY, serialize(state, NOW));
  return { bank: new CampaignSlots(storage, NOW), storage, data, quota: (value: boolean) => { full = value; } };
}
describe('free player packs and preserved local balances', () => {
  it('confirms and saves one reward directly to the named campaign, without altering earned DP', () => {
    const { bank } = setup(0.7); const id = bank.getSnapshot().campaignId!;
    expect(bank.beginPointClaim('mock.dp.3', 'first', id, NOW).ok).toBe(true);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(bank.finishPointClaim('mock:apple:first', NOW).ok).toBe(true);
    expect(bank.getSnapshot().developmentBudget).toEqual({ earnedDP: 0.7, testDP: 3, totalDP: 3.7 });
    const receipt = bank.getSnapshot().commerce.transactions[0]; expect(receipt.status).toBe('completed');
    expect(receipt.claimDelivered).toBe(true); expect(validTestWallet(bank.getSnapshot().commerce)).toBe(true);
    expect(bank.finishPointClaim(receipt.key, NOW).ok).toBe(true); expect(bank.getSnapshot().developmentBudget.testDP).toBe(3);
  });
  it('resumes only confirmed pending claims after reload and cannot duplicate them', () => {
    const { bank, storage } = setup(); const id = bank.getSnapshot().campaignId!;
    bank.beginPointClaim('mock.dp.8', 'pending', id, NOW);
    bank.beginPurchase('google', 'mock.dp.3', 'old-pending', NOW);
    const loaded = new CampaignSlots(storage, NOW); expect(loaded.resumePointClaims(NOW).ok).toBe(true);
    expect(loaded.getSnapshot().developmentBudget.testDP).toBe(8);
    expect(loaded.getSnapshot().commerce.transactions[1].status).toBe('pending');
    new CampaignSlots(storage, NOW).resumePointClaims(NOW);
    expect(new CampaignSlots(storage, NOW).getSnapshot().developmentBudget.testDP).toBe(8);
  });
  it('rejects a stale confirmation, and a slot switch cannot redirect an already confirmed reward', () => {
    const { bank } = setup(); const id = bank.getSnapshot().campaignId!;
    bank.beginPointClaim('mock.dp.3', 'destination', id, NOW); bank.newGame(2, 'Second', NOW);
    expect(bank.beginPointClaim('mock.dp.3', 'stale', id, NOW).ok).toBe(false);
    expect(bank.finishPointClaim('mock:apple:destination', NOW).ok).toBe(true);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    bank.load(1, NOW); expect(bank.getSnapshot().developmentBudget.testDP).toBe(3);
  });
  it('keeps rewards available when the destination was overwritten during processing', () => {
    const { bank } = setup(); const old = bank.getSnapshot().campaignId!;
    bank.beginPointClaim('mock.dp.20', 'replaced', old, NOW); bank.newGame(1, 'Replacement', NOW, true);
    expect(bank.finishPointClaim('mock:apple:replaced', NOW).ok).toBe(true);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(availableTestMilli(bank.getSnapshot().commerce)).toBe(20000);
    expect(bank.claimHeldPoints(bank.getSnapshot().campaignId!, NOW).ok).toBe(true);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(20);
    bank.finishPointClaim('mock:apple:replaced', NOW); expect(bank.getSnapshot().developmentBudget.testDP).toBe(20);
  });
  it('rolls back quota failure, leaving the confirmed request available to retry once', () => {
    const { bank, storage, quota } = setup(); bank.beginPointClaim('mock.dp.3', 'quota', bank.getSnapshot().campaignId!, NOW);
    const before = storage.getItem(SLOTS_KEY); const wallet = bank.getSnapshot().commerce;
    quota(true); expect(bank.finishPointClaim('mock:apple:quota', NOW).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(before); expect(bank.getSnapshot().commerce).toBe(wallet);
    quota(false); expect(bank.resumePointClaims(NOW).ok).toBe(true); expect(bank.getSnapshot().developmentBudget.testDP).toBe(3);
  });
  it('protects deleted allocations while Undo is available, then returns orphaned points to the wallet', () => {
    const { bank } = setup(); bank.beginPointClaim('mock.dp.3', 'original', bank.getSnapshot().campaignId!, NOW); bank.finishPointClaim('mock:apple:original', NOW);
    bank.newGame(2, 'Second', NOW); bank.delete(1, NOW, true);
    expect(availableTestMilli(bank.getSnapshot().commerce)).toBe(0);
    bank.undoDelete(NOW); bank.load(1, NOW); expect(bank.getSnapshot().developmentBudget.testDP).toBe(3);
    bank.newGame(1, 'Replacement', NOW, true); expect(availableTestMilli(bank.getSnapshot().commerce)).toBe(3000);
  });
  it('does not grant cancelled requests or duplicate a request into another product', () => {
    const { bank } = setup(); const id = bank.getSnapshot().campaignId!;
    bank.beginPointClaim('mock.dp.3', 'cancel', id, NOW); bank.resolvePurchase('mock:apple:cancel', 'cancel', NOW);
    expect(bank.finishPointClaim('mock:apple:cancel', NOW).ok).toBe(false);
    expect(bank.beginPointClaim('mock.dp.8', 'cancel', id, NOW).ok).toBe(false);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
  });
  it('accepts exact 0.7 earned plus 0.3 allocated for a one-DP upgrade', () => {
    const { bank } = setup(0.7); bank.beginPurchase('apple', 'mock.dp.3', 'fraction', NOW); bank.resolvePurchase('mock:apple:fraction', 'success', NOW);
    bank.allocatePurchase(bank.getSnapshot().campaignId!, 300, NOW);
    expect(bank.unlockDevelopment('intel_records', NOW).ok).toBe(true);
    expect(bank.getSnapshot().commerce.transactions[0].spent).toBe(300);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(bank.getSnapshot().state.department.devPoints).toBe(0);
  });
  it.each([0.00000001, 0.123456, 0.9999, 1.9999999])('preserves the earned sub-milli fraction (%s)', (earned) => {
    const plan = developmentSpendPlan(2, earned);
    expect(plan.paidMilli).toBe(2000 - Math.floor(earned * 1000));
    expect(plan.earnedRemaining + plan.earnedUsed).toBeCloseTo(earned, 12);
    expect(plan.earnedRemaining).toBeGreaterThanOrEqual(0);
    expect(plan.earnedRemaining).toBeLessThan(0.001);
  });
  it('rejects another tab writing between confirmation and completion without replacing its bank', () => {
    const { bank, storage } = setup(); bank.beginPointClaim('mock.dp.3', 'tabs', bank.getSnapshot().campaignId!, NOW);
    const other = new CampaignSlots(storage, NOW); other.resumePointClaims(NOW);
    const changed = storage.getItem(SLOTS_KEY);
    expect(bank.finishPointClaim('mock:apple:tabs', NOW).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(changed);
    expect(other.getSnapshot().developmentBudget.testDP).toBe(3);
  });
});
