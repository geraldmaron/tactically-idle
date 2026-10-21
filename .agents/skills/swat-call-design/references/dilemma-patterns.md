# Dilemma patterns

This file holds the canonical fake-choice checklist, 15 dilemma patterns that fit three-stage
calls, and the escalation palette. swat-call-design and swat-writing-review each repeat the checklist word for
word. If a copy drifts, this one wins, and review files the drift as a consistency finding.

Every worked line below fits the budgets in swat-call-prose and the word lists in `prose-lint.ts` (checked by
eye against them on 2026-10-06, not by running `npm run check:strings`). All of it is illustrative. Never copy a
line into data.

## The canonical checklist

The fake-choice checklist. Reject a choice when any line is true.

1. Every option forecasts near-certain success, or all forecasts and costs are nearly identical.
2. Swapping the labels leaves the outcome text still fitting. The options differ only in wording.
3. One option is better on every axis, or one is an obvious trap.
4. The player can't say why they'd pick an option. Blind choices breed regret and frustration.
5. Nothing the player can see changes afterward, in evidence, a relationship, a person's safety, resources or the ending.
6. Waiting or opting out costs nothing. Opting out of the adventure makes a boring story.
7. A later stage forgets the choice.
8. Tone gives away the answer, with one option written warmly and the others as straw men.
9. A band label contradicts its text on some truth.
10. The mixed band is the favorable band plus time. A mixed result must change who is talking, what is known, where a person is, or what a later option costs.

Lines 9 and 10 were added in version 0.2.0. A copy in another skill that stops at line 8 has
drifted. Version 0.3.0 left the ten lines' wording unchanged and added tests below (visible
costs, phantom costs, the minutes rule, the payoff column and the per-option-set preview read),
so a copy that matches the ten lines has not drifted.

The tests that travel with it.

- Swap. Exchange two titles. If each outcome text still fits, the options differ only in
  wording.
- Tone. Read both options aloud. If one sounds kinder, braver or smarter, rewrite the other
  until neither does.
- Reason to pick. Write "A player picks <title> because it protects <good>, accepting <risk> to
  <who>." for every option. A blank is line 4. If one option's reason is "so I can choose better
  later", check that a reasonable player would sometimes skip it. If nobody would, the stage is
  an ordering, and its options do not exclude each other.
- Previews per visible option set (line 1). Compare the favorable previews of every option
  visible together in one state, not per stage, because context-gated options appear together.
  If two favorable lines name the same act by the same person ("Nate opens the door himself."
  and "Nate opens up by morning."), rewrite one so the preview states what makes it different
  (who opens, when, what it costs to get there).
- Dominance (line 3). Fill this grid for every stage, and again for every variant module or
  phone state that changes the summaries. Never judge line 3 by eye.

```
Dominance grid, stage <n>, variant <id>
| Option | Odds (to calibrate) | Minutes | Unlocks (flags, reveals) | Who pays on adverse | Charged by (field) | Cost the player sees ("<summary or preview string>") | Value it protects | Payoff only this option produces |
```

  If any option equals or beats another in every column, cut it or give the loser something
  only it protects. Four rules decide what a column may hold.

  1. Visible costs only. The grid is judged on what the player sees, the odds, the summary's
     cost and the preview. A cost that lives only in a modifier, a flag or this grid does not
     count. Quote the string that carries each option's cost. If the fastest, likeliest
     option's summary carries no concrete loss, it is dominant.
  2. No phantom costs. A "Who pays" cell counts only if some reachable path charges it. Name
     the field that does in "Charged by" (a truth branch, a modifier, a flag a later
     `visibleWhen` or context prompt reads, an ending gated on it, an objective that can fail).
     An empty "Charged by" cell is a phantom. Remove the option, or make the cost real in at
     least one situation (the kids in the hallway when the door opens, the neighbors objective
     failing on that path). Proof-run failure. "Call Nate before anyone moves" listed "the
     family, still home" as its cost, but every close set the neighbors safe, so calling first
     won on every column the engine enforced.
  3. Minutes are the idle player's main currency. A force or entry option that saves more than
     twice the minutes of the restraint option costs more than it on trust, strain and
     completion, all three, in every situation where it is reachable. Otherwise the stage fails
     E2 (force is never the reward), even if no row beats another on every column. Proof-run
     failure. Entry at 4 minutes against waiting at 50 to 360 passed "no row beats another"
     while being the throughput play.
  4. Values pay back. When a value option loses on odds and minutes, it wins in a column the
     player feels after the call (trust, strain, a debrief line, a later callback, a different
     disposition or reward). The payoff column names what only it produced. Two endings reached
     by competing options never carry identical trust and strain unless the record names the
     player-visible difference. Proof-run failure. "Ask Lewis to send Mara out first" beat "Ask
     Mara what she will sign" on odds and time, and both ended at the same ending with the same
     trust, so kindness read as a tax.
 Example from a proof run. "Call her daughter back" (better odds, 2 minutes,
  the key code and the weapon's history) beat "Call Lucia from the curb" (worse odds, 4 to 6
  minutes, contact only), and both shared one adverse result. The repair gives the curb call
  what only it protects, Lucia's own voice and her say, which the daughter call spends.
