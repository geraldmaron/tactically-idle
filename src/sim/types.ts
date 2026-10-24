// Shared records for the Tactically Idle first playable.
// FROZEN CONTRACT: parallel modules build against these shapes. Module-specific
// types belong in the owning module's file, not here.
// Units: geometry in feet (y grows downward), time in epoch milliseconds for the
// department clock, and abstract "operation minutes" inside an operation run.

import type { SquadArrangementLockTarget, SquadArrangementProposal, SquadArrangementState } from './squad-optimizer';
import type { CommandStaffState, ManagerId, ManagerPolicyPatch } from './command-staff';
import type { RankId } from './ranks';
import type { UnlockRule } from '../content/unlocks';
import type { ContentDescriptor } from '../content/content-descriptors';
import type { DistrictId, Tier, WorldState } from './world/types';
import type { AftercareChoice, PeopleState } from './people/types';

export type Id = string;

// ---------------------------------------------------------------- geometry

export interface Vec {
  x: number;
  y: number;
}
export type Polygon = Vec[];

export type RoomType =
  | 'bedroom'
  | 'bathroom'
  | 'hall'
  | 'living'
  | 'kitchen'
  | 'storage'
  | 'office'
  | 'retail'
  | 'utility'
  | 'stair';

export interface Room {
  id: Id;
  label: string;
  type: RoomType;
  floor: number;
  /** Wall-centerline polygon, clockwise, in feet. Areas are computed from this. */
  polygon: Polygon;
  /** Task-capacity and scenario tags, e.g. 'sleeping', 'water', 'narrow'. */
  tags: string[];
  env?: { lighting?: 'normal' | 'dim' | 'dark' };
}

export type ZoneKind = 'porch' | 'yard' | 'street' | 'alley' | 'parking';

export interface ExteriorZone {
  id: Id;
  label: string;
  kind: ZoneKind;
  polygon: Polygon;
  tags: string[];
}

/** 'stair' joins a room on floor 0 to a room on floor 1 (from/to are the stair's foot and head). */
export type OpeningType = 'door' | 'doorway' | 'window' | 'sliding' | 'stair';

/** Abstract construction materials. Properties live in src/content/materials.ts. */
export type WallMaterial = 'brick' | 'wood_frame' | 'drywall' | 'plaster' | 'concrete' | 'glass_partition';
export type DoorMaterial = 'hollow_core' | 'solid_core' | 'steel' | 'glass';
export type Glazing = 'single' | 'double' | 'security';
export type WindowCovering = 'none' | 'blinds' | 'curtains';
export type FloorMaterial = 'timber_joist' | 'concrete_slab';
export type OpeningState = 'open' | 'closed' | 'locked' | 'blocked';

export interface Opening {
  id: Id;
  type: OpeningType;
  /** Room or exterior-zone ids joined by this opening. */
  a: Id;
  b: Id;
  /** Segment on the shared wall centerline. */
  from: Vec;
  to: Vec;
  /** Doors only: which end is the hinge and which space the leaf swings into. */
  swing?: { hinge: 'from' | 'to'; into: Id };
  state: OpeningState;
  /** Doors / sliding: leaf material. */
  material?: DoorMaterial;
  /** Floor the opening is on (stairs: the lower floor). Defaults to the floor of space `a`. */
  floor?: number;
  /** Windows / sliding: glazing and covering. */
  glazing?: Glazing;
  covering?: WindowCovering;
}

export type ObjectType =
  | 'bed'
  | 'nightstand'
  | 'dresser'
  | 'wardrobe'
  | 'desk'
  | 'sofa'
  | 'armchair'
  | 'coffee_table'
  | 'rug'
  | 'tv'
  | 'dining_table'
  | 'chair'
  | 'counter'
  | 'sink'
  | 'stove'
  | 'fridge'
  | 'toilet'
  | 'tub'
  | 'vanity'
  | 'shelf'
  | 'register'
  | 'plant'
  | 'shrub'
  | 'tree'
  | 'steps'
  | 'fence';

export interface PlacedObject {
  id: Id;
  type: ObjectType;
  /** Room or exterior-zone id. */
  in: Id;
  /** Top-left corner of the unrotated footprint, feet. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: 0 | 90 | 180 | 270;
  /** Versioned furnishing plans supply the authoritative symbol orientation. */
  placement?: { back: 'N' | 'E' | 'S' | 'W'; anchor: 'wall' | 'group'; group?: string };
  /** false = drawn only; true = consumed by a named rule (usable space, scenario fact). */
  mechanical: boolean;
  tags: string[];
}

export interface MapNote {
  id: Id;
  text: string;
  at: Vec;
  /** Authored map flavour. Decorative notes never imply a mechanic. */
  decorative: true;
}

/**
 * Distance math a location is measured with (src/sim/geometry.ts). Absent: `Math.hypot`, which
 * ECMA-262 lets engines approximate; every location issued before `_g2` keeps it so its derived
 * costs, staging points and furnishing stay byte-identical. `'exact'`: `Math.sqrt(dx*dx + dy*dy)`,
 * built from IEEE-754 operations that every engine rounds the same way.
 */
export type GeometryVersion = 'exact';

/** How a unit inside a larger building is reached from the street (multi-unit residential). */
export interface LocationAccess {
  /** Floor of the unit's front door: 0 ground, 1 second floor, 2 third, 3 fourth (American numbering in text). */
  unitLevel: 0 | 1 | 2 | 3;
  /** The building has an elevator serving the unit's floor. */
  lift: boolean;
  /** A wheelchair can get from the street to the unit's front door without steps. */
  stepFree: boolean;
  /** Player-facing line, also carried as a map note, e.g. 'Third-floor unit; the building has an elevator'. */
  note: string;
}

export interface LocationDefinition {
  id: Id;
  familyId: Id;
  version: number;
  seed: number;
  name: string;
  setting: 'residential' | 'business' | 'apartment';
  /** Distance math version; see GeometryVersion. Absent on every location issued before `_g2`. */
  geometry?: GeometryVersion;
  /** Unit floor and step-free route for a unit in a multi-unit building (`apartment_unit_g2`). */
  access?: LocationAccess;
  units: 'ft';
  /** Drawing extents (lot), feet. */
  bounds: { w: number; h: number };
  /** Exterior wall outline of floor 0. */
  footprint: Polygon;
  /** Number of floors, 1 or 2 (max 2). Defaults to 1. */
  floors?: number;
  /** Outline of floor 1 when present (may be smaller than floor 0). */
  upperFootprint?: Polygon;
  wallThickness: { exterior: number; interior: number };
  /** Default wall materials, with overrides for the wall shared by two spaces. */
  materials: { exterior: WallMaterial; interior: WallMaterial; overrides: { a: Id; b: Id; material: WallMaterial }[]; /** Between floors 0 and 1. */ floorCeiling?: FloorMaterial };
  rooms: Room[];
  zones: ExteriorZone[];
  openings: Opening[];
  objects: PlacedObject[];
  notes: MapNote[];
  /** Zone ids squads may start from. */
  entries: Id[];
}

/** Authored, seed-driven variation applied to a base layout before validation. */
export type VariationRule =
  | {
      kind: 'shiftEdge';
      id: Id;
      /** Vertices whose `axis` coordinate equals `at` and whose other coordinate lies in [span0, span1] move together. */
      axis: 'x' | 'y';
      at: number;
      span: [number, number];
      /** Allowed offsets in feet; one is chosen by seed. Include 0 for the base layout. */
      offsets: number[];
    }
  | {
      kind: 'openingState';
      id: Id;
      openingId: Id;
      states: OpeningState[];
    }
  | {
      kind: 'optionalOpening';
      id: Id;
      opening: Opening;
      /** Probability the opening exists, 0..1. */
      chance: number;
    };

