// Scenario schema for the operation engine. Owned by the operation module.
// A ScenarioDefinition is static authored content; everything that changes during
// play lives in OperationRun (types.ts). See docs/operation-model.md.
import type { CapabilityId, CertId, CompletionDisposition, Id, KnowledgeStatus, OpeningState, OutcomeBand, RatingKey, RiskBand, StageId, Vec } from './types';
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
  /** V5 subject facts follow only the person’s publicly observed location. */
  storyPersonId?: Id;
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
  /** V7 conversations can involve people other than the physical action target. */
  responsivePeople?: Id[];
  /** Story props bind to existing map objects or an explicit person's carried item. */
  storyProps?: { propId: Id; holderPersonId?: Id; reason: string }[];
  /** 'requested' includes a service that has arrived, but excludes an accepted handover. */
  externalSupport?: { serviceId: Id; status: 'requested' | 'available' | 'accepted'; reason: string }[];
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
  /**
   * Environment aids the action depends on (engine checks `scenario.environment`):
   * 'cctv' needs cameras that work (environment.cctv and power on); 'keyholder' needs a keyholder.
   */
  env?: ('cctv' | 'keyholder')[];
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
  /** Fictional person-level injury; selected from actual participants, without an extra random draw. */
  officerHarm?: { severity: 'wounded' | 'serious'; label: string };
  /** V13: an authored injury or death of a bound person (civilian or subject), recorded like a
   * force outcome so the debrief and safety score carry it. Content puts it only on outcomes that
   * end the call, because the engine then refuses ordinary choices involving that person. */
  personHarm?: { personId: Id; severity: 'wounded' | 'serious' | 'fatal' }[];
  /** V13: a consequence the engine draws when the decision commits (sim/drawn-effects.ts): who is
   * hit when a subject fires at the team, or what the team's force does to a person. The chosen
   * variant's effects apply as if authored; saves accept anything a variant can produce. */
  drawn?: DrawnModel;
  /** The effects for each result `drawn` can give, keyed as the model names them. */
  variants?: Record<string, OutcomeEffect[]>;
  /** V13: engine-only branches on a clock (sim/clocks.ts), read when the decision commits, at the
   * end of this choice's own minutes. A clock this call doesn't have never runs low or out. */
  clocks?: ClockCondition[];
  /** V13: engine-only branches on a subject's meters as they stand at the start of the decision
   * (sim/meters.ts): escalation the hidden truth didn't call for, from someone past breaking point. */
  meters?: MeterCondition[];
  /** V13: what this outcome does to a subject's agitation and rapport (sim/meters.ts). */
  moves?: { personId: Id; event: MeterEvent }[];
  /** V13: command commits to something a subject asked for (sim/commitments.ts). Kept or broken
   * by what the team does to that person afterwards; breaking one costs rapport and trust. */
  promise?: { id: Id; personId: Id; kind: ConcessionKind | 'promise' };
  officerCare?: 'stabilize' | 'evacuate';
  requestSupport?: Id[];
  acceptSupport?: Id[];
  /** Engine-only branches, evaluated only when a decision commits. Never preview these texts. */
  truth?: { factId: Id; is: boolean }[];
  /** Settle a claim against scenario truth at commit, without exposing truth during evaluation. */
  reveal?: Id[];
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
  /** V5: change the actual exit doorway of this decision's bound route, only after the person moves. */
  storyExitState?: OpeningState;
  stage?: StageId;
  ending?: Id;
  /** Cause sentence (past tense) used in the explanation and debrief. */
  text?: string;
}

export type OutcomeTable = Record<OutcomeBand, OutcomeEffect[]>;

export interface ActionCapabilities {
  rules: CapabilityId[];
  required?: CapabilityId[];
  openingId?: Id;
  safetyFactIds?: Id[];
  subjectFactIds?: Id[];
  responseContext?: 'open' | 'constrained';
  accessMethod?: 'mechanical' | 'charge';
  vehicleAccessible?: boolean;
  deescalation?: boolean;
}

