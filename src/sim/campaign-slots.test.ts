import { describe, expect, it } from 'vitest';
import { CampaignSlots, SLOT_COUNT, SLOTS_KEY } from './campaign-slots';
import { createInitialState } from './department';
import { SAVE_KEY, serialize } from './save';
import { withSaveLock } from './save-lock';

const T0 = Date.UTC(2026, 9, 2);
function memory() {
  const entries = new Map<string, string>();
  let quota = false;
  return { entries, setQuota: (value: boolean) => { quota = value; },
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { if (quota) throw new DOMException('Quota exceeded', 'QuotaExceededError'); entries.set(key, value); } };
}

describe('ten local campaign slots', () => {
  it('migrates the existing autosave into slot one without changing people or deleting its recovery source', () => {
    const storage = memory(); const state = createInitialState(T0, 71);
    state.candidates[0].shortlisted = true;
    const original = serialize(state, T0); storage.setItem(SAVE_KEY, original);
    const saves = new CampaignSlots(storage, T0, () => 55);
    expect(saves.getSnapshot().state).toEqual(state);
    expect(saves.getSnapshot().activeSlotId).toBe(1);
    expect(saves.getSnapshot().slots.filter(Boolean)).toHaveLength(1);
    expect(storage.getItem(SAVE_KEY)).toBe(original);
    expect(new CampaignSlots(storage, T0, () => 999).getSnapshot().state).toEqual(state);
  });
  it('stores the first campaign immediately and keeps seeds independent after new game, load and reload', () => {
    const storage = memory(); let seed = 100;
    const saves = new CampaignSlots(storage, T0, () => seed++);
    const original = structuredClone(saves.getSnapshot().state);
    expect(saves.newGame(2, 'Night shift', T0).ok).toBe(true);
    const next = structuredClone(saves.getSnapshot().state);
    expect(next.personnel!.campaignSeed).not.toBe(original.personnel!.campaignSeed);
    expect(saves.getSnapshot().activeSlotId).toBe(2);
    const reloaded = new CampaignSlots(storage, T0, () => 900);
    expect(reloaded.getSnapshot().state).toEqual(next);
    expect(reloaded.load(1, T0).ok).toBe(true);
    expect(reloaded.getSnapshot().state).toEqual(original);
    expect(reloaded.load(2, T0).ok).toBe(true);
    expect(reloaded.getSnapshot().state).toEqual(next);
  });
  it('has exactly ten slots and requires explicit overwrite confirmation when they are full', () => {
    const storage = memory(); let seed = 1;
    const saves = new CampaignSlots(storage, T0, () => seed++);
    for (let id = 2; id <= SLOT_COUNT; id++) expect(saves.newGame(id, `Game ${id}`, T0).ok).toBe(true);
    expect(saves.getSnapshot().slots.filter(Boolean)).toHaveLength(10);
    const before = storage.getItem(SLOTS_KEY);
    expect(saves.newGame(11, 'No', T0).ok).toBe(false);
    expect(saves.newGame(1, 'No', T0).ok).toBe(false);
    expect(saves.saveAs(1, 'No', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(before);
    expect(saves.newGame(1, 'Replacement', T0, true).ok).toBe(true);
    expect(saves.getSnapshot().slots[0]?.name).toBe('Replacement');
  });
  it('preserves current progress when switching and leaves copies independently loadable', () => {
    const storage = memory(); const saves = new CampaignSlots(storage, T0, () => 17);
    const candidate = saves.getSnapshot().state.candidates[0];
    saves.send({ type: 'shortlist', candidateId: candidate.id, on: true }, T0);
    const state = structuredClone(saves.getSnapshot().state);
    expect(saves.saveAs(3, 'Before the operation', T0).ok).toBe(true);
    expect(saves.getSnapshot().activeSlotId).toBe(3);
    expect(saves.rename(3, '  Backup  ', T0).ok).toBe(true);
    expect(saves.getSnapshot().slots[2]?.name).toBe('Backup');
    expect(saves.load(1, T0).ok).toBe(true);
    expect(saves.getSnapshot().state).toEqual(state);
    expect(saves.load(3, T0).ok).toBe(true);
    expect(saves.getSnapshot().state).toEqual(state);
  });
  it('requires deletion confirmation, protects the active slot and can undo a deletion after reload', () => {
    const storage = memory(); const saves = new CampaignSlots(storage, T0, () => 17);
    saves.saveAs(2, 'Backup', T0);
    const original = storage.getItem(SLOTS_KEY);
    expect(saves.delete(1, T0).ok).toBe(false);
    expect(saves.delete(2, T0, true).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(original);
    expect(saves.delete(1, T0, true).ok).toBe(true);
    expect(saves.getSnapshot().slots[0]).toBeNull();
    const reloaded = new CampaignSlots(storage, T0);
    expect(reloaded.getSnapshot().canUndoDelete).toBe(true);
    expect(reloaded.undoDelete(T0).ok).toBe(true);
    expect(reloaded.getSnapshot().slots[0]?.valid).toBe(true);
  });
  it('does not replace slots or switch games when local storage runs out', () => {
    const storage = memory(); const saves = new CampaignSlots(storage, T0, () => 71);
    saves.newGame(2, 'Second', T0);
    const before = storage.getItem(SLOTS_KEY); const state = saves.getSnapshot().state;
    storage.setQuota(true);
    expect(saves.newGame(3, 'Third', T0).ok).toBe(false);
    expect(saves.load(1, T0).ok).toBe(false);
    expect(saves.delete(1, T0, true).ok).toBe(false);
    expect(saves.rename(2, 'Changed', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(before);
    expect(saves.getSnapshot().state).toBe(state);
    expect(saves.getSnapshot().activeSlotId).toBe(2);
    expect(saves.getSnapshot().issue).toContain('storage is full');
    saves.send({ type: 'tick' }, T0 + 5000);
    expect(saves.getSnapshot().state.department.clockHighWater).toBe(T0 + 5000);
    expect(saves.getSnapshot().issue).toBeTruthy();
    expect(saves.getSnapshot().dirty).toBe(true);
    storage.setQuota(false);
    expect(saves.save(T0 + 5000).ok).toBe(true);
    expect(saves.getSnapshot().issue).toBeNull();
    expect(saves.getSnapshot().dirty).toBe(false);
  });
  it('leaves unreadable legacy data intact and retains a corrupt slot without loading or overwriting it', () => {
    const storage = memory(); storage.setItem(SAVE_KEY, 'old broken bytes');
    const saves = new CampaignSlots(storage, T0, () => 7);
    expect(storage.getItem(SAVE_KEY)).toBe('old broken bytes');
    expect(saves.getSnapshot().slots[0]?.valid).toBe(false);
    expect(saves.getSnapshot().activeSlotId).toBe(2);
    expect(saves.load(1, T0).ok).toBe(false);
    expect(saves.getSnapshot().slots[0]?.valid).toBe(false);
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0].data).toBe('old broken bytes');
  });
  it('never overwrites an unreadable library, even during automatic ticks', () => {
    const storage = memory(); storage.setItem(SLOTS_KEY, '{broken');
    const saves = new CampaignSlots(storage, T0);
    saves.send({ type: 'tick' }, T0 + 5000);
    expect(saves.saveAs(1, 'New', T0).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe('{broken');
    expect(saves.exportRecovery()).toBe('{broken');
    expect(saves.getSnapshot().issue).toContain('unreadable');
  });
  it('refuses stale-tab writes and switching rather than overwriting another tab', () => {
    const storage = memory(); const first = new CampaignSlots(storage, T0, () => 1);
    const other = new CampaignSlots(storage, T0, () => 2);
    other.newGame(2, 'Other tab', T0);
    const saved = storage.getItem(SLOTS_KEY);
    expect(first.newGame(2, 'Overwrite', T0).ok).toBe(false);
    first.send({ type: 'tick' }, T0 + 5000);
    expect(storage.getItem(SLOTS_KEY)).toBe(saved);
    expect(first.getSnapshot().issue).toContain('another tab');
    expect(first.getSnapshot().activeSlotId).toBe(1);
  });
  it('handles denied reads and absent storage while keeping the campaign available in memory', () => {
    for (const storage of [null, { getItem: () => { throw new Error('Storage denied'); }, setItem: () => { throw new Error('Storage denied'); } }]) {
      const saves = new CampaignSlots(storage, T0, () => 33);
      expect(saves.getSnapshot().state.personnel!.campaignSeed).toBe(33);
      expect(saves.getSnapshot().issue).toBeTruthy();
      expect(saves.saveAs(1, 'Test', T0).ok).toBe(false);
      expect(saves.exportCurrent(T0)).toContain('campaignSeed');
    }
  });
  it('imports a compatible backup without changing the active campaign and rejects corrupt or occupied targets', () => {
    const storage = memory(); const saves = new CampaignSlots(storage, T0, () => 10);
    const original = saves.getSnapshot().state;
    const backup = serialize(createInitialState(T0, 99), T0);
    expect(saves.importGame(2, 'Imported', backup, T0).ok).toBe(true);
    expect(saves.getSnapshot().state).toBe(original);
    expect(saves.getSnapshot().activeSlotId).toBe(1);
    const data = storage.getItem(SLOTS_KEY);
    expect(saves.importGame(3, 'Broken', 'not a save', T0).ok).toBe(false);
    expect(saves.importGame(2, 'Replace', backup, T0).ok).toBe(false);
    expect(saves.importGame(1, 'Active', backup, T0, true).ok).toBe(false);
    expect(storage.getItem(SLOTS_KEY)).toBe(data);
    expect(saves.load(2, T0).ok).toBe(true);
    expect(saves.getSnapshot().state.personnel!.campaignSeed).toBe(99);
  });
  it('detaches a corrupt active save before ticking and can explicitly load another full-library slot', () => {
    const storage = memory(); const saves = new CampaignSlots(storage, T0, () => 18);
    for (let id = 2; id <= 10; id++) saves.saveAs(id, `Slot ${id}`, T0);
    const library = JSON.parse(storage.getItem(SLOTS_KEY)!);
    const bad = JSON.parse(library.slots[9].data); bad.state.report = {};
    library.slots[9].data = JSON.stringify(bad);
    const raw = JSON.stringify(library); storage.setItem(SLOTS_KEY, raw);
    const loaded = new CampaignSlots(storage, T0 + 3_600_000, () => 900);
    expect(loaded.getSnapshot().activeSlotId).toBeNull();
    loaded.send({ type: 'tick' }, T0 + 3_605_000);
    expect(storage.getItem(SLOTS_KEY)).toBe(raw);
    expect(loaded.load(1, T0 + 3_605_000).ok).toBe(false);
    expect(loaded.load(1, T0 + 3_605_000, true).ok).toBe(true);
    expect(loaded.getSnapshot().activeSlotId).toBe(1);
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[9].data).toBe(library.slots[9].data);
  });
  it('can explicitly delete permanently to release space when an undo copy would exceed quota', () => {
    const source = memory(); const setup = new CampaignSlots(source, T0, () => 5); setup.saveAs(2, 'Copy', T0);
    const limit = source.getItem(SLOTS_KEY)!.length;
    const storage = { getItem: source.getItem, setItem: (key: string, data: string) => {
      if (data.length > limit) throw new DOMException('Quota exceeded', 'QuotaExceededError'); source.setItem(key, data);
    } };
    const saves = new CampaignSlots(storage, T0);
    expect(saves.delete(1, T0, true).ok).toBe(false);
    expect(saves.getSnapshot().slots[0]).not.toBeNull();
    expect(saves.delete(1, T0, true, true).ok).toBe(true);
    expect(saves.getSnapshot().slots[0]).toBeNull();
    expect(saves.getSnapshot().canUndoDelete).toBe(false);
    expect(source.getItem(SLOTS_KEY)!.length).toBeLessThan(limit);
  });
  it('serializes cross-tab initialization and writes through the shared browser lock', async () => {
    let queue: Promise<unknown> = Promise.resolve();
    const locks = { request: (_name: string, callback: () => unknown) => {
      const result = queue.then(callback); queue = result.catch(() => undefined); return result;
    } } as unknown as Pick<LockManager, 'request'>;
    const storage = memory();
    const [a, b] = await Promise.all([
      withSaveLock(locks, () => new CampaignSlots(storage, T0, () => 1)),
      withSaveLock(locks, () => new CampaignSlots(storage, T0, () => 2)),
    ]);
    expect(a.getSnapshot().state).toEqual(b.getSnapshot().state);
    const results = await Promise.all([
      withSaveLock(locks, async () => { await Promise.resolve(); return a.newGame(2, 'A', T0); }),
      withSaveLock(locks, () => b.newGame(3, 'B', T0)),
    ]);
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    const persisted = new CampaignSlots(storage, T0);
    expect(persisted.getSnapshot().slots[1]?.name).toBe('A');
    expect(persisted.getSnapshot().slots[2]).toBeNull();
    expect(b.getSnapshot().issue).toContain('another tab');
  });
  it('marks queued game changes unsaved until their serialized persistence succeeds', () => {
    const storage = memory(); const saves = new CampaignSlots(storage, T0, () => 10);
    expect(saves.getSnapshot().dirty).toBe(false);
    saves.send({ type: 'tick' }, T0 + 5000, false);
    expect(saves.getSnapshot().dirty).toBe(true);
    expect(saves.save(T0 + 5000).ok).toBe(true);
    expect(saves.getSnapshot().dirty).toBe(false);
  });
});
