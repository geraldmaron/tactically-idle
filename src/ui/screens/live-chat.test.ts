import { beforeEach, describe, expect, it } from 'vitest';
import { chatGapMs, chatHandle, chatPhase, chatTick, countRefreshMs, drawChatLine, drawStateLine, drawThreadLine, fillerTick, nextChatHandle, nextLiveCount, resetChatMemory, seenCount, seenState, type ChatTickLine } from './live-chat';
import type { ThreatChatDef } from '../../sim/scenario-types';

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

describe('a live count', () => {
  it('refreshes every second or two, not every frame', () => {
    const random = rng(3);
    for (let i = 0; i < 200; i++) {
      const ms = countRefreshMs(random);
      expect(ms).toBeGreaterThanOrEqual(1300);
      expect(ms).toBeLessThanOrEqual(2800);
    }
  });

  it('holds near a steady audience, moving by a handful of people', () => {
    const random = rng(5);
    let shown = 554;
    const steps: number[] = [];
    for (let i = 0; i < 60; i++) { const next = nextLiveCount(shown, 554, random); steps.push(Math.abs(next - shown)); shown = next; }
    expect(Math.max(...steps)).toBeLessThanOrEqual(6);
    expect(Math.abs(shown - 554)).toBeLessThanOrEqual(17);
  });

  it('takes several refreshes to absorb a jump, and never strays 3% past the sim', () => {
    const random = rng(9);
    let shown = 1500;
    const path: number[] = [];
    for (let i = 0; i < 12; i++) { shown = nextLiveCount(shown, 4800, random); path.push(shown); }
    expect(path[0]).toBeLessThan(2900);
    expect(path.slice(0, 4).every((n, i, list) => i === 0 || n > list[i - 1])).toBe(true);
    expect(path.at(-1)!).toBeGreaterThan(4500);
    expect(path.every(n => n <= Math.ceil(4800 * 1.03))).toBe(true);
  });
});

describe('the chat', () => {
  beforeEach(() => resetChatMemory());

  it('never shows a line twice on one run, and goes quiet once the pool is spent', () => {
    const random = rng(11);
    const pool = ['a', 'b', 'c', 'd'];
    const drawn = Array.from({ length: 6 }, () => drawChatLine('run1', 'stream', pool, random));
    expect(new Set(drawn.slice(0, 4))).toEqual(new Set(pool));
    expect(drawn.slice(4)).toEqual([null, null]);
    // Another run starts fresh; a remount on the same run does not.
    expect(drawChatLine('run2', 'stream', pool, random)).not.toBeNull();
    expect(drawChatLine('run1', 'stream', pool, random)).toBeNull();
  });

  it('paces lines seconds apart, quicker as the gauge fills', () => {
    const mid = () => 0.5;
    expect(chatGapMs(0, mid)).toBeGreaterThan(chatGapMs(100, mid));
    expect(chatGapMs(100, () => 0)).toBeGreaterThanOrEqual(1600);
  });

  it('names the same commenter for the same line on a replay', () => {
    expect(chatHandle('run1', 'stream', 3)).toBe(chatHandle('run1', 'stream', 3));
    expect(new Set(Array.from({ length: 40 }, (_, i) => chatHandle('run1', 'stream', i))).size).toBeGreaterThanOrEqual(38);
  });
});

const thread = (letter: string, n: number, extra: Record<number, { by?: string; afterMin?: number }> = {}) =>
  Array.from({ length: n }, (_, i) => ({ text: `${letter}${i + 1}`, ...extra[i] }));
const CHAT: ThreatChatDef = { early: thread('e', 6), closing: thread('c', 6, { 1: { afterMin: 6.8 } }), imminent: thread('i', 6, { 5: { by: 'poster' } }) };

