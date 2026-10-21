import { beforeEach, describe, expect, it } from 'vitest';
import { chatGapMs, chatHandle, countRefreshMs, drawChatLine, nextLiveCount, resetChatMemory } from './live-chat';

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
