import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTuningPatch, onTuningChange, registeredTables, tunable, tuningHash, tuningLayers, tuningRevision, validatePatch, withTuning } from './tuning';

// Fake tables shaped like the real ones: nested records, a list of weights, a tuple pair, a string.
const ODDS = tunable('TEST_ODDS', {
  favorableAt: 8,
  adverseAt: -12,
  seats: [1, 0.35, 0.2],
  bandTime: { favorable: 1, mixed: 1.2, adverse: 1.5 } as Record<string, number>,
  pair: [3, -2] as readonly [number, number],
  label: 'odds',
  enabled: true,
}, {
  deny: [{ path: 'TEST_ODDS.label', kind: 'structural', reason: 'Names a content key.' }],
  guard: next => next.favorableAt <= next.adverseAt ? 'favorableAt must stay above adverseAt.' : null,
});
const SPATIAL = tunable('TEST_SPATIAL', { reach: 0.6, clear: { full: 0.6, partial: 0.25 } }, {
  deny: [{ path: 'reach', kind: 'generation', reason: 'Baked into generated calls.' }],
});

afterEach(() => { applyTuningPatch({}); });

describe('tunable', () => {
  it('returns the same object and registers it', () => {
    const table = { a: 1 };
    expect(tunable('TEST_IDENTITY', table)).toBe(table);
    expect(registeredTables().filter(name => name.startsWith('TEST_'))).toEqual(['TEST_IDENTITY', 'TEST_ODDS', 'TEST_SPATIAL']);
  });

  it('keeps every identity while patches come and go', () => {
    const { seats, bandTime } = ODDS;
    applyTuningPatch({ TEST_ODDS: { favorableAt: 10, seats: [1, 0.4, 0.2], bandTime: { mixed: 1.3 } } });
    expect(ODDS.favorableAt).toBe(10);
    expect(ODDS.seats).toBe(seats);
    expect(ODDS.bandTime).toBe(bandTime);
    expect(seats).toEqual([1, 0.4, 0.2]);
    expect(bandTime).toEqual({ favorable: 1, mixed: 1.3, adverse: 1.5 });
    applyTuningPatch({});
    expect(seats).toEqual([1, 0.35, 0.2]);
    expect(bandTime.mixed).toBe(1.2);
  });
});

