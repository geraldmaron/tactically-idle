// The content controls: what the game promises about what it shows, written once as data. The store
// rules (sources.ts) and the owner's standards become numbered controls, and every surface that makes
// or shows content reads this one registry: the string gates, the generators' tests, the rating
// answers (rating.ts), the editorial pass (brief.ts), the settings screens and the docs. Nothing
// here is code that a surface can quietly skip. A control with no enforcement says so as a gap
// with a backlog id, and the registry test fails if a blocking control has neither (policy.test.ts).
//
// Rendered to docs/content-policy.md. Edit this file and re-render with
// `npx vitest run src/gen/incident/gates/policy-corpus.test.ts -u`; never edit the doc.
import type { SourceId } from './sources';

export type Family = 'violence' | 'self_harm' | 'real_world' | 'harassment' | 'user_content' | 'listing' | 'rating' | 'quality';
export type Surface = 'call_text' | 'threat_text' | 'ending_text' | 'chat' | 'world_text' | 'handle' | 'art' | 'store_metadata' | 'generation' | 'ui' | 'review';
export type Severity = 'block' | 'fix' | 'note';
export type TextCheckId = 'V1' | 'V4' | 'V5' | 'S1' | 'R1' | 'R4' | 'H1' | 'L1' | 'Q2';
export type ControlId =
  | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6'
  | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6'
  | 'R1' | 'R2' | 'R3' | 'R4'
  | 'H1' | 'H2' | 'H3' | 'U1' | 'L1'
  | 'A1' | 'A2' | 'N1' | 'M1' | 'P1'
  | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8'
  | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7' | 'E1';

/** How a control is held. `text`: a lexicon check in checks.ts. `structure`: a test or gate over the
 * data. `derived`: computed from the data (rating.ts). `ui`: a screen default. `process`: a step with a
 * written procedure. `review`: a human or editor pass reads it. `gap`: nothing holds it yet. */
export type Enforcement =
  | { kind: 'text'; check: TextCheckId }
  | { kind: 'structure' | 'derived' | 'ui' | 'process' | 'review'; ref: string }
  | { kind: 'gap'; backlog: string; note: string };

export interface Control {
  id: ControlId;
  family: Family;
  title: string;
  /** What the content must do, in one sentence a writer can follow. */
  rule: string;
  /** Why the game holds it, in terms of the store or the owner. */
  why: string;
  sources: readonly SourceId[];
  surfaces: readonly Surface[];
  severity: Severity;
  enforcedBy: readonly Enforcement[];
  /** What an editor or reviewer does with this control (brief.ts builds the editorial brief from it). */
  editor: string;
}

const ALL_TEXT: readonly Surface[] = ['call_text', 'threat_text', 'ending_text', 'chat', 'world_text'];
/** The universal prohibitions apply to every surface that carries words, so moving a line (a rename, a new
 * field, a reaction pool) can never switch a basic protection off. Specialised controls add checks. */
const ANY_TEXT: readonly Surface[] = [...ALL_TEXT, 'ui', 'store_metadata', 'handle'];

