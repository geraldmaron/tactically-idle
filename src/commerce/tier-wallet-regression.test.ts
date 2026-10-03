import { describe, expect, it } from 'vitest';
import legacyWalletText from '../sim/fixtures/release-v4-wallet.json?raw';
import { CampaignSlots, SLOTS_KEY } from '../sim/campaign-slots';
import { createInitialState } from '../sim/department';
import { deserialize, SAVE_KEY, serialize } from '../sim/save';
import { availableTestMilli, campaignTestMilli } from './ledger';
import type { TestWallet } from './types';

const oldLibrary = JSON.parse(legacyWalletText);
const NOW = oldLibrary.slots[0].savedAt as number;
const firstCampaign = oldLibrary.slots[0].campaignId as string;
const secondCampaign = oldLibrary.slots[1].campaignId as string;
const oldWallet = oldLibrary.commerce as TestWallet;

function memory(raw?: string) {
  const entries = new Map<string, string>();
  if (raw) entries.set(SLOTS_KEY, raw);
  let full = false;
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (full) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      entries.set(key, value);
    },
  };
  return { storage, entries, quota: (value: boolean) => { full = value; } };
}
function historical() {
  const store = memory(legacyWalletText);
  return { ...store, bank: new CampaignSlots(store.storage, NOW, () => 903) };
}
function fresh(earned: number, funding = 100000) {
  const store = memory();
  const state = createInitialState(NOW, 13);
  state.department.devPoints = earned; state.department.funding = funding;
  store.storage.setItem(SAVE_KEY, serialize(state, NOW));
  return { ...store, bank: new CampaignSlots(store.storage, NOW, () => 41) };
}
function allocate(bank: CampaignSlots, milli: number) {
  expect(bank.beginPurchase('google', 'mock.dp.20', 'allocation', NOW).ok).toBe(true);
  expect(bank.resolvePurchase('mock:google:allocation', 'success', NOW).ok).toBe(true);
  expect(bank.allocatePurchase(bank.getSnapshot().campaignId!, milli, NOW).ok).toBe(true);
}
function expectOldOtherBalances(wallet: TestWallet) {
  expect(campaignTestMilli(wallet, secondCampaign)).toBe(1700);
  expect(availableTestMilli(wallet)).toBe(3000);
}

