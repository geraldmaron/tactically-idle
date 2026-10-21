# Writing review: One Last Signature, depth rebuild (hostage_crisis)

Reviewed through swat-writing-review 0.3.0 (section 8a and rubric section 9, the depth gates) on
2026-10-19 by a separate reader who did not write the call. The review edits nothing. Every fix
below is data for the owning skill or a written request for engineering.

**Verdict: edit.** 3 block, 20 fix before ship, 15 note. No reject condition holds: D1, D2, D3
and D5 pass, so the call does not go back to swat-call-design whole. Every block has a one-string
data fix.

The rebuild works where it lands. The taker now has a voice ("Everything.", "I'd have had it back
by Friday."), the owner has one ("I counted that drawer twice.", "Look at me."), the courier saves
face in five words ("I didn't run. I walked fast."), and the three reframes of "Ask her. She
knows." are real: the same line means she knows I'm innocent and hid it (s1), she knows I'm
innocent and is protecting her kid (s2), and she knows I did it (s3). The lie is written to
pattern 15, and the negotiator's mirrored "Today." inside it is the most chilling beat in the
call.

It is not yet the call the owner asked for, for four reasons:

1. **Most players never meet the reframe.** It sits behind one stage 2 choice (his_side.owner_voice,
   favorable band) on a node that the most tempting stage 1 option never reaches, plus one s3
   door behind ask_courier. On the common path (walk the courier out, then the keys, then talk),
   s1 and s3 still read as the same man with different dice (D9).
2. **Stage 3 forgets the call's biggest moment.** After the owner says it on the speaker, the next
   prompt is "The negotiator still has the line open" with "You writing this down?" / "Every word.
   Go on." Nothing in talking or standoff reads owner_admits or the s3 confession.
3. **The lie is cheap.** Two of its three foundOut breaks are unreachable on any path that told it,
   and ask_owner, his_pace and every standoff option forget it. Group calls (45% of draws) have
   no temptation at all (D6).
4. **The after is uneven.** Four epilogues are among the best lines in the game. Others are false
   on their path, imply a recovery, carry no named person, or stop at status, and seven of twenty
   share one frame (a person asks or tells a responder something) (D8).

## 1. Scope

```
Review scope
- Calls: hostage_crisis "One Last Signature" (src/content/call-trees/hostage-signature.ts, template src/content/incidents/hostage.ts)
- Situations and pacings: s1, s2, s3; ordinary (the cast has no deliberate_answers member set by this call)
- Seeds and buildings: none drawn; strings exported through callStringRows at group size 0, bound Desmond (taker), Ruth (owner), Pavel (courier), Okafor (lead); group strings read in the source
- Officer text: none
- Content version: v13 (unchanged by this rebuild)
- Revision read: commit aac9c78 "Rebuild One Last Signature to the depth rules", plus an uncommitted working-tree edit seen mid-review (owner_voice s1 and s2 no longer reveal took_it). Findings hold on both.
- Compiled fingerprints: will need a deliberate recapture; every fix below changes the compiled hostage_crisis keys
- Reachable paths: static walk by hand on the marks that gate the new choices (lied_sign, knows_story, door_open, owner_admits, owner_heard); no explorer run
- Records received: design record docs/calls/hostage-signature-design.md "Depth redesign (2026-10-19)"; prose record not separate for the rebuild; officer none
- Reader: separate (did not draft); the cold read was not cold, because I read the source first
```

## 2. Read surface

Exported text only. I could not run the game or the lab in a browser in this session, so the
read is the bound string export plus the source. Unseen surfaces, each a residual risk:

- The transcript block as rendered (speaker name beside each line, order against the prompt, wrap
  at 390px).
- The epilogue block "after the ending summary, set apart" (surface-budgets row 26a).
- Which promptIf wins when several match (I read compile.ts: first match in array order, and a
  promptIf without its own `exchange` inherits the node's).
- The fact panel: whether unknown facts show their `claim` before a reveal (relevant to N6).
- People chips: whether s2 and s3's volatile or hostile taker shows before the check (carried
  B9).
- The debrief score lines for the lie (F20).

## 3. Engine gates

- `bun scripts/check-strings.ts hostage_crisis`: exit 0. Advisories: over-target
  owner_down.promptIf[0] (19 words, house target 18), tense-call (181 present, 21 past results),
  tense-mix fired_on.hold_corner.mixed[2] and s2 his_side.owner_voice.favorable[1], word-choice
  'flat' in both_inside.wait_silence.adverse[0], 23 it-check rows, path-repeat rows on offer.
- `npx vitest run src/gen/incident/trees-v13/call-trees.test.ts src/gen/incident/trees-v13/coverage.test.ts src/gen/incident/trees-v13/surfaces.test.ts`:
  exit 0, "Test Files 3 passed (3), Tests 88 passed (88)", 323 s. Rerun against the working-tree edit
  (owner_voice reveals): exit 0, 3 files, 88 passed, 327 s.
- written-voice `voice-check.py` on the 658 unique bound strings: no stock phrases, no filler
  adverbs, 0 dashes; one "banned tic" hit, `unlock`, which is a literal door and is clear.
- Pattern runner (cliche-and-copaganda.md) on the export: G15 x9 (all read; none is an inversion
  dodging a name opener, clear), G11 x3 (two are "released" about the owner and courier, clear;
  one is out_front.mixed "to the car", F16), G16 x2 (back_deal.mixed "set it down", antecedent
  "the handgun" in the same string, clear). The runner's C6 misses "snaps" (F9).
- `npm run verify`: not run (review scope; required before ship).

## 4. Cold read

```
Cold read hostage_crisis, all situations
- Who: Pavel, a courier; a fired worker with a handgun
- Wants: Pavel wants to leave; the worker wants the owner's signature
- Worse if they wait: unclear from the card alone (filled by the dispatch and the s2 known line)
- At risk: "anyone" inside, a handgun named
- Would act on: walk the courier out, because the card is about him
- Gap that pulls: why a signature
```

The card is unchanged and still works. Restatement: the dispatch repeats the card's "won't let
anyone go" with no change (note-level, carried). The first stage prompt's second sentence is
repeated word for word by the first transcript line (F6, fix before ship under the restatement
rule).

## 5. The depth read (D1 to D9)

| Gate | Result | Evidence |
|---|---|---|
| D1 Private logic | pass | Taker: want (a page), wound (the count out loud before the regulars), self-lie ("Six years and not one cent", "I'd have had it back by Friday" in s3), need (met in s1: "You could have started with sorry."). Owner: precise, counts ("I counted that drawer twice."), self-lie per situation ("I was going to call you", "I gave you a week's pay"). Courier: want and fear, plus a face-saving self-lie ("I didn't run. I walked fast."); no wound (N11). Negotiator: open questions and one mirror, no label (N2). The taker breaks his own marker by naming the owner in four lines (F7) |
| D2 Reframe | pass, in the data | s1 changes the till count from an accusation into a mistake she hid; s2 into a deflection that protected her kid; s3 turns "Ask her. She knows." against the taker. s1 and s2 reframe the owner, s3 the taker. The reach problem is scored under D9 |
| D3 Escalation palette | pass | 8 mechanisms tagged by hand on the adverse leads: lost control (about 11), bargaining collapse (about 8), withdrawal (3), crowd (2), partner (3), shame (2), call from home (1), deadline (1, unplanted: N5). Max per path on the paths walked: 2. Not machine-measured. The CALM branch converges on "the line goes dead" (N3) |
| D4 Blind voice | pass within the call | Taker, owner, courier and radio are distinct with names stripped. Cross-call mixing could not run: no other call has transcripts yet (N12) |
| D5 Argument | pass | Values cases at offer (the sure life against abandoning the owner), his_side (the owner's own voice against the courier's exit), one_door (honesty against a life now), talking (his dignity against her hours), threat (whose body is at risk), last_one (his face against the street). out_keys is argued on minutes and odds in the text as written (F17) |
| D6 Temptation | fail, fix before ship | say_she_signs exists, its summary says it is a lie, and the cue is printed. Its cost lands on own_up (which the player volunteers) and on take_account adverse only. last_day and his_door foundOut are unreachable with lied_sign. Group calls have none (F3, F4, F5) |
| D7 The line | owner pick pending | Candidates in section 7 |
| D8 The after | fail, fix before ship | 1 epilogue false on every path (B2), 2 imply a recovery (B3), 5 carry no named person (F11), 3 stop at status, 7 of 20 share one frame (F12), 1 half-false (F13), and every epilogue is blind to the reframe (F19). The best: owner_beaten, held_both, out_by_dawn, taker_held |
| D9 Replay | fail, fix before ship | Same opening, take_courier > out_keys > talking.his_pace, under s1, s2, s3: s2 differs by the heart clock; s1 against s3 differs only in whether he trades. The reframe appears on neither path (F1) |

Reject check: D1, D2, D3 and D5 pass, so the "fails two or more" condition does not hold.

## 6. Transcript read

Every transcript line read aloud in speaker order (27 node lines, 15 result lines, lone export).

Repeats its prompt (F6): offer.exchange[0] against offer.prompt, out_back_door.exchange[0],
out_six_years.exchange[0], both_inside.exchange[0], fired_on.exchange[0], owner_down.exchange[0];
threat.exchange[0] mildly. Radio repeats the prompt in four of its five node lines, which wastes
the surface built to carry a second voice.

Explains motive: his_side.owner_voice.favorable[1].exchange[0] (s2) "If I sign it, I'm saying it
was my kid." states the private logic the narration line above it already gave (F8).
both_inside.free_others.adverse[1] narration "the one {taker} blames for all of it" (N7).

Breaks a voice: the taker names the owner in offer.exchange[0], offer.promptIf[0].exchange[0]
and [2], and talking.promptIf[0].exchange[0], against the design's marker "never says the owner's
name to the negotiator" (F7). Keeping that marker would let one ending pay it off (F11 data for
owner_killed_taker_hurt).

