# Surface budgets

The single budget table for the Tactically Idle writing skills. swat-call-prose
owns it. swat-call-design, swat-writing-review and swat-officer-stories point
here instead of keeping their own copies. If you change a number, change it
here and nowhere else.

Values were read from the repo on 2026-10-06. The lint ceilings come from
LENGTH_BUDGETS in src/gen/incident/gates/prose-lint.ts, the clamps from the UI
stylesheets, and the field wiring from src/gen/incident/frameworks-v9.ts. If a
file moved, search for LENGTH_BUDGETS, line-clamp or "Response unfinished".
When the code and this file disagree, the code wins, and this file gets a
dated correction.

## How to read the columns

- **Lint ceiling** is a hard character limit the typed-package lint enforces.
  "none" means the lint sets no length for that field, but every linted
  sentence still stops at 34 words. Hand-authored stories are not linted, and
  the house holds them to the same ceilings by hand.
- **House target** is tighter on purpose, for a player who gives each screen
  seconds. It is a design choice tuned in playtest, not a measurement. A string
  over its house target is allowed only with a reason in the prose record.
- **Clamp** says what the screen does to long text. A clamp cuts silently, so
  anything past it is lost to the player.

## Call surfaces, in player order

| # | Surface | Source field | Lint ceiling | House target | Shape | Clamp or display |
|---|---|---|---|---|---|---|
| 1 | Card title | title | 34 | 1 to 3 words | a place, object or person, never a genre | 22px, wraps to 2 lines |
| 2 | Card chips | variantLabel, difficulty drivers | none | 1 to 3 words | shown only when it differs from the title | one line |
| 3 | Card hook | summary (typed lane uses opening) | none | about 130 chars, first sentence 14 words | person and want in the first five words, one gap, what gets worse | live panel clamps to 3 lines at 14px |
| 4 | Pressure label | pressureLabel | none | 2 to 4 words | whose safety, then what runs out ("Mara’s time inside"). An institution's schedule fails unless the hook ties it to a person's safety | compiler-owned in the typed lane |
| 5 | Dispatch reason | dispatchReason (typed dispatch) | 240 | 2 sentences | who called and what they want the team for | full, under "Why your team was sent" |
| 6 | Known line | known[] | 260 | 3 lines of about 12 words | source, claim, how they know | full |
| 7 | Unknown line | unknown[] (typed question) | 260 | 2 lines of about 12 words | one question a single fact closes | full |
| 8 | Team job | teamResponsibilities[] | 260 | 10 words | verb first, names the person | compiler-owned in the typed lane |
| 9 | Fact label | label (typed factLabel) | 40 | 3 to 5 words | the claim as a noun phrase | one line in the fact panel |
| 10 | Fact claim | claim | none | 20 words | what is claimed, stated plainly | debrief prints Told or Not reported before it |
| 11 | Fact note and uncertainty | note, uncertainty | none | 12 words | who says it and how they know | fact panel |
| 12 | Fact results | resolved.confirmed and disproved (typed confirmed, disproved) | none | 20 words | who found what, where | after the check only |
| 13 | Map marker | markers.unknown, reported, confirmed, disproved | none, house 10 chars counted | 1 word | the claim or the checked fact in neutral words (ARMED?, NO JOB), never a person's name and never a motive (GRUDGE fails) | compiler-owned in the typed lane |
| 14 | Map task | action task | hard house limit 12 chars including spaces, counted, not estimated | 1 to 3 words | where the team goes | uppercase on the map, sized by character count in src/ui/blueprint/layout.ts |
| 15 | Stage label | stage.label | none | 1 to 2 words, about 24 chars | the position or the problem | uppercase 12px, clamped to 2 lines |
| 16 | Stage prompt | prompt | 120 | 2 sentences, 18 words | the new fact, then the pressure | about 3 lines at 16px |
| 17 | Context prompt | contextPrompts[].prompt | none, hold to 120 | 2 sentences, 18 words | names the earlier choice through one detail | replaces the prompt while its condition holds |
| 18 | Choice title | action title | 60 | 2 to 5 words, 30 chars | verb, object, optional qualifier | about 34 chars a line at 17px, 2 lines |
| 19 | Choice summary | action summary | 230, and 80 when the action has a requirement | 20 words | the act, then its cost as a concrete event | locked choices clamp to 2 lines (about 80 chars at 390px), so with a requirement the cost lands in the first 80 characters or the whole summary fits in 80. Hidden when equal to the favorable preview |
| 20 | Requirement reason | requires reason, hazardReason | none | 8 words | what is missing, verb first | shown on a locked choice |
| 21 | Outcome preview | outcomePreview per band | none | 20 words each | how well the team does it, true in every situation, adverse names who pays | 1 to 2 sentences |
| 22 | Result line | outcome effect text (ScenarioDefinition) | 240 | 30 words | who did what, then what changed, in the call's one result tense | the decision log prints the choice title before it |
| 23 | Result label | resultLabels per band | none | 2 to 4 words | the band in plain words | beside the result |
| 24 | Officer harm | officerHarm.label | none | 10 words | plain, non-graphic, names the call | becomes the injury label on the roster |
| 25 | Ending title | ending title | 60 | 2 to 6 words | the outcome, with a person in it | debrief header |
| 26 | Ending summary | ending summary | 240 | 35 words | who is safe, who is not, one lasting detail | debrief body |
| 27 | Still needed | remainingTasks[] | none | 8 words | verb first, a person named | listed under "Still needed" |
| 28 | Civilian outcome | civilianOutcomes[].label | none | 6 words | the person and their state | debrief |
| 29 | Service text | externalServices[] label and description | none | 15 words | who arrives, when, what they take over | briefing and debrief |
| 30 | Debrief headline | ending title plus the record lines | none | 10 words | the record first | debrief |
| 31 | Spoken line inside any field | the host field | the host field's ceiling | radio 10 words, speech 15 | one beat | inherits the host field's display |
| 31a | Modifier label | modifiers[].label | none | 6 words | the reason the odds moved, in the world ("Lucia trusts the medic") | shown with the odds |
| 31b | Cert bonus label | certBonus.label | none | 6 words | what the certified officer does differently | shown with the odds |
| 31c | Support label and task | support.label, support.task | none, task 12 chars like row 14 | 6 words, task 1 to 3 | the supporting squad's role ("covering the back door") | briefing and map |
| 31d | Equipment label | equipment[].label | none | 6 words | what the item lets someone do, never hardware worship | shown on the choice |
| 31e | Objective label | objectives[].label | none | 8 words | verb first, a person named | briefing and debrief |