- Mixed (line 10). Read each option's favorable and mixed text side by side. "Lewis tells you
  what Monday is." against "Lewis tells you, after a long pause." fails. The mixed price can be
  smaller than the adverse one, but it must differ in kind. Judge it on effects, never on the
  prose. A flag the band sets that no later `Condition` reads is decoration, so a mixed band
  whose only difference is a dead flag plus minutes fails line 10 however different its text
  reads.
- Band against truth (line 9). Read each band's preview and result against every truth. If the
  favorable band holds a result the player would call a failure on some truth, the forecast
  lies. Carry hidden-truth risk in the summary and `consequenceLevel`, and give the bad-truth
  result its own `resultLabels`.
- Sure thing. If one option cannot fail, price it honestly in time, trust or strain, or it wins
  every time. Players weigh a certain outcome above a probable one.
- Waiting. Line 6 means waiting must cost something real, such as minutes, trust or a window.
  It never means waiting is the losing choice when it preserves life (E2).

## How to read a pattern

Each pattern names the two goods and the values behind them, the lever that carries it and the
lane where that lever exists, the stage it fits, the turn that reprices it, a worked stage, and
the trap it drifts toward with the repair. Values follow the moral foundations names (care,
fairness, loyalty, authority, liberty, sanctity), because two goods from the same value make a
weak dilemma.

## The patterns

### 1. Speed against certainty

- Goods. Care for a child who may be in danger, against fairness to a man who may be his
  father.
- Lever and lane. A choice taken before the check, with `if` outcomes on the fact and a `reveal`.
- Stage and turn. Stage 2. The check shows the report was wrong.
- Prompt. "A shopper says a man walked a crying child out of the toy aisle. Staff say the boy
  came in with his dad."
- A. "Stop the man at the doors." Fast. If he is the father, his son watches him stopped in
  front of everyone.
- B. "Check the camera first." Two minutes. If he is not the father, he is in the parking lot
  by then.
- Adverse for A. "He is the father. The boy cries harder, and the father asks for a
  supervisor."
- Trap and repair. The check always works, so speed is never worth it. Give the check a real
  failure (a second check, an unfinished call) and the gamble a real win.

### 2. The door against the person behind it

- Goods. Care for the person inside, against liberty (their home, their say).
- Lever and lane. Choices that fork on the person's answer (`if` on a fact), one routed to an
  entry node behind `authority: 'entry'`, one to a hold.
- Stage and turn. Stage 3. The person answers and refuses entry, or does not answer.
- Prompt. "Smoke from a pan is curling under the door. Nobody inside has answered in four
  minutes."
- A. "Force the door." He is reached now. His door won’t lock tonight, and he did not ask you
  in.
- B. "Wait for the landlord’s key." His door stays whole. The kitchen fills for six more
  minutes.
- Adverse for B. "The landlord is still across town. The smoke alarm inside has started."
- Trap and repair. The person is never at risk, so forcing is a trap. Land both costs on the
  same person (E6).

### 3. The first account against an independent source

- Goods. Loyalty and respect for the person involved, against fairness through a neutral
  record.
- Lever and lane. Two stage 1 choices that reveal different facts, and a follow-up choice behind
  `onlyIf` when the sources disagree.
- Stage and turn. Stage 1. The independent source disagrees with the first account.
- Prompt. "The night manager says it’s the back sensor again. Patrol hasn’t looked at the back
  yet."
- A. "Hear the manager out." He relaxes and helps later. You hear his version before anyone
  else’s.
- B. "Pull the alarm log first." One extra minute. He waits outside and says so.
- Adverse for B. "He stops answering questions and asks why nobody believes him."
- Trap and repair. The standard consequence lines come from the compiler, so designers forget the
  cost the choice itself carries. Write each cost in the choice `summary` and `preview`.

### 4. Wait for the right resource against act now with less