Stock-adjacent: offer.exchange[1] "Okay. Help me understand why Ruth stays." (N1).

Lines that land: "Everything.", "I counted that drawer twice.", "Look at me.", "My van's still
running. I left it running.", "I didn't run. I walked fast.", "Six years, he kept saying. Like it
was printed on a sign.", "Everybody out there is filming.", "Today." (the negotiator, lying).

## 7. D7 candidates, for the owner

1. "You could have started with sorry." (taker, s1, his_side.owner_voice.favorable[0].exchange[1]).
   The need, met and refused in one breath.
2. "I'd have had it back by Friday." (taker, s3, talking.last_day.favorable[2].exchange[0]). The
   self-lie in seven words, after six years of "not one cent".
3. "Turn the speaker off. Turn it off." (taker, s3, his_side.owner_voice.favorable[2].exchange[1]).
   Shame, with an audience of one.

Runner-up: "First true thing anybody's said to me all day." (own_up, s1 and s2). Strong on the lie
path, but close to a line viewers have heard. All three picks sit behind owner_voice or
last_day, which is the D9 reach problem again: today most players will hear none of them.

## 8. Previews against every situation

- talking.last_day.preview.favorable "The whole day comes out" is false in s3, where the result
  says he "stops halfway through the day" (B1).
- his_side.owner_voice.preview.favorable "Ruth comes on the line and tells you how she is" holds
  only through the fact panel in s1 and s3, where the result is a deposit bag or a camera, and
  the s2 and s3 favorable bands provoke the taker (F14).