export interface LocationFamily {
  id: Id;
  version: number;
  base: LocationDefinition;
  variations: VariationRule[];
}

export interface DerivedRoom {
  id: Id;
  area: number;
  /** Area minus footprints of mechanical objects tagged 'blocks_space'. */
  usableArea: number;
  /** Useful simultaneous participants for a task in this room. */
  capacity: number;
  centroid: Vec;
  bbox: { x: number; y: number; w: number; h: number };
  /** Floor of the space (zones are 0). */
  floor?: number;
}

export interface GraphEdge {
  to: Id;
  openingId: Id;
  /** Abstract traversal minutes across this edge. */
  cost: number;
}

/** A place just outside/inside an opening where a squad can stage. Derived from geometry. */
export interface StagingPoint {
  id: Id;
  /** Space the squad stands in. */
  spaceId: Id;
  /** Space on the other side of the opening. */
  facesId: Id;
  openingId: Id;
  kind: 'door' | 'doorway' | 'window' | 'stair';
  at: Vec;
  floor?: number;
}

export interface DerivedLocation {
  locationId: Id;
  stagingPoints: StagingPoint[];
  /** Rooms and zones keyed by id (zones get area/centroid too). */
  spaces: Record<Id, DerivedRoom>;
  /** Traversable adjacency (windows and blocked openings excluded). */
  adjacency: Record<Id, GraphEdge[]>;
  /** Shortest traversal minutes between any two spaces; Infinity when unreachable. */
  distance: Record<Id, Record<Id, number>>;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  ref?: Id;
}

export interface BuiltLocation {
  location: LocationDefinition;
  derived: DerivedLocation;
  issues: ValidationIssue[];
}

// ---------------------------------------------------------------- people

export type RatingKey = 'shooting' | 'composure' | 'communication' | 'awareness' | 'medical' | 'coordination';
export type Ratings = Record<RatingKey, number>; // 0..100 display scale

export type CertId = 'crisis_negotiation' | 'entry_team' | 'advanced_first_aid' | 'surveillance' | 'drone_operator' | 'less_lethal' | 'advanced_less_lethal' | 'deescalation' | 'vehicle_operations' | 'precision_support' | 'controlled_access';
export type TraitId = 'steady' | 'observant' | 'mentor' | 'impatient' | 'calm_voice' | 'rookie';
export type Role = 'comms' | 'breach' | 'medic' | 'recon' | 'lead';

export type Assignment =
  | { kind: 'training'; courseId: Id; startedAt: number; endsAt: number }
  /** Teaching for a neighbouring department (src/sim/detail.ts); `fee` is paid when it ends. */
  | { kind: 'detail'; startedAt: number; endsAt: number; fee: number }
  | { kind: 'operation'; runId: Id }
  /** A SWAT proactive shift in a district (save v19, src/sim/world/shifts.ts). */
  | { kind: 'proactive'; shiftId: Id; startedAt: number; endsAt: number }
  /** Aftercare (save v19, src/sim/people/aftercare.ts): an officer stood down to rest, or a colleague
   * spending a shift on peer support. Both keep the officer off calls until `endsAt`. */
  | { kind: 'standdown'; imprintId: Id; startedAt: number; endsAt: number }
  | { kind: 'peer_support'; imprintId: Id; startedAt: number; endsAt: number };

export interface Officer {
  id: Id;
  /** Stable authored person; optional for isolated officer fixtures. */
  identityId?: string;
  firstName: string;
  surname: string;
  role: Role;
  /** Authored portrait path. */
  portrait: string;
  ratings: Ratings;
  certs: CertId[];
  traits: TraitId[];
  /** Funding per hour. */
  wage: number;
  xp: number;
  /** Current condition 0..100. Separate from the composure rating. */
  stress: number;
  injury: { label: string; until: number } | null;
  squadId: SquadId | null;
  assignment: Assignment | null;
  hiredAt: number;
  /** Game-calendar day of birth (see src/sim/calendar.ts). Age derives from it. */
  bornDay: number;
  /** Game-calendar day service began (may precede joining this department). */
  serviceStartDay: number;
  /** `earned`: funding this officer brought in through call payouts (an equal share of each
   * payout among the officers on the call) and instructor detail fees. */
  /** `byType`: calls of each incident type this officer has worked here (the odds read it as
   * familiarity, content/traits.ts TYPE_HISTORY). */
  career: { operations: number; favorable: number; adverse: number; earned?: number; byType?: Record<string, number> };
  /** Announced retirement; the officer leaves on `day`. Forecastable, never instant. */
  retirement: { day: number; reason: 'age' | 'service' | 'burnout'; announcedDay: number; extended: boolean } | null;
  /** Ranks reached in play (save v12), oldest first, each with the call, course or detail that
   * brought it. The rank itself derives from `xp` (sim/ranks.ts). */
  promotions?: { rank: RankId; day: number; cause: string }[];
  /** Epoch ms when stress last rose above the burnout threshold and stayed there. */
  highStressSince?: number | null;
  /** Newest debrief run id already counted into `career`. */
  lastRunCounted?: string | null;
}

export interface Candidate {
  id: Id;
  officer: Officer; // squadId null, assignment null
  /** Total due at signing, issue kit included. */
  signingCost: number;
  /** The part of signingCost that pays for the officer's issue kit (content/issue-kit.ts). */
  issueKit?: number;
  shortlisted: boolean;
  expiresAt: number;
}

/** Up to four persistent squads (owner decision, 2026-10-02). */
export type SquadId = 'A' | 'B' | 'C' | 'D';
export const SQUAD_IDS: readonly SquadId[] = ['A', 'B', 'C', 'D'];
/** SWAT duty when not deployed. Rest speeds recovery; patrol is a separate workforce. */
export type SquadDuty = 'standby' | 'rest';

export interface Squad {
  id: SquadId;
  name: string;
  officerIds: Id[];
  leaderId: Id | null;
  duty: SquadDuty;
  /** Saved loadout preference: itemId -> qty. Applied only when the preset node is unlocked. */
  loadoutPreset: Record<Id, number>;
}

// ---------------------------------------------------------------- department

export type ItemCategory = 'comms' | 'intel' | 'protection' | 'access' | 'medical' | 'response' | 'less_lethal' | 'vehicles' | 'supplies';
export type CapabilityId = 'visible_exterior' | 'dark_visible_scene' | 'opening_inspection' | 'weak_radio_link' | 'medical_exposure' | 'authorized_response' | 'specialist_support' | 'less_lethal_device' | 'less_lethal_impact' | 'permitted_door_access' | 'vehicle_exterior' | 'scene_coordination';

export type ItemKind = 'equipment' | 'consumable' | 'infrastructure';

export interface ItemDefinition {
  id: Id;
  name: string;
  kind: ItemKind;
  category: ItemCategory;
  aliases?: string[];
  capabilities?: CapabilityId[];
  requiresCerts?: CertId[];
  /** Only deployable in the single explicit exterior support slot. */
  supportOnly?: boolean;
  helpsWith?: string[];
  counters?: string[];
  supplies?: { itemId: Id; qty: number }[];
  cost: number;
  /** Capability tags actions require, e.g. 'comms_kit', 'throw_phone', 'thermal', 'medkit', 'shield'. */
  tags: string[];
  /** Development node that must be unlocked before purchase, if any. */
  requiresNode?: Id;
  description: string;
  /** Per-unit deterioration. Each physical unit tracks its own condition. */
  wear: {
    /** Condition lost per operation where the unit is actually used. */
    perUse: number;
    /** Condition lost per game day while owned (ageing, battery fade, seals). */
    perDay: number;
    /** Below this the unit is unreliable (penalised, may fail). */
    unreliableBelow: number;
    /** At or below this the unit cannot be deployed until serviced or scrapped. */
    failAt: number;
    /** Servicing: time, cost, and the condition it restores (max). 0 hours = not serviceable. */
    serviceHours: number;
    serviceCost: number;
    restoreTo: number;
    /** Consumables: unusable after this many game days from acquisition. */
    shelfLifeDays?: number;
  };
  /** Effective and maximum range in feet, for items whose use depends on distance. */
  range?: { effective: number; max: number };
}