export interface ActionDefinition {
  /** V7: an actual, explicit force use. Carried equipment never opts an action in. */
  forceProfile?: { kind: 'firearm' | 'less_lethal_device' | 'less_lethal_impact'; personId: Id; personRole: 'subject' | 'civilian'; officerExposure?: boolean };
  /** V7: field care or a medical receiver accepting an already injured person. */
  personCare?: { personId: Id; kind: 'stabilize' | 'accept'; serviceId?: Id };
  /** Optional bound person target; current public position drives spatial evaluation. */
  storyTargetPersonId?: Id;
  /** V13: the person a conversation is with, when it is with someone (sim/meters.ts). */
  talksTo?: Id;
  /** V13: what this choice asks command for (sim/authorization.ts). Unauthorized, it is locked
   * with the generated reason; authorized, the card carries the generated command line. */
  authority?: AuthorityRequest;
  /** Full archetype route rechecked against current openings at action evaluation. */
  storyRoute?: string;
  /** Person routes use bound endpoints; squad routes start at each squad's actual current position. */
  storyRouteActor?: 'person' | 'squad' | 'external_support' | 'inspection';
  /** V7: inspect this person's planned observed arrival, without moving them. */
  storyRouteInspection?: { personId: Id; arrivalFlag: string };
  /** V4 dispatch/care administration can remain possible when every deployed officer is hurt. */
  commandOnly?: boolean;
  /** Wait exactly the remaining response time of a bounded, authored service. */
  awaitSupport?: Id;
  /** Public-state visibility; hidden truth must never participate. */
  visibleWhen?: Condition;
  /** Authored public possibilities. These describe uncertainty rather than reveal the sampled truth. */
  outcomePreview?: Record<OutcomeBand, string>;
  /** Explicit event labels for v5 steps whose narrative result differs from the effort check. */
  resultLabels?: Record<OutcomeBand, string>;
  /** Severity of the possible consequences, independent of success probability. */
  consequenceLevel?: RiskBand;
  /** Opt-in fictional contextual equipment rules. Legacy actions remain unchanged. */
  capabilities?: ActionCapabilities;
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
  /** A long hold's span ('Hours', 'All night'), shown in place of estimated minutes. The clock
   * still advances by minutes, so pressure and civilian safety stay fair to the wait (v13). */
  timeLabel?: string;
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
  /** Acting squads allowed (1..4, default 1). */
  maxActing?: number;
  /**
   * Spaces this action lets the squad see into. A favourable result updates what the player last
   * saw there (and settles location/armament facts of the people actually present). Default:
   * [targetId] when the action has an approach other than 'none' or a spatial signal; pass [] for none.
   * A remote camera action uses approach 'none' with explicit `observes`.
   */
  observes?: Id[];
  /** Locked doors on the route open with the keyholder: no force time. Needs environment.keyholder. */
  keyholder?: boolean;
  /**
   * Perimeter / coverage action: each acting squad claims a DIFFERENT exterior side (a zone with a
   * way into the building). Squads beyond the number of sides add nothing. Use with approach 'window'
   * and coveragePerVantage; a spatial signal is optional.
   */
  perimeter?: boolean;
  /** Why a rushed (execution + urgent) entry or an upstairs approach is justified under a hazard ('Someone is down inside'). */
  hazardReason?: string;
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
  /** V5 story dilemmas in priority order, based only on public committed state. */
  contextPrompts?: { when: Condition; prompt: string }[];
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
  disposition?: CompletionDisposition;
  /** V4 completion is earned by these authored conditions, never by a numeric score alone. */
  completion?: Condition & { acceptedServiceId?: Id };
  /** Public unfinished responsibilities, saved with incomplete debriefs. */
  remainingTasks?: string[];
}

export interface ExternalServiceDefinition {
  id: Id;
  label: string;
  kind: string;
  description: string;
  /** Public, fixed for this seeded incident; begins when the request is committed. */
  arrivalMinutes: number;
  available: boolean;
  /** Public care/safety conditions that must already hold before responsibility is accepted. */
  acceptWhen?: Condition;
}

export interface ScenarioRewards {
  funding: number;
  devPoints: number;
  /** Maximum trust change; the actual change runs from -trust to +trust. */
  trust: number;
  xp: number;
}

