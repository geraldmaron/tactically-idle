import { DEV_NODES } from '../content/dev-tree';
import { newLocalId, type MockOutcome, type MockProvider, type ProviderEvent, type TestWallet } from '../commerce/types';
import { MockStoreProvider } from '../commerce/mock-provider';
import { allocateTestMilli, applyTestEvent, beginTestPurchase, campaignTestMilli, completeTestPurchase, emptyTestWallet, refundTestPurchase, spendTestMilli, unassignTestMilli, validTestWallet } from '../commerce/ledger';
import { createInitialState } from './department';
import { dispatch } from './game';
import { randomCampaignSeed } from './personnel';
import { deserialize, serialize, SAVE_KEY, type SaveStorage } from './save';
import type { Command, GameState, HandlerResult } from './types';

export const SLOT_COUNT = 10;
export const SLOTS_KEY = 'tactically-idle/campaign-slots';

export interface CampaignSlot {
  campaignId: string;
  name: string;
  createdAt: number;
  savedAt: number;
  data: string;
}
interface SlotLibrary {
  version: 2;
  commerce: TestWallet;
  activeSlotId: number | null;
  slots: (CampaignSlot | null)[];
  deleted?: { slotId: number; slot: CampaignSlot };
}
export interface SlotSummary {
  id: number;
  campaignId: string;
  name: string;
  savedAt: number;
  valid: boolean;
  level?: number;
  officers?: number;
  funding?: number;
  day?: number;
  operation?: boolean;
}
export interface CampaignSnapshot {
  state: GameState;
  slots: (SlotSummary | null)[];
  activeSlotId: number | null;
  issue: string | null;
  /** Changes only when the whole campaign is replaced, to dismiss stale UI selections. */
  session: number;
  canUndoDelete: boolean;
  dirty: boolean;
  commerce: TestWallet;
  campaignId: string | null;
  developmentBudget: { earnedDP: number; testDP: number; totalDP: number };
}
const emptyLibrary = (): SlotLibrary => ({ version: 2, commerce: emptyTestWallet(), activeSlotId: null, slots: Array(SLOT_COUNT).fill(null) });
const validId = (id: number) => Number.isInteger(id) && id >= 1 && id <= SLOT_COUNT;
const cleanName = (name: string, id: number) => name.trim().slice(0, 36) || `Campaign ${id}`;
const failure = (reason: string): HandlerResult => ({ ok: false, reason });

function readLibrary(raw: string): SlotLibrary | null {
  try {
    const x = JSON.parse(raw);
    const validSlot = (s: CampaignSlot | null) => s === null || (typeof s === 'object' && typeof s.name === 'string'
      && typeof s.data === 'string' && Number.isFinite(s.createdAt) && Number.isFinite(s.savedAt));
    if (![1, 2].includes(x?.version) || !Array.isArray(x.slots) || x.slots.length !== SLOT_COUNT
      || !x.slots.every(validSlot) || (x.activeSlotId !== null && !validId(x.activeSlotId))
      || (x.deleted !== undefined && (!validId(x.deleted?.slotId) || !x.deleted.slot || !validSlot(x.deleted.slot)))) return null;
    if (x.version === 1) {
      x.slots = x.slots.map((slot: CampaignSlot | null) => slot ? { ...slot, campaignId: newLocalId() } : null);
      if (x.deleted) x.deleted.slot = { ...x.deleted.slot, campaignId: newLocalId() };
      x.version = 2; x.commerce = emptyTestWallet();
    }
    const ids = x.slots.filter(Boolean).map((slot: CampaignSlot) => slot.campaignId);
    if (x.deleted) ids.push(x.deleted.slot.campaignId);
    if (ids.some((id: unknown) => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(id))
      || new Set(ids).size !== ids.length || !validTestWallet(x.commerce)) return null;
    return x;
  } catch { return null; }
}

