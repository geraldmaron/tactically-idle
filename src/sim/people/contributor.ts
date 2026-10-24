// The bond contributor for shared actions (docs/world-redesign.md, "Bonds"): small, capped and visible, in the
// existing contributor shape, so the world-calls lane can add it where the engine lists a step's inputs.
// This file is a leaf (types only), so resolution.ts can import it without pulling the rest of the people
// layer into an import cycle.
import type { Contributor, GameState, Id } from '../types';
import type { BondState } from './types';
import { PEOPLE_TUNING } from './tuning';

const VALUE: Partial<Record<BondState, number>> = {
  trusted: PEOPLE_TUNING.contributor.trusted,
  close: PEOPLE_TUNING.contributor.close,
  mentor: PEOPLE_TUNING.contributor.mentor,
  tense: PEOPLE_TUNING.contributor.tense,
  strained: PEOPLE_TUNING.contributor.strained,
};

const PHRASE: Partial<Record<BondState, string>> = {
  trusted: 'trust each other on the step',
  close: 'work close',
  mentor: 'mentor and trainee, in step',
  tense: 'tense, slower together',
  strained: 'strained, slower together',
};

/** The contributor for the officers on one action, or null when no pair among them has a bond that counts.
 * The pairs' values add and the total is capped at plus or minus `contributor.cap`. A pair is counted once. */
export function bondContributor(d: Pick<GameState, 'people' | 'officers'>, officerIds: readonly Id[]): Contributor | null {
  const ids = [...new Set(officerIds)].filter((id) => d.officers[id] && (d.people.records[id]?.status ?? 'employed') === 'employed');
  let total = 0;
  let strongest: { a: Id; b: Id; state: BondState; value: number } | null = null;
  let counted = 0;
  for (const bond of d.people.bonds) {
    if (!ids.includes(bond.a) || !ids.includes(bond.b)) continue;
    const value = VALUE[bond.state];
    if (!value) continue;
    total += value;
    counted++;
    if (!strongest || Math.abs(value) > Math.abs(strongest.value)) strongest = { a: bond.a, b: bond.b, state: bond.state, value };
  }
  if (!strongest) return null;
  const cap = PEOPLE_TUNING.contributor.cap;
  const value = Math.max(-cap, Math.min(cap, total));
  if (value === 0) return null;
  const a = d.officers[strongest.a].surname, b = d.officers[strongest.b].surname;
  const label = counted === 1 ? `${a} and ${b}: ${PHRASE[strongest.state]}` : `Bonds in the stack: ${a} and ${b} lead, ${counted} pairs`;
  return { label, value, source: 'familiarity', ref: strongest.a };
}
