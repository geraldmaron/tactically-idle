# Worked review, false_intruder at content v12

A full pass on one shipped call, written from reads on 2026-10-06. Every quoted line was read
on the story sheet or in source that day. Text and odds may have changed since. Re-read the call
before reusing any quote, and never copy a proposed fix into data without the owning skill's
pass. The author of this example also read the source first, so it is a declared self-read, and
the record says so.

## Scope

```
Review scope
- Calls: false_intruder ("The Spare Key")
- Situations and pacings: 1 and 2, ordinary only
- Seeds and buildings: building seed 7, cedar_close (authored) only
- Officer text: none
- Content version: v12 from INCIDENT_CONTENT_VERSION
- Issued fingerprint files present: issued-v9, issued-v10, issued-v11 (no v12 file)
- Reachable paths: situation 2 explorer, 102 states, 3 of 5 endings reached
- Records received: design none, prose none, officer none (shipped before these skills existed)
- Reader: self-read declared, source read before the sheet
```

Freeze line. The package entry is from v9 and is issued, so its own fields (opening, results,
approach results) change only through a new version-gated layer. The v12 depth layer
(src/content/framework-depth-v12.ts) has no fingerprint file, so whether its lines can still
change in v12 is the owner's call. Compiler strings in src/gen/incident/frameworks-v9.ts change
only through an engineering override field.

## Read surface

- Situation 1 at `/story.html?type=false_intruder` (opened on situation 1, ordinary pacing,
  call 0000, cast Riya Boateng).
- Situation 2 at `/story.html?view=lab&type=false_intruder&family=cedar_close&seed=7&tier=2&variant=1`
  (call 0002, cast Luca Te Rangi).
- The sheet rendered in a pane about 487px wide. The running game at 390px was not opened.
- Unseen, so stated as a gap. Card clamp, live summary clamp, locked summary clamp, chips,
  stage label clamp, decision log, debrief layout. Situation 3, deliberate pacing and generated
  buildings were not read.

## Cold read

```
Cold read false_intruder, situation 1, seed 7
- Who: Riya Boateng, a visitor with a key
- Wants: to be believed that the resident expects them (inferred, never stated as a want)
- Worse if they wait: blank
- Would act on: blank, both first moves read the same
- Gap that pulls: does the resident expect Riya today
```

Situation 2 gave the same blanks with Luca Te Rangi. The card runs to 228 characters, so the
live panel's three-line clamp most likely cuts the third sentence, the stacked hedge. The first known line repeats the card word for word.

## Path log, situation 2

```
Path log false_intruder, situation 2, seed 7, ordinary
Explorer: 102 states, 3 of 5 endings reached, 46 decision points (22 with one option, 4 within 5 points, 3 with every option at 90% or more)
| Path | Choices and bands, in order | Ending id | What the player saw change |
| P1 | Hear Luca’s explanation at the doorway (favorable) > Confirm the visit with the resident (favorable) > Ask Luca to get their things now (favorable) > Walk Luca out to wait for the resident (favorable) | resolved_disproved | Luca outside by agreement |
| P2 | Hear Luca’s explanation (favorable) > Confirm the visit (adverse) > Arrange a second check with Luca (adverse) > report failed response | handed_over | call left open, trust down |
| P3 | Hear Luca’s explanation (favorable) > Confirm the visit (favorable) > Wait with Luca until the resident gets home (favorable) | resolved_waited | resident home, report corrected |
```

