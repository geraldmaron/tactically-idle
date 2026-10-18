// Media queries the shell lays out by. 1440 and 900 are the two widths the lab is designed for
// (spec section 3); below 1100 px the top bar folds its tabs and the call strip folds its chips.
import { useSyncExternalStore } from 'react';

export const NARROW = '(max-width: 1100px)';
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    notify => { const list = window.matchMedia(query); list.addEventListener('change', notify); return () => list.removeEventListener('change', notify); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useNarrow = () => useMedia(NARROW);