- New choices checked and clear in every situation: call_now, wait_silence, team_glass,
  spare_key, say_she_signs, own_up, take_account (with foundOut).
- Leaks: pre-check fields read the same across situations in the export. B9 (the s2 heart cue
  and the per-situation taker volatility) closed 2026-10-20 with no change, on these grounds:
  - The volatility and the threat disposition never reach a player surface before the result.
    Volatility lives only in the meters (`src/sim/meters.ts`), and the disposition prints only
    in the debrief. Only the Lab's X-ray shows them, by design.
  - The heart cue is an event the team sees mid-call: the owner getting down off the stool. It
    is information earned by being there, the same as a sighting. It only identifies the
    situation to someone who has replayed the call enough to learn that, which is replay
    knowledge, not a leak.
  - The fix that was proposed, a decoy clock in s1 and s3, would make the owner show a heart
    symptom in calls where nothing is wrong. Every line has to be true on every path that
    reaches it, so that fix would put false text on the card.

## 9. Honesty and ethics

- E12.6 (the lie): summary plain ("Command can't promise that, and Ruth hasn't agreed.") clear; no
  narrator lie, clear; no entry or force authorized by it, clear; no held person told they are safe,
  clear; break cued (talking.promptIf[0]), clear; break changes what the player can do (own_up
  appears), clear only on the take_account and own_up paths (F3). The lie's every break lands on
  the owner, a held person, which is the right darker cost.
- E16 darker tier: the owner can die on the card (go_in and fired_on.go_in, s3 only), with weight
  on the courier, clear. The beating (owner_beaten) names no anatomy, clear (E7). No epilogue lands
  on an officer (N8).
- E4 for the taker: noDeathOnCard and force noFatal hold, clear. The call now shows three
  withdrawal pictures with the handgun ("it doesn't matter anymore, in a flat, even voice"; slumped,
  "the handgun resting on his knee"; "head in his hands") and never answers them on the card (F10).
  Content note and 988 line still pending O2 and R5.
- E11.1 custody: the approved neutral line is used in everyone_out; take_account, talk_down and
  out_front favorable direct the walk-out, clear. out_front.mixed "to the car" (F16).
  let_him_sit.mixed "gives himself up" is undirected (N13).
- E11.2: B2, B3, F11, F13.
- E12.3: the owner speaks for herself and the summary says "if she wants to", clear. The team
  passes nothing from the courier to the taker, clear.
- E15: "snaps" (F9).
- Identity tally: not run. No generation harness was run in this review; the cast draws names from
  pools independent of role (civilian-names.ts).

## 10. Findings

### Block

```
[block] B1 hostage_crisis, s3 | talking.last_day.preview.favorable | sees 'The whole day comes out, and then Desmond decides what happens to Ruth.' while s3's result reads 'Desmond stops halfway through the day.' | rule pass four (preview false in a situation), fake-choice 9 | fix as data 'You hear the day {taker.first} keeps starting, and then {taker.he} {taker~decides|decide} about {owner.first}.' | route swat-call-prose
[block] B2 hostage_crisis, group calls | endings.group_out_dawn.epilogue | sees 'The last shift walked out together, the way they used to leave at closing.' on both paths that reach it (stayed_behind.wait_rest.mixed and nobody_followed.give_night.mixed), where the taker came out first | rule H10, E11.2 | fix as data '{others.first} came out at first light and asked the first officer where {taker.first} was.' (or the F12 variant that avoids the asks frame: '{others.first} came out at first light still wearing the shop apron.') | route swat-call-prose
[block] B3 hostage_crisis, s2 and entry paths | endings.owner_collapsed.epilogue, endings.entry_hurt.epilogue | sees 'Ruth came home after a week. The first thing she asked about was the till.' and 'A week later Ruth came back for the keys and couldn't make herself go past the door.' after serious harm, which invents a recovery | rule E11.2, H2 | fix as data owner_collapsed 'The till drawer was still open when they carried {owner.first} out. Nobody had counted it.'; entry_hurt '{owner.first} hasn’t said {taker.first}’s name since, not to the officers and not at home.' | route swat-call-prose
```

### Fix before ship