export type UnitStatus = 'ready' | 'reserved' | 'service' | 'expired' | 'scrapped';

/** One physical item. Condition, age and use are tracked per unit, not per stack. */
export interface ItemUnit {
  id: Id;
  itemId: Id;
  /** Short display serial, e.g. 'RH-0142'. */
  serial: string;
  /** 0..100. */
  condition: number;
  acquiredAt: number;
  uses: number;
  status: UnitStatus;
  /** When servicing completes (epoch ms). */
  serviceUntil: number | null;
  /** Per-unit manufacturing variance on wear, ~0.8..1.25. */
  wearRate: number;
  /** Consumables: epoch ms after which the unit is expired. */
  expiresAt: number | null;
  /** Last time time-based wear was applied (epoch ms). */
  lastWearAt: number;
}

/** One reserved physical unit for one squad in one run. */
export interface LoadoutReservation {
  id: Id;
  runId: Id;
  squadId: SquadId;
  itemId: Id;
  unitId: Id;
}

export interface RestockRule {
  itemId: Id;
  target: number;
  /** Maximum spend per settlement window. Never drives funding below zero. */
  budgetCeiling: number;
}

export type DevBranch = 'personnel' | 'field' | 'intel' | 'logistics' | 'wellbeing';

export type NodeEffect =
  | { kind: 'unlockCourse'; courseId: Id }
  | { kind: 'unlockItem'; itemId: Id }
  | { kind: 'rosterCap'; delta: number }
  | { kind: 'trainingSlots'; delta: number }
  | { kind: 'recoveryRate'; mult: number }
  | { kind: 'income'; perHour: number }
  | { kind: 'loadoutPresets' }
  | { kind: 'restockRules' }
  | { kind: 'equipmentManager'; repairMultiplier: number; wearMultiplier: number; maxConcurrentServices: number }
  | { kind: 'candidatePool'; delta: number }
  /** Hires a Command Staff manager (src/sim/command-staff.ts). */
  | { kind: 'commandStaff'; managerId: ManagerId };

export interface DevelopmentTier {
  /** Incremental purchase price; effects are the total benefit at this tier. */
  cost: { funding: number };
  /** Milestone that grants this tier free when met (sim/grants.ts). */
  grant: UnlockRule;
  effects: NodeEffect[];
}

export interface DevelopmentNode {
  id: Id;
  branch: DevBranch;
  name: string;
  description: string;
  cost: { funding: number };
  /** Milestone that grants a one-time node free; tiered nodes carry one per tier. */
  grant: UnlockRule;
  requires: Id[];
  effects: NodeEffect[];
  /** Ordered tiers I through III. Missing for a one-time program or license. */
  tiers?: DevelopmentTier[];
}

export interface Course {
  id: Id;
  name: string;
  hours: number;
  cost: number;
  requiresNode?: Id;
  requiresCerts?: CertId[];
  grants: { cert?: CertId; rating?: { key: RatingKey; delta: number } };
}

/** What a ledger entry was for (src/sim/ledger.ts). */
export type LedgerKind = 'payout' | 'signing' | 'severance' | 'purchase' | 'training' | 'development' | 'service' | 'salvage' | 'restock' | 'staff' | 'detail' | 'patrol';

/** One discrete change to funding, with the balance either side (save v11). */
export interface LedgerEntry {
  /** Increases with every new or folded entry, so a viewer can tell what it has not shown yet. */
  seq: number;
  at: number;
  amount: number;
  before: number;
  after: number;
  kind: LedgerKind;
  label: string;
  /** The newest posting folded into this entry (absent when there is only one). */
  latest?: number;
}

export type PatrolGrade = 1 | 2 | 3;

/** A coverage position, separate from tactical officers and their equipment and stress. */
export interface PatrolEmployee {
  id: Id;
  profileId: Id;
  grade: PatrolGrade;
  /** Productive hours inside the department's funded accrual window. Never derived from money. */
  serviceHours: number;
  hiredAt: number;
  /** Departed identities stay in history and cannot be hired again. */
  dismissedAt: number | null;
  training: { toGrade: PatrolGrade; startedAt: number; endsAt: number } | null;
  /** The district this employee patrols (save v19). Absent means Pike Street, the home district. */
  districtId?: DistrictId;
}

export interface PatrolBoost {
  id: Id;
  factor: number;
  grantedAt: number;
  expiresAt: number;
}

export interface PatrolState {
  personnel: PatrolEmployee[];
  nextId: number;
  boosts: PatrolBoost[];
}

export interface PatrolTrainingCompletion {
  employeeId: Id;
  profileId: Id;
  grade: PatrolGrade;
  completedAt: number;
}

/** A development a milestone granted free (sim/grants.ts). */
export interface GrantRecord {
  nodeId: Id;
  tier: number;
  at: number;
  /** The milestone in words, as Develop showed it: 'Level 4', '10 calls resolved', 'Trust 85'. */
  milestone: string;
}

export interface Department {
  name: string;
  funding: number;
  /** Recent funding events, oldest first, capped (src/sim/ledger.ts). Optional for fixtures. */
  ledger?: LedgerEntry[];
  /** How the department is known to work (src/sim/reputation.ts): lean -1 talks first .. +1 goes in
   * hard, a moving average of committed choices, and how many choices it has seen. */
  reputation?: { lean: number; choices: number };
  /** How the player decides (src/sim/player-profile.ts): `stall`, 0..1, a moving average of the
   * share of each decision's threat window they let run, over `decisions` committed decisions. */
  habits?: { stall: number; decisions: number };
  /** Live calls closed resolved (save v12), counted for development milestones. */
  callsResolved: number;
  /** Developments granted by a milestone (save v12), oldest first. */
  grants: GrantRecord[];
  /** Standing, 0..100. Not spendable. */
  trust: number;
  level: number;
  /** Total service earned on live calls (save v7; see department-level.ts). Absent in older
   * saves, which count from the threshold of the level they hold. */
  service?: number;
  rosterCap: number;
  trainingSlots: number;
  unlockedNodes: Id[];
  /** Purchased tier by node ID. Entitlements remain in unlockedNodes. */
  developmentTiers: Record<Id, number>;
  restockRules: RestockRule[];
  /** Opt-in automatic servicing ceiling per clock hour; absent/zero means paused. */
  maintenanceBudgetPerHour?: number;
  /** Simulation time already settled. */
  lastSettledAt: number;
  /** Last player command; unattended funding accrual stops 24h after this. */
  lastInteractionAt: number;
  /** Greatest clock value ever observed; backward clock moves grant nothing. */
  clockHighWater: number;
  /** Last free candidate search (epoch ms). */
  candidateRefreshedAt?: number;
  /** Epoch ms of game-calendar day 0 (see src/sim/calendar.ts). */
  calendarEpoch: number;
  /** Lifetime purchases as the platform last reported them (save v19, `syncEntitlements` on every launch
   * and purchase; ui/entitlements.ts). Settlement and rates read them; nothing that decides a roll does.
   * Purchases are reconciled from the store account, never trusted from a save. */
  entitlements?: Entitlements;
}