Two house targets were cut to fit the lint. The research pass proposed 25
words for a stage prompt and 60 for an ending, but 120 and 240 characters hold
about 20 and 40 words, so the targets are 18 and 35.

Sentence targets for every surface above. Average 8 to 14 words, none over 22
(house), none over 34 (lint). One and two word sentences are fine.

## Typed lane, one string on several surfaces

The compiler reuses some writer fields on more than one surface. Write each so
it works everywhere it appears. Read in src/gen/incident/frameworks-v9.ts on
2026-10-06.

| Field you write | Where the player reads it | Write it as |
|---|---|---|
| opening | card hook (summary) and the first known line | a hook that is also a sourced fact, naming the person |
| question | first unknown line, the assess stage prompt, Still needed on the unfinished ending | a question that also reads as a task |
| approaches[i] | assess choice titles, with a compiler summary under them | verb first, and name the person in approach 0 or verify |
| verify | adapt choice title | verb first, names the person |
| resolutions[i] | resolve choice title and the ending title | a verb phrase that still works as a title afterward |
| results[i] (typed package field only) | resolve choice forecast, its favorable and mixed outcome text, the ending summary | present tense, so it reads as forecast and as record. Other results in the same typed call match it |
| waitFor.title and result | choice title and the waited ending's title and summary | same rule as resolutions and results |
| actOnReport.wrong | read only after the gamble fails | the backing out, said plainly, then what is still to do |