describe('merge rules', () => {
  it('recurses into objects and assigns lists element by element', () => {
    expect(applyTuningPatch({ TEST_ODDS: { pair: [2, -1], enabled: false }, TEST_SPATIAL: { clear: { partial: 0.3 } } })).toEqual([]);
    expect(ODDS.pair).toEqual([2, -1]);
    expect(ODDS.enabled).toBe(false);
    expect(SPATIAL.clear).toEqual({ full: 0.6, partial: 0.3 });
  });

  it('refuses unknown tables and keys, type changes, list lengths and deny-listed paths, and applies the rest', () => {
    const problems = applyTuningPatch({
      TEST_NOPE: { a: 1 },
      TEST_ODDS: { favorableAt: 9, bogus: 1, adverseAt: '−10', seats: [1, 0.5], bandTime: { slow: 2, mixed: 1.25 }, label: 'other', pair: [1, Number.NaN] },
      TEST_SPATIAL: { reach: 0.7, clear: 0.5 },
    });
    expect(problems.map(problem => problem.path).sort()).toEqual([
      'TEST_NOPE', 'TEST_ODDS.adverseAt', 'TEST_ODDS.bandTime.slow', 'TEST_ODDS.bogus', 'TEST_ODDS.label', 'TEST_ODDS.pair.1', 'TEST_ODDS.seats',
      'TEST_SPATIAL.clear', 'TEST_SPATIAL.reach',
    ]);
    expect(problems.find(problem => problem.path === 'TEST_ODDS.label')!.reason).toMatch(/structural/);
    expect(problems.find(problem => problem.path === 'TEST_SPATIAL.reach')!.reason).toMatch(/generation/);
    expect(ODDS.favorableAt).toBe(9);
    expect(ODDS.adverseAt).toBe(-12);
    expect(ODDS.seats).toEqual([1, 0.35, 0.2]);
    expect(ODDS.bandTime).toEqual({ favorable: 1, mixed: 1.25, adverse: 1.5 });
    expect(ODDS.label).toBe('odds');
    expect(ODDS.pair).toEqual([1, -2]);
    expect(SPATIAL.reach).toBe(0.6);
    expect(Object.keys(ODDS.bandTime)).not.toContain('slow');
  });

  it('refuses prototype keys', () => {
    const problems = validatePatch(JSON.parse('{"TEST_ODDS":{"__proto__":{"favorableAt":1},"constructor":1}}'));
    expect(problems.map(problem => problem.path)).toEqual(['TEST_ODDS.__proto__', 'TEST_ODDS.constructor']);
    expect(({} as Record<string, unknown>).favorableAt).toBeUndefined();
  });

  it('drops the whole table change when the guard refuses it', () => {
    const problems = applyTuningPatch({ TEST_ODDS: { favorableAt: -20, seats: [1, 0.5, 0.2] } });
    expect(problems).toEqual([{ path: 'TEST_ODDS', reason: 'favorableAt must stay above adverseAt.' }]);
    expect(ODDS.favorableAt).toBe(8);
    expect(ODDS.seats).toEqual([1, 0.35, 0.2]);
  });

  it('validates without applying', () => {
    expect(validatePatch({ TEST_ODDS: { favorableAt: 12 } })).toEqual([]);
    expect(validatePatch({ TEST_ODDS: { favorableAt: true } })).toHaveLength(1);
    expect(ODDS.favorableAt).toBe(8);
    expect(tuningRevision()).toBeGreaterThan(0);
  });
});

describe('patch layers', () => {
  it('applies idempotently, always from the saved values', () => {
    const next = { TEST_ODDS: { favorableAt: 11, bandTime: { adverse: 2 } } };
    applyTuningPatch(next);
    const once = JSON.stringify(ODDS);
    applyTuningPatch(next);
    expect(JSON.stringify(ODDS)).toBe(once);
    applyTuningPatch({ TEST_ODDS: { adverseAt: -10 } });
    expect(ODDS.favorableAt).toBe(8);
    expect(ODDS.bandTime.adverse).toBe(1.5);
    expect(ODDS.adverseAt).toBe(-10);
  });

  it('lists defaults, saved overrides and the patch', () => {
    applyTuningPatch({ TEST_SPATIAL: { clear: { full: 0.7 } } });
    const layers = tuningLayers();
    expect(layers.defaults.TEST_SPATIAL).toEqual({ reach: 0.6, clear: { full: 0.6, partial: 0.25 } });
    expect(layers.saved).toEqual({});
    expect(layers.patch).toEqual({ TEST_SPATIAL: { clear: { full: 0.7 } } });
    layers.defaults.TEST_SPATIAL.reach = 1;
    expect(tuningLayers().defaults.TEST_SPATIAL.reach).toBe(0.6);
  });

  it('withTuning applies for the call only, silently, and restores the previous patch', () => {
    applyTuningPatch({ TEST_ODDS: { favorableAt: 9 } });
    const revision = tuningRevision();
    const heard = vi.fn();
    const off = onTuningChange(heard);
    const seen = withTuning({ TEST_ODDS: { adverseAt: -5 } }, () => [ODDS.favorableAt, ODDS.adverseAt]);
    expect(seen).toEqual([8, -5]);
    expect([ODDS.favorableAt, ODDS.adverseAt]).toEqual([9, -12]);
    expect(() => withTuning({ TEST_ODDS: { favorableAt: 15 } }, () => { throw new Error('boom'); })).toThrow('boom');
    expect(ODDS.favorableAt).toBe(9);
    expect(tuningRevision()).toBe(revision);
    expect(heard).not.toHaveBeenCalled();
    expect(tuningLayers().patch).toEqual({ TEST_ODDS: { favorableAt: 9 } });
    off();
  });

  it('bumps the revision and tells listeners until they unsubscribe', () => {
    const heard = vi.fn();
    const off = onTuningChange(heard);
    const before = tuningRevision();
    applyTuningPatch({ TEST_ODDS: { favorableAt: 10 } });
    expect(tuningRevision()).toBe(before + 1);
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    applyTuningPatch({});
    expect(heard).toHaveBeenCalledTimes(1);
    expect(tuningRevision()).toBe(before + 2);
  });

  it('applies a patch to a table that registers after it', () => {
    applyTuningPatch({ TEST_LATE: { a: 2 } });
    const late = tunable('TEST_LATE', { a: 1 });
    expect(late.a).toBe(2);
    applyTuningPatch({});
    expect(late.a).toBe(1);
  });
});

