// Scenario schema for the operation engine. Owned by the operation module.
// A ScenarioDefinition is static authored content; everything that changes during
// play lives in OperationRun (types.ts). See docs/operation-model.md.
import type { CertId, Id, KnowledgeStatus, OpeningState, OutcomeBand, RatingKey, StageId, Vec } from './types';
import type { Channel } from './spatial';

export type ActionIcon =
  | 'radio'
  | 'intel'
  | 'thermal'
  | 'drone'
  | 'shield'
  | 'medic'
  | 'wait'
  | 'handover'
  | 'door'
  | 'perimeter'
  | 'search';

export type CheckKind = 'contact' | 'observation' | 'execution' | 'pressure' | 'medical' | 'coordination';

/** How an action is paced. 'waiting' actions cost an impatient officer; 'urgent' ones suit them. */
export type Tempo = 'urgent' | 'normal' | 'waiting';

/** All present keys must hold. Evaluated against the run state before a decision. */
export interface Condition {
  facts?: { factId: Id; in: KnowledgeStatus[] }[];
  flags?: string[];
  notFlags?: string[];
  pressureAtLeast?: number;
  pressureBelow?: number;
}

export interface FactDefinition {
  id: Id;
  /** Player-facing name for debrief ('Occupancy of the east bedroom'). */
  label: string;
  spaceId: Id;
  /** Whether the claim this fact makes is actually true. Engine truth; never shown early. */
  truth: boolean;
  initial: KnowledgeStatus;
  /** Unknown facts draw an amber marker only when true; a wrong-report scenario hides the real one. */
  showWhenUnknown: boolean;
  /** Short map-marker words naming the CLAIM per status ('MOVEMENT?', 'PATIENT?', 'CLEAR'), never its source. */
  markers: { unknown?: string; reported?: string; confirmed?: string; disproved?: string };
  /** Marker subtext naming the source while reported ('per neighbour'). */
  markerSource?: string;
  /** The claim as a plain sentence ('A neighbour thinks someone was moving in the kitchen.'). */
  claim: string;
  /** Who reported it ('Neighbour (unverified)', 'Caller', 'Dispatch'); null when nobody did. */
  source: string | null;
  /** Why it matters or what would settle it, shown while unresolved. */
  note: string | null;
  /** Replaces `note` once the fact is confirmed or disproved. */
  resolved?: { confirmed?: string; disproved?: string };
  /** The person or thing the claim is about, placed at exact points in the room. */
  person?: {
    label: string;
    /** True position, hidden until confirmed. Absent when the claim is false and nobody is there. */
    at?: Vec;
    /** Where the report places them (approximate marker while reported). Defaults to the room centroid. */
    reportedAt?: Vec;
  };
  /** Longer briefing sentence while reported. */
  reportedText?: string;
  /** What is unresolved while unknown/reported, in player language. */
  uncertainty: string;
}

export interface ObjectiveDefinition {
  id: Id;
  label: string;
}

export interface PressureModel {
  /** Starting situation pressure, 0..100. */
  start: number;
  /** Pressure gained per operation minute. */
  perMinute: number;
  /** Above this, civilian safety falls with elapsed time. */
  threshold: number;
  /** Civilian safety lost per operation minute spent above the threshold. */
  civilianPerMinute: number;
}

export interface RatingWeight {
  key: RatingKey;
  weight: number;
}

export interface ActionRequirements {
  /** Every cert must be held by an officer in the acting squads who can take part. */
  certs?: CertId[];
  /** At least one acting squad must carry an item with any of these tags. */
  anyTags?: string[];
  /** Every tag must be carried by some acting squad. */
  allTags?: string[];
  /** Total squads taking part (acting + support). */
  minSquads?: { count: number; reason: string };
  facts?: { factId: Id; in: KnowledgeStatus[]; reason: string }[];
  flags?: { flag: string; reason: string }[];
  notFlags?: { flag: string; reason: string }[];
  /** Opening states matter: blocked refuses; locked needs the tool or costs time. */
  openings?: { openingId: Id; blockedReason: string; lockedTag?: string; lockedNote: string }[];
}

export interface EquipmentEffect {
  tag: string;
  /** Score points when a squad carries it. */
  value: number;
  /** Replaces `value` when the limiting space holds one participant (narrow). */
  narrowValue?: number;
  /** Items in the same group are alternatives; only the best applies. */
  group?: string;
  label: string;
  /**
   * Range rule from ITEMS[tag].range. 'target': straight-line distance from the squad's
   * standing point to the subject. 'opening': a usable opening of the target space must lie
   * within range.max of the standing point. Within effective = full, between = linear
   * falloff, beyond max = unusable with a specific reason.
   */
  range?: 'target' | 'opening';
}

