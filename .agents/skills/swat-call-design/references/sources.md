# Sources

Every source behind swat-call-design, with the claim it supports. The external sources were
opened by the research pass for this skill set on 2026-10-06. This file restates what that pass
recorded and did not re-open them, so open a source yourself before quoting it or leaning on a
number. Secondary and summary-only sources are marked. Nothing that could not be opened is
cited anywhere in this skill.

## Repo sources (read while writing this skill, 2026-10-06)

| Source (search symbol) | Supports |
|---|---|
| `src/content/incident-frameworks-v9.ts` (`IncidentFramework`) | Writer-owned typed fields, the burglary and false_intruder text quoted in the worked sheets |
| `src/gen/incident/frameworks-v9.ts` (`withAdditionalFramework`) | Compiler-owned strings, field reuse, fixed pressure, what each stage offers |
| `src/content/framework-depth-v12.ts` (`frameworkAt`) | The v12 layer, add-only behavior, the repeated `waitFor` sentence |
| `src/gen/incident/index.ts` (`INCIDENT_CONTENT_VERSION`) | Version 12 on 2026-10-06 |
| `src/gen/incident/gates/prose-lint.ts` (`LENGTH_BUDGETS`, `UNSAFE_DETAIL`) | Budgets, word lists, the pacing name rule |
| `src/gen/incident/characteristics-v9.ts` (`applyRecipeCharacteristic`) | Deliberate-answers pacing |
| `src/sim/scenario-types.ts` (`ScenarioDefinition`, `EndingDefinition`) | Hand-authored fields, dispositions, the trust comment |
| `src/ui/screens/situation-panel.css` (`situation-summary`) | The three-line clamp at 14 px |
| `src/gen/incident/stories-v5/` (`signature.ts`, `armed.ts`) | The strong repo lines and injury labels |
| `docs/content-pipeline.md` | Agent brief template, decision structures, gates, freeze rule |
| `docs/setting-modules.md`, `docs/story-archetypes.md`, `docs/character-driven-stories.md` | Lanes and existing content requirements |
| Compiled calls from `generateIncident` (burglary and false_intruder, v12, three situations) | Worked sheet B |

## Screen craft

| Tag | Source | Supports |
|---|---|---|
| TV1 | Dick Wolf, NPR interview, 2003. https://www.npr.org/transcripts/127019083 | Borrow the headline and invent the body, cut transitions, less blood than real scenes, no quips at gunpoint |
| TV2 | Steven Bochco, NPR interview, 1989. https://www.npr.org/transcripts/598811490 | Violence's toll on officers, distrust of neat closure, the ensemble |
| TV3 | Jed Mercurio, Den of Geek interview. https://www.denofgeek.com/tv/line-of-duty-creator-jed-mercurio-interview/ | The finely balanced test, self-justifying wrongdoers, no drama of reassurance |
| TV4 | Television Academy, the women of Criminal Minds, part I. https://www.televisionacademy.com/news/online-originals/women-criminal-minds-part-i | Everyday fear, motive as the interesting part |
| TV5 | Television Academy, part II. https://www.televisionacademy.com/news/online-originals/women-criminal-minds-part-ii | Fear, then who, then why; rationing the hardest stories |
| TV6 | The Ringer on The Shield pilot. https://www.theringer.com/tv/2022/3/11/22971849/the-shield-pilot-20th-anniversary | Interesting over likable |
| TV7 | Joel Surnow, Salon, 2002. https://www.salon.com/2002/02/05/surnow/ | Real time needs a reason; answer the questions you raise |
| TV8 | Gustav Möller, Danish Film Institute. https://dfi.dk/en/node/43814 | Sound and the listener's imagination |
| TV9 | Denis Villeneuve, Den of Geek. https://www.denofgeek.com/?p=389978 | Stretched time builds tension |
| TV10 | No Film School on the Sicario border scene (secondary). https://nofilmschool.com/sicario-border-crossing-scene | Stillness, then sudden release |
| TV11 | David Simon, The Believer. https://www.thebeliever.net/?p=41916 | Write for insiders; institutions outweigh individuals |
| TV12 | Inlander on S.W.A.T. writers. https://www.inlander.com/archive/how-writers-of-cop-tv-shows-like-s-w-a-t-are-wrestling-with-the/article_395a9111-f131-5eed-8e0a-6aa630c0073a.html | Pose questions, de-escalation against drama, no gun worship |
| TV13 | Royal Television Society on Happy Valley. https://rts.org.uk/article/happy-valley-cop-edge | The heroic in the ordinary |
| TV14 | Tim Minear, TheWrap. https://www.thewrap.com/9-1-1-season-2-premiere-earthquake-awful-people-jennifer-love-hewitt/ | Tone mix, saving people nobody likes |
| TV15 | Jerry Bruckheimer, BFI. https://www.bfi.org.uk/interviews/jerry-bruckheimer-top-gun-beverly-hills-cop-f1-the-movie | Drop the audience into a world and show how it works |
| TV16 | Color of Change, Normalizing Injustice (advocacy). https://hollywood.colorofchange.org/crime-tv-report | Wrongful acts unexamined, clean force, skewed casting. Same study as AU13 |
| TV17 | Bend Bulletin on Southland (secondary). https://bendbulletin.com/2013/02/28/southland-a-cop-show-that-cops-watch | Chases leave real costs |
| TV18 | SlashFilm on Michael Mann's research (secondary). https://www.slashfilm.com/812856/michael-mann-went-to-some-exhaustive-lengths-while-doing-research-for-heat/ | Ride-along research |
| TV19 | Hachette publisher copy, The Real Prime Suspect. https://www.hachette.co.uk/titles/jackie-malton/the-real-prime-suspect/9781804190142 | A detective behind a drama |
| TV20 | PERF ICAT, module 5. https://www.policeforum.org/assets/ICAT/module%205_operational%20safety%20tactics_dec16.pdf | Time on the responders' side, the tactical pause, distance and cover |

