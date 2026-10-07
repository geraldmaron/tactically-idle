# Sources

Where the rules in this skill come from, and how far each source can be trusted.

Two kinds of reading sit behind this file. The repo files in section 1 were opened directly while
the skill was written, on 2026-10-06. The outside sources in sections 2 to 5 were opened by the
research pass on the same date and summarized in its briefs. This skill's author worked from those
briefs and did not reopen every outside page. A claim that matters to a ship decision should be
checked against the source itself before it is repeated as fact.

Makers and works are named only as the source of a technique. Nothing here asks a writer to
imitate a named person, and nothing is quoted beyond a short phrase.

## 1. Repo files read for this skill

Each path is paired with a symbol to search for if the file moved. The code wins over this skill.

| Path | Search for | What it supports |
|---|---|---|
| src/sim/types.ts | `interface Officer`, `interface DebriefResult` | officer fields, the 10-debrief cap, casualty and outcome records |
| src/content/personas.json | `personalNote` | 100 personas, 44 she, 43 he, 13 they, 27 notes opening with "enjoys", 10 names with diacritics |
| src/content/personas.ts | `Never use culture, appearance or pronouns` | the persona contract |
| src/content/officers.ts | `startingOfficers` | seats draw identities per campaign, service capped by age minus 21 |
| src/content/recruits.ts | `PROFILES`, `roleForPersona` | per-role trait lists, one trait at most at recruitment, rookie service under 1.2 years |
| src/ui/components/labels.ts | `TRAIT_INFO` | the six condition sentences |
| src/sim/resolution.ts | `calm voice on the line`, `strainFor` | contributor lines, trait effects, steady having no line |
| src/sim/officer.ts | `STRESS_BANDS` | Ready, Strained 30, Overloaded 60, Mandatory recovery 80 |
| src/sim/career.ts | `CAREER_TUNING` | retirement at 60, service from 25 years, burnout rules, personnel detail strings |
| src/sim/calendar.ts | `experienceBand`, `gameDayMs` | one game day per real hour, experience bands |
| src/sim/save.ts | `CURRENT_SAVE_VERSION` | save version 9 and the hardcoded trait list |
| src/sim/personnel.test.ts | `uses pronouns in ordinary notes` | the pronoun-opener test and build independence from identity |
| src/ui/screens/HQ.tsx | `PERSONNEL_EVENT` | the shift report prints the full name before each detail |
| src/content/scenario-names.ts | `SCENARIO_SURNAMES` | the civilian surname pool equals the roster's 100 surnames |
| src/gen/incident/high-risk-common-v4.ts | `injuryHR` | the injury labels in hand-authored stories |
| docs/art/roster-integration.md | `Identity contract` | who owns persona identity fields, no death mechanic |

## 2. Character and attachment in games

| Source | Supports | Limits |
|---|---|---|
| Tynan Sylvester, "The Simulation Dream", Game Developer | a story system is worth only what reaches the player's head | design essay |
| Robert McKee, Character (publisher page) | character shown through choice under pressure, a light contradiction | publisher copy, book not read |
| XCOM 2 War of the Chosen bonds and traits, GameBanshee | negative traits tied to their cause and curable | secondary coverage |
| UFOpaedia on XCOM soldiers, and Game Informer on XCOM war stories | earned nicknames, players naming their soldiers | wiki, secondary |
| Darkest Dungeon wiki, Quirks and Virtue pages | quirk caps, lock-in over time, virtue at the stress limit | wiki, secondary |
| RimWorld wiki, Backstories and About pages | backstories setting skills, and why this game must not | wiki, secondary |
| Crusader Kings III wiki, Stress | the player choosing how a character copes | wiki, secondary |
| Battle Brothers dev blog 110 | backgrounds with their own events | developer blog |
| Wildermyth official site, Nate Austin at GDC 2022, a GameBanshee interview and James O'Connor in SUPERJUMP | breach of trust and out-of-character writing as attachment risks, "endless possibilities are boring" | session read from listing and coverage |
| Fire Emblem Wiki, Support | pair bonds from fighting side by side | wiki, secondary |
| Arknights wiki, operator file | character files opening in tiers as trust rises | wiki, secondary |
| GamesBeat on the Nemesis system | characters referring back to past encounters | press coverage |

## 3. Player psychology

| Source | Supports | Limits |
|---|---|---|
| Ryan, Rigby and Przybylski, motivational pull of video games, 2006 | autonomy behind letting the player name and choose | academic paper |
| GamingBolt interview with Jake Solomon, and Kotaku on "Remembering the Fallen" | players inventing stories for soldiers, memorials that mark loss | interview and press |
| 80.lv and Game Developer on Darkest Dungeon | flawed heroes with stress at the center | interviews |
| Turn Based Lovers, Wildermyth interview | events cast to characters so they stay true to themselves | interview |
| Kahneman and colleagues, 1993 | peak and end, so exit lines get the most care | academic paper |

## 4. Screen and prose craft

| Source | Supports | Limits |
|---|---|---|
| The Ringer on The Shield pilot | interesting over likable | press retrospective |
| Royal Television Society on Happy Valley | the heroic in the ordinary | press |
| NPR, Steven Bochco, 1989 | violence leaves a bill on officers | interview transcript |
| Inlander on S.W.A.T. writers | disagreement inside the team, no hardware worship | press |
| NPR, "Joe Wambaugh, The Writer Who Redefined LAPD", 2008 | how the job acts on the cop, the voice changing with it | radio piece |
| Richard Price, The Believer | team humor has to be exact | interview |
| Elmore Leonard, ten rules (via a reproduction) | "said", no phonetic dialect | reproduction of the 2001 article |

## 5. Ethics and representation

| Source | Supports | Limits |
|---|---|---|
| LAPD Inspector General, review of SWAT operations, 2026 | most incidents resolved without force, so restraint is the big scene | one large full-time team, atypical in scale |
| Color Of Change, Normalizing Injustice, 2020 | misconduct framed as the cost of doing business, oversight as obstacle | advocacy research |
| Geena Davis Institute, representation in games | complex personalities over one defining trait | advocacy research |
| Haggis-Burridge and colleagues, Building Better Minority Characters, 2020 | avoiding tokens and comic relief | academic paper |
| CDC and SAMHSA, trauma-informed principles, 2018 | safety, transparency and choice in how strain is written | public health guidance |
| Samaritans and Mindframe guidance | weight of a death shown on people, never the act | written for drama and media, applied here by analogy |

## 6. Sources not used

The research pass could not open the Bruckheimer WorldScreen interviews, the NPR 24 retrospective,
the Television Academy video segments or the Bustle 9-1-1 piece. Nothing in this skill rests on
them, and they must not be cited.
