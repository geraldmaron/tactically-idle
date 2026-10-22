// What the rendered gates walk and what they hold the UI to. One place, owner-tunable: the thresholds
// below are the budgets the rules use, and STATES is the manifest rule R17 checks the walk against.

export const WIDTHS = [320, 390, 430];
/** Viewport heights per width, as the capture tool has always used them. */
export const HEIGHTS = { 320: 568, 390: 844, 430: 932 };
/** Every capture draws the same campaign: the sim's one random draw is pinned, and so is the clock. */
export const CAMPAIGN_SEED = 41041;
export const FIXED_TIME = '2026-10-22T09:00:00';

/** What the page-side probe measures against. */
export const PROBE_CFG = {
  floorPx: 12,        // R7: no text under this
  controlPx: 14,      // R7: controls and decisions read at this or more
  touch: 44,          // R6: effective hit region, in CSS px
  chipInset: 4,       // R15: text to a chip's inner border, top and bottom
  flushInset: 2,      // R2: content to the border of the card around it
  textContrast: 4.5,  // R14: normal text
  largeContrast: 3,   // R14: large text and essential non-text controls
  iconSizes: [16, 20, 24], // R9 rendered
};

/** R13: the safe-area fixtures. env(safe-area-inset-*) is overridden through the DevTools protocol. */
export const INSET_FIXTURES = {
  bottom: { top: 47, right: 0, bottom: 34, left: 0 },
  side: { top: 0, right: 44, bottom: 0, left: 44 },
};

/**
 * R16, owner-tunable. At each width, the first choice on a live stage must show its title in the first
 * viewport ('title'), or else a visible "choices below" affordance ('title-or-affordance'). The affordance
 * is any element with `data-choices-below`.
 */
export const FIRST_CHOICE_BUDGET = { 320: 'title-or-affordance', 390: 'title', 430: 'title' };

/**
 * R17: every surface and state the walk must capture, at every width. `decision` marks the live stages
 * R16 measures. `kind` says what R2 and R12 treat as the active surface.
 */
export const STATES = [
  { id: '01-first-run', kind: 'screen' },
  { id: '02-hq', kind: 'screen' },
  { id: '03-finance-sheet', kind: 'sheet' },
  { id: '03b-level-sheet', kind: 'sheet' },
  { id: '04-command-staff-sheet', kind: 'sheet' },
  { id: '05-squad', kind: 'screen' },
  { id: '06-officer-sheet', kind: 'sheet' },
  { id: '06-officer-sheet-career', kind: 'sheet' },
  { id: '06-officer-sheet-care', kind: 'sheet' },
  { id: '07-arrange-sheet', kind: 'sheet' },
  { id: '08-hire', kind: 'screen' },
  { id: '08-recruit-card', kind: 'screen' },
  { id: '08-hire-contract-sheet', kind: 'sheet' },
  { id: '09-training', kind: 'screen' },
  { id: '10-develop', kind: 'screen' },
  { id: '11-develop-sheet', kind: 'sheet' },
  { id: '12-gear', kind: 'screen' },
  { id: '13-gear-item-sheet', kind: 'sheet' },
  { id: '14-restock-sheet', kind: 'sheet' },
  { id: '15-presets-sheet', kind: 'sheet' },
  { id: '16-menu-sheet', kind: 'sheet' },
  { id: '17-themes-page', kind: 'sheet' },
  { id: '16b-saves-sheet', kind: 'sheet' },
  { id: '18-board', kind: 'screen' },
  { id: '19-prepare-brief', kind: 'screen' },
  { id: '19b-brief-map-sheet', kind: 'sheet' },
  { id: '20-prepare-team-empty', kind: 'screen' },
  { id: '21-prepare-team-picked', kind: 'screen' },
  { id: '22-live-decide-1', kind: 'screen', decision: true },
  { id: '22b-live-full-map', kind: 'sheet' },
  { id: '23-review-sheet', kind: 'sheet' },
  { id: '24-result-beat', kind: 'screen' },
  { id: '25-live-decide-2', kind: 'screen', decision: true },
  { id: '25-live-decide-3', kind: 'screen', decision: true },
  { id: '26-debrief', kind: 'screen' },
  { id: '27-board-after', kind: 'screen' },
  { id: '28-hq-after-call', kind: 'screen' },
  // States Astra's audit could not see: tools after their unlock, and the save error.
  { id: '29-restock-unlocked-sheet', kind: 'sheet' },
  { id: '30-presets-unlocked-sheet', kind: 'sheet' },
  { id: '31-saves-error', kind: 'sheet' },
];

export const stateIds = () => STATES.map((s) => s.id);
