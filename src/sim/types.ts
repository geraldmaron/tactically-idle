// Shared records for the Tactically Idle first playable.
// FROZEN CONTRACT: parallel modules build against these shapes. Module-specific
// types belong in the owning module's file, not here.
// Units: geometry in feet (y grows downward), time in epoch milliseconds for the
// department clock, and abstract "operation minutes" inside an operation run.

import type { SquadArrangementLockTarget, SquadArrangementProposal, SquadArrangementState } from './squad-optimizer';

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
  | { kind: 'operation'; runId: Id };

export interface Officer {
  id: Id;
  /** Stable authored person; absent on legacy procedurally generated officers. */
  identityId?: string;
  firstName: string;
  surname: string;
  role: Role;
  /** Authored portrait path, or a preserved legacy portrait key. */
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
  career: { operations: number; favorable: number; adverse: number };
  /** Announced retirement; the officer leaves on `day`. Forecastable, never instant. */
  retirement: { day: number; reason: 'age' | 'service' | 'burnout'; announcedDay: number; extended: boolean } | null;
  /** XP already converted into rating growth. */
  xpBanked?: number;
  /** Epoch ms when stress last rose above the burnout threshold and stayed there. */
  highStressSince?: number | null;
  /** Newest debrief run id already counted into `career`. */
  lastRunCounted?: string | null;
}

export interface Candidate {
  id: Id;
  officer: Officer; // squadId null, assignment null
  signingCost: number;
  shortlisted: boolean;
  expiresAt: number;
}

/** Up to four persistent squads (owner decision, 2026-10-02). */
export type SquadId = 'A' | 'B' | 'C' | 'D';
export const SQUAD_IDS: readonly SquadId[] = ['A', 'B', 'C', 'D'];
/** Squad duty when not deployed. patrol earns routine funding; rest speeds recovery. */
export type SquadDuty = 'patrol' | 'standby' | 'rest';

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
  | { kind: 'candidatePool'; delta: number };

export interface DevelopmentTier {
  /** Incremental purchase price; effects are the total benefit at this tier. */
  cost: { dp: number; funding: number };
  effects: NodeEffect[];
}