function summary(slot: CampaignSlot, index: number): SlotSummary {
  const state = deserialize(slot.data);
  return {
    id: index + 1, campaignId: slot.campaignId, name: slot.name, savedAt: slot.savedAt, valid: !!state,
    ...(state ? { level: state.department.level, officers: Object.keys(state.officers).length,
      funding: state.department.funding, day: Math.floor((state.department.clockHighWater - state.department.calendarEpoch) / 3_600_000),
      operation: !!state.activeRun } : {}),
  };
}

/** One atomic localStorage entry keeps ten slots and the active pointer consistent. */
export class CampaignSlots {
  private library = emptyLibrary();
  private expectedRaw: string | null = null;
  private blocked = false;
  private state: GameState;
  private issue: string | null = null;
  private session = 0;
  private dirty = true;
  private snapshot: CampaignSnapshot;

  constructor(private storage: SaveStorage | null, now: number, private seedFactory = randomCampaignSeed) {
    this.state = createInitialState(now, seedFactory());
    let legacy: string | null = null;
    try {
      if (!storage) throw new Error('Storage unavailable');
      this.expectedRaw = storage.getItem(SLOTS_KEY);
      if (this.expectedRaw !== null) {
        const library = readLibrary(this.expectedRaw);
        if (!library) {
          this.blocked = true;
          this.issue = 'The local save library is unreadable. It has been left untouched; this game is only in memory.';
        } else {
          this.library = library;
          const slot = library.activeSlotId ? library.slots[library.activeSlotId - 1] : null;
          const loaded = slot ? deserialize(slot.data) : null;
          if (loaded) {
            try { this.state = dispatch(loaded, { type: 'tick' }, { now }).state; }
            catch {
              this.library = { ...library, activeSlotId: null };
              this.issue = 'The active save could not be resumed. Its original data is untouched. Load another slot or export the save library for recovery.';
            }
          }
          else {
            this.library = { ...library, activeSlotId: null };
            this.issue = 'No readable active save. Load another slot or save this new game into an empty slot. Existing saves are untouched.';
          }
        }
      } else {
        legacy = storage.getItem(SAVE_KEY);
        let loaded = legacy ? deserialize(legacy) : null;
        if (loaded) {
          try { this.state = dispatch(loaded, { type: 'tick' }, { now }).state; }
          catch { loaded = null; }
        }
        const id = legacy && !loaded ? 2 : 1;
        if (legacy && !loaded) this.library.slots[0] = { campaignId: newLocalId(), name: 'Previous save (unreadable)', createdAt: now, savedAt: now, data: legacy };
        this.library.activeSlotId = id;
        this.library.slots[id - 1] = this.record(loaded ? 'Existing campaign' : `Campaign ${id}`, now);
        // The old autosave remains intact as a recovery copy after migration.
        this.write(this.library);
        if (legacy && !loaded) this.issue = 'Your previous save could not be read. Its original data is preserved in slot 1; the new game is in slot 2.';
      }
    } catch {
      this.issue = 'Local saving is unavailable or storage is full. Your current game is only in memory; existing saves are untouched.';
    }
    // Persist UUID migration before any test purchase can refer to a campaign.
    if (this.expectedRaw && !this.blocked) {
      try { if (JSON.parse(this.expectedRaw).version === 1) this.write(this.library); }
      catch { this.issue = 'Campaign migration could not be saved. Existing saves are untouched; retry saving before using the test store.'; }
    }
    this.snapshot = this.makeSnapshot();
  }

  getSnapshot = (): CampaignSnapshot => this.snapshot;
  reportStorageIssue(message: string): void { this.issue = message; this.publish(); }

