// How a pressure source's count and chat move on the strip (LiveFeed.tsx SourceTicker). Presentation
// only and store-free: the sim says where the count is (sim/pressure-sources.ts sourceCount); this
// says how a live count gets there and who in the chat says what, so it reads like a real stream
// and no viewer's line is read twice on one call (docs/call-pressure.md, "Reactions").
import { commenterHandle } from '../../content/world';
import type { ChatLineDef, ThreatChatDef } from '../../sim/scenario-types';

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

/** Where a threat has drained to, in thirds (docs/call-pressure.md, "Chat that follows the
 * pressure"): early under a third, closing to two thirds, imminent after. */
export type ChatPhase = 'early' | 'closing' | 'imminent';
export function chatPhase(dither: number, minutes: number): ChatPhase {
  const drain = minutes > 0 ? Math.max(0, dither) / minutes : 0;
  return drain < 1 / 3 ? 'early' : drain < 2 / 3 ? 'closing' : 'imminent';
}
/** How much of the gap each phase keeps: the chat speeds up as the threat closes. */
const PHASE_PACE: Record<ChatPhase, number> = { early: 1, closing: 0.8, imminent: 0.6 };
/** The shortest gap between lines, so the one before is read before the next pushes it up. */
export const MIN_CHAT_GAP_MS = 1600;
/** Where in the drain the last imminent line, the one reserved for the poster, plays. */
export const RESERVED_AT = 0.9;
/** A visible line fades after this long, so a spent chat never freezes on stale lines. */
export const CHAT_FADE_MS = 12000;

/** How long until the chat's next line, in milliseconds: a few seconds apart on a small stream, about
 * two on a full one (`fill` 0..100), shorter as the threat closes, never under 1.6 seconds. Slow
 * enough that a call's pools last. */
export function chatGapMs(fill: number, random: () => number, phase: ChatPhase = 'early'): number {
  const base = Math.max(2200, 5200 - Math.max(0, Math.min(100, fill)) * 28);
  return Math.max(MIN_CHAT_GAP_MS, base * (0.75 + random() * 0.5) * PHASE_PACE[phase]);
}

/** The lines each call run has already shown, by run and source. Module memory, so a ticker that
 * remounts (a beat changes, the map opens) never replays a line on the same run. */
const shown = new Map<string, Set<string>>();

/** What the chat has played, by run: threads by threat and phase, how many speakers have said a line
 * (so a remount never gives one handle two lines), the last state and count a visible chat saw. */
const threadDone = new Map<string, Set<number>>();
const threadTicks = new Map<string, number>();
const speakers = new Map<string, number>();
const lastState = new Map<string, string>();
const lastCount = new Map<string, number>();

/** Forget every run's chat (tests, and a new game). */
export function resetChatMemory(): void { shown.clear(); threadDone.clear(); threadTicks.clear(); speakers.clear(); lastState.clear(); lastCount.clear(); }

/** The next line of an open threat's thread (ThreatChat): the thread of the phase the drain is in, in
 * written order, once each per run. A line waiting on a beat (`afterMin`) is skipped until the stall
 * reaches it, and plays later in the same phase. In imminent the last line is held for the end of the
 * drain (RESERVED_AT) and then plays whatever else is left. Null when the phase has nothing to say. */
export function drawThreadLine(runKey: string, threatId: string, chat: ThreatChatDef, dither: number, minutes: number): ChatLineDef | null {
  const phase = chatPhase(dither, minutes);
  const lines = chat[phase];
  const key = `${runKey}:${threatId}:${phase}`;
  const done = threadDone.get(key) ?? new Set<number>();
  threadDone.set(key, done);
  const reserved = phase === 'imminent' ? lines.length - 1 : -1;
  if (reserved >= 0 && minutes > 0 && dither / minutes >= RESERVED_AT && !done.has(reserved)) {
    // The reserved line is the last thing said: what was still waiting in the phase is dropped, so a
    // late reload never plays the poster before the lines that lead up to them.
    lines.forEach((_, i) => done.add(i));
    return lines[reserved];
  }
  const at = lines.findIndex((line, i) => i !== reserved && !done.has(i) && (line.afterMin === undefined || line.afterMin <= dither));
  if (at < 0) return null;
  done.add(at);
  return lines[at];
}

