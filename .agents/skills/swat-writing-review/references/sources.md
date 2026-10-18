# Sources

What each rule in this skill rests on. Accessed 2026-10-06. Two groups, kept apart on purpose.
Repo files and local tools were read by the author of this skill. Outside sources were opened by
the research pass for this skill set on the same date and were not reopened by this file's
author. Re-check any figure before quoting it to a player or a stakeholder.

## Repo files and local tools, read directly

| Source | What it supports here |
| --- | --- |
| docs/content-pipeline.md, "Human review" and "Current fingerprint policy" | The review checklist mapped in review-rubric.md, approve, edit or reject in the pull request, edits returned as data, the deliberate fingerprint recapture |
| /story.html on the dev server (lab view), replaced on 2026-10-09 by the Scenario Lab at /lab (docs/scenario-lab.md) | The URL parameters it wrote, the path explorer summary, flat-odds notes, reference squad line, absence of a verdict field. The lab that replaced it has a call verdict, saves notes to docs/calls/notes/<type>.json and exports findings in SKILL.md section 11's row shape |
| src/content/call-trees/civilian-names.ts and the name gate in src/gen/incident/trees-v13/call-trees.test.ts | The civilian name pools are disjoint from the officer catalog, so the roster-surname collision found on 2026-10-06 in the retired cast code can no longer happen |
| src/gen/incident/gates/prose-lint.ts | `UNSAFE_DETAIL`, `META_PHRASING` and the other word lists |
| scripts/check-strings.ts | `npm run check:strings`: every call bound with the longest names and sent to the string checker, one call at a time |
| src/content/personas.json | 27 of 100 notes using "enjoys", the "pavement" note |
| src/gen/incident/trees-v13/compiled-fingerprints.json | The only tripwire, recaptured deliberately |
| The retired typed package, v12 depth, cast, hand-authored story and Maple Street scenario files, read 2026-10-06 | The target lines, the bureaucratic summary, the repeated waitFor sentence and the stock urgency prompts quoted in examples, as dated evidence. They were deleted on 2026-10-17 and no path is cited |
| package.json scripts | `npm test`, `npm run verify` and no strings exporter |
| written-voice skill (SKILL.md, references/verification-record.md and its voice-check script) | The composition rule (shape owner writes the record, others add one line), the Tells checked slot, the checker's CLI and that `--allow` replaces its list |

## Choice, consequence and structure

- Choice of Games, "5 Rules for Writing Interesting Choices in Multiple Choice Games" (2010).
  https://www.choiceofgames.com/2010/03/5-rules-for-writing-interesting-choices-in-multiple-choice-games/
  Supports fake-choice lines 3, 5 and 6 (dominant options, nothing changes, opting out is free).
- Choice of Games, "How to Write Intentional Choices" (2016).
  https://choiceofgames.com/2016/12/how-to-write-intentional-choices
  Supports the cue trace. Players are most frustrated when results contradict the intention they
  chose with.
- Mawhorter, Mateas, Wardrip-Fruin and Jhala, choice poetics slides (2014).
  https://www.cs.hmc.edu/~pmawhorter/research/slides/choice_poetics-Mawhorter_Mateas_Wardrip-Fruin_Jhala-2014.pdf
  Supports fake-choice line 4 (blind choices). Partly read, mostly images, one slide used.
- Wardrip-Fruin and colleagues, "Agency Reconsidered", DiGRA 2009.
  https://www.cs.uky.edu/~sgware/reading/papers/wardripfruin2009agency.pdf
  Supports line 5 and the path log column for what the player saw change.
- Sam Kabo Ashwell, "Standard Patterns in Choice-Based Games" (2015).
  https://heterogenoustasks.wordpress.com/2015/01/26/standard-patterns-in-choice-based-games/
  Supports line 7 and the memory test (branches that rejoin forget choices unless state is tracked).
- Emily Short, "Small-Scale Structures in CYOA" (2016).
  https://emshort.blog/2016/11/05/small-scale-structures-in-cyoa/
  Supports reading the three stages as one escalating dilemma.