export const CONTROLS: readonly Control[] = [
  { id: 'V1', family: 'violence', title: 'No graphic harm', severity: 'block', surfaces: ANY_TEXT,
    rule: 'Harm is one plain fact about a named person. No wound anatomy, gore, or prolonged detail of injury or death.',
    why: 'Apple will not publish prolonged graphic or sadistic realistic violence, and Google bans graphic descriptions of realistic violence.',
    sources: ['apple-age', 'apple-1.1.2', 'google-violence', 'owner-grounded'],
    enforcedBy: [{ kind: 'text', check: 'V1' }, { kind: 'review', ref: '.agents/skills/swat-writing-review/SKILL.md' }],
    editor: 'Cut any line that describes how a body was hurt. Keep who was hurt and what they need next.' },
  { id: 'V2', family: 'violence', title: 'Force is never the reward', severity: 'block', surfaces: ['call_text', 'ending_text', 'generation'],
    rule: 'Force outcomes cost trust and go to review. No line celebrates, enjoys or rewards force.',
    why: 'Apple objects to content that encourages violence. The game values preserving life.',
    sources: ['apple-1.1.2', 'google-violence', 'owner-grounded', 'owner-ethics'],
    enforcedBy: [{ kind: 'structure', ref: 'src/sim/outcome-score.test.ts' }, { kind: 'review', ref: '.agents/skills/swat-writing-review/SKILL.md' }],
    editor: 'Read every force and entry result for relief, triumph or admiration. Replace with what it cost the people in the room.' },
  { id: 'V3', family: 'violence', title: 'Death and injury are brief and plain', severity: 'fix', surfaces: ['call_text', 'ending_text'],
    rule: 'A death or serious injury is stated once, in a sentence or two, on the people left behind. It is never the subject of a scene.',
    why: 'Keeps the app under prolonged graphic violence and keeps the weight on people, not the act.',
    sources: ['apple-age', 'google-violence', 'owner-grounded'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-call-prose/references/voice-and-soul.md' }],
    editor: 'Check each death or injury result: one fact, a named person, and what someone does next. Trim anything longer.' },
  { id: 'V4', family: 'violence', title: 'Menace comes from behavior, not method', severity: 'fix', surfaces: ALL_TEXT,
    rule: 'A threat line carries menace through who is threatened, proximity, control, sound, time and how the people in the room react. It never names a method of harm.',
    why: 'Google bans violent threats and graphic descriptions; fiction in a game is allowed when it is not graphic. This is also what makes a threat land.',
    sources: ['google-violence', 'apple-1.1.2', 'owner-quality'],
    enforcedBy: [{ kind: 'text', check: 'V4' }, { kind: 'review', ref: '.agents/skills/swat-call-prose/references/voice-and-soul.md' }],
    editor: 'Rewrite flat threat lines so a sound, a position change or a person\'s reaction carries the fear. Never add an act of harm to make it scarier.' },
  { id: 'V5', family: 'violence', title: 'Weapons are generic and never how-to', severity: 'block', surfaces: ANY_TEXT,
    rule: 'Weapons are named by type (handgun, rifle, shotgun). No real makes, models, calibers, modifications or ways to get one.',
    why: 'Apple bans content that encourages illegal or reckless weapon use or helps buy firearms.',
    sources: ['apple-1.1.3'],
    enforcedBy: [{ kind: 'text', check: 'V5' }],
    editor: 'Replace any brand, model or cartridge with the generic type.' },

  { id: 'S1', family: 'self_harm', title: 'No self-harm method', severity: 'block', surfaces: ANY_TEXT,
    rule: 'No means, amounts or acts of self-harm reach the player, whether or not they chose the topic.',
    why: 'Google prohibits promoting self-harm or suicide; the owner holds E4.1.',
    sources: ['google-violence', 'owner-ethics'],
    enforcedBy: [{ kind: 'text', check: 'S1' }, { kind: 'review', ref: '.agents/skills/swat-writing-review/SKILL.md' }],
    editor: 'Remove any named means. Keep what the person says about not wanting to be alive, in their words.' },
  { id: 'S2', family: 'self_harm', title: 'Support is always reachable', severity: 'block', surfaces: ['ui'],
    rule: 'A support entry stays in Settings, and the debrief of any situation with a self-harm risk shows the support line, whatever the warning setting.',
    why: 'Reviewers look for care around self-harm themes; the owner approved this placement.',
    sources: ['owner-ethics', 'apple-2.3.1'],
    enforcedBy: [{ kind: 'ui', ref: 'src/ui/settings/DebriefSupport.tsx' }],
    editor: 'Not a text control. Check the debrief and Settings entries still render for every suicide_self_harm situation.' },
  { id: 'S3', family: 'self_harm', title: 'An at-risk person is never shown dying', severity: 'block', surfaces: ['call_text', 'ending_text', 'generation'],
    rule: 'A subject at risk of self-harm never dies on the card. Force on them is `noFatal`, and the negotiator asks the direct question off the card.',
    why: 'Keeps the strongest self-harm content out of the shipped game.',
    sources: ['owner-ethics', 'google-violence'],
    enforcedBy: [{ kind: 'structure', ref: 'src/gen/incident/gates/content-descriptors.test.ts' }],
    editor: 'Confirm no ending or result shows or implies the at-risk person\'s death.' },
  { id: 'S4', family: 'self_harm', title: 'Self-harm is declared and filterable', severity: 'block', surfaces: ['generation', 'ui'],
    rule: 'Every situation with a subject at risk declares `suicide_self_harm`, the card warns, and the player can filter it.',
    why: 'The warning and the filter are how the game answers the mature-theme questions honestly.',
    sources: ['apple-2.3.6', 'google-ratings'],
    enforcedBy: [{ kind: 'structure', ref: 'src/gen/incident/gates/content-descriptors.test.ts' }, { kind: 'ui', ref: 'src/ui/settings/CardWarning.tsx' }],
    editor: 'Not a text control. When a new situation adds a subject at risk, its descriptor list changes with it.' },
  { id: 'S5', family: 'self_harm', title: 'Self-harm is never framed as a solution', severity: 'block', surfaces: ['call_text', 'chat', 'ending_text'],
    rule: 'No line, choice, comment or ending presents self-harm as relief, an answer or a good outcome. Chat never encourages it.',
    why: 'Google prohibits promoting self-harm; Apple reviews upsetting content under 1.1.',
    sources: ['google-violence', 'owner-ethics'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-writing-review/SKILL.md' }],
    editor: 'Read every line near a risk beat, including viewer chat, for approval or encouragement.' },

  { id: 'R1', family: 'real_world', title: 'Fictional companies and outlets only', severity: 'block', surfaces: [...ANY_TEXT, 'art'],
    rule: 'Apps, streams, outlets, brands and businesses are invented. No real company is named or implied.',
    why: 'Apple 1.1.2 bars targeting a real corporation; real marks in a violent scene invite a takedown.',
    sources: ['apple-1.1.2'],
    enforcedBy: [{ kind: 'text', check: 'R1' }, { kind: 'structure', ref: 'src/content/world.test.ts' }],
    editor: 'Replace any real brand with the city canon tokens ({delivery_app}, {stream_app}, {outlet}).' },
  { id: 'R2', family: 'real_world', title: 'No real incident, attack or victim', severity: 'block', surfaces: ['call_text', 'ending_text', 'generation', 'world_text'],
    rule: 'No call is modeled on an identifiable real incident, attack or victim, and none uses a real tragedy for effect.',
    why: 'Apple 1.1.7 and Google Sensitive Events both bar capitalizing on real tragedies.',
    sources: ['apple-1.1.7', 'google-sensitive'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-call-design/SKILL.md' }],
    editor: 'Ask of each premise whether a reader could name the real event it came from. If yes, change the premise, not the wording.' },
  { id: 'R3', family: 'real_world', title: 'No targeting by identity', severity: 'block', surfaces: ['generation', 'call_text'],
    rule: 'Names and pronouns are drawn without reading the role, danger or cooperation. No group is the only enemy.',
    why: 'Apple 1.1.2 bars enemies that solely target a real race, culture or group.',
    sources: ['apple-1.1.2'],
    enforcedBy: [{ kind: 'structure', ref: 'src/gen/incident/trees-v13/call-trees.test.ts' }],
    editor: 'Check that no role\'s lines depend on who the drawn person is.' },
  { id: 'R4', family: 'real_world', title: 'No real agencies', severity: 'fix', surfaces: [...ANY_TEXT, 'art'],
    rule: 'The department and its partners are invented. Real police and federal agencies are not named.',
    why: 'Avoids implying a real department endorses or is portrayed in a violent scene.',
    sources: ['apple-1.1.7'],
    enforcedBy: [{ kind: 'text', check: 'R4' }],
    editor: 'Replace a real agency with the invented department or a generic role.' },

  { id: 'H1', family: 'harassment', title: 'Addresses come from the generated place', severity: 'block', surfaces: ANY_TEXT,
    rule: 'No typed street address appears in authored text. A posted address is the generated, fictional place.',
    why: 'Doxxing a real address would be harassment of a real person, which Google bars.',
    sources: ['google-harassment'],
    enforcedBy: [{ kind: 'text', check: 'H1' }],
    editor: 'Use {place} or a description. Never a number and a street.' },
  { id: 'H2', family: 'harassment', title: 'Handles are curated', severity: 'fix', surfaces: ['handle', 'chat'],
    rule: 'Commenter handles are built only from curated pools and shapes, and a run of combinations is checked against an owner-approved blocklist.',
    why: 'A generated handle must not form a slur, a real person or a real brand.',
    sources: ['google-harassment', 'apple-1.2'],
    enforcedBy: [{ kind: 'structure', ref: 'src/content/world.test.ts' }, { kind: 'gap', backlog: 'policy-handle-blocklist', note: 'the pools are curated and tested against real brands, but nobody has run every combination against an approved blocklist' }],
    editor: 'Not a text control. Review new pool words before they ship.' },
  { id: 'U1', family: 'user_content', title: 'Chat is authored, never player or model text', severity: 'block', surfaces: ['chat', 'world_text', 'generation'],
    rule: 'Every comment, headline and message a player sees is authored or drawn from authored pools. No text a player types, and no model output at runtime, reaches another player or the screen.',
    why: 'Apple 1.2 needs filtering, reporting and blocking for user-generated content; scripted developer text is probably outside it (unverified for generated or player-influenced text), so the game keeps none.',
    sources: ['apple-1.2'],
    enforcedBy: [{ kind: 'structure', ref: 'src/content/incidents/reactions.test.ts' }, { kind: 'review', ref: '.agents/skills/swat-call-prose/references/live-chat.md' }],
    editor: 'Reject any proposal to generate chat or news at runtime unless the 1.2 safeguards ship with it.' },

  { id: 'A1', family: 'listing', title: 'Store art and previews suit 4+', severity: 'block', surfaces: ['art', 'store_metadata'],
    rule: 'Icons, screenshots and previews never show a gun pointed at a person or a gruesome death, and the hook text on a screenshot passes V1 to V5.',
    why: 'Apple 2.3.8 asks metadata to suit 4+ even when the app is rated higher.',
    sources: ['apple-2.3.8'],
    enforcedBy: [{ kind: 'gap', backlog: 'store-wrap', note: 'no store metadata checklist exists yet; it lands with the store packaging' }],
    editor: 'Check every screenshot and preview against the list before it is uploaded.' },
  { id: 'G1', family: 'rating', title: 'Rating answers come from the data', severity: 'block', surfaces: ['generation', 'store_metadata'],
    rule: 'The questionnaire answers are computed from each situation\'s descriptors (rating.ts), never typed by hand, and Apple and IARC answers come from the same profile.',
    why: 'Apple 2.3.6 and Google both require honest answers; a profile computed from content cannot drift.',
    sources: ['apple-2.3.6', 'google-ratings', 'apple-age'],
    enforcedBy: [{ kind: 'derived', ref: 'src/content/policy/rating.ts' }],
    editor: 'Not a text control. Run the profile when a call or descriptor is added.' },
  { id: 'G2', family: 'rating', title: 'First launch names the themes', severity: 'block', surfaces: ['ui'],
    rule: 'The first launch shows the advisory that names the themes plainly before the first call.',
    why: 'Reviewers and players should meet the content warning before the content.',
    sources: ['apple-2.3.6', 'apple-2.3.1'],
    enforcedBy: [{ kind: 'ui', ref: 'src/ui/settings/FirstRun.tsx' }],
    editor: 'Not a text control.' },
  { id: 'G3', family: 'rating', title: 'Call card warns by default', severity: 'fix', surfaces: ['ui'],
    rule: 'Each call card names its topics, and the warning is on by default.',
    why: 'Per-event warnings are the owner\'s disclosure control. They do not make otherwise prohibited content acceptable.',
    sources: ['apple-2.3.6'],
    enforcedBy: [{ kind: 'ui', ref: 'src/ui/settings/CardWarning.tsx' }],
    editor: 'Not a text control.' },
  { id: 'G4', family: 'rating', title: 'Filters never lower the rating', severity: 'block', surfaces: ['generation', 'ui', 'store_metadata'],
    rule: 'The profile counts every situation the game ships, ignoring any player\'s filters. A filter changes what is drawn, never what the questionnaire says.',
    why: 'The store rates the app, and the content still ships.',
    sources: ['apple-2.3.6', 'google-ratings'],
    enforcedBy: [{ kind: 'derived', ref: 'src/content/policy/rating.ts' }],
    editor: 'Not a text control.' },
  { id: 'G5', family: 'rating', title: 'Review notes ship with each submission', severity: 'fix', surfaces: ['store_metadata'],
    rule: 'Each submission carries review notes generated from the profile: fictional cast, the descriptors, the advisory, the support resource and the absence of user content.',
    why: 'Apple 2.3.1(a) wants unusual and sensitive features explained to the reviewer.',
    sources: ['apple-2.3.1'],
    enforcedBy: [{ kind: 'derived', ref: 'src/content/policy/rating.ts' }],
    editor: 'Not a text control.' },
  { id: 'G6', family: 'rating', title: 'A content change re-answers the questionnaire', severity: 'block', surfaces: ['generation', 'store_metadata'],
    rule: 'The rating profile is pinned by a test. A change to what the shipped calls can show fails the test until the questionnaire answers are re-read and the pin is updated.',
    why: 'Google needs a new questionnaire when content changes the answers.',
    sources: ['google-ratings', 'apple-2.3.6'],
    enforcedBy: [{ kind: 'structure', ref: 'src/gen/incident/gates/policy-corpus.test.ts' }],
    editor: 'Not a text control.' },

  { id: 'V6', family: 'violence', title: 'A threat never lingers', severity: 'fix', surfaces: ['threat_text', 'call_text'],
    rule: 'No repeated weapon contact with a named body part, no countdown or execution staging, no composed spectacle, no cruelty for its own sake. One concrete change in the room does the work.',
    why: 'The store audit read these as the places a reviewer is most likely to see abuse rather than danger, and they cost the writing nothing.',
    sources: ['apple-1.1.2', 'google-violence'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-call-prose/references/voice-and-soul.md' }],
    editor: 'If a threat line presses, drags or counts, replace it with the sound, the distance or the person who stops talking.' },
  { id: 'S6', family: 'self_harm', title: 'No preparation beats beside a risk question', severity: 'fix', surfaces: ['call_text', 'chat'],
    rule: 'Right after a suicide-risk question, no choice or line has the person give away belongings or settle affairs. The next beat is about the people waiting for them.',
    why: 'Disposing of belongings next to that question can read as preparation for death.',
    sources: ['google-violence', 'owner-ethics'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-writing-review/SKILL.md' }],
    editor: 'Read what the choices after a risk question ask the person to do. Any that sounds like putting things in order is changed to bringing someone in.' },
  { id: 'H3', family: 'harassment', title: 'No slurs or hate speech', severity: 'block', surfaces: ANY_TEXT,
    rule: 'No slur, no hate speech, no line aimed at a group. Strong language is for a person\'s own anger, never for a category of people.',
    why: 'Apple 1.1.1 and Google harassment policy; also the plain standard.',
    sources: ['google-harassment', 'apple-1.1.2'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-writing-review/SKILL.md' }, { kind: 'gap', backlog: 'policy-handle-blocklist', note: 'there is no machine check for slurs because the owner has not supplied an approved blocklist' }],
    editor: 'Read every line of strong language for who it is aimed at. A person under pressure curses at a situation or a person in the room, never at a group.' },
  { id: 'L1', family: 'quality', title: 'Strong language is speech, under pressure, and counted', severity: 'note', surfaces: ['call_text', 'threat_text', 'ending_text', 'chat'],
    rule: 'Strong language appears in direct speech from a person under real pressure. It is counted for the age-rating answers and named in the launch advisory.',
    why: 'The owner wants the central demand to land heavy, and the app is rated 18+. The questionnaire asks about language, so the count has to come from the data.',
    sources: ['owner-quality', 'apple-2.3.6', 'google-ratings'],
    enforcedBy: [{ kind: 'text', check: 'L1' }, { kind: 'derived', ref: 'src/content/policy/rating.ts' }],
    editor: 'Keep the language when it is the person speaking and the moment is hot. Cut it when it is decoration, repeated, or aimed at a group.' },
  { id: 'A2', family: 'listing', title: 'Listing text is held to the same limits', severity: 'block', surfaces: ['store_metadata'],
    rule: 'The app name, subtitle, keywords, description, promotional text and screenshot captions pass V1 to V5 and R1, and never promise content the app does not contain.',
    why: 'Metadata is read by reviewers before the app is, and Apple wants it to suit 4+.',
    sources: ['apple-2.3.8', 'apple-2.3.6'],
    enforcedBy: [{ kind: 'gap', backlog: 'store-wrap', note: 'listing text does not exist yet; its adapter lands with the store packaging' }],
    editor: 'Run the listing copy through checkText with the store_metadata surface before it is entered.' },
  { id: 'N1', family: 'listing', title: 'Notifications and share previews are neutral', severity: 'block', surfaces: ['ui'],
    rule: 'A notification, widget or share preview never names a crisis theme, a death, a weapon or a person at risk. It says that something is waiting.',
    why: 'External previews reach people who did not choose the content, outside the advisory and the filters.',
    sources: ['apple-2.3.6', 'google-violence'],
    enforcedBy: [{ kind: 'gap', backlog: 'policy-surfaces', note: 'notification preferences exist but delivery is not built; the neutral-copy rule has nothing to hold yet' }],
    editor: 'Read every outward string for what it would say on a lock screen.' },
  { id: 'M1', family: 'listing', title: 'No offer beside sensitive content', severity: 'block', surfaces: ['ui', 'generation'],
    rule: 'No ad, purchase prompt or offer appears during a call, on a debrief that shows the support line, or after an adverse result.',
    why: 'Selling beside a crisis scene is the kind of thing reviewers and players read as exploitative.',
    sources: ['apple-2.3.6', 'google-violence'],
    enforcedBy: [{ kind: 'gap', backlog: 'rewarded-ads', note: 'the backlog states the rule for the ad flow, but nothing enforces it yet' }],
    editor: 'Not a text control. Check every offer surface against the screens that show crisis content.' },
  { id: 'P1', family: 'listing', title: 'Privacy answers match the build', severity: 'block', surfaces: ['store_metadata'],
    rule: 'The App Privacy answers and the Play Data safety form list every SDK and every data flow in the build, and a content change never adds a flow without an update.',
    why: 'Both stores require accurate disclosures; ads and billing SDKs are planned.',
    sources: ['apple-2.3.6', 'google-ratings'],
    enforcedBy: [{ kind: 'gap', backlog: 'store-wrap', note: 'the forms are listed as release requirements in docs/monetization.md and have no check yet' }],
    editor: 'Not a text control.' },
  { id: 'G7', family: 'rating', title: 'The warning shows on every route into a call', severity: 'fix', surfaces: ['ui'],
    rule: 'The theme warning shows on the full card, the compact card, and the first-run call, and is announced with the control that opens the call.',
    why: 'A warning that one layout omits is not a warning.',
    sources: ['apple-2.3.6'],
    enforcedBy: [{ kind: 'ui', ref: 'src/ui/screens/CallTile.tsx' }, { kind: 'gap', backlog: 'policy-surfaces', note: 'the first-run call card carries only a general themes link, and the warning is not tied to the open button for assistive technology' }],
    editor: 'Not a text control.' },
  { id: 'G8', family: 'rating', title: 'Filters say what they cannot do', severity: 'block', surfaces: ['ui'],
    rule: 'The advisory and Settings name the themes every call carries and so cannot be switched off, and a saved exclusion is never dropped without telling the player.',
    why: 'A control that quietly does less than it says is misleading to the player and to a reviewer.',
    sources: ['apple-2.3.6'],
    enforcedBy: [{ kind: 'gap', backlog: 'policy-surfaces', note: 'sanitizeAvoid drops exclusions silently when no call would be left, and the advisory does not say which themes are unavoidable' }],
    editor: 'Not a text control.' },
  { id: 'Q5', family: 'quality', title: 'Every reference was set up first', severity: 'fix', surfaces: ['call_text', 'threat_text', 'ending_text', 'chat', 'world_text'],
    rule: 'A place, document, device, time or earlier event named in speech or narration was told to the reader on a surface they already read. The first mention names the thing ("her courier account", never "the account"). Speech never carries the exposition the narration owes.',
    why: 'The owner could not follow "the account" or a line about "the light on Calloway" nobody had explained.',
    sources: ['owner-quality'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-writing-review/SKILL.md' }],
    editor: 'For each spoken or narrated reference, name the earlier surface that set it up. If there is none, plant it there or cut it.' },
  { id: 'Q6', family: 'quality', title: 'Speech sounds spoken', severity: 'fix', surfaces: ['call_text', 'threat_text', 'ending_text', 'chat'],
    rule: 'Read each spoken line aloud as that person. Real speech has contractions, a breath and the order people use. It is not a written sentence with a relative clause and no connective.',
    why: 'The owner called "Somebody called cass1996 wants the address" a very unnatural sentence.',
    sources: ['owner-quality'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-call-prose/references/voice-and-soul.md' }],
    editor: 'Say the line out loud in the person\'s voice. Rewrite anything you would not say, and give each speaker a different rhythm.' },
  { id: 'Q7', family: 'quality', title: 'Natural idiom and possessives', severity: 'fix', surfaces: ['call_text', 'threat_text', 'ending_text', 'chat', 'world_text'],
    rule: 'A person\'s own things take the possessive ("her scooter"), and phrases are the ones people say ("before closing", not "before close").',
    why: 'The owner found "next to the scooter" and "before close" stiff.',
    sources: ['owner-quality'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-call-prose/references/voice-and-soul.md' }],
    editor: 'Replace officialese and bare articles with how a person would say it.' },
  { id: 'Q1', family: 'quality', title: 'Pronouns fit the person and stay clear', severity: 'fix', surfaces: ['call_text', 'ending_text', 'chat', 'world_text'],
    rule: 'Every person gets the pronouns drawn for them. A pronoun is used when it cannot be mistaken for another person in the string, and the person\'s name is used when it could.',
    why: 'The owner asked for appropriate pronouns; a misread "she" reads as a machine.',
    sources: ['owner-quality'],
    enforcedBy: [{ kind: 'structure', ref: 'src/gen/incident/trees-v13/pronouns.test.ts' }, { kind: 'structure', ref: 'src/gen/incident/trees-v13/call-trees.test.ts' }],
    editor: 'Read each long string under a she/she and a they/they draw and fix any pronoun that could be the wrong person.' },
  { id: 'Q2', family: 'quality', title: 'Clock times say AM or PM', severity: 'fix', surfaces: ['call_text', 'threat_text', 'ending_text', 'world_text'],
    rule: 'Every clock time in narration carries AM or PM, and a time the player must reason from carries its day. A radio call may speak a bare time inside its own quotation marks.',
    why: 'The owner asked for specific times; "11:40" alone leaves night or noon to the reader.',
    sources: ['owner-quality'],
    enforcedBy: [{ kind: 'text', check: 'Q2' }],
    editor: 'Add AM or PM, and the day where a time is evidence. Spoken lines may say "eleven-forty" once the narration has anchored it.' },
  { id: 'Q3', family: 'quality', title: 'Hidden truth is never printed', severity: 'block', surfaces: ['call_text', 'ending_text', 'chat'],
    rule: 'Nothing the player reads states a fact the call is built to hide, in any situation, until a result earns it.',
    why: 'The call\'s dilemma depends on it.',
    sources: ['owner-quality'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-writing-review/SKILL.md' }],
    editor: 'Never propose a rewrite that explains a hidden fact or lets one situation\'s truth show in another.' },
  { id: 'Q4', family: 'quality', title: 'Threats read as threats', severity: 'fix', surfaces: ['threat_text'],
    rule: 'A threat names who is threatened, what changes in the room (a sound, a position, a hand), and what the nearest person does. It is never flat text like "the handgun comes up".',
    why: 'The owner asked for threats that feel like threats, inside the limits above.',
    sources: ['owner-quality', 'google-violence'],
    enforcedBy: [{ kind: 'review', ref: '.agents/skills/swat-call-prose/references/voice-and-soul.md' }],
    editor: 'For each threat line, add one thing a person on scene could hear or see change, and one person reacting. Stay inside V1, V4 and V5.' },
  { id: 'E1', family: 'quality', title: 'Every call gets an editorial pass', severity: 'fix', surfaces: ['review', 'generation'],
    rule: 'A generated or newly written call goes through the editorial pass built from these controls, and the pass is logged.',
    why: 'The owner asked for the review a published piece gets.',
    sources: ['owner-quality'],
    enforcedBy: [{ kind: 'process', ref: 'docs/content-pipeline.md' }, { kind: 'review', ref: '.agents/skills/swat-writing-review/SKILL.md' }],
    editor: 'Log what changed and what was left alone.' },
];

export const controlById = (id: ControlId): Control => CONTROLS.find((control) => control.id === id)!;
export const controlsFor = (surface: Surface): Control[] => CONTROLS.filter((control) => control.surfaces.includes(surface));
export const gaps = (): { control: Control; gap: Extract<Enforcement, { kind: 'gap' }> }[] =>
  CONTROLS.flatMap((control) => control.enforcedBy.flatMap((e) => e.kind === 'gap' ? [{ control, gap: e }] : []));
