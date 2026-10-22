import { createInitialState } from './department';
import type { ContentExclusion } from './incidents';
import type { TimerSetting } from './timer-setting';
import { dispatch } from './game';
import { randomCampaignSeed } from './personnel';
import { deserialize, freezeStall, loadStored, serialize, type SaveStorage } from './save';
import type { Command, GameState, HandlerResult } from './types';

export const SLOT_COUNT = 10;

const newLocalId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export const SLOTS_KEY = 'tactically-idle/campaign-slots';

export interface CampaignSlot {
  campaignId: string;
  name: string;
  createdAt: number;
  savedAt: number;
  data: string;
}
/** Libraries written before save v12 also hold a `commerce` test wallet; it is ignored on read
 * and dropped on the next write. The saves inside are checked one by one (save.ts). */
interface SlotLibrary {
  version: 2;
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
  campaignId: string | null;
}
/** What a writer stores: the state with its running stall frozen at `now` (save.ts freezeStall). The
 * live state is never changed, so the visible call keeps counting after a save. */
const stored = (state: GameState, now: number): string => serialize(freezeStall(state, now), now);
const emptyLibrary = (): SlotLibrary => ({ version: 2, activeSlotId: null, slots: Array(SLOT_COUNT).fill(null) });
const validId = (id: number) => Number.isInteger(id) && id >= 1 && id <= SLOT_COUNT;
const cleanName = (name: string, id: number) => name.trim().slice(0, 36) || `Campaign ${id}`;
const failure = (reason: string): HandlerResult => ({ ok: false, reason });

