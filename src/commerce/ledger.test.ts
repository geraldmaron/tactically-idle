import { describe, expect, it } from 'vitest';
import { allocateTestMilli, applyTestEvent, availableTestMilli, beginTestPurchase, campaignTestMilli, completeTestPurchase, emptyTestWallet, refundTestPurchase, spendTestMilli, unassignTestMilli, validTestWallet } from './ledger';
import { MockStoreProvider } from './mock-provider';
import type { MockOutcome, TestWallet } from './types';
const now = 1000;
function purchase(w: TestWallet, request = 'request-one', product = 'mock.dp.3', outcome: MockOutcome = 'success') {
  const key = beginTestPurchase(w, 'apple', product, request, now);
  const t = w.transactions.find((t) => t.key === key)!;
  applyTestEvent(w, new MockStoreProvider('apple').resolve(t, outcome), now);
  return key;
}
describe('local simulated provider and entitlement ledger', () => {
  it('lists catalog products and grants exactly once across request retries, callbacks, completion and reconciliation', () => {
    const w = emptyTestWallet(); const key = purchase(w);
    purchase(w); purchase(w); completeTestPurchase(w, key, now, true);
    expect(w.transactions[0].completionFailed).toBe(true);
    completeTestPurchase(w, key, now); completeTestPurchase(w, key, now);
    applyTestEvent(w, new MockStoreProvider('apple').reconcile(w.transactions[0])!, now);
    expect(w.transactions).toHaveLength(1); expect(availableTestMilli(w)).toBe(3000);
    expect(w.transactions[0].status).toBe('completed'); expect(validTestWallet(w)).toBe(true);
  });
  it.each(['pending', 'fail', 'cancel'] as const)('%s grants no credits', (outcome) => {
    const w = emptyTestWallet(); purchase(w, 'test', 'mock.dp.8', outcome);
    expect(availableTestMilli(w)).toBe(0); expect(validTestWallet(w)).toBe(true);
    expect(new MockStoreProvider('apple').reconcile(w.transactions[0])).toBeNull();
    if (outcome !== 'pending') { purchase(w, 'test', 'mock.dp.8', 'success'); expect(availableTestMilli(w)).toBe(0); }
  });
  it('pending survives serialization then resolves once without active-campaign coupling', () => {
    const w = emptyTestWallet(); purchase(w, 'pending', 'mock.dp.8', 'pending');
    const reloaded: TestWallet = JSON.parse(JSON.stringify(w));
    purchase(reloaded, 'pending', 'mock.dp.8', 'success');
    allocateTestMilli(reloaded, 'campaign-b', 4500);
    expect(campaignTestMilli(reloaded, 'campaign-a')).toBe(0);
    expect(campaignTestMilli(reloaded, 'campaign-b')).toBe(4500);
    expect(availableTestMilli(reloaded)).toBe(3500);
  });
  it('rejects unverified, unknown-product, mismatched-provider and non-test receipts before credit', () => {
    const w = emptyTestWallet(); const key = beginTestPurchase(w, 'apple', 'mock.dp.3', 'valid', now);
    const event = new MockStoreProvider('apple').resolve(w.transactions[0], 'success');
    for (const change of [{ verified: false }, { productId: 'mock.dp.999' }, { environment: 'production' }, { provider: 'google' as const }, { key: 'missing' }]) {
      expect(() => applyTestEvent(w, { ...event, ...change }, now)).toThrow();
      expect(availableTestMilli(w)).toBe(0);
    }
    expect(() => beginTestPurchase(w, 'google', 'mock.dp.8', 'valid', now)).toThrow();
    expect(() => beginTestPurchase(w, 'google', 'not-a-product', 'new', now)).toThrow();
    expect(w.transactions[0].key).toBe(key);
  });
  it('allocates, spends earned-independent exact milli credits, and unassigns only unused balances', () => {
    const w = emptyTestWallet(); purchase(w);
    allocateTestMilli(w, 'one', 1250); allocateTestMilli(w, 'two', 1750);
    spendTestMilli(w, 'one', 333); unassignTestMilli(w, 'one');
    expect(campaignTestMilli(w, 'one')).toBe(0); expect(campaignTestMilli(w, 'two')).toBe(1750);
    expect(availableTestMilli(w)).toBe(917); expect(w.transactions[0].spent).toBe(333);
    expect(() => spendTestMilli(w, 'two', 1751)).toThrow();
    for (const amount of [0, -1, 0.5, NaN, Infinity, 918]) expect(() => allocateTestMilli(w, 'three', amount)).toThrow();
    expect(validTestWallet(w)).toBe(true);
  });
  it('refunds unspent and allocated credits once, carries only spent debt, and offsets later credits', () => {
    const w = emptyTestWallet(); const key = purchase(w);
    allocateTestMilli(w, 'one', 2000); spendTestMilli(w, 'one', 600);
    refundTestPurchase(w, key, now); refundTestPurchase(w, key, now);
    expect(availableTestMilli(w)).toBe(0); expect(campaignTestMilli(w, 'one')).toBe(0); expect(w.debt).toBe(600);
    const later = purchase(w, 'later'); expect(w.debt).toBe(0); expect(availableTestMilli(w)).toBe(2400);
    refundTestPurchase(w, later, now); expect(w.debt).toBe(600); expect(availableTestMilli(w)).toBe(0);
    purchase(w, 'third'); expect(w.debt).toBe(0); expect(availableTestMilli(w)).toBe(2400);
    expect(validTestWallet(w)).toBe(true);
  });
  it('refund before allocation removes the lot and late replay/cancel cannot restore or erase a fulfilled receipt', () => {
    const w = emptyTestWallet(); const key = purchase(w);
    purchase(w, 'request-one', 'mock.dp.3', 'cancel'); expect(availableTestMilli(w)).toBe(3000);
    refundTestPurchase(w, key, now); purchase(w); completeTestPurchase(w, key, now);
    expect(availableTestMilli(w)).toBe(0); expect(w.debt).toBe(0);
    expect(validTestWallet(w)).toBe(true);
  });
  it('fails closed for corrupt wallet invariants instead of discarding purchase history', () => {
    const w = emptyTestWallet(); purchase(w);
    for (const change of [{ debt: -1 }, { version: 2 }, { revision: NaN }, { transactions: [...w.transactions, w.transactions[0]] }]) expect(validTestWallet({ ...w, ...change })).toBe(false);
    w.transactions[0].allocations['one'] = 3001; expect(validTestWallet(w)).toBe(false);
  });
});
