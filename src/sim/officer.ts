import type { Officer } from './types';

/** Proposed starting bands; tuning values, not commitments. */
export const STRESS_BANDS = {
  ready: 0,
  strained: 30,
  overloaded: 60,
  recovery: 80,
} as const;

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
  if (o.assignment?.kind === 'operation') return { ok: false, reason: `${o.surname} is already deployed` };
  return { ok: true };
}

/** Overloaded officers are restricted from high-risk actions. */
export function highRiskAllowed(o: Officer): boolean {
  return o.stress < STRESS_BANDS.overloaded;
}
