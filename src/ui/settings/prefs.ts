// The player's settings (docs/content-rating.md "First run and settings", docs/call-pressure.md
// "Settings"; owner redesign 2026-10-20 after Xbox Accessibility Guideline 123): the descriptors to keep
// off the board, whether call cards carry theme warnings, and the call timer. Kept in localStorage
// outside the versioned save, so they survive a save rejected on a version bump, and read and
// written in try/catch like src/ui/people/prefs.ts. When storage refuses the write (a sandboxed
// frame, a private window, a full quota) the choice still holds for this page, in memory.
// Pure: no React, no store. The plain read functions at the bottom are what the engine wiring calls.

import { DEFAULT_TIMER_SETTING, TIMER_SETTINGS, type TimerSetting } from '../../sim/timer-setting';
import type { ContentDescriptor } from '../../content/content-descriptors';
import { sanitizeAvoid } from './avoidable';

export const SETTINGS_KEY = 'ti-settings';

/** Whether call cards name the themes a call involves before the player accepts it. */
export const CARD_WARNING_SETTINGS = ['all', 'none'] as const;
export type CardWarningSetting = (typeof CARD_WARNING_SETTINGS)[number];

export interface PlayerSettings {
  /** Descriptors kept off the board: any set that leaves a kind of call to draw. */
  avoidThemes: ContentDescriptor[];
  cardWarnings: CardWarningSetting;
  timer: TimerSetting;
  /** Live call sound and vibration (owner 2026-10-21: on by default, with a mute). */
  sound: boolean;
  /** The red and blue light sweep across the top of a hot call (live-call.css .live-wash). On by
   * default and offered at first run; off holds the lights still (photosensitivity). */
  flashing: boolean;
  /** Set once the player has read the launch advisory and continued. */
  firstRunDone: boolean;
  /** Officers' lives off the clock (bond scenes, romance) shown on screen. Off hides them; play is the same
   * (docs/world-redesign.md, "Bonds"). */
  personalLives: boolean;
}

export const DEFAULT_SETTINGS: Readonly<PlayerSettings> = Object.freeze({
  avoidThemes: [],
  cardWarnings: 'all',
  timer: DEFAULT_TIMER_SETTING,
  sound: true,
  flashing: true,
  firstRunDone: false,
  personalLives: true,
});

/** The value chosen on this page when storage refused it; null while storage holds the choice. */
let unsaved: PlayerSettings | null = null;
/** The last parse, so React's useSyncExternalStore gets a stable snapshot between changes. */
let cache: { raw: string | null; value: PlayerSettings } | null = null;
const listeners = new Set<() => void>();

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? value as T : fallback;

/** Anything stored that isn't a known value falls back to its default, field by field. */
export function parseSettings(raw: string | null): PlayerSettings {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch { /* unreadable: defaults */ }
  return {
    avoidThemes: sanitizeAvoid(data.avoidThemes),
    cardWarnings: pick(CARD_WARNING_SETTINGS, data.cardWarnings, DEFAULT_SETTINGS.cardWarnings),
    timer: pick(TIMER_SETTINGS, data.timer, DEFAULT_SETTINGS.timer),
    sound: data.sound !== false,
    flashing: data.flashing !== false,
    firstRunDone: data.firstRunDone === true,
    personalLives: data.personalLives !== false,
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

// Plain reads for the engine wiring (board filtering, call card warnings, dither).

/** The themes the board leaves out. */
export const avoidedThemes = (): readonly ContentDescriptor[] => readSettings().avoidThemes;
export const cardWarningsOn = (): boolean => readSettings().cardWarnings === 'all';
export const timerSetting = (): TimerSetting => readSettings().timer;
export const firstRunDone = (): boolean => readSettings().firstRunDone;
export const soundOn = (): boolean => readSettings().sound;
export const flashingOn = (): boolean => readSettings().flashing;