## Interactive structure and games

| Tag | Source | Supports |
|---|---|---|
| IF1 | Sam Kabo Ashwell, Standard Patterns in Choice-Based Games, 2015. https://heterogenoustasks.wordpress.com/2015/01/26/standard-patterns-in-choice-based-games/ | Branch and bottleneck, gauntlets, remembering choices |
| IF2 | Emily Short, Small-Scale Structures in CYOA, 2016. https://emshort.blog/2016/11/05/small-scale-structures-in-cyoa/ | Escalating commitment |
| IF3 | Emily Short, Storylets, 2019. https://emshort.blog/2019/11/29/storylets-you-want-them/ | Modular events need a progress measure |
| IF4 | Choice of Games, 5 Rules, 2010. https://www.choiceofgames.com/2010/03/5-rules-for-writing-interesting-choices-in-multiple-choice-games/ | Most checklist lines |
| IF5 | Choice of Games, Intentional Choices, 2016. https://choiceofgames.com/2016/12/how-to-write-intentional-choices | Results that contradict intent frustrate |
| IF6 | Compton, Designing Interesting Decisions. https://www.gamedeveloper.com/design/designing-interesting-decisions-in-games-and-when-not-to- | What makes a decision interesting |
| IF7 | Mawhorter and colleagues, choice poetics slides, 2014 (only the blind-choice slide was read). https://www.cs.hmc.edu/~pmawhorter/research/slides/choice_poetics-Mawhorter_Mateas_Wardrip-Fruin_Jhala-2014.pdf | Blind choices breed regret |
| IF8 | Wardrip-Fruin and colleagues, Agency Reconsidered, DiGRA 2009. https://www.cs.uky.edu/~sgware/reading/papers/wardripfruin2009agency.pdf | Agency needs a perceivable consequence |
| IF9 | Failbetter, Echo Bazaar narrative structures, part one. https://www.failbettergames.com/news/echo-bazaar-narrative-structures-part-one | Failure that opens story |
| IF10 | Game Developer, Road to the IGF, Papers, Please. https://www.gamedeveloper.com/design/road-to-the-igf-lucas-pope-s-i-papers-please-i- | The other side of a familiar scene; systemic dilemmas |
| IF11 | Formosa and colleagues on Papers, Please, 2016. https://researchers.mq.edu.au/en/publications/papers-please-and-the-systemic-approach-to-engaging-ethical-exper/ | Ethics through systems |
| IF12 | Kotaku on writing Reigns. https://kotaku.com/the-most-important-part-of-writing-a-video-game-is-the-1822627600 | Cards of one or two sentences |
| IF13 | Aaron Reed, IF50, Lifeline. https://if50.substack.com/p/2015-lifeline | Two options per beat |
| IF14 | Game Developer, 80 Days postmortem. https://gamedeveloper.com/business/postmortem-inkle-s-i-80-days-i- | Self-contained episodes |
| IF15 | TheSixthAxis, This Is the Police review, 2016. https://thesixthaxis.com/2016/08/02/this-is-the-police-review | Repeated beats wear down a campaign |
| IF16 | RPG Codex, FTL interview. https://rpgcodex.net/article.php?id=8133 | Events always move something concrete |
| IF17 | RimWorld Wiki, About RimWorld (secondary). https://rimworldwiki.com/wiki/About_RimWorld | A storyteller that paces events |
| IF18 | Game Informer on Sid Meier's GDC 2010 keynote. https://gameinformer.com/b/news/archive/2010/03/12/sid-meier-gamers-arent-logical.aspx | Players judge odds by feel |

## Psychology and reading