describe('tuningHash', () => {
  it('is stable under key order and equals saved with an empty patch', () => {
    expect(tuningHash()).toBe(tuningHash('saved'));
    expect(tuningHash()).toMatch(/^[0-9a-f]{8}$/);
    applyTuningPatch({ TEST_ODDS: { favorableAt: 10, bandTime: { mixed: 1.3, adverse: 2 } }, TEST_SPATIAL: { clear: { full: 0.7 } } });
    const a = tuningHash();
    applyTuningPatch({ TEST_SPATIAL: { clear: { full: 0.7 } }, TEST_ODDS: { bandTime: { adverse: 2, mixed: 1.3 }, favorableAt: 10 } });
    expect(tuningHash()).toBe(a);
    expect(a).not.toBe(tuningHash('saved'));
    applyTuningPatch({ TEST_ODDS: { favorableAt: 11 } });
    expect(tuningHash()).not.toBe(a);
  });
});

describe('saved overrides from tuning.json', () => {
  it('merges valid overrides at registration and skips invalid ones with console.error', async () => {
    vi.resetModules();
    vi.doMock('./tuning.json', () => ({ default: { TEST_SAVED: { a: 2, b: 'x', c: { d: 5 }, list: [1, 2, 3] }, TEST_GUARDED: { a: -1 } } }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const fresh = await import('./tuning');
      const table = { a: 1, b: 2, c: { d: 4 }, list: [1, 2] };
      const saved = fresh.tunable('TEST_SAVED', table);
      expect(saved).toBe(table);
      expect(saved).toEqual({ a: 2, b: 2, c: { d: 5 }, list: [1, 2] });
      const guarded = fresh.tunable('TEST_GUARDED', { a: 1, z: 0 }, { guard: next => next.a < 0 ? 'a must not be negative.' : null });
      expect(guarded).toEqual({ a: 1, z: 0 });
      expect(error.mock.calls.map(call => String(call[0]))).toEqual([
        'tuning.json: TEST_SAVED.b: Expected a number, got a string.',
        'tuning.json: TEST_SAVED.list: Expected 2 values, got 3.',
        'tuning.json: TEST_GUARDED: a must not be negative.',
      ]);
      // Saved values are the floor every patch restores to; defaults stay the source values.
      fresh.applyTuningPatch({ TEST_SAVED: { a: 3 } });
      expect(saved.a).toBe(3);
      fresh.applyTuningPatch({});
      expect(saved.a).toBe(2);
      expect(fresh.tuningLayers().defaults.TEST_SAVED).toEqual({ a: 1, b: 2, c: { d: 4 }, list: [1, 2] });
      expect(fresh.tuningLayers().saved).toEqual({ TEST_SAVED: { a: 2, b: 'x', c: { d: 5 }, list: [1, 2, 3] }, TEST_GUARDED: { a: -1 } });
      expect(fresh.tuningHash('saved')).not.toBe(tuningHash('saved'));
    } finally {
      error.mockRestore();
      vi.doUnmock('./tuning.json');
      vi.resetModules();
    }
  });
});
