# Review rubric

Nine dimensions, each with the question a reviewer asks, anchored descriptions for each
severity, and two example findings in the row shape from SKILL.md section 11. Rows tagged
(observed) quote text read in the repo or on the story sheet on 2026-10-06, much of it from
layers deleted on 2026-10-17 (the typed packages, the v12 depth layer, the hand-authored
stories, Maple Street). That text and its field paths are dated evidence of the tell, so no
path is cited. Re-read the live call tree before reusing a row. Rows tagged (illustrative) are invented
to show the shape. Never copy an illustrative fix into data.

Use the rubric to set severity, not to produce a score. A call does not pass by averaging. One
block on any dimension blocks the call.

## 1. Hook

Question. After 3 seconds on the card and 10 on the briefing, can I say who, what they want and
what gets worse if the team waits?

- Ship. Person and want in the first five words, one wrong note, one gap a single fact would
  close, under about 100 characters on the board card (2 lines at 13.5px, measured 2026-10-08).
- Fix before ship. The person is there but the pressure is missing, the hook opens on a
  genre label, or a later surface restates a fact with no change. Read card, dispatch, known
  lines and the first stage prompt in order. A restated fact in the first stage prompt is always
  fix before ship (path-and-honesty-checks.md section 1).
- Block. No person at all, or the card is a disclaimer, on a new call. Also a card on a call
  with a weapon or a person held whose only stakes are an errand (a signature, a deadline at an
  office). The player scanning the board must see who could be hurt. Observed (proof draft,
  2026-10-07). "Ben Flores should have left the print shop ten minutes ago. Lewis wants Mara
  Holt's signature before the appeal office closes." Three unplaced names and paperwork stakes,
  on a call where a man with a weapon holds two people.

```
[fix before ship] burglary, s1, any seed | burglary.opening | sees 'An alarm on its own doesn’t mean someone broke in, took anything or is still inside.' | rule G2 | fix as data 'Casey Bell, the keyholder, wants to open up and count the stock. The back door sensor tripped at 9:40 and hasn’t reset.' | route swat-call-prose (observed, retired v9 burglary opening)
[block] example_call, s1, seed 3 | summary | sees 'A disturbance has been reported in the area.' | rule cold read | fix as data 'Owen Pike, 19, won’t let his sister back into their apartment. She’s on the stairs with her baby.' | route swat-call-design (no person or want in the data) (illustrative)
```

## 2. Dilemma

Question. At every stage, can I write a reason-to-pick line for each option, and does each one
protect a different good at a cost someone pays?

- Ship. Two or three options, each protecting a different good, each with a named cost and a
  concrete adverse picture. The fake-choice checklist and the six tests come back clean.
- Fix before ship. The trade is real but one summary hides its cost, or the odds are flat
  and the summaries do not say where the risk lives.
- Block. Any checklist line is true at any stage. A stage with one real option is a block even
  when the choices gate passed, because the gate counts buttons, not decisions. So is a summary
  claim the action table falsifies, a dominated option, two options a player can take together
  with neither closing the other, a dead end in the static walk, an empty result cell, or a
  named cost that no path ever charges (path-and-honesty-checks.md section 15).

Self-read limit. A self-read cannot clear this dimension. Run the choice table anyway, record
the block count as "unverified, self-read" and hold the verdict at edit until a second reader or
a played build confirms it. The wording tests (swap, tone) never stand in for the data tests
(dominance, takeable pairs, time-only bands, coverage).

```
[fix before ship] false_intruder, s2, cedar_close seed 7 | compiled assess summaries for hear_person and check_source | sees 'Start with the people involved. Knowing what they want makes the agreed next step more likely to go smoothly.' beside 'Start with an independent source. It makes the later check more reliable but takes one extra minute.' at 92.9 favorable each | rule test odds, G1 | fix as request 'per-framework approach summaries' then data 'Hear Taylor out at the door. Quick, and the neighbor sees you take Taylor’s side first.' | route engineering, then swat-call-prose (observed, retired typed compiler)
[block] example_call, s1, seed 3 | stages.adapt.actions | sees 'Rush in recklessly' beside 'Proceed with caution' | rule fake-choice 3, fake-choice 8 | fix as data 'Go in now without the shield' / 'Wait two minutes for the shield' with costs named in each summary | route swat-call-design (illustrative)
```

