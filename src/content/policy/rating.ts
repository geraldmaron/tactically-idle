// The store questionnaire answered from the data (controls G1, G4, G5, G6). The input is every
// situation the game ships with the descriptors it carries (derived from the compiled tree plus
// declared, gates/content-descriptors.ts), and the output is the profile both stores' questions are
// answered from. A player's filters are not an input: the store rates the app, and the content ships.
//
// Apple gives no number for "infrequent" and "frequent". FREQUENT_SHARE is the developer's working reading,
// not an owner decision and not Apple's: a theme counts as frequent when at least one situation in four can
// show it. It measures the share of situations, which is not how often a player meets them (draw weights,
// unlocks and repeats are ignored), and more benign calls would dilute it, so treat the profile as a working
// classification and the questionnaire as a release artifact a person answers (policy-rating-evidence in
// docs/backlog.md). The Apple age mapping follows Apple's table (apple-age in sources.ts), read from a summary of
// the live page: confirm it in App Store Connect before submitting.
import { CONTENT_DESCRIPTORS, type ContentDescriptor } from '../content-descriptors';

export type Frequency = 'none' | 'infrequent' | 'frequent';
export type AppleAge = 4 | 9 | 13 | 16 | 18;

/** One situation of one call and the descriptors it can show. */
export interface SituationFacts { call: string; situation: number; descriptors: readonly ContentDescriptor[] }

export const FREQUENT_SHARE = 0.25;

const VIOLENCE: readonly ContentDescriptor[] = ['death', 'injury', 'police_gunfire'];

export interface RatingProfile {
  situations: number;
  /** The share of situations that carry each descriptor. */
  shares: Record<ContentDescriptor, number>;
  apple: {
    realisticViolence: Frequency;
    /** Always none: control V1 keeps harm brief and plain, and the corpus test holds it. */
    prolongedGraphicViolence: 'none';
    weapons: Frequency;
    matureThemes: Frequency;
    horrorFear: Frequency;
    /** Strong language in direct speech: the share of situations whose text has any (control L1). */
    strongLanguage: Frequency;
    impliedMinimumAge: AppleAge;
  };
  /** The questionnaire topics a person must still answer by hand, and why. */
  openQuestions: string[];
}

const frequencyOf = (share: number): Frequency => share <= 0 ? 'none' : share >= FREQUENT_SHARE ? 'frequent' : 'infrequent';

/** `languageShare`: the share of situations whose bound text carries strong language (checkText L1). */
export function ratingProfile(situations: readonly SituationFacts[], languageShare = 0): RatingProfile {
  const total = situations.length;
  const share = (names: readonly ContentDescriptor[]) => total ? situations.filter((s) => s.descriptors.some((d) => names.includes(d))).length / total : 0;
  const shares = Object.fromEntries(CONTENT_DESCRIPTORS.map((d) => [d, share([d])])) as Record<ContentDescriptor, number>;
  const violence = frequencyOf(share(VIOLENCE));
  // Every call in this game is an armed response to a crime in progress, so weapons, dread and real-world
  // crime are frequent by premise, whatever the descriptor lists say.
  const weapons: Frequency = total ? 'frequent' : 'none';
  const horror: Frequency = total ? 'frequent' : 'none';
  const mature: Frequency = total ? 'frequent' : 'none';
  const ages: AppleAge[] = [4];
  if (violence === 'frequent') ages.push(18); else if (violence === 'infrequent') ages.push(13);
  if (mature === 'frequent') ages.push(16);
  if (weapons === 'frequent') ages.push(13);
  if (horror === 'frequent') ages.push(13);
  return {
    situations: total, shares,
    apple: { realisticViolence: violence, prolongedGraphicViolence: 'none', weapons, matureThemes: mature, horrorFear: horror, strongLanguage: frequencyOf(languageShare), impliedMinimumAge: Math.max(...ages) as AppleAge },
    openQuestions: [
      'Apple: the medical or treatment and the health or wellness questions (the game has a support line and crisis calls but gives no medical guidance).',
      'Apple: the new questions on in-app controls, capabilities and social features (no chat between players, no user-generated content, no ads yet).',
      'IARC: violence against humans and vulnerable characters, fear, and references to suicide, answered from the shares above; the IARC wording was not read.',
      'Apple and IARC: the language, profanity and crude humor questions (the game has strong language in direct speech; the exact question wording was not read).',
      'Per region: IARC and Apple assign regional ratings; confirm each territory the game is sold in.',
      'Everything else in the questionnaires: the profile covers selected topics only, and an 18+ result does not make the content acceptable to review.',
    ],
  };
}

/** The notes for App Review (Apple 2.3.1(a)) and the Play Console, generated so they match the build. */
export function reviewNotes(profile: RatingProfile): string[] {
  const percent = (descriptor: ContentDescriptor) => `${Math.round(profile.shares[descriptor] * 100)}%`;
  return [
    'Tactically Idle is a work of fiction. Every person, company, app and outlet in it is invented, and no call is based on a real incident.',
    `Calls are text and blueprint scenarios about armed standoffs. Across ${profile.situations} shipped situations, ${percent('injury')} can show someone hurt, ${percent('death')} can end with a death stated in one plain sentence, and ${percent('suicide_self_harm')} involve a person at risk of self-harm. Nothing graphic is shown or described.`,
    'The first launch shows an advisory that names these themes. Each call card warns about its topics, and Settings lets the player filter each theme off the board. Filters change what is drawn, not the content the app contains.',
    'A support line shows in the debrief of every call with a self-harm theme, and a Support entry stays in Settings.',
    'There is no chat between players and no user-generated content. Viewer comments inside a livestream scenario are written by the developer and drawn from fixed pools.',
    `Working age rating answers, computed from the shipped content: realistic violence ${profile.apple.realisticViolence}, weapons ${profile.apple.weapons}, mature themes ${profile.apple.matureThemes}, horror or fear ${profile.apple.horrorFear}, strong language ${profile.apple.strongLanguage}, prolonged graphic violence none.`,
  ];
}
