// The incident domain model (docs/incident-domain-model.md, §1 to §5, §11, §12). A template says
// what a kind of call can be: where it happens, who can be in it and how they are drawn, what is
// hidden, and the story graph written against them. An instance (gen/incident/instance.ts) is one
// call drawn from a template: every person explicit, every attribute with what the team knows of
// it. Every later system (resolution, narration, scoring, the board, the lab) reads instances.
//
// Milestone 1 describes today's calls faithfully and changes no odds: a field the engine does not
// read yet is listed in WIRED as false, and the lab says so beside it.
import type { Armament, Disposition, IncidentType, Intent, PoliceAwareness, Readiness } from '../../sim/scenario-types';
import type { Id, RoomType, Vec } from '../../sim/types';
import type { CallTree } from '../call-trees/types';

// ---------------------------------------------------------------- people (§1)

/** What a person is to the incident. Defined once here; every call uses these meanings.
 * - subject: their actions are why the team was called.
 * - hostage: held against their will, as leverage (instrumental) or because they were there
 *   when it started (incidental).
 * - victim: held or threatened by a subject whose grievance or emotion targets them, with no
 *   demand police can meet (expressive). The highest-risk hold; time is not a reliable ally.
 * - trapped: inside and not held: hiding, unaware, or unable to leave.
 * - bystander: nearby and not held.
 * - reporting_party: the caller, family or witness; a source that can be wrong, never on the line.
 * - animal: a pet or working animal. */
export type PersonKind = 'subject' | 'hostage' | 'victim' | 'trapped' | 'bystander' | 'reporting_party' | 'animal';
export const PERSON_KINDS: readonly PersonKind[] = ['subject', 'hostage', 'victim', 'trapped', 'bystander', 'reporting_party', 'animal'];

export type AgeBand = 'infant' | 'child' | 'teen' | 'adult' | 'elderly';
export type Mobility = 'normal' | 'limited' | 'chair' | 'immobile';
export type Need = 'oxygen' | 'medication' | 'cardiac' | 'hearing' | 'language';
export type HoldKind = 'instrumental' | 'expressive' | 'incidental';
export type Restraint = 'free' | 'watched' | 'restrained' | 'shielded';
export type Relationship = 'stranger' | 'customer' | 'coworker' | 'employer' | 'family' | 'former_partner' | 'neighbor' | 'acquaintance';
/** What a subject is doing: holding people, barricaded alone or with people hiding, seeking a
 * person to harm, outside the building (another unit's problem), or getting away. */
export type SubjectActivity = 'holding' | 'barricaded' | 'seeking' | 'offsite' | 'fleeing';
/** Where a person stands, computed from the building (instance.ts). 'cover' and 'shielded' need
 * the furniture cover data of milestone 2 and are never drawn before it. */
export type Placement = 'cover' | 'doorway' | 'window' | 'deep' | 'upstairs' | 'shielded' | 'outside' | 'offsite';

export type WeaponKind = 'handgun' | 'long_gun' | 'shotgun' | 'edged' | 'blunt' | 'improvised' | 'unknown';
export interface Weapon {
  kind: WeaponKind;
  /** A reported gun can be a replica; the team acts on what it believes (§4). */
  real: 'real' | 'replica' | 'unknown';
  where: 'in_hand' | 'within_reach' | 'elsewhere';
  visible: boolean;
}
/** The engine's armament scale for each weapon kind (ThreatProfile.armament). */
export const WEAPON_ARMAMENT: Record<WeaponKind, Armament> = {
  handgun: 'handgun', long_gun: 'long_gun', shotgun: 'long_gun', edged: 'edged', blunt: 'blunt', improvised: 'blunt', unknown: 'unknown',
};

export interface Demand {
  kind: 'expressive' | 'statement' | 'person' | 'transport' | 'item' | 'none';
  /** Plain description for the lab ("a written account that {taker.he} took nothing"). */
  text: string;
  /** Within the concession policy (§7): command can give it. Family, weapons, transport out
   * and officer swaps never are. */
  concedable: boolean;
  /** A clock that runs on this demand (§3). */
  deadline?: Id;
}