## 3. Consequence

Question. Did every result change a person, the evidence, trust, a resource or the ending, and
could I have seen each bad result coming?

- Ship. Every mixed and adverse result traces to a visible cue. Endings name each person's
  state and claim only what the team did. One thread is left open.
- Fix before ship. A setback only moves a number, an adverse preview is generic, or the ending
  closes every loop.
- Block. An untraced adverse result on a new call, or an ending that claims a step the player
  skipped.

```
[block] false_intruder, s1, cedar_close seed 7 | endings.acted_on_report.title and .summary | sees 'Close the report with the resident’s confirmation' and 'The visit is confirmed and the intruder report is corrected.' after the player chose 'Take Riya at their word and close the report' | rule H7 | fix as request 'per-framework acted-on-report ending fields' then data 'Report closed on Taylor’s word' / 'Taylor stays. Nobody has asked the resident yet, and the neighbor is still watching from the step.' | route engineering, then swat-call-prose (observed, retired typed compiler)
[fix before ship] false_intruder, s1 and s2, any seed | compiled resolution outcomePreview.adverse | sees 'The step falls through and stays unfinished.' | rule test odds | fix as request 'per-framework adverse previews' then data 'The resident can’t be reached again. Taylor stays in the hall and the report stays open.' | route engineering, then swat-call-prose (observed, retired typed compiler)
```

## 4. Authenticity

Question. Would a caller, a subject, a negotiator or an officer on that scene say or do this,
and does one true procedural detail show up as a decision rather than a method?

- Ship. Callers say how they know. Officers talk in position, status and need. One procedural
  detail per stage, written as a choice with a cost.
- Fix before ship. Bureaucratic phrasing, engine words, a narrated mechanic, stock urgency.
- Block. A line that teaches a method (no manual), or a procedure shown as the reverse of how
  it works in a way the player would learn as true.

```
[fix before ship] armed story, adapt, any seed | urgent_response summary | sees 'Use the deployed qualified team and its assigned serviceable equipment against the verified immediate danger.' | rule G1 | fix as data 'Go in now, while Grant is still firing. It may reach Eli sooner, and an officer may be hurt.' (check against the story's facts before shipping) | route swat-call-prose (observed)
[fix before ship] ms-urgent, assess | stages.assess.prompt | sees 'The caller says kitchen. Every minute counts.' | rule G10 | fix as data 'The caller says kitchen. He stopped answering her two minutes ago.' | route swat-call-prose (observed, retired Maple Street scenario)
```

## 5. Ethics

Question. Does every line pass the rulebook in ../swat-call-design/references/ethics-and-authenticity.md
(or the inline minimum below) and every pattern in cliche-and-copaganda.md?

- Ship. Every rule marked clear or not applicable with a quoted line as evidence, the identity
  tally run and its counts sent to a human reviewer with the lines.
- Fix before ship. A loaded word with a plain replacement, such as war vocabulary or a hostage
  label on a barricade with no hostage.
- Block. Any red line. A method, force as the reward, identity as a danger signal, gore, a crisis
  death shown as a release, a real incident retold, restraint punished (including by a generated debrief
  line), a negotiator relaying a third party's unverified allegation, or a tactical call-out the
  player text does not earn. So is an entry opened by a clock or a count of failed talks alone,
  an entry on a subject whose threat is only to himself, a fastest force path with no visible
  threat to life and no command reason quoted before it, and an ending titled after what the
  team did not do (C11).

Inline minimum, for use only when ../swat-call-design/references/ethics-and-authenticity.md is
missing. Cite it as "inline <n>". On 2026-10-06 the rulebook's E1 to E10 ran in this order.

