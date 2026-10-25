// Strong language and its milder alternate (docs/content-policy.md, control L1). The player's "Soften strong
// language" setting (ui/settings/prefs.ts) swaps what a person says for text the owner wrote for that line.
// Two layers, in this order:
//   1. Authored pairs. A call tree lists `soft: [{ from, to }]` beside the text it softens (call-trees/types.ts).
//      `from` is the exact bound sentence (so no names or role tokens in it) and `to` is written like the rest of the
//      call, with the same weight. These are the real alternates; the gate in docs/content-policy.md wants one per hit.
//   2. A net. Whole words from the strong-language lexicon become a milder whole word, so a line nobody has written
//      an alternate for (a generated one, a new call) still never reaches a player who asked for it softened.
// Pure and sim-safe: the simulation keeps the raw text, and the text is chosen at the screen.
import { CALL_TREES } from '../call-trees';

export interface SoftPair {
  /** The exact line as the player would read it with no softening, no role tokens. */
  from: string;
  /** What that line says when the player has softened strong language. */
  to: string;
}

/** Every authored pair, longest `from` first so a sentence beats the shorter one it contains. */
export const SOFT_PAIRS: readonly SoftPair[] = Object.values(CALL_TREES)
  .flatMap((tree) => tree?.soft ?? [])
  .sort((a, b) => b.from.length - a.from.length);

type Rule = readonly [RegExp, string];

/** The net: whole words only, never a prefix, so a name or an unrelated word is never touched. Longer forms first. */
const NET: readonly Rule[] = [
  [/\bmotherfuckers\b/gi, 'jerks'], [/\bmotherfucker\b/gi, 'jerk'],
  [/\bbullshit\b/gi, 'nonsense'],
  [/\bfuckin(?:g|’)?\b/gi, 'freaking'], [/\bfucked\b/gi, 'messed up'], [/\bfuckers\b/gi, 'jerks'], [/\bfucker\b/gi, 'jerk'], [/\bfucks\b/gi, 'messes'], [/\bfuck\b/gi, 'heck'],
  [/\bshitstorm\b/gi, 'mess'], [/\bshitheads?\b/gi, 'jerk'], [/\bdumbass(?:es)?\b/gi, 'idiot'], [/\bjackass(?:es)?\b/gi, 'jerk'],
  [/\bshitty\b/gi, 'lousy'], [/\bshit\b/gi, 'crap'],
  [/\bbitches\b/gi, 'jerks'], [/\bbitch\b/gi, 'jerk'],
  [/\bbastards\b/gi, 'jerks'], [/\bbastard\b/gi, 'jerk'],
  [/\bassholes\b/gi, 'jerks'], [/\basshole\b/gi, 'jerk'],
  [/\bgoddamned\b/gi, 'darned'], [/\bgoddamn\b/gi, 'darn'],
];

/** The replacement in the case of what it replaces: FUCK becomes HECK, Fuck becomes Heck. */
const matchCase = (found: string, word: string): string =>
  found === found.toUpperCase() && found.length > 1 ? word.toUpperCase() : found[0] === found[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;

/** `text` through the authored pairs only: what the gate reads, since a pair is the reviewed alternate and the net is not. */
export function softenAuthored(text: string): string {
  let out = text;
  for (const pair of SOFT_PAIRS) if (out.includes(pair.from)) out = out.split(pair.from).join(pair.to);
  return out;
}

/** `text` with its strong language replaced. Text with none comes back as it was. */
export function softenLanguage(text: string): string {
  if (!text) return text;
  let out = softenAuthored(text);
  for (const [word, to] of NET) out = out.replace(word, (found) => matchCase(found, to));
  return out;
}

/** Whether `text` carries a word the net would replace: how a gate asks "was this line handled". */
export const hasStrongLanguage = (text: string): boolean => NET.some(([word]) => new RegExp(word.source, 'i').test(text));
