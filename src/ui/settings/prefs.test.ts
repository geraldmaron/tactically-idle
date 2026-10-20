// The player's settings: defaults, saving and reading back, values a later build no longer knows,
// and storage that refuses (the choice still holds on this page).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS, SETTINGS_KEY, contentNoteSetting, contentTier, firstRunDone, notesTopic, parseSettings,
  readSettings, resetSettingsMemory, subscribeSettings, timerSetting, topicsLeftOut, updateSettings,
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

  it('starts at the signed-off defaults: Mature, nothing off, notes for every topic, Relaxed timer', () => {
    install(fakeStorage());
    expect(readSettings()).toEqual({ tier: 'mature', topicsOff: [], contentNotes: 'all', noteTopics: [], timer: 'relaxed', firstRunDone: false });
    expect([contentTier(), timerSetting(), contentNoteSetting(), firstRunDone()]).toEqual(['mature', 'relaxed', 'all', false]);
    expect(topicsLeftOut()).toEqual([]);
  });

  it('saves every change to storage and reads it back after a reload', () => {
    const storage = fakeStorage();
    install(storage);
    updateSettings({ tier: 'core', topicsOff: ['injury'], timer: 'off', firstRunDone: true });
    updateSettings({ contentNotes: 'flagged', noteTopics: ['death'] });
    resetSettingsMemory();
    expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toMatchObject({ tier: 'core', timer: 'off' });
    expect(readSettings()).toEqual({ tier: 'core', topicsOff: ['injury'], contentNotes: 'flagged', noteTopics: ['death'], timer: 'off', firstRunDone: true });
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

  it('falls back field by field on unknown or broken stored values', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ tier: 'teen', topicsOff: ['death', 'gore', 7], timer: 'standard', firstRunDone: 'yes' })))
      .toEqual({ ...DEFAULT_SETTINGS, topicsOff: ['death'], timer: 'standard' });
  });

  it('keeps the choice in memory when storage refuses, and starts from defaults when it cannot read', () => {
    install(refusing);
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    updateSettings({ tier: 'core', firstRunDone: true });
    expect(contentTier()).toBe('core');
    expect(firstRunDone()).toBe(true);
    install(undefined);
    updateSettings({ timer: 'off' });
    expect(readSettings()).toMatchObject({ tier: 'core', timer: 'off', firstRunDone: true });
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

  it('leaves out the mature-only topics under Core without forgetting the player\'s own list', () => {
    install(fakeStorage());
    updateSettings({ tier: 'core', topicsOff: ['police_gunfire'] });
    expect(topicsLeftOut()).toEqual(['death', 'suicide_self_harm', 'police_gunfire', 'child_at_risk', 'domestic_violence']);
    updateSettings({ tier: 'mature' });
    expect(topicsLeftOut()).toEqual(['police_gunfire']);
  });

  it('notes every topic, only the marked ones, or none', () => {
    const base = { ...DEFAULT_SETTINGS, noteTopics: ['suicide_self_harm' as const] };
    expect(notesTopic('injury', { ...base, contentNotes: 'all' })).toBe(true);
    expect(notesTopic('injury', { ...base, contentNotes: 'flagged' })).toBe(false);
    expect(notesTopic('suicide_self_harm', { ...base, contentNotes: 'flagged' })).toBe(true);
    expect(notesTopic('suicide_self_harm', { ...base, contentNotes: 'none' })).toBe(false);
  });
});
