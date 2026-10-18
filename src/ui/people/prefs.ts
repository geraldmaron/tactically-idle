// The "Color names by role" preference (spec 8.5): one boolean, default on, kept in localStorage
// and read and written in try/catch. When storage refuses the write (a sandboxed frame, a private
// window, a full quota) the choice still holds for this page, in memory. Pure: no React, no store.

export const PEOPLE_COLOR_KEY = 'ti-pref-people-color';

/** The value chosen on this page when storage refused it; null while storage holds the choice. */
let unsaved: boolean | null = null;
const listeners = new Set<() => void>();

/** Default true. */
export function peopleColorOn(): boolean {
  if (unsaved !== null) return unsaved;
  try {
    return globalThis.localStorage?.getItem(PEOPLE_COLOR_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setPeopleColor(on: boolean): void {
  try {
    if (!globalThis.localStorage) throw new Error('no storage');
    globalThis.localStorage.setItem(PEOPLE_COLOR_KEY, on ? '1' : '0');
    unsaved = null;
  } catch {
    unsaved = on;
  }
  listeners.forEach((listener) => listener());
}

/** Called after every change made on this page; returns the unsubscribe. */
export function subscribePeopleColor(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
