// The text controls as code: one pure function per control that a word list can hold. The string gate
// (scripts/check-strings.ts and gates/policy-corpus.test.ts), generator tests and anything that makes
// text at build time call checkText with the surface the text will appear on. The controls that need
// a person (menace, framing, hidden truth) are in the registry as review, and the editorial brief
// carries them (brief.ts).
import { REAL_BRANDS } from '../world';
import { controlById, type ControlId, type Severity, type Surface, type TextCheckId } from './controls';
import { BARE_CLOCK, FIREARM_SPECIFICS, GRAPHIC_HARM, METHOD_OF_HARM, METHOD_REVIEW, REAL_AGENCIES, STREET_ADDRESS, STRONG_LANGUAGE, SUICIDE_METHOD, UNSAFE_DETAIL } from './lexicon';

export interface PolicyFinding { control: ControlId; severity: Severity; surface: Surface; message: string; match: string }

/** Brands too common as ordinary words or surnames to match case-insensitively ("kick the door", "The Fox"). */
const AMBIGUOUS_BRANDS = new Set(['fox', 'kick', 'abc', 'seamless', 'caviar']);
const BRAND_PATTERN = new RegExp(`\\b(?:${REAL_BRANDS.filter((brand) => !AMBIGUOUS_BRANDS.has(brand)).map((brand) => brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');

interface TextCheck {
  control: ControlId; message: string; severity?: Severity; find: (text: string) => string | null;
  /** Only authored text is read: a generated scenario's place names and addresses are fictional by construction. */
  authoredOnly?: boolean;
  /** Only narration is read: a person may say a bare time out loud. */
  narrationOnly?: boolean;
}
export interface CheckOptions {
  /** The text is the finished, generated scenario (bound places and names included). */ generated?: boolean;
  /** The text is a person's direct speech or a typed comment. */ speech?: boolean;
}
const hit = (pattern: RegExp) => (text: string): string | null => text.match(pattern)?.[0] ?? null;

export const TEXT_CHECKS: Record<TextCheckId, TextCheck> = {
  V1: { control: 'V1', message: 'wound anatomy or graphic harm', find: (text) => hit(UNSAFE_DETAIL)(text) ?? hit(GRAPHIC_HARM)(text) },
  V4: { control: 'V4', message: 'a method of harm is named; carry the menace through behavior', find: hit(METHOD_OF_HARM) },
  V5: { control: 'V5', message: 'a real firearm make, model, caliber or modification', find: hit(FIREARM_SPECIFICS) },
  S1: { control: 'S1', message: 'a self-harm method or means', find: (text) => hit(SUICIDE_METHOD)(text) },
  R1: { control: 'R1', message: 'a real company, platform or outlet', find: hit(BRAND_PATTERN) },
  R4: { control: 'R4', message: 'a real agency', find: hit(REAL_AGENCIES) },
  H1: { control: 'H1', message: 'a typed street address', find: hit(STREET_ADDRESS), authoredOnly: true },
  L1: { control: 'L1', message: 'strong language; counted for the rating, read for who it is aimed at', find: hit(STRONG_LANGUAGE) },
  Q2: { control: 'Q2', message: 'a clock time with no AM or PM', find: hit(BARE_CLOCK), narrationOnly: true },
};

/** Findings for `text` on `surface`: every text control whose surfaces include it. S1 also raises its
 * method-review list as a note, because a person reads those. */
export function checkText(text: string, surface: Surface, options: CheckOptions = {}): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  for (const check of Object.values(TEXT_CHECKS)) {
    const control = controlById(check.control);
    if (!control.surfaces.includes(surface)) continue;
    if (options.generated && check.authoredOnly) continue;
    if (options.speech && check.narrationOnly) continue;
    const match = check.find(text);
    if (match) findings.push({ control: control.id, severity: check.severity ?? control.severity, surface, message: check.message, match });
  }
  if (controlById('S1').surfaces.includes(surface)) {
    const review = text.match(METHOD_REVIEW)?.[0];
    if (review) findings.push({ control: 'S1', severity: 'note', surface, message: 'a word that may name a self-harm method; a person reads it', match: review });
  }
  return findings;
}

export const blocking = (findings: readonly PolicyFinding[]): PolicyFinding[] => findings.filter((finding) => finding.severity === 'block');

/** The surface a call-tree string belongs to, from its field path in the strings file (strings.ts `where`). */
export function surfaceOfPath(where: string): Surface {
  if (/(^|\.)ending\.|^ending\./.test(where) || /\.epilogue/.test(where)) return 'ending_text';
  if (/chat|reaction/.test(where)) return 'chat';
  if (/threat|adverse|fired_on|go_in/.test(where)) return 'threat_text';
  return 'call_text';
}
