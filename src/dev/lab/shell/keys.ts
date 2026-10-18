// Global keys (spec 3.0): ⌘K or Ctrl+K opens the palette anywhere; G then C P F O D S T switches
// surface; N starts a note on the selection; \ toggles the review drawer; ? opens the shortcut sheet.
// Esc belongs to the layer stack (viz/layers.tsx). Everything but ⌘K stands down while focus is in a
// text field or a modal is open.
import { useEffect, useRef } from 'react';
import { SURFACE_META } from '../surfaces/meta';
import type { Surface } from '../types';
import { modalOpen } from '../viz';

export interface ShellKeys { palette(): void; surface(tab: Surface): void; note(): void; drawer(): void; shortcuts(): void }

export const GLOBAL_KEYS: readonly { keys: string; does: string }[] = [
  { keys: '⌘K', does: 'Go to a call, surface, node, choice, ending, key, line or tuning field' },
  { keys: 'G then C P F O D S T', does: 'Calls, Play, Flow, Outcomes, Dependencies, Script, Tuning' },
  { keys: 'N', does: 'New note on the selection' },
  { keys: '\\', does: 'Open or close the review drawer' },
  { keys: '?', does: 'Keyboard shortcuts' },
  { keys: 'Esc', does: 'Close the topmost panel' },
];

const BY_KEY = new Map((Object.keys(SURFACE_META) as Surface[]).map(tab => [SURFACE_META[tab].key, tab]));
/** How long after G the surface key still counts. */
const CHORD_MS = 1500;

// The G chord, shared with surface keys: when G was pressed (0 when no chord is open), and the key
// events the shell took as the second half of a chord.
let chordAt = 0;
const chordEvents = new WeakSet<Event>();

/** Whether a key belongs to the shell's G chord: G itself, or the key right after it. Surface key
 * handlers ignore these, whichever listener runs first, so G P switches to Play and never also
 * toggles people colors. */
export function chordKey(event: KeyboardEvent): boolean {
  if (event.key === 'g' || event.key === 'G') return true;
  return chordEvents.has(event) || (chordAt > 0 && Date.now() - chordAt < CHORD_MS);
}

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  return el.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'submit'].includes((el as HTMLInputElement).type);
}

export function useShellKeys(handlers: ShellKeys) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const h = latest.current;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') { event.preventDefault(); h.palette(); return; }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || modalOpen()) return;
      if (chordAt && Date.now() - chordAt < CHORD_MS) {
        chordAt = 0;
        chordEvents.add(event);
        const tab = BY_KEY.get(event.key.toUpperCase());
        if (tab) { event.preventDefault(); h.surface(tab); }
        return;
      }
      chordAt = 0;
      if (event.key === 'g' || event.key === 'G') { chordAt = Date.now(); return; }
      if (event.key === 'n' || event.key === 'N') { event.preventDefault(); h.note(); return; }
      if (event.key === '\\') { event.preventDefault(); h.drawer(); return; }
      if (event.key === '?') { event.preventDefault(); h.shortcuts(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** ⌘K on a Mac, Ctrl+K elsewhere. */
export const paletteKey = () => (isMac() ? '⌘K' : 'Ctrl+K');