| Tag | Source | Supports |
|---|---|---|
| PS1 | Loewenstein, The Psychology of Curiosity, 1994 (pages 88 and 89 read). https://www.cmu.edu/dietrich/sds/docs/loewenstein/PsychofCuriosity.pdf | The curiosity gap, one fact that closes it |
| PS2 | Ghibellini and Meier, Zeigarnik and Ovsiankina meta-analysis, 2025. https://ideas.repec.org/a/pal/palcom/v12y2025i1d10.1057_s41599-025-05000-w.html | People resume unfinished tasks but do not remember them better |
| PS3 | Kahneman and Tversky, Prospect Theory, 1979. https://www.econometricsociety.org/publications/econometrica/1979/03/01/prospect-theory-analysis-decision-under-risk | Loss framing, the certainty effect |
| PS4 | Kahneman and colleagues, When More Pain Is Preferred to Less, 1993. https://mrbartonmaths.com/resourcesnew/8.%20Research/Cognitive%20Psychology/When%20more%20pain%20is%20preferred%20to%20less.pdf | Peak and end |
| PS5 | Ryan, Rigby and Przybylski, Motivational Pull of Video Games, 2006. https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf | Feedback as information, competence and autonomy |
| PS6 | Scheibehenne and colleagues, choice overload meta-analysis, 2010, as reported (press report only). https://www.sciencedaily.com/releases/2010/01/100119121425.htm | More options did not reliably hurt choice |
| PS7 | Nielsen Norman Group, How Long Do Users Stay. https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/ | Decisions in about ten seconds |
| PS8 | Nielsen Norman Group, Reading Content on Mobile. https://www.nngroup.com/articles/mobile-content/ | Brevity on phones |
| PS9 | Moral Foundations Theory. https://moralfoundations.org/ | Goods drawn from different values |
| PS10 | David Bordwell on Hitchcock's bomb, 2013. https://www.davidbordwell.net/blog/2013/11/29/hitchcock-lessing-and-the-bomb-under-the-table/ | Suspense against surprise |

## Authenticity and ethics

| Tag | Source | Supports |
|---|---|---|
| AU1 | LAPD Inspector General, Review of LAPD SWAT Operations, 2026. https://www.oig.lacity.org/_files/ugd/b2dd23_740812f610304fe0ba3b9e32b4b35173.pdf | Call flow, force rates, activation conditions, observed cases. A large full-time team |
| AU2 | Klinger and Rojek, NIJ report 223855, 2008. https://www.ojp.gov/pdffiles1/nij/grants/223855.pdf | National counts from 1986 to 1998 data with gaps, part-time teams |
| AU3 | Noesner, FBI Law Enforcement Bulletin, 2024. https://leb.fbi.gov/articles/featured-articles/fifty-years-of-fbi-crisis-hostage-negotiation | Most crisis calls involve no hostage, the stairway model |
| AU4 | Davis and Vecchi, FBI Law Enforcement Bulletin, 2025. https://leb.fbi.gov/articles/featured-articles/indicators-of-progress-and-high-risk-indicators | Progress and high-risk indicators |
| AU5 | UNLV summary of Pace and colleagues on HOBAS data (summary only; paper not opened). https://unlv.edu/news/accomplishments/steve-pace-stephen-benning-logan-kennedy-jade-laughlin | Contact type and negotiated endings |
| AU6 | Nelson, Criminal Justice Institute practitioner paper, 2009. https://www.cji.edu/wp-content/uploads/2019/04/a-team-approach-to-crisis-negotiation.pdf | Negotiation roles, no promise without command |
| AU7 | CISA SAFECOM, Plain Language Guide. https://www.cisa.gov/sites/default/files/publications/PlainLanguageGuide.pdf | Plain radio language over codes |
| AU8 | Samaritans, depicting suicide and self-harm in drama. https://www.samaritans.org/documents/1039/Guidance_on_depictions_of_suicide_and_self-harm_in_drama_and_film_Digital.pdf | Crisis rules E4.1 to E4.6 and E4.9 |
| AU9 | Everymind Mindframe, stage and screen, 2020. https://cdn.mindframe.org.au/assets/src/uploads/MF-Guidelines-Stage-Screen-DP-LR.pdf | Crisis rules |
| AU10 | Everymind Mindframe, mental illness, violence and crime, 2020. https://cdn.mindframe.org.au/assets/src/uploads/MF_Guidelines_Violence_and_Crime_spread_FINAL.pdf | E4.8 and stigmatizing words |
| AU11 | Level Up, reporting domestic abuse deaths, 2nd ed., 2024. https://welevelup.org/media-guidelines | E5 |
| AU12 | CDC and SAMHSA, trauma-informed principles, 2018. https://stacks.cdc.gov/view/cdc/56843 | E13 |
| AU13 | Color of Change, Normalizing Injustice full report, 2020 (advocacy). https://hollywood.colorofchange.org/wp-content/uploads/2020/02/Normalizing-Injustice_Complete-Report-2.pdf | Same study as TV16 |
| AU14 | ACLU, War Comes Home, 2014 (advocacy). https://assets.aclu.org/live/uploads/publications/jus14-warcomeshome-text-rel1.pdf | E6 deployment figures |
| AU15 | 988 Suicide and Crisis Lifeline. https://988lifeline.org/ | E4.7, US only |

## Not opened, so not cited

The research pass could not open these, and nothing in this skill relies on them. Do not cite
them from memory.

- Jerry Bruckheimer's WorldScreen interviews (the server refused the request).
- NPR's retrospective on 24 (timed out).
- Television Academy video interview segments (video only).
- Bustle's interview on 9-1-1.
