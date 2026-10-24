// The world's saved records (docs/world-redesign.md, "The world model"). Kernel: records only, no rules.
// Definitions (districts, crew archetypes) are content in src/content/city/; rules are in
// src/sim/world/. Determinism contract (sol challenge, 2026-10-24):
// - Hourly rolls for hour h run exactly at the boundary (h + 1) x 3,600,000 inside economy.settle's walk
//   (nextWorldEventTime always offers the next boundary), after that boundary's other due events, using the
//   state at that moment. Commands land between walks, so a coverage change counts from the next boundary.
// - Every draw is hashSeed(`${seed}:${kind}:${h}:${unitOrShiftId}:${index}`): per patrol employee id and
//   per shift id, never the department rng, so online play, offline settlement and any tick partition agree.
// - Ids are namespaced counters from nextId: subjects `s<n>`, crews `k<n>`, cases `c<n>`, leads `l<n>`,
//   shifts `p<n>`, events `e<n>`.
// - A shift stops at one stored time (`strainAt` from its start, else `endsAt`), never from stress sampled at
//   a tick; its roster (`officerIds`) is fixed at the start and is who memories, bonds and cases name. The
//   boundary that stops it releases its officers and processes any retirement waiting on them (economy.settle).
// - A world call pays its fee once per investigation (`WorldCase.feePaidRunId`).
// - Funding and the world have separate windows: hourly opportunities (contacts, crime drift, recruitment)
//   stop at lastInteractionAt + worldCapMs whatever is owned; a case already under review still closes and
//   pays at its time (earned work), and no purchase adds a contact, a lead or an investigation.

/** Ids are stable strings; the union keeps the five authored districts. */
export type DistrictId = 'pike' | 'larkin' | 'harbor' | 'eastgate' | 'oldmill';
export const DISTRICT_IDS: readonly DistrictId[] = ['pike', 'larkin', 'harbor', 'eastgate', 'oldmill'];

export type CrewArchetypeId = 'street_crew' | 'syndicate' | 'theft_ring' | 'supply_network';
export type Tier = 1 | 2 | 3 | 4;
export type Pronouns = 'she' | 'he' | 'they';

export interface DistrictState {
  id: DistrictId;
  open: boolean;
  /** 0..100, one decimal. */
  crime: number;
  /** Patrol employees the player assigned here. Unassigned productive staff cover the home district. */
  patrolUnits: number;
  openedAt: number | null;
}

export interface Crew {
  id: string;
  archetype: CrewArchetypeId;
  name: string;
  districtId: DistrictId;
  /** 0..100: drives crime pressure and recruitment. */
  strength: number;
  status: 'active' | 'collapsed';
  formedAt: number;
  collapsedAt?: number;
  /** Intel toward each tier 3 and 4 member, 0..required (src/content/city/archetypes.ts). */
  intel: Record<string, number>;
}

export type SubjectStatus = 'free' | 'held' | 'resolved' | 'gone';
export type SubjectTrait = 'talks' | 'loyal' | 'volatile' | 'careful';

export interface SubjectEvent {
  at: number;
  kind: 'stopped' | 'case_opened' | 'case_closed' | 'released' | 'sighted' | 'lead' | 'warrant_served';
  caseId?: string;
  leadId?: string;
}

export interface Subject {
  id: string;
  firstName: string;
  surname: string;
  pronouns: Pronouns;
  /** Indices into the civilian name pools (content/call-trees/civilian-names.ts: first names by pronouns,
   * surnames), so a warrant call's incident id can carry this identity and regenerate it exactly. */
  nameKey: { first: number; last: number };
  crewId: string | null;
  tier: Tier;
  districtId: DistrictId;
  status: SubjectStatus;
  traits: SubjectTrait[];
  /** The player has seen this person (a contact, a case, a lead): the dossier exists. */
  known: boolean;
  /** One contact at a time: a subject in an open case or a served lead is reserved by it. */
  reservedBy: string | null;
  /** Free again from this time after a resolution that let them go (released, diverted, cleared). */
  backAt?: number;
  /** Newest last, capped (src/sim/world/subjects.ts). */
  history: SubjectEvent[];
}

export type CaseResolution = 'charged' | 'diverted' | 'care' | 'released' | 'cleared';
export type CaseSource = 'patrol' | 'proactive' | 'call' | 'warrant';

/** One investigation of one person. A contact opens it; a lead and a warrant call carry its id; it pays its
 * award once, at close, whatever lawful resolution ends it. A later contact with the same person after it
 * closed is a new investigation that pays the repeat share. */
