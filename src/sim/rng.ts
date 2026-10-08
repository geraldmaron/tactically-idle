// Deterministic PRNG (mulberry32). State is a uint32 stored in saved records so
// a resumed run continues from exactly the same sequence.

export function next(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: nextState };
}

/** Draw n values; returns the values and the advanced state. */
export function draw(state: number, n: number): { values: number[]; state: number } {
  const values: number[] = [];
  let s = state;
  for (let i = 0; i < n; i++) {
    const r = next(s);
    values.push(r.value);
    s = r.state;
  }
  return { values, state: s };
}

export function pick<T>(state: number, items: readonly T[]): { value: T; state: number } {
  const r = next(state);
  return { value: items[Math.floor(r.value * items.length)], state: r.state };
}

/** Stable 32-bit hash for deriving seeds from strings. */
/** An index in 0..n-1 from a hashSeed value, read from its high bits. FNV-1a's low bit is only the
 * parity of the key's characters, so `hash % n` with an even n reaches half the options for keys
 * that differ in one place (only half the surnames, a turn tied to pacing). */
export const hashIndex = (hash: number, n: number): number => Math.min(n - 1, Math.floor(hash / 4294967296 * n));

export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
