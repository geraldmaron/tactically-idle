// Name tables for the Desk and Street kit (docs/visual-kit.md): screens pick an icon by what a thing
// is, not by drawing. Keys follow the sim's own ids so a lookup never needs a translation step.
import type { DevBranch, ItemCategory, RatingKey } from '../../sim/types';
import type { IncidentType } from '../../sim/scenario-types';
import type { IconName } from '../icons';

export type TabKey = 'hq' | 'calls' | 'officers' | 'build';
export const TAB_ICON: Record<TabKey, IconName> = { hq: 'hq', calls: 'calls', officers: 'officers', build: 'build' };

/** The five bottom-navigation destinations, by route id (components/nav.tsx). */
export type NavKey = 'city' | 'ops' | 'squad' | 'headquarters' | 'store';
export const NAV_ICON: Record<NavKey, IconName> = { city: 'city', ops: 'operations', squad: 'team', headquarters: 'hq', store: 'bag' };

export type ResourceKey = 'funds' | 'rate' | 'trust' | 'level' | 'menu';
export const RESOURCE_ICON: Record<ResourceKey, IconName> = { funds: 'funds', rate: 'rate', trust: 'trust', level: 'level', menu: 'menu' };

/** The six rated skills plus the two role skills (leadership, observation) a role chip names. */
export type SkillKey = RatingKey | 'leadership' | 'observation';
export const SKILL_ICON: Record<SkillKey, IconName> = {
  shooting: 'shooting',
  communication: 'communication',
  medical: 'medical',
  composure: 'composure',
  awareness: 'awareness',
  coordination: 'coordination',
  leadership: 'leadership',
  observation: 'observation',
};

/** Line icons for officer status. The filled, colour-free marks are StatusMark in marks.tsx. */
export type OfficerStatusKey = 'ready' | 'strained' | 'injured' | 'training' | 'deployed' | 'resting';
export const OFFICER_STATUS_ICON: Record<OfficerStatusKey, IconName> = {
  ready: 'ready',
  strained: 'strained',
  injured: 'injured',
  training: 'training',
  deployed: 'deployed',
  resting: 'resting',
};

export type OutcomeKey = 'favorable' | 'mixed' | 'adverse';
export const OUTCOME_ICON: Record<OutcomeKey, IconName> = { favorable: 'wentWell', mixed: 'complications', adverse: 'wentBadly' };

export const GEAR_CATEGORY_ICON: Record<ItemCategory, IconName> = {
  comms: 'walkie',
  intel: 'binoculars',
  protection: 'vest',
  access: 'ram',
  medical: 'medical',
  response: 'hardcase',
  less_lethal: 'lessLethal',
  vehicles: 'van',
  supplies: 'crate',
};

/** Where a piece of gear comes from: the basic kit every officer carries (sim/basic-kit.ts), or pooled
 * armory stock. Put basicKit beside basic kit wherever it is listed with pooled gear. */
export type GearSourceKey = 'basic' | 'pooled';
export const GEAR_SOURCE_ICON: Record<GearSourceKey, IconName> = { basic: 'basicKit', pooled: 'box' };

export const BRANCH_ICON: Record<DevBranch, IconName> = {
  personnel: 'idcard',
  field: 'route',
  intel: 'dossier',
  logistics: 'pallet',
  wellbeing: 'mug',
};

/** The four call types, keyed by incident type id. */
export const CALL_TYPE_ICON: Record<IncidentType, IconName> = {
  hostage_crisis: 'hostage',
  barricaded: 'barricade',
  active_armed_incident: 'activeArmed',
  protected_rescue: 'rescue',
};