- Game Informer on Sid Meier's GDC 2010 keynote.
  https://gameinformer.com/b/news/archive/2010/03/12/sid-meier-gamers-arent-logical.aspx
  Supports the odds test (players judge odds by feel). Secondary report of a talk.
- Kahneman, Fredrickson, Schreiber and Redelmeier, "When More Pain Is Preferred to Less" (1993).
  https://mrbartonmaths.com/resourcesnew/8.%20Research/Cognitive%20Psychology/When%20more%20pain%20is%20preferred%20to%20less.pdf
  Supports reading the ending last and alone, and pattern G4. The 1996 follow-up did not load.

## Reading on a phone

- Nielsen Norman Group, "How Long Do Users Stay on Web Pages?"
  https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/
  Supports the timed cold read (people decide in about ten seconds). Web pages, not games.
- Nielsen Norman Group, "Reading Content on Mobile Devices" (2016).
  https://www.nngroup.com/articles/mobile-content/
  Supports checking clamps at 390px and the house targets for short strings.

## Representation, ethics and crisis

- Color of Change, Normalizing Injustice (2020).
  https://hollywood.colorofchange.org/crime-tv-report
  Supports C1, C2, C5 and C10. An advocacy organization's content study of crime television.
- Geena Davis Institute, representation in games. https://geenadavisinstitute.org/?p=354
  Supports the skew tally and routing identity lines to a human.
- Haggis-Burridge and colleagues, "Building Better Minority Characters" (2020).
  https://pure.buas.nl/en/publications/building-better-minority-characters/
  Supports the officer representation checks.
- Everymind, Mindframe guidelines on mental illness, violence and crime (2020).
  https://cdn.mindframe.org.au/assets/src/uploads/MF_Guidelines_Violence_and_Crime_spread_FINAL.pdf
  Supports C6 and the rule that mental illness is not the explanation.
- Everymind, Mindframe stage and screen resource (2020).
  https://cdn.mindframe.org.au/assets/src/uploads/MF-Guidelines-Stage-Screen-DP-LR.pdf
- Samaritans, guidance on depicting suicide and self-harm in drama and film.
  https://www.samaritans.org/documents/1039/Guidance_on_depictions_of_suicide_and_self-harm_in_drama_and_film_Digital.pdf
  Both support the crisis rules and the crisis frequency count.
- 988 Suicide and Crisis Lifeline. https://988lifeline.org/
  US only. Where a support line appears in the game is an open owner decision.
- CISA SAFECOM, Plain Language Guide (undated).
  https://www.cisa.gov/sites/default/files/publications/PlainLanguageGuide.pdf
  Supports radio checks and G5 (plain words over codes).
- LAPD Office of the Inspector General, Review of LAPD SWAT Operations (2026).
  https://www.oig.lacity.org/_files/ugd/b2dd23_740812f610304fe0ba3b9e32b4b35173.pdf
  Supports inline 2 (most incidents end without force). One large full-time team, an atypical scale.

## Screen craft behind the copaganda patterns

- Dick Wolf, NPR interview (2003). https://www.npr.org/transcripts/127019083
  Quips under a gun and less blood than real scenes (C3, C4).
- Steven Bochco, NPR interview (1989). https://www.npr.org/transcripts/598811490
  The toll of violence and his dislike of neat closure (C7).
- Jed Mercurio, Den of Geek interview.
  https://www.denofgeek.com/tv/line-of-duty-creator-jed-mercurio-interview/
  Rejecting the drama of reassurance (C7) and the finely balanced test behind the dilemma rubric.
- Aaron Rahsaan Thomas, quoted in the Inlander.
  https://www.inlander.com/archive/how-writers-of-cop-tv-shows-like-s-w-a-t-are-wrestling-with-the/article_395a9111-f131-5eed-8e0a-6aa630c0073a.html
  Glorifying big guns (C8). Reported speech in a news piece.

These are cited for techniques only. No maker is a voice to imitate.

## Not opened, so never cite

The research pass could not open these. Bruckheimer's WorldScreen interviews, NPR's 24
retrospective, Television Academy video segments, and the Bustle 9-1-1 interview. The HOBAS
negotiation paper was read only through a university summary.
