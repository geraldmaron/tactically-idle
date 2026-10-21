import type { CheckKind, Tempo } from '../sim/scenario-types';
import type { Role, TraitId } from '../sim/types';

// What an officer brings to a check beyond their ratings (sim/resolution.ts reads these tables), as
// data, so the cards name each one and a call can single out the right person for a moment
// (ActionDefinition.favors). Every effect applies only when its condition holds, scaled by the
// officer's seat on the decision. Wiring probes in src/architecture/wiring.ts keep each one live.

/** When a trait effect applies. Every given field must hold. */
export interface TraitWhen {
  kinds?: CheckKind[];
  tempo?: Tempo[];
  notTempo?: Tempo[];
  /** Call pressure at or above this (0..100), as the stall has left it. */
  pressureAtLeast?: number;
  /** A report the team hasn't confirmed or ruled out is still open. */
  unresolvedReport?: true;
  /** A veteran or a mentor is in the officer's squad on this call. */
  mentored?: boolean;
  /** A pressure source (a clock that fills) whose first cue is heard is at least this full. */
  watchedAtLeast?: number;
}

export interface TraitEffect {
  trait: TraitId;
  /** What the card says, after the officer's surname ("calm voice on the line"). */
  label: string;
  /** Score points at the first seat. */
  value: number;
  when: TraitWhen;
}

export const TRAIT_EFFECTS: readonly TraitEffect[] = [
  { trait: 'calm_voice', label: 'calm voice on the line', value: 6, when: { kinds: ['contact'] } },
  { trait: 'observant', label: 'observant, spots inconsistent reports', value: 6, when: { kinds: ['observation'], unresolvedReport: true } },
  { trait: 'impatient', label: 'impatient, poor at waiting', value: -5, when: { tempo: ['waiting'] } },
  { trait: 'impatient', label: 'impatient, sharper under pressure', value: 4, when: { notTempo: ['waiting'], pressureAtLeast: 50 } },
  { trait: 'rookie', label: 'rookie, still learning', value: -4, when: { mentored: false } },
  { trait: 'rookie', label: 'rookie, steadied by a mentor', value: -1, when: { mentored: true } },
  // Someone who has never had a camera on them talks worse to a person performing for one.
  { trait: 'rookie', label: 'rookie, rattled by the cameras', value: -3, when: { kinds: ['contact', 'pressure'], watchedAtLeast: 40 } },
  { trait: 'steady', label: 'steady when the crowd grows', value: 3, when: { kinds: ['contact', 'coordination', 'pressure'], watchedAtLeast: 40 } },
];

/** How much of the time-pressure penalty a trait takes away, on top of composure: `steady` officers
 * don't speed up because the clock does. */
export const TRAIT_PRESSURE_SHIELD: Partial<Record<TraitId, number>> = { steady: 0.4 };

/** The check a role trains for, and what being in that seat adds (score points at the first seat).
 * Small: the ratings already carry most of what a role means; this is the drill. */
export const ROLE_CHECKS: Record<Role, { kinds: CheckKind[]; value: number; label: string }> = {
  comms: { kinds: ['contact'], value: 2, label: 'negotiator by training' },
  breach: { kinds: ['execution'], value: 2, label: 'breacher by training' },
  medic: { kinds: ['medical'], value: 2, label: 'medic by training' },
  recon: { kinds: ['observation'], value: 2, label: 'recon by training' },
  lead: { kinds: ['coordination', 'pressure'], value: 2, label: 'team lead by training' },
};

/** Calls of this type the officer has worked before (Officer.career.byType): a point a call at the
 * first seat, up to `cap`. Someone who has stood at this kind of door before knows how it goes. */
export const TYPE_HISTORY = { perCall: 1, cap: 4 } as const;