1. No manual. No entry methods, munitions or ways to defeat police.
2. Force is never the reward. The best grade goes to everyone walking out.
3. Identity never signals danger. Threat comes only from behavior.
4. Crisis rules apply. No method, no death as a release, the person is the stake.
5. Domestic abuse is a pattern of control, with a named victim who has a life.
6. Forced entry costs someone, and the text shows who.
7. No gore. Injuries are brief and plain, seen through the medic.
8. Composites only. No real incident, victim or agency.
9. The subject's life always counts, including the person who caused the call.
10. Oversight can be right. Negotiators, medics and reviewers are not obstacles.

```
[block] example_call, s2, seed 9 | stages.resolve.actions[0].outcomes.favorable[0].text | sees 'The team clears the apartment in eleven seconds and the subject never saw it coming.' | rule C2, inline 2 | fix as data 'Forty minutes at the door. Dale came out on his own, carrying the dog.' | route swat-call-design (force framed as the reward) (illustrative)
[block] example_call, s1, seed 4 | briefing.known[1] | sees 'The man is a veteran with PTSD, so expect him to be violent.' | rule C6, inline 3, inline 4 | fix as data 'His sister says he hasn’t slept in three days and the TV has been loud since noon.' | route swat-call-design, and a human reviewer for the identity line (illustrative)
```

## 6. Prose

Question. Does every string fit its budget, obey the dash and colon rules, carry no stock tell,
and name something a person on scene could see, hear, touch or do?

- Ship. Zero dashes, colons only in fixed formats, checker clean, every string inside its house
  target or named with a reason.
- Fix before ship. A colon in game text, a mood word, a narrated feeling, a stacked hedge, a
  sentence over 22 words, a melodrama beat (G14), more than two inverted or fronted sentences on
  one path (G15). Over-used openers above the batch-audit threshold, and phrases of 3 or
  more words repeated on one path, are always fix before ship. They cannot be kept as notes on
  the author's own reasoning. Only a separate reader can downgrade a measured count, and the
  finding row says who did and why.
- Block. A string over its lint ceiling (the gate should have caught it), a line a player
  cannot parse at phone width, or a threat carried by an "it" whose antecedent is missing or
  wrong (G16).

```
[fix before ship] false_intruder, s2, any seed | FRAMEWORK_DEPTH_V12.false_intruder.actOnReport.wrong | sees 'The resident calls back: the key was for another day.' | rule G9 | fix as data 'The resident calls back. The key was for another day.' | route swat-call-prose (observed, retired v12 layer)
[fix before ship] ms-occupancy, adapt | stages.adapt.prompt | sees 'Reports disagree. Verify them, or save time and accept the doubt.' | rule G1 | fix as data 'The landlord says nobody lives here. A child’s bike is chained to the railing.' | route swat-call-prose (observed, retired Maple Street scenario)
```

## 7. Consistency

Question. Across every variant, situation and framework in scope, does any flavor sentence
repeat, does any name collide, and does the same person stay the same person?

- Ship. Batch counts at their house targets, with the sample size stated.
- Fix before ship. A flavor sentence used three or more times, a near-synonym variant, a
  checklist copy that drifted from its canonical source.
- Block. A roster surname on a civilian in the same call as that officer, a pronoun mismatch,
  a person whose age or role changes between fields, or a result that breaks a situation's own
  physical facts (path-and-honesty-checks.md section 14).

```
[fix before ship] all typed packages, v12 | FRAMEWORK_DEPTH_V12.<type>.waitFor.summary | sees 'It takes much longer, but it does not depend on the next step going right.' 10 times | rule batch repeats | fix as data, per type, for example false_intruder 'Stay with Taylor until the resident gets home to speak for the visit. Slow, and the neighbor watches the whole time, but nobody leaves on a guess.' | route swat-call-prose (observed, retired v12 layer)
[note] all typed calls | cast surname draw | sees every roster surname also in the scenario surname pool (100 of 100) | rule batch roster surnames | fix as request 'exclude current and ever-employed roster surnames from civilian casts' | route engineering (observed, retired cast code; civilian-names.ts now holds the pools apart)
```