/** A signal the acting squad's standing point sends to the subject (voice, sight, heat). */
export interface SpatialSpec {
  channel: Channel;
  /** Fact whose person position is the signal's target; otherwise the target room's centre. */
  subjectFactId?: Id;
  /** Score points at a fully clear signal; scaled by transmission. */
  weight: number;
  /** Player-language noun: 'Voice', 'Sightline', 'Heat'. */
  noun: string;
  /** Restrict standing points to this opening's staging points. */
  openingId?: Id;
}

export interface ActionModifier {
  label: string;
  when: Condition;
  /** 'difficulty' raises difficulty by `value`; every other source adds `value` to the score. */
  source: 'preparation' | 'familiarity' | 'difficulty';
  value: number;
}

export interface SupportRule {
  /** Best-case support in score points. */
  max: number;
  /** The space the supporting squad covers or reaches; distance from its position matters. */
  coverSpaceId: Id;
  /** Minutes of travel at which support contribution reaches zero. */
  reachMinutes: number;
  maxSquads: number;
  /** Player-facing role, e.g. 'covering the back door'. */
  label: string;
  task: string;
  /** Opening whose staging point the supporting squad holds in `coverSpaceId`. */
  openingId?: Id;
}

export interface OutcomeEffect {
  when?: Condition;
  knowledge?: { factId: Id; status: KnowledgeStatus }[];
  setFlags?: string[];
  clearFlags?: string[];
  /** Deltas are added; objective, civilian clamp to 0..100. */
  objective?: number;
  civilian?: number;
  pressure?: number;
  extraMinutes?: number;
  openings?: { openingId: Id; state: OpeningState }[];
  stage?: StageId;
  ending?: Id;
  /** Cause sentence (past tense) used in the explanation and debrief. */
  text?: string;
}

export type OutcomeTable = Record<OutcomeBand, OutcomeEffect[]>;

export interface ActionDefinition {
  id: Id;
  stage: StageId;
  title: string;
  icon: ActionIcon;
  /** Eligible-state button line. '{lead}' becomes the lead officer's surname. */
  summary: string;
  targetId: Id;
  /** Map label for acting squads after the action ('Contact', 'Watch'). */
  task: string;
  requires: ActionRequirements;
  check: { kind: CheckKind; ratings: RatingWeight[]; difficulty: number };
  tempo?: Tempo;
  /** Time: base + perSqFt * area of the spaces (default the target) + travel. */
  workload: { base: number; perSqFt: number; areaSpaces?: Id[] };
  /**
   * 'path' travels to the target through the building; 'window' travels to the
   * nearest exterior zone with an opening onto the target; 'none' is remote.
   */
  approach: 'path' | 'window' | 'none';
  /** Spatial signal toward the subject. approach 'none' acts from the squad's current staging point. */
  spatial?: SpatialSpec;
  /** Entry-type: distance from the subject to the nearest door of its room adds time and exposure. */
  entry?: { subjectFactId?: Id };
  /** Useful participants are limited by the smallest listed space's capacity. */
  capacityBound?: Id[];
  maxParticipants?: number;
  /** Acting squads allowed (default 1). */
  maxActing?: number;
  /** Extra score per additional distinct vantage covered by acting squads. */
  coveragePerVantage?: number;
  stressBase: number;
  consumes?: { tag: string; qty: number }[];
  equipment?: EquipmentEffect[];
  /** A cert that adds a flat training bonus when a participant holds it. */
  certBonus?: { cert: CertId; value: number; label: string };
  modifiers?: ActionModifier[];
  support?: SupportRule;
  outcomes: OutcomeTable;
}

export interface StageDefinition {
  id: StageId;
  label: string;
  /** One-line situation prompt for the stage. */
  prompt: string;
  actions: ActionDefinition[];
}

export interface EndingDefinition {
  id: Id;
  title: string;
  summary: string;
  /** Added to the trust delta (restraint earns trust, needless force costs it). */
  trustAdjust: number;
  /** Added to every deployed officer's strain at debrief (negative = relief). */
  strain: number;
}

export interface ScenarioRewards {
  funding: number;
  devPoints: number;
  /** Maximum trust change; the actual change runs from -trust to +trust. */
  trust: number;
  xp: number;
}

