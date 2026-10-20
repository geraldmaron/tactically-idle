// Department reputation (reputation-odds, owner 2026-10-19). The department becomes known for how it
// works: every committed choice has a posture, from going in hard to talking first, and a running
// lean remembers the recent ones. People on scene hear about a department, so the lean nudges the
// odds of the next call, and it tilts which kinds of call the board sends. Every effect is a named
// contributor the player sees in the odds breakdown, small and capped, and silent until the
// department has a record (warmup). It reads only the player's own committed choices, never
// hidden truth, and is deterministic, so a saved game replays the same.
import type { ActionDefinition, CheckKind, IncidentType } from './scenario-types';
import type { Contributor, Department } from './types';
import { tunable } from './tuning';

export type Posture = 'force' | 'assertive' | 'patient' | 'talk';

/** Tunable (sim/tuning.ts). */
export const REPUTATION_TUNING = tunable('REPUTATION_TUNING', {
  /** How far one committed choice moves the lean: a moving average over roughly the last 1/weight
   * choices (a call is about three), so a name builds over half a dozen calls and fades as slowly. */
  weight: 1 / 20,
  /** Choices before the lean counts. A new department has no name yet. */
  warmup: 5,
  /** Score points at a full lean. The resolution span is 60, so this nudges and never decides. */
  maxPoints: 6,
  /** Below this size the lean reads as no reputation at all. */
  deadZone: 0.15,
  /** How far each posture pulls the lean: +1 force, -1 talk. */
  pull: { force: 1, assertive: 0.5, patient: -0.5, talk: -1 } as Record<Posture, number>,
  /** Board tilt at a full lean: the favoured kinds of call weigh up to 1 + board. */
  board: 0.5,
});

/** Contact and pressure checks meet the people on scene, who have heard of the department; an
 * execution check is the team's own drill. Other checks don't read reputation. */
const CHECK_SIGN: Partial<Record<CheckKind, number>> = { contact: -1, pressure: -1, execution: 0.5 };

/** Which calls a lean draws: a hard name gets the armed and barricade work, a patient one the
 * hostage and rescue work where talking is the job. */
const TYPE_SIGN: Record<IncidentType, number> = { active_armed_incident: 1, barricaded: 1, hostage_crisis: -1, protected_rescue: -1 };

/** The posture a choice reads as, from what it does. Null for choices that say nothing about how
 * the department works (moving, watching, coordinating). */
export function postureOf(action: Pick<ActionDefinition, 'authority' | 'forceProfile' | 'tempo' | 'talksTo' | 'check'>): Posture | null {
  if (action.forceProfile || action.authority?.kind === 'entry') return 'force';
  if (action.talksTo || action.check.kind === 'contact') return 'talk';
  if (action.tempo === 'urgent') return 'assertive';
  if (action.tempo === 'waiting') return 'patient';
  return null;
}

/** Fold one committed choice into the lean. */
export function recordPosture(dep: Department, posture: Posture | null): void {
  if (!posture) return;
  const r = (dep.reputation ??= { lean: 0, choices: 0 });
  const w = REPUTATION_TUNING.weight;
  r.lean = Math.max(-1, Math.min(1, r.lean * (1 - w) + REPUTATION_TUNING.pull[posture] * w));
  r.choices += 1;
}

/** The lean that counts now: zero during warmup and inside the dead zone. */
export function effectiveLean(dep: Pick<Department, 'reputation'>): number {
  const r = dep.reputation;
  if (!r || r.choices < REPUTATION_TUNING.warmup || Math.abs(r.lean) < REPUTATION_TUNING.deadZone) return 0;
  return r.lean;
}

export type ReputationBand = 'hard' | 'patient' | null;
export function reputationBand(dep: Pick<Department, 'reputation'>): ReputationBand {
  const lean = effectiveLean(dep);
  return lean > 0 ? 'hard' : lean < 0 ? 'patient' : null;
}

/** The named contributor for a check, or null when the department has no name or the check
 * doesn't meet the people on scene. */
export function reputationContributor(dep: Pick<Department, 'reputation'>, kind: CheckKind): Contributor | null {
  const lean = effectiveLean(dep);
  const sign = CHECK_SIGN[kind];
  if (!lean || !sign) return null;
  const value = Math.round(lean * sign * REPUTATION_TUNING.maxPoints * 10) / 10;
  if (value === 0) return null;
  const label = lean > 0
    ? (sign < 0 ? 'They’ve heard you break doors' : 'Your team has run many entries')
    : (sign < 0 ? 'They’ve heard you talk people out' : 'Your team rarely runs entries');
  return { label, value, source: 'reputation' };
}

/** Multiply each kind of call's draw weight by the lean's tilt. Deterministic: reads saved state. */
export function reputationWeights(dep: Pick<Department, 'reputation'>, weights: Partial<Record<IncidentType, number>>): Partial<Record<IncidentType, number>> {
  const lean = effectiveLean(dep);
  if (!lean) return weights;
  const out: Partial<Record<IncidentType, number>> = {};
  for (const [type, w] of Object.entries(weights) as [IncidentType, number][]) {
    out[type] = w * Math.max(0.25, 1 + REPUTATION_TUNING.board * lean * TYPE_SIGN[type]);
  }
  return out;
}
