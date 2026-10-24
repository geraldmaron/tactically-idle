// The numbers of the city's rules, as plain data. They are kept apart from the rules (src/sim/world/) so a
// balance pass reads one file. Design inputs from docs/world-redesign.md; the campaign simulation still has
// to confirm them before they are accepted. All durations are real time (the calendar's game day is not used).
import type { DistrictId, Tier } from '../../sim/world/types';

export const HOUR = 3_600_000;

/** Case award per tier before the crew kind's factor and the funding scale. */
export const CASE_AWARD: Readonly<Record<Tier, number>> = { 1: 100, 2: 600, 3: 2400, 4: 8000 };
/** How long a case stays under review before it closes and pays. */
export const REVIEW_CLOCK_MS: Readonly<Record<Tier, number>> = { 1: HOUR, 2: 3 * HOUR, 3: 6 * HOUR, 4: 12 * HOUR };
/** A later investigation of someone whose earlier one already closed pays this share. */
export const REPEAT_SHARE = 0.25;

export const CONTACT = {
  /** Contacts per productive patrol unit per hour, flat: crime never raises it. */
  npcPerUnitHour: 0.15,
  /** Contacts per SWAT squad on a proactive shift per hour. */
  swatPerHour: 0.3,
  /** Tier weights for tier 1 to 4. Tier 3 from patrol is a sighting. */
  npcTierWeights: [85, 14, 1, 0] as readonly number[],
  swatTierWeights: [50, 35, 13, 2] as readonly number[],
  /** Chance a tier 1 or 2 contact opens a case. */
  npcCaseChance: 0.6,
  swatCaseChance: 0.7,
  /** How far an armed contact stays answerable as a live call. */
  liveWindowMs: 10 * 60_000,
} as const;

export type ResolutionWeights = Readonly<Record<'charged' | 'diverted' | 'care' | 'released' | 'cleared', number>>;
/** The lawful resolution a case is drawn to end in. Charged is likeliest from tier 2 up. */
export const RESOLUTION_WEIGHTS: Readonly<Record<Tier, ResolutionWeights>> = {
  1: { charged: 30, diverted: 25, care: 10, released: 20, cleared: 15 },
  2: { charged: 55, diverted: 15, care: 8, released: 12, cleared: 10 },
  3: { charged: 60, diverted: 12, care: 6, released: 12, cleared: 10 },
  4: { charged: 65, diverted: 10, care: 5, released: 12, cleared: 8 },
};

/** How long someone let go after a case stays out of contact reach. */
export const BACK_AFTER_MS: Readonly<Record<'diverted' | 'care' | 'released' | 'cleared', number>> = {
  diverted: 48 * HOUR,
  care: 72 * HOUR,
  released: 24 * HOUR,
  cleared: 24 * HOUR,
};

export const CRIME = {
  /** Crime drifts toward base + sum(pressure x strength) x perStrength - coverage x perUnit. */
  base: 30,
  perStrength: 0.5,
  perUnit: 2,
  min: 5,
  max: 95,
  /** Share of the gap closed each hour. */
  driftPerHour: 0.05,
  /** A SWAT squad on a proactive shift counts as this many patrol units of coverage. */
  shiftCoverage: 2,
  stepDown: { 1: 0.3, 2: 1, 3: 4, 4: 12 } as Readonly<Record<Tier, number>>,
  collapseDrop: 10,
} as const;

export const ALLOCATION = { floor: 0.8, ceiling: 1.25, centre: 50, slope: 100, charterFactor: 1.25 } as const;

export const SHIFT = {
  hours: [2, 4, 8] as readonly number[],
  /** Funding per squad-hour before the funding scale. */
  grantPerHour: 200,
  /** Every member must start below this stress. */
  startBelow: 52,
  /** The shift stops when any member would reach 60 within the next hour. */
  stopAt: 58,
  maxHoursPerDay: 8,
  /** The strain stop is found on this grid, so every way of settling the same time agrees on it. */
  strainGridMs: 60_000,
} as const;

/** A crew whose head was taken forms a successor after this long. */
export const SUCCESSOR_DELAY_MS = 7 * 24 * HOUR;
/** Share of a whole roster a successor crew starts with. */
export const SUCCESSOR_START_SHARE = 0.5;
/** How a member's weight counts toward crew strength, tier 1 to 4. */
export const TIER_WEIGHT: Readonly<Record<Tier, number>> = { 1: 1, 2: 2, 3: 5, 4: 12 };
export const EVENT_CAP = 200;
export const STOPPED_SHIFTS_KEPT = 8;
/** Subject history entries kept per person. */
export const HISTORY_CAP = 12;

/** The order districts are processed in each hour. */
export const DISTRICT_ORDER: readonly DistrictId[] = ['pike', 'larkin', 'harbor', 'eastgate', 'oldmill'];
