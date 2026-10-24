// Memory: facts recorded from debriefs, world cases and shifts (docs/world-redesign.md, "Memory"). A fact is
// a recorded thing, never an invented memory: the kind, the place, who else was there and one specific
// detail of 80 characters at most, frozen when it is written. No branch depends on a fact existing.
import type { GameState, Id } from '../types';
import { FACT_DETAIL_MAX, FACT_SHAPES, type FactSlots } from '../../content/people/facts';
import type { FactKind, MemoryFact } from './types';
import { nextPeopleId } from './core';
import { PEOPLE_TUNING } from './tuning';

/** Slot text carries no dash and no colon: both are stripped, and a trailing full stop dropped. */
function clean(text: string): string {
  return text.replace(/[–—]/g, ' ').replace(/\s-\s/g, ' ').replace(/:/g, '').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
}

const SLOT = /\{(\w+)\}/g;

/** Fill a shape from the slots, or null when a slot it needs is missing. */
export function bindShape(shape: string, slots: Partial<FactSlots>): string | null {
  let missing = false;
  const text = shape.replace(SLOT, (_m, key: string) => {
    const value = (slots as Record<string, string | number | undefined>)[key];
    if (value === undefined || value === '') { missing = true; return ''; }
    return typeof value === 'number' ? String(value) : clean(value);
  });
  return missing ? null : text.replace(/\s+/g, ' ').trim();
}

const words = (text: string): string[] => text.toLowerCase().split(/[^a-zÀ-ɏ']+/).filter(Boolean);

/** Pick a detail for a kind: the next shape in rotation for this officer that has its slots, fits in 80
 * characters and carries no name from the call. */
export function detailFor(kind: FactKind, slots: Partial<FactSlots>, existing: readonly MemoryFact[], banned: ReadonlySet<string>): string | null {
  const shapes = FACT_SHAPES[kind];
  const seen = existing.filter((f) => f.kind === kind).length;
  for (let i = 0; i < shapes.length; i++) {
    const text = bindShape(shapes[(seen + i) % shapes.length], slots);
    if (!text || text.length > FACT_DETAIL_MAX) continue;
    if (words(text).some((w) => banned.has(w))) continue;
    return text;
  }
  // Last resort: the place alone, trimmed to fit.
  if (slots.place) {
    const base = `Was on the call at ${clean(slots.place)}.`;
    if (base.length <= FACT_DETAIL_MAX && !words(base).some((w) => banned.has(w))) return base;
  }
  return null;
}

export interface FactInput {
  officerId: Id;
  kind: FactKind;
  at: number;
  place: string;
  with: Id[];
  runId?: Id;
  caseId?: Id;
  slots?: Partial<FactSlots>;
  banned?: ReadonlySet<string>;
}

/** Write a fact if this officer has none yet for the same call, case or shift. Returns it, or null. */
export function recordFact(d: Pick<GameState, 'people'>, input: FactInput): MemoryFact | null {
  const mine = d.people.facts.filter((f) => f.officerId === input.officerId);
  const key = input.runId ?? input.caseId;
  if (key !== undefined && mine.some((f) => f.kind === input.kind && (f.runId === input.runId && f.caseId === input.caseId))) return null;
  const detail = detailFor(input.kind, { place: input.place, ...input.slots }, mine, input.banned ?? new Set());
  if (!detail) return null;
  const fact: MemoryFact = {
    id: nextPeopleId(d.people, 'fact'), officerId: input.officerId, at: input.at, kind: input.kind, place: input.place,
    ...(input.runId !== undefined ? { runId: input.runId } : {}), ...(input.caseId !== undefined ? { caseId: input.caseId } : {}),
    with: [...input.with], detail,
  };
  d.people.facts.push(fact);
  // Keep the newest few per officer.
  const overflow = mine.length + 1 - PEOPLE_TUNING.factsPerOfficer;
  if (overflow > 0) {
    const drop = new Set(mine.slice(0, overflow).map((f) => f.id));
    d.people.facts = d.people.facts.filter((f) => !drop.has(f.id));
  }
  return fact;
}

export const hasFact = (d: Pick<GameState, 'people'>, officerId: Id, kind: FactKind): boolean => d.people.facts.some((f) => f.officerId === officerId && f.kind === kind);

/** Newest first. */
export const factsOf = (d: Pick<GameState, 'people'>, officerId: Id): MemoryFact[] =>
  d.people.facts.filter((f) => f.officerId === officerId).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id, undefined, { numeric: true }));
