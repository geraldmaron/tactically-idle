# Going Live: AI-writing tells (Codex catalog, 2026-10-21)

Owner read Going Live and called it AI slop; their example was "asks for her phone back before anyone has asked her anything". This is the catalog the full rewrite works from, built read-only by Codex (gpt-6.1-sol) against the swat-call-prose rules. Paths are into src/content/call-trees/hostage-live.ts and src/content/incidents/hostage.ts as they stood before the rewrite.

**Rewrite the narrator and cadence first.** The stream gives the call a strong dilemma. The prose repeatedly tells the reader which small actions deserve significance.

Read-only audit of [the call](../../../src/content/call-trees/hostage-live.ts) and [its template](../../../src/content/incidents/hostage.ts), against both requested references. Counts cover alternative branches, with helpers expanded. Paths omit `nodes/choices/outcomes` and the final `text` key; `E=endings`, `S=STREAM.source.reactions`. Quotes are excerpts. Regexes are Python raw strings, using `re.I` unless noted. They locate constructions, not verdicts. No files changed; no UI or engine validation.

1. **Anticipation captions:** explain the significance of unprompted behavior. **About 15 cues.**  
   “before anyone has asked {clerk.him} anything” (`going_live.clerk_out.favorable[0]`); “Nobody asked {clerk.him} to” (`clerk_talks.prompt`); “without being asked” (`off_air.own_it.favorable[0]`).  
   Regex: `r"\bbefore (?:anyone|whoever)\b|\bwithout being (?:asked|told)\b|\bnobody (?:has )?(?:asked|told)\b"`. False positives: necessary sequencing and disclosure that a claim remains unchecked.

2. **Manner doing emotion:** adverbs supply the intended emotional reading. **17.**  
   “very carefully” (`going_live.clerk_out.favorable[0]`); “very quietly” (`cornered.off_camera.favorable[0]`); “turns slowly” (`on_air.cut_feed.adverse[0]`).  
   Regex: `r"\b(?:very )?(?:carefully|slowly|slower|quietly|quieter|plainly)\b"`. False positives: actual audibility or safety instructions.

3. **Artificial exclusivity:** inflate significance through “the one/only.” **23 lexical hits.**  
   “The one line” (`going_live.on_stream.pull`); “the only question” (`clerk_talks.clerk_asked.pull`); “the one good thing tonight” (`way_out.own_lie.cost`).  
   Regex: `r"\bthe (?:one|only)\b"`. False positives: genuine exclusivity.

4. **Milestone stamps:** label a change as unprecedented. **5.**  
   “For the first time since the team arrived” (`clerk_talks.say_clerk_backs.favorable[0]`); “for the first time all night” (`way_out.own_lie.summary`); “for the first time in minutes” (`chat_turned.say_true.favorable[0]`).  
   Regex: `r"\b(?:for the first time|the first person since)\b"`. False positives: consequential chronology.

5. **Interpretive similes:** append an inferred mental explanation. **3.**  
   “as if the picture might come back on its own” (`off_air.promptIf[0].prompt`); “as if {manager.first} wrote all of them” (`cornered.off_camera.adverse[1]`); “as if {manager.first} wrote them” (`chat_turned.prompt`).  
   Regex: `r"\bas if\b"`. False positives: comparisons in character speech. Here two nearly identical explanations underline the same psychology.

6. **Absence performed as drama:** make non-action sound momentous. **3 exact constructions.**  
   “and then nothing” (`cornered.friend_stays.mixed[0]`); “doesn’t speed up once” (`on_air.camera_wall.favorable[1]`); “doesn’t mention {manager.first} once” (`phone_rings.take_call.mixed[0]`).  
   Regex: `r"\band then nothing\b|\bdoesn[’']t[^.!?]*\bonce\b"`, after binding tokens. False positives: meaningful nonresponse.

7. **“Nobody” as automatic pressure:** repeated negative openings substitute for escalation. **32 sentence/title hits; 9/18 timeouts.**  
   “Nobody calls the register back” (`going_live.threat.timeout`); “Nobody calls the register” (`off_air.threat.timeout`); “Nobody picks up” (`clerk_talks.threat.timeout`).  
   Regex: `r"(?:^|[.!?]\s+)Nobody\b"`, case-sensitive. False positives: useful status reporting.

8. **Brochure summaries:** action, benefit, explanatory counterweight. **7 “It also” summaries; 33/44 summaries start with `{lead}`.**  
   “It also means walking out to the police with nobody watching” (`last_word.out_back.summary`); “It also means the police can’t give” (`same_question.answer_it.summary`); “It also leaves {manager.first} with no officer near the door” (`home_again.pull_back.summary`).  
   Regex: `r"\bIt also\b"`. False positives: occasional clear explanation. The repeated menu rhythm requires human review.

9. **Prop insistence:** planted objects repeatedly supply “human” significance. **Water 9, marker 3.**  
   “case of water still in {clerk.his} arms” (`way_out.wait_night.favorable[1]`); “in green marker” (`E.manager_killed.epilogue`); “green marker stayed on the counter all night with its cap off” (`E.held_counter.epilogue`).  
   Regex: `r"\b(?:case of water|green marker)\b"` inventories recurrence; it cannot distinguish continuity from overwork. These objects aren’t literally in every scene.