  private makeSnapshot(): CampaignSnapshot {
    const campaignId = this.library.activeSlotId ? this.library.slots[this.library.activeSlotId - 1]?.campaignId ?? null : null;
    const earnedDP = this.state.department.devPoints;
    const testDP = campaignTestMilli(this.library.commerce, campaignId) / 1000;
    return { commerce: this.library.commerce, campaignId, developmentBudget: { earnedDP, testDP, totalDP: earnedDP + testDP },
      state: this.state, slots: this.library.slots.map((s, i) => s ? summary(s, i) : null),
      activeSlotId: this.library.activeSlotId, issue: this.issue, session: this.session, canUndoDelete: !!this.library.deleted, dirty: this.dirty };
  }
  private publish() { this.snapshot = this.makeSnapshot(); }
  private record(name: string, now: number, createdAt = now, campaignId = newLocalId()): CampaignSlot {
    return { campaignId, name, createdAt, savedAt: now, data: serialize(this.state, now) };
  }
  private withCurrent(now: number): SlotLibrary {
    const next = structuredClone(this.library);
    const id = next.activeSlotId;
    if (id) {
      const old = next.slots[id - 1];
      next.slots[id - 1] = this.record(old?.name ?? `Campaign ${id}`, now, old?.createdAt ?? now, old?.campaignId);
    }
    return next;
  }
  private write(next: SlotLibrary): void {
    if (!this.storage) throw new Error('Local storage is unavailable. Enable browser storage to save this game.');
    if (this.blocked) throw new Error('The save library is unreadable. Existing data will not be overwritten.');
    if (this.storage.getItem(SLOTS_KEY) !== this.expectedRaw) throw new Error('Saves changed in another tab. Reload this page before switching or saving; this tab has not overwritten them.');
    const raw = JSON.stringify(next);
    this.storage.setItem(SLOTS_KEY, raw);
    this.expectedRaw = raw;
    this.library = next;
    if (next.activeSlotId) this.dirty = false;
    this.issue = null;
  }
  private attempt(action: () => void): HandlerResult {
    try { action(); this.publish(); return { ok: true }; }
    catch (error) {
      this.issue = error instanceof Error && error.name !== 'QuotaExceededError'
        ? error.message : 'Local storage is full. Nothing was replaced. Free browser storage or export your current game before leaving.';
      this.publish(); return failure(this.issue);
    }
  }

