// How a pressure source's count and chat move on the strip (LiveFeed.tsx SourceTicker). Presentation
// only and store-free: the sim says where the count is (sim/pressure-sources.ts sourceCount); this
// says how a live count gets there and who in the chat says what, so it reads like a real stream
// and no viewer's line is read twice on one call (docs/call-pressure.md, "Reactions").
import { commenterHandle } from '../../content/world';

/** How long a live count holds before it refreshes, in milliseconds. Stream apps refresh the viewer
 * count every second or two, never every frame. */
export function countRefreshMs(random: () => number): number {
  return 1300 + random() * 1500;
}

/** The count after one refresh: part of the way to the sim's value, as people arrive over a few
 * refreshes rather than all at once, and a few joining or leaving either way like a real audience.
 * Never more than 3% from the sim's value, so the card's odds line and the strip agree. */
export function nextLiveCount(shown: number, target: number, random: () => number): number {
  const pull = (target - shown) * (0.22 + random() * 0.18);
  const churn = Math.max(1, shown * 0.004) * (random() * 2 - 1);
  const next = Math.round(shown + pull + churn);
  const low = Math.floor(target * 0.97), high = Math.ceil(target * 1.03);
  // Catching up never overshoots the band, and once inside it the churn stays there.
  return Math.max(0, Math.min(shown <= high ? high : next, Math.max(shown >= low ? low : next, next)));
}

/** How long until the chat's next line, in milliseconds: a few seconds apart on a small stream, about
 * two on a full one (`fill` 0..100). Slow enough that a call's pools last. */
export function chatGapMs(fill: number, random: () => number): number {
  const base = Math.max(2200, 5200 - Math.max(0, Math.min(100, fill)) * 28);
  return base * (0.75 + random() * 0.5);
}

/** The lines each call run has already shown, by run and source. Module memory, so a ticker that
 * remounts (a beat changes, the map opens) never replays a line on the same run. */
const shown = new Map<string, Set<string>>();

/** Forget every run's chat (tests, and a new game). */
export function resetChatMemory(): void { shown.clear(); }

/** A line from `pool` this run hasn't shown for this source yet, or null once the pool is spent. */
export function drawChatLine(runKey: string, sourceId: string, pool: readonly string[], random: () => number): string | null {
  const key = `${runKey}:${sourceId}`;
  const seen = shown.get(key) ?? new Set<string>();
  shown.set(key, seen);
  const fresh = pool.filter((line) => !seen.has(line));
  if (!fresh.length) return null;
  const line = fresh[Math.floor(random() * fresh.length)];
  seen.add(line);
  return line;
}

/** Who says the `n`th line on a run's source: a stable handle, so a replay of the same run names the
 * same people. */
export function chatHandle(runKey: string, sourceId: string, n: number): string {
  return commenterHandle(`${runKey}:${sourceId}:${n}`);
}
