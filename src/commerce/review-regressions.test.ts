import { describe, expect, it } from 'vitest';
import { CampaignSlots, SLOTS_KEY } from '../sim/campaign-slots';
import { createInitialState } from '../sim/department';
import { SAVE_KEY, serialize } from '../sim/save';
import { createSaveEnvironment } from '../ui/save-environment';
import { applyTestEvent, availableTestMilli, beginTestPurchase, emptyTestWallet, validTestWallet } from './ledger';
import type { ProviderEvent } from './types';

const T0 = Date.UTC(2026, 9, 3);
function storageFixture() {
  const values = new Map<string, string>();
  let quota = false;
  return {
    values,
    setQuota: (value: boolean) => { quota = value; },
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (quota) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      values.set(key, value);
    },
  };
}
function credit(campaigns: CampaignSlots, requestId = 'review-credit') {
  expect(campaigns.beginPurchase('apple', 'mock.dp.3', requestId, T0).ok).toBe(true);
  const key = `mock:apple:${requestId}`;
  expect(campaigns.resolvePurchase(key, 'success', T0).ok).toBe(true);
  return key;
}

describe('independent commerce safety review regressions', () => {
  it.each(['false', 'true', 1, {}, []])('rejects non-boolean verification %j without credit', (verified) => {
    const wallet = emptyTestWallet();
    const key = beginTestPurchase(wallet, 'apple', 'mock.dp.3', 'malformed-verification', T0);
    const event = { key, provider: 'apple', environment: 'local-test', productId: 'mock.dp.3', outcome: 'success', verified } as unknown as ProviderEvent;
    expect(() => applyTestEvent(wallet, event, T0)).toThrow();
    expect(availableTestMilli(wallet)).toBe(0);
    expect(wallet.transactions[0].status).toBe('pending');
  });

  it.each(['apple', 'google'] as const)('never accepts a %s request that makes its own durable bank unreadable', (provider) => {
    const storage = storageFixture();
    const campaigns = new CampaignSlots(storage, T0, () => 17);
    const before = storage.getItem(SLOTS_KEY);
    const result = campaigns.beginPurchase(provider, 'mock.dp.3', 'a'.repeat(160), T0);
    if (!result.ok) expect(storage.getItem(SLOTS_KEY)).toBe(before);
    expect(validTestWallet(JSON.parse(storage.getItem(SLOTS_KEY)!).commerce)).toBe(true);
    const reloaded = new CampaignSlots(storage, T0, () => 18);
    expect(reloaded.getSnapshot().issue).toBeNull();
    expect(reloaded.getSnapshot().campaignId).toBe(campaigns.getSnapshot().campaignId);
  });

  it('leaves both callback credit and campaign snapshot unchanged when persistence fails', () => {
    const storage = storageFixture();
    const campaigns = new CampaignSlots(storage, T0, () => 17);
    campaigns.beginPurchase('apple', 'mock.dp.3', 'quota-event', T0);
    const before = storage.getItem(SLOTS_KEY);
    const state = campaigns.getSnapshot().state;
    const commerce = structuredClone(campaigns.getSnapshot().commerce);
    storage.setQuota(true);
    expect(campaigns.resolvePurchase('mock:apple:quota-event', 'success', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(before);
    expect(campaigns.getSnapshot().state).toBe(state);
    expect(campaigns.getSnapshot().commerce).toEqual(commerce);
    storage.setQuota(false);
    expect(campaigns.resolvePurchase('mock:apple:quota-event', 'success', T0).ok).toBe(true);
    expect(availableTestMilli(campaigns.getSnapshot().commerce)).toBe(3000);
  });

  it('refuses stale callback credit after another tab has allocated the same bank', () => {
    const storage = storageFixture();
    const first = new CampaignSlots(storage, T0, () => 17);
    const key = credit(first);
    const stale = new CampaignSlots(storage, T0, () => 18);
    first.allocatePurchase(first.getSnapshot().campaignId!, 3000, T0);
    const before = storage.getItem(SLOTS_KEY);
    expect(stale.resolvePurchase(key, 'success', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(before);
    expect(new CampaignSlots(storage, T0).getSnapshot().developmentBudget.testDP).toBe(3);
  });

  it('keeps a migrated campaign UUID stable across failed migration and the first successful wallet write', () => {
    const storage = storageFixture();
    const state = createInitialState(T0, 17);
    const original = JSON.stringify({ version: 1, activeSlotId: 1, slots: [{ name: 'Legacy', createdAt: T0, savedAt: T0, data: serialize(state, T0) }, ...Array(9).fill(null)] });
    storage.setItem(SLOTS_KEY, original);
    storage.setQuota(true);
    const campaigns = new CampaignSlots(storage, T0, () => 18);
    const campaignId = campaigns.getSnapshot().campaignId;
    expect(storage.getItem(SLOTS_KEY)).toBe(original);
    storage.setQuota(false);
    credit(campaigns);
    expect(campaigns.allocatePurchase(campaignId!, 3000, T0).ok).toBe(true);
    const reloaded = new CampaignSlots(storage, T0, () => 19);
    expect(reloaded.getSnapshot().campaignId).toBe(campaignId);
    expect(reloaded.getSnapshot().state).toEqual(state);
    expect(reloaded.getSnapshot().developmentBudget.testDP).toBe(3);
  });

  it('does not let overwrite, copy, import, or normal recovery export inherit spendable test DP', () => {
    const storage = storageFixture();
    const campaigns = new CampaignSlots(storage, T0, () => 17);
    const originalCampaign = campaigns.getSnapshot().campaignId!;
    credit(campaigns);
    campaigns.allocatePurchase(originalCampaign, 3000, T0);
    const game = campaigns.exportCurrent(T0);
    const earned = campaigns.getSnapshot().state.department.devPoints;
    expect(campaigns.saveAs(2, 'Copy', T0).ok).toBe(true);
    expect(campaigns.getSnapshot().campaignId).not.toBe(originalCampaign);
    expect(campaigns.getSnapshot().developmentBudget).toEqual({ earnedDP: earned, testDP: 0, totalDP: earned });
    expect(campaigns.importGame(3, 'Imported', game, T0).ok).toBe(true);
    expect(campaigns.load(3, T0).ok).toBe(true);
    expect(campaigns.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(campaigns.newGame(1, 'Overwrite', T0, true).ok).toBe(true);
    expect(campaigns.getSnapshot().campaignId).not.toBe(originalCampaign);
    expect(campaigns.getSnapshot().developmentBudget.testDP).toBe(0);
    const recovery = campaigns.exportRecovery()!;
    expect(recovery).not.toContain(originalCampaign);
    expect(recovery).not.toContain('commerce');
    expect(recovery).not.toContain('installationId');
    expect(campaigns.unassignPurchase(originalCampaign, T0).ok).toBe(true);
    expect(availableTestMilli(campaigns.getSnapshot().commerce)).toBe(3000);
  });

  it('refuses credit and allocation on a no-lock browser without changing its durable bank', () => {
    const storage = storageFixture();
    const original = new CampaignSlots(storage, T0, () => 17);
    original.beginPurchase('apple', 'mock.dp.3', 'no-lock', T0);
    const before = storage.getItem(SLOTS_KEY);
    const environment = createSaveEnvironment({ search: '', framed: false, getLocks: () => null, getLocalStorage: () => storage });
    const campaigns = new CampaignSlots(environment.storage(), T0, () => 18);
    expect(campaigns.resolvePurchase('mock:apple:no-lock', 'success', T0).ok).toBe(false);
    expect(campaigns.allocatePurchase(campaigns.getSnapshot().campaignId!, 3000, T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(before);
    expect(availableTestMilli(campaigns.getSnapshot().commerce)).toBe(0);
  });

  it.each([0, 0.123456789, 1.9999, 2, 3.125])('conserves fractional earned/test balance when unlocking from %s earned DP', (earned) => {
    const storage = storageFixture();
    const state = createInitialState(T0, 17);
    state.department.devPoints = earned;
    state.department.funding = 10000;
    storage.setItem(SAVE_KEY, serialize(state, T0));
    const campaigns = new CampaignSlots(storage, T0, () => 18);
    credit(campaigns);
    campaigns.allocatePurchase(campaigns.getSnapshot().campaignId!, 3000, T0);
    expect(campaigns.unlockDevelopment('personnel_negotiation', T0).ok).toBe(true);
    const snapshot = campaigns.getSnapshot();
    const spent = snapshot.commerce.transactions[0].spent / 1000;
    expect(snapshot.state.department.devPoints).toBeGreaterThanOrEqual(0);
    expect(earned - snapshot.state.department.devPoints + spent).toBeCloseTo(2, 12);
    expect(spent).toBe(earned >= 2 ? 0 : Math.ceil((2 - earned) * 1000 - 1e-8) / 1000);
    expect(snapshot.developmentBudget.testDP).toBe(3 - spent);
    expect(snapshot.state.department.unlockedNodes).toContain('personnel_negotiation');
    expect(snapshot.state.department.funding).toBe(9200);
    const copied = JSON.parse(campaigns.exportCurrent(T0));
    expect(JSON.stringify(copied)).not.toContain('commerce');
    expect(new CampaignSlots(storage, T0).getSnapshot().developmentBudget).toEqual(snapshot.developmentBudget);
  });

  it('rolls back unlock, funding and test debit together on storage failure, then applies once on retry', () => {
    const storage = storageFixture();
    const state = createInitialState(T0, 17);
    state.department.devPoints = 0.123456;
    state.department.funding = 10000;
    storage.setItem(SAVE_KEY, serialize(state, T0));
    const campaigns = new CampaignSlots(storage, T0, () => 18);
    credit(campaigns);
    campaigns.allocatePurchase(campaigns.getSnapshot().campaignId!, 3000, T0);
    const before = storage.getItem(SLOTS_KEY);
    const game = structuredClone(campaigns.getSnapshot().state);
    const commerce = structuredClone(campaigns.getSnapshot().commerce);
    storage.setQuota(true);
    expect(campaigns.unlockDevelopment('personnel_negotiation', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(before);
    expect(campaigns.getSnapshot().state).toEqual(game);
    expect(campaigns.getSnapshot().commerce).toEqual(commerce);
    storage.setQuota(false);
    expect(campaigns.unlockDevelopment('personnel_negotiation', T0).ok).toBe(true);
    const after = storage.getItem(SLOTS_KEY);
    expect(campaigns.unlockDevelopment('personnel_negotiation', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(after);
    expect(campaigns.getSnapshot().commerce.transactions[0].spent).toBe(1877);
  });

  it('restores a deleted campaign identity and its allocation, while unassigning prevents restoration of credits', () => {
    const storage = storageFixture();
    const campaigns = new CampaignSlots(storage, T0, () => 17);
    credit(campaigns);
    const id = campaigns.getSnapshot().campaignId!;
    campaigns.allocatePurchase(id, 3000, T0);
    campaigns.newGame(2, 'Other', T0);
    campaigns.delete(1, T0, true);
    expect(campaigns.undoDelete(T0).ok).toBe(true);
    expect(campaigns.load(1, T0).ok).toBe(true);
    expect(campaigns.getSnapshot().campaignId).toBe(id);
    expect(campaigns.getSnapshot().developmentBudget.testDP).toBe(3);
    campaigns.load(2, T0);
    campaigns.delete(1, T0, true);
    campaigns.unassignPurchase(id, T0);
    campaigns.undoDelete(T0);
    campaigns.load(1, T0);
    expect(campaigns.getSnapshot().campaignId).toBe(id);
    expect(campaigns.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(availableTestMilli(campaigns.getSnapshot().commerce)).toBe(3000);
  });

  it('makes refund debt, completion retries, replay and refund-of-debt-payment idempotent without altering earned progress', () => {
    const storage = storageFixture();
    const state = createInitialState(T0, 17);
    state.department.devPoints = 0;
    state.department.funding = 10000;
    storage.setItem(SAVE_KEY, serialize(state, T0));
    const campaigns = new CampaignSlots(storage, T0, () => 18);
    const firstKey = credit(campaigns, 'refund-first');
    campaigns.allocatePurchase(campaigns.getSnapshot().campaignId!, 3000, T0);
    campaigns.unlockDevelopment('personnel_negotiation', T0);
    const game = structuredClone(campaigns.getSnapshot().state);
    expect(campaigns.refundPurchase(firstKey, T0).ok).toBe(true);
    expect(campaigns.getSnapshot().commerce.debt).toBe(2000);
    expect(campaigns.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(availableTestMilli(campaigns.getSnapshot().commerce)).toBe(0);
    campaigns.refundPurchase(firstKey, T0);
    campaigns.resolvePurchase(firstKey, 'success', T0);
    campaigns.resolvePurchase(firstKey, 'cancel', T0);
    campaigns.reconcilePurchases(T0);
    expect(campaigns.getSnapshot().commerce.debt).toBe(2000);
    const secondKey = credit(campaigns, 'refund-second');
    expect(campaigns.getSnapshot().commerce.debt).toBe(0);
    expect(campaigns.getSnapshot().commerce.transactions[1].debtPaid).toBe(2000);
    expect(availableTestMilli(campaigns.getSnapshot().commerce)).toBe(1000);
    campaigns.completePurchase(secondKey, T0, true);
    campaigns.resolvePurchase(secondKey, 'success', T0);
    campaigns.reconcilePurchases(T0);
    expect(availableTestMilli(campaigns.getSnapshot().commerce)).toBe(1000);
    campaigns.refundPurchase(secondKey, T0);
    campaigns.refundPurchase(secondKey, T0);
    expect(campaigns.getSnapshot().commerce.debt).toBe(2000);
    expect(availableTestMilli(campaigns.getSnapshot().commerce)).toBe(0);
    expect(campaigns.getSnapshot().state).toEqual(game);
    const reloaded = new CampaignSlots(storage, T0, () => 19);
    expect(reloaded.getSnapshot().commerce).toEqual(campaigns.getSnapshot().commerce);
    expect(reloaded.getSnapshot().state).toEqual(game);
  });

  it('preserves unreadable commerce and the legacy recovery source without replacing either', () => {
    const storage = storageFixture();
    const original = new CampaignSlots(storage, T0, () => 17);
    const malformed = JSON.parse(storage.getItem(SLOTS_KEY)!);
    malformed.commerce.debt = -1;
    storage.setItem(SLOTS_KEY, JSON.stringify(malformed));
    storage.setItem(SAVE_KEY, original.exportCurrent(T0));
    const before = storage.getItem(SLOTS_KEY);
    const oldRecovery = storage.getItem(SAVE_KEY);
    const campaigns = new CampaignSlots(storage, T0, () => 18);
    expect(campaigns.beginPurchase('apple', 'mock.dp.3', 'corrupt', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(before);
    expect(storage.getItem(SAVE_KEY)).toBe(oldRecovery);
  });
});
