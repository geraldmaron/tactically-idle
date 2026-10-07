# Sources

Where each rule in this skill comes from. Two kinds of source are listed, and
they carry different confidence.

- **Read by the author of this skill on 2026-10-06.** The repo files and the
  written-voice skill. Values quoted from them are observed, and they can go
  stale, so re-read before trusting a number.
- **Opened by the research pass for this skill set on 2026-10-06.** The craft,
  psychology and safety sources. The author of this file worked from that
  pass's notes and did not re-open them. Where the pass read a source only
  through a reproduction or a summary, the entry says so. URLs are given where
  the pass recorded them.

Never cite a source from this list in game text, and never quote one beyond a
short phrase.

## Repo files (read)

| File, with a search string if it moved | Supports |
|---|---|
| src/gen/incident/gates/prose-lint.ts, search LENGTH_BUDGETS | lint ceilings, word lists, spoiler rule, name and pronoun rules |
| src/gen/incident/frameworks-v9.ts, search "Response unfinished" | compiler-owned strings and the one-field-many-surfaces wiring |
| src/content/incident-frameworks-v9.ts, search "An alarm on its own" | the IncidentFramework fields and the weak openings |
| src/content/framework-depth-v12.ts, search "It takes much longer" | the waitFor sentence repeated ten times |
| src/gen/incident/stories-v5/armed.ts, search "The gunfire stops" | the bar line and two weak lines |
| src/gen/incident/stories-v5/signature.ts, search "one signature" | the second bar line and care written as inventory |
| src/gen/incident/characteristics-v9.ts, search "two extra minutes" | the narrated pacing line and the appended summary sentence |
| src/gen/incident/stories-v6/episode-plan.ts, search bindScenarioText | whole-word, case-sensitive name binding |
| src/sim/operation-selectors.ts, search "{lead}" | {lead} becomes the surname, or "Squad" |
| src/gen/incident/plain-language-v3.test.ts, search "qualified" | the plain-language bans |
| src/gen/incident/index.ts, search INCIDENT_CONTENT_VERSION | the current content version, 12 on the date read |
| src/ui/screens/situation-panel.css and src/ui/app.css, search line-clamp | the 3-line, 2-line and stage label clamps |
| src/ui/screens/LiveView.tsx, search outcomePreview.favorable | the summary hidden when it equals the favorable preview |
| src/ui/components/labels.ts, search TRAIT_INFO | the trait condition sentences |
| docs/content-pipeline.md, search "Agent brief template" | the agent brief prose rules, the story sheet, the freeze rule |

## The written-voice skill (read)

| Source | Supports |
|---|---|
| written-voice SKILL.md | the house voice this skill defers to and never restates |
| written-voice references/verification-record.md | the composition rule, where the shape owner writes the record |
| written-voice scripts/voice-check.py | the checker, its allow flag replacing the default list, its two-dash allowance, its paragraph targets |

## Line craft (opened by the research pass)

| Source | Supports |
|---|---|
| Chakrabarty, Laban and Wu, "Can AI Writing Be Salvaged?", CHI 2025, arXiv 2409.14509 | the detector list, including redundant exposition |
| Paech and others, "Antislop", arXiv 2510.15061, 2025 | sensory clichés and repeated machine phrasing |
| Elmore Leonard, ten rules of writing, New York Times, July 2001, read through a reproduction | "said" only, no adverbs on it, leave out what readers skip |
| Hemingway, Death in the Afternoon, chapter 16, read through the Wikipedia article on the iceberg theory | know the iceberg, ship the tip |
| Raymond Carver, "On Writing", 1981, reprinted in Prospect, September 2005 | plain, exact words that still carry |
| NPR, "Joe Wambaugh, The Writer Who Redefined LAPD", 2008 | how the job acts on the officer, voice that changes with strain |
| Richard Price interview, The Believer | humor that is exact, dialogue that sounds overheard |
| Failbetter Games, Fallen London writer guidelines part III and "Agency and Choices" | no narrated feelings, word limits per scene and option |
| Whalen and Zimmerman, "Describing Trouble", Language in Society 19(4), 1990 | callers prove what they know by saying how they know it |
| Vecchi, Van Hasselt and Romano, "Crisis (Hostage) Negotiation", Aggression and Violent Behavior 10(5), 2005 | active listening order for negotiator lines |
| Nielsen Norman Group, "Reading Content on Mobile Devices", 2016, https://www.nngroup.com/articles/mobile-content/ | brevity on phones, front-loading |
| Nielsen Norman Group, "How Long Do Users Stay on Web Pages", https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/ | the seconds a player gives a screen |

## Screen and game craft behind specific line rules (opened by the research pass)

| Source | Supports |
|---|---|
| NPR transcript of Dick Wolf, 2003, https://www.npr.org/transcripts/127019083 | cut the hallway, no quips at gunpoint, less blood than a real scene |
| Den of Geek interview with Denis Villeneuve, https://www.denofgeek.com/?p=389978 | stretch the wait, release in one line |
| Inlander on writers of S.W.A.T., https://www.inlander.com/archive/how-writers-of-cop-tv-shows-like-s-w-a-t-are-wrestling-with-the/article_395a9111-f131-5eed-8e0a-6aa630c0073a.html | equipment described by what it avoids, de-escalation over escalation |
| Color of Change, Normalizing Injustice, 2020, https://hollywood.colorofchange.org/crime-tv-report | the copaganda patterns the ethics line guards against |
| Kahneman and Tversky, "Prospect Theory", 1979 | write each option as what it puts at risk |
| Kahneman and others, "When More Pain Is Preferred to Less", 1993 | write the ending last, peak and end |
| Game Informer on Sid Meier's GDC 2010 keynote | pair odds with one concrete adverse case |
| Choice of Games, "5 Rules for Writing Interesting Choices", 2010 | the swap and tone tests on choice pairs |

## Plain language and safety (opened by the research pass)

| Source | Supports |
|---|---|
| CISA and SAFECOM, Plain Language Guide, https://www.cisa.gov/sites/default/files/publications/PlainLanguageGuide.pdf | no ten-codes, plain radio |
| Samaritans, guidance on depicting suicide and self-harm in drama, https://www.samaritans.org/documents/1039/Guidance_on_depictions_of_suicide_and_self-harm_in_drama_and_film_Digital.pdf | no method, no single cause, words to avoid |
| Everymind, Mindframe stage and screen resource, 2020, https://cdn.mindframe.org.au/assets/src/uploads/MF-Guidelines-Stage-Screen-DP-LR.pdf | crisis wording, death off the card |
| Everymind, Mindframe guidelines on mental illness, violence and crime, 2020, https://cdn.mindframe.org.au/assets/src/uploads/MF_Guidelines_Violence_and_Crime_spread_FINAL.pdf | mental illness is not the explanation, stigmatizing words |
| Level Up, guidelines for reporting domestic abuse deaths, 2nd edition, 2024, https://welevelup.org/media-guidelines | no "snapped", the pattern of control |
| FBI Law Enforcement Bulletin, Noesner, 2024, https://leb.fbi.gov/articles/featured-articles/fifty-years-of-fbi-crisis-hostage-negotiation | most crisis calls have no hostage, listening before any way out |
| 988 Suicide and Crisis Lifeline, https://988lifeline.org/ | the US-only line, pending an owner decision on where it appears |

## Sources not used

The research pass could not open these, so nothing in this skill rests on
them. Do not cite them. Bruckheimer interviews on WorldScreen, an NPR
retrospective on 24, Television Academy video segments, and a Bustle interview
about 9-1-1.
