import { describe, expect, it, vi } from 'vitest';
import { CampaignSlots, SLOTS_KEY } from '../sim/campaign-slots';
import { createSaveEnvironment, RESPONSIVE_PREVIEW_PARAM } from './save-environment';

const flag = `?${RESPONSIVE_PREVIEW_PARAM}=1`;
const T0 = Date.UTC(2026, 9, 3);

describe('responsive preview save isolation', () => {
  it('requires both the exact harness flag and a child frame', () => {
    for (const [search, framed] of [['', true], [flag, false], [`?${RESPONSIVE_PREVIEW_PARAM}=true`, true], [`?${RESPONSIVE_PREVIEW_PARAM}=0`, true]] as const) {
      const getLocks = vi.fn(() => null);
      const getLocalStorage = vi.fn(() => ({ getItem: () => null, setItem: () => undefined }));
      const environment = createSaveEnvironment({ search, framed, getLocks, getLocalStorage });
      expect(environment.temporary).toBe(false);
      expect(getLocks).toHaveBeenCalledOnce();
      expect(getLocalStorage).not.toHaveBeenCalled();
      environment.storage();
      expect(getLocalStorage).toHaveBeenCalledOnce();
    }
  });

  it('does not access real storage or Web Locks during preview save operations', () => {
    const getLocks = vi.fn(() => { throw new Error('Browser locks must not be accessed'); });
    const getLocalStorage = vi.fn(() => { throw new Error('Real storage must not be accessed'); });
    const environment = createSaveEnvironment({ search: flag, framed: true, getLocks, getLocalStorage });
    expect(environment.temporary).toBe(true);
    expect(environment.locks).toBeNull();
    let seed = 71;
    const campaigns = new CampaignSlots(environment.storage(), T0, () => seed++);
    const original = structuredClone(campaigns.getSnapshot().state);
    expect(campaigns.getSnapshot().activeSlotId).toBe(1);
    expect(campaigns.saveAs(2, 'Copy before operation', T0).ok).toBe(true);
    const longName = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    expect(campaigns.rename(2, longName, T0).ok).toBe(true);
    expect(campaigns.getSnapshot().slots[1]?.name).toBe(longName);
    expect(campaigns.newGame(3, 'Separate test game', T0).ok).toBe(true);
    expect(campaigns.getSnapshot().state.personnel?.campaignSeed).not.toBe(original.personnel?.campaignSeed);
    expect(campaigns.load(2, T0).ok).toBe(true);
    expect(campaigns.getSnapshot().state).toEqual(original);
    expect(campaigns.getSnapshot().issue).toBeNull();
    expect(getLocks).not.toHaveBeenCalled();
    expect(getLocalStorage).not.toHaveBeenCalled();
  });

  it('keeps each preview library separate and discards it on a new frame lifetime', () => {
    const context = { search: flag, framed: true, getLocks: () => null, getLocalStorage: () => { throw new Error('No real storage'); } };
    const first = createSaveEnvironment(context);
    first.storage()!.setItem(SLOTS_KEY, 'only in frame one');
    expect(first.storage(true)!.getItem(SLOTS_KEY)).toBe('only in frame one');
    const second = createSaveEnvironment(context);
    expect(second.storage()!.getItem(SLOTS_KEY)).toBeNull();
    second.storage()!.setItem(SLOTS_KEY, 'only in frame two');
    expect(first.storage()!.getItem(SLOTS_KEY)).toBe('only in frame one');
  });

  it('preserves ordinary storage behavior when the flag is absent', () => {
    const real = { getItem: vi.fn(() => 'existing campaign'), setItem: vi.fn() };
    const environment = createSaveEnvironment({ search: '', framed: false, getLocks: () => null, getLocalStorage: () => real });
    const readOnly = environment.storage()!;
    expect(readOnly.getItem(SLOTS_KEY)).toBe('existing campaign');
    expect(() => readOnly.setItem(SLOTS_KEY, 'replacement')).toThrow('Safe local saving is unavailable');
    expect(real.setItem).not.toHaveBeenCalled();
    expect(environment.storage(false)).toBe(real);
  });
});