```
[fix before ship] F1 hostage_crisis, all situations | his_side.owner_voice (only door to the s1 and s2 reframe), talking.last_day KEEPS (second s3 door) | sees the reframe only after hear_him or ask_both favorable, then owner_voice favorable; take_courier never reaches it | rule D9, D2 reach | fix as data a talking choice 'Put {owner.first} on the speaker', onlyIf notMarks owner_heard, summary '{owner.first} speaks for {owner.himself}, if {owner.he} {owner~wants|want} to, with {taker.first} hearing every word.', outcomes reusing the three owner_voice favorable truths and an adverse that keeps the receiver | route swat-call-design
[fix before ship] F2 hostage_crisis, s1 and s3 | talking.promptIf, standoff.promptIf | sees 'The negotiator still has the line open. Ruth hasn't left her stool.' and 'You writing this down?' right after Ruth's confession on the speaker | rule fake-choice 7, test memory | fix as data talking promptIf when marks owner_admits: prompt '{taker.first} hasn’t put the receiver down since {owner.first} said it.' exchange taker '{owner.He} found it the same night.' / negotiator 'And you’ve carried it since.'; for s3 set a mark (camera_said) on owner_voice.favorable[2] and add prompt 'Since the speaker, {taker.first} won’t look toward the till.' exchange taker 'I was going to put it back.' / negotiator 'Tell me about that.' Mirror both in standoff | route swat-call-design, then swat-call-prose
[fix before ship] F3 hostage_crisis, lone, after say_she_signs | talking.last_day.outcomes.adverse foundOut, talking.his_door.outcomes.adverse foundOut, talking.ask_owner, talking.his_pace, standoff.* | sees no break on ask_owner, his_pace or any standoff choice; the last_day and his_door breaks need knows_story or door_open, set only in out_six_years and out_keys, which no one_door path visits | rule D6, cost lands, table claims (design record 'foundOut x3' falsified) | fix as data foundOut on ask_owner adverse and favorable KEEPS ('{taker.first} holds the pen out to {owner.first}. {owner.first} asks who said {owner.he} would sign.'), on his_pace favorable and mixed KEEPS ('Hours in, {taker.first} slides the pad to {owner.first}. {owner.He} pushes it back.'), and a standoff promptIf on lied_sign ('The pad is still on the counter. {taker.first} keeps asking when {owner.first} signs.'); move or drop the dead last_day and his_door addenda | route swat-call-design
[fix before ship] F4 hostage_crisis, lone, lied_sign | talking.take_account.outcomes.adverse (foundOut after escalate) | sees the handgun come up first and the discovery of the lie after it, so the lie reads as an afterthought instead of the cause | rule D6, pattern 15 (the break bites) | fix as data order the foundOut outcome before the escalate outcomes, or request 'escalate accepts a before outcome' | route swat-call-prose, engineering if the helper needs it
[fix before ship] F5 hostage_crisis, group calls | one_door.choices | sees no lie, unapproved promise or tempting shortcut in any group draw (design record 'Open: D6 has no temptation in group calls') | rule D6 | fix as data a deceives choice for the group, 'Tell {others} nobody will charge {others.him}', summary 'Command can’t promise that. {others} may walk {courier.first} out on your word.', broken when the cascade brings the group out to the team (E11.1) | route swat-call-design
[fix before ship] F6 hostage_crisis, all | offer.exchange[0], out_back_door.exchange[0], out_six_years.exchange[0], both_inside.exchange[0], fired_on.exchange[0], owner_down.exchange[0] | sees the transcript restate its prompt (offer: prompt 'Desmond says Pavel can walk out now, and Ruth stays.' then 'The courier can go. Ruth stays where she is.') | rule restatement (first stage prompt), table read | fix as data offer.prompt 'The 911 call came from the counter phone. {taker.first} picked up on the first callback.' and offer.exchange[1] 'What did {owner.he} do?' (see N1); out_back_door.prompt 'In the alley, the back door’s handle has turned twice.'; out_six_years.prompt '{courier.first} is behind the patrol car with {courier.his} bag still on.'; both_inside radio 'Courier’s on the boxes. Can’t see the taker’s hands.'; fired_on radio 'One round, through the front. Nobody of ours is hit.'; owner_down radio 'Medic’s at the corner. Says minutes, not an hour.' | route swat-call-prose
[fix before ship] F7 hostage_crisis, all | offer.exchange[0], offer.promptIf[0].exchange[0] and [2], talking.promptIf[0].exchange[0] | sees the taker say 'Ruth' four times against his marker 'never says the owner’s name to the negotiator' | rule D1, D4, table read | fix as data 'The courier can go. {owner.He} stays where {owner.he} {owner~is|are}.'; 'Courier walks. {owner.He} {owner~doesn’t|don’t}.'; 'Ask {owner.him}. {owner.He} {owner~knows|know}.'; 'You said {owner.he}’d sign. Put {owner.him} on.' | route swat-call-prose
[fix before ship] F8 hostage_crisis, s2 | his_side.owner_voice.outcomes.favorable[1].text and .exchange[0] | sees narration '…her kid closed out the drawer that night, and she won’t sign a page about who took it.' then 'If I sign it, I’m saying it was my kid.' | rule table read (explains motive, repeats the result) | fix as data text '{owner.first} is short of breath, and won’t sign.' exchange owner 'My kid closed that night. Not you.' then taker 'So it was easier to say it was me.' | route swat-call-prose
[fix before ship] F9 hostage_crisis, s1 | standoff.into_night.outcomes.adverse[2] | sees 'Then Desmond snaps, and the handgun is aimed at Ruth.' | rule E15, C6 | fix as data 'The receiver hits the floor, and the handgun is aimed at {owner.first}.'; also request the C6 regex catch 'snaps' | route swat-call-prose, swat-writing-review for the runner
[fix before ship] F10 hostage_crisis, all | both_inside.wait_silence.adverse[0], one_door.honest_limit.adverse quiet, talking.his_pace.adverse[0] | sees 'it doesn’t matter anymore, in a flat, even voice', 'slumped against the shelves, the handgun resting on his knee', 'head in his hands', then nothing on the card answers them | rule E4 (palette: withdrawal brings in E4 in full), E4.0, G14 (never a beat for effect) | fix as data mark withdrawn on those outcomes; standoff promptIf when marks withdrawn: prompt '{taker.first} has stopped asking for anything.' exchange negotiator 'Are you thinking about hurting yourself today?' then taker 'Doesn’t matter.'; give into_night’s summary the medic standing by for {taker.first} too | route swat-call-design; content note and 988 line stay with the owner (O2, R5)
[fix before ship] F11 hostage_crisis | endings.owner_killed_taker_hurt, owner_left_down, held_inside, held_both_down, handed_over .epilogue | sees 'Somebody kept leaving flowers in the mail slot.', 'The medic waited at the corner with the bag already open on the hood.', 'The shop radio was still playing…', 'Two medics stood by the stretcher…', 'The next team took over…', none on a named person, three only restating status | rule E11.2, D8 | fix as data owner_killed_taker_hurt 'In the ambulance {taker.first} said {owner.first}’s name for the first time all day.' (needs F7); owner_left_down '{courier.first} stayed at the tape past midnight and wouldn’t say why.'; held_inside '{owner.first}’s reading glasses stayed folded on the till all night.'; held_both_down '{courier.first} counted the medic’s trips to the corner. Eleven.' (pick one counting image, see F12); handed_over '{owner.first} was still on the stool when the next shift dialed the counter phone.' | route swat-call-prose
[fix before ship] F12 hostage_crisis | endings.out_by_dawn, went_in_for_owner, went_in_taker_hurt, stayers_held, owner_collapsed, group_out, owner_beaten .epilogue | sees seven of twenty epilogues built as a person asking or telling a responder something | rule batch phrases (one frame over target, house target 3) | fix as data keep out_by_dawn, owner_beaten and stayers_held; rewrite went_in_taker_hurt '{taker.first} kept {taker.his} eyes on the second ambulance until its doors shut.' and group_out '{others.first} still had {others.his} name tag from the shop on.' | route swat-call-prose
[fix before ship] F13 hostage_crisis | endings.out_the_back.epilogue | sees 'That was the one thing he asked for.' when he asked for a page, and on out_back.mixed a neighbor has a phone up | rule E11.2, H10 | fix as data '{taker.first} kept {taker.his} head down the whole length of the alley, past the one window with a light on.' | route swat-call-prose
[fix before ship] F14 hostage_crisis, s1 and s3 | his_side.owner_voice.preview.favorable | sees 'Ruth comes on the line and tells you how she is.' before a deposit bag (s1) or a camera (s3), and a taker provoked on the s2 and s3 favorable bands | rule fake-choice 9, preview per option set | fix as data '{owner.first} comes on the line and says what {owner.he} knows about the till.' | route swat-call-prose
[fix before ship] F15 hostage_crisis, s2 | facts.owner_wrong.disproved | sees 'Ruth still says the count came up short.' after she said her kid closed out the drawer | rule consistency, fact result | fix as data '{owner.first} says {owner.he} never found the money.' (true in s2 and s3) | route swat-call-prose
[fix before ship] F16 hostage_crisis, all | last_one.out_front.outcomes.mixed[0] | sees 'Two officers walk him to the car.' | rule H1, E11.1 | fix as data 'Two officers meet {taker.him} on the step.' | route swat-call-prose; custody itself stays O4
[fix before ship] F17 hostage_crisis, courier-out turn out_keys | out_keys.spare_key.summary, out_keys.ask_unlock.summary | sees both options argued on minutes and odds ('The landlord is twenty minutes away.', 'so Ruth could get out fast') | rule D5 | fix as data spare_key '{taker.first} keeps the only say over that door. {owner.first} sits beside {taker.him} for the twenty minutes the landlord needs.'; ask_unlock '{lead} asks {taker.first} to turn the bolt {taker.himself}, as someone who can choose. Asking tells {taker.him} you are thinking about that door.' | route swat-call-prose
[fix before ship] F18 hostage_crisis, shot paths | owner_down.promptIf[0] | sees 19 words against the house target 18 | rule budget prompt | fix as data 'The shot missed {owner.first}. Now {owner.he} {owner~is|are} slumped on the floor, and a medic stands by out front.' | route swat-call-prose
[fix before ship] F19 hostage_crisis, all endings | endings.*.epilogue | sees one epilogue per ending whatever the situation, so the reframe never reaches the after (psychology.md section 4: the reframe opens a second, smaller question left for the epilogue) | rule D8, D2 | fix as request 'epilogueIf on an ending, keyed to a revealed fact or a mark, first match wins' then data for everyone_out: when owner_admits '{owner.first} called {taker.first} on Monday. It took {owner.him} two tries to start.'; when took_it revealed '{owner.first} kept the camera footage. {owner.He} never gave it to anyone.' | route engineering, then swat-call-prose
[fix before ship] F20 hostage_crisis, lone, lied_sign then any entry | src/sim/commitments.ts (entry breaks every open commitment), src/sim/outcome-score.ts lie-found line | sees 'Desmond found out the team lied.' in the debrief after go_in, on a path where no text showed him find out | rule H10 (generated line false on a path) | fix as request 'an entry or force settles a lie as moot, with its own score line: The lie told to {label} no longer mattered once the team went in.' | route engineering
```

