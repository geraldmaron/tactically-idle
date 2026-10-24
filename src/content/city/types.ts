// Definitions for the city (docs/world-redesign.md, "Crews: archetypes, tiers and subjects"). A new kind of
// crew or a new district is data here, not code in src/sim/world/. Nothing in these records says anything
// about culture, ethnicity or nationality: crews are defined by what they do, districts by their streets.
import type { CrewArchetypeId, DistrictId } from '../../sim/world/types';

/** A crew a district starts with when it opens. */
export interface CrewSeed {
  archetype: CrewArchetypeId;
  name: string;
}

export interface DistrictDef {
  id: DistrictId;
  name: string;
  /** One plain sentence about the place, for the district sheet. */
  blurb: string;
  /** The department level that opens this district. */
  openAtLevel: number;
  /** A district a new department can choose as its first (founding). */
  startable?: true;
  /** Crime when the district opens, 0..100. */
  startCrime: number;
  /** Crews working it from the day it opens. */
  crews: readonly CrewSeed[];
  /** Named neighbors and businesses that appear in the radio and the reports for reasons that have nothing
   * to do with crime. */
  residents: readonly string[];
}

export interface CrewArchetype {
  id: CrewArchetypeId;
  label: string;
  /** What each tier is called, tier 1 first. */
  tierNames: readonly [string, string, string, string];
  /** Multiplies the case award of every tier. */
  awardFactor: number;
  /** Relative chance that a contact in a district meets this kind of crew, against the others there. */
  contactWeight: number;
  /** Chance that a SWAT contact with a tier 3 or 4 member is armed and can be answered live. */
  escalation: Readonly<{ 3: number; 4: number }>;
  /** Intel a tier 3 member (3) and the tier 4 member (4) need before a lead opens on them. */
  intelNeeded: Readonly<{ 3: number; 4: number }>;
  /** Intel one closed case adds toward the next rung: tier 1 and 2 cases toward a tier 3 member, a tier 3
   * case toward the tier 4 member. */
  intelPerCase: Readonly<{ 1: number; 2: number; 3: number }>;
  /** How hard the crew pushes crime up at full strength (multiplies strength in the crime target). */
  crimePressure: number;
  /** New members per day at each of tier 1 to 3 while the crew is short, at full strength. */
  recruitPerDay: Readonly<{ 1: number; 2: number; 3: number }>;
  /** People at each tier when the crew is whole. */
  members: readonly [number, number, number, number];
  /** Names a successor crew can take after this kind of crew collapses. */
  successorNames: readonly string[];
}