  send(command: Command, now: number, persist = true): HandlerResult {
    let result;
    try { result = dispatch(this.state, command, { now }); }
    catch { this.reportStorageIssue('This campaign could not advance. Its previous save is untouched. Export the current game or load a readable backup.'); return failure(this.issue!); }
    if (!result.result.ok) return result.result;
    this.state = result.state;
    this.dirty = true;
    if (persist && this.library.activeSlotId) this.attempt(() => this.write(this.withCurrent(now)));
    else this.publish();
    return result.result;
  }
  save(now: number): HandlerResult {
    if (!this.library.activeSlotId) return failure('Choose an empty slot using Save a copy to keep this game.');
    return this.attempt(() => this.write(this.withCurrent(now)));
  }
  load(id: number, now: number, discardUnsaved = false): HandlerResult {
    if (!validId(id)) return failure('Choose a slot from 1 to 10.');
    if (!this.library.activeSlotId && !discardUnsaved) return failure('Save or export this in-memory campaign, or explicitly confirm discarding it before switching.');
    const slot = this.library.slots[id - 1];
    if (!slot) return failure('That slot is empty.');
    const loaded = deserialize(slot.data);
    if (!loaded) return failure('This save is unreadable or from a newer version. It has not been changed.');
    return this.attempt(() => {
      const next = this.withCurrent(now);
      // Loading the active slot keeps the latest in-memory state, never rewinds it.
      const state = id === this.library.activeSlotId ? this.state : dispatch(loaded, { type: 'tick' }, { now }).state;
      next.activeSlotId = id;
      next.slots[id - 1] = { ...slot, data: serialize(state, now), savedAt: now };
      this.write(next);
      this.state = state;
      this.session++;
    });
  }
  saveAs(id: number, name: string, now: number, overwrite = false): HandlerResult {
    if (!validId(id)) return failure('Choose a slot from 1 to 10.');
    if (this.library.slots[id - 1] && !overwrite) return failure('Confirm before replacing an occupied slot.');
    return this.attempt(() => {
      const next = this.withCurrent(now);
      next.slots[id - 1] = this.record(cleanName(name, id), now);
      next.activeSlotId = id;
      this.write(next);
    });
  }
  newGame(id: number, name: string, now: number, overwrite = false, discardUnsaved = false): HandlerResult {
    if (!validId(id)) return failure('Choose a slot from 1 to 10.');
    if (!this.library.activeSlotId && !discardUnsaved) return failure('Save or export this in-memory campaign, or explicitly confirm discarding it before starting another game.');
    if (this.library.slots[id - 1] && !overwrite) return failure('Confirm before replacing an occupied slot.');
    return this.attempt(() => {
      const next = this.withCurrent(now);
      const state = createInitialState(now, this.seedFactory());
      next.slots[id - 1] = { campaignId: newLocalId(), name: cleanName(name, id), createdAt: now, savedAt: now, data: serialize(state, now) };
      next.activeSlotId = id;
      this.write(next);
      this.state = state;
      this.session++;
    });
  }
  rename(id: number, name: string, now: number): HandlerResult {
    if (!validId(id) || !this.library.slots[id - 1]) return failure('Choose an existing save.');
    return this.attempt(() => { const next = this.withCurrent(now); next.slots[id - 1]!.name = cleanName(name, id); this.write(next); });
  }
  importGame(id: number, name: string, data: string, now: number, overwrite = false): HandlerResult {
    if (!validId(id)) return failure('Choose a slot from 1 to 10.');
    if (this.library.slots[id - 1] && !overwrite) return failure('Confirm before replacing an occupied slot.');
    const state = deserialize(data);
    if (!state) return failure('This file is not a readable campaign backup. No saves were changed.');
    return this.attempt(() => {
      const next = this.withCurrent(now);
      // Import stores a dormant copy. Time settles only when the user loads it.
      next.slots[id - 1] = { campaignId: newLocalId(), name: cleanName(name, id), createdAt: now, savedAt: now, data: serialize(state, now) };
      if (id === next.activeSlotId) throw new Error('Choose another slot for an imported backup, then load it.');
      this.write(next);
    });
  }
  delete(id: number, now: number, confirmed = false, permanent = false): HandlerResult {
    if (!validId(id) || !this.library.slots[id - 1]) return failure('Choose an existing save.');
    if (!confirmed) return failure('Confirm before deleting a save.');
    if (id === this.library.activeSlotId) return failure('Load or start another campaign before deleting the active save.');
    return this.attempt(() => {
      const next = this.withCurrent(now);
      if (permanent) delete next.deleted;
      else next.deleted = { slotId: id, slot: next.slots[id - 1]! };
      next.slots[id - 1] = null;
      this.write(next);
    });
  }
  undoDelete(now: number): HandlerResult {
    if (!this.library.deleted) return failure('No deletion to undo.');
    const { slotId, slot } = this.library.deleted;
    const target = this.library.slots[slotId - 1] ? this.library.slots.indexOf(null) + 1 : slotId;
    if (!target) return failure('All ten slots are occupied. Free a slot before restoring the deleted save.');
    return this.attempt(() => {
      const next = this.withCurrent(now); next.slots[target - 1] = slot; delete next.deleted; this.write(next);
    });
  }
  exportCurrent(now: number): string { return serialize(this.state, now); }
  exportSlot(id: number): string | null { return validId(id) ? this.library.slots[id - 1]?.data ?? null : null; }
  exportRecovery(): string | null {
    if (!this.expectedRaw) return null;
    // Readable exports contain game progress only. UUIDs and wallet grants never become import authority.
    try {
      const raw = JSON.parse(this.expectedRaw);
      if (!readLibrary(this.expectedRaw)) return this.expectedRaw;
      const strip = (slot: CampaignSlot | null) => slot ? { name: slot.name, createdAt: slot.createdAt, savedAt: slot.savedAt, data: slot.data } : null;
      return JSON.stringify({ version: 1, activeSlotId: raw.activeSlotId, slots: raw.slots.map(strip),
        ...(raw.deleted ? { deleted: { slotId: raw.deleted.slotId, slot: strip(raw.deleted.slot) } } : {}) });
    } catch { return this.expectedRaw; }
  }