export interface ShiftReport {
  from: number;
  to: number;
  /** Hours of funding actually accrued (capped). */
  accruedHours: number;
  gross: number;
  wages: number;
  operating: number;
  restockSpend: number;
  /** Automatic manager service only; absent in earlier saves. */
  maintenanceSpend?: number;
  maintenanceStarted?: Id[];
  net: number;
  /** Developments a milestone granted in this window (save v12). */
  grants?: GrantRecord[];
  completedCourses: { officerId: Id; courseId: Id }[];
  /** Patrol promotions completed during this report's interval, separate from SWAT courses. */
  patrolTraining?: PatrolTrainingCompletion[];
  recovered: Id[];
  shortages: string[];
  capped: boolean;
  /** Units that crossed into unreliable/failed/expired, and servicing that finished. */
  equipment: { unitId: Id; event: 'unreliable' | 'failed' | 'expired' | 'serviced' }[];
  /** Retirements announced or completed, birthdays/anniversaries that changed wages. */
  personnel: { officerId: Id; event: 'retirement_announced' | 'retired' | 'anniversary' | 'birthday' | 'promoted'; detail: string }[];
  /** What the world did in this window (save v19). Ids point into GameState.world. */
  world?: ShiftReportWorld;
  /** People beats raised in this window, ids into GameState.people.beats (save v19). */
  people?: Id[];
}

export interface ShiftReportWorld {
  contacts: number;
  casesOpened: number;
  casesClosed: number;
  /** Case awards paid in this window: how many, and the funding they brought. */
  awardsPaid: number;
  awardFunding: number;
  leads: Id[];
  /** Crime per open district at the start and end of the window. */
  crime: Partial<Record<DistrictId, [before: number, after: number]>>;
}

// ---------------------------------------------------------------- operations

export type StageId = 'assess' | 'adapt' | 'resolve';
export type KnowledgeStatus = 'unknown' | 'reported' | 'confirmed' | 'disproved';
export type OutcomeBand = 'favorable' | 'mixed' | 'adverse';
export type RiskBand = 'low' | 'moderate' | 'high' | 'severe';
export type CompletionDisposition = 'resolved' | 'care_accepted' | 'followup_agreed' | 'relief_partial' | 'unresolved';
export interface ExternalSupportState {
  requestedAt: number;
  /** Null means this service could not provide a response for this incident. */
  availableAt: number | null;
  acceptedAt: number | null;
}
export interface ExternalSupportEvent {
  serviceId: Id;
  kind: 'requested' | 'accepted';
  at: number;
}

export interface Contributor {
  label: string;
  /** Signed contribution in score points. */
  value: number;
  source:
    | 'rating'
    | 'condition'
    | 'trait'
    | 'equipment'
    | 'space'
    | 'support'
    | 'familiarity'
    | 'preparation'
    | 'difficulty'
    | 'pressure'
    | 'reputation';
  /** Officer / item / room the contribution came from. */
  ref?: Id;
}

export interface SquadTask {
  squadId: SquadId;
  /** Room or zone id the squad currently occupies / covers. */
  positionId: Id;
  /** Short task label shown on the map, e.g. 'Perimeter', 'Contact'. */
  task: string;
  /** Exact staging point the squad holds, if any (door, window, doorway). */
  stagingId: Id | null;
  /** Where the squad's token stands, feet. */
  at: Vec | null;
}

export interface DecisionResolution {
  /** Actual, clamped changes committed by v3 decisions. Optional for pre-v3 saves. */
  committed?: {
    objectiveDelta: number;
    civilianSafetyDelta: number;
    pressureDelta: number;
    consequences: string[];
    endingTitle: string | null;
    /** Authored event label frozen at commit; the original sampled band remains unchanged. */
    resultLabel?: string;
    /** Exact external responsibility events, saved once at commit in v4. */
    externalSupport?: ExternalSupportEvent[];
    officerCasualties?: OfficerCasualtyRecord[];
    forceOutcome?: ForceOutcome;
    personCasualties?: PersonCasualtyRecord[];
    protectionUsed?: { itemId: Id; unitId: Id };
    /** V13 drawn consequences settled at this commit (sim/drawn-effects.ts): who fired or who
     * force was used on, the result key ('serious', 'firearm:wounded'), and the rule's reason. */
    drawn?: { model: 'incoming_fire' | 'team_force' | 'cascade'; personId: Id; key: string; reason?: string }[];
    /** V5 opening changes resolved against the route actually used, in committed order. */
    openingChanges?: { openingId: Id; state: OpeningState }[];
    /** V13 lines spoken in this result, frozen at commit (call-surfaces). */
    exchange?: { speaker: string; line: string }[];
    /** What the live screen already showed while the player decided (the stall's beats, cues and
     * the threat's landing), kept out of `consequences` and `exchange` so the result tells it once. */
    heard?: { speaker?: string; line: string }[];
  };
  /** Run revision this decision was applied to. */
  revision: number;
  stage: StageId;
  actionId: Id;
  actingSquadIds: SquadId[];
  supportSquadIds: SquadId[];
  officerIds: Id[];
  /** The lead officer's trait and band flags this decision was resolved with (TreeState.lead), so a
   * replay reads the same results without the roster. */
  leadFlags?: string[];
  targetId: Id | null;
  inputs: Contributor[];
  score: number;
  difficulty: number;
  /** Saved uniform sample in [0,1); never rerolled. */
  sample: number;
  band: OutcomeBand;
  timeCost: number;
  /** The team's minutes for this decision before its outcomes added any (sim/clocks.ts
   * teamMinutes): travel, forcing and work at its band. Clock forks read it, so replays read the
   * same minutes the commit did. Includes `ditherMinutes`. */
  clockBaseMinutes: number;
  /** Game minutes the player's stall on this decision cost (sim/clocks.ts ditherMinutes), already
   * in `clockBaseMinutes` and `timeCost`, so a replay reads them from there. Absent when zero. */
  ditherMinutes?: number;
  stressDeltas: Record<Id, number>;
  /** Recorded at application time; absent in older decisions. Never reconstructed from current stress. */
  stressLevels?: Record<Id, { stressBefore: number; stressAfter: number }>;
  itemsConsumed: { itemId: Id; qty: number }[];
  /** Physical units actually used by this decision (wear is applied per unit at debrief). */
  unitsUsed: Id[];
  /** Fact ids whose knowledge status changed, with the new status. */
  knowledgeChanges: { factId: Id; status: KnowledgeStatus }[];
  /** Plain-language reasons, already composed from inputs and changes. */
  explanation: string[];
}

/** A decision point whose time ran out with no choice made (the engine's `lapse`, docs/
 * call-pressure.md "When the time runs out"): the threat landed and the call moved to the moment
 * written for continued inaction. It has no action, band or sample, since nobody chose and nothing
 * was rolled, and no strain or experience lands on anyone for it. */
export interface LapseRecord {
  kind: 'lapse';
  /** Run revision this lapse was applied to. */
  revision: number;
  stage: StageId;
  /** The threat that ran out (NodeThreat.id), and its label as the drain showed it. */
  threatId: Id;
  label: string;
  /** Game minutes the window ran: the threat's minutes, all of it stall. */
  timeCost: number;
  knowledgeChanges: { factId: Id; status: KnowledgeStatus }[];
  explanation: string[];
  /** What the lapse changed, saved as the decisions' committed record is, so the debrief and every
   * replay read the same numbers. */
  committed: {
    objectiveDelta: number;
    civilianSafetyDelta: number;
    pressureDelta: number;
    consequences: string[];
    endingTitle: string | null;
    /** Harm a clock running out during the window recorded (ClockDef.onOut). */
    personCasualties?: PersonCasualtyRecord[];
    /** What the scene said while the time ran (the threat's beats). */
    exchange?: { speaker: string; line: string }[];
    /** What the live screen already showed while the time ran (DecisionResolution.committed.heard). */
    heard?: { speaker?: string; line: string }[];
  };
}

