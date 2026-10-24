// Small shared helpers for the people layer: ids, beats, and lookups. Pure of the economy and operations
// modules so every people module can import it without a cycle.
import type { GameState, Id, Officer } from '../types';
import type { PeopleBeat, PeopleBeatKind, PeopleState, PersonRecord } from './types';
import { PEOPLE_TUNING } from './tuning';
import { hashSeed } from '../rng';

// The lead's Imprint record has no place to remember that a fork is due but the telegraph has not been
// seen. This optional field carries it until types.ts adds it (reported to the lead).
declare module './types' {
  interface Imprint {
    /** Why a fork is due: the note repeated inside its window, or the first trigger was severe. The fork opens
     * only once `seen` is true; until then this is all the record keeps. */
    forkDue?: 'repeat' | 'severe';
  }
}

/** A namespaced id from the people counter: `fact_3`, `imp_4`, `tie_5`, `beat_6`, `set_7`. */
export function nextPeopleId(people: PeopleState, prefix: 'fact' | 'imp' | 'tie' | 'beat' | 'set'): Id {
  return `${prefix}_${people.nextId++}`;
}

export const recordOf = (d: Pick<GameState, 'people'>, officerId: Id): PersonRecord | undefined => d.people.records[officerId];

/** An officer who is employed now: a live Officer and an employed record. */
export function employed(d: Pick<GameState, 'people' | 'officers'>, officerId: Id): Officer | undefined {
  const o = d.officers[officerId];
  const r = d.people.records[officerId];
  return o && (!r || r.status === 'employed') ? o : undefined;
}

export const pairKey = (a: Id, b: Id): [Id, Id] => (a < b ? [a, b] : [b, a]);

/** Raise a beat the report and the team badge show once. Beats about the same thing that are still
 * unacknowledged are not repeated. */
export function raiseBeat(d: Pick<GameState, 'people'>, kind: PeopleBeatKind, officerIds: Id[], at: number, refId?: string, collect?: Id[]): Id | null {
  const p = d.people;
  if (p.beats.some((b) => !b.acknowledged && b.kind === kind && b.refId === refId && sameIds(b.officerIds, officerIds))) return null;
  const beat: PeopleBeat = { id: nextPeopleId(p, 'beat'), at, kind, officerIds: [...officerIds], ...(refId !== undefined ? { refId } : {}), acknowledged: false };
  p.beats.push(beat);
  collect?.push(beat.id);
  trimBeats(p);
  return beat.id;
}

const sameIds = (a: Id[], b: Id[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** Keep every unacknowledged beat and the newest few acknowledged ones. */
function trimBeats(p: PeopleState): void {
  const acknowledged = p.beats.filter((b) => b.acknowledged);
  const excess = acknowledged.length - PEOPLE_TUNING.acknowledgedBeatsKept;
  if (excess <= 0) return;
  const drop = new Set(acknowledged.slice(0, excess).map((b) => b.id));
  p.beats = p.beats.filter((b) => !drop.has(b.id));
}

/** A fixed draw in [0, 1) for a key, from the world seed: the same pair or officer always gets the same
 * value, and nothing consumes the department's rng. FNV-1a's low bits are weak, so the draw reads the high
 * bits of a second pass. */
export function hashUnit(seed: number, key: string): number {
  return hashSeed(`${hashSeed(`${seed >>> 0}:${key}`)}:u`) / 4294967296;
}
