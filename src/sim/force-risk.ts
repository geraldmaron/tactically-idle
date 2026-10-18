import { ITEMS } from '../content/items';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { ForceOutcome, GameState, Id, ItemUnit } from './types';
import { projectedCondition, type Upkeep } from './equipment';
import type { Use } from './resolution';
import { tunable } from './tuning';

type ForceThresholds = { fatal: number; serious: number; wounded: number };
const FORCE_RISK_DEFAULTS = {
  firearm: { fatal: 0.22, serious: 0.48, wounded: 0.75 },
  less_lethal_device: { fatal: 0.004, serious: 0.055, wounded: 0.30 },
  less_lethal_impact: { fatal: 0.009, serious: 0.085, wounded: 0.39 },
  /** V13 drawn force only (sim/drawn-effects.ts): officers take the person by hand. Never fatal in
   * this model. 4% are seriously hurt going down, 26% hurt, 70% unhurt: a little below the
   * device's serious share, with a similar share of lesser injuries. */
  hands: { fatal: 0, serious: 0.04, wounded: 0.30 },
} satisfies Record<string, ForceThresholds>;
/** Which profiles can kill is structure, not balance: drawnKeys asks a team_force effect for a
 * `<profile>:fatal` variant exactly when `fatal > 0`, and the compiler never writes `hands:fatal`. */
const CAN_KILL = Object.fromEntries(Object.entries(FORCE_RISK_DEFAULTS).map(([profile, risk]) => [profile, risk.fatal > 0]));

/** Versioned fictional balance, not measurements of real equipment or medical risk.
 * Thresholds are cumulative. Effort success never changes this separate severity draw.
 * No demographic, hidden-fact, inventory, or story-truth inputs enter this model.
 * Tunable (sim/tuning.ts); the guard keeps each profile's thresholds in order and keeps a profile
 * that can't kill from killing, and one that can from never killing. */
export const FORCE_RISK_V1 = tunable('FORCE_RISK_V1', FORCE_RISK_DEFAULTS, { guard: forceRiskProblem });
export type ForceRiskProfile = keyof typeof FORCE_RISK_V1;

/** Why a candidate force table can't be used, or null. */
export function forceRiskProblem(next: Record<string, ForceThresholds>): string | null {
  for (const [profile, risk] of Object.entries(next)) {
    if (CAN_KILL[profile] !== undefined && (risk.fatal > 0) !== CAN_KILL[profile])
      return CAN_KILL[profile] ? `${profile}.fatal must stay above 0: the call trees carry a fatal result for it.` : `${profile}.fatal must stay 0: the call trees have no fatal result for it.`;
    if (!(risk.fatal >= 0 && risk.fatal < risk.serious && risk.serious < risk.wounded && risk.wounded <= 1))
      return `${profile} needs 0 ≤ fatal < serious < wounded ≤ 1.`;
  }
  return null;
}

/** One uniform sample in [0, 1) settles a draw by cumulative cut points, rarest result first: it
 * lands on the first result whose cut it falls below, else on `rest`. The samplers (forceSeverity,
 * incomingFireSeverity in sim/drawn-effects.ts) and the odds the Scenario Lab shows
 * (forceDistribution, incomingFireDistribution) read the same cuts, so they can't disagree. */
export interface SampleCuts<K extends string> { cuts: readonly (readonly [K, number])[]; rest: K }

/** The result a sample lands on. */
export function cutFor<K extends string>(draw: SampleCuts<K>, sample: number): K {
  for (const [key, at] of draw.cuts) if (sample < at) return key;
  return draw.rest;
}

/** The chance of each result for a uniform sample, for every result the cuts name. A cut below an
 * earlier one takes nothing. */
export function cutShares<K extends string>(draw: SampleCuts<K>): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  let below = 0;
  for (const [key, at] of draw.cuts) {
    const top = Math.min(1, Math.max(below, at));
    out[key] = (out[key] ?? 0) + top - below;
    below = top;
  }
  out[draw.rest] = (out[draw.rest] ?? 0) + 1 - below;
  return out;
}

/** The cuts for one use of force. With `noFatal` (a person the card may never show dying) a sample
 * that would kill seriously hurts instead. */