/** A call's record, in order: committed decisions and lapses. */
export type HistoryEntry = DecisionResolution | LapseRecord;
export const isLapse = (entry: HistoryEntry | undefined): entry is LapseRecord => (entry as LapseRecord | undefined)?.kind === 'lapse';
/** The committed decisions alone, for readers about who acted and what they used. */
export const decisionsOf = (history: readonly HistoryEntry[] | undefined): DecisionResolution[] => (history ?? []).filter((entry): entry is DecisionResolution => !isLapse(entry));

export interface OperationRun {
  id: Id;
  scenarioId: Id;
  scenarioVersion: number;
  /** Unstarted generated card, retained so cancelling deployment can restore it. */
  sourceIncident?: IncidentCard;
  /** Copied from the card at dispatch (save v19): the world subject and lead this call serves. */
  world?: IncidentWorldRef;
  /** The one character callback this call carries, chosen at dispatch in tie, pair, imprint order and kept
   * for replays (docs/world-redesign.md, "How calls plug in"). */
  callback?: { kind: 'tie' | 'pair' | 'imprint'; officerIds: Id[]; refId: Id };
  locationFamilyId: Id;
  locationSeed: number;
  contentVersion: number;
  /** Seeded PRNG state; advanced only when a decision is committed. */
  rngState: number;
  squadIds: SquadId[];
  squadTasks: SquadTask[];
  reservationIds: Id[];
  /** Exact exterior support asset; never a hand-carried loadout. */
  supportUnitIds?: Id[];
  supportPositionId?: Id;
  stage: StageId | 'debrief';
  knowledge: Record<Id, KnowledgeStatus>;
  flags: string[];
  /** External care/response services; distinct from deployed squad support and vehicles. */
  externalSupport?: Record<Id, ExternalSupportState>;
  officerCasualties?: Record<Id, OfficerCasualtyRecord>;
  personCasualties?: Record<Id, PersonCasualtyRecord>;
  /** Operation minutes elapsed. */
  clock: number;
  /** V13 clocks (sim/clocks.ts): what is left of each, and how many of its cues have fired. */
  clocks?: Record<Id, { value: number; cued: number }>;
  /** V13 commitments (sim/commitments.ts): what command promised a person, and whether the team
   * kept it. */
  commitments?: Record<Id, { personId: Id; kind: string; madeAt: number; revision: number; status: 'open' | 'kept' | 'broken' }>;
  /** V13 the crew flags set when the run started (sim/crew.ts), so a replay starts from them too. */
  crew?: string[];
  /** V13 subject meters (sim/meters.ts): agitation and rapport now, and how far each kind of
   * event has moved them this call. */
  meters?: Record<Id, { agitation: number; rapport: number; moved: Partial<Record<string, { agitation: number; rapport: number }>> }>;
  /** 0..100 situation pressure. */
  pressure: number;
  /** 0..100 progress toward the objective. */
  objective: number;
  /** 0..100 civilian safety. */
  civilianSafety: number;
  history: HistoryEntry[];
  /** Explicit failed-response report; never adds progress, an invented receiver or a random roll. */
  responseFailure?: ResponseFailureRecord;
  /** Pre-decision deliveries at exterior staging; distinct from tactical outcomes. */
  resupplies?: { minutes: number; supportUnitId?: Id; allocations: { squadId: SquadId; unitIds: Id[] }[] }[];
  revision: number;
  status: 'active' | 'debrief' | 'closed';
  endingId: Id | null;
  /** True once rewards/settlement were applied. Guards double grants. */
  settled: boolean;
  /** Engine truth: where each scenario person is now (moves between stages). Never shown directly. */
  people?: Record<Id, { spaceId: Id; at: Vec }>;
  /** Player knowledge: where each person was last observed, and at which run revision. */
  lastSeen?: Record<Id, { spaceId: Id; at: Vec; revision: number }>;
  startedAt: number;
  /** When the open decision opened (the start, or the last commit), on the department's clock. A
   * close and resume reads the same time, so time away counts once (sim/clocks.ts openDither). */
  decisionOpenedAt: number;
  /** Set at a commit while its result is on screen; the next decision's stall starts at openDecision. */
  decisionPending?: true;
  /** When the app was hidden with this decision open (owner 2026-10-21: a stall counts only while the
   * player can see it). resumeDecision moves `decisionOpenedAt` on by the time away and clears it. */
  decisionPausedAt?: number;
  /** Where the pressure sources started on this call, when the department's name and habits moved
   * them (sim/player-profile.ts sourceStarts). Replays start from it. */
  sourceStart?: Record<Id, number>;
  /** The highest any gauge that fills reached in this call, 0 to 100 (sim/clocks.ts); absent in a
   * call with none. The debrief's audience factor reads it. */
  fillPeak?: number;
}

export interface ResponseFailureRecord {
  version: 1;
  revision: number;
  atClock: number;
  reasonKind: 'team_unavailable' | 'no_viable_approach';
  title: string;
  reason: string;
  remainingTasks: string[];
  progressRetained?: string[];
}

export interface DebriefResult {
  runId: Id;
  scenarioId: Id;
  endingId: Id;
  endingTitle: string;
  /** Absent only in older saved debriefs. */
  endingSummary?: string;
  /** The ending's epilogue, frozen when the call ends (call-surfaces, E11.2). */
  endingEpilogue?: string;
  /** Saved disposition and receiver evidence survive future content updates. */
  disposition?: CompletionDisposition;
  completionAchieved?: boolean;
  remainingTasks?: string[];
  receivingService?: { id: Id; label: string; kind: string; acceptedAt: number };
  officerCasualties?: OfficerCasualtyRecord[];
  civilianOutcomes?: CivilianOutcomeView[];
  personCasualties?: PersonCasualtyRecord[];
  /** V13 (sim/outcome-score.ts): what the call was scored on, each line with the trust and strain it
   * moved. The call's result comes first; the trust lines add up to the trust change before the
   * department's 0 to 100 clamp, and the strain lines to the strain at close. */
  scoreLines?: { key: string; text: string; trust: number; strain: number }[];
  /** V13: each use of force by the team, on whom, what it did, and the rule's reason. */
  forceLines?: { text: string; reason?: string }[];
  /** Detached complete decision log; optional for isolated debrief fixtures. */
  decisions?: DecisionView[];
  objective: { score: number; label: string };
  civilianSafety: { score: number; label: string };
  /** `promotions`: ranks the officer reaches when this debrief closes, each with what it gives
   * (save v12). */
  officerCondition: { officerId: Id; stressBefore: number; stressAfter: number; xpGained: number; promotions?: { rank: RankId; line: string }[] }[];
  informationPreserved: { factId: Id; label: string; status: KnowledgeStatus }[];
  resources: { itemId: Id; used: number; returned: number }[];
  /** Per-unit condition change from this run. */
  unitWear: { unitId: Id; itemId: Id; serial: string; before: number; after: number }[];
  trustDelta: number;
  fundingReward: number;
  /** Department service this call earned (save v7; absent before). */
  serviceEarned?: number;
  /** The department level this call took the department to, when it rose. */
  levelReached?: number;
  /** Material causes, most significant first. */
  causes: string[];
}