/** §2. 0 to 100. Subjects carry the first five, everyone held or trapped the last two. */
export interface Meters { agitation: number; rapport: number; fatigue: number; intoxication: number; resolve: number; condition: number; composure: number }

export interface PersonRecord {
  warrant: 'none' | 'minor' | 'violent_felony' | 'unknown';
  priorViolence: boolean | 'unknown';
  /** A protective order names this person (barricade). */
  protectiveOrder?: boolean;
}
/** Where a person stands in their group (§1). `id` is the group: the cast slot. `influence`, 0 to 1,
 * is how strongly the leader holds this member, which is what decides whether they follow when the
 * leader gives up (sim/drawn-effects.ts CASCADE_V1). The leader, or a lone subject, carries 1. */
export interface GroupRole { id: Id; role: 'leader' | 'follower' | 'lookout' | 'lone'; influence: number }
/** How a slot's members are drawn into their group, per member from the call seed: their role and
 * how strongly the leader holds them, uniform within `influence`. */
export interface GroupSpec { role: Dist<'follower' | 'lookout'>; influence: { min: number; max: number } }
export interface AnimalTraits { size: 'small' | 'large'; temperament: 'friendly' | 'protective' | 'aggressive'; owner?: Id; contained: boolean }

// ---------------------------------------------------------------- knowledge (§4)

export type BeliefStatus = 'confirmed' | 'reported' | 'assumed' | 'unknown';
export interface Belief {
  status: BeliefStatus;
  source: string;
  /** What the team believes when it differs from the truth ("handgun" for a replica). */
  value?: string;
  /** Fact or action that settles it in play. */
  learnedBy?: string;
}
/** 'kind' is what the team believes this person is. With several people inside, the subject can be
 * unidentified ("three people, one fired, nobody knows which"); force is never authorized on a
 * person the team has not identified as the threat (§7), and mistaking a held person for the
 * subject is a possible result in milestone 2. */
export type KnowledgeKey = 'kind' | 'presence' | 'position' | 'weapons' | 'disposition' | 'hold' | 'needs' | 'record' | 'demands' | 'awareness';

// ---------------------------------------------------------------- clocks (§3)

/** Something that runs down on the operation's minutes (sim/clocks.ts). The situation sets the
 * rate; each call draws it within `rateSpread`; the team hears the cues as they pass. The tree reads
 * it with `if: { clock, low | out }` where the story says what running low or out does. */
export interface Clock {
  id: Id;
  label: string;
  kind: 'medical' | 'structural' | 'battery' | 'supply' | 'deadline' | 'light' | 'crowd' | 'intoxication';
  /** Whose clock it is, when it belongs to a person: it stops once they are out. */
  owner?: Id;
  /** Remaining, 0 to 100, at the start of the call. */
  start: number;
  /** Points lost per minute, before the per-call spread. */
  ratePerMin: number;
  /** Each call draws the rate within this fraction either side (0.25: 75% to 125%). */
  rateSpread?: number;
  /** Whether the team can know the rate before it shows (a full tank says so; a door doesn't). */
  rateKnown: boolean;
  /** Highest first. What the team hears as it passes each point: the line, a mark the tree's
   * prompts and choices read, and whether it settles the fact this clock answers. A cue whose mark
   * is already set, or whose fact is already settled, stays silent. */
  cues: { at: number; text: string; mark?: string; reveal?: boolean }[];
  /** The tree fact whose claim this clock answers ("whether the door will hold"). */
  factKey?: string;
  /** Once low, command won't wait for talking to work (sim/authorization.ts): completes "Command
   * approves it because …" ("{owner.first} can’t wait any longer"). */
  urgent?: string;
  /** The call's own outcomes still run this clock (the barricade's phone battery): the lab shows
   * it, and the engine leaves it alone until the tree reads it. */
  story?: true;
  /** Running out where no fork reads it (sim/clocks.ts): harm recorded to the owner while they are
   * still inside, and a mark the tree's prompts read. */
  onOut?: { harm?: 'wounded' | 'serious'; mark?: string };
}

