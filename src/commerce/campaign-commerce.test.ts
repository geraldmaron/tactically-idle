import { describe, expect, it } from 'vitest';
import { CampaignSlots, SLOTS_KEY } from '../sim/campaign-slots';
import { createInitialState } from '../sim/department';
import { deserialize, SAVE_KEY, serialize } from '../sim/save';
import { availableTestMilli, campaignTestMilli } from './ledger';
const T0 = Date.UTC(2026, 9, 3);
function setup(earned = 0) {
  const entries = new Map<string, string>(); let quota = false;
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => {
    if (quota) throw new DOMException('Quota', 'QuotaExceededError'); entries.set(key, value);
  } };
  const state = createInitialState(T0, 19); state.department.devPoints = earned;
  storage.setItem(SAVE_KEY, serialize(state, T0));
  const bank = new CampaignSlots(storage, T0, () => 20);
  return { bank, storage, entries, setQuota: (on: boolean) => { quota = on; } };
}
function credit(bank: CampaignSlots, id = 'request') {
  expect(bank.beginPurchase('apple', 'mock.dp.3', id, T0).ok).toBe(true);
  const key = `mock:apple:${id}`; expect(bank.resolvePurchase(key, 'success', T0).ok).toBe(true); return key;
}
describe('campaign-isolated test DP and atomic development spending', () => {
  it('migrates all v1 slots with stable distinct UUIDs, retaining campaign contents and deleted save', () => {
    const { storage, bank } = setup(); bank.saveAs(2, 'Copy', T0); bank.delete(1, T0, true);
    const v1 = JSON.parse(bank.exportRecovery()!); storage.setItem(SLOTS_KEY, JSON.stringify(v1));
    const migrated = new CampaignSlots(storage, T0);
    const v2 = JSON.parse(storage.getItem(SLOTS_KEY)!);
    expect(v2.version).toBe(2); expect(v2.commerce.transactions).toEqual([]);
    expect(v2.slots[1].data).toBe(v1.slots[1].data); expect(v2.deleted.slot.data).toBe(v1.deleted.slot.data);
    expect(v2.slots[1].campaignId).not.toBe(v2.deleted.slot.campaignId);
    expect(new CampaignSlots(storage, T0).getSnapshot().campaignId).toBe(migrated.getSnapshot().campaignId);
  });
  it.each([0, 0.123456, 0.9999, 1, 1.9999999, 2, 3])('spends earned first with %s earned DP and never stores purchased balance in GameState', (earned) => {
    const { bank, storage } = setup(earned); credit(bank);
    const campaignId = bank.getSnapshot().campaignId!;
    bank.allocatePurchase(campaignId, 3000, T0);
    expect(bank.unlockDevelopment('personnel_negotiation', T0).ok).toBe(true);
    const snapshot = bank.getSnapshot();
    expect(snapshot.state.department.unlockedNodes).toContain('personnel_negotiation');
    expect(snapshot.state.department.devPoints).toBeGreaterThanOrEqual(0);
    expect(snapshot.state.department.devPoints + snapshot.developmentBudget.testDP).toBeCloseTo(earned + 3 - 2, 8);
    const testSpent = snapshot.commerce.transactions[0].spent;
    expect(testSpent).toBe(earned >= 2 ? 0 : Math.ceil((2 - earned) * 1000));
    expect(deserialize(bank.exportCurrent(T0))!.department.devPoints).toBe(snapshot.state.department.devPoints);
    expect(new CampaignSlots(storage, T0).getSnapshot().developmentBudget).toEqual(snapshot.developmentBudget);
    const before = storage.getItem(SLOTS_KEY); expect(bank.unlockDevelopment('personnel_negotiation', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(before);
  });
  it('leaves unlock, treasury, credit and in-memory state unchanged when storage is full', () => {
    const { bank, storage, setQuota } = setup(0.5); credit(bank);
    bank.allocatePurchase(bank.getSnapshot().campaignId!, 3000, T0);
    const old = bank.getSnapshot(); const raw = storage.getItem(SLOTS_KEY); setQuota(true);
    expect(bank.unlockDevelopment('personnel_negotiation', T0).ok).toBe(false);
    expect(bank.getSnapshot().state).toBe(old.state); expect(bank.getSnapshot().commerce).toBe(old.commerce);
    expect(storage.getItem(SLOTS_KEY)).toBe(raw); setQuota(false);
    expect(bank.unlockDevelopment('personnel_negotiation', T0).ok).toBe(true);
  });
  it('does not duplicate credit through copy, import, overwrite or new game; rename/load/undo preserve allocation', () => {
    const { bank } = setup(); credit(bank); const original = bank.getSnapshot().campaignId!;
    bank.allocatePurchase(original, 3000, T0); bank.rename(1, 'Renamed', T0);
    expect(bank.getSnapshot().campaignId).toBe(original);
    const exportData = bank.exportCurrent(T0); expect(exportData).not.toContain(original);
    bank.saveAs(2, 'Copy', T0); expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(bank.getSnapshot().campaignId).not.toBe(original);
    bank.importGame(3, 'Imported', exportData, T0); bank.load(3, T0);
    expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    bank.delete(1, T0, true); expect(campaignTestMilli(bank.getSnapshot().commerce, original)).toBe(3000);
    bank.undoDelete(T0); bank.load(1, T0); expect(bank.getSnapshot().developmentBudget.testDP).toBe(3);
    bank.newGame(1, 'Replacement', T0, true); expect(bank.getSnapshot().developmentBudget.testDP).toBe(0);
    bank.unassignPurchase(original, T0); expect(availableTestMilli(bank.getSnapshot().commerce)).toBe(3000);
    const recovery = bank.exportRecovery()!; expect(recovery).not.toContain('transactions'); expect(recovery).not.toContain('campaignId');
    expect(bank.importGame(4, 'Bank as campaign', recovery, T0).ok).toBe(false);
  });
  it('binds delayed purchase to the wallet; requires explicit selected campaign allocation after switching', () => {
    const { bank, storage } = setup(); bank.beginPurchase('google', 'mock.dp.8', 'delayed', T0);
    const first = bank.getSnapshot().campaignId!; bank.newGame(2, 'Second', T0);
    const loaded = new CampaignSlots(storage, T0);
    expect(loaded.resolvePurchase('mock:google:delayed', 'success', T0).ok).toBe(true);
    expect(loaded.getSnapshot().developmentBudget.testDP).toBe(0);
    expect(loaded.allocatePurchase(first, 4000, T0).ok).toBe(true);
    expect(loaded.getSnapshot().developmentBudget.testDP).toBe(0);
    loaded.load(1, T0); expect(loaded.getSnapshot().developmentBudget.testDP).toBe(4);
  });
  it('rejects stale callbacks/allocation/unlocks without losing the successful other-tab credit', () => {
    const { bank, storage } = setup(); const stale = new CampaignSlots(storage, T0);
    credit(bank); const raw = storage.getItem(SLOTS_KEY);
    expect(stale.beginPurchase('google', 'mock.dp.20', 'stale', T0).ok).toBe(false);
    expect(stale.allocatePurchase(stale.getSnapshot().campaignId!, 1000, T0).ok).toBe(false);
    expect(stale.unlockDevelopment('personnel_negotiation', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(raw);
    expect(new CampaignSlots(storage, T0).getSnapshot().commerce.transactions).toHaveLength(1);
  });
  it('retains a durable pending receipt if fulfillment hits quota, then completes without another grant', () => {
    const { bank, storage, setQuota } = setup(); bank.beginPurchase('apple', 'mock.dp.3', 'pending', T0);
    setQuota(true); expect(bank.resolvePurchase('mock:apple:pending', 'success', T0).ok).toBe(false);
    expect(bank.getSnapshot().commerce.transactions[0].status).toBe('pending'); setQuota(false);
    const loaded = new CampaignSlots(storage, T0); loaded.resolvePurchase('mock:apple:pending', 'success', T0);
    setQuota(true); expect(loaded.completePurchase('mock:apple:pending', T0).ok).toBe(false); setQuota(false);
    loaded.reconcilePurchases(T0); loaded.reconcilePurchases(T0);
    expect(availableTestMilli(loaded.getSnapshot().commerce)).toBe(3000);
    expect(loaded.getSnapshot().commerce.transactions[0].status).toBe('completed');
  });
  it('preserves the original unreadable wallet bank instead of silently recreating money or campaigns', () => {
    const { bank, storage } = setup(); credit(bank);
    const data = JSON.parse(storage.getItem(SLOTS_KEY)!); data.commerce.transactions[0].spent = -50;
    const raw = JSON.stringify(data); storage.setItem(SLOTS_KEY, raw);
    const loaded = new CampaignSlots(storage, T0);
    expect(loaded.getSnapshot().issue).toContain('unreadable');
    expect(loaded.beginPurchase('apple', 'mock.dp.3', 'new', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(raw);
  });
});