- Goods. Care now, against care done right.
- Lever and lane. A hold choice with `minutes` or `span`, and a clock for the arrival.
- Stage and turn. Stage 2 or 3. The arrival time changes, or the person's patience does.
- Prompt. "The crew is 14 minutes out. He is cold and wants to get up off the bathroom floor."
- A. "Help him up now." He is warm sooner. If something is hurt, you find out halfway up.
- B. "Keep him warm until the crew arrives." Fourteen minutes on the floor, and he says so
  every two.
- Adverse for A. "He can’t take his weight halfway up. The team lowers him back down, and the
  crew is still 12 minutes out."
- Trap and repair. The resource always arrives on time. Make arrival public and fixed, and let
  waiting cost what it costs.

### 5. Keep talking against act while you can (the hold)

- Goods. Care through rapport, against care through a window that may close.
- Lever and lane. `promptIf`, `if` outcomes on a fact and the tree's pressure model.
- Stage and turn. Stage 2. The person goes quiet.
- Prompt. "He has stopped answering. The line is still open, and the TV inside has gone quiet."
- A. "Say nothing and wait." He may fill the silence. If he doesn’t, the quiet is spent.
- B. "Move up to the door now." Closer if something changes. He will hear the stairs.
- Adverse for B. "He hears the stairs and hangs up. The line rings out."
- Trap and repair. Waiting is free, or waiting always loses. Give it a time cost and a real
  chance to fail, and never make it the losing choice by design (E2).

### 6. The person's choice against their safety

- Goods. Liberty (her home, her call), against care.
- Lever and lane. Two endings with `followup_agreed` and `care_accepted`, and a hold choice.
- Stage and turn. Stage 3. The person refuses the help the team came to give.
- Prompt. "She says she is fine and wants everyone gone. Her son says she hasn’t eaten in two
  days."
- A. "Leave her with her son checking in." Her home, her call. If she is worse than she says,
  nobody is there tonight.
- B. "Keep asking about a doctor." She may agree. She may also stop opening the door to anyone.
- Adverse for B. "She asks the team to leave and locks the door behind them."
- Trap and repair. Her choice is written as foolish so care wins. Write her reasons as reasons,
  such as years of managing alone.

### 7. The promise against the clock

- Goods. Loyalty (keep your word to him), against authority (promise only what command
  approves, E12).
- Lever and lane. An outcome `promise` and `authority: { concede }`.
- Limits (E12, concessions). Every offer names command's approval and offers only what the
  team itself can do, such as writing his account down and passing it on. Never a third
  party's process (a board, a court), and never a held person asked to sign or bargain.
- Stage and turn. Stage 2. The demand changes after an offer.
- Prompt. "He wants an hour on the phone with his sister before anyone comes near the door.
  Command hasn’t answered."
- A. "Promise what command allows." He hears a smaller offer now. He may stop talking.
- B. "Ask command before you answer." Two quiet minutes on the line while you wait.
- Adverse for A. "He says that isn’t enough and hangs up. It rings twice before he answers
  again."
- Trap and repair. A free promise. An honest option may promise no more than command approved,
  so the cost lives in what can be offered. A promise past that is a lie, and it follows
  pattern 15.

### 8. Release one now against the agreement that covers everyone

- Goods. Care for one person now, against fairness to everyone still inside.
- Lever and lane. Release steps as `out` and `safe` on outcomes with a `promise`, as in
  `hostage-live.ts`.
- Stage and turn. Stage 2. Once one person leaves, the one left behind changes the math.
- Prompt. "He will let the courier go now if the owner stays. The courier is at the door with
  his bag."
- A. "Take the courier now." One person out. The owner is alone with him, and he knows you said
  yes.
- B. "Hold out for both." Nobody leaves yet. He may decide the offer is gone.
- Adverse for B. "He tells the courier to sit back down."
- Trap and repair. Holding out always works. Both answers must risk someone.

### 9. Care for the subject against protecting a bystander

- Goods. Care for one person, against care for another.
- Lever and lane. `safe` and `harm` on outcomes for two people, and `onlyIf` on public position.
- Stage and turn. Stage 3. A bystander moves into the scene.
- Prompt. "His neighbor is on the landing with her phone up. He won’t come down while she’s
  there."
- A. "Move the neighbor back." He may come down. She argues, and the landing gets loud.
- B. "Keep talking while she stays." Calm for now. If he comes down angry, she is two steps
  away.
- Adverse for A. "She shouts that she lives here. He goes back inside and shuts the door."
- Trap and repair. The bystander is a prop. Give them a role and a reason to be there.

### 10. The tired officer against the right officer

- Goods. Care for the team, against the best chance for the person.
- Lever and lane. Choice `requires` (certs, tags) and `stress`. The briefing
  recommendation slot is design only until R4.
