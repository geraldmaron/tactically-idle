import type { CertId, DevBranch, Officer, RatingKey, Role, SquadDuty, StageId, TraitId } from '../../sim/types';
import type { ExperienceBand } from '../../sim/calendar';
import type { StressBand } from '../../sim/officer';
import { stressBand } from '../../sim/officer';
import type { IconName } from '../icons';

/** `short` fits a quarter-width portrait card in the live strip; everything else uses `label`. */
export const ROLE_META: Record<Role, { label: string; short: string; icon: IconName }> = {
  comms: { label: 'Communication', short: 'Comms', icon: 'chat' },
  breach: { label: 'Entry', short: 'Entry', icon: 'shield' },
  medic: { label: 'Medical', short: 'Medical', icon: 'medic' },
  recon: { label: 'Observation', short: 'Recon', icon: 'binoculars' },
  lead: { label: 'Leadership', short: 'Lead', icon: 'flag' },
};

export const RATING_META: { key: RatingKey; label: string; short: string; icon: IconName }[] = [
  { key: 'shooting', label: 'Shooting proficiency', short: 'Shooting', icon: 'bullseye' },
  { key: 'composure', label: 'Composure', short: 'Composure', icon: 'pulse' },
  { key: 'communication', label: 'Communication', short: 'Communication', icon: 'chat' },
  { key: 'awareness', label: 'Awareness', short: 'Awareness', icon: 'eye' },
  { key: 'medical', label: 'Medical response', short: 'Medical', icon: 'medic' },
  { key: 'coordination', label: 'Coordination', short: 'Coordination', icon: 'nodes' },
];

export const CERT_LABEL: Record<CertId, string> = {
  crisis_negotiation: 'Crisis negotiation',
  entry_team: 'Entry team',
  advanced_first_aid: 'Advanced first aid',
  surveillance: 'Surveillance',
  drone_operator: 'Drone operator',
  less_lethal: 'Less-lethal response',
  advanced_less_lethal: 'Advanced less-lethal response',
  deescalation: 'De-escalation',
  vehicle_operations: 'Vehicle operations',
  precision_support: 'Precision support',
  controlled_access: 'Controlled access',
};

export const CERT_ICON: Record<CertId, IconName> = {
  crisis_negotiation: 'chat',
  entry_team: 'door',
  advanced_first_aid: 'medic',
  surveillance: 'binoculars',
  drone_operator: 'drone',
  less_lethal: 'shield',
  advanced_less_lethal: 'shield',
  deescalation: 'chat',
  vehicle_operations: 'box',
  precision_support: 'binoculars',
  controlled_access: 'door',
};

export const TRAIT_INFO: Record<TraitId, { label: string; condition: string; icon: IconName }> = {
  steady: { label: 'Steady', condition: 'Less strain when uncertainty escalates.', icon: 'anchor' },
  observant: { label: 'Observant', condition: 'Better at spotting inconsistent information.', icon: 'eye' },
  mentor: { label: 'Mentor', condition: 'Supports a trainee on the same task.', icon: 'mortarboard' },
  impatient: { label: 'Impatient', condition: 'Better under urgent conditions; worse during long waits.', icon: 'bolt' },
  calm_voice: { label: 'Calm voice', condition: 'Helps contact and negotiation tasks.', icon: 'soundwave' },
  rookie: { label: 'Rookie', condition: 'Less experienced; grows faster with experience.', icon: 'sprout' },
};

export const BRANCH_META: Record<DevBranch, { label: string; icon: IconName; blurb: string }> = {
  personnel: { label: 'Staff', icon: 'people', blurb: 'More officers, recruitment and training places.' },
  field: { label: 'Field skills', icon: 'compass', blurb: 'What squads can attempt on an operation.' },
  intel: { label: 'Information', icon: 'eye', blurb: 'Learn more before taking action.' },
  logistics: { label: 'Equipment support', icon: 'box', blurb: 'Saved kits, restocking and equipment access.' },
  wellbeing: { label: 'Wellbeing', icon: 'heart', blurb: 'Recovery speed and resilience.' },
};
export const BRANCHES: DevBranch[] = ['personnel', 'field', 'intel', 'logistics', 'wellbeing'];

export const DUTY_META: Record<SquadDuty, { label: string; icon: IconName; blurb: string }> = {
  patrol: { label: 'Patrol', icon: 'patrol', blurb: 'Earns routine funding. Slow recovery.' },
  standby: { label: 'Standby', icon: 'standby', blurb: 'No routine income. Moderate recovery.' },
  rest: { label: 'Rest', icon: 'moon', blurb: 'No income. Recovers fastest.' },
};
export const DUTIES: SquadDuty[] = ['patrol', 'standby', 'rest'];

