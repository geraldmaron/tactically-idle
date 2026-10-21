// The player's settings: defaults, saving and reading back, values a later build no longer knows,
// and storage that refuses (the choice still holds on this page).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS, SETTINGS_KEY, avoidedThemes, cardWarningsOn, firstRunDone, parseSettings,
  readSettings, resetSettingsMemory, subscribeSettings, timerSetting, updateSettings,
} from './prefs';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
const refusing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
const install = (storage: unknown) => Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

describe('player settings', () => {
  beforeEach(() => resetSettingsMemory());
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; resetSettingsMemory(); });

  it('starts at the signed-off defaults: nothing avoided, card warnings on, Relaxed timer', () => {
    install(fakeStorage());
    expect(readSettings()).toEqual({ avoidThemes: [], cardWarnings: 'all', timer: 'relaxed', sound: true, flashing: true, firstRunDone: false });
    expect([avoidedThemes(), cardWarningsOn(), timerSetting(), firstRunDone()]).toEqual([[], true, 'relaxed', false]);
  });

  it('saves every change to storage and reads it back after a reload', () => {
    const storage = fakeStorage();
    install(storage);
    updateSettings({ avoidThemes: ['domestic_violence', 'suicide_self_harm'], timer: 'off', firstRunDone: true });
    updateSettings({ cardWarnings: 'none' });
    resetSettingsMemory();
    expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toMatchObject({ cardWarnings: 'none', timer: 'off' });
    // Going Live, the only call, carries suicide_self_harm in every situation, so avoiding it would
    // leave nothing to draw and the saved list drops it.
    expect(readSettings()).toEqual({ avoidThemes: ['domestic_violence'], cardWarnings: 'none', timer: 'off', sound: true, flashing: true, firstRunDone: true });
    expect(cardWarningsOn()).toBe(false);
  });

  it('returns the same object between changes, so React does not loop on it', () => {
    install(fakeStorage());
    expect(readSettings()).toBe(readSettings());
    const before = readSettings();
    updateSettings({ timer: 'standard' });
    expect(readSettings()).not.toBe(before);
  });

  it('tells subscribers after each change until they unsubscribe', () => {
    install(fakeStorage());
    const listener = vi.fn();
    const stop = subscribeSettings(listener);
    updateSettings({ timer: 'off' });
    expect(listener).toHaveBeenCalledOnce();
    stop();
    updateSettings({ timer: 'standard' });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('falls back field by field on unknown or broken stored values, and drops a descriptor that would leave no calls', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ tier: 'core', avoidThemes: ['death', 'gore', 'child_at_risk', 7], cardWarnings: 'flagged', timer: 'standard', firstRunDone: 'yes' })))
      .toEqual({ ...DEFAULT_SETTINGS, avoidThemes: ['death', 'child_at_risk'], timer: 'standard' });
    // A stored set that would leave no calls is cleaned up, not trusted.
    expect(parseSettings(JSON.stringify({ avoidThemes: ['injury'] })).avoidThemes).toEqual([]);
  });

  it('refuses to save a switch that would leave no calls', () => {
    install(fakeStorage());
    updateSettings({ avoidThemes: ['injury', 'death'] });
    expect(avoidedThemes()).toEqual(['death']);
  });

  it('keeps the choice in memory when storage refuses, and starts from defaults when it cannot read', () => {
    install(refusing);
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    updateSettings({ avoidThemes: ['child_at_risk'], firstRunDone: true });
    expect(avoidedThemes()).toEqual(['child_at_risk']);
    expect(firstRunDone()).toBe(true);
    install(undefined);
    updateSettings({ timer: 'off' });
    expect(readSettings()).toMatchObject({ avoidThemes: ['child_at_risk'], timer: 'off', firstRunDone: true });
  });

  it('goes back to storage once a write succeeds again', () => {
    install(refusing);
    updateSettings({ timer: 'off' });
    const storage = fakeStorage();
    install(storage);
    updateSettings({ timer: 'standard' });
    expect(JSON.parse(storage.data.get(SETTINGS_KEY)!).timer).toBe('standard');
    expect(readSettings().timer).toBe('standard');
  });
});
