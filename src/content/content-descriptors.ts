// What a call situation contains, as a closed list (docs/content-rating.md, owner sign-off
// 2026-10-20). Adding a descriptor means editing this list and the design doc's table together,
// never a free-text tag. `matureOnly` marks the ones the Core tier leaves off the board.

export const CONTENT_DESCRIPTORS = [
  'death',
  'suicide_self_harm',
  'injury',
  'police_gunfire',
  'child_at_risk',
  'domestic_violence',
] as const;

export type ContentDescriptor = (typeof CONTENT_DESCRIPTORS)[number];

export const MATURE_ONLY: Readonly<Record<ContentDescriptor, boolean>> = {
  death: true,
  suicide_self_harm: true,
  injury: false,
  police_gunfire: false,
  child_at_risk: true,
  domestic_violence: true,
};

/** Player tiers. A preference, never a store rating, and never ESRB or PEGI names. */
export const CONTENT_TIERS = ['core', 'mature'] as const;
export type ContentTier = (typeof CONTENT_TIERS)[number];