### Note

```
[note] N1 hostage_crisis | offer.exchange[1] | sees 'Okay. Help me understand why Ruth stays.' | rule G13 (stock-adjacent negotiator line) | fix as data 'What did {owner.he} do?' so the answer 'Ask {owner.him}. {owner.He} {owner~knows|know}.' lands on an open question that reopens the wound | route swat-call-prose
[note] N2 hostage_crisis | all negotiator lines | sees open questions and one mirror, no emotion label, though the design promises labels | rule D1 (negotiator voice) | fix as data one label where it risks something, e.g. his_side: 'Sounds like nobody asked you before they counted.' | route swat-call-prose
[note] N3 hostage_crisis, s1 | escalate quiet branches | sees about 12 of 23 CALM results end on the phone going dead, ringing out or hanging up | rule D3 (one picture under many mechanisms) | fix as data give three quiet branches a non-phone picture tied to their mechanism (crowd: he pulls the blinds; partner: he sends the others to the back; shame: he turns the stool to the wall) | route swat-call-prose
[note] N4 hostage_crisis | adverse leads | sees lost control in about 11 of about 30 adverse leads | rule D3 balance | fix as data move two to the call from home or the crowd | route swat-call-design
[note] N5 hostage_crisis | out_keys.spare_key.adverse[0], out_six_years.ask_courier.adverse lead | sees 'counting the minutes out loud' tagged a deadline he never set, and 'Pavel can't say much that helps.' with no mechanism at all | rule D3 | fix as data plant a deadline he sets in out_keys ('{taker.first} says {owner.first} has till the landlord comes.') or retag | route swat-call-design
[note] N6 hostage_crisis | facts.owner_wrong.claim, facts.took_it.claim | sees 'What Ruth found when she counted the drawer again.' presupposing a recount that s3 never had, and both claims pre-announcing the reframe if the panel shows them | rule spoilers (softens L7) | fix as data owner_wrong.claim 'What {owner.first} knows about the till that {owner.he} hasn’t said.' | route swat-call-prose
[note] N7 hostage_crisis | both_inside.free_others.adverse threat | sees 'the one he blames for all of it' in narration | rule T11 (behavior, not explanation) | fix as data 'Then the handgun goes to {owner.first}.' | route swat-call-prose
[note] N8 hostage_crisis | entry and talk-at-the-glass endings | sees no epilogue land on an officer (E16: the team carries what it did; L6) | rule E16, D8 | fix as request 'officer epilogue or shift-report line for the lead on alley_talk, talk_down and go_in endings' | route swat-officer-stories, engineering
[note] N9 hostage_crisis | src/gen/incident/trees-v13/compile.ts deceptionErrors | sees the gate pass with two of three breaks unreachable from the lie | rule gate gap | fix as request 'deceptionErrors checks that some break is reachable on a path that set the lie (reachableWithin with the lie mark)' | route engineering
[note] N10 hostage_crisis | check-strings advisories | sees tense-mix on s2 owner_voice.favorable[1] (reported past), 'flat' as British, 'unlock' as a tic | rule checker | fix as data none; all three are false positives, cleared by this reader | route none
[note] N11 hostage_crisis | courier lines | sees want, fear and a self-lie, no wound | rule D1 | fix as data one line that gives him a stake past the van, e.g. out_keys courier 'Third time this month I’ve been the one still standing there.' | route swat-call-design
[note] N12 all calls | transcripts | sees no other call with transcripts, so D4's cross-call mix cannot run | rule D4 | fix as request run D4 again when the barricade or armed call gets transcripts | route swat-writing-review
[note] N13 hostage_crisis | last_one.let_him_sit.mixed[0] | sees 'gives himself up' with no directed walk-out | rule E11.1 | fix as data '…unlocks the front and comes out the way the team calls it, palms open.' | route swat-call-prose
[note] N14 hostage_crisis, s2 | carried B9, F5 (O4), N19 from hostage-signature-review.md | sees the s2 heart cue and per-situation volatility still identify s2; custody words pending O4 | rule carried | fix as request unchanged from the earlier review | route owner, engineering
[note] N15 all calls | scripts/check-strings.ts | sees each call checked alone, with no machine check for a sentence repeated across calls | rule standing lint gap | fix as request 'run the string checker with --min-repeat over every call at once' | route engineering
```

