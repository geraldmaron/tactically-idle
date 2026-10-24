import type { Officer } from './types';
import { tunable } from './tuning';

/** Proposed starting bands; tuning values, not commitments. */
export const STRESS_BANDS = {
  ready: 0,
  strained: 30,
  overloaded: 60,
  recovery: 80,
} as const;

/** How strain wears an officer's ratings down. Tunable (sim/tuning.ts). */
export const STRESS_TUNING = tunable('STRESS_TUNING', {
  /** Fraction of a rating contribution lost at stress 100 (linear from conditionFrom). */
  conditionMax: 0.55,
  conditionFrom: 15,
});

/** Share of an officer's rating contribution that strain takes away: what a call and the squad builder both read. */
export function conditionFraction(stress: number): number {
  const T = STRESS_TUNING;
  return Math.max(0, Math.min(T.conditionMax, ((stress - T.conditionFrom) / (100 - T.conditionFrom)) * T.conditionMax));
}

/** Officer experience and age. First-pass values. Tunable (sim/tuning.ts). */
export const EXPERIENCE_TUNING = tunable('EXPERIENCE_TUNING', {
  /** Situation pressure at or above which experience bands matter (pressure-kind checks always count). */
  pressureOn: 50,
  rookiePenalty: -2,
  rookieStrain: 1.15,
  seasonedBonus: 2,
  veteranBonus: 4,
  mentoring: 2,
  /** Strain share per 5 years of age over this. */
  ageStrainFrom: 50,
  ageStrainPer5: 0.05,
});

export type StressBand = 'ready' | 'strained' | 'overloaded' | 'recovery';

export function stressBand(stress: number): StressBand {
  if (stress >= STRESS_BANDS.recovery) return 'recovery';
  if (stress >= STRESS_BANDS.overloaded) return 'overloaded';
  if (stress >= STRESS_BANDS.strained) return 'strained';
  return 'ready';
}

export const BAND_LABEL: Record<StressBand, string> = {
  ready: 'Ready',
  strained: 'Strained',
  overloaded: 'Overloaded',
  recovery: 'Mandatory recovery',
};

export function fullName(o: Officer): string {
  return `${o.firstName} ${o.surname}`;
}

/** Can this officer be deployed to an operation right now? */
export function deployability(o: Officer, now: number): { ok: true } | { ok: false; reason: string } {
  if (o.injury && o.injury.until > now) return { ok: false, reason: `${o.surname} is injured (${o.injury.label})` };
  if (stressBand(o.stress) === 'recovery') return { ok: false, reason: `${o.surname} is in mandatory recovery` };
  if (o.assignment?.kind === 'training') return { ok: false, reason: `${o.surname} is in training` };
  if (o.assignment?.kind === 'detail') return { ok: false, reason: `${o.surname} is on an instructor detail` };
  if (o.assignment?.kind === 'operation') return { ok: false, reason: `${o.surname} is already deployed` };
  if (o.assignment?.kind === 'proactive') return { ok: false, reason: `${o.surname} is on a proactive shift` };
  if (o.assignment?.kind === 'standdown') return { ok: false, reason: `${o.surname} is stood down to rest` };
  if (o.assignment?.kind === 'peer_support') return { ok: false, reason: `${o.surname} is on peer support` };
  return { ok: true };
}

/** Why a world or aftercare assignment keeps an officer off other work (save v19), or null. Training,
 * details and operations keep their own checks; these kinds share one answer everywhere. */
export function worldBusyReason(o: Officer): string | null {
  if (o.assignment?.kind === 'proactive') return `${o.surname} is on a proactive shift`;
  if (o.assignment?.kind === 'standdown') return `${o.surname} is stood down to rest`;
  if (o.assignment?.kind === 'peer_support') return `${o.surname} is on peer support`;
  return null;
}

/** Overloaded officers are restricted from high-risk actions. */
export function highRiskAllowed(o: Officer): boolean {
  return o.stress < STRESS_BANDS.overloaded;
}
