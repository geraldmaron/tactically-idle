import { MockStoreProvider } from './mock-provider';
import { newLocalId, TEST_PRODUCTS, type MockProvider, type ProviderEvent, type TestTransaction, type TestWallet } from './types';

const validId = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x);
const integer = (x: unknown): x is number => Number.isSafeInteger(x) && (x as number) >= 0;
const credited = (t: TestTransaction) => t.status === 'credited' || t.status === 'completed';
export const allocated = (t: TestTransaction) => Object.values(t.allocations).reduce((a, b) => a + b, 0);
export const availableInLot = (t: TestTransaction) => credited(t) && t.refundedAt === undefined ? t.milliDP - t.debtPaid - t.spent - allocated(t) : 0;
export const availableTestMilli = (wallet: TestWallet) => wallet.transactions.reduce((n, t) => n + availableInLot(t), 0);
export const campaignTestMilli = (wallet: TestWallet, campaignId: string | null) => campaignId
  ? wallet.transactions.reduce((n, t) => n + (t.refundedAt === undefined && credited(t) ? t.allocations[campaignId] ?? 0 : 0), 0) : 0;
export const emptyTestWallet = (): TestWallet => ({ version: 1, installationId: newLocalId(), revision: 0, debt: 0, transactions: [] });

export function validTestWallet(value: unknown): value is TestWallet {
  if (!value || typeof value !== 'object') return false;
  const w = value as TestWallet;
  if (w.version !== 1 || !validId(w.installationId) || !integer(w.revision) || !integer(w.debt) || !Array.isArray(w.transactions)) return false;
  const keys = new Set<string>(); const requests = new Set<string>();
  return w.transactions.every((t) => {
    if (!t || !validId(t.key) || !validId(t.requestId) || keys.has(t.key) || requests.has(t.requestId)
      || !['apple', 'google'].includes(t.provider) || t.environment !== 'local-test'
      || t.key !== `mock:${t.provider}:${t.requestId}` || !TEST_PRODUCTS.some((p) => p.id === t.productId && p.milliDP === t.milliDP)
      || !Number.isFinite(t.createdAt) || !Number.isFinite(t.updatedAt)
      || !['pending', 'cancelled', 'failed', 'credited', 'completed'].includes(t.status)
      || !integer(t.debtPaid) || !integer(t.spent) || typeof t.completionFailed !== 'boolean'
      || (t.claimCampaignId !== undefined && !validId(t.claimCampaignId))
      || (t.claimDelivered !== undefined && (typeof t.claimDelivered !== 'boolean' || !t.claimCampaignId))
      || (t.claimDelivered === true && !credited(t))
      || !t.allocations || typeof t.allocations !== 'object' || Array.isArray(t.allocations)
      || !Object.entries(t.allocations).every(([id, n]) => validId(id) && integer(n))
      || (t.refundedAt !== undefined && (!Number.isFinite(t.refundedAt) || !credited(t)))
      || t.spent + t.debtPaid + allocated(t) > t.milliDP
      || (!credited(t) && (t.spent !== 0 || t.debtPaid !== 0 || allocated(t) !== 0))
      || (t.refundedAt !== undefined && allocated(t) !== 0)) return false;
    keys.add(t.key); requests.add(t.requestId); return true;
  });
}
function transaction(wallet: TestWallet, key: string) {
  const t = wallet.transactions.find((x) => x.key === key);
  if (!t) throw new Error('Unknown test transaction');
  return t;
}
export function beginTestPurchase(wallet: TestWallet, provider: MockProvider, productId: string, requestId: string, now: number): string {
  if (!['apple', 'google'].includes(provider) || !validId(requestId) || !validId(`mock:${provider}:${requestId}`)) throw new Error('Invalid test purchase request');
  const existing = wallet.transactions.find((t) => t.requestId === requestId);
  if (existing) {
    if (existing.provider !== provider || existing.productId !== productId) throw new Error('Test request already belongs to another product');
    return existing.key;
  }
  const start = new MockStoreProvider(provider).startPurchase(productId, requestId);
  const product = TEST_PRODUCTS.find((p) => p.id === productId)!;
  wallet.transactions.push({ ...start, createdAt: now, updatedAt: now, status: 'pending', milliDP: product.milliDP,
    debtPaid: 0, spent: 0, allocations: {}, completionFailed: false });
  wallet.revision++;
  return start.key;
}
export function applyTestEvent(wallet: TestWallet, event: ProviderEvent, now: number): void {
  const t = transaction(wallet, event.key);
  if (event.environment !== 'local-test' || event.provider !== t.provider || event.productId !== t.productId) throw new Error('Unrecognized test receipt');
  if (credited(t) || t.status === 'failed' || t.status === 'cancelled') return;
  if (!['success', 'completion_failure', 'pending', 'cancel', 'fail'].includes(event.outcome)) throw new Error('Unknown test outcome');
  if (event.outcome === 'pending') return;
  if (event.outcome === 'cancel' || event.outcome === 'fail') t.status = event.outcome === 'cancel' ? 'cancelled' : 'failed';
  else {
    if (event.verified !== true) throw new Error('Test receipt has not been verified');
    t.status = 'credited';
    t.debtPaid = Math.min(t.milliDP, wallet.debt);
    wallet.debt -= t.debtPaid;
    t.completionFailed = event.outcome === 'completion_failure';
  }
  t.updatedAt = now; wallet.revision++;
}
export function completeTestPurchase(wallet: TestWallet, key: string, now: number, simulateFailure = false): void {
  const t = transaction(wallet, key);
  if (t.status === 'completed') return;
  const result = new MockStoreProvider(t.provider).complete(t, simulateFailure);
  if (result.completed) { t.status = 'completed'; t.completionFailed = false; }
  else t.completionFailed = true;
  t.updatedAt = now; wallet.revision++;
}
export function allocateTestMilli(wallet: TestWallet, campaignId: string, amount: number): void {
  if (!validId(campaignId) || !integer(amount) || amount === 0) throw new Error('Choose a positive test DP amount');
  if (availableTestMilli(wallet) < amount) throw new Error('Not enough unallocated test DP');
  let remaining = amount;
  for (const t of wallet.transactions) {
    const take = Math.min(remaining, availableInLot(t));
    if (take > 0) { t.allocations[campaignId] = (t.allocations[campaignId] ?? 0) + take; remaining -= take; }
  }
  wallet.revision++;
}
export function unassignTestMilli(wallet: TestWallet, campaignId: string): void {
  for (const t of wallet.transactions) delete t.allocations[campaignId];
  wallet.revision++;
}
export function spendTestMilli(wallet: TestWallet, campaignId: string, amount: number): void {
  if (!integer(amount) || campaignTestMilli(wallet, campaignId) < amount) throw new Error('Not enough allocated test DP');
  if (!amount) return;
  let remaining = amount;
  for (const t of wallet.transactions) {
    if (t.refundedAt !== undefined || !credited(t)) continue;
    const take = Math.min(remaining, t.allocations[campaignId] ?? 0);
    if (take) { t.allocations[campaignId] -= take; t.spent += take; remaining -= take; }
  }
  wallet.revision++;
}
export function refundTestPurchase(wallet: TestWallet, key: string, now: number): void {
  const t = transaction(wallet, key);
  if (!credited(t)) throw new Error('Only a credited test transaction can be refunded');
  if (t.refundedAt !== undefined) return;
  wallet.debt += t.spent + t.debtPaid;
  t.allocations = {}; t.refundedAt = now; t.updatedAt = now; wallet.revision++;
}