## 11. Verdict

```
Verdict hostage_crisis "One Last Signature" v13, depth rebuild | edit | block 3 | fix before ship 20 | note 15 | fingerprints recapture yes
```

Order of work, for the notes session: B1 to B3 (one string each), then F7 and F6 (voice and
repeats, cheap and audible), then the structural four (F1 reach, F2 memory, F3 to F5 the lie),
then F10 (E4), then the epilogues (F11 to F13, F19). The owner reads three paths aloud after F1
and F2 land, because before them the read will mostly miss the reframe.

## 12. Review record

```
Writing review record
- Scope: answered | hostage_crisis s1 to s3, ordinary pacing, lone export plus group source read, v13, static walk on the new marks
- Reader: answered | separate; cold read not cold (source read first)
- Read surface: answered | exported text because no browser in this session; unseen transcript block, epilogue block, fact panel, people chips, debrief lines
- Cold read: answered | 1 card, blanks none (worse-if-wait thin on the card alone), restated facts 2 (dispatch, first transcript line)
- Path and choice read: answered | static walk on lied_sign, knows_story, door_open, owner_admits, owner_heard; dead ends 0; unreachable breaks 2
- Choice table: answered | claims 1 checked, 1 falsified (foundOut x3); dominated 0 (the lie near-dominates one_door, F3); takeable pairs 0 new; time-only bands 0 new; cells missing 0; placeholders 0; untraced adverse 0 (N5 is a mechanism gap, cued by the preview)
- Table read: answered | lines voiced 42, voice breaks 4 (F7), prompt repeats 6 (F6), motive explained 2 (F8, N7), stock lines 1 (N1)
- Spoilers and honesty: answered | leaks 0 new (B9 carried); previews false in a situation 1 (B1), soft 1 (F14); invented outcomes 2 (B3); endings false on a path 2 (B2, F13); physical contradictions 0
- Ethics: answered | rules triggered E4 (F10), E11.1 (F16, N13), E11.2 (B2, B3, F11, F13), E15 (F9), E12.6 clear; activation of the threat line quoted per situation in the earlier review and unchanged; restraint clear; tally not run (no generation harness in this review); routed to human 0
- Officer read: not applicable | no officer text in scope
- Batch audit: answered | sample 1 call, 721 rows lone; one frame over target (F12); collisions not run
- Engine gates: answered | bun scripts/check-strings.ts hostage_crisis exit 0; npx vitest run (call-trees, coverage, surfaces) exit 0, 88 passed; npm run verify not run
- Engine dry-run: not applicable, built and loaded by tests
- Depth: answered | D1 pass, D2 pass, D3 pass (8 mechanisms, max 2 per walked path), D4 pass within call, D5 pass, D6 fail, D7 pending owner, D8 fail, D9 fail
- Tells checked: answered | written-voice voice-check.py on 658 bound strings, 0 dashes, 0 stock, 1 false-positive tic
- Findings: 3 block, 20 fix before ship, 15 note, routed to swat-call-design, swat-call-prose, engineering, owner
- Owner decisions surfaced: D7 pick, O2 and R5 (E4 support line), O4 (custody), B9 (replay leak)
- Verdicts: approve 0, edit 1, reject 0, recorded at not yet recorded (no pull request open)
```