/** What a drawn effect asks the engine to settle: incoming fire from a subject, the team's force on
 * a person, or whether a group follows its leader (`on`) when the leader gives up. A cascade takes
 * one saved sample; each member's draw comes from a stream it seeds (sim/drawn-effects.ts). */
export type DrawnModel = { model: 'incoming_fire'; from: Id } | { model: 'team_force'; on: Id } | { model: 'cascade'; on: Id; members: Id[] };

/** A v13 clock (docs/incident-domain-model.md §3, sim/clocks.ts): something that runs down on the
 * operation's minutes, at a rate the situation sets. */
export interface ClockDef {
  id: Id;
  /** Bound plain label ("Ana’s spare tank"). */
  label: string;
  kind: 'medical' | 'structural' | 'battery' | 'supply' | 'deadline' | 'light' | 'crowd' | 'intoxication';
  /** The person whose clock it is: it stops once they are out of the building. */
  owner?: Id;
  /** 0 to 100 at the start of the call. */
  start: number;
  ratePerMin: number;
  /** The team can know how fast it runs before it shows (a gauge, a battery percentage). */
  rateKnown: boolean;
  /** Highest first. Each fires once as the clock passes it: a line the team hears, and optionally a
   * mark (public state) and the settling of the fact this clock stands for. */
  cues: { at: number; text: string; mark?: string; reveal?: boolean }[];
  /** The fact whose claim this clock answers ("will the door hold"). */
  factId?: Id;
  /** Once this clock is low, command won't wait for talking to work: it completes "Command
   * approves it because …" ("{owner.first} can’t wait any longer"), bound. */
  urgent?: string;
  /** What running out does where no fork reads it (sim/clocks.ts clockOutEffects): when it runs out
   * during a decision and the owner is still inside after that decision's own outcome, the engine
   * records `harm` to the owner (unless the outcome already hurt them) and sets `mark`, so the
   * record and the prompts that read the mark agree. */
  onOut?: { harm?: 'wounded' | 'serious'; mark?: string };
}
export interface ClockCondition { clockId: Id; state: 'low' | 'out'; is: boolean }
/** How a subject sounds to the team (sim/meters.ts stanceOf). 'unheard' until the first event. */
export type MeterStance = 'unheard' | 'calm' | 'tense' | 'volatile' | 'breaking' | 'yielding';
/** A branch on a subject's meters at the start of a decision (sim/meters.ts meterConditionsHold):
 * the stance is one of `stance` and the agitation is at least `agitationAtLeast` (each when given).
 * `is: false` negates the test. Someone with no meters never matches, so `is: false` holds for them. */
export interface MeterCondition { personId: Id; stance?: MeterStance[]; agitationAtLeast?: number; is: boolean }

/** V13 authorization (docs/incident-domain-model.md §7, sim/authorization.ts). What command can
 * give a subject. The first group is allowed; the second never is. */
export type ConcessionKind = 'food' | 'water' | 'phone' | 'statement' | 'message' | 'third_party' | 'surrender_terms'
  | 'weapon' | 'transport' | 'officer_swap' | 'family';
export const CONCESSIONS_ALLOWED: readonly ConcessionKind[] = ['food', 'water', 'phone', 'statement', 'message', 'third_party', 'surrender_terms'];
/** What a choice asks command for. Entry: the team goes in. Concession: the team gives a subject
 * something (and every concession is a commitment, D5). Deadly force is not a choice: it is ruled
 * at the moment a drawn force outcome commits (sim/drawn-effects.ts). */
export type AuthorityRequest = { kind: 'entry' } | { kind: 'concession'; item: ConcessionKind };
/** The rule that fired and the command line it generates ("Command approves it because …"), bound
 * for this call. `allowed: false` locks the choice with `reason`. */
export interface AuthorityResult { allowed: boolean; rule: string; reason: string }
/** What counts as a threat to life the team has seen: a fact the team believes (reported or
 * confirmed), or a mark. `because` completes "Command approves it because …", bound. */
export interface ThreatEvidence { factId?: Id; flag?: string; because: string }

/** Standard events that move a subject's meters (sim/meters.ts). */
export type MeterEvent = 'heard' | 'contact' | 'honest' | 'provoked' | 'team_seen' | 'shots' | 'released' | 'promise_kept' | 'promise_broken';
export interface SubjectMeters { agitation: number; rapport: number }

