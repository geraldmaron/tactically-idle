// Tuning for the people layer. A plain table, not a registered tunable (sim/tuning.ts), so the lead can
// wrap it with tunable() and list it in tuning-tables.ts when the build merges. Times are real
// milliseconds; the calendar runs one game day per real hour, so 7 game days is 7 hours.
export const HOUR_MS = 3_600_000;

export const PEOPLE_TUNING = {
  /** A dismissed officer can be hired again this long after they left (7 game days). */
  rehireCooldownMs: 7 * HOUR_MS,
  /** Page 2 of a jacket opens after this many operations worked beside the same colleague. */
  page2After: 4,
  /** A shift that served less than this leaves no memory and moves no bond (a recall at once). */
  shiftMinServedMs: 15 * 60_000,
  /** Service at which a shift counts in full for bonds (the shortest shift): less scales down in proportion. */
  shiftFullServedMs: 2 * HOUR_MS,
  /** Newest facts kept per officer; older ones fall off. */
  factsPerOfficer: 40,
  /** Beats kept: every unacknowledged one, and this many newest acknowledged ones. */
  acknowledgedBeatsKept: 20,
  /** Situation pressure (0 to 100) that counts as high on a favorable call. */
  highPressure: 50,
  /** Stress bands the triggers read (STRESS_BANDS in sim/officer.ts: overloaded 60, recovery 80). */
  overloadedStress: 60,
  criticalStress: 80,
  /** Settled traits per officer, and one settled strain per officer in this window (a game week). */
  settledCap: 3,
  strainWindowMs: 7 * HOUR_MS,
  /** A settled strain eases after this long (21 game days) and drops off the jacket. */
  strainEasesAfterMs: 21 * HOUR_MS,
  bond: {
    /** Hidden drift needed to move up from each state. */
    upAt: { acquainted: 40, trusted: 80 },
    /** Drift added by a shared call that went well, mixed, and a shared shift. Adverse adds nothing: only a
     * recorded cause drags a bond down. */
    gain: { favorable: 12, mixed: 4, adverse: 0, shift: 6 },
    /** A shift that stopped for strain drags the pair down a little. */
    shiftStrain: -12,
    /** Causes that drag a bond down, as drift. */
    cause: { rear_left_open: -35, promotion: -35 },
    /** Drift at or below this moves a bond to tense, and again to strained. */
    tenseAt: -30,
    strainedAt: -30,
    /** Drift at or above this repairs tense to acquainted, and strained to tense. */
    repairTenseAt: 30,
    repairStrainedAt: 50,
    /** A tense bond eases to acquainted after this long (12 game days). */
    tenseEasesAfterMs: 12 * HOUR_MS,
    /** A mentor bond needs this many shared operations and a rank gap of at least one. */
    mentorShared: 3,
    mentorRankGap: 1,
  },
  romance: {
    /** The share of eligible close pairs that are inclined (a fixed draw per pair, never rerolled). */
    inclined: 0.4,
    /** A pair must have been close this long first (12 game days). */
    closeForMs: 12 * HOUR_MS,
  },
  ties: {
    /** The share of subjects from an officer's home district that the officer knows, up to `cap` ties. */
    share: 0.15,
    cap: 3,
    /** The share of jacket ties that start off the record and surface later as a beat. */
    hiddenShare: 0.25,
  },
  /** The coordination contributor for shared actions: small, capped, visible. */
  contributor: { trusted: 1, close: 2, mentor: 2, tense: -1, strained: -2, cap: 3 },
} as const;