export interface OfficerCasualtyRecord {
  officerId: Id;
  /** V7+ injuries freeze the officer's actual location when hurt. Older records omit it. */
  position?: { spaceId: Id; at: Vec };
  severity: 'wounded' | 'serious';
  label: string;
  /** Operation minute when this injury occurred. */
  at: number;
  care: 'needed' | 'stabilized' | 'evacuated';
  /** Department clock time when the officer is fit again. */
  recoveryUntil: number;
}

export interface CivilianOutcomeView {
  id: Id;
  label: string;
  /** `reported` is someone the call has placed at a spot but the team has not confirmed. */
  status: 'unaccounted' | 'reported' | 'needs_help' | 'safe' | 'injured_needs_care' | 'care_accepted' | 'accounted_elsewhere' | 'deceased';
}

/** Fictional game balance; no real-world probability or medical prediction. */
export interface ForceRiskPreview {
  profile: 'firearm' | 'less_lethal_device' | 'less_lethal_impact';
  itemId: Id;
  unitId: Id;
  personId: Id;
  personRole: 'subject' | 'civilian';
  personLabel: string;
  lethalRisk: 'substantial' | 'low_but_present';
  summary: string;
}
export interface ForceOutcome extends ForceRiskPreview {
  version: 1;
  /** A separate saved draw after the effort draw, only for explicit V7 force use. */
  sample: number;
  severity: 'none' | 'wounded' | 'serious' | 'fatal';
}
export interface PersonCasualtyRecord {
  personId: Id;
  personRole: 'subject' | 'civilian';
  label: string;
  severity: 'wounded' | 'serious' | 'fatal';
  at: number;
  care: 'needed' | 'stabilized' | 'accepted' | 'deceased';
  causeRevision: number;
}

// ---------------------------------------------------------------- view models consumed by the UI

export interface DecisionView {
  revision: number;
  /** The action, or for a lapse the threat that ran out (NodeThreat.id). */
  actionId: Id;
  title: string;
  stageLabel: string;
  /** Null for a lapse: nobody chose, and nothing was rolled. */
  band: OutcomeBand | null;
  /** The decision point's time ran out with no choice made (LapseRecord). */
  lapse?: true;
  resultLabel?: string;
  /** Present for committed records; isolated fixtures can derive the result label. */
  officerCasualties?: OfficerCasualtyRecord[];
  forceOutcome?: ForceOutcome;
  personCasualties?: PersonCasualtyRecord[];
  explanation: string[];
  timeCost: number;
  objectiveDelta: number;
  civilianSafetyDelta: number;
  pressureDelta: number;
  /** Older records without snapshots saved requested strain, which may have been clamped on application. */
  actualStressDeltas: boolean;
  stressDeltas: { officerId: Id; label: string; delta: number; stressBefore?: number; stressAfter?: number }[];
  supplies: { itemId: Id; label: string; qty: number }[];
  knowledgeChanges: { factId: Id; label: string; status: KnowledgeStatus }[];
  contributors: Contributor[];
  consequences: string[];
  /** Lines spoken in this result (call-surfaces). */
  exchange?: { speaker: string; line: string }[];
  /** What the live screen showed while the player decided, told once and folded. */
  heard?: { speaker?: string; line: string }[];
  endingTitle: string | null;
}

export interface ActionView {
  forceRisk?: ForceRiskPreview;
  /** V13: what command says to the choice's request (sim/authorization.ts). Allowed, the card shows
   * the line under the summary; refused, the choice is locked and `reason` is the same line. */
  authority?: import('./scenario-types').AuthorityResult;
  /** V13: a lie or a promise command never approved (dilemma pattern 15). */
  deceives?: true;
  /** The decision point's threat, and the bands of this choice slow enough to let it happen. */
  threat?: { label: string; bands: OutcomeBand[] };
  /** The rating this choice leans on most, so the card can show the lead's number for it. */
  keyRating?: RatingKey;
  /** Lead marks (trait ids, band_<band>) this choice's results read (TreeState.lead). */
  leadReads?: string[];
  /** V13: what draws a player to the choice, and what it costs (bound, {lead} filled). */
  weighing?: { pull: string; cost: string };
  /** Common event across effort bands: authored explicitly or proven by identical v6 effect tables. */
  eventResult?: string;
  likelihood: Record<OutcomeBand, number>;
  suppliesRequired: { label: string; qty: number }[];
  outcomePreview: Record<OutcomeBand, string>;
  consequenceLevel: RiskBand;
  /** Conservative public duration bounds, including possible outcome delays. */
  timeRange: { min: number; max: number };
  /** A long hold's span, shown in place of minutes ('Hours', 'All night'). */
  timeLabel?: string;
  id: Id;
  stage: StageId;
  title: string;
  /** Icon key for the UI icon set: 'radio' | 'intel' | 'thermal' | 'drone' | 'shield' | 'medic' | 'wait' | 'handover' | 'door' | 'perimeter' | 'search'. */
  icon: string;
  /** Short consequence/eligibility line for the button, e.g. 'Chen ready', 'Takes more time'. */
  summary: string;
  /** One-line requirement shown under the title. */
  requirementLine: string;
  actingSquadIds: SquadId[];
  supportSquadIds: SquadId[];
  /** Authored support capacity and the minimum still needed for the selected acting squads. */
  support: { maxSquads: number; minSquads: number } | null;
  officerIds: Id[];
  targetId: Id | null;
  eligible: boolean;
  /** Specific reason when ineligible. */
  reason: string | null;
  risk: RiskBand;
  /** Estimated operation minutes. */
  timeCost: number;
  /** Of those, minutes moving through the building (routes, locked doors, a person walking out). */
  travelMinutes: number;
  contributors: Contributor[];
  /** What remains unknown, in player language. */
  uncertainty: string[];
  /** Detail lines: ratings, equipment, space/position effects, dependencies. */
  details: string[];
  /** Map overlays explaining spatial factors: sightlines, ranges, paths. Drawn when the action is selected. */
  overlays: MapOverlay[];
}

export type MapOverlay =
  | { kind: 'line'; from: Vec; to: Vec; tone: 'clear' | 'blocked' | 'partial'; label?: string; /** First material blocker on the line, if known. */ blockedAt?: Vec; floor?: number }
  | { kind: 'range'; at: Vec; radius: number; tone: 'effective' | 'max'; label?: string; floor?: number }
  | { kind: 'path'; points: Vec[]; label?: string; floor?: number };

/** One scenario fact as the player currently knows it. */
export interface FactView {
  id: Id;
  /** Short subject, e.g. 'Second person in the kitchen'. */
  label: string;
  status: KnowledgeStatus;
  /** What the player has been told, in plain words, e.g. 'A neighbour thinks someone else was moving in the kitchen.' */
  claim: string;
  /** Who/what reported it, e.g. 'Neighbour (unverified)'. */
  source: string | null;
  /** Why it matters or what would settle it. */
  note: string | null;
  /** Actions (any stage) that could change this fact. */
  verifyActions: { actionId: Id; title: string; stage: StageId; availableNow: boolean }[];
}

/** A person drawn on the map, only where knowledge allows. */
export interface PersonMark {
  id: Id;
  at: Vec;
  floor?: number;
  /** Role/threat glyph hint for the renderer, only at the knowledge level held: 'subject' | 'civilian' | 'child' | 'patient' | 'dog' | 'unknown'. */
  kind?: string;
  /** Known armament category, if the player knows it. */
  armament?: string | null;
  label: string;
  status: KnowledgeStatus;
  /** Known possessions follow this person's public location, not their hidden position. */
  carried?: PublicCarriedItem[];
  condition?: 'injured' | 'deceased';
}

