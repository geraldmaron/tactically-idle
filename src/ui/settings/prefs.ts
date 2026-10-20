// The player's settings (docs/content-rating.md "First run and settings", docs/call-pressure.md
// "Settings"): the content tier, topics turned off, content notes and the call timer. Kept in
// localStorage outside the versioned save, so they survive a save rejected on a version bump, and
// read and written in try/catch like src/ui/people/prefs.ts. When storage refuses the write (a
// sandboxed frame, a private window, a full quota) the choice still holds for this page, in memory.
// Pure: no React, no store. The plain read functions at the bottom are what the engine wiring calls.

import { CONTENT_DESCRIPTORS, CONTENT_TIERS, MATURE_ONLY, type ContentDescriptor, type ContentTier } from '../../content/content-descriptors';
import { DEFAULT_TIMER_SETTING, TIMER_SETTINGS, type TimerSetting } from '../../sim/timer-setting';

export const SETTINGS_KEY = 'ti-settings';

/** Where the call card note shows: for every topic a call carries, only for the topics the
 * player marked, or never. */
export const CONTENT_NOTE_SETTINGS = ['all', 'flagged', 'none'] as const;
export type ContentNoteSetting = (typeof CONTENT_NOTE_SETTINGS)[number];

export interface PlayerSettings {
  tier: ContentTier;
  /** Topics the player switched off, in either tier. Core also leaves off the mature-only ones;
   * those stay out of this list so switching back to Mature restores the player's own choices. */
  topicsOff: ContentDescriptor[];
  contentNotes: ContentNoteSetting;
  /** The topics that get a note when `contentNotes` is 'flagged'. */
  noteTopics: ContentDescriptor[];
  timer: TimerSetting;
  firstRunDone: boolean;
}

export const DEFAULT_SETTINGS: Readonly<PlayerSettings> = Object.freeze({
  tier: 'mature',
  topicsOff: [],
  contentNotes: 'all',
  noteTopics: [],
  timer: DEFAULT_TIMER_SETTING,
  firstRunDone: false,
});

/** The value chosen on this page when storage refused it; null while storage holds the choice. */
let unsaved: PlayerSettings | null = null;
/** The last parse, so React's useSyncExternalStore gets a stable snapshot between changes. */
let cache: { raw: string | null; value: PlayerSettings } | null = null;
const listeners = new Set<() => void>();

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? value as T : fallback;
const topics = (value: unknown): ContentDescriptor[] =>
  Array.isArray(value) ? CONTENT_DESCRIPTORS.filter((d) => value.includes(d)) : [];

/** Anything stored that isn't a known value falls back to its default, field by field. */
export function parseSettings(raw: string | null): PlayerSettings {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch { /* unreadable: defaults */ }
  return {
    tier: pick(CONTENT_TIERS, data.tier, DEFAULT_SETTINGS.tier),
    topicsOff: topics(data.topicsOff),
    contentNotes: pick(CONTENT_NOTE_SETTINGS, data.contentNotes, DEFAULT_SETTINGS.contentNotes),
    noteTopics: topics(data.noteTopics),
    timer: pick(TIMER_SETTINGS, data.timer, DEFAULT_SETTINGS.timer),
    firstRunDone: data.firstRunDone === true,
  };
}

export function readSettings(): PlayerSettings {
  if (unsaved !== null) return unsaved;
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(SETTINGS_KEY) ?? null;
  } catch { /* refused: defaults */ }
  if (cache?.raw !== raw) cache = { raw, value: parseSettings(raw) };
  return cache.value;
}

/** Writes the whole settings object with `patch` applied, then tells every subscriber. */
export function updateSettings(patch: Partial<PlayerSettings>): void {
  const next = parseSettings(JSON.stringify({ ...readSettings(), ...patch }));
  try {
    if (!globalThis.localStorage) throw new Error('no storage');
    globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    unsaved = null;
  } catch {
    unsaved = next;
  }
  listeners.forEach((listener) => listener());
}

/** Called after every change made on this page; returns the unsubscribe. */
export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test seam: forget the in-memory choice and the parse cache. */
export function resetSettingsMemory(): void {
  unsaved = null;
  cache = null;
}

// Plain reads for the engine wiring (board filtering, content notes, dither).

export const contentTier = (): ContentTier => readSettings().tier;
export const timerSetting = (): TimerSetting => readSettings().timer;
export const contentNoteSetting = (): ContentNoteSetting => readSettings().contentNotes;
export const firstRunDone = (): boolean => readSettings().firstRunDone;

/** Topics the board leaves out: the ones switched off, plus the mature-only ones under Core. */
export function topicsLeftOut(settings: PlayerSettings = readSettings()): ContentDescriptor[] {
  return CONTENT_DESCRIPTORS.filter((d) => settings.topicsOff.includes(d) || (settings.tier === 'core' && MATURE_ONLY[d]));
}

/** Whether a call carrying `topic` gets a note on its card under the player's setting. */
export function notesTopic(topic: ContentDescriptor, settings: PlayerSettings = readSettings()): boolean {
  return settings.contentNotes === 'all' || (settings.contentNotes === 'flagged' && settings.noteTopics.includes(topic));
}