export interface DevelopmentNode {
  id: Id;
  branch: DevBranch;
  name: string;
  description: string;
  cost: { dp: number; funding: number };
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

export interface Department {
  name: string;
  funding: number;
  devPoints: number;
  /** Standing, 0..100. Not spendable. */
  trust: number;
  level: number;
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
  devPoints: number;
  completedCourses: { officerId: Id; courseId: Id }[];
  recovered: Id[];
  shortages: string[];
  capped: boolean;
  /** Units that crossed into unreliable/failed/expired, and servicing that finished. */
  equipment: { unitId: Id; event: 'unreliable' | 'failed' | 'expired' | 'serviced' }[];
  /** Retirements announced or completed, birthdays/anniversaries that changed wages. */
  personnel: { officerId: Id; event: 'retirement_announced' | 'retired' | 'anniversary' | 'birthday'; detail: string }[];
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
    | 'pressure';
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
    /** V5 opening changes resolved against the route actually used, in committed order. */
    openingChanges?: { openingId: Id; state: OpeningState }[];
  };
  /** Run revision this decision was applied to. */
  revision: number;
  stage: StageId;
  actionId: Id;
  actingSquadIds: SquadId[];
  supportSquadIds: SquadId[];
  officerIds: Id[];
  targetId: Id | null;
  inputs: Contributor[];
  score: number;
  difficulty: number;
  /** Saved uniform sample in [0,1); never rerolled. */
  sample: number;
  band: OutcomeBand;
  timeCost: number;
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

export interface OperationRun {
  id: Id;
  scenarioId: Id;
  scenarioVersion: number;
  /** Unstarted generated card, retained so cancelling deployment can restore it. */
  sourceIncident?: IncidentCard;
  locationFamilyId: Id;
  locationSeed: number;
  contentVersion: number;
  /** Seeded PRNG state; advanced only when a decision is committed. */
  rngState: number;
  practice: boolean;
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
  /** 0..100 situation pressure. */
  pressure: number;
  /** 0..100 progress toward the objective. */
  objective: number;
  /** 0..100 civilian safety. */
  civilianSafety: number;
  history: DecisionResolution[];
  /** Free compatibility navigation; separate from scored decisions and RNG samples. */
  stageContinuations?: StageContinuationRecord[];
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
}

export interface StageContinuationRecord {
  version: 1;
  actionId: Id;
  revision: number;
  fromStage: 'adapt';
  toStage: 'resolve';
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

export interface StageContinuationView extends Omit<StageContinuationRecord, 'version'> {
  label: string;
  description: string;
}

export interface DebriefResult {
  runId: Id;
  scenarioId: Id;
  endingId: Id;
  endingTitle: string;
  /** Absent only in older saved debriefs. */
  endingSummary?: string;
  /** Saved disposition and receiver evidence survive future content updates. */
  disposition?: CompletionDisposition;
  completionAchieved?: boolean;
  remainingTasks?: string[];
  receivingService?: { id: Id; label: string; kind: string; acceptedAt: number };
  officerCasualties?: OfficerCasualtyRecord[];
  civilianOutcomes?: CivilianOutcomeView[];
  personCasualties?: PersonCasualtyRecord[];
  /** Detached complete decision log; absent from previously closed legacy debriefs. */
  decisions?: DecisionView[];
  practice: boolean;
  objective: { score: number; label: string };
  civilianSafety: { score: number; label: string };
  officerCondition: { officerId: Id; stressBefore: number; stressAfter: number; xpGained: number }[];
  informationPreserved: { factId: Id; label: string; status: KnowledgeStatus }[];
  resources: { itemId: Id; used: number; returned: number }[];
  /** Per-unit condition change from this run. */
  unitWear: { unitId: Id; itemId: Id; serial: string; before: number; after: number }[];
  trustDelta: number;
  fundingReward: number;
  devPointReward: number;
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
  /** Department clock time; practice records never change the real officer. */
  recoveryUntil: number;
}

export interface CivilianOutcomeView {
  id: Id;
  label: string;
  status: 'unaccounted' | 'needs_help' | 'safe' | 'injured_needs_care' | 'care_accepted' | 'accounted_elsewhere' | 'deceased';
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
  actionId: Id;
  title: string;
  stageLabel: string;
  band: OutcomeBand;
  resultLabel?: string;
  /** Present for current committed records; absence keeps legacy prose fallback. */
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
  endingTitle: string | null;
}

export interface ActionView {
  forceRisk?: ForceRiskPreview;
  /** Common event across effort bands: authored explicitly or proven by identical v6 effect tables. */
  eventResult?: string;
  likelihood: Record<OutcomeBand, number>;
  suppliesRequired: { label: string; qty: number }[];
  outcomePreview: Record<OutcomeBand, string>;
  consequenceLevel: RiskBand;
  /** Conservative public duration bounds, including possible outcome delays. */
  timeRange: { min: number; max: number };
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

export interface GameState {
  /** Saved arrangement protections and a mapping-only undo point. */
  squadArrangement?: SquadArrangementState;
  /** Added in save v4. Optional only for historical test fixtures and migration inputs. */
  personnel?: PersonnelState;
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
  equipmentPowerUpgrade?: { retiredUnits: number; refundedFunding: number };
  /** Monotonic counter for new ids. */
  nextId: number;
  /** Department-level PRNG state for recruit generation. */
  rngState: number;
}

export type Command =
  // department (src/sim/department.ts)
  | { type: 'tick' }
  | { type: 'acknowledgeReport' }
  | { type: 'acknowledgePowerUpgrade' }
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
  | { type: 'markIncidentsSeen' }
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
      practice: boolean;
    }
  | { type: 'cancelOperation' }
  | { type: 'endFailedResponse'; runId: Id; revision: number }
  | { type: 'resupplyAction'; actionId: Id; actingSquadIds: SquadId[]; supportSquadIds: SquadId[] }
  | { type: 'decide'; actionId: Id; actingSquadIds: SquadId[]; supportSquadIds: SquadId[] }
  | { type: 'continueStage'; actionId: Id; revision: number }
  | { type: 'closeDebrief' };

export type CommandType = Command['type'];

export interface Ctx {
  /** Wall clock in epoch ms, injected for determinism. */
  now: number;
}

export type HandlerResult = { ok: true } | { ok: false; reason: string };

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
  | 'acknowledgePowerUpgrade'
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
  | 'markIncidentsSeen';

export type OperationCommandType = 'startOperation' | 'cancelOperation' | 'endFailedResponse' | 'decide' | 'continueStage' | 'closeDebrief';

export interface SaveEnvelope {
  saveVersion: number;
  contentVersion: number;
  savedAt: number;
  state: GameState;
}
