// What a call situation contains, as a closed list (docs/content-rating.md, owner sign-off
// 2026-10-20). Adding a descriptor means editing this list and the design doc's table together,
// never a free-text tag. Every descriptor can warn, and every one can be switched off the board
// (owner decision 2026-10-20), unless that would leave no kind of call to draw (ui/settings/avoidable.ts).

export const CONTENT_DESCRIPTORS = [
  'death',
  'suicide_self_harm',
  'injury',
  'police_gunfire',
  'child_at_risk',
  'domestic_violence',
] as const;

export type ContentDescriptor = (typeof CONTENT_DESCRIPTORS)[number];
