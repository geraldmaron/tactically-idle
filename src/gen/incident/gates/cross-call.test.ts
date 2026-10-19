import { describe, expect, it } from 'vitest';
import { callsWith, holds, repeatedPhrase, tokens } from './cross-call';

describe('cross-call repeat lookup (check:strings N9)', () => {
  it('keeps an apostrophe inside a run, as the checker tokenizes it', () => {
    expect(repeatedPhrase("ngram           2 strings share a run starting 'they won't pick up' (5 words) in a, b")).toEqual(['they', "won't", 'pick', 'up']);
    expect(tokens('They won’t pick up.')).toEqual(['they', "won't", 'pick', 'up']);
  });

  it('matches whole tokens only, never a word prefix', () => {
    expect(holds('They won the round.', ['they', "won't"])).toBe(false);
    expect(holds('The team waits.', ['the', 'team', 'wait'])).toBe(false);
    expect(holds('Then the team waits.', ['the', 'team', 'waits'])).toBe(true);
  });

  it('drops the cut last word of a sentence the checker cut at 70 characters', () => {
    const cut = 'Bellamy is with the team now, and what happens next is not this call’s';
    expect(cut.length).toBeGreaterThanOrEqual(70);
    expect(repeatedPhrase(`repeat                                                    2 strings  ${cut}`)!.at(-1)).toBe('this');
    expect(repeatedPhrase('repeat                                                    7 strings  The team has them.')).toEqual(['the', 'team', 'has', 'them']);
  });

  it('names only the calls whose rows hold the phrase', () => {
    const rows = [{ call: 'armed', text: 'They won’t pick up.' }, { call: 'barricade', text: 'They won the toss.' }, { call: 'rescue', text: 'They wonder why.' }];
    expect(callsWith("ngram           2 strings share a run starting 'they won't pick up' (5 words) in x", rows)).toEqual(['armed']);
    expect(callsWith('summary over-limit 0', rows)).toEqual([]);
  });
});