// ---------------------------------------------------------------- conditions

export interface Conditions {
  timeOfDay: 'day' | 'dusk' | 'night';
  power: 'on' | 'off';
  weather: 'clear' | 'rain' | 'wind' | 'fog' | 'snow';
  /** Bystanders outside: 0 none, 1 some, 2 crowd. */
  crowd: 0 | 1 | 2;
}

// ---------------------------------------------------------------- templates (§12)

// ---------------------------------------------------------------- identity

export type Pronouns = 'he' | 'she' | 'they';
/** Who a person is never depends on what they are to the incident: a subject is drawn from the same
 * distribution as a hostage or a neighbor, and no mechanic reads pronouns or names (§13). A
 * template may narrow it only when its story requires it (a role whose text needs one), never by
 * kind. Ages come from the template where the story supports them, minors included. */
export const IDENTITY_DEFAULT = { pronouns: { pick: [['he', 45], ['she', 45], ['they', 10]] } } as const satisfies { pronouns: Dist<Pronouns> };
/** Ages in years that make each band. Minors (infant, child, teen) are never killed, whatever
 * their kind (owner decision, 2026-10-07). */
export const ageBandOf = (years: number): AgeBand => years < 2 ? 'infant' : years < 13 ? 'child' : years < 18 ? 'teen' : years < 70 ? 'adult' : 'elderly';

/** A fixed value, or weighted options drawn per person from the call seed. */
export type Dist<T> = T | { pick: readonly (readonly [T, number])[] };

/** The attributes a slot gives each person it draws. Situations override them per hidden truth. */
export interface PersonSpec {
  label: string;
  age: Dist<AgeBand>;
  /** Pronouns (default IDENTITY_DEFAULT) and, where the text names it, an age range in years. */
  identity?: { pronouns?: Dist<Pronouns>; years?: { min: number; max: number } };
  mobility?: Dist<Mobility>;
  needs?: Need[];
  /** Where an offsite person is ("an upstairs window across the street"). */
  offsite?: string;
  hold?: { by: string; kind: HoldKind; restraint: Restraint; relationship: Relationship };
  /** Trapped people: whether the subject knows they are there. */
  subjectAware?: boolean;
  activity?: SubjectActivity;
  threat?: { disposition: Dist<Disposition>; intent: Intent; awareness: PoliceAwareness; readiness: Readiness };
  /** What they carry: a fixed list, or weighted lists drawn per person (a group member with their
   * own handgun, a bat, or nothing: `{ pick: [[[handgun], 40], [[], 60]] }`). */
  weapons?: Dist<Weapon[]>;
  /** Accuracy under stress: how often this person's fire hits (sim/drawn-effects.ts). Truth only;
   * the team learns it the hard way. */
  proficiency?: Dist<'untrained' | 'some' | 'trained'>;
  volatility?: Dist<'steady' | 'shifting' | 'volatile'>;
  /** The self-harm screen covers this person (ethics E4.5): the card never shows their death. */
  noDeathOnCard?: boolean;
  record?: PersonRecord;
  relationshipToSubject?: Relationship;
  demands?: Demand[];
  meters?: Partial<Meters>;
  animal?: AnimalTraits;
  /** What the team knows of this person at the start of the call. Unlisted keys are unknown. */
  knowledge?: Partial<Record<KnowledgeKey, Belief>>;
  /** Lines of sight the story relies on before milestone 2 computes them from the building. */
  sightlines?: { to: string; clear: boolean }[];
  /** A slot whose people form a group (a counted slot): how each member past the key roles is drawn
   * into it. The first key role leads (or is 'lone' when the call draws nobody else). */
  group?: GroupSpec;
}