export const BAND_SHORT: Record<StressBand, string> = {
  ready: 'Ready',
  strained: 'Strained',
  overloaded: 'Overloaded',
  recovery: 'Recovery',
};

/** Officer status chips: stress bands plus the non-stress states an officer can be in. */
export type StatusKey = StressBand | 'injured' | 'training' | 'deployed' | 'retiring';
export const STATUS_META: Record<StatusKey, { label: string; icon: IconName; tone: 'mint' | 'amber' | 'warn' | 'danger' | 'blue' | 'neutral' }> = {
  ready: { label: 'Ready', icon: 'checkcircle', tone: 'mint' },
  strained: { label: 'Strained', icon: 'gauge', tone: 'amber' },
  overloaded: { label: 'Overloaded', icon: 'flame', tone: 'warn' },
  recovery: { label: 'Recovery', icon: 'moon', tone: 'danger' },
  injured: { label: 'Injured', icon: 'bandage', tone: 'danger' },
  training: { label: 'Training', icon: 'mortarboard', tone: 'blue' },
  deployed: { label: 'Deployed', icon: 'pin', tone: 'amber' },
  retiring: { label: 'Retiring', icon: 'retire', tone: 'warn' },
};

export const EXPERIENCE_META: Record<ExperienceBand, { icon: IconName; tone: 'mint' | 'amber' | 'blue' | 'neutral' }> = {
  rookie: { icon: 'sprout', tone: 'neutral' },
  developing: { icon: 'trend', tone: 'blue' },
  seasoned: { icon: 'star', tone: 'amber' },
  veteran: { icon: 'medal', tone: 'mint' },
};

export const NODE_STATUS_META = {
  unlocked: { label: 'Unlocked', icon: 'check' as IconName, tone: 'mint' as const },
  available: { label: 'Available', icon: 'unlock' as IconName, tone: 'amber' as const },
  locked: { label: 'Locked', icon: 'lock' as IconName, tone: 'neutral' as const },
};

/** Item unit states, keyed by UnitView.stateLabel. */
export const UNIT_STATE_META: Record<string, { icon: IconName; tone: 'good' | 'worn' | 'bad' | 'neutral' }> = {
  Good: { icon: 'checkcircle', tone: 'good' },
  Worn: { icon: 'gauge', tone: 'worn' },
  Unreliable: { icon: 'warning', tone: 'bad' },
  Failed: { icon: 'xcircle', tone: 'bad' },
  Expired: { icon: 'wait', tone: 'bad' },
  'In service': { icon: 'wrench', tone: 'neutral' },
  Reserved: { icon: 'lock', tone: 'neutral' },
};

export const STAGE_LABEL: Record<StageId, string> = { assess: 'Assess', adapt: 'Adapt', resolve: 'Resolve' };

export const ROOM_TYPE_LABEL: Record<string, string> = {
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  hall: 'Hall',
  living: 'Living room',
  kitchen: 'Kitchen',
  storage: 'Storage',
  office: 'Office',
  retail: 'Retail floor',
  utility: 'Utility',
  stair: 'Stairs',
  porch: 'Porch',
  yard: 'Yard',
  street: 'Street',
  alley: 'Alley',
  parking: 'Parking',
};

/** Readiness 0..100 shown on bars: the inverse of stress. */
export function readiness(o: Pick<Officer, 'stress'>): number {
  return Math.max(0, Math.min(100, Math.round(100 - o.stress)));
}

export function bandOf(o: Pick<Officer, 'stress'>): StressBand {
  return stressBand(o.stress);
}

export function stressText(o: Pick<Officer, 'stress' | 'injury'>, now: number): string {
  if (o.injury && o.injury.until > now) return `Injured: ${o.injury.label}`;
  return BAND_SHORT[stressBand(o.stress)];
}

export function ratingTone(v: number): 'hi' | 'mid' | 'lo' {
  if (v >= 70) return 'hi';
  if (v >= 45) return 'mid';
  return 'lo';
}

/** Tone for a unit's condition bar, using the item's own thresholds so it matches the unit state labels. */
export function conditionTone(condition: number, wear: { failAt: number; unreliableBelow: number }): 'good' | 'worn' | 'bad' {
  if (condition < wear.unreliableBelow) return 'bad';
  const span = 100 - wear.unreliableBelow;
  return condition < wear.unreliableBelow + span * 0.5 ? 'worn' : 'good';
}

/** State label for a ready unit from its condition, matching the Gear screen's wording. */
export function unitStateOf(condition: number, wear: { failAt: number; unreliableBelow: number }): 'Good' | 'Worn' | 'Unreliable' | 'Failed' {
  if (condition <= wear.failAt) return 'Failed';
  const t = conditionTone(condition, wear);
  return t === 'bad' ? 'Unreliable' : t === 'worn' ? 'Worn' : 'Good';
}
