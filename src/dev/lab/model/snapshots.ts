// A pinned baseline of one call (spec J10): its strings as bound for the call in focus, the content
// key and tuning hash it was taken under, and optionally a reach tally and per-style distributions,
// kept in this browser's localStorage so the lab can show what an edit changed: which lines (with the
// changed words), which odds, which ending shares.
import type { Distribution, Policy } from '../../../gen/incident/trees-v13/balance';
import type { StringRow } from '../../../gen/incident/trees-v13/strings';
import type { IncidentType } from '../../../sim/scenario-types';
import { tuningHash } from '../../../sim/tuning';
import type { ReachTally } from '../jobs/tally';
import type { Session } from './session';

/** `population`: the reach population `reach` was played on (populationKey in surfaces/flow/reach.ts);
 * Outcomes compares a tally against `reach` only under the same one. */
export interface CallSnapshot { v: 1; type: IncidentType; label: string; at: number; contentKey: string; tuningHash: string;
  strings: Record<string, string>; reach?: ReachTally; population?: string; styles?: Partial<Record<Policy, Distribution>> }

export const SNAPSHOT_PREFIX = 'ti-lab-baseline:';

/** One string row's stable id: where it is in the tree, plus its situation when it is not `all`
 * (`talking.offer.mixed[2]@s1`). Script rows, `sel=string:<key>` and baselines all use it. */
export function stringRowKey(row: Pick<StringRow, 'where' | 'situation'>): string {
  return row.situation === 'all' ? row.where : `${row.where}@${row.situation}`;
}

/** "Pinned 03:08" in this browser's local time, as every baseline reads in the lab; with a
 * population, "Pinned 03:08 · <population>" (Outcomes compares only under the same population
 * key, which also names the call, squad and step). */
export function pinLabel(at: number, population?: string): string {
  const when = new Date(at);
  const stamp = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  return population ? `Pinned ${stamp} · ${population}` : `Pinned ${stamp}`;
}

/** The call's strings now, keyed by row, with the hashes that say what they were read under. */
export function takeSnapshot(s: Session, rows: readonly StringRow[], extra: { reach?: ReachTally; population?: string; styles?: Partial<Record<Policy, Distribution>>; label?: string } = {}): CallSnapshot {
  const at = Date.now();
  return {
    v: 1, type: s.tree.type, label: extra.label ?? pinLabel(at), at,
    contentKey: s.contentKey, tuningHash: tuningHash('current'), strings: Object.fromEntries(rows.map(row => [stringRowKey(row), row.text])),
    ...(extra.reach ? { reach: extra.reach } : {}), ...(extra.population ? { population: extra.population } : {}), ...(extra.styles ? { styles: extra.styles } : {}),
  };
}

/** Words (and the spaces between them) with their character offsets. */
function tokens(text: string): { text: string; start: number; end: number }[] {
  return [...text.matchAll(/\S+/g)].map(match => ({ text: match[0], start: match.index!, end: match.index! + match[0].length }));
}

/** The character ranges of `after` whose words are not in the longest common word sequence with
 * `before`, adjacent changed words merged into one range. */
export function changedWords(before: string, after: string): [start: number, end: number][] {
  const a = tokens(before), b = tokens(after);
  // Longest common subsequence over words; strings are short (a call's longest line is a few dozen words).
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    lcs[i][j] = a[i].text === b[j].text ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const kept = new Set<number>();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i].text === b[j].text) { kept.add(j); i++; j++; } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++; else j++;
  }
  const ranges: [number, number][] = [];
  b.forEach((word, j) => {
    if (kept.has(j)) return;
    const last = ranges[ranges.length - 1];
    if (last && !kept.has(j - 1) && j > 0) last[1] = word.end; else ranges.push([word.start, word.end]);
  });
  return ranges;
}

/** Rows whose text differs from the baseline: changed rows with their changed words, rows new since
 * the baseline (every word changed), and baseline rows that are gone (`after` empty). Keyed by
 * stringRowKey. */
export function diffStrings(base: CallSnapshot, rows: readonly StringRow[]): Map<string, { before: string; after: string; words: [start: number, end: number][] }> {
  const out = new Map<string, { before: string; after: string; words: [number, number][] }>();
  const now = new Map(rows.map(row => [stringRowKey(row), row.text]));
  for (const [key, after] of now) {
    const before = base.strings[key];
    if (before === after) continue;
    out.set(key, { before: before ?? '', after, words: before === undefined ? (after ? [[0, after.length]] : []) : changedWords(before, after) });
  }
  for (const [key, before] of Object.entries(base.strings)) if (!now.has(key)) out.set(key, { before, after: '', words: [] });
  return out;
}

/** Stores the baseline for its type (localStorage 'ti-lab-baseline:<type>'). False when storage is
 * blocked or full. */
export function saveSnapshot(s: CallSnapshot): boolean {
  try {
    localStorage.setItem(SNAPSHOT_PREFIX + s.type, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** The stored baseline for a type, or null when there is none, it is unreadable, or storage is blocked. */
export function loadSnapshot(type: IncidentType): CallSnapshot | null {
  try {
    const text = localStorage.getItem(SNAPSHOT_PREFIX + type);
    if (!text) return null;
    const value = JSON.parse(text) as Partial<CallSnapshot>;
    return value && value.v === 1 && value.type === type && typeof value.strings === 'object' && value.strings !== null
      && typeof value.contentKey === 'string' && typeof value.tuningHash === 'string' && typeof value.at === 'number' ? value as CallSnapshot : null;
  } catch {
    return null;
  }
}