export interface PublicCarriedItem {
  id: Id;
  label: string;
  glyph: 'phone' | 'document' | 'keys' | 'wheelchair' | 'weapon' | 'tool' | 'item';
  status: 'reported' | 'confirmed';
}

export interface SpaceView {
  id: Id;
  /** Label as the player currently knows it. */
  label: string;
  status: KnowledgeStatus | 'none';
  /** Marker annotation drawn on the map, if any. */
  /** text = the claim in 1–2 words ('MOVEMENT?'), subtext = source ('per neighbour'). */
  marker: { text: string; tone: 'amber' | 'mint'; subtext?: string } | null;
  squadsHere: SquadId[];
  facts: FactView[];
  people: PersonMark[];
  /** Actions that target this space at the current stage. */
  actionIds: Id[];
}

// ---------------------------------------------------------------- game state and commands

/** A generated incident waiting on the board. `id` is the scenario id (see scenario-registry). */
export interface IncidentCard {
  id: Id;
  type: string;
  familyId: Id;
  tier: number;
  arrivedAt: number;
  expiresAt: number;
  seen: boolean;
  /** Content v11+: the first card of a framework this campaign has ever been sent (save v6). */
  newKind?: boolean;
  /** Drawn a tier lower after a run of bad results (sim/player-profile.ts comebackTier); the card
   * says so. */
  eased?: true;
  /** A call the world made (save v19): a warrant served on a lead, or an armed contact the player chose
   * to answer. The subject is cast into the call by name; leads never expire (docs/world-redesign.md). */
  world?: IncidentWorldRef;
}

export interface IncidentWorldRef {
  kind: 'warrant' | 'armed_contact';
  /** The investigation this call serves; its award is paid by the world, once, at close. */
  caseId: Id;
  leadId: Id;
  subjectId: Id;
  caseTier: Tier;
  districtId: DistrictId;
  /** Copied from the start command: what the knowing officer does (see startOperation `tieRole`). Absent
   * reads as 'talk'. */
  tieRole?: 'talk' | 'door';
}

/** Best result on a live call of one recipe. Ranked by completion, then objective, then safety. */
export interface CasebookBest {
  completed: boolean;
  objective: number;
  safety: number;
  /** Debrief objective label, for example 'Resolved' or 'Partial progress'. */
  label: string;
}

/** One recipe met on a live call: framework, situation, pacing and the building type used. */
export interface CasebookRecipe {
  /** Department clock time when a squad was first dispatched to this recipe. */
  firstAt: number;
  best?: CasebookBest;
}

/** Added in save v6. What the campaign has met, for the casebook and unseen-first draws. */
export interface CasebookState {
  /** Frameworks that have arrived on the board, first arrival first. */
  frameworksSeen: string[];
  /** Recipes dispatched on live calls, keyed `type/buildingType/variant/pacing` (content v10+ only). */
  recipes: Record<string, CasebookRecipe>;
}

/** Persisted campaign identities and first-seen builds. No departed officer can be recycled. */
export interface PersonnelState {
  campaignSeed: number;
  catalogVersion: number;
  /** Every person ever employed, including retired and dismissed officers. */
  employedIdentityIds: Id[];
  /** Preserve first-seen builds across refreshes and future balancing changes. */
  builds: Record<Id, Officer>;
}

/** A squad move for an officer who is out on a call, applied when that call closes or is cancelled.
 * A move that no longer holds by then keeps its reason in `dropped` until the player clears it. */
export interface PendingSquadMove {
  officerId: Id;
  squadId: SquadId | null;
  queuedAt: number;
  dropped?: string;
}

export interface GameState {
  /** Named civilian-facing patrol service positions. Never part of tactical squads (save v18). */
  patrol: PatrolState;
  /** Squad moves waiting for a call to end (save v11). Optional for isolated simulation fixtures. */
  pendingSquadMoves?: PendingSquadMove[];
  /** Saved arrangement protections and a mapping-only undo point. */
  squadArrangement?: SquadArrangementState;
  /** Campaign personnel. Optional for isolated simulation fixtures. */
  personnel?: PersonnelState;
  /** Casebook, created on the first board draw. Optional for isolated simulation fixtures. */
  casebook?: CasebookState;
  /** The city: districts, crews, subjects, cases, leads, proactive shifts (save v19). */
  world: WorldState;
  /** Officers as people: records, memory, imprints, bonds, ties (save v19). */
  people: PeopleState;
  /** Command staff, read through commandStaffOf. Optional for isolated simulation fixtures. */
  commandStaff?: CommandStaffState;
  saveVersion: number;
  contentVersion: number;
  department: Department;
  officers: Record<Id, Officer>;
  squads: Squad[];
  candidates: Candidate[];
  /** Every physical item unit, including scrapped/expired history kept for the gear log. */
  units: Record<Id, ItemUnit>;
  reservations: LoadoutReservation[];
  activeRun: OperationRun | null;
  /** Incident board: generated incidents available now, newest first. */
  incidents: IncidentCard[];
  /** Most recent debriefs, newest first, max 10. */
  debriefs: DebriefResult[];
  /** Unacknowledged shift report from the last settlement with meaningful elapsed time. */
  report: ShiftReport | null;
  /** One-time receipt for retired standalone power supplies. */
  /** Monotonic counter for new ids. */
  nextId: number;
  /** Department-level PRNG state for recruit generation. */
  rngState: number;
}

