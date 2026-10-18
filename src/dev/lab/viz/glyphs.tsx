// The lab's glyph set (spec 4.4): inline SVG on a 16 px grid, drawn in currentColor, 12 to 14 px on
// screen. Color never carries a meaning alone, so each meaning has its own shape and the wrappers
// below always give it a name for assistive tech and hover.
import type { ReactNode } from 'react';
import type { Weight } from '../../../gen/incident/trees-v13/balance';
import type { OutcomeBand } from '../../../sim/types';
import { weightLabel } from '../model/label';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = { fill: 'currentColor', stroke: 'none' } as const;

const SHAPES = {
  // result bands
  well: <path {...S} d="M3.5 10.5 8 6l4.5 4.5" />,
  mixed: <path {...S} d="M3.5 8h9" />,
  badly: <path {...S} d="M3.5 5.5 8 10l4.5-4.5" />,
  // run classes (trees-v13/balance.ts Weight)
  clean: <path {...S} d="m3.5 8.5 3 3 6-7" />,
  costly: <><circle {...S} cx="8" cy="8" r="5" /><path {...F} d="M8 3a5 5 0 0 0 0 10z" /></>,
  unresolved: <circle {...S} cx="8" cy="8" r="5" strokeDasharray="2.4 2.1" />,
  hurt: <path {...S} strokeWidth={2} d="M8 3.5v9M3.5 8h9" />,
  death: <path {...S} d="M8 2v12M4.8 5.5h6.4" />,
  // engine marks
  drawn: <><rect {...S} x="2.5" y="2.5" width="11" height="11" rx="2.2" /><circle {...F} cx="5.8" cy="5.8" r="1.25" /><circle {...F} cx="10.2" cy="10.2" r="1.25" /></>,
  turn: <><path {...S} d="M2.5 5h3l5 6h3M2.5 11h3l5-6h3" /><path {...S} d="m11.5 3 2 2-2 2M11.5 9l2 2-2 2" /></>,
  situation: <><rect {...S} x="2.5" y="5.5" width="8" height="8" rx="1" /><path {...S} d="M5 3h7.5a1 1 0 0 1 1 1v7.5" /></>,
  group: <><circle {...S} cx="5.5" cy="5.5" r="2" /><circle {...S} cx="10.5" cy="5.5" r="2" /><path {...S} d="M2 13c0-2.2 1.6-3.6 3.5-3.6S9 10.8 9 13M7 13c0-2.2 1.6-3.6 3.5-3.6S14 10.8 14 13" /></>,
  clock: <><circle {...S} cx="8" cy="8" r="5.6" /><path {...S} d="M8 5v3.2l2.2 1.4" /></>,
  meter: <><path {...S} d="M2.8 11.5a5.2 5.2 0 1 1 10.4 0" /><path {...S} d="m8 11.5 2.6-3.4" /></>,
  writes: <><path {...S} d="M3 13l1-3.6 6.4-6.4 2.6 2.6L6.6 12z" /><path {...S} d="M9.2 4.2l2.6 2.6" /></>,
  reads: <><path {...S} d="M1.8 8S4.2 4 8 4s6.2 4 6.2 4-2.4 4-6.2 4-6.2-4-6.2-4z" /><circle {...S} cx="8" cy="8" r="1.8" /></>,
  lock: <><rect {...S} x="3.5" y="7.2" width="9" height="6.3" rx="1.2" /><path {...S} d="M5.5 7.2V5.4a2.5 2.5 0 0 1 5 0v1.8" /></>,
  // people (spec 8.2)
  subject: <path {...F} d="M8 2.2 13.4 8 8 13.8 2.6 8z" />,
  civilian: <circle {...F} cx="8" cy="8" r="4.6" />,
  person: <circle {...S} cx="8" cy="8" r="4.4" />,
  officer: <path {...S} d="M8 2.2 13 4v3.8c0 3-2.1 5-5 6-2.9-1-5-3-5-6V4z" />,
  withheld: <path {...S} d="M8 2.6 13 8l-5 5.4L3 8z" />,
  // lint
  error: <><path {...S} d="M5.6 2h4.8L14 5.6v4.8L10.4 14H5.6L2 10.4V5.6z" /><path {...S} d="M8 5v3.6" /><circle {...F} cx="8" cy="11" r="1" /></>,
  warn: <><path {...S} d="M8 2.4 14.2 13H1.8z" /><path {...S} d="M8 6.4v3" /><circle {...F} cx="8" cy="11.2" r="0.95" /></>,
  info: <><circle {...S} cx="8" cy="8" r="6" /><path {...S} d="M8 7.3v3.9" /><circle {...F} cx="8" cy="5" r="1" /></>,
  // dilemma flags
  beaten: <><path {...S} d="M2 8h4.5L12 4M6.5 8 12 12" /><path {...S} d="M9.5 3.4 12 4l-.6 2.5M9.5 12.6 12 12l-.6-2.5" /></>,
  flat: <path {...S} d="M3.5 6h9M3.5 10h9" />,
  e2: <><circle {...S} cx="7" cy="9" r="4.8" /><path {...S} d="M7 6.6V9h2" /><path {...S} d="M11.5 2.5h2.6v2.6M14.1 2.5l-2.8 2.8" /></>,
  // shell
  plan: <><rect {...S} x="2" y="2" width="12" height="12" rx="1.2" /><path {...S} d="M2 7.5h5.5V2M10 14v-4.5h4" /></>,
  search: <><circle {...S} cx="7" cy="7" r="4.4" /><path {...S} d="m10.3 10.3 3.4 3.4" /></>,
  caret: <path {...S} d="M4.5 6.5 8 10l3.5-3.5" />,
  close: <path {...S} d="m4 4 8 8M12 4l-8 8" />,
  note: <><path {...S} d="M3 13.2l.9-3.4 6.8-6.8 2.5 2.5-6.8 6.8z" /><path {...S} d="M9.4 4.3l2.5 2.5" /><path {...S} d="M8.5 13.2H13" /></>,
  scan: <><path {...S} d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3" /><path {...S} d="M4.5 8h7" /></>,
  names: <><circle {...S} cx="8" cy="5.6" r="2.6" /><path {...S} d="M3 13.6c.4-2.6 2.4-4.2 5-4.2s4.6 1.6 5 4.2" /></>,
  dot: <circle {...F} cx="8" cy="8" r="3.4" />,
  play: <path {...F} d="M5 3.2 12.4 8 5 12.8z" />,
  grid: <><rect {...S} x="2.5" y="2.5" width="4.5" height="4.5" rx=".8" /><rect {...S} x="9" y="2.5" width="4.5" height="4.5" rx=".8" /><rect {...S} x="2.5" y="9" width="4.5" height="4.5" rx=".8" /><rect {...S} x="9" y="9" width="4.5" height="4.5" rx=".8" /></>,
  undo: <path {...S} d="M5.5 4.5 3 7l2.5 2.5M3 7h6.5a3.5 3.5 0 0 1 0 7H7" />,
  retry: <><path {...S} d="M13 8a5 5 0 1 1-1.6-3.7" /><path {...S} d="M13 2.5v2.8h-2.8" /></>,
  keys: <><rect {...S} x="1.8" y="4" width="12.4" height="8" rx="1.4" /><path {...S} d="M4.5 7h.01M7 7h.01M9.5 7h.01M12 7h.01M5 9.6h6" /></>,
  // palette kinds
  node: <rect {...S} x="2.5" y="4" width="11" height="8" rx="2" />,
  choice: <path {...S} d="M3 8h4l5-4M7 8l5 4" />,
  ending: <><path {...S} d="M4 14V2.5" /><path {...S} d="M4 3h8l-1.8 2.8L12 8.6H4" /></>,
  key: <><circle {...S} cx="5.2" cy="8" r="2.8" /><path {...S} d="M8 8h6M11.5 8v2.4M13.5 8v1.6" /></>,
  row: <path {...S} d="M3 4.5h10M3 8h10M3 11.5h6" />,
  field: <><path {...S} d="M2.5 8h11" /><circle {...F} cx="9.5" cy="8" r="2.2" /></>,
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof SHAPES;

/** One glyph. With a title it is an image with that name; without, it is decoration next to words. */
export function Glyph({ name, size = 14, title, className }: { name: GlyphName; size?: number; title?: string; className?: string }) {
  return (
    <svg className={`lab-glyph${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 16 16"
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false">
      {title && <title>{title}</title>}
      {SHAPES[name]}
    </svg>
  );
}

export const BAND_WORDS: Record<OutcomeBand, string> = { favorable: 'Goes well', mixed: 'Complications', adverse: 'Goes badly' };
const BAND_GLYPH: Record<OutcomeBand, GlyphName> = { favorable: 'well', mixed: 'mixed', adverse: 'badly' };
const BAND_TONE: Record<OutcomeBand, string> = { favorable: 'well', mixed: 'mixed', adverse: 'badly' };

/** A result band: chevron up, bar or chevron down in the band's color, with the game's words when `words`. */
export function BandGlyph({ band, words = false, size }: { band: OutcomeBand; words?: boolean; size?: number }) {
  return (
    <span className={`lab-mark lab-tone-${BAND_TONE[band]}`}>
      <Glyph name={BAND_GLYPH[band]} size={size} title={words ? undefined : BAND_WORDS[band]} />
      {words && <span>{BAND_WORDS[band]}</span>}
    </span>
  );
}

/** How a run ended: check, half disc, dashed ring, plus or dagger. Death is drawn plainly, never animated. */
export function WeightGlyph({ weight, words = false, size }: { weight: Weight; words?: boolean; size?: number }) {
  const label = weightLabel(weight);
  return (
    <span className={`lab-mark lab-tone-${weight}`}>
      <Glyph name={weight} size={size} title={words ? undefined : `Run class: ${label}`} />
      {words && <span>{label[0].toUpperCase() + label.slice(1)}</span>}
    </span>
  );
}

export type PeopleKind = 'subject' | 'civilian' | 'person' | 'officer' | 'withheld';
export const PEOPLE_LABEL: Record<PeopleKind, string> = { subject: 'Subject', civilian: 'Civilian', person: 'Person at the scene', officer: 'Officer', withheld: 'Named; role not confirmed' };

export function PeopleGlyph({ kind, size = 12 }: { kind: PeopleKind; size?: number }) {
  return <span className={`lab-mark lab-person-${kind}`}><Glyph name={kind} size={size} title={PEOPLE_LABEL[kind]} /></span>;
}

export type LintSeverity = 'error' | 'warn' | 'info';
const LINT_LABEL: Record<LintSeverity, string> = { error: 'Error', warn: 'Warning', info: 'Note' };

export function LintGlyph({ severity, size }: { severity: LintSeverity; size?: number }) {
  return <span className={`lab-mark lab-lint-${severity}`}><Glyph name={severity} size={size} title={LINT_LABEL[severity]} /></span>;
}

export type FlagKind = 'beaten' | 'flat' | 'all-high' | 'e2';
const FLAG_GLYPH: Record<FlagKind, GlyphName> = { beaten: 'beaten', flat: 'flat', 'all-high': 'flat', e2: 'e2' };
const FLAG_LABEL: Record<FlagKind, string> = {
  beaten: 'Beaten on every column the engine measures',
  flat: 'Odds within 5 points of another choice',
  'all-high': 'Every choice here is 90% or more',
  e2: 'Saves more than half the minutes of a restraint choice',
};

export function FlagGlyph({ flag, size }: { flag: FlagKind; size?: number }) {
  return <span className={`lab-mark lab-flag-${flag}`}><Glyph name={FLAG_GLYPH[flag]} size={size} title={FLAG_LABEL[flag]} /></span>;
}
