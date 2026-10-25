# Content policy

<!-- Generated from src/content/policy by src/gen/incident/gates/policy-corpus.test.ts. Do not edit by hand: change the controls and re-render with `npx vitest run src/gen/incident/gates/policy-corpus.test.ts -u`. -->

The store rules and the owner's standards, written once as numbered controls that every surface reads: the string gates, the generators' tests, the rating answers, the editorial pass, the settings screens and these docs. A control says what the content must do, why, where it applies, how it is held, and what an editor does about it. A control no check holds is listed as a gap with a backlog id.

Nothing here is legal advice. The store pages were read through a summarising fetch on the dates below, so open the URL before relying on exact wording.

## Sources

| Id | Source | Read | What it says |
| --- | --- | --- | --- |
| apple-1.1.2 | [App Review Guidelines 1.1.2](https://developer.apple.com/app-store/review/guidelines/) | 2026-10-24, summary | Realistic portrayals of people being killed, maimed, tortured or abused, and content that encourages violence, are objectionable. Fictional enemies may not solely target a real race, culture, government or corporation. |
| apple-1.1.3 | [App Review Guidelines 1.1.3](https://developer.apple.com/app-store/review/guidelines/) | 2026-10-24, summary | Depictions that encourage illegal or reckless use of weapons, or help buy firearms or ammunition, are not allowed. |
| apple-1.1.7 | [App Review Guidelines 1.1.7](https://developer.apple.com/app-store/review/guidelines/) | 2026-10-24, summary | Content that capitalizes on violent conflicts, terrorist attacks or epidemics is not allowed. |
| apple-1.2 | [App Review Guidelines 1.2](https://developer.apple.com/app-store/review/guidelines/) | 2026-10-24, summary | Apps where players post or see other players' content need filtering, reporting, blocking and contact details. Scripted developer-written comments are probably outside it; runtime-generated or player-influenced comments are unclear. |
| apple-2.3.1 | [App Review Guidelines 2.3.1(a)](https://developer.apple.com/app-store/review/guidelines/) | 2026-10-24, summary | Explain unusual features and sensitive content in the notes for review and make them reachable by the reviewer. |
| apple-2.3.6 | [App Review Guidelines 2.3.6](https://developer.apple.com/app-store/review/guidelines/) | 2026-10-24, summary | Answer the age rating questions honestly; a wrong rating can draw a regulatory inquiry. |
| apple-2.3.8 | [App Review Guidelines 2.3.8](https://developer.apple.com/app-store/review/guidelines/) | 2026-10-24, summary | Icons, screenshots and previews should suit a 4+ audience even when the app is rated higher; Apple names a gun pointed at a specific character and a gruesome death as images to avoid. |
| apple-age | [App Store Connect, age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions) | 2026-10-24, summary | Tiers 4+, 9+, 13+, 16+, 18+. Realistic violence (a lifelike shoot-out counts): infrequent 13+, frequent 18+. Guns: frequent 13+. Mature themes (real-world crimes, trauma): frequent 16+. Prolonged graphic or sadistic realistic violence leaves an app unrated, which cannot ship on the App Store. Updated age-rating questions have been required since 31 January 2026 (a Codex read of the Apple developer news pages, 2026-10-24); the newer social-media capability questions follow in September 2026. Apple gives no number for infrequent or frequent. |
| google-violence | [Play Developer Policy, Inappropriate Content: Violence](https://support.google.com/googleplay/android-developer/answer/9878810) | 2026-10-24, summary | Gratuitous violence, graphic depictions or descriptions of realistic violence, violent threats to any person, and promoting self-harm or suicide are prohibited. Fictional violence in games is generally allowed. |
| google-sensitive | [Play Developer Policy, Sensitive Events](https://support.google.com/googleplay/android-developer/answer/9878810) | 2026-10-24, summary | No capitalizing on or insensitivity toward real tragedies or deaths, including a real person's death by suicide or overdose. |
| google-harassment | [Play Developer Policy, Bullying and Harassment](https://support.google.com/googleplay/android-developer/answer/9878810) | 2026-10-24, summary | No threats, harassment or humiliation, including of victims and their families after a tragedy. The policy is not expressly limited to real people, so a fictional portrayal is an interpretation, not an exemption. |
| google-ratings | [Play Console, content rating requirements (IARC)](https://support.google.com/googleplay/android-developer/answer/9859655) | 2026-10-24, summary | Every app completes the IARC questionnaire honestly; an unrated app is removed; a change to content that alters the answers needs a new questionnaire. |
| owner-grounded | AGENTS.md, Player-facing writing | 2026-10-24, owner | Consequences land plainly on named people with no wound anatomy or method. Preserving life is what the game values, and force is never the reward. |
| owner-ethics | .agents/skills/swat-call-design/references/ethics-and-authenticity.md | 2026-10-24, owner | The call design ethics rules: no self-harm method (E4.1), no gore (E7), force gated on a visible threat to life (E12.5), a support line after crisis calls (E4.7). |
| owner-quality | owner messages, 2026-10-24 | 2026-10-24, owner | People get the pronouns that fit them, times say AM or PM, threats read as threats, and prose gets an editorial pass the way a published piece does. |

## Controls

### Violence and weapons

| Control | Rule | Severity | Held by | Sources |
| --- | --- | --- | --- | --- |
| **V1** No graphic harm | Harm is one plain fact about a named person. No wound anatomy, gore, or prolonged detail of injury or death. | block | text check V1; review, `.agents/skills/swat-writing-review/SKILL.md` | apple-age, apple-1.1.2, google-violence, owner-grounded |
| **V2** Force is never the reward | Force outcomes cost trust and go to review. No line celebrates, enjoys or rewards force. | block | structure, `src/sim/outcome-score.test.ts`; review, `.agents/skills/swat-writing-review/SKILL.md` | apple-1.1.2, google-violence, owner-grounded, owner-ethics |
| **V3** Death and injury are brief and plain | A death or serious injury is stated once, in a sentence or two, on the people left behind. It is never the subject of a scene. | fix | review, `.agents/skills/swat-call-prose/references/voice-and-soul.md` | apple-age, google-violence, owner-grounded |
| **V4** Menace comes from behavior, not method | A threat line carries menace through who is threatened, proximity, control, sound, time and how the people in the room react. It never names a method of harm. | fix | text check V4; review, `.agents/skills/swat-call-prose/references/voice-and-soul.md` | google-violence, apple-1.1.2, owner-quality |
| **V5** Weapons are generic and never how-to | Weapons are named by type (handgun, rifle, shotgun). No real makes, models, calibers, modifications or ways to get one. | block | text check V5 | apple-1.1.3 |
| **V6** A threat never lingers | No repeated weapon contact with a named body part, no countdown or execution staging, no composed spectacle, no cruelty for its own sake. One concrete change in the room does the work. | fix | review, `.agents/skills/swat-call-prose/references/voice-and-soul.md` | apple-1.1.2, google-violence |

### Self-harm

| Control | Rule | Severity | Held by | Sources |
| --- | --- | --- | --- | --- |
| **S1** No self-harm method | No means, amounts or acts of self-harm reach the player, whether or not they chose the topic. | block | text check S1; review, `.agents/skills/swat-writing-review/SKILL.md` | google-violence, owner-ethics |
| **S2** Support is always reachable | A support entry stays in Settings, and the debrief of any situation with a self-harm risk shows the support line, whatever the warning setting. | block | ui, `src/ui/settings/DebriefSupport.tsx` | owner-ethics, apple-2.3.1 |
| **S3** An at-risk person is never shown dying | A subject at risk of self-harm never dies on the card. Force on them is `noFatal`, and the negotiator asks the direct question off the card. | block | structure, `src/gen/incident/gates/content-descriptors.test.ts` | owner-ethics, google-violence |
| **S4** Self-harm is declared and filterable | Every situation with a subject at risk declares `suicide_self_harm`, the card warns, and the player can filter it. | block | structure, `src/gen/incident/gates/content-descriptors.test.ts`; ui, `src/ui/settings/CardWarning.tsx` | apple-2.3.6, google-ratings |
| **S5** Self-harm is never framed as a solution | No line, choice, comment or ending presents self-harm as relief, an answer or a good outcome. Chat never encourages it. | block | review, `.agents/skills/swat-writing-review/SKILL.md` | google-violence, owner-ethics |
| **S6** No preparation beats beside a risk question | Right after a suicide-risk question, no choice or line has the person give away belongings or settle affairs. The next beat is about the people waiting for them. | fix | review, `.agents/skills/swat-writing-review/SKILL.md` | google-violence, owner-ethics |

### The real world

| Control | Rule | Severity | Held by | Sources |
| --- | --- | --- | --- | --- |
| **R1** Fictional companies and outlets only | Apps, streams, outlets, brands and businesses are invented. No real company is named or implied. | block | text check R1; structure, `src/content/world.test.ts` | apple-1.1.2 |
| **R2** No real incident, attack or victim | No call is modeled on an identifiable real incident, attack or victim, and none uses a real tragedy for effect. | block | review, `.agents/skills/swat-call-design/SKILL.md` | apple-1.1.7, google-sensitive |
| **R3** No targeting by identity | Names and pronouns are drawn without reading the role, danger or cooperation. No group is the only enemy. | block | structure, `src/gen/incident/trees-v13/call-trees.test.ts` | apple-1.1.2 |
| **R4** No real agencies | The department and its partners are invented. Real police and federal agencies are not named. | fix | text check R4 | apple-1.1.7 |

### Harassment and addresses

| Control | Rule | Severity | Held by | Sources |
| --- | --- | --- | --- | --- |
| **H1** Addresses come from the generated place | No typed street address appears in authored text. A posted address is the generated, fictional place. | block | text check H1 | google-harassment |
| **H2** Handles are curated | Commenter handles are built only from curated pools and shapes, and a run of combinations is checked against an owner-approved blocklist. | fix | structure, `src/content/world.test.ts`; GAP, backlog `policy-handle-blocklist` | google-harassment, apple-1.2 |
| **H3** No slurs or hate speech | No slur, no hate speech, no line aimed at a group. Strong language is for a person's own anger, never for a category of people. | block | review, `.agents/skills/swat-writing-review/SKILL.md`; GAP, backlog `policy-handle-blocklist` | google-harassment, apple-1.1.2 |

### Other people's content

| Control | Rule | Severity | Held by | Sources |
| --- | --- | --- | --- | --- |
| **U1** Chat is authored, never player or model text | Every comment, headline and message a player sees is authored or drawn from authored pools. No text a player types, and no model output at runtime, reaches another player or the screen. | block | structure, `src/content/incidents/reactions.test.ts`; review, `.agents/skills/swat-call-prose/references/live-chat.md` | apple-1.2 |

### The store listing

| Control | Rule | Severity | Held by | Sources |
| --- | --- | --- | --- | --- |
| **A1** Store art and previews suit 4+ | Icons, screenshots and previews never show a gun pointed at a person or a gruesome death, and the hook text on a screenshot passes V1 to V5. | block | GAP, backlog `store-wrap` | apple-2.3.8 |
| **A2** Listing text is held to the same limits | The app name, subtitle, keywords, description, promotional text and screenshot captions pass V1 to V5 and R1, and never promise content the app does not contain. | block | GAP, backlog `store-wrap` | apple-2.3.8, apple-2.3.6 |
| **N1** Notifications and share previews are neutral | A notification, widget or share preview never names a crisis theme, a death, a weapon or a person at risk. It says that something is waiting. | block | GAP, backlog `policy-surfaces` | apple-2.3.6, google-violence |
| **M1** No offer beside sensitive content | No ad, purchase prompt or offer appears during a call, on a debrief that shows the support line, or after an adverse result. | block | GAP, backlog `rewarded-ads` | apple-2.3.6, google-violence |
| **P1** Privacy answers match the build | The App Privacy answers and the Play Data safety form list every SDK and every data flow in the build, and a content change never adds a flow without an update. | block | GAP, backlog `store-wrap` | apple-2.3.6, google-ratings |

### Rating and disclosure

| Control | Rule | Severity | Held by | Sources |
| --- | --- | --- | --- | --- |
| **G1** Rating answers come from the data | The questionnaire answers are computed from each situation's descriptors (rating.ts), never typed by hand, and Apple and IARC answers come from the same profile. | block | derived, `src/content/policy/rating.ts` | apple-2.3.6, google-ratings, apple-age |
| **G2** First launch names the themes | The first launch shows the advisory that names the themes plainly before the first call. | block | ui, `src/ui/settings/FirstRun.tsx` | apple-2.3.6, apple-2.3.1 |
| **G3** Call card warns by default | Each call card names its topics, and the warning is on by default. | fix | ui, `src/ui/settings/CardWarning.tsx` | apple-2.3.6 |
| **G4** Filters never lower the rating | The profile counts every situation the game ships, ignoring any player's filters. A filter changes what is drawn, never what the questionnaire says. | block | derived, `src/content/policy/rating.ts` | apple-2.3.6, google-ratings |
| **G5** Review notes ship with each submission | Each submission carries review notes generated from the profile: fictional cast, the descriptors, the advisory, the support resource and the absence of user content. | fix | derived, `src/content/policy/rating.ts` | apple-2.3.1 |
| **G6** A content change re-answers the questionnaire | The rating profile is pinned by a test. A change to what the shipped calls can show fails the test until the questionnaire answers are re-read and the pin is updated. | block | structure, `src/gen/incident/gates/policy-corpus.test.ts` | google-ratings, apple-2.3.6 |
| **G7** The warning shows on every route into a call | The theme warning shows on the full card, the compact card, and the first-run call, and is announced with the control that opens the call. | fix | ui, `src/ui/screens/CallTile.tsx`; GAP, backlog `policy-surfaces` | apple-2.3.6 |
| **G8** Filters say what they cannot do | The advisory and Settings name the themes every call carries and so cannot be switched off, and a saved exclusion is never dropped without telling the player. | block | GAP, backlog `policy-surfaces` | apple-2.3.6 |

### Prose quality and process

| Control | Rule | Severity | Held by | Sources |
| --- | --- | --- | --- | --- |
| **L1** Strong language is speech, under pressure, and counted | Strong language appears in direct speech from a person under real pressure. It is counted for the age-rating answers and named in the launch advisory. | note | text check L1; derived, `src/content/policy/rating.ts` | owner-quality, apple-2.3.6, google-ratings |
| **Q5** Every reference was set up first | A place, document, device, time or earlier event named in speech or narration was told to the reader on a surface they already read. The first mention names the thing ("her courier account", never "the account"). Speech never carries the exposition the narration owes. | fix | review, `.agents/skills/swat-writing-review/SKILL.md` | owner-quality |
| **Q6** Speech sounds spoken | Read each spoken line aloud as that person. Real speech has contractions, a breath and the order people use. It is not a written sentence with a relative clause and no connective. | fix | review, `.agents/skills/swat-call-prose/references/voice-and-soul.md` | owner-quality |
| **Q7** Natural idiom and possessives | A person's own things take the possessive ("her scooter"), and phrases are the ones people say ("before closing", not "before close"). | fix | review, `.agents/skills/swat-call-prose/references/voice-and-soul.md` | owner-quality |
| **Q1** Pronouns fit the person and stay clear | Every person gets the pronouns drawn for them. A pronoun is used when it cannot be mistaken for another person in the string, and the person's name is used when it could. | fix | structure, `src/gen/incident/trees-v13/pronouns.test.ts`; structure, `src/gen/incident/trees-v13/call-trees.test.ts` | owner-quality |
| **Q2** Clock times say AM or PM | Every clock time in narration carries AM or PM, and a time the player must reason from carries its day. A radio call may speak a bare time inside its own quotation marks. | fix | text check Q2 | owner-quality |
| **Q3** Hidden truth is never printed | Nothing the player reads states a fact the call is built to hide, in any situation, until a result earns it. | block | review, `.agents/skills/swat-writing-review/SKILL.md` | owner-quality |
| **Q4** Threats read as threats | A threat names who is threatened, what changes in the room (a sound, a position, a hand), and what the nearest person does. It is never flat text like "the handgun comes up". | fix | review, `.agents/skills/swat-call-prose/references/voice-and-soul.md` | owner-quality, google-violence |
| **E1** Every call gets an editorial pass | A generated or newly written call goes through the editorial pass built from these controls, and the pass is logged. | fix | process, `docs/content-pipeline.md`; review, `.agents/skills/swat-writing-review/SKILL.md` | owner-quality |

## Gaps

- **H2** Handles are curated: the pools are curated and tested against real brands, but nobody has run every combination against an approved blocklist (backlog `policy-handle-blocklist`).
- **A1** Store art and previews suit 4+: no store metadata checklist exists yet; it lands with the store packaging (backlog `store-wrap`).
- **H3** No slurs or hate speech: there is no machine check for slurs because the owner has not supplied an approved blocklist (backlog `policy-handle-blocklist`).
- **A2** Listing text is held to the same limits: listing text does not exist yet; its adapter lands with the store packaging (backlog `store-wrap`).
- **N1** Notifications and share previews are neutral: notification preferences exist but delivery is not built; the neutral-copy rule has nothing to hold yet (backlog `policy-surfaces`).
- **M1** No offer beside sensitive content: the backlog states the rule for the ad flow, but nothing enforces it yet (backlog `rewarded-ads`).
- **P1** Privacy answers match the build: the forms are listed as release requirements in docs/monetization.md and have no check yet (backlog `store-wrap`).
- **G7** The warning shows on every route into a call: the first-run call card carries only a general themes link, and the warning is not tied to the open button for assistive technology (backlog `policy-surfaces`).
- **G8** Filters say what they cannot do: sanitizeAvoid drops exclusions silently when no call would be left, and the advisory does not say which themes are unavoidable (backlog `policy-surfaces`).

## Rating profile

A working classification computed from the 6 situations the game ships. A player's filters are not an input. "Frequent" means at least 25% of situations can show the theme: the developer's working reading of a word Apple does not define, not an owner decision, and not a measure of how often a player meets it. The questionnaire itself is answered by a person (backlog `policy-rating-evidence`).

| Descriptor | Share of situations |
| --- | --- |
| death | 50% |
| suicide_self_harm | 50% |
| injury | 100% |
| police_gunfire | 100% |
| child_at_risk | 50% |
| domestic_violence | 0% |

| Apple question | Answer |
| --- | --- |
| Realistic violence | frequent |
| Prolonged graphic or sadistic violence | none |
| Guns or other weapons | frequent |
| Mature or suggestive themes | frequent |
| Horror or fear themes | frequent |
| Strong language | frequent |
| Implied minimum age | 18+ |

Still answered by a person:

- Apple: the medical or treatment and the health or wellness questions (the game has a support line and crisis calls but gives no medical guidance).
- Apple: the new questions on in-app controls, capabilities and social features (no chat between players, no user-generated content, no ads yet).
- IARC: violence against humans and vulnerable characters, fear, and references to suicide, answered from the shares above; the IARC wording was not read.
- Apple and IARC: the language, profanity and crude humor questions (the game has strong language in direct speech; the exact question wording was not read).
- Per region: IARC and Apple assign regional ratings; confirm each territory the game is sold in.
- Everything else in the questionnaires: the profile covers selected topics only, and an 18+ result does not make the content acceptable to review.

### Review notes, generated

- Tactically Idle is a work of fiction. Every person, company, app and outlet in it is invented, and no call is based on a real incident.
- Calls are text and blueprint scenarios about armed standoffs. Across 6 shipped situations, 100% can show someone hurt, 50% can end with a death stated in one plain sentence, and 50% involve a person at risk of self-harm. Nothing graphic is shown or described.
- The first launch shows an advisory that names these themes. Each call card warns about its topics, and Settings lets the player filter each theme off the board. Filters change what is drawn, not the content the app contains.
- A support line shows in the debrief of every call with a self-harm theme, and a Support entry stays in Settings.
- There is no chat between players and no user-generated content. Viewer comments inside a livestream scenario are written by the developer and drawn from fixed pools.
- Working age rating answers, computed from the shipped content: realistic violence frequent, weapons frequent, mature themes frequent, horror or fear frequent, strong language frequent, prolonged graphic violence none.
