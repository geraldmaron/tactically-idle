// The world's saved records (docs/world-redesign.md, "The world model"). Kernel: records only, no rules.
// Definitions (districts, crew archetypes) are content in src/content/city/; rules are in
// src/sim/world/. Every random draw is keyed by (save seed, district, hour index, draw kind, index), so
// online play and offline settlement produce the same world.

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

export interface WorldCase {
  id: string;
  subjectId: string;
  crewId: string | null;
  archetype: CrewArchetypeId | null;
  tier: Tier;
  districtId: DistrictId;
  source: CaseSource;
  openedAt: number;
  /** Review clock end; the case closes and pays at this time. */
  closesAt: number;
  status: 'review' | 'closed';
  /** Decided when the case opens (seeded), revealed at close. Every lawful resolution pays the same. */
  resolution: CaseResolution;
  /** Funding paid at close: tier award x archetype factor x funding scale at opening. Paid once. */
  award: number;
  paidAt?: number;
  /** SWAT officers who worked it (proactive, call or warrant), for memory facts and ties. */
  officerIds: string[];
}

export type LeadSource = 'sighting' | 'proactive' | 'intel' | 'armed_contact';

export interface Lead {
  id: string;
  subjectId: string;
  crewId: string | null;
  districtId: DistrictId;
  tier: Tier;
  foundAt: number;
  source: LeadSource;
  /** Leads never expire. `warrant` once a card is on the board, `served` after its call closes. */
  status: 'open' | 'warrant' | 'served';
  cardId?: string;
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
  /** The scripted first contact has run (first session teaching moment). */
  firstContactDone: boolean;
}
