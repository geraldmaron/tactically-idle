# Writing review: One Last Signature, depth register (hostage_crisis)

Reviewed through swat-writing-review 0.3.0 (pass six and rubric section 9, D1 to D10) on
2026-10-19 by a separate reader who did not write the call, at commit ddafbad on
claude/scenario-depth. The review edits nothing. Every fix below is data for the owning skill or a
written request.

**Verdict: edit.** 4 block, 21 fix before ship, 12 note. No reject condition holds: D1, D2, D3 and
D5 pass. Every block has a one-string data fix.

## The short read

The register works. The call now has a past before stage 1, and the best new lines are the kind
the owner asked for: small, physical and wrong for the moment in a way that tells you who
someone is. "He doesn't make her sit. He just moves it closer." "As they go, Desmond asks them to
take her coat." "The way a person puts down something that belongs to someone else." The cold
open is a scene, not a summary of the card, and the profiles give the owner a ledger and a
dead spouse that one ending pays off ("on the floor behind the register where she kept the
ledger").

It falls short in four places:

1. **The new ending details aren't checked against every path.** "Came out last" is false in
   group calls, "alone in the shop now" is false in group calls, "nobody had known there was a
   cat" is hard to believe of an owner who hasn't missed a day in 22 years, "called him on
   Monday" implies a release, and owner_beaten's page is both signed and not signed.
2. **The narrator keeps giving speeches.** Twelve choice summaries carry a sentence of general
   wisdom ("Time makes most people tired before it makes them dangerous.", "People say things
   to a face they never say to a phone."), and four prompts end on a portent ("Nothing is moving,
   and that is its own kind of danger."). The approved sample has none of these. They are the
   main reason the longer strings read as overwritten.
3. **Depth is front-loaded.** Stage 1 and stage 2 results are beats. Many stage 3 and group
   results are still one-liners ("Nobody gets released on demand.", "The alley suits Desmond,
   but Ruth still signs first.").
4. **The building is a corner shop in every family.** The bar and restaurant draws (The Rusty
   Anchor, Casa Lupita, Mama Chen's Kitchen) get cereal shelves, aisles, cans, "the shop" and a
   counter opened at dawn.

The endings also lean on one move. Seven of twenty closing beats turn on "nobody" ("Nobody had
known", "Nobody had counted it", "Nobody had thought to tell her", "the slip nobody signed",
"the parcel nobody signed for", "a hand nobody would recognize", "Nobody could tell him yes").
One of them is the best line in the endings, but seven of them make it a habit.

## 1. Scope

```
Review scope
- Calls: hostage_crisis "One Last Signature" (src/content/call-trees/hostage-signature.ts)
- Situations and pacings: s1, s2, s3; ordinary
- Seeds and buildings: none drawn; bound export from check-strings (longest names, he, she, they); families market_row, corner_store_flat_g2, bar_restaurant_g2 read against src/gen/building/procedural/families/bar_restaurant.ts and corner_store_flat.ts
- Officer text: none
- Content version: v13
- Revision read: ddafbad "Rewrite One Last Signature in the depth register". Mid-review, another session edited offer.take_courier.favorable[0] in the working tree ('drags a second stool closer to where {owner.first} is standing. {taker.He} doesn’t sit on it. {taker.He} just moves it there, close enough to touch.') and recaptured fingerprints. Findings are against ddafbad; F9 still holds on the edit, and strongest line 3 no longer exists in the working tree
- Compiled fingerprints: will need a deliberate recapture; every fix changes compiled hostage_crisis keys
- Reachable paths: static walk by hand on the paths into each ending, the group cascade, promptIf order (first match wins)
- Records received: previous reviews docs/calls/hostage-depth-review.md; no separate prose record for the register rewrite
- Reader: separate (did not draft); cold read not cold, source read first
```

## 2. Read surface

Exported text and source only. I didn't run the lab or the game in a browser, so these surfaces
went unseen: the cold open's placement and length on a 390px screen (row 0a says it is read
once), the Who they are block, the pull and cost lines under the expanded choice card, the
transcript block beside the prompt, and the epilogue block. With prompts near 50 words and
summaries near 60, the clamp and tap-to-expand behavior is the main residual risk.

## 3. Engine gates

- `bun scripts/check-strings.ts hostage_crisis`: exit 0, 951 strings per cast. Advisories:
  over-target offer.prompt (55 words, target 50) and out_back_door.prompt (52); 51 unique
  sentences over 22 words (max 34, his_door.favorable[0] and call_now.favorable[0]); sentence
  variation 0.53 FLAT, mean 10.4; result tense present 178, past 21; 22 unique tense-mix rows
  (most are reported past, clear); feeling 'frightened' x2 and 'calm'; engine-word 'roll' (a
  roll of quarters, clear) and 'leaning'; word-choice 'flat' x3 (hands flat, a flat voice, clear);
  `may` twice in resolve summaries (limit 1); 26 rule-of-three lists; opener share by name 39% in
  the they cast; 324 it-check rows; 2,980 path-repeat rows (door 42, handgun 36, counter 36).
- `npx vitest run src/gen/incident/trees-v13/call-trees.test.ts`: exit 0, "Test Files 1 passed
  (1), Tests 76 passed (76)", 21.4 s.
- written-voice checker and the cliche runner: not run in this pass. Tells were read by eye.
- `npm run verify`: not run (review scope; required before ship).

## 4. Cold read

```
Cold read hostage_crisis, all situations
- Who: the courier; a fired worker with a handgun; the owner
- Wants: the courier to leave; the worker a page clearing him
- Worse if they wait: the courier is late and inside; the owner sits with the one person who blames her
- At risk: everyone inside, a handgun named
- Would act on: walk the courier out
- Gap that pulls: did he take the money
```

The card is unchanged and still works. The cold open now closes the "why a signature" gap
before stage 1, which is what pretext should do (D10 pass). Restatement: the courier's "eleven
stops left" appears in the cold open and again in the profile (N1).

## 5. Pretext and depth by stage

| Stage | Pretext | Depth | Read |
|---|---|---|---|
| Cold open | yes | a scene with a before (the count out loud, the coffee, the sign flipped) | pass; the floorboard is planted and never paid (N1) |
| Who they are | yes | taker and owner have pasts; the courier has a schedule, not a life | pass, courier thin |
| 1 offer | yes | "One of them is a stranger. The other is the reason he came back." | strong |
| 2 out_back_door, out_six_years | yes | the handle that turns, "Six years, he kept saying" | strong |
| 2 out_keys | thin | the prompt is a logistics report ending on a garbled portent | weak (F13) |
| 2 both_inside, his_side, one_door | yes | the legal pad, "I counted that drawer twice", "Everything." | good |
| 3 talking | yes in the variants, filler in the base prompt | owner_admits and camera_said variants carry the reframe | mixed (F7, F13) |
| 3 standoff, threat | base prompts end on portents | threat's "eyes on his face, not the handgun" is good | mixed (F13) |
| 3 results | depth falls off | many one-liners, group paths thinnest | weak (F19) |
| Endings | yes | longer, with details, some false on paths | see section 8 |

## 6. Strongest and weakest lines

Strongest:

1. "As they go, {taker.first} asks them to take {owner.his} coat." (owner_down.medic_door.favorable[0]).
   Planted by the coat on the stool and the coat left behind; tenderness from the man with the handgun.
2. "{taker.He} sets the handgun next to the register, carefully, the way a person puts down something
   that belongs to someone else" (threat.talk_down.favorable[0]).
3. "{taker.He} doesn't make {owner.him} sit. {taker.He} just moves it closer." (offer.take_courier.favorable[0] at ddafbad; the working tree has since replaced it with a second stool, 'close enough to touch', which is weaker).
4. "Ask me anything but who." / "Then I know who." (talking.owner_speaker.favorable[2], s2).
5. "One of them is a stranger. The other is the reason {taker.first} came back." (offer.prompt).

Also landing: "I gave you a week's pay so you could leave with something.", "the way someone tests a
lock they already know is open", "Eleven deliveries left, every one of them late.", "The till
drawer was still open when they carried her out. Nobody had counted it."

Weakest:

1. "Nothing is moving, and that is its own kind of danger." (standoff.prompt). Stock portent.
2. "Some stories end differently when someone finally lets them finish." (talking.last_day.summary). Purple maxim.
3. "The camera above the door has a red light on it that nobody noticed before, and now nobody in
   the shop can stop noticing it." (talking.promptIf[2]). Overwritten, and "nobody noticed before" is invented.
4. "Whoever opens it next, it will be {taker.first} who decides." (out_keys.prompt). Garbled syntax doing a portent's job.
5. "Two people for the price of one conversation." (offer.ask_both.summary). Slogan.

Runners-up: "Nobody gets hurt in the next hour by your hand." (standoff.pull_back.summary), "What happens
in the next minute depends on who says what, and how." (threat.prompt), "Most people who fire once
are as frightened by it as anyone." (fired_on.hold_corner.summary).

## 7. Choices, pull and cost

Every stage has at least two options a player could argue for on values. The pull and cost lines
mostly sharpen the dilemma, and the best pairs name a person on both sides ("A sure life, right
now" / "{owner.first} stays with the grievance"). Where they fail:

- his_side under the `terms` mark: the prompt says the price "is one you can pay", and write_now's
  favorable band frees both people. The prompt picks the option for the player (F15).
- standoff.pull_back: the pull "Nothing you do can make this worse tonight." is false in s2, where
  the owner collapses on that path, and the summary says the call is handed off when every result
  keeps the team on the corner (B4).
- talking.his_pace in s1 and s3: the patient hold never escalates, and its cost ("Every hour of it
  is spent by {owner.first}") lands only in s2. That is the wait test working as intended, since
  waiting preserves life, so this is not a finding.
- Pull lines that describe the taker's want instead of the player's: read_back.pull "Being taken
  seriously, at last, by people who wrote it all down." Generic: his_pace.pull "Time on your side,
  and nothing forced.", out_front.pull "Simple instructions, in plain view." (N7).
- Group calls still have no temptation; say_she_signs is LONE only (F20, carried from F5).

## 8. Honesty: the endings' new details, path by path

| Detail | Paths that reach it | Holds | Finding |
|---|---|---|---|
| everyone_out "came out last" | take_account LETS_GO, talk_down, out_front; in group calls the cascade `all` brings the coworkers out after him | false in group | B2 |
| everyone_out "palms forward as instructed" | take_account ("the way they tell him to"), talk_down ("on the team's word"), out_front favorable and mixed | holds | clear |
| everyone_out "Nobody had known there was a cat" | all | the owner has run the place 22 years and "hasn't missed a day" | F1 |
| everyone_out.epilogueIf owner_admits "called him on Monday" | s1 | implies he was reachable at home on Monday (custody, O4) | F2 |
| entry_clean "the handgun in an evidence bag" | threat.go_in, fired_on.go_in favorable | true on both, but the one procedural flourish in the endings, and it implies a case | N2 |
| last_one "the same gray blanket" / out_by_dawn "wrapped in blankets" | every way into last_one | one blanket shared by two strangers, then plural; image spent twice on one path | F17 |
| taker_held "alone in the shop now" | last_one out_front, out_back, let_him_sit adverse; last_one's GROUP_IN variant shows coworkers still beside him | false in group | B3 |
| owner_beaten "a hand nobody would recognize" and epilogue "too hard to write it" | step_back adverse KEEPS (s3): "has signed" | the page is in his pocket inside, so nobody outside has seen the hand; the epilogue reads as if she didn't sign | F3 |
| held_both "the van at the curb has run out of gas" | pull_back, stay_on, into_night, read_back, step_back, hold_corner heldEnd | false on short holds | F4 |
| held_inside "the phone inside rings out every half hour" | stay_on favorable KEEPS ("doesn't hang up") and mixed ("keeps the line open") | false on stay_on paths | F5 |
| went_in_for_owner epilogue "asked the nurse whether he was hurt" | owner_down.go_in, after a heart collapse | implies she recovered enough to ask | F6 |
| owner_killed_taker_hurt epilogue "said her name for the first time all day" | s3 only | narration reports him naming her (ask_both KEEPS, alley_talk KEEPS, take_account KEEPS) | F8 |
| went_in_taker_hurt title "Carried out, both of them" | owner_down.go_in adverse, force hurt | he is "on the shop floor" with a medic, and the epilogue has him watching the ambulance doors from there | N3 |
| talking.prompt "hasn't left her stool in an hour" | take_courier then call_now reaches talking a few minutes in | false on fast paths | F7 |
| take_courier.summary "goes home tonight" | adverse band orders him back; held_both keeps him inside | false on some paths | B1 |

Clear: owner_killed (weight on the courier, E2.2), owner_collapsed (no recovery invented, medic
working, E4.5 not involved since she is not the E4 subject), entry_hurt, out_the_back, stayers_held,
group_out, held_both_down, owner_left_down. E11.1 directed walk-outs hold on out_front,
take_account, talk_down, let_him_sit favorable and the group call-outs. E12 concessions name
command (write_now, offer_record, back_deal). E12.6: say_she_signs says plainly that command can't
promise it and the owner hasn't agreed, and its break is cued in talking.promptIf[0]. E4: the
negotiator asks the direct question on withdrawn, and stay_on answers it. E7: owner_beaten names no
anatomy.

## 9. Props against the three families

The place binds to names such as The Rusty Anchor, Mulligan's Tavern, Casa Lupita, Dino's Pizzeria
and Mama Chen's Kitchen in bar_restaurant_g2, whose main room is "Bar and dining" with a kitchen
behind it.

| Prop | Fields | Market row | Corner store | Bar or restaurant |
|---|---|---|---|---|
| cereal shelves | both_inside.team_glass.mixed[0] | fits | fits | fails |
| aisles | both_inside.wait_silence.favorable[0], .adverse quiet | fits | fits | fails |
| cans scatter | out_keys.ask_unlock.adverse threat | fits | fits | weak |
| opened every morning, opening up at dawn | coldOpen, offer.hear_him.favorable[0], out_six_years.exchange[2], last_one.prompt | fits | fits | fails for a tavern, weak for a diner |
| "the shop" as the place noun | about 28 strings, including endings and the camera, radio, apron, name tag | fits | fits | fails |
| till, register, counter, stool, drinks cooler, legal pad, safe, camera, ledger, regulars who pay on Fridays, little bell | many | fits | fits | fits |
| steel back door and alley | out_back_door, alley_talk, out_back | delivery lane | backChance 0.95 | backChance 0.95 |

## 10. Depth gates

| Gate | Result | Evidence |
|---|---|---|
| D1 Private logic | pass | Taker: want (a page), wound (the count in front of the regulars), self-lie ("Six years and not one cent", "It was going back Friday"), need ("You could have started with sorry."). Owner: precise, per-situation self-lie ("I was going to call you", "I gave you a week's pay"). Courier: "Who does that?" gives him a point of view; still no stake past the van |
| D2 Reframe | pass | owner_voice and owner_speaker turn "Ask her. She knows." three ways, and talking.promptIf carries it into stage 3 |
| D3 Escalation palette | pass | noise (pallet), withdrawal (flat voice, slumped), barricade (shelf), call from home (phone face down), crowd (phone at the tape), coworker order, bargaining (one more line, "Paper isn't a signature"), the lie, shame (pity), surprise (the bell), trap. One mechanism at most twice per path walked |
| D4 Blind voice | pass within the call | taker, owner, courier, negotiator and radio are distinct with names stripped; cross-call mix not run |
| D5 Argument | pass | values cases at every stage; out_keys is argued on minutes more than values |
| D6 Temptation | pass in lone calls, fail in group | say_she_signs's cost now lands on take_account, owner_speaker, ask_owner, his_pace and own_up. Group calls have none (F20) |
| D7 The line | owner pick pending | candidates: "As they go, {taker.first} asks them to take {owner.his} coat."; "Ask me anything but who." / "Then I know who."; "He asked if I wanted a coffee for the road. Who does that?" (the sample's own line) |
| D8 The after | fail, fix before ship | 7 of 20 closing beats share the "nobody" move (F11); 2 endings false in group (B2, B3); 1 implied release (F2); 1 implied recovery (F6); 1 contradiction (F3); 2 time claims false on short paths (F4, F5) |
| D9 Replay | pass | owner_speaker now sits on the common stage 3 path, so s1 and s3 read as different men when the player puts the owner on |
| D10 Pretext | pass | the cold open is a scene with a before; the profiles give taker and owner pasts by stage 1; the courier's past is a schedule (N1) |

## 11. Findings

### Block

```
[block] B1 hostage_crisis, all situations | offer.take_courier.summary | sees '{courier.first} goes home tonight.' while the adverse band orders him back to the boxes and held_both ends with him still inside | rule H10, swat-call-prose rule 3 (a summary never states the favorable outcome) | fix as data '{lead} tells {taker.first} the courier is leaving and asks for nothing else. {owner.first} stays behind the counter with the one person in the building who blames {owner.him}, and {taker.first} learns you take what you are given.' | route swat-call-prose
[block] B2 hostage_crisis, group calls | endings.everyone_out.summary | sees '{taker.first} came out last, palms forward as instructed' when the cascade brings the coworkers out after him | rule H10 | fix as data '{courier.first} and {owner.first} are safe outside, and {owner.first} was out before {taker.first} was. {taker.first} came out palms forward, the way the team told {taker.him}, and asked the nearest officer if someone could feed the cat in the back room. {owner.first} hadn’t known there was a cat.' | route swat-call-prose
[block] B3 hostage_crisis, group calls | endings.taker_held.summary | sees 'alone in the shop now' after last_one's GROUP_IN variant shows '{others} is still beside {taker.first}' | rule H10, H9 | fix as data '{courier.first} and {owner.first} are out of harm’s way. {taker.first} is holding out behind the counter with the handgun, and patrol keeps the street shut. The lights inside are still on.' | route swat-call-prose
[block] B4 hostage_crisis, all, s2 worst | standoff.pull_back.summary, .pull, .preview.favorable | sees 'hands the scene to the night watch, and the call ends there for you' and 'Nothing you do can make this worse tonight.' while every result keeps the team on the corner (held_inside: 'with the team at the perimeter') and the s2 branch writes 'Then {owner.first} folds over behind the till' under a favorable preview of 'You hold the corner, and {owner.first} remains inside.' | rule E11 (no handoff of a live armed scene), preview softer than worst result | fix as data summary 'Your squad falls back to the corner and holds the block. Nobody pushes {taker.first} tonight, and nobody gets {owner.first} out either.' pull 'Nobody forces anything, and nobody walks into a doorway.' preview.favorable 'You hold the corner. {owner.first} stays inside, and if {owner.he} {owner~is|are} unwell, nobody can reach {owner.him}.' | route swat-call-prose
```

### Fix before ship

```
[fix before ship] F1 hostage_crisis, all | endings.everyone_out.summary | sees 'Nobody had known there was a cat.' of a back room whose owner 'hasn’t missed a day' in 22 years | rule H10 (plausible on every path), consistency | fix as data '{owner.first} hadn’t known there was a cat.' (it turns the line toward the owner and keeps the epilogue's cat) | route swat-call-prose
[fix before ship] F2 hostage_crisis, s1 | endings.everyone_out.epilogueIf[0] | sees '{owner.first} called {taker.first} on Monday.' after the team has him, which implies he was home to call | rule E11.2, H1, O4 | fix as data '{owner.first} called {taker.first}’s cousin on Monday. It took {owner.him} two tries to start.' (pays off the profile's emergency contact) | route swat-call-prose, owner for O4
[fix before ship] F3 hostage_crisis, s3 | endings.owner_beaten.summary and .epilogue | sees 'in a hand nobody would recognize' while the page is folded in his pocket inside, and 'Her hand had shaken too hard to write it.' after step_back says she signed | rule H10, E11.2 | fix as data summary 'Medics have {owner.first}, hurt. {owner.His} name is on the page folded in {taker.first}’s shirt pocket. {courier.first} is safe. {taker.first} hasn’t come out.' epilogue '{owner.first} asked the medic for a pen, to see whether {owner.he} could still write {owner.his} own name.' | route swat-call-prose
[fix before ship] F4 hostage_crisis, courier inside | endings.held_both.summary | sees 'the van at the curb has run out of gas' on holds that end within the hour | rule H10 | fix as data 'Patrol has the block sealed. {courier.first} and {owner.first} are both still in there with {taker.first}, who is armed, and {courier.first}’s van is still idling at the curb.' | route swat-call-prose
[fix before ship] F5 hostage_crisis, stay_on paths | endings.held_inside.summary, .remainingTasks[0] | sees 'the phone inside rings out every half hour' after stay_on 'doesn’t hang up' and 'keeps the line open', and 'Get {owner.first} off the shop floor' when the owner is on the stool | rule H10, H8 | fix as data summary 'Command holds the street, with the team at the perimeter. {owner.first} is still inside with {taker.first} and the handgun, and the team calls the counter every half hour.' task 'Get {owner.first} out from behind the counter' | route swat-call-prose
[fix before ship] F6 hostage_crisis, s2 | endings.went_in_for_owner.epilogue | sees '{owner.first} asked the nurse whether {taker.first} was hurt.' after a heart collapse, which implies a recovery | rule E11.2, H2 | fix as data '{courier.first} drove the rest of the route that night and couldn’t remember a single stop.' | route swat-call-prose
[fix before ship] F7 hostage_crisis, fast paths | talking.prompt | sees '{owner.first} hasn’t left {owner.his} stool in an hour' when take_courier then call_now reaches talking minutes in, and the closer 'Whatever happens next will happen at that counter.' | rule H10, swat-call-prose rule 4 | fix as data 'The negotiator still has the line open, and {taker.first} has stopped pacing. {owner.first} hasn’t left {owner.his} stool since this started and keeps both hands flat on the counter, where {taker.first} can see them.' | route swat-call-prose
[fix before ship] F8 hostage_crisis, s3 | endings.owner_killed_taker_hurt.epilogue against offer.ask_both.favorable[1], talking.alley_talk.favorable[2], talking.take_account.favorable[2] | sees 'said {owner.first}’s name for the first time all day' after narration reports him naming her ('Only a statement with {owner.first}’s name under it will do, {taker.first} says.') | rule H10, D1 marker | fix as data in the reported lines 'Only a statement with {owner.his} name under it will do, {taker.first} says.' and '{taker.he} {taker~says|say} {owner.he} still {owner~owes|owe} a signature' and 'it changes nothing until {owner.he} {owner~signs|sign} it' | route swat-call-prose
[fix before ship] F9 hostage_crisis, all | offer.take_courier.favorable[0] against offer.prompt and .preview.favorable | sees 'drags the stool closer to where {owner.first} is standing' after 'on a stool at the till' and 'left on the stool' | rule consistency, H11 (still true on the working-tree edit, which keeps 'where {owner.first} is standing') | fix as data 'Inside, {taker.first} pulls the blinds halfway and drags {owner.first}’s stool closer to the register, with {owner.first} still on it. {taker.He} {taker~doesn’t|don’t} make {owner.him} move. {taker.He} just {taker~moves|move} it closer.' | route swat-call-prose
[fix before ship] F10 hostage_crisis, all | offer.take_courier.preview.mixed | sees '{taker.first} hangs up on you.' while the result keeps the receiver 'off the hook' and the team hears the owner | rule preview false | fix as data '{courier.first} gets clear, and {taker.first} slams the phone down on the counter.' | route swat-call-prose
[fix before ship] F11 hostage_crisis | endings everyone_out, owner_collapsed, went_in_for_owner, owner_killed, went_in_taker_hurt, stayers_held, owner_beaten | sees seven closing beats built on 'nobody' | rule D8, batch repeats | fix as data keep owner_collapsed 'Nobody had counted it.' and F1's everyone_out line; owner_killed 'with the delivery slip still blank'; went_in_taker_hurt 'still holding the parcel'; stayers_held '{taker.first} kept asking an officer whether the others were out yet.'; F3 and F6 cover owner_beaten and went_in_for_owner | route swat-call-prose
[fix before ship] F12 hostage_crisis, all | summaries of offer.ask_both, offer.hear_him, both_inside.wait_silence, both_inside.team_glass, talking.alley_talk, talking.his_pace, talking.last_day, talking.his_door, standoff.into_night, standoff.read_back, standoff.stay_on, fired_on.hold_corner | sees a narrator maxim in each ('Time makes most people tired before it makes them dangerous.', 'People say things to a face they never say to a phone.', 'Some stories end differently when someone finally lets them finish.', 'Long nights end most of these.', 'Sometimes that is enough.', 'It is what you do when someone says nothing matters.') | rule swat-call-prose section 5 (never a slogan), rubric 6 | fix as data cut the maxim sentence in each; where the summary then lacks a cost, use the existing cost line's person (for last_day 'Ask {taker.first} to tell it start to finish, all of it. {owner.first} has to hear it all again, three feet away.') | route swat-call-prose
[fix before ship] F13 hostage_crisis, all | standoff.prompt, threat.prompt, talking.prompt, out_keys.prompt | sees 'Nothing is moving, and that is its own kind of danger.', 'What happens in the next minute depends on who says what, and how.', 'Whatever happens next will happen at that counter.', 'Whoever opens it next, it will be {taker.first} who decides.' | rule G10 stock urgency, swat-call-prose rule 4 | fix as data standoff '…has stopped answering questions with anything but questions. The coat hasn’t moved either.'; threat end on '…not the handgun.'; out_keys 'The front door is locked from inside now, and the only key to it is in {taker.first}’s shirt pocket.' | route swat-call-prose
[fix before ship] F14 hostage_crisis, all | fired_on.hold_corner.summary | sees 'Most people who fire once are as frightened by it as anyone.' | rule rubric 4 (a claim the player learns as true), feeling word | fix as data 'You pull everyone back behind cover, count heads, and call {place} again. {owner.first} stays inside with someone who has just fired, while you find out why.' | route swat-call-prose
[fix before ship] F15 hostage_crisis, terms | his_side.promptIf[0] | sees 'That is the price {taker.first} named, and it is one you can pay.' beside write_now, whose favorable band frees both | rule fake-choice 8, test tone | fix as data 'A written account would buy {owner.first}’s way out. That is the price {taker.first} named. {courier.first} is waiting near the boxes, and the legal pad is on the counter between everyone.' | route swat-call-prose
[fix before ship] F16 hostage_crisis, bar_restaurant_g2 | both_inside.team_glass.mixed[0], both_inside.wait_silence.favorable[0] and adverse quiet, out_keys.ask_unlock.adverse threat, coldOpen, offer.hear_him.favorable[0], out_six_years.exchange[2], last_one.prompt, about 28 'the shop' strings | sees 'behind the cereal shelves', 'pacing the aisles', 'Cans scatter', 'opened {place} every morning', 'opening up at dawn', 'the shop' in a tavern or a pizzeria | rule consistency (pipeline item 3, props fit every family) | fix as data 'behind the back shelves', 'pacing behind the counter', 'Whatever was on the shelf scatters across the tiles', 'opened {place} every day for six years', 'six years of opening up', and '{place}' or 'the place' for 'the shop' | route swat-call-prose
[fix before ship] F17 hostage_crisis, every way into last_one | last_one.prompt, endings.out_by_dawn.summary | sees 'wrapped in the same gray blanket from the medic' then 'wrapped in blankets on the back step of the ambulance' | rule path echo, image spent twice | fix as data last_one '{courier.first} and {owner.first} are outside with patrol, each in a gray blanket from the medic.'; out_by_dawn '…have been outside for hours, on the back step of the ambulance.' | route swat-call-prose
[fix before ship] F18 hostage_crisis, all | standoff.stay_on.favorable[0] | sees a result opening 'Sunday dinners, a cousin, a dog that died.' | rule E17 (a result opens with a subject and a verb) | fix as data '{taker.first} talks about Sunday dinners, a cousin, a dog that died. Then {taker.he} {taker~asks|ask} whether the medic out front is for {taker.him} too, and lets {owner.first} go.' | route swat-call-prose
[fix before ship] F19 hostage_crisis, stage 3 and group | talking.ask_owner.mixed[2], talking.back_deal.favorable[2] and mixed[2], talking.others_walk_owner.*, stayed_behind.*, nobody_followed.*, threat.go_in.favorable[0] | sees 'Nobody gets released on demand.', 'The alley suits {taker.first}, but {owner.first} still signs first.', 'A few hours on, the remaining ones walk out, hands empty.' | rule budget result (a beat: the act, the reaction, what changed) | fix as data for ask_owner '{taker.first} says {owner.first} isn’t going anywhere because somebody on a phone said so. {owner.first} sits back down and folds {owner.his} hands on the counter.' and the same shape for the rest | route swat-call-prose
[fix before ship] F20 hostage_crisis, group calls (carried F5) | one_door.choices | sees no lie, unapproved promise or tempting shortcut in any group draw | rule D6 | fix as data a group temptation, for example telling the coworkers {taker.first} will be fine if they walk, which command can't promise | route swat-call-design
[fix before ship] F21 hostage_crisis, all | 51 sentences over 22 words (his_door.favorable[0] and call_now.favorable[0] at 34, courier_first.favorable[0] at 33) | sees the register's length carried by sentence length | rule rubric 6 (none over 22) | fix as data split at the existing commas, e.g. call_now '{taker.first} answers on the second ring. Before the negotiator can say a word, {taker.he} {taker~asks|ask} if {courier.first} is all right. There is a cake in that parcel for somebody’s birthday.' | route swat-call-prose
```

### Note

```
[note] N1 hostage_crisis | coldOpen, roles[courier].profile | sees 'eleven stops left' in both, and the floorboard that groans planted and never paid; the courier's past is a schedule | rule restatement, D10 | fix as data a courier profile line with a stake ('{courier.first} took the route after the warehouse cut nights. {courier.He} {courier~has|have} a daughter who waits up.') and a floorboard payoff in quiet_exit ('the board behind the counter groans once') | route swat-call-prose
[note] N2 hostage_crisis | endings.entry_clean.summary | sees 'the handgun in an evidence bag' | rule E11 (implied process), O4 | fix as data 'the handgun out of reach on the counter' | route swat-call-prose, owner for O4
[note] N3 hostage_crisis | endings.went_in_taker_hurt.title and .epilogue, endings.went_in_for_owner.summary | sees 'Carried out, both of them' while he is on the shop floor, and two sibling endings in which someone watches an ambulance leave | rule H7, image repeat | fix as data title 'Both of them hurt'; epilogue '{taker.first} asked the medic twice whether {owner.first} was breathing.' | route swat-call-prose
[note] N4 hostage_crisis, owner_down.go_in.mixed | endings.went_in_for_owner | sees an officer's twisted knee left out of the ending | rule H9 | fix as data add 'One officer is limping.' | route swat-call-prose
[note] N5 hostage_crisis | endings.went_in_taker_hurt.summary | sees 'still holding the parcel nobody signed for' on paths where the courier set the parcel down inside and left by a courierToo line that never mentions it | rule H10 | fix as data 'still holding the delivery slip' | route swat-call-prose
[note] N6 hostage_crisis, lie path | talking.own_up.favorable[0] | sees 'only the ballgame on the line' where the ballgame was never planted on that path | rule continuity | fix as data 'only the drinks cooler on the line' | route swat-call-prose
[note] N7 hostage_crisis | standoff.read_back.pull, talking.his_pace.pull, last_one.out_front.pull | sees the taker's want written as the player's pull, and two generic pulls | rule budget pull | fix as data read_back 'Let {taker.first} hear it in someone else’s voice.' | route swat-call-prose
[note] N8 hostage_crisis | talking.his_door.favorable[0] | sees 'the way {taker.he} must have held it for a thousand customers' (narrator inference) | rule swat-call-prose rule 3 | fix as data 'the way {taker.he} held it for customers for six years' | route swat-call-prose
[note] N9 hostage_crisis | owner_down.go_in.summary, standoff.into_night.summary | sees 'armed and frightened', 'the same calm voice' | rule feeling words | fix as data 'armed, and shouting for help' / 'the same voice' | route swat-call-prose
[note] N10 hostage_crisis | endings.out_by_dawn.summary | sees 'have been outside for hours' when let_him_sit's favorable band can land 45 minutes after the owner walked out | rule H10 (span 'All night' covers it if the UI shows the span) | fix as data none if the span label shows; else 'have been outside since dark' | route swat-call-prose
[note] N11 hostage_crisis, bar and corner draws | out_back_door, alley_talk, out_back | sees a steel back door assumed in every draw, while backChance is 0.95 | rule consistency | fix as request 'a family or building condition on the courier_out turn so out_back_door draws only where a rear door exists' | route engineering
[note] N12 all calls | scripts/check-strings.ts | sees each call checked alone, with no machine check for a sentence repeated across calls | rule standing lint gap | fix as request 'run the string checker with --min-repeat over every call at once' | route engineering
```

## 12. Verdict

```
Verdict hostage_crisis "One Last Signature" v13, depth register | edit | block 4 | fix before ship 21 | note 12 | fingerprints recapture yes
```

Order for the notes session: B1 to B4 (one string each), then F1 to F8 (the endings and
prompts that lie on a path), then F12 and F13 (cutting the maxims and portents is one pass and
the biggest audible gain), then F16 (props), then F19 and F21 (stage 3 depth and sentence
length). F20 goes to swat-call-design.

## 13. Review record

```
Writing review record
- Scope: answered | hostage_crisis s1 to s3, ordinary, bound export (3 casts) plus source, v13, static walk on every ending's paths and the group cascade
- Reader: answered | separate; cold read not cold (source read first)
- Read surface: answered | exported text because no browser session; unseen cold open, Who they are, pull and cost under the expanded card, transcript block, epilogue block at 390px
- Cold read: answered | 1 card, blanks none, restated facts 1 (N1)
- Path and choice read: answered | static walk, dead ends 0, cheaper reveals not re-run
- Choice table: answered | claims 3 checked, 2 falsified (B4 pull, F15); dominated 0 outside the terms state; untraced adverse 0 found
- Table read: answered | transcript lines read aloud by speaker; voice breaks 0 new; stock lines 0 new
- Spoilers and honesty: answered | leaks 0 new, previews false 2 (B4, F10), endings false on a path 6 (B2, B3, F3, F4, F5, F7 prompt), implied outcomes 2 (F2, F6), physical contradictions 1 (F9)
- Ethics: answered | E11 (B4), E11.2 (F2, F3, F6), E11.1 clear, E12 clear, E12.6 clear, E4 clear, E7 clear, E16 clear; tally not run (no generation harness in this pass)
- Officer read: not applicable
- Batch audit: not applicable, single call; repeated closing frame counted by hand (F11)
- Engine gates: answered | bun scripts/check-strings.ts hostage_crisis exit 0, 951 strings; npx vitest run src/gen/incident/trees-v13/call-trees.test.ts exit 0, 76 passed; npm run verify not run
- Engine dry-run: not applicable, built and loaded by tests
- Depth: answered | D1 pass, D2 pass, D3 pass (11 mechanisms, max 2 per path walked), D4 pass in call, D5 pass, D6 pass lone / fail group, D7 owner pick pending, D8 fail, D9 pass, D10 pass
- Tells checked: not run | written-voice checker not run in this pass; tells read by eye
- Findings: 4 block, 21 fix before ship, 12 note, routed to swat-call-prose, swat-call-design, engineering, owner
- Owner decisions surfaced: O4 (F2, N2), D7 pick
- Verdicts: approve 0, edit 1, reject 0
```
