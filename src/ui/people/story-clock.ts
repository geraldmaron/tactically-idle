// The one clock a screen of rotating story lines shares (station rebuild, "signs of life"). Every tile
// that turns its personal line asks here, so a roster re-renders once every STORY_TURN_MS and not once
// per tile. Under reduced motion there is no clock at all: the tick is a constant and the lines hold
// still on their first, highest-priority line (story-line.ts `turnedLine(..., still)`).
import { useSyncExternalStore } from 'react';
import { useReducedMotion } from '../motion';
import { STORY_TURN_MS } from './story-line';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let tick = 0;

function start() {
  if (timer !== null || typeof setInterval === 'undefined') return;
  timer = setInterval(() => { tick += 1; listeners.forEach((listener) => listener()); }, STORY_TURN_MS);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) { clearInterval(timer); timer = null; }
  };
}

const idle = () => () => {};

/** `{ still, now }`: `still` is the reduced-motion answer, `now` is the time to hand to `turnedLine`. The
 * component re-renders once per turn while lines are rotating, and never while they are held. */
export function useStoryClock(): { still: boolean; now: number } {
  const still = useReducedMotion();
  useSyncExternalStore(still ? idle : subscribe, () => (still ? 0 : tick), () => 0);
  return { still, now: Date.now() };
}