describe('a threat\'s chat', () => {
  beforeEach(() => resetChatMemory());

  it('is in the phase of the drain, in thirds', () => {
    expect([0, 3.6, 3.7, 7.2, 7.4, 11].map(d => chatPhase(d, 11))).toEqual(['early', 'early', 'closing', 'closing', 'imminent', 'imminent']);
    expect(chatPhase(5, 0)).toBe('early');
  });

  it('plays a phase in written order, once each, and then has nothing to say', () => {
    const drawn = Array.from({ length: 8 }, () => drawThreadLine('r', 't', CHAT, 1, 11)?.text ?? null);
    expect(drawn).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6', null, null]);
  });

  it('holds a line behind its beat until the stall reaches it, and plays it later in the phase', () => {
    const early = Array.from({ length: 3 }, () => drawThreadLine('r', 't', CHAT, 4, 11)?.text);
    expect(early).toEqual(['c1', 'c3', 'c4']);
    expect(drawThreadLine('r', 't', CHAT, 6.9, 11)?.text).toBe('c2');
  });

  it('holds the last imminent line for the end of the drain, and drops what the drain has passed', () => {
    const before = Array.from({ length: 6 }, () => drawThreadLine('r', 't', CHAT, 8, 11)?.text ?? null);
    expect(before).toEqual(['i1', 'i2', 'i3', 'i4', 'i5', null]);
    expect(drawThreadLine('r', 't', CHAT, 10, 11)).toMatchObject({ text: 'i6', by: 'poster' });
    // A thread the drain has left is never played late.
    expect(drawThreadLine('r', 't', CHAT, 8, 11)).toBeNull();
    expect(drawThreadLine('r2', 't', CHAT, 10, 11)).toMatchObject({ text: 'i6' });
  });

  it('plays filler one tick in four, and none once it is imminent', () => {
    const early = Array.from({ length: 8 }, () => fillerTick('r', 't', 'early'));
    expect(early).toEqual([false, false, false, true, false, false, false, true]);
    expect(Array.from({ length: 8 }, () => fillerTick('r', 'u', 'imminent'))).toEqual(Array(8).fill(false));
  });

  it('plays a state pool in order, once', () => {
    const pool = ['a', 'b'];
    expect([drawStateLine('r', 's', 'stopped', pool), drawStateLine('r', 's', 'stopped', pool), drawStateLine('r', 's', 'stopped', pool)]).toEqual(['a', 'b', null]);
    expect(drawStateLine('r', 's', 'slowed', pool)).toBe('a');
  });

  it('remembers the state and the count a visible chat last saw, so what began unseen plays when it shows', () => {
    expect(seenState('r', 's', 'none')).toBeNull();
    expect(seenState('r', 's', 'slowed')).toBe('none');
    expect(seenState('r', 's', 'slowed')).toBe('slowed');
    expect(seenCount('r', 's', 4000)).toBeNull();
    expect(seenCount('r', 's', 3000)).toBe(4000);
  });

  it('never gives a handle two lines, even when the ticker remounts', () => {
    const first = Array.from({ length: 20 }, () => nextChatHandle('r', 's'));
    const after = Array.from({ length: 20 }, () => nextChatHandle('r', 's'));
    expect(new Set([...first, ...after]).size).toBeGreaterThanOrEqual(38);
  });
});

describe('the chat on a tick', () => {
  beforeEach(() => resetChatMemory());
  const base = (over: Partial<Parameters<typeof chatTick>[0]> = {}) => ({ runKey: 'r', sourceId: 'stream', threatId: 't', thread: CHAT, dither: 1, minutes: 11, stopped: false, streamDown: false,
    pool: ['f1', 'f2', 'f3'], queue: [] as string[], random: rng(7), spare: { n: 0 }, ...over });

  it('plays a queued state line before anything else, and a stopped stream plays nothing after it', () => {
    const queue = ['cut'];
    expect(chatTick(base({ queue, stopped: true }))).toMatchObject({ kind: 'queued', text: 'cut' });
    expect(chatTick(base({ queue, stopped: true }))).toBeNull();
    expect(chatTick(base({ streamDown: true }))).toBeNull();
  });

  it('falls back to the cue pool when the threat has no thread, and to joins once the pool is spent', () => {
    const plain = base({ thread: null });
    const lines = Array.from({ length: 6 }, () => chatTick(plain));
    expect(lines.slice(0, 3).every(line => line?.kind === 'filler')).toBe(true);
    expect(lines.slice(3).map(line => line?.kind ?? null)).toEqual(['join', null, 'join']);
  });

  it('says nothing in imminent once the thread is spent, rather than fall to filler', () => {
    const late = base({ dither: 8 });
    const kinds = Array.from({ length: 8 }, () => chatTick(late)?.kind ?? null);
    expect(kinds.filter(kind => kind === 'filler').length).toBe(0);
    expect(kinds.slice(5)).toEqual([null, null, null]);
  });
});

/** A decision read at the timer's rate: the strip's loop with real gaps, a threat of `minutes` game
 * minutes. The player reads from the start and never chooses. */
function playback(rate: number, minutes: number) {
  resetChatMemory();
  const random = rng(3);
  const log: { t: number; phase: string; tick: ChatTickLine }[] = [];
  const spare = { n: 0 };
  const queue: string[] = [];
  const dither = (ms: number) => Math.min(minutes, ms / 60000 * rate);
  let t = 0;
  while (dither(t) < minutes) {
    const d = dither(t);
    const tick = chatTick({ runKey: 'p', sourceId: 'stream', threatId: 't', thread: CHAT, dither: d, minutes, stopped: false, streamDown: false, pool: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9', 'x10', 'x11', 'x12'], queue, random, spare });
    if (tick) log.push({ t, phase: chatPhase(d, minutes), tick });
    t += chatGapMs(50, random, chatPhase(d, minutes));
  }
  return { log, landsAt: minutes / rate * 60000 };
}

describe.each([['Relaxed', 5], ['Standard', 10]])('playback at %s', (_, rate) => {
  it.each([10, 13])('plays the first on-topic line at once, the reserved line before the landing, and never a thread line late (%i minutes)', minutes => {
    const { log, landsAt } = playback(rate, minutes);
    const thread = log.filter(entry => entry.tick.kind === 'thread');
    expect(thread[0].t).toBeLessThanOrEqual(3000);
    const reserved = thread.find(entry => entry.tick.by === 'poster');
    expect(reserved, 'the reserved line plays').toBeDefined();
    expect(reserved!.t).toBeLessThan(landsAt);
    expect(reserved!.t).toBeGreaterThanOrEqual(landsAt * 0.9 - 1);
    for (const entry of thread) expect(entry.tick.text![0], `${entry.tick.text} in ${entry.phase}`).toBe(entry.phase[0]);
    expect(log.some(entry => entry.phase === 'imminent' && entry.tick.kind === 'filler')).toBe(false);
  });
});