/** Whether this tick is filler from the cue pool rather than the thread: one tick in four, and none
 * once the threat is imminent. */
export function fillerTick(runKey: string, threatId: string, phase: ChatPhase): boolean {
  const key = `${runKey}:${threatId}`;
  const n = threadTicks.get(key) ?? 0;
  threadTicks.set(key, n + 1);
  return phase !== 'imminent' && n % 4 === 3;
}

/** A state pool's next line, in written order, once each per run and state. */
export function drawStateLine(runKey: string, sourceId: string, state: string, pool: readonly string[]): string | null {
  const key = `${runKey}:${sourceId}:state:${state}`;
  const done = threadDone.get(key) ?? new Set<number>();
  threadDone.set(key, done);
  const at = pool.findIndex((_, i) => !done.has(i));
  if (at < 0) return null;
  done.add(at);
  return pool[at];
}

/** The stream state a visible chat last saw, and the count it last saw, by run and source: kept in
 * memory so a chat that was hidden (a result) plays what began meanwhile when it shows again. */
export function seenState(runKey: string, sourceId: string, state: string | null): string | null {
  const key = `${runKey}:${sourceId}`;
  const before = lastState.get(key) ?? null;
  if (state !== null) lastState.set(key, state);
  return before;
}
export function seenCount(runKey: string, sourceId: string, count: number): number | null {
  const key = `${runKey}:${sourceId}`;
  const before = lastCount.get(key) ?? null;
  lastCount.set(key, count);
  return before;
}

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

/** The next speaker's handle on a run's source. The count lives in memory with the lines already
 * shown, so a ticker that remounts never gives one handle two lines. */
export function nextChatHandle(runKey: string, sourceId: string): string {
  const key = `${runKey}:${sourceId}`;
  const n = speakers.get(key) ?? 0;
  speakers.set(key, n + 1);
  return chatHandle(runKey, sourceId, n);
}

/** What the chat reads on one tick: the strip's own loop and the playback test both draw through it. */
export interface ChatTickInput {
  runKey: string; sourceId: string; threatId: string;
  /** The open threat's thread, or null when it has none (it falls back to the cue pool as before). */
  thread: ThreatChatDef | null;
  dither: number; minutes: number;
  stopped: boolean; streamDown: boolean;
  /** The cue pool for the count the stream is at. */
  pool: readonly string[];
  /** State lines waiting to play, first in line. */
  queue: string[];
  random: () => number;
  /** Counts the ticks a spent chat has gone quiet, so joins come every other one. */
  spare: { n: number };
}
export interface ChatTickLine { kind: 'queued' | 'thread' | 'filler' | 'join'; text: string | null; by?: string }

/** One tick of the chat, in order of precedence: a state line, then the thread of the drain's phase,
 * then filler from the cue pool (one tick in four, and none in imminent when the threat has a
 * thread), then a join once the pool is spent. A stopped stream, or a node reached with the stream
 * down, plays only what is queued. Null is a quiet tick. */
export function chatTick(i: ChatTickInput): ChatTickLine | null {
  const queued = i.queue.shift();
  if (queued !== undefined) return { kind: 'queued', text: queued };
  if (i.stopped || i.streamDown) return null;
  const phase = chatPhase(i.dither, i.minutes);
  const filler = !i.thread || fillerTick(i.runKey, i.threatId, phase);
  const line = i.thread && !filler ? drawThreadLine(i.runKey, i.threatId, i.thread, i.dither, i.minutes) : null;
  if (line) return { kind: 'thread', text: line.text, ...(line.by !== undefined ? { by: line.by } : {}) };
  if (i.thread && phase === 'imminent') return null;
  const pooled = drawChatLine(i.runKey, i.sourceId, i.pool, i.random);
  if (pooled) return { kind: 'filler', text: pooled };
  return i.spare.n++ % 2 === 0 ? { kind: 'join', text: null } : null;
}