- Stage and turn. Stage 1 or 3. The cost surfaces on the roster after the call.
- Prompt. "One officer on the squad has talked someone through a door before. She has been on
  for eleven hours."
- A. "Send her up." Best chance he keeps talking. Her strain carries into tomorrow’s roster.
- B. "Send the rested officer." Steady and fresh. He has not done this before, and it may show.
- Adverse for B. "The man asks who he is talking to now, twice."
- Trap and repair. Strain is invisible, so the tired officer is free. Show the roster cost, and
  leave what it does to her to swat-officer-stories.

### 11. Act on the report against confirming it

- Goods. Fairness to the person the report describes, against care for the caller's fear.
- Lever and lane. A choice taken before the check, with `if` outcomes on the fact.
- Stage and turn. Stage 2. The owner calls back.
- Prompt. "A neighbor reports a stranger letting himself in next door. He says he’s the owner’s
  nephew and has a key."
- A. "Take him at his word and close it." Quick, and he is treated as a guest. If the owner
  says no, you reopen it in front of him.
- B. "Call the owner first." Slower. He waits on the step while you call, and the street
  watches.
- Adverse for B. "The owner doesn’t pick up. He has been on the step ten minutes and says so."
- Trap and repair. The report is always right or always wrong. Vary the truth across situations
  and keep both readings plausible from the card.

### 12. The negotiator's clock against command's clock

- Goods. Care through time, against authority and the needs of people outside the call.
- Lever and lane. A clock or `CallTree.pressure` with a stated reason, plus the recommendation
  slot.
- Stage and turn. Stage 2. The outside clock moves.
- Prompt. "The negotiator wants another hour. The street has been shut since noon, and the
  school lets out at 3."
- A. "Give the negotiator the hour." Time on his side. Two hundred children walk out past the
  tape at 3.
- B. "Plan the move for 2:45." The street reopens on time. He has fifteen fewer minutes to
  decide.