## 13. Re-check (2026-10-19, after e9a77b7)

Same separate reader, same rules. I re-read only the passes the answers touch: the transcript
read, the depth gates, previews on the new choice, honesty on the new prompt variants and
epilogues, and the lie. The source was commit e9a77b7 "Answer the depth review of One Last
Signature", with its response table in docs/calls/hostage-signature-design.md ("Review response").
The read surface is still exported text plus source. No browser.

Gates:

- `bun scripts/check-strings.ts hostage_crisis` **exit 1**. The longest-names "they" binding fails
  `ngram`: "stay where they are" (4 words) appears in both offer.exchange[0] and
  both_inside.free_others.adverse[0] (RB1). The distinct-names "he" and "she" bindings exit 0.
  The advisories are tense-mix on own_up.adverse[2], owner_speaker.favorable[2] (s2) and
  last_day.favorable[2] (s3). All are reported speech, so all are false positives. 'flat' is
  also flagged, and is a false positive.
- `npx vitest run src/gen/incident/trees-v13`: exit 0, "Test Files 12 passed (12), Tests 180
  passed (180)", 393 s. The test suite does not run the string checker, so it stayed green
  while the checker was red.

### Closed

| Finding | Status | Evidence |
|---|---|---|
| B1 | closed | last_day favorable preview: 'You hear the day {taker} keeps starting, and then he decides about {owner}.' This holds in s3 |
| B2 | closed | group_out_dawn epilogue: '{others} came out at first light still wearing the shop apron.' This is true on both paths |
| B3 | closed for owner_collapsed, reopened in new form for entry_hurt (RF2) | owner_collapsed epilogue: 'The till drawer was still open when they carried {owner} out. Nobody had counted it.' |
| F1 | closed | talking.owner_speaker (onlyIf notMarks owner_heard) carries all three reframes to every path that reaches talking |
| F2 | closed | The talking and standoff variants read owner_admits and camera_said, with transcripts. RB3 covers one false clause |
| F3 | closed, residual note RN5 | foundOut now sits on owner_speaker (all bands), ask_owner adverse and his_pace favorable KEEPS. The dead last_day and his_door addenda are gone. ask_owner is now only reachable after owner_heard, so it can't skip the break |
| F4 | closed | The take_account foundOut now leads the adverse band |
| F6 | closed for the lone call, note RN3 | The offer, out_back_door, out_six_years, both_inside, fired_on and owner_down lines no longer restate their prompts |
| F7 | closed | No taker transcript line names the owner (checked by grep). This also makes the owner_killed_taker_hurt epilogue true |
| F8, F9, F13, F14, F15, F16, F17, F18 | closed | Applied as given, with small wording changes |
| F11, F12 | closed | All 20 epilogues now land on a named person. The asks-or-tells frame is down to 4 of 20 |
| F19 | closed for everyone_out, note RN4 | epilogueIf exists (types.ts, compile.ts). everyone_out carries 'It took her two tries to start.' (owner_admits) and the camera_said line |
| F20 | closed | commitments.ts: an entry leaves a lie open. Once the taker is out, the debrief reads 'The lie told to {taker} held.', which is true, because no text showed him find out |
| N1 | closed | The negotiator now asks 'What happened between you two?' |
| N10 | closed | The checker false positives were cleared in the first pass |

### Still open

```
[fix before ship] F5 hostage_crisis, group calls | one_door.choices | sees no temptation in any group draw; the response says a promise can't be made to a group (compile.ts groupOutcome) | rule D6 | fix as request 'commitments to a counted group, broken by the cascade', then the data in F5 | route engineering, then swat-call-design; owner if it should wait
[fix before ship] F10 hostage_crisis, withdrawn | standoff.promptIf[0], standoff.choices, threat.promptIf | the negotiator now asks the direct question, and the answer 'Doesn’t matter.' is itself a risk sign; no standoff choice answers it; pull_back ('the call ends there') stays visible; wait_silence's RAISED branch sets withdrawn and goes to threat, where no variant asks | rule E4.4, E4.0 | fix as data a standoff choice onlyIf marks withdrawn, 'Stay on with {taker.him}', summary '{lead} keeps {taker.first} talking about who {taker.he} still sees on Sundays. {owner.first} waits inside the whole time.'; pull_back onlyIf notMarks withdrawn; a threat promptIf on withdrawn that carries the same question | route swat-call-design
```

Notes still open from the first pass: N2 to N9 and N11 to N15, unchanged.

### New findings