/** One person of a v13 incident instance (gen/incident/instance.ts), compiled for the engine. Who
 * they are (pronouns, names) is never here: no mechanic reads identity. */
export interface IncidentPersonDef {
  /** The story-bound person id (the tree role). */
  id: Id;
  kind: 'subject' | 'hostage' | 'victim' | 'trapped' | 'bystander' | 'reporting_party' | 'animal';
  /** Bound plain label for contributor lines ("Ana Ruiz"). */
  label: string;
  minor: boolean;
  spaceId: Id;
  at: Vec;
  threat?: ThreatProfile;
  /** Facts whose status is what the team knows of this person's weapon and temper. Unknown until
   * the fact is reported or confirmed; the odds use what the team knows. */
  armamentFactId?: Id;
  dispositionFactId?: Id;
  /** Furniture between this person and the door the team comes through (spatial-factors.ts). */
  cover?: { objectId: Id; label: string; grade: 'hard' | 'concealment' };
  /** Truth, read only when a drawn effect resolves (incoming fire, team force). */
  weapon?: { kind: 'handgun' | 'long_gun' | 'shotgun' | 'edged' | 'blunt' | 'improvised' | 'unknown'; real: 'real' | 'replica' | 'unknown' };
  proficiency?: 'untrained' | 'some' | 'trained';
  /** Feet from this person to the door the team comes through. */
  doorFt?: number;
  /** Never killed on the card: a minor, or a subject the self-harm screen covers (E4.5). */
  noFatal?: boolean;
  /** A subject's agitation and rapport at the start of the call, and how far events move them. */
  meters?: SubjectMeters;
  volatility?: 'steady' | 'shifting' | 'volatile';
  /** Someone in a group (a counted template slot): which group (the slot), their role in it, and
   * how strongly the leader holds them, 0 to 1 (the leader carries 1). Read when the leader gives
   * up (sim/drawn-effects.ts CASCADE_V1). */
  group?: { id: Id; role: 'leader' | 'follower' | 'lookout' | 'lone'; influence: number };
  /** A held person: who holds them, and why (§1). Instrumental: leverage for a demand. Expressive:
   * the holder's grievance is with them. Incidental: they were there when it started. */
  hold?: { by: Id; kind: 'instrumental' | 'expressive' | 'incidental' };
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
  briefing: { known: string[]; unknown: string[]; dispatchReason?: string; teamResponsibilities?: string[] };
  /** V5 archetype bindings share the generated world with narrative, actions and map views. */
  story?: StoryInstance;
  /** v13: the incident instance's people as the engine reads them (sim/incident-factors.ts). */
  incidentPeople?: IncidentPersonDef[];
  /** V13: what runs down on the operation's minutes in this call (sim/clocks.ts). */
  clocks?: ClockDef[];
  /** V13: what counts as a seen threat to life in this call (sim/authorization.ts). */
  threats?: ThreatEvidence[];
  externalServices?: ExternalServiceDefinition[];
  civilianOutcomes?: { id: Id; label: string; factId: Id; safeFlag: string; injuredFlag: string; careFlag: string }[];
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
  difficulty?: DifficultyInfo;
}

