// The one reading of "the player asked for less motion". Every screen that animates, counts up, pulses
// or plays a sound asks here instead of keeping its own copy of the media query. Presentation only.
import { useSyncExternalStore } from 'react';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const mediaList = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null;

/** True when the player's system asks for reduced motion. False where there is no window or no matchMedia. */
export const reducedMotion = (): boolean => !!mediaList()?.matches;

function subscribe(listener: () => void): () => void {
  const media = mediaList();
  if (!media || typeof media.addEventListener !== 'function') return () => {};
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

/** Reads `reducedMotion()` and re-renders when the player changes the system setting. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, reducedMotion, () => false);
}