describe('tier purchases and player packs over a published v4 wallet', () => {
  it('preserves the complete previous ledger, campaign IDs, allocations and nonactive save bytes on load', () => {
    const { bank, storage } = historical();
    expect(bank.getSnapshot().issue).toBeNull();
    expect(storage.getItem(SLOTS_KEY)).toBe(legacyWalletText);
    expect(bank.getSnapshot().commerce).toEqual(oldWallet);
    expect(bank.getSnapshot().campaignId).toBe(firstCampaign);
    expect(bank.getSnapshot().developmentBudget).toEqual({ earnedDP: 0.70000001, testDP: 3.3, totalDP: 4.00000001 });
    expectOldOtherBalances(bank.getSnapshot().commerce);
    const beforeFunds = JSON.parse(oldLibrary.slots[0].data).state.department.funding;
    expect(bank.getSnapshot().state.department.funding).toBe(beforeFunds + 240);
    expect(bank.save(NOW).ok).toBe(true);
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[1]).toEqual(oldLibrary.slots[1]);
    const reloaded = new CampaignSlots(storage, NOW);
    expect(reloaded.getSnapshot().commerce).toEqual(oldWallet);
    expect(reloaded.getSnapshot().state).toEqual(bank.getSnapshot().state);
    expect(reloaded.getSnapshot().campaignId).toBe(firstCampaign);
  });

  it('pays all three incremental prices using earned DP, old allocations and one new pack without touching another campaign', () => {
    const { bank, storage } = historical();
    const startFunds = bank.getSnapshot().state.department.funding;
    const expectedRemainder = 0.70000001 - 0.7;
    expect(bank.unlockDevelopment('intel_records', NOW, 1).ok).toBe(true);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(3);
    expect(bank.getSnapshot().commerce.transactions[0].spent).toBe(300);
    expect(bank.getSnapshot().state.department.devPoints).toBe(expectedRemainder);
    expectOldOtherBalances(bank.getSnapshot().commerce);
    expect(bank.unlockDevelopment('intel_records', NOW, 2).ok).toBe(true);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(bank.getSnapshot().state.department.devPoints).toBe(expectedRemainder);
    expect(bank.getSnapshot().commerce.transactions[0].spent).toBe(3300);
    const oldLot = structuredClone(bank.getSnapshot().commerce.transactions[0]);
    expect(bank.beginPointClaim('mock.dp.8', 'tier-three-pack', firstCampaign, NOW).ok).toBe(true);
    expect(bank.finishPointClaim('mock:apple:tier-three-pack', NOW).ok).toBe(true);
    expect(bank.getSnapshot().commerce.transactions[0]).toEqual(oldLot);
    expect(bank.unlockDevelopment('intel_records', NOW, 3).ok).toBe(true);
    expect(bank.getSnapshot().state.department.developmentTiers.intel_records).toBe(3);
    expect(bank.getSnapshot().state.department.funding).toBe(startFunds - 1000 - 3000 - 6000);
    expect(bank.getSnapshot().state.department.devPoints).toBe(expectedRemainder);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(3);
    expect(bank.getSnapshot().commerce.transactions.map((receipt) => receipt.spent)).toEqual([3300, 5000]);
    expectOldOtherBalances(bank.getSnapshot().commerce);
    const reloaded = new CampaignSlots(storage, NOW);
    expect(reloaded.getSnapshot().commerce).toEqual(bank.getSnapshot().commerce);
    expect(reloaded.getSnapshot().state).toEqual(bank.getSnapshot().state);
    expect(reloaded.finishPointClaim('mock:apple:tier-three-pack', NOW).ok).toBe(true);
    expect(reloaded.getSnapshot().developmentBudget).toEqual(bank.getSnapshot().developmentBudget);
  });

  it('rejects skipped, stale, repeated and max-tier clicks atomically across state, money and receipts', () => {
    const { bank, storage } = historical();
    const reject = (tier: number) => {
      const before = bank.getSnapshot(); const raw = storage.getItem(SLOTS_KEY);
      expect(bank.unlockDevelopment('intel_records', NOW, tier).ok).toBe(false);
      expect(bank.getSnapshot().state).toBe(before.state);
      expect(bank.getSnapshot().commerce).toBe(before.commerce);
      expect(bank.getSnapshot().campaignId).toBe(before.campaignId);
      expect(storage.getItem(SLOTS_KEY)).toBe(raw);
    };
    reject(2); reject(0); reject(1.5);
    expect(bank.unlockDevelopment('intel_records', NOW, 1).ok).toBe(true);
    reject(1); reject(3);
    expect(bank.unlockDevelopment('intel_records', NOW, 2).ok).toBe(true);
    reject(2);
    expect(bank.beginPointClaim('mock.dp.8', 'max-tier', firstCampaign, NOW).ok).toBe(true);
    expect(bank.finishPointClaim('mock:apple:max-tier', NOW).ok).toBe(true);
    expect(bank.unlockDevelopment('intel_records', NOW, 3).ok).toBe(true);
    reject(3); reject(4);
  });

  it('rolls back a tier-II quota failure completely and charges it only once after retry and reload', () => {
    const { bank, storage, quota } = historical();
    expect(bank.unlockDevelopment('intel_records', NOW, 1).ok).toBe(true);
    const before = bank.getSnapshot(); const raw = storage.getItem(SLOTS_KEY);
    quota(true);
    expect(bank.unlockDevelopment('intel_records', NOW, 2).ok).toBe(false);
    expect(bank.getSnapshot().state).toBe(before.state);
    expect(bank.getSnapshot().commerce).toBe(before.commerce);
    expect(storage.getItem(SLOTS_KEY)).toBe(raw);
    quota(false);
    const reloaded = new CampaignSlots(storage, NOW);
    expect(reloaded.unlockDevelopment('intel_records', NOW, 2).ok).toBe(true);
    expect(reloaded.getSnapshot().state.department.funding).toBe(before.state.department.funding - 3000);
    expect(reloaded.getSnapshot().commerce.transactions[0].spent).toBe(3300);
    expect(reloaded.unlockDevelopment('intel_records', NOW, 2).ok).toBe(false);
    expect(new CampaignSlots(storage, NOW).getSnapshot().commerce).toEqual(reloaded.getSnapshot().commerce);
  });

  it('keeps allocations isolated through upgraded-save copy and import while preserving the purchased tier', () => {
    const { bank } = historical();
    expect(bank.unlockDevelopment('intel_records', NOW, 1).ok).toBe(true);
    const original = bank.getSnapshot();
    const text = bank.exportCurrent(NOW);
    expect(deserialize(text)!.department.developmentTiers.intel_records).toBe(1);
    expect(text).not.toContain(firstCampaign);
    expect(text).not.toContain('baseline-eight');
    expect(bank.saveAs(3, 'Tiered copy', NOW).ok).toBe(true);
    expect(bank.getSnapshot().campaignId).not.toBe(firstCampaign);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(bank.getSnapshot().state.department.developmentTiers.intel_records).toBe(1);
    expect(bank.importGame(4, 'Tiered import', text, NOW).ok).toBe(true);
    expect(bank.load(4, NOW).ok).toBe(true);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(bank.getSnapshot().state.department.developmentTiers.intel_records).toBe(1);
    expect(bank.getSnapshot().commerce).toEqual(original.commerce);
    expect(bank.load(2, NOW).ok).toBe(true);
    expect(bank.getSnapshot().campaignId).toBe(secondCampaign);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(1.7);
    expect(bank.getSnapshot().state.department.developmentTiers.intel_records).toBeUndefined();
    expect(bank.load(1, NOW).ok).toBe(true);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(3);
    expect(bank.getSnapshot().state).toEqual(original.state);
  });

  it('does not turn a stale tab into an extra tier purchase or a second point grant', () => {
    const { bank, storage } = historical();
    const stale = new CampaignSlots(storage, NOW);
    expect(bank.unlockDevelopment('intel_records', NOW, 1).ok).toBe(true);
    const saved = storage.getItem(SLOTS_KEY);
    expect(stale.unlockDevelopment('intel_records', NOW, 1).ok).toBe(false);
    expect(stale.beginPointClaim('mock.dp.20', 'stale-pack', firstCampaign, NOW).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(saved);
    expect(new CampaignSlots(storage, NOW).getSnapshot().commerce.transactions).toHaveLength(1);
  });
});

