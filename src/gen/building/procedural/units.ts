/**
 * Interior connectivity policy. On every floor each room must be reachable from the front-door room
 * (ground floor) or the stair head (upper floor) through interior openings alone, without passing
 * through a leaf room (a bedroom only opens onto its own ensuite). The outside never counts as a route:
 * a kitchen you can only enter from the back yard is a defect, not a second approach.
 *
 * The one exception is a separate unit: rooms a family deliberately gives their own street door and
 * keeps apart from the main premises. A unit is rooted at an entry room (by room key) that holds an
 * exterior door; it may contain only its listed member keys (plus ensuites of its rooms) and, with
 * `upstairs`, the whole upper floor. Any room outside the main premises and outside a unit is a FAIL
 * in plausibility.ts, and openings.ts grows the main tree from the front room alone, so the old
 * multi-root forest (every exterior-door room a root) cannot come back.
 */
export interface UnitRule {
  /** Room key of the unit's entrance room; it must hold an exterior door to count. */
  entry: string;
  /** Room keys that may belong to the unit besides its entry (ensuites follow their bedroom). */
  members: string[];
  /** The whole upper floor belongs to the unit (reached by a stair inside it). */
  upstairs: boolean;
}

/** Separate units by family spec id. Families not listed have none: one building, one front door. */
export const SEPARATE_UNITS: Record<string, UnitRule[]> = {
  // Every guest room opens onto the walkway and is a unit of its own; its ensuite opens off it.
  motel_row: [{ entry: 'unit', members: ['bath'], upstairs: false }],
  // The apartment above the store has its own street door into the hall at the stair foot. The
  // stockroom, back office and restroom belong to the shop and must be reached from the sales floor.
  corner_store_flat: [{ entry: 'hall', members: ['stair', 'storage'], upstairs: true }],
};

export const unitsOf = (familyId: string): UnitRule[] => SEPARATE_UNITS[familyId.replace(/_g\d+$/, '')] ?? [];
