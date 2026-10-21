// Design candidates the owner compares before one ships. The decide-beat layouts were settled on
// 2026-10-21 (4B, the map folded from stage 2); the reading face is still open (docs/ops-experience.md, "How the comparisons
// get decided"). Dev builds only: production always reads the current design. Kept in localStorage
// beside the player's settings, never in the save, and read in try/catch like prefs.ts. A URL
// parameter (?face=serif) sets it too, so a comparison link opens on a candidate.
import { useSyncExternalStore } from 'react';

/** The story text's face: Barlow (`sans`, today) or Source Serif 4 (`serif`). */
export const READING_FACES = ['sans', 'serif'] as const;
export type ReadingFace = (typeof READING_FACES)[number];

export interface DesignCandidates { face: ReadingFace }

export const CANDIDATES_KEY = 'ti-dev-candidates';
const CURRENT: DesignCandidates = Object.freeze({ face: 'sans' });
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: DesignCandidates } | null = null;
let memory: DesignCandidates | null = null;

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T => allowed.includes(value as T) ? value as T : fallback;

export function parseCandidates(raw: string | null): DesignCandidates {
  let data: Record<string, unknown> = {};
  try { const parsed: unknown = raw ? JSON.parse(raw) : null; if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>; } catch { /* defaults */ }
  return { face: pick(READING_FACES, data.face, CURRENT.face) };
}

/** The candidates in view: the current design outside dev builds. */
export function readCandidates(): DesignCandidates {
  if (!import.meta.env.DEV) return CURRENT;
  if (memory) return memory;
  let raw: string | null = null;
  try { raw = globalThis.localStorage?.getItem(CANDIDATES_KEY) ?? null; } catch { /* refused */ }
  if (cache?.raw !== raw) cache = { raw, value: parseCandidates(raw) };
  return cache.value;
}

export function updateCandidates(patch: Partial<DesignCandidates>): void {
  const next = parseCandidates(JSON.stringify({ ...readCandidates(), ...patch }));
  try { globalThis.localStorage.setItem(CANDIDATES_KEY, JSON.stringify(next)); memory = null; } catch { memory = next; }
  applyFace(next.face);
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Re-renders on a switch. Tests read the plain value: some call LiveView as a function, outside a
 * renderer, and the mode never changes inside a build, so the hook order stays fixed. */
export function useCandidates(): DesignCandidates {
  return import.meta.env.MODE === 'test' ? readCandidates() : useSyncExternalStore(subscribe, readCandidates, readCandidates);
}

/** The face rides on the document (the reading-face-serif class), so every screen with story text reads it:
 * Prepare's cold open, the live prompt and results, transcripts and the debrief. */
function applyFace(face: ReadingFace): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('reading-face-serif', face === 'serif');
  if (face === 'serif') loadSerif();
}

/** The serif is only fetched when a dev build picks it, so production never loads it. */
function loadSerif(): void {
  if (typeof document === 'undefined' || document.getElementById('ti-serif-candidate')) return;
  const link = document.createElement('link');
  link.id = 'ti-serif-candidate';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap';
  document.head.appendChild(link);
}

/** Dev builds: a ?face= parameter sets the candidate on load, and a stored serif loads. */
export function initCandidates(): void {
  if (!import.meta.env.DEV || typeof location === 'undefined') return;
  const params = new URLSearchParams(location.search);
  const patch: Partial<DesignCandidates> = {};
  if (params.has('face')) patch.face = pick(READING_FACES, params.get('face'), CURRENT.face);
  if (Object.keys(patch).length) updateCandidates(patch);
  else applyFace(readCandidates().face);
}
