// Which calls a repeated sentence or run from the string checker comes from (hostage review N9). The
// checker, run over every call's rows at once, names a repeat by its text only, so check:strings
// finds the calls that hold it. Matching is on the checker's own tokens (game_string_checks.py
// toks: lowercase, curly apostrophes made straight, runs of letters, digits and apostrophes) and on
// whole tokens, so a run never matches inside a longer word.

const APOS = /’/g;
/** The checker's tokens of a text. */
export const tokens = (text: string): string[] => text.toLowerCase().replace(APOS, "'").match(/[a-z0-9']+/g) ?? [];

/** The checker prints a repeated sentence cut to 70 characters. */
const REPEAT_CUT = 70;

/** The phrase a checker row names, as tokens: a repeated sentence (its last token dropped when the
 * checker cut it mid-word) or the first run of a shared n-gram. Null for any other row. */
export function repeatedPhrase(line: string): string[] | null {
  const repeat = /^repeat\s+\d+ strings\s{2}(.+?)\s*$/.exec(line);
  if (repeat) {
    const words = tokens(repeat[1]);
    return repeat[1].length >= REPEAT_CUT ? words.slice(0, -1) : words;
  }
  const ngram = /^ngram\s.*share a run starting '(.+)' \(\d+ words\)/.exec(line);
  return ngram ? tokens(ngram[1]) : null;
}

/** Whether `phrase` (tokens) occurs in `text` as whole, consecutive tokens. */
export function holds(text: string, phrase: readonly string[]): boolean {
  if (!phrase.length) return false;
  const t = tokens(text);
  for (let i = 0; i + phrase.length <= t.length; i++) if (phrase.every((word, k) => t[i + k] === word)) return true;
  return false;
}

/** The calls, sorted, whose rows hold the phrase a checker row names. */
export function callsWith(line: string, rows: readonly { text: string; call: string }[]): string[] {
  const phrase = repeatedPhrase(line);
  if (!phrase) return [];
  return [...new Set(rows.filter(row => holds(row.text, phrase)).map(row => row.call))].sort();
}