10. **Ornamental counting:** precision without decision value. **About 8 conspicuous passages.**  
    “eleven times” (`going_live.watch_feed.adverse[0]`); “in six steps” (`clip_going.out_now.favorable[0]`); “On the ninth time” / “On the twelfth” (`ceiling.say_name.favorable[0]`).  
    Candidate regex: `r"\b(?:eleven|six|nine|ninth|twelfth|eight|ten|dozen)\b"`. False positives: genuine timing constraints. The evidentiary timestamp deserves preservation.

11. **Decorative texture/choreography:** specificity announces the writer’s attention without helping the player. **At least 3 clear cases.**  
    “quiet enough to hear the cooler hum” (`off_air.prompt`); “where a calendar from the supplier hangs” (`on_air.camera_wall.favorable[0]`); “with one thumb, in the middle of a comment” (`cornered.off_camera.favorable[0]`).  
    **No reliable regex:** relevance depends on the scene.

12. **Balanced triads:** disparate actions acquire a rehearsed cadence. **About 8 obvious examples.**  
    “the timestamp, the red light, the two blocks” (`on_air.manager_speaks.mixed[0]`); “No audience, no show, nothing to perform” (`way_out.walk_dark.pull`); “No picture, no count, nobody at the window” (`threat.go_dark.summary`).  
    **No reliable regex:** comma counting mostly finds ordinary lists.

13. **“Still” and reset tableaux:** prompts repeatedly inventory persistent positions. **68 word hits.**  
    “The phone is still propped against the register” (`on_air.prompt`); “The phone is still on the register” (`way_out.prompt`); “The phone is still propped on the register” (`fired_on.prompt`).  
    Regex: `r"\bstill\b"`. False positives: necessary persistence. The recurring phone/floor/weapon tableau is the structural problem; prompts don’t all literally share an opener.

14. **Reaction codas:** finish the action, then append a small expressive response. **Roughly a dozen conspicuous results, plus clock beats.**  
    “reads that one out too, slower” (`going_live.on_stream.mixed[0]`); “doesn’t read any of them out” (`on_air.manager_speaks.favorable[1]`); “goes back to the clip” (`clip_going.out_now.favorable[0]`); “then reads it again” (`STREAM.cues[2]`).  
    **No reliable regex.** Not every result does this. Anticipation captions and similes additionally explain what the reaction means.

15. **Preview hedging rhythm:** setup plus modal danger. **17/44 adverse previews contain “could.”**  
    “the handgun could follow it” (`going_live.on_stream.preview.adverse`); “{rider.first} could fire” (`going_live.clerk_out.preview.adverse`); “{manager.first} could pay for it” (`going_live.watch_feed.preview.adverse`).  
    Regex: `r"\bcould\b"`, scoped to previews. False positives: honest uncertainty. “Pay for it” also euphemizes the threatened harm.

16. **Chat as thematic chorus:** strangers deliver polished judgments about the premise. **About 5 editorial lines.**  
    “{rider.first} needs a lawyer not a camera” (`S.byCue[2][14]`); “the clerk didnt sign up for this” (`S.byCue[3][13]`); “everyone in there is somebody’s kid” (`S.byCue[3][16]`).  
    **No reliable regex.** Each is plausible alone; accumulation makes the chat sound like the author’s conscience.

The rewriter’s ten rules, in priority order. Afters demonstrate the move, not validated replacement fields:

1. **Let behavior stand.** “asks for ... phone back before anyone has asked ... anything” → “asks for the phone back.”
2. **Rebuild menus around act and concrete cost.** “It keeps ... It also means ...” → “Bring Rider out the back. Nobody will film the exit.”
3. **Remove milestone labels.** “For the first time since the team arrived ... sits down” → “Rider sits down.”
4. **Report acts without inferred explanations.** “raises the handgun ... as if ... wrote all of them” → “Rider raises the handgun at Manager.”
5. **Make recurring props earn their return.** “green marker stayed ... with its cap off” → delete that epilogue.
6. **Open on the changed fact.** “The phone is still propped ...” → “Thousands of people just watched the shot.”
7. **Cut emotion adverbs before inventing gestures.** “sets ... down ... very carefully” → “sets the water down.”
8. **Count evidence, not choreography.** “walks to the door in six steps” → “walks to the door.”
9. **Break slogan symmetry.** “No audience, no show, nothing to perform” → “The exit won’t be filmed.”
10. **Name threatened harm.** “{manager.first} could pay for it” → “If Rider raises the handgun, Manager is in front of it.”

## Second Codex pass, 2026-10-21

Verdict edit. Applied all eleven findings: soft adverse previews on `clip_going.stay_with` and
`on_air.camera_wall` now name the handgun and the manager; the stream cue at 22 no longer has the
rider perform for the camera; `way_out.wait_night` and the `news_on` prompt no longer claim a live
stream that a cut path has ended; `threat.go_dark` and `E.manager_killed` say what happened without
staging; `threat.go_dark.preview.mixed`, `last_word.let_him_sit.cost`, `last_word.out_back.mixed[2]`
and `way_out`'s exchange were made plain; the three "gets as far as" results were rewritten. Three
replacements were reworded again to clear the n-gram and path-echo checks (`check:strings` exits 0).