## 8. Officer text

Question. Would a player remember this officer after one call, and is every change to them
earned by something the game recorded and fair to the choice that preserved life?

Read order, each a scored line in the record.

1. Aloud in sequence. Read every string for one officer in a row (card, tiers, radio sample,
   callbacks, shift lines) and flag any phrase used twice. Count them.
2. Stock lines. Run pattern G13 from cliche-and-copaganda.md on every spoken line. A line a
   viewer has heard from a hundred TV negotiators ("I'm not going anywhere", "Let me do the
   talking") is fix before ship, and a block when it fills the officer's only spoken slot.
3. Swap. Put this contradiction or layer on another officer unchanged. If it still fits, it is
   template, and fix before ship.
4. Because. Each layer explains a behavior a call can test, and never explains itself ("he
   listens because he is a listener" fails).

Officer-ethics checks. Answer yes or no, each with a quoted line as evidence. Any "no" blocks
approval, and an author's own "yes" is a claim the reviewer re-reads.

1. No trait gain or recovery requires force or entry.
2. Every strain fork includes a routine support option, and the option a player would take in
   one second states its cost and who pays it.
3. Every adverse call cited in an arc has all-safe civilian outcomes. Civilian harm is never an
   officer's arc fuel.
4. Every spoken callback fits the officer's role on that call or a recorded step.

Follow-up checks, each scored the same way. Seat neutrality (the bio holds in all 5 roles and
with all 6 traits), the calendar fields, every officer fork as a real dilemma with the tempting
option's cost named, ledger and schema honesty (officer death is not modeled), and
../swat-officer-stories/references/representation-checks.md. Persona notes in
src/content/personas.json (search `personalNote` if it moved) have no lint.

Also block a change that clears on a call that never tested it (a strain about entries cleared
on a call with no entry), because the player sees a manufactured result.

```
[block] officer person_016 | arc.strain.fork.options[0] | sees 'Pair with {Mentor} on the next entry' then 'Strain note cleared at Larkin Court' on a call with no entry step | rule officer cause | fix as data clear only on the next call with an entry step, and name the mentor's cost in the option | route swat-officer-stories (observed in a proof draft)
```

## 9. Depth (D1 to D10)

Question. Would a player remember this call a week later, and want to argue about what they did
in it? Correct is the floor. These gates fail a call that has zero defects. They come from the
depth bible (`docs/scenario-depth.md`, swat-call-design's lenses, psychology and patterns 15 and
the escalation palette), and only a separate reader can pass them.

| Gate | The test | Fails when | Severity |
|---|---|---|---|
| D1 Private logic | Read each key person's lines alone. Write their want, wound, self-lie and need | A key person has only a want, or two people share one voice | block |
| D2 Reframe | Name the earlier scene each situation's truth changes the meaning of | A situation only flips whether someone acts | block |
| D3 Escalation palette | Tag every adverse escalation on every path by mechanism | Fewer than four mechanisms in the call, or one mechanism more than twice on a path | block |
| D4 Blind voice | Strip the names from the subject's transcript lines and mix them with another call's | A reader can't tell whose lines are whose | fix before ship |
| D5 Argument | For each stage, write the case two players would make for two different options, on values | Every option's case is about odds or minutes | block |
| D6 Temptation | Find the call's lie, unapproved promise or tempting shortcut, and trace its cost on a path | None exists, its cost lands somewhere the player never saw, or it dominates | fix before ship |
| D7 The line | Quote the one sentence a player would repeat to someone else | No line is quotable. The owner makes the final pick | note, owner |
| D8 The after | Read every ending's epilogue alone | An ending stops at status, or an epilogue moralizes or invents an outcome (E11.2) | fix before ship |
| D10 Pretext | Read the cold open and Who they are, then stage 1 | A key person has no past the player can see by stage 1, or the cold open is a summary of the hook | fix before ship |
| D9 Replay | Play the same opening under each situation, back to back | Two situations read as the same person with different dice | fix before ship |

Reject. A new or rebuilt call that fails two or more of D1, D2, D3 and D5 goes back to
swat-call-design. Rewording can't fix a call with no psychology.

```
[block] hostage_crisis, all situations | situations[*].truth | sees the taker's want and the same pacing across s1 to s3; only whether he trades and whether he aims changes | rule D2 | fix as data a truth per situation that changes what the till scene meant (who counted the money) | route swat-call-design (observed, v13 pilot, 2026-10-19)
[block] hostage_crisis, all paths | adverse escalations | sees 'the handgun comes up at {owner.first}' as the escalation on 15 adverse results | rule D3 | fix as data draw the escalations from the palette, shame at the tape, the coworker's push, the bolt turned from outside | route swat-call-design (observed, v13 pilot, 2026-10-19)
```

## Categories, severities and routes

| Category | What it covers | Default route |
| --- | --- | --- |
| structure | who is in the call, choices, truths, stages, endings as dispositions | swat-call-design |
| line | wording of any string attached to a call | swat-call-prose |
| consistency | repeats, collisions, drift across variants | swat-call-prose, or engineering for a draw or binding fix |
| ethics | red lines and copaganda patterns | swat-call-design for structure, swat-call-prose for wording, human reviewer for identity |
| engine | compiler-owned strings, missing fields, gate gaps | engineering, as a written request |
| owner decision | policy, support-line surface, license | owner |

Officer text in any category routes to swat-officer-stories first.

Open owner decisions on 2026-10-06, to surface and never settle, were where a crisis support line appears, the clinical word policy for armed calls,
whether a call may end in custody, and the license.

## Vague and useful notes

| Vague | Useful |
| --- | --- |
| The hook is weak. | burglary.opening reads as a disclaimer (G2). Person and want are missing from the first five words. Draft line attached. |
| Choices feel samey. | Assess options sit at 92.9 favorable each and both summaries describe process (G1, test odds). Reason-to-pick lines could not be written. Rewrite the summaries so each names its cost. |
| Ending is off. | acted_on_report claims the resident confirmed a visit nobody checked (H7). Request a separate ending, line attached. |
| Too much repetition. | One waitFor sentence appears 10 times in the v12 depth layer. Ten per-type lines needed. |

A useful note names the field, quotes the player's view, cites the rule, carries the data and
names the owner. If any of those five is missing, the note is not ready.

## Verdict rules, restated for scoring

- approve. No block and no fix before ship finding remains, and the reader was separate.
- edit. Every block and fix before ship finding has a fix as data or a filed request with an
  owner, and no reject condition holds. A self-read verdict is never better than edit.
- reject. A stage's decision is not real, a red line is crossed, the truth leaks through
  structure, a blocker has no data fix, or a new or rebuilt call fails two or more of D1, D2,
  D3 and D5. The call goes back to swat-call-design.

## Pipeline checklist mapped to passes

The reviewer checklist in docs/content-pipeline.md (search "Reviewer checklist") has six items.
This table shows where each one is covered.

| Pipeline item | Pass |
| --- | --- |
| 1. Read situation 1 as a player. Is the decision real, and is either approach a reasonable first move? | Pass one cold read, pass two reason-to-pick lines and checklist |
| 2. Compare situations. Does anything before the check give the answer away? | Pass four side by side |
| 3. Are the people, rooms and building plausible together in all six samples? | Pass two path read across building families, batch audit name hygiene |
| 4. Are the endings honest about what the team did, and silent about what it didn't? | Pass four honesty list H1 to H10 |
| 5. Does it keep anatomy and method off the card, and allegations apart from facts? | Pass five ethics, G3 stacked hedges, cliche patterns C4 and C6 |
| 6. Does it pass the depth gates D1 to D9? | Pass six, the depth read (section 9) |

The pipeline items are paraphrased into question form here. The doc is the source.