export function forceCuts(profile: ForceRiskProfile, noFatal = false): SampleCuts<ForceOutcome['severity']> {
  const risk = FORCE_RISK_V1[profile];
  return noFatal
    ? { cuts: [['serious', Math.max(risk.fatal, risk.serious)], ['wounded', risk.wounded]], rest: 'none' }
    : { cuts: [['fatal', risk.fatal], ['serious', risk.serious], ['wounded', risk.wounded]], rest: 'none' };
}

export function forceItemMatches(profile: ForceRiskProfile, itemId: Id): boolean {
  const item = ITEMS[itemId];
  return profile !== 'hands' && !!item && (profile === 'firearm'
    ? item.category === 'response' && !!item.capabilities?.some(cap => ['authorized_response', 'specialist_support'].includes(cap))
    : !!item.capabilities?.includes(profile));
}

/** A force tool needs a serviceable carried unit and a qualified acting participant.
 * Callers supply only the acting squads' units and the action's actual participants. */
export function qualifiedForceUnit(state: GameState, profile: ForceRiskProfile, units: readonly ItemUnit[], participantIds: readonly Id[], upkeep: Upkeep): ItemUnit | undefined {
  const now = state.department.clockHighWater;
  return units.find(unit => {
    const item = ITEMS[unit.itemId];
    return forceItemMatches(profile, unit.itemId)
      && (unit.status === 'ready' || unit.status === 'reserved')
      && (unit.expiresAt === null || unit.expiresAt > now)
      && projectedCondition(state, unit, now, upkeep) > item.wear.failAt
      && participantIds.some(id => !!state.officers[id] && (item.requiresCerts ?? []).every(cert => state.officers[id].certs.includes(cert)));
  });
}

export function forceSeverity(profile: ForceRiskProfile, sample: number): ForceOutcome['severity'] {
  return cutFor(forceCuts(profile), sample);
}

/** Protection changes a real authored officer injury, rather than merely the score.
 * It never changes the target person's risk and never makes officers immune. */
export function selectedProtection(_scenario: ScenarioDefinition, action: ActionDefinition, uses: Use[]): { itemId: Id; unitId: Id } | undefined {

  const allowed = action.capabilities?.rules.some(cap => cap === 'authorized_response' || cap === 'medical_exposure')
    || action.equipment?.some(effect => effect.tag === 'shield');
  if (!allowed) return;
  const unit = uses.find(use => ITEMS[use.itemId]?.category === 'protection');
  return unit ? { itemId: unit.itemId, unitId: unit.unitId } : undefined;
}

export function protectedOfficerEffects(effects: OutcomeEffect[], protection?: { itemId: Id; unitId: Id }): OutcomeEffect[] {
  return protection ? effects.map(effect => effect.officerHarm?.severity === 'serious'
    ? { ...effect, officerHarm: { ...effect.officerHarm, severity: 'wounded' } } : effect) : effects;
}

export function validForceOutcome(value: unknown): value is ForceOutcome {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const outcome = value as ForceOutcome;
  return outcome.version === 1 && Object.hasOwn(FORCE_RISK_V1, outcome.profile)
    && typeof outcome.sample === 'number' && Number.isFinite(outcome.sample) && outcome.sample >= 0 && outcome.sample < 1
    && outcome.severity === forceSeverity(outcome.profile, outcome.sample)
    && forceItemMatches(outcome.profile, outcome.itemId)
    && [outcome.itemId, outcome.unitId, outcome.personId, outcome.personLabel, outcome.summary].every(text => typeof text === 'string' && text.trim().length > 0)
    && ['subject', 'civilian'].includes(outcome.personRole)
    && outcome.lethalRisk === (outcome.profile === 'firearm' ? 'substantial' : 'low_but_present');
}

/** The chance of each severity forceSeverity gives for this profile; with `noFatal`, the chance of
 * each severity a person who is never killed gets (teamForceSeverity), fatal always 0. */
export function forceDistribution(profile: ForceRiskProfile, noFatal = false): Record<'fatal' | 'serious' | 'wounded' | 'none', number> {
  return { fatal: 0, serious: 0, wounded: 0, none: 0, ...cutShares(forceCuts(profile, noFatal)) };
}