export interface CastSlot {
  id: string;
  kind: PersonKind;
  count: { min: number; max: number; weights?: readonly number[] };
  /** Tree roles bound to this slot's people in draw order (the leader first). Everyone past them is
   * a member of the tree's counted role for this slot (CallTree.groups), named together in prose. A
   * slot that can draw more people than it has key roles needs one. */
  keyRoles: string[];
  person: PersonSpec;
}

export interface SituationModel {
  /** Index into tree.situations. */
  index: number;
  /** Per key role, counted role (a group's members) or slot id, the attributes this hidden truth
   * sets. */
  people?: Record<string, Partial<PersonSpec>>;
  clocks?: Clock[];
}

export interface IncidentTemplate {
  type: IncidentType;
  label: string;
  /** The story graph. Its roles are the template's key roles. */
  tree: CallTree;
  cast: CastSlot[];
  conditions: { [K in keyof Conditions]: Dist<Conditions[K]> };
  situations: SituationModel[];
  /** Complication module ids this template allows (milestone 4). */
  complications: string[];
}

// ---------------------------------------------------------------- instances

export type IncidentClass = 'hostage' | 'victim' | 'barricade' | 'active_threat' | 'rescue';
export type ScaleClass = 'lone' | 'pair' | 'small_group' | 'group';

export interface IncidentPerson {
  id: Id;
  slot: string;
  /** The person's engine id: the tree role for a key role, or the member id ('others_1') for a
   * member of a counted role. Story bindings, facts, the cast and the engine all key on it. */
  roleKey?: string;
  /** For a member of a counted role, that role ('others'). */
  countedRole?: string;
  kind: PersonKind;
  label: string;
  name?: { first: string; surname: string; pronouns: Pronouns };
  /** Drawn for everyone, named or not, from the same distribution whatever their kind. */
  pronouns: Pronouns;
  age: AgeBand;
  years?: number;
  mobility: Mobility;
  needs: Need[];
  position:
    | { kind: 'inside'; spaceId: Id; roomType: RoomType; at: Vec; outside: Vec; placement: Placement; floor: number }
    | { kind: 'outside'; spaceId: Id; at: Vec }
    | { kind: 'offsite'; where: string };
  hold?: { by: Id; kind: HoldKind; restraint: Restraint; relationship: Relationship };
  subjectAware?: boolean;
  activity?: SubjectActivity;
  threat?: { armament: Armament; readiness: Readiness; disposition: Disposition; intent: Intent; awareness: PoliceAwareness };
  weapons: Weapon[];
  proficiency?: 'untrained' | 'some' | 'trained';
  volatility?: 'steady' | 'shifting' | 'volatile';
  noDeathOnCard?: boolean;
  record?: PersonRecord;
  relationshipToSubject?: Relationship;
  group?: GroupRole;
  demands: Demand[];
  meters: Partial<Meters>;
  animal?: AnimalTraits;
  knowledge: Partial<Record<KnowledgeKey, Belief>>;
  sightlines: { to: string; clear: boolean }[];
}

/** Which instance fields the engine reads today. Milestone 2 turns the rest on. */
export const WIRED: Record<string, boolean> = {
  names: true, rooms: true, positions: true, routes: true, situation: true, turns: true, pacing: true,
  // M2 slice 1 (sim/incident-factors.ts): armament and readiness, temper once revealed, awareness,
  // what waiting does by intent, cover between an armed person and the door, and what the team knows.
  threat: true, weapons: true, placement: true, knowledge: true,
  // M2 slice 3 (sim/clocks.ts, sim/meters.ts): clocks run on the operation's minutes, and a
  // subject's agitation and rapport move with events, as far as their volatility says.
  meters: true, clocks: true, volatility: true,
  // M2 slice 5 (sim/drawn-effects.ts CASCADE_V1): a member's influence decides whether they follow
  // a leader who gives up. The role (follower, lookout) is drawn and shown, not yet read.
  group: true,
  hold: false, conditions: false, record: false,
};
