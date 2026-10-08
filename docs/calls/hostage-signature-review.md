# Writing review: One Last Signature (hostage_crisis, M2 slice 5 pilot)

Reviewed through swat-writing-review 0.3.0 on 2026-10-07 and 2026-10-08 by a separate reader who
did not write the call. The review edits nothing. Every fix below is data for the owning skill or
a request for engineering.

**Re-check verdict (2026-10-08, section 16): edit.** Of the 44 findings, 33 are closed and 11
stay open, all of them for the owner, engineering or the skill files, so none blocks.
The re-check found 9 new findings, two of them fix before freeze (NF1 and NF2), both one-line data
fixes; NF9 is a stale v13 byte guard for the lead. Sections 1 to 15 below are the first pass, kept as written.

**First-pass verdict: edit.** 9 block, 14 fix before freeze, 21 note.

The structure holds. The gates pass at every group size, force never outscores talking, and
several lines carry real weight ("I only needed one signature.", the unsigned slip, "Ruth asks
someone to lock up for her."). It cannot ship as it stands, for five reasons:

1. Three previews are false in a situation.
2. Two summaries print a raw `{lead}` token in the game.
3. The board card can cut the handgun off the hook.
4. An owner who collapses can be reported under a green "Went well" chip.
5. The owner's heart in s2 tells a returning player the hidden truth for free.

Every block has a data fix or a filed request, so the verdict is edit, not reject.

## 1. Scope

```
Review scope
- Calls: hostage_crisis "One Last Signature" (src/content/call-trees/hostage-signature.ts, template src/content/incidents/hostage.ts)
- Situations and pacings: s1, s2, s3; ordinary and deliberate_answers
- Seeds and buildings: lab market_row seed 7 (s1, s2, s2 slow pacing); game board bar_restaurant_g2 (The Rusty Anchor); engine walks over market_row, corner_store_flat_g2, bar_restaurant_g2
- Group sizes: 0, 1 and 2 others (1 to 3 subjects), bound with he, she and they
- Officer text: none
- Content version: v13 from INCIDENT_CONTENT_VERSION (src/gen/incident/index.ts:55)
- Issued fingerprint files present: issued-v6-v8, issued-v9, issued-v10, issued-v11; no issued-v13 (the v13 lane is untracked)
- Reachable paths: 38-start crossed engine walk, 133,335 states, 95,604 endings, 0 gaps (section 4)
- Records received: design and prose records in docs/calls/hostage-signature-design.md; officer none
- Reader: separate (did not draft); the cold read was not fully cold, because I read the source before the rendered card
```

Freeze line. v13 has no issued suite, and the owner direction on file is "no freezes in
development". Whether v13 is open is still the owner's call (O3), so the verdict says the fixes
ship in v13 if the owner confirms it.

## 2. Read surface

- Lab, s1: `http://localhost:57444/story.html?type=hostage_crisis&variant=0` (market_row seed 7,
  lone; Iolanthe, Zofia Crowther, Esteban).
- Lab, s2 step-through at 390px:
  `http://localhost:57444/story.html?view=lab&type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1&tab=run`
  (lone; Marek, Aiyana Szabo, Gabriela). Played two paths (L1 and L2 in section 4).
- Lab, s2 slow pacing with one other: the same URL plus `&pacing=deliberate_answers` (Zoltan,
  Farid, Darya, Reuben).
- Game at 390px: the Ops board in the user's own campaign, read only. The hook was measured in the
  DOM (`.optile .opboard-summary`).
- Exported text: every string bound at 0, 1 and 2 others with four pronoun sets (mixed, all she,
  all he, all they) through `callStringRows` and `bindRoleTokens`, plus three player-order path
  blocks. Scratch files only; nothing committed, every scratch test deleted.
- Engine-scripted paths through `startGateRun`, `applyMove` and `scoreCall`, ten paths across s1
  to s3 (section 4).

Unseen, so stated as a gap. I did not play a call in the running game. The only campaign loaded
was the user's own save, and playing would have changed it; the QA preset that equips a disposable
department only activates inside a framed preview. So the live panel clamp, the in-game decision
log, the in-game debrief layout and the map markers during play were not seen in the game. I read
the decision card's chip text from `src/ui/screens/OperationFeedback.tsx` instead. I did not open
s3 in the lab; it was read through the exports and the scripted paths.

## 3. Cold read

```
Cold read hostage_crisis, s1, market_row seed 7 (lab)
- Who: Zofia Crowther, role not on the card (the briefing makes her the courier)
- Wants: to leave; she should have left ten minutes ago
- Worse if they wait: weak; the hold goes on, but nothing on the card gets worse with time
- At risk: everyone inside, from a fired employee with a handgun
- Would act on: walk Zofia out on the offer
- Gap that pulls: whether Iolanthe lets Esteban go

Cold read hostage_crisis, game board, The Rusty Anchor (390px)
- Visible: "Anders Amankwah should have left The Rusty Anchor ten minutes ago. A fired employee with a handgun won’t let…"
- Who: Anders Amankwah | Wants: to leave | Worse if they wait: blank | At risk: implied by "a handgun"
- Worst-case binding (Katarzyna Castellanos, The Fox and Pheasant): "…A fired employee with a…" The handgun is cut.
```

The board card clamps the hook to 2 lines at 13.5px (`src/ui/screens/ops-visual.css:28`), about
103 to 106 characters at 390px. The prose skill's budget assumes the live panel's 3 lines. At
typical names the player loses "anyone leave."; at long names the player loses the handgun, and
the visible stakes are an errand (B5).

Restatement, s1. Later surfaces carry 10 facts: the dispatch adds who fired whom and the threat
and restates the handgun and the refusal; the known lines add four; the first stage prompt adds
the 911 call from the counter phone and the offer.

```
Restatement hostage_crisis, s1 | facts 10 | new 8 | changed 0 | restated 2 (dispatch) | first stage prompt restates no
```

## 4. Path and choice read

No path explorer exists on the lab page today, so the machine walk stands in for it. The repo's
coverage gate draws 13 hostage starts and does not cross group size: it walks two others once (s2)
and never walks s3 with any group (N6). I copied the gate into a scratch test whose starts cross
situation, turn, pacing and group size, ran it, and deleted it.

```
Path log hostage_crisis, all situations, both pacings, 1 to 3 subjects
Explorer (crossed coverage walk): 38 starts, 133,335 states, 236,335 commits, 22,400 drawn results walked, 95,604 endings, 0 gaps
| Path | Choices and bands, in order | Ending id | What the player saw change |
| L1 s2 lone (lab) | Walk Aiyana out now (favorable) > Get the front unlocked (adverse) > Send the team in (favorable) | entry_clean, 10.3 min | courier out; shelf across the door; handgun on Gabriela; command line; owner out |
| L2 s2 lone (lab) | Walk Aiyana out now (favorable) > Get the front unlocked (favorable) > Let Marek set the pace (favorable) | at last_one, 36.8 min | bolt open; owner sits on the tiles (clock cue); owner sent home after dark |
| E1 s1 (engine) | take_courier fav > ask_unlock fav > his_door fav > out_front fav | everyone_out, 16.8 min | trust 11, factor 1.0 |
| E2 s1 (engine) | take_courier fav > ask_unlock fav > his_pace fav > let_him_sit fav | out_by_dawn, 82.8 min | trust 10; "The team was on scene for 83 minutes." |
| E3 s2 (engine) | take_courier fav > ask_unlock adv > step_back fav > out_front fav | everyone_out, 22.3 min | trust 11 |
| E4 s2 (engine) | take_courier fav > ask_unlock adv > talk_down fav > out_front fav | everyone_out, 17.3 min | trust 11 |
| E5 s2 (engine) | take_courier fav > spare_key fav > his_pace fav | owner_collapsed, 53.8 min | owner out badly hurt under a favorable band |
| E6 s3 (engine) | take_courier fav > ask_unlock adv > go_in adv | owner_killed_taker_hurt, 11.1 min | owner died; taker badly hurt by the firearm; an officer hurt |
| E7 s3 (engine) | take_courier fav > ask_unlock adv > step_back adv | owner_beaten, 20.1 min | owner struck until she signed |
| E8 s2 (engine) | hear_him fav > owner_voice fav > his_pace adv > medic_door adv | held_both, 69 min | owner collapsed and seriously hurt; courier still inside |
```

Reason-to-pick lines. I could write one for every offered option, so fake-choice line 4 is false
everywhere. Three that took thought:

- Get the landlord's spare key. A player picks it because it opens the door without the taker's
  consent, the only exit that works in s3, accepting twenty minutes with the owner inside.
- Ask for the owner now (lone). A player picks it to save a minute, accepting that it reads as an
  order. Where the unlocked door is on the same menu, the door beats it by 12 points of odds for
  one minute (N10).
- Let the taker decide (last_one). A player picks it because it is near certain (96 favorable),
  accepting the street closed all night and the debrief's time line.

Claims in the records, checked against the table that would break them:

| Claim, quoted | Row that would falsify it | Holds |
| --- | --- | --- |
| "Preview vs result ... false 0" | every truth-branched band's preview against each situation (45 bands) | no, 3 false (B2 to B4) |
| "placeholders 0" | the rendered summaries | no, `{lead}` prints (B1) |
| "mixed bands differ from favorable by who is talking, where a person is or a mark" | his_pace, wait_rest, give_night mixed | no (B7) |
| "4-word runs 0 ... path echoes 0" | a distinct-name, he and she export | no, 4 runs, 2 on one path (F2) |
| check-strings findings are "every one a T1 self-duplicate or the T2 place name, 0 real" | the committed checker's n-gram list | no, it names runs shared by two fields (F2) |
| "taps common 1/1/1, longest 1/1/2" | stage 3 decision counts | no, 2 common and 5 longest (F13) |
| "E11 ... surrender is 'with the team now'; no ending implies release" | custody words in endings and prompts | no, 4 lines (F5) |
| "4 known + 1 unknown" briefing | row E's count, which includes dispatch, responsibilities and appended lines | no, up to 9 (F12) |
| "hook 130 chars bound ... over-target 0" | the board's clamp at 390px | no, 2 lines (B5) |
| T1 and T2 "described rather than applied" | the working tree | stale, both applied (N5) |
| R-E1 "prints 'is out, hurt.' even when" inside | `src/sim/outcome-score.ts` | stale, `hurtInside` exists (N5) |
| "0 gaps ... every situation x group size x turn x pacing" | a crossed walk | yes, 0 gaps |
| "E2 clear: entries score worst" | scoreCall on entry and talk paths | yes, 7 against 10 and 11 |
| taker never shown dying, force `noFatal` | the compiled force variants | yes |
| "phantom costs 0" | a path where each named cost lands | yes |
| "name openers 52%" | distinct names per path | yes, and 60 to 70% per path, over target (F1) |

Claims checked 16: falsified 9, stale 2, held 5.

Fake-choice checklist, from the canonical ten lines in
`swat-call-design/references/dilemma-patterns.md` (this skill's own copy stops at line 8, N20):

| Line | Result | Where |
| --- | --- | --- |
| 1 near-certain or identical forecasts | clear; stage 1 options sit 4 to 4.6 points apart, and each summary names its cost | offer |
| 2 swap | clear | every node |
| 3 dominance or trap | **true** for a returning player in s2: the clock cue identifies the situation (B9) | out_* nodes, then talking |
| 4 can't say why | clear | every node |
| 5 nothing visible changes | **true** for three mixed bands (B7) | his_pace, wait_rest, give_night |
| 6 waiting costs nothing | clear; holds cost the owner's minutes, the s2 clock and a debrief time line | holds |
| 7 later stage forgets | clear; prompts read hung_up, terms, sign_demand, silent, counting, wants_back, others_out | stage 2 and 3 prompts |
| 8 tone | clear | every node |
| 9 band label contradicts text | **true**; a collapse can print under "Went well" (B6) | his_pace, into_night, spare_key |
| 10 mixed is favorable plus time | **true** (B7) | as line 5 |

Tests. Swap clean. Tone clean. Wait: waiting is priced and never scores below force (section 7).
Memory clean. Roster: the entry needs `entry_team`, the shield adds 6, and three marks add to the
entry check. Odds: stage 1 is flat within 5 points, and every summary names its cost, so it
passes.

Dominance, as rendered (s2, lone, tier 2):

| Node | Option | Favorable | Adverse | Minutes | Beaten on every column by |
| --- | --- | --- | --- | --- | --- |
| offer | Walk Aiyana out now | 59.1 | 9.9 | 3.3 to 5.7 | none; the only option that frees anyone now |
| offer | Ask for Gabriela too | 63.3 | 5.7 | 4 to 6 | none |
| offer | Let Marek talk first | 67.9 | 4 | 5 to 7.5 | none |
| out_keys | Get the landlord's spare key | 63.1 | 5.9 | 20 to 54 | none; the only consent-free exit |
| out_keys | Get the front unlocked | 71 | 4 | 3 to 4.5 | none |
| talking | Take down his account | 77.4 | 4 | 6 to 9 | none; the kept commitment pays in the debrief |
| talking | Ask for Gabriela now | 68.1 | 4 | 2 to 3 | the unlocked door, except by one minute (N10) |
| talking | Use the door he unlocked | 80.5 | 4 | 3 to 4.5 | none |
| talking | Let Marek set the pace | 93.4 | 4 | 30 to 96 | none |
| threat | Talk him down | 39.6 | 29.4 | 3 to 4.5 | none |
| threat | Send the team in | 19.9 | 49.1 | 2 to 3 | none; worst odds and worst adverse, fastest |
| threat | Clear out of sight | 52.6 | 16.4 | 8 to 12 | none |
| last_one | Talk him out the front | 72.4 | 4 | 6 to 22 | none |
| last_one | Let him decide | 96 | 4 | 45 to 84 | none |

Takeable pairs 0, because taking a choice leaves its node. Coverage: 0 gaps in the crossed walk,
no placeholder in the source, and one placeholder the engine leaves in rendered text (B1).

Taps. The common path spends two decisions in stage 3 (talking, then last_one). The longest
spends five: standoff, threat, fired_on, last_one, stayed_behind (F13).

Cue trace. Every adverse escalation traces to a summary or preview that names the danger to the
owner. Two that took checking:

```
| Choice | Mixed or adverse result, as written | Cue shown before | Field holding the cue | Traced |
| Clear out of sight | 'By the time the team looks again, Ruth has signed, struck with the handgun until she did.' (s3) | 'nobody near enough to help Ruth' / 'nobody is close by if Desmond hurts Ruth' | threat.step_back.summary, .preview.adverse | yes |
| Let the taker set the pace | 'Ruth sags off the stool two hours in and stays down.' (s2) | known[3] 'sat down hard'; the clock cue 'get down from the stool and sit on the tiles'; 'who may collapse first if unwell' | briefing.known[3], clock cue, talking.his_pace.preview.favorable | yes |
```

Named costs. Every option's named cost lands on at least one path (46 checked). "Ruth has to hear
it all again" on last_day lands only as text, which is enough for a cost the owner pays in
dignity.

## 5. Table read

```
Speakers hostage_crisis
| Speaker | Kind | Lines | Voice markers source |
| taker | subject | 3 direct ("The back door’s my business", "Nobody gives me orders", "That’s not what I said") plus reported | none on file |
| courier | caller, through dispatch | 1 direct ("I only needed one signature.") plus reported | none |
| owner | held person | reported only | none |
| others | subjects (group) | reported only ("only came here to vouch for a friend") | none |
| negotiator | negotiator | reported only ("the negotiator won’t") | none |
| {lead} | officer | summaries only | neutral, no markers on file |
| narration | narration | results, prompts, endings | not applicable |
```

The taker holds one need throughout, said plainly, with no monologue and no diagnosis. The
negotiator never promises without command (the concession cards carry the generated "Command
approves a written statement."), never argues, and never relays an allegation; on call_now mixed,
"The team says only that Ines is safe." The courier is interviewed outside and never put on the
line. Stock spoken lines 0 (G13 runner), no quips under threat.

The breaks are in the narration's shape, not the voices: names open 60 to 70% of sentences on a
path (F1), and the group's names repeat back to back in five strings (F3).

The endings, read last and alone. `everyone_out` is the strongest: each person's state, the
neutral custody line, and the unsigned slip as the lasting detail. `entry_hurt` and `owner_killed`
put their weight on a named person present. Three endings claim things a path makes false (F8,
F9, F10). No sermon endings.

## 6. Spoilers and honesty

Side by side. Card, dispatch, known and unknown lines, fact labels, every prompt, title, summary
and preview are one string each across situations; only results carry per-situation rows. Leaks
in pre-check fields: 0. The s2 clock cue is a result line rather than a pre-check field, but it
identifies the situation (B9).

Previews against every situation's result (45 truth-branched bands checked):

| Action | Band | Preview, quoted | s1 | s2 | s3 |
| --- | --- | --- | --- | --- | --- |
| talking.his_door | favorable | 'Desmond sends Ruth out the door he unbolted.' | agrees | agrees | **false**: 'That door is for when Ruth signs' |
| talking.others_walk_owner | mixed | 'Ruth reaches the door, but Pavel and Wren go back inside.' | agrees | agrees | **false**: 'Ruth isn’t anybody’s to walk anywhere. Pavel and Wren stay by the till.' |
| fired_on.go_in | adverse | 'Desmond fires again during the entry.' | **false** unless the owner is down: 'Desmond drags Ruth to the floor as officers come in.' | **false**, the same | agrees |

Honesty list.

- H1. "in custody" in `ending.out_the_back.summary`, `ending.stayers_held.summary` and
  `stayed_behind.prompt`; "Two officers walk Desmond to the car" in `last_one.out_front.mixed[0]`.
  The call shows the walk-out, but custody is the owner's open decision (O4), and E11.1's neutral
  line is the approved wording until then (F5). "Ines gets released first" is the taker letting
  her go, so it is clear.
- H2, H3, H4, H6, H7 clear. The back-door promise is kept only on `out_back`. H5 clear: the
  ambulance hand-off is shown.
- H8 and H10. `held_both`'s task "Get Ruth off that stool" is false where the owner has collapsed
  (path E8 reached it at 69 minutes with her seriously hurt) (F8). `entry_hurt` says "officers
  took Desmond without a fight" after he fired at the glass on fired_on paths (F9).
  `owner_killed_taker_hurt` says "Ines watched from the patrol car" on paths where she slipped out
  during the entry (F10). `group_out_dawn` says "left last night" on paths where they left in the
  afternoon (N13).
- H9. Endings outside the group endings never name the coworkers; the debrief's person lines do
  ("Pavel Dimitrov is with the team, unhurt.") (N16).
- H11. `owner_down.medic_door.favorable[0]` has the taker step back "palms out", and then
  `owner_collapsed` says he "stayed inside, still armed" (N14).

## 7. Ethics and copaganda

I walked the rulebook rule by rule (E1 to E15) and the copaganda table (P1 to P11 as C1 to C11,
and G1 to G16).

- E1 clear.
- E2 clear, with numbers. An unhurt entry scores trust 7 and factor 0.86, against 11 and 1.0 for a
  talk-out and 10 and 0.98 for the all-night hold. The entry is the worst option on odds at the
  threat node (19.9 favorable, 49.1 adverse).
- E2.2. Two deaths of the owner and one beating need the human read the writer already asked for
  (owner).
- E3: F14. The subject slot's surname draw is not uniform. Only 68 of 136 surnames reached the
  taker in 300 calls, 29 of them at more than twice their expected count, holding 191 of the 300
  draws; the courier and owner slots drew 117 and 112. The review's role-skew snippet maps names
  to the officer catalog, and v13 civilian names are deliberately disjoint from it, so cultural
  groups could not be tallied. The counts go to a human with the fix.
- E4 applies to the taker. E4.5 clear: force is `noFatal`, and the compiled variants skip the fatal
  line. E4.7: the content note and 988 line are drafted in row M, pending O2 and R5 (owner). The
  engine's slow-pacing line narrates a mechanic about a crisis subject in half of all calls (F11).
- E6 clear: every entry summary names who can be hurt. E7: the owner_beaten line is brief, and it
  goes to the human read. E8, E9, E10 clear.
- E11: F5.
- E12.1 activation, quoted. Armed: "Patrol says {taker.first} is holding a handgun on the people
  inside." and "came back carrying a handgun". Threat: "threatened the people inside". Refusal:
  "won’t let them go". The position of advantage is implied by the hold but stated in no player
  line (N17).
- E12.2 positions: patrol on the perimeter ("Patrol puts her behind the car", "patrol keeps the
  street shut"), the medic at the corner and the curb ("A medic waits at the corner for your
  word"), the negotiator on the counter phone from cover, and the team at the glass and the alley,
  priced in their summaries. Misplaced 0.
- E12.3 clear: the others are asked to walk out themselves, never to carry words.
- E12.4 clear: the owner's clock authorizes entry only for her collapse, with the generated care
  line. E12.5 clear.
- Restraint. The longest hold's debrief adds "The team was on scene for 83 minutes." at −1 trust
  and +3 strain. Restraint still outscores force, so this is not a block, but a time charge on a
  hold that kept everyone alive is an owner question under E14 (N19).
- C2 "in seconds" (F7). C11 "with their hands up" (F6). Others clear.

Fastest force path per situation:

| Situation | Threat line before the entry appears | Command's reason | Minutes, entry against fastest talk |
| --- | --- | --- | --- |
| s1 | 'Desmond has taken one push too many and thrusts the handgun out toward Ruth.' (meter branch, mark `turned`) | generated from `threatMarks.turned`, "{taker.first} turned the handgun on {owner.first}" | about 13 (nominal, not played) against 16.8 |
| s2 | 'Cans scatter across the tiles. When the shelf stops, the handgun is on Gabriela.' | 'Command approves it because Marek pointed the handgun at Gabriela.' (rendered) | 10.3 against 17.3 |
| s3 | as s2 | as s2 | 10.1 against 17 to 22 |

The entry is never more than twice as fast as talking, needs an adverse result before it appears,
and scores below every walk-out.

## 8. Batch audit (the group variants of one call)

```
Batch audit hostage_crisis, sample 1 call at 3 group sizes x 4 pronoun sets, 696 strings at two others, 938 sentences, from exports
| Check | Count | House target | Finding row |
| Sentences of 4+ words used 3+ times | 0 | 0 | none |
| Phrases of 3+ words repeated on one path | P1 12, P2 9, P3 7 (mostly place phrases); 4-word runs across fields 4, two on one path | 0 outside fixed formats | F2 |
| Over-used openers | names 52% of sentences (taker 27%); 60 to 70% per path (taker 32 to 38%) | names up to 35% with 3 or fewer people | F1 |
| Inverted or fronted openers (G15) | 1 locative inversion; 8 fronted adverbial clauses read as normal English | 0 inversions, at most 2 fronted per path | F4 |
| Template echo across types | not applicable, one type | 0 | none |
| Near-synonym variants | 2 pairs | 0 | N18 |
| Roster surnames in civilian casts | 0; the civilian pool is disjoint from the officer catalog, held by a test | 0 | none |
| Pool first names outside the cast | 0; text uses tokens only (names_check.py reads the retired scenario-names pool, so it does not apply) | 0 | none |
| Identity-by-role skew | subject slot: 68 of 136 surnames in 300 calls, 29 over 2x | no group over 2x in armed slots | F14 |
| Crisis calls per shift | not measured, no shift sampler | at most 1 | N21 |
| Officer pressure spread | not applicable | | |
| Spelling in unlinted data | 0 (checker word-choice 0) | 0 | none |
| Dashes and colons in game text | 0 and 0 | 0 | none |
```

## 9. Officer text

Not applicable; no officer text is in scope. `{lead}` appears in 29 summaries and stays neutral.

## 10. Engine gates

```
npx vitest run src/gen/incident/trees-v13/call-trees.test.ts src/gen/incident/trees-v13/coverage.test.ts src/gen/incident/trees-v13/groups.test.ts
  exit 0 | Test Files 3 passed (3) | Tests 92 passed (92) | 42.56s
bun scripts/check-strings.ts hostage_crisis
  exit 0 | 696 strings | repeat 0, ngram 0, path-echo 0, path-repeat 557, opener-share 2, cadence-flat 1, triad 1, it-check 36, tense-call 1
committed checker (git HEAD) on a distinct-name, mixed-pronoun export
  exit 1 | repeat 81, ngram 63, path-echo 60
working-tree checker on the same export
  exit 1 | ngram 4, all four shared by two different fields; repeat 0, path-echo 0
crossed coverage walk (scratch copy of coverage.test.ts, deleted)
  exit 0 | 38 starts, 133,335 states, 0 gaps
npm test
  exit 0 | Test Files 171 passed, 5 skipped (176) | Tests 2972 passed, 5 skipped (2977) | 443.99s
npm run verify
  not run | review pass, not a freeze
```

The writer's T1 and T2 claim, checked rather than trusted. T1 is real: most of the committed
checker's 81 repeats are one field's rows for two situations. It is not the whole story. The
committed checker's n-gram list also names runs shared by two different fields ("says nobody
leaves until", "stays on the line", "Ines leaves with her"), and the patched checker still reports
four when the call is bound with distinct names and he or she. The repo script hides them because
it binds every role to one longest name as singular they, which changes the agreement forms (F2,
N7). T1 and T2 are also already applied in the working tree: the shared checker's repeat key
changed, and `scripts/check-strings.ts` passes "Fox" and "Pheasant" as cast. The sheet still says
they were "described rather than applied" (N5).

Engine dry-run: not applicable; the call is built and loaded by the gates.

## 11. Findings

Severity first, then field. Each fix is data the owning skill can take or change; none has been
applied.

### Blocks

```
[block] B1 hostage_crisis, all situations | threat.talk_down.summary and talking.alley_talk.summary | sees 'Singh calls to Marek from the glass, in plain view. If the handgun turns, it turns toward {lead}.' (rendered in the lab) | rule G12 placeholder | fix as data 'If the handgun turns, it turns toward the window and whoever stands there.' and 'Only the door frame stands between the officer and the handgun.' | route swat-call-prose, then engineering: replace every {lead} (src/sim/operation-selectors.ts:364 calls String.replace with a string, so only the first is replaced) and fail any bound summary that still holds '{lead}'
[block] B2 hostage_crisis, s3 | talking.his_door.preview.favorable | sees 'Desmond sends Ruth out the door he unbolted.' while s3 favorable reads 'That door is for when Ruth signs, according to Desmond, who leaves it unbolted anyway.' | rule preview false in a situation | fix as data '{taker.first} gives you a straight answer about the door {taker.he} unbolted.' | route swat-call-prose
[block] B3 hostage_crisis, s3 | talking.others_walk_owner.preview.mixed | sees 'Ruth reaches the door, but Pavel and Wren go back inside.' while s3 mixed reads 'Desmond says Ruth isn’t anybody’s to walk anywhere. Pavel and Wren stay by the till.' | rule preview false in a situation | fix as data '{others} {others#ends|end} up at the till beside {taker.first}, who keeps the handgun.' | route swat-call-prose
[block] B4 hostage_crisis, s1 and s2 with the owner not down | fired_on.go_in.preview.adverse | sees 'Desmond fires again during the entry.' while the result reads 'Desmond drags Ruth to the floor as officers come in.' | rule preview false in a situation | fix as data '{taker.first} turns on {owner.first} as you come in, the handgun still in hand. {owner.first} may not survive it, and {taker.first} can be hurt too.' | route swat-call-prose
[block] B5 hostage_crisis, all situations, game board at 390px | card.summary (tree.summary) | sees '…A fired employee with a…' at long names and '…won’t let…' at typical names (2-line clamp at 13.5px, src/ui/screens/ops-visual.css:28) | rule cold read, hook test 7, budget card hook | fix as data '{courier.first} should have left ten minutes ago. Now a fired worker with a handgun won’t let anyone go.' (98 characters with a 9-letter name; the board already shows the building type) | route swat-call-prose; the owner may instead have engineering clamp the board hook at 3 lines
[block] B6 hostage_crisis, s2 | talking.his_pace.favorable[1], standoff.into_night.favorable[1], out_keys.spare_key.favorable[2] | sees the owner collapse ('Ruth sags off the stool two hours in and stays down.') under the decision card's green 'Went well' chip (src/ui/screens/OperationFeedback.tsx:14 and :68), reached on engine path E5 | rule fake-choice 9 | fix as request 'TreeOutcome.resultLabel mapped to the decision card, so a clock-out outcome in the favorable band reads "Too late for {owner.first}"' then data '{owner.first} sags off the stool two hours in. {taker.first} unbolts the door at once, and officers carry {owner.him} out to the medic. {taker.first} keeps the handgun.' | route engineering, then swat-call-design
[block] B7 hostage_crisis, all situations | talking.his_pace.mixed[0], stayed_behind.wait_rest.mixed[0], nobody_followed.give_night.mixed[0] | sees 'Desmond lets Ruth go after dark. She has been at the counter four hours.' against the favorable 'until the street lights come on': same route, same ending, 20 more minutes; the design record says mixed bands differ by who talks, where a person is or a mark | rule fake-choice 10, table time-band, table claims | fix as data his_pace mixed adds mark still_armed with '{taker.first} lets {owner.first} go after dark and keeps the handgun in {taker.his} lap.'; wait_rest and give_night route favorable to group_out and keep mixed on group_out_dawn | route swat-call-design
[block] B8 hostage_crisis, two others | one_door.others_courier.adverse[0] | sees 'Desmond catches Pavel at the door and pulls them back.' ({others.him} binds plural after {others.first}) | rule consistency, pronoun mismatch | fix as data '{taker.first} gets to the door first and stands in front of {others.first}.' | route swat-call-prose
[block] B9 hostage_crisis, s2 against s1 and s3 | template situations[1].clocks owner_condition cue, and tree situations truth | sees 'Through the glass, the team sees Ruth get down from the stool and sit on the tiles.' about 3 to 6 minutes in, only in s2, the one situation where lets_go and raised are both true, so a returning player learns the truth for free. Taker volatility is also volatile only where raised is true, so the size of the "more worked up" contributor may reveal it too (not checked in the game UI) | rule fake-choice 3 (cheaper reveal), static walk cheaper reveals | fix as request 'a per-call drawn axis for the owner's condition (the clock and owner_faint drawn independently of the situation, as turns and group size are)' and data 'draw taker volatility from the same pick in every situation' | route swat-call-design, then engineering; whether replay learning counts as "truth leaks through structure" (a reject condition) is an owner decision
```

### Fix before freeze

```
[fix before freeze] F1 hostage_crisis, all situations | results, previews and summaries | sees names opening 60 to 70% of sentences on a path (P1 54 of 86, the taker 33) | rule batch openers, prose rule 11 (names up to 35% with three or fewer people) | fix as data, for about one taker-opened sentence in three, give the sentence to an object or another person and never invert it: out_keys.ask_unlock.favorable[0] 'The front bolt slides back, and officers on the sidewalk hear it. {taker.first} says the door stays shut.'; out_back_door.ask_door.adverse lead 'The line goes dead mid-question.' | route swat-call-prose (measured by a separate reader; not downgraded)
[fix before freeze] F2 hostage_crisis, all situations | offer.hear_him.mixed[0] then his_side.courier_first.adverse[0]; out_back_door.ask_door.mixed[0] then talking.his_pace.summary | sees 'says nobody leaves until' twice and 'stays on the line' twice on one path, against the prose record's '4-word runs 0' | rule batch phrases, table claims | fix as data courier_first.adverse '{taker.first} steps in front of {courier.first}. No one goes anywhere until the writing is done, {taker.he} {taker~says|say}.'; ask_door.mixed '“The back door’s my business,” {taker.he} {taker~says|say}, and {taker~keeps|keep} the receiver to {taker.his} ear.' | route swat-call-prose
[fix before freeze] F3 hostage_crisis, two others | both_inside.free_others.favorable[0], talking.others_walk_owner.favorable[0] and [2], nobody_followed.give_night.summary, nobody_followed.call_others.mixed[0] | sees 'Desmond sends Pavel and Wren off. Pavel and Wren file out the street door…' | rule batch phrases, read aloud | fix as data free_others '{others} {others#files|file} out the street door with open palms when {taker.first} says go, and officers walk {others.him} clear.'; give_night 'You keep the street sealed and leave {others} to decide. Your squad stays until the door opens.' | route swat-call-prose
[fix before freeze] F4 hostage_crisis, one or two others | one_door.promptIf[1] | sees 'Nearest the exit are Pavel and Wren, and Ines is right behind them.' | rule G15 inversion | fix as data '{others} {others#stands|stand} nearest the exit, and {courier.first} is right behind {others.him}.' | route swat-call-prose
[fix before freeze] F5 hostage_crisis, all situations | ending.out_the_back.summary, ending.stayers_held.summary, stayed_behind.prompt, last_one.out_front.mixed[0] | sees '…and is in custody.' and 'Two officers walk Desmond to the car.', while the design record says surrender is 'with the team now' | rule H1, G11, E11.1, table claims | fix as data '…came out by the alley, away from the crowd at the tape, and is with the team now.'; '…and {taker.first} is with the team.'; '{taker.first} and part of {taker.his} old shift are with the team.'; 'Two officers take {taker.him} by the arms.' | route swat-call-prose, and owner for O4
[fix before freeze] F6 hostage_crisis, one or two others | nobody_followed.call_others.favorable[0], fired_on.go_in.favorable[3] | sees 'Pavel and Wren walk out together with their hands up' and 'raise their hands' | rule C11 surrender pose, E11.1 | fix as data '{others} {others#walks|walk} out together, hands open the way the team tells {others.him}, and officers take {others.him} aside.'; '{others} {others#keeps|keep} {others.his} hands where officers can see them.' | route swat-call-prose
[fix before freeze] F7 hostage_crisis, s2 with the owner down | fired_on.go_in.favorable[1] | sees 'The team is over the counter in seconds.' | rule C2 clean force | fix as data 'Officers are over the counter before {taker.first} can turn. Two of them carry {owner.first} out, and {taker.first} lets go of the handgun.' | route swat-call-prose
[fix before freeze] F8 hostage_crisis, s2 | ending.held_both (task[1] and summary), reached from owner_down.medic_door.adverse and every heldEnd courier line | sees 'Get Ruth off that stool' and no word of her collapse, on engine path E8 where she is down and seriously hurt | rule H8, H9, H10 | fix as data a held_both_down ending, title 'Both still inside', summary 'Patrol has the block sealed. {owner.first} is down behind the counter, and {courier.first} is still on the boxes with {taker.first}, who is armed.', tasks 'Get {owner.first} to the medic', 'Walk {courier.first} out to patrol', 'Talk {taker.first} into putting the handgun down'; route owner_down with the courier inside there | route swat-call-design
[fix before freeze] F9 hostage_crisis, all situations | ending.entry_hurt.summary | sees 'officers took Desmond without a fight' after he fired at the glass (fired_on paths) or hauled Ruth down, and 'getting checked at the curb' when she is badly hurt | rule H10, preview severity | fix as data '{owner.first} is with the medic at the curb, hurt in the entry. {courier.first} is safe, and officers have {taker.first}. {owner.first} asks someone to lock up for {owner.him}.' | route swat-call-design (a split by severity is structure)
[fix before freeze] F10 hostage_crisis, s3 | ending.owner_killed_taker_hurt.summary | sees 'Ines watched from the patrol car.' on paths where 'Ines slips away in the struggle' | rule H10 | fix as data '{courier.first} is in the patrol car now.' | route swat-call-prose
[fix before freeze] F11 hostage_crisis, deliberate_answers pacing (half of calls) | compiled briefing.known[4] (src/gen/incident/trees-v13/compile.ts:492) | sees 'Dispatch says Zoltan takes a long time to answer. Every conversation with Zoltan takes two extra minutes.' about a subject the sheet screens under E4 | rule E4, engine-map R9, prose rule 4 | fix as request 'R9: a per-tree pacing opt-out or a tree-authored pacing line' then data '{taker.first} goes quiet for a long time before each answer, dispatch says.' | route engineering, and swat-call-design to file R9 in row O (row E cites it; row O omits it)
[fix before freeze] F12 hostage_crisis, all situations | briefing (dispatch, known[0..3], responsibilities[0..2], the appended pacing line) | sees up to 9 briefing lines against row E's 4 known plus 1 unknown, which counts the dispatch, responsibilities and appended lines | rule design row E, cold read 10 seconds | fix as data drop known[0] (known[2]'s quote carries it) and fold the responsibilities to 'Get {courier.first} and {owner.first} out' and 'Bring {taker.first} out alive, and anyone with {taker.him}' | route swat-call-design
[fix before freeze] F13 hostage_crisis, all situations | stage 3 nodes talking, standoff, threat, fired_on, last_one, stayed_behind | sees 2 decisions in stage 3 on the common path and 5 on the longest, against the design record's 1/1/1 and 1/1/2 | rule taps (more than three at the commit stage), table claims | fix as data route favorable releases where the taker has set the handgun down (take_account.favorable[0], talk_down.favorable[0]) straight into the surrender and cascade, so last_one is reached only while the taker is still deciding | route swat-call-design
[fix before freeze] F14 all v13 calls, subject slot (here the taker) | drawTreeCast surname draw (src/gen/incident/trees-v13/compile.ts:50) | sees 68 of 136 surnames reach the armed role in 300 calls, 29 above twice their expected count, holding 191 draws; courier 117, owner 112 | rule E3, batch identity skew | fix as request 'draw from the hash's high bits (Math.floor(hash / 2^32 * length)), as resolveNext does for turns, and gate uniformity per role'; then send the subject-slot counts and lines to a human | route engineering, then owner
```

### Notes

```
[note] N1 hostage_crisis | briefing.dispatch | restates the card's handgun and refusal with a source | rule restatement | fix as data none needed | route swat-call-prose
[note] N2 hostage_crisis | his_side.prompt; talking.promptIf[0]; threat.prompt | each restates the result just above it ('He wants a page saying he took nothing.' then 'wants it on paper that he took nothing'; the clock cue then 'has slid down onto the tiles'; 'the handgun is on Ruth' then 'Desmond has the handgun on Ruth.') | rule restatement | fix as data talking.promptIf[0] '{taker.first} is still talking. {owner.first} stays down on the tiles behind the till.' | route swat-call-prose
[note] N3 hostage_crisis, s2 | talking.promptIf[0] | sees 'short of breath' when the team has only seen her through the glass | rule sourced once | fix as data as N2 | route swat-call-prose
[note] N4 hostage_crisis, one or two others | both_inside.free_others.title, one_door.others_courier.title, talking.others_walk_owner.title | sees 'Give Pavel a way out' while both members leave | rule consistency | fix as data 'Open the front to {others}' if it fits 30 characters at the longest names, else keep and record why | route swat-call-prose
[note] N5 docs/calls/hostage-signature-design.md | row O tooling and R-E1 | says T1 and T2 were "described rather than applied" and that the debrief prints "is out, hurt." for an owner hurt inside; both are already done in the working tree (game_string_checks.py repeat key; check-strings.ts passes Fox and Pheasant; outcome-score.ts hurtInside) | rule record honesty | fix as data update rows O and P | route swat-call-design
[note] N6 src/gen/incident/trees-v13/coverage.test.ts | startsFor | the gate's starts never cross group size: 13 hostage starts, two others once (s2), s3 never with a group | rule gate coverage | fix as request 'key the starts by situation, turn, pacing and subject count, as the review's scratch walk did (38 starts, 0 gaps)' | route engineering
[note] N7 scripts/check-strings.ts | binding | binds every role to one longest name as singular they, which hides agreement-dependent repeats and reports one name for every opener | rule batch method | fix as request 'bind distinct longest names per role, and run once each with he and with she' | route engineering
[note] N8 .agents/skills/swat-call-prose/references/surface-budgets.md row 3 | card hook clamp | says the live panel clamps to 3 lines at 14px; the board card clamps to 2 lines at 13.5px, about 103 characters at 390px (measured 2026-10-08) | rule consistency | fix as data 'board card clamps to 2 lines at 13.5px (about 100 characters at 390px, measured 2026-10-08); live panel 3 lines' | route swat-call-prose
[note] N9 standing lint gap | src/gen/incident/gates/prose-lint.ts | sees no machine check on dashes, colons, stock phrases, cross-framework repeats or hand-authored stories | rule standing lint gap | fix as request 'extend prose-lint with these checks and run it on hand-authored stories' | route engineering
[note] N10 hostage_crisis, lone, after ask_unlock | talking.ask_owner beside talking.his_door | 68.1 favorable at 2 to 3 minutes beside 80.5 at 3 to 4.5, same adverse | rule test dominance | fix as data give ask_owner something only it buys, or hide it when door_open is set | route swat-call-design
[note] N11 hostage_crisis, all situations | ending.out_by_dawn.summary | sees 'Ines and Ruth went home hours ago.', a step never shown (in s2 the owner is unwell) | rule H5 | fix as data '{courier.first} and {owner.first} have been outside for hours.' | route swat-call-prose
[note] N12 hostage_crisis, one or two others | ending.group_out.summary | prints the coworkers' private reason as narration ('who came to back up a story about a till') on paths that never showed it | rule ship the tip | fix as data 'Officers have {taker.first}, and {others} too.' | route swat-call-prose
[note] N13 hostage_crisis, two others | ending.group_out_dawn.summary | sees 'left last night' when they left in the afternoon | rule H10 | fix as data '{owner.first} and {courier.first} left hours ago.' | route swat-call-prose
[note] N14 hostage_crisis, s2 | owner_down.medic_door.favorable[0] against ending.owner_collapsed.summary | 'palms out', then 'still armed' | rule H11 | fix as data '…steps back from the door, the handgun on the counter behind {taker.him}.' | route swat-call-prose
[note] N15 hostage_crisis, lone | briefing.responsibilities[2] | 'anyone with him' in a call with nobody with him | rule restatement, R-G3 | fix as request R-G3 (count-conditioned briefing lines) | route engineering
[note] N16 hostage_crisis, one or two others | most endings | the coworkers' end state appears only in the debrief person lines | rule H9 | fix as request 'extend R-G3 to count-conditioned ending addenda' | route engineering
[note] N17 hostage_crisis | briefing | the position of advantage is stated in no player line (E12.1) | rule E12.1 | fix as data a known line 'The counter faces the only street door, and {courier.first} and {owner.first} are between it and {taker.first}.' (counted against F12's budget) | route swat-call-design
[note] N18 hostage_crisis | standoff.pull_back.adverse[2], ending.held_both.summary, read_back adverse | two near-synonym pairs ('is left in there with' / 'is still in there with'; 'is still by the door' / 'is still sitting by the door') | rule batch near-synonym | fix as data vary by fact | route swat-call-prose
[note] N19 src/sim/outcome-score.ts time.long | debrief | 'The team was on scene for 83 minutes.' at −1 trust on the all-night hold that kept everyone alive (still above the entry's 7) | rule E14 in spirit | fix as request none until the owner rules | route owner
[note] N20 .agents/skills/swat-writing-review/SKILL.md section 4 | fake-choice checklist | copies lines 1 to 8; the canonical list has 10 | rule consistency | fix as data copy lines 9 and 10 | route swat-call-design
[note] N21 batch | crisis frequency | not measured, no shift sampler | rule batch crisis | fix as request 'a shift sampler' | route engineering
```

## 12. Notes session order

Blocks first, one at a time:

1. B1: two strings, plus the one engine line.
2. B2 to B4: three previews.
3. B8: one string.
4. B5: the hook, with the owner's choice of data or clamp.
5. B7, then B6: design.
6. B9: design and an engineering request, with the owner's ruling on replay leaks.

Then the F rows. After edits, rerun the three gate files and `bun scripts/check-strings.ts
hostage_crisis` with distinct names (N7), and re-read only the passes each fix touched.

## 13. Verdict

```
Verdict hostage_crisis "One Last Signature" v13 | edit | block 9 | fix before freeze 14 | note 21 | ships in v13 if the owner confirms v13 is open (O3), else the next version
```

## 14. Owner decisions surfaced

1. O4 custody: the four lines in F5.
2. E2.2 human read of each death and the beating: `owner_killed`, `owner_killed_taker_hurt`,
   `owner_beaten`, and `threat.step_back.adverse` in s3.
3. O2 and R5: the drafted content note and 988 line still have no surface.
4. Whether a situation a returning player can identify from a free cue counts as "truth leaks
   through structure" (reject) or a block with a fix (B9). I scored it as a block.
5. B5: fix the hook in data, or clamp the board hook at 3 lines.
6. E3: the subject-slot name counts (F14), for a human read once the draw is fixed.
7. N19: whether the debrief's time charge on a hold that kept everyone alive is acceptable.
8. O1: the armed-lane words ("handgun", "armed", "hurt", "die") the writer already raised.

## 15. Review record

```
Writing review record
- Scope: answered | hostage_crisis s1 to s3, ordinary and deliberate_answers, 0 to 2 others, v13, 38-start crossed walk
- Reader: answered | separate; the cold read was not fully cold (source read first)
- Read surface: answered | lab /story.html?type=hostage_crisis&variant=0 and ...&variant=1&tab=run (and &pacing=deliberate_answers) at 390px; game Ops board at 390px, read only | unseen in game: live panel clamp, decision log, debrief layout, map markers in play (no disposable campaign; playing would change the user's save); s3 not opened in the lab
- Cold read: answered | 2 cards (lab s1, game board); blanks: worse-if-they-wait weak, and on the board the handgun at long names; restated facts 2 (dispatch), 0 in the first stage prompt
- Path and choice read: answered | crossed walk 38 starts, 133,335 states, 0 gaps; 2 lab paths played, 10 engine paths scored, 3 path blocks exported
- Choice table: answered | claims 16 checked, 9 falsified, 2 stale; dominated 0 strict, 1 near (N10); takeable pairs 0; time-only bands 3; commit taps max 5; cells missing 0; placeholders 1 rendered ({lead}); untraced adverse 0
- Table read: answered | 7 speakers voiced; voice breaks 0 in speech, narration breaks F1 and F3; stock lines 0
- Spoilers and honesty: answered | leaks 0 in pre-check fields, 1 structural (B9); previews false in a situation 3; invented or implied outcomes 5 (F5 x4, N11); endings false on a path 4 (F8, F9, F10, N13); still-needed lines false 1 (F8); physical contradictions 1 (N14)
- Ethics: answered | rules triggered E3 (F14), E4 (F11), E11 (F5), E12.1 (N17), C2 (F7), C11 (F6); activation quoted for armed, threat and refusal, advantage implied; fastest force path quoted per situation (section 7), entry 10 to 13 min against talk 17; restraint clear, time line to the owner; tally: subject slot, 300 calls, 68 of 136 surnames, 29 over 2x (cultural grouping not possible, the civilian pool is disjoint from the personas); routed to human 2 (F14, E2.2 read)
- Officer read: not applicable | no officer text in scope
- Batch audit: answered | sample 1 call x 3 sizes x 4 pronoun sets, 696 strings, 938 sentences; repeats 0; 4-word runs 4; openers over target 1 (names); collisions 0; crisis cap not measured
- Engine gates: answered | three gate files exit 0, 92 passed; check-strings exit 0; npm test exit 0, 2972 passed, 5 skipped; npm run verify not run (review, not a freeze)
- Engine dry-run: not applicable, built and loaded by tests
- Tells checked: answered in part | swat-call-prose game_string_checks.py ran on distinct-name exports (feeling 0, policy-voice 0, stock 0, stock-spoken 0); the review's pattern runner ran at 0, 1 and 2 others; written-voice's voice-check is not installed in this repo, not run
- Findings: 9 block, 14 fix before freeze, 21 note, routed to swat-call-prose, swat-call-design, engineering, owner
- Owner decisions surfaced: O4 custody, E2.2 human read, O2 and R5, replay leak (B9), hook clamp (B5), E3 counts, time line (N19), O1 words
- Verdicts: approve 0, edit 1, reject 0, recorded at not yet recorded (no pull request open; record it in the PR as docs/content-pipeline.md asks)
```

## 16. Re-check (2026-10-08)

The writer answered every finding in data (the "Review response" table at the end of
docs/calls/hostage-signature-design.md), and the lead changed the engine for B1, B6, F11 and F14.
I re-read only the passes those fixes touched, against the files as they stood at 00:50 (the call)
and 01:02 (the engine), by the same rules as the first pass.

### How it was re-checked

- Strings re-exported from the current call at 0, 1 and 2 others with four pronoun sets (701 at
  two others, 684 at one, 642 lone), diffed against the first-pass export: 152 strings new or
  changed.
- The prose checker on all 12 distinct-name bindings: every one exit 0, with repeat 0, ngram 0,
  path-echo 0, inversion 0, fronted 0, over-limit 0. `bun scripts/check-strings.ts hostage_crisis`:
  exit 0, 701 strings.
- The 45 truth-branched previews read against each situation's result again.
- The review's pattern runner and batch counters on the new export: near-synonym pairs 0; C2 and
  C11 gone; the G11 hits left are the four custody lines waiting on O4.
- Per-path openers on three player-order path blocks rebuilt from the new strings.
- Engine paths in a scratch test (deleted): the s2 collapse under his_pace and into_night, path
  E8, the s1 surrender on the account, the slow-pacing line in each situation, and a 300-call
  surname tally.
- A crossed coverage walk (scratch copy of the gate, deleted): 40 starts over every situation,
  turn, pacing and group size, 145,428 states, 106,335 endings, 0 gaps.
- The board card in the running game at 390px, read only: the live card already shows the new
  hook, and the worst-case binding measured in the DOM and restored.

### Findings, one by one

| ID | Status | Evidence |
| --- | --- | --- |
| B1 | closed | No summary holds a second `{lead}` (both rewritten). `summaryFor` now replaces every `{lead}` for v13 (`src/sim/operation-selectors.ts`) |
| B2 | closed | 'You get a straight answer, and the front stays unbolted.' holds in s1, s2 ('holds the door open') and s3 ('leaves it unbolted anyway') |
| B3 | closed | '{others} end up at the till beside {taker.first}, who keeps the handgun.' holds in s1 and s2 ('orders them to the till') and s3 ('stay by the till') |
| B4 | closed | 'Desmond meets you at the till, armed.' holds for the drag, the second shot and the s3 shot |
| B5 | closed | 98 characters at a 9-letter name; nothing hidden under the board's 2-line clamp, measured in the DOM at 390px |
| B6 | closed | The engine labels any v13 decision where someone is hurt or killed with the worst harm (`harmResultLabel`, `src/sim/action-result.ts`), and the card shows it in place of the green chip. Seen on the s2 collapse under his_pace favorable ('Tamar Holloway was badly hurt') and into_night favorable ('Kalani Dimitrov was badly hurt'). The band's "went well" survives only inside the collapsed "Details and reasons", after "Recorded check: favorable" |
| B7 | closed | his_pace mixed sets `still_armed` ('with the handgun still across his lap'); wait_rest and give_night favorable end in `group_out`, mixed in `group_out_dawn` |
| B8 | closed | 'Desmond beats Pavel to the door and puts a hand on the bolt.' No pronoun |
| B9 | open, owner | Unchanged: the s2 cue still identifies the situation. Engineering request and owner ruling (design question 10). Does not block under the lead's instruction |
| F1 | closed by downgrade | Names now open 43 to 49% of sentences per path (were 60 to 70%) and the taker 18 to 21% (were 32 to 38%), spread over three to five people. Still above the 35% house figure, but the cuts that got it here already produced 12 new agentless passives (NF3), so further cuts would trade a count for dodges. Downgraded to a note by the separate reader, as batch-audit.md allows |
| F2 | closed | 0 four-word runs across fields at all 12 bindings |
| F3 | closed | No group name repeats back to back (one awkward line, NF7) |
| F4 | closed | '{others} stand nearest the exit, and {courier.first} is right behind them.' |
| F5 | open, owner | Four custody lines unchanged pending O4 |
| F6 | closed | 'palms showing'; 'show officers their empty hands' |
| F7 | closed | 'Officers are over the counter with Desmond still looking the other way.' |
| F8 | closed | New `held_both_down`; `heldEnd` now routes four exclusive cases, and path E8 ends there. Residual risk in NF8 |
| F9 | closed | 'Ruth is getting care at the curb, hurt in the entry. Ines is safe. Officers are holding Desmond.' |
| F10 | closed | 'Ines is safe in a patrol car now.' |
| F11 | closed | The pacing line no longer applies to a subject (compile.ts). It now lands on the courier, in calls whose turn talks to the courier. Its mechanic wording is engine-owned under R9, filed in row O (note) |
| F12 | closed by downgrade | Applied as proposed (known[0] dropped, responsibilities folded to two), and row E now counts honestly: 8 lines, 9 with the pacing line, against row E's cap of 5. My own fix plus N17's added line could not reach the cap either, so what remains is a design-budget question (do responsibilities count toward the 10 seconds?) for swat-call-design, not a blocker on this call |
| F13 | closed | The account and the talk at the glass now end in the surrender in the same decision, so stage 3 takes one or two decisions on the common path. The longest chain is six, all real decisions after adverse results and none of them chores; the owner may still fold a step (design question 9). New issue from this fix in NF1 |
| F14 | closed | 300 calls: taker 116 distinct surnames, courier 124, owner 122; 11, 8 and 7 names above twice their expected count, about what a uniform draw gives (expected 2.2 per name). The human read of the counts stays with the owner |
| N1 | closed | none needed |
| N2, N3 | closed | his_side.prompt, talking.promptIf[0] and threat.prompt no longer restate the result above them (threat.prompt has a side effect, NF4) |
| N4 | closed | Kept with a recorded reason: the full group name breaks the title budget |
| N5 | closed | Rows O and P now say T1, T2 and R-E1 were applied |
| N6, N7, N9, N15, N16, N21 | open, engineering | Listed in row O; none blocks the call |
| N8, N20 | open, skill files | The board clamp in surface-budgets.md and checklist lines 9 and 10 in this skill's SKILL.md; outside the call's files |
| N10 | closed | `ask_owner` hidden once the front is unbolted |
| N11 to N14 | closed | as the writer's table says, each read in the new export |
| N17 | closed | Advantage line added as known[3] (unsourced, NF5) |
| N18 | closed | near-synonym pairs 0 |
| N19 | open, owner | design question 13 |

Totals: 33 closed (two of them by downgrade), 11 open (B9 and F5 for the owner, N19 for the owner,
six engineering notes, two skill-file notes).

### New findings from the edits

```
[fix before freeze] NF1 hostage_crisis, s1 and s2 (take_account), all situations (talk_down) | talking.take_account.favorable[0], threat.talk_down.favorable[0] | sees 'Then Desmond sets the handgun down by the till and walks Ruth out, hands empty.' and '…follows Ruth out past the team, hands open.' Since F13 these lines are the surrender, but nobody directs the walk-out or takes hold of him, and he walks the held person out and past the team | rule E11.1, E12.2 | fix as data 'Six years at the counter go into the officers’ notes. {taker.first} sets the handgun down, sends {owner.first} out first, and comes out the way the team says, hands open. The team has {taker.him} at the door.' and '{taker.first} leaves the handgun next to the register and lets {owner.first} out first, then comes out the way the team says, hands open. Two officers meet {taker.him} on the sidewalk.' | route swat-call-prose
[fix before freeze] NF2 hostage_crisis, s3 | talking.take_account.mixed[2] | sees 'The account gets read back so Ruth has to listen, and she stays put.' The old line had the taker order it; the passive leaves the team as the apparent reader making a held person listen | rule E12 (no held person made a party), honesty of agency | fix as data '{taker.first} makes the negotiator read the account back so {owner.first} has to listen, and {owner.he} {owner~stays|stay} put.' | route swat-call-prose
[note] NF3 hostage_crisis | his_side.owner_voice.mixed[0] and [1], talking.his_pace.adverse[0], talking.ask_owner.preview.adverse, last_one.prompt and others | sees agentless passives up from 4 to 16 after the opener fix, a pseudo-cleft ('A demand is what Desmond hears'), and a fronted locative ('Behind the counter, Desmond is alone.'); at most two per path, and most read naturally | rule G15 (a rise after an opener fix), prose rule 11 | fix as data '{taker.first} hears a demand, and the handgun may come up toward {owner.first}.'; '{courier.first} and {owner.first} are outside with patrol. {taker.first} is alone behind the counter.'; '…The receiver goes back to {taker.first} before {owner.he} can say more.' | route swat-call-prose
[note] NF4 hostage_crisis | threat.prompt | sees 'Ruth is at the till, close enough for Desmond to grab.' under the threat menu, where the handgun is on her; the N2 fix dropped the object | rule threat object named | fix as data '{owner.first} is still at the till, and the handgun hasn’t moved off {owner.him}.' | route swat-call-prose
[note] NF5 hostage_crisis | briefing.known[1], briefing.known[3] | the courier's role is now stated nowhere in the briefing (known[0], the delivery, was dropped for F12), and the new advantage line has no source | rule hook test 8, known-line shape | fix as data '{courier.first}, the courier, told the dispatcher, “I only needed one signature.”' and 'Patrol says the only street door faces the counter, where {taker.first} keeps {owner.first} close.' | route swat-call-prose
[note] NF6 hostage_crisis | preview.favorable on take_account, his_door, write_now, call_now, hold_corner; hear_him adverse | 'You get' opens six previews, and two sit on one talking menu | rule fake-choice 1 (per visible option set), batch openers | fix as data his_door 'The front stays unbolted, and {taker.first} answers to your face.' | route swat-call-prose
[note] NF7 hostage_crisis, s3, one or two others | talking.others_walk_owner.favorable[2] | sees 'The street door shuts behind them alone.' | rule read aloud | fix as data 'The street door shuts without {owner.first}.' | route swat-call-prose
[note] NF8 hostage_crisis, s2 | ending.held_both_down.title; heldEnd routing | the new ending shares the title 'Both still inside' with held_both; and a clock that runs out inside a held-ending decision (pull_back, hold_corner) sets owner_down after the `when` is read, so the call may still end in held_both with the owner down (not verified; the same class as design question 6 and R-G4) | rule H10, consistency | fix as data title 'Both inside, {owner.first} down'; fix as request R-G4 | route swat-call-prose, engineering
[note] NF9 all v13 calls | src/gen/incident/trees-v13/compiled-fingerprints.json | captured at 00:52, before the recipe draw moved to hashIndex at 00:59 and 01:03, so 'compile to the captured bytes on every listed building' fails for every v13 call; v13 is not issued, and the issued v9 to v11 suites pass | rule gate compiled-fingerprints | fix as request 're-capture the v13 compiled fingerprints once the draw changes settle' | route engineering
```

### Engine gates on the re-check

```
crossed coverage walk (scratch, deleted) | exit 0 | 40 starts, 145,428 states, 0 gaps
game_string_checks.py, 12 distinct-name bindings | exit 0 each
bun scripts/check-strings.ts hostage_crisis | exit 0 | 701 strings
three gate files (01:09) | exit 0 | Test Files 3 passed (3), Tests 92 passed (92)
npm test, settled tree (01:10 to 01:17, no file changed during the run) | exit 1 | Test Files 1 failed, 170 passed, 5 skipped; Tests 1 failed, 2971 passed, 5 skipped; the one failure is compiled-fingerprints.test.ts (NF9). Issued v9 to v11 suites pass
npm test, earlier run (00:58 to 01:06) | exit 1, 6 failed | discarded: the lead edited scenario-recipes.ts and operation-selectors.ts during the run; the two failing files pass on the settled tree (48 tests)
```

### Verdict

```
Verdict hostage_crisis "One Last Signature" v13, re-check | edit | block 0 open (B9 open for the owner) | fix before freeze 2 new (NF1, NF2), F5 open for the owner | note 7 new, 9 open from the first pass | ships in v13 once NF1 and NF2 land, if the owner confirms v13 is open
```

Approve is one step away: NF1 and NF2 are one-line data fixes for swat-call-prose. The owner
items stay listed and do not block under the lead's instruction: B9 (replay leak), F5 and O4
(custody), the E2.2 human reads, O1, O2 and R5, N19, the board clamp, and the E3 count read.

### Re-check record

```
Writing review record, re-check
- Scope: answered | the passes the fixes touched, hostage_crisis s1 to s3, 0 to 2 others, v13; call as of 00:50, engine as of 01:02 on 2026-10-08
- Reader: answered | separate, same reader as the first pass
- Read surface: answered | exports at 12 bindings; the game board at 390px (DOM, read only) | unseen: a played call in the game, as in the first pass
- Cold read: answered | the hook now shows the danger on the board at every binding; courier role missing from the briefing (NF5)
- Path and choice read: answered | crossed walk 40 starts, 0 gaps; engine paths E5, E8, the s2 into_night collapse, the s1 surrender
- Choice table: answered | previews false 0 of 45; time-only mixed bands 0; placeholders 0; commit taps 1 to 2 common, 6 longest (accepted)
- Table read: answered | changed strings read in path order; agency and dodges in NF2 and NF3
- Spoilers and honesty: answered | previews false 0; endings false on a path 0 known (NF8 unverified); custody lines 4 (owner)
- Ethics: answered | E11.1 surrender lines on the new shortcut (NF1); E3 draw now uniform; restraint unchanged
- Officer read: not applicable
- Batch audit: answered | repeats 0, 4-word runs 0, near-synonyms 0, name openers 43 to 49% per path (downgraded), passives 4 to 16 (NF3)
- Engine gates: answered | three gate files exit 0, 92 passed; check-strings exit 0; crossed walk 0 gaps (run before the lead's 01:03 recipe-draw change, which remaps seeds to situations but not the combinations the walk covers); npm test on the settled tree exit 1, only the stale compiled-fingerprints guard (NF9)
- Engine dry-run: not applicable, built and loaded by tests
- Tells checked: answered in part | game_string_checks.py at 12 bindings; written-voice not installed
- Findings: first pass 33 closed, 11 open (owner 3, engineering 6, skill files 2); new 2 fix before freeze, 7 note
- Verdicts: approve 0, edit 1, reject 0
```