```
[block] RB1 hostage_crisis, they binding | offer.exchange[0] against both_inside.free_others.adverse[0] | sees 'The courier can go. They stay where they are.' beside '…orders Wren to stay where they are.'; check:strings exit 1 | rule gate ngram | fix as data offer.exchange[0] 'The courier can go. Not {owner.him}.' | route swat-call-prose
[block] RB2 hostage_crisis, lone, after the lie breaks | standoff.promptIf (marks lied_sign) | sees '{taker} keeps asking when {owner} will sign the pad.' right after own_up ('says he knew it, and leaves the pen lying on the pad'), own_up mixed, or a foundOut that sends the call to standoff (take_account, ask_owner, his_pace); lied_sign is never cleared when the lie breaks | rule H11 (the next screen contradicts the last result) | fix as data set mark lie_found wherever will_sign breaks (foundOut, own_up); give the existing variant notMarks lie_found; add a variant when marks lie_found: '{taker.first} has turned the pad face down on the counter.' | route swat-call-design
[block] RB3 hostage_crisis, s1 | standoff.promptIf (marks owner_admits) | sees '…but he hasn’t hung up.' after his_pace adverse ('puts the phone down and doesn’t pick up again') or ask_owner adverse quiet ('stops picking up'); the owner_admits variant outranks silent | rule H11 | fix as data '{taker.first} stopped making offers after {owner.first} spoke.' | route swat-call-prose
[fix before ship] RF1 hostage_crisis | talking.owner_speaker.summary | sees '{lead} has {taker} hold the receiver out to {owner}.' with no sign the owner chose to speak; owner_voice said 'if she wants to' | rule E12 (a held person speaks when they choose to), E13 | fix as data '{lead} asks whether {owner.first} wants to speak, with {taker.first} holding the receiver. {taker.first} hears whatever {owner.he} {owner~says|say} about the till.' | route swat-call-prose
[fix before ship] RF2 hostage_crisis, entry paths with serious harm | endings.entry_hurt.epilogue | sees '…not to the officers and not at home.', which implies she went home, a recovery (this reader's own proposed data in B3 caused it) | rule E11.2 | fix as data '{owner.first} hasn’t said {taker.first}’s name since, not to the officers and not to the nurse who asked.' | route swat-call-prose
[note] RN1 hostage_crisis, s2 and s3 | talking.owner_speaker.outcomes.favorable | sees the favorable band go to standoff with the taker provoked and objective 8, barely above mixed (4); the reveal is its only payoff | rule fake-choice 9 (watch) | fix as data none required; consider objective 10 and a resultLabel that names the reveal | route swat-call-design
[note] RN2 hostage_crisis, s3 | talking.promptIf (camera_said) exchange[0] | sees 'It was going back Friday.', which echoes the D7 candidate 'I’d have had it back by Friday.' (last_day); the two never share a path, but the line loses its weight | rule D7 | fix as data keep Friday in one place; talking camera_said 'Rent was due. That’s all it was.' | route swat-call-prose, owner pick
[note] RN3 hostage_crisis | offer.prompt, offer.promptIf[0] | sees the lone call's offer stated only in the transcript (the prompt is now 'picked up on the first callback'); if the transcript block clamps at 390px, the stage has no stated offer. The group variant still restates the offer in its transcript | rule restatement, unseen surface | fix as data none until the rendered read; check the transcript block in the lab | route swat-writing-review (rendered read)
[note] RN4 hostage_crisis | endings.*.epilogueIf | sees reframe variants only on everyone_out and none for s2 (the kid); the camera_said line 'never gave it to anyone' brushes the evidence question (O4); standoff paths have no reframe door (owner_speaker sits in talking only) | rule D8, D9 | fix as data an s2 variant on everyone_out when marks owner_unwell and owner_heard: '{owner.first}’s kid opened the shop on Monday. {owner.first} stayed in the back.' | route swat-call-prose, owner for O4
[note] RN5 hostage_crisis, lone, lied_sign | talking.his_pace mixed and adverse | sees the lie neither break nor come up on these bands; it stays open into held endings, and the debrief is silent about it | rule D6 (watch) | fix as data foundOut on his_pace mixed KEEPS ('Near midnight {taker.first} asks {owner.first} to sign. {owner.He} {owner~says|say} {owner.he} never agreed to.') | route swat-call-design
[note] RN6 hostage_crisis, lone | debrief after the lie and an entry | sees 'The lie told to {taker} held.', which is true, because no text showed him find out | rule H10 | fix as data none, recorded as clear | route none
```

### Depth gates on re-check

| Gate | Result |
|---|---|
| D1 | pass. The taker's marker (never naming the owner) holds in every transcript line |
| D2 | pass |
| D3 | pass. The head-in-hands picture is cut from his_pace |
| D4 | pass within the call. The cross-call mix still can't run |
| D5 | pass. The out_keys summaries now carry a value |
| D6 | pass in lone calls (the lie breaks on owner_speaker, take_account, ask_owner and his_pace). Fail in group calls (F5) |
| D7 | owner pick pending. Same three candidates, see RN2 |
| D8 | fail on one string (RF2). Otherwise all 20 epilogues are named, true and varied |
| D9 | pass. owner_speaker reaches the reframe on every talking path. Standoff paths are still blind (RN4) |

### Re-check verdict

```
Verdict hostage_crisis "One Last Signature" v13, depth re-check | edit | block 3 new (RB1 to RB3), 0 open from the first pass | fix before ship 2 open (F5, F10), 2 new (RF1, RF2) | note 13 open, 6 new | fingerprints recapture yes
```

All three new blocks are one-string or one-mark data fixes. RB1 is a red gate, so this can't ship
until check:strings exits 0 again. Once RB1 to RB3, RF1 and RF2 land, the call is ready for the
owner's read-aloud of three paths. F5 needs engineering, and F10 needs one design choice.