Not reached in situation 2 with the reference squad. resolved_confirmed (the visit is not
confirmed in this situation) and acted_on_report (the gamble's report is wrong here). The
explorer was not run on situation 1.

Reason-to-pick lines.

- Hear the explanation. "Makes the agreed next step more likely to go smoothly." I could not say
  what that protects for whom. Fake-choice line 4 is close to true.
- Ask the neighbor. "More reliable but takes one extra minute." Same forecast, 92.9 favorable,
  0 points apart from the first. Line 1 is close to true for this pair.
- Ask Riya to get their things together. Protects time if Riya must leave, costs minutes if not.
  Real, and at 73.4 favorable it carries the stage's only risk. The assess stage passes on it.
- Confirm with the resident, against take Riya at their word. Certainty against a spared call,
  and the gamble's summary names the cost ("If Riya wasn’t expected today, the report has to be
  reopened."). The sheet flagged the pair as flat, but the risk lives in hidden truth and the
  summary names it, so the odds test passes.
- Close with the confirmation, against wait for the resident. Speed against a slow sure close.
  Real.

Cue trace.

```
| Choice | Mixed or adverse result, as written | Cue shown before | Field holding the cue | Traced |
| Take Luca at their word | 'The resident calls back: the key was for another day. The team reopens the report...' | 'If Luca wasn’t expected today, the report has to be reopened.' | actOnReport.summary | yes |
| Skip the early precaution | 'Luca has to wait outside and isn’t ready to go. Getting ready now takes longer, and it may not work on the first try.' (late precaution, run before the walk-out on P1) | 'If Luca does have to wait outside, it helps to be ready to go.' | precaution.summary | yes |
| Any resolution | 'The agreed step falls through for now. What you checked stays on record, but the step is not done.' | 'The step falls through and stays unfinished.' | compiled outcomePreview.adverse | yes, but generic |
```

Choice table. This example was written before the choice table existed, so it was not run. A
review today builds it from path-and-honesty-checks.md sections 2 to 8 (dominance, takeable
pairs, time-only bands, taps, cell coverage), and the record below marks the slot not done
rather than deleting it. Because this is a self-read, the block count is also unverified.

## Table read

Typed call, so narration only. Speakers are the narrator and, by report, the neighbor and the
resident. Breaks found.

```
| Speaker | Line as written | Break | Rule |
| narration | 'Taylor explains the invitation in a way you can check, and is treated as a visitor, not a suspect.' (approachResults[0], source) | policy voice, not a person | G1 |
| narration | 'The resident calls back: the key was for another day.' | colon joining clauses | G9 |
| narration | 'Nothing was taken and nobody is arrested.' (results[1]) | answers a question the player never asked | H1 |
```

Two lines read well aloud and should stay. "The neighbor admits they saw an unfamiliar face, not
a forced door." and "The resident lent Taylor the key for a visit last week, not today." Both are
sourced, concrete and short.

## Spoilers and honesty

Situations 1 and 2 read side by side. Card, dispatch reason, known and unknown lines, fact label,
approaches, check, precaution and act-on-report text were identical apart from the bound name
and the room ("Dispatch places Riya in the living room" against "Dispatch places Luca in the long
hall"). Leaks 0 across two situations. Situation 3 not compared.

Honesty. The act-on-report ending reuses the confirmed resolution's title and result, read both
on the sheet's endings table and in the compiler, where the ending's title is
`framework.resolutions[index]` and its summary `framework.results[index]`. A player who took Riya
at their word is told the resident confirmed the visit. H7 broken, invented outcome count 1.

## Ethics

Inline minimum walked (the rulebook did not exist yet). 1, 2, 6, 7, 8, 9 and 10 clear. 4 and 5 not
applicable. 3 needs a human. The premise turns on a neighbor reporting a stranger who does not
look like they belong. The text states no identity, which is right, but the cast draw decides
who plays the stranger. The step that was missed here is the count. With generation runnable, the
reviewer should have drawn the visitor slot over 300 seeds with the role-skew snippet in
batch-audit.md section 5 and sent a human the counts and lines, not a request to read a sample.

## Batch counts

Sample of 2 calls for this type, plus source counts across the v12 depth layer.

- The waitFor sentence "It takes much longer, but it does not depend on the next step going
  right." in 10 places across 10 types. TEMPLATE ECHO.
- Colons in game text, 1 (act-on-report wrong text).
- Card repeated as the first known line, 2 of 2 calls.
- Roster surnames in casts, 0 of 2 (reference squad Singh, Aung, Vann, Moretti). Pool overlap
  100 of 100, so the risk stands.
- Crisis frequency not applicable.

## Engine gates

```
npx vitest run src/gen/incident/content-gates.test.ts
Test Files 1 passed (1), Tests 46 passed (46), Duration 381.69s, exit 0
```

That ran on the working tree as it stood on 2026-10-06. `npm test` and `npm run verify` were not
run for this example, so a real verdict here could not be approve.

## Findings

```
[block] false_intruder, s1, cedar_close seed 7 | endings.acted_on_report.title and .summary (compiled) | sees 'Close the report with the resident’s confirmation' / 'The visit is confirmed and the intruder report is corrected. Riya stays as the resident’s guest.' after 'Take Riya at their word and close the report' | rule H7 | fix as request 'optional actOnReport ending title and summary, defaulting to today's output for issued versions' then data 'Report closed on Taylor’s word' / 'Taylor stays as the resident’s guest. Nobody has spoken to the resident, so the report rests on Taylor’s word.' | route engineering, then swat-call-prose
[fix before freeze] false_intruder, all situations | framework.opening (card summary) | sees 'Having a key doesn’t prove the visit is welcome, and a neighbor not recognizing someone doesn’t prove it isn’t.' | rule cold read, G2, G3 | fix as request 'version-gated opening override for issued packages' then data 'Taylor Brooks says they’re expected. The neighbor who called it in is still on the step, and the resident is away.' | route engineering, then swat-call-prose
[fix before freeze] false_intruder, all situations | compiled briefing.known[0] | sees the card repeated word for word | rule batch same string in two fields | fix as request 'stop copying opening into known' then data 'The neighbor saw Taylor open the front door with a key at about 4:15 and has never seen them before.' | route engineering, then swat-call-prose
[fix before freeze] false_intruder, all situations | compiled stages.adapt.prompt and stages.resolve.prompt | sees 'Check the disputed point in person.' / 'Act on what you checked and what the people involved agreed to.' | rule G1 | fix as request 'per-framework stage prompts in a version-gated layer' then data 'Taylor holds out a phone with the resident’s number on it. The neighbor wants Taylor out first.' / 'The neighbor is still on the step, and Taylor is asking whether they can stay.' | route engineering, then swat-call-prose
[fix before freeze] false_intruder, all situations | compiled assess summaries for hear_person and check_source | sees two process summaries at 92.9 favorable each | rule test odds, G1 | fix as request 'per-framework approach summaries' then data 'Hear Taylor out at the door. Quick, and the neighbor sees the team take Taylor’s side first.' / 'Ask the neighbor what they saw. A minute longer, and Taylor waits in the hall while you do.' | route engineering, then swat-call-prose
[fix before freeze] false_intruder, all situations | compiled resolution outcomePreview.adverse | sees 'The step falls through and stays unfinished.' | rule test odds | fix as request 'per-resolution adverse previews' then data 'The resident can’t be reached again. Taylor stays in the hall and the report stays open.' | route engineering, then swat-call-prose
[fix before freeze] ten typed frameworks, v12 | FRAMEWORK_DEPTH_V12.<type>.waitFor.summary | sees 'It takes much longer, but it does not depend on the next step going right.' in 10 places | rule batch repeats | fix as data, for false_intruder, 'Stay with Taylor until the resident gets home to speak for the visit. Slow, and the neighbor watches the whole time, but nobody leaves on a guess.' and one line per other type | route swat-call-prose, in v12 if the owner says it is open
[fix before freeze] false_intruder, s2 | FRAMEWORK_DEPTH_V12.false_intruder.actOnReport.wrong | sees 'The resident calls back: the key was for another day.' | rule G9 | fix as data 'The resident calls back. The key was for another day. The team reopens the report and works out with Taylor what happens now.' | route swat-call-prose, in v12 if open
[note] false_intruder, all situations | results[1] and waitFor.result | sees 'Nothing was taken and nobody is arrested.' / 'The report is corrected, and nothing was taken.' | rule H1 | fix as data 'Taylor waits outside by agreement, and the resident will sort out the key.' | route swat-call-prose, next version (issued entry)
[note] false_intruder, all situations | approachResults[0] | sees 'Taylor explains the invitation in a way you can check, and is treated as a visitor, not a suspect.' | rule G1 | fix as data 'Taylor shows the message inviting them over and gives the resident’s number.' | route swat-call-prose, next version
[note] false_intruder, premise | cast draw for the visitor slot | sees a stranger-at-the-door premise with identity left to the draw | rule inline 3 | fix as data none until the visitor slot is tallied over 300 seeds (batch-audit.md section 5), then the counts and lines go to a human | route owner
[note] false_intruder, s2 | explorer summary | sees 22 of 46 decision points with one option | rule fake-choice 5 (to check) | fix as data none yet, confirm whether these are forced follow-ups or thin stages | route swat-call-design
[note] all calls | src/gen/incident/gates/prose-lint.ts and the cast surname draw | sees no check on dashes, colons, stock phrases, cross-framework repeats or hand-authored text, and a surname pool that holds every roster surname | rule standing lint gap, batch roster surnames | fix as request 'extend prose-lint, exclude roster surnames from civilian casts' | route engineering
```

Two proposed fixes were caught by this review's own rules while drafting. An approach result
showing an invitation dated today would have leaked the answer before the check, so it
was cut. A resolve prompt about Taylor's coat on the chair would have been false on paths where
the precaution already ran, so it was replaced. Check every proposed line against every path it
can appear on.

## Verdict

```
Verdict false_intruder v12 | edit | block 1, unverified, self-read | fix before freeze 7 | note 5 | ships in next version (v12 depth-layer lines may ship in v12 if the owner says it is open)
```

## Record

```
Writing review record
- Scope: answered | false_intruder, situations 1 and 2, seed 7, cedar_close, ordinary, v12, explorer on s2 only
- Reader: answered | self-read declared, source read before the sheet, so the cold read was not cold, limits applied (verdict held at edit)
- Read surface: answered | story sheet lab view at about 487px | game at 390px not opened, unseen card clamp, live and locked summary clamps, chips, stage label clamp, decision log, debrief
- Cold read: answered | 2 cards, blanks worse if they wait, would act on, restated facts 1 (card copied into the first known line)
- Path and choice read: answered | paths 3 on s2 from the explorer
- Choice table: not done | written before the table existed, so fake choices 0 and untraced adverse 0 are unverified
- Table read: answered | lines voiced 10 narration strings from source, voice breaks 3
- Spoilers and honesty: answered | leaks 0 across s1 and s2, invented outcomes 1
- Ethics: answered | rules triggered inline 3, rulebook missing, inline used, activation not applicable (patrol call), tally not run | missed, should have run, routed to human 1
- Officer read: not applicable | no officer text in scope
- Batch audit: answered | sample 2 calls plus source counts, repeats 1 sentence in 10 places, collisions 0, skew not judged under 30 calls, crisis cap not applicable
- Engine gates: answered | npx vitest run src/gen/incident/content-gates.test.ts exit 0, 46 passed | npm test and npm run verify not run, example only
- Tells checked: not run | the example quotes shipped strings and was not exported for the checker
- Findings: 1 block, 7 fix before freeze, 5 note, routed to engineering, swat-call-prose, swat-call-design, owner
- Owner decisions surfaced: whether v12 is open, human read of the cast draw
- Verdicts: approve 0, edit 1, reject 0, recorded at not recorded (worked example, no pull request)
```