export type Command =
  // department (src/sim/department.ts)
  | { type: 'tick' }
  | { type: 'acknowledgeReport' }
  | { type: 'hire'; candidateId: Id }
  | { type: 'dismiss'; officerId: Id }
  | { type: 'shortlist'; candidateId: Id; on: boolean }
  | { type: 'refreshCandidates' }
  | { type: 'startCourse'; officerId: Id; courseId: Id }
  | { type: 'unlockNode'; nodeId: Id; expectedTier?: number }
  | { type: 'buyItem'; itemId: Id; qty: number }
  | { type: 'createSquad'; name: string }
  | { type: 'renameSquad'; squadId: SquadId; name: string }
  | { type: 'assignToSquad'; officerId: Id; squadId: SquadId | null }
  | { type: 'swapSquadMembers'; officerId: Id; withId: Id }
  | { type: 'cancelPendingSquadMove'; officerId: Id }
  | { type: 'setSquadArrangementLock'; target: SquadArrangementLockTarget; locked: boolean }
  | { type: 'applySquadArrangement'; proposal: SquadArrangementProposal }
  | { type: 'undoSquadArrangement' }
  | { type: 'setLeader'; squadId: SquadId; officerId: Id }
  | { type: 'setSquadDuty'; squadId: SquadId; duty: SquadDuty }
  | { type: 'setLoadoutPreset'; squadId: SquadId; items: Record<Id, number> }
  | { type: 'setRestockRule'; rule: RestockRule | { itemId: Id; remove: true } }
  | { type: 'serviceUnit'; unitId: Id }
  | { type: 'setMaintenanceBudget'; perHour: number }
  | { type: 'scrapUnit'; unitId: Id }
  | { type: 'offerRetention'; officerId: Id }
  | { type: 'startDetail'; officerId: Id }
  | { type: 'markIncidentsSeen' }
  | { type: 'hirePatrol'; profileId: Id }
  | { type: 'dismissPatrol'; employeeId: Id }
  | { type: 'startPatrolTraining'; employeeId: Id }
  | { type: 'activatePatrolBoost'; boostId: Id }
  // command staff (src/sim/command-staff.ts); unlockNode opens a post, hireStaff fills it
  | { type: 'setManagerEnabled'; managerId: ManagerId; enabled: boolean }
  | { type: 'setManagerPolicy'; patch: ManagerPolicyPatch }
  | { type: 'hireStaff'; managerId: ManagerId; candidateId: Id }
  | { type: 'dismissStaff'; managerId: ManagerId }
  | { type: 'refreshStaffPool'; managerId: ManagerId }
  // world (src/sim/world/handlers.ts)
  /** The first session: name the unit and pick the starting district (WorldState.onboarding). */
  | { type: 'foundDepartment'; name: string; districtId: DistrictId }
  | { type: 'setDistrictCoverage'; districtId: DistrictId; units: number }
  | { type: 'openDistrict'; districtId: DistrictId }
  | { type: 'startProactiveShift'; squadId: SquadId; districtId: DistrictId; hours: 2 | 4 | 8 }
  | { type: 'recallProactiveShift'; squadId: SquadId }
  /** Put a warrant card on the board for an open lead with enough intel. */
  | { type: 'openWarrant'; leadId: Id }
  /** Answer an armed contact now as a live call (online only); otherwise it stays a lead. */
  | { type: 'respondToContact'; leadId: Id }
  // people (src/sim/people/handlers.ts)
  | { type: 'decideAftercare'; imprintId: Id; choice: AftercareChoice; partnerId?: Id }
  | { type: 'acknowledgeBeat'; beatId: Id }
  /** The player opened a jacket or report that shows these imprints' telegraphs. */
  | { type: 'markTelegraphSeen'; imprintIds: Id[] }
  // platform
  | { type: 'syncEntitlements'; entitlements: Entitlements }
  // operations (src/sim/operation.ts)
  | {
      type: 'startOperation';
      scenarioId: Id;
      squadIds: SquadId[];
      /** Starting entry / zone per squad. */
      positions: Partial<Record<SquadId, Id>>;
      /** itemId -> qty per squad. */
      loadouts: Partial<Record<SquadId, Record<Id, number>>>;
      /** Optional explicit unit picks per squad; otherwise the best-condition ready units are taken. */
      units?: Partial<Record<SquadId, Id[]>>;
      /** A maximum of one owned vehicle unit, explicitly selected. */
      supportUnitIds?: Id[];
      /** Optional staging point per squad (from derived.stagingPoints); must lie in that squad's position zone. */
      staging?: Partial<Record<SquadId, Id>>;
      /** A world call only: what the officer who knows its subject does. 'talk' (default): leads the contact
       * checks, and the tie contributor applies. 'door': holds the street door and takes no part in contact
       * checks with the subject (recusal), so the contributor never applies. */
      tieRole?: 'talk' | 'door';
    }
  | { type: 'cancelOperation' }
  /** The next decision shows after its result was read (sim/clocks.ts openDither). */
  | { type: 'openDecision'; revision: number }
  /** The app was hidden, or came back, with a decision open: the stall stops and starts with it. */
  | { type: 'pauseDecision'; revision: number }
  | { type: 'resumeDecision'; revision: number }
  | { type: 'endFailedResponse'; runId: Id; revision: number }
  | { type: 'resupplyAction'; actionId: Id; actingSquadIds: SquadId[]; supportSquadIds: SquadId[] }
  /** `leadOfficerId`: the officer the player sends to lead this decision, one of those taking part.
   * Without it the best fit leads (cert holders first, then aptitude). */
  | { type: 'decide'; actionId: Id; actingSquadIds: SquadId[]; supportSquadIds: SquadId[]; leadOfficerId?: Id;
    /** Game minutes the stall cost (sim/clocks.ts openDither); the engine caps it at the open threat. */
    ditherMinutes?: number;
    /** The run revision the choice was made on. When given, a choice made on an older screen is refused. */
    revision?: number }
  /** The open decision point's time ran out with no choice made (sim/clocks.ts lapsedThreat). */
  | { type: 'lapse'; revision: number; threatId: Id }
  | { type: 'closeDebrief' };

export type CommandType = Command['type'];

export interface Ctx {
  /** Wall clock in epoch ms, injected for determinism. */
  now: number;
  /** The descriptors the player keeps off the board (sim/incidents.ts ContentExclusion). The store
   * passes the saved preference; without it the board draws unfiltered. */
  exclusion?: { avoid: readonly ContentDescriptor[] };
  /** The player's call timer setting (ui/settings/prefs.ts), so the engine reads whether a decision
   * point's time has run out at the rate the screen showed. Without it the engine treats the timer
   * as Off: nothing lapses. */
  timer?: import('./timer-setting').TimerSetting;
}

export interface Entitlements {
  /** Department Charter: +25% patrol service grant. */
  charter: boolean;
  /** Night Watch Office: offline funding window 7 days instead of 72 hours. */
  nightWatch: boolean;
}

/** A successful patrol commitment, presented once by the UI and never persisted as a command. */
export interface PatrolReceipt {
  kind: 'hire' | 'dismiss' | 'training' | 'boost';
  employeeId?: Id;
  profileId?: Id;
  boostId?: Id;
  amount: number;
  sequence: number;
  netDelta: number;
  endsAt?: number;
}
export type HandlerResult = { ok: true; patrolReceipt?: PatrolReceipt } | { ok: false; reason: string };

/**
 * Handlers receive a structuredClone draft they may mutate freely. The dispatcher
 * commits the draft only when the handler returns ok: true, so a refused command
 * never mutates state.
 */
export type Handler<T extends CommandType> = (
  draft: GameState,
  cmd: Extract<Command, { type: T }>,
  ctx: Ctx,
) => HandlerResult;

export type HandlerMap<T extends CommandType> = { [K in T]: Handler<K> };

export type DepartmentCommandType =
  | 'setMaintenanceBudget'
  | 'tick'
  | 'acknowledgeReport'
  | 'hire'
  | 'dismiss'
  | 'shortlist'
  | 'refreshCandidates'
  | 'startCourse'
  | 'unlockNode'
  | 'buyItem'
  | 'createSquad'
  | 'renameSquad'
  | 'assignToSquad'
  | 'swapSquadMembers'
  | 'cancelPendingSquadMove'
  | 'startDetail'
  | 'setSquadArrangementLock'
  | 'applySquadArrangement'
  | 'undoSquadArrangement'
  | 'setLeader'
  | 'setSquadDuty'
  | 'setLoadoutPreset'
  | 'setRestockRule'
  | 'serviceUnit'
  | 'scrapUnit'
  | 'offerRetention'
  | 'markIncidentsSeen'
  | 'hirePatrol'
  | 'dismissPatrol'
  | 'startPatrolTraining'
  | 'activatePatrolBoost'
  | 'setManagerEnabled'
  | 'setManagerPolicy'
  | 'hireStaff'
  | 'dismissStaff'
  | 'refreshStaffPool';

export type WorldCommandType = 'foundDepartment' | 'setDistrictCoverage' | 'openDistrict' | 'startProactiveShift' | 'recallProactiveShift' | 'openWarrant' | 'respondToContact' | 'syncEntitlements';

export type PeopleCommandType = 'decideAftercare' | 'acknowledgeBeat' | 'markTelegraphSeen';

export type OperationCommandType = 'startOperation' | 'cancelOperation' | 'openDecision' | 'pauseDecision' | 'resumeDecision' | 'endFailedResponse' | 'decide' | 'lapse' | 'closeDebrief';

export interface SaveEnvelope {
  saveVersion: number;
  contentVersion: number;
  savedAt: number;
  state: GameState;
}