export interface WorldCase {
  id: string;
  subjectId: string;
  crewId: string | null;
  archetype: CrewArchetypeId | null;
  tier: Tier;
  districtId: DistrictId;
  source: CaseSource;
  openedAt: number;
  /** `open`: a tier 3 or 4 investigation waiting on a warrant (no clock yet). `review`: closes at `closesAt`.
   * `closed`: resolved and paid. */
  status: 'open' | 'review' | 'closed';
  /** Review clock end; set when the case enters review. */
  closesAt: number | null;
  /** A second or later investigation of this person: pays the repeat share. */
  repeat: boolean;
  /** Decided when the case opens (seeded), revealed at close. Every lawful resolution pays the same. */
  resolution: CaseResolution;
  /** Funding paid at close: tier award x archetype factor x funding scale at opening. Paid once. */
  award: number;
  paidAt?: number;
  /** The WorldEvent id of the payment; set once, never cleared. */
  paidEventId?: string;
  /** SWAT officers who worked it (proactive, call or warrant), for memory facts and ties. */
  officerIds: string[];
  /** The run whose debrief paid the call fee for this investigation. A world call pays its fee once per
   * investigation: a reopened warrant (an escape, or a lead held open) plays for the case and pays nothing
   * more. Optional; absent until a call on it has closed. */
  feePaidRunId?: string;
}

export type LeadSource = 'sighting' | 'proactive' | 'intel' | 'armed_contact';

export interface Lead {
  id: string;
  /** The investigation this lead belongs to. */
  caseId: string;
  subjectId: string;
  crewId: string | null;
  districtId: DistrictId;
  tier: Tier;
  foundAt: number;
  source: LeadSource;
  /** Leads never expire. `warrant` while its card is on the board or its call runs; back to `open` if the
   * card goes or the call is cancelled; `served` once its call's debrief closes. */
  status: 'open' | 'warrant' | 'served';
  cardId?: string;
  /** An armed contact found while the player was here can be answered live until this time; after it, the
   * lead waits like any other. */
  liveUntil?: number;
}

export interface ProactiveShift {
  id: string;
  squadId: 'A' | 'B' | 'C' | 'D';
  districtId: DistrictId;
  startedAt: number;
  endsAt: number;
  /** Set when the shift stops: its own end, a recall, or someone reaching the stop threshold. */
  stoppedAt?: number;
  stopReason?: 'ended' | 'recalled' | 'strain';
  /** The officers who rode the shift, recorded when it starts and never changed: membership moves are
   * refused while it is active, and memories, cases and bonds read this list, not the squad or the
   * assignments (which are cleared before the last boundary's roll). Optional for older saves. */
  officerIds?: string[];
  /** The one time the shift stops for strain: when its most strained member would reach the stop line at the
   * flat proactive rate, on the minute grid, computed at the start. Absent when the shift ends first. Every
   * way of settling the same span stops at this time, whatever the tick size. */
  strainAt?: number;
  contacts: number;
  caseIds: string[];
  leadIds: string[];
}

export type WorldEventKind =
  | 'contact' | 'case_opened' | 'case_closed' | 'lead' | 'crew_collapsed' | 'crew_formed'
  | 'district_opened' | 'shift_started' | 'shift_ended';

/** The radio and the return report read these. No prose is stored: the UI words them from the fields. */
export interface WorldEvent {
  id: string;
  at: number;
  kind: WorldEventKind;
  districtId?: DistrictId;
  subjectId?: string;
  caseId?: string;
  leadId?: string;
  crewId?: string;
  squadId?: 'A' | 'B' | 'C' | 'D';
  /** Patrol unit call sign number for NPC contacts. */
  unit?: number;
  tier?: Tier;
  amount?: number;
}

export interface WorldState {
  /** From the campaign seed; every draw derives from it. */
  seed: number;
  districts: Record<DistrictId, DistrictState>;
  crews: Crew[];
  subjects: Record<string, Subject>;
  cases: WorldCase[];
  leads: Lead[];
  /** Active shifts and the last few stopped ones. */
  shifts: ProactiveShift[];
  /** Newest last, capped (src/sim/world/events.ts). */
  events: WorldEvent[];
  /** Absolute hour index (floor(ms / 3,600,000)) through which hourly rolls have been made. */
  rolledThroughHour: number;
  nextId: number;
  /** The first-session journey, persisted per campaign (not a browser setting). */
  onboarding: Onboarding;
  /** The district the department was founded in: patrol hires start there and coverage taken off other
   * districts returns there. Optional; absent means Pike Street (the first district). */
  home?: DistrictId;
}

export interface Onboarding {
  /** cold_open: the first call has not closed. founding: name the unit and pick the district. first_shift:
   * the scripted first contact's case is open (`firstCaseId`). first_return: waiting for the first return
   * after time away. done: proactive shifts and the rest are open. */
  stage: 'cold_open' | 'founding' | 'first_shift' | 'first_return' | 'done';
  firstCaseId?: string;
  /** The real time the first shift began, for the first-return check. */
  firstShiftAt?: number;
}