function readLibrary(raw: string): SlotLibrary | null {
  try {
    const x = JSON.parse(raw);
    const validSlot = (s: CampaignSlot | null) => s === null || (typeof s === 'object' && typeof s.name === 'string'
      && typeof s.data === 'string' && Number.isFinite(s.createdAt) && Number.isFinite(s.savedAt));
    if (x?.version !== 2 || !Array.isArray(x.slots) || x.slots.length !== SLOT_COUNT
      || !x.slots.every(validSlot) || (x.activeSlotId !== null && !validId(x.activeSlotId))
      || (x.deleted !== undefined && (!validId(x.deleted?.slotId) || !x.deleted.slot || !validSlot(x.deleted.slot)))) return null;
    const ids = x.slots.filter(Boolean).map((slot: CampaignSlot) => slot.campaignId);
    if (x.deleted) ids.push(x.deleted.slot.campaignId);
    if (ids.some((id: unknown) => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(id))
      || new Set(ids).size !== ids.length) return null;
    return { version: 2, activeSlotId: x.activeSlotId, slots: x.slots, ...(x.deleted ? { deleted: x.deleted } : {}) };
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
  /** The themes the player keeps off the board; the store keeps it current (ui/store.ts). */
  exclusion: ContentExclusion | undefined;
  /** The player's call timer setting, passed to every command (Ctx.timer). Off when unset. */
  timer: TimerSetting | undefined;

  constructor(private storage: SaveStorage | null, now: number, private seedFactory = randomCampaignSeed) {
    this.state = createInitialState(now, seedFactory());
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
          const loaded = slot ? loadStored(slot.data) : null;
          if (loaded) {
            try { this.state = dispatch(loaded, { type: 'tick' }, { now }).state; }
            catch {
              this.adoptFreeSlot(library, now, 'The active save could not be resumed. Its original data is untouched.', 'Load another slot or export the save library for recovery.');
            }
          }
          else {
            this.adoptFreeSlot(library, now, 'The active save is unreadable or uses a different game version. Existing saves are untouched.', 'Start a new campaign or load a current save.');
          }
        }
      } else {
        this.library.activeSlotId = 1;
        this.library.slots[0] = this.record('Campaign 1', now);
        this.write(this.library);
      }
    } catch {
      this.issue = 'Local saving is unavailable or storage is full. Your current game is only in memory; existing saves are untouched.';
    }
    this.snapshot = this.makeSnapshot();
  }

  /** The active save can't be played, so the fresh campaign takes the first empty slot and autosaves
   * from the start; the old save stays as it was. With every slot full it stays in memory until the
   * player picks a slot. */
  private adoptFreeSlot(library: SlotLibrary, now: number, reason: string, fallback: string): void {
    const free = library.slots.findIndex((slot) => !slot);
    if (free < 0) {
      this.library = { ...library, activeSlotId: null };
      this.issue = `${reason} ${fallback}`;
      return;
    }
    const slots = [...library.slots];
    slots[free] = this.record(`Campaign ${free + 1}`, now);
    this.write({ ...library, activeSlotId: free + 1, slots });
    this.issue = `${reason} A new campaign started in slot ${free + 1} and saves automatically.`;
  }

  getSnapshot = (): CampaignSnapshot => this.snapshot;
  reportStorageIssue(message: string): void { this.issue = message; this.publish(); }

  private makeSnapshot(): CampaignSnapshot {
    const campaignId = this.library.activeSlotId ? this.library.slots[this.library.activeSlotId - 1]?.campaignId ?? null : null;
    return { campaignId,
      state: this.state, slots: this.library.slots.map((s, i) => s ? summary(s, i) : null),
      activeSlotId: this.library.activeSlotId, issue: this.issue, session: this.session, canUndoDelete: !!this.library.deleted, dirty: this.dirty };
  }
  private publish() { this.snapshot = this.makeSnapshot(); }
  private record(name: string, now: number, createdAt = now, campaignId = newLocalId()): CampaignSlot {
    return { campaignId, name, createdAt, savedAt: now, data: stored(this.state, now) };
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
    try { result = dispatch(this.state, command, { now, exclusion: this.exclusion, ...(this.timer ? { timer: this.timer } : {}) }); }
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
    const loaded = loadStored(slot.data);
    if (!loaded) return failure('This save is unreadable or uses a different game version. Start a new campaign. Your saved data has not been changed.');
    return this.attempt(() => {
      const next = this.withCurrent(now);
      // Loading the active slot keeps the latest in-memory state, never rewinds it.
      const state = id === this.library.activeSlotId ? this.state : dispatch(loaded, { type: 'tick' }, { now }).state;
      next.activeSlotId = id;
      next.slots[id - 1] = { ...slot, data: stored(state, now), savedAt: now };
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
      this.session++;
    });
  }
  newGame(id: number, name: string, now: number, overwrite = false, discardUnsaved = false): HandlerResult {
    if (!validId(id)) return failure('Choose a slot from 1 to 10.');
    if (!this.library.activeSlotId && !discardUnsaved) return failure('Save or export this in-memory campaign, or explicitly confirm discarding it before starting another game.');
    if (this.library.slots[id - 1] && !overwrite) return failure('Confirm before replacing an occupied slot.');
    return this.attempt(() => {
      const next = this.withCurrent(now);
      const state = createInitialState(now, this.seedFactory(), this.exclusion);
      next.slots[id - 1] = { campaignId: newLocalId(), name: cleanName(name, id), createdAt: now, savedAt: now, data: stored(state, now) };
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
    const state = loadStored(data);
    if (!state) return failure('This backup is unreadable or uses a different game version. Start a new campaign. No saves were changed.');
    return this.attempt(() => {
      const next = this.withCurrent(now);
      // Import stores a dormant copy. Time settles only when the user loads it.
      next.slots[id - 1] = { campaignId: newLocalId(), name: cleanName(name, id), createdAt: now, savedAt: now, data: stored(state, now) };
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
  exportCurrent(now: number): string { return stored(this.state, now); }
  exportSlot(id: number): string | null { return validId(id) ? this.library.slots[id - 1]?.data ?? null : null; }
  exportRecovery(): string | null {
    if (!this.expectedRaw) return null;
    // Readable exports contain game progress only. Campaign UUIDs never become import authority.
    try {
      const raw = JSON.parse(this.expectedRaw);
      if (!readLibrary(this.expectedRaw)) return this.expectedRaw;
      const strip = (slot: CampaignSlot | null) => slot ? { name: slot.name, createdAt: slot.createdAt, savedAt: slot.savedAt, data: slot.data } : null;
      return JSON.stringify({ version: 1, activeSlotId: raw.activeSlotId, slots: raw.slots.map(strip),
        ...(raw.deleted ? { deleted: { slotId: raw.deleted.slotId, slot: strip(raw.deleted.slot) } } : {}) });
    } catch { return this.expectedRaw; }
  }
}
