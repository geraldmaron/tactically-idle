// The three notification categories asked once, when the first shift starts (docs/world-redesign.md, "Notifications":
// asked when the player starts something they want to hear about; declining changes nothing). Kept in
// localStorage like the other settings, read and written in try/catch. The browser build delivers no
// notifications yet, so this records the choice for the build that does; Settings (F2) reads the same key.
import { useSyncExternalStore } from 'react';

export const NOTIFY_KEY = 'ti-notify';

export interface NotifyPrefs {
  /** Shifts and training finish. */
  finished: boolean;
  /** A call drops in the player's city. */
  calls: boolean;
  /** One daily digest instead of the two above. */
  digest: boolean;
  /** The player has answered the first-shift ask, either way. */
  asked: boolean;
}

export const DEFAULT_NOTIFY: Readonly<NotifyPrefs> = Object.freeze({ finished: true, calls: true, digest: false, asked: false });

let unsaved: NotifyPrefs | null = null;
let cache: { raw: string | null; value: NotifyPrefs } | null = null;
const listeners = new Set<() => void>();

export function parseNotify(raw: string | null): NotifyPrefs {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch { /* unreadable: defaults */ }
  const flag = (key: keyof NotifyPrefs) => (typeof data[key] === 'boolean' ? data[key] as boolean : DEFAULT_NOTIFY[key]);
  return { finished: flag('finished'), calls: flag('calls'), digest: flag('digest'), asked: data.asked === true };
}

export function readNotify(): NotifyPrefs {
  if (unsaved) return unsaved;
  let raw: string | null = null;
  try { raw = globalThis.localStorage?.getItem(NOTIFY_KEY) ?? null; } catch { /* refused: defaults */ }
  if (cache?.raw !== raw) cache = { raw, value: parseNotify(raw) };
  return cache.value;
}

export function writeNotify(patch: Partial<NotifyPrefs>): void {
  const next = parseNotify(JSON.stringify({ ...readNotify(), ...patch }));
  try {
    if (!globalThis.localStorage) throw new Error('no storage');
    globalThis.localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
    unsaved = null;
  } catch {
    unsaved = next;
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useNotifyPrefs = (): NotifyPrefs => useSyncExternalStore(subscribe, readNotify, () => DEFAULT_NOTIFY);

/** Test seam. */
export function resetNotifyMemory(): void { unsaved = null; cache = null; }
