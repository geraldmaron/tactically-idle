// What a call situation contains, as a closed list (docs/content-rating.md, owner sign-off
// 2026-10-20). Adding a descriptor means editing this list and the design doc's table together,
// never a free-text tag. Every descriptor can warn; only the avoidable themes filter the board.

export const CONTENT_DESCRIPTORS = [
  'death',
  'suicide_self_harm',
  'injury',
  'police_gunfire',
  'child_at_risk',
  'domestic_violence',
] as const;

export type ContentDescriptor = (typeof CONTENT_DESCRIPTORS)[number];

/** The themes a player can keep off the board (owner decision 2026-10-20, after Xbox Accessibility
 * Guideline 123). death, injury and police_gunfire are mechanics every kind of call carries, so
 * they warn but never filter: avoiding them would empty the board. */
export const AVOIDABLE_THEMES = ['suicide_self_harm', 'child_at_risk', 'domestic_violence'] as const satisfies readonly ContentDescriptor[];
export type AvoidableTheme = (typeof AVOIDABLE_THEMES)[number];