export interface StoryAnchor { spaceId: Id; at: Vec }
export interface StoryPersonBinding {
  id: Id;
  label: string;
  locationFactId: Id;
  initial: StoryAnchor;
  reported?: StoryAnchor;
  /** Public role, never inferred from a name, culture or hidden character data. */
  publicKind?: 'person' | 'subject' | 'civilian' | 'patient';
  transitions: { when: Condition; to: StoryAnchor | { kind: 'offscene'; label: string }; observed: boolean; label?: string }[];
}
export interface StoryPropBinding {
  id: Id;
  label: string;
  kind: 'carried' | 'mapped';
  holderPersonId?: Id;
  /** Holder named by the report, independent of the actual hidden holder. */
  reportedHolderPersonId?: Id;
  objectId?: Id;
  /** Conditions refer only to committed observations, not hidden truth. */
  knownWhen?: Condition;
  confirmedWhen?: Condition;
  glyph?: 'phone' | 'document' | 'keys' | 'wheelchair' | 'weapon' | 'tool' | 'item';
  transitions?: { when: Condition; holderPersonId?: Id; observed?: boolean }[];
}
export interface StoryInstance {
  /** V9 catalog recipe and public, mechanically supported characteristics. */
  recipeId?: string;
  characteristics?: { id: string; personId?: Id; label: string; source: string }[];
  /** V9 cast recipe output. Cosmetic only; never a source of gameplay modifiers. */
  cast?: Record<string, { firstName: string; surname: string; pronouns: 'she' | 'he' | 'they' }>;
  /** V6 coherent situation selected before presentation; all module effects share these bindings. */
  episode?: { variantId: string; modules: string[]; publicContext: string[] };
  archetypeId: string;
  version: number;
  episodeId: string;
  seed: number;
  bindings: {
    rooms: Record<string, { spaceId: Id }>;
    exterior: Record<string, { spaceId: Id }>;
    routes: Record<string, { fromSpaceId: Id; toSpaceId: Id; openingIds: Id[]; profile: 'walking' | 'chair' }>;
    people: Record<string, StoryPersonBinding>;
    props: Record<string, StoryPropBinding>;
  };
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
  | 'vacant_occupancy'
  | 'active_armed_incident'
  | 'hostage_crisis'
  | 'protected_rescue'
  // Content v11 drop: ordinary calls compiled from typed framework data.
  | 'fall_at_home'
  | 'water_leak'
  | 'lost_child';

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
  /**
   * Facts that describe this person. The engine reads the kind from the fact id prefix:
   * 'loc:' (where they are / whether they are present), 'arm:' (armament and readiness),
   * 'cond:' (disposition, intent, awareness). See FACT_PREFIX.
   */
  factIds: Id[];
  /**
   * What the player is told while the matching fact is only 'reported' (may differ from `threat`:
   * 'reported unarmed' for a person who has a long gun). Missing fields are unknown, not assumed.
   */
  reported?: Partial<ThreatProfile>;
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

// ---------------------------------------------------------------- engine conventions (operation module)
// Everything below is additive to the phase-3 types. The incident generator relies on these
// names; see docs in src/sim/threat.ts for what each one does in resolution.

/** Fact id prefixes the engine reads (facts must also be listed in the person's `factIds`). */
export const FACT_PREFIX = {
  /** 'loc:<personId>[:suffix]': where a person is / whether they are present. Auto-settled by observing the space. */
  location: 'loc:',
  /** 'arm:<personId>[:suffix]': armament and readiness. Shown on the map only once confirmed. */
  armament: 'arm:',
  /** 'cond:<personId>[:suffix]': disposition, intent, awareness. */
  condition: 'cond:',
  /** 'use:<spaceId>[:suffix]': what a room is used for. Starts 'reported' instead of 'unknown' when plans are on file. */
  use: 'use:',
} as const;

/** Run flags the engine reads. Outcome effects set them (`setFlags`); requirements and conditions may test them. */
export const PERSON_FLAG = {
  /** Subject safely contained: no longer a threat contributor, no longer moves. */
  contained: (personId: Id) => `contained:${personId}`,
  /** Civilian or held person with officers: stays put, no longer counts as exposed. */
  withPolice: (personId: Id) => `with_police:${personId}`,
  /** Person led out of the building: removed from risk and movement. */
  evacuated: (personId: Id) => `evacuated:${personId}`,
  /** Person left the scene on their own: removed from risk and movement. */
  escaped: (personId: Id) => `escaped:${personId}`,
  /** Person is being kept under observation: their moves are followed (knowledge does not go stale). */
  watched: (personId: Id) => `watched:${personId}`,
} as const;

/** Run flags that clear a hazard restriction for any action. */
export const HAZARD_FLAG = {
  gas: 'hazard_cleared:gas',
  structural: 'hazard_cleared:structural',
} as const;

export type DifficultyBand = 'low' | 'moderate' | 'high' | 'severe';

/** Expected difficulty as shown to the player, conditional on what is currently known. */
export interface DifficultyInfo {
  score: number;
  band: DifficultyBand;
  /** Up to three drivers in player language, biggest first. */
  drivers: string[];
}