export interface ScenarioDefinition {
  id: Id;
  version: number;
  /** e.g. 'OP 0141' */
  code: string;
  title: string;
  setting: 'residential' | 'business' | 'apartment';
  locationFamilyId: Id;
  locationSeed: number;
  summary: string;
  /** e.g. 'Uncertain occupancy' */
  variantLabel: string;
  /** e.g. 'Low time pressure' */
  pressureLabel: string;
  squadRange: { min: number; max: number };
  briefing: { known: string[]; unknown: string[] };
  facts: FactDefinition[];
  objectives: ObjectiveDefinition[];
  pressure: PressureModel;
  stages: Record<StageId, StageDefinition>;
  endings: Record<Id, EndingDefinition>;
  rewards: ScenarioRewards;
  /** Generated incidents only: the seed tuple that regenerates this scenario exactly. */
  incident?: IncidentSpec;
  /** Everyone present (subjects, civilians, animals) with true positions and attributes. */
  people?: PersonDefinition[];
  environment?: EnvironmentDefinition;
  /** Expected difficulty, shown as a band with its top drivers (conditional on known info). */
  difficulty?: { score: number; band: 'low' | 'moderate' | 'high' | 'severe'; drivers: string[] };
}

export function scenarioActions(s: ScenarioDefinition): ActionDefinition[] {
  return [...s.stages.assess.actions, ...s.stages.adapt.actions, ...s.stages.resolve.actions];
}

// ---------------------------------------------------------------- phase 3: generated incidents
// See docs/phase3-generation.md. Distributions live in src/gen/incident/tables.ts.

export type IncidentType =
  | 'welfare_check'
  | 'domestic'
  | 'person_in_crisis'
  | 'barricaded'
  | 'burglary'
  | 'business_robbery'
  | 'holding'
  | 'medical_complication'
  | 'disturbance'
  | 'missing_vulnerable'
  | 'false_intruder'
  | 'vacant_occupancy';

/** Deterministic seed tuple for a generated incident. */
export interface IncidentSpec {
  type: IncidentType;
  familyId: Id;
  buildingSeed: number;
  seed: number;
  /** 1..5 */
  tier: number;
  contentVersion: number;
}

export type Armament = 'none' | 'blunt' | 'edged' | 'handgun' | 'long_gun' | 'unknown';
export type Readiness = 'concealed' | 'carried' | 'brandished';
export type Disposition = 'cooperative' | 'distressed' | 'intoxicated' | 'agitated' | 'hostile' | 'in_crisis';
export type Intent = 'unaware' | 'escape' | 'barricade' | 'harm_self' | 'harm_others';
export type PoliceAwareness = 'unaware' | 'suspicious' | 'aware';

export type PersonRole =
  | 'subject'
  | 'resident'
  | 'child'
  | 'elderly'
  | 'staff'
  | 'customer'
  | 'held_person'
  | 'patient'
  | 'dog'
  | 'dangerous_dog';

export interface ThreatProfile {
  armament: Armament;
  readiness: Readiness;
  disposition: Disposition;
  intent: Intent;
  awareness: PoliceAwareness;
}

export interface PersonDefinition {
  id: Id;
  role: PersonRole;
  /** Player-facing label once known ('Resident', 'Second subject', 'Dog'). */
  label: string;
  /** True starting position. */
  spaceId: Id;
  at: Vec;
  threat?: ThreatProfile;
  mobility: 'normal' | 'limited' | 'immobile';
  /** Engine-driven movement between stages (truth only). Positions must be valid points in existing spaces. */
  moves?: Partial<Record<StageId, { spaceId: Id; at: Vec; reason: string }>>;
  /** Facts that describe this person (presence, location, armament, condition). */
  factIds: Id[];
}

export interface EnvironmentDefinition {
  timeOfDay: 'day' | 'dusk' | 'night';
  weather: 'clear' | 'rain' | 'wind' | 'fog' | 'snow';
  power: 'on' | 'off';
  /** 0..1: reduces usable space and movement speed. */
  clutter: number;
  hazards: ('gas' | 'fire_risk' | 'structural' | 'biohazard')[];
  /** Contact quality: language barrier or hearing impairment of the key person. */
  communication: 'normal' | 'language_barrier' | 'hearing_impaired';
  /** Bystanders outside: 0 none, 1 some, 2 crowd. */
  crowd: 0 | 1 | 2;
  keyholder: boolean;
  plansOnFile: boolean;
  alarm: 'none' | 'armed' | 'triggered';
  cctv: boolean;
}
