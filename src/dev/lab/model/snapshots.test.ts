// Baselines: a call's strings pinned with the content key and tuning they were read under, the rows
// that changed since (with the changed words), and storage that never throws.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionClockNexts } from './clocks';
import { callStringRows } from '../../../gen/incident/trees-v13/strings';
import type { StringRow } from '../../../gen/incident/trees-v13/strings';
import { tuningHash } from '../../../sim/tuning';
import { parseLabUrl } from '../url';
import { openSession, sessionBinder } from './session';
import type { Session } from './session';
import { changedWords, diffStrings, loadSnapshot, pinLabel, saveSnapshot, SNAPSHOT_PREFIX, stringRowKey, takeSnapshot } from './snapshots';

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}

function fakeStorage(full = false) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { if (full) throw new Error('QuotaExceededError'); data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('snapshots', () => {
  const s = open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1');
  const rows = callStringRows(s.tree, sessionBinder(s), s.counts, sessionClockNexts(s));

  it('pins every row by its key with the content key and tuning hash', () => {
    const snap = takeSnapshot(s, rows, { label: 'Before the edit' });
    expect(snap).toMatchObject({ v: 1, type: 'hostage_crisis', label: 'Before the edit', contentKey: s.contentKey, tuningHash: tuningHash('current') });
    expect(Object.keys(snap.strings)).toHaveLength(new Set(rows.map(stringRowKey)).size);
    expect(Object.keys(snap.strings)).toHaveLength(rows.length);
    expect(stringRowKey({ where: 'talking.prompt', situation: 'all' })).toBe('talking.prompt');
    expect(stringRowKey({ where: 'a.b.mixed[2]', situation: 's1' })).toBe('a.b.mixed[2]@s1');
    expect(diffStrings(snap, rows).size).toBe(0);
  });

  it('labels a baseline in local time, as the lab shows it', () => {
    const at = new Date(2026, 9, 9, 3, 8).getTime();
    expect(pinLabel(at)).toBe('Pinned 03:08');
    expect(pinLabel(at, 'this call · random style · 400 runs')).toBe('Pinned 03:08 · this call · random style · 400 runs');
    const snap = takeSnapshot(s, rows);
    const when = new Date(snap.at);
    expect(snap.label).toBe(`Pinned ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`);
  });

  it('shows exactly the edited row, with the changed word, and rows added or gone', () => {
    const snap = takeSnapshot(s, rows);
    const index = rows.findIndex(row => row.surface === 'preview');
    const before = rows[index].text, words = before.split(' ');
    const edited = [...words.slice(0, 2), 'suddenly', ...words.slice(3)].join(' ');
    const after: StringRow[] = rows.map((row, i) => i === index ? { ...row, text: edited } : row);
    const diff = diffStrings(snap, after);
    expect([...diff.keys()]).toEqual([stringRowKey(rows[index])]);
    const change = diff.get(stringRowKey(rows[index]))!;
    expect(change.before).toBe(before);
    expect(change.after).toBe(edited);
    expect(change.words.map(([a, b]) => edited.slice(a, b))).toEqual(['suddenly']);
    const grown = diffStrings(snap, [...rows.slice(1), { situation: 'all', where: 'new.line', surface: 'prompt', text: 'A new line.' }]);
    expect(grown.get('new.line')).toEqual({ before: '', after: 'A new line.', words: [[0, 11]] });
    expect(grown.get(stringRowKey(rows[0]))).toEqual({ before: rows[0].text, after: '', words: [] });
  });

  it('marks changed words as merged ranges', () => {
    const text = 'Lee lowers the gun and waits';
    expect(changedWords('Lee raises the gun and waits', text).map(([a, b]) => text.slice(a, b))).toEqual(['lowers']);
    expect(changedWords('Lee waits', text).map(([a, b]) => text.slice(a, b))).toEqual(['lowers the gun and']);
    expect(changedWords(text, text)).toEqual([]);
  });

  it('stores and reads a baseline per type, and never throws when storage is blocked or full', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    const snap = takeSnapshot(s, rows);
    expect(saveSnapshot(snap)).toBe(true);
    expect(storage.data.has(`${SNAPSHOT_PREFIX}hostage_crisis`)).toBe(true);
    expect(loadSnapshot('hostage_crisis')).toEqual(snap);
    expect(loadSnapshot('barricaded')).toBeNull();
    storage.data.set(`${SNAPSHOT_PREFIX}barricaded`, '{not json');
    expect(loadSnapshot('barricaded')).toBeNull();
    storage.data.set(`${SNAPSHOT_PREFIX}barricaded`, JSON.stringify({ ...snap, type: 'barricaded', v: 2 }));
    expect(loadSnapshot('barricaded')).toBeNull();
    vi.stubGlobal('localStorage', fakeStorage(true));
    expect(saveSnapshot(snap)).toBe(false);
    vi.stubGlobal('localStorage', undefined);
    expect(saveSnapshot(snap)).toBe(false);
    expect(loadSnapshot('hostage_crisis')).toBeNull();
  });
});