- Before and after, the commander's will. The player is command, so titles are the act. Before,
  "Ask command to go in", with a summary that opens "Command approves." The approval is
  automatic, so the ask is ceremony. After, "Send the shield to her door", with the cost line
  naming what the move risks. Oversight appears only when it can refuse or delay, and then the
  refusal has a price ("The negotiator objects. If command overrules, he stops talking for ten
  minutes.").
- Adverse for A. "The school lets out into the cordon, and command pulls two officers to the
  gate."
- Trap and repair. Command's clock reads as impatience. Give it a reason nobody can stop (E10),
  and write both as professionals.

### 13. Dignity against the crowd at the tape

- Goods. Sanctity (her dignity), against speed and the chance she changes her mind.
- Lever and lane. An exit route choice with `walks` (the engine checks the doors on the way).
- Stage and turn. Stage 3. The person agrees to come out.
- Prompt. "She has agreed to come out. Thirty people are at the tape with their phones up."
- A. "Walk her out the front now." Quick. Her face is on thirty phones before she reaches the
  car.
- B. "Take the back stairs." Eight more minutes. She may change her mind on the stairs.
- Adverse for B. "She stops on the back stairs and says she wants to go back up."
- Trap and repair. The crowd is scenery. Make the front route cost her something she said she
  cared about.

### 14. Finish against follow up

- Goods. Fairness to the next call waiting, against care for the person this one left behind.
- Lever and lane. `remainingTasks` on the ending and the `resolved` or `followup_agreed`
  dispositions, with a hold choice.
- Stage and turn. Stage 3 and the ending. Something left undone surfaces.
- Prompt. "The leak is stopped. The tenant upstairs still doesn’t know anyone has been in her
  flat."
- A. "Wait to tell her in person." She hears it from a face. The squad sits idle for forty
  minutes.
- B. "Leave a note and clear the call." The squad is free. She comes home to a note and a wet
  floor.
- Adverse for B. "She calls that night, upset, and asks who was in her home."
- Trap and repair. The follow-up is free. Price the squad's time and show the next call
  waiting.

### 15. The temptation: a lie or a promise past command

- Goods. Care for the person a lie frees now, against the fairness and trust every later step
  runs on. The player chooses between a sure gain now and a debt they can see coming.
- Lever and lane. `deceives` on the choice (engine lane, `deception-commitments`): it makes a
  commitment command never approved. It breaks when the promised thing is still undelivered
  where the tree says it must be, and later choices read `kept` or `broken`.
- Rules.
  - The summary says plainly that it is a lie, or that command can't deliver it. The player is
    never tricked into lying.
  - The favorable band is better than any honest option's favorable band right now. Otherwise
    nobody is tempted.
  - The break has a visible cue before it bites (a prompt, a transcript line, a person asking
    for the thing). The gate fails a deception without one.
  - The break changes what the player can do next: an option locks, a person stops trusting the
    negotiator, or an ending turns.
  - At most one deception per stage. Never lie to a hostage about their own safety in a way that
    makes them act against it.
- Stage and turn. Stage 1 or 2 for the lie, stage 3 for the break.
- Prompt. "He'll free the courier the moment the owner agrees to sign. She hasn't."
- A. "Tell him she'll sign." Command can't deliver it. The courier walks now, and he will ask to
  see the page.
- B. "Tell him the truth: she won't." The courier may stay on the boxes.
- Adverse for A at the break. "He asks the owner to read it out. She says she never agreed, and
  the line goes dead."
- Trap and repair. The lie is the best choice on every axis, or its cost lands somewhere the
  player never saw. Price the break in a person, not a number, and cue it first.

## The escalation palette

When a result goes badly, the reason it goes badly is part of the story. A call draws its
adverse escalations from at least four of these, and repeats no one of them more than twice on
a path (D3). Each one asks for a different answer, so the stage 3 options can differ by which
one is in play.

| Mechanism | What tips the person | What answers it | Example result |
|---|---|---|---|
| Shame spiral | The wound touched in front of others | Privacy, an apology from the right person | "The regulars at the tape can hear every word. He stops answering." |
| The crowd | Being watched: a chant, a phone held up | Moving the audience, a face-saving exit | "A phone goes up at the tape, and he moves to the window." |
| The partner | Someone beside them pushing | Separating them, talking to the partner | "His coworker says something low, and he picks the handgun back up." |
| Lost control | Something done without their say | Giving back a small control | "The bolt was his. When it turns from outside, he shouts." |
| A deadline passing | A time they set runs out | A reason to reset it they can accept | "Six o'clock comes. He said six." |
| The call from home | Family on the line or at the tape | Using or blocking the contact, at a cost | "His daughter's name comes up on his phone. He doesn't answer it." |
| Bargaining collapse | The deal they built falls apart | A smaller deal, honestly offered | "The page is finished. She still won't sign it." |
| Withdrawal | They stop caring what happens | Something they still care about | "He says it doesn't matter now. He sounds calm." |

Withdrawal in an armed or weapon-reaching person is a self-harm sign. It brings in E4 in full.

## A worked pair

Stage 3 of the Iris sheet (design-sheet.md), after the check finds Iris on the floor asking the
team not to break her door. Illustrative.

| Choice | Protects | Costs, and who pays | Adverse picture the player should foresee |
|---|---|---|---|
| Force the door | Iris, minutes sooner | Her lock, and the one thing she asked for | "The lock holds. Iris hears the team at it from the floor and asks again." |
| Wait for the niece's key | Her door and her say over who comes in | About 20 minutes, which Iris spends on a cold floor | "The niece's car won't start. Iris has stopped answering the letterbox." |

Both options can end the call on their favorable band, which every stage 3 option must.

## Rejected dilemmas, with repairs

| Rejected | Lines it trips | Repair |
|---|---|---|
| "Rush in recklessly" against "Proceed with caution" | 3 and 8, a strawman written in mood words | "Go in now, without the shield" against "Wait two minutes for the shield", each with what it risks and who pays |
| "Ask the neighbor what she saw" beside "Check the door", with no cost on the first | 3, a free option every player takes | Price it in a minute, or in the person inside hearing voices on the landing |
| "Gently reassure Ada" against "Barge in" | 8, a tone tilt | "Keep Ada talking at the door" against "Ask Ada to let you in now", each with its cost |
| "Bring the crew up now" at stage 3, worst odds, slower, and its best result resolves nothing | 3, a trap at the commit beat | Move the setup step to stage 1 as a precaution, or cut it |
| "Put the entry team at the back door" as an optional stage 2 step that costs trust | 6, readiness written as a hawkish choice and its absence as restraint | Containment is the default (E12). Make the trade how close and how visible, "Move the team up to the back door, where Lewis may hear them" |
| "Offer to send his side to the board" | 3 and E12, a promise the team cannot keep | "Take down his account for command to pass on", with command's approval in the summary |
| "Tell him she'll sign" written as an ordinary offer | 3 and 8, a lie presented as honest, with no cost in sight | Write it as pattern 15: the summary says command can't deliver it, and its break is cued before it lands |
| A threat beat used on every adverse result ("the handgun comes up at her") | 5 and 10 across the call, one psychology | Draw each adverse escalation from the palette below, at most twice per path (D3) |
