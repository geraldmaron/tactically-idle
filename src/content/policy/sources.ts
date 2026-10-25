// Where each control comes from: the store rules and the owner's own standards, with when each was
// read and how well. A control cites source ids, never prose, so a rule that changes upstream has one
// place to be re-read (docs/content-policy.md).
//
// `read` says how the text was obtained. 'summary' means a summarising fetch of the live page on the
// date given, which is enough to design against and not enough to cite in a dispute: open the URL
// before relying on the exact wording. Nothing here is legal advice.

export type Publisher = 'apple' | 'google' | 'owner';
export type Read = 'summary' | 'owner';

export interface PolicySource { id: string; publisher: Publisher; title: string; ref: string; url?: string; readOn: string; read: Read; gist: string }

const APPLE_GUIDELINES = 'https://developer.apple.com/app-store/review/guidelines/';
const APPLE_AGE = 'https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions';
const GOOGLE_VIOLENCE = 'https://support.google.com/googleplay/android-developer/answer/9878810';
const GOOGLE_RATINGS = 'https://support.google.com/googleplay/android-developer/answer/9859655';

export const POLICY_SOURCES = [
  { id: 'apple-1.1.2', publisher: 'apple', title: 'Realistic portrayals of killing and abuse', ref: 'App Review Guidelines 1.1.2', url: APPLE_GUIDELINES, readOn: '2026-10-24', read: 'summary', gist: 'Realistic portrayals of people being killed, maimed, tortured or abused, and content that encourages violence, are objectionable. Fictional enemies may not solely target a real race, culture, government or corporation.' },
  { id: 'apple-1.1.3', publisher: 'apple', title: 'Weapons', ref: 'App Review Guidelines 1.1.3', url: APPLE_GUIDELINES, readOn: '2026-10-24', read: 'summary', gist: 'Depictions that encourage illegal or reckless use of weapons, or help buy firearms or ammunition, are not allowed.' },
  { id: 'apple-1.1.7', publisher: 'apple', title: 'Real conflicts and attacks', ref: 'App Review Guidelines 1.1.7', url: APPLE_GUIDELINES, readOn: '2026-10-24', read: 'summary', gist: 'Content that capitalizes on violent conflicts, terrorist attacks or epidemics is not allowed.' },
  { id: 'apple-1.2', publisher: 'apple', title: 'User-generated content', ref: 'App Review Guidelines 1.2', url: APPLE_GUIDELINES, readOn: '2026-10-24', read: 'summary', gist: 'Apps where players post or see other players\' content need filtering, reporting, blocking and contact details. Scripted developer-written comments are probably outside it; runtime-generated or player-influenced comments are unclear.' },
  { id: 'apple-2.3.1', publisher: 'apple', title: 'Review notes', ref: 'App Review Guidelines 2.3.1(a)', url: APPLE_GUIDELINES, readOn: '2026-10-24', read: 'summary', gist: 'Explain unusual features and sensitive content in the notes for review and make them reachable by the reviewer.' },
  { id: 'apple-2.3.6', publisher: 'apple', title: 'Honest age rating', ref: 'App Review Guidelines 2.3.6', url: APPLE_GUIDELINES, readOn: '2026-10-24', read: 'summary', gist: 'Answer the age rating questions honestly; a wrong rating can draw a regulatory inquiry.' },
  { id: 'apple-2.3.8', publisher: 'apple', title: 'Metadata suits 4+', ref: 'App Review Guidelines 2.3.8', url: APPLE_GUIDELINES, readOn: '2026-10-24', read: 'summary', gist: 'Icons, screenshots and previews should suit a 4+ audience even when the app is rated higher; Apple names a gun pointed at a specific character and a gruesome death as images to avoid.' },
  { id: 'apple-age', publisher: 'apple', title: 'Age rating values', ref: 'App Store Connect, age ratings values and definitions', url: APPLE_AGE, readOn: '2026-10-24', read: 'summary', gist: 'Tiers 4+, 9+, 13+, 16+, 18+. Realistic violence (a lifelike shoot-out counts): infrequent 13+, frequent 18+. Guns: frequent 13+. Mature themes (real-world crimes, trauma): frequent 16+. Prolonged graphic or sadistic realistic violence leaves an app unrated, which cannot ship on the App Store. Updated age-rating questions have been required since 31 January 2026 (a Codex read of the Apple developer news pages, 2026-10-24); the newer social-media capability questions follow in September 2026. Apple gives no number for infrequent or frequent.' },
  { id: 'google-violence', publisher: 'google', title: 'Violence', ref: 'Play Developer Policy, Inappropriate Content: Violence', url: GOOGLE_VIOLENCE, readOn: '2026-10-24', read: 'summary', gist: 'Gratuitous violence, graphic depictions or descriptions of realistic violence, violent threats to any person, and promoting self-harm or suicide are prohibited. Fictional violence in games is generally allowed.' },
  { id: 'google-sensitive', publisher: 'google', title: 'Sensitive events', ref: 'Play Developer Policy, Sensitive Events', url: GOOGLE_VIOLENCE, readOn: '2026-10-24', read: 'summary', gist: 'No capitalizing on or insensitivity toward real tragedies or deaths, including a real person\'s death by suicide or overdose.' },
  { id: 'google-harassment', publisher: 'google', title: 'Bullying and harassment', ref: 'Play Developer Policy, Bullying and Harassment', url: GOOGLE_VIOLENCE, readOn: '2026-10-24', read: 'summary', gist: 'No threats, harassment or humiliation, including of victims and their families after a tragedy. The policy is not expressly limited to real people, so a fictional portrayal is an interpretation, not an exemption.' },
  { id: 'google-ratings', publisher: 'google', title: 'Content ratings', ref: 'Play Console, content rating requirements (IARC)', url: GOOGLE_RATINGS, readOn: '2026-10-24', read: 'summary', gist: 'Every app completes the IARC questionnaire honestly; an unrated app is removed; a change to content that alters the answers needs a new questionnaire.' },
  { id: 'owner-grounded', publisher: 'owner', title: 'Grounded, life preserved', ref: 'AGENTS.md, Player-facing writing', readOn: '2026-10-24', read: 'owner', gist: 'Consequences land plainly on named people with no wound anatomy or method. Preserving life is what the game values, and force is never the reward.' },
  { id: 'owner-ethics', publisher: 'owner', title: 'Ethics screen E1 to E12', ref: '.agents/skills/swat-call-design/references/ethics-and-authenticity.md', readOn: '2026-10-24', read: 'owner', gist: 'The call design ethics rules: no self-harm method (E4.1), no gore (E7), force gated on a visible threat to life (E12.5), a support line after crisis calls (E4.7).' },
  { id: 'owner-quality', publisher: 'owner', title: 'Prose quality asks', ref: 'owner messages, 2026-10-24', readOn: '2026-10-24', read: 'owner', gist: 'People get the pronouns that fit them, times say AM or PM, threats read as threats, and prose gets an editorial pass the way a published piece does.' },
] as const satisfies readonly PolicySource[];

export type SourceId = (typeof POLICY_SOURCES)[number]['id'];