describe('earned progress at milli-DP boundaries', () => {
  it.each([
    { earned: 0.70000001, allocated: 300, remainder: 0.70000001 - 0.7 },
    { earned: 0.00000001, allocated: 1000, remainder: 0.00000001 },
    { earned: 0.123456, allocated: 877, remainder: 0.123456 - 0.123 },
    { earned: 0.9999, allocated: 1, remainder: 0.9999 - 0.999 },
  ])('spends exact allocated milli-DP and preserves $earned earned progress remainder', ({ earned, allocated, remainder }) => {
    const { bank, storage } = fresh(earned); allocate(bank, allocated);
    const funding = bank.getSnapshot().state.department.funding;
    expect(bank.unlockDevelopment('intel_records', NOW, 1).ok).toBe(true);
    expect(bank.getSnapshot().commerce.transactions[0].spent).toBe(allocated);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(bank.getSnapshot().state.department.devPoints).toBe(remainder);
    expect(bank.getSnapshot().state.department.funding).toBe(funding - 1000);
    const reload = new CampaignSlots(storage, NOW);
    expect(reload.getSnapshot().developmentBudget).toEqual(bank.getSnapshot().developmentBudget);
    expect(deserialize(reload.exportCurrent(NOW))!.department.devPoints).toBe(remainder);
  });

  it('never treats an almost-funded campaign as funded or borrows unassigned wallet points', () => {
    const { bank, storage } = fresh(0.69999999); allocate(bank, 300);
    const before = bank.getSnapshot(); const raw = storage.getItem(SLOTS_KEY);
    expect(availableTestMilli(before.commerce)).toBe(19700);
    expect(bank.unlockDevelopment('intel_records', NOW, 1).ok).toBe(false);
    expect(bank.getSnapshot().state).toBe(before.state);
    expect(bank.getSnapshot().commerce).toBe(before.commerce);
    expect(storage.getItem(SLOTS_KEY)).toBe(raw);
  });

  it('does not consume points or buy the tier if its separate funding cost is short', () => {
    const { bank, storage } = fresh(0.7, 999); allocate(bank, 300);
    const before = bank.getSnapshot(); const raw = storage.getItem(SLOTS_KEY);
    expect(bank.unlockDevelopment('intel_records', NOW, 1).ok).toBe(false);
    expect(bank.getSnapshot().state).toBe(before.state);
    expect(bank.getSnapshot().commerce).toBe(before.commerce);
    expect(storage.getItem(SLOTS_KEY)).toBe(raw);
  });
});