  /** Called only inside the same save lock as all ordinary bank writes. */
  private walletChange(now: number, change: (wallet: TestWallet) => void): HandlerResult {
    return this.attempt(() => { const next = this.withCurrent(now); change(next.commerce); this.write(next); });
  }
  beginPurchase(provider: MockProvider, productId: string, requestId: string, now: number): HandlerResult {
    return this.walletChange(now, (wallet) => { beginTestPurchase(wallet, provider, productId, requestId, now); });
  }
  receivePurchase(event: ProviderEvent, now: number): HandlerResult {
    return this.walletChange(now, (wallet) => applyTestEvent(wallet, event, now));
  }
  resolvePurchase(key: string, outcome: MockOutcome, now: number): HandlerResult {
    const t = this.library.commerce.transactions.find((entry) => entry.key === key);
    if (!t) return failure('Unknown test transaction');
    return this.receivePurchase(new MockStoreProvider(t.provider).resolve(t, outcome), now);
  }
  completePurchase(key: string, now: number, fail = false): HandlerResult {
    return this.walletChange(now, (wallet) => completeTestPurchase(wallet, key, now, fail));
  }
  reconcilePurchases(now: number): HandlerResult {
    return this.walletChange(now, (wallet) => {
      for (const t of wallet.transactions) {
        const event = new MockStoreProvider(t.provider).reconcile(t);
        if (event) { applyTestEvent(wallet, event, now); completeTestPurchase(wallet, t.key, now); }
      }
    });
  }
  refundPurchase(key: string, now: number): HandlerResult {
    return this.walletChange(now, (wallet) => refundTestPurchase(wallet, key, now));
  }
  allocatePurchase(campaignId: string, milliDP: number, now: number): HandlerResult {
    if (!this.library.slots.some((slot) => slot?.campaignId === campaignId && deserialize(slot.data))) return failure('Choose a readable saved campaign');
    return this.walletChange(now, (wallet) => allocateTestMilli(wallet, campaignId, milliDP));
  }
  unassignPurchase(campaignId: string, now: number): HandlerResult {
    return this.walletChange(now, (wallet) => unassignTestMilli(wallet, campaignId));
  }
  unlockDevelopment(nodeId: string, now: number): HandlerResult {
    const id = this.library.activeSlotId;
    const slot = id ? this.library.slots[id - 1] : null;
    if (!id || !slot) return failure('Save this campaign in a slot before spending development points');
    const node = DEV_NODES[nodeId];
    if (!node) return failure('Unknown development node');
    return this.attempt(() => {
      const state = dispatch(this.state, { type: 'tick' }, { now }).state;
      const earned = state.department.devPoints;
      const paidMilli = earned >= node.cost.dp ? 0 : Math.max(0, Math.ceil((node.cost.dp - earned) * 1000));
      if (campaignTestMilli(this.library.commerce, slot.campaignId) < paidMilli) throw new Error('Not enough development points. Earn points or explicitly allocate test DP to this campaign.');
      const earnedUsed = node.cost.dp - paidMilli / 1000;
      const temporary = structuredClone(state);
      temporary.department.devPoints = node.cost.dp;
      const applied = dispatch(temporary, { type: 'unlockNode', nodeId }, { now });
      if (!applied.result.ok) throw new Error(applied.result.reason);
      applied.state.department.devPoints = Math.max(0, earned - earnedUsed);
      const next = this.withCurrent(now);
      spendTestMilli(next.commerce, slot.campaignId, paidMilli);
      next.slots[id - 1] = { ...slot, savedAt: now, data: serialize(applied.state, now) };
      this.write(next);
      this.state = applied.state;
    });
  }
}