Compiler-owned strings in the typed lane, which a writer changes only through a
version-gated layer. The adapt prompt and the verify summary ("Check the
disputed point in person."), the resolve prompt, both team responsibilities,
the approach summaries, the placement line ("Dispatch places <name> in
<room> at <building>."), the markers REPORTED, CHECKED and CORRECTED, the
pressure label, the mixed and adverse previews on resolutions, and the
unfinished ending ("Response unfinished").

## Result tense

Result lines hold one tense across a call and never switch inside a string.
The typed lane is present, because results[i] doubles as a forecast. The
repo's hand-authored stories also run present (stories-v5, read 2026-10-07).
A hand-authored call may choose past, and the record names the choice.
Prompts, summaries and previews are present. Ending summaries may close in
past. No repo contract fixing a past tense for outcome text was found on
2026-10-07, so if one appears, it wins and this section gets a dated note.

## Binder additions

These change a string after you write it. Leave room for them.

| Addition | What happens | Headroom to leave |
|---|---|---|
| Name binding | the authored full and first name become the drawn name | measure each budgeted string after binding, with the longest full name in the cast pool for each slot and the longest location swap. Report the authored length and the worst bound length. The checker's --bind flag does the swap |
| deliberate_answers pacing | appends "Allow extra time for <name> to answer." to conversation summaries, and adds a known line | about 40 chars under the summary ceiling |
| {lead} | becomes the lead officer's surname, or "Squad" with none | write so both read |
| American spelling bridge | rewrites listed British forms | none, but write American anyway |

## Officer surfaces

swat-officer-stories owns what these say. The budgets live here so all four
skills share one table. Fields marked proposed do not exist yet, and text for
them is design only until engineering builds them.

| # | Surface | Source field | House target | Shape |
|---|---|---|---|---|
| 32 | Recruit card line | personalNote today, pressureLine proposed | 18 words | a habit a call can test |
| 33 | Officer sheet bio | story layers, proposed | 40 words, three short lines | one public fact, one habit, one trait link |
| 34 | Radio sample | voiceSample, proposed | 10 words | how they call a room clear |
| 35 | Trait condition | TRAIT_INFO condition | 1 sentence, 10 words | when it applies, then what changes |
| 36 | Contributor line | built by code as surname, colon, label | 6 words after the name | the stat row prints the colon, the writer never types it |
| 37 | Injury label | injury label | 10 words | plain, names where it happened |
| 38 | Shift report entry | personnel event detail | 15 words | who, and what changed |
| 39 | Debrief callback | ledger detail, proposed | 80 chars | resolves to a recorded fact, one per operation |

## Exemplars

One illustrative line per row group. Never copy these into data. They exist to
show the shape at the right length.

1. Card title. "The Latched Storeroom"
2. Card hook. "Lena Sorensen wants her bakery open by 5. The storeroom is latched from inside, and she has the spare key out."
3. Dispatch reason. "Lena Sorensen called from her bakery. She wants someone beside her before she opens the storeroom."
4. Known line. "Lena found the latch down at 4:10. It only locks from inside."
5. Unknown line. "Who is in the storeroom, and will they come out?"
6. Fact label. "Someone inside the storeroom"
7. Marker. "VOICE?" while reported, "VOICE" once checked.
8. Stage prompt. "The latch lifts an inch, then drops. Lena is reaching past you for the handle."
9. Context prompt after waiting. "You held Lena at the counter. Now the voice inside is asking for her."
10. Choice title. "Talk through the door first"
11. Choice summary. "{lead} talks through the door. Lena’s ovens stay cold the whole time."
12. Adverse preview. "The voice stops answering, and Lena tries her key while you stand in the doorway."
13. Result line. "A boy’s voice says he will come out if the lady goes upstairs."
13a. Pressure label. "Lena’s hand on the key"
14. Ending summary. "Lena opened at 5:20. The boy left with patrol and a bag of yesterday’s rolls."
15. Still needed. "Call the boy’s mother back tomorrow"
16. Shift report entry. "Abara marks five years on the team this week."

## Open disagreement on title width

Two passes estimated the card title differently at a 390px viewport. One
worked from the CSS font size and got about 28 characters a line. The other
measured the running game and got about 40. Until someone measures the board
card in a browser and records it here with the date, the lint ceiling of 34
governs and the house target stays at 1 to 3 words, which fits either way.

## Change log

- 2026-10-06. First version, values read from the repo that day.
- 2026-10-07. Proof round 2. Pressure-label shape, bound-length measuring, the result tense section, and row 22 named for the ScenarioDefinition field.
- 2026-10-06. Proof round 1. Counted limits for markers and map tasks, the locked-summary 80-character rule, neutral markers, truthful previews, and rows 31a to 31e for modifier, cert, support, equipment and objective labels (fields read in src/sim/scenario-types.ts).
