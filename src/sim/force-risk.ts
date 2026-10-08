import { ITEMS } from '../content/items';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { ForceOutcome, ForceRiskPreview, Id } from './types';
import type { Use } from './resolution';

/** Versioned fictional balance, not measurements of real equipment or medical risk.
 * Thresholds are cumulative. Effort success never changes this separate severity draw.
 * No demographic, hidden-fact, inventory, or story-truth inputs enter this model. */
export const FORCE_RISK_V1 = {
  firearm: { fatal: 0.22, serious: 0.48, wounded: 0.75 },
  less_lethal_device: { fatal: 0.004, serious: 0.055, wounded: 0.30 },
  less_lethal_impact: { fatal: 0.009, serious: 0.085, wounded: 0.39 },
  /** V13 drawn force only (sim/drawn-effects.ts): officers take the person by hand. Never fatal in
   * this model. 4% are seriously hurt going down, 26% hurt, 70% unhurt: a little below the
   * device's serious share, with a similar share of lesser injuries. */
  hands: { fatal: 0, serious: 0.04, wounded: 0.30 },
} as const;
export type ForceRiskProfile = keyof typeof FORCE_RISK_V1;

export function forceItemMatches(profile: ForceRiskPreview['profile'], itemId: Id): boolean {
  const item = ITEMS[itemId];
  return !!item && (profile === 'firearm'
    ? item.category === 'response' && !!item.capabilities?.some(cap => ['authorized_response', 'specialist_support'].includes(cap))
    : !!item.capabilities?.includes(profile));
}

/** Only final exact-unit uses count. Evaluation already checked ownership, condition,
 * operator qualification, public context and the complete physical supply bundle. */
export function selectedForceRisk(scenario: ScenarioDefinition, action: ActionDefinition, uses: Use[]): ForceRiskPreview | undefined {
  const profile = action.forceProfile;
  if (scenario.version < 7 || !profile) return;
  const person = Object.values(scenario.story?.bindings.people ?? {}).find(person => person.id === profile.personId);
  const unit = uses.find(use => forceItemMatches(profile.kind, use.itemId));
  if (!person || !unit) return;
  const lethalRisk = profile.kind === 'firearm' ? 'substantial' : 'low_but_present';
  return { profile: profile.kind, itemId: unit.itemId, unitId: unit.unitId, personId: person.id,
    personRole: profile.personRole, personLabel: person.label, lethalRisk,
    summary: profile.kind === 'firearm'
      ? `${ITEMS[unit.itemId].name}: substantial risk of serious injury or death to ${person.label}, even if the task succeeds.`
      : `${ITEMS[unit.itemId].name}: much lower lethal risk than firearm use, but serious injury and death remain possible even if the task succeeds.`,
  };
}

export function forceSeverity(profile: ForceRiskProfile, sample: number): ForceOutcome['severity'] {
  const risk = FORCE_RISK_V1[profile];
  return sample < risk.fatal ? 'fatal' : sample < risk.serious ? 'serious' : sample < risk.wounded ? 'wounded' : 'none';
}

export function resolveForceRisk(preview: ForceRiskPreview, sample: number): ForceOutcome {
  return { ...preview, version: 1, sample, severity: forceSeverity(preview.profile, sample) };
}

/** Protection changes a real authored officer injury, rather than merely the score.
 * It never changes the target person's risk and never makes officers immune. */
export function selectedProtection(scenario: ScenarioDefinition, action: ActionDefinition, uses: Use[]): { itemId: Id; unitId: Id } | undefined {
  if (scenario.version < 7) return;
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
