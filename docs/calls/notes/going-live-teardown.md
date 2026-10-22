# Going Live: hostile teardown

2026-10-22. A separate reader's teardown of `src/content/call-trees/hostage-live.ts` (with the stream
in `src/content/incidents/hostage.ts`), asked to start from "broken until shown otherwise". Nothing
in the call was edited. The method that answers it is in [../depth-mesh-method.md](../depth-mesh-method.md).

## Verdict

**Reject, back to `swat-call-design`.** The owner is right on both counts, and more prose passes will
not fix either, because the causes are structural:

1. **One escalation, 34 times.** `escalate()` gives 26 adverse results the same `threat` outcome, the
   handgun coming up on the manager, plus 8 `anyway` lines that do the same. 28 of the call's 44
   adverse previews mention the handgun. The depth rubric's own blocking example is the call this one
   replaced, at 15 (`review-rubric.md` section 9, D3). That is the repetition the owner hears across
   stages.
2. **The player who reads the odds never reaches the story.** The best-odds route is
   `going_live.on_stream` (85%) then `on_air.camera_wall` (85 to 89%) then `way_out.walk_dark`, three
   taps to `out_quiet`. Across 300 drawn calls it learned who took the bag 0 times, never heard the
   manager answer, never met the clerk outside and never faced the lie. That is the lifecycle that
   "doesn't flow".
3. **The two hidden facts are one fact.** Situation 1 is `rider_clear: true, raised: false`, situation
   2 the reverse (`situations[0..1].truth`). Every stage 1 adverse reveals `raised`, so the first bad
   roll settles the turn's question for free, and the call teaches one rule: the rider who aims is the
   rider who lied.

It fails D3 outright and D2 in situation 2 (below), which meets the reject line in the rubric (two of
D1, D2, D3, D5). sol, reading separately, reached the same verdict; after both reads there are 16 blocks (section "sol's independent teardown").

## How it was read

| Read | What ran | Covers |
|---|---|---|
| Source | The whole tree, the stream clock, the design and lapse sheets, the AI-tells and content-rules notes | every string and route |
| Engine walk | Breadth-first over every move the engine allows (`availableMoves`: choices by band, plus lapses), per situation, deduplicated by `pathStateKey` | s1 51,221 states, 16 nodes, 8 endings; s2 39,248 states, 18 nodes, 10 endings |
| Transcripts | 1,500 walks per situation picking uniformly over choice and band, 10% lapse when one is due, recording the prompt, transcript and result lines the engine commits | repetition per played path. Adverse is overweighted here, so shares are marked "uniform" |
| Real dice | `playToEnd` on 300 drawn calls (tier 2, day-one squads) under the balance styles `random`, `best_odds`, `patient`, `fast` | what a player actually meets |
| Lab | `npm run lab` on port 5184, `/lab?type=hostage_crisis&variant=1`, Play at 390x844 for stages 1 and 2, the X-ray odds, and Outcomes (2,000 random-style runs) | rendered read, odds, reachability |
| Gates | `npm run check:strings -- hostage_crisis` | exit 0, 846 strings |

The scratch walker, analysis and gate scripts are outside the repo (session scratchpad); every number
below came from one of them or from the lab, and the command is named where it matters.

## The lifecycle, designed against played

```
DESIGNED                                   PLAYED (best_odds, 300 calls, real dice)
approach  going_live   plant the glance    going_live.on_stream        85%  terms set, glance never seen
   |                                          |
turn      on_air       who took the bag    on_air.camera_wall          89%  nothing revealed, cost never charged
          off_air      reprices stage 1       |
          clerk_talks                         |
   |                                          v
commit    way_out      filmed or unfilmed  way_out.walk_dark           77%  out_quiet
   v                                       turn reached 0 of 300; lie, clerk, manager's answer never met
ending
```

| Measure | random | best_odds | patient | fast |
|---|---|---|---|---|
| Learned who took the bag (`f_rider_clear` confirmed or disproved) | 23% | 0% | 55% | 37% |
| Skipped stage 2 entirely | 2% | 1% | 2% | 2% |
| Asked the exit question twice (`way_out` then `last_word`) | 10% | 0% | 0% | 0% |

Under uniform band picks, which overweight the adverse band, stage 2 is skipped on 10% (s1) and 32%
(s2) of paths, and in s2 the first stage 3 node is `threat` on 53% of paths. With real dice the skip
is rare, so the lifecycle problem a player actually meets is the dominant route above, plus three
smaller ones:

- **Stage 3 is three stages.** `way_out` hands to `last_word`, which hands to `ceiling` or a held
  ending. 2% of uniform paths take four or more resolve decisions, and `last_word` re-asks the
  question `way_out` just asked (finding 5).
- **The late nodes are coins with two tails.** On the state the shortest path arrives in, both
  `fired_on` options sit at 3% favorable (`go_in` 3/16/81, `hold_talk` 3/9/88 in s1 and 3/0/97 in
  s2), and `home_again.pick_up` at 3/0/97. The climax is decided by pressure before the player
  chooses.
- **The turn is optional by design and avoided by odds.** Only three choices reveal `rider_clear`
  (`on_air.manager_speaks`, `clerk_talks.clerk_asked`, `phone_rings.clerk_answers`), each harder than
  its sibling. The briefing's one unknown, "Who took the bag", is a side quest.

## Findings

Severity follows `swat-writing-review` section 11. Odds are squad A, seed 7, at the first state the
engine reaches each node, so they move with pressure and stall; they are evidence, not balance
targets.

| # | Field path | What's wrong | Why a player feels it | Severity | Gate |
|---|---|---|---|---|---|
| 1 | `escalate()` (26 calls) `.threat`, plus 8 `.anyway` | Every talk and move option's adverse band is the handgun on the manager, reworded: "brings the handgun up level with {manager.first}’s chest" (`on_air.manager_speaks`), "levels the handgun on {manager.first} and keeps it there" (`way_out.own_lie`), "points the handgun at {manager.first} from a foot away" (`cornered.friend_stays`). 28 of 44 adverse previews name the handgun; 13 hedge with may, could or can | Every risk reads as the same risk, so no option's danger is its own. Uniform s2 paths average 1.2 handgun-on-manager sentences, up to 5 | block | D3; dilemma-patterns "Rejected dilemmas" last row; fake-choice 2 |
| 2 | `on_air.camera_wall` | 85 to 89% favorable, harm low, every band routes to `way_out`. Its cost, "{rider.first} gives up the witnesses {rider.he} came here for, on your word", is charged on no path | The obvious pick at the turn, and it removes the turn. best_odds takes it 293 of 297 times | block | fake-choice 3; phantom cost (dominance rule 2) |
| 3 | `situations[0].truth`, `situations[1].truth`, `escalate()` `reveal: ['raised']` | `raised` is always the opposite of `rider_clear`, and every stage 1 adverse reveals `raised` | The first bad roll answers the call's only unknown before the turn. The innocent rider never aims; the guilty one always does | block | design section 9 (correlated axes, cheaper reveal); D2; fake-choice 3 |
| 4 | `last_word.out_back` against `last_word.out_front` | `out_back` is easier (36 to 51% against 21 to 36%), faster (6 against 12 min), scores higher (32 against 30, 62 against 60), and `out_front`'s mixed band adds 15 minutes. `out_front` wins only on `friend_promise`, which only the s2 `cornered` path sets | A stage 3 menu with a trap on it | block | fake-choice 3; dominance grid |
| 5 | `way_out` and `last_word` menus | The same three options twice on one path: filmed exit, unfilmed exit, wait all night. `walk_dark.summary` "It is the exit {rider.first} has refused all night." then `out_back.summary` "It is the unfilmed exit {rider.first} refused all night."; `wait_night` and `let_him_sit` are both 45 minutes, `span: 'All night'` | The commit beat resets instead of escalating; the player answers a question they already answered | block | fake-choice 7 inverted (a later stage repeats the choice); D5; prose rule "no 4-word run" |
| 6 | `clerk_talks.say_clerk_backs` | The lie is better than the truth in s1: 65/31/4 in 2 min against `clerk_asked` 53/31/16 in 5. Its discovery (`foundOut`) fires only `if: TOOK` (`way_out.walk_live.mixed[1]`); in s1 it is charged only by its own 4% adverse or by the player choosing `own_lie`. No ending or epilogue reads `lied_clerk` | The temptation pays and is forgotten. The design promised it "usually works in the moment and costs later" | block | D6 (dominates); fake-choice 7 |
| 7 | `fired_on.go_in`, `fired_on.hold_talk`, `home_again.pick_up` | Both options at or near 3% favorable on arrival (above) | No choice exists at the call's most dangerous moment | block, needs validation across states | fake-choice 1 |
| 8 | `way_out.walk_dark.mixed` (all three `when` rows) | Same ending as favorable (`out_quiet`), plus `minutes: 40`, objective 60 against 75. The checker flags "a long while" | The mixed band is the good band, later. And `walk_dark` beats `walk_live` on mixed (ends the call) and adverse (held, no handgun) at near-equal odds | block (raised after sol's read) | fake-choice 10; delay-only |
| 9 | `going_live.on_stream` against `going_live.watch_feed` | 85/11/4, harm low against 61/31/8, harm moderate. `watch_feed` wins one minute and the `glance` mark, worth +6 on one later choice | The opening's observation option is a trap, so the planted turn (the glance) is skipped | fix before ship | fake-choice 3; Odds test |
| 10 | `situations[1].note`, design "Reframe" s2 | The s2 reframe is "the followers' faith is why the rider can't stop". That is a motive, not an earlier scene whose meaning changes. s2 only flips who took the bag and whether the handgun comes up | Replaying s2 after s1 reads as the same rider with worse dice | block | D2; D9 |
| 11 | 43 `clerkToo(...)` lines, 30 of them out the back, the stockroom or the alley | The clerk inside leaves for free in most resolutions: "{clerk.first} slips out the back while the phone is face down" (`way_out.walk_dark.favorable[1]`), "finds the back door by touch" (`threat.go_dark`), "crawls out the back while officers fill the front" (`fired_on.go_in`). Inside, the clerk's only state is "pressed against the stockroom door" | Stage 1's `clerk_out` cost ("The comments may spot the stockroom door") prices an exit the call later gives away. A nineteen-year-old held at gunpoint stops being a person and becomes a closing line | fix before ship | fake-choice 3 and 5; H9; D1 |
| 12 | The manager after `on_air` | One choice is hers (`manager_speaks`). Elsewhere she is a position: "on the floor", "on the tile" or "to the floor" 24 times in the tree, 1.3 to 1.6 times per path, up to 5. Her s1 private logic (covering the clerk) surfaces only in `manager_speaks` and `phone_rings.clerk_answers` favorable | The planted turn in `going_live.prompt` ("never at the handgun") is never paid off on the dominant route | fix before ship | D1; design section 3 ("the person named first still matters in stage 3") |
| 13 | Nine `threat.timeout` texts and `holdTheNight` | Every run-out is the same beat, nobody answers: "The register phone stays silent", "doesn’t ring", "gets no answer, and neither does", "never answers", "stops answering", "The line stays quiet", "unanswered". The stage 3 ones then end on "Command holds the street" and the held endings open on it (`home_again.threat.timeout` then `held_counter.summary`) | Indecision always looks the same, so the player learns that not choosing is one flat outcome. The Codex pass removed the "Nobody" openers; the beat stayed | fix before ship | prose rule "no 4-word run"; restatement |
| 14 | Menus at every stage | The same three verbs on every stage: talk on the stream (`on_stream`, `call_back`, `say_true`, `camera_wall`), take the audience (`cut_feed`, `take_down`, `go_dark`, `van_back`, `off_camera`), move close and risk being seen (`watch_feed`, `team_glass`, `move_up_dark`, `to_the_door`, `out_now`, `back_step`) | The owner's "repetitive across stages": the room changes, the decision does not | fix before ship | D5; fake-choice 2 across stages |
| 15 | 11:40, the red light, the timestamp | Told by the rider in `going_live.on_stream.favorable`, `address_out.call_back.favorable`, `on_air.manager_speaks.mixed`, `van_light.reporter_call.favorable`, `off_air.own_it.favorable` ("the whole story again from 11:40") and its `calm_voice` line. Up to 5 tellings on a uniform path | A detail that should be the rider's anchor becomes a refrain with no change | fix before ship | prose rule 7 (image spent twice without a change of state) |
| 16 | `STREAM.cues[0]` (`hostage.ts`) | "A viewer types, “Is that handgun real?”" is order-blind: it lands in `on_air.manager_speaks` results after the manager's public answer (lab, s2) and in `threat.go_dark` right after command ended the stream (engine transcript, s2), along with "Another courier shares the stream" | The stream comments on itself after it is dead; the first-minute question arrives ten minutes in | fix before ship | H11; continuity |
| 17 | `way_out.prompt`, `way_out.threat.text`, beat `camera_door`, `on_air` beat `count_two` | The van is two blocks out, already "trained on the front door" in the prompt, then "parks at the corner" as the threat, then "Lights up" as a beat. On `going_live` adverse paths `threat.threat` has it "go live from the corner" without ever arriving | One arrival told four ways, out of order | fix before ship | restatement; H10 |
| 18 | `on_air.manager_speaks.preview.favorable` | "{manager.first} answers straight, and what {manager.he} says decides where this goes." In s2 the favorable band exposes the rider, turns the chat (+15) and routes to `cornered`, the self-harm moment | A "Goes well" label on the result a player would call the worst turn, behind a preview that defers | block (raised after sol's read) | fake-choice 9; preview rule "never defer" |
| 19 | Count lines: `on_air.prompt` and `promptIf[1]` ("passed a thousand"), beats `count_two` ("over two thousand"), `three_k`, `cornered.threat` ("passes five thousand") | Prose restates the number the strip ticks. In the lab the ticker read 807 at `on_air` entry (s2, seed 7) with the 2.8-minute beat about to say "over two thousand" | The screen and the radio disagree on the one number both show. sol measured about 650 on the strip when `on_air.promptIf[1]` says a thousand | fix before ship | prose rule 4 (leave out what the screen shows) |
| 20 | `going_live.prompt`, `endings.manager_killed.title` | With a they-drawn manager, "They keep looking at the stockroom door" follows three named people and reads as plural; the death title binds to "They didn’t come out" | The planted turn and the death title both blur in one pronoun draw in three | note | binding hazard |
| 21 | Result tense | `check:strings` reports 21 to 24 past-tense results of 203 and four tense-mix rows (`going_live.on_stream.favorable[0]`, `threat.go_dark.favorable[0]`, `way_out.own_lie.mixed[0]`, `on_air.manager_speaks.favorable[1]`) | Small, and reported but not blocking | note | prose rule "one result tense" |

### Why the gates passed it

`npm run check:strings -- hostage_crisis` exits 0 with `ngram 0` and `path-echo 0`, while 58 to 60% of
uniform engine paths repeat a 4-word run across two different strings. The checker does look across
the whole call, but for runs of six words or more (`ngram`); its 4-word `path-echo` and its image
`path-repeat` work inside one node, so a 4- or 5-word echo between stages, or the same beat in new
words, is invisible to it, and its cross-node signal is 857 advisory `path-repeat` rows of single
words that nobody can act on. No gate counts beats in data (how many adverse outcomes route to
`threat` on a path), dominance under the balance styles, or whether the best-odds player reaches the
turn. The design sheet also declared "None dominated" and the checklist clean
(`going-live-design.md`, "Dominance grids"), so the structural rules existed and were self-certified
rather than enforced: blind gates and rubber-stamped records are both part of the cause (sol, method
review finding 19). The method doc proposes those measures, as hypotheses to be tested.

## What I could not verify

- The rendered read of every path at 390px. I read stages 1 and 2 of s2 on Play; stage 3, the
  run-out moments and the debrief I read from engine output and source, not the screen.
- Finding 7's odds across arrival states. They were read at the BFS's first arrival, which comes in
  hot; a calmer arrival may show a real choice.
- Finding 19 at the moment the `count_two` beat fires (sol verified the `promptIf[1]` case, not the beat).
- D4 blind voice, D7 the line (owner's pick), the viewer chat pools, officer voice markers and the E3
  tally were not run.
- Whether `entry_hurt` reached from `fired_on.hold_talk.adverse[0]` (no entry made) is scored as an
  entry under review.

## sol's independent teardown

sol (Codex on its configured default model, `codex-companion.mjs task --fresh --effort high`,
read-only, 2026-10-22) was given the same files and the same brief, without my findings, so its read
is a second reader rather than a check on mine. It walked the engine in memory (all 150 choice, band
and timeout route keys in s2, 133 in s1, 40,000-state cap), replayed paths in a second building
family, and did not see the rendered screen. **Its verdict: reject**, 34 findings. Where it found the
same fault, the two reads agree on cause; it also found faults I missed, which says the first read
was not enough on its own.

| sol # | Finding (field path) | Severity sol gave | My verdict | What changed |
|---|---|---|---|---|
| 1 | `way_out.wait_night.favorable[0]` then `way_out.threat.text`: the rider walks out, then the van threat lands with "{rider.first} watches the light from behind the counter" | block | accepted | Added as S1. I saw the same class (`threat.go_dark`, the van going live after the manager was sent out) and had not traced it to the threat landing after a closing action |
| 2 | Coupled truths | block | accepted | Same as finding 3 |
| 3 | `off_air.promptIf[0].exchange[1]` "I did. I want to hear you without them." before the choice `off_air.own_it` "Tell {rider.him} it was you" | block | accepted | Added as S2; verified in source |
| 4 | Stage 1 adverse skips stage 2 | block | accepted with controls | Same as the lifecycle section: real for the call's structure, rare with real dice (1 to 2%), so kept as part of finding 1 and the lifecycle map, not a separate block |
| 5 | Failed filmed exit returns to the same exit menu | block | accepted | Same as finding 5; sol adds the negotiator's `last_word.exchange[1]` swapping in "leave the phone" for the deal just tried |
| 6 | `threat.talk_down.adverse[0]` wounds the negotiator; `out_on_camera` closes resolved with officer care outstanding and no remaining task | block | accepted with controls | Added as S3; reproduced by sol, not by me, so the engine's debrief lines for officer casualties need a look before the fix is written |
| 7 | `on_air.manager_speaks.favorable[1]` labeled favorable | block | accepted | Same as finding 18; raised to block |
| 8 | `way_out.walk_dark` "only your word" and "nothing to perform for" while `way_out.prompt` has a TV camera on the door | block | accepted | Added as S4; the call's main stage 3 moral trade rests on a condition the player can see is false |
| 9 | Mixed bands that are favorable plus time (`walk_dark`, `let_him_sit`) | block | accepted | Same as finding 8; raised to block, since fake-choice line 10 is a reject line |
| 10 | The lie survives in s2 on lie favorable then `walk_live` favorable | fix before ship | accepted | Extends finding 6: the lie is free in s1 and avoidable in s2 |
| 11 | `manager_killed_rider_hurt.title` "Two carried out" when the manager is not carried out | block | accepted | Added as S5 |
| 12, 13 | `camera_wall`, `team_glass` and a failed `clerk_asked` all reach `way_out`, whose prompt has the rider "talking about coming out" with nothing causing it | fix before ship | accepted | Added as S6 |
| 14 | `way_out.own_lie.favorable[0]` asks a question; `last_word.promptIf[0]` says both are silent | fix before ship | accepted | Added as S7 |
| 15 | `manager_speaks` reveals the truth but doesn't set `knows_truth`, so `threat.talk_down`'s modifier ignores it | fix before ship | accepted | Added as S8; verified in source |
| 16, 17 | `phone_wall` survives the phone leaving the wall; `still_armed` turns "in hand" into "on the counter" | fix before ship | accepted with controls | Added as S9; state that names a position needs a writer that clears it |
| 18 | `threat.go_dark.favorable[0]` ends the stream without `cut` or `stream_off`; the next node showed about 12,772 watching | fix before ship | accepted with controls | Added to finding 16 as a second order-blind stream case; the number is sol's, not reproduced by me |
| 19 | The van's four entrances | fix before ship | accepted | Same as finding 17 |
| 20 | `on_air.promptIf[1]` "passes a thousand" with the engine count near 650 | fix before ship | accepted | Confirms finding 19; its "needs validation" is now verified for this prompt |
| 21 | `cornered.off_camera` adverse preview "keeps scrolling" against an s2 result that aims the handgun | block | accepted | Added as S10 |
| 22 | `on_air.camera_wall.preview.adverse` promises the handgun turning; the s1 result props the phone higher | block | accepted | Added to S10; I missed it, and it is the kind of false preview the review skill blocks |
| 23 | `off_air.own_it` adverse preview "hangs up on you" against the s1 line "The line stays open" | block | accepted with controls | Added to S10. The lead line has the rider tell the negotiator to stop calling, so the contradiction is in the line's state, not the gist |
| 24 | `last_word.out_front.preview.mixed` "goes silent at the camera" never happens with the manager inside | block | accepted | Added to S10 |
| 25 | `threat.promptIf` order hides the shot when the clerk is inside | fix before ship | accepted | Added as S11 |
| 26 | The bargain told three times in a row (`on_stream.favorable`, its exchange, `on_air.promptIf[0]`) | fix before ship | accepted | Added as S12 |
| 27 | The stockroom glance spent three times on the `watch_feed` route without a change | fix before ship | accepted | Added as S12; the pilot repeated this fault (method doc, section 10) |
| 28, 29 | Three mixed setbacks on one path are "he cares more about the camera"; three costs price restraint with the same manager-gun-distance picture | fix before ship | accepted | Same family as findings 1 and 14 |
| 30 | `home_again`: "home" is nobody the player has met | fix before ship | accepted | Added as S13 |
| 31 | "Around 3:00", "Around 3:30" in a call with no start time | fix before ship | accepted | Added as S13 |
| 32 | `rider_held` and `held_counter` drop the clerk's state | fix before ship | accepted | Added to finding 11 |
| 33 | The family tie (uncle or aunt) in the design never reaches the player; the reveal is only "got the job" | fix before ship | accepted | Added to finding 12 |
| 34 | `roles[0].profile` and `coldOpen` repeat the Tuesday account closure | fix before ship | accepted | Added as S13 |

Nothing sol raised was rejected. Where I downgraded (4, 6, 16 to 18, 23) the reason is evidence I could
not reproduce or a narrower reading, stated in the row.

### Added findings from sol

| # | Field path | What's wrong | Severity | Gate |
|---|---|---|---|---|
| S1 | `way_out.threat` landing after a closing action (`wait_night.favorable`), in `threat.go_dark`, and `on_air.threat.text` after `on_air.cut_feed.adverse[0]` (lead's play at 390x844 on `ad0d329`: "watches the stream end on the screen", then "The comments turn. Viewers ask why…") | The threat's line lands after the result that ended the scene it describes; viewers comment on a stream that just ended | block | H10, H11 |
| S2 | `off_air.promptIf[0].exchange[1]`, `off_air.own_it` | The negotiator admits the cut before the player chooses to | block | fake-choice 5 |
| S3 | `threat.talk_down.adverse[0]` into resolved endings | A wounded officer has no state in any ending | block, accepted with controls | H8, H9 |
| S4 | `way_out.walk_dark.cost`, `.pull`, `way_out.prompt` | The unfilmed exit is filmed by TV | block | fake-choice 3, H11 |
| S5 | `endings.manager_killed_rider_hurt.title` | "Two carried out" is false | block | H7 |
| S6 | `way_out.prompt` after `camera_wall`, `team_glass`, failed `clerk_asked` | Progress at the stage boundary that no result caused | fix before ship | D2 |
| S7 | `way_out.own_lie.favorable[0]`, `last_word.promptIf[0]` | A question asked, then erased | fix before ship | fake-choice 7 |
| S8 | `on_air.manager_speaks.favorable[*]` | No `knows_truth`, so the truth doesn't help later | fix before ship | fake-choice 7 |
| S9 | `phone_wall`, `still_armed` marks | Position marks never cleared | fix before ship | H11 |
| S10 | previews: `cornered.off_camera.adverse`, `on_air.camera_wall.adverse`, `off_air.own_it.adverse`, `last_word.out_front.mixed` | Previews false or softer on a truth or entry state | block | H11; preview rule |
| S11 | `threat.promptIf` order | The shot's landing hidden behind the clerk variant | fix before ship | design section 5 (first match wins) |
| S12 | `going_live.on_stream.favorable` to `on_air.promptIf[0]`; the glance on the `watch_feed` route | Told three times in a row | fix before ship | restatement |
| S14 | `address_out.threat.beats[0]` (`past_tape`, 3.2 min) against `address_out.threat.text`; `van_light.threat.beats[0]` (`reporter`, 3.6 min) against `van_light.threat.text` | Each beat tells the threat's landing before it lands: "One on foot past the corner line. Patrol has them." then "A viewer slips past the tape…"; "Reporter at the tape, calling subject by name." then "The {outlet_short} reporter walks up to the patrol line… and calls {rider.first}’s name". The countdown spends its payoff early and the landing repeats it (raised by the chat session's sol review, relayed by the lead) | fix before ship | restatement; call-pressure.md "Constant alarm" |
| S13 | `home_again.pick_up`; "Around 3:00"; `roles[0].profile` and `coldOpen` | A decisive person never met; absolute clock times; the profile repeats the cold open | fix before ship | D1, H10, D10 |

**Count after both reads:** 16 blocks (findings 1 to 7, 10, plus 8 and 18 raised, and S1 to S5, S10),
the rest fix before ship or note. The verdict stands: reject, back to `swat-call-design`.
